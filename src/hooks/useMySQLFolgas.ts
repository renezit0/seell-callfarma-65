import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MySQLFolga {
  folga_id: number;
  usuario_id: number;
  data_folga: string;  // DATE in YYYY-MM-DD format
  periodo_id: number;
  observacao?: string;
  registrado_por?: number;
  data_registro?: string;
  usuario_nome?: string;
}

export const useMySQLFolgas = () => {
  const [folgas, setFolgas] = useState<MySQLFolga[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFolgas = async (
    data_inicio?: string,
    data_fim?: string,
    loja_id?: number,
    usuario_id?: number
  ) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('mysql-usuarios', {
        body: {
          action: 'fetch_folgas',
          data_inicio,
          data_fim,
          loja_id,
          usuario_id
        }
      });

      if (error) throw error;

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

  return {
    folgas,
    loading,
    error,
    fetchFolgas
  };
};