-- =====================================================================
--  🟢 GIMS ASSIGNMENT PORTAL — "SAB KUCH ZERO SE" (ALL-IN-ONE)
--  ---------------------------------------------------------------------
--  KAHAN CHALANI HAI:
--     Supabase Dashboard -> SQL Editor -> + New query -> poora paste -> RUN
--
--  YE FILE KYA KARTI HAI:
--     1. purana sab kuch saaf karta hai (tables + purane app users)
--     2. saari tables, security (RLS), storage buckets banata hai
--     3. admin login banata hai:  admin@gims / admin123
--     4. aakhir me VERIFY result dikhata hai (sab green hona chahiye)
--
--  WARNING: ye file purana data DELETE karti hai. Sirf shuru me chalao.
--  Tip: chalane ke baad neeche "Results" me verification row zaroor dekho.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- =====================================================================
-- 0. CLEAN SLATE
-- =====================================================================
drop trigger if exists on_auth_user_created on auth.users;

-- trg_mark_late ka drop safe tareeqe se (naye project me table hoti hi nahi)
do $drop$
begin
  if to_regclass('public.submissions') is not null then
    drop trigger if exists trg_mark_late on public.submissions;
  end if;
end $drop$;

drop table if exists public.attendance_records cascade;
drop table if exists public.attendance_sessions cascade;
drop table if exists public.timetable cascade;
drop table if exists public.submissions cascade;
drop table if exists public.assignments cascade;
drop table if exists public.course_teachers cascade;
drop table if exists public.subject_teachers cascade;
drop table if exists public.subjects cascade;
drop table if exists public.courses cascade;
drop table if exists public.classes cascade;
drop table if exists public.user_credentials cascade;
drop table if exists public.settings cascade;
drop table if exists public.profiles cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.mark_late() cascade;
drop function if exists public.my_role() cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.my_class_id() cascade;
drop function if exists public.resolve_login(text) cascade;
drop function if exists public.set_my_password(text) cascade;
drop function if exists public.ensure_admin(text,text) cascade;
drop function if exists public.ensure_admin(text,text,text) cascade;
drop function if exists public.admin_upsert_user(text,text,text,text,text,uuid,text,text,uuid) cascade;
drop function if exists public.admin_set_password(uuid,text) cascade;
drop function if exists public.admin_delete_user(uuid) cascade;
drop function if exists public._check_password(text,text) cascade;

-- purane app ke auth users bhi saaf karo (agar delete na ho to chalta rahega)
do $outer$
declare v_n integer := 0;
begin
  delete from auth.identities
   where user_id in (select id from auth.users where lower(email) like '%@gims.internal');
  delete from auth.users where lower(email) like '%@gims.internal';
  get diagnostics v_n = row_count;
  raise notice '✅ purane app-users delete: %', v_n;
exception when others then
  raise notice '⚠️ purane auth users delete nahi ho sake (% ) — reuse karenge', sqlerrm;
end $outer$;

-- =====================================================================
-- 1. TABLES
-- =====================================================================
create table public.classes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       text not null unique,
  sections   text[] not null default array['A'],
  session    text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null unique,
  email      text,
  role       text not null default 'student' check (role in ('admin','teacher','student')),
  full_name  text,
  roll_no    text,
  class_id   uuid references public.classes(id) on delete set null,
  section    text,
  phone      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_credentials (
  user_id       uuid primary key references public.profiles(id) on delete cascade,
  password_text text,
  updated_at    timestamptz not null default now()
);

-- MASTER subject catalogue (ek hi baar add karo: "Programming Fundamentals")
create table public.courses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       text,
  semester   text,
  color      text default '#0f9d58',
  created_at timestamptz not null default now()
);
create unique index courses_name_uniq on public.courses (lower(name));

-- kisi class ko diya gaya subject (offering)
create table public.subjects (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes(id) on delete cascade,
  course_id  uuid references public.courses(id) on delete set null,
  name       text not null,
  code       text,
  teacher_id uuid references public.profiles(id) on delete set null,  -- lead teacher (compat)
  sections   text[],                                                  -- null = saare sections
  semester   text,
  color      text default '#0f9d58',
  created_at timestamptz not null default now()
);

