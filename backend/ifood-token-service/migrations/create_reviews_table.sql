-- ==========================================
-- iFood Reviews Database Schema
-- ==========================================
-- Creates tables for storing iFood customer reviews and merchant responses
-- Author: System
-- Date: 2025-09-04
-- ==========================================

-- Drop existing tables if needed (be careful in production!)
-- DROP TABLE IF EXISTS ifood_review_replies CASCADE;
-- DROP TABLE IF EXISTS ifood_reviews CASCADE;

-- ==========================================
-- Main Reviews Table
-- ==========================================
CREATE TABLE IF NOT EXISTS ifood_reviews (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL,
    review_id VARCHAR(255) UNIQUE NOT NULL, -- iFood review ID
    order_id VARCHAR(255),
    order_short_id VARCHAR(50),
    
    -- Review content
    customer_comment TEXT,
    score DECIMAL(2,1) CHECK (score >= 1.0 AND score <= 5.0),
    
    -- Review status flags
    published BOOLEAN DEFAULT true,
    discarded BOOLEAN DEFAULT false,
    moderated BOOLEAN DEFAULT false,
    
    -- Survey information
    survey_id UUID,
    questionnaire_data JSONB, -- Stores questions and answers
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL, -- iFood creation time
    order_created_at TIMESTAMP,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Merchant reply (denormalized for performance)
    has_reply BOOLEAN DEFAULT false,
    reply_text TEXT,
    reply_created_at TIMESTAMP,
    replied_by UUID,
    
    -- Analytics fields
    sentiment_score DECIMAL(3,2), -- -1.00 to 1.00
    category_tags TEXT[], -- ['food_quality', 'delivery', 'packaging']
    requires_attention BOOLEAN DEFAULT false,
    
    -- Foreign key constraints
    CONSTRAINT fk_merchant 
        FOREIGN KEY (merchant_id) 
        REFERENCES ifood_merchants(id) 
        ON DELETE CASCADE,
    
    -- Indexes for performance
    CONSTRAINT unique_merchant_review 
        UNIQUE(merchant_id, review_id)
);

-- ==========================================
-- Create Indexes
-- ==========================================

-- Performance indexes
CREATE INDEX idx_reviews_merchant_created 
    ON ifood_reviews(merchant_id, created_at DESC);

CREATE INDEX idx_reviews_rating 
    ON ifood_reviews(score);

CREATE INDEX idx_reviews_published 
    ON ifood_reviews(published) 
    WHERE published = true;

CREATE INDEX idx_reviews_requires_attention 
    ON ifood_reviews(requires_attention) 
    WHERE requires_attention = true;

CREATE INDEX idx_reviews_has_reply 
    ON ifood_reviews(has_reply);

CREATE INDEX idx_reviews_created_at 
    ON ifood_reviews(created_at DESC);

-- Full text search index for comments
CREATE INDEX idx_reviews_comment_search 
    ON ifood_reviews 
    USING gin(to_tsvector('portuguese', customer_comment));

-- ==========================================
-- Review Replies Table (for audit trail)
-- ==========================================
CREATE TABLE IF NOT EXISTS ifood_review_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id VARCHAR(255) NOT NULL,
    merchant_id UUID NOT NULL,
    reply_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    ifood_response JSONB, -- Store iFood API response
    status VARCHAR(50) DEFAULT 'sent', -- sent, failed, pending
    
    CONSTRAINT fk_review_reply 
        FOREIGN KEY (review_id) 
        REFERENCES ifood_reviews(review_id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_merchant_reply 
        FOREIGN KEY (merchant_id) 
        REFERENCES ifood_merchants(id) 
        ON DELETE CASCADE
);

CREATE INDEX idx_replies_review_id 
    ON ifood_review_replies(review_id);

CREATE INDEX idx_replies_merchant_id 
    ON ifood_review_replies(merchant_id);

-- ==========================================
-- Review Summary Statistics Table
-- ==========================================
CREATE TABLE IF NOT EXISTS ifood_review_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL UNIQUE,
    total_reviews_count INTEGER DEFAULT 0,
    valid_reviews_count INTEGER DEFAULT 0,
    average_score DECIMAL(2,1),
    
    -- Rating distribution
    rating_1_count INTEGER DEFAULT 0,
    rating_2_count INTEGER DEFAULT 0,
    rating_3_count INTEGER DEFAULT 0,
    rating_4_count INTEGER DEFAULT 0,
    rating_5_count INTEGER DEFAULT 0,
    
    -- Response metrics
    total_with_comments INTEGER DEFAULT 0,
    total_with_replies INTEGER DEFAULT 0,
    response_rate DECIMAL(5,2), -- Percentage
    avg_response_time_hours DECIMAL(6,2),
    
    -- Time periods
    last_review_date TIMESTAMP,
    last_sync_date TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_merchant_summary 
        FOREIGN KEY (merchant_id) 
        REFERENCES ifood_merchants(id) 
        ON DELETE CASCADE
);

