#!/usr/bin/env node
/* Renders og/<slug>.png share cards (1200x630) from og/manifest.json.
   Uses playwright-core with a system Chrome/Chromium binary — exact viewport,
   one browser for all cards. Skips unchanged cards via og/.stamps.json.
   Run from repo root:  node scripts/build-og.mjs
   Chrome binary: $CHROME, or google-chrome / chromium-browser / chromium on PATH. */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

let pw;
try { pw = await import("playwright-core"); }
catch { try { pw = await import("playwright"); } catch { console.error("playwright-core not installed — skipping og render"); process.exit(0); } }

const chrome = process.env.CHROME || ["google-chrome", "chromium-browser", "chromium"].map(c => {
  try { return execFileSync("which", [c], { stdio: "pipe" }).toString().trim(); } catch { return null; }
}).find(Boolean);
if (!chrome){ console.error("no chrome binary found — skipping og render"); process.exit(0); }

const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const man = JSON.parse(readFileSync("og/manifest.json", "utf8"));
const stampsPath = "og/.stamps.json";
const stamps = existsSync(stampsPath) ? JSON.parse(readFileSync(stampsPath, "utf8")) : {};
mkdirSync("og", { recursive: true });

const tpl = (m) => `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;box-sizing:border-box}
  html,body{width:1200px;height:630px;background:#f6f7f9}
  body{font-family:Inter,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;overflow:hidden;position:relative}
  .left{padding:64px 40px 0 64px;width:760px;position:relative;z-index:2}
  .kick{font-size:26px;font-weight:600;color:#2563eb;letter-spacing:.02em}
  .name{font-size:${m.name.length > 46 ? 52 : 62}px;font-weight:700;line-height:1.08;letter-spacing:-.02em;margin-top:14px;
    display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  .when{font-size:30px;color:#475569;margin-top:18px}
  .when b{color:#0f172a;font-weight:600}
  .brand{position:absolute;left:64px;bottom:52px;display:flex;align-items:center;gap:14px;font-size:24px;font-weight:600;letter-spacing:.06em;color:#475569;z-index:2}
  .dot{width:14px;height:14px;border-radius:50%;background:#2563eb}
  svg{position:absolute;right:-160px;top:50%;transform:translateY(-50%)}
</style></head><body>
  <div class="left">
    <div class="kick">${esc(m.provider)}${m.rocket ? " · " + esc(m.rocket) : ""}</div>
    <div class="name">${esc(m.name)}</div>
    <div class="when"><b>${esc(m.when)}</b>${m.site ? " — " + esc(m.flag + m.site) : ""}</div>
  </div>
  <div class="brand"><span class="dot"></span>ROCKETLAUNCHTRACKER.COM</div>
  <svg width="720" height="720" viewBox="0 0 720 720" fill="none">
    <circle cx="360" cy="360" r="300" fill="#eef2f8" stroke="#c9d2e0" stroke-width="2"/>
    <ellipse cx="360" cy="360" rx="300" ry="110" stroke="#c9d2e0" fill="none"/>
    <ellipse cx="360" cy="360" rx="300" ry="220" stroke="#dde3ee" fill="none"/>
    <ellipse cx="360" cy="360" rx="110" ry="300" stroke="#c9d2e0" fill="none"/>
    <ellipse cx="360" cy="360" rx="220" ry="300" stroke="#dde3ee" fill="none"/>
    <ellipse cx="360" cy="360" rx="345" ry="150" stroke="#2563eb" stroke-width="3" stroke-dasharray="10 12" fill="none" transform="rotate(-24 360 360)"/>
    <circle cx="220" cy="212" r="11" fill="#2563eb"/>
    <path d="M330 415 Q 290 330 225 218" stroke="#2563eb" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="332" cy="418" r="6" fill="#dc2626"/>
  </svg>
</body></html>`;

const todo = man.filter(m => stamps[m.slug] !== m.key || !existsSync(`og/${m.slug}.png`));
if (!todo.length){ console.log(`og: 0 rendered, ${man.length} unchanged`); process.exit(0); }

const browser = await pw.chromium.launch({ executablePath: chrome, args: ["--no-sandbox", "--disable-gpu"] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 } })).newPage();
let made = 0;
for (const m of todo){
  try{
    await page.setContent(tpl(m), { waitUntil: "load" });
    await page.screenshot({ path: `og/${m.slug}.png` });
    stamps[m.slug] = m.key; made++;
  }catch(e){ console.error("og fail", m.slug, String(e).slice(0, 120)); }
}
await browser.close();
const live = new Set(man.map(m => m.slug));
for (const k of Object.keys(stamps)) if (!live.has(k)) delete stamps[k];
writeFileSync(stampsPath, JSON.stringify(stamps, null, 1));
console.log(`og: ${made} rendered, ${man.length - todo.length} unchanged`);
