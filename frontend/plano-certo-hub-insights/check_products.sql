-- Verificar produtos no banco
SELECT 
    COUNT(*) as total_products,
    COUNT(CASE WHEN options_id IS NOT NULL THEN 1 END) as with_options,
    COUNT(CASE WHEN options_id IS NULL THEN 1 END) as without_options
FROM products 
WHERE merchant_id = '577cb3b1-5845-4fbc-a219-8cd3939cb9ea';

-- Ver alguns produtos com options_id
SELECT 
    name,
    options_id,
    array_length(options_id::text[], 1) as total_options,
    created_at
FROM products 
WHERE merchant_id = '577cb3b1-5845-4fbc-a219-8cd3939cb9ea'
AND options_id IS NOT NULL
LIMIT 5;
