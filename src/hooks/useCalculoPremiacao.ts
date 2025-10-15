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
  const [metas, setMetas] = useState<any>(null);
  const [resultado, setResultado] = useState<any>(null);
  const [projecoes, setProjecoes] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);

  useEffect(() => {
    if (!funcionario || !periodo) return;

    const calcular = async () => {
      setLoading(true);
      try {
        // 1. Buscar vendas da API externa (callfarma-vendas)
        const { data: vendasData, error: vendasError } = await supabase.functions.invoke('callfarma-vendas', {
          body: {
            loja_id: lojaId,
            data_inicio: periodo.data_inicio,
            data_fim: periodo.data_fim,
            usuario_id: funcionario.id
          }
        });

        if (vendasError) throw vendasError;

        // 2. Buscar metas do funcionário
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

        // 3. Buscar metas da loja (para cargos de apoio)
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

        // 4. Buscar folgas do usuário
        const { data: folgasData } = await supabase
          .from('folgas')
          .select('data_folga')
          .eq('usuario_id', funcionario.id)
          .eq('periodo_id', periodo.id);

        const folgas = folgasData?.map(f => f.data_folga) || [];

        // 5. Buscar dados da loja (região)
        const { data: lojaData } = await supabase
          .from('lojas')
          .select('regiao')
          .eq('id', lojaId)
          .single();

        const regiao = lojaData?.regiao || 'outros';

        // 6. Verificar se há vendas hoje
        const hoje = new Date().toISOString().split('T')[0];
        const temVendasHoje = vendasData?.vendas_usuario?.some((v: any) => v.data_venda === hoje) || false;

        // 7. Calcular dias úteis
        const diasUteis = calcularDiasUteis(
          periodo.data_inicio,
          periodo.data_fim,
          regiao,
          temVendasHoje,
          folgas
        );

        // 8. Organizar vendas por categoria
        const vendasPorCategoria: Record<string, VendasCategoria> = {};
        vendasData?.vendas_usuario?.forEach((v: any) => {
          if (!vendasPorCategoria[v.categoria]) {
            vendasPorCategoria[v.categoria] = { valor: 0, quantidade: 0 };
          }
          vendasPorCategoria[v.categoria].valor += parseFloat(v.valor_venda || 0);
          vendasPorCategoria[v.categoria].quantidade += 1;
        });

        // Vendas da loja
        const vendasLojaPorCategoria: Record<string, VendasCategoria> = {};
        vendasData?.vendas_loja?.forEach((v: any) => {
          if (!vendasLojaPorCategoria[v.categoria]) {
            vendasLojaPorCategoria[v.categoria] = { valor: 0, quantidade: 0 };
          }
          vendasLojaPorCategoria[v.categoria].valor += parseFloat(v.valor_venda || 0);
          vendasLojaPorCategoria[v.categoria].quantidade += 1;
        });

        // 9. Calcular projeções
        const projecoesCalculadas = calcularProjecoes(vendasPorCategoria, metasObj, diasUteis);

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
              generico: vendasPorCategoria.generico || { valor: 0, quantidade: 0 },
              similar: vendasPorCategoria.similar || { valor: 0, quantidade: 0 },
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
              generico: vendasPorCategoria.generico || { valor: 0, quantidade: 0 },
              similar: vendasPorCategoria.similar || { valor: 0, quantidade: 0 },
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
    metas,
    resultado,
    projecoes,
    insights
  };
}
