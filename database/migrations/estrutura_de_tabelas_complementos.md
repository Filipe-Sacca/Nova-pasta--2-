PRODUCTS

create table public.products (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  item_id text null,
  name text not null,
  category text null,
  price numeric(10, 2) null,
  description text null,
  is_active text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  merchant_id text null,
  "imagePath" text null,
  product_id text null,
  ifood_category_id character varying null,
  ifood_category_name character varying null,
  constraint products_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_products_ifood_category_id on public.products using btree (ifood_category_id) TABLESPACE pg_default;

GRUPO DE COMPLEMENTOS

create table public.complement_groups (
  id uuid not null default gen_random_uuid (),
  group_compl_id uuid not null,
  name character varying(255) not null,
  status character varying(50) not null,
  option_group_type character varying(50) not null,
  option_ids uuid[] null,
  product_id uuid null,
  constraint complement_groups_pkey primary key (id),
  constraint complement_groups_group_compl_id_key unique (group_compl_id)
) TABLESPACE pg_default;

COMPLEMENTOS

create table public.ifood_complements (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  item_id text null,
  name text not null,
  category text null,
  price numeric(10, 2) null,
  description text null,
  is_active text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  merchant_id text null,
  "imagePath" text null,
  product_id text null,
  ifood_category_id character varying null,
  ifood_category_name character varying null,
  constraint ifood_complements_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists ifood_complements_ifood_category_id_idx on public.ifood_complements using btree (ifood_category_id) TABLESPACE pg_default;