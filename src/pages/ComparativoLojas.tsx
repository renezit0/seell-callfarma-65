import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useCallfarmaAPI } from '@/hooks/useCallfarmaAPI';
import { usePeriodoAtual } from '@/hooks/usePeriodoAtual';
import { Navigate, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { 
  BarChart, 
  LineChart, 
  TrendingUp, 
  Store, 
  Users, 
  ArrowLeft,
  Trophy,
  Target,
  DollarSign,
  Percent
} from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell,
  PieChart,
  Pie
} from 'recharts';

interface LojaData {
  id: number;
  nome: string;
  numero: string;
  regiao: string;
}

interface VendedorDestaque {
  nome: string;
  loja: string;
  total_rentaveis: number;
  total_goodlife: number;
  total_geral: number;
}

interface ComparativoData {
  loja: string;
  faturamento: number;
  rentaveis: number;
  goodlife: number;
  perfumaria: number;
  conveniencia: number;
  percentualRentaveis: number;
  meta: number;
  atingimentoMeta: number;
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function ComparativoLojas() {
  const navigate = useNavigate();
  const periodoAtual = usePeriodoAtual();
  const { user, loading: authLoading } = useAuth();
  const { buscarVendasFuncionarios } = useCallfarmaAPI();
  const { toast } = useToast();
  
  const [lojas, setLojas] = useState<LojaData[]>([]);
  const [selectedLojas, setSelectedLojas] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataInicio, setDataInicio] = useState(periodoAtual.data_inicio);
  const [dataFim, setDataFim] = useState(periodoAtual.data_fim);
  const [comparativoData, setComparativoData] = useState<ComparativoData[]>([]);
  const [vendedoresDestaque, setVendedoresDestaque] = useState<VendedorDestaque[]>([]);
  const [metasLojas, setMetasLojas] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    if (user) {
      carregarLojas();
      carregarMetas();
    }
  }, [user]);

  const carregarLojas = async () => {
    try {
      const { data, error } = await supabase
        .from('lojas')
        .select('id, nome, numero, regiao')
        .order('nome');

      if (error) throw error;
      setLojas(data || []);
      
      // Selecionar primeiras 5 lojas por padrão
      if (data && data.length > 0) {
        setSelectedLojas(data.slice(0, Math.min(5, data.length)).map(l => l.id));
      }
    } catch (error) {
      console.error('Erro ao carregar lojas:', error);
    }
  };

  const carregarMetas = async () => {
    try {
      const { data: periodosData } = await supabase
        .from('periodos_meta')
        .select('id')
        .gte('data_fim', dataInicio)
        .lte('data_inicio', dataFim)
        .single();

      if (periodosData) {
        const { data: metasData } = await supabase
          .from('metas_loja')
          .select('loja_id, meta_valor_total')
          .eq('periodo_meta_id', periodosData.id);

        if (metasData) {
          const metasMap = new Map(metasData.map(m => [m.loja_id, m.meta_valor_total]));
          setMetasLojas(metasMap);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar metas:', error);
    }
  };

  const buscarComparativos = async () => {
    if (selectedLojas.length === 0) return;

    try {
      setLoading(true);
      console.log('🔍 Buscando comparativos para', selectedLojas.length, 'lojas...');

      const promises = selectedLojas.map(async (lojaId) => {
        const loja = lojas.find(l => l.id === lojaId);
        if (!loja) return null;

        // Buscar vendas da loja via API - com tratamento de erro
        // Como a API busca todas as lojas, vamos filtrar localmente
        const cdfil = parseInt(loja.numero);
        const filtrarPorLoja = (vendas: any[]) => vendas.filter(v => v.CDFIL === cdfil);

        // Função auxiliar para buscar com retry em caso de timeout
        const buscarComRetry = async (filtros: any, tentativas = 2) => {
          for (let i = 0; i < tentativas; i++) {
            try {
              const resultado = await buscarVendasFuncionarios(filtros);
              return resultado || [];
            } catch (error) {
              console.warn(`Tentativa ${i + 1} falhou para`, filtros, error);
              if (i === tentativas - 1) {
                return []; // Retorna array vazio na última tentativa
              }
              // Aguardar 1 segundo antes de tentar novamente
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          return [];
        };

        // Buscar cada categoria separadamente com retry
        const [vendasRentaveis, vendasGoodlife, vendasPerfumaria, vendasConveniencia] = await Promise.all([
          buscarComRetry({
            dataInicio,
            dataFim,
            filtroGrupos: '20,25'
          }),
          buscarComRetry({
            dataInicio,
            dataFim,
            filtroGrupos: '22'
          }),
          buscarComRetry({
            dataInicio,
            dataFim,
            filtroGrupos: '46'
          }),
          buscarComRetry({
            dataInicio,
            dataFim,
            filtroGrupos: '36,13'
          })
        ]);

        // Calcular totais por categoria
        const rentaveis = filtrarPorLoja(vendasRentaveis).reduce((sum, v) => sum + (v.TOTAL_VALOR || 0), 0);
        const goodlife = filtrarPorLoja(vendasGoodlife).reduce((sum, v) => sum + (v.TOTAL_VALOR || 0), 0);
        const perfumaria = filtrarPorLoja(vendasPerfumaria).reduce((sum, v) => sum + (v.TOTAL_VALOR || 0), 0);
        const conveniencia = filtrarPorLoja(vendasConveniencia).reduce((sum, v) => sum + (v.TOTAL_VALOR || 0), 0);
        
        // Faturamento = soma de todas as categorias
        const faturamento = rentaveis + goodlife + perfumaria + conveniencia;

        const meta = metasLojas.get(lojaId) || 0;
        const atingimentoMeta = meta > 0 ? (faturamento / meta) * 100 : 0;
        const percentualRentaveis = faturamento > 0 ? (rentaveis / faturamento) * 100 : 0;

        return {
          loja: loja.nome,
          faturamento,
          rentaveis,
          goodlife,
          perfumaria,
          conveniencia,
          percentualRentaveis,
          meta,
          atingimentoMeta
        };
      });

      const resultados = (await Promise.all(promises)).filter(Boolean) as ComparativoData[];
      setComparativoData(resultados);

      // Buscar vendedores destaque
      await buscarVendedoresDestaque();

    } catch (error) {
      console.error('Erro ao buscar comparativos:', error);
      toast({
        title: "Erro ao buscar dados",
        description: "Alguns dados podem não ter sido carregados devido a timeout na API externa. Tente novamente ou reduza o número de lojas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const buscarVendedoresDestaque = async () => {
    try {
      const promises = selectedLojas.map(async (lojaId) => {
        const loja = lojas.find(l => l.id === lojaId);
        if (!loja) return [];

        // Filtrar por loja usando o CDFIL
        const cdfil = parseInt(loja.numero);
        const filtrarPorLoja = (vendas: any[]) => vendas.filter(v => v.CDFIL === cdfil);

        // Função auxiliar para buscar com retry
        const buscarComRetry = async (filtros: any, tentativas = 2) => {
          for (let i = 0; i < tentativas; i++) {
            try {
              const resultado = await buscarVendasFuncionarios(filtros);
              return resultado || [];
            } catch (error) {
              console.warn(`Tentativa ${i + 1} falhou para vendedores`, filtros, error);
              if (i === tentativas - 1) {
                return []; // Retorna array vazio na última tentativa
              }
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          return [];
        };

        const [vendasRentaveis, vendasGoodlife] = await Promise.all([
          buscarComRetry({
            dataInicio,
            dataFim,
            filtroGrupos: '20,25',
            groupBy: 'scefun.CDFUN,scefun.NOME'
          }),
          buscarComRetry({
            dataInicio,
            dataFim,
            filtroGrupos: '22',
            groupBy: 'scefun.CDFUN,scefun.NOME'
          })
        ]);

        const funcionariosMap = new Map<string, VendedorDestaque>();

        filtrarPorLoja(vendasRentaveis).forEach(v => {
          const key = `${v.CDFUN}-${v.NOME}`;
          if (!funcionariosMap.has(key)) {
            funcionariosMap.set(key, {
              nome: v.NOME,
              loja: loja.nome,
              total_rentaveis: 0,
              total_goodlife: 0,
              total_geral: 0
            });
          }
          const func = funcionariosMap.get(key)!;
          func.total_rentaveis += v.TOTAL_VALOR || 0;
          func.total_geral += v.TOTAL_VALOR || 0;
        });

        filtrarPorLoja(vendasGoodlife).forEach(v => {
          const key = `${v.CDFUN}-${v.NOME}`;
          if (!funcionariosMap.has(key)) {
            funcionariosMap.set(key, {
              nome: v.NOME,
              loja: loja.nome,
              total_rentaveis: 0,
              total_goodlife: 0,
              total_geral: 0
            });
          }
          const func = funcionariosMap.get(key)!;
          func.total_goodlife += v.TOTAL_VALOR || 0;
          func.total_geral += v.TOTAL_VALOR || 0;
        });

        return Array.from(funcionariosMap.values())
          .sort((a, b) => b.total_geral - a.total_geral)
          .slice(0, 3);
      });

      const resultados = (await Promise.all(promises)).flat();
      setVendedoresDestaque(resultados.sort((a, b) => b.total_geral - a.total_geral).slice(0, 10));

    } catch (error) {
      console.error('Erro ao buscar vendedores destaque:', error);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !['admin', 'supervisor'].includes(user.tipo || '')) {
    return <Navigate to="/rankings" replace />;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const totalFaturamento = comparativoData.reduce((sum, d) => sum + d.faturamento, 0);
  const mediaAtingimento = comparativoData.length > 0 
    ? comparativoData.reduce((sum, d) => sum + d.atingimentoMeta, 0) / comparativoData.length 
    : 0;

  return (
    <div className="page-container space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/rankings')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <BarChart className="w-7 h-7" />
              Comparativo entre Lojas
            </h1>
            <p className="text-sm text-muted-foreground">
              Análise visual de performance e rankings de vendedores
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Filtros de Comparação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Data Início</Label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            <div>
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
            <div>
              <Label>Lojas ({selectedLojas.length} selecionadas)</Label>
              <Select
                value={selectedLojas.length > 0 ? "multiple" : ""}
                onValueChange={(value) => {
                  if (value === "all") {
                    setSelectedLojas(lojas.map(l => l.id));
                  } else if (value === "none") {
                    setSelectedLojas([]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar lojas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Selecionar Todas</SelectItem>
                  <SelectItem value="none">Limpar Seleção</SelectItem>
                  {lojas.map((loja) => (
                    <div
                      key={loja.id}
                      className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent"
                      onClick={() => {
                        setSelectedLojas(prev =>
                          prev.includes(loja.id)
                            ? prev.filter(id => id !== loja.id)
                            : [...prev, loja.id]
                        );
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedLojas.includes(loja.id)}
                        onChange={() => {}}
                        className="cursor-pointer"
                      />
                      <span className="text-sm">{loja.nome}</span>
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={buscarComparativos} 
            disabled={loading || selectedLojas.length === 0}
            className="w-full sm:w-auto"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            {loading ? 'Carregando...' : 'Gerar Comparativos'}
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : comparativoData.length > 0 ? (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 border-violet-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Faturamento Total</p>
                    <p className="text-2xl font-bold text-foreground">{formatCurrency(totalFaturamento)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-violet-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border-cyan-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Lojas Analisadas</p>
                    <p className="text-2xl font-bold text-foreground">{comparativoData.length}</p>
                  </div>
                  <Store className="h-8 w-8 text-cyan-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Média Atingimento</p>
                    <p className="text-2xl font-bold text-foreground">{formatPercent(mediaAtingimento)}</p>
                  </div>
                  <Target className="h-8 w-8 text-emerald-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Vendedores Destaque</p>
                    <p className="text-2xl font-bold text-foreground">{vendedoresDestaque.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico: Faturamento vs Rentáveis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart className="h-5 w-5" />
                Faturamento vs Rentáveis por Loja
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={comparativoData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="loja" angle={-45} textAnchor="end" height={100} />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="faturamento" fill="#8b5cf6" name="Faturamento" />
                  <Bar yAxisId="left" dataKey="rentaveis" fill="#06b6d4" name="Rentáveis" />
                  <Line yAxisId="right" type="monotone" dataKey="percentualRentaveis" stroke="#10b981" name="% Rentáveis" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gráficos em Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Atingimento de Metas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Atingimento de Metas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={comparativoData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="loja" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip formatter={(value: number, name: string) => 
                      name === "atingimentoMeta" ? formatPercent(value) : formatCurrency(value)
                    } />
                    <Legend />
                    <Bar dataKey="meta" fill="#94a3b8" name="Meta" />
                    <Bar dataKey="faturamento" fill="#8b5cf6" name="Realizado" />
                    <Line type="monotone" dataKey="atingimentoMeta" stroke="#10b981" name="% Atingimento" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Distribuição por Categoria */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Vendas por Categoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={comparativoData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="loja" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="rentaveis" stackId="a" fill="#06b6d4" name="Rentáveis" />
                    <Bar dataKey="goodlife" stackId="a" fill="#10b981" name="GoodLife" />
                    <Bar dataKey="perfumaria" stackId="a" fill="#f59e0b" name="Perfumaria" />
                    <Bar dataKey="conveniencia" stackId="a" fill="#ef4444" name="Conveniência" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Performance Radar */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Performance Relativa por Loja
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={comparativoData.map(d => ({
                  loja: d.loja,
                  Faturamento: (d.faturamento / Math.max(...comparativoData.map(x => x.faturamento))) * 100,
                  Rentáveis: d.percentualRentaveis,
                  'Ating. Meta': d.atingimentoMeta > 100 ? 100 : d.atingimentoMeta,
                  GoodLife: (d.goodlife / Math.max(...comparativoData.map(x => x.goodlife))) * 100,
                  Perfumaria: (d.perfumaria / Math.max(...comparativoData.map(x => x.perfumaria))) * 100
                }))}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="loja" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar name="Performance" dataKey="Faturamento" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                  <Radar name="Rentáveis %" dataKey="Rentáveis" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.3} />
                  <Radar name="Meta %" dataKey="Ating. Meta" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Vendedores */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Top 10 Vendedores do Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {vendedoresDestaque.map((vendedor, index) => (
                  <div
                    key={`${vendedor.nome}-${vendedor.loja}`}
                    className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-center min-w-[40px]">
                      {index < 3 ? (
                        <Trophy className={`h-6 w-6 ${
                          index === 0 ? 'text-yellow-500' : 
                          index === 1 ? 'text-gray-400' : 
                          'text-amber-600'
                        }`} />
                      ) : (
                        <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-foreground">{vendedor.nome}</div>
                      <div className="text-sm text-muted-foreground">{vendedor.loja}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-foreground">{formatCurrency(vendedor.total_geral)}</div>
                      <div className="text-xs text-muted-foreground">
                        R: {formatCurrency(vendedor.total_rentaveis)} | 
                        G: {formatCurrency(vendedor.total_goodlife)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <BarChart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhum dado disponível
            </h3>
            <p className="text-muted-foreground">
              Selecione as lojas e clique em "Gerar Comparativos" para visualizar os dados.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
