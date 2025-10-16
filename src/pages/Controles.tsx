import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Package, User, Phone, MapPin, Truck, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

interface Loja {
  id: number;
  numero: string;
  nome: string;
}

interface Entrega {
  id: number;
  matricula_vendedor: string;
  nome_vendedor: string;
  codigo_produto: number;
  nome_produto: string;
  loja_origem_id: number;
  loja_destino_id: number;
  cpf_cliente: string;
  telefone_cliente: string;
  forma_entrega: string;
  status: string;
  data_criacao: string;
  data_entrega: string | null;
  entregue_por_usuario_id: number | null;
  observacoes: string | null;
}

export default function Controles() {
  const { user } = useAuth();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form states
  const [matricula, setMatricula] = useState("");
  const [nomeVendedor, setNomeVendedor] = useState("");
  const [codigoProduto, setCodigoProduto] = useState("");
  const [nomeProduto, setNomeProduto] = useState("");
  const [lojaOrigem, setLojaOrigem] = useState("");
  const [lojaDestino, setLojaDestino] = useState(user?.loja_id?.toString() || "");
  const [cpfCliente, setCpfCliente] = useState("");
  const [telefoneCliente, setTelefoneCliente] = useState("");
  const [formaEntrega, setFormaEntrega] = useState("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    carregarLojas();
    carregarEntregas();
  }, []);

  const carregarLojas = async () => {
    try {
      const { data, error } = await supabase
        .from("lojas")
        .select("id, numero, nome")
        .order("numero");
      
      if (error) throw error;
      setLojas(data || []);
    } catch (error) {
      console.error("Erro ao carregar lojas:", error);
      toast.error("Erro ao carregar lojas");
    }
  };

  const carregarEntregas = async () => {
    try {
      const { data, error } = await supabase
        .from("controles_entregas")
        .select("*")
        .order("data_criacao", { ascending: false });
      
      if (error) throw error;
      
      // Filtrar por loja se não for admin
      if (user?.tipo !== 'admin') {
        const entregasFiltradas = data?.filter(
          (e: Entrega) => e.loja_origem_id === user?.loja_id || e.loja_destino_id === user?.loja_id
        );
        setEntregas(entregasFiltradas || []);
      } else {
        setEntregas(data || []);
      }
    } catch (error) {
      console.error("Erro ao carregar entregas:", error);
      toast.error("Erro ao carregar entregas");
    }
  };

  const buscarVendedor = async () => {
    if (!matricula) {
      toast.error("Digite a matrícula do vendedor");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mysql-usuarios', {
        body: {
          action: 'buscar_por_matricula',
          matricula: matricula
        }
      });

      if (error) throw error;

      if (data?.success) {
        setNomeVendedor(data.data.nome);
        toast.success("Vendedor encontrado!");
      } else {
        toast.error(data?.message || "Vendedor não encontrado");
        setNomeVendedor("");
      }
    } catch (error) {
      console.error("Erro ao buscar vendedor:", error);
      toast.error("Erro ao buscar vendedor");
      setNomeVendedor("");
    } finally {
      setLoading(false);
    }
  };

  const buscarProduto = async () => {
    if (!codigoProduto) {
      toast.error("Digite o código do produto");
      return;
    }

    setLoading(true);
    try {
      const hoje = new Date();
      const dataFim = format(hoje, 'yyyy-MM-dd');
      const dataIni = format(new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

      const { data, error } = await supabase.functions.invoke('callfarma-vendas', {
        body: {
          endpoint: '/financeiro/vendas-por-funcionario',
          params: {
            dataFim: dataFim,
            dataIni: dataIni,
            filtroProduto: codigoProduto,
            groupBy: '',
            orderBy: 'scefun.NOME asc'
          }
        }
      });

      if (error) throw error;

      if (data?.msg && data.msg.length > 0) {
        setNomeProduto(data.msg[0].NOMEPRODU);
        toast.success("Produto encontrado!");
      } else {
        toast.error("Produto não encontrado");
        setNomeProduto("");
      }
    } catch (error) {
      console.error("Erro ao buscar produto:", error);
      toast.error("Erro ao buscar produto");
      setNomeProduto("");
    } finally {
      setLoading(false);
    }
  };

  const salvarEntrega = async () => {
    if (!matricula || !nomeVendedor || !codigoProduto || !nomeProduto || 
        !lojaOrigem || !lojaDestino || !formaEntrega) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("controles_entregas")
        .insert({
          matricula_vendedor: matricula,
          nome_vendedor: nomeVendedor,
          codigo_produto: parseInt(codigoProduto),
          nome_produto: nomeProduto,
          loja_origem_id: parseInt(lojaOrigem),
          loja_destino_id: parseInt(lojaDestino),
          cpf_cliente: cpfCliente,
          telefone_cliente: telefoneCliente,
          forma_entrega: formaEntrega,
          criado_por_usuario_id: user?.id,
          observacoes: observacoes || null
        });

      if (error) throw error;

      toast.success("Entrega registrada com sucesso!");
      limparFormulario();
      carregarEntregas();
    } catch (error) {
      console.error("Erro ao salvar entrega:", error);
      toast.error("Erro ao salvar entrega");
    } finally {
      setLoading(false);
    }
  };

  const marcarComoEntregue = async (id: number) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("controles_entregas")
        .update({
          status: 'entregue',
          data_entrega: new Date().toISOString(),
          entregue_por_usuario_id: user?.id
        })
        .eq('id', id);

      if (error) throw error;

      toast.success("Entrega marcada como entregue!");
      carregarEntregas();
    } catch (error) {
      console.error("Erro ao marcar entrega:", error);
      toast.error("Erro ao marcar entrega como entregue");
    } finally {
      setLoading(false);
    }
  };

  const limparFormulario = () => {
    setMatricula("");
    setNomeVendedor("");
    setCodigoProduto("");
    setNomeProduto("");
    setLojaOrigem("");
    setLojaDestino(user?.loja_id?.toString() || "");
    setCpfCliente("");
    setTelefoneCliente("");
    setFormaEntrega("");
    setObservacoes("");
  };

  const getFormaEntregaLabel = (forma: string) => {
    const formas: Record<string, string> = {
      retira_outra_loja: "Retira na outra loja",
      retira_propria_loja: "Retira na própria loja",
      entrega_casa: "Entrega em casa via televendas"
    };
    return formas[forma] || forma;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { variant: any; label: string }> = {
      pendente: { variant: "outline", label: "Pendente" },
      entregue: { variant: "default", label: "Entregue" },
      cancelado: { variant: "destructive", label: "Cancelado" }
    };
    const config = badges[status] || badges.pendente;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Controles de Entregas</h1>
      </div>

      {/* Formulário de Cadastro */}
      <Card>
        <CardHeader>
          <CardTitle>Nova Entrega</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Vendedor */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="matricula">Matrícula do Vendedor *</Label>
              <div className="flex gap-2">
                <Input
                  id="matricula"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  placeholder="Digite a matrícula"
                />
                <Button onClick={buscarVendedor} disabled={loading} size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Nome do Vendedor</Label>
              <Input value={nomeVendedor} disabled placeholder="Busque pela matrícula" />
            </div>
          </div>

          {/* Produto */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código do Produto *</Label>
              <div className="flex gap-2">
                <Input
                  id="codigo"
                  value={codigoProduto}
                  onChange={(e) => setCodigoProduto(e.target.value)}
                  placeholder="Digite o código"
                />
                <Button onClick={buscarProduto} disabled={loading} size="icon">
                  <Package className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Nome do Produto</Label>
              <Input value={nomeProduto} disabled placeholder="Busque pelo código" />
            </div>
          </div>

          {/* Lojas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="origem">Loja Origem *</Label>
              <Select value={lojaOrigem} onValueChange={setLojaOrigem}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a loja origem" />
                </SelectTrigger>
                <SelectContent>
                  {lojas.map((loja) => (
                    <SelectItem key={loja.id} value={loja.id.toString()}>
                      {loja.numero} - {loja.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="destino">Loja Destino *</Label>
              <Select value={lojaDestino} onValueChange={setLojaDestino}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a loja destino" />
                </SelectTrigger>
                <SelectContent>
                  {lojas.map((loja) => (
                    <SelectItem key={loja.id} value={loja.id.toString()}>
                      {loja.numero} - {loja.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cliente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF do Cliente</Label>
              <Input
                id="cpf"
                value={cpfCliente}
                onChange={(e) => setCpfCliente(e.target.value)}
                placeholder="000.000.000-00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone do Cliente</Label>
              <Input
                id="telefone"
                value={telefoneCliente}
                onChange={(e) => setTelefoneCliente(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          {/* Forma de Entrega */}
          <div className="space-y-2">
            <Label htmlFor="forma">Forma de Entrega *</Label>
            <Select value={formaEntrega} onValueChange={setFormaEntrega}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a forma de entrega" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="retira_outra_loja">Retira na outra loja</SelectItem>
                <SelectItem value="retira_propria_loja">Retira na própria loja</SelectItem>
                <SelectItem value="entrega_casa">Entrega em casa via televendas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="obs">Observações</Label>
            <Input
              id="obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Informações adicionais"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={salvarEntrega} disabled={loading}>
              Salvar Entrega
            </Button>
            <Button onClick={limparFormulario} variant="outline">
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Entregas */}
      <Card>
        <CardHeader>
          <CardTitle>Entregas Registradas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entregas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Nenhuma entrega registrada
                    </TableCell>
                  </TableRow>
                ) : (
                  entregas.map((entrega) => (
                    <TableRow key={entrega.id}>
                      <TableCell>
                        {format(new Date(entrega.data_criacao), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <div>
                            <div className="font-medium">{entrega.nome_vendedor}</div>
                            <div className="text-xs text-muted-foreground">
                              Mat: {entrega.matricula_vendedor}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate" title={entrega.nome_produto}>
                          {entrega.nome_produto}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Cód: {entrega.codigo_produto}
                        </div>
                      </TableCell>
                      <TableCell>
                        {lojas.find(l => l.id === entrega.loja_origem_id)?.numero || '-'}
                      </TableCell>
                      <TableCell>
                        {lojas.find(l => l.id === entrega.loja_destino_id)?.numero || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          {getFormaEntregaLabel(entrega.forma_entrega)}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(entrega.status)}</TableCell>
                      <TableCell>
                        {entrega.status === 'pendente' && (
                          <Button
                            size="sm"
                            onClick={() => marcarComoEntregue(entrega.id)}
                            disabled={loading}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Entregar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
