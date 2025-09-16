import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTicketMedioSelfcheckout } from '@/hooks/useTicketMedioSelfcheckout';
import { useCallfarmaAPI, VendaAPI } from '@/hooks/useCallfarmaAPI';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Calendar, DollarSign, TrendingUp, BarChart3, LineChart, Trophy, TrendingDown, Users, Building2, Package } from 'lucide-react';
import { getNomeCategoria, getIconeCategoria, getClasseCorCategoria, getClasseBgCategoria, getCorCategoria } from '@/utils/categories';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format, startOfMonth, subMonths, eachDayOfInterval, getDay } from 'date-fns';
import { PeriodSelector } from '@/components/PeriodSelector';
import { StoreSelector } from '@/components/StoreSelector';
import { usePeriodContext } from '@/contexts/PeriodContext';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface ChartData {
  date: string;
  value: number;
  transactions: number;
  geral: number;
  saude: number;
  perfumaria_r_mais: number;
  conveniencia_r_mais: number;
  r_mais: number;
}

interface Vendedor {
  id: number;
  nome: string;
}

interface DadosCallfarma {
  vendas_consolidadas: any;
  grupos_disponiveis: any[];
  vendas_por_dia_grupo: any[];
}

interface IndicadorMeta {
  categoria: string;
  valor_realizado: number;
  meta_valor: number;
  percentual_meta: number;
  nome_categoria: string;
}

// Mapeamento de categorias da API para nomes amigáveis
const NOMES_CATEGORIAS = {
  'r_mais': 'Rentáveis R+',
  'perfumaria_r_mais': 'Perfumaria R+',
  'saude': 'GoodLife',
  'conveniencia_r_mais': 'Conveniência R+'
};

// Mapeamento para cores das categorias
const CORES_CATEGORIAS = {
  'r_mais': 'hsl(0, 84%, 60%)',
  'perfumaria_r_mais': 'hsl(262, 83%, 58%)',
  'saude': 'hsl(142, 76%, 36%)',
  'conveniencia_r_mais': 'hsl(32, 95%, 44%)',
  'geral': 'hsl(217, 91%, 60%)'
};

