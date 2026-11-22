# 📁 HAR FILE KA KAAM — GIMS Portal

> Ye file batati hai ke **konsi file kya karti hai** aur kab usko chhedna hai.
> 90% kaam ke liye tumhe sirf 3 files yaad rakhni hain: **`1-SETUP-DATABASE.sql`**, **`START-HERE.md`**, **`components/`** — bas.

---

## 🌳 Poora structure

```
gims-portal/
├── START-HERE.md          ← setup guide (parhne ke liye)
├── FILES.md               ← ye file (har file ka kaam)
├── README.md              ← GitHub ke home page per dikhta hai
├── package.json           ← app ki dependencies + commands
├── package-lock.json      ← exact versions (chhedna nahi)
├── next.config.mjs        ← build settings (static export)
├── jsconfig.json          ← `@/` shortcut imports ke liye
├── .gitignore             ← git ko batata hai kya upload na kare
├── .env.local.example     ← local development ke liye keys ka sample
│
├── app/                   ← website ka dhancha
├── components/            ← saari screens (sab se zyada kaam yahan)
├── lib/                   ← chhote helpers
├── supabase/              ← database ki SQL files
└── docs/FEATURES.md       ← features list + aage ka roadmap
```

---

# 🗄 `supabase/` — DATABASE (sab se ahem)

| File | Kya karti hai | Kab chalayein |
|---|---|---|
| **`1-SETUP-DATABASE.sql`** | **Poora database ek hi file me**: 10 tables, indexes, RLS policies, GRANTS, storage buckets, settings, `resolve_login`, `ensure_admin`, admin RPCs, `auth_tokens_guard`, `notify pgrst`. Aakhir me verify row deti hai. | **Naye Supabase project per SIRF EK BAAR.** Dobara chalana bhi safe hai — par **saara data delete** ho jata hai (`drop table`). |
| `2-CHECK-DATABASE.sql` | Sirf **padhne wali** file — kuch badalti nahi. Batati hai: admin login theek hai? password sahi? 12 tables? 4 buckets? RLS policies? | Jab shak ho ke database theek hai ya nahi. Kabhi bhi chala sakte hain. |
| **`3-MIGRATE-v2.sql`** | **Purane database ko v2 banati hai** — master subjects + multiple teachers + sections. **Data safe rehta hai** (kuch delete nahi hota). Dobara chalana bhi safe. | Jab pehle se data ho aur naye features chahiye. Naya project banaya to zaroorat nahi (1-SETUP me sab hai). |

> ⚠️ `1-SETUP-DATABASE.sql` me `drop table` hai. Naya project = theek. Purane project per chalane se **data chala jayega**.

---

# 🖥 `app/` — website ka starting point

| File | Kya karta hai |
|---|---|
| `app/page.js` | Website ka **entry point**. Sirf itna: `<AppShell />` render karta hai. |
| `app/layout.js` | HTML ka dhancha, `<title>`, metadata, fonts, favicon. |
| `app/globals.css` | **Poora design** — rang (green/white), buttons, tables, cards, sidebar, mobile responsive. Design badalna ho to yahan. |

---

# 🧩 `components/` — screens

### Bunyadi (3 files sab se ahem)

| File | Kya karta hai |
|---|---|
| **`components/AppShell.js`** | **Dimagh.** Login check karta hai, session sunta hai, user ka profile load karta hai, aur role ke hisaab se sahi app kholta hai: `admin` → AdminApp, `teacher` → TeacherApp, `student` → StudentApp. Login/signup/logout ka control bhi yahan. |
| **`components/Login.js`** | Login screen. Login ID → email me badal ke sign-in. Neeche **version + database status** dikhata hai (`✅ database ready`). |
| **`components/ui.js`** | Chhote ready-made parts: `Btn`, `Card`, `Modal`, `Input`, `Select`, `Badge`, `Stat`, `Tabs`, `Progress`, `Empty`, `Spinner`, `Toaster`. Nayi screen banate waqt yehi use karo — design khud match ho jayega. |

### Admin (`components/admin/`) — 8 files

| File | Kya karta hai |
|---|---|
| `AdminApp.js` | Admin ka **dhancha**: sidebar, tabs, **Audit card**, aur **saara data ek saath load** (`store`: classes, courses, subjects, links, teachers, students, assignments, submissions, passwords, settings). Naya data chahiye to `load()` me query add karo. |
| **`ClassesView.js`** | **⭐ HUB.** Class card → `Open →` → 5 tabs: **Overview · Subjects & Teachers · Students · Time Table · Attendance**. Subjects assign modal (subjects + teachers + sections) bhi yahin. Students ab isi ke andar se add hote hain. |
| `SubjectsView.js` | **MASTER subject list** — `Programming Fundamentals` ek hi baar add hota hai. Har card per dikhta hai: kitni classes me hai, kaun se teachers padha rahe hain. |
| `TeachersView.js` | Teachers list + **📚 Subjects button** → class-wise tick. Ab **multiple teachers** support (ek subject ke 4+ teachers). Password show/reset/delete bhi. |
| `StudentsView.js` | Students (Class → Students tab ke andar chalta hai, `fixedClass` ke saath): single add, **⚡ bulk add (400+)**, edit, reset password, delete, CSV export, subjects preview. Class pehle se locked hoti hai. |
| `AttendanceView.js` | **OCR attendance**: sheet ki photo upload → text nikalo → students match karo → manual edit → save. Class ke andar `fixedClass` ke saath bhi chalta hai. |
| `TimetableView.js` | **Class + section wise** timetable grid. Cell per click → subject/time/room → save. OCR se image import bhi. `fixedClass` ke saath class locked. |
| `SettingsView.js` | Roll number pattern (`26-ARID-`), start number, university name, session, etc. |

