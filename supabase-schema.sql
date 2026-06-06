-- Run this in your Supabase SQL editor to create the required tables

create extension if not exists "pgcrypto";

create table if not exists competitors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sail_no text not null,
  class text not null check (class in ('ILCA 4','ILCA 6','ILCA 7')),
  created_at timestamptz default now()
);

create table if not exists races (
  id uuid primary key default gen_random_uuid(),
  race_number int not null,
  race_date date not null,
  start_time time not null,
  seq_minutes int not null default 3,
  created_at timestamptz default now()
);

create table if not exists race_results (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references races(id) on delete cascade,
  competitor_id uuid not null references competitors(id) on delete cascade,
  position int,
  elapsed_seconds int,
  dnf boolean not null default false,
  created_at timestamptz default now()
);

-- Enable RLS (Row Level Security) — allow all for anon key (adjust for production)
alter table competitors enable row level security;
alter table races enable row level security;
alter table race_results enable row level security;

create policy "allow_all_competitors" on competitors for all using (true) with check (true);
create policy "allow_all_races" on races for all using (true) with check (true);
create policy "allow_all_race_results" on race_results for all using (true) with check (true);
