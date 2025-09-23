-- Adicionar campos de timestamp na tabela ifood_tokens
ALTER TABLE ifood_tokens 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS token_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Criar trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger na tabela
DROP TRIGGER IF EXISTS update_ifood_tokens_updated_at ON ifood_tokens;
CREATE TRIGGER update_ifood_tokens_updated_at
    BEFORE UPDATE ON ifood_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();