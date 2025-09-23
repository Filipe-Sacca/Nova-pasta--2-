-- ==================== DELIVERY ANALYTICS TABLES ====================
-- Sistema completo de análise geográfica de entregas
-- Permite criar heatmaps, análise de regiões e insights de vendas

-- ==================== 1. HISTÓRICO DE ENTREGAS ====================
-- Tabela principal que armazena TODAS as entregas com localização completa
CREATE TABLE IF NOT EXISTS delivery_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identificação do pedido
    merchant_id TEXT NOT NULL,
    order_id TEXT,
    external_id TEXT,
    
    -- Dados temporais
    order_date TIMESTAMP NOT NULL DEFAULT NOW(),
    delivery_date TIMESTAMP,
    delivery_time_minutes INTEGER, -- Tempo total de entrega em minutos
    
    -- Localização do Restaurante
    restaurant_lat DECIMAL(10, 8) NOT NULL,
    restaurant_lng DECIMAL(11, 8) NOT NULL,
    restaurant_address TEXT,
    restaurant_neighborhood TEXT,
    restaurant_city TEXT,
    restaurant_state TEXT DEFAULT 'SP',
    
    -- Localização do Cliente
    customer_lat DECIMAL(10, 8) NOT NULL,
    customer_lng DECIMAL(11, 8) NOT NULL,
    customer_address TEXT NOT NULL,
    customer_neighborhood TEXT,
    customer_city TEXT,
    customer_state TEXT DEFAULT 'SP',
    customer_postal_code TEXT,
    
    -- Dados do pedido
    order_value DECIMAL(10, 2),
    delivery_fee DECIMAL(10, 2),
    items_count INTEGER,
    
    -- Status final
    final_status TEXT, -- DELIVERED, CANCELLED, etc
    cancellation_reason TEXT,
    
    -- Avaliação
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    has_complaint BOOLEAN DEFAULT FALSE,
    
    -- Entregador
    delivery_person_id TEXT,
    delivery_person_name TEXT,
    vehicle_type TEXT,
    
    -- Distância e rota
    distance_km DECIMAL(6, 2), -- Distância calculada entre restaurante e cliente
    actual_distance_km DECIMAL(6, 2), -- Distância real percorrida
    
    -- Metadados
    weather_condition TEXT, -- sunny, rainy, etc (para análise futura)
    day_of_week INTEGER, -- 0 = domingo, 6 = sábado
    hour_of_day INTEGER, -- 0-23
    is_weekend BOOLEAN,
    is_holiday BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para queries (criados separadamente)
CREATE INDEX idx_delivery_history_merchant ON delivery_history (merchant_id);
CREATE INDEX idx_delivery_history_date ON delivery_history (order_date DESC);
CREATE INDEX idx_delivery_history_customer_location ON delivery_history (customer_lat, customer_lng);
CREATE INDEX idx_delivery_history_neighborhood ON delivery_history (customer_neighborhood);
CREATE INDEX idx_delivery_history_status ON delivery_history (final_status);

-- ==================== 2. REGIÕES DE ENTREGA ====================
-- Define regiões/zonas para análise agregada
CREATE TABLE IF NOT EXISTS delivery_regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id TEXT NOT NULL,
    
    region_name TEXT NOT NULL, -- Ex: "Zona Sul", "Centro", "Vila Mariana"
    region_code TEXT UNIQUE, -- Ex: "ZS", "CT", "VM"
    
    -- Polígono da região (simplificado como retângulo)
    min_lat DECIMAL(10, 8) NOT NULL,
    max_lat DECIMAL(10, 8) NOT NULL,
    min_lng DECIMAL(11, 8) NOT NULL,
    max_lng DECIMAL(11, 8) NOT NULL,
    
    -- Ou usando PostGIS (se disponível)
    -- region_polygon GEOMETRY(POLYGON, 4326),
    
    -- Estatísticas da região (atualizadas periodicamente)
    total_orders INTEGER DEFAULT 0,
    total_revenue DECIMAL(10, 2) DEFAULT 0,
    avg_delivery_time INTEGER, -- minutos
    avg_rating DECIMAL(3, 2),
    
    -- Configurações
    delivery_fee_adjustment DECIMAL(5, 2) DEFAULT 0, -- Ajuste de taxa para a região
    is_active BOOLEAN DEFAULT TRUE,
    priority_level INTEGER DEFAULT 5, -- 1-10, usado para priorização
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_regions_merchant ON delivery_regions (merchant_id);
CREATE INDEX idx_regions_active ON delivery_regions (is_active);

