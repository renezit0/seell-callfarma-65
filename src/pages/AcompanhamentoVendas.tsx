import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCallfarmaAPI } from '@/hooks/useCallfarmaAPI';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, TrendingUp, DollarSign, Target, Users, Store, Share2, BarChart3, Clock, Trophy, TrendingDown } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { StoreSelector } from '@/components/StoreSelector';
import { usePeriodContext } from '@/contexts/PeriodContext';
import { canViewAllStores } from '@/utils/userTypes';
import { format, differenceInDays, isWeekend, subDays, addDays } from 'date-fns';
import { toast } from 'sonner';

// Interfaces e configurações
interface UsuarioInfo {
  id: number;
  nome: string;
  matricula: string;
  tipo: string;
}

interface CategoriaConfig {
  nome: string;
  icone: string;
  cor: string;
}

interface ConfigUsuario {
  categorias: Record<string, CategoriaConfig>;
  taxas_comissao: Record<string, number>;
  isBonus?: boolean;
}

interface MetaData {
  categoria: string;
  meta_mensal: number;
  realizado: number;
  percentual: number;
  meta_diaria: number;
  venda_hoje: number;
  projecao: number;
  status_ok: boolean;
}

interface ComissaoData {
  categoria: string;
  valor_vendido: number;
  taxa: number;
  comissao: number;
}

interface AnaliseFolgas {
  total_dias: number;
  dias_trabalhados: number;
  dias_uteis_restantes: number;
  percentual_tempo: number;
}

// Configurações de grupos de produtos e comissões
const PRODUCT_GROUPS: Record<string, number[]> = {
  'similar': [2, 21, 20, 25, 22],
  'generico': [47, 5, 6],
  'perfumaria_alta': [46],
  'goodlife': [22],
  'rentaveis20': [20],
  'rentaveis25': [25],
  'dermocosmetico': [31, 16],
  'conveniencia': [36],
  'brinquedo': [13]
};

const COMMISSION_CONFIG: Record<string, ConfigUsuario> = {
  'gerente': {
    categorias: {
      'geral': { nome: 'Venda Geral', icone: 'Store', cor: '#1565c0' },
      'generico_similar': { nome: 'Genérico e Similar', icone: 'Target', cor: '#e74a3b' },
      'goodlife': { nome: 'Good Life', icone: 'TrendingUp', cor: '#28a745' }
    },
    taxas_comissao: { similar: 0.02, generico: 0.02, dermocosmetico: 0.02, rentaveis20: 0.01, rentaveis25: 0.01 }
  },
  'farmaceutico': {
    categorias: {
      'geral': { nome: 'Venda Geral', icone: 'Store', cor: '#1565c0' },
      'generico_similar': { nome: 'Genérico e Similar', icone: 'Target', cor: '#e74a3b' },
      'goodlife': { nome: 'Good Life', icone: 'TrendingUp', cor: '#28a745' }
    },
    taxas_comissao: { similar: 0.02, generico: 0.02, dermocosmetico: 0.02, rentaveis20: 0.01, rentaveis25: 0.01 }
  },
  'auxiliar': {
    categorias: {
      'geral': { nome: 'Venda Geral', icone: 'Store', cor: '#1565c0' },
      'generico_similar': { nome: 'Genérico e Similar', icone: 'Target', cor: '#e74a3b' },
      'goodlife': { nome: 'Good Life', icone: 'TrendingUp', cor: '#28a745' }
    },
    taxas_comissao: { similar: 0.05, generico: 0.045, dermocosmetico: 0.02, rentaveis: 0.01, rentaveis20: 0.01, rentaveis25: 0.01 }
  },
  'consultora': {
    categorias: {
      'perfumaria_alta': { nome: 'Perfumaria R+', icone: 'Trophy', cor: '#8e44ad' },
      'dermocosmetico': { nome: 'Dermocosméticos', icone: 'Target', cor: '#f6c23e' },
      'goodlife': { nome: 'Good Life', icone: 'TrendingUp', cor: '#28a745' }
    },
    taxas_comissao: { perfumaria_alta: 0.03, dermocosmetico: 0.02, goodlife: 0.05 }
  },
  'aux_conveniencia': {
    categorias: {
      'conveniencia': { nome: 'Conveniência', icone: 'Store', cor: '#fd7e14' }
    },
    taxas_comissao: { conveniencia: 0.02, brinquedo: 0.02 },
    isBonus: true
  }
};

