-- ============================================================================
-- Couple Journal – Datenbank für den Sync einrichten
-- Einmal komplett im Supabase SQL-Editor ausführen (SQL Editor → New query →
-- alles einfügen → Run). Das Skript kann gefahrlos mehrfach ausgeführt werden.
-- ============================================================================

-- 1) Mitglieder: Nur Konten in dieser Tabelle dürfen Daten lesen und schreiben.
create table if not exists public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.members enable row level security;
drop policy if exists "members: eigene Zeile lesen" on public.members;
create policy "members: eigene Zeile lesen" on public.members
  for select to authenticated using (user_id = auth.uid());

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.members where user_id = auth.uid());
$$;

-- 2) Alle Einträge der App (Erlebnisse, Fotos, Meilensteine, Wünsche, Briefe, Einstellungen)
create table if not exists public.items (
  id uuid primary key,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  created_by text,
  created_at timestamptz,
  client_updated_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid default auth.uid()
);
create index if not exists items_updated_idx on public.items (updated_at, id);

-- Der Server setzt den Zeitstempel selbst – so spielen falsch gehende Handy-Uhren keine Rolle.
create or replace function public.items_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  return new;
end;
$$;
drop trigger if exists items_touch on public.items;
create trigger items_touch
  before insert or update on public.items
  for each row execute function public.items_touch();

alter table public.items enable row level security;
drop policy if exists "items: nur Mitglieder" on public.items;
create policy "items: nur Mitglieder" on public.items
  for all to authenticated
  using (public.is_member())
  with check (public.is_member());

-- 3) Live-Updates (Realtime), damit neue Einträge sofort beim Partner erscheinen
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items'
  ) then
    alter publication supabase_realtime add table public.items;
  end if;
end;
$$;

-- 4) Privater Speicher für Fotos
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "photos: lesen" on storage.objects;
create policy "photos: lesen" on storage.objects
  for select to authenticated using (bucket_id = 'photos' and public.is_member());

drop policy if exists "photos: hochladen" on storage.objects;
create policy "photos: hochladen" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos' and public.is_member());

drop policy if exists "photos: ersetzen" on storage.objects;
create policy "photos: ersetzen" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and public.is_member())
  with check (bucket_id = 'photos' and public.is_member());

drop policy if exists "photos: löschen" on storage.objects;
create policy "photos: löschen" on storage.objects
  for delete to authenticated using (bucket_id = 'photos' and public.is_member());

-- 5) Eure beiden Konten freischalten.
--    Erst unter Authentication → Users beide Konten anlegen ("Add user"),
--    dann diese Zeile (noch einmal) ausführen:
insert into public.members (user_id)
select id from auth.users
on conflict do nothing;

-- Kontrolle: Hier sollten genau eure zwei E-Mail-Adressen stehen.
select u.email, m.created_at as freigeschaltet_seit
from public.members m join auth.users u on u.id = m.user_id;
