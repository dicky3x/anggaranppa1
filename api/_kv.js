// Akses Upstash Redis (REST) tanpa dependensi.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const cmd = async (a) => {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(a) });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || r.status);
  return j.result;
};
exports.available = () => !!(URL_ && TOKEN);
exports.getJson = async (key) => { const v = await cmd(["GET", key]); return v ? JSON.parse(v) : null; };
exports.setJson = (key, val) => cmd(["SET", key, JSON.stringify(val)]);
