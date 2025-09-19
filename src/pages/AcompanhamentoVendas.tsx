/**
 * Página de Acompanhamento de Vendas - Versão Unificada
 * Implementa o sistema de comissões baseado em cargos e busca dados da API
 */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCallfarmaAPI } from '@/hooks/useCallfarmaAPI';
import { usePeriodContext } from '@/contexts/PeriodContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PeriodSelector } from '@/components/PeriodSelector';
import { StoreSelector } from '@/components/StoreSelector';
import { ProtectedRoute, ConditionalRender } from '@/components/ProtectedRoute';
import { 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  Target, 
  Users, 
  Store, 
  Share2, 
  BarChart3, 
  Clock, 
  Trophy,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { format, differenceInDays, isWeekend, addDays } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

export type UserRole = 
  | 'admin' 
  | 'gerente' 
  | 'gerentefarma' 
  | 'subgerentefarma' 
  | 'farmaceutico' 
  | 'subgerente' 
  | 'auxiliar' 
  | 'aux1' 
  | 'consultora' 
  | 'aux_conveniencia' 
  | 'supervisor' 
  | 'compras' 
  | 'rh' 
  | 'fiscal';

export interface UserPermissions {
  canAccessAllStores: boolean;
  canViewAllUsers: boolean;
  canEditUsers: boolean;
  canEditSelf: boolean;
  canViewAllSales: boolean;
  canViewOwnSales: boolean;
  canViewStoreSales: boolean;
  canManageSystem: boolean;
  canManageStores: boolean;
  canViewReports: boolean;
  canEditOwnStoreUsers: boolean;
}

export interface SalesData {
  [categoria: string]: number; // Mudança: usar string em vez de number
}

export interface CommissionConfig {
  [key: string]: number;
}

export interface CommissionResult {
  category: string;
  categoryName: string;
  salesAmount: number;
  rate: number;
  commission: number;
}

export interface CommissionSummary {
  results: CommissionResult[];
  totalCommission: number;
  isBonus: boolean;
}

interface UsuarioInfo {
  id: number;
  nome: string;
  matricula: string;
  tipo: string;
  loja_id: number;
}

interface AnalisePeriodo {
  total_dias: number;
  dias_trabalhados: number;
  dias_uteis_restantes: number;
  percentual_tempo: number;
}

interface VendaProcessada {
  id: string;
  cdfun: number;
  nomefun: string;
  cdfil: number;
  data_venda: string;
  categoria: string;
  valor_venda: number;
  valor_devolucao: number;
  valor_liquido: number;
}

interface Funcionario {
  id: number;
  nome: string;
}

// ============================================================================
// CONFIGURAÇÕES DE COMISSÕES E PRODUTOS
// ============================================================================

// Configuração de comissões por cargo (CORRIGIDA)
export const COMMISSION_RATES: Record<UserRole, CommissionConfig> = {
  // Gerentes e farmacêuticos: similar 2%, generico 2%, dermocosmetico 2%
  gerente: {
    similar: 0.02,
    generico: 0.02,         // ADICIONADO
    dermocosmetico: 0.02
  },
  
  gerentefarma: {
    similar: 0.02,
    generico: 0.02,         // ADICIONADO
    dermocosmetico: 0.02
  },
  
  subgerentefarma: {
    similar: 0.02,
    generico: 0.02,         // ADICIONADO
    dermocosmetico: 0.02
  },
  
  farmaceutico: {
    similar: 0.02,
    generico: 0.02,         // ADICIONADO
    dermocosmetico: 0.02
  },
  
  // Subgerente, auxiliar: similar 5%, generico 4,5%, dermocosmetico 2%
  subgerente: {
    similar: 0.05,
    generico: 0.045,        // ADICIONADO
    dermocosmetico: 0.02
  },
  
  auxiliar: {
    similar: 0.05,
    generico: 0.045,        // ADICIONADO
    dermocosmetico: 0.02
  },
  
  aux1: {
    similar: 0.05,
    generico: 0.045,        // ADICIONADO
    dermocosmetico: 0.02
  },
  
  // Consultora: perfumaria_alta 3%, dermocosmetico 2%, goodlife 5%
  consultora: {
    perfumaria_alta: 0.03,
    dermocosmetico: 0.02,
    goodlife: 0.05
  },
  
  // Auxiliar conveniência: brinquedos e conveniencia 2% (é bonus, não comissão)
  aux_conveniencia: {
    brinquedo: 0.02,
    conveniencia: 0.02
  },
  
  // Cargos administrativos sem comissão
  admin: {},
  supervisor: {},
  compras: {},
  rh: {},
  fiscal: {}
};

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

// Permissões por cargo
const ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
  admin: {
    canAccessAllStores: true,
    canViewAllUsers: true,
    canEditUsers: true,
    canEditSelf: true,
    canViewAllSales: true,
    canViewOwnSales: true,
    canViewStoreSales: true,
    canManageSystem: true,
    canManageStores: true,
    canViewReports: true,
    canEditOwnStoreUsers: true
  },
  gerente: {
    canAccessAllStores: false,
    canViewAllUsers: false,
    canEditUsers: false,
    canEditSelf: true,
    canViewAllSales: true,
    canViewOwnSales: true,
    canViewStoreSales: true,
    canManageSystem: false,
    canManageStores: false,
    canViewReports: true,
    canEditOwnStoreUsers: true
  },
  gerentefarma: {
    canAccessAllStores: false,
    canViewAllUsers: false,
    canEditUsers: false,
    canEditSelf: true,
    canViewAllSales: true,
    canViewOwnSales: true,
    canViewStoreSales: true,
    canManageSystem: false,
    canManageStores: false,
    canViewReports: true,
    canEditOwnStoreUsers: true
  },
  subgerentefarma: {
    canAccessAllStores: false,
    canViewAllUsers: false,
    canEditUsers: false,
    canEditSelf: true,
    canViewAllSales: false,
    canViewOwnSales: true,
    canViewStoreSales: false,
    canManageSystem: false,
    canManageStores: false,
    canViewReports: false,
    canEditOwnStoreUsers: false
  },
  farmaceutico: {
    canAccessAllStores: false,
    canViewAllUsers: false,
    canEditUsers: false,
    canEditSelf: true,
    canViewAllSales: false,
    canViewOwnSales: true,
    canViewStoreSales: false,
    canManageSystem: false,
    canManageStores: false,
    canViewReports: false,
    canEditOwnStoreUsers: false
  },
  subgerente: {
    canAccessAllStores: false,
    canViewAllUsers: false,
    canEditUsers: false,
    canEditSelf: true,
    canViewAllSales: false,
    canViewOwnSales: true,
    canViewStoreSales: false,
    canManageSystem: false,
    canManageStores: false,
    canViewReports: false,
    canEditOwnStoreUsers: false
  },
  auxiliar: {
    canAccessAllStores: false,
    canViewAllUsers: false,
    canEditUsers: false,
    canEditSelf: true,
    canViewAllSales: false,
    canViewOwnSales: true,
    canViewStoreSales: false,
    canManageSystem: false,
    canManageStores: false,
    canViewReports: false,
    canEditOwnStoreUsers: false
  },
  aux1: {
    canAccessAllStores: false,
    canViewAllUsers: false,
    canEditUsers: false,
    canEditSelf: true,
    canViewAllSales: false,
    canViewOwnSales: true,
    canViewStoreSales: false,
    canManageSystem: false,
    canManageStores: false,
    canViewReports: false,
    canEditOwnStoreUsers: false
  },
  consultora: {
    canAccessAllStores: false,
    canViewAllUsers: false,
    canEditUsers: false,
    canEditSelf: true,
    canViewAllSales: false,
    canViewOwnSales: true,
    canViewStoreSales: false,
    canManageSystem: false,
    canManageStores: false,
    canViewReports: false,
    canEditOwnStoreUsers: false
  },
  aux_conveniencia: {
    canAccessAllStores: false,
    canViewAllUsers: false,
    canEditUsers: false,
    canEditSelf: true,
    canViewAllSales: false,
    canViewOwnSales: true,
    canViewStoreSales: false,
    canManageSystem: false,
    canManageStores: false,
    canViewReports: false,
    canEditOwnStoreUsers: false
  },
  supervisor: {
    canAccessAllStores: true,
    canViewAllUsers: true,
    canEditUsers: false,
    canEditSelf: true,
    canViewAllSales: true,
    canViewOwnSales: true,
    canViewStoreSales: true,
    canManageSystem: false,
    canManageStores: false,
    canViewReports: true,
    canEditOwnStoreUsers: false
  },
  compras: {
    canAccessAllStores: false,
    canViewAllUsers: false,
    canEditUsers: false,
    canEditSelf: true,
    canViewAllSales: false,
    canViewOwnSales: false,
    canViewStoreSales: false,
    canManageSystem: false,
    canManageStores: false,
    canViewReports: false,
    canEditOwnStoreUsers: false
  },
  rh: {
    canAccessAllStores: false,
    canViewAllUsers: true,
    canEditUsers: true,
    canEditSelf: true,
    canViewAllSales: false,
    canViewOwnSales: false,
    canViewStoreSales: false,
    canManageSystem: false,
    canManageStores: false,
    canViewReports: false,
    canEditOwnStoreUsers: false
  },
  fiscal: {
    canAccessAllStores: true,
    canViewAllUsers: false,
    canEditUsers: false,
    canEditSelf: true,
    canViewAllSales: true,
    canViewOwnSales: true,
    canViewStoreSales: true,
    canManageSystem: false,
    canManageStores: false,
    canViewReports: true,
    canEditOwnStoreUsers: false
  }
};

