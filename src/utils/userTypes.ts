/**
 * Sistema padronizado de tipos de usuário para toda a aplicação
 */

export type UserType = 
  | 'admin'
  | 'supervisor'
  | 'compras'
  | 'rh'
  | 'gerente'
  | 'gerentefarma'
  | 'lider'
  | 'subgerente'
  | 'subgerentefarma'
  | 'auxiliar'
  | 'aux1'
  | 'farmaceutico'
  | 'aux_conveniencia'
  | 'fiscal'
  | 'consultora'
  | 'sublider';

/**
 * Função para obter descrição amigável do tipo de usuário
 */
export function getDescricaoTipoUsuario(tipo: string): string {
  const descricoes: Record<string, string> = {
    'admin': 'Administrador',
    'supervisor': 'Supervisor',
    'compras': 'Compras',
    'rh': 'RH',
    'gerente': 'Gerente Loja',
    'gerentefarma': 'Gerente Farmacêutico',
    'lider': 'Gerente Loja',
    'subgerente': 'Auxiliar de Farmácia II - SUB',
    'subgerentefarma': 'Farmacêutico - SUB',
    'auxiliar': 'Auxiliar de Farmácia II',
    'aux1': 'Auxiliar de Farmácia I',
    'farmaceutico': 'Farmacêutico',
    'aux_conveniencia': 'Auxiliar de Farmácia I - Conveniência',
    'fiscal': 'Fiscal de Estacionamento',
    'consultora': 'Consultora de Beleza',
    'sublider': 'Auxiliar de Farmácia II - SUB'
  };
  
  return descricoes[tipo] ?? tipo.charAt(0).toUpperCase() + tipo.slice(1);
}

/**
 * Função para obter cor do badge baseado no tipo de usuário
 */
export function getCorTipoUsuario(tipo: string): string {
  const cores: Record<string, string> = {
    'admin': 'bg-red-500 hover:bg-red-600 text-white border-0',
    'supervisor': 'bg-indigo-600 hover:bg-indigo-700 text-white border-0',
    'compras': 'bg-purple-600 hover:bg-purple-700 text-white border-0',
    'rh': 'bg-teal-600 hover:bg-teal-700 text-white border-0',
    'gerente': 'bg-gray-900 hover:bg-gray-800 text-white border-0',
    'gerentefarma': 'bg-emerald-600 hover:bg-emerald-700 text-white border-0',
    'lider': 'bg-gray-900 hover:bg-gray-800 text-white border-0',
    'subgerente': 'bg-cyan-600 hover:bg-cyan-700 text-white border-0',
    'subgerentefarma': 'bg-cyan-500 hover:bg-cyan-600 text-white border-0',
    'farmaceutico': 'bg-green-500 hover:bg-green-600 text-white border-0',
    'auxiliar': 'bg-blue-500 hover:bg-blue-600 text-white border-0',
    'aux1': 'bg-blue-400 hover:bg-blue-500 text-white border-0',
    'aux_conveniencia': 'bg-orange-500 hover:bg-orange-600 text-white border-0',
    'fiscal': 'bg-yellow-600 hover:bg-yellow-700 text-white border-0',
    'consultora': 'bg-pink-500 hover:bg-pink-600 text-white border-0',
    'sublider': 'bg-blue-600 hover:bg-blue-700 text-white border-0'
  };
  
  return cores[tipo] || 'bg-gray-500 hover:bg-gray-600 text-white border-0';
}

/**
 * Função para obter todos os tipos de usuário disponíveis
 */
export function getTiposUsuario() {
  return [
    { value: 'admin', label: 'Administrador' },
    { value: 'supervisor', label: 'Supervisor' },
    { value: 'compras', label: 'Compras' },
    { value: 'rh', label: 'RH' },
    { value: 'gerente', label: 'Gerente Loja' },
    { value: 'gerentefarma', label: 'Gerente Farmacêutico' },
    { value: 'lider', label: 'Gerente Loja' },
    { value: 'subgerente', label: 'Auxiliar de Farmácia II - SUB' },
    { value: 'subgerentefarma', label: 'Farmacêutico - SUB' },
    { value: 'farmaceutico', label: 'Farmacêutico' },
    { value: 'auxiliar', label: 'Auxiliar de Farmácia II' },
    { value: 'aux1', label: 'Auxiliar de Farmácia I' },
    { value: 'aux_conveniencia', label: 'Auxiliar de Farmácia I - Conveniência' },
    { value: 'fiscal', label: 'Fiscal de Estacionamento' },
    { value: 'consultora', label: 'Consultora de Beleza' },
    { value: 'sublider', label: 'Auxiliar de Farmácia II - SUB' }
  ];
}

/**
 * Função para verificar se é um tipo de usuário com permissões administrativas
 */
export function isUserTypeAdmin(tipo: string): boolean {
  return ['admin'].includes(tipo);
}

/**
 * Função para verificar se pode ver todas as lojas
 */
export function canViewAllStores(tipo: string): boolean {
  return ['admin', 'supervisor', 'compras', 'rh'].includes(tipo);
}

/**
 * Função para verificar se pode editar usuários
 */
export function canEditUsers(tipo: string): boolean {
  return ['admin', 'rh', 'gerente', 'gerentefarma', 'lider'].includes(tipo);
}

/**
 * Função para verificar se pode editar usuários de qualquer loja
 */
export function canEditUsersAllStores(tipo: string): boolean {
  return ['admin', 'rh'].includes(tipo);
}

/**
 * Função para verificar se pode editar apenas usuários da própria loja
 */
export function canEditUsersOwnStore(tipo: string): boolean {
  return ['gerente', 'gerentefarma', 'lider'].includes(tipo);
}

/**
 * Função para verificar se pode apenas visualizar usuários
 */
export function canOnlyViewUsers(tipo: string): boolean {
  return ['subgerente', 'subgerentefarma', 'auxiliar', 'aux1', 'farmaceutico', 'aux_conveniencia', 'fiscal', 'consultora', 'supervisor', 'compras'].includes(tipo);
}

/**
 * Função para verificar se pode ver vendas de todos os funcionários
 */
export function canViewAllSales(tipo: string): boolean {
  return ['admin', 'supervisor', 'compras', 'rh', 'gerente', 'gerentefarma', 'lider', 'subgerente', 'subgerentefarma'].includes(tipo);
}

/**
 * Função para verificar se pode ver apenas suas próprias vendas
 */
export function canViewOwnSalesOnly(tipo: string): boolean {
  return ['auxiliar', 'aux1', 'aux_conveniencia', 'consultora'].includes(tipo);
}

/**
 * Função para verificar se pode ver vendas da loja (mas não individuais)
 */
export function canViewStoreSales(tipo: string): boolean {
  return ['fiscal', 'auxiliar', 'aux1', 'aux_conveniencia', 'consultora'].includes(tipo);
}

/**
 * Função para verificar se é um tipo de usuário farmacêutico
 */
export function isUserTypeFarmaceutico(tipo: string): boolean {
  return ['farmaceutico', 'subgerentefarma', 'gerentefarma'].includes(tipo);
}

/**
 * Função para verificar se pode editar a si mesmo
 */
export function canEditSelf(tipo: string): boolean {
  return ['admin'].includes(tipo); // Apenas admin pode editar a si mesmo
}