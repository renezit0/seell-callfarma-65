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
  TOTAL_VLR_DV?: number; // Devoluções em valor
  TOTAL_QTD_DV?: number; // Devoluções em quantidade
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

// CORREÇÃO: Mapeamento dos grupos por categoria conforme API Callfarma - CORRIGIDO
const GRUPOS_POR_CATEGORIA = {
  'rentaveis': '20,25', // grupos 20 e 25
  'perfumaria_alta': '46', // grupo 46 para perfumaria alta rentabilidade
  'conveniencia_alta': '36,13', // grupos para conveniência alta (36 e 13)
  'goodlife': '22', // CORREÇÃO: grupo 22 apenas para goodlife (não duplicar)
  'generico_similar': '2,21,20,25,47,5,6', // CORREÇÃO: todos os grupos de genérico e similar SEM o 22
  'geral': '' // sem filtro de grupos
};

export const useCallfarmaAPI = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const buscarVendasFuncionarios = async (filtros: FiltrosVendas): Promise<VendaFuncionario[]> => {
    setLoading(true);
    try {
      const params: any = {
        dataFim: filtros.dataFim,
        dataIni: filtros.dataInicio,
        groupBy: filtros.groupBy || 'scefun.CDFUN,scefilial.CDFIL',
        orderBy: filtros.orderBy || 'scefun.NOME asc'
      };

      // Adicionar filtros opcionais
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
      
      // CORREÇÃO: Agregar dados por funcionário SEM duplicação
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

  // CORREÇÃO: Função para buscar vendas por categoria usando os grupos corretos SEM duplicação
  const buscarVendasPorCategoria = async (categoria: string, dataInicio: string, dataFim: string): Promise<any[]> => {
    setLoading(true);
    try {
      const params: any = {
        dataFim,
        dataIni: dataInicio,
        groupBy: 'scefilial.CDFIL',
        orderBy: 'scefun.NOME asc'
      };

      // CORREÇÃO: Aplicar filtro de grupos baseado na categoria CORRIGIDA
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

      // Adicionar filtros específicos da campanha
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
      
      // CORREÇÃO: Agregar dados por loja (CDFIL) SEM duplicação
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

  // Função otimizada para buscar vendas por loja e dia para gráficos  
  const buscarVendasPorLojaEDia = async (dataInicio: string, dataFim: string, grupos?: string): Promise<any[]> => {
    setLoading(true);
    try {
      const params: any = {
        dataFim,
        dataIni: dataInicio,
        groupBy: 'scefilial.CDFIL,scekarde.DATA',
        orderBy: 'scefun.NOME asc'
      };

      // Adicionar filtro de grupos se fornecido
      if (grupos) {
        params.filtroGrupos = grupos;
      }

      const { data, error } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/financeiro/vendas-por-funcionario',
          params
        }
      });

      if (error) throw error;
      
      const rawData = data?.msg || [];
      console.log('Dados brutos vendas por loja e dia:', rawData);
      
      return rawData;
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
  };

  // CORREÇÃO: FUNÇÃO ULTRA OTIMIZADA - APENAS 2 REQUISIÇÕES PARA TODAS AS CATEGORIAS SEM DUPLICAÇÃO!
  const buscarTodasVendasConsolidadas = async (dataInicio: string, dataFim: string, userLojaId?: number): Promise<{
    geral: any[],
    rentaveis: any[],
    perfumaria_alta: any[],
    conveniencia_alta: any[],
    goodlife: any[]
  }> => {
    setLoading(true);
    try {
      console.log('🚀 BUSCA CONSOLIDADA CORRIGIDA - Máximo 2 requisições para TODAS as categorias SEM duplicação!');
      
      // Buscar informações da loja se fornecida
      let filtroLoja = null;
      if (userLojaId) {
        const { data: lojaData, error: lojaError } = await supabase
          .from('lojas')
          .select('numero')
          .eq('id', userLojaId)
          .maybeSingle();

        if (!lojaError && lojaData) {
          filtroLoja = lojaData.numero.toString().padStart(2, '0');
          console.log(`🏪 Filtrando por loja: ${filtroLoja}`);
        }
      }

      // APENAS 2 REQUISIÇÕES EM PARALELO para todos os dados!
      const [dadosGeral, dadosGrupos] = await Promise.all([
        // Requisição 1: Dados gerais por loja e data
        supabase.functions.invoke('callfarma-vendas', {
          body: {
            endpoint: '/financeiro/vendas-por-funcionario',
            params: {
              dataFim,
              dataIni: dataInicio,
              groupBy: 'scefilial.CDFIL,scekarde.DATA',
              orderBy: 'scefun.NOME asc',
              ...(filtroLoja && { filtroFiliais: filtroLoja })
            }
          }
        }),
        // CORREÇÃO: Requisição 2: Dados específicos por grupos SEM duplicação do grupo 22
        supabase.functions.invoke('callfarma-vendas', {
          body: {
            endpoint: '/financeiro/vendas-por-funcionario',
            params: {
              dataFim,
              dataIni: dataInicio,
              filtroGrupos: '36,13,25,20,46,22', // TODOS os grupos que precisamos
              groupBy: 'scekarde.DATA,scefilial.CDFIL,sceprodu.CDGRUPO',
              orderBy: 'scefun.NOME asc',
              ...(filtroLoja && { filtroFiliais: filtroLoja })
            }
          }
        })
      ]);

      if (dadosGeral.error || dadosGrupos.error) {
        throw new Error('Erro nas requisições da API');
      }

      const rawGeral = dadosGeral.data?.msg || [];
      const rawGrupos = dadosGrupos.data?.msg || [];
      
      console.log(`📊 Dados consolidados - Geral: ${rawGeral.length} | Grupos: ${rawGrupos.length} registros`);

      // Processar dados com valor líquido
      const processarDados = (items: any[]) => {
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
      };

      // Processar dados gerais
      const dadosGeraisProcessados = processarDados(rawGeral);
      
      // CORREÇÃO: Separar por grupos localmente SEM duplicação - MUITO MAIS EFICIENTE!
      const gruposMap = {
        rentaveis: [20, 25],
        perfumaria_alta: [46],
        conveniencia_alta: [36, 13],
        goodlife: [22] // CORREÇÃO: grupo 22 APENAS para goodlife
      };

      const resultados = {
        geral: dadosGeraisProcessados,
        rentaveis: processarDados(rawGrupos.filter((item: any) => gruposMap.rentaveis.includes(parseInt(item.CDGRUPO)))),
        perfumaria_alta: processarDados(rawGrupos.filter((item: any) => gruposMap.perfumaria_alta.includes(parseInt(item.CDGRUPO)))),
        conveniencia_alta: processarDados(rawGrupos.filter((item: any) => gruposMap.conveniencia_alta.includes(parseInt(item.CDGRUPO)))),
        goodlife: processarDados(rawGrupos.filter((item: any) => gruposMap.goodlife.includes(parseInt(item.CDGRUPO))))
      };

      // Log de resultados
      Object.entries(resultados).forEach(([categoria, dados]) => {
        const total = dados.reduce((sum, item) => sum + item.VALOR_LIQUIDO, 0);
        console.log(`✅ ${categoria}: ${dados.length} registros, R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
      });
      
      return resultados;
      
    } catch (error) {
      console.error('❌ Erro na busca consolidada:', error);
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
  };

  // CORREÇÃO: Função otimizada para buscar vendas de hoje por categoria SEM duplicação
  const buscarVendasHojePorCategoria = async (cdfil: number, dataHoje: string): Promise<{
    geral: number,
    rentaveis: number,
    perfumaria: number,
    conveniencia: number,
    goodlife: number
  }> => {
    setLoading(true);
    try {
      const cdfilStr = cdfil.toString();
      console.log(`🔍 Buscando vendas de hoje consolidadas para CDFIL ${cdfilStr} em ${dataHoje}`);
      console.log(`🏪 Filtro será aplicado: filtroFiliais="${cdfilStr}"`);
      
      // APENAS 2 requisições para vendas de hoje
      const [dadosGeralHoje, dadosGruposHoje] = await Promise.all([
        // Vendas gerais de hoje
        supabase.functions.invoke('callfarma-vendas', {
          body: {
            endpoint: '/financeiro/vendas-por-funcionario',
            params: {
              dataFim: dataHoje,
              dataIni: dataHoje,
              groupBy: 'scefilial.CDFIL',
              orderBy: 'TOTAL_VLR_VE desc',
              filtroFiliais: cdfilStr
            }
          }
        }),
        // CORREÇÃO: Vendas por grupos de hoje SEM duplicação
        supabase.functions.invoke('callfarma-vendas', {
          body: {
            endpoint: '/financeiro/vendas-por-funcionario',
            params: {
              dataFim: dataHoje,
              dataIni: dataHoje,
              filtroGrupos: '36,13,25,20,46,22',
              groupBy: 'scefilial.CDFIL,sceprodu.CDGRUPO',
              orderBy: 'TOTAL_VLR_VE desc',
              filtroFiliais: cdfilStr
            }
          }
        })
      ]);

      console.log('🔍 Resposta da API - Dados Gerais:', dadosGeralHoje.data?.msg?.length || 0, 'registros');
      console.log('🔍 Resposta da API - Dados Grupos:', dadosGruposHoje.data?.msg?.length || 0, 'registros');

      // Processar vendas gerais com VALIDAÇÃO EXTRA
      const rawGeralHoje = dadosGeralHoje.data?.msg || [];
      console.log('📊 Dados gerais recebidos:', rawGeralHoje);
      
      // FILTRO ADICIONAL: Garantir que apenas dados do CDFIL correto sejam processados
      const dadosGeralFiltrados = rawGeralHoje.filter((item: any) => {
        return item.CDFIL && item.CDFIL.toString() === cdfilStr;
      });
      
      console.log(`🔍 Dados gerais após filtro local por CDFIL ${cdfilStr}:`, dadosGeralFiltrados.length, 'registros');
      console.log('📊 Dados gerais filtrados:', dadosGeralFiltrados);
      
      const totalGeral = dadosGeralFiltrados.reduce((sum: number, item: any) => {
        const valorVenda = parseFloat(item.TOTAL_VLR_VE || 0);
        const valorDevolucao = parseFloat(item.TOTAL_VLR_DV || 0);
        const valorLiquido = valorVenda - valorDevolucao;
        console.log(`💰 Item geral CDFIL ${item.CDFIL}: R$ ${valorVenda} - R$ ${valorDevolucao} = R$ ${valorLiquido}`);
        return sum + valorLiquido;
      }, 0);

      // CORREÇÃO: Processar vendas por grupos com VALIDAÇÃO EXTRA SEM duplicação
      const rawGruposHoje = dadosGruposHoje.data?.msg || [];
      console.log('📊 Dados grupos recebidos:', rawGruposHoje.length, 'registros');
      
      // FILTRO ADICIONAL: Garantir que apenas dados do CDFIL correto sejam processados
      const dadosGruposFiltrados = rawGruposHoje.filter((item: any) => {
        return item.CDFIL && item.CDFIL.toString() === cdfilStr;
      });
      
      console.log(`🔍 Dados grupos após filtro local por CDFIL ${cdfilStr}:`, dadosGruposFiltrados.length, 'registros');
      
      const vendasPorGrupo = dadosGruposFiltrados.reduce((acc: any, item: any) => {
        const grupo = parseInt(item.CDGRUPO);
        const valorVenda = parseFloat(item.TOTAL_VLR_VE || 0);
        const valorDevolucao = parseFloat(item.TOTAL_VLR_DV || 0);
        const valorLiquido = valorVenda - valorDevolucao;
        
        console.log(`💼 Item grupo ${grupo} CDFIL ${item.CDFIL}: R$ ${valorVenda} - R$ ${valorDevolucao} = R$ ${valorLiquido}`);

        // CORREÇÃO: Mapear grupos SEM duplicação
        if ([20, 25].includes(grupo)) {
          acc.rentaveis += valorLiquido;
        } else if ([46].includes(grupo)) {
          acc.perfumaria += valorLiquido;
        } else if ([36, 13].includes(grupo)) {
          acc.conveniencia += valorLiquido;
        } else if ([22].includes(grupo)) {
          // CORREÇÃO: grupo 22 APENAS para goodlife
          acc.goodlife += valorLiquido;
        }

        return acc;
      }, {
        rentaveis: 0,
        perfumaria: 0,
        conveniencia: 0,
        goodlife: 0
      });

      const resultado = {
        geral: totalGeral,
        rentaveis: vendasPorGrupo.rentaveis,
        perfumaria: vendasPorGrupo.perfumaria,
        conveniencia: vendasPorGrupo.conveniencia,
        goodlife: vendasPorGrupo.goodlife
      };

      console.log(`🎯 Vendas hoje CDFIL ${cdfil} (CORRIGIDAS - SEM duplicação):`, resultado);
      return resultado;
      
    } catch (error) {
      console.error('❌ Erro ao buscar vendas de hoje:', error);
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
  };

  // CORREÇÃO: Função para buscar vendas do dia específico por loja e categoria SEM duplicação
  const buscarVendasHojePorLoja = async (cdfil: string, dataAtual: string): Promise<{
    geral: number;
    rentaveis: number;
    perfumaria: number;
    conveniencia: number;
    goodlife: number;
  }> => {
    setLoading(true);
    try {
      console.log(`🏪 Buscando vendas de hoje para CDFIL ${cdfil} na data ${dataAtual}`);

      // Buscar vendas geral (sem filtro de grupos)
      const vendasGeral = await buscarVendasPorLojaCategoria(cdfil, dataAtual, '');
      
      // CORREÇÃO: Buscar vendas por categoria com grupos específicos SEM duplicação
      const vendasRentaveis = await buscarVendasPorLojaCategoria(cdfil, dataAtual, '20,25');
      const vendasPerfumaria = await buscarVendasPorLojaCategoria(cdfil, dataAtual, '46');
      const vendasConveniencia = await buscarVendasPorLojaCategoria(cdfil, dataAtual, '36,13');
      const vendasGoodlife = await buscarVendasPorLojaCategoria(cdfil, dataAtual, '22'); // CORREÇÃO: apenas grupo 22

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
  };

  // Função auxiliar para buscar vendas por loja, data e categoria
  const buscarVendasPorLojaCategoria = async (cdfil: string, data: string, grupos: string): Promise<number> => {
    const params: any = {
      dataFim: data,
      dataIni: data,
      groupBy: 'scefilial.CDFIL',
      orderBy: 'TOTAL_VLR_VE desc',
      filtroFiliais: cdfil // Filtrar especificamente pelo CDFIL da loja
    };

    console.log(`🎯 Buscando vendas para CDFIL ${cdfil} na data ${data} com grupos ${grupos || 'todos'}`);

    // Adicionar filtro de grupos se necessário
    if (grupos) {
      params.filtroGrupos = grupos;
    }

    const { data: response, error } = await supabase.functions.invoke('callfarma-vendas', {
      body: {
        endpoint: '/financeiro/vendas-por-funcionario',
        params
      }
    });

    if (error) throw error;
    
    const rawData = response?.msg || [];
    console.log(`💰 Vendas para CDFIL ${cdfil} grupos ${grupos || 'todos'}:`, rawData.length, 'registros');
    
    // CORREÇÃO: Filtrar apenas registros do CDFIL específico para garantir que não venham dados de outras lojas
    const vendasFiltradas = rawData.filter((item: any) => item.CDFIL && item.CDFIL.toString() === cdfil.toString());
    console.log(`🔍 Após filtro por CDFIL ${cdfil}: ${vendasFiltradas.length} registros`);
    
    // CORREÇÃO: Somar o valor total de vendas da loja SEM duplicação
    const totalVendas = vendasFiltradas.reduce((sum: number, item: any) => {
      return sum + (item.TOTAL_VLR_VE || 0);
    }, 0);

    console.log(`💰 Total vendas CDFIL ${cdfil} grupos ${grupos || 'todos'}: R$ ${totalVendas.toFixed(2)}`);
    
    return totalVendas;
  };

  // CORREÇÃO: Função SUPER OTIMIZADA que faz apenas 2 requisições para todos os dados SEM duplicação
  const buscarTodosDadosGraficos = async (dataInicio: string, dataFim: string, userLojaId?: number): Promise<{
    geral: any[];
    rentaveis: any[];
    perfumaria_alta: any[];
    conveniencia_alta: any[];
    goodlife: any[];
  }> => {
    setLoading(true);
    try {
      console.log(`🚀 Buscando TODOS os dados em apenas 2 requisições - SUPER RÁPIDO E CORRIGIDO!`);
      
      // Buscar informações da loja do usuário
      let filtroLoja = null;
      if (userLojaId) {
        const { data: lojaData, error: lojaError } = await supabase
          .from('lojas')
          .select('numero')
          .eq('id', userLojaId)
          .maybeSingle();

        if (!lojaError && lojaData) {
          filtroLoja = lojaData.numero.toString().padStart(2, '0');
          console.log(`🏪 Filtrando por loja: ${filtroLoja}`);
        }
      }

      // Fazer apenas 2 requisições em paralelo - MUITO MAIS RÁPIDO!
      const [dadosGeral, dadosGrupos] = await Promise.all([
        // Requisição 1: Dados gerais (sem filtro de grupos)
        supabase.functions.invoke('callfarma-vendas', {
          body: {
            endpoint: '/financeiro/vendas-por-funcionario',
            params: {
              dataFim,
              dataIni: dataInicio,
              groupBy: 'scefilial.CDFIL,scekarde.DATA',
              orderBy: 'scefun.NOME asc',
              ...(filtroLoja && { filtroFiliais: filtroLoja })
            }
          }
        }),
        // CORREÇÃO: Requisição 2: Dados com TODOS os grupos SEM duplicação (36,13,25,20,46,22)
        supabase.functions.invoke('callfarma-vendas', {
          body: {
            endpoint: '/financeiro/vendas-por-funcionario',
            params: {
              dataFim,
              dataIni: dataInicio,
              filtroGrupos: '36,13,25,20,46,22',
              groupBy: 'scekarde.DATA,scefilial.CDFIL,sceprodu.CDGRUPO',
              orderBy: 'scefun.NOME asc',
              ...(filtroLoja && { filtroFiliais: filtroLoja })
            }
          }
        })
      ]);

      if (dadosGeral.error || dadosGrupos.error) {
        console.error('Erro nas requisições:', { geral: dadosGeral.error, grupos: dadosGrupos.error });
        return { geral: [], rentaveis: [], perfumaria_alta: [], conveniencia_alta: [], goodlife: [] };
      }

      const rawGeral = dadosGeral.data?.msg || [];
      const rawGrupos = dadosGrupos.data?.msg || [];
      
      console.log(`📊 Dados recebidos - Geral: ${rawGeral.length} | Grupos: ${rawGrupos.length} registros`);

      // Função para processar dados com valor líquido
      const processarDados = (items: any[]) => {
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
      };

      // Processar dados gerais
      const geralProcessado = processarDados(rawGeral);
      
      // CORREÇÃO: Processar e filtrar dados por grupos SEM duplicação
      const gruposProcessados = processarDados(rawGrupos);
      
      const rentaveis = gruposProcessados.filter(item => [20, 25].includes(parseInt(item.CDGRUPO)));
      const perfumaria_alta = gruposProcessados.filter(item => [46].includes(parseInt(item.CDGRUPO)));
      const conveniencia_alta = gruposProcessados.filter(item => [36, 13].includes(parseInt(item.CDGRUPO)));
      const goodlife = gruposProcessados.filter(item => [22].includes(parseInt(item.CDGRUPO))); // CORREÇÃO: apenas grupo 22

      const resultado = {
        geral: geralProcessado,
        rentaveis,
        perfumaria_alta,
        conveniencia_alta,
        goodlife
      };

      // Log dos resultados
      Object.entries(resultado).forEach(([categoria, dados]) => {
        const total = dados.reduce((sum: number, item: any) => sum + item.VALOR_LIQUIDO, 0);
        console.log(`✅ ${categoria}: ${dados.length} registros - R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
      });
      
      return resultado;
      
    } catch (error) {
      console.error(`❌ Erro ao buscar todos os dados dos gráficos:`, error);
      toast({
        title: "Erro",
        description: `Erro ao buscar dados dos gráficos`,
        variant: "destructive",
      });
      return { geral: [], rentaveis: [], perfumaria_alta: [], conveniencia_alta: [], goodlife: [] };
    } finally {
      setLoading(false);
    }
  };

  const buscarVendasPorProduto = async (params: {
    dataInicio: string;
    dataFim: string;
    codigosProdutos: string; // códigos separados por vírgula
    cdfil?: number;
  }) => {
    setLoading(true);
    try {
      console.log('🔍 Buscando vendas por produto:', params);
      
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

      console.log('✅ Dados de vendas por produto recebidos:', data?.msg?.length || 0, 'registros');
      return data?.msg || [];
      
    } catch (error) {
      console.error('❌ Erro ao buscar vendas por produto:', error);
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
        groupBy: 'scefun.CDFUN,scefilial.CDFIL', // Agrupar por colaborador e loja
        orderBy: 'TOTAL_VLR_VE desc'
      };

      // Filtros da campanha (principalmente produtos no caso Biolab)
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
    buscarVendasPorProduto
  };
};

