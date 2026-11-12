# Dashboard Anggaran Bidang PPA I – Kanwil DJPb Riau

Situs statis (HTML + Chart.js) dengan login dan fungsi serverless Vercel (folder `api/`).

## Login
Pengunjung melihat halaman login lebih dulu. Bawaan: pengguna `ppa1`, kata sandi `ppa1` (sesi 30 hari per browser). Data anggaran (`private/data.json`) hanya dikirim server setelah login.
Untuk mengganti, isi variabel `LOGIN_USER` dan `LOGIN_PASS` di Vercel (Settings → Environment Variables), lalu Redeploy; semua sesi lama otomatis keluar.
Rencana kegiatan disimpan di Upstash Redis, tanpa kata sandi tambahan.

## Setup sekali di Vercel
1. Project → Storage → hubungkan **Upstash Redis** (agar rencana kegiatan tersimpan dan dibagi ke semua pengguna).
2. Deployments → Redeploy.

## Update data dari PDF (cukup upload)
GitHub → folder `data` → Add file → Upload files → PDF terbaru → Commit.
GitHub Actions mengekstrak ke `private/data.json`, lalu Vercel deploy ulang otomatis.
(Di repo GitHub, Settings → Actions → General → Workflow permissions = Read and write.)

## Struktur
- `public/index.html` tampilan; `api/` login, data, rencana; `private/data.json` data hasil ekstrak
- `data/` tempat unggah PDF; `.github/workflows/update-data.yml` otomatisasi
- `scripts/parse_pdf.py` parser (ubah `KODE_PPA1` jika alokasi berubah)

## Catatan keamanan
Repo GitHub sebaiknya **private**: folder `data/` berisi PDF dan `private/data.json` berisi angka anggaran.
