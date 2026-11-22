-- CycloneSafe / DISASTRON Complete Idempotent Supabase PostgreSQL Migration
-- Target Supabase Project: https://qpjmzqpomsitvdaxjgou.supabase.co
-- Run this entire script in Supabase Dashboard -> SQL Editor.

create extension if not exists "pgcrypto";

-- =====================================================================
-- 0. REUSABLE TRIGGER FUNCTION FOR AUTOMATIC updated_at TIMESTAMPS
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- 1. PROFILES TABLE
-- =====================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can delete own profile" on public.profiles;
create policy "Users can delete own profile"
  on public.profiles for delete
  to authenticated
  using (auth.uid() = id);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 2. MODULE 1: FAMILY MEMBERS TABLE (public.family_members)
-- =====================================================================
create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  relationship text not null,
  phone text not null,
  blood_group text default '',
  status text not null default 'Safe',
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'family_members' and column_name = 'safety_status'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'family_members' and column_name = 'status'
  ) then
    alter table public.family_members rename column safety_status to status;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'family_members' and column_name = 'medical_notes'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'family_members' and column_name = 'notes'
  ) then
    alter table public.family_members rename column medical_notes to notes;
  end if;
end $$;

alter table public.family_members add column if not exists blood_group text default '';
alter table public.family_members add column if not exists status text not null default 'Safe';
alter table public.family_members add column if not exists notes text default '';
alter table public.family_members add column if not exists created_at timestamptz not null default now();
alter table public.family_members add column if not exists updated_at timestamptz not null default now();

alter table public.family_members enable row level security;

drop policy if exists "Users can select own family members" on public.family_members;
create policy "Users can select own family members"
  on public.family_members for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own family members" on public.family_members;
create policy "Users can insert own family members"
  on public.family_members for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own family members" on public.family_members;
create policy "Users can update own family members"
  on public.family_members for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own family members" on public.family_members;
create policy "Users can delete own family members"
  on public.family_members for delete
  to authenticated
  using (auth.uid() = user_id);

drop trigger if exists trg_family_members_updated_at on public.family_members;
create trigger trg_family_members_updated_at
  before update on public.family_members
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 3. MODULE 2: EMERGENCY CONTACTS TABLE (public.emergency_contacts)
-- =====================================================================
create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_name text not null,
  relationship text not null,
  phone text not null,
  email text default '',
  priority integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'emergency_contacts' and column_name = 'name'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'emergency_contacts' and column_name = 'contact_name'
  ) then
    alter table public.emergency_contacts rename column name to contact_name;
  end if;
end $$;

alter table public.emergency_contacts add column if not exists contact_name text not null default '';
alter table public.emergency_contacts add column if not exists relationship text not null default '';
alter table public.emergency_contacts add column if not exists phone text not null default '';
alter table public.emergency_contacts add column if not exists email text default '';
alter table public.emergency_contacts add column if not exists priority integer not null default 1;
alter table public.emergency_contacts add column if not exists created_at timestamptz not null default now();
alter table public.emergency_contacts add column if not exists updated_at timestamptz not null default now();

alter table public.emergency_contacts enable row level security;

drop policy if exists "Users can select own emergency contacts" on public.emergency_contacts;
create policy "Users can select own emergency contacts"
  on public.emergency_contacts for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own emergency contacts" on public.emergency_contacts;
create policy "Users can insert own emergency contacts"
  on public.emergency_contacts for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own emergency contacts" on public.emergency_contacts;
create policy "Users can update own emergency contacts"
  on public.emergency_contacts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own emergency contacts" on public.emergency_contacts;
create policy "Users can delete own emergency contacts"
  on public.emergency_contacts for delete
  to authenticated
  using (auth.uid() = user_id);

drop trigger if exists trg_emergency_contacts_updated_at on public.emergency_contacts;
create trigger trg_emergency_contacts_updated_at
  before update on public.emergency_contacts
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 4. MODULE 3: DISASTER REPORTS TABLE (public.disaster_reports)
-- =====================================================================
create table if not exists public.disaster_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  disaster_category text not null,
  locality text default '',
  description text not null,
  latitude double precision not null,
  longitude double precision not null,
  incident_photo_url text default '',
  incident_photo_path text default '',
  status text not null default 'SUBMITTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'disaster_reports' and column_name = 'category'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'disaster_reports' and column_name = 'disaster_category'
  ) then
    alter table public.disaster_reports rename column category to disaster_category;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'disaster_reports' and column_name = 'location_label'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'disaster_reports' and column_name = 'locality'
  ) then
    alter table public.disaster_reports rename column location_label to locality;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'disaster_reports' and column_name = 'image_url'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'disaster_reports' and column_name = 'incident_photo_url'
  ) then
    alter table public.disaster_reports rename column image_url to incident_photo_url;
  end if;
end $$;

alter table public.disaster_reports add column if not exists disaster_category text not null default 'Other';
alter table public.disaster_reports add column if not exists locality text default '';
alter table public.disaster_reports add column if not exists incident_photo_url text default '';
alter table public.disaster_reports add column if not exists incident_photo_path text default '';
alter table public.disaster_reports add column if not exists status text not null default 'SUBMITTED';
alter table public.disaster_reports add column if not exists created_at timestamptz not null default now();
alter table public.disaster_reports add column if not exists updated_at timestamptz not null default now();