-- ==================== 3. ANÁLISE AGREGADA POR GRID ====================
-- Divide a cidade em grid para heatmap (quadrados de ~500m)
CREATE TABLE IF NOT EXISTS delivery_grid_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id TEXT NOT NULL,
    
    -- Identificação do grid
    grid_lat DECIMAL(7, 5), -- Centro do quadrado (precisão ~1m)
    grid_lng DECIMAL(8, 5),
    grid_size_meters INTEGER DEFAULT 500,
    
    -- Período de análise
    analysis_date DATE NOT NULL,
    analysis_period TEXT, -- 'daily', 'weekly', 'monthly'
    
    -- Métricas
    total_orders INTEGER DEFAULT 0,
    total_revenue DECIMAL(10, 2) DEFAULT 0,
    avg_order_value DECIMAL(10, 2),
    avg_delivery_time INTEGER,
    
    -- Distribuição por horário
    orders_morning INTEGER DEFAULT 0, -- 6-12h
    orders_afternoon INTEGER DEFAULT 0, -- 12-18h
    orders_night INTEGER DEFAULT 0, -- 18-24h
    orders_dawn INTEGER DEFAULT 0, -- 0-6h
    
    -- Performance
    on_time_delivery_rate DECIMAL(5, 2), -- Porcentagem
    customer_satisfaction DECIMAL(3, 2), -- Média de rating
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    UNIQUE(merchant_id, grid_lat, grid_lng, analysis_date, analysis_period)
);

CREATE INDEX idx_grid_merchant_date ON delivery_grid_analytics (merchant_id, analysis_date DESC);
CREATE INDEX idx_grid_location ON delivery_grid_analytics (grid_lat, grid_lng);

-- ==================== 4. TENDÊNCIAS POR BAIRRO ====================
CREATE TABLE IF NOT EXISTS neighborhood_trends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id TEXT NOT NULL,
    
    neighborhood_name TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT 'São Paulo',
    state TEXT NOT NULL DEFAULT 'SP',
    
    -- Período
    trend_date DATE NOT NULL,
    trend_period TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
    
    -- Métricas principais
    total_orders INTEGER DEFAULT 0,
    total_revenue DECIMAL(10, 2) DEFAULT 0,
    unique_customers INTEGER DEFAULT 0,
    new_customers INTEGER DEFAULT 0,
    returning_customers INTEGER DEFAULT 0,
    
    -- Crescimento
    growth_rate DECIMAL(5, 2), -- % comparado ao período anterior
    market_share DECIMAL(5, 2), -- % do total de pedidos
    
    -- Top produtos (JSON)
    top_items JSONB, -- [{item_name, quantity, revenue}]
    
    -- Horários de pico
    peak_hour INTEGER, -- Hora com mais pedidos (0-23)
    peak_day_of_week INTEGER, -- Dia com mais pedidos (0-6)
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    UNIQUE(merchant_id, neighborhood_name, trend_date, trend_period)
);

CREATE INDEX idx_trends_merchant ON neighborhood_trends (merchant_id);
CREATE INDEX idx_trends_neighborhood ON neighborhood_trends (neighborhood_name);
CREATE INDEX idx_trends_date ON neighborhood_trends (trend_date DESC);