// Funções de permissão
export function getUserPermissions(role: UserRole): UserPermissions {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.auxiliar;
}

export function hasPermission(role: UserRole, permission: keyof UserPermissions): boolean {
  const permissions = getUserPermissions(role);
  return permissions[permission];
}

export function canViewSalesData(role: UserRole, context: 'own' | 'store' | 'all'): boolean {
  const permissions = getUserPermissions(role);
  
  switch (context) {
    case 'own':
      return permissions.canViewOwnSales;
    case 'store':
      return permissions.canViewStoreSales;
    case 'all':
      return permissions.canViewAllSales;
    default:
      return false;
  }
}

// Funções de comissão
export function isBonus(role: UserRole): boolean {
  return role === 'aux_conveniencia';
}

export function getCommissionRates(role: UserRole): CommissionConfig {
  return COMMISSION_RATES[role] || {};
}

export function hasCommissions(role: UserRole): boolean {
  const rates = getCommissionRates(role);
  return Object.keys(rates).length > 0;
}

export function getCategoryDisplayName(category: string): string {
  const names: Record<string, string> = {
    'r_mais': 'Rentáveis R+',
    'goodlife': 'Good Life',
    'perfumaria_r_mais': 'Perfumaria R+',
    'conveniencia_r_mais': 'Conveniência R+',
    'geral': 'Geral'
  };
  
  return names[category] || category;
}

