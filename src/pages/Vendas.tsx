import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTicketMedioSelfcheckout } from '@/hooks/useTicketMedioSelfcheckout';
import { useCallfarmaAPI, VendaFormatada } from '@/hooks/useCallfarmaAPI'; // Importar hook da API
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

// Usar interface da API
interface Venda extends VendaFormatada {}

interface ChartData {
  date: string;
  value: number;
  transactions: number;
  // Dados por indicador
  geral: number;
  goodlife: number;
  perfumaria_r_mais: number;
  conveniencia_r_mais: number;
  r_mais: number;
}

interface Vendedor {
  id: number;
  nome: string;
  codigo_funcionario?: number; // Código do funcionário na API Callfarma
}

export default function Vendas() {
  // ✅ ALL HOOKS DECLARED FIRST - ALWAYS RUN IN SAME ORDER
  const { user, loading: authLoading } = useAuth();
  const { selectedPeriod } = usePeriodContext();
  const { 
    buscarVendasFormatadas, 
    buscarDadosGraficoAPI, 
    buscarNumeroLoja,
    loading: apiLoading 
  } = useCallfarmaAPI(); // Hook da API Callfarma
  
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [lojaInfo, setLojaInfo] = useState<{ regiao: string; numero: string; nome: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('geral');
  const [vendedorFilter, setVendedorFilter] = useState<string>('all');
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [chartCategoriaFilter, setChartCategoriaFilter] = useState<string>('geral');
  const [filtroAdicional, setFiltroAdicional] = useState<string>('periodo');
  const [selectedLojaId, setSelectedLojaId] = useState<number | null>(null);
  
  // Check if user can view all stores
  const canViewAllStores = user?.tipo && ['admin', 'supervisor', 'compras'].includes(user.tipo);
  const currentLojaId = selectedLojaId || user?.loja_id || null;
  
  // Hook para ticket médio baseado no selfcheckout_dados
  const { dados: ticketMedioData } = useTicketMedioSelfcheckout(currentLojaId, 'completo');

  // ✅ All processing happens after hooks - using useMemo for performance
  const filteredVendas = useMemo(() => {
    return vendas.filter(venda => {
      const matchesSearch = venda.categoria.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategoria = categoriaFilter === 'all' || venda.categoria === categoriaFilter;
      const matchesVendedor = vendedorFilter === 'all' || venda.usuario_id.toString() === vendedorFilter;
      return matchesSearch && matchesCategoria && matchesVendedor;
    });
  }, [vendas, searchTerm, categoriaFilter, vendedorFilter]);

  const calculatedData = useMemo(() => {
    // ✅ REGRA IMPORTANTE: Categorias R+ NÃO SOMAM NO GERAL
    const vendasGeral = vendas.filter(v => v.categoria === 'geral');
    const totalGeralVendas = vendasGeral.reduce((sum, venda) => sum + venda.valor_venda, 0);
    
    // Para participação, usar APENAS vendas gerais (não incluir R+)
    const valorTotalTodas = vendas.reduce((sum, venda) => sum + venda.valor_venda, 0);
    const participacaoGeral = valorTotalTodas > 0 ? (totalGeralVendas / valorTotalTodas * 100) : 0;
    
    const totalVendas = filteredVendas.reduce((sum, venda) => sum + venda.valor_venda, 0);
    // Usar ticket médio do selfcheckout quando disponível, senão usar cálculo tradicional
    const ticketMedio = ticketMedioData?.ticket_medio_geral || 
      (filteredVendas.length > 0 ? totalVendas / filteredVendas.length : 0);

    return {
      totalGeralVendas,
      valorTotalTodas,
      participacaoGeral,
      totalVendas,
      ticketMedio
    };
  }, [vendas, filteredVendas, ticketMedioData]);

  // Vendas por categoria para indicadores (agrupando conforme especificado)
  const vendasPorCategoria = useMemo(() => {
    const grouped = vendas.reduce((acc, venda) => {
      let categoria = venda.categoria;
      
      // Agrupamento para indicadores conforme especificado
      if (venda.categoria === 'similar' || venda.categoria === 'generico') {
        categoria = 'generico_similar'; // Colaboradores têm meta de genérico+similar somados
      } else if (venda.categoria === 'conveniencia' || venda.categoria === 'brinquedo') {
        categoria = 'conveniencia_r_mais'; // ✅ PARA LOJA: conveniencia -> conveniencia_r_mais
      } else if (venda.categoria === 'rentaveis20' || venda.categoria === 'rentaveis25') {
        categoria = 'r_mais'; // Rentáveis
      } else if (venda.categoria === 'saude') {
        categoria = 'goodlife'; // GoodLife
      } else if (venda.categoria === 'perfumaria_r_mais') {
        categoria = 'perfumaria_r_mais'; // Perfumaria Alta Rentabilidade
      }
      
      if (!acc[categoria]) {
        acc[categoria] = { valor: 0, transacoes: 0 };
      }
      acc[categoria].valor += venda.valor_venda;
      acc[categoria].transacoes += 1;
      return acc;
    }, {} as Record<string, { valor: number; transacoes: number }>);
    
    return grouped;
  }, [vendas]);

  // Estado para armazenar metas
  const [metasData, setMetasData] = useState<Record<string, { meta: number; realizado: number }>>({});

  // Buscar metas da loja para calcular porcentagens
  useEffect(() => {
    if (!user || !selectedPeriod || !currentLojaId) return;
    
    const fetchMetas = async () => {
      try {
        // Buscar metas da loja atual para o período selecionado
        const { data: metasLoja } = await supabase
          .from('metas_loja')
          .select('*, metas_loja_categorias(*)')
          .eq('loja_id', currentLojaId)
          .eq('periodo_meta_id', selectedPeriod.id);

        const metasMap: Record<string, { meta: number; realizado: number }> = {};
        
        // Categorias conforme mapeamento
        const categorias = ['r_mais', 'perfumaria_r_mais', 'conveniencia_r_mais', 'goodlife'];
        
        categorias.forEach(categoria => {
          let metaValor = 0;
          
          // Para categoria geral usar meta_valor_total, para outras usar metas_loja_categorias  
          if (categoria === 'geral') {
            metaValor = metasLoja?.[0]?.meta_valor_total || 0;
          } else {
            const metaCategoria = metasLoja?.[0]?.metas_loja_categorias?.find(
              (m: any) => m.categoria === categoria
            );
            metaValor = metaCategoria?.meta_valor || 0;
          }
          
          // Calcular realizado da categoria
          const categoriaDados = vendasPorCategoria[categoria];
          const realizado = categoriaDados?.valor || 0;
          
          metasMap[categoria] = { meta: metaValor, realizado };
        });
        
        setMetasData(metasMap);
      } catch (error) {
        console.error('Erro ao buscar metas para ranking:', error);
      }
    };
    
    fetchMetas();
  }, [user, selectedPeriod, vendasPorCategoria, currentLojaId]);

  // Calcular melhor e pior indicador baseado na % de meta realizada
  const indicadoresRanking = useMemo(() => {
    const indicadores = Object.entries(vendasPorCategoria)
      .filter(([categoria]) => categoria !== 'geral' && categoria !== 'generico_similar') // ✅ Remover generico_similar dos indicadores de loja
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
      .filter(indicador => indicador.meta > 0) // Só incluir categorias com meta definida
      .sort((a, b) => b.percentualMeta - a.percentualMeta);
    
    return {
      melhor: indicadores[0] || null,
      pior: indicadores[indicadores.length - 1] || null
    };
  }, [vendasPorCategoria, metasData]);

  // ✅ useEffect ALWAYS RUNS - no early returns before this
  useEffect(() => {
    if (user && !initialized && currentLojaId) {
      fetchLojaInfo();
      fetchVendedores();
      fetchVendas();
      generateChartData();
      setInitialized(true);
    }
  }, [user, initialized, currentLojaId]);

  // ✅ Refetch when filters change - OTIMIZADO
  useEffect(() => {
    if (user && initialized && currentLojaId && selectedPeriod) {
      // Só recarregar vendedores se mudou o período ou a loja
      fetchVendedores(); 
      fetchVendas();
    }
  }, [selectedPeriod, currentLojaId, selectedLojaId, user, initialized]);

    // Refetch vendas quando vendedor muda (mas não vendedores) ou filtro adicional
  useEffect(() => {
    if (user && initialized && currentLojaId && selectedPeriod) {
      // Apenas refetch vendas se o vendedorFilter ou filtroAdicional mudarem, e não o período/loja
      // Isso evita chamadas duplicadas se o período/loja também mudarem, pois o useEffect acima já cuida disso.
      const hasPeriodOrLojaChanged = prevSelectedPeriodRef.current !== selectedPeriod || prevCurrentLojaIdRef.current !== currentLojaId;
      if (!hasPeriodOrLojaChanged) {
        fetchVendas();
      }
    }
  }, [vendedorFilter, filtroAdicional, user, initialized, currentLojaId, selectedPeriod]);

  // Refs para armazenar valores anteriores de selectedPeriod e currentLojaId
  const prevSelectedPeriodRef = useRef(selectedPeriod);
  const prevCurrentLojaIdRef = useRef(currentLojaId);

  useEffect(() => {
    prevSelectedPeriodRef.current = selectedPeriod;
    prevCurrentLojaIdRef.current = currentLojaId;
  }, [selectedPeriod, currentLojaId]);

  // Quando selecionar um colaborador, mostrar todas as categorias por padrão
  useEffect(() => {
    if (vendedorFilter !== 'all') {
      setCategoriaFilter('all');
      setChartCategoriaFilter('multi');
    }
  }, [vendedorFilter]);

  // Regerar dados do gráfico quando dados/filtros mudarem
  useEffect(() => {
    if (user && lojaInfo && currentLojaId) {
      generateChartData();
    }
  }, [vendas, lojaInfo, user, chartCategoriaFilter, vendedorFilter, currentLojaId]);

  const fetchVendedores = async () => {
    if (!currentLojaId || !selectedPeriod) return;

    try {
      console.log('Buscando funcionários com vendas no período...');
      
      // Calcular datas do período selecionado
      const dataInicioAjustada = new Date(selectedPeriod.startDate);
      dataInicioAjustada.setDate(dataInicioAjustada.getDate() + 1);
      const dataInicio = format(dataInicioAjustada, 'yyyy-MM-dd');
      const dataFim = format(selectedPeriod.endDate, 'yyyy-MM-dd');

      // Buscar vendas da API para obter funcionários com vendas no período
      const vendasPeriodo = await buscarVendasFormatadas(dataInicio, dataFim, currentLojaId);
      
      // Extrair IDs únicos dos funcionários que tiveram vendas
      const funcionariosComVendas = [...new Set(vendasPeriodo.map(v => v.usuario_id))];
      
      console.log(`Funcionários com vendas no período: ${funcionariosComVendas.length}`);

      if (funcionariosComVendas.length === 0) {
        setVendedores([]);
        return;
      }

      // Criar lista de vendedores diretamente com base nos dados da API
      const funcionariosUnicos = vendasPeriodo.reduce((acc, venda) => {
        if (venda.usuario_id && !acc.some(f => f.id === venda.usuario_id)) {
          acc.push({
            id: venda.usuario_id,
            nome: venda.nome_funcionario || `Funcionário ${venda.usuario_id}`,
            codigo_funcionario: venda.usuario_id.toString()
          });
        }
        return acc;
      }, [] as Vendedor[]);
      
      // Ordenar por nome
      funcionariosUnicos.sort((a, b) => a.nome.localeCompare(b.nome));
      
      setVendedores(funcionariosUnicos);
    } catch (error) {
      console.error('Erro ao buscar vendedores:', error);
      setVendedores([]);
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

  const fetchVendas = async () => {
    if (!currentLojaId || !selectedPeriod) return;

    try {
      setLoading(true);
      console.log('🔍 Buscando vendas da API Callfarma...');
      
      // Calcular datas baseado no filtro adicional
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
      } else if (filtroAdicional === 'periodo' && selectedPeriod) {
        // Iniciar no dia seguinte à data de início (dia 21 ao invés de 20)
        const dataInicioAjustada = new Date(selectedPeriod.startDate);
        dataInicioAjustada.setDate(dataInicioAjustada.getDate() + 1);
        
        dataInicio = format(dataInicioAjustada, 'yyyy-MM-dd');
        dataFim = format(selectedPeriod.endDate, 'yyyy-MM-dd');
      } else {
        // Padrão: período selecionado
        const dataInicioAjustada = new Date(selectedPeriod.startDate);
        dataInicioAjustada.setDate(dataInicioAjustada.getDate() + 1);
        
        dataInicio = format(dataInicioAjustada, 'yyyy-MM-dd');
        dataFim = format(selectedPeriod.endDate, 'yyyy-MM-dd');
      }

      console.log(`📅 Período: ${dataInicio} até ${dataFim}`);
      console.log(`🏪 Loja ID: ${currentLojaId}`);
      console.log(`👤 Vendedor filtro: ${vendedorFilter}`);

      // Buscar vendas da API Callfarma
      const funcionarioId = vendedorFilter !== 'all' ? parseInt(vendedorFilter) : undefined;
      const vendasAPI = await buscarVendasFormatadas(
        dataInicio,
        dataFim,
        currentLojaId,
        funcionarioId
      );

      console.log(`✅ Vendas recebidas da API: ${vendasAPI.length} registros`);
      setVendas(vendasAPI);

    } catch (error) {
      console.error('❌ Erro ao buscar vendas:', error);
      toast.error('Erro ao carregar vendas da API');
    } finally {
      setLoading(false);
    }
  };

  const generateChartData = async () => {
    if (!currentLojaId || !selectedPeriod) return;

    try {
      console.log('📈 Gerando dados do gráfico apenas para o período selecionado...');
      
      // USAR APENAS O PERÍODO SELECIONADO - NÃO 3 MESES ATRÁS!
      const dataInicioGrafico = format(new Date(selectedPeriod.startDate), 'yyyy-MM-dd');
      const dataFimGrafico = format(selectedPeriod.endDate, 'yyyy-MM-dd');

      const dadosAPI = await buscarDadosGraficoAPI(
        dataInicioGrafico,
        dataFimGrafico,
        currentLojaId,
        vendedorFilter !== 'all' ? parseInt(vendedorFilter) : undefined
      );

      // Processar dados para o gráfico
      const processedChartData: ChartData[] = [];
      const datesInPeriod = eachDayOfInterval({
        start: new Date(selectedPeriod.startDate),
        end: new Date(selectedPeriod.endDate),
      });

      datesInPeriod.forEach(date => {
        const formattedDate = format(date, 'yyyy-MM-dd');
        const dailyData = dadosAPI.filter(d => format(new Date(d.data), 'yyyy-MM-dd') === formattedDate);

        const chartEntry: ChartData = {
          date: format(date, 'dd/MM'),
          value: 0,
          transactions: 0,
          geral: 0,
          goodlife: 0,
          perfumaria_r_mais: 0,
          conveniencia_r_mais: 0,
          r_mais: 0,
        };

        dailyData.forEach(d => {
          chartEntry.value += d.valor_venda;
          chartEntry.transactions += d.transacoes;
          chartEntry.geral += d.geral;
          chartEntry.goodlife += d.goodlife;
          chartEntry.perfumaria_r_mais += d.perfumaria_r_mais;
          chartEntry.conveniencia_r_mais += d.conveniencia_r_mais;
          chartEntry.r_mais += d.r_mais;
        });
        processedChartData.push(chartEntry);
      });

      setChartData(processedChartData);
    } catch (error) {
      console.error('Erro ao gerar dados do gráfico:', error);
      setChartData([]);
    }
  };

    } catch (error) {
      console.error('❌ Erro ao gerar dados do gráfico:', error);
    }
  };

  // ✅ NOW we can do early returns AFTER all hooks
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
          <p className="text-muted-foreground">Loja não identificada. Contate o administrador.</p>
        </div>
      </div>
    );
  }

  const getCategoriaColor = (categoria: string) => {
    // Usar cores do design system baseadas na categoria
    return `${getClasseBgCategoria(categoria)} ${getClasseCorCategoria(categoria)}`;
  };

  // Cor da linha do gráfico single-line baseada na categoria selecionada
  const singleStrokeColor = getCorCategoria(chartCategoriaFilter && chartCategoriaFilter !== 'multi' ? chartCategoriaFilter : 'geral');

  return (
    <div className="page-container space-y-4 sm:space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {canViewAllStores && !selectedLojaId 
              ? 'Vendas - Todas as Lojas' 
              : lojaInfo 
                ? `Vendas - ${lojaInfo.numero} - ${lojaInfo.nome.toUpperCase()}`
                : `Vendas - Loja ${currentLojaId}`
            }
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Acompanhe as vendas e performance da loja
            {selectedPeriod && (
              <span className="block text-xs text-muted-foreground/70 mt-1">
                Período: {selectedPeriod.label}
              </span>
            )}
          </p>
          {(loading || apiLoading) && (
            <p className="text-xs text-blue-500 mt-1">
              🔄 Carregando dados da API Callfarma...
            </p>
          )}
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
                  {ticketMedioData ? 
                    `Vendas Geral: R$ ${ticketMedioData.total_vendas_geral_periodo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` :
                    'Baseado no período selecionado'
                  }
                </p>
              </div>
              <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        {ticketMedioData && (
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Clientes Atendidos</p>
                  <p className="text-lg sm:text-2xl font-bold text-foreground">
                    {ticketMedioData.total_clientes_periodo.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    Total no período
                  </p>
                </div>
                <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        )}

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
            Indicadores por Categoria
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
            <span className="hidden sm:inline">Gráficos</span>
            <span className="sm:hidden">Gráfico</span>
          </TabsTrigger>
          <TabsTrigger value="table" className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Tabela</span>
            <span className="sm:hidden">Lista</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="charts" className="space-y-4">
          {/* Filtro do Gráfico */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <LineChart className="w-4 h-4 sm:w-5 sm:h-5" />
                Filtro do Gráfico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={chartCategoriaFilter} onValueChange={setChartCategoriaFilter}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Categoria do Gráfico" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover border border-border shadow-md">
                  <SelectItem value="geral">Venda Geral</SelectItem>
                  <SelectItem value="goodlife">GoodLife</SelectItem>
                  <SelectItem value="perfumaria_r_mais">Perfumaria Alta Rentabilidade</SelectItem>
                  <SelectItem value="conveniencia_r_mais">Conveniência Alta Rentabilidade</SelectItem>
                  <SelectItem value="r_mais">Rentáveis</SelectItem>
                  <SelectItem value="multi">Gráfico Multi Linha - Indicadores</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {chartCategoriaFilter === 'multi' ? 'Gráfico Multi Linha - Indicadores' : `Evolução de Vendas - ${getNomeCategoria(chartCategoriaFilter)}`}
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
                        formatter={(value: number, name: string) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, getNomeCategoria(name)]}
                        labelFormatter={(label) => `Data: ${label}`}
                      />
                      <Legend formatter={(value) => getNomeCategoria(value)} />
                       {/* Remover linha geral do gráfico multi-linha conforme solicitado */}
                      <Line 
                        type="monotone" 
                        dataKey="goodlife" 
                        stroke="hsl(142, 76%, 36%)" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ r: 3 }}
                        isAnimationActive={false}
                        name="goodlife"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="perfumaria_r_mais" 
                        stroke="hsl(262, 83%, 58%)" 
                        strokeWidth={2}
                        strokeDasharray="10 5"
                        dot={{ r: 3 }}
                        isAnimationActive={false}
                        name="perfumaria_r_mais"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="conveniencia_r_mais" 
                        stroke="hsl(32, 95%, 44%)" 
                        strokeWidth={2}
                        strokeDasharray="15 5"
                        dot={{ r: 3 }}
                        isAnimationActive={false}
                        name="conveniencia_r_mais"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="r_mais" 
                        stroke="hsl(0, 84%, 60%)" 
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
                        formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Vendas']}
                        labelFormatter={(label) => `Data: ${label}`}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
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
              <CardTitle>Lista de Vendas</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-2">Carregando vendas da API...</span>
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
                              {venda.nome_funcionario || vendedores.find(v => v.id === venda.usuario_id)?.nome || `ID: ${venda.usuario_id}`}
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredVendas.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              {loading ? 'Carregando vendas...' : 'Nenhuma venda encontrada'}
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
                            Vendedor: {venda.nome_funcionario || vendedores.find(v => v.id === venda.usuario_id)?.nome || `ID: ${venda.usuario_id}`}
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredVendas.length === 0 && (
                      <div className="text-center text-muted-foreground py-8 border rounded-lg">
                        {loading ? 'Carregando vendas da API...' : 'Nenhuma venda encontrada'}
                      </div>
                    )}
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