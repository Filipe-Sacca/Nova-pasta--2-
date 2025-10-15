-- =====================================================
-- MIGRAÇÃO: Estrutura para Sincronização Automática com iFood
-- Data: 2025-10-12
-- Projeto: iFood Integration Hub - Gestão de Menus
-- =====================================================

-- =====================================================
-- 1️⃣ PRODUCTS - Adicionar original_price
-- =====================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS original_price NUMERIC(10, 2);

COMMENT ON COLUMN products.original_price IS 'Preço original do produto (item.price.originalValue)';

-- =====================================================
-- 2️⃣ COMPLEMENT_GROUPS - Correções e adições
-- =====================================================

-- Corrigir tipo de option_ids (UUID[] → TEXT[])
ALTER TABLE complement_groups
  ALTER COLUMN option_ids TYPE TEXT[] USING option_ids::TEXT[];

-- Adicionar novas colunas
ALTER TABLE complement_groups
  ADD COLUMN IF NOT EXISTS product_ids UUID[],
  ADD COLUMN IF NOT EXISTS min_selection INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_selection INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS merchant_id TEXT;

-- Remover coluna product_id se existir (relacionamento incorreto)
ALTER TABLE complement_groups
  DROP COLUMN IF EXISTS product_id;

-- Índices GIN para arrays
CREATE INDEX IF NOT EXISTS idx_complement_groups_product_ids
  ON complement_groups USING GIN (product_ids);

CREATE INDEX IF NOT EXISTS idx_complement_groups_merchant_id
  ON complement_groups(merchant_id);

-- Comentários
COMMENT ON COLUMN complement_groups.product_ids IS 'Array de UUIDs dos produtos que possuem este grupo (reconstruído a cada sincronização)';
COMMENT ON COLUMN complement_groups.option_ids IS 'Array de IDs das opções do iFood (optionGroup.optionIds)';
COMMENT ON COLUMN complement_groups.min_selection IS 'Quantidade mínima de opções selecionáveis (optionGroup.min)';
COMMENT ON COLUMN complement_groups.max_selection IS 'Quantidade máxima de opções selecionáveis (optionGroup.max)';

-- =====================================================
-- 3️⃣ IFOOD_COMPLEMENTS - Renomear e adicionar colunas
-- =====================================================

-- Renomear colunas existentes
DO $$
BEGIN
  -- Renomear item_id → option_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ifood_complements' AND column_name = 'item_id'
  ) THEN
    ALTER TABLE ifood_complements RENAME COLUMN item_id TO option_id;
  END IF;

  -- Renomear price → context_price
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ifood_complements' AND column_name = 'price'
  ) THEN
    ALTER TABLE ifood_complements RENAME COLUMN price TO context_price;
  END IF;

  -- Renomear is_active → status
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ifood_complements' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE ifood_complements RENAME COLUMN is_active TO status;
  END IF;
END $$;

-- Adicionar novas colunas
ALTER TABLE ifood_complements
  ADD COLUMN IF NOT EXISTS complement_group_ids UUID[],
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Remover colunas desnecessárias
ALTER TABLE ifood_complements
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS ifood_category_id,
  DROP COLUMN IF EXISTS ifood_category_name;

-- Índices GIN para arrays
CREATE INDEX IF NOT EXISTS idx_ifood_complements_complement_group_ids
  ON ifood_complements USING GIN (complement_group_ids);

CREATE INDEX IF NOT EXISTS idx_ifood_complements_option_id
  ON ifood_complements(option_id);

CREATE INDEX IF NOT EXISTS idx_ifood_complements_status
  ON ifood_complements(status);

-- Comentários
COMMENT ON COLUMN ifood_complements.option_id IS 'ID da opção no iFood (option.id)';
COMMENT ON COLUMN ifood_complements.context_price IS 'Preço do complemento (contextModifiers[0].price.value)';
COMMENT ON COLUMN ifood_complements.status IS 'Status: AVAILABLE, UNAVAILABLE';
COMMENT ON COLUMN ifood_complements.complement_group_ids IS 'Array de UUIDs dos grupos aos quais pertence (reconstruído a cada sincronização)';

-- =====================================================
-- 4️⃣ IFOOD_MERCHANTS - Adicionar colunas para cache
-- =====================================================

ALTER TABLE ifood_merchants
  ADD COLUMN IF NOT EXISTS catalog_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS catalog_synced_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS categories_synced_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS sync_status VARCHAR(50) DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_merchants_sync_status
  ON ifood_merchants(sync_status);

COMMENT ON COLUMN ifood_merchants.catalog_id IS 'Catalog ID cacheado do iFood (atualizado se necessário)';
COMMENT ON COLUMN ifood_merchants.categories_synced_at IS 'Última sincronização de categorias';
COMMENT ON COLUMN ifood_merchants.last_sync_at IS 'Última sincronização de produtos';

-- =====================================================
-- 5️⃣ TRIGGERS para updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para products
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para complement_groups
DROP TRIGGER IF EXISTS update_complement_groups_updated_at ON complement_groups;
CREATE TRIGGER update_complement_groups_updated_at
    BEFORE UPDATE ON complement_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para ifood_complements
DROP TRIGGER IF EXISTS update_ifood_complements_updated_at ON ifood_complements;
CREATE TRIGGER update_ifood_complements_updated_at
    BEFORE UPDATE ON ifood_complements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6️⃣ CONSTRAINTS de validação
-- =====================================================

-- Constraint para min/max em complement_groups
ALTER TABLE complement_groups
  DROP CONSTRAINT IF EXISTS complement_groups_min_max_check;
ALTER TABLE complement_groups
  ADD CONSTRAINT complement_groups_min_max_check
  CHECK (min_selection >= 0 AND max_selection >= min_selection);

-- =====================================================
-- 7️⃣ VIEWS ÚTEIS para consultas
-- =====================================================

-- View: Produtos com seus grupos de complementos
CREATE OR REPLACE VIEW products_with_complements AS
SELECT
  p.id,
  p.name,
  p.item_id,
  p.product_id,
  p.price,
  p.original_price,
  p.is_active,
  p.imagePath,
  p.merchant_id,
  json_agg(
    json_build_object(
      'group_id', cg.id,
      'group_name', cg.name,
      'min_selection', cg.min_selection,
      'max_selection', cg.max_selection,
      'status', cg.status
    ) ORDER BY cg.display_order
  ) FILTER (WHERE cg.id IS NOT NULL) AS option_groups
FROM products p
LEFT JOIN unnest(
  ARRAY(
    SELECT id FROM complement_groups
    WHERE product_ids @> ARRAY[p.id]
  )
) AS group_id ON true
LEFT JOIN complement_groups cg ON cg.id = group_id
GROUP BY p.id;

-- View: Grupos de complementos com seus complementos
CREATE OR REPLACE VIEW complement_groups_with_options AS
SELECT
  cg.id,
  cg.name,
  cg.group_compl_id,
  cg.status,
  cg.min_selection,
  cg.max_selection,
  cg.merchant_id,
  json_agg(
    json_build_object(
      'option_id', ic.id,
      'name', ic.name,
      'price', ic.context_price,
      'status', ic.status,
      'display_order', ic.display_order
    ) ORDER BY ic.display_order
  ) FILTER (WHERE ic.id IS NOT NULL) AS options
FROM complement_groups cg
LEFT JOIN ifood_complements ic ON ic.complement_group_ids @> ARRAY[cg.id]
GROUP BY cg.id;

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================

SELECT '✅ Migração concluída! Estrutura pronta para sincronização automática.' AS status;