-- MASTER subject ke teachers (teacher add karte waqt yahan se subjects chunte hain)
create table public.course_teachers (
  course_id  uuid not null references public.courses(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (course_id, teacher_id)
);

-- ek subject ke KAI teachers
create table public.subject_teachers (
  subject_id uuid not null references public.subjects(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  is_lead    boolean not null default false,
  added_at   timestamptz not null default now(),
  primary key (subject_id, teacher_id)
);

create table public.assignments (
  id           uuid primary key default gen_random_uuid(),
  subject_id   uuid not null references public.subjects(id) on delete cascade,
  title        text not null,
  description  text,
  deadline     timestamptz not null,
  max_marks    integer default 10,
  allow_late   boolean not null default true,
  file_path    text,
  file_name    text,
  is_published boolean not null default true,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table public.submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id    uuid not null references public.profiles(id) on delete cascade,
  file_path     text,
  file_name     text,
  file_size     bigint,
  note          text,
  submitted_at  timestamptz not null default now(),
  is_late       boolean not null default false,
  status        text not null default 'pending' check (status in ('pending','accepted','rejected')),
  marks         numeric,
  feedback      text,
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  unique (assignment_id, student_id)
);

create table public.attendance_sessions (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid references public.classes(id) on delete cascade,
  section    text,
  subject_id uuid references public.subjects(id) on delete set null,
  date       date not null,
  image_path text,
  ocr_text   text,
  total      integer default 0,
  present    integer default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.attendance_records (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'absent' check (status in ('present','absent','late','leave')),
  unique (session_id, student_id)
);

create table public.timetable (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes(id) on delete cascade,
  section    text not null default 'A',
  day        integer not null check (day between 1 and 6),
  slot       integer not null check (slot between 1 and 8),
  start_time text,
  end_time   text,
  subject_id uuid references public.subjects(id) on delete set null,
  label      text,
  room       text,
  created_at timestamptz not null default now(),
  unique (class_id, section, day, slot)
);

create table public.settings (
  key   text primary key,
  value jsonb not null
);

-- =====================================================================
-- 2. INDEXES
-- =====================================================================
create index idx_profiles_role   on public.profiles(role);
create index idx_profiles_class  on public.profiles(class_id, section);
create index idx_profiles_roll   on public.profiles(roll_no);
create index idx_subjects_class  on public.subjects(class_id);
create index idx_assign_subject  on public.assignments(subject_id);
create index idx_assign_deadline on public.assignments(deadline);
create index idx_sub_assignment  on public.submissions(assignment_id);
create index idx_sub_student     on public.submissions(student_id);
create index idx_att_class_date  on public.attendance_sessions(class_id, date);
create index idx_tt_class        on public.timetable(class_id, section);

-- =====================================================================
-- 3. HELPER FUNCTIONS
-- =====================================================================
create or replace function public.my_role()
returns text language sql stable security definer set search_path = public
as $fn$ select role from public.profiles where id = auth.uid() $fn$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $fn$ select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false) $fn$;

create or replace function public.my_class_id()
returns uuid language sql stable security definer set search_path = public
as $fn$ select class_id from public.profiles where id = auth.uid() $fn$;

-- login id / roll number  ->  andarooni auth email
create or replace function public.resolve_login(p_identifier text)
returns text language sql stable security definer set search_path = public
as $fn$
  select p.email
  from public.profiles p
  where lower(p.username) = lower(trim(p_identifier))
     or p.roll_no = trim(p_identifier)
  limit 1
$fn$;

grant execute on function public.resolve_login(text) to anon, authenticated;

-- user apna password khud badle to admin panel me bhi update ho
create or replace function public.set_my_password(p_password text)
returns void language plpgsql security definer set search_path = public
as $fn$
begin
  if auth.uid() is null then
    raise exception 'not logged in';
  end if;
  insert into public.user_credentials (user_id, password_text, updated_at)
  values (auth.uid(), p_password, now())
  on conflict (user_id) do update
     set password_text = excluded.password_text, updated_at = now();
end;
$fn$;

grant execute on function public.set_my_password(text) to authenticated;

-- kya ye teacher is subject ka teacher hai? (multiple teachers support)
create or replace function public.is_subject_teacher(p_subject uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (select 1 from public.subject_teachers st where st.subject_id = p_subject and st.teacher_id = auth.uid())
      or exists (select 1 from public.subjects s where s.id = p_subject and s.teacher_id = auth.uid());
$fn$;
grant execute on function public.is_subject_teacher(uuid) to authenticated;

-- =====================================================================
-- 4. AUTO PROFILE (trigger) — agar profile fail ho to auth user KABHI na ruke
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $fn$
begin
  begin
    insert into public.profiles (id, username, email, role, full_name)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(new.email,'@',1)),
      new.email,
      coalesce(nullif(new.raw_user_meta_data->>'role',''), 'student'),
      coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1))
    )
    on conflict (id) do nothing;
  exception when others then
    raise notice 'profile auto-create skip: %', sqlerrm;
  end;

  return new;
