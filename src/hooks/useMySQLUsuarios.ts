import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MySQLUsuario {
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

export const useMySQLUsuarios = () => {
  const [usuarios, setUsuarios] = useState<MySQLUsuario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsuarios = async (lojaId?: number, userType?: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('mysql-usuarios', {
        body: {
          action: 'fetch_usuarios',
          loja_id: lojaId,
          user_type: userType
        }
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        setUsuarios(data.data || []);
      } else {
        throw new Error(data?.message || 'Erro ao buscar usuários');
      }
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const authenticateMySQL = async (login: string, senha: string): Promise<MySQLUsuario | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('mysql-usuarios', {
        body: {
          action: 'authenticate',
          login,
          senha
        }
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        return data.data;
      }

      return null;
    } catch (err) {
      console.error('Erro na autenticação:', err);
      return null;
    }
  };

  return {
    usuarios,
    loading,
    error,
    fetchUsuarios,
    authenticateMySQL
  };
};