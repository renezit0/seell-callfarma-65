import { useState, useCallback } from 'react';
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

// Interfaces para a página Vendas
export interface VendaFilial {
  DATA: string;
  CDGRUPO: number;
  valor: number;
  vldesc: number;
  pretab: number;
  cusliq: number;
  CDFIL: number;
  ABREV: string;
  cusliqAnt: number;
  valorAnt: number;
  crescimento: string;
  totCliAnt: number;
  ticketMedioAnt: number;
  margemAnt: string;
  margem: string;
  totCli: number;
  ticketMedio: number;
}

export interface VendaFuncionarioDetalhada {
  CDFIL: number;
  NOMEFIL: string;
  CDFUN: number;
  NOMEFUN: string;
  CPFFUN: number;
  CDPRODU: number;
  NOMEPRODU: string;
  CDGRUPO: number;
  NOMEGRUPO: string;
  CDMARCA: number;
  NOMEMARCA: string;
  CDFAMIL: number;
  NOMEFAMIL: string;
  CDFORNE: number;
  NOMEFORNE: string;
  DATA: string;
  TOTAL_QTD_VE: number;
  TOTAL_QTD_DV: number;
  TOTAL_VLR_VE: number;
  TOTAL_VLR_DV: number;
}

// Mapeamento dos grupos por categoria
const GRUPOS_POR_CATEGORIA = {
  'rentaveis': '20,25',
  'perfumaria_alta': '36',
  'conveniencia_alta': '13',
  'goodlife': '22',
  'geral': ''
};

