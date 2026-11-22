-- =====================================================================
--  🔄 GIMS v2 — UPGRADE (purana data SAFE rehta hai)
--
--  Naya kya:
--    1. `courses`  — MASTER subject list (ek hi baar add karo)
--    2. `subjects` — ab "class ko diya gaya subject" (offering)
--                    + course_id link + sections (A/B/C)
--    3. `subject_teachers` — ek subject ke KAI teachers
--    4. Purane subjects/teachers khud migrate ho jate hain
--
--  Kahaan chalayein: Supabase → SQL Editor → ye poora paste → Run
--  SAFE: dobara chalane per kuch kharab nahi hota (idempotent)
-- =====================================================================


-- ---------------------------------------------------------------- 1
-- MASTER SUBJECT CATALOGUE
-- ----------------------------------------------------------------
create table if not exists public.courses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       text,
  semester   text,
  color      text default '#0f9d58',
  created_at timestamptz not null default now()
);
create unique index if not exists courses_name_uniq on public.courses (lower(name));


-- ---------------------------------------------------------------- 2
-- subjects: course link + sections
-- ----------------------------------------------------------------
alter table public.subjects add column if not exists course_id uuid references public.courses(id) on delete set null;
alter table public.subjects add column if not exists sections  text[];

comment on column public.subjects.sections is 'null = saare sections, warna sirf ye sections (A,B)';


-- ---------------------------------------------------------------- 3
-- EK SUBJECT KE KAI TEACHERS
-- ----------------------------------------------------------------
create table if not exists public.subject_teachers (
  subject_id uuid not null references public.subjects(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  is_lead    boolean not null default false,
  added_at   timestamptz not null default now(),
  primary key (subject_id, teacher_id)
);


-- ---------------------------------------------------------------- 4
-- PURANA DATA MIGRATE
-- ----------------------------------------------------------------
-- purane teacher_id -> subject_teachers
insert into public.subject_teachers (subject_id, teacher_id, is_lead)
select s.id, s.teacher_id, true
from public.subjects s
where s.teacher_id is not null
on conflict (subject_id, teacher_id) do nothing;

-- purane subjects se master courses banao (naam ke hisaab se)
insert into public.courses (name, code, semester, color)
select distinct on (lower(s.name)) s.name, s.code, s.semester, coalesce(s.color, '#0f9d58')
from public.subjects s
where not exists (select 1 from public.courses c where lower(c.name) = lower(s.name))
order by lower(s.name), s.created_at;

-- subjects ko course se jodo
update public.subjects s
   set course_id = c.id
  from public.courses c
 where s.course_id is null
   and lower(c.name) = lower(s.name);


-- ---------------------------------------------------------------- 5
-- HELPER: kya main is subject ka teacher hoon?
-- ----------------------------------------------------------------
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


-- ---------------------------------------------------------------- 6
-- RLS: nayi tables + multiple teachers wali policies
-- ----------------------------------------------------------------
alter table public.courses          enable row level security;
alter table public.subject_teachers enable row level security;

drop policy if exists courses_select on public.courses;
drop policy if exists courses_write  on public.courses;
create policy courses_select on public.courses for select to authenticated using (true);
create policy courses_write  on public.courses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists st_select on public.subject_teachers;
drop policy if exists st_write  on public.subject_teachers;
create policy st_select on public.subject_teachers for select to authenticated using (true);
create policy st_write  on public.subject_teachers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- subjects write
drop policy if exists subjects_write on public.subjects;
create policy subjects_write on public.subjects for all to authenticated
  using (public.is_admin() or public.is_subject_teacher(id))
  with check (public.is_admin() or public.is_subject_teacher(id));

-- assignments
drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.subjects s
      where s.id = assignments.subject_id
        and (public.is_subject_teacher(s.id) or s.class_id = public.my_class_id())
    )
  );

drop policy if exists assignments_write on public.assignments;
create policy assignments_write on public.assignments for all to authenticated
  using (public.is_admin() or public.is_subject_teacher(assignments.subject_id))
  with check (public.is_admin() or public.is_subject_teacher(assignments.subject_id));

-- submissions
drop policy if exists submissions_select on public.submissions;
create policy submissions_select on public.submissions for select to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.assignments a
      where a.id = submissions.assignment_id and public.is_subject_teacher(a.subject_id)
    )
  );

drop policy if exists submissions_update on public.submissions;
create policy submissions_update on public.submissions for update to authenticated
  using (
    public.is_admin()
    or (student_id = auth.uid() and status in ('pending','rejected'))
    or exists (
      select 1 from public.assignments a
      where a.id = submissions.assignment_id and public.is_subject_teacher(a.subject_id)
    )
  );


-- ---------------------------------------------------------------- 7
-- GRANTS + CACHE
-- ----------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

notify pgrst, 'reload schema';


-- ---------------------------------------------------------------- 8
-- VERIFY
-- ----------------------------------------------------------------
select
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE')                  as total_tables,
  (select count(*) from public.courses)                                            as master_subjects,
  (select count(*) from public.subjects)                                           as class_offerings,
  (select count(*) from public.subject_teachers)                                   as teacher_links,
  (select count(*) from public.subjects where course_id is null)                   as offerings_without_master,
  (select count(*) from public.subjects s
     where not exists (select 1 from public.subject_teachers st where st.subject_id = s.id)
       and s.teacher_id is null)                                                   as subjects_without_teacher;

-- total_tables = 12  |  subjects_without_teacher = 0 hona chahiye
-- ---------------------------------------------------------------------
