import { 
  DiasUteis, 
  ProjecaoCategoria, 
  AnaliseRitmo, 
  Insight,
  VendasCategoria,
  ResultadoGerencial,
  ResultadoFarmaceutico,
  ResultadoConsultora,
  ResultadoApoio,
  ResultadoAuxConveniencia,
  VendasLoja,
  VendasUsuario
} from '@/types/premiacao';
import { formatCurrency } from '@/lib/utils';

// ==================== DIAS ÚTEIS ====================

export function calcularDiasUteis(
  dataInicio: string,
  dataFim: string,
  regiao: string,
  temVendasHoje: boolean,
  folgasUsuario: string[] = []
): DiasUteis {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);
  
  let diasTotal = 0;
  let diasUteisTotal = 0;
  let diasUteisPassados = 0;
  let diasUteisRestantes = 0;
  
  const dataCorrente = new Date(inicio);
  
  while (dataCorrente <= fim) {
    const dataFormatada = dataCorrente.toISOString().split('T')[0];
    const diaSemana = dataCorrente.getDay();
    
    const ehFolga = folgasUsuario.includes(dataFormatada);
    const ehDiaUtil = regiao !== 'centro' || diaSemana !== 0;
    
    if (ehDiaUtil && !ehFolga) {
      diasUteisTotal++;
      
      if (dataCorrente < hoje || 
          (dataCorrente.toDateString() === hoje.toDateString() && temVendasHoje)) {
        diasUteisPassados++;
      } else {
        diasUteisRestantes++;
      }
    }
    
    diasTotal++;
    dataCorrente.setDate(dataCorrente.getDate() + 1);
  }
  
  const percentualTempo = diasUteisTotal > 0 
    ? (diasUteisPassados / diasUteisTotal) * 100 
    : 0;
  
  return {
    dias_total: diasTotal,
    dias_uteis_total: diasUteisTotal,
    dias_uteis_passados: Math.max(1, diasUteisPassados),
    dias_uteis_restantes: diasUteisRestantes,
    percentual_tempo: percentualTempo
  };
}

// ==================== PROJEÇÕES ====================

export function calcularProjecoes(
  vendas: Record<string, VendasCategoria>,
  metas: Record<string, number>,
  diasUteis: DiasUteis
): Record<string, ProjecaoCategoria> {
  const projecoes: Record<string, ProjecaoCategoria> = {};
  
  for (const [categoria, metaValor] of Object.entries(metas)) {
    if (typeof metaValor !== 'number' || metaValor === 0) continue;
    
    const vendaCategoria = vendas[categoria];
    const valorVendido = vendaCategoria?.valor || 0;
    
    const ritmoDiario = valorVendido / diasUteis.dias_uteis_passados;
    const valorProjetado = valorVendido + (ritmoDiario * diasUteis.dias_uteis_restantes);
    
    const percentualAtual = (valorVendido / metaValor) * 100;
    const percentualProjetado = (valorProjetado / metaValor) * 100;
    
    let status: 'atingido' | 'próximo' | 'distante';
    if (percentualProjetado >= 100) {
      status = 'atingido';
    } else if (percentualProjetado >= 95) {
      status = 'próximo';
    } else {
      status = 'distante';
    }
    
    projecoes[categoria] = {
      valor_atual: valorVendido,
      percentual_atual: percentualAtual,
      ritmo_diario: ritmoDiario,
      valor_projetado: valorProjetado,
      percentual_projetado: percentualProjetado,
      meta: metaValor,
      dias_passados: diasUteis.dias_uteis_passados,
      dias_restantes: diasUteis.dias_uteis_restantes,
      status: status
    };
  }
  
  return projecoes;
}

// ==================== ANÁLISE DE RITMO ====================

