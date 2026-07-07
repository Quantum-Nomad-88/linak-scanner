-- Secure setup for LINAK test setup uploads
-- 1. Storage → New bucket → name: test-setup-records → keep PRIVATE (do not make public)
-- 2. Replace YOUR_TEAM_ACCESS_CODE below with a long random string (20+ chars)
-- 3. Enter the same team code in the app → Cloud storage → Team access code

create schema if not exists private;

create table if not exists private.team_config (
  id int primary key default 1 check (id = 1),
  access_code text not null
);

insert into private.team_config (access_code)
values ('YOUR_TEAM_ACCESS_CODE')
on conflict (id) do update set access_code = excluded.access_code;

revoke all on schema private from public, anon, authenticated;
revoke all on private.team_config from public, anon, authenticated;

create or replace function public.check_team_access(code text)
returns boolean
language sql
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from private.team_config
    where access_code is not null
      and access_code <> ''
      and access_code = code
  );
$$;

revoke all on function public.check_team_access(text) from public;
grant execute on function public.check_team_access(text) to anon, authenticated;

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
drop policy if exists "team_select" on setup_records;
drop policy if exists "team_insert" on setup_records;

create policy "team_select" on setup_records
  for select
  using (
    public.check_team_access(
      coalesce(current_setting('request.headers', true)::json->>'x-team-access', '')
    )
  );

create policy "team_insert" on setup_records
  for insert
  with check (
    public.check_team_access(
      coalesce(current_setting('request.headers', true)::json->>'x-team-access', '')
    )
  );

drop policy if exists "public_read" on storage.objects;
drop policy if exists "anon_upload" on storage.objects;
drop policy if exists "anon_update" on storage.objects;
drop policy if exists "team_read_storage" on storage.objects;
drop policy if exists "team_upload_storage" on storage.objects;

create policy "team_read_storage" on storage.objects
  for select
  using (
    bucket_id = 'test-setup-records'
    and public.check_team_access(
      coalesce(current_setting('request.headers', true)::json->>'x-team-access', '')
    )
  );

create policy "team_upload_storage" on storage.objects
  for insert
  with check (
    bucket_id = 'test-setup-records'
    and public.check_team_access(
      coalesce(current_setting('request.headers', true)::json->>'x-team-access', '')
    )
  );
