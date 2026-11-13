-- Trocken-Quest: gemeinsamer Speicher (Supabase / Postgres)
-- Einmal im Supabase-Dashboard unter «SQL Editor» einfügen und «Run» drücken.
-- Das Skript darf mehrmals laufen (es überschreibt nur Funktionen und Regeln, keine Daten).
--
-- Prinzip
--   * Jedes Gerät meldet sich anonym an (kein Passwort, keine E-Mail).
--   * Mit einem Familien-Code tritt das Gerät der Familie bei:
--       Kinder-Code  -> Rolle «kind»   (darf Einträge machen, keine Einstellungen ändern)
--       Eltern-Code  -> Rolle «eltern» (darf alles)
--   * In der Datenbank steht nur der Heldenname, kein echter Name.

-- ---------- Tabellen ----------
create table if not exists public.families (
  id          uuid primary key default gen_random_uuid(),
  kid_code    text not null unique,
  parent_code text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists public.members (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  family_id  uuid not null references public.families (id) on delete cascade,
  role       text not null check (role in ('kind', 'eltern')),
  device     text,                       -- «kind», «mama», «papa»
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  family_id  uuid primary key references public.families (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.prefs (
  family_id  uuid primary key references public.families (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id         uuid primary key,
  family_id  uuid not null references public.families (id) on delete cascade,
  user_id    uuid not null default auth.uid(),
  day        date not null,
  ts         timestamptz not null,
  type       text not null,
  body       jsonb not null default '{}'::jsonb,   -- questId, dry, item, rewardId, text, res, n, recipe, meta
  by         text,
  created_at timestamptz not null default now()
);
alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check
  check (type in ('quest', 'night', 'build', 'reward', 'training', 'note', 'collect', 'craft', 'attack'));
create index if not exists events_family_day on public.events (family_id, day);

-- ---------- Hilfsfunktionen ----------
create or replace function public.my_family() returns uuid
language sql stable security definer set search_path = public as $$
  select family_id from public.members where user_id = auth.uid()
$$;

create or replace function public.is_parent() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and role = 'eltern')
$$;

-- Zufälliger Code, 10 Zeichen ohne verwechselbare Zeichen (kein 0/O, 1/I), z. B. «K7QM-2XRP-HD»
create or replace function public.new_code() returns text
language plpgsql volatile set search_path = public as $$
declare
  abc constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  raw bytea := decode(md5(gen_random_uuid()::text || clock_timestamp()::text), 'hex');
  c text := '';
begin
  for i in 0..9 loop
    c := c || substr(abc, (get_byte(raw, i) % 32) + 1, 1);
  end loop;
  return substr(c, 1, 4) || '-' || substr(c, 5, 4) || '-' || substr(c, 9, 2);
end $$;

-- Erste Einrichtung durch einen Elternteil: legt die Familie an und gibt beide Codes zurück
create or replace function public.create_family(device text default null)
returns table (family_id uuid, kid_code text, parent_code text)
language plpgsql security definer set search_path = public as $$
declare f public.families;
begin
  if auth.uid() is null then raise exception 'nicht angemeldet'; end if;
  if exists (select 1 from public.members m where m.user_id = auth.uid()) then
    raise exception 'Dieses Gerät gehört schon zu einer Familie';
  end if;
  insert into public.families (kid_code, parent_code) values (public.new_code(), public.new_code())
  returning * into f;
  insert into public.members (user_id, family_id, role, device) values (auth.uid(), f.id, 'eltern', device);
  return query select f.id, f.kid_code, f.parent_code;
end $$;

-- Weitere Geräte treten mit einem Code bei (Gross/Klein, Leerzeichen und Striche egal)
create or replace function public.join_family(code text, device text default null)
returns table (family_id uuid, role text)
language plpgsql security definer set search_path = public as $$
declare f public.families; r text; c text;
begin
  if auth.uid() is null then raise exception 'nicht angemeldet'; end if;
  c := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  if length(c) < 8 then raise exception 'Code unbekannt'; end if;
  perform pg_sleep(0.5);   -- bremst Ausprobieren
  select * into f from public.families where replace(parent_code, '-', '') = c;
  if found then r := 'eltern';
  else
    select * into f from public.families where replace(kid_code, '-', '') = c;
    if found then r := 'kind'; else raise exception 'Code unbekannt'; end if;
  end if;
  insert into public.members (user_id, family_id, role, device) values (auth.uid(), f.id, r, device)
  on conflict (user_id) do update set family_id = excluded.family_id, role = excluded.role, device = excluded.device;
  return query select f.id, r;
end $$;

-- Wer bin ich? (Familie und Rolle dieses Geräts)
create or replace function public.whoami()
returns table (family_id uuid, role text, device text)
language sql stable security definer set search_path = public as $$
  select m.family_id, m.role, m.device from public.members m where m.user_id = auth.uid()
$$;

-- ---------- Rechte ----------
revoke all on function public.new_code() from public, anon, authenticated;
revoke all on function public.create_family(text) from public, anon;
revoke all on function public.join_family(text, text) from public, anon;
revoke all on function public.whoami() from public, anon;
grant execute on function public.create_family(text) to authenticated;
grant execute on function public.join_family(text, text) to authenticated;
grant execute on function public.whoami() to authenticated;

revoke all on public.families, public.members, public.settings, public.prefs, public.events from anon;
grant select on public.families to authenticated;
grant select, delete on public.members to authenticated;
grant select, insert, update on public.settings to authenticated;
grant select, insert, update on public.prefs to authenticated;
grant select, insert, delete on public.events to authenticated;

-- ---------- Zugriffsregeln (Row Level Security) ----------
alter table public.families enable row level security;
alter table public.members  enable row level security;
alter table public.settings enable row level security;
alter table public.prefs    enable row level security;
alter table public.events   enable row level security;

drop policy if exists fam_read on public.families;
drop policy if exists mem_read on public.members;
drop policy if exists mem_delete on public.members;
drop policy if exists set_read on public.settings;
drop policy if exists set_write on public.settings;
drop policy if exists set_upd on public.settings;
drop policy if exists prefs_read on public.prefs;
drop policy if exists prefs_write on public.prefs;
drop policy if exists prefs_upd on public.prefs;
drop policy if exists ev_read on public.events;
drop policy if exists ev_insert on public.events;
drop policy if exists ev_delete on public.events;

-- Familien: Eltern sehen ihre Codes, Kinder nicht
create policy fam_read on public.families for select to authenticated using (id = public.my_family() and public.is_parent());

-- Mitglieder: Eltern sehen alle Geräte der Familie, jedes Gerät sich selbst
create policy mem_read on public.members for select to authenticated using (user_id = auth.uid() or (family_id = public.my_family() and public.is_parent()));
create policy mem_delete on public.members for delete to authenticated using (family_id = public.my_family() and public.is_parent());

-- Einstellungen: alle lesen, nur Eltern schreiben
create policy set_read  on public.settings for select to authenticated using (family_id = public.my_family());
create policy set_write on public.settings for insert to authenticated with check (family_id = public.my_family() and public.is_parent());
create policy set_upd   on public.settings for update to authenticated using (family_id = public.my_family() and public.is_parent());

-- Vorlieben (Lieblingsübungen, Inselzeit, Einführung gesehen): alle der Familie
create policy prefs_read  on public.prefs for select to authenticated using (family_id = public.my_family());
create policy prefs_write on public.prefs for insert to authenticated with check (family_id = public.my_family());
create policy prefs_upd   on public.prefs for update to authenticated using (family_id = public.my_family());

-- Tagebuch: alle lesen; Kind schreibt Quests, Nächte, Bauen, Training, Sammeln, Herstellen, Boss-Schläge;
-- Belohnungen und Notizen nur Eltern
create policy ev_read on public.events for select to authenticated using (family_id = public.my_family());
create policy ev_insert on public.events for insert to authenticated with check (
  family_id = public.my_family() and user_id = auth.uid()
  and (public.is_parent() or type in ('quest', 'night', 'build', 'training', 'collect', 'craft', 'attack'))
);
-- Löschen: Eltern alles; Kind nur eigene Einträge der letzten 10 Minuten («Rückgängig»)
create policy ev_delete on public.events for delete to authenticated using (
  family_id = public.my_family()
  and (public.is_parent() or (user_id = auth.uid() and created_at > now() - interval '10 minutes'))
);
