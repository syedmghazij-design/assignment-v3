# 🟢 GIMS PORTAL — START HERE (naya setup, zero se)

**Ye guide bilkul shuru se hai. Har click likha hua hai. Total ~35 minute.**

> Tumhare paas is waqt kya hona chahiye: GitHub, Supabase, Cloudflare — teeno ke **free accounts** (agar nahi hain to pehle bana lo, 5 minute).
> Purane repo / project / page ko delete karna **zaroori nahi** — naye bana lena kaafi hai.

---

## 📦 ZIP me kya hai

```
gims-portal/
├── app/                    ← website ka code
├── components/             ← 3 dashboards (student / teacher / admin)
├── lib/                    ← helpers, OCR, supabase client
├── supabase/
│   ├── 1-SETUP-DATABASE.sql   ← ⭐ Supabase me SIRF ye chalani hai
│   └── 2-CHECK-DATABASE.sql   ← check karne ke liye (optional)
├── docs/FEATURES.md        ← features + aage kya add karna
├── package.json
├── next.config.mjs
├── jsconfig.json
├── .gitignore
└── START-HERE.md           ← ye file
```

---

# STEP 1 — GitHub (naya repo)

1. `https://github.com/new` kholo
2. **Repository name**: `gims-portal`
3. **Private** select karo
4. **Create repository**
5. Agle page per neela link: **“uploading an existing file”** → click
6. **Zip extract karo** → `gims-portal` folder kholo → andar ki **saari cheezain** select karo:
   ```
   app   components   docs   lib   supabase
   jsconfig.json   next.config.mjs   package.json   package-lock.json
   README.md   START-HERE.md   .gitignore
   ```
7. Browser ke upload box me **drag & drop** karo
8. **Commit changes** (green) ✅

> ⚠️ `node_modules` ya `.next` folder **upload na karo** (agar milen to). Zaroori nahi.
> Agar `.gitignore` nazar na aaye (hidden file hoti hai) to koi masla nahi — chhor do.

---

# STEP 2 — Supabase (naya project + database)

### 2.1 Project banao
1. `https://supabase.com/dashboard` → **New project**
2. - **Project name**: `gims-assignments`
   - **Database Password**: strong password (note kar lo)
   - **Region**: **South Asia (Mumbai)**
   - **Plan**: **Free**
3. **Create new project** → **2 minute wait** ("Project is ready")

### 2.2 Database setup (ek hi file)
1. Left sidebar → **`SQL Editor`** (`>_`) → **`+ New query`**
2. Zip se **`supabase/1-SETUP-DATABASE.sql`** kholo (Notepad me) → **Ctrl+A** → **Ctrl+C**
3. Supabase editor me **Ctrl+V** → neeche right **`Run`**
4. **Results** tab me ek row aayegi. Ye check karo:

   | Column | Hona chahiye |
   |---|---|
   | `1_login_id` | `admin@gims` |
   | `3_confirmed` | `true` |
   | `4_identity` | `true` |
   | **`6_password_ok`** | **`true`** ← sab se ahem |
   | `7_settings` | `4` |
   | `8_tables` | `10` |

   ✅ Aisa hai → aage barho.
   ❌ Nahi → neeche **Troubleshooting #1** dekho.

### 2.3 2 Keys copy karo
Supabase → neeche **⚙ Project Settings** → **API**

| Copy karo | Kahan milega |
|---|---|
| **Project URL** | `https://xxxxx.supabase.co` |
| **anon public key** | `eyJhbGciOi...` **ya** `sb_publishable_...` (dono chalengi) |

> `service_role` key ki **zaroorat nahi** — chhoo bhi na.

---

# STEP 3 — Cloudflare Pages (naya page)

### 3.1 Project banao
1. `https://dash.cloudflare.com` → left menu **`Workers & Pages`**
2. **`Create`** → **`Pages`** tab → **`Connect to Git`**
3. GitHub authorize karo → `gims-portal` repo select → **`Begin setup`**

### 3.2 Settings — bilkul aise bharo

| Field | Value |
|---|---|
| **Project name** | `gims-portal` |
| **Production branch** | `main` |
| **Framework preset** | `Next.js (Static HTML Export)` *(nahi mile to `None`)* |
| **Build command** | `npm run build` |
| **Build output directory** | `out` |
| **Root directory** | *(khaali)* |

### 3.3 Environment variables (3 add karo)

**Add variable** dabao → teeno add karo:

| Variable name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase **anon public** key |
| `NODE_VERSION` | `20` |

> ⚠️ Naam bilkul same. Value paste karo — shuru/aakhir me **space na lage**.
> Ye variables **pehli deploy se pehle** add karna zaroori hai.

### 3.4 Deploy
**`Save and Deploy`** → 2–4 minute → link milega: `https://gims-portal-xxx.pages.dev`

---

# STEP 4 — Login + verify

1. Link kholo → login page per **sab se neeche** ye lines dikhni chahiye:
   ```
   v1.3 · key: anon-jwt
   database: xxxxx.supabase.co
   ✅ database ready — admin@gims mil gaya
   ```
   - `v1.3` = naya build ✔
   - `database:` = **tumhara naya Supabase URL** ✔
   - `✅ database ready` = DB theek juda hai ✔

