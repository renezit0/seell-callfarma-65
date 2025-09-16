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

export interface FiltrosVendas {
  dataInicio: string;
  dataFim: string;
  filtroFornecedores?: string;
  filtroGrupos?: string;
  groupBy?: string;
  orderBy?: string;
}

export interface CampanhaVendasLoja {
  CDFIL: number;
  NOMEFIL: string;
  TOTAL_VALOR: number;
  TOTAL_QUANTIDADE: number;
  TOTAL_VLR_DV?: number;
  TOTAL_QTD_DV?: number;
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

export interface VendasConsolidadas {
  geral: number;
  por_grupos: Record<number, number>;
  total_geral_todos_grupos: number;
  dados_detalhados: any[];
  // Campos para categorias consolidadas da loja
  r_mais: number;
  perfumaria_r_mais: number;
  saude: number;
  conveniencia_r_mais: number;
  // Campos para categorias individuais de colaboradores
  similar: number;
  generico: number;
  perfumaria_alta: number;
  goodlife: number;
  rentaveis20: number;
  rentaveis25: number;
  dermocosmetico: number;
  conveniencia: number;
  brinquedo: number;
}

export interface GrupoInfo {
  CDGRUPO: number;
  NMGRUPO: string;
}

// Venda processada da API para compatibilidade com o componente
export interface VendaAPI {
  id: string;
  usuario_id: number;
  data_venda: string;
  categoria: string;
  valor_venda: number;
  loja_id?: number;
  registrado_por_usuario_id?: number | null;
}

// Mapeamento correto dos grupos conforme especificado
const GRUPOS_COLABORADORES = {
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

const GRUPOS_LOJA = {
  'r_mais': [20, 25],
  'perfumaria_r_mais': [46],
  'saude': [22],
  'conveniencia_r_mais': [36, 13]
};

export const useCallfarmaAPI = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Buscar todos os grupos disponíveis
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

  // FUNÇÃO PRINCIPAL: Buscar vendas consolidadas da loja com TODOS os dados da API
  const buscarVendasConsolidasCallfarma = async (
    dataInicio: string, 
    dataFim: string, 
    cdfil?: number
  ): Promise<VendasConsolidadas> => {
    setLoading(true);
    try {
      console.log(`🏪 Buscando vendas consolidadas da API Callfarma - CDFIL: ${cdfil || 'TODAS'}`);
      
      // Buscar número da loja se ID fornecido
      let filtroLoja = null;
      if (cdfil) {
        const { data: lojaData } = await supabase
          .from('lojas')
          .select('numero')
          .eq('id', cdfil)
          .maybeSingle();
        
        if (lojaData) {
          filtroLoja = lojaData.numero.toString().padStart(2, '0');
          console.log(`🏪 Filtro da loja: ${filtroLoja}`);
        }
      }

      // REQUISIÇÃO 1: Dados gerais (sem filtro de grupos) - INCLUI TODOS OS VENDEDORES/TERCEIROS
      const paramsGeral: any = {
        dataFim,
        dataIni: dataInicio,
        groupBy: 'scefilial.CDFIL',
        orderBy: 'TOTAL_VLR_VE desc'
      };

      if (filtroLoja) {
        paramsGeral.filtroFiliais = filtroLoja;
      }

      // REQUISIÇÃO 2: Dados detalhados por grupos - INCLUI TODOS OS VENDEDORES/TERCEIROS
      const paramsDetalhados: any = {
        dataFim,
        dataIni: dataInicio,
        groupBy: 'scefilial.CDFIL,sceprodu.CDGRUPO',
        orderBy: 'TOTAL_VLR_VE desc'
      };

      if (filtroLoja) {
        paramsDetalhados.filtroFiliais = filtroLoja;
      }

      console.log('🚀 Fazendo requisições em paralelo para máxima eficiência...');

      const [respostaGeral, respostaDetalhada] = await Promise.all([
        supabase.functions.invoke('callfarma-vendas', {
          body: {
            endpoint: '/financeiro/vendas-por-funcionario',
            params: paramsGeral
          }
        }),
        supabase.functions.invoke('callfarma-vendas', {
          body: {
            endpoint: '/financeiro/vendas-por-funcionario',
            params: paramsDetalhados
          }
        })
      ]);

      if (respostaGeral.error || respostaDetalhada.error) {
        throw new Error('Erro nas requisições da API Callfarma');
      }

      const dadosGerais = respostaGeral.data?.msg || [];
      const dadosDetalhados = respostaDetalhada.data?.msg || [];
      
      console.log(`📊 Dados recebidos - Geral: ${dadosGerais.length} | Detalhados: ${dadosDetalhados.length} registros`);

      // Processar dados gerais
      let totalGeral = 0;
      dadosGerais.forEach((item: any) => {
        const valorVenda = parseFloat(item.TOTAL_VLR_VE || 0);
        const valorDevolucao = parseFloat(item.TOTAL_VLR_DV || 0);
        totalGeral += (valorVenda - valorDevolucao);
      });

      // Processar dados por grupos
      const vendasPorGrupo: Record<number, number> = {};
      let totalTodosGrupos = 0;

      // Inicializar todas as categorias
      const categoriasLoja = {
        r_mais: 0,
        perfumaria_r_mais: 0,
        saude: 0,
        conveniencia_r_mais: 0
      };

      const categoriasColaboradores = {
        similar: 0,
        generico: 0,
        perfumaria_alta: 0,
        goodlife: 0,
        rentaveis20: 0,
        rentaveis25: 0,
        dermocosmetico: 0,
        conveniencia: 0,
        brinquedo: 0
      };

      dadosDetalhados.forEach((item: any) => {
        const valorVenda = parseFloat(item.TOTAL_VLR_VE || 0);
        const valorDevolucao = parseFloat(item.TOTAL_VLR_DV || 0);
        const valorLiquido = valorVenda - valorDevolucao;
        
        if (valorLiquido > 0) {
          const grupoId = parseInt(item.CDGRUPO);
          
          // Somar por grupo individual
          if (!vendasPorGrupo[grupoId]) {
            vendasPorGrupo[grupoId] = 0;
          }
          vendasPorGrupo[grupoId] += valorLiquido;
          totalTodosGrupos += valorLiquido;

          // Somar por categorias consolidadas da LOJA
          Object.entries(GRUPOS_LOJA).forEach(([categoria, grupos]) => {
            if (grupos.includes(grupoId)) {
              categoriasLoja[categoria as keyof typeof categoriasLoja] += valorLiquido;
            }
          });

          // Somar por categorias individuais de COLABORADORES
          Object.entries(GRUPOS_COLABORADORES).forEach(([categoria, grupos]) => {
            if (grupos.includes(grupoId)) {
              categoriasColaboradores[categoria as keyof typeof categoriasColaboradores] += valorLiquido;
            }
          });
        }
      });

      const resultado: VendasConsolidadas = {
        geral: totalGeral,
        por_grupos: vendasPorGrupo,
        total_geral_todos_grupos: totalTodosGrupos,
        dados_detalhados: dadosDetalhados,
        // Categorias consolidadas da loja
        ...categoriasLoja,
        // Categorias individuais de colaboradores  
        ...categoriasColaboradores
      };

      console.log('✅ Vendas consolidadas da API Callfarma:', {
        'Total Geral': `R$ ${totalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
        'Total Todos os Grupos': `R$ ${totalTodosGrupos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
        'R+ (20+25)': `R$ ${categoriasLoja.r_mais.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
        'Perfumaria R+ (46)': `R$ ${categoriasLoja.perfumaria_r_mais.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
        'Saúde (22)': `R$ ${categoriasLoja.saude.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
        'Conveniência R+ (36+13)': `R$ ${categoriasLoja.conveniencia_r_mais.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
        'Grupos com vendas': Object.keys(vendasPorGrupo).length
      });

      return resultado;
      
    } catch (error) {
      console.error('❌ Erro ao buscar vendas consolidadas da API:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar vendas da API externa",
        variant: "destructive",
      });
      return {
        geral: 0,
        por_grupos: {},
        total_geral_todos_grupos: 0,
        dados_detalhados: [],
        // Categorias consolidadas da loja
        r_mais: 0,
        perfumaria_r_mais: 0,
        saude: 0,
        conveniencia_r_mais: 0,
        // Categorias individuais de colaboradores
        similar: 0,
        generico: 0,
        perfumaria_alta: 0,
        goodlife: 0,
        rentaveis20: 0,
        rentaveis25: 0,
        dermocosmetico: 0,
        conveniencia: 0,
        brinquedo: 0
      };
    } finally {
      setLoading(false);
    }
  };

  // NOVA FUNÇÃO: Buscar vendas formatadas como lista para o componente
  const buscarVendasListaAPI = async (
    dataInicio: string,
    dataFim: string,
    cdfil?: number,
    vendedorId?: number,
    categoria?: string
  ): Promise<VendaAPI[]> => {
    setLoading(true);
    try {
      console.log('📋 Buscando lista de vendas da API...');

      let filtroLoja = null;
      if (cdfil) {
        const { data: lojaData } = await supabase
          .from('lojas')
          .select('numero')
          .eq('id', cdfil)
          .maybeSingle();
        
        if (lojaData) {
          filtroLoja = lojaData.numero.toString().padStart(2, '0');
        }
      }

      const params: any = {
        dataFim,
        dataIni: dataInicio,
        groupBy: 'scefun.CDFUN,scekarde.DATA,sceprodu.CDGRUPO',
        orderBy: 'scekarde.DATA desc'
      };

      if (filtroLoja) {
        params.filtroFiliais = filtroLoja;
      }

      if (vendedorId) {
        params.filtroFuncionarios = vendedorId.toString();
      }

      // Aplicar filtro de categoria através dos grupos
      if (categoria && categoria !== 'all' && categoria !== 'geral') {
        let grupos: number[] = [];
        
        if (categoria === 'r_mais') {
          grupos = GRUPOS_LOJA.r_mais;
        } else if (categoria === 'perfumaria_r_mais') {
          grupos = GRUPOS_LOJA.perfumaria_r_mais;
        } else if (categoria === 'saude') {
          grupos = GRUPOS_LOJA.saude;
        } else if (categoria === 'conveniencia_r_mais') {
          grupos = GRUPOS_LOJA.conveniencia_r_mais;
        } else if (GRUPOS_COLABORADORES[categoria as keyof typeof GRUPOS_COLABORADORES]) {
          grupos = GRUPOS_COLABORADORES[categoria as keyof typeof GRUPOS_COLABORADORES];
        }

        if (grupos.length > 0) {
          params.filtroGrupos = grupos.join(',');
        }
      }

      const { data, error } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/financeiro/vendas-por-funcionario',
          params
        }
      });

      if (error) throw error;

      const rawData = data?.msg || [];
      
      // Converter dados da API para formato compatível com o componente
      const vendasFormatadas: VendaAPI[] = rawData.map((item: any, index: number) => {
        const valorVenda = parseFloat(item.TOTAL_VLR_VE || 0);
        const valorDevolucao = parseFloat(item.TOTAL_VLR_DV || 0);
        const valorLiquido = valorVenda - valorDevolucao;
        
        // Determinar categoria baseada no grupo
        let categoriaItem = 'geral';
        const grupoId = parseInt(item.CDGRUPO);
        
        // Mapear grupo para categoria
        Object.entries(GRUPOS_LOJA).forEach(([cat, grupos]) => {
          if (grupos.includes(grupoId)) {
            categoriaItem = cat;
          }
        });

        Object.entries(GRUPOS_COLABORADORES).forEach(([cat, grupos]) => {
          if (grupos.includes(grupoId)) {
            categoriaItem = cat;
          }
        });

        return {
          id: `${item.CDFUN}-${item.DATA}-${index}`,
          usuario_id: item.CDFUN || 0,
          data_venda: item.DATA,
          categoria: categoriaItem,
          valor_venda: valorLiquido,
          loja_id: cdfil,
          registrado_por_usuario_id: item.CDFUN || 0
        };
      }).filter(venda => venda.valor_venda > 0);

      console.log(`✅ ${vendasFormatadas.length} vendas formatadas`);
      return vendasFormatadas;

    } catch (error) {
      console.error('❌ Erro ao buscar lista de vendas:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar lista de vendas da API externa",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  // NOVA FUNÇÃO: Buscar dados para gráficos da API
  const buscarDadosGraficosAPI = async (
    dataInicio: string,
    dataFim: string,
    cdfil?: number,
    vendedorId?: number
  ): Promise<any[]> => {
    setLoading(true);
    try {
      console.log('📈 Buscando dados para gráficos da API...');

      let filtroLoja = null;
      if (cdfil) {
        const { data: lojaData } = await supabase
          .from('lojas')
          .select('numero')
          .eq('id', cdfil)
          .maybeSingle();
        
        if (lojaData) {
          filtroLoja = lojaData.numero.toString().padStart(2, '0');
        }
      }

      const params: any = {
        dataFim,
        dataIni: dataInicio,
        groupBy: 'scekarde.DATA,scefilial.CDFIL,sceprodu.CDGRUPO',
        orderBy: 'scekarde.DATA asc'
      };

      if (filtroLoja) {
        params.filtroFiliais = filtroLoja;
      }

      if (vendedorId) {
        params.filtroFuncionarios = vendedorId.toString();
      }

      const { data, error } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/financeiro/vendas-por-funcionario',
          params
        }
      });

      if (error) throw error;

      return data?.msg || [];

    } catch (error) {
      console.error('❌ Erro ao buscar dados para gráficos:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Buscar vendas completas com grupos para gráficos
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
      console.log('🚀 Iniciando busca completa de vendas com grupos da API Callfarma...');
      
      const [vendasConsolidadas, gruposDisponiveis] = await Promise.all([
        buscarVendasConsolidasCallfarma(dataInicio, dataFim, cdfil),
        buscarTodosGrupos()
      ]);

      // Buscar dados por dia e grupo para gráficos
      const vendasPorDiaGrupo = await buscarDadosGraficosAPI(dataInicio, dataFim, cdfil);

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
          dados_detalhados: [],
          r_mais: 0,
          perfumaria_r_mais: 0,
          saude: 0,
          conveniencia_r_mais: 0,
          similar: 0,
          generico: 0,
          perfumaria_alta: 0,
          goodlife: 0,
          rentaveis20: 0,
          rentaveis25: 0,
          dermocosmetico: 0,
          conveniencia: 0,
          brinquedo: 0
        },
        grupos_disponiveis: []
      };
    } finally {
      setLoading(false);
    }
  };

  // Gerar relatório detalhado de grupos
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
      console.log('📊 Gerando relatório detalhado de grupos da API...');
      
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

  // Funções originais mantidas para compatibilidade
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

  const buscarFamilias = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/familias'
        }
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar famílias:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar famílias da API externa",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const buscarGrupos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/grupos'
        }
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar grupos:', error);
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

  const buscarMarcas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/marcas'
        }
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar marcas:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar marcas da API externa",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const buscarFornecedores = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/fornecedores',
          params: {
            fgResumido: 'true',
            estwin: 'true'
          }
        }
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar fornecedores:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar fornecedores da API externa",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    // Novas funções otimizadas para API Callfarma
    buscarTodosGrupos,
    buscarVendasConsolidasCallfarma,
    buscarVendasListaAPI,
    buscarDadosGraficosAPI,
    buscarVendasCompletasComGrupos,
    gerarRelatorioGrupos,
    // Funções existentes (mantidas para compatibilidade)
    buscarVendasFuncionarios,
    buscarFamilias,
    buscarGrupos,
    buscarMarcas,
    buscarFornecedores
  };
};