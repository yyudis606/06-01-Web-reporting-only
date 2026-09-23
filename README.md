# 06-01-Web-reporting-only

Dashboard progress reporting berbasis **Next.js (App Router)**. Menampilkan data
progress project (chart, tabel, ringkasan) secara publik di `/dashboard`, dan
menyediakan panel `/admin` untuk mengubah konten dashboard serta mengelola user,
dilindungi login **SuperTokens**.

Live production: https://mywebreporting.vercel.app

---

## Cara Kerja Website

1. **Halaman publik (`/` dan `/dashboard`)** — siapa saja bisa membuka, tanpa
   login. Data diambil server-side dari `app/server/contentStore.js` (baca
   tabel `app_content` di Postgres, atau fallback ke `data/defaultDashboardContent.js`
   kalau `DATABASE_URL` belum diset), lalu diturunkan menjadi angka/chart oleh
   `data/dashboardModel.js`.
2. **Login admin (`/auth`)** — form login custom di atas SuperTokens
   (`supertokens-auth-react`). User cukup mengetik **username** (mis. `yyudis606`),
   lalu di frontend dikonversi jadi email internal `username@devanycode.local`
   (lihat `app/config/admin.js`) sebelum dikirim ke SuperTokens.
3. **Panel admin (`/admin`)** — dibungkus `SessionAuth`, wajib login. Isi
   panelnya menyesuaikan **role** user (Administrator bisa semua, role lain
   hanya bagian tertentu — lihat tabel role di bawah).
4. **API admin (`app/api/admin/**`)** — semua route memverifikasi session
   SuperTokens (`withRequiredSession`) lalu mengecek permission role sebelum
   mengizinkan baca/ubah data (lihat `app/server/adminAuth.js`).
5. **Penyimpanan konten** — perubahan dari panel admin disimpan sebagai JSON
   di tabel `app_content` (Postgres), dibaca kembali oleh halaman dashboard
   publik. Autentikasi & role user disimpan di SuperTokens (Managed Service),
   **terpisah** dari database Postgres dashboard.
6. **Versi aplikasi** — angka `vX.Y.Z` di footer dashboard diambil otomatis
   dari `version` di `package.json` (lihat bagian Deploy & Versioning).

---

## Struktur & Penempatan Kode

