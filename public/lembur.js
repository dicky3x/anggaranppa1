/* Tampilan Lembur Pegawai: kalender per pegawai, konfirmasi SPTPL, pagu, peringatan, rekomendasi. */
(function () {
  const C = window.LemburCore, R = C.R, LS = "ppa1lembur";
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let st = null, canEdit = false, mode = "server", host = null, month = C.ymd(new Date()).slice(0, 7);
  const open = new Set(), today = () => C.ymd(new Date()), endYear = () => new Date().getFullYear() + "-12-31";
  const tglF = (t) => { const d = C.mk(t); return C.HARI[d.getDay()] + ", " + d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }); };
  const KIND = { plan: "Terjadwal", late: "Belum dikonfirmasi", done: "Lembur dilaksanakan", skip: "Tidak lembur" };

  const css = `
.lm .top{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0}.lm .top .sp{flex:1}
.lm .pg{margin-bottom:10px;padding:0}.lm .ph{display:flex;align-items:center;gap:8px 18px;flex-wrap:wrap;padding:12px 16px;cursor:pointer}
.lm .nm{min-width:150px}.lm .pc{display:flex;flex-direction:column;min-width:118px}.lm .pc small{color:var(--mute);font-size:12px}.lm .pc b{font-weight:600}
.lm .pbar{height:6px;margin:0 16px 12px;background:var(--line);border-radius:3px;overflow:hidden;display:flex}.lm .pbar i{display:block;height:100%}
.lm .pb{padding:0 16px 16px}.lm h3{font-size:14px;margin:16px 0 8px}
.lm .cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}.lm .cal .h{text-align:center;font-weight:600;font-size:12px;color:var(--mute)}
.lm .dc{min-height:78px;border:1px solid var(--line);border-radius:6px;padding:4px;background:var(--sf);font-size:12px;overflow:hidden}
.lm .dc.we{background:color-mix(in srgb,var(--hd) 70%,var(--sf))}.lm .dc.td{outline:2px solid var(--real)}.lm .dc.em{background:transparent;border-color:transparent}.lm .dc[data-act]{cursor:pointer}
.lm .chip{display:block;width:100%;text-align:left;margin-top:3px;padding:2px 5px;border-radius:4px;border:1px solid;font:inherit;font-size:11px;line-height:1.3;cursor:default}
.lm .chip[data-act]{cursor:pointer}
.lm .plan{background:color-mix(in srgb,var(--pagu) 14%,var(--sf));color:var(--pagu);border-color:var(--pagu)}
.lm .done{background:color-mix(in srgb,var(--ok) 16%,var(--sf));color:var(--ok);border-color:var(--ok)}
.lm .skip{background:color-mix(in srgb,var(--bad) 12%,var(--sf));color:var(--bad);border-color:var(--bad);text-decoration:line-through}
.lm .late{background:color-mix(in srgb,var(--warn) 18%,var(--sf));color:var(--warn);border-color:var(--warn)}
.lm .leg{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;font-size:12px}.lm .leg span{padding:1px 8px;border-radius:10px;border:1px solid}
.lm .mn{display:flex;align-items:center;gap:8px;margin-bottom:8px}.lm .mn b{min-width:130px;text-align:center}
.lm .sc{max-height:340px;overflow:auto}
table.lt{min-width:700px}.lt th,.lt td{text-align:left;white-space:normal;vertical-align:top;position:static}.lt th:first-child,.lt td:first-child{position:static;min-width:0;max-width:none;box-shadow:none;background:transparent}.lt th:first-child{background:var(--hd)}
.lt tr.k-done td{background:color-mix(in srgb,var(--ok) 12%,var(--sf))}.lt tr.k-skip td{background:color-mix(in srgb,var(--bad) 10%,var(--sf))}.lt tr.k-late td{background:color-mix(in srgb,var(--warn) 14%,var(--sf))}
.lt .w{display:block;font-size:12px;margin-top:2px}.lt .w.bad{color:var(--bad)}.lt .w.warn{color:var(--warn)}
.lm .rec{margin-top:14px;padding:12px;border:1px dashed var(--line);border-radius:8px}.lm .rec ul{margin:6px 0;padding-left:18px}
.lm .nb{display:inline-block;padding:0 7px;border-radius:10px;font-size:12px;font-weight:500}.lm .nb.bad{background:color-mix(in srgb,var(--bad) 18%,var(--sf));color:var(--bad)}.lm .nb.warn{background:color-mix(in srgb,var(--warn) 20%,var(--sf));color:var(--warn)}
#lmE label,#lmP label{display:block;margin:9px 0 2px;font-weight:500}#lmE input,#lmE select,#lmE textarea,#lmP input,#lmP select{width:100%}
#lmE textarea{font:inherit;color:var(--ink);background:var(--sf);border:1px solid var(--line);border-radius:6px;padding:6px 10px}
#lmE .pv{margin-top:10px;padding:8px 10px;border-radius:6px;background:var(--bg);font-size:13px}.g2{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}`;

  async function load() {
    try { const r = await fetch("/api/lembur"); if (!r.ok) throw 0; st = (await r.json()).state; mode = "server"; }
    catch { mode = "local"; try { st = JSON.parse(localStorage.getItem(LS) || "null"); } catch { st = null; } if (!st) st = C.seed(); }
  }
  async function send(op) {
    if (mode === "local") {
      try { st = C.apply(st, op); } catch (e) { alert(e.message); return false; }
      try { localStorage.setItem(LS, JSON.stringify(st)); } catch {} return true;
    }
    let r; try { r = await fetch("/api/lembur", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(op) }); } catch { alert("Tidak dapat terhubung ke server."); return false; }
    if (r.status === 401) { alert("Sesi berakhir, silakan login lagi."); location.reload(); return false; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { alert("Gagal menyimpan. " + (j.error || "")); return false; }
    st = j.state; return true;
  }

  const evalAll = () => st.pegawai.map((p) => ({ p, ev: C.evaluate(p, st.entri, today()) }));
  function chipHtml(it, pid) {
    const e = it.e, bad = it.warns.some((w) => w.lv === "bad");
    const tip = `${KIND[it.kind]} · ${e.jam} jam SPTPL${e.sptpl ? " · " + e.sptpl : ""} · ${R(it.amount)}` + it.warns.map((w) => "\n⚠ " + w.t).join("");
    const lbl = `${e.status === "done" ? "✓ " : e.status === "skip" ? "✕ " : ""}${e.jam} jam${bad ? " ⚠" : ""}<br>${it.kind === "skip" ? "–" : R(it.amount)}`;
    return canEdit ? `<button class="chip ${it.kind}" data-act="ent" data-eid="${esc(e.id)}" title="${esc(tip)}">${lbl}</button>` : `<span class="chip ${it.kind}" title="${esc(tip)}">${lbl}</span>`;
  }
  function calendar(p, ev) {
    const [y, m] = month.split("-").map(Number), first = new Date(y, m - 1, 1), n = new Date(y, m, 0).getDate(), off = (first.getDay() + 6) % 7;
    let h = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((x) => `<div class="h">${x}</div>`).join("");
    for (let i = 0; i < off; i++) h += `<div class="dc em"></div>`;
    for (let d = 1; d <= n; d++) {
      const t = `${month}-${String(d).padStart(2, "0")}`, we = C.dayType(t) === "weekend";
      const its = ev.list.filter((i) => i.e.tgl === t);
      h += `<div class="dc${we ? " we" : ""}${t === today() ? " td" : ""}" ${canEdit ? `data-act="add" data-id="${esc(p.id)}" data-d="${t}"` : ""}><b>${d}</b>${its.map((i) => chipHtml(i, p.id)).join("")}</div>`;
    }
    return `<div class="cal">${h}</div><div class="leg"><span class="plan">Terjadwal</span><span class="done">Lembur dilaksanakan</span><span class="skip">Tidak lembur</span><span class="late">Belum dikonfirmasi</span></div>`;
  }
  function table(p, ev) {
    if (!ev.list.length) return `<p style="color:var(--mute)">Belum ada jadwal SPTPL untuk pegawai ini.${canEdit ? " Klik tanggal di kalender atau tombol “+ Jadwal SPTPL”." : ""}</p>`;
    const rows = ev.list.map((it) => {
      const e = it.e, a = e.status === "done" ? (Number.isFinite(e.jamAktual) ? e.jamAktual : e.jam) : "–";
      const conf = canEdit ? (e.status ? `<button class="sm" data-act="conf" data-eid="${esc(e.id)}" data-s="">↺ Reset</button>` : `<button class="sm" data-act="conf" data-eid="${esc(e.id)}" data-s="done">✓ Lembur</button><button class="sm" data-act="conf" data-eid="${esc(e.id)}" data-s="skip">✕ Tidak lembur</button>`) : "";
      const nominal = e.status === "skip" ? "–" : e.status === "done" ? R(it.pay) + (it.unpaid ? `<span class="w bad">tidak dibayar ${R(it.unpaid)}</span>` : "") : R(it.amount) + `<span class="w">estimasi</span>`;
      return `<tr class="k-${it.kind}"><td>${tglF(e.tgl)}${e.libur ? '<span class="w">hari libur</span>' : ""}</td><td>${it.type === "weekday" ? "Weekday" : "Weekend"}</td><td>${e.jam} jam${e.sptpl ? `<span class="w">${esc(e.sptpl)}</span>` : ""}</td><td>${a}</td><td>${nominal}</td><td>${KIND[it.kind]}<br>${conf}</td><td>${it.warns.map((w) => `<span class="w ${w.lv}">⚠ ${esc(w.t)}</span>`).join("") || "–"}</td><td>${canEdit ? `<button class="sm" data-act="ent" data-eid="${esc(e.id)}">Ubah</button>` : ""}</td></tr>`;
    }).join("");
    return `<div class="sc"><table class="lt"><thead><tr><th>Tanggal SPTPL</th><th>Jenis</th><th>Jam SPTPL</th><th>Jam aktual</th><th>Uang lembur</th><th>Konfirmasi</th><th>Peringatan</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function recBox(p, ev) {
    const s = ev.sum.sisaProyeksi;
    let body;
    if (s <= 0) body = `<p>Pagu lembur sudah terpakai atau terencana penuh. Tidak ada sisa untuk direkomendasikan.</p>`;
    else {
      const r = C.recommend(p, s, today(), endYear(), ev.list.map((i) => i.e.tgl));
      body = !r.sessions.length ? `<p>Sisa ${R(s)} lebih kecil dari tarif terendah, jadi tidak bisa dipakai lagi.</p>`
        : `<p>Sisa pagu setelah semua SPTPL terlaksana: <b>${R(s)}</b>. Agar terpakai maksimal tanpa melebihi pagu:</p><ul>${r.sessions.map((x) => `<li>${tglF(x.tgl)} · ${x.type === "weekday" ? "weekday" : "weekend"} · <b>${x.jam} jam</b> · ${R(x.amount)}</li>`).join("")}</ul>
        <p>Total ${R(r.total)} · sisa pagu akhir tahun ${R(r.sisaAkhir)}.</p>${canEdit ? `<button class="sm" data-act="recadd" data-id="${esc(p.id)}">Jadikan jadwal SPTPL</button>` : ""}`;
    }
    return `<div class="rec"><b>Rekomendasi lembur mendatang</b>${body}<small style="color:var(--mute)">Kombinasi dengan jumlah hari paling sedikit, mulai besok sampai 31 Desember. Jika ada hari kerja yang ternyata libur nasional, centang “hari libur” saat input agar memakai tarif weekend.</small></div>`;
  }
  function render() {
    if (!host || !st) return;
    const all = evalAll(), sum = (f) => all.reduce((a, x) => a + f(x.ev.sum), 0);
    const [y, m] = month.split("-").map(Number), ml = new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    const kpi = [["Total pagu lembur", R(sum((s) => s.pagu))], ["Terpakai (lembur dilaksanakan)", R(sum((s) => s.terpakai))], ["Sisa pagu", R(sum((s) => s.sisa))], ["Jadwal belum dikonfirmasi", sum((s) => s.nBelum)], ["Lembur berpotensi tidak dibayar", sum((s) => s.nBad)]]
      .map(([a, b], i) => `<div class="card ${i === 2 ? "real" : i === 4 && b ? "sisa" : ""}"><small>${a}</small><b>${b}</b></div>`).join("");
    const cards = all.map(({ p, ev }) => {
      const s = ev.sum, o = open.has(p.id), pc = (v) => (p.pagu ? Math.min(100, (v / p.pagu) * 100) : 0);
      return `<div class="card pg"><div class="ph" data-act="toggle" data-id="${esc(p.id)}"><span class="nm"><span style="color:var(--mute)">${o ? "▾" : "▸"}</span> <b>${esc(p.nama)}</b><br><small style="color:var(--mute)">Golongan ${p.gol}</small></span>
        <span class="pc"><small>Pagu lembur s.d. akhir tahun</small><b>${R(p.pagu)}${canEdit ? ` <button class="sm" data-act="peg" data-id="${esc(p.id)}">Ubah</button>` : ""}</b></span>
        <span class="pc"><small>Terpakai</small><b>${R(s.terpakai)}</b></span><span class="pc"><small>Sisa pagu</small><b style="color:var(--real)">${R(s.sisa)}</b></span>
        <span class="pc"><small>Sisa jika SPTPL terlaksana</small><b>${R(s.sisaProyeksi)}</b></span>
        <span>${s.nBelum ? `<span class="nb warn">${s.nBelum} belum dikonfirmasi</span> ` : ""}${s.nBad ? `<span class="nb bad">⚠ ${s.nBad} berisiko tidak dibayar</span>` : ""}</span></div>
        <div class="pbar" title="Hijau: terpakai · Biru: terjadwal"><i style="width:${pc(s.terpakai)}%;background:var(--ok)"></i><i style="width:${pc(s.rencana)}%;background:var(--pagu)"></i></div>
        ${o ? `<div class="pb"><div class="mn"><button class="sm" data-act="mprev">◀</button><b>${ml}</b><button class="sm" data-act="mnext">▶</button>${canEdit ? `<button class="sm" data-act="add" data-id="${esc(p.id)}" data-d="">+ Jadwal SPTPL</button>` : ""}</div>${calendar(p, ev)}<h3>Daftar jadwal SPTPL dan konfirmasi</h3>${table(p, ev)}${recBox(p, ev)}</div>` : ""}</div>`;
    }).join("");
    host.innerHTML = `${mode === "local" ? `<div class="card" style="border-color:var(--sisa);margin-bottom:10px">Database belum terhubung: data lembur hanya tersimpan di browser ini (lihat README: Upstash Redis).</div>` : ""}
      <section class="kpi">${kpi}</section><div class="top"><b>Pegawai</b><span class="sp"></span>${canEdit ? `<button data-act="addpeg">+ Pegawai</button>` : ""}</div>${cards || "<p>Belum ada pegawai.</p>"}
      <p class="foot">Uang lembur dihitung dari tarif per orang sesuai jenis hari (weekday/weekend) dan jam SPTPL. Jam di luar tabel tarif (weekday maks 2 jam, weekend 2–4 jam) dianggap tidak dibayar. Lembur dilaksanakan mengurangi sisa pagu; pagu tidak terkait data PDF.</p>`;
  }

  // ---- dialog ----
  function dialogs() {
    if (document.getElementById("lmE")) return;
    const st0 = document.createElement("style"); st0.textContent = css; document.head.appendChild(st0);
    document.body.insertAdjacentHTML("beforeend", `
<dialog id="lmE"><h2 id="lmEt" style="margin:0 0 4px;font-size:15px"></h2><small id="lmEs" style="color:var(--mute)"></small>
 <div class="g2"><div><label for="eT">Tanggal SPTPL</label><input id="eT" type="date"></div><div><label for="eJ">Jam lembur (SPTPL)</label><input id="eJ" type="number" min="1" max="12" step="1"></div></div>
 <label for="eN">Nomor SPTPL</label><input id="eN" maxlength="80"><label for="eK">Keterangan</label><textarea id="eK" rows="2" maxlength="200"></textarea>
 <label style="font-weight:400"><input id="eL" type="checkbox" style="width:auto"> Hari libur nasional (pakai tarif weekend)</label>
 <div class="g2"><div><label for="eS">Konfirmasi</label><select id="eS"><option value="">Belum dikonfirmasi</option><option value="done">Lembur dilaksanakan</option><option value="skip">Tidak lembur</option></select></div><div id="eAw"><label for="eA">Jam aktual</label><input id="eA" type="number" min="0" max="24" step="1"></div></div>
 <div class="pv" id="ePv"></div><p id="eE" class="neg" style="margin:8px 0 0"></p>
 <div style="display:flex;gap:8px;justify-content:space-between;margin-top:14px"><button id="eD" style="color:var(--bad)">Hapus</button><span style="display:flex;gap:8px"><button id="eX">Batal</button><button id="eV" style="background:var(--real);color:#fff;border-color:var(--real)">Simpan</button></span></div></dialog>
<dialog id="lmP"><h2 id="lmPt" style="margin:0 0 4px;font-size:15px"></h2>
 <label for="pN">Nama pegawai</label><input id="pN" maxlength="60"><div class="g2"><div><label for="pG">Golongan</label><select id="pG"><option>1</option><option>2</option><option>3</option><option>4</option></select></div><div><label for="pP">Pagu lembur s.d. akhir tahun (Rp)</label><input id="pP" type="number" min="0" step="1"></div></div>
 <label style="margin-top:12px">Tarif uang lembur (Rp)</label><div class="g2"><div><label for="t1">Weekday 1 jam</label><input id="t1" type="number" min="0"></div><div><label for="t2">Weekday 2 jam</label><input id="t2" type="number" min="0"></div><div><label for="t3">Weekend 2 jam</label><input id="t3" type="number" min="0"></div><div><label for="t4">Weekend 3 jam</label><input id="t4" type="number" min="0"></div><div><label for="t5">Weekend 4 jam</label><input id="t5" type="number" min="0"></div></div>
 <p id="pE" class="neg" style="margin:8px 0 0"></p>
 <div style="display:flex;gap:8px;justify-content:space-between;margin-top:14px"><button id="pD" style="color:var(--bad)">Hapus pegawai</button><span style="display:flex;gap:8px"><button id="pX">Batal</button><button id="pV" style="background:var(--real);color:#fff;border-color:var(--real)">Simpan</button></span></div></dialog>`);
    const $ = (i) => document.getElementById(i);
    $("eX").onclick = () => $("lmE").close(); $("pX").onclick = () => $("lmP").close();
    $("eS").onchange = () => { $("eAw").style.display = $("eS").value === "done" ? "" : "none"; if ($("eS").value === "done" && $("eA").value === "") $("eA").value = $("eJ").value; pv(); };
    ["eT", "eJ", "eL", "eA"].forEach((i) => ($(i).oninput = pv));
  }
  const $ = (i) => document.getElementById(i);
  let cur = null;
  function pv() {
    const peg = st.pegawai.find((p) => p.id === cur.pid); if (!peg || !C.validDate($("eT").value)) { $("ePv").textContent = "Isi tanggal untuk melihat perhitungan."; return; }
    const type = C.dayType($("eT").value, $("eL").checked), jam = Number($("eJ").value) || 0, done = $("eS").value === "done", akt = done ? Number($("eA").value || jam) : jam;
    const tf = C.tarifFor(peg, type, Math.min(akt, jam)), w = [...tf.warn];
    if (done && akt > jam) w.push({ lv: "bad", t: `Jam aktual (${akt}) melebihi SPTPL (${jam}): kelebihan jam tidak dibayar.` });
    $("ePv").innerHTML = `${C.HARI[C.dow($("eT").value)]} · tarif <b>${type === "weekday" ? "weekday" : "weekend"}</b> · uang lembur <b>${R(tf.amount)}</b> (sisa pagu saat ini ${R(C.evaluate(peg, st.entri, today()).sum.sisa)})` + w.map((x) => `<br><span style="color:var(--${x.lv === "bad" ? "bad" : "warn"})">⚠ ${esc(x.t)}</span>`).join("");
  }
  function openEnt(pid, eid, tgl) {
    const peg = st.pegawai.find((p) => p.id === pid), old = eid ? st.entri.find((e) => e.id === eid) : null;
    cur = { pid, eid }; $("lmEt").textContent = old ? "Ubah jadwal SPTPL" : "Tambah jadwal SPTPL"; $("lmEs").textContent = peg.nama + " · Golongan " + peg.gol;
    $("eT").value = old ? old.tgl : tgl || today(); $("eJ").value = old ? old.jam : 2; $("eN").value = old ? old.sptpl || "" : ""; $("eK").value = old ? old.ket || "" : ""; $("eL").checked = !!(old && old.libur);
    $("eS").value = old ? old.status || "" : ""; $("eA").value = old && Number.isFinite(old.jamAktual) ? old.jamAktual : ""; $("eAw").style.display = $("eS").value === "done" ? "" : "none"; $("eE").textContent = ""; $("eD").style.display = old ? "" : "none";
    $("eV").onclick = async () => {
      const ent = { id: old ? old.id : undefined, pid, tgl: $("eT").value, jam: $("eJ").value, sptpl: $("eN").value, ket: $("eK").value, libur: $("eL").checked, status: $("eS").value, jamAktual: $("eS").value === "done" ? $("eA").value : undefined };
      if (!C.validDate(ent.tgl)) return ($("eE").textContent = "Tanggal wajib diisi.");
      if (!(Number($("eJ").value) >= 1)) return ($("eE").textContent = "Jam lembur minimal 1.");
      $("eV").disabled = true; const ok = await send({ op: "ent.upsert", ent }); $("eV").disabled = false; if (ok) { $("lmE").close(); render(); }
    };
    $("eD").onclick = async () => { if (confirm("Hapus jadwal SPTPL ini?") && await send({ op: "ent.delete", id: old.id })) { $("lmE").close(); render(); } };
    $("lmE").showModal(); pv();
  }
  function openPeg(id) {
    const old = id ? st.pegawai.find((p) => p.id === id) : null, t = old ? old.tarif : { wd1: 0, wd2: 0, we2: 0, we3: 0, we4: 0 };
    $("lmPt").textContent = old ? "Ubah pegawai, pagu, dan tarif" : "Tambah pegawai"; $("pN").value = old ? old.nama : ""; $("pG").value = old ? old.gol : 3; $("pP").value = old ? old.pagu : 0;
    ["wd1", "wd2", "we2", "we3", "we4"].forEach((k, i) => ($("t" + (i + 1)).value = t[k])); $("pE").textContent = ""; $("pD").style.display = old ? "" : "none";
    $("pV").onclick = async () => {
      const peg = { id: old ? old.id : undefined, nama: $("pN").value, gol: $("pG").value, pagu: $("pP").value, tarif: { wd1: $("t1").value, wd2: $("t2").value, we2: $("t3").value, we3: $("t4").value, we4: $("t5").value } };
      if (!peg.nama.trim()) return ($("pE").textContent = "Nama wajib diisi.");
      $("pV").disabled = true; const ok = await send({ op: "peg.upsert", peg }); $("pV").disabled = false; if (ok) { $("lmP").close(); render(); }
    };
    $("pD").onclick = async () => { if (confirm("Hapus pegawai ini beserta seluruh jadwal lemburnya?") && await send({ op: "peg.delete", id: old.id })) { $("lmP").close(); render(); } };
    $("lmP").showModal();
  }

  async function onClick(ev) {
    const el = ev.target.closest("[data-act]"); if (!el || !host.contains(el)) return;
    const a = el.dataset.act, id = el.dataset.id;
    if (a === "toggle") { open.has(id) ? open.delete(id) : open.add(id); render(); }
    else if (a === "mprev" || a === "mnext") { const [y, m] = month.split("-").map(Number), d = new Date(y, m - 1 + (a === "mnext" ? 1 : -1), 1); month = C.ymd(d).slice(0, 7); render(); }
    else if (!canEdit) return;
    else if (a === "peg") openPeg(id); else if (a === "addpeg") openPeg(null);
    else if (a === "add") { ev.stopPropagation(); openEnt(id, null, el.dataset.d); }
    else if (a === "ent") { const e = st.entri.find((x) => x.id === el.dataset.eid); if (e) openEnt(e.pid, e.id); }
    else if (a === "conf") { if (await send({ op: "ent.confirm", id: el.dataset.eid, status: el.dataset.s })) render(); }
    else if (a === "recadd") {
      const p = st.pegawai.find((x) => x.id === id), ev2 = C.evaluate(p, st.entri, today()), r = C.recommend(p, ev2.sum.sisaProyeksi, today(), endYear(), ev2.list.map((i) => i.e.tgl));
      if (!r.sessions.length || !confirm(`Tambahkan ${r.sessions.length} jadwal rekomendasi sebagai SPTPL untuk ${p.nama}?`)) return;
      for (const s of r.sessions) if (!(await send({ op: "ent.upsert", ent: { pid: id, tgl: s.tgl, jam: s.jam, sptpl: "Rekomendasi", ket: "", libur: false, status: "" } }))) break;
      render();
    }
  }

  window.Lembur = {
    async init(el, opts) { host = el; canEdit = !!opts.canEdit; dialogs(); host.classList.add("lm"); if (!host._b) { host.addEventListener("click", onClick); host._b = true; } host.innerHTML = "<p>Memuat data lembur…</p>"; await load(); render(); },
    render,
  };
})();
