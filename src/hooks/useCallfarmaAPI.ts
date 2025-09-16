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
  filtroFiliais?: string;
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

export interface VendaFormatada {
  id: string;
  usuario_id: number;
  data_venda: string;
  categoria: string;
  valor_venda: number;
  loja_id?: number;
  registrado_por_usuario_id?: number;
  nome_funcionario?: string;
}

const GRUPOS_POR_CATEGORIA = {
  'rentaveis': '20,25',
  'perfumaria_alta': '46',
  'conveniencia_alta': '36,13',
  'goodlife': '22',
  'geral': ''
};

const MAPEAMENTO_GRUPOS_CATEGORIAS: Record<number, string> = {
  20: 'rentaveis20',
  25: 'rentaveis25',
  46: 'perfumaria_r_mais',
  36: 'conveniencia',
  13: 'conveniencia',
  22: 'saude'
};

export const useCallfarmaAPI = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const buscarNumeroLoja = async (lojaId: number): Promise<string> => {
    try {
      console.log(`🔍 Buscando número da loja para ID: ${lojaId}`);
      
      const { data, error } = await supabase
        .from('lojas')
        .select('numero, nome')
        .eq('id', lojaId)
        .single();

      if (error) {
        console.error('❌ Erro ao buscar loja:', error);
        throw error;
      }

      if (!data) {
        throw new Error(`Loja com ID ${lojaId} não encontrada`);
      }

      const numeroFormatado = data.numero.toString().padStart(2, '0');
      console.log(`✅ Loja encontrada: ${data.nome} - Número: ${numeroFormatado}`);
      
      return numeroFormatado;
    } catch (error) {
      console.error('❌ Erro ao buscar número da loja:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar número da loja",
        variant: "destructive",
      });
      throw error;
    }
  };

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
      if (filtros.filtroFiliais) {
        params.filtroFiliais = filtros.filtroFiliais;
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

  const buscarVendasFormatadas = async (
    dataInicio: string, 
    dataFim: string, 
    lojaId: number,
    funcionarioId?: number
  ): Promise<VendaFormatada[]> => {
    setLoading(true);
    try {
      console.log('🔍 Buscando vendas formatadas da API Callfarma');
      console.log(`🏪 Loja ID: ${lojaId}`);
      
      const numeroLoja = await buscarNumeroLoja(lojaId);
      console.log(`🏪 Número da loja formatado: ${numeroLoja}`);

      const params: any = {
        dataFim,
        dataIni: dataInicio,
        groupBy: 'scefun.CDFUN,scefilial.CDFIL,sceprodu.CDGRUPO,scekarde.DATA',
        orderBy: 'scefun.NOME asc',
        filtroFiliais: numeroLoja
      };

      console.log('📋 Parâmetros da requisição:', params);

      if (funcionarioId) {
        const { data: funcionarioData } = await supabase
          .from('usuarios')
          .select('codigo_funcionario')
          .eq('id', funcionarioId)
          .single();
        
        if (funcionarioData?.codigo_funcionario) {
          params.filtroFuncionarios = funcionarioData.codigo_funcionario;
          console.log(`👤 Filtro por funcionário: ${funcionarioData.codigo_funcionario}`);
        } else {
          console.warn(`Funcionário com ID ${funcionarioId} não possui codigo_funcionario. Não será aplicado filtro de funcionário na API Callfarma.`);
          delete params.filtroFuncionarios;
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
      console.log(`📊 Dados recebidos da API: ${rawData.length} registros`);
      
      const dadosFiltradosLoja = rawData.filter((item: any) => {
        const cdfilMatch = item.CDFIL && item.CDFIL.toString().padStart(2, '0') === numeroLoja;
        if (!cdfilMatch) {
          console.log(`⚠️ Excluindo registro de outra loja - CDFIL: ${item.CDFIL}, esperado: ${numeroLoja}`);
        }
        return cdfilMatch;
      });
      
      console.log(`🔍 Após filtro por loja: ${dadosFiltradosLoja.length} registros`);

      const vendasFormatadas: VendaFormatada[] = [];
      
      dadosFiltradosLoja.forEach((item: any, index: number) => {
        const grupo = parseInt(item.CDGRUPO);
        const categoria = MAPEAMENTO_GRUPOS_CATEGORIAS[grupo];
        
        if (categoria) {
          const valorVenda = parseFloat(item.TOTAL_VLR_VE || 0);
          const valorDevolucao = parseFloat(item.TOTAL_VLR_DV || 0);
          const valorLiquido = valorVenda - valorDevolucao;

          if (valorLiquido > 0) {
            vendasFormatadas.push({
              id: `api-${index}-${item.CDFUN}-${item.CDGRUPO}-${item.DATA}`,
              usuario_id: item.CDFUN || 0,
              data_venda: item.DATA,
              categoria: categoria,
              valor_venda: valorLiquido,
              loja_id: lojaId,
              registrado_por_usuario_id: item.CDFUN || 0,
              nome_funcionario: item.NOMEFUN
            });
          }
        }
      });

      const paramsGeral = {
        dataFim,
        dataIni: dataInicio,
        groupBy: 'scefun.CDFUN,scefilial.CDFIL,scekarde.DATA',
        orderBy: 'scefun.NOME asc',
        filtroFiliais: numeroLoja
      };

      if (funcionarioId) {
        const { data: funcionarioData } = await supabase
          .from('usuarios')
          .select('codigo_funcionario')
          .eq('id', funcionarioId)
          .single();
        
        if (funcionarioData?.codigo_funcionario) {
          paramsGeral.filtroFuncionarios = funcionarioData.codigo_funcionario;
        }
      }

      console.log('📋 Parâmetros vendas gerais:', paramsGeral);

      const { data: dataGeral, error: errorGeral } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/financeiro/vendas-por-funcionario',
          params: paramsGeral
        }
      });

      if (!errorGeral && dataGeral?.msg) {
        console.log(`📊 Dados gerais recebidos: ${dataGeral.msg.length} registros`);
        
        const dadosGeraisFiltrados = dataGeral.msg.filter((item: any) => {
          const cdfilMatch = item.CDFIL && item.CDFIL.toString().padStart(2, '0') === numeroLoja;
          if (!cdfilMatch) {
            console.log(`⚠️ Excluindo venda geral de outra loja - CDFIL: ${item.CDFIL}, esperado: ${numeroLoja}`);
          }
          return cdfilMatch;
        });
        
        console.log(`🔍 Vendas gerais após filtro por loja: ${dadosGeraisFiltrados.length} registros`);

        dadosGeraisFiltrados.forEach((item: any, index: number) => {
          const valorVenda = parseFloat(item.TOTAL_VLR_VE || 0);
          const valorDevolucao = parseFloat(item.TOTAL_VLR_DV || 0);
          const valorLiquido = valorVenda - valorDevolucao;

          if (valorLiquido > 0) {
            vendasFormatadas.push({
              id: `api-geral-${index}-${item.CDFUN}-${item.DATA}`,
              usuario_id: item.CDFUN || 0,
              data_venda: item.DATA,
              categoria: 'geral',
              valor_venda: valorLiquido,
              loja_id: lojaId,
              registrado_por_usuario_id: item.CDFUN || 0,
              nome_funcionario: item.NOMEFUN
            });
          }
        });
      }

      console.log(`✅ Vendas formatadas FILTRADAS por loja ${numeroLoja}: ${vendasFormatadas.length} registros processados`);
      return vendasFormatadas;

    } catch (error) {
      console.error('❌ Erro ao buscar vendas formatadas:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar vendas da API externa",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const buscarDadosGraficoAPI = async (
    dataInicio: string,
    dataFim: string,
    lojaId: number,
    funcionarioId?: number
  ): Promise<any[]> => {
    setLoading(true);
    try {
      console.log('📈 Buscando dados do gráfico da API Callfarma - OTIMIZADO');
      console.log(`📅 Período: ${dataInicio} até ${dataFim}`);
      
      const numeroLoja = await buscarNumeroLoja(lojaId);
      
      const params: any = {
        dataFim,
        dataIni: dataInicio,
        groupBy: 'scekarde.DATA,sceprodu.CDGRUPO',
        orderBy: 'scekarde.DATA asc',
        filtroFiliais: numeroLoja,
      };

      if (funcionarioId) {
        const { data: funcionarioData } = await supabase
          .from('usuarios')
          .select('codigo_funcionario')
          .eq('id', funcionarioId)
          .single();
        
        if (funcionarioData?.codigo_funcionario) {
          params.filtroFuncionarios = funcionarioData.codigo_funcionario;
        }
      }

      console.log('📋 Parâmetros do gráfico:', params);

      const { data, error } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/financeiro/vendas-por-funcionario',
          params
        }
      });

      if (error) throw error;

      const rawData = data?.msg || [];
      console.log(`📊 Dados do gráfico recebidos: ${rawData.length} registros`);

      const dadosFiltrados = rawData.filter((item: any) => {
        return item.CDFIL && item.CDFIL.toString().padStart(2, '0') === numeroLoja;
      });

      const dadosProcessados = new Map<string, any>();

      dadosFiltrados.forEach(item => {
        const data = item.DATA;
        const grupo = parseInt(item.CDGRUPO);
        const valorVenda = parseFloat(item.TOTAL_VLR_VE || 0);
        const valorDevolucao = parseFloat(item.TOTAL_VLR_DV || 0);
        const valorLiquido = valorVenda - valorDevolucao;

        if (valorLiquido <= 0) return;

        if (!dadosProcessados.has(data)) {
          dadosProcessados.set(data, {
            date: new Date(data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            value: 0,
            transactions: 0,
            geral: 0,
            goodlife: 0,
            perfumaria_r_mais: 0,
            conveniencia_r_mais: 0,
            r_mais: 0
          });
        }

        const registro = dadosProcessados.get(data);
        registro.value += valorLiquido;
        registro.transactions += 1;

        if ([20, 25].includes(grupo)) {
          registro.r_mais += valorLiquido;
        } else if ([46].includes(grupo)) {
          registro.perfumaria_r_mais += valorLiquido;
        } else if ([36, 13].includes(grupo)) {
          registro.conveniencia_r_mais += valorLiquido;
        } else if ([22].includes(grupo)) {
          registro.goodlife += valorLiquido;
        }
        registro.geral += valorLiquido; // Adicionar ao total geral
      });

      const resultado = Array.from(dadosProcessados.values())
        .sort((a, b) => {
          const [dayA, monthA] = a.date.split('/');
          const [dayB, monthB] = b.date.split('/');
          const dateA = new Date(new Date().getFullYear(), parseInt(monthA) - 1, parseInt(dayA));
          const dateB = new Date(new Date().getFullYear(), parseInt(monthB) - 1, parseInt(dayB));
          return dateA.getTime() - dateB.getTime();
        });

      console.log(`✅ Gráfico processado: ${resultado.length} pontos`);
      return resultado;

    } catch (error) {
      console.error('❌ Erro ao buscar dados do gráfico:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar dados do gráfico da API externa",
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

  const buscarVendasPorLojaEDia = async (dataInicio: string, dataFim: string, grupos?: string): Promise<any[]> => {
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

  const buscarTodasVendasConsolidadas = async (dataInicio: string, dataFim: string, userLojaId?: number): Promise<{
    geral: any[],
    rentaveis: any[],
    perfumaria_alta: any[],
    conveniencia_alta: any[],
    goodlife: any[]
  }> => {
    setLoading(true);
    try {
      console.log('🚀 BUSCA CONSOLIDADA - Máximo 2 requisições para TODAS as categorias!');
      
      let filtroLoja = null;
      if (userLojaId) {
        filtroLoja = await buscarNumeroLoja(userLojaId);
        console.log(`🏪 Filtrando por loja: ${filtroLoja}`);
      }

      const [dadosGeral, dadosGrupos] = await Promise.all([
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
        throw new Error('Erro nas requisições da API');
      }

      const rawGeral = dadosGeral.data?.msg || [];
      const rawGrupos = dadosGrupos.data?.msg || [];
      
      console.log(`📊 Dados consolidados - Geral: ${rawGeral.length} | Grupos: ${rawGrupos.length} registros`);

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

      const dadosGeraisProcessados = processarDados(rawGeral);
      
      const gruposMap = {
        rentaveis: [20, 25],
        perfumaria_alta: [46],
        conveniencia_alta: [36, 13],
        goodlife: [22]
      };

      const resultados = {
        geral: dadosGeraisProcessados,
        rentaveis: processarDados(rawGrupos.filter((item: any) => gruposMap.rentaveis.includes(parseInt(item.CDGRUPO)))),
        perfumaria_alta: processarDados(rawGrupos.filter((item: any) => gruposMap.perfumaria_alta.includes(parseInt(item.CDGRUPO)))),
        conveniencia_alta: processarDados(rawGrupos.filter((item: any) => gruposMap.conveniencia_alta.includes(parseInt(item.CDGRUPO)))),
        goodlife: processarDados(rawGrupos.filter((item: any) => gruposMap.goodlife.includes(parseInt(item.CDGRUPO))))
      };

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
      
      const [dadosGeralHoje, dadosGruposHoje] = await Promise.all([
        supabase.functions.invoke('callfarma-vendas', {
          body: {
            endpoint: '/financeiro/vendas-por-funcionario',
            params: {
              dataFim: dataHoje,
              dataIni: dataHoje,
              groupBy: 'scefilial.CDFIL',
              filtroFiliais: cdfilStr
            }
          }
        }),
        supabase.functions.invoke('callfarma-vendas', {
          body: {
            endpoint: '/financeiro/vendas-por-funcionario',
            params: {
              dataFim: dataHoje,
              dataIni: dataHoje,
              filtroGrupos: '36,13,25,20,46,22',
              groupBy: 'scefilial.CDFIL,sceprodu.CDGRUPO',
              filtroFiliais: cdfilStr
            }
          }
        })
      ]);

      if (dadosGeralHoje.error || dadosGruposHoje.error) {
        throw new Error('Erro nas requisições de vendas de hoje');
      }

      const rawGeralHoje = dadosGeralHoje.data?.msg || [];
      const rawGruposHoje = dadosGruposHoje.data?.msg || [];

      const processarValorLiquido = (items: any[]) => {
        return items.reduce((total, item) => {
          const valorVenda = parseFloat(item.TOTAL_VLR_VE || 0);
          const valorDevolucao = parseFloat(item.TOTAL_VLR_DV || 0);
          return total + (valorVenda - valorDevolucao);
        }, 0);
      };

      const totalGeral = processarValorLiquido(rawGeralHoje);

      const gruposMap = {
        rentaveis: [20, 25],
        perfumaria: [46],
        conveniencia: [36, 13],
        goodlife: [22]
      };

      const totalRentaveis = processarValorLiquido(rawGruposHoje.filter((item: any) => gruposMap.rentaveis.includes(parseInt(item.CDGRUPO))));
      const totalPerfumaria = processarValorLiquido(rawGruposHoje.filter((item: any) => gruposMap.perfumaria.includes(parseInt(item.CDGRUPO))));
      const totalConveniencia = processarValorLiquido(rawGruposHoje.filter((item: any) => gruposMap.conveniencia.includes(parseInt(item.CDGRUPO))));
      const totalGoodlife = processarValorLiquido(rawGruposHoje.filter((item: any) => gruposMap.goodlife.includes(parseInt(item.CDGRUPO))));

      const resultados = {
        geral: totalGeral > 0 ? totalGeral : 0,
        rentaveis: totalRentaveis > 0 ? totalRentaveis : 0,
        perfumaria: totalPerfumaria > 0 ? totalPerfumaria : 0,
        conveniencia: totalConveniencia > 0 ? totalConveniencia : 0,
        goodlife: totalGoodlife > 0 ? totalGoodlife : 0,
      };

      console.log('✅ Vendas de hoje consolidadas:', resultados);
      return resultados;

    } catch (error) {
      console.error('❌ Erro ao buscar vendas de hoje por categoria:', error);
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

  return {
    buscarVendasFuncionarios,
    buscarVendasFormatadas,
    buscarDadosGraficoAPI,
    buscarFamilias,
    buscarGrupos,
    buscarMarcas,
    buscarFornecedores,
    buscarVendasPorCategoria,
    buscarVendasCampanha,
    buscarVendasPorLojaEDia,
    buscarTodasVendasConsolidadas,
    buscarVendasHojePorCategoria,
    loading,
  };
};