CREATE INDEX idx_summary_merchant_id 
    ON ifood_review_summary(merchant_id);

-- ==========================================
-- Create Update Trigger for updated_at
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ifood_reviews_updated_at 
    BEFORE UPDATE ON ifood_reviews 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ifood_review_summary_updated_at 
    BEFORE UPDATE ON ifood_review_summary 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- Helper Functions
-- ==========================================

-- Function to update review summary statistics
CREATE OR REPLACE FUNCTION update_review_summary(p_merchant_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO ifood_review_summary (
        merchant_id,
        total_reviews_count,
        valid_reviews_count,
        average_score,
        rating_1_count,
        rating_2_count,
        rating_3_count,
        rating_4_count,
        rating_5_count,
        total_with_comments,
        total_with_replies,
        response_rate,
        last_review_date,
        last_sync_date
    )
    SELECT 
        p_merchant_id,
        COUNT(*),
        COUNT(*) FILTER (WHERE published = true),
        AVG(score)::DECIMAL(2,1),
        COUNT(*) FILTER (WHERE FLOOR(score) = 1),
        COUNT(*) FILTER (WHERE FLOOR(score) = 2),
        COUNT(*) FILTER (WHERE FLOOR(score) = 3),
        COUNT(*) FILTER (WHERE FLOOR(score) = 4),
        COUNT(*) FILTER (WHERE FLOOR(score) = 5),
        COUNT(*) FILTER (WHERE customer_comment IS NOT NULL),
        COUNT(*) FILTER (WHERE has_reply = true),
        CASE 
            WHEN COUNT(*) FILTER (WHERE customer_comment IS NOT NULL) > 0 THEN
                (COUNT(*) FILTER (WHERE has_reply = true)::DECIMAL / 
                 COUNT(*) FILTER (WHERE customer_comment IS NOT NULL)) * 100
            ELSE 0
        END,
        MAX(created_at),
        CURRENT_TIMESTAMP
    FROM ifood_reviews
    WHERE merchant_id = p_merchant_id
    ON CONFLICT (merchant_id) DO UPDATE SET
        total_reviews_count = EXCLUDED.total_reviews_count,
        valid_reviews_count = EXCLUDED.valid_reviews_count,
        average_score = EXCLUDED.average_score,
        rating_1_count = EXCLUDED.rating_1_count,
        rating_2_count = EXCLUDED.rating_2_count,
        rating_3_count = EXCLUDED.rating_3_count,
        rating_4_count = EXCLUDED.rating_4_count,
        rating_5_count = EXCLUDED.rating_5_count,
        total_with_comments = EXCLUDED.total_with_comments,
        total_with_replies = EXCLUDED.total_with_replies,
        response_rate = EXCLUDED.response_rate,
        last_review_date = EXCLUDED.last_review_date,
        last_sync_date = EXCLUDED.last_sync_date,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- Sample Data (for testing only)
-- ==========================================
-- INSERT INTO ifood_reviews (merchant_id, review_id, order_id, customer_comment, score, created_at)
-- VALUES 
-- ('577cb3b1-5845-4fbc-a219-8cd3939cb9ea', 'test-review-001', 'order-001', 'Comida excelente!', 5.0, NOW()),
-- ('577cb3b1-5845-4fbc-a219-8cd3939cb9ea', 'test-review-002', 'order-002', 'Demorou muito', 2.0, NOW());

-- ==========================================
-- Permissions
-- ==========================================
-- Grant appropriate permissions to your application user
-- GRANT ALL ON ifood_reviews TO your_app_user;
-- GRANT ALL ON ifood_review_replies TO your_app_user;
-- GRANT ALL ON ifood_review_summary TO your_app_user;

-- ==========================================
-- Maintenance Views
-- ==========================================

-- View for reviews needing attention
CREATE OR REPLACE VIEW v_reviews_need_attention AS
SELECT 
    r.id,
    r.merchant_id,
    r.review_id,
    r.customer_comment,
    r.score,
    r.created_at,
    r.has_reply,
    m.name as merchant_name
FROM ifood_reviews r
JOIN ifood_merchants m ON r.merchant_id = m.id
WHERE r.published = true
    AND r.customer_comment IS NOT NULL
    AND r.has_reply = false
    AND r.score <= 3
ORDER BY r.created_at DESC;

-- View for review analytics
CREATE OR REPLACE VIEW v_review_analytics AS
SELECT 
    merchant_id,
    DATE(created_at) as review_date,
    COUNT(*) as total_reviews,
    AVG(score) as avg_score,
    COUNT(*) FILTER (WHERE score >= 4) as positive_reviews,
    COUNT(*) FILTER (WHERE score <= 2) as negative_reviews,
    COUNT(*) FILTER (WHERE has_reply = true) as replied_reviews
FROM ifood_reviews
WHERE published = true
GROUP BY merchant_id, DATE(created_at)
ORDER BY review_date DESC;

-- ==========================================
-- End of Schema
-- ========================================== 