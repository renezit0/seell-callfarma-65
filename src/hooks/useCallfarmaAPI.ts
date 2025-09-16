import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface VendaFuncionario {
  CDFUN: number;
  NOME: string;
  CDFIL: number;
  NOMEFIL: string;
  TOTAL_VALOR: number;
  TOTAL_QUANTIDADE: number;
}

export interface VendasConsolidadas {
  geral: number;
  por_grupos: Record<number, number>; // grupo_id -> valor_total
  total_geral_todos_grupos: number;
  dados_detalhados: any[];
}

export interface GrupoInfo {
  CDGRUPO: number;
  NMGRUPO: string;
}

export interface FiltrosVendas {
  dataInicio: string;
  dataFim: string;
  filtroFornecedores?: string;
  filtroGrupos?: string;
  groupBy?: string;
  orderBy?: string;
}

export interface FiltroCampanha {
  dataInicio: string;
  dataFim: string;
  filtroFornecedores?: string;
  filtroMarcas?: string;
  filtroFamilias?: string;
  filtroGrupos?: string;
  filtroProduto?: string;
}

export const useCallfarmaAPI = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // 🚀 NOVA FUNÇÃO: Buscar todos os grupos disponíveis
  const buscarTodosGrupos = async (): Promise<GrupoInfo[]> => {
    setLoading(true);
    try {
      console.log('📊 Buscando todos os grupos disponíveis...');
      
      const { data, error } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/grupos'
        }
      });

      if (error) throw error;
      
      const grupos = data || [];
      console.log(`✅ ${grupos.length} grupos encontrados`);
      
      return grupos;
    } catch (error) {
      console.error('❌ Erro ao buscar grupos:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar grupos da API externa",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  // 🚀 NOVA FUNÇÃO SUPER OTIMIZADA: Buscar vendas consolidadas da loja
  const buscarVendasConsolidasLoja = async (
    dataInicio: string, 
    dataFim: string, 
    cdfil?: number
  ): Promise<VendasConsolidadas> => {
    setLoading(true);
    try {
      console.log(`🏪 Buscando vendas consolidadas da loja CDFIL: ${cdfil || 'TODAS'}`);
      
      // Buscar dados detalhados como na sua requisição de exemplo
      const params: any = {
        dataFim,
        dataIni: dataInicio,
        groupBy: 'scefilial.CDFIL,sceprodu.CDGRUPO,scefun.CDFUN',
        orderBy: 'scefun.NOME asc'
      };

      // Filtrar por loja específica se fornecida
      if (cdfil) {
        // Buscar número da loja no banco para usar como filtro
        const { data: lojaData } = await supabase
          .from('lojas')
          .select('numero')
          .eq('id', cdfil)
          .maybeSingle();
        
        if (lojaData) {
          params.filtroFiliais = lojaData.numero.toString().padStart(2, '0');
        }
      }

      const { data, error } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/financeiro/vendas-por-funcionario',
          params
        }
      });

      if (error) throw error;
      
      const dadosDetalhados = data?.msg || [];
      console.log(`📊 ${dadosDetalhados.length} registros detalhados recebidos`);

      // Processar dados para consolidação
      const vendasPorGrupo: Record<number, number> = {};
      let totalGeralTodosGrupos = 0;
      let totalVendasGerais = 0; // Vendas sem filtro de grupo específico

      dadosDetalhados.forEach((item: any) => {
        const valorVenda = parseFloat(item.TOTAL_VLR_VE || 0);
        const valorDevolucao = parseFloat(item.TOTAL_VLR_DV || 0);
        const valorLiquido = valorVenda - valorDevolucao;
        
        if (valorLiquido > 0) {
          const grupoId = parseInt(item.CDGRUPO);
          
          // Somar por grupo
          if (!vendasPorGrupo[grupoId]) {
            vendasPorGrupo[grupoId] = 0;
          }
          vendasPorGrupo[grupoId] += valorLiquido;
          
          // Somar total geral
          totalGeralTodosGrupos += valorLiquido;
        }
      });

      // Buscar vendas gerais (sem filtro de grupos) para comparação
      const paramsGeral = {
        ...params,
        groupBy: 'scefilial.CDFIL'
      };
      delete paramsGeral.filtroGrupos; // Sem filtro de grupos

      const { data: dataGeral } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/financeiro/vendas-por-funcionario',
          params: paramsGeral
        }
      });

      const dadosGerais = dataGeral?.msg || [];
      dadosGerais.forEach((item: any) => {
        const valorVenda = parseFloat(item.TOTAL_VLR_VE || 0);
        const valorDevolucao = parseFloat(item.TOTAL_VLR_DV || 0);
        totalVendasGerais += (valorVenda - valorDevolucao);
      });

      const resultado: VendasConsolidadas = {
        geral: totalVendasGerais,
        por_grupos: vendasPorGrupo,
        total_geral_todos_grupos: totalGeralTodosGrupos,
        dados_detalhados: dadosDetalhados
      };

      console.log('✅ Vendas consolidadas:', {
        'Total Geral (sem filtros)': `R$ ${totalVendasGerais.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
        'Total Todos os Grupos': `R$ ${totalGeralTodosGrupos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
        'Grupos com vendas': Object.keys(vendasPorGrupo).length
      });

      return resultado;
      
    } catch (error) {
      console.error('❌ Erro ao buscar vendas consolidadas:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar vendas consolidadas da API externa",
        variant: "destructive",
      });
      return {
        geral: 0,
        por_grupos: {},
        total_geral_todos_grupos: 0,
        dados_detalhados: []
      };
    } finally {
      setLoading(false);
    }
  };

  // 🚀 FUNÇÃO OTIMIZADA: Buscar vendas completas com grupos
  const buscarVendasCompletasComGrupos = async (
    dataInicio: string,
    dataFim: string,
    cdfil?: number
  ): Promise<{
    vendas_por_dia_grupo: any[];
    vendas_consolidadas: VendasConsolidadas;
    grupos_disponiveis: GrupoInfo[];
  }> => {
    setLoading(true);
    try {
      console.log('🚀 Iniciando busca completa de vendas com grupos...');
      
      // Executar buscas em paralelo para máxima eficiência
      const [vendasConsolidadas, gruposDisponiveis] = await Promise.all([
        buscarVendasConsolidasLoja(dataInicio, dataFim, cdfil),
        buscarTodosGrupos()
      ]);

      // Buscar dados por dia e grupo para gráficos
      const paramsGraficos: any = {
        dataFim,
        dataIni: dataInicio,
        groupBy: 'scekarde.DATA,scefilial.CDFIL,sceprodu.CDGRUPO',
        orderBy: 'scekarde.DATA asc'
      };

      if (cdfil) {
        const { data: lojaData } = await supabase
          .from('lojas')
          .select('numero')
          .eq('id', cdfil)
          .maybeSingle();
        
        if (lojaData) {
          paramsGraficos.filtroFiliais = lojaData.numero.toString().padStart(2, '0');
        }
      }

      const { data: dataGraficos } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/financeiro/vendas-por-funcionario',
          params: paramsGraficos
        }
      });

      const vendasPorDiaGrupo = dataGraficos?.msg || [];

      console.log('✅ Busca completa finalizada:', {
        'Vendas por dia/grupo': vendasPorDiaGrupo.length,
        'Grupos disponíveis': gruposDisponiveis.length,
        'Total consolidado': `R$ ${vendasConsolidadas.total_geral_todos_grupos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
      });

      return {
        vendas_por_dia_grupo: vendasPorDiaGrupo,
        vendas_consolidadas: vendasConsolidadas,
        grupos_disponiveis: gruposDisponiveis
      };
      
    } catch (error) {
      console.error('❌ Erro na busca completa:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar dados completos da API externa",
        variant: "destructive",
      });
      return {
        vendas_por_dia_grupo: [],
        vendas_consolidadas: {
          geral: 0,
          por_grupos: {},
          total_geral_todos_grupos: 0,
          dados_detalhados: []
        },
        grupos_disponiveis: []
      };
    } finally {
      setLoading(false);
    }
  };

  // 🚀 FUNÇÃO PARA RELATÓRIO DETALHADO DE GRUPOS
  const gerarRelatorioGrupos = async (
    dataInicio: string,
    dataFim: string,
    cdfil?: number
  ): Promise<{
    grupos_com_vendas: Array<{
      grupo: GrupoInfo;
      valor_total: number;
      percentual_total: number;
      numero_transacoes: number;
    }>;
    total_geral: number;
    grupos_sem_vendas: GrupoInfo[];
  }> => {
    setLoading(true);
    try {
      console.log('📊 Gerando relatório detalhado de grupos...');
      
      const [vendasCompletas] = await Promise.all([
        buscarVendasCompletasComGrupos(dataInicio, dataFim, cdfil)
      ]);

      const { vendas_consolidadas, grupos_disponiveis } = vendasCompletas;
      const vendasPorGrupo = vendas_consolidadas.por_grupos;
      const totalGeral = vendas_consolidadas.total_geral_todos_grupos;

      // Processar grupos com vendas
      const gruposComVendas = Object.entries(vendasPorGrupo).map(([grupoId, valor]) => {
        const grupo = grupos_disponiveis.find(g => g.CDGRUPO === parseInt(grupoId));
        const transacoes = vendas_consolidadas.dados_detalhados.filter(
          item => parseInt(item.CDGRUPO) === parseInt(grupoId)
        ).length;

        return {
          grupo: grupo || { CDGRUPO: parseInt(grupoId), NMGRUPO: `Grupo ${grupoId}` },
          valor_total: valor,
          percentual_total: totalGeral > 0 ? (valor / totalGeral) * 100 : 0,
          numero_transacoes: transacoes
        };
      }).sort((a, b) => b.valor_total - a.valor_total);

      // Identificar grupos sem vendas
      const gruposComVendasIds = new Set(Object.keys(vendasPorGrupo).map(id => parseInt(id)));
      const gruposSemVendas = grupos_disponiveis.filter(
        grupo => !gruposComVendasIds.has(grupo.CDGRUPO)
      );

      console.log('✅ Relatório de grupos gerado:', {
        'Grupos com vendas': gruposComVendas.length,
        'Grupos sem vendas': gruposSemVendas.length,
        'Total geral': `R$ ${totalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
      });

      return {
        grupos_com_vendas: gruposComVendas,
        total_geral: totalGeral,
        grupos_sem_vendas: gruposSemVendas
      };
      
    } catch (error) {
      console.error('❌ Erro ao gerar relatório de grupos:', error);
      return {
        grupos_com_vendas: [],
        total_geral: 0,
        grupos_sem_vendas: []
      };
    } finally {
      setLoading(false);
    }
  };

  // Manter funções existentes para compatibilidade
  const buscarVendasFuncionarios = async (filtros: FiltrosVendas): Promise<VendaFuncionario[]> => {
    setLoading(true);
    try {
      const params: any = {
        dataFim: filtros.dataFim,
        dataIni: filtros.dataInicio,
        groupBy: filtros.groupBy || 'scefun.CDFUN,scefilial.CDFIL',
        orderBy: filtros.orderBy || 'scefun.NOME asc'
      };

      if (filtros.filtroFornecedores) {
        params.filtroFornecedores = filtros.filtroFornecedores;
      }
      if (filtros.filtroGrupos) {
        params.filtroGrupos = filtros.filtroGrupos;
      }

      const { data, error } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/financeiro/vendas-por-funcionario',
          params
        }
      });

      if (error) throw error;
      
      const rawData = data?.msg || [];
      const funcionariosMap = new Map<string, VendaFuncionario>();
      
      rawData.forEach((item: any) => {
        const key = `${item.CDFUN}-${item.CDFIL}`;
        
        if (funcionariosMap.has(key)) {
          const funcionario = funcionariosMap.get(key)!;
          funcionario.TOTAL_VALOR += item.TOTAL_VLR_VE || 0;
          funcionario.TOTAL_QUANTIDADE += item.TOTAL_QTD_VE || 0;
        } else {
          funcionariosMap.set(key, {
            CDFUN: item.CDFUN,
            NOME: item.NOMEFUN,
            CDFIL: item.CDFIL,
            NOMEFIL: item.NOMEFIL,
            TOTAL_VALOR: item.TOTAL_VLR_VE || 0,
            TOTAL_QUANTIDADE: item.TOTAL_QTD_VE || 0
          });
        }
      });
      
      return Array.from(funcionariosMap.values());
    } catch (error) {
      console.error('Erro ao buscar vendas de funcionários:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar vendas de funcionários da API externa",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    // Novas funções otimizadas
    buscarTodosGrupos,
    buscarVendasConsolidasLoja,
    buscarVendasCompletasComGrupos,
    gerarRelatorioGrupos,
    // Funções existentes (mantidas para compatibilidade)
    buscarVendasFuncionarios
  };
};