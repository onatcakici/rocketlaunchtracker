/* Mission-page runtime: countdown, local times, liftoff forecast,
   launch-day webcast embed, status refresh, trajectory animation. */
(function(){
  "use strict";
  const L = window.__LAUNCH || {};
  const $ = s => document.querySelector(s);
  const net = new Date(L.net);

  /* local-time fields */
  document.querySelectorAll("[data-local]").forEach(el => {
    const d = new Date(el.getAttribute("data-local"));
    if (isFinite(+d)) el.textContent = new Intl.DateTimeFormat(undefined,
      { weekday:"short", month:"short", day:"numeric", year:"numeric", hour:"numeric", minute:"2-digit" }).format(d);
  });

  /* countdown */
  const cd = $("#lpCount");
  function tick(){
    if (!cd || !isFinite(+net)) return;
    const ms = net - Date.now();
    if (L.past || ms < -1800e3){ cd.textContent = "This launch is in the past — see the board for what's next."; return; }
    const neg = ms < 0, a = Math.abs(ms);
    const d = Math.floor(a / 864e5), h = Math.floor(a / 36e5) % 24,
          m = Math.floor(a / 6e4) % 60, s = Math.floor(a / 1e3) % 60;
    const pad = n => String(n).padStart(2, "0");
    cd.textContent = (neg ? "T+" : "T−") + (d ? d + "d " : "") + pad(h) + ":" + pad(m) + ":" + pad(s) +
      (neg ? " — launched" : " to launch");
    document.title = (neg ? "T+" : "T−") + (d ? d + "d " : "") + pad(h) + ":" + pad(m) + " · " + (L.name || "Launch");
  }
  tick(); setInterval(tick, 1000);

  /* launch-day live mode: embed the webcast within T−60m .. T+30m */
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
  function liveCheck(){
    const box = $("#lpLive");
    if (!box || !isFinite(+net)) return;
    const ms = net - Date.now();
    const inWindow = ms < 3600e3 && ms > -1800e3;
    if (!inWindow){ if (box.dataset.on){ box.dataset.on = ""; box.innerHTML = ""; } return; }
    if (box.dataset.on) return;
    const w = (L.webcasts || []).map(x => ytId(x.url)).find(Boolean);
    if (w){
      box.innerHTML = `<div class="lp-player"><iframe src="https://www.youtube-nocookie.com/embed/${w}?rel=0" title="Launch webcast" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
      box.dataset.on = "1";
    } else if ((L.webcasts || [])[0]){
      box.innerHTML = `<p class="lp-livehint">Launching soon — <a href="${(L.webcasts[0].url || "#").replace(/"/g, "")}" target="_blank" rel="noopener">watch the webcast ▶</a></p>`;
      box.dataset.on = "1";
    }
  }
  liveCheck(); setInterval(liveCheck, 30e3);

  /* status refresh every 60s while the page is open (real ids only, near launch) */
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}/.test(String(L.id));
  async function poll(){
    if (!uuid) return;
    const ms = net - Date.now();
    if (ms > 7200e3 || ms < -3600e3) return;      // only within T−2h .. T+1h
    try{
      const r = await fetch(`https://ll.thespacedevs.com/2.3.0/launches/${L.id}/?format=json`);
      if (!r.ok) return;
      const j = await r.json();
      if (j.net && Math.abs(new Date(j.net) - net) > 1000){
        location.reload();                         // net slipped — regenerate view
      }
    }catch(e){}
  }
  setInterval(poll, 60e3);

  /* forecast at liftoff (Open-Meteo, keyless, ≤16 days out) */
  (async () => {
    const la = parseFloat(L.latitude), lo = parseFloat(L.longitude);
    const days = (net - Date.now()) / 864e5;
    if (!isFinite(la) || !isFinite(lo) || !isFinite(days) || days < -0.5 || days > 15.5) return;
    try{
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&hourly=temperature_2m,wind_speed_10m,cloud_cover,precipitation_probability&wind_speed_unit=kn&timezone=UTC&forecast_days=16`);
      if (!r.ok) return;
      const j = await r.json(), H = j.hourly || {};
      const want = L.net.slice(0, 13) + ":00";
      const i = (H.time || []).indexOf(want);
      if (i < 0) return;
      const el = $("#lpWx");
      el.querySelector(".v").textContent =
        `${Math.round(H.temperature_2m[i])}°C · wind ${Math.round(H.wind_speed_10m[i])} kn · ${H.cloud_cover[i]}% cloud · ${H.precipitation_probability[i]}% rain chance`;
      el.hidden = false;
    }catch(e){}
  })();

  /* trajectory */
  if (window.RLTOrbit && $("#orbitCv")){
    RLTOrbit.play($("#orbitCv"), { latitude: L.latitude, longitude: L.longitude,
      orbit: L.orbit, pad: L.pad, net: isFinite(+net) ? net : new Date() });
  }
})();
