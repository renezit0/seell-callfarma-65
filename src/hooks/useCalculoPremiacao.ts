import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  calcularDiasUteis,
  calcularProjecoes,
  calcularPremiacaoGerencial,
  calcularPremiacaoFarmaceutico,
  calcularPremiacaoConsultora,
  calcularPremiacaoApoio,
  calcularPremiacaoAuxConveniencia,
  calcularTempoEmpresa,
  analisarRitmoVendas,
  gerarInsights
} from '@/utils/calculosPremiacao';
import { VendasLoja, VendasUsuario, VendasCategoria } from '@/types/premiacao';

interface UseCalculoPremiacaoProps {
  funcionario: any;
  periodo: any;
  lojaId: number;
}

export function useCalculoPremiacao({ funcionario, periodo, lojaId }: UseCalculoPremiacaoProps) {
  const [loading, setLoading] = useState(true);
  const [vendas, setVendas] = useState<any>(null);
  const [vendasLoja, setVendasLoja] = useState<any>(null);
  const [metas, setMetas] = useState<any>(null);
  const [resultado, setResultado] = useState<any>(null);
  const [projecoes, setProjecoes] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);

  useEffect(() => {
    if (!funcionario || !periodo) return;

    const calcular = async () => {
      setLoading(true);
      try {
        // 1. Buscar informações da loja (número e região)
        const { data: lojaInfo } = await supabase
          .from('lojas')
          .select('numero, regiao')
          .eq('id', lojaId)
          .single();

        const numeroLoja = lojaInfo?.numero?.toString().padStart(2, '0');
        const regiao = lojaInfo?.regiao || 'outros';

        // 2. Buscar vendas da API externa usando o endpoint correto
        const { data: vendasData, error: vendasError } = await supabase.functions.invoke('callfarma-vendas', {
          body: {
            endpoint: '/financeiro/vendas-por-funcionario',
            params: {
              dataIni: periodo.data_inicio,
              dataFim: periodo.data_fim,
              filtroFiliais: numeroLoja,
              filtroGrupos: '20,25,46,36,13,22,47,5,6,2,21', // Todos os grupos necessários
              groupBy: 'scefun.CDFUN,scefilial.CDFIL,scekarde.DATA,sceprodu.CDGRUPO',
              orderBy: 'scefun.NOME asc'
            }
          }
        });

        if (vendasError) {
          console.error('Erro ao buscar vendas:', vendasError);
          throw vendasError;
        }

        const rawData = vendasData?.msg || [];
        
        // FILTRAR APENAS DADOS DA LOJA ESPECÍFICA (número da loja convertido para inteiro)
        const numeroLojaInt = parseInt(numeroLoja || '0');
        const dadosFiltradosPorLoja = rawData.filter((v: any) => {
          const cdFilial = parseInt(v.CDFIL || '0');
          return cdFilial === numeroLojaInt;
        });
        
        console.log('Total de registros recebidos da API:', rawData.length);
        console.log('Registros após filtrar por loja', numeroLoja, ':', dadosFiltradosPorLoja.length);
        console.log('Matrícula do funcionário:', funcionario.matricula);
        console.log('Buscando vendas do CDFUN:', parseInt(funcionario.matricula || '0'));

        // Buscar metas do funcionário
        const { data: metasUsuario, error: metasError } = await supabase
          .from('metas')
          .select('categoria, meta_mensal')
          .eq('usuario_id', funcionario.id)
          .eq('periodo_meta_id', periodo.id);

        if (metasError) throw metasError;

        // Organizar metas por categoria
        const metasObj: Record<string, number> = {};
        metasUsuario?.forEach((m: any) => {
          metasObj[m.categoria] = m.meta_mensal;
        });

        // Buscar metas da loja (para cargos de apoio)
        const { data: metasLojaData, error: metasLojaError } = await supabase
          .from('metas_loja_categorias')
          .select('categoria, meta_valor, metas_loja!inner(loja_id, periodo_meta_id)')
          .eq('metas_loja.loja_id', lojaId)
          .eq('metas_loja.periodo_meta_id', periodo.id);

        if (metasLojaError) throw metasLojaError;

        const metasLojaObj: Record<string, number> = {};
        metasLojaData?.forEach((m: any) => {
          metasLojaObj[m.categoria] = m.meta_valor;
        });

        // Buscar folgas do usuário
        const { data: folgasData } = await supabase
          .from('folgas')
          .select('data_folga')
          .eq('usuario_id', funcionario.id)
          .eq('periodo_id', periodo.id);

        const folgas = folgasData?.map(f => f.data_folga) || [];

        // Verificar se há vendas hoje
        const hoje = new Date().toISOString().split('T')[0];
        const temVendasHoje = rawData.some((v: any) => v.DATA === hoje);

        // Calcular dias úteis
        const diasUteis = calcularDiasUteis(
          periodo.data_inicio,
          periodo.data_fim,
          regiao,
          temVendasHoje,
          folgas
        );

        // Organizar vendas por categoria baseado nos CDGRUPO da API
        // Grupos: 2,21=Similar | 5,6,47=Genérico | 20,25=Rentáveis | 36=Perfumaria Alta | 46=Dermocosméticos | 13,22=GoodLife
        const vendasPorCategoria: Record<string, VendasCategoria> = {
          geral: { valor: 0, quantidade: 0 },
          generico_similar: { valor: 0, quantidade: 0 }, // Categoria unificada para genérico e similar
          rentaveis20: { valor: 0, quantidade: 0 },
          rentaveis25: { valor: 0, quantidade: 0 },
          perfumaria_alta: { valor: 0, quantidade: 0 },
          dermocosmetico: { valor: 0, quantidade: 0 },
          goodlife: { valor: 0, quantidade: 0 },
          conveniencia: { valor: 0, quantidade: 0 },
          brinquedo: { valor: 0, quantidade: 0 }
        };

        // Filtrar vendas do funcionário específico (CDFUN) usando os dados já filtrados por loja
        // IMPORTANTE: Se não tiver matrícula, não conseguimos filtrar as vendas do funcionário
        if (!funcionario.matricula) {
          console.warn('Funcionário sem matrícula cadastrada! Não é possível calcular vendas individuais.');
          toast({
            title: 'Matrícula não cadastrada',
            description: 'Este funcionário não possui matrícula cadastrada no sistema. Entre em contato com o RH.',
            variant: 'destructive'
          });
        }
        
        const vendasDoUsuario = dadosFiltradosPorLoja.filter((v: any) => {
          const matriculaFuncionario = parseInt(funcionario.matricula || '0');
          return v.CDFUN === matriculaFuncionario;
        });
        
        console.log(`Encontradas ${vendasDoUsuario.length} vendas para o funcionário (CDFUN: ${funcionario.matricula})`);
        
        vendasDoUsuario.forEach((v: any) => {
          const valor = parseFloat(v.TOTAL_VLR_VE || 0);
          const qtd = parseInt(v.TOTAL_QTD_VE || 0);
          const grupo = parseInt(v.CDGRUPO || 0);

          // Sempre adiciona ao geral
          vendasPorCategoria.geral.valor += valor;
          vendasPorCategoria.geral.quantidade += qtd;

          // Mapear por grupo conforme documentação da API
          if (grupo === 2 || grupo === 21 || grupo === 5 || grupo === 6 || grupo === 47) {
            // Genérico e Similar unificados em uma categoria
            vendasPorCategoria.generico_similar.valor += valor;
            vendasPorCategoria.generico_similar.quantidade += qtd;
          } else if (grupo === 20) {
            vendasPorCategoria.rentaveis20.valor += valor;
            vendasPorCategoria.rentaveis20.quantidade += qtd;
          } else if (grupo === 25) {
            vendasPorCategoria.rentaveis25.valor += valor;
            vendasPorCategoria.rentaveis25.quantidade += qtd;
          } else if (grupo === 36) {
            vendasPorCategoria.perfumaria_alta.valor += valor;
            vendasPorCategoria.perfumaria_alta.quantidade += qtd;
          } else if (grupo === 46) {
            vendasPorCategoria.dermocosmetico.valor += valor;
            vendasPorCategoria.dermocosmetico.quantidade += qtd;
          } else if (grupo === 13 || grupo === 22) {
            vendasPorCategoria.goodlife.valor += valor;
            vendasPorCategoria.goodlife.quantidade += qtd;
          }
        });

        // Vendas da loja (todos os funcionários) - usando dados filtrados por loja
        const vendasLojaPorCategoria: Record<string, VendasCategoria> = {
          geral: { valor: 0, quantidade: 0 },
          r_mais: { valor: 0, quantidade: 0 },
          perfumaria_r_mais: { valor: 0, quantidade: 0 },
          conveniencia_r_mais: { valor: 0, quantidade: 0 },
          saude: { valor: 0, quantidade: 0 }
        };

        dadosFiltradosPorLoja.forEach((v: any) => {
          const valor = parseFloat(v.TOTAL_VLR_VE || 0);
          const qtd = parseInt(v.TOTAL_QTD_VE || 0);
          const grupo = parseInt(v.CDGRUPO || 0);

          vendasLojaPorCategoria.geral.valor += valor;
          vendasLojaPorCategoria.geral.quantidade += qtd;

          if (grupo === 20 || grupo === 25) {
            vendasLojaPorCategoria.r_mais.valor += valor;
            vendasLojaPorCategoria.r_mais.quantidade += qtd;
          } else if (grupo === 36) {
            vendasLojaPorCategoria.perfumaria_r_mais.valor += valor;
            vendasLojaPorCategoria.perfumaria_r_mais.quantidade += qtd;
          } else if (grupo === 13 || grupo === 22) {
            vendasLojaPorCategoria.saude.valor += valor;
            vendasLojaPorCategoria.saude.quantidade += qtd;
          }
        });

        console.log('Vendas do usuário por categoria:', vendasPorCategoria);
        console.log('Metas do usuário:', metasObj);
        console.log('Vendas da loja por categoria:', vendasLojaPorCategoria);

        // 9. Calcular projeções
        // Para gerentes/líderes, calcular projeções da LOJA
        // Para outros cargos, calcular projeções INDIVIDUAIS
        let projecoesCalculadas;
        if (funcionario.tipo === 'gerente' || funcionario.tipo === 'lider') {
          // Projeções baseadas nas vendas DA LOJA
          projecoesCalculadas = calcularProjecoes(vendasLojaPorCategoria, metasLojaObj, diasUteis);
        } else {
          // Projeções baseadas nas vendas DO FUNCIONÁRIO
          projecoesCalculadas = calcularProjecoes(vendasPorCategoria, metasObj, diasUteis);
        }

        // 10. Análise de ritmo
        const analiseRitmo = analisarRitmoVendas(vendasPorCategoria, metasObj, diasUteis);

        // 11. Gerar insights
        const insightsGerados = gerarInsights(
          funcionario.tipo,
          analiseRitmo,
          projecoesCalculadas,
          diasUteis
        );

        // 12. Calcular premiação baseado no tipo
        let resultadoCalculo: any = null;

        const tempoEmpresa = calcularTempoEmpresa(funcionario.data_contratacao);

        // Calcular percentuais para todas as metas
        const percentuaisLoja: Record<string, number> = {};
        for (const [cat, meta] of Object.entries(metasLojaObj)) {
          const vendaLoja = vendasLojaPorCategoria[cat]?.valor || 0;
          percentuaisLoja[cat] = (vendaLoja / meta) * 100;
        }

        const percentuaisUsuario: Record<string, number> = {};
        for (const [cat, meta] of Object.entries(metasObj)) {
          const vendaUsuario = vendasPorCategoria[cat]?.valor || 0;
          percentuaisUsuario[cat] = (vendaUsuario / meta) * 100;
        }

        // Verificar balanço (simplificado - você pode buscar do banco se tiver)
        const balanco = true;

        switch (funcionario.tipo) {
          case 'gerente':
          case 'lider':
            const vendasLojaFormatadas: VendasLoja = {
              geral: vendasLojaPorCategoria.geral || { valor: 0, quantidade: 0 },
              r_mais: vendasLojaPorCategoria.r_mais || { valor: 0, quantidade: 0 },
              perfumaria_r_mais: vendasLojaPorCategoria.perfumaria_r_mais || { valor: 0, quantidade: 0 },
              conveniencia_r_mais: vendasLojaPorCategoria.conveniencia_r_mais || { valor: 0, quantidade: 0 },
              saude: vendasLojaPorCategoria.saude || { valor: 0, quantidade: 0 }
            };
            resultadoCalculo = calcularPremiacaoGerencial(
              vendasLojaFormatadas,
              metasLojaObj,
              projecoesCalculadas,
              balanco
            );
            break;

          case 'farmaceutico':
            const vendasUsuarioFarm: VendasUsuario = {
              generico: vendasPorCategoria.generico_similar || { valor: 0, quantidade: 0 }, // Usar categoria unificada
              similar: { valor: 0, quantidade: 0 }, // Manter para compatibilidade, mas zerado
              goodlife: vendasPorCategoria.goodlife || { valor: 0, quantidade: 0 },
              perfumaria_alta: vendasPorCategoria.perfumaria_alta || { valor: 0, quantidade: 0 },
              dermocosmetico: vendasPorCategoria.dermocosmetico || { valor: 0, quantidade: 0 },
              conveniencia: vendasPorCategoria.conveniencia || { valor: 0, quantidade: 0 },
              brinquedo: vendasPorCategoria.brinquedo || { valor: 0, quantidade: 0 },
              rentaveis20: vendasPorCategoria.rentaveis20 || { valor: 0, quantidade: 0 },
              rentaveis25: vendasPorCategoria.rentaveis25 || { valor: 0, quantidade: 0 }
            };
            resultadoCalculo = calcularPremiacaoFarmaceutico(
              vendasUsuarioFarm,
              metasObj,
              percentuaisUsuario,
              'farmaceutico'
            );
            break;

          case 'auxiliar':
            const vendasUsuarioAux: VendasUsuario = {
              generico: vendasPorCategoria.generico_similar || { valor: 0, quantidade: 0 }, // Usar categoria unificada
              similar: { valor: 0, quantidade: 0 }, // Manter para compatibilidade, mas zerado
              goodlife: vendasPorCategoria.goodlife || { valor: 0, quantidade: 0 },
              perfumaria_alta: vendasPorCategoria.perfumaria_alta || { valor: 0, quantidade: 0 },
              dermocosmetico: vendasPorCategoria.dermocosmetico || { valor: 0, quantidade: 0 },
              conveniencia: vendasPorCategoria.conveniencia || { valor: 0, quantidade: 0 },
              brinquedo: vendasPorCategoria.brinquedo || { valor: 0, quantidade: 0 },
              rentaveis20: vendasPorCategoria.rentaveis20 || { valor: 0, quantidade: 0 },
              rentaveis25: vendasPorCategoria.rentaveis25 || { valor: 0, quantidade: 0 }
            };
            resultadoCalculo = calcularPremiacaoFarmaceutico(
              vendasUsuarioAux,
              metasObj,
              percentuaisUsuario,
              'auxiliar'
            );
            break;

          case 'consultora':
            const vendasUsuarioConsultora: VendasUsuario = {
              generico: { valor: 0, quantidade: 0 },
              similar: { valor: 0, quantidade: 0 },
              goodlife: vendasPorCategoria.goodlife || { valor: 0, quantidade: 0 },
              perfumaria_alta: vendasPorCategoria.perfumaria_alta || { valor: 0, quantidade: 0 },
              dermocosmetico: vendasPorCategoria.dermocosmetico || { valor: 0, quantidade: 0 },
              conveniencia: { valor: 0, quantidade: 0 },
              brinquedo: { valor: 0, quantidade: 0 },
              rentaveis20: { valor: 0, quantidade: 0 },
              rentaveis25: { valor: 0, quantidade: 0 }
            };
            resultadoCalculo = calcularPremiacaoConsultora(
              vendasUsuarioConsultora,
              percentuaisUsuario
            );
            break;

          case 'aux_conveniencia':
            const vendasUsuarioAuxConv: VendasUsuario = {
              generico: { valor: 0, quantidade: 0 },
              similar: { valor: 0, quantidade: 0 },
              goodlife: { valor: 0, quantidade: 0 },
              perfumaria_alta: { valor: 0, quantidade: 0 },
              dermocosmetico: { valor: 0, quantidade: 0 },
              conveniencia: vendasPorCategoria.conveniencia || { valor: 0, quantidade: 0 },
              brinquedo: vendasPorCategoria.brinquedo || { valor: 0, quantidade: 0 },
              rentaveis20: { valor: 0, quantidade: 0 },
              rentaveis25: { valor: 0, quantidade: 0 }
            };
            resultadoCalculo = calcularPremiacaoAuxConveniencia(
              tempoEmpresa,
              percentuaisLoja,
              balanco,
              vendasUsuarioAuxConv
            );
            break;

          case 'aux1':
          case 'fiscal':
          case 'zelador':
            resultadoCalculo = calcularPremiacaoApoio(
              tempoEmpresa,
              percentuaisLoja,
              balanco
            );
            break;

          default:
            throw new Error(`Tipo de funcionário não suportado: ${funcionario.tipo}`);
        }

        setVendas(vendasPorCategoria);
        setVendasLoja(vendasLojaPorCategoria);
        setMetas(metasObj);
        setResultado(resultadoCalculo);
        setProjecoes(projecoesCalculadas);
        setInsights(insightsGerados);

      } catch (error: any) {
        console.error('Erro ao calcular premiação:', error);
        toast({
          title: 'Erro ao calcular premiação',
          description: error.message || 'Não foi possível calcular a premiação',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    calcular();
  }, [funcionario, periodo, lojaId]);

  return {
    loading,
    vendas,
    vendasLoja,
    metas,
    resultado,
    projecoes,
    insights
  };
}
