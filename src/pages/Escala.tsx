import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { usePeriodoAtual } from '@/hooks/usePeriodoAtual';
import { useMySQLUsuarios } from '@/hooks/useMySQLUsuarios';
import { useMySQLFolgas } from '@/hooks/useMySQLFolgas';
import { getDescricaoTipoUsuario } from '@/utils/userTypes';
import { useToast } from '@/hooks/use-toast';
import { Users, Eye, Calendar as CalendarIcon, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Usuario {
  id: number;
  nome: string;
  tipo: string;
  loja_id: number;
}

const tiposAusencia = {
  folga: { label: 'Folga', color: 'bg-emerald-500 dark:bg-emerald-600' },
  atestado: { label: 'Atestado', color: 'bg-orange-500 dark:bg-orange-600' },
  feriado: { label: 'Feriado', color: 'bg-purple-500 dark:bg-purple-600' },
  falta: { label: 'Falta', color: 'bg-destructive' },
  banco: { label: 'Banco de Horas', color: 'bg-yellow-500 dark:bg-yellow-600' },
  ferias: { label: 'Férias', color: 'bg-primary' }
};

export default function Escala() {
  const { user } = useAuth();
  const { toast } = useToast();
  const periodo = usePeriodoAtual();
  const { usuarios, fetchUsuarios, loading: loadingUsuarios } = useMySQLUsuarios();
  const { folgas, fetchFolgas, loading: loadingFolgas } = useMySQLFolgas();
  
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState<Usuario | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');

  // Verificar permissões do usuário
  const podeGerenciar = user?.tipo && ['lider', 'gerente', 'sublider', 'subgerente'].includes(user.tipo);

  // Calcular datas do período
  const dataInicio = periodo ? new Date(periodo.data_inicio).toISOString().split('T')[0] : '';
  const dataFim = periodo ? new Date(periodo.data_fim).toISOString().split('T')[0] : '';

  // Carregar usuários ao montar o componente
  useEffect(() => {
    if (user?.loja_id && podeGerenciar) {
      fetchUsuarios(user.loja_id);
    }
  }, [user?.loja_id, podeGerenciar]);

  // Carregar folgas quando o usuário selecionado ou período mudar
  useEffect(() => {
    if (selectedUser && dataInicio && dataFim) {
      fetchFolgas(selectedUser, dataInicio, dataFim);
    } else if (!podeGerenciar && user?.id && dataInicio && dataFim) {
      // Se não pode gerenciar, mostra apenas suas próprias folgas
      fetchFolgas(user.id, dataInicio, dataFim);
    }
  }, [selectedUser, dataInicio, dataFim, user?.id, podeGerenciar]);

  // Filtrar usuários por tipo
  const usuariosFiltrados = usuarios.filter(usuario => {
    if (filtroTipo === 'todos') return true;
    return usuario.tipo === filtroTipo;
  });

  const handleUserSelect = (userId: string) => {
    const userFound = usuarios.find(u => u.id === parseInt(userId));
    if (userFound) {
      setSelectedUser(userFound.id);
      setSelectedUserDetails(userFound);
    }
  };

  // Extrair tipo de ausência da observação
  const getTipoFromObservacao = (observacao?: string): string => {
    if (!observacao) return 'folga';
    
    for (const [tipo] of Object.entries(tiposAusencia)) {
      if (observacao.toLowerCase().includes(`[${tipo}]`)) {
        return tipo;
      }
    }
    return 'folga';
  };

  // Formatar data para exibição
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  if (!periodo) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertDescription>
            Nenhum período ativo encontrado. Configure um período nas metas primeiro.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarIcon className="w-6 h-6" />
              Escala de Trabalho
            </h1>
            <p className="text-sm text-muted-foreground">
              Período: {formatDate(dataInicio)} a {formatDate(dataFim)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant={viewMode === 'list' ? 'default' : 'outline'} 
            onClick={() => setViewMode('list')}
            size="sm"
          >
            <Users className="w-4 h-4 mr-2" />
            Lista
          </Button>
          <Button 
            variant={viewMode === 'calendar' ? 'default' : 'outline'} 
            onClick={() => setViewMode('calendar')}
            size="sm"
          >
            <Eye className="w-4 h-4 mr-2" />
            Calendário
          </Button>
        </div>
      </div>

      {/* Seleção de usuário - apenas para quem pode gerenciar */}
      {podeGerenciar && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Selecionar Funcionário
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="filtroTipo">Filtrar por Tipo</Label>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os tipos</SelectItem>
                    <SelectItem value="auxiliar">Auxiliar</SelectItem>
                    <SelectItem value="farmaceutico">Farmacêutico</SelectItem>
                    <SelectItem value="consultora">Consultora</SelectItem>
                    <SelectItem value="lider">Líder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="usuario">Funcionário</Label>
                <Select onValueChange={handleUserSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingUsuarios ? (
                      <SelectItem value="loading" disabled>Carregando...</SelectItem>
                    ) : usuariosFiltrados.length === 0 ? (
                      <SelectItem value="empty" disabled>Nenhum funcionário encontrado</SelectItem>
                    ) : (
                      usuariosFiltrados.map((usuario) => (
                        <SelectItem key={usuario.id} value={usuario.id.toString()}>
                          {usuario.nome} - {getDescricaoTipoUsuario(usuario.tipo)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {selectedUserDetails && (
              <Alert>
                <AlertDescription>
                  Visualizando folgas de: <strong>{selectedUserDetails.nome}</strong> ({getDescricaoTipoUsuario(selectedUserDetails.tipo)})
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lista de Folgas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Folgas do Período</span>
            {loadingFolgas && (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                <span className="text-sm">Carregando...</span>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {folgas.length === 0 ? (
            <div className="text-center py-8">
              <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {selectedUser || !podeGerenciar 
                  ? "Nenhuma folga registrada no período selecionado" 
                  : "Selecione um funcionário para ver suas folgas"
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {folgas.map((folga) => {
                const tipo = getTipoFromObservacao(folga.observacao);
                const tipoInfo = tiposAusencia[tipo as keyof typeof tiposAusencia] || tiposAusencia.folga;
                
                return (
                  <div key={folga.folga_id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-4 h-4 rounded-full ${tipoInfo.color}`}></div>
                      <div>
                        <p className="font-medium">{formatDate(folga.data_folga)}</p>
                        <p className="text-sm text-muted-foreground">
                          {tipoInfo.label}
                          {folga.observacao && folga.observacao.replace(/\[.*?\]/g, '').trim() && (
                            <> - {folga.observacao.replace(/\[.*?\]/g, '').trim()}</>
                          )}
                        </p>
                        {folga.nome_usuario && (
                          <p className="text-xs text-muted-foreground">
                            Funcionário: {folga.nome_usuario}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informações adicionais */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            {Object.entries(tiposAusencia).map(([key, tipo]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${tipo.color}`}></div>
                <span className="text-sm">{tipo.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            * A funcionalidade de registro de ausências será implementada em breve
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}