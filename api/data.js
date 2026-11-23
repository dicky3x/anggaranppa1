const A = require("./_auth");
const kv = require("./_kv");
const bundled = require("../private/data.json");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const me = A.authed(req);
  if (!me) return res.status(401).json({ error: "Belum login" });
  let data = bundled;  // data bawaan repo, kecuali ada unggahan PDF terbaru di database
  if (kv.available()) {
    try { const d = await kv.getJson("ppa1:data"); if (d && Array.isArray(d.subkomponen)) data = d; } catch {}
  }
  res.status(200).json({ ...data, me });
};
