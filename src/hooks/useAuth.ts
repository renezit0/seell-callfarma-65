import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export interface User {
  id: number;
  nome: string;
  login: string;
  tipo: string;
  loja_id: number;
  permissao: number;
  status: string;
  cpf?: string;
  matricula?: string;
  loja_nome?: string;
  loja_numero?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const login = async (loginInput: string, senha: string) => {
    console.log('🚀 Iniciando login MySQL para:', loginInput);
    try {
      // Usar a edge function para autenticação no MySQL
      const { data, error } = await supabase.functions.invoke('mysql-usuarios', {
        body: {
          action: 'authenticate',
          login: loginInput,
          senha: senha
        }
      });

      if (error) {
        console.error('❌ Erro na chamada da edge function:', error);
        return { success: false, error: 'Erro de conexão com o servidor' };
      }

      if (!data?.success) {
        console.log('❌ Credenciais inválidas');
        return { success: false, error: data?.message || 'Usuário ou senha inválidos' };
      }

      const userRecord = data.data;
      
      // Mapear os dados do MySQL para o tipo User
      const userData: User = {
        id: userRecord.id,
        nome: userRecord.nome,
        login: userRecord.login,
        tipo: userRecord.tipo,
        loja_id: userRecord.loja_id,
        permissao: Number(userRecord.permissao) || 0,
        status: userRecord.status || 'ativo',
        cpf: userRecord.CPF || userRecord.cpf || null,
        matricula: userRecord.matricula,
        loja_nome: userRecord.loja_nome,
        loja_numero: userRecord.loja_numero
      };
      
      console.log('✅ Login MySQL bem-sucedido:', userData.nome);
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      
      return { success: true };
    } catch (error) {
      console.error('❌ Erro no login MySQL:', error);
      return { success: false, error: 'Erro de conexão com o servidor' };
    }
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('user');
    // Usar window.location para garantir redirecionamento completo
    window.location.href = '/login';
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
      } catch (error) {
        console.error('Erro ao carregar usuário do localStorage:', error);
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  return { user, login, logout, loading };
}