-- ==================== 5. CLIENTES POR REGIÃO ====================
-- Para análise de base de clientes por área
CREATE TABLE IF NOT EXISTS customer_location_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id TEXT NOT NULL,
    customer_id TEXT,
    
    -- Localização principal do cliente
    primary_lat DECIMAL(10, 8),
    primary_lng DECIMAL(11, 8),
    primary_address TEXT,
    primary_neighborhood TEXT,
    
    -- Estatísticas
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(10, 2) DEFAULT 0,
    avg_order_value DECIMAL(10, 2),
    last_order_date TIMESTAMP,
    first_order_date TIMESTAMP,
    
    -- Frequência
    order_frequency TEXT, -- 'daily', 'weekly', 'monthly', 'occasional'
    is_vip BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_merchant ON customer_location_analytics (merchant_id);
CREATE INDEX idx_customer_location ON customer_location_analytics (primary_lat, primary_lng);
CREATE INDEX idx_customer_neighborhood ON customer_location_analytics (primary_neighborhood);

-- ==================== VIEWS PARA ANÁLISE ====================

-- View: Resumo por região
CREATE OR REPLACE VIEW region_summary AS
SELECT 
    dr.merchant_id,
    dr.region_name,
    dr.region_code,
    COUNT(DISTINCT dh.order_id) as total_orders,
    SUM(dh.order_value) as total_revenue,
    AVG(dh.delivery_time_minutes) as avg_delivery_time,
    AVG(dh.rating) as avg_rating,
    COUNT(DISTINCT DATE(dh.order_date)) as active_days
FROM delivery_regions dr
LEFT JOIN delivery_history dh ON 
    dh.merchant_id = dr.merchant_id AND
    dh.customer_lat BETWEEN dr.min_lat AND dr.max_lat AND
    dh.customer_lng BETWEEN dr.min_lng AND dr.max_lng AND
    dh.final_status = 'DELIVERED'
WHERE dh.order_date >= NOW() - INTERVAL '30 days'
GROUP BY dr.merchant_id, dr.region_name, dr.region_code;

-- View: Heatmap data para últimos 7 dias
CREATE OR REPLACE VIEW delivery_heatmap AS
SELECT 
    merchant_id,
    ROUND(customer_lat::numeric, 3) as lat_grid, -- Agrupa em ~100m
    ROUND(customer_lng::numeric, 3) as lng_grid,
    COUNT(*) as order_count,
    SUM(order_value) as total_value,
    AVG(delivery_time_minutes) as avg_delivery_time
FROM delivery_history
WHERE 
    order_date >= NOW() - INTERVAL '7 days' AND
    final_status = 'DELIVERED'
GROUP BY merchant_id, lat_grid, lng_grid;

-- View: Top bairros por receita
CREATE OR REPLACE VIEW top_neighborhoods AS
SELECT 
    merchant_id,
    customer_neighborhood,
    customer_city,
    COUNT(*) as total_orders,
    SUM(order_value) as total_revenue,
    AVG(order_value) as avg_order_value,
    AVG(rating) as avg_rating,
    COUNT(DISTINCT DATE(order_date)) as active_days
FROM delivery_history
WHERE 
    order_date >= NOW() - INTERVAL '30 days' AND
    final_status = 'DELIVERED' AND
    customer_neighborhood IS NOT NULL
GROUP BY merchant_id, customer_neighborhood, customer_city
ORDER BY total_revenue DESC;

-- ==================== FUNÇÕES ÚTEIS ====================

