const A = require("./_auth");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") { const ok = A.authed(req); return res.status(ok ? 200 : 401).json({ ok }); }
  if (req.method === "DELETE") { A.clear(res); return res.status(200).json({ ok: true }); }
  if (req.method !== "POST") return res.status(405).json({ error: "Metode tidak didukung" });
  let b = {};
  try { b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {}; } catch {}
  if (b.logout) { A.clear(res); return res.status(200).json({ ok: true }); }
  if (A.check(String(b.user || ""), String(b.password ?? b.pass ?? ""))) { A.issue(res); return res.status(200).json({ ok: true }); }
  await new Promise((r) => setTimeout(r, 800));
  return res.status(401).json({ error: "Pengguna atau kata sandi salah" });
};