end;
$fn$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =====================================================================
-- 5. LATE FLAG — deadline DB me check hoti hai (client se bypass nahi)
-- =====================================================================
create or replace function public.mark_late()
returns trigger language plpgsql security definer set search_path = public
as $fn$
declare
  v_deadline timestamptz;
begin
  select deadline into v_deadline from public.assignments where id = new.assignment_id;
  new.is_late := coalesce(new.submitted_at, now()) > v_deadline;
  return new;
end;
$fn$;

create trigger trg_mark_late
before insert or update on public.submissions
for each row execute function public.mark_late();

-- =====================================================================
-- 6. ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles            enable row level security;
alter table public.user_credentials    enable row level security;
alter table public.classes             enable row level security;
alter table public.subjects            enable row level security;
alter table public.assignments         enable row level security;
alter table public.submissions         enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records  enable row level security;
alter table public.timetable           enable row level security;
alter table public.settings            enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.my_role() in ('admin','teacher'));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (public.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy profiles_delete on public.profiles for delete to authenticated
  using (public.is_admin());

create policy cred_all on public.user_credentials for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy classes_select on public.classes for select to authenticated using (true);
create policy classes_write  on public.classes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy subjects_select on public.subjects for select to authenticated using (true);
create policy subjects_write  on public.subjects for all to authenticated
  using (public.is_admin() or public.is_subject_teacher(id))
  with check (public.is_admin() or public.is_subject_teacher(id));

create policy assignments_select on public.assignments for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.subjects s
      where s.id = assignments.subject_id
        and (public.is_subject_teacher(s.id) or s.class_id = public.my_class_id())
    )
  );
create policy assignments_write on public.assignments for all to authenticated
  using (
    public.is_admin()
    or public.is_subject_teacher(assignments.subject_id)
  )
  with check (
    public.is_admin()
    or public.is_subject_teacher(assignments.subject_id)
  );

create policy submissions_select on public.submissions for select to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.assignments a
      join public.subjects s on s.id = a.subject_id
      where a.id = submissions.assignment_id and public.is_subject_teacher(a.subject_id)
    )
  );
create policy submissions_insert on public.submissions for insert to authenticated
  with check (student_id = auth.uid());
create policy submissions_update on public.submissions for update to authenticated
  using (
    public.is_admin()
    or (student_id = auth.uid() and status in ('pending','rejected'))
    or exists (
      select 1 from public.assignments a
      join public.subjects s on s.id = a.subject_id
      where a.id = submissions.assignment_id and public.is_subject_teacher(a.subject_id)
    )
  );
create policy submissions_delete on public.submissions for delete to authenticated
  using (public.is_admin() or (student_id = auth.uid() and status in ('pending','rejected')));

