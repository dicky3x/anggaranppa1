const A = require("./_auth");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") { const me = A.authed(req); return res.status(me ? 200 : 401).json({ ok: !!me, ...(me || {}) }); }
  if (req.method === "DELETE") { A.clear(res); return res.status(200).json({ ok: true }); }
  if (req.method !== "POST") return res.status(405).json({ error: "Metode tidak didukung" });
  let b = {};
  try { b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {}; } catch {}
  if (b.logout) { A.clear(res); return res.status(200).json({ ok: true }); }
  const user = String(b.user || "").trim(), role = A.check(user, String(b.password ?? b.pass ?? ""));
  if (role) { A.issue(res, user, role); return res.status(200).json({ ok: true, user, role }); }
  await new Promise((r) => setTimeout(r, 800));
  return res.status(401).json({ error: "Pengguna atau kata sandi salah" });
};
