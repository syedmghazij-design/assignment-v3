# 📋 GIMS PORTAL — Features & Architecture

---

## 1️⃣ Jo tum ne maanga tha — aur kya bana

| # | Tumhari requirement | Status | Kahan hai |
|---|---|---|---|
| 1 | 3 logins — Student / Teacher / Admin | ✅ | `profiles.role` + alag dashboards |
| 2 | Student: subject-wise **segments**, click → us subject ki assignments | ✅ | Student → **Subjects** tab |
| 3 | Student: wahan se hi **upload** | ✅ | Assignment card → Upload modal |
| 4 | Teacher: class-wise section, assignment **assign** karna | ✅ | Teacher → My Subjects → + New assignment |
| 5 | Teacher: purani **download** + **Accept / Reject** | ✅ | Review modal (file + marks + feedback) |
| 6 | **Deadline strict** | ✅ | Server-side `is_late` trigger — client se bypass nahi ho sakta |
| 7 | Teacher: deadline ke baad wali **accept kar sakta hai** | ✅ | Accept/Reject late per bhi kaam karta hai |
| 8 | Deadline ke baad wali **alag section** me | ✅ | Teacher → **Late Submissions** (alag tab + badge) |
| 9 | Har cheez **section-wise + organised** | ✅ | Har view subject/class/section segments me |
| 10 | **Buttons per kaam**, kam scrolling | ✅ | Sidebar nav + tab pills + clickable stat cards |
| 11 | **Dates/time perfectly managed** | ✅ | Har jagah `dd Mmm yyyy · h:mm AM/PM` + live countdown |
| 12 | Student ka **timetable** (buttons se) | ✅ | Student → Timetable (Mon…Sat buttons) |
| 13 | Dashboard **infographics** — pending/rejected counts, click → details | ✅ | 5 stat cards + donut chart + progress bars |
| 14 | Admin ka **poora access** — class, subject, har cheez | ✅ | 8 admin sections |
| 15 | **Roll number pattern** `26-ARID-4700` | ✅ | Settings → pattern + **bulk auto-generate** |
| 16 | Teacher ID/password admin ki marzi ka | ✅ | Admin → Teachers → New |
| 17 | Student/Teacher apna password change kar sakay | ✅ | Sidebar → Change password |
| 18 | Password change admin panel me bhi update ho | ✅ | `user_credentials` table (admin-only RLS) |
| 19 | Admin ID `admin@gims` / `admin123` | ✅ | seed me bana hua |
| 20 | **OCR daily attendance** (image upload) | ✅ | Admin → Attendance (OCR) — Tesseract, free |
| 21 | **OCR timetable** | ✅ | Admin → Time Table → Import from image |
| 22 | Har cheez **manually customisable** | ✅ | Har OCR result edit ho sakta hai + pura grid manual |
| 23 | **Green + white theme** | ✅ | `app/globals.css` — ek jagah se badlo |
| 24 | 400 students handle | ✅ | Bulk add + chunked API (10-10) + DB indexes |
| 25 | Files zip me | ✅ | `GIMS-PORTAL-FINAL-v1.3.zip` |

### Bonus jo maine khud add kiya
- ⚡ **Bulk add 500 students** ek click me (roll auto-increment)
- ⬇ **CSV export** (students + passwords) — Excel ke liye
- 📊 **Donut chart** + per-class bar chart
- ⏳ **Live countdown** har assignment per ("2d 4h left" / "Overdue by 3h")
- ⭐ **Marks + feedback** system
- 🔍 Search + filters har table me
- 📱 Fully **mobile responsive** (phone per bhi chalega)
- 🔒 **Row Level Security** — student sirf apna data, teacher sirf apne subject ka, admin sab
- 🖨 **Print-friendly** timetable
- 🗂 File storage separate buckets (assignment / submission / attendance / timetable)

---

## 2️⃣ Aage kya add karo (value ke hisaab se tarteeb)

### 🥇 Must-have next (1–2 din ka kaam)
| Feature | Faida |
|---|---|
| **Deadline reminder** (email/WhatsApp) | Students bhoolte nahi — Supabase Edge Function + cron |
| **Assignment edit** (teacher deadline badal sakay) | Abhi delete + naya banana parta hai |
| **Result / marksheet PDF** | Subject-wise marks ka printable page |
| **Attendance summary report** (75% se kam wale students) | Admin ko warning list |

### 🥈 Impressive (university demo me “wow”)
| Feature | Faida |
|---|---|
| **Plagiarism check** | 2 files ka text compare (cosine similarity) — 100% original idea |
| **Bulk PDF download (ZIP)** | Teacher ek click me poori class ki files |
| **Announcement / notice board** | Admin notice, sab ko dashboard per |
| **Student profile photo** | Roll number ke saath pehchaan |
| **Dark mode** | Bas ek CSS toggle |
| **PWA** (Add to Home Screen) | Mobile app jaisa feel, APK ki zaroorat nahi |
| **Fee / challan module** | Admin side extra module |
| **Quiz / MCQ test** | Assignment ke ilawa assessment |

### 🥉 Long-term
- Parent login (sirf attendance + result)
- Multi-semester / transcript tracking
- WhatsApp Bot (Twilio) — “assignment aayi hai”
- Analytics dashboard (class average, submission trend)
- AI se assignment plagiarism + auto-grade suggestion

> **Meri salah:** pehle deployee karke **demo** do, phir 2–3 features (reminder + PDF + plagiarism) add karo. Waqt kam hai to demo > features.

---

## 3️⃣ Ye bana kaise hai (architecture — viva me ye pooch sakte hain)

