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

// Interface para dados de vendas por filial
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

// Interface para dados de funcionários
export interface VendaFuncionarioAPI {
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

// Mapeamento dos grupos por categoria conforme API Callfarma
const GRUPOS_POR_CATEGORIA = {
  'rentaveis': '20,25', // grupos 20 e 25
  'perfumaria_alta': '46', // grupo 46
  'conveniencia_alta': '36,13', // grupos 36 e 13
  'goodlife': '22', // grupo 22
  'todos_indicadores': '20,25,46,36,13,22' // todos os grupos
};

export const useCallfarmaAPI = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Função para buscar vendas gerais por filial
  const buscarVendasPorFilial = async (
    cdfil: number | 'all',
    dataInicio: string,
    dataFim: string
  ): Promise<VendaFilial[]> => {
    setLoading(true);
    try {
      const params: any = {
        dataFim,
        dataIni: dataInicio,
        dataFimAnt: dataFim, // Para não quebrar a API, mesmo valor
        dataIniAnt: dataInicio, // Para não quebrar a API, mesmo valor
      };

      // Se não for 'all', filtrar por filial específica
      if (cdfil !== 'all') {
        params.cdfil = cdfil;
      }

      const { data, error } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/financeiro/vendas-por-filial',
          params
        }
      });

      if (error) throw error;
      
      const rawData = data?.msg || [];
      console.log('Dados vendas por filial:', rawData);
      
      return rawData;
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
  };

  // Função para buscar dados de funcionários por categoria
  const buscarVendasFuncionariosPorCategoria = async (
    dataInicio: string,
    dataFim: string,
    cdfil?: number | 'all'
  ): Promise<VendaFuncionarioAPI[]> => {
    setLoading(true);
    try {
      const params: any = {
        dataFim,
        dataIni: dataInicio,
        filtroGrupos: GRUPOS_POR_CATEGORIA.todos_indicadores,
        groupBy: 'scefilial.CDFIL,scefun.CDFUN,sceprodu.CDGRUPO,scekarde.DATA',
        orderBy: 'scefun.NOME asc'
      };

      // Filtrar por filial se especificado
      if (cdfil && cdfil !== 'all') {
        params.filtroFiliais = cdfil.toString();
      }

      const { data, error } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/financeiro/vendas-por-funcionario',
          params
        }
      });

      if (error) throw error;
      
      const rawData = data?.msg || [];
      console.log('Dados vendas funcionários por categoria:', rawData.length);
      
      return rawData;
    } catch (error) {
      console.error('Erro ao buscar vendas funcionários por categoria:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar vendas funcionários da API externa",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Função otimizada para buscar todos os dados necessários em uma requisição
  const buscarDadosVendasCompletos = async (
    dataInicio: string,
    dataFim: string,
    cdfil?: number | 'all'
  ): Promise<{
    vendasFilial: VendaFilial[];
    vendasFuncionarios: VendaFuncionarioAPI[];
    funcionarios: Array<{id: number, nome: string}>;
  }> => {
    setLoading(true);
    try {
      console.log('Buscando dados completos de vendas - API Callfarma');
      
      // Fazer as duas requisições em paralelo para otimizar
      const [dadosFilial, dadosFuncionarios] = await Promise.all([
        buscarVendasPorFilial(cdfil || 'all', dataInicio, dataFim),
        buscarVendasFuncionariosPorCategoria(dataInicio, dataFim, cdfil)
      ]);

      // Extrair lista única de funcionários que tiveram vendas
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

      console.log(`Dados completos: ${dadosFilial.length} filiais, ${dadosFuncionarios.length} registros funcionários, ${funcionarios.length} funcionários únicos`);

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
  };

  // Função para buscar dados de um funcionário específico
  const buscarVendasFuncionarioEspecifico = async (
    dataInicio: string,
    dataFim: string,
    cdfun: number,
    cdfil?: number
  ): Promise<VendaFuncionarioAPI[]> => {
    setLoading(true);
    try {
      const params: any = {
        dataFim,
        dataIni: dataInicio,
        filtroFuncionarios: cdfun.toString(),
        groupBy: 'scefilial.CDFIL,scefun.CDFUN,sceprodu.CDGRUPO,scekarde.DATA',
        orderBy: 'scekarde.DATA desc'
      };

      // Filtrar por filial se especificado
      if (cdfil) {
        params.filtroFiliais = cdfil.toString();
      }

      const { data, error } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/financeiro/vendas-por-funcionario',
          params
        }
      });

      if (error) throw error;
      
      const rawData = data?.msg || [];
      console.log(`Dados funcionário específico ${cdfun}:`, rawData.length);
      
      return rawData;
    } catch (error) {
      console.error('Erro ao buscar vendas funcionário específico:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar vendas do funcionário da API externa",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Manter as funções originais para compatibilidade
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
      console.log('Dados brutos da API:', rawData);
      
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
      
      const vendas = Array.from(funcionariosMap.values());
      console.log('Vendas agregadas:', vendas);
      
      return vendas;
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

  // Funções existentes mantidas para compatibilidade
  const buscarVendasPorCategoria = async (categoria: string, dataInicio: string, dataFim: string): Promise<any[]> => {
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

      const { data, error } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/financeiro/vendas-por-funcionario',
          params
        }
      });

      if (error) throw error;
      return data?.msg || [];
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
  };

  const buscarVendasCampanha = async (filtros: FiltroCampanha): Promise<CampanhaVendasLoja[]> => {
    setLoading(true);
    try {
      const params: any = {
        dataFim: filtros.dataFim,
        dataIni: filtros.dataInicio,
        groupBy: 'scefilial.CDFIL',
        orderBy: 'TOTAL_VLR_VE desc'
      };

      if (filtros.filtroFornecedores) {
        params.filtroFornecedores = filtros.filtroFornecedores;
      }
      if (filtros.filtroMarcas) {
        params.filtroMarcas = filtros.filtroMarcas;
      }
      if (filtros.filtroFamilias) {
        params.filtroFamilias = filtros.filtroFamilias;
      }
      if (filtros.filtroGrupos) {
        params.filtroGrupos = filtros.filtroGrupos;
      }
      if (filtros.filtroProduto) {
        params.filtroProduto = filtros.filtroProduto;
      }

      const { data, error } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/financeiro/vendas-por-funcionario',
          params
        }
      });

      if (error) throw error;
      
      const rawData = data?.msg || [];
      console.log('Dados brutos da campanha:', rawData);
      
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
      
      const vendasCampanha = Array.from(lojasMap.values());
      console.log('Vendas da campanha agregadas por loja:', vendasCampanha);
      
      return vendasCampanha;
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
  };

  const buscarVendasPorProduto = async (params: {
    dataInicio: string;
    dataFim: string;
    codigosProdutos: string;
    cdfil?: number;
  }) => {
    setLoading(true);
    try {
      console.log('Buscando vendas por produto:', params);
      
      const { data } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/financeiro/vendas-por-funcionario',
          params: {
            dataIni: params.dataInicio,
            dataFim: params.dataFim,
            filtroProduto: params.codigosProdutos,
            groupBy: 'scefilial.CDFIL,scefun.CDFUN',
            orderBy: 'scefun.NOME asc',
            ...(params.cdfil && { filtroFiliais: params.cdfil.toString() })
          }
        }
      });

      console.log('Dados de vendas por produto recebidos:', data?.msg?.length || 0, 'registros');
      return data?.msg || [];
      
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
  };

  const buscarVendasCampanhaDetalhada = async (filtros: FiltroCampanha): Promise<any[]> => {
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

      const { data, error } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/financeiro/vendas-por-funcionario',
          params
        }
      });

      if (error) throw error;
      
      return data?.msg || [];
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
  };

  return {
    loading,
    // Novas funções principais
    buscarDadosVendasCompletos,
    buscarVendasPorFilial,
    buscarVendasFuncionariosPorCategoria,
    buscarVendasFuncionarioEspecifico,
    // Funções originais mantidas para compatibilidade
    buscarVendasFuncionarios,
    buscarVendasPorCategoria,
    buscarVendasCampanha,
    buscarVendasCampanhaDetalhada,
    buscarFamilias,
    buscarGrupos,
    buscarMarcas,
    buscarFornecedores,
    buscarVendasPorProduto
  };
};