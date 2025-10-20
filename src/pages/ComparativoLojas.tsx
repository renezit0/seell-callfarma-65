import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useCallfarmaAPI } from "@/hooks/useCallfarmaAPI";
import { usePeriodoAtual } from "@/hooks/usePeriodoAtual";
import { Navigate, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
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
  Percent,
} from "lucide-react";
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
} from "recharts";

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
  lojaNumero: string;
  faturamento: number;
  rentaveis: number;
  goodlife: number;
  perfumaria: number;
  conveniencia: number;
  percentualRentaveis: number;
  meta: number;
  atingimentoMeta: number;
}

interface ParticipacaoFuncionario {
  nome: string;
  loja: string;
  valor_rentaveis: number;
  percentual: number;
}

export default function ComparativoLojas() {
  const navigate = useNavigate();
  const periodoAtual = usePeriodoAtual();
  const { user, loading: authLoading } = useAuth();
  const callfarmaAPI = useCallfarmaAPI();
  const { toast } = useToast();

  const [lojas, setLojas] = useState<LojaData[]>([]);
  const [selectedLojas, setSelectedLojas] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataInicio, setDataInicio] = useState(periodoAtual.data_inicio);
  const [dataFim, setDataFim] = useState(periodoAtual.data_fim);
  const [comparativoData, setComparativoData] = useState<ComparativoData[]>([]);
  const [vendedoresDestaque, setVendedoresDestaque] = useState<VendedorDestaque[]>([]);
  const [participacaoFuncionarios, setParticipacaoFuncionarios] = useState<ParticipacaoFuncionario[]>([]);
  const [metasLojas, setMetasLojas] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    if (user) {
      carregarLojas();
      carregarMetas();
    }
  }, [user]);

  const carregarLojas = async () => {
    try {
      const { data, error } = await supabase.from("lojas").select("id, nome, numero, regiao").order("nome");

      if (error) throw error;

      // Filtrar loja OUTRA (ANÁLISE)
      const lojasFiltradas = (data || []).filter(
        (loja) => !loja.nome.toUpperCase().includes("OUTRA") && !loja.nome.toUpperCase().includes("ANÁLISE"),
      );

      setLojas(lojasFiltradas);

      if (lojasFiltradas.length > 0) {
        setSelectedLojas(lojasFiltradas.slice(0, Math.min(5, lojasFiltradas.length)).map((l) => l.id));
      }
    } catch (error) {
      console.error("Erro ao carregar lojas:", error);
    }
  };

  const carregarMetas = async () => {
    try {
      const { data: periodosData } = await supabase
        .from("periodos_meta")
        .select("id")
        .gte("data_fim", dataInicio)
        .lte("data_inicio", dataFim)
        .single();

      if (periodosData) {
        const { data: metasData } = await supabase
          .from("metas_loja")
          .select("loja_id, meta_valor_total")
          .eq("periodo_meta_id", periodosData.id);

        if (metasData) {
          const metasMap = new Map(metasData.map((m) => [m.loja_id, m.meta_valor_total]));
          setMetasLojas(metasMap);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar metas:", error);
    }
  };

  const buscarComparativos = async () => {
    if (selectedLojas.length === 0) return;

    try {
      setLoading(true);
      console.log("🔍 Buscando comparativos para", selectedLojas.length, "lojas...");

      // OTIMIZAÇÃO: Buscar dados de TODAS as lojas de uma vez e filtrar no frontend
      // Isso reduz de ~40 chamadas para apenas 7 chamadas!

      console.log("⚡ Buscando vendas gerais...");
      const [vendasGeral, vendasRentaveis, vendasGoodlife, vendasPerfumaria, vendasConveniencia] = await Promise.all([
        callfarmaAPI.buscarVendasFuncionarios({
          dataInicio,
          dataFim,
          groupBy: "scefilial.CDFIL",
        }),
        callfarmaAPI.buscarVendasFuncionarios({
          dataInicio,
          dataFim,
          filtroGrupos: "20,25",
          groupBy: "scefilial.CDFIL",
        }),
        callfarmaAPI.buscarVendasFuncionarios({
          dataInicio,
          dataFim,
          filtroGrupos: "22",
          groupBy: "scefilial.CDFIL",
        }),
        callfarmaAPI.buscarVendasFuncionarios({
          dataInicio,
          dataFim,
          filtroGrupos: "46",
          groupBy: "scefilial.CDFIL",
        }),
        callfarmaAPI.buscarVendasFuncionarios({
          dataInicio,
          dataFim,
          filtroGrupos: "36,13",
          groupBy: "scefilial.CDFIL",
        }),
      ]);

      console.log("⚡ Processando dados das lojas...");
      const resultados = selectedLojas
        .map((lojaId) => {
          const loja = lojas.find((l) => l.id === lojaId);
          if (!loja) return null;

          const cdfil = parseInt(loja.numero);

          const filtrarPorLoja = (vendas: any[]) =>
            vendas.filter((v) => v.CDFIL === cdfil && v.NOMEFIL && !v.NOMEFIL.includes("OUTRA"));

          const faturamento = filtrarPorLoja(vendasGeral).reduce((sum, v) => sum + (v.TOTAL_VALOR || 0), 0);
          const rentaveis = filtrarPorLoja(vendasRentaveis).reduce((sum, v) => sum + (v.TOTAL_VALOR || 0), 0);
          const goodlife = filtrarPorLoja(vendasGoodlife).reduce((sum, v) => sum + (v.TOTAL_VALOR || 0), 0);
          const perfumaria = filtrarPorLoja(vendasPerfumaria).reduce((sum, v) => sum + (v.TOTAL_VALOR || 0), 0);
          const conveniencia = filtrarPorLoja(vendasConveniencia).reduce((sum, v) => sum + (v.TOTAL_VALOR || 0), 0);

          const meta = metasLojas.get(lojaId) || 0;
          const atingimentoMeta = meta > 0 ? (faturamento / meta) * 100 : 0;
          const percentualRentaveis = faturamento > 0 ? (rentaveis / faturamento) * 100 : 0;

          return {
            loja: loja.nome,
            lojaNumero: loja.numero,
            faturamento,
            rentaveis,
            goodlife,
            perfumaria,
            conveniencia,
            percentualRentaveis,
            meta,
            atingimentoMeta,
          };
        })
        .filter(Boolean) as ComparativoData[];

      setComparativoData(resultados);

      console.log("⚡ Buscando vendedores e participação...");
      await Promise.all([buscarVendedoresDestaque(), buscarParticipacaoFuncionarios()]);

      console.log("✅ Dados carregados com sucesso!");
    } catch (error) {
      console.error("Erro ao buscar comparativos:", error);
      toast({
        title: "Erro ao buscar dados",
        description: "Alguns dados podem não ter sido carregados. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const buscarVendedoresDestaque = async () => {
    try {
      // OTIMIZAÇÃO: Buscar vendas de funcionários de TODAS as lojas de uma vez
      const [vendasRentaveis, vendasGoodlife] = await Promise.all([
        callfarmaAPI.buscarVendasFuncionarios({
          dataInicio,
          dataFim,
          filtroGrupos: "20,25",
          groupBy: "scefilial.CDFIL,scefun.CDFUN",
        }),
        callfarmaAPI.buscarVendasFuncionarios({
          dataInicio,
          dataFim,
          filtroGrupos: "22",
          groupBy: "scefilial.CDFIL,scefun.CDFUN",
        }),
      ]);

      const funcionariosMap = new Map<string, VendedorDestaque>();

      selectedLojas.forEach((lojaId) => {
        const loja = lojas.find((l) => l.id === lojaId);
        if (!loja) return;

        const cdfil = parseInt(loja.numero);
        const filtrarPorLoja = (vendas: any[]) =>
          vendas.filter(
            (v) => v.CDFIL === cdfil && v.NOME && !v.NOME.includes("OUTRA") && !v.NOME.includes("ESPONTANEA"),
          );

        filtrarPorLoja(vendasRentaveis || []).forEach((v) => {
          const key = `${v.CDFUN}-${v.CDFIL}`;
          if (!funcionariosMap.has(key)) {
            funcionariosMap.set(key, {
              nome: v.NOME,
              loja: loja.nome,
              total_rentaveis: 0,
              total_goodlife: 0,
              total_geral: 0,
            });
          }
          const func = funcionariosMap.get(key)!;
          func.total_rentaveis += v.TOTAL_VALOR || 0;
          func.total_geral += v.TOTAL_VALOR || 0;
        });

        filtrarPorLoja(vendasGoodlife || []).forEach((v) => {
          const key = `${v.CDFUN}-${v.CDFIL}`;
          if (!funcionariosMap.has(key)) {
            funcionariosMap.set(key, {
              nome: v.NOME,
              loja: loja.nome,
              total_rentaveis: 0,
              total_goodlife: 0,
              total_geral: 0,
            });
          }
          const func = funcionariosMap.get(key)!;
          func.total_goodlife += v.TOTAL_VALOR || 0;
          func.total_geral += v.TOTAL_VALOR || 0;
        });
      });

      const todosVendedores = Array.from(funcionariosMap.values());
      const top10 = todosVendedores.sort((a, b) => b.total_rentaveis - a.total_rentaveis).slice(0, 10);

      setVendedoresDestaque(top10);
    } catch (error) {
      console.error("Erro ao buscar vendedores destaque:", error);
    }
  };

  const buscarParticipacaoFuncionarios = async () => {
    try {
      // OTIMIZAÇÃO: Buscar vendas de funcionários de TODAS as lojas de uma vez
      const vendasRentaveis = await callfarmaAPI.buscarVendasFuncionarios({
        dataInicio,
        dataFim,
        filtroGrupos: "20,25",
        groupBy: "scefilial.CDFIL,scefun.CDFUN",
        orderBy: "TOTAL_VLR_VE desc",
      });

      const todasParticipacoes: ParticipacaoFuncionario[] = [];

      selectedLojas.forEach((lojaId) => {
        const loja = lojas.find((l) => l.id === lojaId);
        if (!loja) return;

        const cdfil = parseInt(loja.numero);
        const filtrarPorLoja = (vendas: any[]) =>
          vendas.filter(
            (v) => v.CDFIL === cdfil && v.NOME && !v.NOME.includes("OUTRA") && !v.NOME.includes("ESPONTANEA"),
          );

        const vendasFiltradas = filtrarPorLoja(vendasRentaveis || []);
        const totalRentaveisLoja = vendasFiltradas.reduce((sum, v) => sum + (v.TOTAL_VALOR || 0), 0);

        vendasFiltradas.forEach((v) => {
          todasParticipacoes.push({
            nome: v.NOME,
            loja: loja.nome,
            valor_rentaveis: v.TOTAL_VALOR || 0,
            percentual: totalRentaveisLoja > 0 ? ((v.TOTAL_VALOR || 0) / totalRentaveisLoja) * 100 : 0,
          });
        });
      });

      setParticipacaoFuncionarios(todasParticipacoes);
    } catch (error) {
      console.error("Erro ao buscar participação de funcionários:", error);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !["admin", "supervisor"].includes(user.tipo || "")) {
    return <Navigate to="/rankings" replace />;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const totalFaturamento = comparativoData.reduce((sum, d) => sum + d.faturamento, 0);
  const mediaAtingimento =
    comparativoData.length > 0
      ? comparativoData.reduce((sum, d) => sum + d.atingimentoMeta, 0) / comparativoData.length
      : 0;

  return (
    <div className="page-container space-y-6 bg-background min-h-screen p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/rankings")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <BarChart className="w-7 h-7" />
              Comparativo entre Lojas
            </h1>
            <p className="text-sm text-muted-foreground">Análise visual de performance e participação de vendedores</p>
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
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div>
              <Label>Data Fim</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
            <div>
              <Label>Lojas ({selectedLojas.length} selecionadas)</Label>
              <Select
                value={selectedLojas.length > 0 ? "multiple" : ""}
                onValueChange={(value) => {
                  if (value === "all") {
                    setSelectedLojas(lojas.map((l) => l.id));
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
                        setSelectedLojas((prev) =>
                          prev.includes(loja.id) ? prev.filter((id) => id !== loja.id) : [...prev, loja.id],
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
            {loading ? "Carregando..." : "Gerar Comparativos"}
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
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Faturamento Total</p>
                    <p className="text-2xl font-bold text-foreground">{formatCurrency(totalFaturamento)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-chart-2/10 to-chart-2/5 border-chart-2/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Lojas Analisadas</p>
                    <p className="text-2xl font-bold text-foreground">{comparativoData.length}</p>
                  </div>
                  <Store className="h-8 w-8 text-chart-2" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-chart-3/10 to-chart-3/5 border-chart-3/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Média Atingimento</p>
                    <p className="text-2xl font-bold text-foreground">{formatPercent(mediaAtingimento)}</p>
                  </div>
                  <Target className="h-8 w-8 text-chart-3" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-chart-4/10 to-chart-4/5 border-chart-4/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Vendedores Destaque</p>
                    <p className="text-2xl font-bold text-foreground">{vendedoresDestaque.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-chart-4" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Faturamento vs Rentáveis */}
          <Card className="col-span-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart className="h-5 w-5" />
                Faturamento GERAL vs Rentáveis por Loja
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={comparativoData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="loja" angle={-45} textAnchor="end" height={100} className="text-xs" />
                  <YAxis yAxisId="left" className="text-xs" />
                  <YAxis yAxisId="right" orientation="right" className="text-xs" />
                  <Tooltip
                    formatter={(value: any) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="faturamento" fill="#8b5cf6" name="Faturamento GERAL" />
                  <Bar yAxisId="left" dataKey="rentaveis" fill="#10b981" name="Rentáveis" />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="percentualRentaveis"
                    stroke="#f59e0b"
                    name="% Rentáveis"
                    strokeWidth={2}
                  />
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
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="loja" angle={-45} textAnchor="end" height={80} className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      formatter={(value: number, name: string) =>
                        name === "atingimentoMeta" ? formatPercent(value) : formatCurrency(value)
                      }
                    />
                    <Legend />
                    <Bar dataKey="meta" fill="#94a3b8" name="Meta" />
                    <Bar dataKey="faturamento" fill="#8b5cf6" name="Realizado" />
                    <Line
                      type="monotone"
                      dataKey="atingimentoMeta"
                      stroke="#f59e0b"
                      name="% Atingimento"
                      strokeWidth={2}
                    />
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
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="loja" angle={-45} textAnchor="end" height={80} className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="rentaveis" stackId="a" fill="#10b981" name="Rentáveis" />
                    <Bar dataKey="goodlife" stackId="a" fill="#f59e0b" name="GoodLife" />
                    <Bar dataKey="perfumaria" stackId="a" fill="#ec4899" name="Perfumaria" />
                    <Bar dataKey="conveniencia" stackId="a" fill="#06b6d4" name="Conveniência" />
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
                <RadarChart
                  data={comparativoData.map((d) => ({
                    loja: d.loja,
                    Faturamento: (d.faturamento / Math.max(...comparativoData.map((x) => x.faturamento))) * 100,
                    Rentáveis: d.percentualRentaveis,
                    "Ating. Meta": d.atingimentoMeta > 100 ? 100 : d.atingimentoMeta,
                    GoodLife: (d.goodlife / Math.max(...comparativoData.map((x) => x.goodlife))) * 100,
                    Perfumaria: (d.perfumaria / Math.max(...comparativoData.map((x) => x.perfumaria))) * 100,
                  }))}
                >
                  <PolarGrid />
                  <PolarAngleAxis dataKey="loja" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar name="Performance" dataKey="Faturamento" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                  <Radar name="Rentáveis %" dataKey="Rentáveis" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                  <Radar name="Meta %" dataKey="Ating. Meta" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top 10 Vendedores e Participação */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 10 Vendedores */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Top 10 Vendedores em Rentáveis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {vendedoresDestaque.slice(0, 10).map((vendedor, index) => (
                    <div
                      key={`${vendedor.nome}-${vendedor.loja}`}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div
                        className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${
                          index === 0
                            ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-lg"
                            : index === 1
                              ? "bg-gradient-to-br from-gray-300 to-gray-500 text-white shadow-md"
                              : index === 2
                                ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-md"
                                : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        <span>{index + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{vendedor.nome}</p>
                        <p className="text-xs text-muted-foreground">{vendedor.loja}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">{formatCurrency(vendedor.total_rentaveis)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Participação Individual nos Rentáveis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-chart-2" />
                  Participação nos Rentáveis por Loja
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {comparativoData.map((loja) => {
                    const funcionariosLoja = participacaoFuncionarios
                      .filter((f) => f.loja === loja.loja)
                      .sort((a, b) => b.percentual - a.percentual)
                      .slice(0, 5);

                    return (
                      <div key={loja.loja} className="space-y-2">
                        <h4 className="font-semibold text-sm">{loja.loja}</h4>
                        <div className="space-y-1">
                          {funcionariosLoja.map((func, idx) => (
                            <div key={`${func.nome}-${idx}`} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground truncate max-w-[150px]">{func.nome}</span>
                                <span className="font-medium">{func.percentual.toFixed(1)}%</span>
                              </div>
                              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-chart-2 to-chart-3 transition-all"
                                  style={{ width: `${func.percentual}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Participações por Loja - DESTAQUE */}
          <Card className="col-span-full bg-gradient-to-br from-primary/5 via-chart-2/5 to-chart-3/5 border-2 border-primary/20">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-chart-2/10 border-b border-primary/20">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg shadow-lg">
                  <Trophy className="h-6 w-6 text-white" />
                </div>
                <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
                  Top Participações em Rentáveis por Loja
                </span>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1 ml-11">
                Vendedores com maior impacto nas vendas rentáveis de cada loja
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {comparativoData.map((loja, lojaIdx) => {
                  const topFuncionarios = participacaoFuncionarios
                    .filter((f) => f.loja === loja.loja)
                    .sort((a, b) => b.percentual - a.percentual)
                    .slice(0, 3);

                  const colors = [
                    "from-yellow-400 to-yellow-600",
                    "from-gray-300 to-gray-500",
                    "from-orange-400 to-orange-600",
                  ];

                  return (
                    <Card
                      key={loja.loja}
                      className="overflow-hidden hover:shadow-xl transition-shadow duration-300 border-2 hover:border-primary/40"
                    >
                      <CardHeader className="bg-gradient-to-r from-primary/10 to-chart-2/10 pb-3">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-primary" />
                          <CardTitle className="text-base font-bold">{loja.loja}</CardTitle>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">Rentáveis:</span>
                          <span className="text-sm font-bold text-primary">{formatCurrency(loja.rentaveis)}</span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {topFuncionarios.map((func, idx) => (
                            <div
                              key={`${func.nome}-${idx}`}
                              className={`flex items-center gap-3 p-3 rounded-lg transition-all hover:scale-102 ${
                                idx === 0
                                  ? "bg-gradient-to-r from-yellow-400/10 to-yellow-600/10 border border-yellow-500/30"
                                  : idx === 1
                                    ? "bg-gradient-to-r from-gray-300/10 to-gray-500/10 border border-gray-400/30"
                                    : "bg-gradient-to-r from-orange-400/10 to-orange-600/10 border border-orange-500/30"
                              }`}
                            >
                              <div
                                className={`flex items-center justify-center w-9 h-9 rounded-full font-bold text-white shadow-lg bg-gradient-to-br ${colors[idx]}`}
                              >
                                {idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate">{func.nome}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                                    <div
                                      className={`h-full bg-gradient-to-r ${colors[idx]} transition-all`}
                                      style={{ width: `${func.percentual}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-bold text-primary min-w-[45px] text-right">
                                    {func.percentual.toFixed(1)}%
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatCurrency(func.valor_rentaveis)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Comparativo dos Líderes de Cada Loja */}
          <Card className="col-span-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-chart-3" />
                Ranking dos Líderes de Vendas por Loja
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Comparativo do vendedor #1 de cada loja por % de participação nos rentáveis
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {(() => {
                  // Pegar o líder (#1) de cada loja
                  const lideresLojas = comparativoData
                    .map((loja) => {
                      const funcionariosLoja = participacaoFuncionarios
                        .filter((f) => f.loja === loja.loja)
                        .sort((a, b) => b.percentual - a.percentual);

                      return funcionariosLoja.length > 0
                        ? {
                            ...funcionariosLoja[0],
                            nomeLoja: loja.loja,
                          }
                        : null;
                    })
                    .filter(Boolean);

                  // Ordenar líderes por % de participação
                  const rankingLideres = lideresLojas.sort((a, b) => b.percentual - a.percentual);

                  const colors = [
                    "from-yellow-400 to-yellow-600",
                    "from-gray-300 to-gray-500",
                    "from-orange-400 to-orange-600",
                  ];

                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <Card className="bg-gradient-to-br from-primary/10 to-chart-2/10">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-muted-foreground">Maior Participação</p>
                                <p className="text-2xl font-bold text-primary">
                                  {rankingLideres.length > 0 ? formatPercent(rankingLideres[0].percentual) : "-"}
                                </p>
                              </div>
                              <Trophy className="h-8 w-8 text-yellow-500" />
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-gradient-to-br from-chart-2/10 to-chart-3/10">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-muted-foreground">Lojas Comparadas</p>
                                <p className="text-2xl font-bold text-chart-2">{rankingLideres.length}</p>
                              </div>
                              <Store className="h-8 w-8 text-chart-2" />
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-gradient-to-br from-chart-3/10 to-chart-4/10">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-muted-foreground">Participação Média</p>
                                <p className="text-2xl font-bold text-chart-3">
                                  {rankingLideres.length > 0
                                    ? formatPercent(
                                        rankingLideres.reduce((sum, l) => sum + l.percentual, 0) /
                                          rankingLideres.length,
                                      )
                                    : "-"}
                                </p>
                              </div>
                              <Percent className="h-8 w-8 text-chart-3" />
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="space-y-3">
                        {rankingLideres.map((lider, idx) => {
                          const isTop3 = idx < 3;

                          return (
                            <div
                              key={`${lider.nome}-${lider.nomeLoja}`}
                              className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                                idx === 0
                                  ? "bg-gradient-to-r from-yellow-400/10 to-yellow-600/10 border border-yellow-500/30"
                                  : idx === 1
                                    ? "bg-gradient-to-r from-gray-300/10 to-gray-500/10 border border-gray-400/30"
                                    : idx === 2
                                      ? "bg-gradient-to-r from-orange-400/10 to-orange-600/10 border border-orange-500/30"
                                      : "hover:bg-accent/50"
                              }`}
                            >
                              <div
                                className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-white shadow-lg ${
                                  isTop3 ? "bg-gradient-to-br " + colors[idx] : "bg-secondary text-secondary-foreground"
                                }`}
                              >
                                {idx + 1}
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-base truncate">{lider.nome}</p>
                                <p className="text-xs text-muted-foreground">{lider.nomeLoja}</p>
                              </div>

                              <div className="text-right min-w-[140px]">
                                <p className="font-bold text-primary text-lg">{lider.percentual.toFixed(2)}%</p>
                                <p className="text-xs text-muted-foreground">{formatCurrency(lider.valor_rentaveis)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <BarChart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum dado disponível</h3>
            <p className="text-muted-foreground">
              Selecione as lojas e clique em "Gerar Comparativos" para visualizar os dados.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
