/* ============================================================
   ROCKET LAUNCH TRACKER — app.js
   Data: Launch Library 2 (The Space Devs)
   Strategy: use repo-cached data/launches.json (refreshed by a
   GitHub Action every ~6h); fall back to / refresh from the live
   API in the browser. All times rendered in the viewer's zone.
   ============================================================ */
"use strict";
console.log("RLT build v4.6");

const DATA_URL = "data/launches.json";
const API_URL  = "https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=60&mode=detailed";
const STALE_MS = 6 * 3600 * 1000;      // cached file considered stale after 6h
const LS_KEY   = "rlt.cache.v1";

const $  = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

const state = {
  launches: [],        // normalized, sorted by net
  generated: null,     // Date the dataset was produced
  source: "…",
  sample: false,
  q: "", provider: "", status: "",
  previous: [],
  view: "list",
  calCursor: null,     // Date anchored to displayed month
};

/* ---------------- utilities ---------------- */
function escapeHtml(s){
  return String(s == null ? "" : s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function pad2(n){ return String(n).padStart(2,"0"); }
const TZ_NAME = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "local time"; } catch(e){ return "local time"; } })();

function fmtLocal(d, opts){
  return new Intl.DateTimeFormat(undefined, Object.assign({
    weekday:"short", month:"short", day:"numeric", hour:"numeric", minute:"2-digit"
  }, opts || {})).format(d);
}
function fmtUTC(d){
  return d.toISOString().replace("T"," ").slice(0,16) + " UTC";
}
function sameLocalDay(a,b){
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function dayKey(d){ return d.getFullYear()+"-"+pad2(d.getMonth()+1)+"-"+pad2(d.getDate()); }

const CC3 = { USA:"US",NZL:"NZ",IND:"IN",GUF:"GF",JPN:"JP",CHN:"CN",RUS:"RU",KAZ:"KZ",FRA:"FR",GBR:"GB",
  KOR:"KR",PRK:"KP",ISR:"IL",IRN:"IR",AUS:"AU",BRA:"BR",NOR:"NO",SWE:"SE",ESP:"ES",DEU:"DE",ITA:"IT",
  CAN:"CA",MEX:"MX",UKR:"UA",IDN:"ID",ARG:"AR",NLD:"NL",PRT:"PT" };
function flag(code){
  if (!code) return "";
  let cc = String(code).trim().toUpperCase();
  if (cc.length === 3) cc = CC3[cc] || "";
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) + " ";
}

function slugFor(l){
  return (l.name || "launch").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60)
    + "-" + String(l.id).replace(/[^a-z0-9]/gi, "").slice(0, 8);
}
function ytId(u){
  try{
    const url = new URL(u);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1) || null;
    if (url.hostname.includes("youtube.com")){
      if (url.pathname.startsWith("/watch")) return url.searchParams.get("v");
      const m = url.pathname.match(/^\/(live|embed)\/([\w-]{6,})/);
      if (m) return m[2];
    }
  }catch(e){}
  return null;
}
function glossaryAnchor(orbitName){
  const o = (orbitName || "").toLowerCase();
  if (o.includes("gto") || o.includes("transfer")) return "gto";
  if (o.includes("sun-sync") || o.includes("sso") || o.includes("polar")) return "sso";
  if (o.includes("geo")) return "geo";
  if (o.includes("medium") || o.includes("meo")) return "meo";
  if (o.includes("suborbital")) return "suborbital";
  if (o.includes("mars") || o.includes("lunar") || o.includes("moon") || o.includes("injection") || o.includes("escape")) return "escape";
  if (o.includes("low earth") || o.includes("leo")) return "leo";
  return "";
}
function statusClass(abbrev){
  if (abbrev === "Go" || abbrev === "Success") return "go";
  if (abbrev === "TBC") return "tbc";
  if (abbrev === "TBD" || abbrev === "Hold" || abbrev === "Failure") return "tbd";
  return "other";
}
function chip(l){
  const cls = statusClass(l.status.abbrev);
  const map = { go:"chip-go", tbc:"chip-tbc", tbd:"chip-tbd", other:"chip-other" };
  return `<span class="chip ${map[cls]}" title="${escapeHtml(l.status.name)}">${escapeHtml(l.status.abbrev || l.status.name || "?")}</span>`;
}
function tMinus(net, now){
  let diff = net - (now || Date.now());
  const past = diff < 0; if (past) diff = -diff;
  const d = Math.floor(diff/86400000), h = Math.floor(diff/3600000)%24,
        m = Math.floor(diff/60000)%60, s = Math.floor(diff/1000)%60;
  return { past, d, h, m, s,
    short: (past?"T+":"T−") + (d>0 ? `${d}d ${pad2(h)}h` : `${pad2(h)}:${pad2(m)}:${pad2(s)}`) };
}

