// Tipos para o sistema de premiação

export interface Periodo {
  id: number;
  data_inicio: string;
  data_fim: string;
  descricao: string;
  status: 'ativo' | 'inativo';
}

export interface Usuario {
  id: number;
  nome: string;
  matricula: string;
  tipo: 'lider' | 'gerente' | 'farmaceutico' | 'auxiliar' | 'consultora' | 
        'aux1' | 'fiscal' | 'zelador' | 'aux_conveniencia';
  loja_id: number;
  data_contratacao: string;
  tempo_empresa?: number;
  status: 'ativo' | 'inativo';
}

export interface Loja {
  id: number;
  nome: string;
  regiao: 'centro' | 'outros';
}

export interface MetasLoja {
  meta_id: number;
  loja_id: number;
  periodo_id: number;
  geral: number;
  r_mais: number;
  perfumaria_r_mais: number;
  conveniencia_r_mais: number;
  saude: number;
}

export interface MetasUsuario {
  usuario_id: number;
  periodo_id: number;
  geral: number;
  generico_similar: number;
  goodlife: number;
  perfumaria_alta: number;
  dermocosmetico: number;
  conveniencia: number;
}

export interface VendasCategoria {
  valor: number;
  quantidade: number;
}

export interface VendasLoja {
  geral: VendasCategoria;
  r_mais: VendasCategoria;
  perfumaria_r_mais: VendasCategoria;
  conveniencia_r_mais: VendasCategoria;
  saude: VendasCategoria;
}

export interface VendasUsuario {
  generico: VendasCategoria;
  similar: VendasCategoria;
  goodlife: VendasCategoria;
  perfumaria_alta: VendasCategoria;
  dermocosmetico: VendasCategoria;
  conveniencia: VendasCategoria;
  brinquedo: VendasCategoria;
  rentaveis20: VendasCategoria;
  rentaveis25: VendasCategoria;
}

export interface Folga {
  usuario_id: number;
  data_folga: string;
}

export interface DiasUteis {
  dias_total: number;
  dias_uteis_total: number;
  dias_uteis_passados: number;
  dias_uteis_restantes: number;
  percentual_tempo: number;
}

export interface ProjecaoCategoria {
  valor_atual: number;
  percentual_atual: number;
  ritmo_diario: number;
  valor_projetado: number;
  percentual_projetado: number;
  meta: number;
  dias_passados: number;
  dias_restantes: number;
  status: 'atingido' | 'próximo' | 'distante';
}

export interface AnaliseRitmo {
  falta_para_meta: number;
  ritmo_atual: number;
  ritmo_necessario: number;
  diferenca_ritmo: number;
  pode_atingir: boolean;
  dias_criticos: {
    inicio_mes: boolean;
    fim_mes: boolean;
    ritmo_acelerado: boolean;
  };
}

export interface Insight {
  titulo: string;
  descricao: string;
  icone: string;
  cor: string;
  prioridade: 'alta' | 'media' | 'baixa';
}

export interface ResultadoGerencial {
  base_calculo: number;
  base_calculo_projetada: number;
  percentuais: Record<string, number>;
  multiplicadores: Record<string, number>;
  premiacoes: Record<string, number>;
  premiacao_total: number;
  multiplicadores_projetados: Record<string, number>;
  premiacoes_projetadas: Record<string, number>;
  premiacao_total_projetada: number;
  multiplicadores_maximos: Record<string, number>;
  premiacoes_maximas: Record<string, number>;
  premiacao_total_maxima: number;
  premiacao_total_maxima_projetada: number;
  faturamento_projetado: number;
}

export interface ResultadoFarmaceutico {
  premiacao_total: number;
  detalhes: {
    percentual_geral: number;
    percentual_generico_similar: number;
    percentual_goodlife: number;
    venda_generico_similar: number;
    venda_geral: number;
    venda_goodlife: number;
  };
  premiacoes: Array<{ descricao: string; valor: number }>;
  campanha_pix: boolean;
  valor_adicional_pix: number;
  comissoes: Record<string, number>;
  total_comissoes: number;
}

export interface ResultadoConsultora {
  premiacao_total: number;
  detalhes: {
    percentual_perfumaria_alta: number;
    percentual_dermocosmetico: number;
    percentual_goodlife: number;
    venda_perfumaria_alta: number;
    venda_dermocosmetico: number;
    venda_goodlife: number;
  };
  premiacoes: Array<{ descricao: string; valor: number }>;
  comissoes: Record<string, number>;
  total_comissoes: number;
}

export interface ResultadoApoio {
  base_calculo: number;
  tempo_empresa: number;
  percentuais: Record<string, number>;
  multiplicadores: Record<string, number>;
  premiacoes: Record<string, number>;
  premiacao_total: number;
  premiacao_maxima: number;
}

export interface ResultadoAuxConveniencia {
  premiacao_base: ResultadoApoio;
  vendas_conveniencia: {
    conveniencia: VendasCategoria;
    brinquedo: VendasCategoria;
  };
  comissoes: Record<string, number>;
  total_comissoes: number;
  total_geral: number;
}