export function analisarRitmoVendas(
  vendas: Record<string, VendasCategoria>,
  metas: Record<string, number>,
  diasUteis: DiasUteis
): Record<string, AnaliseRitmo> {
  const analises: Record<string, AnaliseRitmo> = {};
  
  for (const [categoria, metaValor] of Object.entries(metas)) {
    if (typeof metaValor !== 'number' || metaValor === 0) continue;
    
    const valorVendido = vendas[categoria]?.valor || 0;
    const faltaParaMeta = Math.max(0, metaValor - valorVendido);
    
    const ritmoNecessario = diasUteis.dias_uteis_restantes > 0
      ? faltaParaMeta / diasUteis.dias_uteis_restantes
      : 0;
    
    const ritmoAtual = diasUteis.dias_uteis_passados > 0
      ? valorVendido / diasUteis.dias_uteis_passados
      : 0;
    
    const diferencaRitmo = ritmoAtual > 0
      ? ((ritmoNecessario / ritmoAtual) - 1) * 100
      : 0;
    
    const podeAtingir = ritmoNecessario <= ritmoAtual * 1.3;
    
    const diasCriticos = {
      inicio_mes: diasUteis.dias_uteis_passados <= 5,
      fim_mes: diasUteis.dias_uteis_restantes <= 5 && diasUteis.dias_uteis_restantes > 0,
      ritmo_acelerado: diferencaRitmo > 30
    };
    
    analises[categoria] = {
      falta_para_meta: faltaParaMeta,
      ritmo_atual: ritmoAtual,
      ritmo_necessario: ritmoNecessario,
      diferenca_ritmo: diferencaRitmo,
      pode_atingir: podeAtingir,
      dias_criticos: diasCriticos
    };
  }
  
  return analises;
}

// ==================== TEMPO DE EMPRESA ====================

export function calcularTempoEmpresa(dataContratacao: string): number {
  const inicio = new Date(dataContratacao);
  const hoje = new Date();
  
  const anos = hoje.getFullYear() - inicio.getFullYear();
  const meses = hoje.getMonth() - inicio.getMonth();
  
  return anos + (meses / 12);
}

export function formatarTempoEmpresa(anos: number): string {
  if (!anos || anos <= 0) return "Recém contratado";
  
  const anosCompletos = Math.floor(anos);
  const meses = Math.floor((anos - anosCompletos) * 12);
  
  if (anosCompletos > 0) {
    let resultado = `${anosCompletos} ano${anosCompletos > 1 ? 's' : ''}`;
    if (meses > 0) {
      resultado += ` e ${meses} mes${meses > 1 ? 'es' : ''}`;
    }
    return resultado;
  }
  
  if (meses > 0) {
    return `${meses} mes${meses > 1 ? 'es' : ''}`;
  }
  
  return "Menos de 1 mês";
}

// ==================== BASE DE CÁLCULO GERENCIAL ====================

export function determinarBaseCalculo(faturamento: number): number {
  if (faturamento <= 299000) return 1300;
  if (faturamento <= 399000) return 1400;
  if (faturamento <= 499000) return 1500;
  if (faturamento <= 599000) return 1700;
  if (faturamento <= 699000) return 1900;
  if (faturamento <= 799000) return 2100;
  if (faturamento <= 899000) return 2300;
  if (faturamento <= 999000) return 2500;
  if (faturamento <= 1199000) return 2700;
  if (faturamento <= 1499000) return 3000;
  if (faturamento <= 1799000) return 3500;
  if (faturamento <= 1999000) return 4000;
  return 4500;
}

// ==================== CÁLCULO GERENCIAL ====================

