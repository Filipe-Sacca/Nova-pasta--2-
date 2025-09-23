-- Fix column sizes for ifood_orders table
-- Problem: "value too long for type character varying(50)"

-- Increase size of string columns that might be too small
ALTER TABLE ifood_orders 
ALTER COLUMN ifood_order_id TYPE VARCHAR(255),
ALTER COLUMN merchant_id TYPE VARCHAR(255),
ALTER COLUMN customer_name TYPE VARCHAR(255),
ALTER COLUMN customer_phone TYPE VARCHAR(100),
ALTER COLUMN payment_method TYPE VARCHAR(100);

-- If customer_address exists as a column, increase its size
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'ifood_orders' 
               AND column_name = 'customer_address') THEN
        ALTER TABLE ifood_orders ALTER COLUMN customer_address TYPE TEXT;
    END IF;
END $$;

-- Add items column if it doesn't exist (for storing items array)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ifood_orders' 
                   AND column_name = 'items') THEN
        ALTER TABLE ifood_orders ADD COLUMN items JSONB;
    END IF;
END $$;

-- Success message
SELECT 'Column sizes updated successfully!' as status;