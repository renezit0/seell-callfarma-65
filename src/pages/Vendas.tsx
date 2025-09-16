import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, Calendar, DollarSign, TrendingUp, BarChart3 } from 'lucide-react';
import { getNomeCategoria, getIconeCategoria, getClasseCorCategoria, getClasseBgCategoria } from '@/utils/categories';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { PeriodSelector } from '@/components/PeriodSelector';
import { StoreSelector } from '@/components/StoreSelector';
import { usePeriodContext } from '@/contexts/PeriodContext';

// Mapeamento simples dos grupos
const GRUPOS_PARA_CATEGORIAS: Record<number, string> = {
  2: 'similar',
  5: 'generico', 
  6: 'generico',
  13: 'brinquedo',
  16: 'dermocosmetico',
  20: 'rentaveis20',
  21: 'similar', 
  22: 'goodlife',
  25: 'rentaveis25',
  31: 'dermocosmetico',
  36: 'conveniencia',
  46: 'perfumaria_alta',
  47: 'generico'
};

interface VendaSimples {
  id: string;
  data: string;
  funcionario: string;
  cdfun: number;
  categoria: string;
  grupo: number;
  valor_bruto: number;
  valor_liquido: number;
  quantidade: number;
}

export default function Vendas() {
  const { user, loading: authLoading } = useAuth();
  const { selectedPeriod } = usePeriodContext();
  
  const [vendas, setVendas] = useState<VendaSimples[]>([]);
  const [funcionarios, setFuncionarios] = useState<{cdfun: number, nome: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('all');
  const [funcionarioFilter, setFuncionarioFilter] = useState<string>('all');
  const [filtroAdicional, setFiltroAdicional] = useState<string>('periodo');
  const [selectedLojaId, setSelectedLojaId] = useState<number | null>(null);
  const [lojaInfo, setLojaInfo] = useState<{numero: string, nome: string} | null>(null);
  
  const canViewAllStores = user?.tipo && ['admin', 'supervisor', 'compras'].includes(user.tipo);
  const currentLojaId = canViewAllStores ? selectedLojaId : (user?.loja_id || null);

  // Filtrar vendas
  const filteredVendas = useMemo(() => {
    return vendas.filter(venda => {
      const matchesSearch = venda.funcionario.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           venda.categoria.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategoria = categoriaFilter === 'all' || venda.categoria === categoriaFilter;
      const matchesFuncionario = funcionarioFilter === 'all' || venda.cdfun.toString() === funcionarioFilter;
      return matchesSearch && matchesCategoria && matchesFuncionario;
    });
  }, [vendas, searchTerm, categoriaFilter, funcionarioFilter]);

  // Cálculos simples
  const calculatedData = useMemo(() => {
    const totalGeral = vendas.reduce((sum, venda) => sum + venda.valor_liquido, 0);
    const totalFiltrado = filteredVendas.reduce((sum, venda) => sum + venda.valor_liquido, 0);
    const ticketMedio = filteredVendas.length > 0 ? totalFiltrado / filteredVendas.length : 0;
    
    return {
      totalGeral,
      totalFiltrado,
      ticketMedio,
      totalTransacoes: vendas.length,
      transacoesFiltradas: filteredVendas.length
    };
  }, [vendas, filteredVendas]);

  // Buscar informações da loja
  useEffect(() => {
    if (currentLojaId) {
      fetchLojaInfo();
    }
  }, [currentLojaId]);

  // Buscar vendas quando mudar
  useEffect(() => {
    if (user && selectedPeriod && lojaInfo) {
      fetchVendas();
    }
  }, [user, selectedPeriod, lojaInfo, filtroAdicional]);

  const fetchLojaInfo = async () => {
    if (!currentLojaId) return;
    
    try {
      const { data, error } = await supabase
        .from('lojas')
        .select('numero, nome')
        .eq('id', currentLojaId)
        .single();

      if (error) throw error;
      setLojaInfo(data);
    } catch (error) {
      console.error('Erro ao buscar loja:', error);
    }
  };

  const fetchVendas = async () => {
    if (!lojaInfo || !selectedPeriod) return;
    
    try {
      setLoading(true);
      
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
        const dataInicioAjustada = new Date(selectedPeriod.startDate);
        dataInicioAjustada.setDate(dataInicioAjustada.getDate() + 1);
        dataInicio = format(dataInicioAjustada, 'yyyy-MM-dd');
        dataFim = format(selectedPeriod.endDate, 'yyyy-MM-dd');
      }

      console.log('🔍 Buscando vendas:', {
        loja: lojaInfo.numero,
        periodo: `${dataInicio} até ${dataFim}`,
        filtro: filtroAdicional
      });

      // Buscar da API
      const { data, error } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/financeiro/vendas-por-funcionario',
          params: {
            dataFim,
            dataIni: dataInicio,
            groupBy: 'scekarde.DATA,scefun.CDFUN,sceprodu.CDGRUPO',
            orderBy: 'scekarde.DATA desc',
            filtroFiliais: lojaInfo.numero.padStart(2, '0')
          }
        }
      });

      if (error) throw error;

      const dadosAPI = data?.msg || [];
      console.log('📊 Dados recebidos da API:', dadosAPI.length, 'registros');

      // Filtrar apenas registros da loja correta
      const dadosDaLoja = dadosAPI.filter((item: any) => {
        return item.CDFIL?.toString() === lojaInfo.numero;
      });

      console.log('🏪 Dados filtrados da loja', lojaInfo.numero + ':', dadosDaLoja.length, 'registros');

      // TOTAL GERAL = Somar TODOS os registros da loja (sem filtro por categoria)
      const totalGeralLoja = dadosDaLoja.reduce((sum: number, item: any) => {
        const valorBruto = parseFloat(item.TOTAL_VLR_VE || 0);
        const valorDevolucao = parseFloat(item.TOTAL_VLR_DV || 0);
        const valorLiquido = valorBruto - valorDevolucao;
        return sum + valorLiquido;
      }, 0);

      console.log('💰 TOTAL GERAL DA LOJA:', totalGeralLoja.toFixed(2));

      // Processar cada registro UMA VEZ SÓ (sem duplicações)
      const vendasProcessadas: VendaSimples[] = [];
      const funcionariosSet = new Set<string>();

      dadosDaLoja.forEach((item: any, index: number) => {
        const valorBruto = parseFloat(item.TOTAL_VLR_VE || 0);
        const valorDevolucao = parseFloat(item.TOTAL_VLR_DV || 0);
        const valorLiquido = valorBruto - valorDevolucao;
        const quantidade = (item.TOTAL_QTD_VE || 0) - (item.TOTAL_QTD_DV || 0);

        if (valorLiquido > 0 && quantidade > 0) {
          // Mapear grupo para categoria (SEM DUPLICAÇÃO)
          const categoria = GRUPOS_PARA_CATEGORIAS[item.CDGRUPO] || 'outros';
          
          vendasProcessadas.push({
            id: `${item.CDFUN}-${item.DATA}-${item.CDGRUPO}-${index}`,
            data: item.DATA?.split('T')[0] || '',
            funcionario: item.NOMEFUN || 'Desconhecido',
            cdfun: item.CDFUN || 0,
            categoria,
            grupo: item.CDGRUPO || 0,
            valor_bruto: valorBruto,
            valor_liquido: valorLiquido,
            quantidade
          });

          funcionariosSet.add(JSON.stringify({cdfun: item.CDFUN, nome: item.NOMEFUN}));
        }
      });

      // Extrair funcionários únicos
      const funcionariosUnicos = Array.from(funcionariosSet).map(f => JSON.parse(f));

      // Calcular totais por categoria ORIGINAL (sem agrupamentos)
      const porCategoriaOriginal = vendasProcessadas.reduce((acc, v) => {
        if (!acc[v.categoria]) acc[v.categoria] = {valor: 0, qtd: 0, registros: 0};
        acc[v.categoria].valor += v.valor_liquido;
        acc[v.categoria].qtd += v.quantidade;
        acc[v.categoria].registros += 1;
        return acc;
      }, {} as Record<string, {valor: number, qtd: number, registros: number}>);

      // Calcular agrupamentos para indicadores
      const gruposGenerico = [5, 6, 47]; // Genérico
      const gruposSimilar = [2, 21]; // Similar
      const gruposRentaveis = [20, 25]; // Rentáveis

      const totalGenericoSimilar = dadosDaLoja
        .filter((item: any) => [...gruposGenerico, ...gruposSimilar].includes(item.CDGRUPO))
        .reduce((sum: number, item: any) => {
          const valorLiquido = (item.TOTAL_VLR_VE || 0) - (item.TOTAL_VLR_DV || 0);
          return sum + valorLiquido;
        }, 0);

      const totalRentaveis = dadosDaLoja
        .filter((item: any) => gruposRentaveis.includes(item.CDGRUPO))
        .reduce((sum: number, item: any) => {
          const valorLiquido = (item.TOTAL_VLR_VE || 0) - (item.TOTAL_VLR_DV || 0);
          return sum + valorLiquido;
        }, 0);

      console.log('📈 Relatório de vendas:');
      console.log('├─ Total Geral:', totalGeralLoja.toFixed(2));
      console.log('├─ Por categoria original:', porCategoriaOriginal);
      console.log('├─ Genérico + Similar:', totalGenericoSimilar.toFixed(2));
      console.log('├─ Rentáveis (20+25):', totalRentaveis.toFixed(2));
      console.log('└─ Registros processados:', vendasProcessadas.length);

      setVendas(vendasProcessadas);
      setFuncionarios(funcionariosUnicos);
      
    } catch (error) {
      console.error('Erro ao buscar vendas:', error);
      toast.error('Erro ao carregar vendas da API');
    } finally {
      setLoading(false);
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
            API Externa Callfarma - Debug Mode
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

      {/* Statistics Cards Simples */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Vendas</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground">
                  R$ {calculatedData.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {calculatedData.totalTransacoes} transações
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
                <p className="text-xs text-muted-foreground">
                  Por transação
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
                <p className="text-xs sm:text-sm text-muted-foreground">Filtradas</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground">
                  R$ {calculatedData.totalFiltrado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {calculatedData.transacoesFiltradas} transações
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
                <p className="text-xs sm:text-sm text-muted-foreground">Funcionários</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground">
                  {funcionarios.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  Com vendas
                </p>
              </div>
              <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-4 sm:mb-6">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>Filtros de Busca</span>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              Debug Mode - Console aberto
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
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
                <SelectItem value="periodo">Período Selecionado</SelectItem>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="ontem">Ontem</SelectItem>
                <SelectItem value="ultima_semana">Última Semana</SelectItem>
                <SelectItem value="ultimo_mes">Último Mês</SelectItem>
              </SelectContent>
            </Select>

            <Select value={funcionarioFilter} onValueChange={setFuncionarioFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Funcionário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Funcionários</SelectItem>
                {funcionarios.map((funcionario) => (
                  <SelectItem key={funcionario.cdfun} value={funcionario.cdfun.toString()}>
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
                <SelectItem value="rentaveis20">Rentáveis 20</SelectItem>
                <SelectItem value="rentaveis25">Rentáveis 25</SelectItem>
                <SelectItem value="perfumaria_alta">Perfumaria Alta</SelectItem>
                <SelectItem value="conveniencia">Conveniência</SelectItem>
                <SelectItem value="brinquedo">Brinquedo</SelectItem>
                <SelectItem value="goodlife">GoodLife</SelectItem>
                <SelectItem value="similar">Similar</SelectItem>
                <SelectItem value="generico">Genérico</SelectItem>
                <SelectItem value="dermocosmetico">Dermocosmético</SelectItem>
                <SelectItem value="outros">Outros</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              onClick={fetchVendas} 
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Carregando...' : 'Atualizar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Vendas */}
      <Card>
        <CardHeader>
          <CardTitle>
            Lista de Vendas ({filteredVendas.length} de {vendas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Carregando vendas da API...</span>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Valor Bruto</TableHead>
                      <TableHead>Valor Líquido</TableHead>
                      <TableHead>Qtd</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVendas.slice(0, 50).map((venda) => (
                      <TableRow key={venda.id}>
                        <TableCell>
                          {new Date(venda.data).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="font-medium">{venda.funcionario}</TableCell>
                        <TableCell>
                          <Badge className={getCategoriaColor(venda.categoria)} variant="secondary">
                            <i className={`${getIconeCategoria(venda.categoria)} mr-1`}></i>
                            {getNomeCategoria(venda.categoria)}
                          </Badge>
                        </TableCell>
                        <TableCell>{venda.grupo}</TableCell>
                        <TableCell>
                          R$ {venda.valor_bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="font-semibold">
                          R$ {venda.valor_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>{venda.quantidade}</TableCell>
                      </TableRow>
                    ))}
                    {filteredVendas.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhuma venda encontrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden space-y-3">
                {filteredVendas.slice(0, 20).map((venda) => (
                  <div key={venda.id} className="border rounded-lg p-4 bg-card">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm text-muted-foreground">
                        {new Date(venda.data).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="text-lg font-semibold">
                        R$ {venda.valor_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="font-medium">{venda.funcionario}</div>
                      <Badge className={getCategoriaColor(venda.categoria)} variant="secondary">
                        <i className={`${getIconeCategoria(venda.categoria)} mr-1`}></i>
                        {getNomeCategoria(venda.categoria)} (Grupo {venda.grupo})
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        Qtd: {venda.quantidade} | Bruto: R$ {venda.valor_bruto.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {filteredVendas.length > 50 && (
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  Mostrando primeiros 50 resultados. Abra o console (F12) para ver logs detalhados.
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}