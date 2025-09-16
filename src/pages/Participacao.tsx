import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePeriodoAtual } from "@/hooks/usePeriodoAtual";
import { useCallfarmaAPI } from "@/hooks/useCallfarmaAPI";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import { PeriodSelector } from "@/components/PeriodSelector";
import { Loader2 } from "lucide-react";

interface LojaParticipacao {
  id: number;
  nome: string;
  regional: string;
  vendas_geral: number;
  vendas_categorias: {
    r_mais: number;
    perfumaria_r_mais: number;
    conveniencia_r_mais: number;
    saude: number;
  };
  participacao: {
    r_mais: number;
    perfumaria_r_mais: number;
    conveniencia_r_mais: number;
    saude: number;
  };
}

interface TotaisGerais {
  vendas_geral: number;
  vendas_categorias: {
    r_mais: number;
    perfumaria_r_mais: number;
    conveniencia_r_mais: number;
    saude: number;
  };
  participacao_media: {
    r_mais: number;
    perfumaria_r_mais: number;
    conveniencia_r_mais: number;
    saude: number;
  };
}

const categorias = [
  { key: 'r_mais', nome: 'Rentáveis', icone: 'fa-chart-pie', cor: '#e74a3b' },
  { key: 'perfumaria_r_mais', nome: 'Perfumaria R+', icone: 'fa-spray-can', cor: '#8e44ad' },
  { key: 'conveniencia_r_mais', nome: 'Conveniência R+', icone: 'fa-shopping-basket', cor: '#fd7e14' },
  { key: 'saude', nome: 'GoodLife', icone: 'fa-heartbeat', cor: '#28a745' }
];

const regionais = [
  { key: 'todos', nome: 'Todas as Regionais' },
  { key: 'CWB', nome: 'Curitiba' },
  { key: 'PG', nome: 'Ponta Grossa' },
  { key: 'TELEVENDAS', nome: 'Televendas' },
  { key: 'OUTROS', nome: 'Outros/Sem Regional' }
];

