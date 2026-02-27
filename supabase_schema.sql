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
