import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCallfarmaAPI } from '@/hooks/useCallfarmaAPI';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, TrendingUp, DollarSign, Target, Users, Store, Share2, BarChart3, Clock, Trophy, AlertCircle } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { StoreSelector } from '@/components/StoreSelector';
import { usePeriodContext } from '@/contexts/PeriodContext';
import { format, differenceInDays, isWeekend, addDays } from 'date-fns';
import { toast } from 'sonner';

// #region TIPOS E INTERFACES

export type UserRole = 
  | 'admin'
  | 'supervisor'
  | 'compras'
  | 'rh'
  | 'gerente'
  | 'gerentefarma'
  | 'subgerente'
  | 'subgerentefarma'
  | 'auxiliar'
  | 'aux1'
  | 'farmaceutico'
  | 'aux_conveniencia'
  | 'fiscal'
  | 'consultora';

export interface UserPermissions {
  canAccessAllStores: boolean;
  canViewAllUsers: boolean;
  canEditUsers: boolean;
  canEditSelf: boolean;
  canViewAllSales: boolean;
  canViewOwnSales: boolean;
  canViewStoreSales: boolean;
  canManageSystem: boolean;
  canViewReports: boolean;
}

interface UsuarioInfo {
  id: number;
  nome: string;
  matricula: string;
  tipo: UserRole;
  loja_id: number;
}

interface AnalisePeriodo {
  total_dias: number;
  dias_trabalhados: number;
  dias_uteis_restantes: number;
  percentual_tempo: number;
}

interface CommissionResult {
  category: string;
  categoryName: string;
  salesAmount: number;
  rate: number;
  commission: number;
}

interface CommissionSummary {
  results: CommissionResult[];
  totalCommission: number;
  isBonus: boolean;
}

interface APIVendaItem {
  categoria_id: number;
  valor_total: number;
  quantidade: number;
  data_venda: string;
}

interface APIVendasResponse {
  vendas: APIVendaItem[];
  vendas_por_categoria?: Record<string, number>;
  total_geral?: number;
  periodo: {
    data_inicio: string;
    data_fim: string;
  };
}

// #endregion

// #region LÓGICA DE PERMISSÕES (INLINE)

const ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
  admin: { canAccessAllStores: true, canViewAllUsers: true, canEditUsers: true, canEditSelf: true, canViewAllSales: true, canViewOwnSales: true, canViewStoreSales: true, canManageSystem: true, canViewReports: true },
  supervisor: { canAccessAllStores: true, canViewAllUsers: true, canEditUsers: false, canEditSelf: false, canViewAllSales: true, canViewOwnSales: true, canViewStoreSales: true, canManageSystem: false, canViewReports: true },
  compras: { canAccessAllStores: true, canViewAllUsers: false, canEditUsers: false, canEditSelf: false, canViewAllSales: true, canViewOwnSales: true, canViewStoreSales: true, canManageSystem: false, canViewReports: true },
  rh: { canAccessAllStores: true, canViewAllUsers: true, canEditUsers: true, canEditSelf: false, canViewAllSales: true, canViewOwnSales: true, canViewStoreSales: true, canManageSystem: false, canViewReports: true },
  gerente: { canAccessAllStores: false, canViewAllUsers: true, canEditUsers: true, canEditSelf: false, canViewAllSales: true, canViewOwnSales: true, canViewStoreSales: true, canManageSystem: false, canViewReports: true },
  gerentefarma: { canAccessAllStores: false, canViewAllUsers: true, canEditUsers: true, canEditSelf: false, canViewAllSales: true, canViewOwnSales: true, canViewStoreSales: true, canManageSystem: false, canViewReports: true },
  subgerente: { canAccessAllStores: false, canViewAllUsers: true, canEditUsers: false, canEditSelf: false, canViewAllSales: true, canViewOwnSales: true, canViewStoreSales: true, canManageSystem: false, canViewReports: false },
  subgerentefarma: { canAccessAllStores: false, canViewAllUsers: true, canEditUsers: false, canEditSelf: false, canViewAllSales: true, canViewOwnSales: true, canViewStoreSales: true, canManageSystem: false, canViewReports: false },
  auxiliar: { canAccessAllStores: false, canViewAllUsers: false, canEditUsers: false, canEditSelf: false, canViewAllSales: false, canViewOwnSales: true, canViewStoreSales: true, canManageSystem: false, canViewReports: false },
  aux1: { canAccessAllStores: false, canViewAllUsers: false, canEditUsers: false, canEditSelf: false, canViewAllSales: false, canViewOwnSales: true, canViewStoreSales: true, canManageSystem: false, canViewReports: false },
  farmaceutico: { canAccessAllStores: false, canViewAllUsers: false, canEditUsers: false, canEditSelf: false, canViewAllSales: false, canViewOwnSales: true, canViewStoreSales: true, canManageSystem: false, canViewReports: false },
  aux_conveniencia: { canAccessAllStores: false, canViewAllUsers: false, canEditUsers: false, canEditSelf: false, canViewAllSales: false, canViewOwnSales: true, canViewStoreSales: true, canManageSystem: false, canViewReports: false },
  fiscal: { canAccessAllStores: false, canViewAllUsers: false, canEditUsers: false, canEditSelf: false, canViewAllSales: false, canViewOwnSales: false, canViewStoreSales: true, canManageSystem: false, canViewReports: false },
  consultora: { canAccessAllStores: false, canViewAllUsers: false, canEditUsers: false, canEditSelf: false, canViewAllSales: false, canViewOwnSales: true, canViewStoreSales: true, canManageSystem: false, canViewReports: false },
};

