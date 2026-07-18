/* ============================================================
   RLTWire — shared canvas 3D wireframe engine (no libraries).
   - Hero: animated yellow phosphor rocket (#wireframe canvas)
   - Cards/modal: static muted wireframes, seeded per vehicle,
     so every launch has a visual that can never fail to load.
   Respects reduced motion; hero pauses offscreen.
   ============================================================ */
(function(){
  "use strict";
  const SEG = 12, TAU = Math.PI * 2;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- parametric rocket model ---------- */
  function buildModel(p){
    const V = [], E = [];
    const R = p.r, H = p.h, FR = p.fair;
    function ring(y, r){
      const s = V.length;
      for (let i = 0; i < SEG; i++){
        const a = i / SEG * TAU;
        V.push([Math.cos(a) * r, y, Math.sin(a) * r]);
      }
      for (let i = 0; i < SEG; i++) E.push([s + i, s + (i + 1) % SEG]);
      return s;
    }
    function connect(a, b, step){
      for (let i = 0; i < SEG; i += (step || 2)) E.push([a + i, b + i]);
    }
    function cyl(x0, z0, r, y0, y1, coneTip){
      const rings = [];
      const n = 3;
      for (let i = 0; i <= n; i++){
        const s = V.length;
        for (let j = 0; j < SEG; j += 2){
          const a = j / SEG * TAU;
          V.push([x0 + Math.cos(a) * r, y0 + (y1 - y0) * i / n, z0 + Math.sin(a) * r]);
        }
        for (let j = 0; j < SEG / 2; j++) E.push([s + j, s + (j + 1) % (SEG / 2)]);
        rings.push(s);
      }
      for (let i = 0; i < n; i++)
        for (let j = 0; j < SEG / 2; j += 2) E.push([rings[i] + j, rings[i + 1] + j]);
      if (coneTip){
        const t = V.push([x0, y1 + r * 2.2, z0]) - 1;
        for (let j = 0; j < SEG / 2; j += 1) E.push([rings[n] + j, t]);
      }
    }
    // core stack
    const rE  = ring(0.4, R * 1.07);
    const r1  = ring(2, R);
    const rMid1 = ring(H * 0.18, R), rMid2 = ring(H * 0.36, R), rSep = ring(H * 0.53, R);
    const rSep2 = ring(H * 0.575, R), rUp = ring(H * 0.73, R);
    const f1 = ring(H * 0.765, FR), f2 = ring(H * 0.885, FR);
    const n1 = ring(H * 0.925, FR * 0.75), n2 = ring(H * 0.956, FR * 0.45);
    const tip = V.push([0, H, 0]) - 1;
    connect(rE, r1, 3); connect(r1, rMid1); connect(rMid1, rMid2); connect(rMid2, rSep);
    connect(rSep, rSep2, 3); connect(rSep2, rUp); connect(rUp, f1, 2); connect(f1, f2);
    connect(f2, n1, 2); connect(n1, n2, 2);
    for (let i = 0; i < SEG; i += 2) E.push([n2 + i, tip]);
    // grid fins / flaps
    if (p.fins){
      for (let k = 0; k < 4; k++){
        const a = (k + .5) / 4 * TAU, c = Math.cos(a), s = Math.sin(a);
        const y = H * 0.545, b = V.length, out = R * 1.7;
        V.push([c*R, y, s*R], [c*out, y + .2, s*out], [c*out, y + 1.6, s*out], [c*R, y + 1.8, s*R]);
        E.push([b,b+1],[b+1,b+2],[b+2,b+3],[b,b+2],[b+1,b+3]);
      }
    }
    if (p.flaps){ // starship-style: 2 big fins near top and bottom
      for (const [yy, len] of [[H * 0.82, H * 0.13], [H * 0.06, H * 0.16]]){
        for (const sgn of [1, -1]){
          const b = V.length, out = R * 2.05 * sgn;
          V.push([sgn * R * .95, yy, 0], [out, yy - len * .35, 0], [out, yy + len * .5, 0], [sgn * R * .95, yy + len, 0]);
          E.push([b,b+1],[b+1,b+2],[b+2,b+3],[b,b+2]);
        }
      }
    }
    // landing legs
    if (p.legs){
      for (let k = 0; k < 4; k++){
        const a = k / 4 * TAU, c = Math.cos(a), s = Math.sin(a);
        const b = V.length;
        V.push([c*R*1.06, H*0.2, s*R*1.06], [c*R*1.35, 0.6, s*R*1.35], [c*R*1.56, 0.3, s*R*1.56]);
        E.push([b, b+1], [b+1, b+2]);
      }
    }
    // side boosters
    if (p.boosters){
      for (let k = 0; k < p.boosters; k++){
        const a = k / p.boosters * TAU + .5;
        cyl(Math.cos(a) * R * 2.05, Math.sin(a) * R * 2.05, R * 0.62, 0.5, H * 0.5, true);
      }
    }
    // engine bells
    const eN = Math.min(p.engines, 9), rr = eN > 1 ? R * 0.64 : 0;
    for (let k = 0; k < eN; k++){
      const a = k / Math.max(1, eN - (eN > 1 ? 1 : 0)) * TAU;
      const cx0 = k === eN - 1 && eN > 1 ? 0 : Math.cos(a) * rr;
      const cz0 = k === eN - 1 && eN > 1 ? 0 : Math.sin(a) * rr;
      const b = V.length, br = R * 0.13, bR = R * 0.3;
      for (let j = 0; j < 4; j++){
        const aa = j / 4 * TAU + .4;
        V.push([cx0 + Math.cos(aa)*br, 0.2, cz0 + Math.sin(aa)*br]);
        V.push([cx0 + Math.cos(aa)*bR, -R * 0.9, cz0 + Math.sin(aa)*bR]);
      }
      for (let j = 0; j < 4; j++){
        E.push([b + j*2, b + j*2 + 1]);
        E.push([b + j*2 + 1, b + ((j+1)%4)*2 + 1]);
      }
    }
    return { V, E, cy: H * 0.5, h: H };
  }

  /* ---------- vehicle heuristics ---------- */
  function paramsFor(name){
    const n = (name || "").toLowerCase();
    if (n.includes("starship") || n.includes("super heavy"))
      return { r: 2.6, h: 50, fair: 2.6, fins: false, flaps: true, legs: false, boosters: 0, engines: 7 };
    if (n.includes("heavy") && n.includes("falcon"))
      return { r: 1.6, h: 45, fair: 2.0, fins: true, flaps: false, legs: true, boosters: 2, engines: 9 };
    if (n.includes("electron") || n.includes("alpha") || n.includes("pegasus") || n.includes("minotaur"))
      return { r: 1.1, h: 34, fair: 1.5, fins: false, flaps: false, legs: false, boosters: 0, engines: 5 };
    if (n.includes("ariane") || n.includes("vulcan") || n.includes("lvm3") || n.includes("gslv") || n.includes("atlas") || n.includes("long march"))
      return { r: 1.9, h: 42, fair: 2.3, fins: false, flaps: false, legs: false, boosters: 2, engines: 2 };
    if (n.includes("new glenn") || n.includes("neutron") || n.includes("h3") || n.includes("terran"))
      return { r: 2.1, h: 44, fair: 2.5, fins: false, flaps: false, legs: true, boosters: 0, engines: 7 };
    return { r: 1.6, h: 45, fair: 2.0, fins: true, flaps: false, legs: true, boosters: 0, engines: 9 }; // falcon-ish default
  }
  const cache = {};
  function modelFor(name){
    const p = paramsFor(name);
    const key = JSON.stringify(p);
    return cache[key] || (cache[key] = buildModel(p));
  }
  function hash(s){
    let h = 0;
    for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  /* ---------- renderer ---------- */
  function render(cv, model, yaw, tilt, o){
    const ctx = cv.getContext("2d");
    const DPR = Math.min(devicePixelRatio || 1, 2);
    const W = cv.clientWidth * DPR, H = cv.clientHeight * DPR;
    if (cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; }
    ctx.clearRect(0, 0, W, H);
    const [cr, cg, cb] = o.rgb;

    // ambient specks + orbit arc for card mode
    if (o.decor){
      const hs = hash(o.seedKey);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},.35)`;
      for (let i = 0; i < 14; i++){
        const x = ((hs * (i + 3) * 2654435761) % 1000) / 1000 * W;
        const y = ((hs * (i + 7) * 40503) % 1000) / 1000 * H;
        ctx.fillRect(x, y, DPR, DPR);
      }
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},.22)`;
      ctx.setLineDash([3 * DPR, 5 * DPR]);
      ctx.lineWidth = DPR * .7;
      ctx.beginPath();
      ctx.ellipse(W * .5, H * .52, W * .42, H * .3, -.3, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const fit = (H * 0.86) / model.h;   // fit rocket height into canvas
    ctx.lineWidth = Math.max(1, DPR * 0.75);
    if (o.glow){ ctx.shadowColor = `rgba(${cr},${cg},${cb},.65)`; ctx.shadowBlur = 7 * DPR; }
    const cyaw = Math.cos(yaw), syaw = Math.sin(yaw);
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const P = model.V.map(pt => {
      let [x, y, z] = pt; y -= model.cy;
      const x1 = x * cyaw - z * syaw, z1 = x * syaw + z * cyaw;
      const y2 = y * ct - z1 * st, z2 = y * st + z1 * ct;
      const s = 46 / (46 + z2 * 1.15);
      return [W / 2 + x1 * s * fit * 2.2, H / 2 - y2 * s * fit, z2];
    });
    for (const [a, b] of model.E){
      const pa = P[a], pb = P[b];
      const depth = (pa[2] + pb[2]) / 2;
      const alpha = Math.max(.1, Math.min(.85, (o.base || .62) - depth * 0.075));
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha})`;
      ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  /* ---------- public: static card/modal paint ---------- */
  window.RLTWire = {
    paintStatic(cv, name){
      if (!cv || !cv.clientWidth) return;
      const yaw = (hash(name) % 628) / 100;
      render(cv, modelFor(name), yaw, 0.14, {
        rgb: [138, 147, 180], glow: false, base: .5, decor: true, seedKey: name,
      });
      cv.dataset.painted = "1";
    },
    paintAll(root){
      (root || document).querySelectorAll("canvas.lc-wire").forEach(cv =>
        window.RLTWire.paintStatic(cv, cv.dataset.name || ""));
    },
  };

  /* ---------- hero: animated ---------- */
  const heroCv = document.getElementById("wireframe");
  if (heroCv){
    const model = modelFor("falcon default");
    let start = null, running = true;
    function frame(now){
      if (start === null) start = now;
      const t = (now - start) / 1000;
      render(heroCv, model, reduced ? 0.7 : t * 0.4,
        0.12 + (reduced ? 0 : Math.sin(t * 0.23) * 0.05),
        { rgb: [255, 232, 31], glow: true, base: .62 });
      if (running && !reduced) requestAnimationFrame(frame);
    }
    addEventListener("resize", () => { if (reduced) requestAnimationFrame(frame); });
    requestAnimationFrame(frame);
    if ("IntersectionObserver" in window && !reduced){
      new IntersectionObserver(en => {
        const vis = en[0].isIntersecting;
        if (vis && !running){ running = true; requestAnimationFrame(frame); }
        running = vis;
      }, { threshold: 0.02 }).observe(heroCv);
    }
  }

  // paint any cards that rendered before this script loaded
  window.RLTWire.paintAll();
  addEventListener("resize", () => window.RLTWire.paintAll());
})();
