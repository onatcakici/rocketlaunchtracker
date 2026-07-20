#!/usr/bin/env node
/* Builds per-launch pages, og manifest, launch archive and sitemap
   from data/launches.json + data/previous.json. No dependencies.
   Run from the repo root: node scripts/build-pages.mjs */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from "node:fs";

const SITE = "https://rocketlaunchtracker.com";
const CC3 = { USA:"US",NZL:"NZ",IND:"IN",GUF:"GF",JPN:"JP",CHN:"CN",RUS:"RU",KAZ:"KZ",FRA:"FR",GBR:"GB",
  KOR:"KR",PRK:"KP",ISR:"IL",IRN:"IR",AUS:"AU",BRA:"BR",NOR:"NO",SWE:"SE",ESP:"ES",DEU:"DE",ITA:"IT",
  CAN:"CA",MEX:"MX",UKR:"UA",IDN:"ID",ARG:"AR",NLD:"NL",PRT:"PT" };
const flag = code => {
  if (!code) return "";
  let cc = String(code).trim().toUpperCase();
  if (cc.length === 3) cc = CC3[cc] || "";
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) + " ";
};
const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slug = l => (l.name || "launch").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60)
  + "-" + String(l.id).replace(/[^a-z0-9]/gi, "").slice(0, 8);

const read = p => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };
const up = read("data/launches.json") || { results: [] };
const prev = read("data/previous.json") || { results: [] };
const upcoming = up.results || [];
const previous = prev.results || [];

/* ---------- archive merge (previous launches accumulate per year) ---------- */
mkdirSync("archive", { recursive: true });
const byYear = {};
for (const l of previous){
  const y = (l.net || "").slice(0, 4);
  if (!/^\d{4}$/.test(y)) continue;
  (byYear[y] = byYear[y] || []).push(l);
}
for (const [y, list] of Object.entries(byYear)){
  const path = `archive/${y}.json`;
  const cur = read(path) || { year: +y, results: [] };
  const seen = new Map(cur.results.map(l => [String(l.id), l]));
  for (const l of list) seen.set(String(l.id), l);   // newest data wins
  const merged = [...seen.values()].sort((a, b) => new Date(b.net) - new Date(a.net));
  writeFileSync(path, JSON.stringify({ year: +y, updated: up.generated || null, count: merged.length, results: merged }, null, 1));
}