export const useCallfarmaAPI = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // ✅ Função helper para fazer requisições à API
  const makeAPIRequest = useCallback(async (endpoint: string, params: any = {}) => {
    const { data, error } = await supabase.functions.invoke('callfarma-vendas', {
      body: { endpoint, params }
    });

    if (error) throw error;
    return data?.msg || [];
  }, []);

  // ✅ Função helper para processar dados com valor líquido
  const processarDadosComValorLiquido = useCallback((items: any[]) => {
    return items.map(item => {
      const valorVenda = parseFloat(item.TOTAL_VLR_VE || 0);
      const valorDevolucao = parseFloat(item.TOTAL_VLR_DV || 0);
      
      return {
        ...item,
        TOTAL_VLR_VE: valorVenda,
        TOTAL_VLR_DV: valorDevolucao,
        VALOR_LIQUIDO: valorVenda - valorDevolucao
      };
    }).filter(item => item.VALOR_LIQUIDO > 0);
  }, []);

  // ✅ BUSCAR VENDAS FUNCIONÁRIOS (compatível com outras páginas)
  const buscarVendasFuncionarios = useCallback(async (filtros: FiltrosVendas): Promise<VendaFuncionario[]> => {
    setLoading(true);
    try {
      const params: any = {
        dataFim: filtros.dataFim,
        dataIni: filtros.dataInicio,
        groupBy: filtros.groupBy || 'scefun.CDFUN,scefilial.CDFIL',
        orderBy: filtros.orderBy || 'scefun.NOME asc'
      };

      if (filtros.filtroFornecedores) params.filtroFornecedores = filtros.filtroFornecedores;
      if (filtros.filtroGrupos) params.filtroGrupos = filtros.filtroGrupos;

      const rawData = await makeAPIRequest('/financeiro/vendas-por-funcionario', params);
      
      // Agregar dados por funcionário
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
  }, [makeAPIRequest, toast]);

  // ✅ BUSCAR DADOS BÁSICOS (compatível com outras páginas)
  const buscarFamilias = useCallback(async () => {
    setLoading(true);
    try {
      return await makeAPIRequest('/familias');
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
  }, [makeAPIRequest, toast]);

  const buscarGrupos = useCallback(async () => {
    setLoading(true);
    try {
      return await makeAPIRequest('/grupos');
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
  }, [makeAPIRequest, toast]);

  const buscarMarcas = useCallback(async () => {
    setLoading(true);
    try {
      return await makeAPIRequest('/marcas');
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
  }, [makeAPIRequest, toast]);

  const buscarFornecedores = useCallback(async () => {
    setLoading(true);
    try {
      return await makeAPIRequest('/fornecedores', {
        fgResumido: 'true',
        estwin: 'true'
      });
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
  }, [makeAPIRequest, toast]);

  // ✅ BUSCAR VENDAS POR CATEGORIA (compatível com outras páginas)
  const buscarVendasPorCategoria = useCallback(async (categoria: string, dataInicio: string, dataFim: string): Promise<any[]> => {
    setLoading(true);
    try {
      const params: any = {
        dataFim,
        dataIni: dataInicio,
        groupBy: 'scefilial.CDFIL',
        orderBy: 'scefun.NOME asc'
      };

      const gruposCategoria = GRUPOS_POR_CATEGORIA[categoria as keyof typeof GRUPOS_POR_CATEGORIA];
      if (gruposCategoria) {
        params.filtroGrupos = gruposCategoria;
      }

      return await makeAPIRequest('/financeiro/vendas-por-funcionario', params);
    } catch (error) {
      console.error(`Erro ao buscar vendas da categoria ${categoria}:`, error);
      toast({
        title: "Erro",
        description: `Erro ao buscar vendas da categoria ${categoria}`,
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [makeAPIRequest, toast]);

  // ✅ BUSCAR VENDAS CAMPANHA (compatível com outras páginas)
  const buscarVendasCampanha = useCallback(async (filtros: FiltroCampanha): Promise<CampanhaVendasLoja[]> => {
    setLoading(true);
    try {
      const params: any = {
        dataFim: filtros.dataFim,
        dataIni: filtros.dataInicio,
        groupBy: 'scefilial.CDFIL',
        orderBy: 'TOTAL_VLR_VE desc'
      };

      if (filtros.filtroFornecedores) params.filtroFornecedores = filtros.filtroFornecedores;
      if (filtros.filtroMarcas) params.filtroMarcas = filtros.filtroMarcas;
      if (filtros.filtroFamilias) params.filtroFamilias = filtros.filtroFamilias;
      if (filtros.filtroGrupos) params.filtroGrupos = filtros.filtroGrupos;
      if (filtros.filtroProduto) params.filtroProduto = filtros.filtroProduto;

      const rawData = await makeAPIRequest('/financeiro/vendas-por-funcionario', params);
      
      // Agregar dados por loja (CDFIL)
      const lojasMap = new Map<number, CampanhaVendasLoja>();
      
      rawData.forEach((item: any) => {
        const cdfil = item.CDFIL;
        
        if (lojasMap.has(cdfil)) {
          const loja = lojasMap.get(cdfil)!;
          loja.TOTAL_VALOR += item.TOTAL_VLR_VE || 0;
          loja.TOTAL_QUANTIDADE += item.TOTAL_QTD_VE || 0;
          loja.TOTAL_VLR_DV = (loja.TOTAL_VLR_DV || 0) + (item.TOTAL_VLR_DV || 0);
          loja.TOTAL_QTD_DV = (loja.TOTAL_QTD_DV || 0) + (item.TOTAL_QTD_DV || 0);
        } else {
          lojasMap.set(cdfil, {
            CDFIL: cdfil,
            NOMEFIL: item.NOMEFIL,
            TOTAL_VALOR: item.TOTAL_VLR_VE || 0,
            TOTAL_QUANTIDADE: item.TOTAL_QTD_VE || 0,
            TOTAL_VLR_DV: item.TOTAL_VLR_DV || 0,
            TOTAL_QTD_DV: item.TOTAL_QTD_DV || 0
          });
        }
      });
      
      return Array.from(lojasMap.values());
    } catch (error) {
      console.error('Erro ao buscar vendas da campanha:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar vendas da campanha da API externa",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [makeAPIRequest, toast]);

  const buscarVendasCampanhaDetalhada = useCallback(async (filtros: FiltroCampanha): Promise<any[]> => {
    setLoading(true);
    try {
      const params: any = {
        dataFim: filtros.dataFim,
        dataIni: filtros.dataInicio,
        groupBy: 'scefun.CDFUN,scefilial.CDFIL',
        orderBy: 'TOTAL_VLR_VE desc'
      };

      if (filtros.filtroProduto) params.filtroProduto = filtros.filtroProduto;
      if (filtros.filtroFornecedores) params.filtroFornecedores = filtros.filtroFornecedores;
      if (filtros.filtroMarcas) params.filtroMarcas = filtros.filtroMarcas;
      if (filtros.filtroFamilias) params.filtroFamilias = filtros.filtroFamilias;
      if (filtros.filtroGrupos) params.filtroGrupos = filtros.filtroGrupos;

      return await makeAPIRequest('/financeiro/vendas-por-funcionario', params);
    } catch (error) {
      console.error('Erro ao buscar vendas detalhadas da campanha:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar vendas detalhadas da campanha da API externa",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [makeAPIRequest, toast]);

  // ✅ BUSCAR VENDAS POR PRODUTO (compatível com outras páginas)
  const buscarVendasPorProduto = useCallback(async (params: {
    dataInicio: string;
    dataFim: string;
    codigosProdutos: string;
    cdfil?: number;
  }) => {
    setLoading(true);
    try {
      const requestParams: any = {
        dataIni: params.dataInicio,
        dataFim: params.dataFim,
        filtroProduto: params.codigosProdutos,
        groupBy: 'scefilial.CDFIL,scefun.CDFUN',
        orderBy: 'scefun.NOME asc'
      };

      if (params.cdfil) {
        requestParams.filtroFiliais = params.cdfil.toString();
      }

      return await makeAPIRequest('/financeiro/vendas-por-funcionario', requestParams);
    } catch (error) {
      console.error('Erro ao buscar vendas por produto:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar vendas por produto da API externa",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [makeAPIRequest, toast]);

  // ✅ BUSCAR VENDAS POR LOJA E DIA (compatível com outras páginas)
  const buscarVendasPorLojaEDia = useCallback(async (dataInicio: string, dataFim: string, grupos?: string): Promise<any[]> => {
    setLoading(true);
    try {
      const params: any = {
        dataFim,
        dataIni: dataInicio,
        groupBy: 'scefilial.CDFIL,scekarde.DATA',
        orderBy: 'scefun.NOME asc'
      };

      if (grupos) {
        params.filtroGrupos = grupos;
      }

      return await makeAPIRequest('/financeiro/vendas-por-funcionario', params);
    } catch (error) {
      console.error('Erro ao buscar vendas por loja e dia:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar vendas por loja e dia da API externa",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [makeAPIRequest, toast]);

  // ✅ FUNÇÃO ULTRA OTIMIZADA - TODAS AS CATEGORIAS EM 2 REQUISIÇÕES (compatível com outras páginas)
  const buscarTodasVendasConsolidadas = useCallback(async (dataInicio: string, dataFim: string, userLojaId?: number): Promise<{
    geral: any[],
    rentaveis: any[],
    perfumaria_alta: any[],
    conveniencia_alta: any[],
    goodlife: any[]
  }> => {
    setLoading(true);
    try {
      let filtroLoja = null;
      if (userLojaId) {
        const { data: lojaData, error: lojaError } = await supabase
          .from('lojas')
          .select('numero')
          .eq('id', userLojaId)
          .maybeSingle();

        if (!lojaError && lojaData) {
          filtroLoja = lojaData.numero.toString().padStart(2, '0');
        }
      }

      const [dadosGeral, dadosGrupos] = await Promise.all([
        makeAPIRequest('/financeiro/vendas-por-funcionario', {
          dataFim,
          dataIni: dataInicio,
          groupBy: 'scefilial.CDFIL,scekarde.DATA',
          orderBy: 'scefun.NOME asc',
          ...(filtroLoja && { filtroFiliais: filtroLoja })
        }),
        makeAPIRequest('/financeiro/vendas-por-funcionario', {
          dataFim,
          dataIni: dataInicio,
          filtroGrupos: '36,13,25,20,46,22',
          groupBy: 'scekarde.DATA,scefilial.CDFIL,sceprodu.CDGRUPO',
          orderBy: 'scefun.NOME asc',
          ...(filtroLoja && { filtroFiliais: filtroLoja })
        })
      ]);

      const dadosGeraisProcessados = processarDadosComValorLiquido(dadosGeral);
      
      const gruposMap = {
        rentaveis: [20, 25],
        perfumaria_alta: [46],
        conveniencia_alta: [36, 13],
        goodlife: [22]
      };

      const resultados = {
        geral: dadosGeraisProcessados,
        rentaveis: processarDadosComValorLiquido(dadosGrupos.filter((item: any) => gruposMap.rentaveis.includes(parseInt(item.CDGRUPO)))),
        perfumaria_alta: processarDadosComValorLiquido(dadosGrupos.filter((item: any) => gruposMap.perfumaria_alta.includes(parseInt(item.CDGRUPO)))),
        conveniencia_alta: processarDadosComValorLiquido(dadosGrupos.filter((item: any) => gruposMap.conveniencia_alta.includes(parseInt(item.CDGRUPO)))),
        goodlife: processarDadosComValorLiquido(dadosGrupos.filter((item: any) => gruposMap.goodlife.includes(parseInt(item.CDGRUPO))))
      };
      
      return resultados;
      
    } catch (error) {
      console.error('Erro na busca consolidada:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar dados consolidados da API externa",
        variant: "destructive",
      });
      return {
        geral: [],
        rentaveis: [],
        perfumaria_alta: [],
        conveniencia_alta: [],
        goodlife: []
      };
    } finally {
      setLoading(false);
    }
  }, [makeAPIRequest, processarDadosComValorLiquido, toast]);

  // ✅ BUSCAR VENDAS HOJE POR CATEGORIA (compatível com outras páginas)
  const buscarVendasHojePorCategoria = useCallback(async (cdfil: number, dataHoje: string): Promise<{
    geral: number,
    rentaveis: number,
    perfumaria: number,
    conveniencia: number,
    goodlife: number
  }> => {
    setLoading(true);
    try {
      const cdfilStr = cdfil.toString();
      
      const [dadosGeralHoje, dadosGruposHoje] = await Promise.all([
        makeAPIRequest('/financeiro/vendas-por-funcionario', {
          dataFim: dataHoje,
          dataIni: dataHoje,
          groupBy: 'scefilial.CDFIL',
          orderBy: 'TOTAL_VLR_VE desc',
          filtroFiliais: cdfilStr
        }),
        makeAPIRequest('/financeiro/vendas-por-funcionario', {
          dataFim: dataHoje,
          dataIni: dataHoje,
          filtroGrupos: '36,13,25,20,46,22',
          groupBy: 'scefilial.CDFIL,sceprodu.CDGRUPO',
          orderBy: 'TOTAL_VLR_VE desc',
          filtroFiliais: cdfilStr
        })
      ]);

      const dadosGeralFiltrados = dadosGeralHoje.filter((item: any) => 
        item.CDFIL && item.CDFIL.toString() === cdfilStr
      );
      
      const totalGeral = dadosGeralFiltrados.reduce((sum: number, item: any) => {
        const valorLiquido = (parseFloat(item.TOTAL_VLR_VE || 0)) - (parseFloat(item.TOTAL_VLR_DV || 0));
        return sum + valorLiquido;
      }, 0);

      const dadosGruposFiltrados = dadosGruposHoje.filter((item: any) => 
        item.CDFIL && item.CDFIL.toString() === cdfilStr
      );
      
      const vendasPorGrupo = dadosGruposFiltrados.reduce((acc: any, item: any) => {
        const grupo = parseInt(item.CDGRUPO);
        const valorLiquido = (parseFloat(item.TOTAL_VLR_VE || 0)) - (parseFloat(item.TOTAL_VLR_DV || 0));

        if ([20, 25].includes(grupo)) {
          acc.rentaveis += valorLiquido;
        } else if ([46].includes(grupo)) {
          acc.perfumaria += valorLiquido;
        } else if ([36, 13].includes(grupo)) {
          acc.conveniencia += valorLiquido;
        } else if ([22].includes(grupo)) {
          acc.goodlife += valorLiquido;
        }

        return acc;
      }, {
        rentaveis: 0,
        perfumaria: 0,
        conveniencia: 0,
        goodlife: 0
      });

      return {
        geral: totalGeral,
        rentaveis: vendasPorGrupo.rentaveis,
        perfumaria: vendasPorGrupo.perfumaria,
        conveniencia: vendasPorGrupo.conveniencia,
        goodlife: vendasPorGrupo.goodlife
      };
      
    } catch (error) {
      console.error('Erro ao buscar vendas de hoje:', error);
      return {
        geral: 0,
        rentaveis: 0,
        perfumaria: 0,
        conveniencia: 0,
        goodlife: 0
      };
    } finally {
      setLoading(false);
    }
  }, [makeAPIRequest]);

  // ✅ BUSCAR VENDAS HOJE POR LOJA (compatível com outras páginas)
  const buscarVendasHojePorLoja = useCallback(async (cdfil: string, dataAtual: string): Promise<{
    geral: number;
    rentaveis: number;
    perfumaria: number;
    conveniencia: number;
    goodlife: number;
  }> => {
    setLoading(true);
    try {
      const buscarVendasPorLojaCategoria = async (grupos: string): Promise<number> => {
        const params: any = {
          dataFim: dataAtual,
          dataIni: dataAtual,
          groupBy: 'scefilial.CDFIL',
          orderBy: 'TOTAL_VLR_VE desc',
          filtroFiliais: cdfil
        };

        if (grupos) {
          params.filtroGrupos = grupos;
        }

        const rawData = await makeAPIRequest('/financeiro/vendas-por-funcionario', params);
        
        const vendasFiltradas = rawData.filter((item: any) => 
          item.CDFIL && item.CDFIL.toString() === cdfil.toString()
        );
        
        return vendasFiltradas.reduce((sum: number, item: any) => {
          return sum + (item.TOTAL_VLR_VE || 0);
        }, 0);
      };

      const [vendasGeral, vendasRentaveis, vendasPerfumaria, vendasConveniencia, vendasGoodlife] = await Promise.all([
        buscarVendasPorLojaCategoria(''),
        buscarVendasPorLojaCategoria('20,25'),
        buscarVendasPorLojaCategoria('46'),
        buscarVendasPorLojaCategoria('36,13'),
        buscarVendasPorLojaCategoria('22')
      ]);

      return {
        geral: vendasGeral,
        rentaveis: vendasRentaveis,
        perfumaria: vendasPerfumaria,
        conveniencia: vendasConveniencia,
        goodlife: vendasGoodlife
      };
    } catch (error) {
      console.error('Erro ao buscar vendas de hoje por loja:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar vendas de hoje da API externa",
        variant: "destructive",
      });
      return {
        geral: 0,
        rentaveis: 0,
        perfumaria: 0,
        conveniencia: 0,
        goodlife: 0
      };
    } finally {
      setLoading(false);
    }
  }, [makeAPIRequest, toast]);

  // ✅ FUNÇÃO SUPER OTIMIZADA PARA GRÁFICOS (compatível com outras páginas)
  const buscarTodosDadosGraficos = useCallback(async (dataInicio: string, dataFim: string, userLojaId?: number): Promise<{
    geral: any[];
    rentaveis: any[];
    perfumaria_alta: any[];
    conveniencia_alta: any[];
    goodlife: any[];
  }> => {
    setLoading(true);
    try {
      let filtroLoja = null;
      if (userLojaId) {
        const { data: lojaData, error: lojaError } = await supabase
          .from('lojas')
          .select('numero')
          .eq('id', userLojaId)
          .maybeSingle();

        if (!lojaError && lojaData) {
          filtroLoja = lojaData.numero.toString().padStart(2, '0');
        }
      }

      const [dadosGeral, dadosGrupos] = await Promise.all([
        makeAPIRequest('/financeiro/vendas-por-funcionario', {
          dataFim,
          dataIni: dataInicio,
          groupBy: 'scefilial.CDFIL,scekarde.DATA',
          orderBy: 'scefun.NOME asc',
          ...(filtroLoja && { filtroFiliais: filtroLoja })
        }),
        makeAPIRequest('/financeiro/vendas-por-funcionario', {
          dataFim,
          dataIni: dataInicio,
          filtroGrupos: '36,13,25,20,46,22',
          groupBy: 'scekarde.DATA,scefilial.CDFIL,sceprodu.CDGRUPO',
          orderBy: 'scefun.NOME asc',
          ...(filtroLoja && { filtroFiliais: filtroLoja })
        })
      ]);

      const geralProcessado = processarDadosComValorLiquido(dadosGeral);
      const gruposProcessados = processarDadosComValorLiquido(dadosGrupos);
      
      const resultado = {
        geral: geralProcessado,
        rentaveis: gruposProcessados.filter(item => [20, 25].includes(parseInt(item.CDGRUPO))),
        perfumaria_alta: gruposProcessados.filter(item => [46].includes(parseInt(item.CDGRUPO))),
        conveniencia_alta: gruposProcessados.filter(item => [36, 13].includes(parseInt(item.CDGRUPO))),
        goodlife: gruposProcessados.filter(item => [22].includes(parseInt(item.CDGRUPO)))
      };
      
      return resultado;
      
    } catch (error) {
      console.error(`Erro ao buscar todos os dados dos gráficos:`, error);
      toast({
        title: "Erro",
        description: `Erro ao buscar dados dos gráficos`,
        variant: "destructive",
      });
      return { geral: [], rentaveis: [], perfumaria_alta: [], conveniencia_alta: [], goodlife: [] };
    } finally {
      setLoading(false);
    }
  }, [makeAPIRequest, processarDadosComValorLiquido, toast]);

  // ========== NOVAS FUNÇÕES PARA PÁGINA VENDAS ==========

  // ✅ BUSCAR VENDAS POR FILIAL
  const buscarVendasPorFilial = useCallback(async (
    cdfil: number | 'all',
    dataInicio: string,
    dataFim: string
  ): Promise<VendaFilial[]> => {
    setLoading(true);
    try {
      const params: any = {
        dataFim,
        dataIni: dataInicio,
        dataFimAnt: dataFim,
        dataIniAnt: dataInicio,
      };

      if (cdfil !== 'all') {
        params.cdfil = cdfil;
      }

      return await makeAPIRequest('/financeiro/vendas-por-filial', params);
    } catch (error) {
      console.error('Erro ao buscar vendas por filial:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar vendas por filial da API externa",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [makeAPIRequest, toast]);

  // ✅ BUSCAR FUNCIONÁRIOS DETALHADAS
  const buscarVendasFuncionariosDetalhadas = useCallback(async (
    dataInicio: string,
    dataFim: string,
    cdfil?: number | 'all',
    cdfun?: number
  ): Promise<VendaFuncionarioDetalhada[]> => {
    setLoading(true);
    try {
      const params: any = {
        dataFim,
        dataIni: dataInicio,
        filtroGrupos: '20,25,46,36,13,22',
        groupBy: 'scefilial.CDFIL,scefun.CDFUN,sceprodu.CDGRUPO,scekarde.DATA',
        orderBy: 'scefun.NOME asc'
      };

      if (cdfil && cdfil !== 'all') {
        params.filtroFiliais = cdfil.toString();
      }

      if (cdfun) {
        params.filtroFuncionarios = cdfun.toString();
      }

      return await makeAPIRequest('/financeiro/vendas-por-funcionario', params);
    } catch (error) {
      console.error('Erro ao buscar vendas funcionários detalhadas:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar vendas funcionários da API externa",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [makeAPIRequest, toast]);

  // ✅ BUSCAR TODOS OS DADOS DA PÁGINA VENDAS
  const buscarDadosVendasCompletos = useCallback(async (
    dataInicio: string,
    dataFim: string,
    cdfil?: number | 'all'
  ): Promise<{
    vendasFilial: VendaFilial[];
    vendasFuncionarios: VendaFuncionarioDetalhada[];
    funcionarios: Array<{id: number, nome: string}>;
  }> => {
    setLoading(true);
    try {
      const [dadosFilial, dadosFuncionarios] = await Promise.all([
        buscarVendasPorFilial(cdfil || 'all', dataInicio, dataFim),
        buscarVendasFuncionariosDetalhadas(dataInicio, dataFim, cdfil)
      ]);

      // Extrair lista única de funcionários
      const funcionariosMap = new Map();
      dadosFuncionarios.forEach(item => {
        if (item.CDFUN && item.NOMEFUN) {
          funcionariosMap.set(item.CDFUN, {
            id: item.CDFUN,
            nome: item.NOMEFUN
          });
        }
      });

      const funcionarios = Array.from(funcionariosMap.values())
        .sort((a, b) => a.nome.localeCompare(b.nome));

      return {
        vendasFilial: dadosFilial,
        vendasFuncionarios: dadosFuncionarios,
        funcionarios
      };

    } catch (error) {
      console.error('Erro ao buscar dados completos de vendas:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar dados completos de vendas da API externa",
        variant: "destructive",
      });
      return {
        vendasFilial: [],
        vendasFuncionarios: [],
        funcionarios: []
      };
    } finally {
      setLoading(false);
    }
  }, [buscarVendasPorFilial, buscarVendasFuncionariosDetalhadas, toast]);

  return {
    loading,
    // Funções originais (compatíveis com outras páginas)
    buscarVendasFuncionarios,
    buscarVendasPorCategoria,
    buscarVendasCampanha,
    buscarVendasCampanhaDetalhada,
    buscarTodasVendasConsolidadas,
    buscarVendasHojePorCategoria,
    buscarVendasHojePorLoja,
    buscarFamilias,
    buscarGrupos,
    buscarMarcas,
    buscarFornecedores,
    buscarVendasPorProduto,
    buscarVendasPorLojaEDia,
    buscarTodosDadosGraficos,
    // Novas funções para página Vendas
    buscarVendasPorFilial,
    buscarVendasFuncionariosDetalhadas,
    buscarDadosVendasCompletos
  };
};