/* ---------------- normalization (defensive across LL2 versions) ---------------- */
function pick(...vals){ for (const v of vals) if (v !== undefined && v !== null && v !== "") return v; return null; }
function normalize(raw){
  const list = Array.isArray(raw) ? raw : (raw.results || raw.launches || []);
  const out = [];
  for (const r of list){
    try{
      const img = r.image && typeof r.image === "object" ? pick(r.image.image_url, r.image.thumbnail_url) : r.image;
      const vids = (r.webcasts || r.vid_urls || r.vidURLs || []).map(v =>
        typeof v === "string" ? { title:"Webcast", url:v } :
        { title: pick(v.title, v.publisher, "Webcast"), url: v.url }).filter(v => v.url);
      const mtypeRaw = r.mission && (r.mission.type !== undefined ? r.mission.type : null);
      const mtype = mtypeRaw && typeof mtypeRaw === "object" ? pick(mtypeRaw.name) : mtypeRaw;
      const orbitRaw = r.mission && r.mission.orbit;
      const orbit = orbitRaw && typeof orbitRaw === "object" ? pick(orbitRaw.name, orbitRaw.abbrev) : orbitRaw;
      const loc = r.pad && (r.pad.location || {});
      const provider = pick(r.provider, r.launch_service_provider && r.launch_service_provider.name, "Unknown provider");
      const rocket = pick(r.rocket && typeof r.rocket === "object" && r.rocket.configuration
          ? pick(r.rocket.configuration.full_name, r.rocket.configuration.name) : null,
          typeof r.rocket === "string" ? r.rocket : null,
          r.name && r.name.split("|")[0].trim(), "Rocket");
      const net = new Date(pick(r.net, r.window_start, r.t0));
      if (isNaN(+net)) continue;
      out.push({
        id: pick(r.id, r.slug, r.name),
        name: pick(r.name, "Launch"),
        missionName: pick(r.mission && r.mission.name, (r.name||"").split("|")[1] && r.name.split("|")[1].trim(), r.name),
        rocket, provider,
        net,
        windowStart: r.window_start ? new Date(r.window_start) : null,
        windowEnd: r.window_end ? new Date(r.window_end) : null,
        netPrecision: pick(r.net_precision && (r.net_precision.name || r.net_precision), null),
        status: {
          abbrev: pick(r.status && r.status.abbrev, r.status && r.status.name, "TBD"),
          name: pick(r.status && r.status.name, "Unknown"),
          description: pick(r.status && r.status.description, null),
        },
        probability: (typeof r.probability === "number" && r.probability >= 0) ? r.probability : null,
        image: img || null,
        desc: pick(r.mission && r.mission.description, null),
        mtype: mtype || null, orbit: orbit || null,
        pad: pick(r.pad && r.pad.name, null),
        mapUrl: pick(r.pad && r.pad.map_url, null),
        latitude: pick(r.pad && r.pad.latitude, null),
        longitude: pick(r.pad && r.pad.longitude, null),
        location: pick(loc.name, null),
        country: pick(loc.country_code, loc.country && (loc.country.alpha_2_code || loc.country.name), null),
        webcasts: vids,
        webcastLive: !!r.webcast_live,
      });
    }catch(e){ /* skip malformed record */ }
  }
  out.sort((a,b) => a.net - b.net);
  return out;
}

/* ---------------- data loading ---------------- */
async function fetchJson(url){
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(url + " → HTTP " + res.status);
  return res.json();
}
function lsGet(){ try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch(e){ return null; } }
function lsSet(v){ try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch(e){} }

let painted = false;
function applyDataset(dataset){
  // never replace real data with sample data
  if (painted && dataset.sample && !state.sample) return;
  state.launches  = normalize(dataset.raw);
  state.generated = dataset.generated;
  state.source    = dataset.source;
  state.sample    = dataset.sample;
  buildProviderOptions();
  renderSites();
  renderAll();
  injectSchema();
  if (!painted){ painted = true; loadPrevious(); openFromHash(); }
}

async function loadData(force){
  // 0. instant paint from the previous visit's saved copy (no network wait)
  if (!force && !painted){
    const c = lsGet();
    if (c && c.data){
      applyDataset({ raw:c.data, source:"saved copy", generated:new Date(c.t), sample:false });
    }
  }

  // 1. repo-cached feed (preloaded in <head>; fast, same-origin)
  let dataset = null;
  if (!force){
    try {
      const j = await fetchJson(DATA_URL);
      dataset = { raw:j, source:"cached feed", generated: j.generated ? new Date(j.generated) : null, sample: !!j.sample };
      applyDataset(dataset);
      if (!dataset.sample) lsSet({ t: dataset.generated ? +dataset.generated : Date.now(), data: j });
    } catch(e){ /* file:// preview or missing file */ }
  }

  // 2. live API refresh in the background when the feed is missing/stale.
  //    The page is already interactive — this only upgrades the data.
  const stale = !dataset || dataset.sample || !dataset.generated || (Date.now() - dataset.generated > STALE_MS);
  if (stale || force){
    try {
      const j = await fetchJson(API_URL);
      applyDataset({ raw:j, source:"live API", generated:new Date(), sample:false });
      lsSet({ t: Date.now(), data: j });
    } catch(e){ /* offline or rate-limited — whatever painted stays */ }
  }

  if (!painted){
    $("#heroTitle").textContent = "Couldn't reach launch data — check your connection and refresh.";
    $("#listView").innerHTML = "";
  }
}

