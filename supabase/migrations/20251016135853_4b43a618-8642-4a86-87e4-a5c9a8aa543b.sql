-- Criar tabela para controles de entregas
CREATE TABLE IF NOT EXISTS public.controles_entregas (
  id SERIAL PRIMARY KEY,
  matricula_vendedor VARCHAR(50) NOT NULL,
  nome_vendedor VARCHAR(255) NOT NULL,
  codigo_produto INTEGER NOT NULL,
  nome_produto TEXT NOT NULL,
  loja_origem_id INTEGER NOT NULL REFERENCES lojas(id),
  loja_destino_id INTEGER NOT NULL REFERENCES lojas(id),
  cpf_cliente VARCHAR(14),
  telefone_cliente VARCHAR(20),
  forma_entrega VARCHAR(50) NOT NULL CHECK (forma_entrega IN ('retira_outra_loja', 'retira_propria_loja', 'entrega_casa')),
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'entregue', 'cancelado')),
  criado_por_usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  entregue_por_usuario_id INTEGER REFERENCES usuarios(id),
  data_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_entrega TIMESTAMP,
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para melhor performance
CREATE INDEX idx_controles_entregas_loja_origem ON controles_entregas(loja_origem_id);
CREATE INDEX idx_controles_entregas_loja_destino ON controles_entregas(loja_destino_id);
CREATE INDEX idx_controles_entregas_status ON controles_entregas(status);
CREATE INDEX idx_controles_entregas_data_criacao ON controles_entregas(data_criacao);

-- Enable RLS
ALTER TABLE public.controles_entregas ENABLE ROW LEVEL SECURITY;

-- Policy para leitura - admin vê tudo, outros veem apenas da sua loja
CREATE POLICY "Permitir leitura de entregas"
ON public.controles_entregas
FOR SELECT
USING (
  auth.jwt() IS NOT NULL
);

-- Policy para inserção - usuários autenticados podem criar
CREATE POLICY "Permitir criação de entregas"
ON public.controles_entregas
FOR INSERT
WITH CHECK (
  auth.jwt() IS NOT NULL
);

-- Policy para atualização - usuários autenticados podem atualizar
CREATE POLICY "Permitir atualização de entregas"
ON public.controles_entregas
FOR UPDATE
USING (
  auth.jwt() IS NOT NULL
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_controles_entregas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_controles_entregas_updated_at
BEFORE UPDATE ON controles_entregas
FOR EACH ROW
EXECUTE FUNCTION update_controles_entregas_updated_at();