import { useState, useEffect } from 'react';
import { User } from './useAuth';
import { type PeriodOption } from '@/contexts/PeriodContext';
import { useMySQLMetas } from '@/hooks/useMySQLMetas';
import { useMySQLUsuarios } from '@/hooks/useMySQLUsuarios';

export interface ColaboradorProgress {
  id: number;
  nome: string;
  tipo: string;
  metas: {
    geral?: number;
    generico_similar?: number;
    goodlife?: number;
    perfumaria_alta?: number;
    dermocosmetico?: number;
  };
  vendas: {
    geral: number;
    generico_similar: number;
    goodlife: number;
    perfumaria_alta: number;
    dermocosmetico: number;
  };
  progresso: {
    geral?: number;
    generico_similar?: number;
    goodlife?: number;
    perfumaria_alta?: number;
    dermocosmetico?: number;
  };
}

export function useColaboradoresProgress(user: User | null, selectedPeriod?: PeriodOption | null) {
  const { fetchColaboradoresComMetas } = useMySQLMetas();
  const { fetchUsuarios } = useMySQLUsuarios();
  const [colaboradores, setColaboradores] = useState<ColaboradorProgress[]>([]);
  const [loading, setLoading] = useState(true);

  // Verificar se deve mostrar dados da equipe ou apenas próprios
  const shouldShowTeamData = user?.tipo && ['gerente', 'lider', 'sublider', 'subgerente'].includes(user.tipo);
  const showOnlyOwnData = user?.tipo && ['auxiliar', 'farmaceutico', 'consultora'].includes(user.tipo);

  useEffect(() => {
    if (!user || !selectedPeriod) {
      setLoading(false);
      return;
    }

    const fetchColaboradoresProgress = async () => {
      try {
        setLoading(true);

        // Determinar quais usuários buscar
        let usuario_id: number | undefined;
        let loja_id: number | undefined = user.loja_id;

        if (showOnlyOwnData) {
          usuario_id = user.id;
        }

        // Buscar colaboradores e metas via MySQL
        const { usuarios, metas } = await fetchColaboradoresComMetas(loja_id, selectedPeriod.id, usuario_id);

        if (!usuarios || usuarios.length === 0) {
          setColaboradores([]);
          return;
        }

        // TODO: Buscar vendas do Supabase ainda (temporário)
        // Por enquanto retornando dados básicos sem vendas
        const colaboradoresData: ColaboradorProgress[] = usuarios
          .map(usuario => {
            const metasUsuario = metas?.filter(m => m.usuario_id === usuario.id) || [];

            // Se não tem metas, não incluir na lista
            if (metasUsuario.length === 0) {
              return null;
            }

            // Mapeamento de metas por categoria
            const metasMap = metasUsuario.reduce((acc, meta) => {
              acc[meta.categoria] = meta.meta_mensal;
              return acc;
            }, {} as Record<string, number>);

            // Por enquanto, vendas zeradas (precisa implementar busca no MySQL)
            const vendasMap = {
              geral: 0,
              generico_similar: 0,
              goodlife: 0,
              perfumaria_alta: 0,
              dermocosmetico: 0
            };

            // Calcular progresso (percentual)
            const calcularProgresso = (venda: number, meta?: number) => {
              if (!meta || meta === 0) return 0;
              return Math.min((venda / meta) * 100, 100);
            };

            const progresso = {
              geral: metasMap.geral ? calcularProgresso(vendasMap.geral, metasMap.geral) : undefined,
              generico_similar: metasMap.generico_similar ? calcularProgresso(vendasMap.generico_similar, metasMap.generico_similar) : undefined,
              goodlife: metasMap.goodlife ? calcularProgresso(vendasMap.goodlife, metasMap.goodlife) : undefined,
              perfumaria_alta: metasMap.perfumaria_alta ? calcularProgresso(vendasMap.perfumaria_alta, metasMap.perfumaria_alta) : undefined,
              dermocosmetico: metasMap.dermocosmetico ? calcularProgresso(vendasMap.dermocosmetico, metasMap.dermocosmetico) : undefined,
            };

            return {
              id: usuario.id,
              nome: usuario.nome,
              tipo: usuario.tipo,
              metas: metasMap,
              vendas: vendasMap,
              progresso
            };
          })
          .filter(colaborador => colaborador !== null) as ColaboradorProgress[];

        setColaboradores(colaboradoresData);
      } catch (error) {
        console.error('Erro ao buscar progresso dos colaboradores:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchColaboradoresProgress();
  }, [user, selectedPeriod, shouldShowTeamData, showOnlyOwnData]);

  return { colaboradores, loading, shouldShowTeamData, showOnlyOwnData };
}