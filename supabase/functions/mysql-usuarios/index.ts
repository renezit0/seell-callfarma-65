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

    const { action, loja_id, user_type, login, senha, fetch_metas, fetch_folgas, periodo_meta_id, usuario_id, data_inicio, data_fim } = await req.json().catch(() => ({}));
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
      console.log('🔐 Autenticação - Login:', login);
      
      // Limpar CPF (remover pontos, traços, espaços) para comparação
      const cleanCpf = (cpf: string) => cpf.replace(/[.\-\s]/g, '');
      const cleanedLogin = cleanCpf(login);
      
      // Buscar usuário por login direto ou CPF (limpo/formatado)
      const authQuery = `SELECT u.*, l.nome as loja_nome, l.numero as loja_numero 
                        FROM usuarios u 
                        LEFT JOIN lojas l ON u.loja_id = l.id 
                        WHERE (u.login = ? OR u.CPF = ? OR u.CPF = ?) 
                        AND u.status = 'ativo'`;
      
      const result = await client.execute(authQuery, [login, cleanedLogin, login]);
      
      if (result.rows && result.rows.length > 0) {
        const user = result.rows[0];
        const storedPassword = user.senha;
        
        console.log('👤 Usuário encontrado:', user.nome);
        console.log('🔐 Verificando senha...');
        
        // Por enquanto, usar apenas texto plano até corrigir bcrypt no Deno
        const senhaCorreta = (senha === storedPassword);
        
        if (senhaCorreta) {
          console.log('✅ Autenticação bem-sucedida!');
          return new Response(
            JSON.stringify({ 
              success: true, 
              data: user,
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
          console.log('❌ Senha incorreta');
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
      } else {
        console.log('❌ Usuário não encontrado');
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

    // Buscar metas
    if (actionParam === 'fetch_metas' || fetch_metas) {
      console.log('📊 Buscando metas...');
      
      // Buscar períodos ativos
      if (action === 'get_periodos') {
        const query = `SELECT * FROM periodos_meta WHERE status = 'ativo' ORDER BY data_inicio DESC`;
        const result = await client.execute(query);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: result.rows || [] 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Buscar colaboradores com metas
      if (action === 'get_colaboradores_metas') {
        let usuariosQuery = `SELECT u.id, u.nome, u.tipo, u.loja_id 
                           FROM usuarios u 
                           WHERE u.status = 'ativo' 
                           AND u.tipo IN ('auxiliar', 'consultora', 'farmaceutico', 'lider', 'sublider', 'subgerente', 'gerente')`;
        
        const params: any[] = [];
        
        if (loja_id && loja_id !== 'null') {
          usuariosQuery += ` AND u.loja_id = ?`;
          params.push(loja_id);
        }
        
        if (usuario_id) {
          usuariosQuery += ` AND u.id = ?`;
          params.push(usuario_id);
        }
        
        usuariosQuery += ` ORDER BY u.nome`;
        
        const usuariosResult = await client.execute(usuariosQuery, params);
        const usuarios = usuariosResult.rows || [];
        
        // Buscar metas
        if (usuarios.length > 0 && periodo_meta_id) {
          const usuarioIds = usuarios.map((u: any) => u.id);
          const metasQuery = `SELECT * FROM metas WHERE periodo_meta_id = ? AND usuario_id IN (${usuarioIds.map(() => '?').join(',')})`;
          const metasResult = await client.execute(metasQuery, [periodo_meta_id, ...usuarioIds]);
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              data: {
                usuarios: usuarios,
                metas: metasResult.rows || []
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: { usuarios, metas: [] }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Buscar metas de lojas
      if (action === 'get_metas_lojas') {
        let query = `SELECT ml.*, l.nome as loja_nome, l.numero 
                    FROM metas_loja ml 
                    LEFT JOIN lojas l ON ml.loja_id = l.id 
                    WHERE ml.periodo_meta_id = ?`;
        
        const params: any[] = [periodo_meta_id];
        
        if (loja_id && loja_id !== 'null') {
          query += ` AND ml.loja_id = ?`;
          params.push(loja_id);
        }
        
        query += ` ORDER BY ml.loja_id`;
        
        const metasResult = await client.execute(query, params);
        
        // Buscar categorias das metas
        if (metasResult.rows && metasResult.rows.length > 0) {
          const metaLojaIds = metasResult.rows.map((m: any) => m.id);
          const categoriasQuery = `SELECT * FROM metas_loja_categorias WHERE meta_loja_id IN (${metaLojaIds.map(() => '?').join(',')})`;
          const categoriasResult = await client.execute(categoriasQuery, metaLojaIds);
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              data: {
                metas_loja: metasResult.rows,
                categorias: categoriasResult.rows || []
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: { metas_loja: metasResult.rows || [], categorias: [] }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Buscar folgas
    if (actionParam === 'fetch_folgas' || fetch_folgas) {
      console.log('📅 Buscando folgas...');
      
      let query = `SELECT f.*, u.nome as usuario_nome 
                  FROM folgas f 
                  LEFT JOIN usuarios u ON f.usuario_id = u.id 
                  WHERE 1=1`;
      
      const params: any[] = [];
      
      if (data_inicio) {
        query += ` AND f.data_folga >= ?`;
        params.push(data_inicio);
      }
      
      if (data_fim) {
        query += ` AND f.data_folga <= ?`;
        params.push(data_fim);
      }
      
      if (loja_id && loja_id !== 'null') {
        query += ` AND u.loja_id = ?`;
        params.push(loja_id);
      }
      
      if (usuario_id) {
        query += ` AND f.usuario_id = ?`;
        params.push(usuario_id);
      }
      
      query += ` ORDER BY f.data_folga DESC`;
      
      const result = await client.execute(query, params);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: result.rows || [] 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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