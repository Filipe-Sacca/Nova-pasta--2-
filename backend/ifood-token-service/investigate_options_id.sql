-- 1. Buscar produto "Brasileira Updated" e ver options_id
SELECT 
    id,
    name,
    options_id,
    merchant_id
FROM products 
WHERE name LIKE '%Brasileira Updated%'
LIMIT 5;

-- 2. Buscar esses options_id na tabela ifood_complements (deve encontrar)
-- (vamos fazer isso depois de ver o resultado acima)

-- 3. Buscar produto "Pizza Calabresa" e ver options_id
SELECT 
    id,
    name,
    options_id,
    merchant_id
FROM products 
WHERE name LIKE '%Pizza Calabresa%'
LIMIT 5;

-- 4. Tentar buscar options_id de Pizza Calabresa em ifood_complements
-- (vamos fazer isso depois de ver o resultado acima)