async function loadPrevious(){
  try{
    const jj = await fetchJson("data/previous.json");
    state.previous = normalize(jj).sort((a, b) => b.net - a.net);
    if (state.view === "recent") renderRecent();
  }catch(e){}
}

/* ---------------- filtering ---------------- */
function visibleLaunches(){
  const q = state.q.trim().toLowerCase();
  return state.launches.filter(l => {
    if (state.provider && l.provider !== state.provider) return false;
    if (state.status && l.status.abbrev !== state.status) return false;
    if (q){
      const hay = [l.name, l.missionName, l.rocket, l.provider, l.pad, l.location].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
function buildProviderOptions(){
  const sel = $("#providerSel");
  const cur = sel.value;
  const provs = [...new Set(state.launches.map(l => l.provider))].sort();
  sel.innerHTML = '<option value="">All providers</option>' +
    provs.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
  if (provs.includes(cur)) sel.value = cur;
}

/* ---------------- hero ---------------- */
function nextLaunch(){
  const now = Date.now();
  return state.launches.find(l => l.net >= now) || state.launches[0] || null;
}
function renderHero(){
  const l = nextLaunch();
  if (!l){ $("#heroTitle").textContent = "No upcoming launches found."; return; }
  $("#hero").dataset.net = l.net.toISOString();
  $("#heroTitle").textContent = l.missionName || l.name;
  $("#heroSub").textContent = "";
  $("#heroMeta").innerHTML = `
    <div class="readout">
      <span class="k">Status</span><span class="v">${chip(l)}</span>
      <span class="k">NET</span><span class="v">${escapeHtml(fmtLocal(l.net))} <span class="dim">· ${escapeHtml(TZ_NAME)}</span></span>
      <span class="k">Vehicle</span><span class="v">${escapeHtml(l.rocket)} <span class="dim">· ${escapeHtml(l.provider)}</span></span>
      ${l.location ? `<span class="k">Pad</span><span class="v">${flag(l.country)}${escapeHtml([l.pad, l.location].filter(Boolean).join(" · "))}</span>` : ""}
      ${(l.probability != null) ? `<span class="k">Weather</span><span class="v">${l.probability}% go</span>` : ""}
    </div>`;
  const watch = $("#heroWatch");
  if (l.webcasts.length){ watch.hidden = false; watch.href = l.webcasts[0].url; }
  else watch.hidden = true;
  const det = $("#heroDetails");
  det.hidden = false;
  det.onclick = () => openModal(l.id);
  const hp = $("#heroPhoto");
  if (hp){
    if (l.image){ hp.src = l.image; hp.alt = l.name; hp.hidden = false; }
    else hp.hidden = true;
  }
  $("#heroTitle").classList.remove("is-loading");
  tickHero();
}
function tickHero(){
  const iso = $("#hero").dataset.net;
  if (!iso) return;
  const t = tMinus(new Date(iso));
  $("#cdD").textContent = pad2(t.d); $("#cdH").textContent = pad2(t.h);
  $("#cdM").textContent = pad2(t.m); $("#cdS").textContent = pad2(t.s);
  $("#hero").classList.toggle("is-liftoff", t.past);
  $("#heroLabel").textContent = t.past ? "Liftoff · T+" : "Next launch · T−";
  let seen = t.past;
  for (const [id, val] of [["cdD", t.d], ["cdH", t.h], ["cdM", t.m]]){
    const cell = $("#" + id).parentElement;
    if (!seen && val === 0) cell.classList.add("is-zero");
    else { cell.classList.remove("is-zero"); seen = true; }
  }
}

/* ---------------- stats ---------------- */
function renderStats(){
  const now = new Date();
  const in7 = new Date(+now + 7*86400000);
  const ls = state.launches;
  const week  = ls.filter(l => l.net >= now && l.net <= in7).length;
  const month = ls.filter(l => l.net.getMonth() === now.getMonth() && l.net.getFullYear() === now.getFullYear()).length;
  const provs = new Set(ls.map(l => l.provider)).size;
  $("#stats").innerHTML = [
    [week, "next 7 days"], [month, "this month"], [provs, "providers"], [ls.length, "tracked upcoming"],
  ].map(([n, lab]) => `<div class="stat"><div class="stat-num">${n}</div><div class="stat-label">${lab}</div></div>`).join("");
}

/* ---------------- list view ---------------- */
function cardHtml(l){
  return `
  <button class="launch-card" data-id="${escapeHtml(l.id)}" aria-label="${escapeHtml(l.name)} details">
    <div class="lc-img">${l.image ? `<img class="lc-photo" src="${escapeHtml(l.image)}" alt="${escapeHtml(l.name)}" loading="lazy" decoding="async" onload="this.classList.add('on')" onerror="this.remove()">` : ""}
      ${chip(l)}<span class="lc-tminus" data-net="${l.net.toISOString()}"></span></div>
    <div class="lc-body">
      <span class="lc-rocket">${escapeHtml(l.rocket)} · ${escapeHtml(l.provider)}</span>
      <span class="lc-name">${escapeHtml(l.missionName || l.name)}</span>
      <div class="lc-facts">
        <span class="k">NET</span><span class="v hot">${escapeHtml(fmtLocal(l.net))}</span>
        ${l.location ? `<span class="k">Pad</span><span class="v">${flag(l.country)}${escapeHtml([l.pad, l.location].filter(Boolean).join(" · "))}</span>` : ""}
      </div>
    </div>
  </button>`;
}
function renderList(){
  const ls = visibleLaunches();
  $("#listView").innerHTML = ls.length
    ? ls.map(cardHtml).join("")
    : `<div class="empty-note">No launches match those filters.<button id="resetFilters" type="button">Reset filters</button></div>`;
  tickCards();
}
function tickCards(){
  const now = Date.now();
  $$(".lc-tminus").forEach(el => { el.textContent = tMinus(new Date(el.dataset.net), now).short; });
}

function renderRecent(){
  const ls = state.previous;
  $("#recentView").innerHTML = ls.length
    ? ls.map(cardHtml).join("")
    : `<div class="empty-note">Recent launches appear after the next data refresh.</div>`;
  tickCards();
}

/* ---------------- launch sites row ---------------- */
function renderSites(){
  const row = $("#sitesRow");
  if (!row) return;
  const counts = {};
  for (const l of state.launches){
    if (!l.location) continue;
    const key = l.location.split(",")[0].trim();
    if (!counts[key]) counts[key] = { n: 0, country: l.country };
    counts[key].n++;
  }
  const top = Object.entries(counts).sort((a, b) => b[1].n - a[1].n).slice(0, 8);
  row.innerHTML = top.map(([name, v]) =>
    `<button class="site-chip${state.q === name ? " on" : ""}" data-site="${escapeHtml(name)}">${flag(v.country)}${escapeHtml(name)} <span class="n">${v.n}</span></button>`).join("");
}

/* ---------------- calendar view ---------------- */
function renderCalendar(){
  const cur = state.calCursor || (state.calCursor = new Date());
  const y = cur.getFullYear(), m = cur.getMonth();
  $("#calTitle").textContent = new Intl.DateTimeFormat(undefined,{month:"long",year:"numeric"}).format(cur);

  const wd = $(".cal-weekdays");
  if (!wd.childElementCount){
    const base = new Date(2026, 2, 1); // a Sunday
    for (let i=0;i<7;i++){ const d=document.createElement("div");
      d.textContent = new Intl.DateTimeFormat(undefined,{weekday:"short"}).format(new Date(+base + i*86400000)).slice(0,3);
      wd.appendChild(d); }
  }

  const byDay = new Map();
  for (const l of visibleLaunches()){
    const k = dayKey(l.net);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(l);
  }

  const first = new Date(y, m, 1);
  const today = new Date();
  let html = "";
  for (let i=0;i<42;i++){
    const d = new Date(y, m, 1 - first.getDay() + i);
    const inMonth = d.getMonth() === m;
    const k = dayKey(d);
    const items = byDay.get(k) || [];
    const MAX = 3;
    const chips = items.slice(0, MAX).map(l => `
      <button class="cal-chip st-${statusClass(l.status.abbrev)}" data-id="${escapeHtml(l.id)}"
        title="${escapeHtml(l.name)}"><span class="t">${new Intl.DateTimeFormat(undefined,{hour:"numeric"}).format(l.net).replace(/\s/g,"")}</span>${escapeHtml(l.rocket)}</button>`).join("");
    const more = items.length > MAX ? `<button class="cal-more" data-day="${k}">+${items.length - MAX} more</button>` : "";
    html += `<div class="cal-day ${inMonth?"":"other-month"} ${sameLocalDay(d,today)?"is-today":""} ${items.length?"has-launch":""}">
      <span class="cal-date">${d.getDate()}</span>${chips}${more}</div>`;
  }
  $("#calGrid").innerHTML = html;
}

/* ---------------- modal ---------------- */
function gcalLink(l){
  const f = d => d.toISOString().replace(/[-:]|\.\d{3}/g,"");
  const end = l.windowEnd && l.windowEnd > l.net ? l.windowEnd : new Date(+l.net + 3600000);
  const p = new URLSearchParams({
    action:"TEMPLATE", text:`🚀 ${l.name}`,
    dates:`${f(l.net)}/${f(end)}`,
    details:(l.desc ? l.desc.slice(0,600)+"\n\n" : "") + "Tracked via Rocket Launch Tracker",
    location:[l.pad, l.location].filter(Boolean).join(", "),
  });
  return "https://calendar.google.com/calendar/render?" + p.toString();
}
function openModal(id){
  const l = state.launches.find(x => String(x.id) === String(id));
  if (!l) return;
  const t = tMinus(l.net);
  $("#modalBody").innerHTML = `
    <div class="md-img">${l.image
      ? `<img class="lc-photo" src="${escapeHtml(l.image)}" alt="${escapeHtml(l.name)}" decoding="async" onload="this.classList.add('on')" onerror="this.remove()">`
      : ``}</div>
    <div class="md-body">
      <span class="md-rocket">${escapeHtml(l.rocket)} · ${escapeHtml(l.provider)}</span>
      <h2 class="md-title" id="modalTitle">${escapeHtml(l.name)}</h2>
      <div class="md-chips">${chip(l)}
        ${l.probability != null ? `<span class="chip chip-other">Weather ${l.probability}% go</span>` : ""}
        ${l.webcastLive ? `<span class="chip chip-go">LIVE NOW</span>` : ""}</div>
      <p class="md-countdown" data-net="${l.net.toISOString()}">${t.short} to launch</p>
      <div class="md-facts">
        <div class="md-fact"><div class="k">Liftoff (your time)</div><div class="v">${escapeHtml(fmtLocal(l.net,{year:"numeric"}))}</div></div>
        <div class="md-fact"><div class="k">Liftoff (UTC)</div><div class="v mono">${escapeHtml(fmtUTC(l.net))}</div></div>
        ${l.windowEnd && l.windowStart && +l.windowEnd !== +l.windowStart ? `<div class="md-fact"><div class="k">Window closes</div><div class="v">${escapeHtml(fmtLocal(l.windowEnd))}</div></div>` : ""}
        ${l.pad ? `<div class="md-fact"><div class="k">Pad</div><div class="v">${escapeHtml(l.pad)}</div></div>` : ""}
        ${l.location ? `<div class="md-fact"><div class="k">Location</div><div class="v">${flag(l.country)}${escapeHtml(l.location)}${l.country ? " · " + escapeHtml(l.country) : ""}</div></div>` : ""}
        ${l.mtype ? `<div class="md-fact"><div class="k">Mission type</div><div class="v">${escapeHtml(l.mtype)}</div></div>` : ""}
        ${l.orbit ? `<div class="md-fact"><div class="k">Target orbit</div><div class="v">${glossaryAnchor(l.orbit) ? `<a class="fact-link" href="glossary.html#${glossaryAnchor(l.orbit)}">${escapeHtml(l.orbit)}</a>` : escapeHtml(l.orbit)}</div></div>` : ""}
        ${l.status.description ? `<div class="md-fact"><div class="k">Status note</div><div class="v">${escapeHtml(l.status.description)}</div></div>` : ""}
        <div class="md-fact" id="wxFact" hidden><div class="k">Pad weather now</div><div class="v">—</div></div>
        <div class="md-fact" id="wxT0" hidden><div class="k">Forecast at liftoff</div><div class="v">—</div></div>
      </div>
      ${window.RLTOrbit ? `<div class="md-orbit"><canvas id="orbitCv" aria-hidden="true"></canvas><div class="orbit-cap" id="orbitCap">Illustrative trajectory</div></div>` : ""}
      ${l.desc ? `<p class="md-desc">${escapeHtml(l.desc)}</p>` : ""}
      <div class="md-links">
        ${l.webcasts.slice(0,2).map(w => `<a class="btn btn-primary" href="${escapeHtml(w.url)}" target="_blank" rel="noopener">▶ ${escapeHtml(w.title)}</a>`).join("")}
        <a class="btn btn-ghost" href="${escapeHtml(gcalLink(l))}" target="_blank" rel="noopener">+ Google Calendar</a>
        ${l.mapUrl ? `<a class="btn btn-ghost" href="${escapeHtml(l.mapUrl)}" target="_blank" rel="noopener">Pad map</a>` : ""}
        <a class="btn btn-ghost" href="launch/${slugFor(l)}.html">Mission page</a>
      </div>
    </div>`;
  $("#modalBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
  try{ history.replaceState(null, "", "#l-" + encodeURIComponent(id)); }catch(e){}
  fetchWeather(l);
  liveMode(l);
  if (window.RLTOrbit) RLTOrbit.play($("#orbitCv"), l);
  $("#modalClose").focus();
}
function openFromHash(){
  const m = location.hash.match(/^#l-(.+)$/);
  if (m) openModal(decodeURIComponent(m[1]));
}
addEventListener("hashchange", openFromHash);

/* ---------------- pad weather (Open-Meteo, keyless) ---------------- */
const wxCache = {};
async function fetchWeather(l){
  const la = parseFloat(l.latitude), lo = parseFloat(l.longitude);
  if (!isFinite(la) || !isFinite(lo)) return;
  const key = la.toFixed(2) + "," + lo.toFixed(2);
  try{
    if (!wxCache[key]){
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=temperature_2m,wind_speed_10m,cloud_cover,precipitation&hourly=temperature_2m,wind_speed_10m,cloud_cover,precipitation_probability&forecast_days=16&timezone=UTC&wind_speed_unit=kn`);
      if (!r.ok) return;
      const j = await r.json();
      wxCache[key] = { cur: j.current, hr: j.hourly };
    }
    const { cur, hr } = wxCache[key], el = $("#wxFact");
    if (cur && el){
      el.querySelector(".v").textContent =
        `${Math.round(cur.temperature_2m)}°C · wind ${Math.round(cur.wind_speed_10m)} kn · ${cur.cloud_cover}% cloud` +
        (cur.precipitation > 0 ? ` · rain ${cur.precipitation} mm` : "");
      el.hidden = false;
    }
    const t0 = $("#wxT0");
    if (hr && t0 && l.net){
      const want = l.net.toISOString().slice(0, 13) + ":00";
      const i = (hr.time || []).indexOf(want);
      if (i >= 0){
        t0.querySelector(".v").textContent =
          `${Math.round(hr.temperature_2m[i])}°C · wind ${Math.round(hr.wind_speed_10m[i])} kn · ${hr.cloud_cover[i]}% cloud · ${hr.precipitation_probability[i]}% rain chance`;
        t0.hidden = false;
      }
    }
  }catch(e){}
}
let livePollId = 0;
function liveMode(l){
  clearInterval(livePollId); livePollId = 0;
  const ms = l.net - Date.now();
  if (ms < 3600e3 && ms > -1800e3){
    const vid = (l.webcasts || []).map(w => ytId(w.url)).find(Boolean);
    if (vid){
      const holder = document.createElement("div");
      holder.className = "md-player";
      holder.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${vid}?rel=0" title="Launch webcast" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
      const img = $("#modalBody .md-img");
      if (img) img.replaceWith(holder); else $("#modalBody").prepend(holder);
    }
  }
  // status re-check for real launches near T-0 (LL2 single-launch endpoint)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/.test(String(l.id)) && ms < 7200e3 && ms > -3600e3){
    livePollId = setInterval(async () => {
      if ($("#modalBackdrop").hidden){ clearInterval(livePollId); return; }
      try{
        const r = await fetch(`https://ll.thespacedevs.com/2.3.0/launches/${l.id}/?format=json`);
        if (!r.ok) return;
        const j = await r.json();
        const newNet = new Date(j.net);
        const abbrev = j.status && j.status.abbrev;
        if (Math.abs(newNet - l.net) > 1000 || (abbrev && abbrev !== l.status.abbrev)){
          l.net = newNet;
          if (abbrev) l.status = { abbrev, name: (j.status && j.status.name) || abbrev, description: l.status.description };
          renderAll();
          openModal(l.id);
        }
      }catch(e){}
    }, 60e3);
  }
}
function openDayModal(k){
  const items = visibleLaunches().filter(l => dayKey(l.net) === k);
  if (!items.length) return;
  const d = new Date(k + "T12:00:00");
  $("#modalBody").innerHTML = `
    <div class="md-body" style="margin-top:0">
      <h2 class="md-title" id="modalTitle">${escapeHtml(new Intl.DateTimeFormat(undefined,{weekday:"long",month:"long",day:"numeric"}).format(d))}</h2>
      <div class="launch-grid" style="grid-template-columns:1fr">${items.map(cardHtml).join("")}</div>
    </div>`;
  $("#modalBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
  tickCards();
}
function closeModal(){
  clearInterval(livePollId); livePollId = 0;
  if (window.RLTOrbit) RLTOrbit.stop();
  $("#modalBackdrop").hidden = true;
  document.body.style.overflow = "";
  if (location.hash.startsWith("#l-")){
    try{ history.replaceState(null, "", location.pathname + location.search); }catch(e){}
  }
}

/* ---------------- render all / events ---------------- */
function renderAll(){
  renderHero(); renderStats();
  if (state.view === "list") renderList(); else renderCalendar();
  const g = state.generated;
  $("#updatedNote").textContent = g
    ? `${state.source} · updated ${fmtLocal(g,{weekday:undefined,month:"short"})}` + (state.sample ? " · sample data" : "")
    : "";
}
function setView(v){
  state.view = v;
  const map = { list: "#btnListView", cal: "#btnCalView", recent: "#btnRecentView", map: "#btnMapView" };
  for (const [key, sel] of Object.entries(map)){
    const b = $(sel);
    if (!b) continue;
    b.classList.toggle("is-active", v === key);
    b.setAttribute("aria-selected", v === key);
  }
  $("#listView").hidden = v !== "list";
  $("#calView").hidden = v !== "cal";
  $("#recentView").hidden = v !== "recent";
  $("#mapView").hidden = v !== "map";
  if (v !== "map" && window.RLTOrbit) RLTOrbit.stop();
  if (v === "cal") renderCalendar();
  else if (v === "recent") renderRecent();
  else if (v === "map") renderMap();
  else renderList();
}
function renderMap(){
  if (!window.RLTOrbit) return;
  const groups = {};
  const nameOf = l => (l.location || l.pad || "Site").split(",")[0].trim();
  for (const l of state.launches){
    const la = parseFloat(l.latitude), lo = parseFloat(l.longitude);
    if (!isFinite(la) || !isFinite(lo)) continue;
    const key = nameOf(l);
    if (!groups[key]) groups[key] = { key, lat: la, lon: lo, n: 0, name: key };
    groups[key].n++;
  }
  const pads = Object.values(groups);
  const next = state.launches.find(l => isFinite(parseFloat(l.latitude)));
  RLTOrbit.map($("#mapCv"), pads, next ? nameOf(next) : null, key => {
    state.q = key; $("#searchBox").value = key; setView("list");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

document.addEventListener("click", e => {
  if (e.target.id === "resetFilters"){
    state.q = state.provider = state.status = "";
    $("#searchBox").value = ""; $("#providerSel").value = ""; $("#statusSel").value = "";
    renderAll(); return;
  }
  const card = e.target.closest(".launch-card");
  if (card){ openModal(card.dataset.id); return; }
  const sc = e.target.closest(".site-chip");
  if (sc){
    const site = sc.dataset.site;
    state.q = (state.q === site) ? "" : site;
    $("#searchBox").value = state.q;
    renderSites(); renderAll();
    return;
  }
  const sb = e.target.closest("#subBtn");
  if (sb){ const p = $("#subPop"); p.hidden = !p.hidden; return; }
  if (!e.target.closest(".subwrap")){ const p = $("#subPop"); if (p) p.hidden = true; }
  const chipEl = e.target.closest(".cal-chip");
  if (chipEl){ openModal(chipEl.dataset.id); return; }
  const more = e.target.closest(".cal-more");
  if (more){ openDayModal(more.dataset.day); return; }
  if (e.target === $("#modalBackdrop")) closeModal();
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
$("#modalClose").addEventListener("click", closeModal);
$("#btnListView").addEventListener("click", () => setView("list"));
$("#btnCalView").addEventListener("click", () => setView("cal"));
$("#btnRecentView") && $("#btnRecentView").addEventListener("click", () => setView("recent"));
$("#btnMapView") && $("#btnMapView").addEventListener("click", () => setView("map"));
$("#searchBox").addEventListener("input", e => { state.q = e.target.value; renderAll(); });
$("#providerSel").addEventListener("change", e => { state.provider = e.target.value; renderAll(); });
$("#statusSel").addEventListener("change", e => { state.status = e.target.value; renderAll(); });
$("#refreshBtn").addEventListener("click", async e => {
  const b = e.currentTarget; b.classList.add("spinning");
  await loadData(true);
  setTimeout(() => b.classList.remove("spinning"), 600);
});
$("#calPrev").addEventListener("click", () => { state.calCursor = new Date(state.calCursor.getFullYear(), state.calCursor.getMonth()-1, 1); renderCalendar(); });
$("#calNext").addEventListener("click", () => { state.calCursor = new Date(state.calCursor.getFullYear(), state.calCursor.getMonth()+1, 1); renderCalendar(); });
$("#calToday").addEventListener("click", () => { state.calCursor = new Date(); renderCalendar(); });

/* ---------------- clocks ---------------- */
setInterval(() => {
  const n = new Date();
  $("#utcClock").textContent = `${pad2(n.getUTCHours())}:${pad2(n.getUTCMinutes())}:${pad2(n.getUTCSeconds())} UTC`;
  tickHero();
  if (state.view === "list" && new Date().getSeconds() % 10 === 0) tickCards();
  const mc = $(".md-countdown");
  if (mc && !$("#modalBackdrop").hidden) mc.textContent = tMinus(new Date(mc.dataset.net)).short + " to launch";

  // tab-title countdown + LIVE banner
  const nl = state.launches.find(l => +l.net >= Date.now() - 30 * 60000);
  if (nl){
    const t = tMinus(nl.net);
    document.title = `${t.short} · ${nl.missionName || nl.name} — Rocket Launch Tracker`;
    const lb = $("#liveBanner");
    if (lb){
      const ms = +nl.net - Date.now();
      const show = ms < 35 * 60000 && ms > -30 * 60000 && nl.webcasts.length > 0;
      const k = show ? nl.id + (ms <= 0 ? "live" : "soon") : "off";
      if (lb.dataset.k !== k){
        lb.dataset.k = k;
        lb.hidden = !show;
        if (show) lb.innerHTML = `<span class="live-dot"></span> ${ms <= 0 ? "LIVE NOW" : "Launching soon"} — ${escapeHtml(nl.missionName || nl.name)} <a href="${escapeHtml(nl.webcasts[0].url)}" target="_blank" rel="noopener">Watch webcast →</a>`;
      }
    }
  }
}, 1000);

/* ---------------- starfield ---------------- */
(function starfield(){
  const cv = $("#starfield");
  if (!cv) return;
})();

/* ---------------- SEO: structured data for upcoming launches ---------------- */
function injectSchema(){
  try{
    const old = document.getElementById("ld-events");
    if (old) old.remove();
    const items = state.launches.slice(0, 20).map((l, i) => ({
      "@type": "ListItem", "position": i + 1,
      "item": Object.assign({
        "@type": "Event",
        "name": l.name,
        "startDate": l.net.toISOString(),
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/MixedEventAttendanceMode",
        "location": { "@type": "Place", "name": l.pad || "Launch pad", "address": l.location || "TBA" },
        "organizer": { "@type": "Organization", "name": l.provider }
      },
      l.windowEnd ? { "endDate": l.windowEnd.toISOString() } : {},
      l.image ? { "image": l.image } : {},
      l.desc ? { "description": l.desc.slice(0, 300) } : {})
    }));
    const s = document.createElement("script");
    s.type = "application/ld+json"; s.id = "ld-events";
    s.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "ItemList",
      "name": "Upcoming rocket launches", "itemListElement": items });
    document.head.appendChild(s);
  }catch(e){}
}

/* ---------------- theme ---------------- */
(function theme(){
  const root = document.documentElement;
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const stored = () => { try{ return localStorage.getItem("rlt.theme"); }catch(e){ return null; } };
  function apply(){
    const s = stored();
    if (s) root.dataset.theme = s; else delete root.dataset.theme;
    root.classList.toggle("auto-dark", !s && mq.matches);
  }
  mq.addEventListener && mq.addEventListener("change", apply);
  const btn = $("#themeBtn");
  if (btn) btn.addEventListener("click", () => {
    const cur = stored();
    const isDark = cur === "dark" || (!cur && mq.matches);
    try{ localStorage.setItem("rlt.theme", isDark ? "light" : "dark"); }catch(e){}
    apply();
  });
  apply();
})();

/* ---------------- go ---------------- */
try{
  const qp = new URLSearchParams(location.search).get("q");
  if (qp){ state.q = qp; $("#searchBox").value = qp; }
}catch(e){}
const preset = document.body.dataset.preset;
if (preset && !state.q){ state.q = preset; $("#searchBox").value = preset; }
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")){
  addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}
/* PWA install nudge */
let bip = null;
addEventListener("beforeinstallprompt", e => {
  e.preventDefault(); bip = e;
  try{ if (localStorage.getItem("rlt.nudge") === "off") return; }catch(err){}
  const n = $("#installNudge"); if (n) n.hidden = false;
});
$("#nudgeGo") && $("#nudgeGo").addEventListener("click", async () => {
  $("#installNudge").hidden = true;
  if (bip){ bip.prompt(); try{ await bip.userChoice; }catch(e){} bip = null; }
});
$("#nudgeX") && $("#nudgeX").addEventListener("click", () => {
  $("#installNudge").hidden = true;
  try{ localStorage.setItem("rlt.nudge", "off"); }catch(e){}
});

/* nearest launch site */
$("#nearBtn") && $("#nearBtn").addEventListener("click", () => {
  const out = $("#nearOut");
  if (!navigator.geolocation){ out.textContent = " Location isn't available in this browser."; return; }
  out.textContent = " Locating…";
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: la, longitude: lo } = pos.coords;
    const seen = {};
    for (const l of state.launches){
      const pla = parseFloat(l.latitude), plo = parseFloat(l.longitude);
      if (!isFinite(pla) || !isFinite(plo)) continue;
      const nm = (l.location || l.pad || "Site").split(",")[0].trim();
      if (!seen[nm]) seen[nm] = { nm, la: pla, lo: plo };
    }
    let best = null, bd = 1e9;
    const R = 6371, rad = Math.PI / 180;
    for (const s of Object.values(seen)){
      const dLa = (s.la - la) * rad, dLo = (s.lo - lo) * rad;
      const h = Math.sin(dLa/2)**2 + Math.cos(la*rad) * Math.cos(s.la*rad) * Math.sin(dLo/2)**2;
      const d = 2 * R * Math.asin(Math.sqrt(h));
      if (d < bd){ bd = d; best = s; }
    }
    if (!best){ out.textContent = " No sites with coordinates right now."; return; }
    out.innerHTML = ` Nearest: <strong>${escapeHtml(best.nm)}</strong> — ${Math.round(bd).toLocaleString()} km away · <button class="linklike" id="nearGo">view its launches</button>`;
    $("#nearGo").addEventListener("click", () => {
      state.q = best.nm; $("#searchBox").value = best.nm; setView("list");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, () => { out.textContent = " Couldn't get your location (permission denied)."; }, { timeout: 8000 });
});

loadData(false);