export default function Participacao() {
  const [tipoFiltro, setTipoFiltro] = useState<'periodo' | 'data_especifica'>('periodo');
  const [dataEspecifica, setDataEspecifica] = useState(new Date().toISOString().split('T')[0]);
  const [regionalSelecionada, setRegionalSelecionada] = useState('todos');
  const [dadosLojas, setDadosLojas] = useState<LojaParticipacao[]>([]);
  const [totaisGerais, setTotaisGerais] = useState<TotaisGerais>({
    vendas_geral: 0,
    vendas_categorias: { r_mais: 0, perfumaria_r_mais: 0, conveniencia_r_mais: 0, saude: 0 },
    participacao_media: { r_mais: 0, perfumaria_r_mais: 0, conveniencia_r_mais: 0, saude: 0 }
  });
  const [loading, setLoading] = useState(true);

  const periodo = usePeriodoAtual();
  const { buscarTodasVendasConsolidadas } = useCallfarmaAPI();

  const calcularParticipacao = (vendas_loja: any) => {
    const geral = vendas_loja.geral || 0;
    const participacao: any = {};
    
    categorias.forEach(categoria => {
      const valor_categoria = vendas_loja[categoria.key] || 0;
      participacao[categoria.key] = geral > 0 ? (valor_categoria / geral) * 100 : 0;
    });
    
    return participacao;
  };

  const buscarDadosParticipacao = async () => {
    if (!periodo) return;
    
    setLoading(true);
    try {
      const dataInicio = tipoFiltro === 'data_especifica' ? dataEspecifica : periodo.data_inicio;
      const dataFim = tipoFiltro === 'data_especifica' ? dataEspecifica : periodo.data_fim;
      
      // Buscar dados consolidados via API
      const dadosAPI = await buscarTodasVendasConsolidadas(dataInicio, dataFim);
      
      if (dadosAPI) {
        const lojas: LojaParticipacao[] = [];
        const totais = {
          vendas_geral: 0,
          vendas_categorias: { r_mais: 0, perfumaria_r_mais: 0, conveniencia_r_mais: 0, saude: 0 },
          participacao_media: { r_mais: 0, perfumaria_r_mais: 0, conveniencia_r_mais: 0, saude: 0 }
        };

        // Agregar dados gerais por loja
        const lojasMap = new Map<number, any>();
        
        // Processar dados gerais
        dadosAPI.geral.forEach((item: any) => {
        const lojaId = item.CDFIL;
        if (!lojasMap.has(lojaId)) {
          lojasMap.set(lojaId, {
            id: lojaId,
            nome: item.NOMEFIL || `Loja ${lojaId}`,
            regional: item.supervisao || 'OUTROS', // Usar supervisao da tabela lojas
            vendas_geral: 0,
            vendas_categorias: { r_mais: 0, perfumaria_r_mais: 0, conveniencia_r_mais: 0, saude: 0 }
          });
        }
          
          const loja = lojasMap.get(lojaId)!;
          loja.vendas_geral += item.VALOR_LIQUIDO || 0;
        });

        // Processar categorias específicas
        const mapearCategoria = {
          rentaveis: 'r_mais',
          perfumaria_alta: 'perfumaria_r_mais', 
          conveniencia_alta: 'conveniencia_r_mais',
          goodlife: 'saude'
        };

        Object.entries(mapearCategoria).forEach(([apiKey, localKey]) => {
          const dadosCategoria = dadosAPI[apiKey as keyof typeof dadosAPI];
          if (Array.isArray(dadosCategoria)) {
            dadosCategoria.forEach((item: any) => {
              const lojaId = item.CDFIL;
              if (lojasMap.has(lojaId)) {
                const loja = lojasMap.get(lojaId)!;
                loja.vendas_categorias[localKey as keyof typeof loja.vendas_categorias] += item.VALOR_LIQUIDO || 0;
              }
            });
          }
        });

        // Converter para array e calcular participação
        Array.from(lojasMap.values()).forEach(lojaData => {
          const participacao = calcularParticipacao({
            geral: lojaData.vendas_geral,
            ...lojaData.vendas_categorias
          });

          const loja: LojaParticipacao = {
            ...lojaData,
            participacao
          };

          lojas.push(loja);

          // Acumular totais
          totais.vendas_geral += lojaData.vendas_geral;
          categorias.forEach(cat => {
            totais.vendas_categorias[cat.key as keyof typeof totais.vendas_categorias] += 
              lojaData.vendas_categorias[cat.key as keyof typeof lojaData.vendas_categorias];
          });
        });

        // Calcular participação média geral
        if (totais.vendas_geral > 0) {
          categorias.forEach(cat => {
            totais.participacao_media[cat.key as keyof typeof totais.participacao_media] = 
              (totais.vendas_categorias[cat.key as keyof typeof totais.vendas_categorias] / totais.vendas_geral) * 100;
          });
        }

        // Ordenar lojas por valor geral
        lojas.sort((a, b) => b.vendas_geral - a.vendas_geral);

        setDadosLojas(lojas);
        setTotaisGerais(totais);
      }
    } catch (error) {
      console.error('Erro ao buscar dados de participação:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    buscarDadosParticipacao();
  }, [periodo, tipoFiltro, dataEspecifica]);

  const getClasseParticipacao = (percentual: number) => {
    if (percentual >= 25) return 'success';
    if (percentual >= 15) return 'warning';
    if (percentual >= 5) return 'info';
    return 'secondary';
  };

  const dadosFiltrados = dadosLojas.filter(loja => 
    regionalSelecionada === 'todos' || loja.regional === regionalSelecionada
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-container space-y-8">
      {/* Modern Header with proper spacing */}
      <div className="relative overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-8 rounded-xl shadow-lg">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <i className="fas fa-chart-pie text-3xl"></i>
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2">Participação por Categoria</h1>
              <p className="text-emerald-100 text-lg">
                Análise detalhada da participação percentual de cada categoria em relação ao valor geral de vendas
              </p>
            </div>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute -top-4 -right-4 w-24 h-24 bg-emerald-400/20 rounded-full blur-xl"></div>
        <div className="absolute -bottom-2 -left-2 w-16 h-16 bg-emerald-300/20 rounded-full blur-lg"></div>
      </div>

      {/* Filtros com melhor espaçamento */}
      <Card className="card-modern">
        <CardContent className="p-8">
          <div className="flex flex-wrap gap-8 items-end">
            <div className="space-y-3 min-w-[200px]">
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Tipo de Filtro
              </label>
              <div className="flex gap-3">
                <Button
                  variant={tipoFiltro === 'periodo' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTipoFiltro('periodo')}
                  className="btn-modern"
                >
                  <i className="fas fa-calendar-alt mr-2"></i>
                  Por Período
                </Button>
                <Button
                  variant={tipoFiltro === 'data_especifica' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTipoFiltro('data_especifica')}
                  className="btn-modern"
                >
                  <i className="fas fa-calendar-day mr-2"></i>
                  Data Específica
                </Button>
              </div>
            </div>

            {tipoFiltro === 'periodo' ? (
              <div className="space-y-3 min-w-[200px]">
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Período Selecionado
                </label>
                <div className="p-3 bg-muted rounded-lg">
                  <PeriodSelector />
                </div>
              </div>
            ) : (
              <div className="space-y-3 min-w-[200px]">
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Data Específica
                </label>
                <input
                  type="date"
                  value={dataEspecifica}
                  onChange={(e) => setDataEspecifica(e.target.value)}
                  className="px-4 py-3 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
              </div>
            )}

            <div className="space-y-3 min-w-[200px]">
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Filtrar por Regional
              </label>
              <Select value={regionalSelecionada} onValueChange={setRegionalSelecionada}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione uma regional" />
                </SelectTrigger>
                <SelectContent>
                  {regionais.map(regional => (
                    <SelectItem key={regional.key} value={regional.key}>
                      <div className="flex items-center gap-2">
                        <i className="fas fa-map-marker-alt text-muted-foreground"></i>
                        {regional.nome}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="geral" className="space-y-8">
        <div className="bg-background border border-border rounded-xl p-2">
          <TabsList className="grid w-full grid-cols-6 bg-muted/50">
            <TabsTrigger value="geral" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <i className="fas fa-chart-bar mr-2"></i>
              Visão Geral
            </TabsTrigger>
            {categorias.map(categoria => (
              <TabsTrigger key={categoria.key} value={categoria.key} className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <i className={`fas ${categoria.icone} mr-2`} style={{ color: categoria.cor }}></i>
                {categoria.nome}
              </TabsTrigger>
            ))}
            <TabsTrigger value="completo" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <i className="fas fa-table mr-2"></i>
              Tabela Completa
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Visão Geral com espaçamento melhorado */}
        <TabsContent value="geral" className="space-y-8 mt-8">
          {/* Cards de Estatísticas Modernos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <Card className="card-modern hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                    <i className="fas fa-dollar-sign text-white text-xl"></i>
                  </div>
                  <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Total Geral
                  </div>
                </div>
                <div className="text-2xl font-bold text-emerald-600 mb-1">
                  {formatCurrency(totaisGerais.vendas_geral)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Valor total vendido no período
                </div>
              </CardContent>
            </Card>

            {categorias.map(categoria => (
              <Card key={categoria.key} className="card-modern hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div 
                      className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg"
                      style={{ 
                        backgroundColor: categoria.cor + '15', 
                        color: categoria.cor,
                        border: `1px solid ${categoria.cor}20`
                      }}
                    >
                      <i className={`fas ${categoria.icone} text-xl`}></i>
                    </div>
                    <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      {categoria.nome}
                    </div>
                  </div>
                  <div className="text-2xl font-bold mb-1" style={{ color: categoria.cor }}>
                    {formatPercentage(totaisGerais.participacao_media[categoria.key as keyof typeof totaisGerais.participacao_media])}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(totaisGerais.vendas_categorias[categoria.key as keyof typeof totaisGerais.vendas_categorias])} vendidos
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Grid de Lojas Modernizado */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <i className="fas fa-store-alt text-white"></i>
                </div>
                Participação por Loja
              </h3>
              <div className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
                {dadosFiltrados.length} {dadosFiltrados.length === 1 ? 'loja encontrada' : 'lojas encontradas'}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {dadosFiltrados.map(loja => (
                <Card key={loja.id} className="card-modern group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <CardHeader className="pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors">
                        {loja.nome}
                      </CardTitle>
                      <div className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                        #{loja.id}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <i className="fas fa-map-marker-alt text-emerald-500"></i>
                      <span className="font-medium">{loja.regional}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="text-center mb-6 p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200">
                      <div className="text-xs text-emerald-700 uppercase tracking-wide mb-2 font-semibold">
                        Total Geral
                      </div>
                      <div className="text-2xl font-bold text-emerald-700">
                        {formatCurrency(loja.vendas_geral)}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {categorias.map(categoria => (
                        <div 
                          key={categoria.key} 
                          className="text-center p-3 rounded-lg border transition-all hover:shadow-md"
                          style={{ 
                            backgroundColor: categoria.cor + '08', 
                            borderColor: categoria.cor + '20' 
                          }}
                        >
                          <div className="text-xs text-muted-foreground mb-1 font-medium">
                            {categoria.nome}
                          </div>
                          <div className="text-xs mb-2 font-medium">
                            {formatCurrency(loja.vendas_categorias[categoria.key as keyof typeof loja.vendas_categorias])}
                          </div>
                          <div 
                            className="text-sm font-bold"
                            style={{ color: categoria.cor }}
                          >
                            {formatPercentage(loja.participacao[categoria.key as keyof typeof loja.participacao])}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Abas das Categorias */}
        {categorias.map(categoria => (
          <TabsContent key={categoria.key} value={categoria.key} className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <i className={`fas ${categoria.icone}`} style={{ color: categoria.cor }}></i>
                Participação - {categoria.nome}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dadosFiltrados
                  .sort((a, b) => b.participacao[categoria.key as keyof typeof a.participacao] - a.participacao[categoria.key as keyof typeof a.participacao])
                  .map(loja => (
                    <Card key={loja.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{loja.nome}</CardTitle>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <i className="fas fa-map-marker-alt"></i>
                          {loja.regional}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center mb-4 p-3 bg-muted rounded-lg">
                          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                            Total Geral
                          </div>
                          <div className="text-xl font-bold text-emerald-600">
                            {formatCurrency(loja.vendas_geral)}
                          </div>
                        </div>
                        <div 
                          className="text-center p-4 rounded-lg border-2"
                          style={{ 
                            backgroundColor: categoria.cor + '10', 
                            borderColor: categoria.cor + '20' 
                          }}
                        >
                          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                            {categoria.nome}
                          </div>
                          <div className="text-sm mb-2">
                            {formatCurrency(loja.vendas_categorias[categoria.key as keyof typeof loja.vendas_categorias])}
                          </div>
                          <div 
                            className="text-2xl font-bold"
                            style={{ color: categoria.cor }}
                          >
                            {formatPercentage(loja.participacao[categoria.key as keyof typeof loja.participacao])}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            de participação
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          </TabsContent>
        ))}

        {/* Tabela Completa */}
        <TabsContent value="completo">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-4 text-left font-medium">Loja</th>
                      <th className="p-4 text-left font-medium">Regional</th>
                      <th className="p-4 text-right font-medium">Total Geral</th>
                      {categorias.map(categoria => (
                        <React.Fragment key={categoria.key}>
                          <th className="p-4 text-right font-medium">{categoria.nome}</th>
                          <th className="p-4 text-center font-medium">%</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dadosFiltrados.map(loja => (
                      <tr key={loja.id} className="border-b hover:bg-muted/50">
                        <td className="p-4 font-medium">{loja.nome}</td>
                        <td className="p-4">
                          <Badge variant="secondary">{loja.regional}</Badge>
                        </td>
                        <td className="p-4 text-right">{formatCurrency(loja.vendas_geral)}</td>
                        {categorias.map(categoria => (
                          <React.Fragment key={categoria.key}>
                            <td className="p-4 text-right">
                              {formatCurrency(loja.vendas_categorias[categoria.key as keyof typeof loja.vendas_categorias])}
                            </td>
                            <td className="p-4 text-center">
                              <Badge 
                                variant={
                                  loja.participacao[categoria.key as keyof typeof loja.participacao] >= 25 ? 'default' :
                                  loja.participacao[categoria.key as keyof typeof loja.participacao] >= 15 ? 'secondary' :
                                  'outline'
                                }
                              >
                                {formatPercentage(loja.participacao[categoria.key as keyof typeof loja.participacao])}
                              </Badge>
                            </td>
                          </React.Fragment>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}