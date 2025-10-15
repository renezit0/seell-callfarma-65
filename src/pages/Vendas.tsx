import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCallfarmaAPI } from '@/hooks/useCallfarmaAPI';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Calendar, DollarSign, TrendingUp, BarChart3, LineChart, Trophy, TrendingDown, Users } from 'lucide-react';
import { getNomeCategoria, getIconeCategoria, getClasseCorCategoria, getClasseBgCategoria, getCorCategoria } from '@/utils/categories';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format, startOfMonth, subMonths, eachDayOfInterval, getDay } from 'date-fns';
import { StoreSelector } from '@/components/StoreSelector';
import { usePeriodoAtual } from '@/hooks/usePeriodoAtual';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
interface VendaProcessada {
  id: string;
  cdfun: number;
  nomefun: string;
  cdfil: number;
  data_venda: string;
  categoria: string;
  valor_venda: number;
  valor_devolucao: number;
  valor_liquido: number;
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
  id: number;
  nome: string;
}
interface DadosVendasFilial {
  valor: number;
  totCli: number;
  ticketMedio: number;
  crescimento: string;
}
export default function Vendas() {
  // ✅ ALL HOOKS DECLARED FIRST
  const {
    user,
    loading: authLoading
  } = useAuth();
  const periodoAtual = usePeriodoAtual();
  const callfarmaAPI = useCallfarmaAPI();

  // Estados principais
  const [vendasProcessadas, setVendasProcessadas] = useState<VendaProcessada[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [dadosFilial, setDadosFilial] = useState<DadosVendasFilial>({
    valor: 0,
    totCli: 0,
    ticketMedio: 0,
    crescimento: '0'
  });
  const [lojaInfo, setLojaInfo] = useState<{
    regiao: string;
    numero: string;
    nome: string;
    cdfil: number;
  } | null>(null);

  // Estados de filtros
  const [dataInicio, setDataInicio] = useState(periodoAtual.data_inicio);
  const [dataFim, setDataFim] = useState(periodoAtual.data_fim);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('all');
  const [vendedorFilter, setVendedorFilter] = useState<string>('all');
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [chartCategoriaFilter, setChartCategoriaFilter] = useState<string>('geral');
  const [selectedLojaId, setSelectedLojaId] = useState<number | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Check if user can view all stores
  const canViewAllStores = user?.tipo && ['admin', 'supervisor', 'compras'].includes(user.tipo);
  const currentLojaId = selectedLojaId || user?.loja_id || null;


  // Mapeamento de grupos para categorias
  const mapearGrupoParaCategoria = (cdgrupo: number): string => {
    switch (cdgrupo) {
      case 20:
      case 25:
        return 'r_mais';
      case 36:
      case 13:
        return 'conveniencia_r_mais';
      case 46:
        return 'perfumaria_r_mais';
      case 22:
        return 'goodlife';
      default:
        return 'outros';
    }
  };

  // ✅ Processar dados das vendas
  const filteredVendas = useMemo(() => {
    return vendasProcessadas.filter(venda => {
      const matchesSearch = venda.categoria.toLowerCase().includes(searchTerm.toLowerCase()) || venda.nomefun.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategoria = categoriaFilter === 'all' || venda.categoria === categoriaFilter;
      const matchesVendedor = vendedorFilter === 'all' || venda.cdfun.toString() === vendedorFilter;
      return matchesSearch && matchesCategoria && matchesVendedor;
    });
  }, [vendasProcessadas, searchTerm, categoriaFilter, vendedorFilter]);
  const calculatedData = useMemo(() => {
    // Vendas gerais vêm da API vendas-por-filial
    const totalGeralVendas = dadosFilial.valor;
    const ticketMedio = dadosFilial.ticketMedio;
    const totalClientes = dadosFilial.totCli;

    // Calcular total de todas as categorias para participação
    const totalVendasIndicadores = vendasProcessadas.reduce((sum, venda) => {
      return sum + venda.valor_liquido;
    }, 0);
    const valorTotalTodas = totalGeralVendas + totalVendasIndicadores;
    const participacaoGeral = valorTotalTodas > 0 ? totalGeralVendas / valorTotalTodas * 100 : 0;
    const totalVendasFiltradas = filteredVendas.reduce((sum, venda) => sum + venda.valor_liquido, 0);
    return {
      totalGeralVendas,
      valorTotalTodas,
      participacaoGeral,
      totalVendas: totalVendasFiltradas,
      ticketMedio,
      totalClientes
    };
  }, [dadosFilial, vendasProcessadas, filteredVendas]);

  // Vendas por categoria para indicadores
  const vendasPorCategoria = useMemo(() => {
    const grouped = vendasProcessadas.reduce((acc, venda) => {
      const categoria = venda.categoria;
      if (!acc[categoria]) {
        acc[categoria] = {
          valor: 0,
          transacoes: 0
        };
      }
      acc[categoria].valor += venda.valor_liquido;
      acc[categoria].transacoes += 1;
      return acc;
    }, {} as Record<string, {
      valor: number;
      transacoes: number;
    }>);

    // Adicionar categoria geral dos dados da filial
    grouped['geral'] = {
      valor: dadosFilial.valor,
      transacoes: dadosFilial.totCli
    };
    return grouped;
  }, [vendasProcessadas, dadosFilial]);

  // Estados para metas
  const [metasData, setMetasData] = useState<Record<string, {
    meta: number;
    realizado: number;
  }>>({});

  // Buscar metas da loja - desabilitado pois não usa mais período predefinido
  useEffect(() => {
    if (!user || !currentLojaId || isLoadingData) return;
    const fetchMetas = async () => {
      try {
        // Buscar o período ativo atual
        const { data: periodoAtivo } = await supabase
          .from('periodos_meta')
          .select('id')
          .eq('status', 'ativo')
          .gte('data_fim', new Date().toISOString().split('T')[0])
          .lte('data_inicio', new Date().toISOString().split('T')[0])
          .single();
        
        if (!periodoAtivo) return;
        
        const {
          data: metasLoja
        } = await supabase.from('metas_loja').select('*, metas_loja_categorias(*)').eq('loja_id', currentLojaId).eq('periodo_meta_id', periodoAtivo.id);
        const metasMap: Record<string, {
          meta: number;
          realizado: number;
        }> = {};
        const categorias = ['geral', 'r_mais', 'perfumaria_r_mais', 'conveniencia_r_mais', 'goodlife'];
        categorias.forEach(categoria => {
          let metaValor = 0;
          if (categoria === 'geral') {
            metaValor = metasLoja?.[0]?.meta_valor_total || 0;
          } else {
            const metaCategoria = metasLoja?.[0]?.metas_loja_categorias?.find((m: any) => m.categoria === categoria);
            metaValor = metaCategoria?.meta_valor || 0;
          }
          const categoriaDados = vendasPorCategoria[categoria];
          const realizado = categoriaDados?.valor || 0;
          metasMap[categoria] = {
            meta: metaValor,
            realizado
          };
        });
        setMetasData(metasMap);
      } catch (error) {
        console.error('Erro ao buscar metas para ranking:', error);
      }
    };
    fetchMetas();
  }, [user, vendasPorCategoria, currentLojaId]);

  // Calcular melhor e pior indicador
  const indicadoresRanking = useMemo(() => {
    const indicadores = Object.entries(vendasPorCategoria).filter(([categoria]) => categoria !== 'geral').map(([categoria, dados]) => {
      const metaInfo = metasData[categoria];
      const percentualMeta = metaInfo?.meta > 0 ? dados.valor / metaInfo.meta * 100 : 0;
      return {
        categoria,
        valor: dados.valor,
        transacoes: dados.transacoes,
        meta: metaInfo?.meta || 0,
        percentualMeta
      };
    }).filter(indicador => indicador.meta > 0).sort((a, b) => b.percentualMeta - a.percentualMeta);
    return {
      melhor: indicadores[0] || null,
      pior: indicadores[indicadores.length - 1] || null
    };
  }, [vendasPorCategoria, metasData]);

  // ✅ useEffect ÚNICO e SIMPLES - carrega tudo em sequência
  useEffect(() => {
    if (!user) return;
    
    let isMounted = true;
    
    const loadData = async () => {
      if (!isMounted) return;
      setIsLoadingData(true);
      
      try {
        // Etapa 1: Buscar info da loja e receber os dados
        const infoLoja = await fetchLojaInfo();
        
        // Etapa 2: Buscar vendas passando os dados da loja diretamente
        if (infoLoja && isMounted) {
          await fetchVendas(infoLoja);
        }
      } catch (error) {
        console.error('Erro:', error);
      } finally {
        if (isMounted) setIsLoadingData(false);
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [user, currentLojaId, selectedLojaId]);

  // Quando selecionar um colaborador
  useEffect(() => {
    if (vendedorFilter !== 'all') {
      setCategoriaFilter('all');
      setChartCategoriaFilter('multi');
    }
  }, [vendedorFilter]);

  // Gerar dados do gráfico
  useEffect(() => {
    if (user && lojaInfo && !isLoadingData) {
      generateChartData();
    }
  }, [vendasProcessadas, lojaInfo, user, chartCategoriaFilter, vendedorFilter]);
  const fetchLojaInfo = async () => {
    if (!currentLojaId) return null;
    try {
      // Buscar apenas os campos que existem na tabela lojas
      const {
        data: lojaData,
        error: lojaError
      } = await supabase.from('lojas').select('regiao, numero, nome, id').eq('id', currentLojaId).single();
      if (lojaError) throw lojaError;

      // Usar o campo 'numero' da loja como CDFIL para a API
      // Se não tiver numero, usar o ID
      let cdfil = null;
      if (lojaData.numero) {
        // Se numero é string, converter para int. Se já é número, manter
        cdfil = typeof lojaData.numero === 'string' ? parseInt(lojaData.numero) : lojaData.numero;
      } else {
        // Usar o próprio ID como CDFIL
        cdfil = lojaData.id;
      }
      const infoLoja = {
        regiao: lojaData.regiao || 'centro',
        numero: lojaData.numero || currentLojaId.toString(),
        nome: lojaData.nome || `Loja ${currentLojaId}`,
        cdfil
      };
      setLojaInfo(infoLoja);
      console.log('Loja carregada:', infoLoja);
      return infoLoja; // Retornar os dados para usar diretamente
    } catch (error) {
      console.error('Erro ao buscar informações da loja:', error);
      return null;
    }
  };
  const fetchVendas = async (lojaInfoParam?: typeof lojaInfo) => {
    const lojaAtual = lojaInfoParam || lojaInfo;
    if (!lojaAtual) return;
    try {
      // Validar se as datas estão preenchidas
      if (!dataInicio || !dataFim) {
        toast.error('Selecione o período de início e fim');
        return;
      }
      console.log(`Buscando dados API: ${dataInicio} a ${dataFim} para loja CDFIL ${lojaAtual.cdfil}`);
      if (vendedorFilter !== 'all') {
        // Buscar dados específicos do funcionário
        const dadosFuncionario = await callfarmaAPI.buscarVendasFuncionariosDetalhadas(dataInicio, dataFim, lojaAtual.cdfil, parseInt(vendedorFilter));
        const vendasProcessadasFunc = processarDadosFuncionarios(dadosFuncionario);
        setVendasProcessadas(vendasProcessadasFunc);

        // Para funcionário específico, não temos dados gerais da filial
        setDadosFilial({
          valor: 0,
          totCli: 0,
          ticketMedio: 0,
          crescimento: '0'
        });
      } else {
        // Buscar dados completos
        // CORREÇÃO: Só buscar 'all' se for admin E não tiver loja selecionada E não tiver selectedLojaId
        let cdfil;
        if (canViewAllStores && !selectedLojaId) {
          // Admin sem loja específica selecionada - buscar todas as lojas
          cdfil = 'all';
        } else {
          // Usuário normal OU admin com loja selecionada - sempre usar CDFIL específico
          cdfil = lojaAtual.cdfil;
        }
        console.log('CDFIL determinado para busca:', cdfil, {
          canViewAllStores,
          selectedLojaId,
          userLojaId: user?.loja_id,
          currentLojaId
        });
        const {
          vendasFilial,
          vendasFuncionarios,
          funcionarios: funcAPI
        } = await callfarmaAPI.buscarDadosVendasCompletos(dataInicio, dataFim, cdfil);
        console.log('Dados recebidos:', {
          vendasFilial: vendasFilial.length,
          vendasFuncionarios: vendasFuncionarios.length,
          funcionarios: funcAPI.length
        });

        // DEBUG: Verificar se dados vieram filtrados corretamente
        if (vendasFuncionarios.length > 0) {
          const filiaisNosResultados = [...new Set(vendasFuncionarios.map(v => v.CDFIL))];
          console.log('🔍 FILIAIS NOS RESULTADOS:', filiaisNosResultados);
          console.log('🎯 DEVERIA SER APENAS:', cdfil === 'all' ? 'TODAS' : [cdfil]);
          if (cdfil !== 'all' && filiaisNosResultados.length > 1) {
            console.error('❌ PROBLEMA: Recebeu dados de múltiplas filiais quando deveria ser apenas uma!');
            console.error('❌ Filiais recebidas:', filiaisNosResultados);
            console.error('❌ CDFIL esperado:', cdfil);
          } else if (cdfil !== 'all' && !filiaisNosResultados.includes(cdfil)) {
            console.error('❌ PROBLEMA: Não recebeu dados da filial correta!');
            console.error('❌ Filiais recebidas:', filiaisNosResultados);
            console.error('❌ CDFIL esperado:', cdfil);
          } else {
            console.log('✅ Filtro por filial funcionando corretamente!');
          }
        }

        // Processar dados da filial
        if (vendasFilial.length > 0) {
          const dadosFilialAgregados = vendasFilial.reduce((acc, item) => ({
            valor: acc.valor + item.valor,
            totCli: acc.totCli + item.totCli,
            ticketMedio: acc.totCli > 0 ? (acc.valor + item.valor) / (acc.totCli + item.totCli) : item.ticketMedio,
            crescimento: item.crescimento
          }), {
            valor: 0,
            totCli: 0,
            ticketMedio: 0,
            crescimento: '0'
          });
          console.log('Dados filial processados:', dadosFilialAgregados);
          setDadosFilial(dadosFilialAgregados);
        } else {
          console.log('Nenhum dado de filial encontrado');
          setDadosFilial({
            valor: 0,
            totCli: 0,
            ticketMedio: 0,
            crescimento: '0'
          });
        }

        // Processar dados dos funcionários
        const vendasProc = processarDadosFuncionarios(vendasFuncionarios);
        console.log('Vendas processadas:', vendasProc.length);
        setVendasProcessadas(vendasProc);

        // Atualizar lista de funcionários
        console.log('Funcionários encontrados:', funcAPI.length);
        setFuncionarios(funcAPI);
      }
    } catch (error) {
      console.error('Erro ao buscar vendas da API:', error);
      toast.error('Erro ao carregar dados de vendas da API');
    }
  };
  const processarDadosFuncionarios = (dados: any[]): VendaProcessada[] => {
    console.log('Processando dados dos funcionários:', dados.length, 'registros');
    const processados = dados.map((item, index) => {
      const categoria = mapearGrupoParaCategoria(item.CDGRUPO);
      const valorLiquido = (item.TOTAL_VLR_VE || 0) - (item.TOTAL_VLR_DV || 0);
      return {
        id: `${item.CDFIL}-${item.CDFUN}-${item.CDGRUPO}-${item.DATA}-${index}`,
        cdfun: item.CDFUN,
        nomefun: item.NOMEFUN,
        cdfil: item.CDFIL,
        data_venda: item.DATA.split('T')[0],
        categoria,
        valor_venda: item.TOTAL_VLR_VE || 0,
        valor_devolucao: item.TOTAL_VLR_DV || 0,
        valor_liquido: valorLiquido
      };
    }).filter(item => item.valor_liquido > 0);
    console.log('Dados processados:', processados.length, 'vendas válidas');
    return processados;
  };
  const generateChartData = async () => {
    try {
      if (!lojaInfo) return;
      const hoje = new Date();
      const inicioMes = startOfMonth(subMonths(hoje, 2));

      // Para gráficos usamos sempre os últimos 3 meses
      const dataInicio = format(inicioMes, 'yyyy-MM-dd');
      const dataFim = format(hoje, 'yyyy-MM-dd');
      const cdfil = canViewAllStores && !selectedLojaId ? 'all' : lojaInfo.cdfil;
      let dadosChart: any[] = [];
      let dadosVendasFilial: any[] = [];

      if (vendedorFilter !== 'all') {
        // Dados específicos do funcionário
        dadosChart = await callfarmaAPI.buscarVendasFuncionariosDetalhadas(dataInicio, dataFim, lojaInfo.cdfil, parseInt(vendedorFilter));
      } else {
        // Dados gerais - buscar tanto funcionários quanto vendas da filial
        const {
          vendasFilial,
          vendasFuncionarios
        } = await callfarmaAPI.buscarDadosVendasCompletos(dataInicio, dataFim, cdfil);
        dadosChart = vendasFuncionarios;
        dadosVendasFilial = vendasFilial;
      }
      console.log('Dados para gráfico:', dadosChart.length, 'registros funcionários,', dadosVendasFilial.length, 'registros filial');

      // Agrupar por data
      const chartMap = new Map<string, ChartData>();
      const allDays = eachDayOfInterval({
        start: inicioMes,
        end: hoje
      });
      const shouldExcludeSundays = lojaInfo?.regiao === 'centro' && (selectedLojaId || !canViewAllStores);
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

      // Processar dados de vendas gerais da filial
      dadosVendasFilial.forEach(item => {
        const dataKey = item.DATA ? item.DATA.split('T')[0] : null;
        const existing = dataKey ? chartMap.get(dataKey) : null;
        if (existing) {
          const valorVenda = item.valor || 0;
          existing.geral += valorVenda;
          existing.value = valorVenda; // value representa o total geral
        }
      });

      // Processar dados de indicadores (funcionários)
      dadosChart.forEach(item => {
        const dataKey = item.DATA.split('T')[0];
        const existing = chartMap.get(dataKey);
        if (existing) {
          const valorLiquido = (item.TOTAL_VLR_VE || 0) - (item.TOTAL_VLR_DV || 0);
          const categoria = mapearGrupoParaCategoria(item.CDGRUPO);
          existing.transactions += 1;
          if (categoria === 'goodlife') {
            existing.goodlife += valorLiquido;
          } else if (categoria === 'perfumaria_r_mais') {
            existing.perfumaria_r_mais += valorLiquido;
          } else if (categoria === 'conveniencia_r_mais') {
            existing.conveniencia_r_mais += valorLiquido;
          } else if (categoria === 'r_mais') {
            existing.r_mais += valorLiquido;
          }
        }
      });
      const finalData = Array.from(chartMap.values());
      console.log('Dados finais do gráfico:', finalData.length, 'pontos');
      setChartData(finalData);
    } catch (error) {
      console.error('Erro ao gerar dados do gráfico:', error);
    }
  };

  // ✅ Early returns após hooks
  if (authLoading || callfarmaAPI.loading || isLoadingData) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {authLoading ? 'Verificando autenticação...' : 'Carregando dados...'}
          </p>
        </div>
      </div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  const getCategoriaColor = (categoria: string) => {
    return `${getClasseBgCategoria(categoria)} ${getClasseCorCategoria(categoria)}`;
  };
  const singleStrokeColor = getCorCategoria(chartCategoriaFilter && chartCategoriaFilter !== 'multi' ? chartCategoriaFilter : 'geral');
  return <div className="page-container space-y-4 sm:space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {canViewAllStores && !selectedLojaId ? 'Vendas - Todas as Lojas' : lojaInfo ? `Vendas - ${lojaInfo.numero} - ${lojaInfo.nome.toUpperCase()}` : `Vendas - Loja ${currentLojaId || user.loja_id}`}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Dados em tempo real da API Callfarma
          </p>
        </div>
        <div className="flex gap-2">
          {canViewAllStores && <StoreSelector selectedLojaId={selectedLojaId} onLojaChange={setSelectedLojaId} userLojaId={user.loja_id} />}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Vendas Gerais</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground">
                  R$ {calculatedData.totalGeralVendas.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2
                })}
                </p>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {calculatedData.participacaoGeral.toFixed(1)}% do total
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
                  R$ {calculatedData.ticketMedio.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2
                })}
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
                <p className="text-xs sm:text-sm text-muted-foreground">Clientes Atendidos</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground">
                  {calculatedData.totalClientes.toLocaleString('pt-BR')}
                </p>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Total no período
                </p>
              </div>
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Melhor Indicador</p>
                {indicadoresRanking.melhor ? <>
                    <p className="text-base sm:text-lg font-bold text-foreground">
                      {getNomeCategoria(indicadoresRanking.melhor.categoria)}
                    </p>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      {indicadoresRanking.melhor.percentualMeta.toFixed(1)}% da meta
                    </p>
                  </> : <p className="text-lg sm:text-2xl font-bold text-muted-foreground">-</p>}
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
                {indicadoresRanking.pior ? <>
                    <p className="text-base sm:text-lg font-bold text-foreground">
                      {getNomeCategoria(indicadoresRanking.pior.categoria)}
                    </p>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      {indicadoresRanking.pior.percentualMeta.toFixed(1)}% da meta
                    </p>
                  </> : <p className="text-lg sm:text-2xl font-bold text-muted-foreground">-</p>}
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
            {Object.entries(vendasPorCategoria).sort(([, a], [, b]) => b.valor - a.valor).slice(0, 6).map(([categoria, dados]) => {
            const participacao = calculatedData.valorTotalTodas > 0 ? dados.valor / calculatedData.valorTotalTodas * 100 : 0;
            return <div key={categoria} className="p-3 sm:p-4 border rounded-lg bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={getCategoriaColor(categoria)} variant="secondary">
                        <i className={`${getIconeCategoria(categoria)} mr-1`}></i>
                        <span className="text-xs">{getNomeCategoria(categoria)}</span>
                      </Badge>
                      <span className="text-xs sm:text-sm font-medium">
                        {participacao.toFixed(1)}%
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-base sm:text-lg font-bold">
                        R$ {dados.valor.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2
                  })}
                      </p>
                    </div>
                  </div>;
          })}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="mb-4 sm:mb-6">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>Filtros e Período</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Período */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <Label htmlFor="dataInicio">Data Início</Label>
              <Input
                id="dataInicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dataFim">Data Fim</Label>
              <Input
                id="dataFim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={() => {
                  setIsLoadingData(true);
                  fetchVendas().finally(() => setIsLoadingData(false));
                }}
                disabled={isLoadingData}
                className="w-full"
              >
                <Search className="w-4 h-4 mr-2" />
                Buscar Vendas
              </Button>
            </div>
          </div>
          
          {/* Outros Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
            </div>

            <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Funcionário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Funcionários</SelectItem>
                {funcionarios.map(funcionario => <SelectItem key={funcionario.id} value={funcionario.id.toString()}>
                    {funcionario.nome}
                  </SelectItem>)}
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
                <SelectItem value="goodlife">GoodLife</SelectItem>
              </SelectContent>
            </Select>
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
                  <SelectItem value="perfumaria_r_mais">Perfumaria R+</SelectItem>
                  <SelectItem value="conveniencia_r_mais">Conveniência R+</SelectItem>
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
                  {chartCategoriaFilter === 'multi' ? <RechartsLineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} tick={{
                    fontSize: 10
                  }} />
                      <YAxis fontSize={12} tick={{
                    fontSize: 10
                  }} tickFormatter={value => `R$ ${value.toLocaleString('pt-BR')}`} />
                      <Tooltip formatter={(value: number, name: string) => [`R$ ${value.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2
                  })}`, getNomeCategoria(name)]} labelFormatter={label => `Data: ${label}`} />
                      <Legend formatter={value => getNomeCategoria(value)} />
                      <Line type="monotone" dataKey="goodlife" stroke="hsl(142, 76%, 36%)" strokeWidth={2} strokeDasharray="5 5" dot={{
                    r: 3
                  }} isAnimationActive={false} name="goodlife" />
                      <Line type="monotone" dataKey="perfumaria_r_mais" stroke="hsl(262, 83%, 58%)" strokeWidth={2} strokeDasharray="10 5" dot={{
                    r: 3
                  }} isAnimationActive={false} name="perfumaria_r_mais" />
                      <Line type="monotone" dataKey="conveniencia_r_mais" stroke="hsl(32, 95%, 44%)" strokeWidth={2} strokeDasharray="15 5" dot={{
                    r: 3
                  }} isAnimationActive={false} name="conveniencia_r_mais" />
                      <Line type="monotone" dataKey="r_mais" stroke="hsl(0, 84%, 60%)" strokeWidth={2} strokeDasharray="3 3" dot={{
                    r: 3
                  }} isAnimationActive={false} name="r_mais" />
                    </RechartsLineChart> : <RechartsLineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} tick={{
                    fontSize: 10
                  }} />
                      <YAxis fontSize={12} tick={{
                    fontSize: 10
                  }} tickFormatter={value => `R$ ${value.toLocaleString('pt-BR')}`} />
                      <Tooltip formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2
                  })}`, 'Vendas']} labelFormatter={label => `Data: ${label}`} />
                      <Legend />
                      <Line type="monotone" dataKey="value" stroke={singleStrokeColor} strokeWidth={3} dot={{
                    r: 4
                  }} isAnimationActive={false} name="Vendas" />
                    </RechartsLineChart>}
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="table">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Vendas ({filteredVendas.length} registros)</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Valor Venda</TableHead>
                      <TableHead>Valor Líquido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVendas.map(venda => <TableRow key={venda.id}>
                        <TableCell>
                          {new Date(venda.data_venda).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>{venda.nomefun}</TableCell>
                        <TableCell>
                          <Badge className={getCategoriaColor(venda.categoria)} variant="secondary">
                            <i className={`${getIconeCategoria(venda.categoria)} mr-1`}></i>
                            {getNomeCategoria(venda.categoria)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          R$ {venda.valor_venda.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2
                      })}
                        </TableCell>
                        <TableCell>
                          R$ {venda.valor_liquido.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2
                      })}
                        </TableCell>
                      </TableRow>)}
                    {filteredVendas.length === 0 && <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          {callfarmaAPI.loading ? 'Carregando dados...' : 'Nenhuma venda encontrada'}
                        </TableCell>
                      </TableRow>}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {filteredVendas.map(venda => <div key={venda.id} className="border rounded-lg p-4 bg-card">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm text-muted-foreground">
                        {new Date(venda.data_venda).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="text-lg font-semibold">
                        R$ {venda.valor_liquido.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2
                    })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Badge className={getCategoriaColor(venda.categoria)} variant="secondary">
                        <i className={`${getIconeCategoria(venda.categoria)} mr-1`}></i>
                        {getNomeCategoria(venda.categoria)}
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        Funcionário: {venda.nomefun}
                      </div>
                    </div>
                  </div>)}
                {filteredVendas.length === 0 && <div className="text-center text-muted-foreground py-8 border rounded-lg">
                    {callfarmaAPI.loading ? 'Carregando dados...' : 'Nenhuma venda encontrada'}
                  </div>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>;
}