-- Função para calcular distância entre dois pontos (Haversine)
CREATE OR REPLACE FUNCTION calculate_distance(
    lat1 DECIMAL, lng1 DECIMAL,
    lat2 DECIMAL, lng2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
    R CONSTANT DECIMAL := 6371; -- Raio da Terra em km
    dlat DECIMAL;
    dlng DECIMAL;
    a DECIMAL;
    c DECIMAL;
BEGIN
    dlat := radians(lat2 - lat1);
    dlng := radians(lng2 - lng1);
    a := sin(dlat/2) * sin(dlat/2) + 
         cos(radians(lat1)) * cos(radians(lat2)) * 
         sin(dlng/2) * sin(dlng/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    RETURN R * c;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar distância automaticamente
CREATE OR REPLACE FUNCTION update_delivery_distance() RETURNS TRIGGER AS $$
BEGIN
    NEW.distance_km := calculate_distance(
        NEW.restaurant_lat, NEW.restaurant_lng,
        NEW.customer_lat, NEW.customer_lng
    );
    NEW.day_of_week := EXTRACT(DOW FROM NEW.order_date);
    NEW.hour_of_day := EXTRACT(HOUR FROM NEW.order_date);
    NEW.is_weekend := NEW.day_of_week IN (0, 6);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_delivery_distance
BEFORE INSERT OR UPDATE ON delivery_history
FOR EACH ROW
EXECUTE FUNCTION update_delivery_distance();

-- ==================== JOBS AGENDADOS (EXEMPLO) ====================
-- Executar diariamente para atualizar análises

/*
-- Exemplo de job para atualizar grid analytics (executar via cron ou scheduler)
INSERT INTO delivery_grid_analytics (
    merchant_id, grid_lat, grid_lng, analysis_date, analysis_period,
    total_orders, total_revenue, avg_order_value, avg_delivery_time
)
SELECT 
    merchant_id,
    ROUND(customer_lat::numeric, 3) as grid_lat,
    ROUND(customer_lng::numeric, 3) as grid_lng,
    CURRENT_DATE as analysis_date,
    'daily' as analysis_period,
    COUNT(*) as total_orders,
    SUM(order_value) as total_revenue,
    AVG(order_value) as avg_order_value,
    AVG(delivery_time_minutes) as avg_delivery_time
FROM delivery_history
WHERE DATE(order_date) = CURRENT_DATE - 1
    AND final_status = 'DELIVERED'
GROUP BY merchant_id, grid_lat, grid_lng
ON CONFLICT (merchant_id, grid_lat, grid_lng, analysis_date, analysis_period) 
DO UPDATE SET
    total_orders = EXCLUDED.total_orders,
    total_revenue = EXCLUDED.total_revenue,
    avg_order_value = EXCLUDED.avg_order_value,
    avg_delivery_time = EXCLUDED.avg_delivery_time;
*/

-- ==================== COMENTÁRIOS E USO ====================
/*
COMO USAR ESTE SISTEMA:

1. REGISTRAR ENTREGAS:
   - Sempre que uma entrega for criada/concluída, inserir em delivery_history
   - Os campos de localização são OBRIGATÓRIOS para análise

2. CRIAR REGIÕES:
   - Definir regiões de interesse em delivery_regions
   - Pode ser bairros, zonas ou áreas customizadas

3. ANÁLISE DE HEATMAP:
   - Use a view delivery_heatmap para dados de calor
   - Integre com bibliotecas como Leaflet.heat ou Google Maps Heatmap

4. RELATÓRIOS:
   - Top bairros: SELECT * FROM top_neighborhoods WHERE merchant_id = ?
   - Resumo regional: SELECT * FROM region_summary WHERE merchant_id = ?

5. INSIGHTS FUTUROS:
   - Previsão de demanda por região
   - Otimização de rotas
   - Definição de áreas de entrega
   - Precificação dinâmica por região
   - Identificação de zonas de expansão

EXEMPLO DE INSERÇÃO:
INSERT INTO delivery_history (
    merchant_id, order_id, order_date,
    restaurant_lat, restaurant_lng, restaurant_address,
    customer_lat, customer_lng, customer_address, customer_neighborhood,
    order_value, delivery_fee, final_status
) VALUES (
    '577cb3b1-5845-4fbc-a219-8cd3939cb9ea',
    'ORDER-001',
    NOW(),
    -23.550520, -46.633308, 'Av Paulista 1000',
    -23.560520, -46.643308, 'Rua Augusta 500', 'Jardins',
    150.00, 10.00, 'DELIVERED'
);
*/