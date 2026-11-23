/* Parser Laporan Ketersediaan Dana Detail (PDF) -> data bidang PPA I. Berjalan di browser dan Node. */
(function (root) {
  const KODE_PPA1 = ["4715.EBA.994.002.HB", "4715.EBA.994.002.HH", "6212.FAL.001.100.0D", "6213.FAL.003.100.0A", "6213.FAL.003.100.0C"];
  const ALIAS = { "4175": "4715" };
  const NUM = "-?[\\d,]+";
  const ROW = new RegExp(`^(.+?)\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(-?[\\d.]+)(?:\\s*%)?\\s+(${NUM})$`);
  const NUMONLY = new RegExp(`^(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(-?[\\d.]+)(?:\\s*%)?\\s+(${NUM})$`);
  const SKIP = ["Periode ", "Satuan Kerja", "LAPORAN KETERSEDIAAN", "613739", "Realisasi TA", "%", "KANWIL", "Periode Ini", "SISA", "ANGGARAN", "Hal ", "Periode Lalu", "Per Program", "Unit Organisasi", "Kementerian", "Pagu Revisi", "*Lock", "Lock Pagu"];
  const n = (s) => parseInt(s.replace(/,/g, ""), 10);

  function level(c) {
    if (/^[A-Z]{2}\.\d{4}$/.test(c)) return "kegiatan";
    if (/^[A-Z]{3}$/.test(c)) return "kro";
    if (/^[A-Z]{3}\.[A-Z0-9]{3}$/.test(c)) return "ro";
    if (/^\d{3}$/.test(c)) return "komponen";
    if (/^\d{3}\.[A-Z0-9]{2}$/.test(c)) return "sub";
    if (/^\d{6}$/.test(c)) return "akun";
    if (/^\d{6}\.$/.test(c)) return "item";
    return null;
  }
  function norm(k) {
    const p = k.split(".");
    if (p.length !== 5) throw new Error("Format kode salah: " + k);
    return `${ALIAS[p[0]] || p[0]}.${p[1]}.${p[2]}.${p[3]}.${p[4].length === 1 ? "0" + p[4] : p[4]}`;
  }

  // lines: array string (satu per baris PDF). meta: {sumber}
  function parseLines(allLines, sumber) {
    let periode = "";
    const lines = [];
    for (const raw of allLines) {
      const ln = raw.trim();
      const m = /^Periode\s+([A-Za-z]+\s+\d{4})/.exec(ln);
      if (m && !periode) periode = m[1];
      if (ln && !SKIP.some((s) => ln.startsWith(s)) && !ln.includes("JUMLAH SELURUHNYA")) lines.push(ln);
    }
    const rows = [];
    let pending = null, wrapOpen = false;
    for (const ln of lines) {
      let m = ROW.exec(ln), head = null, v = null;
      if (m) {
        head = m[1];
        v = { pagu: n(m[2]), lock: n(m[3]), lalu: n(m[4]), ini: n(m[5]), sd: n(m[6]), sisa: n(m[8]) };
        wrapOpen = false;
      } else if (pending && (m = NUMONLY.exec(ln))) {
        head = pending; pending = null; wrapOpen = true;
        v = { pagu: n(m[1]), lock: n(m[2]), lalu: n(m[3]), ini: n(m[4]), sd: n(m[5]), sisa: n(m[7]) };
      } else {
        const first = ln.split(/\s+/)[0];
        if (level(first)) pending = ln;
        else if (wrapOpen && rows.length) { rows[rows.length - 1].name += " " + ln; wrapOpen = false; }
        else if (pending) pending += " " + ln;
        continue;
      }
      if (m && pending && !level(head.split(/\s+/)[0])) { head = pending + " " + head; }
      pending = null;
      const pm = /^([A-Z]{2})\s?(Program.*)$/.exec(head), gm = /^([A-Z]{3})([A-Z][a-z].*)$/.exec(head);
      let code, name;
      if (pm) { code = pm[1]; name = pm[2]; }
      else if (gm) { code = gm[1]; name = gm[2]; }
      else { const i = head.indexOf(" "); code = i > 0 ? head.slice(0, i) : head; name = i > 0 ? head.slice(i + 1) : ""; }
      const lv = pm ? "program" : level(code);
      if (!lv) continue;
      rows.push({ lv, code: code.replace(/\.$/, ""), name: name.trim(), ...v });
    }
    const want = new Set(KODE_PPA1.map(norm));
    const path = {}, out = [], found = new Set();
    let keg = "", ro = "", kmp = "", curSub = null, curAkun = null;
    const pick = (r) => ({ name: r.name, pagu: r.pagu, lock: r.lock, lalu: r.lalu, ini: r.ini, sd: r.sd, sisa: r.sisa });
    for (const r of rows) {
      const lv = r.lv;
      if (["program", "kegiatan", "kro", "ro", "komponen"].includes(lv)) {
        path[lv] = `${r.code} ${r.name}`; curSub = curAkun = null;
        if (lv === "kegiatan") keg = r.code.split(".")[1];
        if (lv === "ro") ro = r.code;
        if (lv === "komponen") kmp = r.code;
      } else if (lv === "sub") {
        const key = `${keg}.${ro}.${kmp}.${r.code.split(".")[1]}`;
        curAkun = null;
        if (want.has(key)) { found.add(key); curSub = { kode: key, ...pick(r), path: { ...path }, akun: [] }; out.push(curSub); } else curSub = null;
      } else if (lv === "akun" && curSub) {
        curAkun = { kode: r.code, ...pick(r), item: [] }; curSub.akun.push(curAkun);
      } else if (lv === "item" && curAkun) {
        curAkun.item.push({ kode: r.code, ...pick(r) });
      }
    }
    const hilang = [...want].filter((k) => !found.has(k)).sort();
    return { data: { periode, sumber: sumber || "", subkomponen: out }, hilang };
  }

  // Ekstrak baris teks dari dokumen pdf.js (getDocument(...).promise). Memperhitungkan rotasi halaman.
  async function linesFromPdf(pdf) {
    const lines = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p), vt = page.getViewport({ scale: 1 }).transform;
      const items = (await page.getTextContent()).items.filter((i) => typeof i.str === "string" && i.str !== "").map((i) => {
        const tx = i.transform[4], ty = i.transform[5];
        return { str: i.str, x: vt[0] * tx + vt[2] * ty + vt[4], y: vt[1] * tx + vt[3] * ty + vt[5], w: i.width || 0 };
      });
      const rowsY = [];
      for (const it of items.sort((a, b) => a.y - b.y)) {
        const r = rowsY.find((q) => Math.abs(q.y - it.y) <= 3);
        if (r) r.items.push(it); else rowsY.push({ y: it.y, items: [it] });
      }
      rowsY.sort((a, b) => a.y - b.y);
      for (const r of rowsY) {
        r.items.sort((a, b) => a.x - b.x);
        let s = "", end = null;
        for (const it of r.items) {
          if (it.str.trim() === "") { if (!s.endsWith(" ")) s += " "; end = it.x + it.w; continue; }
          if (end !== null && it.x - end > 1 && !s.endsWith(" ") && !it.str.startsWith(" ")) s += " ";
          s += it.str; end = it.x + it.w;
        }
        lines.push(s.replace(/\s+/g, " ").trim());
      }
    }
    return lines;
  }

  const api = { parseLines, linesFromPdf, KODE_PPA1 };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.ParserLaporan = api;
})(typeof self !== "undefined" ? self : this);