```
app/
  page.jsx                       # "/" -> redirect render ke DashboardPage
  layout.jsx                     # Root layout, bungkus <SuperTokensProvider>
  config/
    admin.js                     # Definisi role & permission, username <-> email
    appInfo.js                   # appInfo SuperTokens (nama app, domain, dsb)
    backend.js                   # Init SuperTokens sisi server (Node SDK)
    frontend.js                  # Init SuperTokens sisi browser (React SDK)
    password.js                  # Aturan validasi password
  components/
    supertokensProvider.jsx      # Wrapper SuperTokensAuthWrapper untuk client

  auth/[[...path]]/
    page.jsx                     # Halaman login/signup custom (SuperTokens Pre-Built UI + form sendiri)
    style.scss

  dashboard/
    page.jsx                     # Halaman dashboard publik (server component)
    style.scss
    _components/
      DashboardContent.jsx       # UI dashboard (chart, kartu ringkasan, footer versi)
      charts/
        LineChart.jsx
        BarChart.jsx
        PieChart.jsx
        Card.jsx

  admin/
    page.jsx                     # Halaman panel admin (dibungkus <SessionAuth>)
    style.scss
    _components/
      AdminContent.jsx           # UI panel admin (edit konten, kelola user, dll)

  api/
    content/route.js             # GET data dashboard publik (untuk fetch client bila perlu)
    progress/route.js            # GET data progress (format API terpisah)
    export/route.js              # GET export data ke Excel (pakai exceljs)
    auth/[[...path]]/route.js    # Handler resmi SuperTokens (login/signup/session)
    admin/
      me/route.js                # GET info session admin yang sedang login
      bootstrap/route.js         # POST: klaim role administrator pertama kali (pakai BOOTSTRAP_SECRET)
      content/route.js           # GET/PATCH konten dashboard (butuh permission content:*)
      change-password/route.js   # PATCH ganti password akun sendiri
      profile/route.js           # PATCH ubah display name akun sendiri
      activity-log/route.js      # GET/DELETE log aktivitas (butuh isAdministrator/userManager)
      storage-usage/route.js     # GET estimasi pemakaian storage/DB
      users/route.js             # GET daftar semua user (butuh users:manage)
      users/[userId]/route.js            # DELETE hapus akun user
      users/[userId]/password/route.js   # PATCH reset password user lain
      users/[userId]/roles/route.js      # PATCH ubah role user lain

  server/                         # Kode server-only (tidak pernah dikirim ke browser)
    adminAuth.js                  # Guard session, cek permission, kelola role/user SuperTokens
    contentStore.js               # Baca/tulis tabel app_content di Postgres
    database.js                   # Pool koneksi Postgres (pg), konfigurasi TLS
    activityLog.js                # Simpan/baca log aktivitas admin
    storageUsage.js                # Hitung estimasi penggunaan storage

data/
  dashboardData.js                # Data mentah contoh/statik
  dashboardModel.js                # Fungsi derive: dari content mentah -> data siap-pakai (chart, summary)
  defaultDashboardContent.js       # Isi default dashboard bila DB kosong/belum ada
  teamWorkInput.js                 # Struktur data input kerja tim harian

scss/
  globals.scss                     # Style global (di-import dari app/layout.jsx)

public/images/brand/               # Logo/aset brand devANYcode

package.json                       # Scripts (dev/build/deploy) & versi aplikasi
.env.local / .env.example          # Konfigurasi environment (lihat bagian Environment Variables)
```

**Aturan penempatan kode di proyek ini:**
- Halaman & komponen UI per fitur → folder `app/<fitur>/` masing-masing
  (`dashboard/`, `admin/`, `auth/`), dengan sub-komponen di `_components/`
  (prefix `_` = folder privat, tidak jadi route Next.js) dan style
  `style.scss` khusus halaman itu.
- Chart reusable (Line/Bar/Pie/Card) → `app/dashboard/_components/charts/`.
- Logika yang **harus** jalan di server (query DB, secret, SuperTokens Admin
  API) → wajib taruh di `app/server/`, jangan di komponen client.
- Endpoint HTTP → `app/api/**/route.js`, mengikuti struktur folder = struktur
  URL bawaan Next.js App Router.
- Konfigurasi/aturan bisnis yang dipakai di banyak tempat (role, appInfo,
  password policy) → `app/config/`.
- Data contoh/statik & fungsi transformasi data → `data/`.

---

## Role & Permission

Didefinisikan di [`app/config/admin.js`](/home/yos/Documents/Coding/02_dev_any_code/Example-on-the-landing-page/06-Web-progress/06-01-Web-reporting-only/app/config/admin.js):

| Role              | Bisa apa                                              |
|-------------------|--------------------------------------------------------|
| `administrator`   | Semua akses + kelola user (role & password) — role tertinggi |
| `userManager`     | Kelola user (reset password, hapus, ubah role)         |
| `textEditor`      | Edit teks/judul dashboard                              |
| `projectEditor`   | Edit target project (total site, target/hari)          |
| `scheduleEditor`  | Edit jadwal notifikasi update                          |
| `teamEditor`      | Kelola daftar team                                     |
| `dailyWorkEditor` | Input hasil kerja harian per team                      |
| `siteEditor`      | Kelola data site (nama, status, catatan)                |

Satu user bisa punya lebih dari satu role. Hanya `administrator` yang bisa
mengubah/menghapus akun sesama `administrator`.

---

## Environment Variables

Salin `.env.example` menjadi `.env.local`, lalu isi:

