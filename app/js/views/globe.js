// Globus: alle Orte, an denen ihr zusammen wart – besuchte Länder leuchten rosé.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { all, get, settings, subscribe } from '../store.js';
import { sortByDateDesc, fmtNumber } from '../model.js';
import { entryCard, topbar } from '../ui/components.js';
import { countryName, flag, distanceKm } from '../geo.js';
import { hydrate } from '../photos.js';

export const live = false; // zeichnet sich selbst neu

let libsPromise;
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`${src} konnte nicht geladen werden`));
    document.head.appendChild(s);
  });
}
function loadLibs() {
  if (!libsPromise) {
    libsPromise = (async () => {
      if (!window.d3?.geoOrthographic) {
        await loadScript('vendor/d3-array.min.js');
        await loadScript('vendor/d3-geo.min.js');
      }
      if (!window.topojson) await loadScript('vendor/topojson-client.min.js');
      const world = await fetch('assets/geo/countries-110m.json').then((r) => r.json());
      return { world, countries: window.topojson.feature(world, world.objects.countries).features, borders: window.topojson.mesh(world, world.objects.countries, (a, b) => a !== b) };
    })().catch((e) => { libsPromise = null; throw e; });
  }
  return libsPromise;
}
let detailPromise;
function loadDetail() {
  if (!detailPromise) {
    detailPromise = fetch('assets/geo/countries-50m.json').then((r) => r.json()).then((w) => ({
      countries: window.topojson.feature(w, w.objects.countries).features,
      borders: window.topojson.mesh(w, w.objects.countries, (a, b) => a !== b),
    })).catch(() => { detailPromise = null; return null; });
  }
  return detailPromise;
}

const containCache = new Map();

