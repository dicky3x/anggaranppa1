const A = require("./_auth");
const data = require("../private/data.json");
module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const me = A.authed(req);
  if (!me) return res.status(401).json({ error: "Belum login" });
  res.status(200).json({ ...data, me });
};
