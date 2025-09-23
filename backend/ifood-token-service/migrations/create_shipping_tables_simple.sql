-- Tabela simplificada para active_shipments
CREATE TABLE IF NOT EXISTS active_shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id TEXT NOT NULL,
    order_id TEXT,
    external_id TEXT,
    status TEXT NOT NULL,
    sub_status TEXT,
    estimated_delivery_time TIMESTAMP,
    tracking_url TEXT,
    delivery_person_name TEXT,
    delivery_person_phone TEXT,
    vehicle_type TEXT,
    safe_delivery_score INTEGER,
    risk_level TEXT,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabela simplificada para pending_address_changes
CREATE TABLE IF NOT EXISTS pending_address_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE,
    merchant_id TEXT NOT NULL,
    order_id TEXT,
    external_id TEXT,
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
    change_reason TEXT NOT NULL,
    customer_note TEXT,
    current_shipping_status TEXT,
    responded_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    timeout_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes')
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_active_shipments_merchant ON active_shipments(merchant_id);
CREATE INDEX IF NOT EXISTS idx_active_shipments_status ON active_shipments(status);
CREATE INDEX IF NOT EXISTS idx_pending_changes_merchant ON pending_address_changes(merchant_id);
CREATE INDEX IF NOT EXISTS idx_pending_changes_timeout ON pending_address_changes(timeout_at) WHERE responded_at IS NULL;