create policy att_sessions_select on public.attendance_sessions for select to authenticated
  using (public.is_admin() or class_id = public.my_class_id());
create policy att_sessions_write on public.attendance_sessions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy att_records_select on public.attendance_records for select to authenticated
  using (public.is_admin() or student_id = auth.uid());
create policy att_records_write on public.attendance_records for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy tt_select on public.timetable for select to authenticated using (true);
create policy tt_write  on public.timetable for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy settings_select on public.settings for select to authenticated using (true);
create policy settings_write  on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- 6b. GRANTS — roles ko table access (iske bagair "permission denied for table")
-- =====================================================================
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

alter table public.courses          enable row level security;
alter table public.course_teachers  enable row level security;
alter table public.subject_teachers enable row level security;

create policy courses_select on public.courses for select to authenticated using (true);
create policy courses_write  on public.courses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy ct_select on public.course_teachers for select to authenticated using (true);
create policy ct_write  on public.course_teachers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy st_select on public.subject_teachers for select to authenticated using (true);
create policy st_write  on public.subject_teachers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- 7. STORAGE BUCKETS + POLICIES
-- =====================================================================
insert into storage.buckets (id, name, public) values
  ('assignment-files','assignment-files', false),
  ('submission-files','submission-files', false),
  ('attendance-images','attendance-images', false),
  ('timetable-images','timetable-images', false)
on conflict (id) do nothing;

drop policy if exists "af_read"   on storage.objects;
drop policy if exists "af_write"  on storage.objects;
drop policy if exists "sf_read"   on storage.objects;
drop policy if exists "sf_write"  on storage.objects;
drop policy if exists "sf_delete" on storage.objects;
drop policy if exists "ai_read"   on storage.objects;
drop policy if exists "ai_write"  on storage.objects;
drop policy if exists "ti_read"   on storage.objects;
drop policy if exists "ti_write"  on storage.objects;

create policy "af_read" on storage.objects for select to authenticated
  using (bucket_id = 'assignment-files');
create policy "af_write" on storage.objects for all to authenticated
  using (bucket_id = 'assignment-files' and public.my_role() in ('admin','teacher'))
  with check (bucket_id = 'assignment-files' and public.my_role() in ('admin','teacher'));

create policy "sf_read" on storage.objects for select to authenticated
  using (bucket_id = 'submission-files');
create policy "sf_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'submission-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "sf_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'submission-files'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

create policy "ai_read" on storage.objects for select to authenticated
  using (bucket_id = 'attendance-images');
create policy "ai_write" on storage.objects for all to authenticated
  using (bucket_id = 'attendance-images' and public.is_admin())
  with check (bucket_id = 'attendance-images' and public.is_admin());

create policy "ti_read" on storage.objects for select to authenticated
  using (bucket_id = 'timetable-images');
create policy "ti_write" on storage.objects for all to authenticated
  using (bucket_id = 'timetable-images' and public.is_admin())
  with check (bucket_id = 'timetable-images' and public.is_admin());

-- =====================================================================
-- 8. DEFAULT SETTINGS
-- =====================================================================
insert into public.settings (key, value) values
  ('institution', '{"name":"Gujranwala Institute of Management Sciences","short":"GIMS","tagline":"Assignment Portal"}'::jsonb),
  ('roll_pattern', '{"prefix":"26-ARID-","start":4700,"pad":0}'::jsonb),
  ('academic',     '{"session":"2026-2030","current_semester":"Fall 2026"}'::jsonb),
  ('theme',        '{"primary":"#0f7b3f","accent":"#0f9d58"}'::jsonb)
on conflict (key) do update set value = excluded.value;

