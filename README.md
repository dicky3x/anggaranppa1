# Dashboard Anggaran Bidang PPA I – Kanwil DJPb Riau

Situs statis (HTML + Chart.js) dengan login dan fungsi serverless Vercel (folder `api/`).

## Login
Pengunjung melihat halaman login lebih dulu. Bawaan: pengguna `ppa1`, kata sandi `ppa1` (sesi 30 hari per browser). Data anggaran (`private/data.json`) hanya dikirim server setelah login.
Untuk mengganti atau menambah pengguna, isi variabel `LOGIN_USERS` di Vercel (Settings → Environment Variables), format `user1:sandi1;user2:sandi2`, lalu Redeploy; semua sesi lama otomatis keluar. Jika `LOGIN_USERS` diisi, hanya daftar itu yang berlaku (ppa1/ppa1 tidak lagi bisa masuk kecuali ikut ditulis). Alternatif satu pengguna: `LOGIN_USER` dan `LOGIN_PASS`.
Rencana kegiatan disimpan di Upstash Redis, tanpa kata sandi tambahan.

## Setup sekali di Vercel
1. Project → Storage → hubungkan **Upstash Redis** (agar rencana kegiatan tersimpan dan dibagi ke semua pengguna).
2. Deployments → Redeploy.

## Unggah PDF terbaru langsung dari situs (tanpa GitHub)
Login sebagai akun `edit` → tombol **Unggah PDF terbaru** (kanan atas) → pilih PDF Laporan Ketersediaan Dana Detail → periksa pratinjau → **Terapkan**.
PDF dibaca di browser Anda (file PDF tidak dikirim ke server); hanya angka bidang PPA I hasil bacaan yang disimpan ke database (Upstash Redis) dan langsung tampil untuk semua pengguna.
Membutuhkan Upstash Redis terhubung (lihat "Setup sekali di Vercel"). Data hasil unggahan menggantikan `private/data.json` bawaan repo. Daftar kode alokasi PPA I ada di `public/parser.js` (`KODE_PPA1`) dan `scripts/parse_pdf.py`.

## Lembur Pegawai (tab kedua)
- Kalender lembur per pegawai, jadwal SPTPL, dan konfirmasi **Lembur** / **Tidak lembur** per tanggal.
- Pagu lembur per orang (s.d. akhir tahun) dan tarif per orang dapat diubah lewat tombol **Ubah**; tidak terkait data PDF.
- Lembur dilaksanakan mengurangi sisa pagu. Tarif mengikuti jenis hari (weekday/weekend atau centang hari libur) dan jam.
- Peringatan: jam melebihi batas tarif (weekday maks 2 jam, weekend 2-4 jam), jam di bawah minimum, jam aktual melebihi SPTPL, pagu tidak cukup, SPTPL lewat tanggal belum dikonfirmasi.
- Rekomendasi hari/jam lembur mendatang agar pagu terpakai optimal (jumlah hari paling sedikit).
- Data disimpan di Upstash Redis (kunci `ppa1:lembur`). Hanya akun `edit` yang bisa mengubah.

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