```
Browser (Next.js static app — Cloudflare Pages se serve hota hai)
        │
        └── supabase-js (anon key + user ka JWT session)
                 │
                 ├──► Supabase PostgreSQL ◄── Row Level Security (RLS)
                 │        │                  har table per policy:
                 │        │                  "student sirf apni rows"
                 │        │                  "teacher sirf apne subject ki"
                 │        │                  "admin sab"
                 │        │
                 │        └──► RPC functions (SECURITY DEFINER):
                 │             admin_upsert_user()   ← teacher/student banana
                 │             admin_set_password()  ← password reset
                 │             admin_delete_user()   ← delete
                 │             resolve_login()       ← roll number → email
                 │             set_my_password()     ← khud password change
                 │             (har admin function ke andar is_admin() check)
                 │
                 └──► Supabase Storage (4 private buckets + signed URLs)
```

> **Koi backend server nahi, koi service_role key nahi.** Poora "backend" database ke andar hai — is liye Cloudflare Pages per sirf static files chalti hain aur security 100% database level per hai.

**Login flow (username se, email chhupaya hua):**
1. User `26-ARID-4700` + password daalta hai
2. `resolve_login()` RPC username/roll → internal email (`26-arid-4700@gims.internal`)
3. `supabase.auth.signInWithPassword()` → JWT session
4. `profiles.role` dekh kar Student / Teacher / Admin dashboard khulta hai

**Kyun email chhupaya?** Kyunke roll number me `@` nahi hota, aur Supabase Auth ko email format chahiye. Ye trick real universities bhi use karti hain (username → email mapping).

**Deadline strict kaise?** `submissions` table per DB trigger `mark_late()` — jab bhi submission aati hai, DB khud `deadline` se compare karke `is_late` set karta hai. Student browser se kuch bhi kar le, late late hi rahegi.

**OCR kaise?** Tesseract.js browser me chalta hai (model CDN se aata hai) → image se text → roll-number pattern regex (`26-ARID-(\d+)`) → student list se match → checklist present/absent. Har cheez manually editable.

---

## 4️⃣ Cost

| Service | Free tier | 400 students ke liye kaafi? |
|---|---|---|
| Supabase | 500 MB DB + 1 GB files | ✅ haan (1 GB = ~1000 PDF assignments; barhe to $25/mo Pro) |
| **Cloudflare Pages** | Unlimited requests + unlimited bandwidth, 500 builds/month, **commercial use allowed** | ✅ bohat zyada |
| OCR | Free (browser) | ✅ unlimited |

**Total: Rs 0/month** — aur commercial use bhi legal.

### Vercel vs Cloudflare (important)
| | Vercel Hobby (free) | Cloudflare Pages (free) |
|---|---|---|
| Commercial use | ❌ mana hai (Pro $20/mo chahiye) | ✅ **allowed** |
| Bandwidth | 100 GB | ♾️ unlimited |
| Build minutes | 6000 min/mo | 500 builds/mo |
| Static Next.js export | ✅ | ✅ |

> Bas isi wajah se project Cloudflare ke liye banaya gaya hai. Code bilkul same repository se Vercel per bhi chal jayega (agar kabhi Pro le lo) — sirf `next.config.mjs` ki `output: 'export'` hata dena.

---

## 5️⃣ Demo script (jab university me dikhao — 3 minute)

1. **Admin** login → Dashboard ka donut chart + 400 students dikhao → *“poora control ek panel me”*
2. **Teachers** → naya teacher 5 second me add → password bhi admin set karta hai
3. **Attendance** → sheet ki photo upload → OCR chal kar roll numbers tick → *“manual kaam khatam”*
4. **Teacher** login → naya assignment + deadline → accept/reject
5. **Student** login (roll number) → subject segments → upload → dashboard per pending 0 ho gaya
6. **Late** dikhao → deadline guzri hui submission alag section me, teacher ke paas accept ka option
7. Aakhir me: *“Ye GitHub per timestamp ke saath, aur live URL per chal raha hai.”* 🎤

---

## 6️⃣ Files kahan kya hai (developer ke liye)

```
gims-portal/
├── app/
│   ├── page.js                 → entry point
│   ├── layout.js               → HTML shell + metadata
│   └── globals.css             → 🎨 poori theme (green/white)
├── components/
│   ├── AppShell.js             → session + role routing + change password
│   ├── Login.js                → login screen
│   ├── ui.js                   → buttons, cards, modal, tabs, toast (design system)
│   ├── student/StudentApp.js   → student ka poora dashboard
│   ├── teacher/TeacherApp.js   → teacher ka poora dashboard
│   └── admin/
│       ├── AdminApp.js         → shell + dashboard + charts
│       ├── ClassesView.js      ├── SubjectsView.js
│       ├── TeachersView.js     ├── StudentsView.js
│       ├── AttendanceView.js   ├── TimetableView.js
│       └── SettingsView.js
├── lib/
│   ├── supabase.js             → client + env
│   ├── adminApi.js             → admin RPC calls (user create/reset/delete)
│   ├── utils.js                → dates, files, upload/download
│   ├── ocr.js                  → OCR + roll-number parsing
│   └── toast.js
├── supabase/
│   ├── 1-SETUP-DATABASE.sql    → 🗄 POORA database (tables + RLS + RPC + admin) — ek hi file
│   └── 2-CHECK-DATABASE.sql    → setup verify karne ke liye (optional)
├── START-HERE.md               → 👈 deploy guide (ye parho)
└── docs/FEATURES.md            → ye file
```

**Theme badalni hai?** `app/globals.css` ki pehli lines me `--green-700: #0f7b3f;` badal do → poori website ka rang badal jayega.