// ---------- Daten ----------
function collectPlaces() {
  const entries = all('entry').filter((e) => e.data.place && e.data.place.lat != null && e.data.place.lng != null);
  const groups = new Map();
  for (const e of entries) {
    const p = e.data.place;
    const key = `${Math.round(p.lat * 20) / 20},${Math.round(p.lng * 20) / 20}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { key, lat: p.lat, lng: p.lng, entries: [], trip: false, place: p }));
    g.entries.push(e);
    if (e.data.category === 'trip') g.trip = true;
  }
  for (const g of groups.values()) g.entries = sortByDateDesc(g.entries);
  return [...groups.values()];
}

export function render(el, _params, query) {
  const s = settings();
  el.innerHTML = String(html`
    ${topbar({ title: 'Unsere Welt' })}
    <div class="page globe-page">
      <h1 class="large-title">Unsere <em>Welt</em></h1>
      <div class="globe-wrap" id="gw">
        <canvas id="gc" aria-label="Globus mit euren Orten"></canvas>
        <div class="globe-tools">
          <button class="icon-btn" data-act="zin" aria-label="Hineinzoomen">${icon('plus')}</button>
          <button class="icon-btn" data-act="zout" aria-label="Herauszoomen">${icon('minus')}</button>
          ${s.home ? html`<button class="icon-btn" data-act="home" aria-label="Zuhause">${icon('target')}</button>` : ''}
        </div>
        <div class="globe-popup" id="gp"></div>
      </div>
      <div class="globe-stats" id="gs"></div>
      <div class="section" id="gl"></div>
    </div>`);

  const wrap = el.querySelector('#gw');
  const canvas = el.querySelector('#gc');
  const ctx = canvas.getContext('2d');
  const popup = el.querySelector('#gp');
  let destroyed = false;
  let geo = null, detail = null;
  let places = [], visited = new Set(), arcs = [];
  let W = 0, H = 0, dpr = 1, R0 = 100;
  let rotation = [-10, -30, 0];
  let zoom = 1;
  let selected = null;
  let lastInteract = 0;
  let vel = [0, 0];
  let fly = null;
  let raf = 0;
  let needsDraw = true;
  let tapTargets = [];

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Startposition: Zuhause oder letzter Ort
  if (s.home?.lat != null) rotation = [-s.home.lng, -Math.max(-60, Math.min(60, s.home.lat)), 0];

  function resize() {
    const r = wrap.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R0 = Math.min(W, H) / 2 * 0.84;
    needsDraw = true;
  }

  function computeData() {
    places = collectPlaces();
    visited = new Set();
    for (const p of places) {
      if (!geo) break;
      let id = containCache.get(p.key);
      if (id === undefined) {
        id = null;
        for (const f of geo.countries) {
          if (window.d3.geoContains(f, [p.lng, p.lat])) { id = f.id ?? f.properties.name; break; }
        }
        if (id == null && detail) {
          for (const f of detail.countries) if (window.d3.geoContains(f, [p.lng, p.lat])) { id = f.id ?? f.properties.name; break; }
        }
        if (id != null || detail) containCache.set(p.key, id);
      }
      if (id != null) visited.add(String(id));
    }
    // Bögen: von Zuhause zu jeder Reise, sonst Reisen chronologisch verbinden
    const home = settings().home;
    const trips = places.filter((p) => p.trip).sort((a, b) => String(a.entries[a.entries.length - 1].data.date).localeCompare(String(b.entries[b.entries.length - 1].data.date)));
    arcs = [];
    if (home?.lat != null) trips.forEach((t) => { if (distanceKm(home, t) > 30) arcs.push([home, t]); });
    else for (let i = 1; i < trips.length; i++) arcs.push([trips[i - 1], trips[i]]);
    renderStats();
    renderList();
    needsDraw = true;
  }

  function renderStats() {
    const codes = new Set(places.map((p) => p.place.countryCode).filter(Boolean));
    const countries = Math.max(codes.size, visited.size);
    const home = settings().home;
    let km = 0;
    if (home?.lat != null) km = arcs.reduce((sum, [a, b]) => sum + distanceKm(a, b) * 2, 0);
    else km = arcs.reduce((sum, [a, b]) => sum + distanceKm(a, b), 0);
    el.querySelector('#gs').innerHTML = String(html`
      <div><b>${countries}</b><span>${countries === 1 ? 'Land' : 'Länder'}</span></div>
      <div><b>${places.length}</b><span>${places.length === 1 ? 'Ort' : 'Orte'}</span></div>
      <div><b>${fmtNumber(Math.round(km))}</b><span>km gereist</span></div>`);
  }

  function renderList() {
    const byCountry = new Map();
    for (const p of places) {
      const code = p.place.countryCode || '';
      const name = code ? countryName(code) : p.place.country || 'Unbekannt';
      if (!byCountry.has(name)) byCountry.set(name, { name, code, places: [] });
      byCountry.get(name).places.push(p);
    }
    const list = [...byCountry.values()].sort((a, b) => b.places.reduce((n, p) => n + p.entries.length, 0) - a.places.reduce((n, p) => n + p.entries.length, 0));
    const box = el.querySelector('#gl');
    box.innerHTML = String(!places.length
      ? html`<div class="card center" style="padding:22px"><div style="font-size:40px">🗺️</div><h3 class="serif" style="font-size:20px;margin:6px 0">Euer Globus wartet</h3><p class="muted">Gebt euren Erlebnissen einen Ort – dann leuchten hier eure Länder, und Bögen zeigen eure Reisen.</p></div>`
      : html`
        <div class="section-head"><h2 class="section-title small">Wo wir schon waren</h2></div>
        <div class="country-list">
          ${list.map((c) => html`
            <button class="country" data-fly="${c.places[0].key}" style="width:100%;text-align:left">
              <span class="flag">${flag(c.code)}</span>
              <span class="grow"><span class="name">${c.name}</span><span class="places" style="display:block">${[...new Set(c.places.map((p) => p.place.city || p.place.name))].slice(0, 4).join(' · ')}</span></span>
              <span class="badge" style="background:var(--rose-soft);color:var(--rose)">${c.places.reduce((n, p) => n + p.entries.length, 0)}</span>
            </button>`)}
        </div>`);
  }

  // ---------- Projektion ----------
  const projection = () => window.d3.geoOrthographic().scale(R0 * zoom).translate([W / 2, H / 2]).clipAngle(90).rotate(rotation).precision(0.6);

  function project3d(rot, lng, lat, alt = 0) {
    const [rl, rp] = rot([lng, lat]);
    const l = (rl * Math.PI) / 180, p = (rp * Math.PI) / 180;
    const x = Math.cos(p) * Math.sin(l), y = Math.sin(p), z = Math.cos(p) * Math.cos(l);
    const k = R0 * zoom * (1 + alt);
    const visible = z > 0 || (Math.hypot(x, y) * (1 + alt) > 1 && z > -0.4);
    return { X: W / 2 + k * x, Y: H / 2 - k * y, z, visible };
  }

  function heartPath(c, x, y, size) {
    const s = size / 24;
    c.save();
    c.translate(x - 12 * s, y - 13 * s);
    c.scale(s, s);
    c.beginPath();
    c.moveTo(12, 21.2);
    c.bezierCurveTo(11.8, 21.2, 11.6, 21.1, 11.4, 21);
    c.bezierCurveTo(10.9, 20.7, 3, 15.8, 1.1, 10.8);
    c.bezierCurveTo(-0.6, 6.3, 2.8, 3, 6.6, 3);
    c.bezierCurveTo(8.8, 3, 10.6, 4, 12, 5.6);
    c.bezierCurveTo(13.4, 4, 15.2, 3, 17.4, 3);
    c.bezierCurveTo(21.2, 3, 24.6, 6.3, 22.9, 10.8);
    c.bezierCurveTo(21, 15.8, 13.1, 20.7, 12.6, 21);
    c.bezierCurveTo(12.4, 21.1, 12.2, 21.2, 12, 21.2);
    c.closePath();
    c.restore();
  }

  function draw(t) {
    if (!geo || !W) return;
    const d3 = window.d3;
    const proj = projection();
    const path = d3.geoPath(proj, ctx);
    const R = R0 * zoom;
    const cx = W / 2, cy = H / 2;
    const moving = !!fly || Math.abs(vel[0]) + Math.abs(vel[1]) > 0.01 || performance.now() - lastInteract < 250 || autoRotating();
    const useDetail = detail && !moving;
    const data = useDetail ? detail : geo;
    ctx.clearRect(0, 0, W, H);

    // Atmosphäre
    const atm = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.22);
    atm.addColorStop(0, 'rgba(255,143,163,0.35)');
    atm.addColorStop(0.35, 'rgba(184,166,255,0.14)');
    atm.addColorStop(1, 'rgba(184,166,255,0)');
    ctx.fillStyle = atm;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.22, 0, Math.PI * 2); ctx.fill();

    // Ozean
    const ocean = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    ocean.addColorStop(0, '#2d2b62');
    ocean.addColorStop(0.7, '#191838');
    ocean.addColorStop(1, '#100f26');
    ctx.fillStyle = ocean;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

    // Gradnetz
    ctx.beginPath(); path(d3.geoGraticule10());
    ctx.strokeStyle = 'rgba(255,255,255,0.055)'; ctx.lineWidth = 0.6; ctx.stroke();

    // Land
    ctx.beginPath();
    for (const f of data.countries) if (!visited.has(String(f.id ?? f.properties.name))) path(f);
    ctx.fillStyle = '#3b3566'; ctx.fill();

    // Besuchte Länder
    if (visited.size) {
      ctx.save();
      ctx.beginPath();
      for (const f of data.countries) if (visited.has(String(f.id ?? f.properties.name))) path(f);
      const vg = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      vg.addColorStop(0, '#ffb3c1'); vg.addColorStop(1, '#ff6b8b');
      ctx.fillStyle = vg;
      ctx.shadowColor = 'rgba(255,107,139,0.8)';
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.restore();
    }

    // Grenzen
    ctx.beginPath(); path(data.borders);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 0.5; ctx.stroke();

    // Lichtkante
    const rim = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.2, cx, cy, R * 1.02);
    rim.addColorStop(0, 'rgba(255,255,255,0.07)');
    rim.addColorStop(0.75, 'rgba(255,255,255,0)');
    rim.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = rim;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

    const rot = d3.geoRotation(rotation);

    // Bögen (schwebend)
    const dash = reduced ? 0 : (t / 60) % 20;
    for (const [a, b] of arcs) {
      const interp = d3.geoInterpolate([a.lng, a.lat], [b.lng, b.lat]);
      const dist = d3.geoDistance([a.lng, a.lat], [b.lng, b.lat]);
      const lift = Math.min(0.16, 0.04 + dist * 0.08);
      const n = 48;
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const [lng, lat] = interp(k);
        const pt = project3d(rot, lng, lat, Math.sin(Math.PI * k) * lift);
        if (pt.visible) { pen ? ctx.lineTo(pt.X, pt.Y) : ctx.moveTo(pt.X, pt.Y); pen = true; }
        else pen = false;
      }
      ctx.strokeStyle = 'rgba(243,217,177,0.85)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -dash;
      ctx.shadowColor = 'rgba(243,217,177,0.6)';
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
    }

    // Zuhause
    const home = settings().home;
    tapTargets = [];
    if (home?.lat != null) {
      const p = project3d(rot, home.lng, home.lat);
      if (p.z > 0) {
        ctx.beginPath(); ctx.arc(p.X, p.Y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#f3d9b1'; ctx.fill();
        ctx.beginPath(); ctx.arc(p.X, p.Y, 10, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(243,217,177,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }

    // Marker
    const pulse = reduced ? 0 : (Math.sin(t / 350) + 1) / 2;
    const sorted = places.map((p) => ({ p, pt: project3d(rot, p.lng, p.lat) })).filter((x) => x.pt.z > 0.02).sort((a, b) => a.pt.z - b.pt.z);
    for (const { p, pt } of sorted) {
      const isSel = selected && selected.key === p.key;
      const fade = Math.min(1, pt.z * 4);
      ctx.globalAlpha = fade;
      if (isSel) {
        ctx.beginPath();
        ctx.arc(pt.X, pt.Y, 14 + pulse * 10, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,107,139,${0.35 - pulse * 0.3})`;
        ctx.fill();
      }
      const size = (p.trip ? 20 : 15) * (isSel ? 1.25 : 1) * Math.min(1.3, 0.85 + zoom * 0.15);
      ctx.save();
      ctx.shadowColor = 'rgba(255,107,139,0.9)';
      ctx.shadowBlur = 10;
      heartPath(ctx, pt.X, pt.Y, size);
      ctx.fillStyle = p.trip ? '#ff6b8b' : '#ff9fb1';
      ctx.fill();
      ctx.restore();
      heartPath(ctx, pt.X, pt.Y, size);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      if (p.entries.length > 1) {
        ctx.font = '700 10px -apple-system, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(String(p.entries.length), pt.X, pt.Y + 1);
      }
      ctx.globalAlpha = 1;
      tapTargets.push({ p, x: pt.X, y: pt.Y });
    }
  }

  const autoRotating = () => !reduced && !selected && !fly && performance.now() - lastInteract > 3500 && document.visibilityState === 'visible';

  function frame(t) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    let changed = needsDraw;
    if (fly) {
      const k = Math.min(1, (t - fly.t0) / fly.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      rotation = [fly.from[0] + (fly.to[0] - fly.from[0]) * e, fly.from[1] + (fly.to[1] - fly.from[1]) * e, 0];
      zoom = fly.fromZoom + (fly.toZoom - fly.fromZoom) * e;
      if (k >= 1) fly = null;
      changed = true;
    } else if (Math.abs(vel[0]) + Math.abs(vel[1]) > 0.01 && !dragging) {
      rotation = [rotation[0] + vel[0], Math.max(-85, Math.min(85, rotation[1] + vel[1])), 0];
      vel = [vel[0] * 0.94, vel[1] * 0.94];
      changed = true;
    } else if (autoRotating()) {
      rotation = [rotation[0] + 0.12, rotation[1], 0];
      changed = true;
    }
    if (!changed && (selected || arcs.length) && !reduced && t - lastDraw > 45) changed = true; // Puls & Bogen-Animation (~22 fps)
    if (changed) { draw(t); needsDraw = false; lastDraw = t; }
    else if (!detailDrawn && detail) { draw(t); detailDrawn = true; }
  }
  let detailDrawn = false;
  let lastDraw = 0;

  function flyTo(lng, lat, toZoom = Math.max(zoom, 1.6)) {
    const from = [...rotation];
    let target = [-lng, -Math.max(-80, Math.min(80, lat))];
    let d = target[0] - from[0];
    d = ((d + 540) % 360) - 180;
    target[0] = from[0] + d;
    fly = { from, to: target, t0: performance.now(), dur: 1100, fromZoom: zoom, toZoom };
    lastInteract = performance.now();
    vel = [0, 0];
    detailDrawn = false;
  }

  function select(p) {
    selected = p;
    if (!p) { popup.classList.remove('show'); return; }
    const list = p.entries.slice(0, 2);
    popup.innerHTML = String(html`<div class="entry-list">${list.map((e) => entryCard(e))}${p.entries.length > 2 ? html`<div class="center faint" style="font-size:13px">+ ${p.entries.length - 2} weitere hier</div>` : ''}</div>`);
    hydrate(popup);
    popup.classList.add('show');
    flyTo(p.lng, p.lat);
  }

  // ---------- Gesten ----------
  const pointers = new Map();
  let dragging = false, start = null, pinch = null, lastMove = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastInteract = performance.now();
    fly = null;
    if (pointers.size === 1) {
      dragging = true;
      start = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
      lastMove = { x: e.clientX, y: e.clientY, t: performance.now() };
      vel = [0, 0];
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      start && (start.moved = true);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastInteract = performance.now();
    detailDrawn = false;
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      zoom = Math.max(0.8, Math.min(8, pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d));
      needsDraw = true;
      return;
    }
    if (!dragging || !lastMove) return;
    const dx = e.clientX - lastMove.x, dy = e.clientY - lastMove.y;
    if (Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) > 6) start.moved = true;
    const k = 0.32 / zoom;
    rotation = [rotation[0] + dx * k, Math.max(-85, Math.min(85, rotation[1] - dy * k)), 0];
    const dt = Math.max(1, performance.now() - lastMove.t);
    vel = [(dx * k) * (16 / dt), (-dy * k) * (16 / dt)];
    lastMove = { x: e.clientX, y: e.clientY, t: performance.now() };
    needsDraw = true;
  });
  const end = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size) return;
    dragging = false;
    if (lastMove && performance.now() - lastMove.t > 80) vel = [0, 0];
    if (start && !start.moved) {
      // Tippen: nächsten Marker suchen
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      let best = null, bd = 26;
      for (const tt of tapTargets) {
        const d = Math.hypot(tt.x - x, tt.y - y);
        if (d < bd) { bd = d; best = tt.p; }
      }
      select(best);
    }
    start = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom = Math.max(0.8, Math.min(8, zoom * Math.exp(-e.deltaY * 0.0015)));
    lastInteract = performance.now();
    needsDraw = true;
  }, { passive: false });

  const onClick = async (e) => {
    const t = e.target.closest('[data-act], [data-fly]');
    if (!t) return;
    if (t.dataset.act === 'zin') { fly = { from: [...rotation], to: [...rotation], t0: performance.now(), dur: 350, fromZoom: zoom, toZoom: Math.min(8, zoom * 1.6) }; }
    if (t.dataset.act === 'zout') { fly = { from: [...rotation], to: [...rotation], t0: performance.now(), dur: 350, fromZoom: zoom, toZoom: Math.max(0.8, zoom / 1.6) }; }
    if (t.dataset.act === 'home') { const h = settings().home; if (h) { select(null); flyTo(h.lng, h.lat, 1.8); } }
    if (t.dataset.fly) {
      const p = places.find((x) => x.key === t.dataset.fly);
      if (p) { document.getElementById('scroller').scrollTo({ top: 0, behavior: 'smooth' }); select(p); }
    }
    lastInteract = performance.now();
  };
  el.addEventListener('click', onClick);

  const ro = new ResizeObserver(() => resize());
  ro.observe(wrap);
  resize();

  const unsub = subscribe(() => {
    computeData();
    if (selected) {
      const again = places.find((p) => p.key === selected.key);
      if (again) { selected = again; select(again); } else select(null);
    }
  });

  loadLibs().then((g) => {
    if (destroyed) return;
    geo = g;
    computeData();
    raf = requestAnimationFrame(frame);
    const focus = query?.focus ? get(query.focus) : null;
    if (focus?.data.place?.lat != null) {
      const p = places.find((x) => x.entries.some((e) => e.id === focus.id));
      if (p) setTimeout(() => select(p), 300);
    } else if (!settings().home && places.length) {
      const last = sortByDateDesc(places.map((p) => p.entries[0]))[0];
      if (last) rotation = [-last.data.place.lng, -Math.max(-60, Math.min(60, last.data.place.lat)), 0];
    }
    loadDetail().then((d) => {
      if (destroyed || !d) return;
      detail = d;
      containCache.forEach((v, k) => { if (v == null) containCache.delete(k); });
      computeData();
      detailDrawn = false;
    });
  }).catch((err) => {
    wrap.innerHTML = String(html`<div class="empty"><span class="em">🌍</span><h3>Globus nicht verfügbar</h3><p>${err.message}</p></div>`);
  });

  return () => {
    destroyed = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    unsub();
    el.removeEventListener('click', onClick);
  };
}