-- =====================================================================
-- 8b. AUTH TOKENS GUARD  (yehi "Database error querying schema" ka ilaaj)
--     GoTrue ko NULL nahi, khaali string '' chahiye
-- =====================================================================
create or replace function public.auth_tokens_guard()
returns trigger
language plpgsql
as $fn$
begin
  new.confirmation_token         := coalesce(new.confirmation_token, '');
  new.recovery_token             := coalesce(new.recovery_token, '');
  new.email_change               := coalesce(new.email_change, '');
  new.email_change_token_new     := coalesce(new.email_change_token_new, '');
  new.email_change_token_current := coalesce(new.email_change_token_current, '');
  new.phone_change               := coalesce(new.phone_change, '');
  new.phone_change_token         := coalesce(new.phone_change_token, '');
  new.reauthentication_token     := coalesce(new.reauthentication_token, '');
  return new;
end;
$fn$;

drop trigger if exists trg_auth_tokens_guard on auth.users;
create trigger trg_auth_tokens_guard
  before insert or update on auth.users
  for each row execute function public.auth_tokens_guard();

-- purane users ke NULL tokens bhi theek karo (idempotent)
update auth.users set
  confirmation_token         = coalesce(confirmation_token, ''),
  recovery_token             = coalesce(recovery_token, ''),
  email_change               = coalesce(email_change, ''),
  email_change_token_new     = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change               = coalesce(phone_change, ''),
  phone_change_token         = coalesce(phone_change_token, ''),
  reauthentication_token     = coalesce(reauthentication_token, '')
where confirmation_token is null
   or recovery_token is null
   or email_change is null
   or email_change_token_new is null
   or email_change_token_current is null
   or phone_change is null
   or phone_change_token is null
   or reauthentication_token is null;

-- =====================================================================
-- 9. ensure_admin  —  admin account banata / repair karta hai
-- =====================================================================
create or replace function public.ensure_admin(
  p_username text default 'admin@gims',
  p_password text default 'admin123',
  p_email    text default null
) returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $fn$
declare
  v_id    uuid;
  v_email text;
begin
  v_email := coalesce(nullif(trim(p_email), ''), lower(trim(p_username)) || '@gims.internal');

  select u.id into v_id from auth.users u where lower(u.email) = lower(v_email) limit 1;

  if v_id is null then
    v_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_email, crypt(p_password, gen_salt('bf')), now(),
      now(), now(),
      jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
      jsonb_build_object('username', trim(p_username), 'role', 'admin', 'full_name', 'Administrator'),
      '', '', '', '', '', '', '', ''
    );
  else
    update auth.users
       set encrypted_password = crypt(p_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now())
     where id = v_id;
  end if;

  if not exists (select 1 from auth.identities i where i.user_id = v_id and i.provider = 'email') then
    insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    values (v_id, v_id,
            jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
            'email', v_id::text, now(), now(), now());
  end if;

  update public.profiles
     set username = 'old.' || substr(md5(random()::text), 1, 5) || '.' || username
   where username = trim(p_username)
     and id <> v_id;

  insert into public.profiles (id, username, email, role, full_name)
  values (v_id, trim(p_username), v_email, 'admin', 'Administrator')
  on conflict (id) do update
     set role     = 'admin',
         username = excluded.username,
         email    = excluded.email;

  insert into public.user_credentials (user_id, password_text, updated_at)
  values (v_id, p_password, now())
  on conflict (user_id) do update
     set password_text = excluded.password_text,
         updated_at    = now();

  return v_id::text;
end;
$fn$;