// Funções utilitárias
const getFuncaoNome = (tipo: string): string => {
  const nomes: Record<string, string> = {
    'farmaceutico': 'Farmacêutico',
    'auxiliar': 'Auxiliar de Farmácia II',
    'aux_conveniencia': 'Auxiliar de Conveniência',
    'consultora': 'Consultora de Beleza',
    'lider': 'Gerente Loja',
    'gerente': 'Administrador',
    'admin': 'Administrador',
    'supervisor': 'Supervisor'
  };
  return nomes[tipo] || tipo.charAt(0).toUpperCase() + tipo.slice(1);
};

const getCategoryName = (category: string): string => {
  const names: Record<string, string> = {
    'similar': 'Similar',
    'generico': 'Genérico',
    'dermocosmetico': 'Dermocosmético',
    'perfumaria_alta': 'Perfumaria Alta',
    'goodlife': 'Good Life',
    'brinquedo': 'Brinquedos',
    'conveniencia': 'Conveniência',
    'geral': 'Venda Geral',
    'generico_similar': 'Genérico e Similar',
    'rentaveis': 'Rentáveis'
  };
  return names[category] || category;
};

const getProgressClass = (percentual_vendas: number, percentual_tempo: number): string => {
  if (percentual_vendas >= 95) return 'bg-green-500';
  const relacao = percentual_tempo > 0 ? percentual_vendas / percentual_tempo : 0;
  if (relacao >= 1.10) return 'bg-green-500';
  if (relacao >= 0.95) return 'bg-blue-500';
  if (relacao >= 0.80) return 'bg-yellow-500';
  return 'bg-red-500';
};

const calcularComissoes = (vendas: Record<string, number>, taxas_comissao: Record<string, number>): { comissoes: ComissaoData[], total: number } => {
  const comissoes: ComissaoData[] = [];
  let total = 0;

  Object.entries(taxas_comissao).forEach(([categoria, taxa]) => {
    const valor_vendido = vendas[categoria] || 0;
    const comissao = valor_vendido * taxa;
    
    if (valor_vendido > 0) {
      comissoes.push({
        categoria,
        valor_vendido,
        taxa,
        comissao
      });
      total += comissao;
    }
  });

  return { comissoes, total };
};

const analisarFolgas = (data_inicio: string, data_fim: string): AnaliseFolgas => {
  const dataInicio = new Date(data_inicio);
  const dataFim = new Date(data_fim);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let total_dias = differenceInDays(dataFim, dataInicio) + 1;
  let dias_trabalhados = 0;
  let dias_uteis_restantes = 0;

  let dataCorrente = new Date(dataInicio);
  while (dataCorrente <= dataFim) {
    if (!isWeekend(dataCorrente)) {
      if (dataCorrente < hoje) {
        dias_trabalhados++;
      } else if (format(dataCorrente, 'yyyy-MM-dd') === format(hoje, 'yyyy-MM-dd')) {
        dias_uteis_restantes++;
      } else {
        dias_uteis_restantes++;
      }
    }
    dataCorrente = addDays(dataCorrente, 1);
  }

  const percentual_tempo = total_dias > 0 ? (dias_trabalhados / (dias_trabalhados + dias_uteis_restantes)) * 100 : 0;

  return {
    total_dias,
    dias_trabalhados,
    dias_uteis_restantes,
    percentual_tempo
  };
};

