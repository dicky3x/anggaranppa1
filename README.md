# Dashboard Anggaran Bidang PPA I – Kanwil DJPb Riau

## Update data (cukup upload PDF)
1. Buka repo di GitHub → folder `data` → Add file → Upload files → pilih PDF terbaru → Commit changes.
2. Tunggu 1-3 menit: tab Actions mengekstrak PDF ke `public/data.json`, lalu Vercel deploy ulang otomatis.

## Struktur
- `public/index.html` tampilan, `public/data.json` data hasil ekstrak
- `data/` tempat unggah PDF, `.github/workflows/update-data.yml` otomatisasi
- `scripts/parse_pdf.py` parser (ubah `KODE_PPA1` jika alokasi berubah)
