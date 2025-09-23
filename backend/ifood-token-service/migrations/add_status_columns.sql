-- Add columns for status change tracking
ALTER TABLE ifood_orders 
ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS status_updated_by TEXT,
ADD COLUMN IF NOT EXISTS previousStatus TEXT;