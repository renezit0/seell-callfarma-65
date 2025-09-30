import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4"
import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Usuario {
  id: number;
  nome: string;
  login: string;
  tipo: string;
  loja_id: number;
  status: string;
  CPF?: string;
  matricula?: string;
  email?: string;
  data_contratacao?: string;
  loja_nome?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let client: Client | null = null;

  try {
    // Conectar ao MySQL
    client = await new Client().connect({
      hostname: "69.6.213.99",
      username: "flavi071_flavio",
      password: "Fr@286030",
      db: "flavi071_farmagestaodb",
      port: 3306
    });

    const { action, loja_id, user_type, login, senha } = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const actionParam = url.searchParams.get('action') || action;

    if (actionParam === 'fetch_usuarios') {
      // Construir query baseada nos filtros
      let query = `SELECT u.*, l.nome as loja_nome 
                   FROM usuarios u 
                   LEFT JOIN lojas l ON u.loja_id = l.id 
                   WHERE u.status = 'ativo'`;
      
      const params: any[] = [];
      
      if (loja_id && loja_id !== 'null' && loja_id !== null) {
        query += ` AND u.loja_id = ?`;
        params.push(loja_id);
      }
      
      if (user_type && user_type !== 'all' && user_type !== 'todos') {
        query += ` AND u.tipo = ?`;
        params.push(user_type);
      }
      
      query += ` ORDER BY u.nome`;

      const result = await client.execute(query, params);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: result.rows || [],
          message: `${result.rows?.length || 0} usuários encontrados` 
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    if (actionParam === 'authenticate') {
      // Limpar CPF (remover pontos, traços, espaços) para comparação
      const cleanCpf = (cpf: string) => cpf.replace(/[.\-\s]/g, '');
      const cleanedLogin = cleanCpf(login);
      
      // Buscar por login direto, CPF limpo, ou CPF formatado
      const authQuery = `SELECT u.*, l.nome as loja_nome, l.numero as loja_numero 
                        FROM usuarios u 
                        LEFT JOIN lojas l ON u.loja_id = l.id 
                        WHERE (u.login = ? OR u.CPF = ? OR u.CPF = ?) 
                        AND u.senha = ? AND u.status = 'ativo'`;
      
      const result = await client.execute(authQuery, [login, cleanedLogin, login, senha]);
      
      if (result.rows && result.rows.length > 0) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: result.rows[0],
            message: "Autenticação bem-sucedida" 
          }),
          { 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json' 
            } 
          }
        );
      } else {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "Credenciais inválidas" 
          }),
          { 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json' 
            } 
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: false, message: 'Ação não suportada' }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Erro na edge function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Erro interno do servidor',
        error: error.message 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } finally {
    // Fechar conexão MySQL
    if (client) {
      await client.close();
    }
  }
})