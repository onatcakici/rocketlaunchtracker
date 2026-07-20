/* ============================================================
   RLT Mission Simulator UI.
   Scrub a physics-computed mission (RLTSimCore) on the shared
   Earth renderer (RLTOrbit.engine): drag/zoom camera, play/pause,
   1/10/100x, Free/Chase/Pad cameras, ground-track view.
   ============================================================ */
(function(){
  "use strict";
  const $ = s => document.querySelector(s);
  const E = RLTOrbit.engine;
  const D2R = Math.PI / 180, R2D = 180 / Math.PI, TAU = Math.PI * 2;
  const RE = RLTSimCore.RE, OME = 7.2921159e-5;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- load the launch ---------- */
  const qid = new URLSearchParams(location.search).get("id");
  async function getLaunch(){
    let list = [];
    try{ const r = await fetch("data/launches.json"); if (r.ok) list = (await r.json()).results || []; }catch(e){}
    if (!list.length){ try{ list = (JSON.parse(localStorage.getItem("rlt.cache.v1")).data.results) || []; }catch(e){} }
    let l = list.find(x => String(x.id) === String(qid));
    if (!l) l = list.find(x => new Date(x.net) > new Date()) || list[0];
    return l;
  }

  /* ---------- coastline lat/lon decode (for the ground-track view) ---------- */
  const COASTLL = (() => {
    const idx = {}; for (let i = 0; i < E.CA.length; i++) idx[E.CA[i]] = i;
    return E.CD.split("|").map(s => {
      const n = s.length / 4, a = new Float32Array(n * 2);
      for (let i = 0; i < n; i++){
        a[i*2]   = (idx[s[i*4]] * 89 + idx[s[i*4+1]]) / 2 - 90;
        a[i*2+1] = (idx[s[i*4+2]] * 89 + idx[s[i*4+3]]) / 2 - 180;
      }
      return a;
    });
  })();

  getLaunch().then(raw => {
    if (!raw){ $("#simTitle").textContent = "No launch data available — open the board first."; return; }
    const pad = raw.pad || {};
    const L = {
      id: raw.id, name: raw.name, net: new Date(raw.net),
      rocket: raw.rocket, provider: raw.provider,
      orbit: (raw.mission && raw.mission.orbit) || raw.orbit || "",
      padName: pad.name, site: (pad.location && pad.location.name) || "",
      latitude: parseFloat(pad.latitude), longitude: parseFloat(pad.longitude),
    };
    if (!isFinite(L.latitude)){ L.latitude = 28.5; L.longitude = -80.6; }
    boot(L);
  });

  function boot(L){
    const M = RLTSimCore.computeMission(L);
    document.title = `Simulator — ${L.name} | Rocket Launch Tracker`;
    $("#simTitle").textContent = L.name;
    $("#simSub").textContent = `${M.vehicle} · ${L.site || "launch site"} → ${L.orbit || "orbit"} · simulated payload ${(M.payload/1000).toFixed(1)} t`;
    const slug = (L.name || "launch").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60)
      + "-" + String(L.id).replace(/[^a-z0-9]/gi, "").slice(0, 8);
    $("#lpLink").innerHTML = ` · <a href="launch/${slug}.html">Mission page</a>`;

    /* ----- orbital plane on the globe (same convention as orbit.js) ----- */
    const phi = L.latitude * D2R;
    const inc = M.inclDeg * D2R;
    const dlon = u => Math.atan2(Math.cos(inc) * Math.sin(u), Math.cos(u));
    const u0b = Math.asin(Math.max(-1, Math.min(1, Math.sin(phi) / Math.sin(inc))));
    const u0 = inc > Math.PI / 2 ? Math.PI - u0b : u0b;
    const OMG = L.longitude * D2R - dlon(u0);
    function pos3(thDown, rr, t){                    // -> [x,y,z]*rr/RE in Earth-fixed frame
      const u = u0 + thDown;
      const la = Math.asin(Math.max(-1, Math.min(1, Math.sin(inc) * Math.sin(u))));
      const lo = OMG + dlon(u) - OME * Math.max(0, t);
      return E.llr(la, lo, rr / RE);
    }
    function geo(thDown, t){                          // -> {la, lo} degrees, Earth-fixed
      const u = u0 + thDown;
      const la = Math.asin(Math.max(-1, Math.min(1, Math.sin(inc) * Math.sin(u)))) * R2D;
      let lo = (OMG + dlon(u) - OME * Math.max(0, t)) * R2D;
      lo = ((lo + 540) % 360) - 180;
      return { la, lo };
    }

    /* ----- state lookup at any sim time ----- */
    const S = M.S, B = M.booster && M.booster.S;
    const find = (arr, t) => {
      let lo = 0, hi = arr.length - 1;
      while (lo < hi){ const mid = (lo + hi) >> 1; arr[mid] < t ? lo = mid + 1 : hi = mid; }
      return Math.max(0, lo - 1);
    };
    function stateAt(t){
      if (t <= 0) return { r: RE, th: 0, v: 0, phaseT: t, on: t >= -10 };
      if (t <= M.end.t){
        const i = find(S.t, t);
        const f = Math.min(1, (t - S.t[i]) / Math.max(.01, (S.t[i+1] || S.t[i] + .5) - S.t[i]));
        const g = (a) => a[i] + ((a[i+1] != null ? a[i+1] : a[i]) - a[i]) * f;
        return { r: g(S.h) + RE, th: g(S.th), v: Math.hypot(g(S.vr), g(S.vt)), m: g(S.m), on: true };
      }
      if (M.coast){
        const k = M.coast.at(t - M.end.t);
        const v = M.coast.escape ? Math.hypot(M.end.vr, M.end.vt) :
          Math.sqrt(Math.max(0, RLTSimCore.MU * (2 / k.r - 1 / M.coast.a)));
        return { r: k.r, th: k.th, v, on: true };
      }
      const i = find(S.t, M.end.t);
      return { r: S.h[i] + RE, th: S.th[i], v: 0, on: true };
    }
    function boosterAt(t){
      if (!B || t < B.t[0]) return null;
      if (t > B.t[B.t.length - 1]) return { r: B.h[B.h.length - 1] + RE, th: B.th[B.th.length - 1], done: true };
      const i = find(B.t, t);
      return { r: B.h[i] + RE, th: B.th[i] };
    }

    /* ----- precomputed paths ----- */
    const ascPath = [];                                // [thDown, r, t]
    for (let i = 0; i < S.t.length; i += 2) ascPath.push([S.th[i], S.h[i] + RE, S.t[i]]);
    const coastPath = [];
    if (M.coast && !M.coast.escape){
      const P = M.coast.period;
      for (let k = 0; k <= 1.001; k += 1/240){ const c = M.coast.at(k * P); coastPath.push([c.th, c.r, M.end.t + k * P]); }
    } else if (M.coast && M.coast.escape){
      for (let dt = 0; dt <= 1200; dt += 20){ const c = M.coast.at(dt); coastPath.push([c.th, c.r, M.end.t + dt]); }
    }
    const boostPath = [];
    if (B) for (let i = 0; i < B.t.length; i += 2) boostPath.push([B.th[i], B.h[i] + RE, B.t[i]]);
    const trackPts = [];                               // ground track (lat/lon over full mission)
    for (const [th, rr, tt] of ascPath) trackPts.push({ ...geo(th, tt), t: tt });
    for (const [th, rr, tt] of coastPath) trackPts.push({ ...geo(th, tt), t: tt });

    /* ----- timeline / controls ----- */
    const T0 = -10, T1 = M.tEnd;
    let t = T0, playing = !reduced, speed = 1, cam = "free", track = false;
    let yaw = L.longitude * D2R + Math.PI / 2, tilt = .38 - phi * .35, zoom = 1;
    const cv = $("#simCv"), r = E.makeRenderer(cv);
    const scrub = $("#scrub");
    scrub.min = T0; scrub.max = T1; scrub.value = T0;

    // event ticks on the scrubber
    const ticks = $("#ticks");
    for (const ev of M.events){
      if (ev.t > T1) continue;
      const d = document.createElement("span");
      d.className = "tick"; d.title = `${ev.name} — T+${Math.round(ev.t)}s`;
      d.style.left = ((ev.t - T0) / (T1 - T0) * 100) + "%";
      ticks.appendChild(d);
    }

    $("#btnPlay").addEventListener("click", () => { playing = !playing; if (t >= T1 - .5 && playing) t = T0; });
    scrub.addEventListener("input", () => { t = parseFloat(scrub.value); playing = false; draw(performance.now()); });
    document.querySelectorAll("[data-speed]").forEach(b => b.addEventListener("click", e => {
      speed = +e.currentTarget.dataset.speed;
      document.querySelectorAll("[data-speed]").forEach(x => x.classList.toggle("is-active", x === e.currentTarget));
    }));
    document.querySelectorAll("[data-cam]").forEach(b => b.addEventListener("click", e => {
      cam = e.currentTarget.dataset.cam;
      if (cam === "pad") zoom = 2.4;
      if (cam === "chase") zoom = Math.max(zoom, 1.6);
      if (cam === "free") zoom = 1;
      document.querySelectorAll("[data-cam]").forEach(x => x.classList.toggle("is-active", x === e.currentTarget));
    }));
    $("#btnTrack").addEventListener("click", e => {
      track = !track;
      e.currentTarget.setAttribute("aria-pressed", track);
      e.currentTarget.classList.toggle("is-active", track);
      $("#hudHint").textContent = track ? "ground track — Earth-fixed" : "drag to rotate · scroll to zoom";
    });

    // drag + wheel + touch
    let dragging = false, px = 0, py = 0;
    cv.addEventListener("pointerdown", e => { dragging = true; px = e.clientX; py = e.clientY; cv.setPointerCapture(e.pointerId); if (cam !== "free") setCam("free"); });
    cv.addEventListener("pointermove", e => {
      if (!dragging || track) return;
      yaw += (e.clientX - px) * .005; tilt += (e.clientY - py) * .004;
      tilt = Math.max(-1.2, Math.min(1.2, tilt));
      px = e.clientX; py = e.clientY;
      if (!playing) draw(performance.now());
    });
    addEventListener("pointerup", () => dragging = false);
    cv.addEventListener("wheel", e => { e.preventDefault(); zoom *= e.deltaY < 0 ? 1.12 : .9; zoom = Math.max(.55, Math.min(4, zoom)); if (!playing) draw(performance.now()); }, { passive: false });
    function setCam(c){ cam = c; document.querySelectorAll("[data-cam]").forEach(x => x.classList.toggle("is-active", x.dataset.cam === c)); }

    /* ----- HUD ----- */
    const fmtT = tt => {
      const neg = tt < 0, a = Math.abs(tt);
      const h = Math.floor(a / 3600), m = Math.floor(a / 60) % 60, s = Math.floor(a % 60);
      const p2 = n => String(n).padStart(2, "0");
      return (neg ? "T−" : "T+") + (h ? h + ":" : "") + p2(m) + ":" + p2(s);
    };
    function hud(st){
      $("#gT").textContent = fmtT(t);
      $("#gAlt").textContent = st.r - RE < 1e5 ? ((st.r - RE) / 1000).toFixed(1) + " km" : Math.round((st.r - RE) / 1000).toLocaleString() + " km";
      $("#gVel").textContent = st.v < 1000 ? Math.round(st.v) + " m/s" : (st.v / 1000).toFixed(2) + " km/s";
      $("#gRng").textContent = Math.round(st.th * RE / 1000).toLocaleString() + " km";
      let ph = "Countdown";
      for (const ev of M.events) if (ev.t <= t) ph = ev.name;
      if (t < 0) ph = "Countdown";
      if (M.coast && t > M.end.t) ph = M.coast.escape ? "Escape coast" : "Orbital coast";
      $("#hudPhase").textContent = ph.toUpperCase();
    }

    /* ----- drawing ----- */
    function drawPath3(pts, tMax, C, color, alpha, width){
      const { ctx } = r;
      ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = width * r.DPR; ctx.lineCap = "round";
      ctx.beginPath();
      let pen = false;
      for (const [th, rr, tt] of pts){
        if (tt > tMax) break;
        const p = pos3(th, rr, tt);
        const q = r.pj(p[0], p[1], p[2]);
        if (q[2] > -0.12){ pen ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); pen = true; } else pen = false;
      }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    function dot(p, C, color, rad, glow){
      const q = r.pj(p[0], p[1], p[2]);
      if (q[2] <= -0.15) return;
      const { ctx } = r;
      ctx.fillStyle = color;
      if (glow){ ctx.globalAlpha = .16; ctx.beginPath(); ctx.arc(q[0], q[1], rad * 3.2 * r.DPR, 0, TAU); ctx.fill();
                 ctx.globalAlpha = .35; ctx.beginPath(); ctx.arc(q[0], q[1], rad * 1.9 * r.DPR, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(q[0], q[1], rad * r.DPR, 0, TAU); ctx.fill();
    }

    function draw3D(now, st, C){
      const sun = E.sunDir(new Date(+L.net + Math.max(0, t) * 1000));
      if (cam === "chase" && st.on && t > 0){
        const g = geo(st.th, t);
        yaw = g.lo * D2R + Math.PI / 2;
        tilt = Math.max(-1.1, Math.min(1.1, .3 - g.la * D2R * .5));
      } else if (cam === "pad"){
        yaw = L.longitude * D2R + Math.PI / 2;
        tilt = .38 - phi * .35;
      }
      r.setZoom(zoom);
      r.earth(yaw, tilt, C, sun);
      // pad
      dot(E.ll2xyz(L.latitude, L.longitude), C, C.pad, 2.6, false);
      // paths
      drawPath3(ascPath, Math.min(t, M.end.t), C, C.rocket, .85, 1.6);
      if (t > M.end.t && coastPath.length) drawPath3(coastPath, t, C, C.orbit, .55, 1.1);
      if (boostPath.length && t > boostPath[0][2]) drawPath3(boostPath, t, C, C.txt, .5, 1);
      // future coast ring (dashed, faint)
      if (coastPath.length){
        r.ctx.setLineDash([4 * r.DPR, 6 * r.DPR]);
        drawPath3(coastPath, Infinity, C, C.orbit, .16, 1);
        r.ctx.setLineDash([]);
      }
      // booster
      const bs = boosterAt(t);
      if (bs && !bs.done) dot(pos3(bs.th, bs.r, t), C, C.txt, 2.2, false);
      // vehicle
      if (st.on && t > 0) dot(pos3(st.th, st.r, t), C, C.rocket, 3, true);
    }

    function drawTrack(C){
      const { ctx } = r;
      r.resize();
      const W = r.W, H = r.H;
      ctx.clearRect(0, 0, W, H);
      const X = lo => (lo + 180) / 360 * W, Y = la => (90 - la) / 180 * H;
      // grid
      ctx.strokeStyle = C.grid; ctx.lineWidth = r.DPR * .6; ctx.globalAlpha = .5;
      for (let lo = -150; lo < 180; lo += 30){ ctx.beginPath(); ctx.moveTo(X(lo), 0); ctx.lineTo(X(lo), H); ctx.stroke(); }
      for (let la = -60; la <= 60; la += 30){ ctx.beginPath(); ctx.moveTo(0, Y(la)); ctx.lineTo(W, Y(la)); ctx.stroke(); }
      ctx.globalAlpha = 1;
      // coasts
      ctx.strokeStyle = C.coast; ctx.lineWidth = r.DPR * .8;
      ctx.beginPath();
      for (const a of COASTLL){
        let pen = false, plo = 0;
        for (let i = 0; i < a.length; i += 2){
          const la = a[i], lo = a[i+1];
          if (pen && Math.abs(lo - plo) > 180) pen = false;
          pen ? ctx.lineTo(X(lo), Y(la)) : ctx.moveTo(X(lo), Y(la));
          pen = true; plo = lo;
        }
      }
      ctx.stroke();
      // track: past solid, future faint
      const seg = (filter, alpha, wid) => {
        ctx.strokeStyle = C.orbit; ctx.globalAlpha = alpha; ctx.lineWidth = wid * r.DPR;
        ctx.beginPath();
        let pen = false, plo = 0;
        for (const p of trackPts){
          if (!filter(p)) { pen = false; continue; }
          if (pen && Math.abs(p.lo - plo) > 180) pen = false;
          pen ? ctx.lineTo(X(p.lo), Y(p.la)) : ctx.moveTo(X(p.lo), Y(p.la));
          pen = true; plo = p.lo;
        }
        ctx.stroke(); ctx.globalAlpha = 1;
      };
      seg(p => p.t > t, .25, 1);
      seg(p => p.t <= t, .9, 1.6);
      // pad + vehicle
      ctx.fillStyle = C.pad;
      ctx.beginPath(); ctx.arc(X(L.longitude), Y(L.latitude), 3 * r.DPR, 0, TAU); ctx.fill();
      const st = stateAt(Math.max(0, t));
      if (t > 0){
        const g = geo(st.th, t);
        ctx.fillStyle = C.rocket;
        ctx.beginPath(); ctx.arc(X(g.lo), Y(g.la), 3.4 * r.DPR, 0, TAU); ctx.fill();
      }
    }

    let last = null;
    function draw(now){
      if (playing && last != null){
        t += (now - last) / 1000 * speed;
        if (t >= T1){ t = T1; playing = false; }
        scrub.value = t;
      }
      last = now;
      $("#btnPlay").textContent = playing ? "❚❚" : "▶";
      const C = E.colors();
      const st = stateAt(Math.max(0, t));
      r.resize();
      if (track) drawTrack(C);
      else { r.ctx.clearRect(0, 0, r.W, r.H); draw3D(now, st, C); }
      hud(st);
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }
})();
