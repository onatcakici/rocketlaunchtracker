/* ============================================================
   RLTSimCore — mission physics for the simulator (no libraries).
   2-DOF point-mass ascent in the orbital plane: real gravity,
   exponential atmosphere drag, per-vehicle thrust/mass/burn data
   (approximate public figures), gravity-turn pitch program,
   class-based engine cutoff (perigee/apogee/energy targets),
   booster ballistic return with entry + landing burns, and
   analytic Kepler coast after insertion.
   Output is a sampled timeline the UI scrubs through.
   All values are simulated approximations, not actual telemetry.
   Runs in the browser (window.RLTSimCore) and in node (module.exports).
   ============================================================ */
(function(root){
  "use strict";
  const MU = 3.986004418e14;      // m^3/s^2
  const RE = 6.371e6;             // m
  const G0 = 9.80665;
  const OMEGA_E = 7.2921159e-5;   // rad/s

  /* ---------- vehicle database (approximate public figures) ----------
     stages: T = thrust N (avg), m0 = stage wet mass kg (excl. upper stages),
     mp = propellant kg, tb = burn s. cda = drag Cd*A m^2.
     boost: booster recovery profile (entryT/landT use nEng engines). */
  const VEHICLES = [
    { match: /falcon heavy/i, name: "Falcon Heavy", cda: 12,
      stages: [
        { T: 22800e3, m0: 3 * 435e3, mp: 3 * 411e3, tb: 154 },
        { T: 981e3,  m0: 116e3,     mp: 111.5e3,   tb: 397 } ],
      payload: { leo: 30e3, gto: 8e3, esc: 3.5e3, def: 8e3 },
      boost: { dry: 3 * 24e3, cda: 30, entry: true } },
    { match: /falcon 9/i, name: "Falcon 9", cda: 5.5, tune: { kick: .20, hKick: 500 },
      stages: [
        { T: 7607e3, m0: 435e3, mp: 411e3,   tb: 162 },
        { T: 981e3,  m0: 116e3, mp: 111.5e3, tb: 397 } ],
      payload: { leo: 15.5e3, gto: 5.5e3, esc: 3e3, sub: 10e3, def: 10e3 },
      boost: { dry: 24e3, cda: 10, entry: true } },
    { match: /electron/i, name: "Electron", cda: 1.1, tune: { kick: .40, hKick: 250, span: 2000 },
      stages: [
        { T: 224e3,  m0: 10.2e3, mp: 9.25e3, tb: 156 },
        { T: 26e3,   m0: 2.55e3, mp: 2.35e3, tb: 355 } ],
      payload: { leo: 0.25e3, gto: 0.08e3, def: 0.2e3 },
      boost: { dry: 0.95e3, cda: 2, entry: false } },
    { match: /new glenn/i, name: "New Glenn", cda: 38,
      stages: [
        { T: 17100e3, m0: 1080e3, mp: 1000e3, tb: 190 },
        { T: 1400e3,  m0: 190e3,  mp: 175e3,  tb: 500 } ],
      payload: { leo: 40e3, gto: 12e3, esc: 6e3, def: 20e3 },
      boost: { dry: 80e3, cda: 60, entry: true } },
    { match: /starship/i, name: "Starship", cda: 63, tune: { kick: .17, hKick: 700 },
      stages: [
        { T: 74000e3, m0: 3600e3, mp: 3400e3, tb: 160 },
        { T: 14000e3, m0: 1450e3, mp: 1300e3, tb: 350 } ],
      payload: { leo: 100e3, gto: 20e3, esc: 20e3, sub: 50e3, def: 80e3 },
      boost: { dry: 200e3, cda: 100, entry: true } },
    { match: /neutron/i, name: "Neutron", cda: 15,
      stages: [
        { T: 7300e3, m0: 400e3, mp: 370e3, tb: 160 },
        { T: 890e3,  m0: 90e3,  mp: 84e3,  tb: 400 } ],
      payload: { leo: 11e3, gto: 3e3, def: 8e3 },
      boost: { dry: 30e3, cda: 22, entry: true } },
    { match: /new shepard/i, name: "New Shepard", cda: 7, sub: true,
      stages: [ { T: 490e3, m0: 26e3, mp: 19e3, tb: 141 } ],
      payload: { sub: 4e3, def: 4e3 },
      boost: { dry: 13e3, cda: 12, entry: true } },
    { match: /.*/, name: "Generic two-stage", cda: 9,
      stages: [
        { T: 5100e3, m0: 300e3, mp: 280e3, tb: 165 },
        { T: 700e3,  m0: 80e3,  mp: 74e3,  tb: 430 } ],
      payload: { leo: 8e3, gto: 4e3, esc: 2e3, sub: 6e3, def: 6e3 },
      boost: { dry: 20e3, cda: 16, entry: false } },
  ];

  function orbitClass(orbitName){
    const o = (orbitName || "").toLowerCase();
    if (o.includes("suborbital")) return "sub";
    if (o.includes("gto") || o.includes("transfer")) return "gto";
    if (o.includes("geo")) return "gto";
    if (o.includes("mars") || o.includes("lunar") || o.includes("moon") || o.includes("helio") || o.includes("escape") || o.includes("injection")) return "esc";
    return "leo";                                 // LEO/SSO/MEO all insert low first
  }
  function pickVehicle(rocketName){
    return VEHICLES.find(v => v.match.test(rocketName || "")) || VEHICLES[VEHICLES.length - 1];
  }

  const rho = h => h < 120e3 ? 1.225 * Math.exp(-h / 7160) : 0;

  function elements(r, vr, vt){
    const v2 = vr * vr + vt * vt;
    const eps = v2 / 2 - MU / r;
    const hAng = r * vt;
    const a = -MU / (2 * eps);
    const e2 = Math.max(0, 1 - hAng * hAng / (MU * a));
    const e = Math.sqrt(e2);
    return { eps, a, e, hAng, ra: a * (1 + e), rp: a * (1 - e) };
  }

  /* one vehicle stack integration; returns sampled arrays + events */
  function fly(veh, cls, incl, latDeg, tuning){
    const kick = (tuning && tuning.kick) != null ? tuning.kick : 0.14;   // rad pitch-over
    const span = (tuning && tuning.span) || 2500;
    const hKick = (tuning && tuning.hKick) || 900;
    const payload = (veh.payload[cls] != null ? veh.payload[cls] : veh.payload.def) * ((tuning && tuning.plScale) || 1);
    // Earth-rotation credit projected on the launch plane
    const sinAz = Math.min(1, Math.max(-1, Math.cos(incl) / Math.cos(latDeg * Math.PI / 180)));
    const vRot = 465.1 * Math.cos(latDeg * Math.PI / 180) * sinAz;

    let stage = 0;
    let m = veh.stages.reduce((s, x) => s + x.m0, 0) + payload;
    let r = RE, th = 0, vr = 0, vt = vRot;
    const airRef = h2 => h2 < 130e3 ? vRot : 0;   // atmosphere co-rotates: credit isn't airspeed
    let t = 0, phase = "vertical", coastEnd = 0;
    const DT = 0.2, SAMPLE = 0.5;
    const S = { t: [], h: [], th: [], vr: [], vt: [], m: [], q: [] };
    const events = [{ t: 0, name: "Liftoff" }];
    let maxQ = 0, maxQt = 0, sepState = null, done = null, burnT = 0;

    for (let i = 0; i < 40000; i++){
      const st = veh.stages[stage];
      const h = r - RE;
      let burning = false, Tdir = null;

      if (phase === "coast"){                    // inter-stage
        if (t >= coastEnd){
          stage++;
          if (!veh.stages[stage]){ done = cls === "sub" ? null : "burnout"; phase = "ballistic"; }
          else { phase = "prograde"; burnT = 0; events.push({ t, name: stage === 1 ? "Second stage ignition" : "Stage " + (stage + 1) + " ignition" }); }
        }
      }
      const stg = veh.stages[stage];
      if (stg && phase !== "ballistic" && phase !== "coast" && burnT < stg.tb && stg.mp > 0){
        burning = true;
        const speed = Math.hypot(vr, vt - 0);    // inertial-ish; fine for direction
        if (phase === "vertical"){
          Tdir = [1, 0];
          if (h > hKick) phase = "kick";
        } else if (phase === "kick"){
          const k = Math.min(1, (h - hKick) / span);
          Tdir = [Math.cos(kick * k), Math.sin(kick * k)];
          if (k >= 1) phase = "prograde";
        } else {                                  // prograde (air-relative low, inertial high)
          const blend = Math.min(1, Math.max(0, (h - 30e3) / 30e3));
          const vtRef = vt - airRef(h) * (1 - blend);
          const sv = Math.hypot(vr, vtRef) || 1;
          Tdir = [vr / sv, vtRef / sv];
          if (cls !== "sub" && Tdir[0] < 0) Tdir = [Math.max(0, Tdir[0]), Math.sqrt(1 - Math.min(1, Tdir[0] * Tdir[0]))];
        }
      }

      // accelerations
      let ar = vt * vt / r - MU / (r * r);
      let at = -vr * vt / r;
      const vtAir = vt - airRef(h);
      const sv = Math.hypot(vr, vtAir);
      const q = 0.5 * rho(h) * sv * sv;
      if (q > maxQ && t < 200){ maxQ = q; maxQt = t; }
      if (sv > 0.1 && h < 120e3){
        const cda = stage === 0 ? veh.cda : Math.max(2, veh.cda * 0.4);
        const ad = q * cda / m;
        ar -= ad * vr / sv; at -= ad * vtAir / sv;
      }
      if (burning && Tdir){
        const acc = veh.stages[stage].T / m;
        ar += acc * Tdir[0]; at += acc * Tdir[1];
        const mdot = veh.stages[stage].mp / veh.stages[stage].tb;
        m -= mdot * DT; burnT += DT;
        veh._used = true;
      }

      // suborbital descent: drogue + mains below 4 km
      if (cls === "sub" && phase === "ballistic" && vr < 0 && h < 4e3){
        if (!events.some(e => e.name === "Parachute deploy")) events.push({ t, name: "Parachute deploy" });
        const svp = Math.hypot(vr, vtAir) || 1;
        const adp = 0.5 * rho(h) * svp * svp * (veh.cda * 45) / m;
        ar -= adp * vr / svp; at -= adp * vtAir / svp;
      }
      if (cls === "sub" && phase === "ballistic" && r + vr * DT <= RE){
        events.push({ t, name: "Capsule touchdown", v: Math.abs(vr) });
        r = RE; done = "landed";
      }

      vr += ar * DT; vt += at * DT;
      r += vr * DT; th += vt / r * DT; t += DT;

      // stage burnout
      const stNow = veh.stages[stage];
      if (burning && stNow && (burnT >= stNow.tb - DT / 2)){
        if (stage === 0){
          events.push({ t, name: "MECO", v: sv, h });
          events.push({ t: t + 3, name: "Stage separation" });
          sepState = { t: t + 3, r, th, vr, vt };
          m -= (stNow.m0 - stNow.mp);             // drop the dry stage (booster models its own reserve)
          phase = "coast"; coastEnd = t + 8;
          if (cls !== "sub") events.push({ t: t + 26, name: "Fairing separation" });
        } else {
          done = "burnout"; phase = "ballistic";
        }
      }

      // class cutoff on the upper stage
      if (burning && stage >= 1){
        const el = elements(r, vr, vt);
        const hit = (cls === "leo" && el.rp > RE + 180e3) ||
                    (cls === "gto" && el.ra > RE + 35.5e6) ||
                    (cls === "esc" && el.eps > 0);
        if (hit){
          m -= 0;
          events.push({ t, name: cls === "esc" ? "Escape-velocity cutoff" : "SECO — orbit insertion", v: Math.hypot(vr, vt), h });
          done = "orbit"; phase = "ballistic";
        }
      }

      if (i % Math.round(SAMPLE / DT) === 0 || done){
        S.t.push(t); S.h.push(h); S.th.push(th); S.vr.push(vr); S.vt.push(vt); S.m.push(m); S.q.push(q);
      }
      if (done) break;
      if (h < -10) break;                        // hit ground (suborbital handled by booster-style descent below)
      if (t > 3000) break;
    }
    if (cls === "sub"){
      let ai = 0; for (let k = 1; k < S.h.length; k++) if (S.h[k] > S.h[ai]) ai = k;
      if (S.h[ai] > 20e3) events.push({ t: S.t[ai], name: "Apogee", h: S.h[ai] });
    }
    events.splice(1, 0, { t: maxQt, name: "Max-Q" });
    events.sort((a, b) => a.t - b.t);
    return { S, events, end: { t, r, th, vr, vt }, result: done || "ballistic", payload, maxQt };
  }

  /* booster: ballistic from separation with entry + landing burns */
  function flyBooster(veh, sep){
    if (!veh.boost) return null;
    const b = veh.boost;
    let m = b.dry * 1.12;                        // dry + landing propellant reserve
    let { r, th, vr, vt } = sep;
    let t = sep.t;
    const T = veh.stages[0].T * (b.entry ? 0.36 : 0.0);   // ~3 of 9 engines style
    const DT = 0.25, S = { t: [], h: [], th: [] };
    const events = [];
    let phase = "coast", landed = false;

    for (let i = 0; i < 20000 && !landed; i++){
      const h = r - RE;
      let ar = vt * vt / r - MU / (r * r);
      let at = -vr * vt / r;
      const sv = Math.hypot(vr, vt);
      if (sv > 0.1 && h < 120e3){
        const ad = 0.5 * rho(h) * sv * sv * b.cda / m;
        ar -= ad * vr / sv; at -= ad * vt / sv;
      }
      if (b.entry && phase === "coast" && vr < 0 && h < 62e3){
        phase = "entry"; events.push({ t, name: "Booster entry burn" });
      }
      if (phase === "entry"){
        if (sv > 900){ ar -= T / m * (vr / sv); at -= T / m * (vt / sv); m -= T / (300 * G0) * DT; }
        else phase = "fall";
      }
      // landing burn: suicide-burn window
      const aNet = T * 1.2 / m - G0;
      if (b.entry && phase !== "land" && vr < 0 && h < (vr * vr) / (2 * Math.max(3, aNet)) + 400 && h < 12e3){
        phase = "land"; events.push({ t, name: "Landing burn" });
      }
      if (phase === "land"){
        const want = -Math.sqrt(Math.max(0, 2 * 4 * h)) * 0.6 - 1;     // target descent profile
        const err = want - vr;
        const acc = Math.max(0, Math.min(T * 1.2 / m, err * 1.4 + G0));
        ar += acc; at -= at * 0.15;
        at -= (vt / Math.max(1, sv)) * Math.min(Math.abs(vt) / DT, 3);  // kill drift
        m -= (acc * m) / (300 * G0) * DT * 0.9;
      }
      vr += ar * DT; vt += at * DT; r += vr * DT; th += vt / r * DT; t += DT;
      if (r - RE <= 2){
        landed = true; r = RE;
        events.push({ t, name: Math.abs(vr) < 12 ? "Booster touchdown" : "Booster splashdown", v: Math.abs(vr) });
      }
      if (i % 2 === 0 || landed){ S.t.push(t); S.h.push(r - RE); S.th.push(th); }
      if (t - sep.t > 900) break;
    }
    return { S, events };
  }

  /* Kepler coast after insertion: theta(t) from elements at cutoff */
  function coaster(end){
    const { r, vr, vt } = end;
    const el = elements(r, vr, vt);
    if (el.eps >= 0 || el.e >= 0.995){
      // escape: crude straight-line continuation
      return { escape: true, period: Infinity,
        at(dt){ const v = Math.hypot(vr, vt); return { r: r + v * dt, th: end.th + (vt / r) * Math.min(dt, 600) }; } };
    }
    const a = el.a, e = el.e, n = Math.sqrt(MU / (a * a * a));
    // true anomaly + eccentric anomaly at cutoff
    const p = a * (1 - e * e);
    let nu0 = Math.atan2(Math.sqrt(p / MU) * vr * (el.hAng / p), el.hAng * el.hAng / (MU * r) - 1);
    nu0 = Math.atan2(vr * el.hAng / MU / e, (el.hAng * el.hAng / (MU * r) - 1) / e);
    const E0 = Math.atan2(Math.sqrt(1 - e * e) * Math.sin(nu0), e + Math.cos(nu0));
    const M0 = E0 - e * Math.sin(E0);
    return {
      escape: false, period: 2 * Math.PI / n, a, e,
      at(dt){
        const M = M0 + n * dt;
        let E = M;
        for (let k = 0; k < 6; k++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
        const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
        const rr = a * (1 - e * Math.cos(E));
        return { r: rr, th: end.th + (nu - nu0) };
      }
    };
  }

  /* ---------- public: computeMission ---------- */
  function computeMission(launch){
    const cls = orbitClass(launch.orbit);
    const veh = pickVehicle(launch.rocket);
    const lat = isFinite(parseFloat(launch.latitude)) ? parseFloat(launch.latitude) : 28.5;
    const inclDeg = (launch.orbit || "").toLowerCase().match(/sun-sync|sso|polar/) ? 97 :
                    Math.max(Math.abs(lat), (launch.orbit || "").toLowerCase().match(/geo/) ? Math.abs(lat) : Math.abs(lat));
    const incl = inclDeg * Math.PI / 180;

    // auto-trim payload so the vehicle reaches the target (max 4 tries)
    let run = null, scale = 1;
    for (let k = 0; k < 4; k++){
      run = fly(JSON.parse(JSON.stringify(veh)), cls, incl, lat, Object.assign({}, veh.tune, { plScale: scale }));
      if (cls === "sub" || run.result === "orbit") break;
      scale *= 0.55;
    }
    const booster = run.events.some(e => e.name === "Stage separation")
      ? flyBooster(veh, (() => { const i = run.events.findIndex(e => e.name === "Stage separation");
          // reconstruct sep state from samples at that time
          const t = run.events[i].t; const S = run.S;
          let j = 0; while (j < S.t.length - 1 && S.t[j] < t) j++;
          return { t, r: S.h[j] + RE, th: S.th[j], vr: S.vr[j], vt: S.vt[j] }; })())
      : null;
    let coast = null;
    {
      const el = elements(run.end.r, run.end.vr, run.end.vt);
      if (run.result === "orbit" || el.eps >= 0 || el.rp > RE + 100e3){
        coast = coaster({ r: run.end.r, th: run.end.th, vr: run.end.vr, vt: run.end.vt });
        if (run.result === "burnout" && cls === "esc" && el.eps < 0)
          run.events.push({ t: run.end.t, name: "Burnout — parking orbit (escape needs orbital refueling)" });
      }
    }
    if (booster) run.events = run.events.concat(booster.events).sort((a, b) => a.t - b.t);

    const tEnd = run.end.t + (coast ? (coast.escape ? 1200 : Math.min(coast.period * 2, 4 * 3600)) : (booster ? Math.max(0, booster.S.t[booster.S.t.length - 1] - run.end.t) + 30 : 120));
    return { cls, vehicle: veh.name, payload: run.payload, S: run.S, events: run.events,
      end: run.end, result: run.result, booster, coast, tEnd,
      inclDeg, lat };
  }

  const api = { computeMission, orbitClass, pickVehicle, VEHICLES, RE, MU };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RLTSimCore = api;
})(typeof window !== "undefined" ? window : globalThis);
