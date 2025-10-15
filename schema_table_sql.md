create table public.complement_groups (
  id uuid not null default gen_random_uuid (),
  group_compl_id text not null,
  name character varying(255) not null,
  status character varying(50) not null,
  option_group_type character varying(50) not null,
  option_ids uuid[] null,
  product_ids uuid[] null,
  min_selection integer null default 0,
  max_selection integer null default 1,
  display_order integer null default 0,
  merchant_id text null,
  constraint complement_groups_pkey primary key (id),
  constraint complement_groups_group_compl_id_key unique (group_compl_id),
  constraint complement_groups_min_max_check check (
    (
      (min_selection >= 0)
      and (max_selection >= min_selection)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_complement_groups_product_ids on public.complement_groups using gin (product_ids) TABLESPACE pg_default;

create index IF not exists idx_complement_groups_merchant_id on public.complement_groups using btree (merchant_id) TABLESPACE pg_default;

create trigger update_complement_groups_updated_at BEFORE
update on complement_groups for EACH row
execute FUNCTION update_updated_at_column ();

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
  option_ids text[] null,
  original_price numeric(10, 2) null,
  constraint products_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_products_ifood_category_id on public.products using btree (ifood_category_id) TABLESPACE pg_default;

create trigger update_products_updated_at BEFORE
update on products for EACH row
execute FUNCTION update_updated_at_column ();

create table public.ifood_categories (
  id uuid not null default gen_random_uuid (),
  category_id character varying not null,
  ifood_category_id character varying null,
  merchant_id character varying not null,
  catalog_id character varying not null,
  user_id character varying not null,
  name character varying not null,
  external_code character varying null,
  status character varying not null default 'AVAILABLE'::character varying,
  index integer null default 0,
  template character varying not null default 'DEFAULT'::character varying,
  sequence_number integer null default 0,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint ifood_categories_pkey primary key (id),
  constraint ifood_categories_category_id_key unique (category_id),
  constraint ifood_categories_ifood_category_id_merchant_id_key unique (ifood_category_id, merchant_id)
) TABLESPACE pg_default;

create index IF not exists idx_ifood_categories_merchant_id on public.ifood_categories using btree (merchant_id) TABLESPACE pg_default;

create index IF not exists idx_ifood_categories_user_id on public.ifood_categories using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_ifood_categories_catalog_id on public.ifood_categories using btree (catalog_id) TABLESPACE pg_default;

create index IF not exists idx_ifood_categories_ifood_id on public.ifood_categories using btree (ifood_category_id) TABLESPACE pg_default;

create table public.ifood_complements (
  id uuid not null default gen_random_uuid (),
  option_id text null,
  name text null,
  context_price numeric(10, 2) null,
  description text null,
  status text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  merchant_id text null,
  "imagePath" text null,
  product_id text null,
  options_id text[] null,
  options_product_id text null,
  complement_group_ids uuid[] null,
  display_order integer null default 0,
  constraint ifood_complements_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_ifood_complements_complement_group_ids on public.ifood_complements using gin (complement_group_ids) TABLESPACE pg_default;

create index IF not exists idx_ifood_complements_option_id on public.ifood_complements using btree (option_id) TABLESPACE pg_default;

create index IF not exists idx_ifood_complements_status on public.ifood_complements using btree (status) TABLESPACE pg_default;

create trigger update_ifood_complements_updated_at BEFORE
update on ifood_complements for EACH row
execute FUNCTION update_updated_at_column ();

create table public.ifood_merchants (
  id uuid not null default gen_random_uuid (),
  merchant_id text not null,
  name text not null,
  corporate_name text null,
  description text null,
  type text[] null,
  phone text null,
  address_street text null,
  address_number text null,
  address_complement text null,
  address_neighborhood text null,
  address_city text null,
  address_state text null,
  "postalCode" text null,
  address_country text null,
  operating_hours jsonb null,
  user_id uuid null,
  client_id uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  last_sync_at timestamp with time zone null default now(),
  status boolean not null default false,
  latitude numeric null,
  longitude numeric null,
  catalog_id character varying(255) null,
  catalog_synced_at timestamp without time zone null,
  categories_synced_at timestamp without time zone null,
  sync_status character varying(50) null default 'pending'::character varying,
  constraint ifood_merchants_pkey primary key (id),
  constraint ifood_merchants_merchant_id_key unique (merchant_id),
  constraint unique_merchant_per_user unique (merchant_id, user_id),
  constraint ifood_merchants_client_id_fkey foreign KEY (client_id) references clients (id) on delete CASCADE,
  constraint ifood_merchants_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_ifood_merchants_user_id on public.ifood_merchants using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_ifood_merchants_client_id on public.ifood_merchants using btree (client_id) TABLESPACE pg_default;

create index IF not exists idx_ifood_merchants_merchant_id on public.ifood_merchants using btree (merchant_id) TABLESPACE pg_default;

create index IF not exists idx_ifood_merchants_status on public.ifood_merchants using btree (status) TABLESPACE pg_default;

create index IF not exists idx_merchants_sync_status on public.ifood_merchants using btree (sync_status) TABLESPACE pg_default;

create trigger trigger_update_ifood_merchants_updated_at BEFORE
update on ifood_merchants for EACH row
execute FUNCTION update_ifood_merchants_updated_at ();na ve