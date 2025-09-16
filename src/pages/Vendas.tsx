import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCallfarmaAPI } from '@/hooks/useCallfarmaAPI';
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
  const { user, loading: authLoading } = useAuth();
  const { selectedPeriod } = usePeriodContext();
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
    cdfil?: number; // Fazer opcional para debug
  } | null>(null);

  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('all');
  const [vendedorFilter, setVendedorFilter] = useState<string>('all');
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [chartCategoriaFilter, setChartCategoriaFilter] = useState<string>('geral');
  const [filtroAdicional, setFiltroAdicional] = useState<string>('hoje'); // Mudança: começar com 'hoje' para teste
  const [dataEspecifica, setDataEspecifica] = useState<string>('');
  const [selectedLojaId, setSelectedLojaId] = useState<number | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>(''); // Para mostrar info de debug na tela

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
      const matchesSearch = venda.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           venda.nomefun.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategoria = categoriaFilter === 'all' || venda.categoria === categoriaFilter;
      const matchesVendedor = vendedorFilter === 'all' || venda.cdfun.toString() === vendedorFilter;
      return matchesSearch && matchesCategoria && matchesVendedor;
    });
  }, [vendasProcessadas, searchTerm, categoriaFilter, vendedorFilter]);

  const calculatedData = useMemo(() => {
    const totalGeralVendas = dadosFilial.valor;
    const ticketMedio = dadosFilial.ticketMedio;
    const totalClientes = dadosFilial.totCli;

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
    }, {} as Record<string, { valor: number; transacoes: number }>);

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

  // Buscar metas da loja
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
  }, [user, selectedPeriod, vendasPorCategoria, currentLojaId]);

  // Calcular melhor e pior indicador
  const indicadoresRanking = useMemo(() => {
    const indicadores = Object.entries(vendasPorCategoria)
      .filter(([categoria]) => categoria !== 'geral')
      .map(([categoria, dados]) => {
        const metaInfo = metasData[categoria];
        const percentualMeta = metaInfo?.meta > 0 ? dados.valor / metaInfo.meta * 100 : 0;
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

  // ✅ useEffect principal
  useEffect(() => {
    console.log('🔄 useEffect principal - user:', !!user, 'initialized:', initialized);
    if (user && !initialized) {
      fetchLojaInfo();
      setInitialized(true);
    }
  }, [user, initialized]);

  // ✅ Refetch quando filtros mudarem
  useEffect(() => {
    console.log('🔄 useEffect filtros - user:', !!user, 'initialized:', initialized, 'lojaInfo:', !!lojaInfo);
    if (user && initialized && lojaInfo) {
      fetchVendas();
    }
  }, [selectedPeriod, filtroAdicional, dataEspecifica, user, initialized, currentLojaId, selectedLojaId, lojaInfo]);

  // Quando selecionar um colaborador
  useEffect(() => {
    if (vendedorFilter !== 'all') {
      setCategoriaFilter('all');
      setChartCategoriaFilter('multi');
    }
  }, [vendedorFilter]);

  // Gerar dados do gráfico
  useEffect(() => {
    if (user && lojaInfo && initialized) {
      generateChartData();
    }
  }, [vendasProcessadas, lojaInfo, user, chartCategoriaFilter, vendedorFilter, initialized]);

  const fetchLojaInfo = async () => {
    console.log('🏪 fetchLojaInfo - currentLojaId:', currentLojaId);
    if (!currentLojaId) return;
    
    try {
      // Buscar apenas os campos que existem na tabela lojas
      const { data: lojaData, error: lojaError } = await supabase
        .from('lojas')
        .select('regiao, numero, nome, id')
        .eq('id', currentLojaId)
        .single();
      
      console.log('🏪 Dados da loja:', lojaData);
      console.log('🏪 Erro ao buscar loja:', lojaError);
      
      if (lojaError) {
        setDebugInfo(`Erro ao buscar loja: ${lojaError.message}`);
        throw lojaError;
      }

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

      console.log('🏪 CDFIL definido (usando campo numero ou id):', cdfil);

      const infoLoja = {
        regiao: lojaData.regiao || 'centro',
        numero: lojaData.numero || currentLojaId.toString(),
        nome: lojaData.nome || `Loja ${currentLojaId}`,
        cdfil
      };

      setLojaInfo(infoLoja);
      setDebugInfo(`Loja carregada: ${infoLoja.nome} (CDFIL: ${cdfil} do campo '${lojaData.numero ? 'numero' : 'id'}')`);
      console.log('🏪 Info da loja final:', infoLoja);
      
    } catch (error) {
      console.error('❌ Erro ao buscar informações da loja:', error);
      setDebugInfo(`Erro ao buscar loja: ${error}`);
    }
  };

  const fetchVendas = async () => {
    console.log('📊 fetchVendas iniciado');
    
    if (!lojaInfo) {
      console.log('❌ Sem info da loja ainda, aguardando...');
      setDebugInfo('Aguardando informações da loja...');
      return;
    }
    
    try {
      // Calcular período baseado no filtro
      let dataInicio: string;
      let dataFim: string;
      
      const hoje = new Date();
      
      if (filtroAdicional === 'data_especifica' && dataEspecifica) {
        dataInicio = dataEspecifica;
        dataFim = dataEspecifica;
      } else if (filtroAdicional === 'hoje') {
        const hojeStr = format(hoje, 'yyyy-MM-dd');
        dataInicio = hojeStr;
        dataFim = hojeStr;
      } else if (filtroAdicional === 'ontem') {
        const ontem = new Date(hoje);
        ontem.setDate(hoje.getDate() - 1);
        const ontemStr = format(ontem, 'yyyy-MM-dd');
        dataInicio = ontemStr;
        dataFim = ontemStr;
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
        const dataInicioAjustada = new Date(selectedPeriod.startDate);
        dataInicioAjustada.setDate(dataInicioAjustada.getDate() + 1);
        dataInicio = format(dataInicioAjustada, 'yyyy-MM-dd');
        dataFim = format(selectedPeriod.endDate, 'yyyy-MM-dd');
      } else {
        console.log('❌ Filtro não reconhecido:', filtroAdicional);
        setDebugInfo(`Filtro não reconhecido: ${filtroAdicional}`);
        return;
      }

      console.log(`📅 Período definido: ${dataInicio} a ${dataFim}`);
      console.log(`🏪 CDFIL da loja: ${lojaInfo.cdfil}`);
      
      setDebugInfo(`Buscando dados de ${dataInicio} a ${dataFim} para loja CDFIL ${lojaInfo.cdfil}`);

      // Primeiro, vamos testar uma chamada direta para ver se a API responde
      console.log('🧪 TESTE: Fazendo chamada direta à API...');
      
      try {
        const testeAPI = await supabase.functions.invoke('callfarma-vendas', {
          body: {
            endpoint: '/financeiro/vendas-por-filial',
            params: {
              cdfil: lojaInfo.cdfil,
              dataIni: dataInicio,
              dataFim: dataFim,
              dataIniAnt: dataInicio,
              dataFimAnt: dataFim
            }
          }
        });
        
        console.log('🧪 TESTE API - Resposta:', testeAPI);
        console.log('🧪 TESTE API - Dados:', testeAPI.data);
        console.log('🧪 TESTE API - Erro:', testeAPI.error);
        
        if (testeAPI.error) {
          setDebugInfo(`Erro na API: ${testeAPI.error.message}`);
          toast.error('Erro na chamada da API');
          return;
        }

        const testMsg = testeAPI.data?.msg || [];
        console.log('🧪 TESTE API - Mensagem:', testMsg);
        setDebugInfo(`Teste API OK: ${testMsg.length} registros recebidos`);

        // Se chegou aqui, a API funciona, vamos usar as funções do hook
        if (vendedorFilter !== 'all') {
          console.log('👤 Buscando dados específicos do funcionário:', vendedorFilter);
          
          const dadosFuncionario = await callfarmaAPI.buscarVendasFuncionariosDetalhadas(
            dataInicio,
            dataFim,
            lojaInfo.cdfil,
            parseInt(vendedorFilter)
          );
          
          console.log('👤 Dados funcionário recebidos:', dadosFuncionario.length);
          
          const vendasProcessadasFunc = processarDadosFuncionarios(dadosFuncionario);
          setVendasProcessadas(vendasProcessadasFunc);
          
          setDadosFilial({
            valor: 0,
            totCli: 0,
            ticketMedio: 0,
            crescimento: '0'
          });
          
          setDebugInfo(`Funcionário: ${dadosFuncionario.length} registros → ${vendasProcessadasFunc.length} processados`);
        } else {
          console.log('🏪 Buscando dados completos da loja');
          
          const cdfil = canViewAllStores && !selectedLojaId ? 'all' : lojaInfo.cdfil;
          
          const { vendasFilial, vendasFuncionarios, funcionarios: funcAPI } = await callfarmaAPI.buscarDadosVendasCompletos(
            dataInicio,
            dataFim,
            cdfil
          );

          console.log('📊 Dados completos recebidos:', {
            vendasFilial: vendasFilial.length,
            vendasFuncionarios: vendasFuncionarios.length,
            funcionarios: funcAPI.length
          });

          // Processar dados da filial
          if (vendasFilial.length > 0) {
            const dadosFilialAgregados = vendasFilial.reduce((acc, item) => ({
              valor: acc.valor + item.valor,
              totCli: acc.totCli + item.totCli,
              ticketMedio: acc.totCli > 0 ? (acc.valor + item.valor) / (acc.totCli + item.totCli) : item.ticketMedio,
              crescimento: item.crescimento
            }), { valor: 0, totCli: 0, ticketMedio: 0, crescimento: '0' });
            
            console.log('📊 Dados filial processados:', dadosFilialAgregados);
            setDadosFilial(dadosFilialAgregados);
          } else {
            console.log('❌ Nenhum dado de filial encontrado');
            setDadosFilial({ valor: 0, totCli: 0, ticketMedio: 0, crescimento: '0' });
          }

          // Processar dados dos funcionários
          const vendasProc = processarDadosFuncionarios(vendasFuncionarios);
          console.log('📊 Vendas processadas:', vendasProc.length);
          setVendasProcessadas(vendasProc);
          
          // Atualizar lista de funcionários
          console.log('👥 Funcionários encontrados:', funcAPI.length);
          setFuncionarios(funcAPI);
          
          setDebugInfo(`Dados carregados: ${vendasFilial.length} filiais, ${vendasFuncionarios.length} funcionários, ${vendasProc.length} vendas processadas`);
        }

      } catch (apiError) {
        console.error('❌ Erro na chamada da API:', apiError);
        setDebugInfo(`Erro na API: ${apiError}`);
        toast.error('Erro ao chamar API externa');
      }

    } catch (error) {
      console.error('❌ Erro geral ao buscar vendas:', error);
      setDebugInfo(`Erro geral: ${error}`);
      toast.error('Erro ao carregar dados de vendas');
    }
  };

  const processarDadosFuncionarios = (dados: any[]): VendaProcessada[] => {
    console.log('⚙️ Processando dados dos funcionários:', dados.length, 'registros');
    
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
    }).filter(item => {
      const valido = item.valor_liquido > 0;
      if (!valido) {
        console.log('❌ Item filtrado (valor <= 0):', item);
      }
      return valido;
    });
    
    console.log('✅ Dados processados:', processados.length, 'vendas válidas');
    
    // Log das primeiras 5 vendas para debug
    processados.slice(0, 5).forEach((venda, i) => {
      console.log(`📋 Venda ${i+1}:`, {
        funcionario: venda.nomefun,
        categoria: venda.categoria,
        valor: venda.valor_liquido,
        data: venda.data_venda
      });
    });
    
    return processados;
  };

  const generateChartData = async () => {
    try {
      if (!lojaInfo) return;
      
      const hoje = new Date();
      const inicioMes = startOfMonth(subMonths(hoje, 2));
      
      const dataInicio = format(inicioMes, 'yyyy-MM-dd');
      const dataFim = format(hoje, 'yyyy-MM-dd');
      
      const cdfil = canViewAllStores && !selectedLojaId ? 'all' : lojaInfo.cdfil;
      
      let dadosChart: any[] = [];
      
      if (vendedorFilter !== 'all') {
        dadosChart = await callfarmaAPI.buscarVendasFuncionariosDetalhadas(
          dataInicio,
          dataFim,
          lojaInfo.cdfil,
          parseInt(vendedorFilter)
        );
      } else {
        const { vendasFuncionarios } = await callfarmaAPI.buscarDadosVendasCompletos(dataInicio, dataFim, cdfil);
        dadosChart = vendasFuncionarios;
      }

      console.log('📈 Dados para gráfico:', dadosChart.length, 'registros');

      const chartMap = new Map<string, ChartData>();

      const allDays = eachDayOfInterval({ start: inicioMes, end: hoje });
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

      dadosChart.forEach((item) => {
        const dataKey = item.DATA.split('T')[0];
        const existing = chartMap.get(dataKey);
        if (existing) {
          const valorLiquido = (item.TOTAL_VLR_VE || 0) - (item.TOTAL_VLR_DV || 0);
          const categoria = mapearGrupoParaCategoria(item.CDGRUPO);
          
          existing.value += valorLiquido;
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
      console.log('📈 Dados finais do gráfico:', finalData.length, 'pontos');
      setChartData(finalData);
      
    } catch (error) {
      console.error('❌ Erro ao gerar dados do gráfico:', error);
    }
  };

  // Early returns após hooks
  if (authLoading || callfarmaAPI.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {authLoading ? 'Verificando autenticação...' : 'Carregando dados...'}
          </p>
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

  const singleStrokeColor = getCorCategoria(chartCategoriaFilter && chartCategoriaFilter !== 'multi' ? chartCategoriaFilter : 'geral');

  return (
    <div className="page-container space-y-4 sm:space-y-6 bg-background min-h-screen">
      {/* DEBUG INFO CARD */}
      {debugInfo && (
        <Card className="border-yellow-500 bg-yellow-50">
          <CardContent className="p-4">
            <h3 className="font-bold text-yellow-800">Debug Info:</h3>
            <p className="text-yellow-700 text-sm">{debugInfo}</p>
            <div className="mt-2 text-xs text-yellow-600">
              <p>User: {user?.nome}</p>
              <p>Loja ID: {currentLojaId}</p>
              <p>Período: {selectedPeriod?.label}</p>
              <p>Vendas processadas: {vendasProcessadas.length}</p>
              <p>Funcionários: {funcionarios.length}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {canViewAllStores && !selectedLojaId 
              ? 'Vendas - Todas as Lojas' 
              : lojaInfo 
                ? `Vendas - ${lojaInfo.numero} - ${lojaInfo.nome.toUpperCase()}` 
                : `Vendas - Loja ${currentLojaId || user.loja_id}`
            }
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Dados em tempo real da API Callfarma {lojaInfo?.cdfil ? `(CDFIL: ${lojaInfo.cdfil})` : ''}
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
                <p className="text-xs sm:text-sm text-muted-foreground">Vendas Gerais</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground">
                  R$ {calculatedData.totalGeralVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                  R$ {calculatedData.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  API Callfarma
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

      {/* Filtros com botão de debug */}
      <Card className="mb-4 sm:mb-6">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>Filtros</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                console.log('🔄 Forçando reload...');
                fetchVendas();
              }}
            >
              🔄 Recarregar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
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
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="ontem">Ontem</SelectItem>
                <SelectItem value="ultima_semana">Última Semana</SelectItem>
                <SelectItem value="ultimo_mes">Último Mês</SelectItem>
                <SelectItem value="periodo">Período Selecionado</SelectItem>
                <SelectItem value="data_especifica">Data Específica</SelectItem>
              </SelectContent>
            </Select>

            {filtroAdicional === 'data_especifica' && (
              <Input
                type="date"
                value={dataEspecifica}
                onChange={(e) => setDataEspecifica(e.target.value)}
                className="w-full"
              />
            )}

            <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Funcionário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Funcionários</SelectItem>
                {funcionarios.map(funcionario => (
                  <SelectItem key={funcionario.id} value={funcionario.id.toString()}>
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
                <SelectItem value="r_mais">Rentáveis R+</SelectItem>
                <SelectItem value="perfumaria_r_mais">Perfumaria R+</SelectItem>
                <SelectItem value="conveniencia_r_mais">Conveniência R+</SelectItem>
                <SelectItem value="goodlife">GoodLife</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Vendas Simples para Debug */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Vendas Debug ({filteredVendas.length} registros)</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredVendas.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {callfarmaAPI.loading ? 'Carregando dados...' : 'Nenhuma venda encontrada'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredVendas.slice(0, 10).map(venda => (
                <div key={venda.id} className="border rounded p-2 text-sm">
                  <div className="font-semibold">{venda.nomefun}</div>
                  <div className="text-muted-foreground">
                    {venda.data_venda} | {getNomeCategoria(venda.categoria)} | 
                    R$ {venda.valor_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ))}
              {filteredVendas.length > 10 && (
                <div className="text-center text-muted-foreground py-2">
                  ... e mais {filteredVendas.length - 10} vendas
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}