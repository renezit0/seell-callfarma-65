import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache para a chave pública
let cachedPublicKey: string | null = null;
let keyExpiresAt: number | null = null;

/**
 * Busca a chave pública da API CallFarma
 */
async function getPublicKey(): Promise<string> {
  // Verificar cache
  if (cachedPublicKey && keyExpiresAt && Date.now() < keyExpiresAt) {
    return cachedPublicKey;
  }
  
  try {
    const response = await fetch('https://apiv2.callfarma.com.br:8443/api/v1/public-key', {
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar chave pública: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.key) {
      cachedPublicKey = data.key;
      keyExpiresAt = data.expiresAt || (Date.now() + 3600000); // 1 hora
      console.log('🔑 Chave pública obtida com sucesso');
      return cachedPublicKey;
    }
    
    throw new Error('Resposta da API não contém chave pública');
  } catch (error) {
    console.error('❌ Erro ao buscar chave pública:', error);
    throw error;
  }
}

/**
 * Gera o modificador baseado no timestamp
 */
function generateModifier(timestamp: string): string {
  const reversed = timestamp.split('').reverse().join('');
  const firstFour = reversed.substring(0, 4);
  const mod = parseInt(firstFour, 10) % 997;
  return mod.toString(16);
}

/**
 * Gera a assinatura X-Request-Sign
 */
async function generateSignature(
  method: string,
  pathname: string,
  timestamp: string,
  body: any,
  publicKey: string
): Promise<string> {
  // 1. Gerar modificador
  const modifier = generateModifier(timestamp);
  
  // 2. Stringificar body se existir
  const bodyStr = body ? JSON.stringify(body) : '';
  
  // 3. Concatenar com separador ';_'
  const stringToSign = `${modifier};_${pathname};_${timestamp};_${method};_${bodyStr}`;
  
  // 4. Gerar HMAC-SHA256
  const encoder = new TextEncoder();
  const keyData = encoder.encode(publicKey);
  const dataToSign = encoder.encode(stringToSign);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const hmacBuffer = await crypto.subtle.sign('HMAC', cryptoKey, dataToSign);
  const hmacArray = Array.from(new Uint8Array(hmacBuffer));
  const hmacHash = hmacArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // 5. Gerar SHA256 do (hmac + modifier)
  const finalString = hmacHash + modifier;
  const finalBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(finalString));
  const finalArray = Array.from(new Uint8Array(finalBuffer));
  const finalHash = finalArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // 6. Retornar hash + primeiros 6 caracteres
  return finalHash + finalHash.substring(0, 6);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authToken = Deno.env.get('CALLFARMA_API_TOKEN');
    
    if (!authToken) {
      throw new Error('Token de autenticação da API Callfarma não configurado');
    }

    const { endpoint, params } = await req.json();
    
    console.log(`Chamando endpoint: ${endpoint} com parâmetros:`, params);

    const baseUrl = 'https://apiv2.callfarma.com.br:8443';
    
    // Construir URL com parâmetros
    let url = `${baseUrl}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      if (searchParams.toString()) {
        url += `?${searchParams.toString()}`;
      }
    }

    console.log(`URL final: ${url}`);

    // Gerar timestamp
    const requestTime = Math.floor(Date.now() / 1000).toString();
    
    // Buscar chave pública
    const publicKey = await getPublicKey();
    
    // Gerar assinatura
    const signature = await generateSignature('GET', endpoint, requestTime, null, publicKey);
    
    const headers: Record<string, string> = {
      'accept': 'application/json',
      'authorization': `Bearer ${authToken}`,
      'x-auth-code': '1',
      'x-client-id': '6582',
      'x-request-time': requestTime,
      'x-request-sign': signature,
    };
    
    // Adicionar headers extras para vendas-por-periodo
    if (endpoint === '/financeiro/vendas-por-periodo') {
      headers['origin'] = 'https://coc.callfarma.com.br';
      headers['referer'] = 'https://coc.callfarma.com.br/';
    }
    
    console.log('Headers sendo enviados:', JSON.stringify(headers));
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Erro na API: ${response.status} - ${response.statusText}`);
      console.error(`Corpo da resposta:`, errorBody);
      throw new Error(`Erro na API externa: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Dados recebidos - Status: ${response.status}`);
    console.log(`Tipo de dado: ${Array.isArray(data) ? 'array' : typeof data}`);
    console.log(`Registros: ${data?.msg?.length || 0}`);

    // Retornar dados conforme formato da API
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na função callfarma-vendas:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Erro ao buscar dados da API externa'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});