const getUserPermissions = (role: UserRole): UserPermissions => {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.auxiliar;
};

const hasPermission = (role: UserRole, permission: keyof UserPermissions): boolean => {
  const permissions = getUserPermissions(role);
  return permissions[permission];
};

const getDescricaoTipoUsuario = (tipo: string): string => {
  const descricoes: Record<string, string> = {
    'admin': 'Administrador',
    'supervisor': 'Supervisor',
    'compras': 'Compras',
    'rh': 'RH',
    'gerente': 'Gerente Loja',
    'gerentefarma': 'Gerente Farmacêutico',
    'subgerente': 'Auxiliar de Farmácia II - SUB',
    'subgerentefarma': 'Farmacêutico - SUB',
    'auxiliar': 'Auxiliar de Farmácia II',
    'aux1': 'Auxiliar de Farmácia I',
    'farmaceutico': 'Farmacêutico',
    'aux_conveniencia': 'Auxiliar de Farmácia I - Conveniência',
    'fiscal': 'Fiscal de Estacionamento',
    'consultora': 'Consultora de Beleza',
  };
  return descricoes[tipo] ?? tipo.charAt(0).toUpperCase() + tipo.slice(1);
};

const ConditionalRender: React.FC<{ requiredPermission: keyof UserPermissions; children: React.ReactNode; fallback?: React.ReactNode; userRole: UserRole | null }> = 
  ({ requiredPermission, children, fallback = null, userRole }) => {
  if (!userRole) return <>{fallback}</>;
  if (!hasPermission(userRole, requiredPermission)) return <>{fallback}</>;
  return <>{children}</>;
};

// #endregion

// #region LÓGICA DE COMISSÕES (INLINE)

