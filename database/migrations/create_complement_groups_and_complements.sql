-- Tabela: complement_groups
CREATE TABLE complement_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complement_groupes_id UUID,
    
    min_selection INTEGER DEFAULT 0,
    max_selection INTEGER DEFAULT 1,
    group_type TEXT DEFAULT 'INGREDIENTS',
    status TEXT DEFAULT 'AVAILABLE',
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: complements
CREATE TABLE complements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complement_group_id UUID NOT NULL REFERENCES complement_groups(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price DECIMAL(10, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'AVAILABLE',
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(complement_group_id, product_id)
);
