-- Shelfwatch schema for Supabase / Postgres.
-- Mirrors the documents kept in the Shelfwatch page database (items with nested products,
-- retailers, prices, fx rates). Prices are append-only: a new observation is a new row.

create table if not exists countries (
  code text primary key,
  name text not null,
  currency text not null
);
-- sample rows: replace with your own countries
insert into countries (code, name, currency) values
  ('US','United States','USD'), ('GB','United Kingdom','GBP'), ('JP','Japan','JPY')
on conflict (code) do nothing;

create table if not exists retailers (
  id text primary key,
  name text not null,
  country text not null references countries(code),
  kind text not null default 'unknown' check (kind in ('online','offline','both','unknown')),
  url text,
  note text,
  starter boolean not null default false,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists items (
  id text primary key,
  name text not null,
  category text,
  base_unit text not null check (base_unit in ('kg','l','pc')),
  status text not null default 'active' check (status in ('active','not_needed','replaced')),
  replaced_by text,
  note text,
  priority text check (priority in ('daily','regular','occasional')),
  health text check (health in ('core','ok','limit')),
  sort int,                          -- manual order inside the category
  created_at timestamptz,
  updated_at timestamptz,
  sort_updated_at timestamptz
);

create table if not exists products (
  id text primary key,
  item_id text not null references items(id) on delete cascade,
  name text not null,
  brand text,
  tier text,
  usage text,
  size numeric,
  size_unit text check (size_unit in ('g','kg','ml','l','pc')),
  buy_in text[],
  note text
);

create table if not exists fx_rates (
  date date not null,
  currency text not null,
  per_eur numeric not null,          -- units of currency per 1 EUR
  source text,
  primary key (date, currency)
);

create table if not exists prices (
  id text primary key,
  item_id text not null references items(id),
  product_id text not null references products(id),
  retailer_id text not null references retailers(id),
  country text not null references countries(code),
  currency text not null,
  amount numeric,                    -- pack price as sold, native currency
  size numeric,
  size_unit text,
  unit_price numeric,                -- native currency per base unit (kg, l or pc)
  base_unit text not null,
  promo text,
  promo_until date,                  -- last day of a temporary promo
  regular_unit_price numeric,        -- normal shelf price per unit, native currency
  requires_program text,             -- programs.id when a card or app is needed
  flag text,                         -- something to verify
  origin text not null default 'user' check (origin in ('user','auto')),  -- user = entered or imported by you, auto = researched by Claude
  research_note text,                -- why an auto search found nothing
  updated_at timestamptz,
  checked_at timestamptz,
  placeholder boolean not null default false,  -- source known, price still missing
  observed_at date not null,
  date_precision text,               -- 'year' when the exact date is unknown
  source_type text not null check (source_type in ('import','research','photo','manual')),
  source_url text,
  source_note text,
  photo_asset text,                  -- id of the stored photo; move the file to Supabase Storage
  fx_per_eur numeric,                -- native units per EUR on the observation day (null for EUR)
  eur_amount numeric,
  eur_unit_price numeric,
  created_at timestamptz not null default now()
);
create table if not exists knowledge (
  id text primary key,
  title text not null,
  body text,
  sort_order int,
  updated date,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists programs (
  id text primary key,
  name text not null,
  country text references countries(code),
  status text check (status in ('verified','partial','unverified')),
  cost text,
  benefit text,
  how text,
  expiry text,
  source_url text,
  verified_at date,
  note text,
  retailers text[],
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists nutrition (
  product_id text primary key references products(id) on delete cascade,
  basis text,                        -- 'per 100 g' or 'per cup'
  scope text,                        -- generic_reference | label | press_release | estimate
  form text,
  source_name text,
  source_url text,
  retrieved_at timestamptz,
  note text,
  vals jsonb                         -- energy_kcal, protein_g, fat_g, sat_fat_g, carbs_g, sugars_g, fibre_g, salt_g, vitamins and minerals
);

create index if not exists prices_lookup on prices (product_id, retailer_id, observed_at desc);
create index if not exists prices_item_country on prices (item_id, country);

create table if not exists price_checks (
  id text primary key,
  scope text,
  item_id text,
  product_id text,
  retailer_id text,
  country text,
  status text default 'queued',
  note text,
  requested_at timestamptz,
  finished_at timestamptz
);

-- Latest real observation per product and retailer.
create or replace view current_prices as
select distinct on (product_id, retailer_id) *
from prices
where not placeholder
order by product_id, retailer_id, observed_at desc, created_at desc;

-- Ranking per item and country by EUR unit price at observation.
create or replace view price_ranking as
select cp.*, rank() over (partition by item_id, country order by eur_unit_price) as rank_in_country
from current_prices cp
where eur_unit_price is not null;

-- Change history: each observation next to the one before it for the same product and retailer.
create or replace view price_changes as
select p.*,
       lag(unit_price) over w as prev_unit_price,
       lag(observed_at) over w as prev_observed_at,
       case when lag(unit_price) over w > 0
            then (unit_price - lag(unit_price) over w) / lag(unit_price) over w end as change_ratio
from prices p
where not placeholder and unit_price is not null
window w as (partition by product_id, retailer_id order by observed_at, created_at);

create table if not exists source_register (
  id text primary key,
  name text not null,
  country text,                      -- a country code from the countries table, or ALL
  type text,                         -- retailer | aggregator | government | api | flyer | app | community | crowd | nutrition | photo
  url text,
  access text,                       -- fetch | api_key | paid_actor | photo | blocked | manual
  status text,                       -- works | partial | untested | blocked | down | not_useful
  scores jsonb,                      -- coverage, reliability, freshness, ease, cost (1-5)
  score int,                         -- 0-100 weighted
  confidence text,                   -- tested | reported | untested
  price_scope text,
  update_freq text,
  has_ean boolean, has_unit_price boolean, has_promo_dates boolean,
  needs_membership boolean, needs_key boolean,
  note text, evidence_url text,
  last_tested date,
  created_at timestamptz, updated_at timestamptz
);