-- =====================================================================
-- 10. ADMIN USER MANAGEMENT (admin panel inhe use karta hai)
-- =====================================================================
create or replace function public.admin_upsert_user(
  p_username  text,
  p_password  text default null,
  p_role      text default 'student',
  p_full_name text default null,
  p_roll_no   text default null,
  p_class_id  uuid default null,
  p_section   text default null,
  p_phone     text default null,
  p_user_id   uuid default null
) returns json
language plpgsql
security definer
set search_path = public, auth, extensions
as $fn$
declare
  v_id    uuid;
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Sirf admin ye kaam kar sakta hai';
  end if;

  if p_username is null or length(trim(p_username)) < 2 then
    raise exception 'Login ID / roll number zaroori hai';
  end if;

  v_email := lower(trim(p_username)) || '@gims.internal';

  if p_user_id is not null then
    select u.id into v_id from auth.users u where u.id = p_user_id;
  else
    select u.id into v_id from auth.users u where lower(u.email) = v_email limit 1;
  end if;

  if v_id is null then
    if p_password is null or length(p_password) < 6 then
      raise exception 'Password kam az kam 6 characters ka hona chahiye';
    end if;

    v_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_email, crypt(p_password, gen_salt('bf')), now(),
      now(), now(),
      jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
      jsonb_build_object('username', trim(p_username), 'role', coalesce(p_role,'student'),
                         'full_name', coalesce(p_full_name, trim(p_username))),
      '', '', '', '', '', '', '', ''
    );
  else
    if p_password is not null and length(p_password) >= 6 then
      update auth.users
         set encrypted_password = crypt(p_password, gen_salt('bf')),
             email_confirmed_at = coalesce(email_confirmed_at, now())
       where id = v_id;
    end if;
  end if;

  if not exists (select 1 from auth.identities i where i.user_id = v_id and i.provider = 'email') then
    insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    values (v_id, v_id,
            jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
            'email', v_id::text, now(), now(), now());
  end if;

  insert into public.profiles (id, username, email, role, full_name, roll_no, class_id, section, phone)
  values (v_id, trim(p_username), v_email, coalesce(p_role,'student'),
          coalesce(p_full_name, trim(p_username)), p_roll_no, p_class_id, p_section, p_phone)
  on conflict (id) do update
     set username  = excluded.username,
         email     = excluded.email,
         role      = excluded.role,
         full_name = excluded.full_name,
         roll_no   = excluded.roll_no,
         class_id  = excluded.class_id,
         section   = excluded.section,
         phone     = excluded.phone;

  if p_password is not null and length(p_password) >= 6 then
    insert into public.user_credentials (user_id, password_text, updated_at)
    values (v_id, p_password, now())
    on conflict (user_id) do update
       set password_text = excluded.password_text,
           updated_at    = now();
  end if;

  return json_build_object('ok', true, 'id', v_id, 'username', trim(p_username));
end;
$fn$;

grant execute on function public.admin_upsert_user(text,text,text,text,text,uuid,text,text,uuid) to authenticated;

create or replace function public.admin_set_password(p_id uuid, p_password text)
returns json language plpgsql security definer set search_path = public, auth, extensions
as $fn$
begin
  if not public.is_admin() then
    raise exception 'Sirf admin ye kaam kar sakta hai';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Password kam az kam 6 characters';
  end if;

  update auth.users
     set encrypted_password = crypt(p_password, gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now())
   where id = p_id;

  if not exists (select 1 from auth.identities i where i.user_id = p_id and i.provider = 'email') then
    insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    select p_id, p_id, jsonb_build_object('sub', p_id::text, 'email', u.email, 'email_verified', true),
           'email', p_id::text, now(), now(), now()
    from auth.users u where u.id = p_id;
  end if;

  insert into public.user_credentials (user_id, password_text, updated_at)
  values (p_id, p_password, now())
  on conflict (user_id) do update
     set password_text = excluded.password_text, updated_at = now();

  return json_build_object('ok', true);
end;
$fn$;

grant execute on function public.admin_set_password(uuid, text) to authenticated;

create or replace function public.admin_delete_user(p_id uuid)
returns json language plpgsql security definer set search_path = public, auth
as $fn$
begin
  if not public.is_admin() then
    raise exception 'Sirf admin ye kaam kar sakta hai';
  end if;
  if p_id = auth.uid() then
    raise exception 'Apna khud ka account delete nahi kar sakte';
  end if;

  delete from auth.users where id = p_id;
  return json_build_object('ok', true);
end;
$fn$;

grant execute on function public.admin_delete_user(uuid) to authenticated;

-- =====================================================================
-- 11. RUN — admin banao
-- =====================================================================
do $outer$
declare
  v_old  uuid;
  v_mail text := 'admin@gims.internal';
  v_id   text;
