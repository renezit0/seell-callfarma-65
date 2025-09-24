import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MySQLPeriodoMeta {
  id: number;
  data_inicio: string;
  data_fim: string;
  descricao?: string;
  status: string;
}

export interface MySQLMetaColaborador {
  id: number;
  usuario_id: number;
  categoria: string;
  meta_mensal: number;
  periodo_meta_id: number;
}

export interface MySQLMetaLoja {
  id: number;
  loja_id: number;
  meta_valor_total: number;
  periodo_meta_id: number;
  observacoes?: string;
  loja_nome?: string;
  numero?: string;
}

export interface MySQLMetaLojaCategoria {
  id: number;
  meta_loja_id: number;
  categoria: string;
  meta_valor: number;
}

export interface MySQLUsuario {
  id: number;
  nome: string;
  tipo: string;
  loja_id: number;
}

export const useMySQLMetas = () => {
  const [periodos, setPeriodos] = useState<MySQLPeriodoMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPeriodos = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('mysql-usuarios', {
        body: {
          action: 'get_periodos'
        }
      });

      if (error) throw error;

      if (data?.success) {
        setPeriodos(data.data || []);
      } else {
        throw new Error(data?.message || 'Erro ao buscar períodos');
      }
    } catch (err) {
      console.error('Erro ao buscar períodos do MySQL:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const fetchColaboradoresComMetas = async (
    loja_id?: number, 
    periodo_meta_id?: number, 
    usuario_id?: number
  ): Promise<{ usuarios: MySQLUsuario[], metas: MySQLMetaColaborador[] }> => {
    try {
      const { data, error } = await supabase.functions.invoke('mysql-usuarios', {
        body: {
          action: 'get_colaboradores_metas',
          loja_id,
          periodo_meta_id,
          usuario_id
        }
      });

      if (error) throw error;

      if (data?.success) {
        return {
          usuarios: data.data.usuarios || [],
          metas: data.data.metas || []
        };
      }

      throw new Error(data?.message || 'Erro ao buscar colaboradores com metas');
    } catch (err) {
      console.error('Erro ao buscar colaboradores com metas do MySQL:', err);
      throw err;
    }
  };

  const fetchMetasLojas = async (
    periodo_meta_id: number, 
    loja_id?: number
  ): Promise<{ metas_loja: MySQLMetaLoja[], categorias: MySQLMetaLojaCategoria[] }> => {
    try {
      const { data, error } = await supabase.functions.invoke('mysql-usuarios', {
        body: {
          action: 'get_metas_lojas',
          periodo_meta_id,
          loja_id
        }
      });

      if (error) throw error;

      if (data?.success) {
        return {
          metas_loja: data.data.metas_loja || [],
          categorias: data.data.categorias || []
        };
      }

      throw new Error(data?.message || 'Erro ao buscar metas de lojas');
    } catch (err) {
      console.error('Erro ao buscar metas de lojas do MySQL:', err);
      throw err;
    }
  };

  return {
    periodos,
    loading,
    error,
    fetchPeriodos,
    fetchColaboradoresComMetas,
    fetchMetasLojas
  };
};