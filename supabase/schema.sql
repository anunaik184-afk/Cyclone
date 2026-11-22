-- CycloneSafe Supabase PostgreSQL Schema & Row Level Security (RLS)
-- Run this script in your Supabase Project SQL Editor:
-- https://qpjmzqpomsitvdaxjgou.supabase.co

-- Enable pgcrypto for gen_random_uuid()
create extension if not exists "pgcrypto";

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can delete own profile" on public.profiles;
create policy "Users can delete own profile"
  on public.profiles for delete
  using (auth.uid() = id);

-- 2. FAMILY MEMBERS TABLE
create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  relationship text not null,
  phone text not null,
  blood_group text default '',
  medical_notes text default '',
  safety_status text not null default 'Unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.family_members enable row level security;

drop policy if exists "Users can select own family members" on public.family_members;
create policy "Users can select own family members"
  on public.family_members for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own family members" on public.family_members;
create policy "Users can insert own family members"
  on public.family_members for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own family members" on public.family_members;
create policy "Users can update own family members"
  on public.family_members for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own family members" on public.family_members;
create policy "Users can delete own family members"
  on public.family_members for delete
  using (auth.uid() = user_id);

-- 3. EMERGENCY CONTACTS TABLE
create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  relationship text not null,
  phone text not null,
  email text default '',
  priority integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.emergency_contacts enable row level security;

drop policy if exists "Users can select own emergency contacts" on public.emergency_contacts;
create policy "Users can select own emergency contacts"
  on public.emergency_contacts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own emergency contacts" on public.emergency_contacts;
create policy "Users can insert own emergency contacts"
  on public.emergency_contacts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own emergency contacts" on public.emergency_contacts;
create policy "Users can update own emergency contacts"
  on public.emergency_contacts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own emergency contacts" on public.emergency_contacts;
create policy "Users can delete own emergency contacts"
  on public.emergency_contacts for delete
  using (auth.uid() = user_id);

-- 4. SOS ALERTS TABLE
create table if not exists public.sos_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  alert_type text not null,
  alert_message text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

alter table public.sos_alerts enable row level security;

drop policy if exists "Users can select own sos alerts" on public.sos_alerts;
create policy "Users can select own sos alerts"
  on public.sos_alerts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own sos alerts" on public.sos_alerts;
create policy "Users can insert own sos alerts"
  on public.sos_alerts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own sos alerts" on public.sos_alerts;
create policy "Users can update own sos alerts"
  on public.sos_alerts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own sos alerts" on public.sos_alerts;
create policy "Users can delete own sos alerts"
  on public.sos_alerts for delete
  using (auth.uid() = user_id);

-- 5. DISASTER REPORTS TABLE
create table if not exists public.disaster_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  description text not null,
  latitude double precision not null,
  longitude double precision not null,
  location_label text default '',
  image_url text default '',
  status text not null default 'SUBMITTED',
  created_at timestamptz not null default now()
);

alter table public.disaster_reports enable row level security;

drop policy if exists "Users can select own disaster reports" on public.disaster_reports;
create policy "Users can select own disaster reports"
  on public.disaster_reports for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own disaster reports" on public.disaster_reports;
create policy "Users can insert own disaster reports"
  on public.disaster_reports for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own disaster reports" on public.disaster_reports;
create policy "Users can update own disaster reports"
  on public.disaster_reports for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own disaster reports" on public.disaster_reports;
create policy "Users can delete own disaster reports"
  on public.disaster_reports for delete
  using (auth.uid() = user_id);

-- 6. USER SETTINGS TABLE
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  region_mode text not null default 'IN',
  weather_unit text not null default 'celsius',
  sos_auto_share_location boolean not null default true,
  alert_notifications_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "Users can select own settings" on public.user_settings;
create policy "Users can select own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own settings" on public.user_settings;
create policy "Users can insert own settings"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own settings" on public.user_settings;
create policy "Users can update own settings"
  on public.user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own settings" on public.user_settings;
create policy "Users can delete own settings"
  on public.user_settings for delete
  using (auth.uid() = user_id);

-- 7. STORAGE BUCKET FOR DISASTER REPORT IMAGES
insert into storage.buckets (id, name, public)
values ('disaster-images', 'disaster-images', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can upload disaster images" on storage.objects;
create policy "Authenticated users can upload disaster images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'disaster-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update own disaster images" on storage.objects;
create policy "Users can update own disaster images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'disaster-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own disaster images" on storage.objects;
create policy "Users can delete own disaster images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'disaster-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Public read access for disaster images" on storage.objects;
create policy "Public read access for disaster images"
  on storage.objects for select
  using (bucket_id = 'disaster-images');
