# Dashboard Anggaran Bidang PPA I – Kanwil DJPb Riau

Situs statis (HTML + Chart.js) yang membaca `public/data.json`. Tanpa build step, langsung jalan di Vercel.

## Struktur
- `public/index.html`  tampilan KPI, grafik, tabel bertingkat
- `public/data.json`   data hasil ekstrak PDF (dibuat oleh skrip)
- `scripts/requirements.txt` dependensi skrip (sengaja tidak di root agar Vercel tidak mengira ini proyek Python)
- `scripts/parse_pdf.py`  ekstrak PDF Laporan Ketersediaan Dana Detail → `data.json`

## Deploy pertama
1. Buat repo GitHub, lalu `git init && git add . && git commit -m "init" && git remote add origin <url> && git push -u origin main`
2. vercel.com → Add New → Project → pilih repo → Deploy (biarkan Framework Preset = Other).

## Update dengan PDF baru
```bash
pip install -r scripts/requirements.txt
python scripts/parse_pdf.py "Laporan_terbaru.pdf"   # menimpa public/data.json
git add public/data.json && git commit -m "update data" && git push
```
Vercel otomatis deploy ulang setelah push. Jika ada kode alokasi baru, ubah `KODE_PPA1` di `scripts/parse_pdf.py`.
