CREATE TABLE complement_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Usa UUID para o ID principal, gera automaticamente
    group_compl_id UUID UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    option_group_type VARCHAR(50) NOT NULL,
    option_ids UUID[] -- Coluna para armazenar um array de UUIDs
);