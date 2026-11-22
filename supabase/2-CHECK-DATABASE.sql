-- =====================================================================
--  ✅ CHECK KARO — setup theek hua ya nahi (kuch change nahi karta)
--  Supabase -> SQL Editor -> New query -> paste -> RUN
-- =====================================================================

notify pgrst, 'reload schema';

select
  p.username                                              as "1_login_id",
  p.role                                                  as "2_role",
  u.email                                                 as "3_auth_email",
  (u.email_confirmed_at is not null)                      as "4_confirmed",
  exists(select 1 from auth.identities i
          where i.user_id = u.id and i.provider = 'email') as "5_identity",
  (u.encrypted_password is not null)                      as "6_password_set",
  (select count(*) from information_schema.tables
    where table_schema = 'public'
      and table_name in ('profiles','classes','subjects','assignments',
                         'submissions','timetable','attendance_sessions',
                         'attendance_records','user_credentials','settings','courses','subject_teachers')) as "7_tables",
  (select count(*) from storage.buckets
    where id in ('assignment-files','submission-files',
                 'attendance-images','timetable-images'))  as "8_buckets",
  (select count(*) from public.settings)                   as "9_settings"
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'admin';

-- =====================================================================
--  SAB AISA HONA CHAHIYE:
--    1_login_id  = admin@gims
--    2_role      = admin
--    4_confirmed = true
--    5_identity  = true
--    6_password_set = true
--    7_tables    = 12
--    8_buckets   = 4
--    9_settings  = 4
--
--  Agar row KHAALI aaye -> 1-YE-CHALAO.sql dobara chalao (safe hai).
-- =====================================================================
