-- Run this in your Supabase SQL editor

-- Employees table
create table employees (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text unique not null,
  password text not null,
  designation text default 'employee',
  created_at timestamptz default now()
);

-- Work entries table
create table work_entries (
  id uuid default gen_random_uuid() primary key,
  employee_email text not null,
  employee_name text not null,
  date date not null,
  category text not null,
  business_area text not null,
  report_name text default '',
  etl_job_name text default '',
  task_details text not null,
  time_taken numeric not null,
  status text check (status in ('Complete', 'WIP')) not null,
  goals text not null,
  comment text default '',
  created_at timestamptz default now()
);

-- Indexes for fast queries
create index idx_work_entries_email on work_entries(employee_email);
create index idx_work_entries_date on work_entries(date);

-- Disable RLS for internal tool (enable if you want row-level security)
alter table employees disable row level security;
alter table work_entries disable row level security;

-- Seed employees
insert into employees (name, email, password, designation) values
  ('Aalia Dandawala',  'aalia_dandawala@welspun.com',  'password123', 'employee'),
  ('Sundari Maurya',   'sundari_maurya@welspun.com',   'password123', 'employee'),
  ('Shravan Jadhav',   'shravan_jadhav@welspun.com',   'password123', 'employee'),
  ('Sharad Yadav',     'sharad_yadav1@welspun.com',    'password123', 'employee'),
  ('Sanjeev Singh',    'sanjeev_singh@welspun.com',    'password123', 'employee'),
  ('Riya Agarwal',     'riya_agarwal@welspun.com',     'password123', 'employee'),
  ('Rajesh Mishra',    'rajesh_mishra@welspun.com',    'password123', 'employee'),
  ('Deepika Dalvi',    'deepika_dalvi@welspun.com',    'password123', 'employee'),
  ('Hemil Shah',       'hemil_shah@welspun.com',       'password123', 'employee'),
  ('Manish Korgaonkar','manish_korgaonkar@welspun.com','password123', 'cdo');

-- NOTE: Replace 'password123' with actual passwords before running