export default function Vendas() {
  // ALL HOOKS DECLARED FIRST - ALWAYS RUN IN SAME ORDER
  const { user, loading: authLoading } = useAuth();
  const { selectedPeriod } = usePeriodContext();
  const { 
    loading: callfarmaLoading,
    buscarVendasCompletasComGrupos,
    buscarVendasListaAPI,
    buscarDadosGraficosAPI,
    gerarRelatorioGrupos 
  } = useCallfarmaAPI();

  const [vendas, setVendas] = useState<VendaAPI[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [lojaInfo, setLojaInfo] = useState<{
    regiao: string;
    numero: string;
    nome: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('geral');
  const [vendedorFilter, setVendedorFilter] = useState<string>('all');
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [chartCategoriaFilter, setChartCategoriaFilter] = useState<string>('geral');
  const [filtroAdicional, setFiltroAdicional] = useState<string>('periodo');
  const [selectedLojaId, setSelectedLojaId] = useState<number | null>(null);

  // Estados para dados da Callfarma
  const [dadosCallfarma, setDadosCallfarma] = useState<DadosCallfarma | null>(null);
  const [relatorioGrupos, setRelatorioGrupos] = useState<any>(null);
  const [mostrarRelatorioGrupos, setMostrarRelatorioGrupos] = useState(false);

  // Estados para metas
  const [metasData, setMetasData] = useState<Record<string, { meta: number; realizado: number; }>>({});

  // Check if user can view all stores
  const canViewAllStores = user?.tipo && ['admin', 'supervisor', 'compras'].includes(user.tipo);
  const currentLojaId = selectedLojaId || user?.loja_id || null;

  // Hook para ticket médio baseado no selfcheckout_dados
  const { dados: ticketMedioData } = useTicketMedioSelfcheckout(currentLojaId, 'completo');

  // All processing happens after hooks - using useMemo for performance
  const filteredVendas = useMemo(() => {
    return vendas.filter(venda => {
      const matchesSearch = venda.categoria.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategoria = categoriaFilter === 'all' || venda.categoria === categoriaFilter;
      return matchesSearch && matchesCategoria;
    });
  }, [vendas, searchTerm, categoriaFilter]);

  // Dados calculados da API Callfarma
  const dadosCallfarmaCalculados = useMemo(() => {
    if (!dadosCallfarma) return null;

    const { vendas_consolidadas } = dadosCallfarma;
    const totalTodosGrupos = vendas_consolidadas.total_geral_todos_grupos || 0;
    const totalGeral = vendas_consolidadas.geral || 0;
    const gruposComVendas = Object.keys(vendas_consolidadas.por_grupos || {}).length;

    // Calcular participação dos grupos em relação ao total geral
    const participacaoGrupos = totalGeral > 0 ? (totalTodosGrupos / totalGeral) * 100 : 0;

    return {
      totalTodosGrupos,
      totalGeral,
      gruposComVendas,
      participacaoGrupos,
      vendasPorGrupo: vendas_consolidadas.por_grupos || {},
      // Dados das categorias consolidadas da loja (mapeamento correto)
      rMais: vendas_consolidadas.r_mais || 0,
      perfumariaRMais: vendas_consolidadas.perfumaria_r_mais || 0,
      saude: vendas_consolidadas.saude || 0,
      convenienciaRMais: vendas_consolidadas.conveniencia_r_mais || 0
    };
  }, [dadosCallfarma]);

  const calculatedData = useMemo(() => {
    if (!dadosCallfarmaCalculados) {
      return {
        totalGeralVendas: 0,
        valorTotalTodas: 0,
        participacaoGeral: 0,
        totalVendas: 0,
        ticketMedio: ticketMedioData?.ticket_medio_geral || 0
      };
    }

    const totalGeralVendas = dadosCallfarmaCalculados.totalGeral;
    const valorTotalTodas = dadosCallfarmaCalculados.totalTodosGrupos;
    const participacaoGeral = valorTotalTodas > 0 ? (totalGeralVendas / valorTotalTodas) * 100 : 0;
    const totalVendas = filteredVendas.reduce((sum, venda) => sum + venda.valor_venda, 0);
    const ticketMedio = ticketMedioData?.ticket_medio_geral || (filteredVendas.length > 0 ? totalVendas / filteredVendas.length : 0);

    return {
      totalGeralVendas,
      valorTotalTodas,
      participacaoGeral,
      totalVendas,
      ticketMedio
    };
  }, [dadosCallfarmaCalculados, filteredVendas, ticketMedioData]);

  // Vendas por categoria para indicadores (baseado nos dados da API)
  const vendasPorCategoria = useMemo(() => {
    if (!dadosCallfarmaCalculados) return {};

    return {
      'r_mais': { valor: dadosCallfarmaCalculados.rMais, transacoes: 0 },
      'perfumaria_r_mais': { valor: dadosCallfarmaCalculados.perfumariaRMais, transacoes: 0 },
      'saude': { valor: dadosCallfarmaCalculados.saude, transacoes: 0 },
      'conveniencia_r_mais': { valor: dadosCallfarmaCalculados.convenienciaRMais, transacoes: 0 }
    };
  }, [dadosCallfarmaCalculados]);

  // Calcular indicadores com base nas metas (usando categorias corretas)
  const indicadoresComMetas = useMemo((): IndicadorMeta[] => {
    if (!dadosCallfarmaCalculados || !metasData) return [];

    const indicadores = [
      {
        categoria: 'r_mais',
        valor_realizado: dadosCallfarmaCalculados.rMais,
        nome_categoria: NOMES_CATEGORIAS.r_mais
      },
      {
        categoria: 'perfumaria_r_mais',
        valor_realizado: dadosCallfarmaCalculados.perfumariaRMais,
        nome_categoria: NOMES_CATEGORIAS.perfumaria_r_mais
      },
      {
        categoria: 'saude',
        valor_realizado: dadosCallfarmaCalculados.saude,
        nome_categoria: NOMES_CATEGORIAS.saude
      },
      {
        categoria: 'conveniencia_r_mais', 
        valor_realizado: dadosCallfarmaCalculados.convenienciaRMais,
        nome_categoria: NOMES_CATEGORIAS.conveniencia_r_mais
      }
    ];

    return indicadores.map(indicador => {
      const metaInfo = metasData[indicador.categoria];
      const metaValor = metaInfo?.meta || 0;
      const percentualMeta = metaValor > 0 ? (indicador.valor_realizado / metaValor) * 100 : 0;

      return {
        ...indicador,
        meta_valor: metaValor,
        percentual_meta: percentualMeta
      };
    }).filter(indicador => indicador.meta_valor > 0)
      .sort((a, b) => b.percentual_meta - a.percentual_meta);
  }, [dadosCallfarmaCalculados, metasData]);

  // Melhor e pior indicador baseado na % de meta realizada
  const indicadoresRanking = useMemo(() => {
    return {
      melhor: indicadoresComMetas[0] || null,
      pior: indicadoresComMetas[indicadoresComMetas.length - 1] || null
    };
  }, [indicadoresComMetas]);

  // Buscar metas da loja para calcular porcentagens
  useEffect(() => {
    if (!user || !selectedPeriod || !currentLojaId) return;
    
    const fetchMetas = async () => {
      try {
        console.log('🎯 Buscando metas da loja para comparar com API...');
        
        const { data: metasLoja } = await supabase
          .from('metas_loja')
          .select('*, metas_loja_categorias(*)')
          .eq('loja_id', currentLojaId)
          .eq('periodo_meta_id', selectedPeriod.id);

        const metasMap: Record<string, { meta: number; realizado: number; }> = {};

        // Usar as categorias corretas conforme especificado
        const categorias = ['r_mais', 'perfumaria_r_mais', 'saude', 'conveniencia_r_mais'];

        categorias.forEach(categoria => {
          const metaCategoria = metasLoja?.[0]?.metas_loja_categorias?.find((m: any) => m.categoria === categoria);
          const metaValor = metaCategoria?.meta_valor || 0;

          metasMap[categoria] = {
            meta: metaValor,
            realizado: 0
          };
        });
        
        setMetasData(metasMap);
        console.log('✅ Metas carregadas:', metasMap);
      } catch (error) {
        console.error('❌ Erro ao buscar metas:', error);
      }
    };

    fetchMetas();
  }, [user, selectedPeriod, currentLojaId]);

  // Função para buscar dados da API Callfarma
  const buscarDadosCallfarma = async () => {
    if (!selectedPeriod || !currentLojaId) return;

    try {
      setLoading(true);
      console.log('🚀 Buscando TODOS os dados da API Callfarma (incluindo terceiros)...');
      
      const dataInicio = format(new Date(selectedPeriod.startDate), 'yyyy-MM-dd');
      const dataFim = format(new Date(selectedPeriod.endDate), 'yyyy-MM-dd');

      // Ajustar datas baseado no filtro adicional
      let dataInicioAjustada = dataInicio;
      let dataFimAjustada = dataFim;

      const hoje = new Date();
      
      if (filtroAdicional === 'hoje') {
        dataInicioAjustada = dataFimAjustada = format(hoje, 'yyyy-MM-dd');
      } else if (filtroAdicional === 'ontem') {
        const ontem = new Date(hoje);
        ontem.setDate(hoje.getDate() - 1);
        dataInicioAjustada = dataFimAjustada = format(ontem, 'yyyy-MM-dd');
      } else if (filtroAdicional === 'ultima_semana') {
        const inicioSemana = new Date(hoje);
        inicioSemana.setDate(hoje.getDate() - 7);
        dataInicioAjustada = format(inicioSemana, 'yyyy-MM-dd');
        dataFimAjustada = format(hoje, 'yyyy-MM-dd');
      } else if (filtroAdicional === 'ultimo_mes') {
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        dataInicioAjustada = format(inicioMes, 'yyyy-MM-dd');
        dataFimAjustada = format(hoje, 'yyyy-MM-dd');
      }

      const dados = await buscarVendasCompletasComGrupos(dataInicioAjustada, dataFimAjustada, currentLojaId);
      setDadosCallfarma(dados);

      console.log('✅ Dados da API Callfarma carregados:', dados);
    } catch (error) {
      console.error('❌ Erro ao buscar dados da Callfarma:', error);
      toast.error('Erro ao carregar dados externos da Callfarma');
    } finally {
      setLoading(false);
    }
  };

  // Função para buscar lista de vendas da API
  const buscarVendasAPI = async () => {
    if (!selectedPeriod || !currentLojaId) return;

    try {
      console.log('📋 Buscando lista de vendas da API...');
      
      const dataInicio = format(new Date(selectedPeriod.startDate), 'yyyy-MM-dd');
      const dataFim = format(new Date(selectedPeriod.endDate), 'yyyy-MM-dd');

      // Ajustar datas baseado no filtro adicional
      let dataInicioAjustada = dataInicio;
      let dataFimAjustada = dataFim;

      const hoje = new Date();
      
      if (filtroAdicional === 'hoje') {
        dataInicioAjustada = dataFimAjustada = format(hoje, 'yyyy-MM-dd');
      } else if (filtroAdicional === 'ontem') {
        const ontem = new Date(hoje);
        ontem.setDate(hoje.getDate() - 1);
        dataInicioAjustada = dataFimAjustada = format(ontem, 'yyyy-MM-dd');
      } else if (filtroAdicional === 'ultima_semana') {
        const inicioSemana = new Date(hoje);
        inicioSemana.setDate(hoje.getDate() - 7);
        dataInicioAjustada = format(inicioSemana, 'yyyy-MM-dd');
        dataFimAjustada = format(hoje, 'yyyy-MM-dd');
      } else if (filtroAdicional === 'ultimo_mes') {
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        dataInicioAjustada = format(inicioMes, 'yyyy-MM-dd');
        dataFimAjustada = format(hoje, 'yyyy-MM-dd');
      }

      const vendedorId = vendedorFilter !== 'all' ? parseInt(vendedorFilter) : undefined;
      const categoria = categoriaFilter !== 'all' ? categoriaFilter : undefined;

      const vendasAPI = await buscarVendasListaAPI(
        dataInicioAjustada, 
        dataFimAjustada, 
        currentLojaId, 
        vendedorId,
        categoria
      );
      
      setVendas(vendasAPI);
      console.log('✅ Lista de vendas da API carregada:', vendasAPI.length);
    } catch (error) {
      console.error('❌ Erro ao buscar lista de vendas:', error);
      toast.error('Erro ao carregar lista de vendas da API');
    }
  };

  // Função para gerar relatório de grupos
  const handleGerarRelatorioGrupos = async () => {
    if (!selectedPeriod || !currentLojaId) return;

    try {
      const dataInicio = format(new Date(selectedPeriod.startDate), 'yyyy-MM-dd');
      const dataFim = format(new Date(selectedPeriod.endDate), 'yyyy-MM-dd');

      const relatorio = await gerarRelatorioGrupos(dataInicio, dataFim, currentLojaId);
      setRelatorioGrupos(relatorio);
      setMostrarRelatorioGrupos(true);

      toast.success('Relatório de grupos gerado com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao gerar relatório:', error);
      toast.error('Erro ao gerar relatório de grupos');
    }
  };

  // Gerar dados do gráfico baseados na API Callfarma
  const generateChartDataFromAPI = async () => {
    if (!selectedPeriod || !currentLojaId) return;

    try {
      console.log('📊 Gerando dados do gráfico baseados na API Callfarma...');
      
      const hoje = new Date();
      const inicioMes = startOfMonth(subMonths(hoje, 2));
      const dataInicio = format(inicioMes, 'yyyy-MM-dd');
      const dataFim = format(hoje, 'yyyy-MM-dd');

      const vendedorId = vendedorFilter !== 'all' ? parseInt(vendedorFilter) : undefined;
      
      const vendasPorDia = await buscarDadosGraficosAPI(dataInicio, dataFim, currentLojaId, vendedorId);
      
      // Agrupar por data
      const chartMap = new Map<string, ChartData>();

      // Inicializar com todos os dias do período
      const allDays = eachDayOfInterval({
        start: inicioMes,
        end: hoje
      });

      const shouldExcludeSundays = lojaInfo?.regiao === 'centro' && (selectedLojaId || !canViewAllStores);
      
      allDays.forEach(day => {
        const dayOfWeek = getDay(day);
        if (shouldExcludeSundays && dayOfWeek === 0) {
          return;
        }
        
        const dateStr = format(day, 'yyyy-MM-dd');
        chartMap.set(dateStr, {
          date: format(day, 'dd/MM'),
          value: 0,
          transactions: 0,
          geral: 0,
          saude: 0,
          perfumaria_r_mais: 0,
          conveniencia_r_mais: 0,
          r_mais: 0
        });
      });

      // Processar vendas por categoria da API (usando grupos corretos)
      vendasPorDia.forEach((venda: any) => {
        const existing = chartMap.get(venda.DATA);
        if (existing) {
          const valorVenda = parseFloat(venda.TOTAL_VLR_VE || 0);
          const valorDevolucao = parseFloat(venda.TOTAL_VLR_DV || 0);
          const valorLiquido = valorVenda - valorDevolucao;
          
          existing.value += valorLiquido;
          existing.transactions += 1;

          const grupoId = parseInt(venda.CDGRUPO);
          
          // Mapear grupos para categorias do gráfico (conforme especificação)
          if ([22].includes(grupoId)) {
            existing.saude += valorLiquido;
          } else if ([46].includes(grupoId)) {
            existing.perfumaria_r_mais += valorLiquido;
          } else if ([36, 13].includes(grupoId)) {
            existing.conveniencia_r_mais += valorLiquido;
          } else if ([20, 25].includes(grupoId)) {
            existing.r_mais += valorLiquido;
          }
          
          // Geral = soma de todos
          existing.geral += valorLiquido;
        }
      });

      const finalData = Array.from(chartMap.values());
      setChartData(finalData);
      console.log('✅ Dados do gráfico gerados baseados na API');
    } catch (error) {
      console.error('❌ Erro ao gerar dados do gráfico:', error);
    }
  };

  // useEffect ALWAYS RUNS - no early returns before this
  useEffect(() => {
    if (user && !initialized) {
      fetchLojaInfo();
      fetchVendedores();
      setInitialized(true);
    }
  }, [user, initialized]);

  // Refetch when filters change
  useEffect(() => {
    if (user && initialized) {
      fetchVendedores();
      buscarDadosCallfarma();
      buscarVendasAPI();
    }
  }, [selectedPeriod, vendedorFilter, filtroAdicional, user, initialized, currentLojaId, selectedLojaId, categoriaFilter]);

  // Quando selecionar um colaborador, mostrar todas as categorias por padrão
  useEffect(() => {
    if (vendedorFilter !== 'all') {
      setCategoriaFilter('all');
      setChartCategoriaFilter('multi');
    }
  }, [vendedorFilter]);

  // Gerar dados do gráfico quando dados mudarem
  useEffect(() => {
    if (user && initialized) {
      generateChartDataFromAPI();
    }
  }, [dadosCallfarma, lojaInfo, user, chartCategoriaFilter, vendedorFilter, initialized]);

  const fetchVendedores = async () => {
    try {
      let query = supabase
        .from('usuarios')
        .select('id, nome')
        .eq('status', 'ativo')
        .order('nome');

      if (selectedLojaId) {
        query = query.eq('loja_id', selectedLojaId);
      } else if (canViewAllStores) {
        // Não adiciona filtro de loja
      } else {
        query = query.eq('loja_id', user?.loja_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setVendedores(data || []);
    } catch (error) {
      console.error('Erro ao buscar vendedores:', error);
    }
  };

  const fetchLojaInfo = async () => {
    if (!currentLojaId) return;
    try {
      const { data, error } = await supabase
        .from('lojas')
        .select('regiao, numero, nome')
        .eq('id', currentLojaId)
        .single();
      if (error) throw error;
      setLojaInfo(data);
    } catch (error) {
      console.error('Erro ao buscar informações da loja:', error);
    }
  };

  // NOW we can do early returns AFTER all hooks
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

  const getCategoriaColor = (categoria: string) => {
    return `${getClasseBgCategoria(categoria)} ${getClasseCorCategoria(categoria)}`;
  };

  const singleStrokeColor = CORES_CATEGORIAS[chartCategoriaFilter as keyof typeof CORES_CATEGORIAS] || CORES_CATEGORIAS.geral;

  return (
    <div className="page-container space-y-4 sm:space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {canViewAllStores && !selectedLojaId 
              ? 'Vendas API Callfarma - Todas as Lojas' 
              : lojaInfo 
                ? `Vendas API - ${lojaInfo.numero} - ${lojaInfo.nome.toUpperCase()}` 
                : `Vendas API - Loja ${currentLojaId || user.loja_id}`
            }
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Dados da API Callfarma - Inclui vendas de terceiros
            {selectedPeriod && (
              <span className="block text-xs text-muted-foreground/70 mt-1">
                Período: {selectedPeriod.label}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {canViewAllStores && (
            <StoreSelector 
              selectedLojaId={selectedLojaId} 
              onLojaChange={setSelectedLojaId} 
              userLojaId={user.loja_id} 
            />
          )}
          <PeriodSelector />
        </div>
      </div>

      {/* Statistics Cards - Baseados na API Callfarma */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {/* Card Total da API Callfarma */}
        <Card className="border-2 border-success/20">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Total API Callfarma</p>
                <p className="text-lg sm:text-2xl font-bold text-success">
                  {dadosCallfarmaCalculados 
                    ? `R$ ${dadosCallfarmaCalculados.totalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` 
                    : (loading ? 'Carregando...' : 'R$ 0,00')
                  }
                </p>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Inclui terceiros
                </p>
              </div>
              <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        {/* Card Total Todos os Grupos */}
        <Card className="border-2 border-primary/20">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Todos os Grupos</p>
                <p className="text-lg sm:text-2xl font-bold text-primary">
                  {dadosCallfarmaCalculados 
                    ? `R$ ${dadosCallfarmaCalculados.totalTodosGrupos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` 
                    : (loading ? 'Carregando...' : 'R$ 0,00')
                  }
                </p>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {dadosCallfarmaCalculados ? `${dadosCallfarmaCalculados.gruposComVendas} grupos ativos` : 'API Callfarma'}
                </p>
              </div>
              <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        {/* Card de Ticket Médio (selfcheckout) */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Ticket Médio</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground">
                  R$ {calculatedData.ticketMedio.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </p>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {ticketMedioData 
                    ? `Vendas Geral: R$ ${ticketMedioData.total_vendas_geral_periodo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` 
                    : 'Selfcheckout'
                  }
                </p>
              </div>
              <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        {/* Card Participação dos Grupos */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Participação Grupos</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground">
                  {dadosCallfarmaCalculados 
                    ? `${dadosCallfarmaCalculados.participacaoGrupos.toFixed(1)}%`
                    : '0.0%'
                  }
                </p>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  vs Total Geral
                </p>
              </div>
              <Package className="w-6 h-6 sm:w-8 sm:h-8 text-warning" />
            </div>
          </CardContent>
        </Card>

        {/* Melhor Indicador (baseado em metas) */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Melhor Indicador</p>
                {indicadoresRanking.melhor ? (
                  <>
                    <p className="text-base sm:text-lg font-bold text-foreground">
                      {indicadoresRanking.melhor.nome_categoria}
                    </p>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      {indicadoresRanking.melhor.percentual_meta.toFixed(1)}% da meta
                    </p>
                  </>
                ) : (
                  <p className="text-lg sm:text-2xl font-bold text-muted-foreground">-</p>
                )}
              </div>
              <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        {/* Pior Indicador (baseado em metas) */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Pior Indicador</p>
                {indicadoresRanking.pior ? (
                  <>
                    <p className="text-base sm:text-lg font-bold text-foreground">
                      {indicadoresRanking.pior.nome_categoria}
                    </p>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      {indicadoresRanking.pior.percentual_meta.toFixed(1)}% da meta
                    </p>
                  </>
                ) : (
                  <p className="text-lg sm:text-2xl font-bold text-muted-foreground">-</p>
                )}
              </div>
              <TrendingDown className="w-6 h-6 sm:w-8 sm:h-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Botão para Relatório de Grupos */}
      <div className="flex justify-end mb-4">
        <Button 
          onClick={handleGerarRelatorioGrupos}
          disabled={loading || !selectedPeriod || !currentLojaId}
          className="flex items-center gap-2"
        >
          <BarChart3 className="w-4 h-4" />
          Relatório Detalhado de Grupos
        </Button>
      </div>

      {/* Seção do Relatório de Grupos */}
      {mostrarRelatorioGrupos && relatorioGrupos && (
        <Card className="mb-4 sm:mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="w-4 h-4 sm:w-5 sm:h-5" />
                Relatório Detalhado de Grupos - API Callfarma
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setMostrarRelatorioGrupos(false)}
              >
                Fechar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Grupos com Vendas */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Grupos com Vendas ({relatorioGrupos.grupos_com_vendas.length})</h3>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {relatorioGrupos.grupos_com_vendas.map((item: any, index: number) => (
                    <div key={item.grupo.CDGRUPO} className="p-3 border rounded-lg bg-card">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            #{item.grupo.CDGRUPO} - {item.grupo.NMGRUPO}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.numero_transacoes} transações
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm">
                            R$ {item.valor_total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.percentual_total.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full" 
                          style={{ width: `${Math.min(item.percentual_total, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grupos sem Vendas */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Grupos sem Vendas ({relatorioGrupos.grupos_sem_vendas.length})</h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {relatorioGrupos.grupos_sem_vendas.map((grupo: any) => (
                    <div key={grupo.CDGRUPO} className="p-2 border rounded bg-muted/30">
                      <p className="text-sm">
                        #{grupo.CDGRUPO} - {grupo.NMGRUPO}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-primary/5 rounded-lg">
              <h4 className="font-semibold mb-2">Resumo</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Geral:</span>
                  <span className="font-bold ml-2">
                    R$ {relatorioGrupos.total_geral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Grupos Ativos:</span>
                  <span className="font-bold ml-2">
                    {relatorioGrupos.grupos_com_vendas.length} de {relatorioGrupos.grupos_com_vendas.length + relatorioGrupos.grupos_sem_vendas.length}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Indicadores por Categoria - Baseados na API e Metas */}
      <Card className="mb-4 sm:mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
            Indicadores por Categoria - API vs Metas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {indicadoresComMetas.map((indicador) => (
              <div key={indicador.categoria} className="p-3 sm:p-4 border rounded-lg bg-card">
                <div className="flex items-center justify-between mb-2">
                  <Badge 
                    className={`${indicador.percentual_meta >= 100 ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`} 
                    variant="secondary"
                  >
                    <span className="text-xs">{indicador.nome_categoria}</span>
                  </Badge>
                  <span className="text-xs sm:text-sm font-medium">
                    {indicador.percentual_meta.toFixed(1)}%
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-base sm:text-lg font-bold">
                    R$ {indicador.valor_realizado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Meta: R$ {indicador.meta_valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </p>
                </div>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div 
                    className={`h-2 rounded-full ${indicador.percentual_meta >= 100 ? 'bg-success' : 'bg-warning'}`}
                    style={{ width: `${Math.min(indicador.percentual_meta, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="mb-4 sm:mb-6">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>Filtros</span>
            <Button size="sm" className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Nova Venda
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filtroAdicional} onValueChange={setFiltroAdicional}>
              <SelectTrigger>
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="periodo">Período Selecionado</SelectItem>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="ontem">Ontem</SelectItem>
                <SelectItem value="ultima_semana">Última Semana</SelectItem>
                <SelectItem value="ultimo_mes">Último Mês</SelectItem>
              </SelectContent>
            </Select>

            <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Vendedores</SelectItem>
                {vendedores.map((vendedor) => (
                  <SelectItem key={vendedor.id} value={vendedor.id.toString()}>
                    {vendedor.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Categorias</SelectItem>
                <SelectItem value="geral">Geral</SelectItem>
                <SelectItem value="r_mais">Rentáveis R+</SelectItem>
                <SelectItem value="perfumaria_r_mais">Perfumaria R+</SelectItem>
                <SelectItem value="conveniencia_r_mais">Conveniência R+</SelectItem>
                <SelectItem value="saude">GoodLife</SelectItem>
                <SelectItem value="similar">Similar</SelectItem>
                <SelectItem value="generico">Genérico</SelectItem>
                <SelectItem value="dermocosmetico">Dermocosmético</SelectItem>
                <SelectItem value="perfumaria_alta">Perfumaria Alta</SelectItem>
                <SelectItem value="conveniencia">Conveniência</SelectItem>
                <SelectItem value="brinquedo">Brinquedo</SelectItem>
              </SelectContent>
            </Select>

            <div className="text-xs sm:text-sm text-muted-foreground flex items-center">
              Total: {filteredVendas.length} vendas
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts and Table */}
      <Tabs defaultValue="charts" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="charts" className="flex items-center gap-2 text-sm">
            <LineChart className="w-4 h-4" />
            <span className="hidden sm:inline">Gráficos API</span>
            <span className="sm:hidden">Gráfico</span>
          </TabsTrigger>
          <TabsTrigger value="table" className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Dados API</span>
            <span className="sm:hidden">Lista</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="charts" className="space-y-4">
          {/* Filtro do Gráfico */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <LineChart className="w-4 h-4 sm:w-5 sm:h-5" />
                Gráfico de Vendas - API Callfarma
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={chartCategoriaFilter} onValueChange={setChartCategoriaFilter}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Categoria do Gráfico" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover border border-border shadow-md">
                  <SelectItem value="geral">Total Geral</SelectItem>
                  <SelectItem value="saude">GoodLife</SelectItem>
                  <SelectItem value="perfumaria_r_mais">Perfumaria R+</SelectItem>
                  <SelectItem value="conveniencia_r_mais">Conveniência R+</SelectItem>
                  <SelectItem value="r_mais">Rentáveis R+</SelectItem>
                  <SelectItem value="multi">Gráfico Multi Linha - Todos</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {chartCategoriaFilter === 'multi' 
                  ? 'Evolução de Vendas - Todos os Indicadores' 
                  : `Evolução de Vendas - ${NOMES_CATEGORIAS[chartCategoriaFilter as keyof typeof NOMES_CATEGORIAS] || 'Total Geral'}`
                }
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 will-change-transform [contain:layout_paint]">
                <ResponsiveContainer width="100%" height="100%">
                  {chartCategoriaFilter === 'multi' ? (
                    // Gráfico multi-linha para todos os indicadores
                    <RechartsLineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        fontSize={12} 
                        tick={{ fontSize: 10 }} 
                      />
                      <YAxis 
                        fontSize={12} 
                        tick={{ fontSize: 10 }} 
                        tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} 
                      />
                      <Tooltip 
                        formatter={(value: number, name: string) => [
                          `R$ ${value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 
                          NOMES_CATEGORIAS[name as keyof typeof NOMES_CATEGORIAS] || name
                        ]} 
                        labelFormatter={(label) => `Data: ${label}`} 
                      />
                      <Legend formatter={(value) => NOMES_CATEGORIAS[value as keyof typeof NOMES_CATEGORIAS] || value} />
                      <Line 
                        type="monotone" 
                        dataKey="saude" 
                        stroke={CORES_CATEGORIAS.saude} 
                        strokeWidth={2} 
                        strokeDasharray="5 5" 
                        dot={{ r: 3 }} 
                        isAnimationActive={false} 
                        name="saude" 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="perfumaria_r_mais" 
                        stroke={CORES_CATEGORIAS.perfumaria_r_mais} 
                        strokeWidth={2} 
                        strokeDasharray="10 5" 
                        dot={{ r: 3 }} 
                        isAnimationActive={false} 
                        name="perfumaria_r_mais" 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="conveniencia_r_mais" 
                        stroke={CORES_CATEGORIAS.conveniencia_r_mais} 
                        strokeWidth={2} 
                        strokeDasharray="15 5" 
                        dot={{ r: 3 }} 
                        isAnimationActive={false} 
                        name="conveniencia_r_mais" 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="r_mais" 
                        stroke={CORES_CATEGORIAS.r_mais} 
                        strokeWidth={2} 
                        strokeDasharray="3 3" 
                        dot={{ r: 3 }} 
                        isAnimationActive={false} 
                        name="r_mais" 
                      />
                    </RechartsLineChart>
                  ) : (
                    // Gráfico single-line para categoria específica
                    <RechartsLineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        fontSize={12} 
                        tick={{ fontSize: 10 }} 
                      />
                      <YAxis 
                        fontSize={12} 
                        tick={{ fontSize: 10 }} 
                        tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} 
                      />
                      <Tooltip 
                        formatter={(value: number) => [
                          `R$ ${value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 
                          'Vendas'
                        ]} 
                        labelFormatter={(label) => `Data: ${label}`} 
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey={chartCategoriaFilter === 'geral' ? 'geral' : chartCategoriaFilter}
                        stroke={singleStrokeColor} 
                        strokeWidth={3} 
                        dot={{ r: 4 }} 
                        isAnimationActive={false} 
                        name="Vendas" 
                      />
                    </RechartsLineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="table">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Vendas - API Callfarma</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-2">Carregando dados da API...</span>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Vendedor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredVendas.map((venda) => (
                          <TableRow key={venda.id}>
                            <TableCell>
                              {new Date(venda.data_venda).toLocaleDateString('pt-BR')}
                            </TableCell>
                            <TableCell>
                              <Badge className={getCategoriaColor(venda.categoria)} variant="secondary">
                                <i className={`${getIconeCategoria(venda.categoria)} mr-1`}></i>
                                {getNomeCategoria(venda.categoria)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              R$ {venda.valor_venda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              {vendedores.find(v => v.id === (venda.registrado_por_usuario_id || venda.usuario_id))?.nome || 'N/A'}
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredVendas.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              Nenhuma venda encontrada na API
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden space-y-3">
                    {filteredVendas.map((venda) => (
                      <div key={venda.id} className="border rounded-lg p-4 bg-card">
                        <div className="flex justify-between items-start mb-2">
                          <div className="text-sm text-muted-foreground">
                            {new Date(venda.data_venda).toLocaleDateString('pt-BR')}
                          </div>
                          <div className="text-lg font-semibold">
                            R$ {venda.valor_venda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Badge className={getCategoriaColor(venda.categoria)} variant="secondary">
                            <i className={`${getIconeCategoria(venda.categoria)} mr-1`}></i>
                            {getNomeCategoria(venda.categoria)}
                          </Badge>
                          <div className="text-sm text-muted-foreground">
                            Vendedor: {vendedores.find(v => v.id === (venda.registrado_por_usuario_id || venda.usuario_id))?.nome || 'N/A'}
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredVendas.length === 0 && (
                      <div className="text-center text-muted-foreground py-8 border rounded-lg">
                        Nenhuma venda encontrada na API
                      </div>
                    )}
                  </div>

                  <div className="text-center text-muted-foreground py-4">
                    <p className="text-sm">
                      💡 Dados incluem vendas de terceiros registradas na loja via API Callfarma
                    </p>
                    <p className="text-xs mt-1">
                      Mapeamento: R+ (20,25) | Perfumaria R+ (46) | Saúde (22) | Conveniência R+ (36,13)
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}