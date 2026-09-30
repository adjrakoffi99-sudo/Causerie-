const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_q, r) => r.json({ ok: true }));

const online = new Map();  // numéro -> connexion
const pending = new Map(); // numéro -> messages en attente (en mémoire)

/* ---------- Numéros autorisés (gérés par l'administrateur) ---------- */
const SECRET = process.env.SECRET || crypto.randomBytes(32).toString("hex");
const DATA = process.env.DATA_DIR || path.join(__dirname, "data");
const FILE = path.join(DATA, "users.json");
let users = {};
try { users = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch {}
const save = () => { try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(users)); } catch (e) { console.error("Sauvegarde impossible:", e.message); } };

// Tous les pays utilisent un indicatif à 3 chiffres (+2xx) ; le 0 local du début est ignoré
const norm = (s) => { const d = String(s || "").replace(/\D/g, "").replace(/^00/, ""); return d.length >= 10 ? "+" + d.slice(0, 3) + d.slice(3).replace(/^0+/, "") : ""; };
const validId = (id) => typeof id === "string" && /^\+\d{7,16}$/.test(id);
const hashCode = (code, salt) => crypto.scryptSync(String(code), salt, 32).toString("hex");
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const tokenFor = (u) => crypto.createHmac("sha256", SECRET).update(u.id + ":" + u.ver).digest("hex");
function kick(id) { const w = online.get(id); if (w) { try { w.send(JSON.stringify({ type: "denied" })); w.close(); } catch {} online.delete(id); } }
function setCode(u) {
  const code = String(crypto.randomInt(100000, 1000000));
  u.salt = crypto.randomBytes(16).toString("hex");
  u.hash = hashCode(code, u.salt);
  u.ver = (u.ver || 0) + 1; // invalide les anciennes connexions
  kick(u.id);
  return code;
}

/* ---------- Connexion d'un utilisateur : numéro + code d'accès ---------- */
const fails = new Map();
app.post("/api/login", (q, r) => {
  const { id, code } = q.body || {};
  const key = q.ip + "|" + id;
  const f = fails.get(key) || { n: 0, t: Date.now() };
  if (Date.now() - f.t > 15 * 60e3) { f.n = 0; f.t = Date.now(); }
  if (f.n >= 5) return r.status(429).json({ error: "Trop d'essais. Réessaie dans 15 minutes." });
  const u = validId(id) && users[id];
  if (!u || u.blocked || !eq(hashCode(code, u.salt), u.hash)) {
    f.n++; fails.set(key, f);
    return r.status(401).json({ error: "Numéro non autorisé ou code incorrect." });
  }
  fails.delete(key);
  r.json({ token: tokenFor(u) });
});

/* ---------- Page administrateur (/admin) ---------- */
const admin = (q, r, next) => {
  const p = process.env.ADMIN_PASSWORD;
  const h = (q.headers.authorization || "").split(" ")[1] || "";
  const pw = Buffer.from(h, "base64").toString().split(":").slice(1).join(":");
  if (p && eq(pw, p)) return next();
  r.set("WWW-Authenticate", 'Basic realm="Causerie admin"').status(401).send("Accès refusé");
};
app.get("/admin", admin, (_q, r) => r.sendFile(path.join(__dirname, "admin.html")));
app.get("/api/admin/users", admin, (_q, r) =>
  r.json(Object.values(users).map((u) => ({ id: u.id, name: u.name, blocked: !!u.blocked, online: online.has(u.id) }))));
app.post("/api/admin/add", admin, (q, r) => { // autorise un numéro OU crée un nouveau code
  const id = norm(q.body && q.body.id);
  if (!validId(id)) return r.status(400).json({ error: "Numéro invalide (ex. +225 07 00 00 00 00)." });
  const u = users[id] || (users[id] = { id });
  u.name = String((q.body && q.body.name) || u.name || "").slice(0, 40);
  u.blocked = false;
  const code = setCode(u);
  save();
  r.json({ code, id });
});
app.post("/api/admin/block", admin, (q, r) => {
  const u = users[q.body && q.body.id];
  if (!u) return r.status(404).json({ error: "Numéro inconnu." });
  u.blocked = !!q.body.blocked;
  if (u.blocked) kick(u.id);
  save(); r.json({ ok: true });
});
app.post("/api/admin/remove", admin, (q, r) => {
  const id = q.body && q.body.id;
  if (users[id]) { kick(id); delete users[id]; save(); }
  r.json({ ok: true });
});

/* ---------- Serveurs pour les appels (STUN + TURN optionnel) ---------- */
app.get("/api/ice", (_q, r) => {
  const s = [{ urls: "stun:stun.l.google.com:19302" }];
  if (process.env.TURN_URL) s.push({ urls: process.env.TURN_URL.split(","), username: process.env.TURN_USER, credential: process.env.TURN_PASS });
  r.json(s);
});

app.get("*", (_q, r) => r.sendFile(path.join(__dirname, "public", "index.html")));

/* ---------- Temps réel : messages, appels, présence ---------- */
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 6 * 1024 * 1024 });

wss.on("connection", (ws) => {
  ws.id = null;
  ws.on("message", (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }

    if (m.type === "hello" && validId(m.id)) {
      const u = users[m.id];
      if (!u || u.blocked || !eq(m.token, tokenFor(u))) { ws.send(JSON.stringify({ type: "denied" })); return; }
      ws.id = m.id;
      ws.hide = !!m.hide;
      online.set(m.id, ws);
      (pending.get(m.id) || []).forEach((x) => ws.send(x));
      pending.delete(m.id);
      ws.send(JSON.stringify({ type: "ready" }));
      return;
    }
    if (!ws.id) return;

    if (m.type === "presence" && Array.isArray(m.ids)) {
      const on = m.ids.slice(0, 500).filter((i) => online.has(i) && !online.get(i).hide);
      ws.send(JSON.stringify({ type: "presence", online: on }));
      return;
    }
    if (typeof m.to !== "string") return;
    const out = JSON.stringify({ ...m, from: ws.id, at: Date.now() });
    const dest = online.get(m.to);
    if (dest && dest.readyState === 1) dest.send(out);
    else if (m.type === "msg") {
      const q = pending.get(m.to) || [];
      if (q.length < 50) { q.push(out); pending.set(m.to, q); }
    }
  });
  ws.on("close", () => { if (ws.id && online.get(ws.id) === ws) online.delete(ws.id); });
});

setInterval(() => wss.clients.forEach((c) => c.readyState === 1 && c.ping()), 30000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Causerie en ligne sur le port " + PORT));
