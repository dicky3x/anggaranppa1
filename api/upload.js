// Menyimpan data anggaran hasil baca PDF (dibaca di browser) ke database. Hanya peran edit.
const A = require("./_auth");
const kv = require("./_kv");
const num = (v) => { if (!Number.isFinite(v) || Math.abs(v) > 1e13) throw new Error("Angka tidak valid"); return Math.round(v); };
const str = (v, n = 300) => String(v == null ? "" : v).slice(0, n);
const money = (o) => ({ pagu: num(o.pagu), lock: num(o.lock), lalu: num(o.lalu), ini: num(o.ini), sd: num(o.sd), sisa: num(o.sisa) });
const clean = (d) => {
  if (!d || !Array.isArray(d.subkomponen) || d.subkomponen.length < 1 || d.subkomponen.length > 50) throw new Error("Data tidak berisi subkomponen");
  return {
    periode: str(d.periode, 40), sumber: str(d.sumber, 120),
    subkomponen: d.subkomponen.map((s) => {
      if (!/^\d{4}\.[A-Z]{3}\.[A-Z0-9]{3}\.\d{3}\.[A-Z0-9]{2}$/.test(String(s.kode))) throw new Error("Kode subkomponen tidak valid");
      return {
        kode: s.kode, name: str(s.name), ...money(s),
        path: Object.fromEntries(Object.entries(s.path || {}).slice(0, 8).map(([k, v]) => [str(k, 20), str(v)])),
        akun: (s.akun || []).slice(0, 100).map((a) => ({
          kode: str(a.kode, 10), name: str(a.name), ...money(a),
          item: (a.item || []).slice(0, 500).map((i) => ({ kode: str(i.kode, 12), name: str(i.name), ...money(i) })),
        })),
      };
    }),
  };
};
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const me = A.authed(req);
  if (!me) return res.status(401).json({ error: "Belum login" });
  if (req.method !== "POST") return res.status(405).json({ error: "Metode tidak didukung" });
  if (me.role !== "edit") return res.status(403).json({ error: "Akun ini hanya dapat melihat, tidak dapat mengunggah data." });
  if (!kv.available()) return res.status(503).json({ error: "Database belum terhubung (lihat README: Upstash Redis)." });
  try {
    const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const data = clean(b.data);
    data.diunggah = { oleh: me.user, waktu: new Date().toISOString() };
    await kv.setJson("ppa1:data", data);
    res.status(200).json({ ok: true, periode: data.periode, subkomponen: data.subkomponen.length });
  } catch (e) {
    res.status(400).json({ error: "Data ditolak: " + e.message });
  }
};
