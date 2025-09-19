import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, TrendingUp, DollarSign, Target, Users, Store } from 'lucide-react';
import { Navigate } from 'react-router-dom';
// import { PeriodSelector } from '@/components/PeriodSelector';
import { StoreSelector } from '@/components/StoreSelector';
import { canViewAllStores } from '@/utils/userTypes';

// Grupos de produtos para cálculo de comissões
const PRODUCT_GROUPS = {
  'similar': [2, 21, 20, 25, 22],  // Similar inclui rentáveis E goodlife
  'generico': [47, 5, 6],
  'perfumaria_alta': [46],
  'goodlife': [22],                 // Goodlife mantém categoria própria
  'rentaveis20': [20],              // Rentáveis mantêm categorias específicas
  'rentaveis25': [25],              // Rentáveis mantêm categorias específicas
  'dermocosmetico': [31, 16],
  'conveniencia': [36],
  'brinquedo': [13]
};

// Configuração de comissões por tipo de usuário
const COMMISSION_CONFIG = {
  'gerente': {
    categories: ['similar', 'generico', 'dermocosmetico'],
    rates: { similar: 0.02, generico: 0.02, dermocosmetico: 0.02 }
  },
  'gerentefarma': {
    categories: ['similar', 'generico', 'dermocosmetico'],
    rates: { similar: 0.02, generico: 0.02, dermocosmetico: 0.02 }
  },
  'farmaceutico': {
    categories: ['similar', 'generico', 'dermocosmetico'],
    rates: { similar: 0.02, generico: 0.02, dermocosmetico: 0.02 }
  },
  'subgerente': {
    categories: ['similar', 'generico', 'dermocosmetico'],
    rates: { similar: 0.05, generico: 0.045, dermocosmetico: 0.02 }
  },
  'auxiliar': {
    categories: ['similar', 'generico', 'dermocosmetico'],
    rates: { similar: 0.05, generico: 0.045, dermocosmetico: 0.02 }
  },
  'consultora': {
    categories: ['perfumaria_alta', 'dermocosmetico', 'goodlife'],
    rates: { perfumaria_alta: 0.03, dermocosmetico: 0.02, goodlife: 0.05 }
  },
  'aux_conveniencia': {
    categories: ['brinquedo', 'conveniencia'],
    rates: { brinquedo: 0.02, conveniencia: 0.02 },
    isBonus: true // Indica que é bônus, não comissão
  }
};

interface VendaData {
  usuario_id: number;
  nome: string;
  tipo: string;
  categoria: string;
  valor_venda: number;
  data_venda: string;
}

interface ComissionData {
  usuario_id: number;
  nome: string;
  tipo: string;
  vendas_por_categoria: Record<string, number>;
  comissoes_por_categoria: Record<string, number>;
  total_comissao: number;
  total_vendas: number;
}

