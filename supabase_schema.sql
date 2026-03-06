-- Create a table to store monthly sheets for each teacher/class
create table monthly_sheets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  month int not null,
  year int not null,
  class_name text,
  teacher_name text,
  school_name text,
  location text,
  students jsonb default '[]'::jsonb,
  standard_meals jsonb default '{"S": 14, "T1": 14, "T2": 12}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, month, year)
);

-- Enable Row Level Security (RLS)
alter table monthly_sheets enable row level security;

-- Create a policy that allows users to select only their own sheets
create policy "Users can select their own sheets"
  on monthly_sheets for select
  using (auth.uid() = user_id);

-- Create a policy that allows users to insert their own sheets
create policy "Users can insert their own sheets"
  on monthly_sheets for insert
  with check (auth.uid() = user_id);

-- Create a policy that allows users to update their own sheets
create policy "Users can update their own sheets"
  on monthly_sheets for update
  using (auth.uid() = user_id);

-- Create a policy that allows users to delete their own sheets
create policy "Users can delete their own sheets"
  on monthly_sheets for delete
  using (auth.uid() = user_id);

-- Create a table for global app settings (like login background image)
create table if not exists app_settings (
  setting_key text primary key,
  setting_value text not null,
  updated_at timestamptz default now()
);

-- Disable RLS for app_settings so anyone (even on login page before authenticating) can read/update it
alter table app_settings disable row level security;

-- Create a function to automatically set the phone column in auth.users from user_metadata
create or replace function public.sync_phone_from_metadata()
returns trigger as $$
begin
  if new.raw_user_meta_data->>'phone' is not null then
    new.phone = new.raw_user_meta_data->>'phone';
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Create a trigger to call the function before insert or update
drop trigger if exists sync_phone_on_auth_user on auth.users;
create trigger sync_phone_on_auth_user
  before insert or update on auth.users
  for each row execute procedure public.sync_phone_from_metadata();

-- ==========================================
-- LICENSE KEY SYSTEM
-- ==========================================

-- Create license_keys table
create table if not exists public.license_keys (
  id uuid default gen_random_uuid() primary key,
  key text not null unique,
  is_used boolean default false,
  used_by uuid,
  used_by_email text,
  created_at timestamptz default now(),
  used_at timestamptz
);

-- RLS for license_keys
alter table public.license_keys enable row level security;

-- Admins can manage license keys (replace with your actual admin email)
create policy "Admins can manage license keys"
  on public.license_keys
  for all
  using (auth.jwt() ->> 'email' = 'vuhung@db.edu.vn');

-- Users can view their own license key
create policy "Users can view their own license key"
  on public.license_keys
  for select
  using (auth.uid() = used_by);

-- Function to validate license key during signup
create or replace function public.check_license_key_before_signup()
returns trigger as $$
declare
  valid_key boolean;
begin
  -- Check if license_key is provided in metadata
  if new.raw_user_meta_data->>'license_key' is null or new.raw_user_meta_data->>'license_key' = '' then
    raise exception 'Mã bản quyền là bắt buộc để đăng ký tài khoản.';
  end if;

  -- Check if the key exists and is not used
  select exists(
    select 1 from public.license_keys
    where key = new.raw_user_meta_data->>'license_key'
    and is_used = false
  ) into valid_key;

  if not valid_key then
    raise exception 'Mã bản quyền không hợp lệ hoặc đã được sử dụng.';
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Trigger before insert on auth.users to check license key
drop trigger if exists check_license_key_on_signup on auth.users;
create trigger check_license_key_on_signup
  before insert on auth.users
  for each row execute procedure public.check_license_key_before_signup();

-- Function to mark license key as used after signup
create or replace function public.mark_license_key_as_used()
returns trigger as $$
begin
  update public.license_keys
  set is_used = true,
      used_by = new.id,
      used_by_email = new.email,
      used_at = now()
  where key = new.raw_user_meta_data->>'license_key';
  
  return new;
end;
$$ language plpgsql security definer;

-- Trigger after insert on auth.users to mark key as used
drop trigger if exists mark_license_key_used_on_signup on auth.users;
create trigger mark_license_key_used_on_signup
  after insert on auth.users
  for each row execute procedure public.mark_license_key_as_used();
