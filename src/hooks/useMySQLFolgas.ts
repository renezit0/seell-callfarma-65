import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MySQLFolga {
  folga_id: number;
  usuario_id: number;
  data_folga: string;
  observacao?: string;
  data_registro: string;
  nome_usuario?: string;
  tipo_usuario?: string;
}

export const useMySQLFolgas = () => {
  const [folgas, setFolgas] = useState<MySQLFolga[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFolgas = async (usuario_id: number, data_inicio?: string, data_fim?: string, periodo_id?: number) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('mysql-usuarios', {
        body: {
          action: 'fetch_folgas',
          usuario_id,
          data_inicio,
          data_fim,
          periodo_id
        }
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        setFolgas(data.data || []);
      } else {
        throw new Error(data?.message || 'Erro ao buscar folgas');
      }
    } catch (err) {
      console.error('Erro ao buscar folgas do MySQL:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const registrarFolga = async (usuario_id: number, data_folga: string, observacao?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('mysql-usuarios', {
        body: {
          action: 'registrar_folga',
          usuario_id,
          data_folga,
          observacao
        }
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (err) {
      console.error('Erro ao registrar folga:', err);
      throw err;
    }
  };

  const removerFolga = async (folga_id: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('mysql-usuarios', {
        body: {
          action: 'remover_folga',
          folga_id
        }
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (err) {
      console.error('Erro ao remover folga:', err);
      throw err;
    }
  };

  return {
    folgas,
    loading,
    error,
    fetchFolgas,
    registrarFolga,
    removerFolga
  };
};