### Teacher (`components/teacher/`)
| File | Kya karta hai |
|---|---|
| `TeacherApp.js` | Poora teacher app. Login ke baad seedha **My Classes** (jo classes parhata hai). Class kholein → 3 tabs: **Assignments** (har subject ke saath ➕ Nayi assignment / 📥 Check), **To Review**, **Time Table**. Sidebar: To Review, Late Submissions, My Schedule, Profile. Multiple teachers support (`subject_teachers`). `NewAssignmentModal` aur `ReviewModal` bhi isi file me hain. |

### Student (`components/student/`)
| File | Kya karta hai |
|---|---|
| `StudentApp.js` | Poora student app: dashboard, **Subjects** (sirf apne section wale), subject → assignment → upload, Timetable, Attendance %, Profile. |

---

# 🔧 `lib/` — helpers

| File | Kya karta hai |
|---|---|
| `lib/supabase.js` | Supabase client banata hai (URL + anon key environment variables se). |
| `lib/version.js` | App version (`v1.5`) + database ka naam + key type — login page ke neeche dikhane ke liye. |
| `lib/adminApi.js` | Admin ke user operations: `createUsers`, `updateUser`, `resetPassword`, `deleteUser` — sab Supabase **RPC** se (service_role key ki zaroorat nahi). |
| `lib/ocr.js` | Tesseract.js OCR — photo se text nikalna, roll numbers match karna, attendance/timetable parse karna. |
| `lib/utils.js` | Chhoti utilities: dates (`fmtDate`, `fmtDateTime`), `timeLeft`, `pct`, `initials`, file upload/open, `safeName`. |
| `lib/toast.js` | Chhota toast helper (poore app me messages). |

---

# ⚙️ Config files

| File | Kya karta hai | Chhedna? |
|---|---|---|
| `package.json` | Dependencies + `npm run dev` / `npm run build`. | Sirf nayi library add karte waqt |
| `next.config.mjs` | `output: 'export'` (static site — Cloudflare ke liye zaroori), `trailingSlash`, images unoptimized | ❌ na chhedo |
| `jsconfig.json` | `@/components/...` shortcut | ❌ |
| `.env.local.example` | Local dev ke liye 2 keys ka sample | Copy karke `.env.local` banao |

---

# 🔑 Environment variables (Cloudflare me)

| Naam | Kahan se | Public? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | Haan (safe) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public | Haan (safe — RLS protect karta hai) |
| `NODE_VERSION` | `20` (Cloudflare build ke liye) | — |

> ❌ **`service_role` key kahin nahi chahiye.** Kabhi `NEXT_PUBLIC_` ke saath na rakho.

---

# 🧠 3 cheezein jo yaad rakhni hain

1. **Student ke subjects** khud class se aate hain (section ke hisaab se) — student ko alag se assign nahi karna padta.
2. **Teacher ke classes** subject se aate hain — class me subject assign karte waqt teachers tick karo, classes khud aa jayengi.
3. **Timetable** class + section ka hota hai — har section ka apna alag time table.

---

# 🧱 Database ka naya model (v2)

```
courses (MASTER)                subjects (class ko diya gaya)         subject_teachers
┌──────────────────┐          ┌───────────────────────────┐         ┌──────────────────┐
│ id               │◄─────────│ course_id                 │◄────────│ subject_id       │
│ name  "Prog Fund"│          │ class_id  → BS CS          │         │ teacher_id       │
│ code  "CS-101"   │          │ sections  → {A,B} / null   │         │ is_lead          │
│ color            │          │ name (copy), color         │         └──────────────────┘
└──────────────────┘          └───────────────────────────┘                 │
                                                                             ▼
                                                                    profiles (teacher)
```

- **courses** = master list (ek hi baar add)
- **subjects** = "is class ko ye subject" (offering) + kaun se sections
- **subject_teachers** = kaun kaun se teachers (4+ bhi ho sakte hain)
- `subjects.teacher_id` sirf **lead teacher** ke liye rakha gaya hai (purana compatibility)

**RLS:** `is_subject_teacher(subject_id)` function decide karta hai ke teacher ko us subject ka data milna chahiye ya nahi — `subject_teachers` per based.

---

# 🔨 Common kaam — kahan jao

| Karna hai | File |
|---|---|
| Rang/design badalna | `app/globals.css` |
| Naya field student me add karna | `supabase/1-SETUP-DATABASE.sql` (column) + `StudentsView.js` (form) |
| Subject master list me add | Admin → **Subjects** tab (code: `SubjectsView.js`) |
| Class me subject + teacher dena | Admin → **Classes → Open → + Subject assign** (code: `ClassesView.js`) |
| Login page ka text | `components/Login.js` |
| Naya tab admin sidebar me | `AdminApp.js` (NAV + render) |
| Teacher ka flow badalna | `teacher/TeacherApp.js` |
| OCR behtar karna | `lib/ocr.js` |
| Roll number pattern | Admin → Settings (code: `SettingsView.js`) |
