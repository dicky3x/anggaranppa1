/* Inti hitung lembur: tarif, alokasi pagu, peringatan, rekomendasi, dan reducer data. Dipakai server (api/lembur.js) dan browser. */
(function (root) {
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const mk = (t) => { const [y, m, d] = t.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (t, n) => { const d = mk(t); d.setDate(d.getDate() + n); return ymd(d); };
  const validDate = (t) => typeof t === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t) && ymd(mk(t)) === t;
  const dow = (t) => mk(t).getDay();
  const dayType = (t, libur) => (libur || dow(t) === 0 || dow(t) === 6 ? "weekend" : "weekday");
  const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const R = (n) => "Rp" + Math.round(n).toLocaleString("id-ID");
  const MAXH = { weekday: 2, weekend: 4 }, MINH = { weekday: 1, weekend: 2 };

  const T = (wd2, wd1, we2, we3, we4) => ({ wd1, wd2, we2, we3, we4 });
  const G3 = () => T(97000, 30000, 157000, 217000, 277000), G2 = () => T(83000, 24000, 131000, 179000, 227000);
  function seed() {
    const P = (i, nama, gol, tarif) => ({ id: "p" + i, nama, gol, pagu: 411778, tarif });
    return { v: 1, pegawai: [
      P(1, "Puji Hartanto", 4, T(113000, 36000, 185000, 257000, 329000)), P(2, "Andi M/Sofyan W", 3, G3()), P(3, "Moh. Firdaus", 3, G3()),
      P(4, "Denny A", 3, G3()), P(5, "Said S", 3, G3()), P(6, "Silvia", 2, G2()), P(7, "Rizal", 3, G3()), P(8, "Dicky", 3, G3()), P(9, "Michael A", 2, G2()),
    ], entri: [] };
  }

  // Tarif untuk 'h' jam. Di luar tabel: minimum tidak dibayar, kelebihan dari batas maksimal tidak dibayar.
  function tarifFor(peg, type, h) {
    h = Math.floor(Number(h) || 0);
    const t = peg.tarif, warn = [];
    if (h < MINH[type]) {
      warn.push({ lv: "bad", t: `Lembur ${type === "weekday" ? "hari kerja" : "weekend/libur"} kurang dari ${MINH[type]} jam: tidak ada tarif, kemungkinan tidak dibayar.` });
      return { amount: 0, hPaid: 0, warn };
    }
    const hp = Math.min(h, MAXH[type]);
    if (h > MAXH[type]) warn.push({ lv: "bad", t: `Lembur ${h} jam melebihi batas tarif ${type === "weekday" ? "hari kerja" : "weekend/libur"} (maks ${MAXH[type]} jam): kelebihan ${h - MAXH[type]} jam kemungkinan tidak dibayar.` });
    const amount = type === "weekday" ? (hp === 1 ? t.wd1 : t.wd2) : t["we" + hp];
    return { amount: amount || 0, hPaid: hp, warn };
  }

  // Evaluasi semua entri satu pegawai terhadap pagu. Mengembalikan item per entri dan ringkasan.
  function evaluate(peg, entri, today) {
    const list = entri.filter((e) => e.pid === peg.id).sort((a, b) => a.tgl.localeCompare(b.tgl) || a.id.localeCompare(b.id));
    const items = {};
    for (const e of list) {
      const type = dayType(e.tgl, e.libur), done = e.status === "done";
      const actual = done ? (Number.isFinite(e.jamAktual) ? e.jamAktual : e.jam) : null;
      const basis = done ? Math.min(actual, e.jam) : e.jam;
      const tf = tarifFor(peg, type, basis);
      const warns = [...tf.warn];
      if (done && actual > e.jam) warns.push({ lv: "bad", t: `Jam aktual (${actual}) melebihi SPTPL (${e.jam}): kelebihan jam tidak dibayar.` });
      if (done && actual < e.jam) warns.push({ lv: "warn", t: `Jam aktual (${actual}) kurang dari SPTPL (${e.jam}): dibayar sesuai jam aktual.` });
      if (done && e.tgl > today) warns.push({ lv: "warn", t: "Dikonfirmasi lembur padahal tanggalnya belum tiba." });
      if (!e.status && e.tgl < today) warns.push({ lv: "warn", t: "Tanggal SPTPL sudah lewat, belum dikonfirmasi lembur atau tidak." });
      if (list.some((o) => o !== e && o.tgl === e.tgl)) warns.push({ lv: "warn", t: "Ada lebih dari satu SPTPL pada tanggal yang sama." });
      const kind = done ? "done" : e.status === "skip" ? "skip" : e.tgl < today ? "late" : "plan";
      items[e.id] = { e, type, amount: done || !e.status ? tf.amount : 0, hPaid: tf.hPaid, pay: 0, unpaid: 0, proj: 0, warns, kind };
    }
    let rem = peg.pagu, terpakai = 0, tidakDibayar = 0, rencana = 0;
    for (const e of list.filter((x) => x.status === "done")) {
      const it = items[e.id]; it.pay = Math.min(it.amount, rem); it.unpaid = it.amount - it.pay; rem -= it.pay; terpakai += it.pay; tidakDibayar += it.unpaid;
      if (it.unpaid > 0) it.warns.push({ lv: "bad", t: `Pagu lembur tidak mencukupi: ${R(it.unpaid)} berpotensi tidak dibayar.` });
    }
    const sisa = peg.pagu - terpakai;
    for (const e of list.filter((x) => !x.status)) {
      const it = items[e.id]; it.proj = Math.min(it.amount, rem); rem -= it.proj; rencana += it.proj;
      if (it.proj < it.amount) it.warns.push({ lv: "bad", t: `Jika dilaksanakan, pagu tidak cukup (sisa ${R(it.proj)} dari ${R(it.amount)}): sebagian tidak dibayar.` });
    }
    const arr = list.map((e) => items[e.id]);
    return {
      items, list: arr,
      sum: { pagu: peg.pagu, terpakai, sisa, rencana, sisaProyeksi: sisa - rencana, tidakDibayar,
        nBad: arr.filter((i) => i.warns.some((w) => w.lv === "bad")).length,
        nBelum: arr.filter((i) => i.kind === "late").length },
    };
  }

  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  // Rekomendasi: kombinasi sesi lembur yang menghabiskan pagu (sisa < tarif terendah) tanpa melebihi sisa, dengan hari paling sedikit.
  function recommend(peg, sisa, today, endDate, usedDates) {
    const opts = [["weekday", 1, peg.tarif.wd1], ["weekday", 2, peg.tarif.wd2], ["weekend", 2, peg.tarif.we2], ["weekend", 3, peg.tarif.we3], ["weekend", 4, peg.tarif.we4]]
      .map(([type, jam, amount]) => ({ type, jam, amount: Math.round(amount) })).filter((o) => o.amount > 0);
    const empty = { sessions: [], total: 0, sisaAkhir: Math.max(0, sisa) };
    if (!opts.length || sisa < Math.min(...opts.map((o) => o.amount))) return empty;
    let unit = opts.reduce((g, o) => gcd(g, o.amount), 0) || 1;
    if (sisa / unit > 2e6) unit = Math.max(unit, 1000);
    const N = Math.floor(sisa / unit), INF = 1e9, best = new Int32Array(N + 1).fill(INF), prev = new Int8Array(N + 1).fill(-1);
    best[0] = 0;
    for (let s = 0; s <= N; s++) {
      if (best[s] === INF) continue;
      opts.forEach((o, i) => { const t = s + Math.floor(o.amount / unit); if (o.amount % unit === 0 && t <= N && best[s] + 1 < best[t]) { best[t] = best[s] + 1; prev[t] = i; } });
    }
    // Optimal = sisa lebih kecil dari tarif terendah (tidak ada sesi lagi yang muat); pilih jumlah hari paling sedikit.
    const minA = Math.min(...opts.map((o) => o.amount)), lo = Math.floor((sisa - minA) / unit) + 1;
    let s = 0, bs = INF;
    for (let x = N; x >= Math.max(1, lo); x--) if (best[x] < bs) { bs = best[x]; s = x; }
    if (!s) { s = N; while (s > 0 && best[s] === INF) s--; }
    const pick = []; for (let x = s; x > 0; x -= Math.floor(opts[prev[x]].amount / unit)) pick.push(opts[prev[x]]);
    const used = new Set(usedDates), wd = [], we = [];
    for (let d = addDays(today, 1); d <= endDate; d = addDays(d, 1)) { if (used.has(d)) continue; (dayType(d, false) === "weekend" ? we : wd).push(d); }
    pick.sort((a, b) => b.amount - a.amount);
    const sessions = [];
    const chosen = [];  // beri jarak minimal 1 hari antar lembur bila memungkinkan
    const take = (pool) => { let i = pool.findIndex((d) => chosen.every((c) => Math.abs((mk(d) - mk(c)) / 864e5) > 1)); if (i < 0) i = 0; const d = pool.splice(i, 1)[0]; if (d) chosen.push(d); return d; };
    for (const o of pick) { const d = take(o.type === "weekend" ? we : wd); if (d) sessions.push({ tgl: d, type: o.type, jam: o.jam, amount: o.amount }); }
    sessions.sort((a, b) => a.tgl.localeCompare(b.tgl));
    const total = sessions.reduce((a, x) => a + x.amount, 0);
    return { sessions, total, sisaAkhir: Math.max(0, sisa - total) };
  }

  // ---- reducer data (dipakai server dan mode lokal) ----
  const num = (v, lo, hi, nama) => { v = Number(v); if (!Number.isFinite(v) || v < lo || v > hi) throw new Error(nama + " tidak valid"); return Math.round(v); };
  const str = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
  const rid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function apply(state, op) {
    const st = JSON.parse(JSON.stringify(state));
    if (op.op === "peg.upsert") {
      const p = op.peg || {}, t = p.tarif || {};
      const rec = { id: str(p.id, 40), nama: str(p.nama, 60), gol: num(p.gol, 1, 4, "Golongan"), pagu: num(p.pagu, 0, 1e10, "Pagu lembur"),
        tarif: { wd1: num(t.wd1, 0, 1e8, "Tarif weekday 1 jam"), wd2: num(t.wd2, 0, 1e8, "Tarif weekday 2 jam"), we2: num(t.we2, 0, 1e8, "Tarif weekend 2 jam"), we3: num(t.we3, 0, 1e8, "Tarif weekend 3 jam"), we4: num(t.we4, 0, 1e8, "Tarif weekend 4 jam") } };
      if (!rec.nama) throw new Error("Nama pegawai wajib diisi");
      const i = st.pegawai.findIndex((x) => x.id === rec.id);
      if (i >= 0) st.pegawai[i] = rec; else { rec.id = rid("p"); st.pegawai.push(rec); }
    } else if (op.op === "peg.delete") {
      st.pegawai = st.pegawai.filter((x) => x.id !== op.id); st.entri = st.entri.filter((e) => e.pid !== op.id);
    } else if (op.op === "ent.upsert" || op.op === "ent.confirm") {
      const e = op.ent || { id: op.id, status: op.status, jamAktual: op.jamAktual };
      const old = st.entri.find((x) => x.id === e.id);
      const m = op.op === "ent.confirm" ? { ...(old || {}), status: e.status, jamAktual: e.jamAktual } : e;
      if (op.op === "ent.confirm" && !old) throw new Error("Jadwal tidak ditemukan");
      const rec = { id: str(m.id, 40), pid: str(m.pid, 40), tgl: m.tgl, jam: num(m.jam, 1, 12, "Jam lembur"), sptpl: str(m.sptpl, 80), ket: str(m.ket, 200), libur: !!m.libur, status: ["done", "skip"].includes(m.status) ? m.status : "" };
      if (!validDate(rec.tgl)) throw new Error("Tanggal tidak valid");
      if (!st.pegawai.some((x) => x.id === rec.pid)) throw new Error("Pegawai tidak ditemukan");
      if (rec.status === "done" && m.jamAktual != null && m.jamAktual !== "") rec.jamAktual = num(m.jamAktual, 0, 24, "Jam aktual");
      const i = st.entri.findIndex((x) => x.id === rec.id);
      if (i >= 0) st.entri[i] = rec; else { rec.id = rid("e"); st.entri.push(rec); }
    } else if (op.op === "ent.delete") {
      st.entri = st.entri.filter((e) => e.id !== op.id);
    } else throw new Error("Operasi tidak dikenal");
    return st;
  }

  const api = { seed, tarifFor, evaluate, recommend, apply, ymd, mk, addDays, dayType, dow, HARI, R, MAXH, MINH, validDate };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.LemburCore = api;
})(typeof self !== "undefined" ? self : this);
