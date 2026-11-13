// Sesi login sederhana: cookie HttpOnly bertanda tangan HMAC (berlaku 30 hari).
const crypto = require("crypto");
// Daftar pengguna: LOGIN_USERS="user1:sandi1:edit;user2:sandi2:view" (peran opsional; tanpa peran = edit).
// Peran: edit = boleh input rencana, view = hanya melihat. Jika LOGIN_USERS diisi, hanya daftar ini yang berlaku.
// Jika kosong: LOGIN_USER/LOGIN_PASS, dan bila itu pun kosong: ppa1/ppa1.
const users = () => {
  const raw = process.env.LOGIN_USERS;
  if (raw && raw.trim()) {
    return raw.split(/[;\n]/).map((x) => x.trim()).filter(Boolean).map((x) => {
      const i = x.indexOf(":");
      if (i <= 0) return null;
      let pass = x.slice(i + 1).trim(), role = "edit";
      const j = pass.lastIndexOf(":");
      if (j > 0 && /^(edit|editor|view|viewer|lihat)$/i.test(pass.slice(j + 1).trim())) {
        role = /^edit/i.test(pass.slice(j + 1).trim()) ? "edit" : "view";
        pass = pass.slice(0, j);
      }
      return [x.slice(0, i).trim(), pass, role];
    }).filter(Boolean);
  }
  return [[process.env.LOGIN_USER || "ppa1", process.env.LOGIN_PASS || "ppa1", "edit"]];
};
const secret = () => process.env.SESSION_SECRET || crypto.createHash("sha256")
  .update("ppa1|" + JSON.stringify(users()) + "|" + (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "")).digest("hex");
const sig = (p) => crypto.createHmac("sha256", secret()).update(p).digest("base64url");
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const FLAGS = "HttpOnly; Secure; SameSite=Lax; Path=/";

exports.check = (u, p) => {
  let role = null;  // mengembalikan peran ("edit"/"view") bila cocok, selain itu null
  for (const [uu, pp, rr] of users()) { const a = same(u, uu), b = same(p, pp); if (a && b) role = rr; }
  return role;
};
exports.issue = (res, user, role) => {
  const p = Buffer.from(JSON.stringify({ u: String(user || ""), r: role === "edit" ? "edit" : "view", exp: Date.now() + 30 * 86400e3 })).toString("base64url");
  res.setHeader("Set-Cookie", `sid=${p}.${sig(p)}; ${FLAGS}; Max-Age=2592000`);
};
exports.clear = (res) => res.setHeader("Set-Cookie", `sid=; ${FLAGS}; Max-Age=0`);
exports.authed = (req) => {
  const m = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || "");
  if (!m) return false;
  const [p, s] = m[1].split(".");
  if (!p || !s || !same(s, sig(p))) return false;
  try { const o = JSON.parse(Buffer.from(p, "base64url").toString()); return o.exp > Date.now() ? { user: o.u, role: o.r === "edit" ? "edit" : "view" } : false; } catch { return false; }
};