begin
  -- agar purana admin delete NAHI ho saka, to FRESH email se naya banao
  select u.id into v_old from auth.users u where lower(u.email) = 'admin@gims.internal' limit 1;
  if v_old is not null then
    v_mail := 'admin-' || to_char(now(), 'YYMMDDHH24MISS') || '@gims.internal';
  end if;

  v_id := public.ensure_admin('admin@gims', 'admin123', v_mail);
  raise notice '✅ ADMIN READY — website per login: admin@gims / admin123';
exception when others then
  raise notice '❌ ADMIN CREATE FAIL: % | code=%', sqlerrm, sqlstate;
end $outer$;

-- =====================================================================
-- 12. VERIFY — ye row dekho (sab true hone chahiye)
-- =====================================================================
create or replace function public._check_password(p_email text, p_password text)
returns boolean language sql security definer set search_path = public, extensions, pg_catalog
as $fn$
  select coalesce(
    (select u.encrypted_password = crypt(p_password, u.encrypted_password)
       from auth.users u where lower(u.email) = lower(p_email) limit 1),
    false)
$fn$;

revoke all on function public._check_password(text, text) from public, anon, authenticated;

select
  p.username                                              as "1_login_id",
  u.email                                                 as "2_auth_email",
  (u.email_confirmed_at is not null)                      as "3_confirmed",
  exists(select 1 from auth.identities i
          where i.user_id = u.id and i.provider = 'email') as "4_identity",
  (u.encrypted_password is not null)                      as "5_password_hashed",
  (select public._check_password(p.email, 'admin123'))     as "6_password_ok",
  (select count(*) from public.settings)                   as "7_settings",
  (select count(*) from information_schema.tables
    where table_schema = 'public'
      and table_name in ('profiles','classes','subjects','assignments',
                         'submissions','timetable','attendance_sessions',
                         'attendance_records','user_credentials','settings')) as "8_tables"
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'admin';

drop function public._check_password(text, text);

-- =====================================================================
--  ✅ EXPECTED RESULT (Results tab me) — ye SAB aisa hona chahiye:
--     1_login_id      = admin@gims
--     3_confirmed     = true
--     4_identity      = true
--     5_password_hashed = true
--     6_password_ok   = true     <-- ye sab se ahem hai
--     7_settings      = 4
--     8_tables        = 10
-- =====================================================================
--
--  🟢 Ab website kholo:  Login ID  admin@gims   |   Password  admin123
--
--  ❌ AGAR 6_password_ok = false  YA  koi row hi na aaye:
--     (matlab is project me raw SQL se auth user theek nahi ban raha)
--     1) Supabase -> Authentication -> Users -> "Add user" -> Create new user
--          Email: admin.gims@gims.internal   Password: admin123
--          [x] Auto Confirm User   -> Create
--     2) SQL Editor me SIRF ye ek line chalao:
--          select public.ensure_admin('admin@gims','admin123','admin.gims@gims.internal');
--     3) Website per login: admin@gims / admin123
--
--  ❌ AGAR login per ab bhi "Password ghalat hai":
--     Supabase -> Authentication -> Users me dekho koi user hai?
--     Nahi hai to wahin "Add user" se banao:
--        email: admin@gims.internal | password: admin123 | [x] Auto Confirm
--     phir ye ek line chalao:
--       select public.ensure_admin('admin@gims','admin123');
--

-- =====================================================================
-- 13. API CACHE RELOAD (zaroori!) — iske bagair app ko nayi tables
--     nazar nahi aati aur login ke baad wapas login page aa jata hai.
-- =====================================================================
notify pgrst, 'reload schema';

-- =====================================================================
--  LOGIN KE BAAD (admin panel se):
--   1. Classes  -> + New class
--   2. Teachers -> + New teacher
--   3. Subjects -> + New subject (teacher assign karo)
--   4. Students -> Bulk add (roll numbers 26-ARID-4701…)
--   5. Time Table -> slots set karo
--   6. Attendance -> sheet photo upload (OCR)
-- =====================================================================