export default function AcompanhamentoVendas() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('current');
  const [selectedLojaId, setSelectedLojaId] = useState<number | null>(null);
  const [comissionsData, setComissionsData] = useState<ComissionData[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('all');

  // Verificar se o usuário pode ver todas as lojas
  const hasMultiStoreAccess = user?.tipo && canViewAllStores(user.tipo);

  useEffect(() => {
    if (user && !hasMultiStoreAccess) {
      setSelectedLojaId(user.loja_id);
    }
  }, [user, hasMultiStoreAccess]);

  useEffect(() => {
    if (user && (hasMultiStoreAccess ? selectedLojaId : user.loja_id)) {
      fetchComissionsData();
    }
  }, [user, selectedPeriod, selectedLojaId]);

  const fetchComissionsData = async () => {
    try {
      setLoading(true);
      
      // Aqui você faria a chamada para a API para buscar as vendas
      // Por enquanto, vamos simular os dados
      const mockData: ComissionData[] = [
        {
          usuario_id: 1,
          nome: 'João Silva',
          tipo: 'farmaceutico',
          vendas_por_categoria: { similar: 5000, generico: 3000, dermocosmetico: 2000 },
          comissoes_por_categoria: { similar: 100, generico: 60, dermocosmetico: 40 },
          total_comissao: 200,
          total_vendas: 10000
        },
        {
          usuario_id: 2,
          nome: 'Maria Santos',
          tipo: 'auxiliar',
          vendas_por_categoria: { similar: 3000, generico: 2500, dermocosmetico: 1500 },
          comissoes_por_categoria: { similar: 150, generico: 112.5, dermocosmetico: 30 },
          total_comissao: 292.5,
          total_vendas: 7000
        }
      ];

      setComissionsData(mockData);
    } catch (error) {
      console.error('Erro ao buscar dados de comissões:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateCommission = (vendas: Record<string, number>, tipo: string): Record<string, number> => {
    const config = COMMISSION_CONFIG[tipo as keyof typeof COMMISSION_CONFIG];
    if (!config) return {};

    const comissoes: Record<string, number> = {};
    
    config.categories.forEach(category => {
      const valor = vendas[category] || 0;
      const rate = config.rates[category as keyof typeof config.rates] || 0;
      comissoes[category] = valor * rate;
    });

    return comissoes;
  };

  const getTotalCommission = (comissoes: Record<string, number>): number => {
    return Object.values(comissoes).reduce((sum, value) => sum + value, 0);
  };

  const getCategoryName = (category: string): string => {
    const names: Record<string, string> = {
      'similar': 'Similar',
      'generico': 'Genérico',
      'dermocosmetico': 'Dermocosmético',
      'perfumaria_alta': 'Perfumaria Alta',
      'goodlife': 'Good Life',
      'brinquedo': 'Brinquedos',
      'conveniencia': 'Conveniência'
    };
    return names[category] || category;
  };

  const getCommissionRate = (tipo: string, category: string): number => {
    const config = COMMISSION_CONFIG[tipo as keyof typeof COMMISSION_CONFIG];
    if (!config) return 0;
    return (config.rates[category as keyof typeof config.rates] || 0) * 100;
  };

  // Show loading while authentication is being checked
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

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const filteredData = selectedUser === 'all' 
    ? comissionsData 
    : comissionsData.filter(data => data.usuario_id.toString() === selectedUser);

  return (
    <div className="page-container space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Acompanhamento de Vendas</h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe as vendas e comissões dos colaboradores
          </p>
        </div>
        
        <div className="flex gap-4 items-center">
          {hasMultiStoreAccess && (
            <StoreSelector
              selectedLojaId={selectedLojaId}
              onLojaChange={setSelectedLojaId}
              userLojaId={user?.loja_id || 0}
            />
          )}
          
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Período atual" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Período atual</SelectItem>
              <SelectItem value="last">Período anterior</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os funcionários" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os funcionários</SelectItem>
                {comissionsData.map((data) => (
                  <SelectItem key={data.usuario_id} value={data.usuario_id.toString()}>
                    {data.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Vendas</p>
                <p className="text-2xl font-bold text-foreground">
                  R$ {filteredData.reduce((sum, data) => sum + data.total_vendas, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Comissões</p>
                <p className="text-2xl font-bold text-foreground">
                  R$ {filteredData.reduce((sum, data) => sum + data.total_comissao, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Funcionários</p>
                <p className="text-2xl font-bold text-foreground">{filteredData.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ticket Médio Comissão</p>
                <p className="text-2xl font-bold text-foreground">
                  R$ {filteredData.length > 0 
                    ? (filteredData.reduce((sum, data) => sum + data.total_comissao, 0) / filteredData.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                    : '0,00'
                  }
                </p>
              </div>
              <Target className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Comissões */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Detalhamento de Comissões por Funcionário
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando dados...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left p-4 font-medium text-foreground">Funcionário</th>
                    <th className="text-left p-4 font-medium text-foreground">Tipo</th>
                    <th className="text-left p-4 font-medium text-foreground">Categorias</th>
                    <th className="text-right p-4 font-medium text-foreground">Total Vendas</th>
                    <th className="text-right p-4 font-medium text-foreground">Total Comissão</th>
                    <th className="text-right p-4 font-medium text-foreground">% Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((data) => {
                    const config = COMMISSION_CONFIG[data.tipo as keyof typeof COMMISSION_CONFIG];
                    const percentualComissao = data.total_vendas > 0 ? (data.total_comissao / data.total_vendas) * 100 : 0;
                    
                    return (
                      <tr key={data.usuario_id} className="border-b border-border hover:bg-muted/50">
                        <td className="p-4">
                          <div className="font-medium text-foreground">{data.nome}</div>
                        </td>
                        <td className="p-4">
                          <Badge className="bg-primary text-primary-foreground">
                            {data.tipo}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1">
                            {config?.categories.map((category) => {
                              const valor = data.vendas_por_categoria[category] || 0;
                              const comissao = data.comissoes_por_categoria[category] || 0;
                              const rate = getCommissionRate(data.tipo, category);
                              
                              return valor > 0 ? (
                                <div key={category} className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">{getCategoryName(category)}</span>
                                  <span className="text-foreground">
                                    R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} 
                                    ({rate}%) = R$ {comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              ) : null;
                            })}
                          </div>
                        </td>
                        <td className="p-4 text-right font-medium text-foreground">
                          R$ {data.total_vendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-right font-medium text-green-600">
                          R$ {data.total_comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          {config && 'isBonus' in config && config.isBonus && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Bônus
                            </Badge>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <Badge variant={percentualComissao > 2 ? "default" : "secondary"}>
                            {percentualComissao.toFixed(2)}%
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              {filteredData.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Store className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum dado de comissão encontrado</p>
                  <p className="text-sm">Verifique o período selecionado ou se há vendas registradas.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}