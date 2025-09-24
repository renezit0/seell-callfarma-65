import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMySQLMetas, type MySQLPeriodoMeta, type MySQLMetaColaborador, type MySQLMetaLoja, type MySQLMetaLojaCategoria, type MySQLUsuario } from '@/hooks/useMySQLMetas';
import { supabase } from '@/integrations/supabase/client';

export type MetaColaborador = MySQLMetaColaborador & {
  nome_usuario?: string;
  tipo_usuario?: string;
};

export type ColaboradorComMetas = {
  usuario_id: number;
  nome_usuario: string;
  tipo_usuario: string;
  metas: MetaColaborador[];
  pode_ter_metas: boolean;
};

export type MetaLoja = MySQLMetaLoja & {
  nome_loja?: string;
  categorias?: MetaLojaCategoria[];
};

export type MetaLojaCategoria = MySQLMetaLojaCategoria;

export type PeriodoMeta = MySQLPeriodoMeta;

export function useMetasData() {
  const { user } = useAuth();
  const { fetchPeriodos: fetchPeriodosMySQL, fetchColaboradoresComMetas: fetchColaboradoresMySQL, fetchMetasLojas: fetchMetasLojasMySQL } = useMySQLMetas();
  
  const [colaboradoresComMetas, setColaboradoresComMetas] = useState<ColaboradorComMetas[]>([]);
  const [metasLojas, setMetasLojas] = useState<MetaLoja[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoMeta[]>([]);
  const [periodoSelecionado, setPeriodoSelecionado] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verificar permissões
  const canEditAll = user?.tipo && ['admin', 'supervisor', 'rh'].includes(user.tipo);
  const canViewStoreOnly = user?.tipo && ['gerente', 'lider', 'sublider', 'subgerente'].includes(user.tipo);
  const canEditColaboradores = canEditAll || canViewStoreOnly;
  const canEditOthersIndices = user?.tipo && ['lider', 'gerente', 'sublider', 'subgerente'].includes(user.tipo);
  const isRestrictedUser = user?.tipo && ['auxiliar', 'consultora', 'farmaceutico'].includes(user.tipo);

  // Categorias por tipo de usuário
  const getCategoriasPorTipo = (tipo: string): string[] => {
    switch (tipo) {
      case 'lider':
      case 'gerente':
      case 'sublider':
      case 'subgerente':
      case 'auxiliar':
      case 'farmaceutico':
        return ['geral', 'generico_similar', 'goodlife'];
      case 'consultora':
        return ['perfumaria_alta', 'dermocosmetico', 'goodlife'];
      default:
        return []; // Outros tipos não possuem metas
    }
  };

  // Buscar períodos
  const fetchPeriodos = async () => {
    try {
      setError(null);
      
      const { data, error } = await supabase.functions.invoke('mysql-usuarios', {
        body: { action: 'get_periodos' }
      });

      if (error) throw error;

      if (data?.success) {
        const periodosData = data.data || [];
        setPeriodos(periodosData);
        
        // Selecionar o período mais recente por padrão
        if (periodosData.length > 0 && !periodoSelecionado) {
          setPeriodoSelecionado(periodosData[0].id);
        }
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Erro ao buscar períodos:', err);
    }
  };

  // Buscar colaboradores com suas metas
  const fetchColaboradoresComMetas = async () => {
    if (!periodoSelecionado || !user) return;

    try {
      // Determinar filtros baseados nas permissões
      let loja_id: number | undefined;
      let usuario_id: number | undefined;

      if (!canEditAll && user.loja_id) {
        loja_id = user.loja_id;
      }

      if (isRestrictedUser && user.id) {
        usuario_id = user.id;
      }

      const { usuarios, metas } = await fetchColaboradoresMySQL(loja_id, periodoSelecionado, usuario_id);

      // Agrupar metas por usuário
      const metasPorUsuario = metas.reduce((acc, meta) => {
        if (!acc[meta.usuario_id]) {
          acc[meta.usuario_id] = [];
        }
        acc[meta.usuario_id].push(meta);
        return acc;
      }, {} as Record<number, MySQLMetaColaborador[]>);

      // Criar estrutura final
      const colaboradoresFormatados: ColaboradorComMetas[] = usuarios.map(usuario => ({
        usuario_id: usuario.id,
        nome_usuario: usuario.nome,
        tipo_usuario: usuario.tipo,
        metas: metasPorUsuario[usuario.id] || [],
        pode_ter_metas: getCategoriasPorTipo(usuario.tipo).length > 0
      }));

      setColaboradoresComMetas(colaboradoresFormatados);
    } catch (err: any) {
      setError(err.message);
      console.error('Erro ao buscar colaboradores com metas:', err);
    }
  };

  // Buscar metas de lojas
  const fetchMetasLojas = async () => {
    if (!periodoSelecionado || !user) return;

    try {
      // Determinar filtros baseados nas permissões
      let loja_id: number | undefined;

      if (!canEditAll && user.loja_id) {
        loja_id = user.loja_id;
      }

      const { metas_loja, categorias } = await fetchMetasLojasMySQL(periodoSelecionado, loja_id);

      // Agrupar categorias por meta_loja_id
      const categoriasPorMeta = categorias.reduce((acc, categoria) => {
        if (!acc[categoria.meta_loja_id]) {
          acc[categoria.meta_loja_id] = [];
        }
        acc[categoria.meta_loja_id].push(categoria);
        return acc;
      }, {} as Record<number, MySQLMetaLojaCategoria[]>);

      // Formar estrutura final
      const metasFormatadas: MetaLoja[] = metas_loja.map(meta => ({
        ...meta,
        nome_loja: `${meta.numero} - ${meta.loja_nome}`,
        categorias: categoriasPorMeta[meta.id] || []
      }));

      setMetasLojas(metasFormatadas);
    } catch (err: any) {
      setError(err.message);
      console.error('Erro ao buscar metas de lojas:', err);
    }
  };

  // Atualizar meta de colaborador - TODO: Implementar via MySQL
  const updateMetaColaborador = async (id: number, meta_mensal: number) => {
    console.warn('updateMetaColaborador não implementado para MySQL ainda');
    // TODO: Implementar via edge function
  };

  // Criar meta de colaborador - TODO: Implementar via MySQL
  const createMetaColaborador = async (usuario_id: number, categoria: string, meta_mensal: number) => {
    console.warn('createMetaColaborador não implementado para MySQL ainda');
    // TODO: Implementar via edge function
  };

  // Atualizar meta de loja - TODO: Implementar via MySQL
  const updateMetaLoja = async (id: number, meta_valor_total: number) => {
    console.warn('updateMetaLoja não implementado para MySQL ainda');
    // TODO: Implementar via edge function
  };

  useEffect(() => {
    fetchPeriodos();
  }, []);

  useEffect(() => {
    if (periodoSelecionado) {
      setLoading(true);
      Promise.all([
        fetchColaboradoresComMetas(),
        fetchMetasLojas()
      ]).finally(() => setLoading(false));
    }
  }, [periodoSelecionado, user]);

  return {
    colaboradoresComMetas,
    metasLojas,
    periodos,
    periodoSelecionado,
    setPeriodoSelecionado,
    loading,
    error,
    canEditAll,
    canViewStoreOnly,
    canEditColaboradores,
    canEditOthersIndices,
    isRestrictedUser,
    getCategoriasPorTipo,
    updateMetaColaborador,
    createMetaColaborador,
    updateMetaLoja
  };
}