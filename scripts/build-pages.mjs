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
  const crew = Array.isArray(l.crew) ? l.crew.filter(c => c && c.name) : [];
  const bc = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Rocket Launch Tracker", item: SITE + "/" },
    { "@type": "ListItem", position: 2, name: "Launches", item: SITE + "/" },
    { "@type": "ListItem", position: 3, name: l.name } ] };
  const yt = (l.webcasts || []).map(w => { try { const u = new URL(w.url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    if (u.hostname.includes("youtube.com")){ if (u.pathname.startsWith("/watch")) return u.searchParams.get("v");
      const mm = u.pathname.match(/^\/(live|embed)\/([\w-]{6,})/); if (mm) return mm[2]; } } catch(e){} return null; }).find(Boolean);
  const vid = yt ? { "@context": "https://schema.org", "@type": "VideoObject", name: `${l.name} — launch webcast`,
    description: `Live webcast for ${l.name}.`, thumbnailUrl: [`${SITE}/og/${s}.png`],
    uploadDate: l.net, embedUrl: `https://www.youtube-nocookie.com/embed/${yt}` } : null;
  // internal links: more from this provider / site
  const rel = upcoming.filter(x => x.id !== l.id && (x.provider === l.provider ||
      ((x.pad && x.pad.location && x.pad.location.name) === (loc.name || "—")))).slice(0, 4);
  const HUB = { "SpaceX": "spacex.html", "Rocket Lab": "rocket-lab.html", "United Launch Alliance": "ula.html",
    "Blue Origin": "blue-origin.html", "Arianespace": "arianespace.html", "ISRO": "isro.html" };
  const hubLinks = [
    HUB[l.provider] ? `<a href="../${HUB[l.provider]}">All ${esc(l.provider)} launches</a>` : "",
    /cape canaveral|kennedy/i.test(loc.name || "") ? `<a href="../cape-canaveral.html">Cape Canaveral schedule</a>` : "",
    /vandenberg/i.test(loc.name || "") ? `<a href="../vandenberg.html">Vandenberg schedule</a>` : "",
    /starbase/i.test(loc.name || "") ? `<a href="../starbase.html">Starbase schedule</a>` : "",
    `<a href="../tonight.html">Launches tonight</a>`, `<a href="../this-week.html">This week</a>`,
  ].filter(Boolean).join(" · ");
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
<script type="application/ld+json">${JSON.stringify(bc)}</script>
${vid ? `<script type="application/ld+json">${JSON.stringify(vid)}</script>` : ""}
</head>
<body class="lp">
<header class="lp-head"><a class="lp-brand" href="../"><img src="../favicon.png" alt="" width="22" height="22"> Rocket<span>Launch</span>Tracker</a></header>
<main class="lp-main">
  <p class="lp-kicker">${esc(l.provider || "")}${l.rocket ? " · " + esc(l.rocket) : ""}</p>
  <h1 class="lp-title">${esc(l.name)}</h1>
  <p class="lp-count" id="lpCount">${past ? "Launched" : "—"}</p>
  <div id="lpLive"></div>
  ${crew.length ? `<div class="md-crew">${crew.map(c => `<span class="crew-chip">${c.img ? `<img src="${esc(c.img)}" alt="" loading="lazy" onerror="this.remove()">` : ""}<span><strong>${esc(c.name)}</strong>${c.role ? ` · ${esc(c.role)}` : ""}</span></span>`).join("")}</div>` : ""}
  <div class="md-facts lp-facts">
    ${facts.map(([k, v]) => `<div class="md-fact"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("\n    ")}
    <div class="md-fact" id="lpWx" hidden><div class="k">Forecast at liftoff</div><div class="v">—</div></div>
  </div>
  <div class="md-orbit"><canvas id="orbitCv" aria-hidden="true"></canvas><div class="orbit-cap" id="orbitCap">Illustrative trajectory</div></div>
  ${m.description ? `<p class="lp-desc">${esc(m.description)}</p>` : ""}
  <div class="md-links">
    ${(l.webcasts || []).slice(0, 2).map(w => `<a class="btn btn-primary" href="${esc(w.url)}" target="_blank" rel="noopener">▶ ${esc(w.title || "Webcast")}</a>`).join("\n    ")}
    ${pad.map_url ? `<a class="btn btn-ghost" href="${esc(pad.map_url)}" target="_blank" rel="noopener">Pad map</a>` : ""}
    <a class="btn btn-ghost" href="../sim.html?id=${encodeURIComponent(String(l.id))}">Open simulator ▸</a>
    <a class="btn btn-ghost" href="../">All launches →</a>
  </div>
  ${rel.length ? `<h2 class="stat-h">More launches coming up</h2>
  <ul class="rel-list">${rel.map(x => `<li><a href="${slug(x)}.html">${esc(x.name)}</a> <span class="rel-meta">${esc(fmtUTC(x.net))}${x.pad && x.pad.location && x.pad.location.name ? " · " + esc(x.pad.location.name.split(",")[0]) : ""}</span></li>`).join("")}</ul>` : ""}
  <p class="lp-fine">${hubLinks}</p>
  <p class="lp-fine">Times on this page update to your timezone. Data: <a href="https://thespacedevs.com/llapi" rel="noopener" target="_blank">Launch Library 2</a> · <a href="../glossary.html">Glossary</a> · <a href="../stats.html">Stats</a> · <a href="../about.html">About</a></p>
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

/* ---------- year archive pages ---------- */
const YEARS = Object.keys(byYear).concat(
  (() => { try { return readdirSync("archive").filter(f => /^\d{4}\.json$/.test(f)).map(f => f.slice(0, 4)); } catch { return []; } })()
).filter((v, i, arr) => arr.indexOf(v) === i).sort();
for (const y of YEARS){
  writeFileSync(`launches-${y}.html`, `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${y} rocket launches — complete list and results | Rocket Launch Tracker</title>
<meta name="description" content="Every ${y} rocket launch tracked by this site: dates, missions, providers, rockets, launch sites and outcomes, updated automatically.">
<link rel="canonical" href="${SITE}/launches-${y}.html">
<meta name="robots" content="index,follow">
<link rel="icon" type="image/png" href="favicon.png">
<link rel="stylesheet" href="css/style.css">
</head>
<body class="lp">
<header class="lp-head"><a class="lp-brand" href="./"><img src="favicon.png" alt="" width="22" height="22"> Rocket<span>Launch</span>Tracker</a></header>
<main class="lp-main">
  <p class="lp-kicker">Archive</p>
  <h1 class="lp-title">${y} rocket launches</h1>
  <p class="lp-desc" id="yrNote">Every launch this site has tracked in ${y}, newest first. The list grows automatically after each flight.</p>
  <div class="cmp-wrap"><table class="cmp" id="yrTable"><thead><tr><th>Date (UTC)</th><th>Mission</th><th>Provider</th><th>Rocket</th><th>Site</th><th>Result</th></tr></thead><tbody></tbody></table></div>
  <p class="lp-fine"><a href="./">← All upcoming launches</a> · <a href="stats.html">Stats</a> · Data: <a href="https://thespacedevs.com/llapi" rel="noopener" target="_blank">Launch Library 2</a></p>
</main>
<script>
(async () => {
  const seen = new Map();
  for (const u of ["archive/${y}.json", "data/previous.json"]){
    try{ const r = await fetch(u); if (r.ok) for (const l of ((await r.json()).results || [])) if ((l.net || "").startsWith("${y}")) seen.set(String(l.id), l); }catch(e){}
  }
  const L = [...seen.values()].sort((a, b) => new Date(b.net) - new Date(a.net));
  const esc = x => String(x == null ? "" : x).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const chip = s => { const a = (s && s.abbrev) || "?";
    const cls = a === "Success" ? "chip-go" : (a === "Failure" ? "chip-tbd" : "chip-other");
    return '<span class="chip ' + cls + '">' + esc(a) + "</span>"; };
  document.querySelector("#yrTable tbody").innerHTML = L.map(l =>
    "<tr><td>" + esc((l.net || "").slice(0, 16).replace("T", " ")) + "</td><td>" + esc(l.name) + "</td><td>" + esc(l.provider) +
    "</td><td>" + esc(l.rocket) + "</td><td>" + esc(((l.pad || {}).location || {}).name || "—") + "</td><td>" + chip(l.status) + "</td></tr>").join("");
  if (!L.length) document.getElementById("yrNote").textContent = "No ${y} launches archived yet — check back after the next flight.";
})();
</script>
</body>
</html>
`);
}

/* ---------- intent pages: tonight + this-week (content baked per run) ---------- */
const nowMs = up.generated ? +new Date(up.generated) : 0;
const genDate = up.generated ? new Date(up.generated) : new Date(0);
const fmtDay = d => d.toISOString().slice(0, 10);
function launchRow(l){
  const s = slug(l), loc2 = (l.pad && l.pad.location) || {};
  return `<li class="tn-row"><a href="launch/${s}.html"><strong>${esc(l.name)}</strong></a>
    <span class="rel-meta">${esc(fmtUTC(l.net))} · <span data-local="${esc(l.net)}"></span>${loc2.name ? " · " + flag(loc2.country_code) + esc(loc2.name) : ""}${(l.webcasts || [])[0] ? ` · <a href="${esc(l.webcasts[0].url)}" rel="noopener" target="_blank">watch ▶</a>` : ""}</span></li>`;
}
const LOCAL_ENH = `<script>document.querySelectorAll("[data-local]").forEach(el => { const d = new Date(el.getAttribute("data-local"));
  if (isFinite(+d)) el.textContent = "(" + new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(d) + " your time)"; });</script>`;
function intentPage(fname, title, desc, h1, intro, list, faq){
  const items = list.map(launchRow).join("\n    ");
  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
  writeFileSync(fname, `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/${fname}">
<meta name="robots" content="index,follow">
<link rel="icon" type="image/png" href="favicon.png">
<link rel="stylesheet" href="css/style.css">
<script type="application/ld+json">${JSON.stringify(faqLd)}</script>
</head>
<body class="lp">
<header class="lp-head"><a class="lp-brand" href="./"><img src="favicon.png" alt="" width="22" height="22"> Rocket<span>Launch</span>Tracker</a></header>
<main class="lp-main">
  <p class="lp-kicker">Updated ${esc(fmtUTC(up.generated || "").replace(" UTC", ""))} UTC · refreshes every 6 hours</p>
  <h1 class="lp-title">${h1}</h1>
  <p class="lp-desc">${intro}</p>
  ${list.length ? `<ul class="tn-list">
    ${items}
  </ul>` : `<p class="lp-desc">No launches in this window right now — the schedule shifts often, so check the <a href="./">full board</a>.</p>`}
  <p class="lp-fine"><a href="./">Full schedule</a> · <a href="tonight.html">Tonight</a> · <a href="this-week.html">This week</a> · <a href="news.html">Results</a> · Get a push alert ~45 min before every liftoff: <a href="https://ntfy.sh/rocketlaunchtracker-alerts" rel="noopener" target="_blank">ntfy</a> · <a href="launches.ics">calendar feed</a></p>
</main>
${LOCAL_ENH}
</body>
</html>
`);
}
const next24 = upcoming.filter(l => { const d = +new Date(l.net) - nowMs; return d > -30 * 60e3 && d < 24 * 3600e3; });
const next7 = upcoming.filter(l => { const d = +new Date(l.net) - nowMs; return d > -30 * 60e3 && d < 7 * 86400e3; });
const firstN = next24[0];
intentPage("tonight.html",
  next24.length ? `Rocket Launch Tonight: ${next24.length === 1 ? next24[0].name : next24.length + " launches in the next 24 hours"}` : "Rocket Launch Tonight? Live 24-Hour Schedule",
  next24.length ? `Yes — ${next24.map(l => l.name).slice(0, 2).join("; ")}${next24.length > 2 ? " and more" : ""}. Times in your timezone, webcast links and viewing info.`
                : "Live answer, updated every 6 hours: every rocket launch in the next 24 hours with times in your timezone and webcast links.",
  next24.length ? `Yes — ${next24.length === 1 ? "one launch" : next24.length + " launches"} in the next 24 hours` : "No launch in the next 24 hours",
  next24.length
    ? `${firstN ? `Next up: <strong>${esc(firstN.name)}</strong> at ${esc(fmtUTC(firstN.net))}${firstN.pad && firstN.pad.location && firstN.pad.location.name ? " from " + esc(firstN.pad.location.name) : ""}.` : ""} Every time below converts to your timezone automatically, and most launches stream live — links included.`
    : `Nothing is scheduled to fly in the next 24 hours as of the last data refresh. Launches move around constantly — the <a href="this-week.html">7-day view</a> usually has several.`,
  next24,
  [["Is there a rocket launch tonight?", next24.length ? `Yes. ${next24.map(l => `${l.name} at ${fmtUTC(l.net)}`).join("; ")}.` : "Not in the next 24 hours as of the latest update. Check the 7-day schedule — dates shift often."],
   ["How can I watch the launch live?", "Most launches stream on the provider's official webcast; this page links each one. Streams typically start 15–60 minutes before liftoff."],
   ["Are launch times exact?", "Times are 'no earlier than' and shift often. This page refreshes from Launch Library 2 every 6 hours, and each mission page updates live near liftoff."]]);
intentPage("this-week.html",
  `Rocket Launches This Week — ${next7.length} scheduled`,
  `All ${next7.length} rocket launches in the next 7 days: dates in your timezone, launch sites, webcast links and mission details. Refreshed every 6 hours.`,
  `${next7.length === 1 ? "One launch" : next7.length + " launches"} in the next 7 days`,
  `From ${esc(fmtDay(genDate))} onward — every orbital and suborbital attempt tracked, refreshed every 6 hours. Tap a mission for its countdown, trajectory and forecast.`,
  next7,
  [["How many rocket launches are there this week?", `${next7.length} in the next 7 days as of the latest update.`],
   ["Where are this week's launches from?", [...new Set(next7.map(l => (l.pad && l.pad.location && l.pad.location.name || "").split(",")[0]).filter(Boolean))].join(", ") || "TBD"],
   ["Can dates change?", "Constantly — weather, hardware and range availability all move launches. Subscribe to the calendar feed and every slip updates automatically."]]);

/* ---------- news: auto-recap per completed launch + index ---------- */
mkdirSync("news", { recursive: true });
const newsItems = [];
for (const l of previous){
  const s = slug(l);
  const ok = (l.status && l.status.abbrev) === "Success";
  const fail = (l.status && l.status.abbrev) === "Failure";
  const loc2 = (l.pad && l.pad.location) || {};
  const m2 = l.mission || {};
  const verdict = ok ? "reached orbit successfully" : fail ? "ended in failure" : "has flown";
  const title = `${l.rocket || "Rocket"} launches ${m2.name || l.name} — ${ok ? "success" : fail ? "failure" : "results"}`;
  const fname = `news/${s}-results.html`;
  const desc = `${l.provider || "The operator"}'s ${l.rocket || "rocket"} lifted off from ${loc2.name || "the pad"} at ${fmtUTC(l.net)} carrying ${m2.name || "its payload"} — full results, orbit and mission details.`;
  const art = { "@context": "https://schema.org", "@type": "NewsArticle", headline: title.slice(0, 110),
    datePublished: l.net, dateModified: up.generated || l.net,
    image: [`${SITE}/og/${s}.png`], author: { "@type": "Organization", name: "Rocket Launch Tracker" },
    publisher: { "@type": "Organization", name: "Rocket Launch Tracker", logo: { "@type": "ImageObject", url: `${SITE}/apple-touch-icon.png` } },
    mainEntityOfPage: `${SITE}/${fname}`, description: desc };
  newsItems.push({ fname, title, net: l.net, ok, fail, name: l.name });
  writeFileSync(fname, `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | Rocket Launch Tracker</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/${fname}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE}/${fname}">
<link rel="icon" type="image/png" href="../favicon.png">
<link rel="stylesheet" href="../css/style.css">
<script type="application/ld+json">${JSON.stringify(art)}</script>
</head>
<body class="lp">
<header class="lp-head"><a class="lp-brand" href="../"><img src="../favicon.png" alt="" width="22" height="22"> Rocket<span>Launch</span>Tracker</a></header>
<main class="lp-main">
  <p class="lp-kicker">Launch result · ${esc(fmtUTC(l.net).slice(0, 10))}</p>
  <h1 class="lp-title">${esc(title)}</h1>
  <p class="lp-desc">${esc(l.provider || "The operator")}'s <strong>${esc(l.rocket || "rocket")}</strong> lifted off at <strong>${esc(fmtUTC(l.net))}</strong>${loc2.name ? ` from ${flag(loc2.country_code)}${esc([l.pad && l.pad.name, loc2.name].filter(Boolean).join(", "))}` : ""} and ${verdict}${m2.orbit ? `, targeting ${esc(m2.orbit)}` : ""}.${m2.description ? " " + esc(m2.description) : ""}</p>
  <div class="md-facts lp-facts">
    <div class="md-fact"><div class="k">Result</div><div class="v">${esc((l.status && l.status.name) || "Flown")}</div></div>
    <div class="md-fact"><div class="k">Liftoff (UTC)</div><div class="v mono">${esc(fmtUTC(l.net))}</div></div>
    ${l.provider ? `<div class="md-fact"><div class="k">Provider</div><div class="v">${esc(l.provider)}</div></div>` : ""}
    ${m2.orbit ? `<div class="md-fact"><div class="k">Target orbit</div><div class="v">${esc(m2.orbit)}</div></div>` : ""}
  </div>
  <p class="lp-fine"><a href="../launch/${s}.html">Full mission page & trajectory →</a> · <a href="../news.html">All recent results</a> · <a href="../">Upcoming launches</a> · <a href="../stats.html">Stats</a></p>
</main>
</body>
</html>
`);
}
newsItems.sort((a, b) => new Date(b.net) - new Date(a.net));
writeFileSync("news.html", `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rocket Launch Results — latest outcomes | Rocket Launch Tracker</title>
<meta name="description" content="The latest rocket launch results, updated automatically after every flight: successes, failures, liftoff times and mission details.">
<link rel="canonical" href="${SITE}/news.html">
<meta name="robots" content="index,follow">
<link rel="icon" type="image/png" href="favicon.png">
<link rel="stylesheet" href="css/style.css">
</head>
<body class="lp">
<header class="lp-head"><a class="lp-brand" href="./"><img src="favicon.png" alt="" width="22" height="22"> Rocket<span>Launch</span>Tracker</a></header>
<main class="lp-main">
  <p class="lp-kicker">Auto-updated after every flight</p>
  <h1 class="lp-title">Latest launch results</h1>
  <ul class="tn-list">
    ${newsItems.map(n => `<li class="tn-row"><a href="${n.fname}"><strong>${esc(n.title)}</strong></a> <span class="rel-meta">${esc(fmtUTC(n.net))}${n.ok ? " · ✅" : n.fail ? " · ❌" : ""}</span></li>`).join("\n    ")}
  </ul>
  <p class="lp-fine"><a href="./">Upcoming launches</a> · <a href="launches-${new Date(nowMs || Date.now()).getUTCFullYear()}.html">Year archive</a> · <a href="stats.html">Stats</a></p>
</main>
</body>
</html>
`);

/* ---------- dynamic homepage title/description + hero preload (idempotent) ---------- */
{
  const first = upcoming.find(l => +new Date(l.net) > nowMs) || upcoming[0];
  let ih = readFileSync("index.html", "utf8");
  if (first){
    const when = fmtUTC(first.net).slice(0, 16);
    ih = ih.replace(/<title>[^<]*<\/title>/,
      `<title>Next Rocket Launch: ${esc((first.name || "").split("|").pop().trim())} — ${esc(when)} UTC · Live Countdown & Schedule</title>`);
    ih = ih.replace(/(<meta name="description" content=")[^"]*(">)/,
      `$1Live countdown to ${esc(first.name)} (${esc(when)} UTC) plus the full schedule of every upcoming rocket launch — SpaceX, NASA, ULA, Rocket Lab and more, in your timezone.$2`);
    // hero image self-host hooks
    const meta = `<meta name="rlt-hero-id" content="${esc(String(first.id))}">`;
    const pre = `<link rel="preload" as="image" href="img/next.jpg" fetchpriority="high">`;
    ih = ih.replace(/<meta name="rlt-hero-id"[^>]*>\n?/g, "").replace(/<link rel="preload" as="image" href="img\/next.jpg"[^>]*>\n?/g, "");
    ih = ih.replace('<link rel="preload" href="data/launches.json" as="fetch">',
      `<link rel="preload" href="data/launches.json" as="fetch">\n${pre}\n${meta}`);
    writeFileSync("index.html", ih);
  }
}

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
  "glossary.html", "stats.html", "compare.html", "api.html", "sim.html",
  "tonight.html", "this-week.html", "news.html", "about.html",
  "see-launch-from-orlando.html", "see-launch-from-miami.html", "see-launch-from-tampa.html",
  "see-launch-from-jacksonville.html", "see-launch-from-daytona-beach.html", "see-launch-from-cocoa-beach.html",
  "see-launch-from-melbourne-fl.html", "see-launch-from-west-palm-beach.html",
  "see-launch-from-los-angeles.html", "see-launch-from-san-diego.html", "see-launch-from-santa-barbara.html",
  "see-launch-from-lompoc.html", "see-launch-from-brownsville.html", "see-launch-from-south-padre-island.html",
  ...YEARS.map(y => `launches-${y}.html`)];
const urls = [
  ...core.map(u => `  <url><loc>${SITE}/${u}</loc><lastmod>${today}</lastmod><changefreq>${u === "" ? "hourly" : "daily"}</changefreq><priority>${u === "" ? "1.0" : "0.7"}</priority></url>`),
  ...upcoming.map(l => `  <url><loc>${SITE}/launch/${slug(l)}.html</loc><lastmod>${today}</lastmod><changefreq>hourly</changefreq><priority>0.8</priority></url>`),
  ...previous.map(l => `  <url><loc>${SITE}/news/${slug(l)}-results.html</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`)
];
writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);

console.log(`pages: ${keep.size} launch pages, ${man.length} og entries, sitemap ${core.length + upcoming.length} urls`);