export function calcularPremiacaoGerencial(
  vendasLoja: VendasLoja,
  metas: Record<string, number>,
  projecoes: Record<string, ProjecaoCategoria>,
  balanco: boolean
): ResultadoGerencial {
  const faturamento = vendasLoja.geral.valor;
  const faturamentoProjetado = projecoes.geral?.valor_projetado || faturamento;
  
  const baseCalculo = determinarBaseCalculo(faturamento);
  const baseCalculoProjetada = determinarBaseCalculo(faturamentoProjetado);
  
  // Calcular percentuais
  const percentuais: Record<string, number> = {
    geral: (vendasLoja.geral.valor / metas.geral) * 100,
    r_mais: (vendasLoja.r_mais.valor / metas.r_mais) * 100,
    perfumaria_r_mais: (vendasLoja.perfumaria_r_mais.valor / metas.perfumaria_r_mais) * 100,
    conveniencia_r_mais: (vendasLoja.conveniencia_r_mais.valor / metas.conveniencia_r_mais) * 100,
    saude: (vendasLoja.saude.valor / metas.saude) * 100,
  };
  
  // Calcular multiplicadores atuais
  const multiplicadores: Record<string, number> = {
    geral: calcularMultiplicadorGeral(percentuais.geral),
    r_mais: calcularMultiplicadorIndicador(percentuais.r_mais),
    perfumaria_r_mais: calcularMultiplicadorIndicador(percentuais.perfumaria_r_mais),
    conveniencia_r_mais: calcularMultiplicadorIndicador(percentuais.conveniencia_r_mais),
    saude: calcularMultiplicadorIndicador(percentuais.saude),
    balanco: balanco ? 0.1 : 0.0
  };
  
  // Calcular multiplicadores projetados
  const percentuaisProjetados: Record<string, number> = {
    geral: projecoes.geral?.percentual_projetado || percentuais.geral,
    r_mais: projecoes.r_mais?.percentual_projetado || percentuais.r_mais,
    perfumaria_r_mais: projecoes.perfumaria_r_mais?.percentual_projetado || percentuais.perfumaria_r_mais,
    conveniencia_r_mais: projecoes.conveniencia_r_mais?.percentual_projetado || percentuais.conveniencia_r_mais,
    saude: projecoes.saude?.percentual_projetado || percentuais.saude,
  };
  
  const multiplicadoresProjetados: Record<string, number> = {
    geral: calcularMultiplicadorGeral(percentuaisProjetados.geral),
    r_mais: calcularMultiplicadorIndicador(percentuaisProjetados.r_mais),
    perfumaria_r_mais: calcularMultiplicadorIndicador(percentuaisProjetados.perfumaria_r_mais),
    conveniencia_r_mais: calcularMultiplicadorIndicador(percentuaisProjetados.conveniencia_r_mais),
    saude: calcularMultiplicadorIndicador(percentuaisProjetados.saude),
    balanco: balanco ? 0.1 : 0.0
  };
  
  // Multiplicadores máximos (100% em tudo)
  const multiplicadoresMaximos: Record<string, number> = {
    geral: 0.6,
    r_mais: 0.2,
    perfumaria_r_mais: 0.2,
    conveniencia_r_mais: 0.2,
    saude: 0.2,
    balanco: 0.1
  };
  
  // Calcular premiações
  const premiacoes: Record<string, number> = {};
  const premiacoesProjetadas: Record<string, number> = {};
  const premiacoesMaximas: Record<string, number> = {};
  
  for (const key in multiplicadores) {
    premiacoes[key] = baseCalculo * multiplicadores[key];
    premiacoesProjetadas[key] = baseCalculoProjetada * multiplicadoresProjetados[key];
    premiacoesMaximas[key] = baseCalculoProjetada * multiplicadoresMaximos[key];
  }
  
  const somaMultiplicadores = Object.values(multiplicadores).reduce((a, b) => a + b, 0);
  const somaMultiplicadoresProjetados = Object.values(multiplicadoresProjetados).reduce((a, b) => a + b, 0);
  
  const premiacaoTotal = baseCalculo * Math.min(somaMultiplicadores, 1.5);
  const premiacaoTotalProjetada = baseCalculoProjetada * Math.min(somaMultiplicadoresProjetados, 1.5);
  const premiacaoTotalMaxima = baseCalculo * 1.5;
  const premiacaoTotalMaximaProjetada = baseCalculoProjetada * 1.5;
  
  return {
    base_calculo: baseCalculo,
    base_calculo_projetada: baseCalculoProjetada,
    percentuais,
    multiplicadores,
    premiacoes,
    premiacao_total: premiacaoTotal,
    multiplicadores_projetados: multiplicadoresProjetados,
    premiacoes_projetadas: premiacoesProjetadas,
    premiacao_total_projetada: premiacaoTotalProjetada,
    multiplicadores_maximos: multiplicadoresMaximos,
    premiacoes_maximas: premiacoesMaximas,
    premiacao_total_maxima: premiacaoTotalMaxima,
    premiacao_total_maxima_projetada: premiacaoTotalMaximaProjetada,
    faturamento_projetado: faturamentoProjetado
  };
}

