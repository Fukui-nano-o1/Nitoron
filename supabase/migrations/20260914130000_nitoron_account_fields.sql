-- Account page fields.
-- Public (nitoron_profiles, readable by anyone): role, main crops, owned machines.
-- Private (settings, owner-only RLS): legal name, phone, address. Never copied into publications.
alter table public.nitoron_profiles
  add column if not exists role text not null default '' check (length(role) <= 40),
  add column if not exists crops text not null default '' check (length(crops) <= 200),
  add column if not exists machines jsonb not null default '[]'::jsonb
    check (jsonb_typeof(machines) = 'array' and jsonb_array_length(machines) <= 30 and octet_length(machines::text) <= 8000);

alter table public.settings
  add column if not exists full_name text not null default '' check (length(full_name) <= 80),
  add column if not exists phone text not null default '' check (length(phone) <= 40),
  add column if not exists address text not null default '' check (length(address) <= 200);
