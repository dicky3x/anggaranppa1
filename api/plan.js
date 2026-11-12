// Penyimpanan rencana kegiatan di Upstash Redis (REST). Tanpa dependensi.
const crypto = require("crypto");
const A = require("./_auth");
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = "ppa1:plans";

const cmd = async (a) => {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(a) });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || r.status);
  return j.result;
};
const load = async () => { const v = await cmd(["GET", KEY]); return v ? JSON.parse(v) : {}; };

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!A.authed(req)) return res.status(401).json({ error: "Belum login" });
  if (!URL_ || !TOKEN) return res.status(503).json({ error: "Database belum terhubung" });
  try {
    if (req.method === "GET") return res.status(200).json({ plans: await load() });
    if (req.method !== "POST") return res.status(405).json({ error: "Metode tidak didukung" });

    const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const key = String(b.key || "");
    if (!/^[\w.|]{3,80}$/.test(key)) return res.status(400).json({ error: "Kunci tidak valid" });
    const plans = await load();
    if (b.op === "upsert") {
      const p = b.plan || {};
      const keg = String(p.keg || "").trim().slice(0, 200), tgl = String(p.tgl || ""), biaya = Math.round(Number(p.biaya));
      if (!keg || !(biaya >= 0) || biaya > 1e12 || (tgl && !/^\d{4}-\d{2}-\d{2}$/.test(tgl)))
        return res.status(400).json({ error: "Isian tidak valid" });
      const list = plans[key] || [];
      const id = p.id && list.some((x) => x.id === p.id) ? p.id : crypto.randomUUID();
      const rec = { id, keg, tgl, biaya }, i = list.findIndex((x) => x.id === id);
      i >= 0 ? (list[i] = rec) : list.push(rec);
      plans[key] = list;
    } else if (b.op === "delete") {
      plans[key] = (plans[key] || []).filter((x) => x.id !== b.id);
      if (!plans[key].length) delete plans[key];
    } else return res.status(400).json({ error: "Operasi tidak dikenal" });
    await cmd(["SET", KEY, JSON.stringify(plans)]);
    return res.status(200).json({ plans });
  } catch (e) {
    return res.status(500).json({ error: "Kesalahan server: " + e.message });
  }
};
