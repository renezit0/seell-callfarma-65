import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTicketMedioSelfcheckout } from '@/hooks/useTicketMedioSelfcheckout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Calendar, DollarSign, TrendingUp, BarChart3, LineChart, Trophy, TrendingDown, Users } from 'lucide-react';
import { getNomeCategoria, getIconeCategoria, getClasseCorCategoria, getClasseBgCategoria, getCorCategoria } from '@/utils/categories';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format, startOfMonth, subMonths, eachDayOfInterval, getDay } from 'date-fns';
import { PeriodSelector } from '@/components/PeriodSelector';
import { StoreSelector } from '@/components/StoreSelector';
import { usePeriodContext } from '@/contexts/PeriodContext';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

// Mapeamento dos grupos conforme fornecido
const CATEGORIAS_GRUPOS = {
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

const MAPEAMENTO_LOJA_CATEGORIAS = {
  'r_mais': [20, 25],
  'perfumaria_r_mais': [46],
  'saude': [22],
  'conveniencia_r_mais': [36, 13]
};

// Criar mapeamento inverso para facilitar a busca
const GRUPOS_PARA_CATEGORIAS: Record<number, string> = {};
Object.entries(CATEGORIAS_GRUPOS).forEach(([categoria, grupos]) => {
  grupos.forEach(grupo => {
    GRUPOS_PARA_CATEGORIAS[grupo] = categoria;
  });
});

interface VendaAPI {
  CDFIL: number;
  NOMEFIL: string;
  CDFUN: number;
  NOMEFUN: string;
  DATA: string;
  TOTAL_QTD_VE: number;
  TOTAL_QTD_DV: number;
  TOTAL_VLR_VE: number;
  TOTAL_VLR_DV: number;
  CDGRUPO?: number;
}

interface VendaProcessada {
  id: string;
  cdfun: number;
  nome_funcionario: string;
  data_venda: string;
  categoria: string;
  valor_bruto: number;
  valor_liquido: number;
  quantidade: number;
}

interface ChartData {
  date: string;
  value: number;
  transactions: number;
  geral: number;
  goodlife: number;
  perfumaria_r_mais: number;
  conveniencia_r_mais: number;
  r_mais: number;
}

interface Funcionario {
  cdfun: number;
  nome: string;
  matricula?: string;
}

export default function Vendas() {
  const { user, loading: authLoading } = useAuth();
  const { selectedPeriod } = usePeriodContext();
  
  const [vendasProcessadas, setVendasProcessadas] = useState<VendaProcessada[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [lojaInfo, setLojaInfo] = useState<{ regiao: string; numero: string; nome: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('all');
  const [funcionarioFilter, setFuncionarioFilter] = useState<string>('all');
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [chartCategoriaFilter, setChartCategoriaFilter] = useState<string>('geral');
  const [filtroAdicional, setFiltroAdicional] = useState<string>('periodo');
  const [selectedLojaId, setSelectedLojaId] = useState<number | null>(null);
  const [numeroLoja, setNumeroLoja] = useState<string>('');
  
  const canViewAllStores = user?.tipo && ['admin', 'supervisor', 'compras'].includes(user.tipo);
  const currentLojaId = canViewAllStores ? selectedLojaId : (user?.loja_id || null);
  
  const { dados: ticketMedioData } = useTicketMedioSelfcheckout(currentLojaId, 'completo');

  // Função para mapear grupo para categoria
  const mapearGrupoParaCategoria = (cdgrupo?: number): string => {
    if (!cdgrupo) return 'geral';
    return GRUPOS_PARA_CATEGORIAS[cdgrupo] || 'geral';
  };

  // Filtros das vendas
  const filteredVendas = useMemo(() => {
    return vendasProcessadas.filter(venda => {
      const matchesSearch = venda.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           venda.nome_funcionario.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategoria = categoriaFilter === 'all' || venda.categoria === categoriaFilter;
      const matchesFuncionario = funcionarioFilter === 'all' || venda.cdfun.toString() === funcionarioFilter;
      return matchesSearch && matchesCategoria && matchesFuncionario;
    });
  }, [vendasProcessadas, searchTerm, categoriaFilter, funcionarioFilter]);

  // Cálculos das vendas
  const calculatedData = useMemo(() => {
    const vendasGeral = vendasProcessadas.filter(v => v.categoria === 'geral');
    const totalGeralVendas = vendasGeral.reduce((sum, venda) => sum + venda.valor_liquido, 0);
    
    const valorTotalTodas = vendasProcessadas.reduce((sum, venda) => sum + venda.valor_liquido, 0);
    const participacaoGeral = valorTotalTodas > 0 ? (totalGeralVendas / valorTotalTodas * 100) : 0;
    
    const totalVendas = filteredVendas.reduce((sum, venda) => sum + venda.valor_liquido, 0);
    const ticketMedio = filteredVendas.length > 0 ? totalVendas / filteredVendas.length : 0;

    return {
      totalGeralVendas,
      valorTotalTodas,
      participacaoGeral,
      totalVendas,
      ticketMedio
    };
  }, [vendasProcessadas, filteredVendas]);

  // Vendas por categoria
  const vendasPorCategoria = useMemo(() => {
    const grouped = vendasProcessadas.reduce((acc, venda) => {
      let categoria = venda.categoria;
      
      if (venda.categoria === 'similar' || venda.categoria === 'generico') {
        categoria = 'generico_similar';
      } else if (venda.categoria === 'conveniencia' || venda.categoria === 'brinquedo') {
        categoria = 'conveniencia_r_mais';
      } else if (venda.categoria === 'rentaveis20' || venda.categoria === 'rentaveis25') {
        categoria = 'r_mais';
      } else if (venda.categoria === 'goodlife') {
        categoria = 'goodlife';
      } else if (venda.categoria === 'perfumaria_alta') {
        categoria = 'perfumaria_r_mais';
      }
      
      if (!acc[categoria]) {
        acc[categoria] = { valor: 0, transacoes: 0 };
      }
      acc[categoria].valor += venda.valor_liquido;
      acc[categoria].transacoes += 1;
      return acc;
    }, {} as Record<string, { valor: number; transacoes: number }>);
    
    return grouped;
  }, [vendasProcessadas]);

  const [metasData, setMetasData] = useState<Record<string, { meta: number; realizado: number }>>({});

  // Buscar metas
  useEffect(() => {
    if (!user || !selectedPeriod || !currentLojaId) return;
    
    const fetchMetas = async () => {
      try {
        const { data: metasLoja } = await supabase
          .from('metas_loja')
          .select('*, metas_loja_categorias(*)')
          .eq('loja_id', currentLojaId)
          .eq('periodo_meta_id', selectedPeriod.id);

        const metasMap: Record<string, { meta: number; realizado: number }> = {};
        const categorias = ['r_mais', 'perfumaria_r_mais', 'conveniencia_r_mais', 'goodlife'];
        
        categorias.forEach(categoria => {
          let metaValor = 0;
          
          if (categoria === 'geral') {
            metaValor = metasLoja?.[0]?.meta_valor_total || 0;
          } else {
            const metaCategoria = metasLoja?.[0]?.metas_loja_categorias?.find(
              (m: any) => m.categoria === categoria
            );
            metaValor = metaCategoria?.meta_valor || 0;
          }
          
          const categoriaDados = vendasPorCategoria[categoria];
          const realizado = categoriaDados?.valor || 0;
          
          metasMap[categoria] = { meta: metaValor, realizado };
        });
        
        setMetasData(metasMap);
      } catch (error) {
        console.error('Erro ao buscar metas:', error);
      }
    };
    
    fetchMetas();
  }, [user, selectedPeriod, vendasPorCategoria, currentLojaId]);

  // Ranking de indicadores
  const indicadoresRanking = useMemo(() => {
    const indicadores = Object.entries(vendasPorCategoria)
      .filter(([categoria]) => categoria !== 'geral' && categoria !== 'generico_similar')
      .map(([categoria, dados]) => {
        const metaInfo = metasData[categoria];
        const percentualMeta = metaInfo?.meta > 0 ? (dados.valor / metaInfo.meta) * 100 : 0;
        
        return {
          categoria,
          valor: dados.valor,
          transacoes: dados.transacoes,
          meta: metaInfo?.meta || 0,
          percentualMeta
        };
      })
      .filter(indicador => indicador.meta > 0)
      .sort((a, b) => b.percentualMeta - a.percentualMeta);
    
    return {
      melhor: indicadores[0] || null,
      pior: indicadores[indicadores.length - 1] || null
    };
  }, [vendasPorCategoria, metasData]);

  // Buscar informações da loja e número
  useEffect(() => {
    if (currentLojaId) {
      fetchLojaInfo();
    }
  }, [currentLojaId]);

  // Buscar vendas quando mudar período ou loja
  useEffect(() => {
    if (user && selectedPeriod && numeroLoja) {
      fetchVendasAPI();
    }
  }, [user, selectedPeriod, numeroLoja, filtroAdicional]);

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
      setNumeroLoja(data.numero);
    } catch (error) {
      console.error('Erro ao buscar informações da loja:', error);
    }
  };

  // Buscar vendas da API externa - OTIMIZADO para uma loja específica
  const fetchVendasAPI = async () => {
    if (!numeroLoja || !selectedPeriod) return;
    
    try {
      setLoading(true);
      console.log('🔍 Buscando vendas da API para loja:', numeroLoja);

      // Calcular período
      const hoje = new Date();
      let dataInicio: string;
      let dataFim: string;

      if (filtroAdicional === 'hoje') {
        dataInicio = dataFim = format(hoje, 'yyyy-MM-dd');
      } else if (filtroAdicional === 'ontem') {
        const ontem = new Date(hoje);
        ontem.setDate(hoje.getDate() - 1);
        dataInicio = dataFim = format(ontem, 'yyyy-MM-dd');
      } else if (filtroAdicional === 'ultima_semana') {
        const inicioSemana = new Date(hoje);
        inicioSemana.setDate(hoje.getDate() - 7);
        dataInicio = format(inicioSemana, 'yyyy-MM-dd');
        dataFim = format(hoje, 'yyyy-MM-dd');
      } else if (filtroAdicional === 'ultimo_mes') {
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        dataInicio = format(inicioMes, 'yyyy-MM-dd');
        dataFim = format(hoje, 'yyyy-MM-dd');
      } else {
        // Período selecionado
        const dataInicioAjustada = new Date(selectedPeriod.startDate);
        dataInicioAjustada.setDate(dataInicioAjustada.getDate() + 1);
        dataInicio = format(dataInicioAjustada, 'yyyy-MM-dd');
        dataFim = format(selectedPeriod.endDate, 'yyyy-MM-dd');
      }

      // Fazer requisição ÚNICA e OTIMIZADA para a loja específica
      const { data, error } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/financeiro/vendas-por-funcionario',
          params: {
            dataFim,
            dataIni: dataInicio,
            groupBy: 'scekarde.DATA,scefun.CDFUN,sceprodu.CDGRUPO',
            orderBy: 'scekarde.DATA desc',
            filtroFiliais: numeroLoja.padStart(2, '0') // FILTRO DIRETO pela loja
          }
        }
      });

      if (error) {
        console.error('Erro na API:', error);
        throw error;
      }

      const dadosAPI: VendaAPI[] = data?.msg || [];
      console.log('📊 Dados recebidos:', dadosAPI.length, 'registros');

      // Processar dados de forma mais eficiente
      const vendasMap = new Map<string, VendaProcessada>();

      dadosAPI.forEach((item, index) => {
        const categoria = mapearGrupoParaCategoria(item.CDGRUPO);
        const valorLiquido = (item.TOTAL_VLR_VE || 0) - (item.TOTAL_VLR_DV || 0);
        
        if (valorLiquido > 0) {
          const key = `${item.CDFUN}-${item.DATA}-${item.CDGRUPO || 0}`;
          
          if (vendasMap.has(key)) {
            // Agregar se já existe
            const vendaExistente = vendasMap.get(key)!;
            vendaExistente.valor_bruto += (item.TOTAL_VLR_VE || 0);
            vendaExistente.valor_liquido += valorLiquido;
            vendaExistente.quantidade += (item.TOTAL_QTD_VE || 0) - (item.TOTAL_QTD_DV || 0);
          } else {
            // Criar nova venda
            vendasMap.set(key, {
              id: key,
              cdfun: item.CDFUN,
              nome_funcionario: item.NOMEFUN,
              data_venda: item.DATA.split('T')[0],
              categoria,
              valor_bruto: item.TOTAL_VLR_VE || 0,
              valor_liquido: valorLiquido,
              quantidade: (item.TOTAL_QTD_VE || 0) - (item.TOTAL_QTD_DV || 0)
            });
          }
        }
      });

      const vendasProcessadasArray = Array.from(vendasMap.values());
      
      // Extrair funcionários únicos
      const funcionariosUnicos = Array.from(
        new Map(
          dadosAPI.map(item => [item.CDFUN, { cdfun: item.CDFUN, nome: item.NOMEFUN }])
        ).values()
      );

      console.log('✅ Processamento concluído:', vendasProcessadasArray.length, 'vendas,', funcionariosUnicos.length, 'funcionários');
      
      setVendasProcessadas(vendasProcessadasArray);
      setFuncionarios(funcionariosUnicos);
      
    } catch (error) {
      console.error('Erro ao buscar vendas da API:', error);
      toast.error('Erro ao carregar vendas da API externa');
    } finally {
      setLoading(false);
    }
  };

  // Gerar dados do gráfico de forma simplificada
  useEffect(() => {
    if (vendasProcessadas.length > 0) {
      generateChartData();
    }
  }, [vendasProcessadas, chartCategoriaFilter]);

  const generateChartData = () => {
    try {
      const chartMap = new Map<string, ChartData>();
      
      // Inicializar últimos 30 dias
      const hoje = new Date();
      const inicio = new Date(hoje);
      inicio.setDate(hoje.getDate() - 30);
      
      const allDays = eachDayOfInterval({ start: inicio, end: hoje });
      const shouldExcludeSundays = lojaInfo?.regiao === 'centro';

      allDays.forEach(day => {
        const dayOfWeek = getDay(day);
        if (shouldExcludeSundays && dayOfWeek === 0) return;

        const dateStr = format(day, 'yyyy-MM-dd');
        chartMap.set(dateStr, {
          date: format(day, 'dd/MM'),
          value: 0,
          transactions: 0,
          geral: 0,
          goodlife: 0,
          perfumaria_r_mais: 0,
          conveniencia_r_mais: 0,
          r_mais: 0
        });
      });

      // Processar vendas para o gráfico
      vendasProcessadas.forEach((venda) => {
        const existing = chartMap.get(venda.data_venda);
        if (existing) {
          existing.value += venda.valor_liquido;
          existing.transactions += 1;

          if (venda.categoria === 'geral') {
            existing.geral += venda.valor_liquido;
          } else if (venda.categoria === 'goodlife') {
            existing.goodlife += venda.valor_liquido;
          } else if (venda.categoria === 'perfumaria_alta') {
            existing.perfumaria_r_mais += venda.valor_liquido;
          } else if (venda.categoria === 'conveniencia' || venda.categoria === 'brinquedo') {
            existing.conveniencia_r_mais += venda.valor_liquido;
          } else if (venda.categoria === 'rentaveis20' || venda.categoria === 'rentaveis25') {
            existing.r_mais += venda.valor_liquido;
          }
        }
      });

      const finalData = Array.from(chartMap.values());
      setChartData(finalData);
    } catch (error) {
      console.error('Erro ao gerar dados do gráfico:', error);
    }
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

  if (!currentLojaId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Selecione uma loja para visualizar as vendas</p>
        </div>
      </div>
    );
  }

  const getCategoriaColor = (categoria: string) => {
    return `${getClasseBgCategoria(categoria)} ${getClasseCorCategoria(categoria)}`;
  };

  const singleStrokeColor = getCorCategoria(chartCategoriaFilter && chartCategoriaFilter !== 'multi' ? chartCategoriaFilter : 'geral');

  return (
    <div className="page-container space-y-4 sm:space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {lojaInfo 
              ? `Vendas - ${lojaInfo.numero} - ${lojaInfo.nome.toUpperCase()}`
              : `Vendas - Loja ${currentLojaId}`
            }
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Dados da API Externa Callfarma
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

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Participação Geral</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground">
                  {calculatedData.participacaoGeral.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  R$ {calculatedData.totalGeralVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Ticket Médio</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground">
                  R$ {calculatedData.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  API Externa
                </p>
              </div>
              <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Vendas</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground">
                  R$ {calculatedData.valorTotalTodas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {vendasProcessadas.length} transações
                </p>
              </div>
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Melhor Indicador</p>
                {indicadoresRanking.melhor ? (
                  <>
                    <p className="text-base sm:text-lg font-bold text-foreground">
                      {getNomeCategoria(indicadoresRanking.melhor.categoria)}
                    </p>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      {indicadoresRanking.melhor.percentualMeta.toFixed(1)}% da meta
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

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Pior Indicador</p>
                {indicadoresRanking.pior ? (
                  <>
                    <p className="text-base sm:text-lg font-bold text-foreground">
                      {getNomeCategoria(indicadoresRanking.pior.categoria)}
                    </p>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      {indicadoresRanking.pior.percentualMeta.toFixed(1)}% da meta
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

      {/* Indicadores por Categoria */}
      <Card className="mb-4 sm:mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
            Indicadores por Categoria (API Externa)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {Object.entries(vendasPorCategoria)
              .sort(([,a], [,b]) => b.valor - a.valor)
              .slice(0, 6)
              .map(([categoria, dados]) => {
                const participacao = calculatedData.valorTotalTodas > 0 ? (dados.valor / calculatedData.valorTotalTodas * 100) : 0;
                return (
                  <div key={categoria} className="p-3 sm:p-4 border rounded-lg bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={getCategoriaColor(categoria)} variant="secondary">
                        <i className={`${getIconeCategoria(categoria)} mr-1`}></i>
                        <span className="text-xs">{getNomeCategoria(categoria)}</span>
                      </Badge>
                      <span className="text-xs sm:text-sm font-medium">{participacao.toFixed(1)}%</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-base sm:text-lg font-bold">
                        R$ {dados.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="mb-4 sm:mb-6">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>Filtros</span>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              API Externa - Loja {numeroLoja}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar..."
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

            <Select value={funcionarioFilter} onValueChange={setFuncionarioFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Funcionário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Funcionários</SelectItem>
                {funcionarios.map((funcionario) => (
                  <SelectItem key={funcionario.cdfun} value={funcionario.cdfun.toString()}>
                    {funcionario.nome}
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
                <SelectItem value="rentaveis20">Rentáveis 20</SelectItem>
                <SelectItem value="rentaveis25">Rentáveis 25</SelectItem>
                <SelectItem value="perfumaria_alta">Perfumaria Alta</SelectItem>
                <SelectItem value="conveniencia">Conveniência</SelectItem>
                <SelectItem value="brinquedo">Brinquedo</SelectItem>
                <SelectItem value="goodlife">GoodLife</SelectItem>
                <SelectItem value="similar">Similar</SelectItem>
                <SelectItem value="generico">Genérico</SelectItem>
                <SelectItem value="dermocosmetico">Dermocosmético</SelectItem>
              </SelectContent>
            </Select>

            <div className="text-xs sm:text-sm text-muted-foreground flex items-center">
              Total: {filteredVendas.length} vendas
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Vendas */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Vendas (API Externa)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Carregando vendas da API...</span>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Valor Bruto</TableHead>
                      <TableHead>Valor Líquido</TableHead>
                      <TableHead>Quantidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVendas.slice(0, 100).map((venda) => (
                      <TableRow key={venda.id}>
                        <TableCell>
                          {new Date(venda.data_venda).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>{venda.nome_funcionario}</TableCell>
                        <TableCell>
                          <Badge className={getCategoriaColor(venda.categoria)} variant="secondary">
                            <i className={`${getIconeCategoria(venda.categoria)} mr-1`}></i>
                            {getNomeCategoria(venda.categoria)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          R$ {venda.valor_bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          R$ {venda.valor_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>{venda.quantidade}</TableCell>
                      </TableRow>
                    ))}
                    {filteredVendas.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Nenhuma venda encontrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden space-y-3">
                {filteredVendas.slice(0, 50).map((venda) => (
                  <div key={venda.id} className="border rounded-lg p-4 bg-card">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm text-muted-foreground">
                        {new Date(venda.data_venda).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="text-lg font-semibold">
                        R$ {venda.valor_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="text-sm font-medium">{venda.nome_funcionario}</div>
                      <Badge className={getCategoriaColor(venda.categoria)} variant="secondary">
                        <i className={`${getIconeCategoria(venda.categoria)} mr-1`}></i>
                        {getNomeCategoria(venda.categoria)}
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        Qtd: {venda.quantidade}
                      </div>
                    </div>
                  </div>
                ))}
                {filteredVendas.length === 0 && (
                  <div className="text-center text-muted-foreground py-8 border rounded-lg">
                    Nenhuma venda encontrada
                  </div>
                )}
              </div>
              
              {filteredVendas.length > 100 && (
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  Mostrando primeiros 100 resultados de {filteredVendas.length} vendas
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}