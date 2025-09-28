import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4"
import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts"

// Função simples para verificar senha bcrypt manualmente
async function verifyBcryptPassword(password: string, hash: string): Promise<boolean> {
  try {
    // Usar implementação mais robusta do bcrypt
    const response = await fetch(`https://api.bcrypt.online/v1/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, hash })
    });
    
    if (response.ok) {
      const result = await response.json();
      return result.match === true;
    }
  } catch (error) {
    console.error('Erro na verificação bcrypt online:', error);
  }
  
  // Fallback: comparação simples se a API não funcionar
  return false;
}

// Função alternativa para verificar senha
async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    console.log('Verificando senha. Hash:', hashedPassword.substring(0, 20) + '...');
    
    // Se for bcrypt hash
    if (hashedPassword.startsWith('$2y$') || hashedPassword.startsWith('$2a$') || hashedPassword.startsWith('$2b$')) {
      console.log('Detectado hash bcrypt, tentando verificar...');
      
      // Tentar verificação online primeiro
      const bcryptResult = await verifyBcryptPassword(password, hashedPassword);
      if (bcryptResult) return true;
      
      // Se falhar, tentar importar bcrypt dinamicamente
      try {
        const bcrypt = await import("https://deno.land/x/bcrypt@v0.4.1/mod.ts");
        return await bcrypt.compare(password, hashedPassword);
      } catch (e) {
        console.log('Erro com bcrypt, falha na verificação:', e instanceof Error ? e.message : String(e));
        return false; // Retornar false se não conseguir verificar bcrypt
      }
    } else {
      // Senha em texto plano
      console.log('Comparando senha em texto plano');
      return password === hashedPassword;
    }
  } catch (error) {
    console.error('Erro geral na verificação de senha:', error);
    return false;
  }
}

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
      
      // Construir consulta flexível para CPF como no PHP original
      let authQuery = `SELECT u.*, l.nome as loja_nome, l.numero as loja_numero 
                      FROM usuarios u 
                      LEFT JOIN lojas l ON u.loja_id = l.id 
                      WHERE u.login = ?`;
      const queryParams = [login];
      
      // Se o input parece ser um CPF (só números)
      if (cleanedLogin.length > 0 && /^\d+$/.test(cleanedLogin)) {
        // Buscar por CPF exato
        authQuery += ` OR u.CPF = ?`;
        queryParams.push(login);
        
        // Se o CPF tem menos de 11 dígitos, buscar também com zeros à esquerda
        if (cleanedLogin.length < 11) {
          const cpfComZeros = cleanedLogin.padStart(11, '0');
          authQuery += ` OR u.CPF = ?`;
          queryParams.push(cpfComZeros);
        }
        
        // Se o CPF tem 11 dígitos, buscar também sem o zero inicial
        if (cleanedLogin.length === 11 && cleanedLogin[0] === '0') {
          const cpfSemZero = cleanedLogin.replace(/^0+/, '');
          if (cpfSemZero) {
            authQuery += ` OR u.CPF = ?`;
            queryParams.push(cpfSemZero);
          }
        }
        
        // Buscar por CPF apenas com números
        if (cleanedLogin !== login) {
          authQuery += ` OR u.CPF = ?`;
          queryParams.push(cleanedLogin);
        }
      }
      
      authQuery += ` AND u.status = 'ativo'`;
      
      const result = await client.execute(authQuery, queryParams);
      
      if (result.rows && result.rows.length > 0) {
        const usuario = result.rows[0];
        const senhaArmazenada = usuario.senha;
        let autenticado = false;
        
        // Verificar senha usando a função compatível
        console.log('Usuário encontrado:', usuario.login, 'ID:', usuario.id);
        console.log('Tentando verificar senha...');
        
        autenticado = await verifyPassword(senha, senhaArmazenada);
        console.log('Resultado da verificação:', autenticado);
        
        // Se autenticou e senha era texto plano, não atualizar por enquanto
        // para evitar problemas durante os testes
        
        if (!autenticado) {
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
      
      // Se chegou aqui, a autenticação foi bem-sucedida
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
    }

    // Adicionar suporte para buscar folgas
    if (actionParam === 'fetch_folgas') {
      const { usuario_id, data_inicio, data_fim, periodo_id } = await req.json().catch(() => ({}));
      
      let query = '';
      let params: any[] = [];
      
      if (periodo_id) {
        // Buscar folgas por período - primeiro pegar as datas do período
        query = `
          SELECT f.folga_id, f.usuario_id, f.data_folga, f.observacao, f.data_registro,
                 u.nome as nome_usuario, u.tipo as tipo_usuario
          FROM folgas f
          JOIN usuarios u ON f.usuario_id = u.id
          WHERE f.usuario_id = ? 
            AND f.data_folga BETWEEN (
              SELECT data_inicio FROM periodos_meta WHERE id = ?
            ) AND (
              SELECT data_fim FROM periodos_meta WHERE id = ?
            )
          ORDER BY f.data_folga ASC
        `;
        params = [usuario_id, periodo_id, periodo_id];
      } else if (data_inicio && data_fim) {
        // Buscar folgas por intervalo de datas
        query = `
          SELECT f.folga_id, f.usuario_id, f.data_folga, f.observacao, f.data_registro,
                 u.nome as nome_usuario, u.tipo as tipo_usuario
          FROM folgas f
          JOIN usuarios u ON f.usuario_id = u.id
          WHERE f.usuario_id = ? AND f.data_folga BETWEEN ? AND ?
          ORDER BY f.data_folga ASC
        `;
        params = [usuario_id, data_inicio, data_fim];
      } else {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Parâmetros inválidos para buscar folgas' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const result = await client.execute(query, params);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: result.rows || [],
          message: `${result.rows?.length || 0} folgas encontradas` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Adicionar suporte para buscar metas
    if (actionParam === 'fetch_metas') {
      const { periodo_id, loja_id } = await req.json().catch(() => ({}));
      
      let query = `
        SELECT m.*, u.nome as nome_usuario, u.tipo as tipo_usuario
        FROM metas m
        JOIN usuarios u ON m.usuario_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];
      
      if (periodo_id) {
        query += ` AND m.periodo_meta_id = ?`;
        params.push(periodo_id);
      }
      
      if (loja_id) {
        query += ` AND u.loja_id = ?`;
        params.push(loja_id);
      }
      
      query += ` ORDER BY u.nome ASC`;
      
      const result = await client.execute(query, params);
      
    // Adicionar suporte para buscar dados da loja
    if (actionParam === 'fetch_loja') {
      const { loja_id } = await req.json().catch(() => ({}));
      
      if (!loja_id) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'ID da loja não informado' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const query = `SELECT id, numero, nome FROM lojas WHERE id = ?`;
      const result = await client.execute(query, [loja_id]);
      
      if (result.rows && result.rows.length > 0) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: result.rows[0],
            message: "Loja encontrada" 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "Loja não encontrada" 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Adicionar suporte para registrar folga
    if (actionParam === 'registrar_folga') {
      const { usuario_id, data_folga, observacao } = await req.json().catch(() => ({}));
      
      if (!usuario_id || !data_folga) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Parâmetros obrigatórios não informados' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Verificar se já existe folga nesta data
      const checkQuery = `SELECT folga_id FROM folgas WHERE usuario_id = ? AND data_folga = ?`;
      const existingResult = await client.execute(checkQuery, [usuario_id, data_folga]);
      
      if (existingResult.rows && existingResult.rows.length > 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Já existe uma folga registrada nesta data' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Inserir nova folga
      const insertQuery = `INSERT INTO folgas (usuario_id, data_folga, observacao, data_registro) VALUES (?, ?, ?, NOW())`;
      const result = await client.execute(insertQuery, [usuario_id, data_folga, observacao || '']);
      
      if (result.affectedRows && result.affectedRows > 0) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Folga registrada com sucesso' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Erro ao registrar folga' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Adicionar suporte para remover folga
    if (actionParam === 'remover_folga') {
      const { folga_id } = await req.json().catch(() => ({}));
      
      if (!folga_id) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'ID da folga não informado' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const deleteQuery = `DELETE FROM folgas WHERE folga_id = ?`;
      const result = await client.execute(deleteQuery, [folga_id]);
      
      if (result.affectedRows && result.affectedRows > 0) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Folga removida com sucesso' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Folga não encontrada ou já removida' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
        JSON.stringify({ 
          success: true, 
          data: result.rows || [],
          message: `${result.rows?.length || 0} metas encontradas` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Adicionar suporte para buscar períodos
    if (actionParam === 'fetch_periodos') {
      const query = `
        SELECT * FROM periodos_meta 
        WHERE status = 'ativo' 
        ORDER BY data_inicio DESC
      `;
      
      const result = await client.execute(query, []);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: result.rows || [],
          message: `${result.rows?.length || 0} períodos encontrados` 
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
        error: error instanceof Error ? error.message : 'Erro desconhecido'
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