export default function Acompanhamento() {
  const { user, loading: authLoading } = useAuth();
  const { selectedPeriod } = usePeriodContext();
  const callfarmaAPI = useCallfarmaAPI();

  const [loading, setLoading] = useState(true);
  const [selectedLojaId, setSelectedLojaId] = useState<number | null>(null);
  const [funcionariosLoja, setFuncionariosLoja] = useState<UsuarioInfo[]>([]);
  const [selectedFuncionarioId, setSelectedFuncionarioId] = useState<string>('me');
  const [visualizacao, setVisualizacao] = useState<string>('resumo');
  const [metasData, setMetasData] = useState<Record<string, MetaData>>({});
  const [comissoesData, setComissoesData] = useState<{ comissoes: ComissaoData[], total: number }>({ comissoes: [], total: 0 });
  const [analiseFolgasData, setAnaliseFolgasData] = useState<AnaliseFolgas>({
    total_dias: 0,
    dias_trabalhados: 0,
    dias_uteis_restantes: 0,
    percentual_tempo: 0
  });
  const [lojaInfo, setLojaInfo] = useState<{ nome: string; regiao: string } | null>(null);

  const hasMultiStoreAccess = user?.tipo && canViewAllStores(user.tipo);
  const currentLojaId = selectedLojaId || user?.loja_id || null;
  const isLider = user?.tipo === 'lider';
  const isGerenteAdminSupervisor = user?.tipo && ['gerente', 'admin', 'supervisor'].includes(user.tipo);
  const isAuxConveniencia = user?.tipo === 'aux_conveniencia';

  // Configuração do usuário atual
  const configAtual = useMemo(() => {
    if (!user?.tipo) return COMMISSION_CONFIG['auxiliar'];
    return COMMISSION_CONFIG[user.tipo as keyof typeof COMMISSION_CONFIG] || COMMISSION_CONFIG['auxiliar'];
  }, [user?.tipo]);

  // Definir visualização padrão
  useEffect(() => {
    if (user) {
      const defaultVisualizacao = (isLider || isGerenteAdminSupervisor) ? 'comparativo' : 'resumo';
      setVisualizacao(defaultVisualizacao);
    }
  }, [user, isLider, isGerenteAdminSupervisor]);

  // Definir loja inicial
  useEffect(() => {
    if (user && !hasMultiStoreAccess && user.loja_id) {
      setSelectedLojaId(user.loja_id);
    }
  }, [user, hasMultiStoreAccess]);

  // Buscar informações da loja
  useEffect(() => {
    const fetchLojaInfo = async () => {
      if (!currentLojaId) return;

      try {
        const { data: loja, error } = await supabase
          .from('lojas')
          .select('nome, regiao')
          .eq('id', currentLojaId)
          .single();

        if (error) throw error;
        setLojaInfo(loja);
      } catch (error) {
        console.error('Erro ao buscar informações da loja:', error);
      }
    };

    fetchLojaInfo();
  }, [currentLojaId]);

  // Buscar funcionários da loja
  useEffect(() => {
    const fetchFuncionarios = async () => {
      if (!currentLojaId || !hasMultiStoreAccess) return;

      try {
        const { data: funcionarios, error } = await supabase
          .from('usuarios')
          .select('id, nome, matricula, tipo')
          .eq('loja_id', currentLojaId)
          .eq('status', 'ativo')
          .order('nome');

        if (error) throw error;
        setFuncionariosLoja(funcionarios || []);
      } catch (error) {
        console.error('Erro ao buscar funcionários:', error);
      }
    };

    fetchFuncionarios();
  }, [currentLojaId, hasMultiStoreAccess]);

  // Buscar dados de acompanhamento
  useEffect(() => {
    const fetchAcompanhamentoData = async () => {
      if (!user || !selectedPeriod || !currentLojaId) return;

      setLoading(true);
      try {
        const usuarioId = selectedFuncionarioId === 'me' ? user.id : parseInt(selectedFuncionarioId);
        const dataInicio = format(new Date(selectedPeriod.startDate), 'yyyy-MM-dd');
        const dataFim = format(new Date(selectedPeriod.endDate), 'yyyy-MM-dd');

        // Análise de folgas
        const analise = analisarFolgas(dataInicio, dataFim);
        setAnaliseFolgasData(analise);

        // Buscar metas (simulado - adaptar para sua API)
        const metasMock: Record<string, MetaData> = {};
        Object.keys(configAtual.categorias).forEach(categoria => {
          const metaValor = Math.floor(Math.random() * 10000) + 5000;
          const realizadoValor = Math.floor(Math.random() * metaValor);
          const percentual = (realizadoValor / metaValor) * 100;
          const metaDiaria = analise.dias_uteis_restantes > 0 ? (metaValor - realizadoValor) / analise.dias_uteis_restantes : 0;
          const vendaHoje = Math.floor(Math.random() * 500);
          const projecao = analise.total_dias > 0 ? (realizadoValor / analise.dias_trabalhados) * analise.total_dias / metaValor * 100 : 0;

          metasMock[categoria] = {
            categoria,
            meta_mensal: metaValor,
            realizado: realizadoValor,
            percentual,
            meta_diaria: metaDiaria,
            venda_hoje: vendaHoje,
            projecao,
            status_ok: percentual >= analise.percentual_tempo
          };
        });
        setMetasData(metasMock);

        // Calcular comissões
        const vendasMock: Record<string, number> = {};
        Object.keys(configAtual.taxas_comissao).forEach(categoria => {
          vendasMock[categoria] = metasMock[categoria]?.realizado || Math.floor(Math.random() * 5000);
        });

        const comissoes = calcularComissoes(vendasMock, configAtual.taxas_comissao);
        setComissoesData(comissoes);

      } catch (error) {
        console.error('Erro ao buscar dados de acompanhamento:', error);
        toast.error('Erro ao carregar dados de acompanhamento');
      } finally {
        setLoading(false);
      }
    };

    fetchAcompanhamentoData();
  }, [user, selectedPeriod, currentLojaId, selectedFuncionarioId, configAtual]);

  const handleShare = () => {
    // Gerar texto para WhatsApp
    const nomeUsuario = selectedFuncionarioId === 'me' ? user?.nome : funcionariosLoja.find(f => f.id.toString() === selectedFuncionarioId)?.nome;
    const periodo = `${format(new Date(selectedPeriod.startDate), 'dd/MM/yyyy')} a ${format(new Date(selectedPeriod.endDate), 'dd/MM/yyyy')}`;
    
    let texto = `📊 *ACOMPANHAMENTO DE METAS*\n\n`;
    texto += `👤 *${nomeUsuario}*\n`;
    texto += `🏪 ${lojaInfo?.nome || 'Loja'}\n`;
    texto += `📅 ${periodo}\n`;
    texto += `⏰ ${analiseFolgasData.percentual_tempo.toFixed(1)}% decorrido\n\n`;
    texto += `*PROGRESSO:*\n`;

    Object.entries(metasData).forEach(([categoria, meta]) => {
      const emoji = meta.status_ok ? "✅" : "⚠️";
      const projecaoEmoji = meta.projecao >= 100 ? "🎯" : "📈";
      texto += `${emoji} *${configAtual.categorias[categoria]?.nome}*\n`;
      texto += `   Meta: R$ ${meta.meta_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Realizado: R$ ${meta.realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      texto += `   Progresso: *${meta.percentual.toFixed(1)}%* | Projeção: ${projecaoEmoji} *${meta.projecao.toFixed(1)}%*\n`;
      texto += `   Hoje: R$ ${meta.venda_hoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Meta/dia: R$ ${meta.meta_diaria.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n`;
    });

    if (!isAuxConveniencia) {
      texto += `💰 *COMISSÕES:* R$ ${comissoesData.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    }
    texto += `📆 Dias restantes: ${analiseFolgasData.dias_uteis_restantes}\n\n`;
    texto += `📊 Acompanhamento gerado em ${format(new Date(), 'dd/MM/yyyy')}`;

    // Abrir WhatsApp
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="page-container space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Acompanhamento de Metas e Comissões</h1>
          <p className="text-muted-foreground mt-1">
            {isAuxConveniencia ? 'Acompanhe suas comissões de conveniência' : 'Visualize o desempenho de vendas e comissões'}
          </p>
        </div>
        
        <div className="flex gap-4 items-center">
          {hasMultiStoreAccess && (
            <StoreSelector
              selectedLojaId={selectedLojaId}
              onLojaChange={setSelectedLojaId}
              userLojaId={user?.loja_id || 0}
            />
          )}
          
          {(isLider || isGerenteAdminSupervisor) && funcionariosLoja.length > 0 && (
            <Select value={selectedFuncionarioId} onValueChange={setSelectedFuncionarioId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Selecionar Funcionário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="me">Meu Acompanhamento</SelectItem>
                {funcionariosLoja.map((func) => (
                  <SelectItem key={func.id} value={func.id.toString()}>
                    {func.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button onClick={handleShare} className="btn-primary">
            <Share2 className="mr-2 h-4 w-4" /> Compartilhar
          </Button>
        </div>
      </div>

      {/* Informações do período e tempo */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Período</p>
                <p className="font-medium">{selectedPeriod.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Tempo Decorrido</p>
                <p className="font-medium">{analiseFolgasData.percentual_tempo.toFixed(1)}%</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Dias Restantes</p>
                <p className="font-medium">{analiseFolgasData.dias_uteis_restantes} dias</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Loja</p>
                <p className="font-medium">{lojaInfo?.nome || 'Carregando...'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navegação de Visualização */}
      <Tabs value={visualizacao} onValueChange={setVisualizacao} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="completo">Completo</TabsTrigger>
          {(isLider || isGerenteAdminSupervisor) && <TabsTrigger value="comparativo">Comparativo</TabsTrigger>}
        </TabsList>

        {/* Visualização Resumo */}
        <TabsContent value="resumo">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando resumo...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Cards de Metas */}
              {Object.entries(metasData).map(([categoria, meta]) => {
                const categoriaConfig = configAtual.categorias[categoria];
                if (!categoriaConfig) return null;

                return (
                  <Card key={categoria}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categoriaConfig.cor }}></div>
                        {categoriaConfig.nome}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Meta:</span>
                        <span className="font-medium">R$ {meta.meta_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Realizado:</span>
                        <span className={`font-medium ${meta.status_ok ? 'text-green-600' : 'text-red-600'}`}>
                          R$ {meta.realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Progresso:</span>
                        <span className={`font-medium ${meta.status_ok ? 'text-green-600' : 'text-red-600'}`}>
                          {meta.percentual.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={Math.min(100, meta.percentual)} className="w-full" />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Meta Diária: R$ {meta.meta_diaria.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        <span>Projeção: {meta.projecao.toFixed(1)}%</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Card de Comissões */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    {configAtual.isBonus ? 'Bônus' : 'Comissões'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {comissoesData.comissoes.map((comissao) => (
                    <div key={comissao.categoria} className="flex justify-between">
                      <span className="text-muted-foreground">
                        {getCategoryName(comissao.categoria)} ({(comissao.taxa * 100).toFixed(1)}%):
                      </span>
                      <span className="font-medium text-green-600">
                        R$ {comissao.comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                    <span>Total Acumulado:</span>
                    <span className="text-green-600">
                      R$ {comissoesData.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Visualização Completa */}
        <TabsContent value="completo">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando detalhes completos...</div>
          ) : (
            <div className="space-y-6">
              {/* Vendas de Hoje */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    Vendas de Hoje ({format(new Date(), 'dd/MM/yyyy')})
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(metasData).map(([categoria, meta]) => {
                    const categoriaConfig = configAtual.categorias[categoria];
                    if (!categoriaConfig) return null;

                    return (
                      <div key={categoria} className="flex justify-between items-center">
                        <span className="text-muted-foreground">{categoriaConfig.nome}:</span>
                        <span className={`font-medium ${meta.venda_hoje >= meta.meta_diaria ? 'text-green-600' : 'text-red-600'}`}>
                          R$ {meta.venda_hoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} 
                          (Meta: R$ {meta.meta_diaria.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                        </span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Detalhes por Categoria */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(metasData).map(([categoria, meta]) => {
                  const categoriaConfig = configAtual.categorias[categoria];
                  if (!categoriaConfig) return null;

                  return (
                    <Card key={categoria}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categoriaConfig.cor }}></div>
                          {categoriaConfig.nome}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Meta Mensal:</span>
                          <span className="font-medium">R$ {meta.meta_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Realizado:</span>
                          <span className={`font-medium ${meta.status_ok ? 'text-green-600' : 'text-red-600'}`}>
                            R$ {meta.realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Progresso:</span>
                          <span className={`font-medium ${meta.status_ok ? 'text-green-600' : 'text-red-600'}`}>
                            {meta.percentual.toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={Math.min(100, meta.percentual)} className="w-full" />
                        <div className="text-sm text-muted-foreground">
                          <div>Meta Diária Necessária: R$ {meta.meta_diaria.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          <div>Projeção de Fechamento: {meta.projecao.toFixed(1)}%</div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Estatísticas Gerais */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-500" />
                    Estatísticas Gerais
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dias no Período:</span>
                    <span className="font-medium">{analiseFolgasData.total_dias}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dias Trabalhados:</span>
                    <span className="font-medium">{analiseFolgasData.dias_trabalhados}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dias Úteis Restantes:</span>
                    <span className="font-medium">{analiseFolgasData.dias_uteis_restantes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tempo Decorrido:</span>
                    <span className="font-medium">{analiseFolgasData.percentual_tempo.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Comissões Acumuladas:</span>
                    <span className="font-medium text-green-600">
                      R$ {comissoesData.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Visualização Comparativa */}
        <TabsContent value="comparativo">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando tabela comparativa...</div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Tabela Comparativa de Metas e Comissões
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Progresso</TableHead>
                        <TableHead className="text-right">Meta</TableHead>
                        <TableHead className="text-right">Realizado</TableHead>
                        <TableHead className="text-right">%</TableHead>
                        <TableHead className="text-right">Meta Diária</TableHead>
                        <TableHead className="text-right">Comissões</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {funcionariosLoja.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            <Store className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Nenhum funcionário encontrado</p>
                            <p className="text-sm">Verifique se há funcionários cadastrados para esta loja.</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        funcionariosLoja.map((funcionario) => {
                          const funcConfig = COMMISSION_CONFIG[funcionario.tipo as keyof typeof COMMISSION_CONFIG] || COMMISSION_CONFIG['auxiliar'];
                          const categoriasPrincipal = Object.keys(funcConfig.categorias)[0];
                          const metaExemplo = metasData[categoriasPrincipal] || {
                            meta_mensal: 0,
                            realizado: 0,
                            percentual: 0,
                            meta_diaria: 0
                          };

                          return (
                            <TableRow key={funcionario.id}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{funcionario.nome}</div>
                                  <div className="text-sm text-muted-foreground">({funcionario.matricula})</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{getFuncaoNome(funcionario.tipo)}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  {Object.keys(funcConfig.categorias).map(cat => (
                                    <Badge key={cat} variant="outline" className="mr-1 text-xs">
                                      {getCategoryName(cat)}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Progress value={Math.min(100, metaExemplo.percentual)} className="w-[100px]" />
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                R$ {metaExemplo.meta_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                R$ {metaExemplo.realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant={metaExemplo.percentual >= analiseFolgasData.percentual_tempo ? "default" : "secondary"}>
                                  {metaExemplo.percentual.toFixed(1)}%
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                R$ {metaExemplo.meta_diaria.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right font-medium text-green-600">
                                R$ {comissoesData.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                {funcConfig.isBonus && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    Bônus
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

