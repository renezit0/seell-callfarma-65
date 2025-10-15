import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${authToken}`,
        'x-auth-code': '1',
      },
    });

    if (!response.ok) {
      console.error(`Erro na API: ${response.status} - ${response.statusText}`);
      throw new Error(`Erro na API externa: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Dados recebidos:`, data);

    // Separar vendas por usuário e por loja
    const vendasUsuario = data.filter((v: any) => v.usuario_id && v.usuario_id === params.usuario_id) || [];
    const vendasLoja = data.filter((v: any) => v.loja_id && v.loja_id === params.loja_id) || [];

    const resultado = {
      vendas_usuario: vendasUsuario,
      vendas_loja: vendasLoja,
      total_registros: data?.length || 0
    };

    console.log(`Processado: ${vendasUsuario.length} vendas do usuário, ${vendasLoja.length} vendas da loja`);

    return new Response(JSON.stringify(resultado), {
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