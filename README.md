# Dashboard Anggaran Bidang PPA I – Kanwil DJPb Riau

Situs statis (HTML + Chart.js) dengan login dan fungsi serverless Vercel (folder `api/`).

## Login
Pengunjung melihat halaman login lebih dulu. Bawaan: pengguna `ppa1`, kata sandi `ppa1` (sesi 30 hari per browser). Data anggaran (`private/data.json`) hanya dikirim server setelah login.
Untuk mengganti atau menambah pengguna, isi variabel `LOGIN_USERS` di Vercel (Settings → Environment Variables), format `user1:sandi1;user2:sandi2`, lalu Redeploy; semua sesi lama otomatis keluar. Jika `LOGIN_USERS` diisi, hanya daftar itu yang berlaku (ppa1/ppa1 tidak lagi bisa masuk kecuali ikut ditulis). Alternatif satu pengguna: `LOGIN_USER` dan `LOGIN_PASS`.
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

## Menambah pengguna dan peran
Isi variabel `LOGIN_USERS` di Vercel (Settings → Environment Variables), lalu Redeploy. Format: `pengguna:sandi:peran`, dipisah titik koma.
Contoh: `ppa1:ppa1:edit;tamu:sandi123:view`
- `edit` = boleh menambah, mengubah, dan menghapus rencana. Peran dikosongkan = `edit`.
- `view` = hanya melihat; tombol input disembunyikan dan server menolak penyimpanan (403).
- Jika `LOGIN_USERS` diisi, hanya daftar itu yang berlaku (`ppa1`/`ppa1` bawaan tidak otomatis ikut; tulis lagi jika masih dipakai).
- Jangan pakai `;` di sandi. Mengubah daftar lalu redeploy mengeluarkan semua sesi lama.
