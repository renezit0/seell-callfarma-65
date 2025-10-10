import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, List, AlertCircle, Search, TrendingUp } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useCallfarmaAPI } from '@/hooks/useCallfarmaAPI';
import { useToast } from '@/hooks/use-toast';
import { usePeriodoAtual } from '@/hooks/usePeriodoAtual';
import { supabase } from '@/integrations/supabase/client';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';

interface DadosVenda {
  CDFIL: number;
  NOMEFIL: string;
  TOTAL_VALOR: number;
  TOTAL_QUANTIDADE: number;
}

interface Loja {
  id: number;
  nome: string;
  numero: string;
}

export default function Relatorios() {
  const periodoAtual = usePeriodoAtual();
  const { user, loading: userLoading } = useAuth();
  const { buscarVendasCampanha, loading: apiLoading } = useCallfarmaAPI();
  const { toast } = useToast();

  const [filtros, setFiltros] = useState({
    dataInicio: periodoAtual.dataInicio.toISOString().split('T')[0],
    dataFim: periodoAtual.dataFim.toISOString().split('T')[0],
    grupos: '',
    produtos: '',
    familias: ''
  });

  const [dados, setDados] = useState<DadosVenda[]>([]);
  const [todasLojas, setTodasLojas] = useState<Loja[]>([]);
  const [modoVisualizacao, setModoVisualizacao] = useState<'grafico' | 'lista' | 'zeros'>('grafico');
  const [tipoGrafico, setTipoGrafico] = useState<'valor' | 'quantidade'>('valor');

  useEffect(() => {
    if (user && !userLoading) {
      carregarLojas();
    }
  }, [user, userLoading]);

  const carregarLojas = async () => {
    try {
      const { data, error } = await supabase
        .from('lojas')
        .select('id, nome, numero')
        .order('numero');
      
      if (error) throw error;
      setTodasLojas(data || []);
    } catch (error) {
      console.error('Erro ao carregar lojas:', error);
    }
  };

  const buscarDados = async () => {
    try {
      if (!filtros.grupos && !filtros.produtos && !filtros.familias) {
        toast({
          title: 'Atenção',
          description: 'Informe ao menos um filtro: grupos, produtos ou famílias',
          variant: 'destructive'
        });
        return;
      }

      const resultado = await buscarVendasCampanha({
        dataInicio: filtros.dataInicio,
        dataFim: filtros.dataFim,
        filtroGrupos: filtros.grupos || undefined,
        filtroProduto: filtros.produtos || undefined,
        filtroFamilias: filtros.familias || undefined
      });

      setDados(resultado);

      toast({
        title: 'Sucesso',
        description: `${resultado.length} lojas encontradas`
      });

    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao buscar dados da API',
        variant: 'destructive'
      });
    }
  };

  const getLojasComZeroVendas = () => {
    const lojasComVendas = new Set(dados.map(d => d.CDFIL));
    return todasLojas.filter(loja => !lojasComVendas.has(parseInt(loja.numero)));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  const allowedRoles = ['gerente', 'lider', 'sublider', 'subgerente', 'admin', 'supervisor', 'rh'];

  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user?.tipo || !allowedRoles.includes(user.tipo)) {
    return <Navigate to="/" replace />;
  }

  const dadosGrafico = dados
    .sort((a, b) => tipoGrafico === 'valor' ? b.TOTAL_VALOR - a.TOTAL_VALOR : b.TOTAL_QUANTIDADE - a.TOTAL_QUANTIDADE)
    .map(d => ({
      loja: d.NOMEFIL,
      valor: d.TOTAL_VALOR,
      quantidade: d.TOTAL_QUANTIDADE
    }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Relatórios de Vendas</h1>
        <p className="text-muted-foreground">
          Análise comparativa de vendas por loja - Grupos, Produtos ou Famílias
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros de Busca
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dataInicio">Data Início</Label>
              <Input
                id="dataInicio"
                type="date"
                value={filtros.dataInicio}
                onChange={(e) => setFiltros(prev => ({ ...prev, dataInicio: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="dataFim">Data Fim</Label>
              <Input
                id="dataFim"
                type="date"
                value={filtros.dataFim}
                onChange={(e) => setFiltros(prev => ({ ...prev, dataFim: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="grupos">Grupos (separados por vírgula)</Label>
              <Input
                id="grupos"
                placeholder="Ex: 20,25,36"
                value={filtros.grupos}
                onChange={(e) => setFiltros(prev => ({ ...prev, grupos: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="produtos">Produtos (separados por vírgula)</Label>
              <Input
                id="produtos"
                placeholder="Ex: 12345,67890"
                value={filtros.produtos}
                onChange={(e) => setFiltros(prev => ({ ...prev, produtos: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="familias">Famílias (separadas por vírgula)</Label>
              <Input
                id="familias"
                placeholder="Ex: 10,15,20"
                value={filtros.familias}
                onChange={(e) => setFiltros(prev => ({ ...prev, familias: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={() => { buscarDados(); setModoVisualizacao('grafico'); }} 
              disabled={apiLoading}
              className="gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              Carregar Gráficos
            </Button>
            <Button 
              onClick={() => { buscarDados(); setModoVisualizacao('lista'); }} 
              disabled={apiLoading}
              variant="outline"
              className="gap-2"
            >
              <List className="h-4 w-4" />
              Carregar Lista
            </Button>
            <Button 
              onClick={() => { buscarDados(); setModoVisualizacao('zeros'); }} 
              disabled={apiLoading}
              variant="outline"
              className="gap-2"
            >
              <AlertCircle className="h-4 w-4" />
              Lojas com 0 Vendidos
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {apiLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : dados.length > 0 ? (
        <>
          {modoVisualizacao === 'grafico' && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Gráfico Comparativo por Loja
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={tipoGrafico === 'valor' ? 'default' : 'outline'}
                      onClick={() => setTipoGrafico('valor')}
                    >
                      Valor
                    </Button>
                    <Button
                      size="sm"
                      variant={tipoGrafico === 'quantidade' ? 'default' : 'outline'}
                      onClick={() => setTipoGrafico('quantidade')}
                    >
                      Quantidade
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[500px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosGrafico} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="loja" 
                        angle={-45} 
                        textAnchor="end" 
                        height={100}
                        interval={0}
                      />
                      <YAxis />
                      <ChartTooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-card p-3 border rounded-lg shadow-lg">
                                <p className="font-semibold">{payload[0].payload.loja}</p>
                                <p className="text-sm text-muted-foreground">
                                  Valor: {formatCurrency(payload[0].payload.valor)}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Quantidade: {formatNumber(payload[0].payload.quantidade)}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      <Bar 
                        dataKey={tipoGrafico === 'valor' ? 'valor' : 'quantidade'} 
                        fill="hsl(var(--primary))" 
                        name={tipoGrafico === 'valor' ? 'Valor (R$)' : 'Quantidade'}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {modoVisualizacao === 'lista' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <List className="h-5 w-5" />
                  Lista de Vendas por Loja
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dados
                    .sort((a, b) => b.TOTAL_VALOR - a.TOTAL_VALOR)
                    .map((item, index) => (
                      <div
                        key={item.CDFIL}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="min-w-12 justify-center">
                            {index + 1}º
                          </Badge>
                          <div>
                            <div className="font-medium text-foreground">
                              {item.NOMEFIL}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Código: {item.CDFIL}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-green-600">
                            {formatCurrency(item.TOTAL_VALOR)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Qtd: {formatNumber(item.TOTAL_QUANTIDADE)}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {modoVisualizacao === 'zeros' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  Lojas com 0 Vendidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {getLojasComZeroVendas().length > 0 ? (
                  <div className="space-y-2">
                    {getLojasComZeroVendas().map((loja) => (
                      <div
                        key={loja.id}
                        className="flex items-center gap-3 p-4 rounded-lg border border-destructive/20 bg-destructive/5"
                      >
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        <div>
                          <div className="font-medium text-foreground">
                            {loja.nome}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Código: {loja.numero}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <TrendingUp className="w-12 h-12 text-green-600 mx-auto mb-4" />
                    <p className="text-foreground font-medium">
                      Todas as lojas tiveram vendas no período!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhum dado encontrado
            </h3>
            <p className="text-muted-foreground">
              Configure os filtros e clique em um dos botões acima para carregar os dados.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}