function calcularMultiplicadorGeral(percentual: number): number {
  if (percentual >= 100) return 0.6;
  if (percentual >= 95) return 0.4;
  if (percentual >= 90) return 0.2;
  return 0.0;
}

function calcularMultiplicadorIndicador(percentual: number): number {
  if (percentual >= 100) return 0.2;
  if (percentual >= 95) return 0.1;
  return 0.0;
}

// ==================== CÁLCULO FARMACÊUTICO ====================

export function calcularPremiacaoFarmaceutico(
  vendasUsuario: VendasUsuario,
  metas: Record<string, number>,
  percentuais: Record<string, number>,
  tipoComissao: 'farmaceutico' | 'auxiliar'
): ResultadoFarmaceutico {
  const vendaGenSim = (vendasUsuario.generico?.valor || 0) + (vendasUsuario.similar?.valor || 0);
  const vendaGeral = vendasUsuario.goodlife?.valor || 0;
  const vendaGoodlife = vendasUsuario.goodlife?.valor || 0;
  
  const premiacoes: Array<{ descricao: string; valor: number }> = [];
  
  // Premiações por metas
  if (percentuais.geral >= 100) {
    const valor = vendaGenSim * 0.005;
    premiacoes.push({ descricao: 'Meta Geral 100%', valor });
  }
  
  if (percentuais.generico_similar >= 95 && percentuais.generico_similar < 100) {
    const valor = vendaGenSim * 0.005;
    premiacoes.push({ descricao: 'Meta Gen/Sim 95-99.9%', valor });
  }
  
  if (percentuais.generico_similar >= 100 && percentuais.generico_similar < 110) {
    const valor = vendaGenSim * 0.005;
    premiacoes.push({ descricao: 'Meta Gen/Sim 100%', valor });
  }
  
  if (percentuais.generico_similar >= 110) {
    const valor = vendaGenSim * 0.01;
    premiacoes.push({ descricao: 'Meta Gen/Sim 110%', valor });
  }
  
  if (percentuais.goodlife >= 100) {
    const valor = vendaGenSim * 0.005;
    premiacoes.push({ descricao: 'Meta GoodLife 100%', valor });
  }
  
  const totalPremiacoes = premiacoes.reduce((sum, p) => sum + p.valor, 0);
  
  // Comissões
  const comissoes: Record<string, number> = {};
  
  if (tipoComissao === 'farmaceutico') {
    comissoes.generico = (vendasUsuario.generico?.valor || 0) * 0.02;
    comissoes.similar = (vendasUsuario.similar?.valor || 0) * 0.02;
    comissoes.dermocosmetico = (vendasUsuario.dermocosmetico?.valor || 0) * 0.02;
    comissoes.rentaveis = ((vendasUsuario.rentaveis20?.valor || 0) + (vendasUsuario.rentaveis25?.valor || 0)) * 0.01;
  } else {
    comissoes.generico = (vendasUsuario.generico?.valor || 0) * 0.045;
    comissoes.similar = (vendasUsuario.similar?.valor || 0) * 0.05;
    comissoes.dermocosmetico = (vendasUsuario.dermocosmetico?.valor || 0) * 0.02;
    comissoes.rentaveis = ((vendasUsuario.rentaveis20?.valor || 0) + (vendasUsuario.rentaveis25?.valor || 0)) * 0.01;
  }
  
  const totalComissoes = Object.values(comissoes).reduce((a, b) => a + b, 0);
  
  // Campanhas PIX
  const campanhaGensim = vendaGenSim > 65000;
  const valorPix = campanhaGensim ? vendaGenSim * 0.01 : 0;
  const valorRentaveisPix = ((vendasUsuario.rentaveis20?.valor || 0) + (vendasUsuario.rentaveis25?.valor || 0)) * 0.01;
  
  return {
    premiacao_total: totalPremiacoes + totalComissoes + valorPix + valorRentaveisPix,
    detalhes: {
      percentual_geral: percentuais.geral,
      percentual_generico_similar: percentuais.generico_similar,
      percentual_goodlife: percentuais.goodlife,
      venda_generico_similar: vendaGenSim,
      venda_geral: vendaGeral,
      venda_goodlife: vendaGoodlife
    },
    premiacoes,
    campanha_pix: campanhaGensim,
    valor_adicional_pix: valorPix + valorRentaveisPix,
    comissoes,
    total_comissoes: totalComissoes
  };
}

