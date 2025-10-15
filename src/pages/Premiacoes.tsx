import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCalculoPremiacao } from '@/hooks/useCalculoPremiacao';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, TrendingUp, Target, Calendar, DollarSign, Users, AlertCircle, CheckCircle2, Lightbulb } from 'lucide-react';
import { formatCurrency, formatPercentage } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  calcularTempoEmpresa,
  formatarTempoEmpresa
} from '@/utils/calculosPremiacao';

export default function Premiacoes() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [periodoSelecionado, setPeriodoSelecionado] = useState<any>(null);
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<any>(null);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [periodos, setPeriodos] = useState<any[]>([]);

  // Hook de cálculo de premiação
  const { 
    loading: calculando,
    vendas,
    vendasLoja,
    metas,
    resultado, 
    projecoes,
    insights 
  } = useCalculoPremiacao({
    funcionario: funcionarioSelecionado,
    periodo: periodoSelecionado,
    lojaId: user?.loja_id || 0
  });

  useEffect(() => {
    // Carregar dados iniciais
    const carregarDados = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        // Buscar períodos ativos
        const { data: periodosData, error: periodosError } = await supabase
          .from('periodos_meta')
          .select('*')
          .eq('status', 'ativo')
          .order('data_inicio', { ascending: false });

        if (periodosError) throw periodosError;

        // Formatar períodos
        const periodosFormatados = periodosData?.map(p => ({
          id: p.id,
          descricao: p.descricao || `${new Date(p.data_inicio).toLocaleDateString('pt-BR')} - ${new Date(p.data_fim).toLocaleDateString('pt-BR')}`,
          data_inicio: p.data_inicio,
          data_fim: p.data_fim,
          status: p.status
        })) || [];

        setPeriodos(periodosFormatados);

        // Selecionar primeiro período automaticamente
        if (periodosFormatados.length > 0) {
          setPeriodoSelecionado(periodosFormatados[0]);
        }

        // Buscar funcionários da loja do usuário (incluindo matricula para calcular premiação)
        const { data: funcionariosData, error: funcionariosError } = await supabase
          .from('usuarios')
          .select('id, nome, tipo, data_contratacao, loja_id, status, matricula')
          .eq('loja_id', user.loja_id)
          .eq('status', 'ativo')
          .order('nome');

        if (funcionariosError) throw funcionariosError;

        setFuncionarios(funcionariosData || []);

        // Se o usuário não for gerente/líder, selecionar ele mesmo automaticamente
        const isGestor = ['gerente', 'lider', 'sublider', 'subgerente', 'admin', 'supervisor'].includes(user.tipo);
        if (!isGestor) {
          const usuarioAtual = funcionariosData?.find(f => f.id === user.id);
          if (usuarioAtual) {
            setFuncionarioSelecionado(usuarioAtual);
          }
        }

      } catch (error: any) {
        console.error('Erro ao carregar dados:', error);
        toast({
          title: 'Erro ao carregar dados',
          description: error.message || 'Não foi possível carregar os períodos e funcionários',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    carregarDados();
  }, [user]);

  if (loading) {
    return (
      <div className="page-container space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="page-container space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Trophy className="w-8 h-8 text-primary" />
            Cálculo de Premiações
          </h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe seu desempenho e premiação em tempo real
          </p>
        </div>
      </div>

      {/* Seletores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select 
              value={periodoSelecionado?.id?.toString() || ''} 
              onValueChange={(value) => {
                const periodo = periodos.find(p => p.id.toString() === value);
                setPeriodoSelecionado(periodo);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                {periodos.map(periodo => (
                  <SelectItem key={periodo.id} value={periodo.id.toString()}>
                    {periodo.descricao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              Funcionário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select 
              value={funcionarioSelecionado?.id?.toString() || ''} 
              onValueChange={(value) => {
                const func = funcionarios.find(f => f.id.toString() === value);
                setFuncionarioSelecionado(func);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o funcionário" />
              </SelectTrigger>
              <SelectContent>
                {funcionarios.map(func => (
                  <SelectItem key={func.id} value={func.id.toString()}>
                    {func.nome} - {func.tipo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Alerta informativo */}
      {!periodoSelecionado || !funcionarioSelecionado ? (
        <Alert>
          <AlertDescription>
            Selecione um período e um funcionário para visualizar o cálculo de premiação.
          </AlertDescription>
        </Alert>
      ) : calculando ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Premiação Atual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(resultado?.premiacao_total || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Baseado nas vendas até agora
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Premiação Projetada
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(resultado?.premiacao_total_projetada || resultado?.premiacao_total || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Projeção para o fim do período
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  Premiação Máxima
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(resultado?.premiacao_total_maxima || resultado?.premiacao_maxima || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Potencial com 100% das metas
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Insights */}
          {insights && insights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-500" />
                  Insights e Recomendações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {insights.map((insight, idx) => (
                    <Alert key={idx} className="border-l-4" style={{ borderLeftColor: insight.cor }}>
                      <AlertDescription>
                        <div className="flex items-start gap-2">
                          <i className={`fas fa-${insight.icone} mt-1`} style={{ color: insight.cor }}></i>
                          <div>
                            <p className="font-semibold">{insight.titulo}</p>
                            <p className="text-sm text-muted-foreground">{insight.descricao}</p>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detalhes por Categoria */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Detalhes por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projecoes && Object.entries(projecoes)
                  .filter(([categoria]) => {
                    const isGerente = funcionarioSelecionado?.tipo === 'gerente' || funcionarioSelecionado?.tipo === 'lider';
                    if (isGerente) {
                      return true;
                    } else {
                      return categoria !== 'geral';
                    }
                  })
                  .map(([categoria, proj]: [string, any]) => {
                    const isGerente = funcionarioSelecionado?.tipo === 'gerente' || funcionarioSelecionado?.tipo === 'lider';
                    // Para gerentes, usar vendas da loja; para outros, vendas do usuário
                    const vendasParaExibir = isGerente ? vendasLoja : vendas;
                    const getCategoryIcon = (cat: string) => {
                      if (cat === 'geral') return '📊';
                      if (cat.includes('conveniencia')) return '🛒';
                      if (cat.includes('rentaveis') || cat.includes('r_mais')) return '💰';
                      if (cat.includes('perfumaria')) return '💄';
                      if (cat.includes('saude') || cat.includes('goodlife')) return '💚';
                      if (cat.includes('balanco')) return '⚖️';
                      return '📈';
                    };

                    const getCategoryName = (cat: string) => {
                      const names: Record<string, string> = {
                        'geral': 'Meta Geral',
                        'conveniencia_r_mais': 'Conveniência R+',
                        'r_mais': 'Rentáveis',
                        'perfumaria_r_mais': 'Perfumaria R+',
                        'saude': 'GoodLife',
                        'balanco': 'Balanço',
                        'generico_similar': 'Genérico+Similar',
                        'goodlife': 'GoodLife',
                        'perfumaria_alta': 'Perfumaria Alta',
                        'dermocosmetico': 'Dermocosmético'
                      };
                      return names[cat] || cat.replace(/_/g, ' ');
                    };

                    const percentual = proj.percentual_atual || 0;
                    const getBadgeColor = (perc: number) => {
                      if (perc >= 100) return 'bg-green-500';
                      if (perc >= 95) return 'bg-yellow-500';
                      if (perc >= 90) return 'bg-orange-500';
                      return 'bg-red-500';
                    };

                    return (
                      <Card key={categoria} className="border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <span className="text-xl">{getCategoryIcon(categoria)}</span>
                              {getCategoryName(categoria)}
                            </CardTitle>
                            <Badge className={`${getBadgeColor(percentual)} text-white`}>
                              {percentual.toFixed(1)}%
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <p className="text-sm text-muted-foreground">Meta:</p>
                            <p className="text-lg font-bold">{formatCurrency(metas?.[categoria] || proj.meta || 0)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Realizado (Loja):</p>
                            <p className="text-lg font-semibold text-primary">{formatCurrency(vendasParaExibir?.[categoria]?.valor || 0)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Projeção:</p>
                            <p className="text-lg font-semibold text-green-600">{formatCurrency(proj.valor_projetado || 0)} ({proj.percentual_projetado?.toFixed(1) || 0}%)</p>
                          </div>
                          {resultado?.multiplicadores?.[categoria] !== undefined && (
                            <div className="pt-2 border-t">
                              <p className="text-sm text-muted-foreground">Multiplicador:</p>
                              <p className="text-xl font-bold text-orange-600">{resultado.multiplicadores[categoria].toFixed(1)}</p>
                            </div>
                          )}
                          {resultado?.premiacoes?.[categoria] !== undefined && (
                            <div>
                              <p className="text-sm text-muted-foreground">Premiação:</p>
                              <p className="text-xl font-bold">{formatCurrency(resultado.premiacoes[categoria])}</p>
                            </div>
                          )}
                          
                          {/* Tabela de faixas para categorias */}
                          {categoria !== 'balanco' && (
                            <div className="pt-2 border-t text-xs space-y-1">
                              {categoria === 'geral' ? (
                                <>
                                  <div className="flex justify-between"><span>90%</span><span>0.2</span><span>{formatCurrency((resultado?.base_calculo || 0) * 0.2)}</span></div>
                                  <div className="flex justify-between"><span>95%</span><span>0.4</span><span>{formatCurrency((resultado?.base_calculo || 0) * 0.4)}</span></div>
                                  <div className="flex justify-between"><span>100%</span><span>0.6</span><span>{formatCurrency((resultado?.base_calculo || 0) * 0.6)}</span></div>
                                </>
                              ) : categoria !== 'balanco' && (
                                <>
                                  <div className="flex justify-between"><span>95%</span><span>0.1</span><span>{formatCurrency((resultado?.base_calculo || 0) * 0.1)}</span></div>
                                  <div className="flex justify-between"><span>100%</span><span>0.2</span><span>{formatCurrency((resultado?.base_calculo || 0) * 0.2)}</span></div>
                                </>
                              )}
                            </div>
                          )}
                          {categoria === 'balanco' && (
                            <div className="pt-2 border-t">
                              <p className="text-sm">Status: <span className="font-semibold">{resultado?.multiplicadores?.balanco > 0 ? 'Sim' : 'Não'}</span></p>
                              <div className="text-xs space-y-1 mt-2">
                                <div className="flex justify-between"><span>Sim</span><span>0.1</span><span>{formatCurrency((resultado?.base_calculo || 0) * 0.1)}</span></div>
                                <div className="flex justify-between"><span>Não</span><span>0.0</span><span>{formatCurrency(0)}</span></div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </CardContent>
          </Card>

          {/* Tabela de Faixas de Faturamento - APENAS PARA GERENTES */}
          {(funcionarioSelecionado?.tipo === 'gerente' || funcionarioSelecionado?.tipo === 'lider') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Tabela de Faixas de Faturamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 font-semibold">Faixa de Faturamento</th>
                        <th className="text-right p-3 font-semibold">Base de Cálculo</th>
                        <th className="text-right p-3 font-semibold">Premiação Máxima</th>
                        <th className="text-center p-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { min: 0, max: 299000, base: 1300 },
                        { min: 299000, max: 399000, base: 1400 },
                        { min: 399000, max: 499000, base: 1500 },
                        { min: 499000, max: 599000, base: 1700 },
                        { min: 599000, max: 699000, base: 1900 },
                        { min: 699000, max: 799000, base: 2100 },
                        { min: 799000, max: 899000, base: 2300 },
                        { min: 899000, max: 999000, base: 2500 },
                        { min: 999000, max: 1199000, base: 2700 },
                        { min: 1199000, max: 1499000, base: 3000 },
                        { min: 1499000, max: 1799000, base: 3500 },
                        { min: 1799000, max: 1999000, base: 4000 },
                        { min: 1999000, max: 999999999, base: 4500 }
                      ].map((faixa, idx) => {
                        const faturamentoAtual = projecoes?.geral?.valor_atual || 0;
                        const isFaixaAtual = faturamentoAtual >= faixa.min && faturamentoAtual < faixa.max;
                        return (
                          <tr key={idx} className={isFaixaAtual ? 'bg-primary/10 font-semibold' : ''}>
                            <td className="p-3">
                              De {formatCurrency(faixa.min)} até {faixa.max < 999999999 ? formatCurrency(faixa.max) : 'Acima'}
                            </td>
                            <td className="text-right p-3">{formatCurrency(faixa.base)}</td>
                            <td className="text-right p-3">{formatCurrency(faixa.base * 1.5)}</td>
                            <td className="text-center p-3">
                              {isFaixaAtual && (
                                <Badge className="bg-black text-white">Faixa Atual</Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Entendendo o Sistema de Premiação - APENAS PARA GERENTES */}
          {(funcionarioSelecionado?.tipo === 'gerente' || funcionarioSelecionado?.tipo === 'lider') && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5" />
                  Entendendo o Sistema de Premiação
                </CardTitle>
                <Button variant="outline" size="sm">
                  <i className="fas fa-share-alt mr-2"></i>
                  Compartilhar Sistema
                </Button>
              </CardHeader>
              <CardContent>
                <p className="mb-6 text-muted-foreground">
                  O sistema de premiação gerencial é baseado no faturamento da loja e no atingimento de metas em diferentes indicadores. 
                  A premiação é calculada multiplicando o valor base de referência pelos multiplicadores de cada categoria alcançada.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="border-2">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <i className="fas fa-calculator text-primary"></i>
                        Base de Cálculo
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <p className="mb-3">
                        A base de cálculo é determinada pelo faturamento total da loja no período. 
                        Quanto maior o faturamento, maior o valor base utilizado para calcular as premiações.
                      </p>
                      <p className="font-semibold">
                        O faturamento considerado é o da Meta Geral, independente dos outros indicadores.
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-2">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <i className="fas fa-times text-green-600"></i>
                        Multiplicadores
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <p className="mb-3">
                        Cada categoria possui percentuais de atingimento que determinam o multiplicador a ser aplicado sobre a base de cálculo:
                      </p>
                      <div>
                        <p className="font-semibold">Meta Geral: 90% (0.2), 95% (0.4), 100% (0.6)</p>
                      </div>
                      <div>
                        <p className="font-semibold">Demais Indicadores: 95% (0.1), 100% (0.2)</p>
                      </div>
                      <div>
                        <p className="font-semibold">Balanço: Atingido (0.1), Não atingido (0)</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-2">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <i className="fas fa-calculator text-orange-600"></i>
                        Cálculo Final
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <p className="mb-3">
                        A premiação total é a soma dos valores obtidos em cada categoria:
                      </p>
                      <p className="font-semibold bg-muted p-2 rounded text-center">
                        Premiação Total = Base de Cálculo × Soma dos Multiplicadores
                      </p>
                      <p className="mt-3">
                        O valor máximo possível é de 1.5x a base de cálculo, quando todos os indicadores atingem 100% e o balanço é positivo.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Informações do Funcionário */}
          {funcionarioSelecionado && (
            <Card>
              <CardHeader>
                <CardTitle>Informações do Colaborador</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium">{funcionarioSelecionado.nome}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tipo</p>
                    <Badge variant="outline">{funcionarioSelecionado.tipo}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tempo de Empresa</p>
                    <p className="font-medium">
                      {formatarTempoEmpresa(calcularTempoEmpresa(funcionarioSelecionado.data_contratacao))}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Data Admissão</p>
                    <p className="font-medium">
                      {new Date(funcionarioSelecionado.data_contratacao).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
