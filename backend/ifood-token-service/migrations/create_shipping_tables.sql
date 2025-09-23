-- ==================== iFood Shipping Tables ====================
-- Database migration for iFood Shipping module
-- Supports both platform orders (with orderId) and external orders (with externalId)

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS ifood_shipping_events CASCADE;
DROP TABLE IF EXISTS ifood_shipping_status CASCADE;
DROP TABLE IF EXISTS ifood_address_changes CASCADE;
DROP TABLE IF EXISTS ifood_safe_delivery CASCADE;
DROP TABLE IF EXISTS ifood_delivery_persons CASCADE;

-- ==================== Shipping Status Table ====================
-- Main table for tracking shipping status of all orders
CREATE TABLE ifood_shipping_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id TEXT NOT NULL,
    order_id TEXT, -- Platform order ID from iFood
    external_id TEXT, -- External order ID for non-platform orders
    status TEXT NOT NULL, -- REQUESTED, ACKNOWLEDGED, PREPARING, etc.
    sub_status TEXT,
    estimated_delivery_time TIMESTAMP,
    tracking_url TEXT,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Ensure we have either orderId or externalId
    CHECK (order_id IS NOT NULL OR external_id IS NOT NULL),
    -- Unique constraint for each order
    UNIQUE(merchant_id, order_id),
    UNIQUE(merchant_id, external_id)
);

-- ==================== Shipping Events Table ====================
-- Stores all events received from polling
CREATE TABLE ifood_shipping_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE, -- iFood event ID for deduplication
    merchant_id TEXT NOT NULL,
    order_id TEXT,
    external_id TEXT,
    merchant_external_code TEXT,
    event_code TEXT NOT NULL,
    event_sub_code TEXT,
    event_message TEXT,
    event_metadata JSONB,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP,
    
    -- Foreign key to shipping status
    FOREIGN KEY (merchant_id, order_id) REFERENCES ifood_shipping_status(merchant_id, order_id) ON DELETE CASCADE,
    -- Index for efficient polling queries
    INDEX idx_shipping_events_acknowledged (merchant_id, acknowledged),
    INDEX idx_shipping_events_created (created_at DESC)
);

-- ==================== Address Changes Table ====================
-- Tracks address change requests and responses
CREATE TABLE ifood_address_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL REFERENCES ifood_shipping_events(event_id),
    merchant_id TEXT NOT NULL,
    order_id TEXT,
    external_id TEXT,
    
    -- Original address
    original_street_name TEXT,
    original_street_number TEXT,
    original_complement TEXT,
    original_neighborhood TEXT,
    original_city TEXT,
    original_state TEXT,
    original_postal_code TEXT,
    original_latitude DECIMAL(10, 8),
    original_longitude DECIMAL(11, 8),
    
    -- New requested address
    new_street_name TEXT NOT NULL,
    new_street_number TEXT NOT NULL,
    new_complement TEXT,
    new_neighborhood TEXT NOT NULL,
    new_city TEXT NOT NULL,
    new_state TEXT NOT NULL,
    new_postal_code TEXT NOT NULL,
    new_latitude DECIMAL(10, 8) NOT NULL,
    new_longitude DECIMAL(11, 8) NOT NULL,
    new_reference TEXT,
    
    -- Change request details
    change_reason TEXT NOT NULL,
    customer_note TEXT,
    
    -- Response
    accepted BOOLEAN,
    rejection_reason TEXT,
    additional_fee DECIMAL(10, 2),
    estimated_time TEXT,
    responded_at TIMESTAMP,
    auto_rejected BOOLEAN DEFAULT FALSE, -- True if rejected due to 15-min timeout
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    timeout_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
    
    -- Foreign key to shipping status
    FOREIGN KEY (merchant_id, order_id) REFERENCES ifood_shipping_status(merchant_id, order_id) ON DELETE CASCADE,
    -- Index for timeout queries
    INDEX idx_address_changes_timeout (timeout_at, responded_at)
);

-- ==================== Safe Delivery Table ====================
-- Stores Safe Delivery scores and incidents
CREATE TABLE ifood_safe_delivery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id TEXT NOT NULL,
    order_id TEXT,
    external_id TEXT,
    
    -- Score information
    score INTEGER CHECK (score >= 0 AND score <= 100),
    risk_level TEXT CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH')),
    
    -- Score factors
    address_verification_score INTEGER,
    customer_history_score INTEGER,
    delivery_time_risk_score INTEGER,
    area_risk_score INTEGER,
    
    -- Incident reporting
    incident_type TEXT,
    incident_description TEXT,
    incident_reported_at TIMESTAMP,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Foreign key to shipping status
    FOREIGN KEY (merchant_id, order_id) REFERENCES ifood_shipping_status(merchant_id, order_id) ON DELETE CASCADE,
    -- Index for score queries
    INDEX idx_safe_delivery_score (merchant_id, risk_level)
);