// ==================== CÁLCULO CONSULTORA ====================

export function calcularPremiacaoConsultora(
  vendasUsuario: VendasUsuario,
  percentuais: Record<string, number>
): ResultadoConsultora {
  const vendaPerfumaria = vendasUsuario.perfumaria_alta?.valor || 0;
  const vendaDermo = vendasUsuario.dermocosmetico?.valor || 0;
  const vendaGoodlife = vendasUsuario.goodlife?.valor || 0;
  
  const premiacoes: Array<{ descricao: string; valor: number }> = [];
  
  if (percentuais.perfumaria_alta >= 100) {
    premiacoes.push({ descricao: 'Meta Perfumaria 100%', valor: vendaPerfumaria * 0.01 });
  }
  
  if (percentuais.dermocosmetico >= 100) {
    premiacoes.push({ descricao: 'Meta Dermocosmético 100%', valor: vendaDermo * 0.01 });
  }
  
  if (percentuais.goodlife >= 100) {
    premiacoes.push({ descricao: 'Meta GoodLife 100%', valor: vendaGoodlife * 0.01 });
  }
  
  const comissoes: Record<string, number> = {
    perfumaria_alta: vendaPerfumaria * 0.03,
    dermocosmetico: vendaDermo * 0.02,
    goodlife: vendaGoodlife * 0.05
  };
  
  const totalPremiacoes = premiacoes.reduce((sum, p) => sum + p.valor, 0);
  const totalComissoes = Object.values(comissoes).reduce((a, b) => a + b, 0);
  
  return {
    premiacao_total: totalPremiacoes + totalComissoes,
    detalhes: {
      percentual_perfumaria_alta: percentuais.perfumaria_alta,
      percentual_dermocosmetico: percentuais.dermocosmetico,
      percentual_goodlife: percentuais.goodlife,
      venda_perfumaria_alta: vendaPerfumaria,
      venda_dermocosmetico: vendaDermo,
      venda_goodlife: vendaGoodlife
    },
    premiacoes,
    comissoes,
    total_comissoes: totalComissoes
  };
}

// ==================== CÁLCULO APOIO ====================

export function calcularPremiacaoApoio(
  tempoEmpresa: number,
  percentuaisLoja: Record<string, number>,
  balanco: boolean
): ResultadoApoio {
  const baseCalculo = tempoEmpresa >= 1 ? 256 : 158;
  
  const multiplicadores: Record<string, number> = {
    geral: percentuaisLoja.geral >= 100 ? 0.6 : percentuaisLoja.geral >= 95 ? 0.3 : 0.0,
    r_mais: percentuaisLoja.r_mais >= 100 ? 0.2 : 0.0,
    perfumaria_r_mais: percentuaisLoja.perfumaria_r_mais >= 100 ? 0.2 : 0.0,
    conveniencia_r_mais: percentuaisLoja.conveniencia_r_mais >= 100 ? 0.2 : 0.0,
    saude: percentuaisLoja.saude >= 100 ? 0.2 : 0.0,
    balanco: balanco ? 0.1 : 0.0
  };
  
  const premiacoes: Record<string, number> = {};
  for (const key in multiplicadores) {
    premiacoes[key] = baseCalculo * multiplicadores[key];
  }
  
  const somaMultiplicadores = Object.values(multiplicadores).reduce((a, b) => a + b, 0);
  const premiacaoTotal = baseCalculo * Math.min(somaMultiplicadores, 1.5);
  const premiacaoMaxima = baseCalculo * 1.5;
  
  return {
    base_calculo: baseCalculo,
    tempo_empresa: tempoEmpresa,
    percentuais: percentuaisLoja,
    multiplicadores,
    premiacoes,
    premiacao_total: premiacaoTotal,
    premiacao_maxima: premiacaoMaxima
  };
}