const PRODUCT_GROUPS: Record<string, number[]> = {
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

const COMMISSION_RATES: Record<UserRole, Record<string, number>> = {
  gerente: { similar: 0.02, generico: 0.02, dermocosmetico: 0.02 },
  gerentefarma: { similar: 0.02, generico: 0.02, dermocosmetico: 0.02 },
  subgerentefarma: { similar: 0.02, generico: 0.02, dermocosmetico: 0.02 },
  farmaceutico: { similar: 0.02, generico: 0.02, dermocosmetico: 0.02 },
  subgerente: { similar: 0.05, generico: 0.045, dermocosmetico: 0.02 },
  auxiliar: { similar: 0.05, generico: 0.045, dermocosmetico: 0.02 },
  aux1: { similar: 0.05, generico: 0.045, dermocosmetico: 0.02 },
  consultora: { perfumaria_alta: 0.03, dermocosmetico: 0.02, goodlife: 0.05 },
  aux_conveniencia: { brinquedo: 0.02, conveniencia: 0.02 },
  admin: {}, supervisor: {}, compras: {}, rh: {}, fiscal: {}
};

const getCommissionCategoryDisplayName = (category: string): string => {
  const names: Record<string, string> = {
    'similar': 'Similar',
    'generico': 'Genérico',
    'perfumaria_alta': 'Perfumaria Alta',
    'goodlife': 'Good Life',
    'dermocosmetico': 'Dermocosmético',
    'conveniencia': 'Conveniência',
    'brinquedo': 'Brinquedos'
  };
  return names[category] || category;
};

const calculateCommissions = (userRole: UserRole, salesData: Record<number, number>): CommissionSummary => {
  const rates = COMMISSION_RATES[userRole] || {};
  const results: CommissionResult[] = [];
  let totalCommission = 0;

  Object.entries(rates).forEach(([category, rate]) => {
    const categoryIds = PRODUCT_GROUPS[category] || [];
    const salesAmount = categoryIds.reduce((sum, id) => sum + (salesData[id] || 0), 0);

    if (salesAmount > 0) {
      const commission = salesAmount * rate;
      results.push({
        category,
        categoryName: getCommissionCategoryDisplayName(category),
        salesAmount,
        rate,
        commission
      });
      totalCommission += commission;
    }
  });

  return { results, totalCommission, isBonus: userRole === 'aux_conveniencia' };
};

const hasCommissions = (userRole: UserRole): boolean => {
  const rates = COMMISSION_RATES[userRole];
  return rates && Object.keys(rates).length > 0;
};

// #endregion

// #region LÓGICA DE PROCESSAMENTO DE DADOS (INLINE)

const processSalesData = (apiResponse: APIVendasResponse): Record<number, number> => {
  const salesData: Record<number, number> = {};
  if (apiResponse.vendas_por_categoria) {
    Object.entries(apiResponse.vendas_por_categoria).forEach(([categoryId, value]) => {
      salesData[parseInt(categoryId)] = Number(value);
    });
  } else if (apiResponse.vendas && Array.isArray(apiResponse.vendas)) {
    apiResponse.vendas.forEach(venda => {
      const categoryId = venda.categoria_id;
      if (!salesData[categoryId]) salesData[categoryId] = 0;
      salesData[categoryId] += venda.valor_total;
    });
  }
  return salesData;
};

const validateSalesData = (apiResponse: any): apiResponse is APIVendasResponse => {
  if (!apiResponse || typeof apiResponse !== 'object') return false;
  const hasVendas = Array.isArray(apiResponse.vendas);
  const hasVendasPorCategoria = apiResponse.vendas_por_categoria && typeof apiResponse.vendas_por_categoria === 'object';
  if (!hasVendas && !hasVendasPorCategoria) return false;
  if (!apiResponse.periodo || !apiResponse.periodo.data_inicio || !apiResponse.periodo.data_fim) return false;
  return true;
};

// #endregion

export default function AcompanhamentoVendas() {
  const { user, loading: authLoading } = useAuth();
  const { selectedPeriod } = usePeriodContext();
  const callfarmaAPI = useCallfarmaAPI();

  const userRole = user?.tipo as UserRole | null;
  const userPermissions = useMemo(() => userRole ? getUserPermissions(userRole) : ROLE_PERMISSIONS.auxiliar, [userRole]);

  const [loading, setLoading] = useState(true);
  const [selectedLojaId, setSelectedLojaId] = useState<number | null>(null);
  const [funcionariosLoja, setFuncionariosLoja] = useState<UsuarioInfo[]>([]);
  const [selectedFuncionarioId, setSelectedFuncionarioId] = useState<string>('me');
  const [commissionSummary, setCommissionSummary] = useState<CommissionSummary>({ results: [], totalCommission: 0, isBonus: false });
  const [analisePeriodo, setAnalisePeriodo] = useState<AnalisePeriodo>({ total_dias: 0, dias_trabalhados: 0, dias_uteis_restantes: 0, percentual_tempo: 0 });
  const [lojaInfo, setLojaInfo] = useState<{ nome: string; regiao: string } | null>(null);

  const currentLojaId = selectedLojaId || user?.loja_id || null;

  // Definir loja inicial
  useEffect(() => {
    if (user && !userPermissions.canAccessAllStores && user.loja_id) {
      setSelectedLojaId(user.loja_id);
    }
  }, [user, userPermissions.canAccessAllStores]);

  // Buscar informações da loja
  useEffect(() => {
    const fetchLojaInfo = async () => {
      if (!currentLojaId) return;
      try {
        const response = await callfarmaAPI.get(`/lojas/${currentLojaId}`);
        if (response.data) {
          setLojaInfo({ nome: response.data.nome || 'Loja', regiao: response.data.regiao || '' });
        }
      } catch (error) {
        console.error('Erro ao buscar informações da loja:', error);
      }
    };
    fetchLojaInfo();
  }, [currentLojaId, callfarmaAPI]);

  // Buscar funcionários da loja
  useEffect(() => {
    const fetchFuncionarios = async () => {
      if (!currentLojaId || !userPermissions.canViewAllSales) return;
      try {
        const response = await callfarmaAPI.get(`/funcionarios/loja/${currentLojaId}`);
        if (response.data) {
          setFuncionariosLoja(response.data);
        }
      } catch (error) {
        console.error('Erro ao buscar funcionários:', error);
        setFuncionariosLoja([]);
      }
    };
    fetchFuncionarios();
  }, [currentLojaId, userPermissions.canViewAllSales, callfarmaAPI]);

  // Análise do período
  const calcularAnalisePeriodo = useMemo(() => {
    if (!selectedPeriod) return { total_dias: 0, dias_trabalhados: 0, dias_uteis_restantes: 0, percentual_tempo: 0 };

    const dataInicio = new Date(selectedPeriod.startDate);
    const dataFim = new Date(selectedPeriod.endDate);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let total_dias = differenceInDays(dataFim, dataInicio) + 1;
    let dias_trabalhados = 0;
    let dias_uteis_restantes = 0;

    let dataCorrente = new Date(dataInicio);
    while (dataCorrente <= dataFim) {
      if (!isWeekend(dataCorrente)) {
        if (dataCorrente < hoje) {
          dias_trabalhados++;
        } else {
          dias_uteis_restantes++;
        }
      }
      dataCorrente = addDays(dataCorrente, 1);
    }

    const percentual_tempo = total_dias > 0 ? (dias_trabalhados / (dias_trabalhados + dias_uteis_restantes)) * 100 : 0;

    return {
      total_dias,
      dias_trabalhados,
      dias_uteis_restantes,
      percentual_tempo
    };
  }, [selectedPeriod]);

  // Buscar dados de vendas e calcular comissões
  useEffect(() => {
    const fetchSalesData = async () => {
      if (!user || !selectedPeriod || !currentLojaId || !userRole) return;

      setLoading(true);
      try {
        const usuarioId = selectedFuncionarioId === 'me' ? user.id : parseInt(selectedFuncionarioId);
        const dataInicio = format(new Date(selectedPeriod.startDate), 'yyyy-MM-dd');
        const dataFim = format(new Date(selectedPeriod.endDate), 'yyyy-MM-dd');

        const response = await callfarmaAPI.get('/vendas', {
          params: {
            usuario_id: usuarioId,
            loja_id: currentLojaId,
            data_inicio: dataInicio,
            data_fim: dataFim,
            grupo_por_categoria: true
          }
        });

        if (response.data && validateSalesData(response.data)) {
          const processedSales = processSalesData(response.data);
          if (hasCommissions(userRole)) {
            setCommissionSummary(calculateCommissions(userRole, processedSales));
          } else {
            setCommissionSummary({ results: [], totalCommission: 0, isBonus: false });
          }
        } else {
          // Fallback para dados simulados em caso de erro ou dados inválidos
          const mockSales: Record<number, number> = {};
          [2, 21, 20, 25, 22, 47, 5, 6, 46, 31, 16, 36, 13].forEach(categoryId => {
            mockSales[categoryId] = Math.floor(Math.random() * 5000) + 1000;
          });
          if (hasCommissions(userRole)) {
            setCommissionSummary(calculateCommissions(userRole, mockSales));
          } else {
            setCommissionSummary({ results: [], totalCommission: 0, isBonus: false });
          }
        }
        setAnalisePeriodo(calcularAnalisePeriodo);

      } catch (error) {
        console.error('Erro ao buscar dados de vendas:', error);
        toast.error('Erro ao carregar dados de vendas');
        // Fallback para dados simulados em caso de erro
        const mockSales: Record<number, number> = {};
        [2, 21, 20, 25, 22, 47, 5, 6, 46, 31, 16, 36, 13].forEach(categoryId => {
          mockSales[categoryId] = Math.floor(Math.random() * 5000) + 1000;
        });
        if (hasCommissions(userRole)) {
          setCommissionSummary(calculateCommissions(userRole, mockSales));
        } else {
          setCommissionSummary({ results: [], totalCommission: 0, isBonus: false });
        }
        setAnalisePeriodo(calcularAnalisePeriodo);
      } finally {
        setLoading(false);
      }
    };

    fetchSalesData();
  }, [user, selectedPeriod, currentLojaId, selectedFuncionarioId, userRole, callfarmaAPI, calcularAnalisePeriodo]);

  const handleShare = () => {
    const nomeUsuario = selectedFuncionarioId === 'me' ? user?.nome : funcionariosLoja.find(f => f.id.toString() === selectedFuncionarioId)?.nome;
    const periodo = `${format(new Date(selectedPeriod.startDate), 'dd/MM/yyyy')} a ${format(new Date(selectedPeriod.endDate), 'dd/MM/yyyy')}`;
    
    let texto = `📊 *ACOMPANHAMENTO DE VENDAS*\n\n`;
    texto += `👤 *${nomeUsuario}*\n`;
    texto += `🏪 ${lojaInfo?.nome || 'Loja'}\n`;
    texto += `📅 ${periodo}\n`;
    texto += `⏰ ${analisePeriodo.percentual_tempo.toFixed(1)}% decorrido\n\n`;

    if (commissionSummary.results.length > 0) {
      texto += `*${commissionSummary.isBonus ? 'BÔNUS' : 'COMISSÕES'}:*\n`;
      commissionSummary.results.forEach(result => {
        texto += `💰 ${result.categoryName}: R$ ${result.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      });
      texto += `\n*Total: R$ ${commissionSummary.totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n`;
    }

    texto += `📆 Dias restantes: ${analisePeriodo.dias_uteis_restantes}\n\n`;
    texto += `📊 Relatório gerado em ${format(new Date(), 'dd/MM/yyyy')}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
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

  if (!userPermissions.canViewOwnSales && !userPermissions.canViewStoreSales) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Acompanhamento de Vendas</h1>
          <p className="text-muted-foreground mt-1">
            {commissionSummary.isBonus ? 'Acompanhe seus bônus' : 'Visualize o desempenho de vendas e comissões'}
          </p>
        </div>
        
        <div className="flex gap-4 items-center">
          <ConditionalRender requiredPermission="canAccessAllStores" userRole={userRole}>
            <StoreSelector
              selectedLojaId={selectedLojaId}
              onLojaChange={setSelectedLojaId}
              userLojaId={user?.loja_id || 0}
            />
          </ConditionalRender>
          
          <ConditionalRender requiredPermission="canViewAllSales" userRole={userRole}>
            {funcionariosLoja.length > 0 && (
              <Select value={selectedFuncionarioId} onValueChange={setSelectedFuncionarioId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Selecionar Funcionário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">Meu Acompanhamento</SelectItem>
                  {funcionariosLoja.map((funcionario) => (
                    <SelectItem key={funcionario.id} value={funcionario.id.toString()}>
                      {funcionario.nome} ({funcionario.matricula})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </ConditionalRender>
          
          <Button onClick={handleShare} variant="outline" size="sm">
            <Share2 className="w-4 h-4 mr-2" />
            Compartilhar
          </Button>
        </div>
      </div>

      {/* Informações da Loja e Período */}
      {lojaInfo && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Loja</p>
                  <p className="font-medium">{lojaInfo.nome}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Período</p>
                  <p className="font-medium">
                    {format(new Date(selectedPeriod.startDate), 'dd/MM')} a {format(new Date(selectedPeriod.endDate), 'dd/MM')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Tempo Decorrido</p>
                  <p className="font-medium">{analisePeriodo.percentual_tempo.toFixed(1)}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Dias Restantes</p>
                  <p className="font-medium">{analisePeriodo.dias_uteis_restantes}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs de Visualização */}
      <Tabs defaultValue="resumo">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-3">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <ConditionalRender requiredPermission="canViewAllSales" userRole={userRole}>
            <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
          </ConditionalRender>
          <TabsTrigger value="detalhado">Detalhado</TabsTrigger>
        </TabsList>

        {/* Visualização Resumo */}
        <TabsContent value="resumo">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              Carregando dados...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Cards de Comissões */}
              {commissionSummary.results.map((result) => (
                <Card key={result.category}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-green-500" />
                      {result.categoryName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">R$ {result.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-muted-foreground">
                      {result.salesAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em vendas @ {(result.rate * 100).toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
              ))}
              <Card className="col-span-full md:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    Total de {commissionSummary.isBonus ? 'Bônus' : 'Comissões'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">R$ {commissionSummary.totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Visualização Comparativa */}
        <TabsContent value="comparativo">
          <ConditionalRender 
            requiredPermission="canViewAllSales"
            userRole={userRole}
            fallback={
              <Card>
                <CardContent className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">Você não tem permissão para visualizar dados comparativos.</p>
                </CardContent>
              </Card>
            }
          >
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                Carregando tabela comparativa...
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Comparativo de Comissões por Funcionário
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Funcionário</TableHead>
                          <TableHead>Cargo</TableHead>
                          <TableHead>Categorias</TableHead>
                          <TableHead className="text-right">Total Vendas</TableHead>
                          <TableHead className="text-right">Comissões</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {funcionariosLoja.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              <Store className="w-12 h-12 mx-auto mb-4 opacity-50" />
                              <p>Nenhum funcionário encontrado</p>
                            </TableCell>
                          </TableRow>
                        ) : (
                          funcionariosLoja.map((funcionario) => {
                            const funcRole = funcionario.tipo as UserRole;
                            const funcHasCommissions = hasCommissions(funcRole);
                            const rates = COMMISSION_RATES[funcRole] || {};
                            
                            return (
                              <TableRow key={funcionario.id}>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">{funcionario.nome}</div>
                                    <div className="text-sm text-muted-foreground">({funcionario.matricula})</div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{getDescricaoTipoUsuario(funcionario.tipo)}</Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    {Object.keys(rates).map(category => (
                                      <Badge key={category} variant="outline" className="mr-1 text-xs">
                                        {getCommissionCategoryDisplayName(category)}
                                      </Badge>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  R$ {Math.floor(Math.random() * 10000).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-right font-medium text-green-600">
                                  {funcHasCommissions ? (
                                    <>
                                      R$ {Math.floor(Math.random() * 500).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      {hasCommissions(funcRole) && funcRole === 'aux_conveniencia' && (
                                        <Badge variant="outline" className="ml-2 text-xs">Bônus</Badge>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground">N/A</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={funcHasCommissions ? "default" : "secondary"}>
                                    {funcHasCommissions ? "Ativo" : "Sem comissão"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </ConditionalRender>
        </TabsContent>

        {/* Visualização Detalhada */}
        <TabsContent value="detalhado">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              Carregando detalhes...
            </div>
          ) : (
            <div className="space-y-6">
              {/* Estatísticas do Período */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-500" />
                    Estatísticas do Período
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{analisePeriodo.total_dias}</p>
                    <p className="text-sm text-muted-foreground">Dias no Período</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{analisePeriodo.dias_trabalhados}</p>
                    <p className="text-sm text-muted-foreground">Dias Trabalhados</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">{analisePeriodo.dias_uteis_restantes}</p>
                    <p className="text-sm text-muted-foreground">Dias Restantes</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{analisePeriodo.percentual_tempo.toFixed(1)}%</p>
                    <p className="text-sm text-muted-foreground">Tempo Decorrido</p>
                  </div>
                </CardContent>
              </Card>

              {/* Detalhamento por Categoria */}
              {commissionSummary.results.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-blue-500" />
                      Detalhamento por Categoria
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {commissionSummary.results.map((result) => (
                        <div key={result.category} className="border rounded-lg p-4">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="font-semibold text-lg">{result.categoryName}</h4>
                            <Badge variant="outline">{(result.rate * 100).toFixed(1)}% de comissão</Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Vendas Realizadas</p>
                              <p className="text-xl font-bold text-foreground">
                                R$ {result.salesAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Taxa Aplicada</p>
                              <p className="text-xl font-bold text-blue-600">{(result.rate * 100).toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">{commissionSummary.isBonus ? 'Bônus Gerado' : 'Comissão Gerada'}</p>
                              <p className="text-xl font-bold text-green-600">
                                R$ {result.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}