| Variable                       | Kegunaan                                                             |
|---------------------------------|-----------------------------------------------------------------------|
| `NEXT_PUBLIC_API_DOMAIN`        | Domain API (untuk SuperTokens), harus sama dengan domain deploy      |
| `NEXT_PUBLIC_WEBSITE_DOMAIN`    | Domain website publik                                                |
| `SUPERTOKENS_CONNECTION_URI`    | URL Core SuperTokens (**Managed Service** dari supertokens.com)      |
| `SUPERTOKENS_API_KEY`           | API key Core SuperTokens Managed Service                              |
| `API_KEYS`                      | Kunci internal tambahan (mis. proteksi endpoint tertentu)             |
| `BOOTSTRAP_SECRET`              | Secret satu kali untuk klaim role `administrator` pertama (lihat `api/admin/bootstrap`) |
| `DATABASE_URL`                  | Connection string Postgres (untuk konten dashboard, Railway Postgres) |
| `DATABASE_SSL_CA` / `DATABASE_TLS_SERVERNAME` | Sertifikat & servername TLS untuk koneksi Postgres yang aman |
| `RAILWAY_PROJECT_TOKEN` / `RAILWAY_PROJECT_ID` | (Opsional) Project Token Railway, dipakai panel admin untuk menampilkan kapasitas & pemakaian volume Postgres yang akurat (bagian Cloud Storage). Kalau kosong, dipakai estimasi dari query SQL sebagai fallback. |

> ⚠️ **SuperTokens sekarang pakai Managed Service** (bukan lagi Railway Core
> self-hosted). `DATABASE_URL` (Postgres untuk konten dashboard) tetap di
> Railway dan tidak berubah.
>
> **`RAILWAY_PROJECT_TOKEN`** dibuat lewat Railway Dashboard → Project
> `web-reporting-supertokens` → Settings → Tokens → New Token (pilih
> environment `production`). Token ini hanya bisa membaca info project yang
> dipilih, tidak bisa dipakai untuk mengakses project/akun Railway lain.

---

## Command yang Dipakai

```bash
# Install dependency
npm install

# Jalankan development server (http://localhost:3000)
npm run dev

# Build production (validasi sebelum deploy)
npm run build

# Jalankan hasil build secara lokal (setelah npm run build)
npm run start

# Cek kualitas kode dengan ESLint (aturan Next.js)
npm run lint

# Deploy ke Vercel production SEKALIGUS auto-bump versi patch
# (mis. v1.0.3 -> v1.0.4), lalu tampil di footer dashboard
npm run deploy

# Deploy ke Vercel production TANPA mengubah versi
# (dipakai untuk perubahan kecil/tidak signifikan)
vercel --prod
```

> Command `npm run deploy` menjalankan `predeploy` (`npm version patch
> --no-git-tag-version --allow-same-version`) lalu `next build && vercel
> deploy --prod --yes`. Perubahan versi hanya tersimpan di `package.json`
> (tidak membuat git tag).

---

## Deploy & Versioning

- Versi aplikasi (`vX.Y.Z` di footer dashboard) = field `version` di
  `package.json`.
- **Perubahan besar** → `npm run deploy` (auto naik versi patch).
- **Perubahan kecil/kosmetik** → `vercel --prod` saja (versi tidak berubah).
- Env var baru/berubah di Vercel **baru berlaku setelah deploy baru** dibuat —
  mengubah env var lewat `vercel env add/rm` saja tidak memengaruhi deployment
  yang sudah berjalan.

---

## Infrastruktur

- **Hosting**: Vercel (production: https://mywebreporting.vercel.app)
- **Autentikasi**: SuperTokens Managed Service (EmailPassword + UserRoles + UserMetadata)
- **Database konten dashboard**: Postgres di Railway (tabel `app_content`, key-value JSON)
- **Aset statis**: `public/images/brand/` (logo devANYcode)