// ==================== CÁLCULO AUX CONVENIÊNCIA ====================

export function calcularPremiacaoAuxConveniencia(
  tempoEmpresa: number,
  percentuaisLoja: Record<string, number>,
  balanco: boolean,
  vendasUsuario: VendasUsuario
): ResultadoAuxConveniencia {
  const premiacaoBase = calcularPremiacaoApoio(tempoEmpresa, percentuaisLoja, balanco);
  
  const comissoes: Record<string, number> = {
    conveniencia: (vendasUsuario.conveniencia?.valor || 0) * 0.02,
    brinquedo: (vendasUsuario.brinquedo?.valor || 0) * 0.02
  };
  
  const totalComissoes = Object.values(comissoes).reduce((a, b) => a + b, 0);
  
  return {
    premiacao_base: premiacaoBase,
    vendas_conveniencia: {
      conveniencia: vendasUsuario.conveniencia || { valor: 0, quantidade: 0 },
      brinquedo: vendasUsuario.brinquedo || { valor: 0, quantidade: 0 }
    },
    comissoes,
    total_comissoes: totalComissoes,
    total_geral: premiacaoBase.premiacao_total + totalComissoes
  };
}

// ==================== INSIGHTS ====================

export function gerarInsights(
  tipoUsuario: string,
  analiseRitmo: Record<string, AnaliseRitmo>,
  projecoes: Record<string, ProjecaoCategoria>,
  diasUteis: DiasUteis
): Insight[] {
  const insights: Insight[] = [];
  
  const percentualTempo = diasUteis.percentual_tempo;
  const diasRestantes = diasUteis.dias_uteis_restantes;
  
  if (percentualTempo > 75 && diasRestantes <= 5) {
    insights.push({
      titulo: 'Reta final do período!',
      descricao: `Restam apenas ${diasRestantes} dias úteis. Foque nas categorias mais próximas de atingir as metas.`,
      icone: 'clock',
      cor: '#e74c3c',
      prioridade: 'alta'
    });
  }
  
  for (const [categoria, projecao] of Object.entries(projecoes)) {
    const analise = analiseRitmo[categoria];
    
    if (projecao.percentual_projetado >= 85 && projecao.percentual_projetado < 100) {
      const nomeCat = formatarNomeCategoria(categoria);
      
      if (analise.pode_atingir) {
        insights.push({
          titulo: `${nomeCat} próximo da meta!`,
          descricao: `Faltam apenas ${formatCurrency(analise.falta_para_meta)} para atingir 100%.`,
          icone: 'fire',
          cor: '#27ae60',
          prioridade: 'alta'
        });
      }
    }
    
    if (projecao.percentual_atual >= 95) {
      const nomeCat = formatarNomeCategoria(categoria);
      insights.push({
        titulo: `${nomeCat} já em ${projecao.percentual_atual.toFixed(1)}%!`,
        descricao: `Continue focando nessa categoria para maximizar sua premiação.`,
        icone: 'check-circle',
        cor: '#3498db',
        prioridade: 'baixa'
      });
    }
  }
  
  insights.sort((a, b) => {
    const ordem: Record<string, number> = { 'alta': 1, 'media': 2, 'baixa': 3 };
    return ordem[a.prioridade] - ordem[b.prioridade];
  });
  
  return insights;
}

function formatarNomeCategoria(categoria: string): string {
  const nomes: Record<string, string> = {
    'generico_similar': 'Genérico+Similar',
    'goodlife': 'GoodLife',
    'perfumaria_alta': 'Perfumaria Alta',
    'dermocosmetico': 'Dermocosmético',
    'geral': 'Meta Geral',
    'r_mais': 'Rentáveis',
    'perfumaria_r_mais': 'Perfumaria R+',
    'conveniencia_r_mais': 'Conveniência R+',
    'saude': 'GoodLife'
  };
  return nomes[categoria] || categoria;
}