alter table public.disaster_reports enable row level security;

drop policy if exists "Users can select own disaster reports" on public.disaster_reports;
create policy "Users can select own disaster reports"
  on public.disaster_reports for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own disaster reports" on public.disaster_reports;
create policy "Users can insert own disaster reports"
  on public.disaster_reports for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own disaster reports" on public.disaster_reports;
create policy "Users can update own disaster reports"
  on public.disaster_reports for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own disaster reports" on public.disaster_reports;
create policy "Users can delete own disaster reports"
  on public.disaster_reports for delete
  to authenticated
  using (auth.uid() = user_id);

drop trigger if exists trg_disaster_reports_updated_at on public.disaster_reports;
create trigger trg_disaster_reports_updated_at
  before update on public.disaster_reports
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 5. MODULE 4: SOS ALERTS TABLE (public.sos_alerts)
-- =====================================================================
create table if not exists public.sos_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  emergency_type text not null,
  emergency_details text not null,
  latitude double precision not null,
  longitude double precision not null,
  location text default '',
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sos_alerts' and column_name = 'alert_type'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sos_alerts' and column_name = 'emergency_type'
  ) then
    alter table public.sos_alerts rename column alert_type to emergency_type;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sos_alerts' and column_name = 'alert_message'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sos_alerts' and column_name = 'emergency_details'
  ) then
    alter table public.sos_alerts rename column alert_message to emergency_details;
  end if;
end $$;

alter table public.sos_alerts add column if not exists emergency_type text not null default 'Medical Emergency';
alter table public.sos_alerts add column if not exists emergency_details text not null default '';
alter table public.sos_alerts add column if not exists location text default '';
alter table public.sos_alerts add column if not exists status text not null default 'ACTIVE';
alter table public.sos_alerts add column if not exists created_at timestamptz not null default now();
alter table public.sos_alerts add column if not exists updated_at timestamptz not null default now();

alter table public.sos_alerts enable row level security;

drop policy if exists "Users can select own sos alerts" on public.sos_alerts;
create policy "Users can select own sos alerts"
  on public.sos_alerts for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own sos alerts" on public.sos_alerts;
create policy "Users can insert own sos alerts"
  on public.sos_alerts for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own sos alerts" on public.sos_alerts;
create policy "Users can update own sos alerts"
  on public.sos_alerts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own sos alerts" on public.sos_alerts;
create policy "Users can delete own sos alerts"
  on public.sos_alerts for delete
  to authenticated
  using (auth.uid() = user_id);

drop trigger if exists trg_sos_alerts_updated_at on public.sos_alerts;
create trigger trg_sos_alerts_updated_at
  before update on public.sos_alerts
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 6. USER SETTINGS TABLE (public.user_settings)
-- =====================================================================
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  region_mode text not null default 'IN',
  weather_unit text not null default 'celsius',
  sos_auto_share_location boolean not null default true,
  alert_notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings add column if not exists created_at timestamptz not null default now();
alter table public.user_settings add column if not exists updated_at timestamptz not null default now();

alter table public.user_settings enable row level security;

drop policy if exists "Users can select own settings" on public.user_settings;
create policy "Users can select own settings"
  on public.user_settings for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own settings" on public.user_settings;
create policy "Users can insert own settings"
  on public.user_settings for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own settings" on public.user_settings;
create policy "Users can update own settings"
  on public.user_settings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own settings" on public.user_settings;
create policy "Users can delete own settings"
  on public.user_settings for delete
  to authenticated
  using (auth.uid() = user_id);

drop trigger if exists trg_user_settings_updated_at on public.user_settings;
create trigger trg_user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 7. MODULE 5: STORAGE BUCKET (disaster-reports) & STORAGE RLS POLICIES
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('disaster-reports', 'disaster-reports', false)
on conflict (id) do update set public = false;

drop policy if exists "Authenticated users can upload disaster report photos" on storage.objects;
create policy "Authenticated users can upload disaster report photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'disaster-reports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Authenticated users can view own disaster report photos" on storage.objects;
create policy "Authenticated users can view own disaster report photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'disaster-reports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Authenticated users can update own disaster report photos" on storage.objects;
create policy "Authenticated users can update own disaster report photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'disaster-reports'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'disaster-reports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Authenticated users can delete own disaster report photos" on storage.objects;
create policy "Authenticated users can delete own disaster report photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'disaster-reports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================================
-- 8. MODULE 6 & 9: SCHEMA/TABLE PRIVILEGES & POSTGREST SCHEMA RELOAD
-- =====================================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.family_members to authenticated;
grant select, insert, update, delete on table public.emergency_contacts to authenticated;
grant select, insert, update, delete on table public.disaster_reports to authenticated;
grant select, insert, update, delete on table public.sos_alerts to authenticated;
grant select, insert, update, delete on table public.user_settings to authenticated;

notify pgrst, 'reload schema';
