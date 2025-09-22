-- Fix para problema de tokens duplicados
-- Adicionar restrição UNIQUE para (user_id, client_id) para evitar duplicatas

-- Primeiro, remover a restrição UNIQUE apenas em user_id
ALTER TABLE public.ifood_tokens DROP CONSTRAINT IF EXISTS ifood_tokens_user_id_key;

-- Adicionar nova restrição UNIQUE para (user_id, client_id)
ALTER TABLE public.ifood_tokens ADD CONSTRAINT ifood_tokens_user_client_unique UNIQUE (user_id, client_id);

-- Limpar tokens duplicados se existirem (manter apenas o mais recente)
DELETE FROM public.ifood_tokens
WHERE id NOT IN (
    SELECT DISTINCT ON (user_id, client_id) id
    FROM public.ifood_tokens
    ORDER BY user_id, client_id, created_at DESC
);

-- Adicionar índice para performance na busca por user_id + client_id
CREATE INDEX IF NOT EXISTS idx_ifood_tokens_user_client ON public.ifood_tokens(user_id, client_id);