export function getDescricaoTipoUsuario(tipo: string): string {
  const descricoes: Record<string, string> = {
    'admin': 'Administrador',
    'gerente': 'Gerente',
    'gerentefarma': 'Gerente Farmácia',
    'subgerentefarma': 'Subgerente Farmácia',
    'farmaceutico': 'Farmacêutico',
    'subgerente': 'Subgerente',
    'auxiliar': 'Auxiliar',
    'aux1': 'Auxiliar Nível 1',
    'consultora': 'Consultora',
    'aux_conveniencia': 'Auxiliar Conveniência',
    'supervisor': 'Supervisor',
    'compras': 'Compras',
    'rh': 'Recursos Humanos',
    'fiscal': 'Fiscal'
  };
  
  return descricoes[tipo] || tipo;
}

// Mapear grupo da API para categoria (IGUAL ao Vendas.tsx)
export function mapearGrupoParaCategoria(cdgrupo: number): string {
  switch (cdgrupo) {
    case 20:
    case 25:
      return 'r_mais';
    case 36:
    case 13:
      return 'conveniencia_r_mais';
    case 46:
      return 'perfumaria_r_mais';
    case 22:
      return 'goodlife';
    default:
      return 'outros';
  }
}

export function calculateCommissions(role: UserRole, salesData: SalesData): CommissionSummary {
  const rates = getCommissionRates(role);
  const results: CommissionResult[] = [];
  let totalCommission = 0;
  
  // Para cada categoria configurada para o cargo
  Object.entries(rates).forEach(([category, rate]) => {
    const categoryTotal = salesData[category] || 0;
    
    if (categoryTotal > 0) {
      const commission = categoryTotal * rate;
      results.push({
        category,
        categoryName: getCategoryDisplayName(category),
        salesAmount: categoryTotal,
        rate,
        commission
      });
      totalCommission += commission;
    }
  });
  
  return {
    results,
    totalCommission,
    isBonus: isBonus(role)
  };
}

// Processar dados dos funcionários (IGUAL ao Vendas.tsx)
const processarDadosFuncionarios = (dados: any[]): VendaProcessada[] => {
  console.log('Processando dados dos funcionários:', dados.length, 'registros');
  
  const processados = dados.map((item, index) => {
    const categoria = mapearGrupoParaCategoria(item.CDGRUPO);
    const valorLiquido = (item.TOTAL_VLR_VE || 0) - (item.TOTAL_VLR_DV || 0);
    
    return {
      id: `${item.CDFIL}-${item.CDFUN}-${item.CDGRUPO}-${item.DATA}-${index}`,
      cdfun: item.CDFUN,
      nomefun: item.NOMEFUN,
      cdfil: item.CDFIL,
      data_venda: item.DATA.split('T')[0],
      categoria,
      valor_venda: item.TOTAL_VLR_VE || 0,
      valor_devolucao: item.TOTAL_VLR_DV || 0,
      valor_liquido: valorLiquido
    };
  }).filter(item => item.valor_liquido > 0);
  
  console.log('Dados processados:', processados.length, 'vendas válidas');
  return processados;
};

// ============================================================================
// HOOKS PERSONALIZADOS
// ============================================================================

interface UsePermissionsReturn {
  permissions: UserPermissions;
  hasPermission: (permission: keyof UserPermissions) => boolean;
  canViewSales: (context: 'own' | 'store' | 'all') => boolean;
  canViewOwnSales: boolean;
  userRole: UserRole | null;
}

