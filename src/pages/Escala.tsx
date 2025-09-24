import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMySQLFolgas } from '@/hooks/useMySQLFolgas';
import { useMySQLUsuarios } from '@/hooks/useMySQLUsuarios';
import { CalendarioEscala } from '@/components/escala/CalendarioEscala';
import { PainelRegistroAusencia } from '@/components/escala/PainelRegistroAusencia';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, UserMinus, Clock } from 'lucide-react';
import { usePeriodoAtual } from '@/hooks/usePeriodoAtual';

interface Usuario {
  id: number;
  nome: string;
  tipo: string;
  loja_id: number;
  status: string;
}

interface Folga {
  folga_id: number;
  usuario_id: number;
  data_folga: string;
  observacao?: string;
  usuario?: { nome: string; tipo: string };
  usuario_nome?: string;
}

export default function Escala() {
  const { user } = useAuth();
  const { folgas, fetchFolgas } = useMySQLFolgas();
  const { usuarios, fetchUsuarios } = useMySQLUsuarios();
  const periodo = usePeriodoAtual();

  // Verificar permissões do usuário
  const canManageAll = user?.tipo && ['admin', 'supervisor', 'rh', 'gerente'].includes(user.tipo);
  const canViewOwn = user?.tipo && ['auxiliar', 'consultora', 'farmaceutico', 'lider', 'sublider', 'subgerente'].includes(user.tipo);

  const carregarDados = async () => {
    if (!user) return;

    try {
      // Buscar usuários da loja via MySQL
      await fetchUsuarios(user.loja_id);
      
      // Buscar folgas do período via MySQL (usando o período de hoje para teste)
      const hoje = new Date();
      const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      
      const dataInicio = primeiroDia.toISOString().split('T')[0];
      const dataFim = ultimoDia.toISOString().split('T')[0];
      
      if (!canManageAll && user.id) {
        // Para usuários sem permissão de gerenciamento, mostrar apenas suas próprias folgas
        await fetchFolgas(dataInicio, dataFim, user.loja_id, user.id);
      } else {
        // Para gerentes/administradores, mostrar todas as folgas da loja
        await fetchFolgas(dataInicio, dataFim, user.loja_id);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  useEffect(() => {
    if (user && periodo) {
      // Carregar dados quando usuário e período estiverem disponíveis
      carregarDados();
    }
  }, [user, periodo]);

  const adicionarAusencia = async (data: Date, tipo: string, observacao?: string) => {
    console.warn('Adicionar ausência via MySQL não implementado ainda');
    // TODO: Implementar via edge function
  };

  const removerAusencia = async (id: number) => {
    console.warn('Remover ausência via MySQL não implementado ainda');
    // TODO: Implementar via edge function
  };

  // Função auxiliar para extrair tipo da observação
  const extrairTipoDaObservacao = (observacao?: string): string => {
    if (!observacao) return 'folga';
    
    const obs = observacao.toLowerCase();
    if (obs.includes('férias')) return 'ferias';
    if (obs.includes('atestado')) return 'atestado';
    if (obs.includes('falta')) return 'falta';
    return 'folga';
  };

  // Estatísticas das ausências
  const estatisticasAusencias = () => {
    const tiposAusencia = ['ferias', 'atestado', 'falta', 'folga'];
    return {
      totalAusencias: folgas.length,
      porTipo: tiposAusencia.map(tipo => ({
        tipo,
        count: folgas.filter(f => extrairTipoDaObservacao(f.observacao) === tipo).length,
        label: tipo.charAt(0).toUpperCase() + tipo.slice(1)
      }))
    };
  };

  if (!user) {
    return <div>Carregando...</div>;
  }

  // Verificar se o usuário tem permissão para acessar esta página
  if (!canManageAll && !canViewOwn) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Acesso Negado</h2>
            <p className="text-muted-foreground">
              Você não tem permissão para acessar esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = estatisticasAusencias();

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Escala de Folgas</h1>
          <p className="text-muted-foreground">
            Gerencie folgas, férias e ausências da equipe
          </p>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Total de Ausências</p>
                <p className="text-2xl font-bold">{stats.totalAusencias}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {stats.porTipo.map(({ tipo, count, label }) => (
          <Card key={tipo}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <UserMinus className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-2xl font-bold">{count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Calendário e Painel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Estatísticas temporárias até migrar componentes */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Folgas do MySQL</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Sistema migrado para MySQL - {folgas.length} folgas encontradas
              </p>
              <div className="space-y-2">
                {folgas.slice(0, 10).map((folga) => (
                  <div key={folga.folga_id} className="flex justify-between items-center p-2 bg-muted rounded">
                    <span>{folga.usuario_nome || `Usuário ${folga.usuario_id}`}</span>
                    <span>{folga.data_folga}</span>
                    <span className="text-sm text-muted-foreground">{folga.observacao}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}