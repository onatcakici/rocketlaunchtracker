/* ============================================================
   RLTOrbit — wireframe globe + orbit animations (no libraries).
   - Modal: globe rotated to the launch pad, animated ascent arc
     into the mission's target orbit class (illustrative).
   - Map view: all pads dotted on a slowly rotating globe.
   Theme-aware (light/dark), pauses when hidden.
   ============================================================ */
(function(){
  "use strict";
  const TAU = Math.PI * 2;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function colors(){
    const dark = document.documentElement.dataset.theme === "dark" ||
      (document.documentElement.classList.contains("auto-dark"));
    return dark
      ? { globe:"#39445c", globeHi:"#4d5975", orbit:"#3b82f6", rocket:"#60a5fa", pad:"#f87171", txt:"#aab3cc", halo:"#0e1420" }
      : { globe:"#aeb9cc", globeHi:"#8e9cb5", orbit:"#2563eb", rocket:"#2563eb", pad:"#dc2626", txt:"#5b6472", halo:"#f6f7f9" };
  }
  const D2R = Math.PI / 180;
  function ll2xyz(lat, lon){
    const la = lat * D2R, lo = lon * D2R;
    return [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)];
  }
  function rotY(p, a){ const c = Math.cos(a), s = Math.sin(a); return [p[0]*c - p[2]*s, p[1], p[0]*s + p[2]*c]; }
  function rotX(p, a){ const c = Math.cos(a), s = Math.sin(a); return [p[0], p[1]*c - p[2]*s, p[1]*s + p[2]*c]; }

  function makeRenderer(cv){
    const ctx = cv.getContext("2d");
    let W = 0, H = 0, DPR = 1, R = 0, cx = 0, cy = 0;
    function resize(){
      DPR = Math.min(devicePixelRatio || 1, 1.5);
      W = cv.clientWidth * DPR; H = cv.clientHeight * DPR;
      if (cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; }
      R = Math.min(W, H) * 0.38; cx = W / 2; cy = H / 2;
    }
    function proj(p, yaw, tilt){
      let q = rotY(p, yaw); q = rotX(q, tilt);
      return [cx + q[0] * R, cy - q[1] * R, q[2]];   // z>0 = front
    }
    function globe(yaw, tilt, C){
      ctx.lineWidth = DPR * 0.8;
      // outline
      ctx.strokeStyle = C.globeHi;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      // parallels & meridians, front brighter
      for (const back of [false, true]){
        ctx.strokeStyle = C.globe;
        ctx.globalAlpha = back ? .35 : .8;
        for (let lat = -60; lat <= 60; lat += 30) path(latCircle(lat), yaw, tilt, back);
        for (let lon = 0; lon < 180; lon += 30) path(meridian(lon), yaw, tilt, back);
        ctx.globalAlpha = 1;
      }
    }
    const latCircle = lat => { const pts = []; for (let l = 0; l <= 360; l += 6) pts.push(ll2xyz(lat, l)); return pts; };
    const meridian = lon => { const pts = []; for (let l = -90; l <= 90; l += 6) pts.push(ll2xyz(l, lon)); pts.push(...[...Array(31)].map((_, i) => ll2xyz(90 - i * 6, lon + 180))); return pts; };
    function path(pts, yaw, tilt, back, close){
      ctx.beginPath();
      let pen = false;
      for (const p of pts){
        const [x, y, z] = proj(p, yaw, tilt);
        const front = z > -0.02;
        if (back ? !front : front){ pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; }
        else pen = false;
      }
      ctx.stroke();
    }
    return { ctx, resize, proj, globe, path, get R(){ return R; }, get DPR(){ return DPR; }, get W(){ return W; }, get H(){ return H; } };
  }

  /* ---------- orbit geometry per mission ---------- */
  function orbitSpec(orbitName, lat){
    const o = (orbitName || "").toLowerCase();
    const incl = Math.max(Math.abs(lat || 28) * D2R, 0.25);
    if (o.includes("sun-sync") || o.includes("sso") || o.includes("polar"))
      return { rx: 1.3, rz: 1.3, incl: 97 * D2R, esc: false, label: "near-polar orbit" };
    if (o.includes("geo") && !o.includes("transfer"))
      return { rx: 1.85, rz: 1.85, incl: 0.12, esc: false, label: "geostationary orbit" };
    if (o.includes("gto") || o.includes("transfer"))
      return { rx: 1.95, rz: 1.15, incl: incl, esc: false, ecc: .55, label: "transfer ellipse" };
    if (o.includes("mars") || o.includes("lunar") || o.includes("moon") || o.includes("helio") || o.includes("escape") || o.includes("injection"))
      return { rx: 2.4, rz: 2.4, incl: incl, esc: true, label: "escape trajectory" };
    if (o.includes("medium") || o.includes("meo"))
      return { rx: 1.6, rz: 1.6, incl: Math.max(incl, .9), esc: false, label: "medium Earth orbit" };
    if (o.includes("suborbital"))
      return { rx: 1.18, rz: 1.18, incl: incl, esc: false, sub: true, label: "suborbital arc" };
    return { rx: 1.28, rz: 1.28, incl: incl, esc: false, label: "low Earth orbit" };
  }
  function ringPoint(spec, th, lonOff){
    let p = [Math.cos(th) * spec.rx, 0, Math.sin(th) * (spec.rz || spec.rx)];
    if (spec.ecc) p[0] -= spec.rx * spec.ecc * .5;
    p = rotX(p, -spec.incl);
    return rotY(p, lonOff);
  }

  let raf = 0, mode = null;

  function stop(){ mode = null; if (raf) cancelAnimationFrame(raf); raf = 0; }

  /* ---------- per-launch ascent animation ---------- */
  function play(cv, launch){
    stop();
    const r = makeRenderer(cv);
    const lat = parseFloat(launch.latitude), lon = parseFloat(launch.longitude);
    const okLL = isFinite(lat) && isFinite(lon);
    const spec = orbitSpec(launch.orbit, okLL ? lat : 28);
    const padLL = okLL ? [lat, lon] : [28.5, -80.6];
    const lonOff = padLL[1] * D2R - (25 + 90) * D2R;  // insertion ~25° off the pad, camera-front
    const cap = document.getElementById("orbitCap");
    if (cap) cap.textContent = `Illustrative ascent to ${spec.label}` + (launch.pad ? ` from ${launch.pad}` : "");
    mode = "play";
    let t0 = null;
    const CYCLE = 10000;
    function frame(now){
      if (mode !== "play") return;
      if (!t0) t0 = now;
      const C = colors();
      r.resize();
      const t = ((now - t0) % CYCLE) / CYCLE;
      const yaw = Math.PI / 2 - padLL[1] * D2R + (reduced ? 0 : Math.sin((now - t0) / 9000) * .12);
      const tilt = .38 - padLL[0] * D2R * .35;
      const { ctx } = r;
      ctx.clearRect(0, 0, r.W, r.H);
      r.globe(yaw, tilt, C);
      // pad marker
      const pp = ll2xyz(padLL[0], padLL[1]);
      const [px, py, pz] = r.proj(pp, yaw, tilt);
      if (pz > 0){
        ctx.fillStyle = C.pad;
        ctx.beginPath(); ctx.arc(px, py, 3.2 * r.DPR, 0, TAU); ctx.fill();
        ctx.strokeStyle = C.pad; ctx.globalAlpha = .5;
        ctx.beginPath(); ctx.arc(px, py, (5 + (t * 40) % 9) * r.DPR, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // target orbit ring (dashed)
      ctx.strokeStyle = C.orbit; ctx.setLineDash([4 * r.DPR, 5 * r.DPR]); ctx.globalAlpha = .55;
      ctx.lineWidth = r.DPR;
      for (const back of [true, false]){
        ctx.globalAlpha = back ? .2 : .55;
        const pts = []; for (let a = 0; a <= 360; a += 4) pts.push(ringPoint(spec, a * D2R, lonOff));
        r.path(pts, yaw, tilt, back);
      }
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      // ascent (first 45% of cycle) then coast around ring
      const asc = Math.min(1, t / .45);
      const insertTh = Math.PI * .5;
      function ascPoint(k){
        const surf = pp.map(v => v * 1.02);
        const tgt = ringPoint(spec, insertTh, lonOff);
        const e = k * k * (3 - 2 * k);
        const bulge = 1 + Math.sin(e * Math.PI) * .16;
        return [0, 1, 2].map(i => (surf[i] + (tgt[i] - surf[i]) * e) * bulge);
      }
      ctx.strokeStyle = C.rocket; ctx.lineWidth = 1.8 * r.DPR;
      ctx.beginPath();
      for (let k = 0; k <= asc; k += .02){
        const [x, y, z] = r.proj(ascPoint(k), yaw, tilt);
        if (z > -0.1) k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      // rocket dot
      let head;
      if (t < .45) head = ascPoint(asc);
      else if (spec.esc){
        const k = (t - .45) / .55;
        const dir = ringPoint(spec, insertTh, lonOff);
        head = dir.map(v => v * (1 + k * 1.6));
      } else {
        head = ringPoint(spec, insertTh + ((t - .45) / .55) * TAU * (spec.sub ? .35 : 1), lonOff);
      }
      const [hx, hy, hz] = r.proj(head, yaw, tilt);
      if (hz > -0.15){
        ctx.fillStyle = C.rocket;
        ctx.shadowColor = C.rocket; ctx.shadowBlur = 8 * r.DPR;
        ctx.beginPath(); ctx.arc(hx, hy, 3 * r.DPR, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  }

  /* ---------- map of all pads ---------- */
  function map(cv, pads, highlightKey){
    stop();
    const r = makeRenderer(cv);
    mode = "map";
    let t0 = null;
    function frame(now){
      if (mode !== "map") return;
      if (!t0) t0 = now;
      const C = colors();
      r.resize();
      const yaw = reduced ? .6 : (now - t0) / 14000 * TAU * .35 + .6;
      const tilt = .42;
      const { ctx } = r;
      ctx.clearRect(0, 0, r.W, r.H);
      r.globe(yaw, tilt, C);
      ctx.font = `${10.5 * r.DPR}px Inter, sans-serif`;
      const taken = [];
      for (const p of pads){
        const [x, y, z] = r.proj(ll2xyz(p.lat, p.lon), yaw, tilt);
        if (z <= 0) continue;
        const hot = p.key === highlightKey;
        ctx.fillStyle = hot ? C.pad : C.orbit;
        ctx.globalAlpha = .9;
        ctx.beginPath(); ctx.arc(x, y, (2.4 + Math.min(p.n, 8) * .55) * r.DPR, 0, TAU); ctx.fill();
        if (hot){
          ctx.strokeStyle = C.pad; ctx.globalAlpha = .5;
          ctx.beginPath(); ctx.arc(x, y, (7 + (now / 60 % 10)) * r.DPR / 1.2, 0, TAU); ctx.stroke();
        }
        const lbl = p.name + " · " + p.n;
        let ly = y + 3 * r.DPR;
        while (taken.some(t => Math.abs(t[1] - ly) < 12 * r.DPR && Math.abs(t[0] - x) < 150 * r.DPR)) ly += 13 * r.DPR;
        taken.push([x, ly]);
        ctx.globalAlpha = 1; ctx.lineWidth = 3 * r.DPR; ctx.strokeStyle = C.halo; ctx.lineJoin = "round";
        ctx.strokeText(lbl, x + 8 * r.DPR, ly);
        ctx.fillStyle = C.txt;
        ctx.fillText(lbl, x + 8 * r.DPR, ly);
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  }

  window.RLTOrbit = { play, map, stop };
})();
