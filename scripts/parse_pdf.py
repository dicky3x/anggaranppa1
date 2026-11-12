#!/usr/bin/env python3
"""Ekstrak data bidang PPA I dari PDF Laporan Ketersediaan Dana Detail -> private/data.json
Pakai: python scripts/parse_pdf.py path/laporan.pdf
"""
import re, sys, json, pdfplumber
from pathlib import Path

# ---- KONFIGURASI: kode alokasi bidang PPA I --------------------------------
# Format: kegiatan.KRO.RO.komponen.subkomponen (subkomponen 1 huruf otomatis jadi 0X)
KODE_PPA1 = [
    "4715.EBA.994.002.HB",
    "4715.EBA.994.002.HH",
    "6212.FAL.001.100.0D",
    "6213.FAL.003.100.0A",
    "6213.FAL.003.100.0C",
]
ALIAS_KEGIATAN = {"4175": "4715"}  # di PDF kegiatannya WA.4715 (4175 = salah ketik)
# -----------------------------------------------------------------------------

NUM = r"-?[\d,]+"
ROW = re.compile(rf"^(?P<head>.+?)\s+(?P<pagu>{NUM})\s+(?P<lock>{NUM})\s+(?P<lalu>{NUM})\s+"
                 rf"(?P<ini>{NUM})\s+(?P<sd>{NUM})\s+(?P<pct>-?[\d.]+)(?:\s*%)?\s+(?P<sisa>{NUM})$")
NUMONLY = re.compile(rf"^(?P<pagu>{NUM})\s+(?P<lock>{NUM})\s+(?P<lalu>{NUM})\s+(?P<ini>{NUM})\s+(?P<sd>{NUM})\s+(?P<pct>-?[\d.]+)(?:\s*%)?\s+(?P<sisa>{NUM})$")
SKIP = ("Periode ", "Satuan Kerja", "LAPORAN KETERSEDIAAN", "613739", "Realisasi TA", "%", "KANWIL",
        "Periode Ini", "SISA", "ANGGARAN", "Hal ", "Periode Lalu", "Per Program", "Unit Organisasi",
        "Kementerian", "Pagu Revisi", "*Lock", "Lock Pagu")
n = lambda s: int(s.replace(",", ""))

def level(code):
    if re.fullmatch(r"[A-Z]{2}\.\d{4}", code): return "kegiatan"
    if re.fullmatch(r"[A-Z]{3}", code): return "kro"
    if re.fullmatch(r"[A-Z]{3}\.[A-Z0-9]{3}", code): return "ro"
    if re.fullmatch(r"\d{3}", code): return "komponen"
    if re.fullmatch(r"\d{3}\.[A-Z0-9]{2}", code): return "sub"
    if re.fullmatch(r"\d{6}", code): return "akun"
    if re.fullmatch(r"\d{6}\.", code): return "item"
    return None

def norm(kode):
    k, kro, ro, kmp, sub = kode.split(".") if kode.count(".") == 4 else (None,) * 5
    if k is None:  # 6212.FAL.001.100.0D
        raise ValueError(kode)
    return f"{ALIAS_KEGIATAN.get(k, k)}.{kro}.{ro}.{kmp}.{sub.zfill(2) if len(sub)==1 else sub}"

def parse(pdf_path):
    lines, periode = [], ""
    with pdfplumber.open(pdf_path) as pdf:
        for p in pdf.pages:
            for ln in (p.extract_text() or "").splitlines():
                ln = ln.strip()
                m = re.match(r"Periode\s+([A-Za-z]+\s+\d{4})", ln)
                if m and not periode: periode = m.group(1)
                if ln and not ln.startswith(SKIP) and "JUMLAH SELURUHNYA" not in ln:
                    lines.append(ln)
    ctx, rows, pending, wrap_open = {}, [], None, False
    for ln in lines:
        m = ROW.match(ln)
        head = m["head"] if m else None
        if not m and pending and NUMONLY.match(ln):  # angka di baris terpisah dari uraian
            m, head, pending = NUMONLY.match(ln), pending, None
            wrap_open = True
        elif not m:
            if level(ln.split()[0]): pending = ln
            elif wrap_open and rows: rows[-1]["name"] += " " + ln; wrap_open = False
            elif pending: pending += " " + ln
            continue
        else:
            wrap_open = False
        if pending and not level(head.split()[0]):
            head, pending = pending + " " + head, None
        else:
            pending = None
        pm = re.match(r"^([A-Z]{2})\s?(Program.*)$", head)
        code, name = (pm.group(1), pm.group(2)) if pm else head.split(" ", 1) if " " in head else (head, "")
        lv = "program" if pm else level(code)
        if not lv: continue
        vals = dict(pagu=n(m["pagu"]), lock=n(m["lock"]), lalu=n(m["lalu"]), ini=n(m["ini"]),
                    sd=n(m["sd"]), sisa=n(m["sisa"]))
        rows.append(dict(lv=lv, code=code.rstrip("."), name=name.strip(), **vals))
    # bangun pohon untuk subkomponen terpilih
    want = {norm(k) for k in KODE_PPA1}
    path, out, cur_sub, cur_akun, found = {}, [], None, None, set()
    for r in rows:
        lv = r["lv"]
        if lv in ("program", "kegiatan", "kro", "ro", "komponen"):
            path[lv] = f'{r["code"]} {r["name"]}'; cur_sub = cur_akun = None
            if lv == "kegiatan": keg = r["code"].split(".")[1]
            if lv == "ro": ro = r["code"]
            if lv == "kro": kro = r["code"]
            if lv == "komponen": kmp = r["code"]
        elif lv == "sub":
            key = f"{keg}.{ro}.{kmp}.{r['code'].split('.')[1]}"
            cur_akun = None
            if key in want:
                found.add(key)
                cur_sub = dict(kode=key, **{k: r[k] for k in ("name","pagu","lock","lalu","ini","sd","sisa")},
                               path=dict(path), akun=[])
                out.append(cur_sub)
            else:
                cur_sub = None
        elif lv == "akun" and cur_sub is not None:
            cur_akun = dict(kode=r["code"], **{k: r[k] for k in ("name","pagu","lock","lalu","ini","sd","sisa")}, item=[])
            cur_sub["akun"].append(cur_akun)
        elif lv == "item" and cur_akun is not None:
            cur_akun["item"].append(dict(kode=r["code"], **{k: r[k] for k in ("name","pagu","lock","lalu","ini","sd","sisa")}))
    missing = want - found
    if missing: print("PERINGATAN, kode tidak ditemukan:", sorted(missing), file=sys.stderr)
    return dict(periode=periode, sumber=Path(pdf_path).name, subkomponen=out)

if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(__doc__)
    data = parse(sys.argv[1])
    Path(__file__).resolve().parent.parent.joinpath("private/data.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    t = sum(s["pagu"] for s in data["subkomponen"])
    print(f'OK: {len(data["subkomponen"])} subkomponen, total pagu {t:,}')