function usePermissions(user: any): UsePermissionsReturn {
  const userRole = useMemo(() => {
    return user?.tipo as UserRole || null;
  }, [user?.tipo]);
  
  const permissions = useMemo(() => {
    if (!userRole) {
      return {
        canAccessAllStores: false,
        canViewAllUsers: false,
        canEditUsers: false,
        canEditSelf: false,
        canViewAllSales: false,
        canViewOwnSales: false,
        canViewStoreSales: false,
        canManageSystem: false,
        canManageStores: false,
        canViewReports: false,
        canEditOwnStoreUsers: false
      };
    }
    
    return getUserPermissions(userRole);
  }, [userRole]);
  
  const checkPermission = useMemo(() => {
    return (permission: keyof UserPermissions): boolean => {
      if (!userRole) return false;
      return hasPermission(userRole, permission);
    };
  }, [userRole]);
  
  const checkViewSales = useMemo(() => {
    return (context: 'own' | 'store' | 'all'): boolean => {
      if (!userRole) return false;
      return canViewSalesData(userRole, context);
    };
  }, [userRole]);
  
  return {
    permissions,
    hasPermission: checkPermission,
    canViewSales: checkViewSales,
    canViewOwnSales: permissions.canViewOwnSales,
    userRole
  };
}

interface UseCommissionsReturn {
  hasCommissions: boolean;
  isBonus: boolean;
  calculateCommissions: (salesData: SalesData) => CommissionSummary;
  formatCommission: (value: number) => string;
  formatRate: (rate: number) => string;
}