-- ==================== Delivery Persons Table ====================
-- Stores delivery person information
CREATE TABLE ifood_delivery_persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id TEXT NOT NULL,
    order_id TEXT,
    external_id TEXT,
    
    -- Delivery person details
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    document TEXT,
    vehicle_type TEXT CHECK (vehicle_type IN ('MOTORCYCLE', 'BICYCLE', 'CAR', 'WALKER')),
    vehicle_plate TEXT,
    
    -- Tracking
    photo_url TEXT,
    current_latitude DECIMAL(10, 8),
    current_longitude DECIMAL(11, 8),
    last_location_update TIMESTAMP,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Foreign key to shipping status
    FOREIGN KEY (merchant_id, order_id) REFERENCES ifood_shipping_status(merchant_id, order_id) ON DELETE CASCADE,
    -- Index for active deliveries
    INDEX idx_delivery_persons_active (merchant_id, updated_at DESC)
);

-- ==================== Indexes for Performance ====================

-- Shipping status queries
CREATE INDEX idx_shipping_status_merchant ON ifood_shipping_status(merchant_id);
CREATE INDEX idx_shipping_status_order ON ifood_shipping_status(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_shipping_status_external ON ifood_shipping_status(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_shipping_status_updated ON ifood_shipping_status(updated_at DESC);
CREATE INDEX idx_shipping_status_active ON ifood_shipping_status(merchant_id, status) 
    WHERE status NOT IN ('DELIVERED', 'CONCLUDED', 'CANCELLED');

-- Event processing
CREATE INDEX idx_shipping_events_unprocessed ON ifood_shipping_events(merchant_id, processed_at) 
    WHERE processed_at IS NULL;

-- Address change management
CREATE INDEX idx_address_changes_pending ON ifood_address_changes(merchant_id, responded_at) 
    WHERE responded_at IS NULL;

-- Safe delivery monitoring
CREATE INDEX idx_safe_delivery_recent ON ifood_safe_delivery(merchant_id, created_at DESC);

-- ==================== Triggers for Updated Timestamps ====================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_shipping_status_updated_at BEFORE UPDATE ON ifood_shipping_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_safe_delivery_updated_at BEFORE UPDATE ON ifood_safe_delivery
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_persons_updated_at BEFORE UPDATE ON ifood_delivery_persons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== Views for Common Queries ====================

-- Active shipments view
CREATE VIEW active_shipments AS
SELECT 
    ss.*,
    dp.name as delivery_person_name,
    dp.phone as delivery_person_phone,
    dp.vehicle_type,
    sd.score as safe_delivery_score,
    sd.risk_level
FROM ifood_shipping_status ss
LEFT JOIN ifood_delivery_persons dp ON 
    ss.merchant_id = dp.merchant_id AND 
    (ss.order_id = dp.order_id OR ss.external_id = dp.external_id)
LEFT JOIN ifood_safe_delivery sd ON 
    ss.merchant_id = sd.merchant_id AND 
    (ss.order_id = sd.order_id OR ss.external_id = sd.external_id)
WHERE ss.status NOT IN ('DELIVERED', 'CONCLUDED', 'CANCELLED');

-- Pending address changes view
CREATE VIEW pending_address_changes AS
SELECT 
    ac.*,
    ss.status as current_shipping_status
FROM ifood_address_changes ac
JOIN ifood_shipping_status ss ON 
    ac.merchant_id = ss.merchant_id AND 
    (ac.order_id = ss.order_id OR ac.external_id = ss.external_id)
WHERE ac.responded_at IS NULL 
    AND ac.timeout_at > NOW();

-- ==================== Sample Data for Testing (Optional) ====================
-- Uncomment below to insert sample data for testing

-- INSERT INTO ifood_shipping_status (merchant_id, order_id, status, estimated_delivery_time)
-- VALUES 
--     ('test-merchant-1', 'ORDER-001', 'PREPARING', NOW() + INTERVAL '30 minutes'),
--     ('test-merchant-1', 'ORDER-002', 'DISPATCHED', NOW() + INTERVAL '15 minutes');

-- INSERT INTO ifood_shipping_events (event_id, merchant_id, order_id, event_code, event_message)
-- VALUES 
--     ('EVENT-001', 'test-merchant-1', 'ORDER-001', 'ORDER_CONFIRMED', 'Order confirmed by restaurant'),
--     ('EVENT-002', 'test-merchant-1', 'ORDER-002', 'RIDER_ASSIGNED', 'Delivery person assigned');

-- ==================== Permissions ====================
-- Grant appropriate permissions to your application user
-- Replace 'your_app_user' with your actual database user

-- GRANT ALL ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO your_app_user;