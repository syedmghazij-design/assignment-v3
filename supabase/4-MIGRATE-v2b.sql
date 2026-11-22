-- =====================================================================
--  🔄 GIMS v2b — MASTER SUBJECT ke TEACHERS
--
--  Naya: `course_teachers`
--     "Programming Fundamentals" ko kaun kaun se teachers padha sakte hain
--     → Teacher add karte waqt subjects tick karo
--     → Class me subject assign karte waqt us subject ke saare teachers aa jate hain
--
--  Supabase → SQL Editor → poora paste → Run
--  SAFE: dobara chalane per kuch kharab nahi hota.
-- =====================================================================

create table if not exists public.course_teachers (
  course_id  uuid not null references public.courses(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (course_id, teacher_id)
);

-- purana data se pool banao (jo teachers offerings me hain wo master subject me bhi aayen)
insert into public.course_teachers (course_id, teacher_id)
select distinct s.course_id, st.teacher_id
from public.subject_teachers st
join public.subjects s on s.id = st.subject_id
where s.course_id is not null
on conflict do nothing;

-- students ke tasalsul se bachne ke liye sirf teachers
delete from public.course_teachers ct
where not exists (select 1 from public.profiles p where p.id = ct.teacher_id and p.role = 'teacher');

-- RLS
alter table public.course_teachers enable row level security;

drop policy if exists ct_select on public.course_teachers;
drop policy if exists ct_write  on public.course_teachers;
create policy ct_select on public.course_teachers for select to authenticated using (true);
create policy ct_write  on public.course_teachers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- GRANTS + cache
grant select, insert, update, delete on public.course_teachers to authenticated;
grant all on public.course_teachers to service_role;

notify pgrst, 'reload schema';

-- VERIFY
select
  (select count(*) from public.courses)         as master_subjects,
  (select count(*) from public.course_teachers) as subject_teacher_links,
  (select count(*) from public.subject_teachers) as class_teacher_links;

-- subject_teacher_links > 0 ho to pool ban gaya