/* ---------- per-launch pages ---------- */
mkdirSync("launch", { recursive: true });
const fmtUTC = iso => {
  const d = new Date(iso);
  if (!isFinite(+d)) return "TBD";
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
};
function page(l, past){
  const s = slug(l);
  const m = l.mission || {};
  const pad = l.pad || {}, loc = pad.location || {};
  const title = `${l.name} — ${fmtUTC(l.net)}${loc.name ? " from " + loc.name : ""}`;
  const desc = (m.description ? String(m.description).slice(0, 155).replace(/\s+\S*$/, "") + "…"
    : `Launch time, countdown, pad, orbit and webcast for ${l.name}.`);
  const orbitName = m.orbit || "";
  const ld = {
    "@context": "https://schema.org", "@type": "Event",
    name: l.name, startDate: l.net, eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    location: { "@type": "Place", name: [pad.name, loc.name].filter(Boolean).join(", ") || "Launch site",
      address: loc.name || "Earth" },
    image: [`${SITE}/og/${s}.png`],
    description: desc,
    organizer: { "@type": "Organization", name: l.provider || "Launch provider" },
    offers: { "@type": "Offer", url: `${SITE}/launch/${s}.html`, price: "0", priceCurrency: "USD",
      availability: "https://schema.org/InStock", validFrom: l.net }
  };
  const data = { id: l.id, name: l.name, net: l.net, windowEnd: l.window_end, status: l.status || {},
    provider: l.provider, rocket: l.rocket, orbit: orbitName, pad: pad.name,
    location: loc.name, country: loc.country_code,
    latitude: pad.latitude, longitude: pad.longitude,
    webcasts: l.webcasts || [], image: l.image || null, past: !!past };
  const facts = [
    ["Liftoff (UTC)", `<span class="mono">${esc(fmtUTC(l.net))}</span>`],
    ["Liftoff (your time)", `<span data-local="${esc(l.net)}">—</span>`],
    l.window_end && l.window_end !== l.net ? ["Window closes", `<span data-local="${esc(l.window_end)}">—</span>`] : null,
    pad.name ? ["Pad", esc(pad.name)] : null,
    loc.name ? ["Location", flag(loc.country_code) + esc(loc.name) + (loc.country_code ? " · " + esc(loc.country_code) : "")] : null,
    m.type ? ["Mission type", esc(m.type)] : null,
    orbitName ? ["Target orbit", esc(orbitName)] : null,
    l.probability != null ? ["Weather odds", esc(l.probability) + "% go"] : null,
    (l.status && l.status.name) ? ["Status", esc(l.status.name)] : null,
  ].filter(Boolean);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | Rocket Launch Tracker</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/launch/${s}.html">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(l.name)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}/launch/${s}.html">
<meta property="og:image" content="${SITE}/og/${s}.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/og/${s}.png">
<link rel="icon" type="image/png" href="../favicon.png">
<link rel="stylesheet" href="../css/style.css">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body class="lp">
<header class="lp-head"><a class="lp-brand" href="../"><img src="../favicon.png" alt="" width="22" height="22"> Rocket<span>Launch</span>Tracker</a></header>
<main class="lp-main">
  <p class="lp-kicker">${esc(l.provider || "")}${l.rocket ? " · " + esc(l.rocket) : ""}</p>
  <h1 class="lp-title">${esc(l.name)}</h1>
  <p class="lp-count" id="lpCount">${past ? "Launched" : "—"}</p>
  <div id="lpLive"></div>
  <div class="md-facts lp-facts">
    ${facts.map(([k, v]) => `<div class="md-fact"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("\n    ")}
    <div class="md-fact" id="lpWx" hidden><div class="k">Forecast at liftoff</div><div class="v">—</div></div>
  </div>
  <div class="md-orbit"><canvas id="orbitCv" aria-hidden="true"></canvas><div class="orbit-cap" id="orbitCap">Illustrative trajectory</div></div>
  ${m.description ? `<p class="lp-desc">${esc(m.description)}</p>` : ""}
  <div class="md-links">
    ${(l.webcasts || []).slice(0, 2).map(w => `<a class="btn btn-primary" href="${esc(w.url)}" target="_blank" rel="noopener">▶ ${esc(w.title || "Webcast")}</a>`).join("\n    ")}
    ${pad.map_url ? `<a class="btn btn-ghost" href="${esc(pad.map_url)}" target="_blank" rel="noopener">Pad map</a>` : ""}
    <a class="btn btn-ghost" href="../">All launches →</a>
  </div>
  <p class="lp-fine">Times on this page update to your timezone. Data: <a href="https://thespacedevs.com/llapi" rel="noopener" target="_blank">Launch Library 2</a> · <a href="../glossary.html">Glossary</a> · <a href="../stats.html">Stats</a></p>
</main>
<script>window.__LAUNCH = ${JSON.stringify(data)};</script>
<script src="../js/orbit.js"></script>
<script src="../js/launch.js"></script>
</body>
</html>
`;
}

const keep = new Set();
for (const l of upcoming){ const s = slug(l); keep.add(s + ".html"); writeFileSync(`launch/${s}.html`, page(l, false)); }
for (const l of previous){ const s = slug(l); if (!keep.has(s + ".html")){ keep.add(s + ".html"); writeFileSync(`launch/${s}.html`, page(l, true)); } }
for (const f of readdirSync("launch")) if (f.endsWith(".html") && !keep.has(f)) unlinkSync(`launch/${f}`);

/* ---------- og manifest ---------- */
mkdirSync("og", { recursive: true });
const man = upcoming.map(l => ({ slug: slug(l), name: l.name, provider: l.provider || "", rocket: l.rocket || "",
  when: fmtUTC(l.net), flag: flag((l.pad && l.pad.location && l.pad.location.country_code) || ""),
  site: (l.pad && l.pad.location && l.pad.location.name) || "",
  key: [slug(l), l.net, l.status && l.status.abbrev].join("|") }));
writeFileSync("og/manifest.json", JSON.stringify(man, null, 1));

/* ---------- sitemap ---------- */
const today = (up.generated || new Date().toISOString()).slice(0, 10);
const core = ["", "cape-canaveral.html", "vandenberg.html", "starbase.html", "florida.html",
  "spacex.html", "rocket-lab.html", "ula.html", "blue-origin.html", "arianespace.html", "isro.html",
  "falcon-9.html", "starship.html", "electron.html", "new-glenn.html", "ariane-6.html", "vulcan.html",
  "glossary.html", "stats.html"];
const urls = [
  ...core.map(u => `  <url><loc>${SITE}/${u}</loc><lastmod>${today}</lastmod><changefreq>${u === "" ? "hourly" : "daily"}</changefreq><priority>${u === "" ? "1.0" : "0.7"}</priority></url>`),
  ...upcoming.map(l => `  <url><loc>${SITE}/launch/${slug(l)}.html</loc><lastmod>${today}</lastmod><changefreq>hourly</changefreq><priority>0.8</priority></url>`)
];
writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);

console.log(`pages: ${keep.size} launch pages, ${man.length} og entries, sitemap ${core.length + upcoming.length} urls`);
