// Sesi login sederhana: cookie HttpOnly bertanda tangan HMAC (berlaku 30 hari).
const crypto = require("crypto");
const USER = () => process.env.LOGIN_USER || "ppa1";
const PASS = () => process.env.LOGIN_PASS || "ppa1";
const secret = () => process.env.SESSION_SECRET || crypto.createHash("sha256")
  .update("ppa1|" + PASS() + "|" + (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "")).digest("hex");
const sig = (p) => crypto.createHmac("sha256", secret()).update(p).digest("base64url");
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const FLAGS = "HttpOnly; Secure; SameSite=Lax; Path=/";

exports.check = (u, p) => { const a = same(u, USER()), b = same(p, PASS()); return a && b; };
exports.issue = (res) => {
  const p = Buffer.from(JSON.stringify({ u: USER(), exp: Date.now() + 30 * 86400e3 })).toString("base64url");
  res.setHeader("Set-Cookie", `sid=${p}.${sig(p)}; ${FLAGS}; Max-Age=2592000`);
};
exports.clear = (res) => res.setHeader("Set-Cookie", `sid=; ${FLAGS}; Max-Age=0`);
exports.authed = (req) => {
  const m = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || "");
  if (!m) return false;
  const [p, s] = m[1].split(".");
  if (!p || !s || !same(s, sig(p))) return false;
  try { return JSON.parse(Buffer.from(p, "base64url").toString()).exp > Date.now(); } catch { return false; }
};