2. **Login ID**: `admin@gims` — **Password**: `admin123` → **Sign in**
3. Andar jaate hi sidebar → **Change password** → naya strong password set karo 🔐

---

# STEP 5 — Portal bharna (class ke andar, step by step) ⚠️

> **Sab kuch class ke andar hai.** Har cheez linked — koi alag/thali hui cheez nahi.

| # | Kahan | Kya karein |
|---|---|---|
| **1** | **Subjects** | Master list: `Programming Fundamentals`, `Calculus`… **ek hi baar** add karo |
| **2** | **Teachers** | naam + login ID + password + **ye kaun se subjects padha sakta hai (tick karo)** |
| **3** | **Classes & Students** → + New class | `BS Computer Science` / `BSCS` / sections `A,B` |
| **4** | Class card per **`Open →`** | Ab 5 tabs khulengi neeche wali |
| **4b** | **Teachers** → **📚** | Subject ke andar us ki classes dikhengi — jis class me padhana hai tick karo |

### Class ke andar 5 tabs

| Tab | Kya karein |
|---|---|
| **Overview** | students, subjects, assignments ka khulasa + jo adhoora hai |
| **Subjects & Teachers** | `+ Subject assign` → subjects tick → **teachers tick** (4+ bhi) → sections tick → Save |
| **Students** | `+ New student` ya `⚡ Bulk add` — **class aur section pehle se set** |
| **Time Table** | is class + section ka time table (class pehle se selected) |
| **Attendance** | is class ka OCR attendance |

> 💡 Students kahin aur se add nahi hote — **sirf class ke andar** se. Is liye koi student adhoora/bina-class nahi reh sakta.

### Phir
| # | Kahan | Kya |
|---|---|---|
| **5** | Class → **Students** | bulk add (roll numbers) |
| **6** | Class → **Time Table** | slot per click → subject/time/room |
| **7** | Class → **Attendance** | photo upload → OCR → check → Save |

---

## 🩺 Dashboard — sab ek nazar me

- **Audit card** — jo adhoora hai (bina teacher subject, bina class student…) — click karke seedha fix
- **Classes grid** — har class card se `Open class →` → wahi 5 tabs

## 👩‍🏫 Teacher ka flow (login ke baad seedha)
```
My Classes  ← kiss kiss class ko parhata hai, turant samne
   └─ class kholein → 3 tabs
        Assignments  → har subject ke saamne  ➕ Nayi assignment  |  📥 Check
        To Review    → is class ki submissions
        Time Table   → is class ka time table
```
Sidebar: To Review · Late Submissions · My Schedule · Profile

## 👨‍🎓 Student ka flow
```
Subjects → subject → assignment → file upload
```

---

# 🆘 Troubleshooting

| # | Masla | Hal |
|---|---|---|
| 1 | `6_password_ok = false` ya row khaali | `1-SETUP-DATABASE.sql` dobara chalao (safe). Phir bhi na ho → **Authentication → Users → Add user**: email `admin.1@gims.internal`, password `admin123`, Auto Confirm ✔ → phir SQL Editor: `select public.ensure_admin('admin@gims','admin123','admin.1@gims.internal');` |
| 2 | Login page per **❌ database se rabta nahi** | Cloudflare ki keys ghalat → Settings → Environment variables → dobara paste → **Retry deployment** |
| 3 | Login page per **⚠️ admin@gims nahi mila** | `1-SETUP-DATABASE.sql` nahi chali → chalao |
| 4 | **Password ghalat hai** | Login page per jo `database:` likha hai wo check karo — wahi project ho jisme SQL chalayi thi |
| 5 | Login ke baad **wapas login page** | SQL Editor me: `notify pgrst, 'reload schema';` → 10 sec → dobara login |
| 6 | Build fail: **out not found** | Build output directory `out` karo (STEP 3.2) |
| 7 | Build fail: **next not found** | `package.json` upload nahi hua → dobara upload karo |
| 8 | **Env var change karne ke baad bhi purana chal raha** | Deployments → ⋯ → **Retry deployment** |
| 9 | Student ko **subject nahi dikhta** | Admin → Students → Edit → Class + Section set karo |
| 10 | **OCR slow** | Pehli baar model download hota hai (~5 MB). Achi roshni wali photo do |

---

# ✅ FINAL CHECKLIST

- [ ] GitHub repo (private) + saari files upload
- [ ] Supabase project bana
- [ ] `1-SETUP-DATABASE.sql` chali → `6_password_ok = true`
- [ ] URL + anon key copy
- [ ] Cloudflare project + 3 env vars + deploy
- [ ] Login page per `v1.3` + `✅ database ready`
- [ ] `admin@gims` / `admin123` se login + password change
- [ ] Class → Teacher → Subject → Students (bulk)
- [ ] Time table
- [ ] Ek attendance OCR test
- [ ] Ek student + ek teacher se login test

**Ho gaya 🎉** — ab aage jo add karna hai wo `docs/FEATURES.md` me likha hai (reminder, plagiarism check, marksheet PDF…).
