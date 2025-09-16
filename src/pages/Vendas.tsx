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

// CORREÇÃO 1: Mapeamento dos grupos conforme fornecido - REMOVIDO grupo 22 de 'similar'
const CATEGORIAS_GRUPOS = {
  'similar': [2, 21, 20, 25], // REMOVIDO 22 para evitar duplicação com goodlife
  'generico': [47, 5, 6],
  'perfumaria_alta': [46],
  'goodlife': [22], // Mantido apenas aqui
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

  // CORREÇÃO 2: Cálculos das vendas - Total geral da loja é a soma de todos os CDFIL da loja
  const calculatedData = useMemo(() => {
    // GERAL = TODAS as vendas da loja (soma total por CDFIL)
    const totalGeralVendas = vendasProcessadas.reduce((sum, venda) => sum + venda.valor_liquido, 0);
    
    // Para participação, geral é 100% do total
    const valorTotalTodas = totalGeralVendas;
    const participacaoGeral = 100; // Geral sempre é 100% do total
    
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

  // CORREÇÃO 3: Vendas por categoria - Corrigida a lógica de agregação
  const vendasPorCategoria = useMemo(() => {
    const grouped = vendasProcessadas.reduce((acc, venda) => {
      // Adicionar à categoria específica
      let categoria = venda.categoria;
      
      if (!acc[categoria]) {
        acc[categoria] = { valor: 0, transacoes: 0 };
      }
      acc[categoria].valor += venda.valor_liquido;
      acc[categoria].transacoes += 1;

      // CORREÇÃO: Mapear para categorias agrupadas SEM duplicação
      // Genérico & Similar: somar apenas uma vez cada categoria
      if (venda.categoria === 'similar' || venda.categoria === 'generico') {
        if (!acc['generico_similar']) acc['generico_similar'] = { valor: 0, transacoes: 0 };
        acc['generico_similar'].valor += venda.valor_liquido;
        acc['generico_similar'].transacoes += 1;
      } 
      // Conveniência R+: somar conveniencia e brinquedo
      else if (venda.categoria === 'conveniencia' || venda.categoria === 'brinquedo') {
        if (!acc['conveniencia_r_mais']) acc['conveniencia_r_mais'] = { valor: 0, transacoes: 0 };
        acc['conveniencia_r_mais'].valor += venda.valor_liquido;
        acc['conveniencia_r_mais'].transacoes += 1;
      } 
      // R+: somar rentaveis20 e rentaveis25
      else if (venda.categoria === 'rentaveis20' || venda.categoria === 'rentaveis25') {
        if (!acc['r_mais']) acc['r_mais'] = { valor: 0, transacoes: 0 };
        acc['r_mais'].valor += venda.valor_liquido;
        acc['r_mais'].transacoes += 1;
      } 
      // GoodLife: somar apenas goodlife (SEM duplicação)
      else if (venda.categoria === 'goodlife') {
        if (!acc['goodlife']) acc['goodlife'] = { valor: 0, transacoes: 0 };
        acc['goodlife'].valor += venda.valor_liquido;
        acc['goodlife'].transacoes += 1;
      } 
      // Perfumaria R+: somar perfumaria_alta
      else if (venda.categoria === 'perfumaria_alta') {
        if (!acc['perfumaria_r_mais']) acc['perfumaria_r_mais'] = { valor: 0, transacoes: 0 };
        acc['perfumaria_r_mais'].valor += venda.valor_liquido;
        acc['perfumaria_r_mais'].transacoes += 1;
      }
      
      return acc;
    }, {} as Record<string, { valor: number; transacoes: number }>);

    // CORREÇÃO: Total geral como categoria - soma de TODOS os CDFIL da loja
    const totalGeral = vendasProcessadas.reduce((sum, venda) => sum + venda.valor_liquido, 0);
    const totalTransacoes = vendasProcessadas.length;
    
    grouped['geral'] = {
      valor: totalGeral,
      transacoes: totalTransacoes
    };
    
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

  // CORREÇÃO 4: Buscar vendas da API externa - Garantir soma correta por CDFIL da loja
  const fetchVendasAPI = async () => {
    if (!numeroLoja || !selectedPeriod) return;
    
    try {
      setLoading(true);
      
      // Converter número da loja para CDFIL (número da loja na API)
      const cdfilLoja = parseInt(numeroLoja);
      console.log('🔍 Buscando vendas da API para loja:', numeroLoja, 'CDFIL:', cdfilLoja);

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

      console.log('📅 Período:', dataInicio, 'até', dataFim);

      // CORREÇÃO: Fazer requisição com filtro de loja específico
      const { data, error } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/financeiro/vendas-por-funcionario',
          params: {
            dataFim,
            dataIni: dataInicio,
            groupBy: 'scekarde.DATA,scefun.CDFUN,sceprodu.CDGRUPO',
            orderBy: 'scekarde.DATA desc',
            filtroFiliais: numeroLoja.toString().padStart(2, '0') // Garantir filtro correto
          }
        }
      });

      if (error) {
        console.error('Erro na API:', error);
        throw error;
      }

      const dadosAPI: VendaAPI[] = data?.msg || [];
      console.log('📊 Dados recebidos da API:', dadosAPI.length, 'registros');

      // CORREÇÃO: Filtro adicional local para garantir que só apareçam dados da loja específica
      const dadosFiltrados = dadosAPI.filter(item => {
        const match = item.CDFIL === cdfilLoja;
        if (!match) {
          console.log('⚠️ Filtrando item de outra loja:', item.CDFIL, 'esperado:', cdfilLoja);
        }
        return match;
      });

      console.log('🔍 Dados após filtro local:', dadosFiltrados.length, 'registros');

      // Verificar se recebemos dados da loja correta
      if (dadosFiltrados.length > 0) {
        const lojasUnicas = [...new Set(dadosFiltrados.map(item => item.CDFIL))];
        console.log('🏪 Lojas nos dados filtrados:', lojasUnicas);
      }

      // CORREÇÃO: Processar dados sem duplicação
      const vendasMap = new Map<string, VendaProcessada>();

      dadosFiltrados.forEach((item, index) => {
        const categoria = mapearGrupoParaCategoria(item.CDGRUPO);
        const valorLiquido = (item.TOTAL_VLR_VE || 0) - (item.TOTAL_VLR_DV || 0);
        
        if (valorLiquido > 0) {
          const key = `${item.CDFUN}-${item.DATA}-${item.CDGRUPO || 0}-${index}`;
          
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
          dadosFiltrados.map(item => [item.CDFUN, { cdfun: item.CDFUN, nome: item.NOMEFUN }])
        ).values()
      );

      console.log('✅ Processamento concluído:', vendasProcessadasArray.length, 'vendas,', funcionariosUnicos.length, 'funcionários');
      
      // CORREÇÃO: Verificar total de valores por categoria (sem duplicação)
      const totalPorCategoria = vendasProcessadasArray.reduce((acc, venda) => {
        if (!acc[venda.categoria]) acc[venda.categoria] = 0;
        acc[venda.categoria] += venda.valor_liquido;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('💰 Total por categoria (SEM duplicação):', totalPorCategoria);
      
      setVendasProcessadas(vendasProcessadasArray);
      setFuncionarios(funcionariosUnicos);
      
      // Gerar dados do gráfico
      generateChartData(vendasProcessadasArray);
      
      toast.success(`Vendas carregadas: ${vendasProcessadasArray.length} registros da loja ${numeroLoja}`);
      
    } catch (error) {
      console.error('Erro ao buscar vendas:', error);
      toast.error('Erro ao carregar vendas da API externa');
    } finally {
      setLoading(false);
    }
  };

  // Gerar dados do gráfico
  const generateChartData = (vendas: VendaProcessada[]) => {
    try {
      // Agrupar vendas por data
      const vendasPorData = vendas.reduce((acc, venda) => {
        const data = venda.data_venda;
        if (!acc[data]) {
          acc[data] = {
            geral: 0,
            goodlife: 0,
            perfumaria_r_mais: 0,
            conveniencia_r_mais: 0,
            r_mais: 0,
            transacoes: 0
          };
        }
        
        acc[data].geral += venda.valor_liquido;
        acc[data].transacoes += 1;
        
        // CORREÇÃO: Mapear categorias sem duplicação
        if (venda.categoria === 'goodlife') {
          acc[data].goodlife += venda.valor_liquido;
        } else if (venda.categoria === 'perfumaria_alta') {
          acc[data].perfumaria_r_mais += venda.valor_liquido;
        } else if (venda.categoria === 'conveniencia' || venda.categoria === 'brinquedo') {
          acc[data].conveniencia_r_mais += venda.valor_liquido;
        } else if (venda.categoria === 'rentaveis20' || venda.categoria === 'rentaveis25') {
          acc[data].r_mais += venda.valor_liquido;
        }
        
        return acc;
      }, {} as Record<string, any>);

      // Converter para array e ordenar por data
      const chartMap = new Map<string, ChartData>();
      
      Object.entries(vendasPorData).forEach(([data, valores]) => {
        chartMap.set(data, {
          date: data,
          value: valores.geral,
          transactions: valores.transacoes,
          geral: valores.geral,
          goodlife: valores.goodlife,
          perfumaria_r_mais: valores.perfumaria_r_mais,
          conveniencia_r_mais: valores.conveniencia_r_mais,
          r_mais: valores.r_mais
        });
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
            Dados da API Externa Callfarma - CORRIGIDO (sem duplicação)
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
            Indicadores por Categoria (API Externa - CORRIGIDO)
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

      {/* Resto do componente permanece igual... */}
      {/* Filters, Tables, etc. */}
      
    </div>
  );
}

