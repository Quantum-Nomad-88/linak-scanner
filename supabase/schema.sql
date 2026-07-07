-- Run once in Supabase → SQL Editor
-- Also create Storage bucket "test-setup-records" (Public bucket) in the dashboard first.

create table if not exists setup_records (
  id text primary key,
  product_type text,
  test_type text,
  testing_started_at text,
  file_path text,
  created_at timestamptz default now()
);

alter table setup_records enable row level security;

drop policy if exists "anon_all" on setup_records;
create policy "anon_all" on setup_records
  for all using (true) with check (true);

drop policy if exists "public_read" on storage.objects;
create policy "public_read" on storage.objects
  for select using (bucket_id = 'test-setup-records');

drop policy if exists "anon_upload" on storage.objects;
create policy "anon_upload" on storage.objects
  for insert with check (bucket_id = 'test-setup-records');

drop policy if exists "anon_update" on storage.objects;
create policy "anon_update" on storage.objects
  for update using (bucket_id = 'test-setup-records');
