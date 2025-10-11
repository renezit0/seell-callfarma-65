import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, TrendingUp, PieChart, Activity, Calendar } from 'lucide-react';
import { getNomeCategoria, getCorCategoria } from '@/utils/categories';
import { Navigate } from 'react-router-dom';
import { format, startOfMonth, subMonths, eachDayOfInterval, getDay } from 'date-fns';
import { StoreSelector } from '@/components/StoreSelector';
import { useCallfarmaAPI } from '@/hooks/useCallfarmaAPI';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { 
  LineChart as RechartsLineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Cell,
  Pie,
  Area,
  AreaChart as RechartsAreaChart
} from 'recharts';

interface ChartData {
  date: string;
  value: number;
  clientes: number;
  ticketMedio: number;
  geral: number;
  goodlife: number;
  perfumaria_r_mais: number;
  conveniencia_r_mais: number;
  r_mais: number;
}

interface PieChartData {
  name: string;
  value: number;
  color: string;
}

interface MetasData {
  categoria: string;
  meta: number;
  realizado: number;
  percentual: number;
}

export default function Graficos() {
  const { user, loading: authLoading } = useAuth();
  const { buscarTodasVendasConsolidadas } = useCallfarmaAPI();
  const [loading, setLoading] = useState(true);
  const [selectedLojaId, setSelectedLojaId] = useState<number | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [pieChartData, setPieChartData] = useState<PieChartData[]>([]);
  const [metasData, setMetasData] = useState<MetasData[]>([]);
  const [lojaInfo, setLojaInfo] = useState<{ regiao: string; numero: string; nome: string } | null>(null);
  
  // Filtros de data
  const hoje = new Date();
  const diaAtual = hoje.getDate();
  
  // Se hoje é antes do dia 20, usar dia 21 do mês anterior
  // Se hoje é dia 20 ou depois, usar dia 21 do mês atual
  const getDataInicioDefault = () => {
    if (diaAtual < 20) {
      // Dia 21 do mês anterior
      const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 21);
      return format(mesAnterior, 'yyyy-MM-dd');
    } else {
      // Dia 21 do mês atual
      const mesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 21);
      return format(mesAtual, 'yyyy-MM-dd');
    }
  };
  
  const [dataInicio, setDataInicio] = useState(getDataInicioDefault());
  const [dataFim, setDataFim] = useState(format(hoje, 'yyyy-MM-dd'));

  const canViewAllStores = user?.tipo && ['admin', 'supervisor', 'compras'].includes(user.tipo);
  const currentLojaId = canViewAllStores ? selectedLojaId : (user?.loja_id || null);

  // Mapeamento dos grupos de categorias (igual ao script Node.js)
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

  // Função para determinar categorias baseado no grupo
  const determinarCategorias = (cdgrupo: number) => {
    const categorias = [];
    for (const [categoria, grupos] of Object.entries(CATEGORIAS_GRUPOS)) {
      if (grupos.includes(cdgrupo)) {
        categorias.push(categoria);
      }
    }
    return categorias;
  };

  const determinarCategoriasLoja = (cdgrupo: number) => {
    const categorias = [];
    for (const [categoria, grupos] of Object.entries(MAPEAMENTO_LOJA_CATEGORIAS)) {
      if (grupos.includes(cdgrupo)) {
        categorias.push(categoria);
      }
    }
    return categorias;
  };

  useEffect(() => {
    // Só buscar info da loja se for uma loja específica
    if (user && currentLojaId) {
      fetchLojaInfo();
    } else if (canViewAllStores && !selectedLojaId) {
      // Limpar info da loja quando for "todas as lojas"
      setLojaInfo(null);
    }
  }, [user, currentLojaId]);

  useEffect(() => {
    // Buscar dados do gráfico sempre que as dependências mudarem
    if (user && dataInicio && dataFim) {
      fetchChartData();
      fetchMetasComparison();
    }
  }, [user, currentLojaId, dataInicio, dataFim, lojaInfo]);

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
      return data;
    } catch (error) {
      console.error('Erro ao buscar informações da loja:', error);
      return null;
    }
  };

  const fetchChartData = async () => {
    try {
      setLoading(true);
      
      // Criar datas no timezone local para evitar problemas de fuso horário
      const startDate = new Date(dataInicio + 'T00:00:00');
      const endDate = new Date(dataFim + 'T23:59:59');

      // MODIFICAÇÃO: Só passar currentLojaId se não for "todas as lojas"
      const lojaIdParaFiltro = (canViewAllStores && !selectedLojaId) ? undefined : currentLojaId;
      
      console.log('Buscando dados da API externa para período:', {
        startDate: dataInicio,
        endDate: dataFim,
        loja: lojaIdParaFiltro || 'TODAS AS LOJAS'
      });

      // Buscar dados com ou sem filtro de loja
      const todosDados = await buscarTodasVendasConsolidadas(dataInicio, dataFim, lojaIdParaFiltro);
      
      const {
        geral: dadosGeral,
        rentaveis: dadosRentaveis,
        perfumaria_alta: dadosPerfumariaAlta,
        conveniencia_alta: dadosConvenienciaAlta,
        goodlife: dadosGoodlife
      } = todosDados;

      console.log('Dados recebidos da API:', {
        geral: dadosGeral.length,
        rentaveis: dadosRentaveis.length,
        perfumariaAlta: dadosPerfumariaAlta.length,
        convenienciaAlta: dadosConvenienciaAlta.length,
        goodlife: dadosGoodlife.length
      });

  // Verificar se deve excluir domingos - só se for uma loja específica da região centro
  let shouldExcludeSundays = false;
  let infoLoja = lojaInfo;
  
  // Se não temos info da loja mas temos um ID específico, buscar agora
  if (lojaIdParaFiltro && !lojaInfo) {
    try {
      const { data: tempLojaInfo } = await supabase
        .from('lojas')
        .select('regiao, numero, nome')
        .eq('id', lojaIdParaFiltro)
        .single();
      infoLoja = tempLojaInfo;
      setLojaInfo(tempLojaInfo);
    } catch (error) {
      console.warn('Erro ao buscar info da loja:', error);
    }
  }
  
  if (lojaIdParaFiltro && infoLoja) {
    shouldExcludeSundays = infoLoja.regiao === 'centro';
  }
  
  console.log('Informação da loja:', infoLoja);
  console.log('Deve excluir domingos?', shouldExcludeSundays);

      // Buscar informações da loja apenas se for uma loja específica
      let numeroLoja = null;
      if (lojaIdParaFiltro) {
        const { data: lojaData } = await supabase
          .from('lojas')
          .select('numero')
          .eq('id', lojaIdParaFiltro)
          .single();
        numeroLoja = parseInt(lojaData?.numero || '0');
        console.log('Número da loja:', numeroLoja);
      }

      // Inicializar com todos os dias do período
      const chartMap = new Map<string, ChartData>();
      
      // Garantir que usamos apenas os dias dentro do período especificado
      const allDays = eachDayOfInterval({ 
        start: startDate, 
        end: endDate 
      });

      console.log('Período dos gráficos:', {
        inicio: format(startDate, 'dd/MM/yyyy'),
        fim: format(endDate, 'dd/MM/yyyy'),
        totalDias: allDays.length
      });

      allDays.forEach(day => {
        const dayOfWeek = getDay(day);
        const dateStr = format(day, 'yyyy-MM-dd');
        
        // Verificar se a data está realmente dentro do período
        if (dateStr < dataInicio || dateStr > dataFim) {
          console.log('Pulando data fora do período:', dateStr);
          return;
        }
        
        // Só excluir domingo se for loja específica da região centro
        if (shouldExcludeSundays && dayOfWeek === 0) {
          console.log('Excluindo domingo:', dateStr, 'para loja da região centro');
          return;
        }

        chartMap.set(dateStr, {
          date: format(day, 'dd/MM'),
          value: 0,
          clientes: 0,
          ticketMedio: 0,
          geral: 0,
          goodlife: 0,
          perfumaria_r_mais: 0,
          conveniencia_r_mais: 0,
          r_mais: 0
        });
      });

      console.log('Total de dias no gráfico:', chartMap.size);

      // Buscar dados de vendas por filial para calcular ticket médio corretamente
      let dadosVendasFilial: any[] = [];
      try {
        if (lojaIdParaFiltro) {
          // Buscar dados da API vendas-por-filial para a loja específica
          const { data: vendasFilialData, error } = await supabase.functions.invoke('callfarma-vendas', {
            body: {
              endpoint: '/financeiro/vendas-por-filial',
              params: {
                dataFim: dataFim,
                dataIni: dataInicio,
                dataFimAnt: dataFim,
                dataIniAnt: dataInicio
              }
            }
          });

          if (!error && vendasFilialData?.msg) {
            // Filtrar apenas pela loja específica
            dadosVendasFilial = vendasFilialData.msg.filter((item: any) => item.CDFIL === numeroLoja);
            console.log('Dados vendas filial para ticket médio:', dadosVendasFilial.length);
          }
        }
      } catch (error) {
        console.warn('Erro ao buscar dados de vendas por filial para ticket médio:', error);
      }

      // Função para processar dados de uma categoria
      const processarDadosCategoria = (dados: any[], nomeCategoria: string) => {
        const vendasPorData = new Map<string, number>();
        const clientesPorData = new Map<string, number>();
        
        dados.forEach((item: any) => {
          try {
            const cdfil = parseInt(item.CDFIL) || 0;
            const valorLiquido = parseFloat(item.VALOR_LIQUIDO) || 0; // Usar VALOR_LIQUIDO já calculado
            const dataVendaRaw = item.DATA;

            // MODIFICAÇÃO: Só filtrar por loja específica se não for "todas as lojas"
            if (numeroLoja && cdfil !== numeroLoja) {
              return;
            }

            // Processar data
            let dataVenda = null;
            if (dataVendaRaw) {
              if (dataVendaRaw.includes('T')) {
                dataVenda = dataVendaRaw.split('T')[0];
              } else {
                dataVenda = dataVendaRaw;
              }
            }

            if (!dataVenda) {
              return;
            }

            // Usar valor líquido já calculado pela API
            if (valorLiquido <= 0) {
              return;
            }

            // Somar ao total da data
            const totalAnterior = vendasPorData.get(dataVenda) || 0;
            vendasPorData.set(dataVenda, totalAnterior + valorLiquido);

          } catch (error) {
            console.warn('Erro ao processar registro da API:', error);
          }
        });

        // Calcular clientes usando dados da API vendas-por-filial
        if (dadosVendasFilial.length > 0) {
          dadosVendasFilial.forEach((item: any) => {
            try {
              const dataVenda = item.DATA ? item.DATA.split('T')[0] : null;
              const qtdClientes = parseInt(item.TOTCLI) || 0;

              if (dataVenda && qtdClientes > 0) {
                const clientesAnterior = clientesPorData.get(dataVenda) || 0;
                clientesPorData.set(dataVenda, clientesAnterior + qtdClientes);
              }
            } catch (error) {
              console.warn('Erro ao processar clientes da API filial:', error);
            }
          });
        }
        
        return { vendas: vendasPorData, clientes: clientesPorData };
      };

      // Processar dados de cada categoria
      const resultadosGeral = processarDadosCategoria(dadosGeral, 'geral');
      const resultadosRentaveis = processarDadosCategoria(dadosRentaveis, 'rentaveis');
      const resultadosPerfumariaAlta = processarDadosCategoria(dadosPerfumariaAlta, 'perfumaria_alta');
      const resultadosConvenienciaAlta = processarDadosCategoria(dadosConvenienciaAlta, 'conveniencia_alta');
      const resultadosGoodlife = processarDadosCategoria(dadosGoodlife, 'goodlife');

      // Aplicar vendas aos dias do gráfico
      for (const [dataVenda] of chartMap.entries()) {
        const existing = chartMap.get(dataVenda);
        if (existing) {
          const valorGeral = resultadosGeral.vendas.get(dataVenda) || 0;
          const clientesGeral = resultadosGeral.clientes.get(dataVenda) || 0;
          
          existing.value = valorGeral;
          existing.geral = valorGeral;
          existing.clientes = clientesGeral;
          existing.ticketMedio = clientesGeral > 0 ? valorGeral / clientesGeral : 0;
          existing.goodlife = resultadosGoodlife.vendas.get(dataVenda) || 0;
          existing.perfumaria_r_mais = resultadosPerfumariaAlta.vendas.get(dataVenda) || 0;
          existing.conveniencia_r_mais = resultadosConvenienciaAlta.vendas.get(dataVenda) || 0;
          existing.r_mais = resultadosRentaveis.vendas.get(dataVenda) || 0;
        }
      }

      const finalData = Array.from(chartMap.values());
      setChartData(finalData);

      // Preparar dados para o gráfico de pizza
      const categoryTotals = finalData.reduce((acc, day) => {
        acc.geral += day.geral;
        acc.goodlife += day.goodlife;
        acc.perfumaria_r_mais += day.perfumaria_r_mais;
        acc.conveniencia_r_mais += day.conveniencia_r_mais;
        acc.r_mais += day.r_mais;
        return acc;
      }, {
        geral: 0,
        goodlife: 0,
        perfumaria_r_mais: 0,
        conveniencia_r_mais: 0,
        r_mais: 0
      });

      const pieData: PieChartData[] = Object.entries(categoryTotals)
        .filter(([_, value]) => value > 0)
        .map(([categoria, value]) => ({
          name: getNomeCategoria(categoria),
          value: value as number,
          color: getCorCategoria(categoria)
        }));

      setPieChartData(pieData);
      
      console.log('Dados processados com sucesso:', {
        registrosGeral: dadosGeral.length,
        diasComVendas: resultadosGeral.vendas.size,
        totalGeral: categoryTotals.geral
      });
      
    } catch (error) {
      console.error('Erro ao gerar dados dos gráficos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetasComparison = async () => {
    if (!dataInicio || !dataFim) return;
    
    // MODIFICAÇÃO: Só buscar metas se for uma loja específica
    if (canViewAllStores && !selectedLojaId) {
      console.log('Pulando comparação de metas para "todas as lojas"');
      setMetasData([]);
      return;
    }

    try {
      // Como não temos mais o período selecionado, vamos desabilitar a comparação de metas
      // que requer um periodo_meta_id específico
      console.log('Comparação de metas desabilitada nesta visualização');
      setMetasData([]);
      
    } catch (error) {
      console.error('Erro ao buscar comparação de metas:', error);
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

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="page-container space-y-4 sm:space-y-6 bg-background min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart className="w-6 h-6" />
            {canViewAllStores && !selectedLojaId 
              ? 'Gráficos - Todas as Lojas' 
              : lojaInfo 
                ? `Gráficos - ${lojaInfo.numero} - ${lojaInfo.nome.toUpperCase()}`
                : currentLojaId
                  ? `Gráficos - Loja ${currentLojaId}`
                  : 'Gráficos'
            }
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Visualize dados de vendas em diferentes formatos
            {lojaInfo?.regiao === 'centro' && (
              <span className="block text-xs text-amber-600 mt-1 font-medium">
                Lojas da região Centro não abrem aos domingos
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {canViewAllStores && (
            <StoreSelector 
              selectedLojaId={selectedLojaId} 
              onLojaChange={setSelectedLojaId} 
              userLojaId={user.loja_id} 
            />
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dataInicio">Data Início</Label>
              <Input
                id="dataInicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
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
                  fetchChartData();
                  fetchMetasComparison();
                }}
                className="w-full"
              >
                Atualizar Gráficos
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2">Carregando gráficos...</span>
        </div>
      ) : (
        <>
          {/* Gráfico Multi-Linha */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Evolução Multi-Linha - Todas as Categorias
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={12} tick={{ fontSize: 10 }} />
                    <YAxis fontSize={12} tick={{ fontSize: 10 }} tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, getNomeCategoria(name)]}
                      labelFormatter={(label) => `Data: ${label}`}
                    />
                    <Legend formatter={(value) => getNomeCategoria(value)} />
                    <Line type="monotone" dataKey="geral" stroke="hsl(221, 83%, 53%)" strokeWidth={3} dot={{ r: 3 }} name="geral" />
                    <Line type="monotone" dataKey="goodlife" stroke="hsl(142, 76%, 36%)" strokeWidth={2} dot={{ r: 2 }} name="goodlife" />
                    <Line type="monotone" dataKey="perfumaria_r_mais" stroke="hsl(262, 83%, 58%)" strokeWidth={2} dot={{ r: 2 }} name="perfumaria_r_mais" />
                    <Line type="monotone" dataKey="conveniencia_r_mais" stroke="hsl(32, 95%, 44%)" strokeWidth={2} dot={{ r: 2 }} name="conveniencia_r_mais" />
                    <Line type="monotone" dataKey="r_mais" stroke="hsl(0, 84%, 60%)" strokeWidth={2} dot={{ r: 2 }} name="r_mais" />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Gráficos Individuais por Indicador */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Evolução Individual por Indicador
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Venda Geral */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[hsl(221,83%,53%)]">
                    <TrendingUp className="w-4 h-4" />
                    Venda Geral
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsAreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={12} tick={{ fontSize: 10 }} />
                        <YAxis fontSize={12} tick={{ fontSize: 10 }} tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
                        <Tooltip formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Venda Geral']} labelFormatter={(label) => `Data: ${label}`} />
                        <Area type="monotone" dataKey="geral" stroke="hsl(221, 83%, 53%)" fill="hsl(221, 83%, 53%)" fillOpacity={0.3} />
                      </RechartsAreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* R+ Mais */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[hsl(0,84%,60%)]">
                    <TrendingUp className="w-4 h-4" />
                    R+ Mais
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsAreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={12} tick={{ fontSize: 10 }} />
                        <YAxis fontSize={12} tick={{ fontSize: 10 }} tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
                        <Tooltip formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'R+ Mais']} labelFormatter={(label) => `Data: ${label}`} />
                        <Area type="monotone" dataKey="r_mais" stroke="hsl(0, 84%, 60%)" fill="hsl(0, 84%, 60%)" fillOpacity={0.3} />
                      </RechartsAreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Perfumaria R+ Mais */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[hsl(262,83%,58%)]">
                    <TrendingUp className="w-4 h-4" />
                    Perfumaria R+ Mais
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsAreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={12} tick={{ fontSize: 10 }} />
                        <YAxis fontSize={12} tick={{ fontSize: 10 }} tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
                        <Tooltip formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Perfumaria R+ Mais']} labelFormatter={(label) => `Data: ${label}`} />
                        <Area type="monotone" dataKey="perfumaria_r_mais" stroke="hsl(262, 83%, 58%)" fill="hsl(262, 83%, 58%)" fillOpacity={0.3} />
                      </RechartsAreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Conveniência R+ Mais */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[hsl(32,95%,44%)]">
                    <TrendingUp className="w-4 h-4" />
                    Conveniência R+ Mais
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsAreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={12} tick={{ fontSize: 10 }} />
                        <YAxis fontSize={12} tick={{ fontSize: 10 }} tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
                        <Tooltip formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Conveniência R+ Mais']} labelFormatter={(label) => `Data: ${label}`} />
                        <Area type="monotone" dataKey="conveniencia_r_mais" stroke="hsl(32, 95%, 44%)" fill="hsl(32, 95%, 44%)" fillOpacity={0.3} />
                      </RechartsAreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Goodlife */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[hsl(142,76%,36%)]">
                    <TrendingUp className="w-4 h-4" />
                    Goodlife
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsAreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={12} tick={{ fontSize: 10 }} />
                        <YAxis fontSize={12} tick={{ fontSize: 10 }} tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
                        <Tooltip formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Goodlife']} labelFormatter={(label) => `Data: ${label}`} />
                        <Area type="monotone" dataKey="goodlife" stroke="hsl(142, 76%, 36%)" fill="hsl(142, 76%, 36%)" fillOpacity={0.3} />
                      </RechartsAreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Demais Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  Distribuição por Categoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Total']} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Ticket Médio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsAreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} tick={{ fontSize: 10 }} />
                      <YAxis fontSize={12} tick={{ fontSize: 10 }} tickFormatter={(value) => `R$ ${value.toFixed(2)}`} />
                      <Tooltip formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Ticket Médio']} labelFormatter={(label) => `Data: ${label}`} />
                      <Area type="monotone" dataKey="ticketMedio" stroke="hsl(32, 95%, 44%)" fill="hsl(32, 95%, 44%)" fillOpacity={0.3} />
                    </RechartsAreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Quantidade de Clientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} tick={{ fontSize: 10 }} />
                      <YAxis fontSize={12} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value: number) => [value, 'Clientes']} labelFormatter={(label) => `Data: ${label}`} />
                      <Bar dataKey="clientes" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart className="w-5 h-5" />
                  Metas vs Realizado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={metasData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="categoria" fontSize={12} tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                      <YAxis fontSize={12} tick={{ fontSize: 10 }} tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
                      <Tooltip formatter={(value: number, name: string) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, name === 'meta' ? 'Meta' : 'Realizado']} />
                      <Legend />
                      <Bar dataKey="meta" fill="hsl(0, 0%, 60%)" radius={[4, 4, 0, 0]} name="Meta" />
                      <Bar dataKey="realizado" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} name="Realizado" />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}