function useCommissions(userRole: UserRole | null): UseCommissionsReturn {
  const userHasCommissions = useMemo(() => {
    if (!userRole) return false;
    return hasCommissions(userRole);
  }, [userRole]);
  
  const userIsBonus = useMemo(() => {
    if (!userRole) return false;
    return isBonus(userRole);
  }, [userRole]);
  
  const calculate = useMemo(() => {
    return (salesData: SalesData): CommissionSummary => {
      if (!userRole) {
        return {
          results: [],
          totalCommission: 0,
          isBonus: false
        };
      }
      return calculateCommissions(userRole, salesData);
    };
  }, [userRole]);
  
  const formatCommission = useMemo(() => {
    return (value: number): string => {
      return value.toLocaleString('pt-BR', { 
        style: 'currency', 
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    };
  }, []);
  
  const formatRate = useMemo(() => {
    return (rate: number): string => {
      return `${(rate * 100).toFixed(1)}%`;
    };
  }, []);
  
  return {
    hasCommissions: userHasCommissions,
    isBonus: userIsBonus,
    calculateCommissions: calculate,
    formatCommission,
    formatRate
  };
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function AcompanhamentoVendasNovo() {
  const { user, loading: authLoading } = useAuth();
  const { selectedPeriod } = usePeriodContext();
  const callfarmaAPI = useCallfarmaAPI();

  // Hooks personalizados
  const { hasPermission, canViewSales, canViewOwnSales, userRole } = usePermissions(user);
  const { hasCommissions, isBonus, calculateCommissions, formatCommission, formatRate } = useCommissions(userRole);

  const [loading, setLoading] = useState(true);
  const [selectedLojaId, setSelectedLojaId] = useState<number | null>(null);
  const [funcionariosLoja, setFuncionariosLoja] = useState<UsuarioInfo[]>([]);
  const [selectedFuncionarioId, setSelectedFuncionarioId] = useState<string>('me');
  const [visualizacao, setVisualizacao] = useState<string>('resumo');
  
  // Estados iguais ao Vendas.tsx
  const [vendasProcessadas, setVendasProcessadas] = useState<VendaProcessada[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [salesData, setSalesData] = useState<SalesData>({});
  const [commissionSummary, setCommissionSummary] = useState<CommissionSummary>({
    results: [],
    totalCommission: 0,
    isBonus: false
  });
  const [analisePeriodo, setAnalisePeriodo] = useState<AnalisePeriodo>({
    total_dias: 0,
    dias_trabalhados: 0,
    dias_uteis_restantes: 0,
    percentual_tempo: 0
  });
  const [lojaInfo, setLojaInfo] = useState<{
    regiao: string;
    numero: string;
    nome: string;
    cdfil: number;
  } | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Verificações de acesso
  const canAccessAllStores = hasPermission('canAccessAllStores');
  const currentLojaId = selectedLojaId || user?.loja_id || null;
  const canViewAllSales = hasPermission('canViewAllSales');

  // Definir visualização padrão baseada em permissões
  useEffect(() => {
    if (user && userRole) {
      if (canViewAllSales) {
        setVisualizacao('comparativo');
      } else {
        setVisualizacao('resumo');
      }
    }
  }, [user, userRole, canViewAllSales]);

  // Definir loja inicial
  useEffect(() => {
    if (user && !canAccessAllStores && user.loja_id) {
      setSelectedLojaId(user.loja_id);
    }
  }, [user, canAccessAllStores]);

  // Buscar informações da loja (IGUAL ao Vendas.tsx)
  const fetchLojaInfo = async () => {
    if (!currentLojaId || isLoadingData) return;
    
    try {
      // Buscar apenas os campos que existem na tabela lojas
      const { data: lojaData, error: lojaError } = await supabase
        .from('lojas')
        .select('regiao, numero, nome, id')
        .eq('id', currentLojaId)
        .single();
      
      if (lojaError) throw lojaError;

      // Usar o campo 'numero' da loja como CDFIL para a API
      let cdfil = null;
      
      if (lojaData.numero) {
        cdfil = typeof lojaData.numero === 'string' ? parseInt(lojaData.numero) : lojaData.numero;
      } else {
        cdfil = lojaData.id;
      }

      const infoLoja = {
        regiao: lojaData.regiao || 'centro',
        numero: lojaData.numero || currentLojaId.toString(),
        nome: lojaData.nome || `Loja ${currentLojaId}`,
        cdfil
      };

      setLojaInfo(infoLoja);
      console.log('Loja carregada:', infoLoja);
      
    } catch (error) {
      console.error('Erro ao buscar informações da loja:', error);
    }
  };

  // Buscar funcionários da loja
  useEffect(() => {
    const fetchFuncionarios = async () => {
      if (!currentLojaId || !canViewAllSales) return;

      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select('id, nome, matricula, tipo, loja_id')
          .eq('loja_id', currentLojaId)
          .eq('ativo', true);

        if (error) {
          console.error('Erro ao buscar funcionários:', error);
          setFuncionariosLoja([]);
          return;
        }

        if (data) {
          setFuncionariosLoja(data);
        }
      } catch (error) {
        console.error('Erro ao buscar funcionários:', error);
        setFuncionariosLoja([]);
      }
    };

    fetchFuncionarios();
  }, [currentLojaId, canViewAllSales]);

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

  // Buscar vendas (COM GARANTIA DE FINALIZAR LOADING)
  const fetchVendas = async () => {
    try {
      if (!selectedPeriod) {
        console.log('❌ Período não selecionado');
        return;
      }
      
      const dataInicio = format(new Date(selectedPeriod.startDate), 'yyyy-MM-dd');
      const dataFim = format(new Date(selectedPeriod.endDate), 'yyyy-MM-dd');

      console.log(`🔍 Buscando dados API: ${dataInicio} a ${dataFim}`);

      // COPIANDO EXATAMENTE A LÓGICA DO RANKINGS
      console.log(`🔍 Buscando dados da API (igual ao Rankings)...`);
      
      const promises = [];
      
      // Buscar dados já agregados por categoria (igual Rankings)
      // Similar (grupos 2, 21, 20, 25, 22)
      promises.push(callfarmaAPI.buscarVendasFuncionarios({
        dataInicio,
        dataFim,
        filtroGrupos: '2,21,20,25,22'
      }));
      
      // Genérico (grupos 47, 5, 6)
      promises.push(callfarmaAPI.buscarVendasFuncionarios({
        dataInicio,
        dataFim,
        filtroGrupos: '47,5,6'
      }));
      
      // Perfumaria Alta (grupo 46)
      promises.push(callfarmaAPI.buscarVendasFuncionarios({
        dataInicio,
        dataFim,
        filtroGrupos: '46'
      }));
      
      // GoodLife (grupo 22)
      promises.push(callfarmaAPI.buscarVendasFuncionarios({
        dataInicio,
        dataFim,
        filtroGrupos: '22'
      }));
      
      // Dermocosmético (grupos 31, 16)
      promises.push(callfarmaAPI.buscarVendasFuncionarios({
        dataInicio,
        dataFim,
        filtroGrupos: '31,16'
      }));
      
      // Conveniência (grupo 36)
      promises.push(callfarmaAPI.buscarVendasFuncionarios({
        dataInicio,
        dataFim,
        filtroGrupos: '36'
      }));
      
      // Brinquedos (grupo 13)
      promises.push(callfarmaAPI.buscarVendasFuncionarios({
        dataInicio,
        dataFim,
        filtroGrupos: '13'
      }));
      
      const resultados = await Promise.all(promises);
      
      const [vendasSimilar, vendasGenerico, vendasPerfumaria, vendasGoodlife, vendasDermo, vendasConveniencia, vendasBrinquedo] = resultados;
      
      console.log('Dados recebidos (agregados como Rankings):', {
        similar: vendasSimilar?.length || 0,
        generico: vendasGenerico?.length || 0,
        perfumaria: vendasPerfumaria?.length || 0,
        goodlife: vendasGoodlife?.length || 0,
        dermocosmetico: vendasDermo?.length || 0,
        conveniencia: vendasConveniencia?.length || 0,
        brinquedo: vendasBrinquedo?.length || 0
      });
      
      // Filtrar por loja (IGUAL AO RANKINGS)
      const filtrarPorLoja = (vendas: any[]) => {
        if (!canAccessAllStores && user?.loja_id) {
          return vendas.filter(v => v.CDFIL === lojaInfo.cdfil);
        } else if (canAccessAllStores && selectedLojaId) {
          return vendas.filter(v => v.CDFIL === lojaInfo.cdfil);
        }
        return vendas;
      };
      
      const similarFiltradas = filtrarPorLoja(vendasSimilar || []);
      const genericoFiltradas = filtrarPorLoja(vendasGenerico || []);
      const perfumariaFiltradas = filtrarPorLoja(vendasPerfumaria || []);
      const goodlifeFiltradas = filtrarPorLoja(vendasGoodlife || []);
      const dermoFiltradas = filtrarPorLoja(vendasDermo || []);
      const convenienciaFiltradas = filtrarPorLoja(vendasConveniencia || []);
      const brinquedoFiltradas = filtrarPorLoja(vendasBrinquedo || []);
      
      console.log('Dados filtrados por loja (igual Rankings):', {
        similar: similarFiltradas.length,
        generico: genericoFiltradas.length,
        perfumaria: perfumariaFiltradas.length,
        goodlife: goodlifeFiltradas.length,
        dermocosmetico: dermoFiltradas.length,
        conveniencia: convenienciaFiltradas.length,
        brinquedo: brinquedoFiltradas.length
      });
      
      // Buscar CDFUN do usuário se necessário
      let funcionarioSelecionado = null;
      
      if (selectedFuncionarioId === 'me') {
        try {
          // Buscar usuário pela matrícula (que corresponde ao CDFUN da API)
          const { data: userData } = await supabase
            .from('usuarios')
            .select('matricula, nome')
            .eq('id', user.id)
            .single();
          
          console.log('Dados do usuário:', userData);
          
          // A matrícula do usuário deve corresponder ao CDFUN da API
          if (userData?.matricula) {
            funcionarioSelecionado = parseInt(userData.matricula);
            console.log(`Usando matrícula ${userData.matricula} como CDFUN para filtrar vendas`);
          }
        } catch (e) {
          console.warn('Erro ao buscar matrícula do usuário:', e);
        }
      } else if (selectedFuncionarioId !== 'all') {
        // Para funcionário específico selecionado, buscar sua matrícula
        try {
          const { data: funcionarioData } = await supabase
            .from('usuarios')
            .select('matricula, nome')
            .eq('id', parseInt(selectedFuncionarioId))
            .single();
          
          if (funcionarioData?.matricula) {
            funcionarioSelecionado = parseInt(funcionarioData.matricula);
            console.log(`Usando matrícula ${funcionarioData.matricula} do funcionário selecionado`);
          }
        } catch (e) {
          console.warn('Erro ao buscar matrícula do funcionário selecionado:', e);
        }
      }
      
      // Processar dados para o funcionário (IGUAL AO RANKINGS)
      const processarCategoria = (vendas: any[], funcionarioCdfun?: number) => {
        if (!vendas || vendas.length === 0) return 0;
        
        if (funcionarioCdfun) {
          // Buscar funcionário específico nos dados agregados
          const funcionario = vendas.find(v => v.CDFUN === funcionarioCdfun);
          const total = funcionario?.TOTAL_VALOR || 0;
          
          if (total > 0) {
            console.log(`  Funcionário ${funcionarioCdfun} encontrado com R$ ${total.toFixed(2)}`);
          }
          
          return total;
        } else {
          // Somar todos os funcionários
          return vendas.reduce((sum, v) => sum + (v.TOTAL_VALOR || 0), 0);
        }
      };
      
      // Calcular vendas por categoria (usando dados agregados)
      const salesData: SalesData = {};
      
      // Similar
      const totalSimilar = processarCategoria(similarFiltradas, funcionarioSelecionado);
      if (totalSimilar > 0) salesData['similar'] = totalSimilar;
      
      // Genérico  
      const totalGenerico = processarCategoria(genericoFiltradas, funcionarioSelecionado);
      if (totalGenerico > 0) salesData['generico'] = totalGenerico;
      
      // Perfumaria Alta
      const totalPerfumaria = processarCategoria(perfumariaFiltradas, funcionarioSelecionado);
      if (totalPerfumaria > 0) salesData['perfumaria_alta'] = totalPerfumaria;
      
      // GoodLife
      const totalGoodlife = processarCategoria(goodlifeFiltradas, funcionarioSelecionado);
      if (totalGoodlife > 0) salesData['goodlife'] = totalGoodlife;
      
      // Dermocosmético
      const totalDermo = processarCategoria(dermoFiltradas, funcionarioSelecionado);
      if (totalDermo > 0) salesData['dermocosmetico'] = totalDermo;
      
      // Conveniência
      const totalConveniencia = processarCategoria(convenienciaFiltradas, funcionarioSelecionado);
      if (totalConveniencia > 0) salesData['conveniencia'] = totalConveniencia;
      
      // Brinquedos
      const totalBrinquedo = processarCategoria(brinquedoFiltradas, funcionarioSelecionado);
      if (totalBrinquedo > 0) salesData['brinquedo'] = totalBrinquedo;
      
      console.log('💰 Vendas calculadas (método Rankings):', salesData);
      
      // Criar lista de funcionários únicos (igual Rankings)
      const todosFuncionarios = new Map();
      [
        ...similarFiltradas,
        ...genericoFiltradas, 
        ...perfumariaFiltradas,
        ...goodlifeFiltradas,
        ...dermoFiltradas,
        ...convenienciaFiltradas,
        ...brinquedoFiltradas
      ].forEach(v => {
        if (v.CDFUN && v.NOME) {
          todosFuncionarios.set(v.CDFUN, {
            id: v.CDFUN,
            nome: v.NOME
          });
        }
      });
      
      setFuncionarios(Array.from(todosFuncionarios.values()));
      console.log(`👥 Funcionários encontrados: ${todosFuncionarios.size}`);
      
      // Mock vendas processadas para compatibilidade
      const vendasMock: VendaProcessada[] = [];
      Object.entries(salesData).forEach(([categoria, valor]) => {
        if (valor > 0) {
          vendasMock.push({
            id: `mock-${categoria}`,
            cdfun: funcionarioSelecionado || 0,
            nomefun: user?.nome || 'Usuário',
            cdfil: lojaInfo.cdfil,
            data_venda: dataInicio,
            categoria,
            valor_venda: valor,
            valor_devolucao: 0,
            valor_liquido: valor
          });
        }
      });
      
      setVendasProcessadas(vendasMock);
      
      console.log('✅ Processamento concluído:', {
        funcionarioSelecionado,
        totalCategorias: Object.keys(salesData).length,
        totalVendas: Object.values(salesData).reduce((sum, v) => sum + v, 0)
      });

    } catch (error) {
      console.error('❌ Erro ao buscar vendas da API:', error);
      toast.error('Erro ao carregar dados de vendas da API');
      
      // Em caso de erro, limpar dados mas não deixar em loading
      setSalesData({});
      setVendasProcessadas([]);
      setFuncionarios([]);
    }
  };

  // useEffect principal (CORRIGIDO)
  useEffect(() => {
    if (!user) return;
    
    const initializeData = async () => {
      if (!lojaInfo && currentLojaId) {
        await fetchLojaInfo();
      }
    };

    initializeData();
  }, [user, currentLojaId]);

  // Fetch vendas quando tudo estiver pronto
  useEffect(() => {
    if (!user || !lojaInfo || !selectedPeriod) return;
    
    const loadData = async () => {
      setLoading(true);
      try {
        await fetchVendas();
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, lojaInfo, selectedPeriod, selectedFuncionarioId]);

  // Calcular vendas por categoria para comissões
  const vendasPorCategoria = useMemo(() => {
    const grouped = vendasProcessadas.reduce((acc, venda) => {
      const categoria = venda.categoria;
      
      if (!acc[categoria]) {
        acc[categoria] = 0;
      }
      acc[categoria] += venda.valor_liquido;
      return acc;
    }, {} as SalesData);

    console.log('Vendas por categoria:', grouped);
    return grouped;
  }, [vendasProcessadas]);

  // Atualizar salesData e comissões quando vendasPorCategoria mudar
  useEffect(() => {
    setSalesData(vendasPorCategoria);
    
    if (hasCommissions) {
      const summary = calculateCommissions(vendasPorCategoria);
      console.log('Comissões calculadas:', summary);
      setCommissionSummary(summary);
    } else {
      setCommissionSummary({
        results: [],
        totalCommission: 0,
        isBonus: false
      });
    }
    
    setAnalisePeriodo(calcularAnalisePeriodo);
  }, [vendasPorCategoria, hasCommissions, calculateCommissions, calcularAnalisePeriodo]);

  // Função para compartilhar no WhatsApp
  const handleShare = () => {
    const nomeUsuario = selectedFuncionarioId === 'me' ? user?.nome : funcionariosLoja.find(f => f.id.toString() === selectedFuncionarioId)?.nome;
    const periodo = selectedPeriod ? `${format(new Date(selectedPeriod.startDate), 'dd/MM/yyyy')} a ${format(new Date(selectedPeriod.endDate), 'dd/MM/yyyy')}` : '';
    
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

  if (authLoading || callfarmaAPI.loading || isLoadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {authLoading ? 'Verificando autenticação...' : 'Carregando dados da API...'}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Verificar se o usuário tem permissão para ver vendas
  if (!canViewOwnSales && !canViewSales('store') && !canViewSales('all')) {
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
            {selectedPeriod && (
              <span className="block text-sm text-muted-foreground/70 mt-1">
                Período: {selectedPeriod.label} (dia 21 ao dia 20)
              </span>
            )}
          </p>
        </div>
        
        <div className="flex gap-4 items-center">
          {canAccessAllStores && (
            <StoreSelector
              selectedLojaId={selectedLojaId}
              onLojaChange={setSelectedLojaId}
              userLojaId={user?.loja_id || 0}
            />
          )}
          
          {canViewAllSales && funcionariosLoja.length > 0 && (
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
          
          <Button onClick={handleShare} variant="outline" size="sm">
            <Share2 className="w-4 h-4 mr-2" />
            Compartilhar
          </Button>
        </div>
      </div>

      {/* Informações da Loja e Período */}
      {lojaInfo && selectedPeriod && (
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
      <Tabs value={visualizacao} onValueChange={setVisualizacao}>
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-3">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          {canViewAllSales && (
            <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
          )}
          <TabsTrigger value="detalhado">Detalhado</TabsTrigger>
        </TabsList>

        {/* Visualização Resumo */}
        <TabsContent value="resumo">
          {loading || isLoadingData ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              Carregando dados da API...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Cards de Comissões */}
              {commissionSummary.results.map((result) => (
                <Card key={result.category}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      {result.categoryName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vendas:</span>
                      <span className="font-medium">
                        R$ {result.salesAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Taxa:</span>
                      <span className="font-medium">{formatRate(result.rate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{commissionSummary.isBonus ? 'Bônus:' : 'Comissão:'}</span>
                      <span className="font-bold text-green-600">
                        {formatCommission(result.commission)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Card Total */}
              {commissionSummary.results.length > 0 && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-700">
                      <Trophy className="w-5 h-5" />
                      Total {commissionSummary.isBonus ? 'Bônus' : 'Comissões'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-700">
                        {formatCommission(commissionSummary.totalCommission)}
                      </p>
                      <p className="text-sm text-green-600 mt-1">Acumulado no período</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Mensagem quando não há comissões */}
              {commissionSummary.results.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhuma comissão encontrada</h3>
                    <p className="text-muted-foreground">
                      {hasCommissions 
                        ? 'Não há vendas nas categorias que geram comissão no período selecionado.'
                        : 'Seu cargo não possui sistema de comissões configurado.'
                      }
                    </p>
                    {vendasProcessadas.length > 0 && (
                      <div className="mt-4 text-sm text-muted-foreground">
                        <p>Vendas encontradas: {vendasProcessadas.length} registros</p>
                        <p>Total em vendas: R$ {vendasProcessadas.reduce((sum, v) => sum + v.valor_liquido, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Visualização Comparativa */}
        <TabsContent value="comparativo">
          {canViewAllSales ? (
            loading || isLoadingData ? (
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
                            const rates = getCommissionRates(funcRole);
                            
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
                                        {getCategoryDisplayName(category)}
                                      </Badge>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  <span className="text-muted-foreground">-</span>
                                </TableCell>
                                <TableCell className="text-right font-medium text-green-600">
                                  {funcHasCommissions ? (
                                    <>
                                      <span className="text-muted-foreground">-</span>
                                      {isBonus(funcRole) && (
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
            )
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-muted-foreground">Você não tem permissão para visualizar dados comparativos.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Visualização Detalhada */}
        <TabsContent value="detalhado">
          {loading || isLoadingData ? (
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
                            <Badge variant="outline">{formatRate(result.rate)} de comissão</Badge>
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
                              <p className="text-xl font-bold text-blue-600">{formatRate(result.rate)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">{commissionSummary.isBonus ? 'Bônus Gerado' : 'Comissão Gerada'}</p>
                              <p className="text-xl font-bold text-green-600">
                                {formatCommission(result.commission)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Debug Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-500" />
                    Debug - Dados da API
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <p>Total de vendas processadas: {vendasProcessadas.length}</p>
                    <p>Usuário logado: {user?.nome} (ID: {user?.id})</p>
                    <p>Funcionário selecionado: {selectedFuncionarioId}</p>
                    <p>Cargo: {user?.tipo}</p>
                    <p>Tem comissões: {hasCommissions ? 'Sim' : 'Não'}</p>
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Vendas por Categoria:</h4>
                      {Object.entries(salesData).map(([categoria, valor]) => (
                        <div key={categoria} className="flex justify-between py-1">
                          <span>{getCategoryDisplayName(categoria)}</span>
                          <span className="font-medium">R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}