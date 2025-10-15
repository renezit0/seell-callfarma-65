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
                Detalhamento por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {projecoes && Object.entries(projecoes).map(([categoria, proj]: [string, any]) => (
                  <div key={categoria} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold capitalize">{categoria.replace(/_/g, ' ')}</h4>
                      <Badge variant={proj.status === 'atingido' ? 'default' : proj.status === 'próximo' ? 'secondary' : 'destructive'}>
                        {proj.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Atual</p>
                        <p className="font-medium">{formatCurrency(proj.valor_atual)}</p>
                        <p className="text-xs text-muted-foreground">{proj.percentual_atual.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Projetado</p>
                        <p className="font-medium text-green-600">{formatCurrency(proj.valor_projetado)}</p>
                        <p className="text-xs text-green-600">{proj.percentual_projetado.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Meta</p>
                        <p className="font-medium">{formatCurrency(proj.meta)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Ritmo Diário</p>
                        <p className="font-medium">{formatCurrency(proj.ritmo_diario)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

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
