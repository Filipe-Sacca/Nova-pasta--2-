-- Fix column sizes for ifood_orders table
-- First we need to drop the view that depends on these columns

-- Step 1: Drop the view
DROP VIEW IF EXISTS v_orders_status_dashboard CASCADE;

-- Step 2: Alter the column types
ALTER TABLE ifood_orders 
ALTER COLUMN ifood_order_id TYPE VARCHAR(255),
ALTER COLUMN merchant_id TYPE VARCHAR(255),
ALTER COLUMN customer_name TYPE VARCHAR(255),
ALTER COLUMN customer_phone TYPE VARCHAR(100),
ALTER COLUMN payment_method TYPE VARCHAR(100);

-- Step 3: Add items column if it doesn't exist
ALTER TABLE ifood_orders 
ADD COLUMN IF NOT EXISTS items JSONB;

-- Step 4: Recreate the view (adjust this based on your actual view definition)
CREATE OR REPLACE VIEW v_orders_status_dashboard AS
SELECT 
    id,
    ifood_order_id,
    merchant_id,
    user_id,
    status,
    customer_name,
    customer_phone,
    total_amount,
    delivery_fee,
    payment_method,
    created_at,
    updated_at,
    confirmed_at,
    delivered_at,
    cancelled_at,
    cancellation_reason,
    cancelled_by
FROM ifood_orders
ORDER BY created_at DESC;

-- Success message
SELECT 'Columns and view updated successfully!' as status;