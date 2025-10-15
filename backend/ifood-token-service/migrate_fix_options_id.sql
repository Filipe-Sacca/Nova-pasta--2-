-- ============================================================================
-- MIGRAÇÃO: Fix options_id em products
-- ============================================================================
-- Data: 2025-10-14
-- Problema: products.options_id estava salvando product_id dos complementos
--           em vez de option_id (ID do grupo de opções do iFood)
-- Solução: Buscar option_ids corretos de complement_groups e atualizar products
-- ============================================================================

-- ETAPA 1: Ver situação atual (ANTES da migração)
SELECT
    p.id,
    p.name,
    p.options_id,
    p.merchant_id
FROM products p
WHERE p.options_id IS NOT NULL
LIMIT 10;

-- ETAPA 2: Criar função temporária para atualizar options_id
CREATE OR REPLACE FUNCTION fix_product_options_id()
RETURNS TABLE(
    product_id UUID,
    product_name TEXT,
    old_options_id JSONB,
    new_options_id JSONB,
    status TEXT
) AS $$
DECLARE
    product_record RECORD;
    new_option_ids JSONB;
    option_ids_array TEXT[];
BEGIN
    -- Iterar por todos os produtos que têm product_id não nulo
    FOR product_record IN
        SELECT
            p.id,
            p.name,
            p.product_id,
            p.options_id as old_options_id,
            p.merchant_id
        FROM products p
        WHERE p.product_id IS NOT NULL
    LOOP
        -- Buscar option_ids do complement_groups para este produto
        SELECT COALESCE(
            array_agg(DISTINCT unnested_option_id)::TEXT[],
            ARRAY[]::TEXT[]
        )
        INTO option_ids_array
        FROM complement_groups cg,
        LATERAL unnest(cg.product_ids::TEXT[]) AS unnested_product_id,
        LATERAL unnest(cg.option_ids::TEXT[]) AS unnested_option_id
        WHERE unnested_product_id = product_record.product_id
        AND cg.merchant_id = product_record.merchant_id;

        -- Converter array para JSONB
        IF array_length(option_ids_array, 1) > 0 THEN
            new_option_ids := to_jsonb(option_ids_array);
        ELSE
            new_option_ids := NULL;
        END IF;

        -- Atualizar produto SOMENTE se encontrou option_ids
        IF new_option_ids IS NOT NULL THEN
            UPDATE products
            SET
                options_id = new_option_ids,
                updated_at = NOW()
            WHERE id = product_record.id;

            -- Retornar resultado
            RETURN QUERY SELECT
                product_record.id,
                product_record.name,
                product_record.old_options_id,
                new_option_ids,
                'UPDATED'::TEXT;
        ELSE
            -- Retornar que não encontrou options
            RETURN QUERY SELECT
                product_record.id,
                product_record.name,
                product_record.old_options_id,
                NULL::JSONB,
                'NO_OPTIONS_FOUND'::TEXT;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ETAPA 3: Executar a migração e ver resultados
SELECT * FROM fix_product_options_id()
ORDER BY status, product_name;

-- ETAPA 4: Verificar após migração
SELECT
    p.id,
    p.name,
    p.options_id,
    p.merchant_id,
    (
        SELECT COUNT(*)
        FROM ifood_complements ic
        WHERE ic.option_id = ANY(
            SELECT jsonb_array_elements_text(p.options_id)
        )
    ) as matching_complements_count
FROM products p
WHERE p.options_id IS NOT NULL
LIMIT 10;

-- ETAPA 5: Limpar função temporária
DROP FUNCTION IF EXISTS fix_product_options_id();

-- ============================================================================
-- VALIDAÇÃO MANUAL (copie e cole esses comandos um por um)
-- ============================================================================

-- 1. Ver produto "Brasileira Updated" (deve ter options_id corretos)
SELECT
    p.id,
    p.name,
    p.options_id,
    (
        SELECT json_agg(
            json_build_object(
                'option_id', ic.option_id,
                'name', ic.name
            )
        )
        FROM ifood_complements ic
        WHERE ic.option_id = ANY(
            SELECT jsonb_array_elements_text(p.options_id)
        )
    ) as matched_complements
FROM products p
WHERE p.name LIKE '%Brasileira Updated%';

-- 2. Ver produto "Pizza Calabresa" (agora deve ter options_id corretos também)
SELECT
    p.id,
    p.name,
    p.options_id,
    (
        SELECT json_agg(
            json_build_object(
                'option_id', ic.option_id,
                'name', ic.name
            )
        )
        FROM ifood_complements ic
        WHERE ic.option_id = ANY(
            SELECT jsonb_array_elements_text(p.options_id)
        )
    ) as matched_complements
FROM products p
WHERE p.name LIKE '%Pizza Calabresa%';

-- ============================================================================
-- ROLLBACK (caso necessário - CUIDADO!)
-- ============================================================================
-- ⚠️ NÃO execute isso a menos que precise reverter a migração!
--
-- UPDATE products
-- SET options_id = NULL
-- WHERE options_id IS NOT NULL;
