-- QRLink production database
create extension if not exists pgcrypto;

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  bio text default '' check (char_length(bio) <= 180),
  email text default '',
  phone text default '',
  links jsonb not null default '[]'::jsonb,
  photo_url text default '',
  created_at timestamptz not null default now()
);

alter table public.cards enable row level security;

-- Public cards are intentionally readable because the card itself is public.
drop policy if exists "Public can read cards" on public.cards;
create policy "Public can read cards" on public.cards for select to anon, authenticated using (true);

-- Prototype creation policy. Before a large public launch, add Supabase Auth and
-- rate limiting / abuse controls and change this to per-user policies.
drop policy if exists "Anyone can create cards" on public.cards;
create policy "Anyone can create cards" on public.cards for insert to anon, authenticated with check (true);

insert into storage.buckets (id,name,public)
values ('profile-photos','profile-photos',true)
on conflict (id) do update set public=true;

drop policy if exists "Public can view profile photos" on storage.objects;
create policy "Public can view profile photos" on storage.objects for select to anon, authenticated using (bucket_id='profile-photos');

drop policy if exists "Anyone can upload profile photos" on storage.objects;
create policy "Anyone can upload profile photos" on storage.objects for insert to anon, authenticated with check (bucket_id='profile-photos');
