// Data lembur pegawai (pegawai, tarif, pagu, jadwal SPTPL, konfirmasi) di Upstash Redis.
const A = require("./_auth");
const kv = require("./_kv");
const core = require("../public/lembur-core.js");
const KEY = "ppa1:lembur";
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const me = A.authed(req);
  if (!me) return res.status(401).json({ error: "Belum login" });
  if (!kv.available()) return res.status(503).json({ error: "Database belum terhubung" });
  try {
    const state = (await kv.getJson(KEY)) || core.seed();
    if (req.method === "GET") return res.status(200).json({ state, me });
    if (req.method !== "POST") return res.status(405).json({ error: "Metode tidak didukung" });
    if (me.role !== "edit") return res.status(403).json({ error: "Akun ini hanya dapat melihat, tidak dapat mengubah data." });
    const op = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    let next;
    try { next = core.apply(state, op); } catch (e) { return res.status(400).json({ error: e.message }); }
    await kv.setJson(KEY, next);
    return res.status(200).json({ state: next, me });
  } catch (e) {
    return res.status(500).json({ error: "Kesalahan server: " + e.message });
  }
};
