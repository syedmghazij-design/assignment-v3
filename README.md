# 🟢 GIMS Portal — Assignment, Attendance & Timetable Management

University assignment portal: **students upload**, **teachers review (accept/reject)**, **admin controls everything** — with OCR attendance, timetable, strict deadlines, and 3 separate logins.

**Stack:** Next.js 14 (static export) · Supabase (Postgres + Auth + Storage) · **Cloudflare Pages** · Tesseract.js (OCR)

> Vercel ka free plan commercial use allow nahi karta — is liye Cloudflare Pages (free + commercial allowed, unlimited bandwidth).

---

## 🚀 Setup (35 min, zero coding)

👉 **Poori guide: [`START-HERE.md`](START-HERE.md)**

Short version:
1. **Supabase** → new project → SQL Editor me `supabase/1-SETUP-DATABASE.sql` paste + Run
2. **Supabase → Settings → API** → Project URL + anon key copy (bas 2 cheezain)
3. **GitHub** → new **private** repo → saari files upload
4. **Cloudflare Pages** → Connect to Git → build `npm run build`, output `out` → 2 env vars + `NODE_VERSION=20` → Deploy
5. Login: `admin@gims` / `admin123` → **foran password change karo**

---

## 🔑 Default login

| Role | Login ID | Password |
|---|---|---|
| Admin | `admin@gims` | `admin123` |
| Teacher | admin banata hai | admin sets |
| Student | roll number (`26-ARID-4700`) | admin sets |

---

## 🧩 Features

- 3 role-based dashboards (Student / Teacher / Admin)
- Subject-wise segments → assignment list → upload
- Teacher: create assignment, strict deadline, late → separate section, accept/reject + marks + feedback
- Student: pending / in-review / accepted / rejected infographics (clickable), timetable, attendance %
- Admin: classes, sections, subjects, teachers, students (bulk 400+), password reset & visibility, CSV export
- OCR attendance from sheet photo + OCR timetable import (both fully editable)
- Roll-number pattern `26-ARID-xxxx` auto-generation
- Row Level Security: student sees only own data, teacher only own subjects, admin everything
- Green & white theme, fully responsive

Full list + roadmap: [`docs/FEATURES.md`](docs/FEATURES.md)

---

## 💻 Local development (optional)

```bash
npm install
cp .env.local.example .env.local   # 2 keys paste karo
npm run dev                        # http://localhost:3000
```

---

## 🔒 Security

- **Koi `service_role` key ki zaroorat nahi** — users banana/reset/delete Supabase RPC functions se hota hai (andar `is_admin()` check).
- Sirf `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` chahiye (ye public hone chahiye).
- Poora data **Row Level Security** se protected hai.
- `.env.local` gitignored hai. Repo **private** rakho.

---

© GIMS — built for students, by a student. 🎓
