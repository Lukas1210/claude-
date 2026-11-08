// Vollbild-Fotoansicht: wischen, zoomen (Pinch & Doppeltippen), nach unten wischen zum Schließen.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { get, update } from '../store.js';
import { photoUrl, sharePhoto, deletePhotos } from '../photos.js';
import { fmtDateLong, catOf } from '../model.js';
import { actionSheet, confirmDialog, toast, openSheet } from '../ui/sheet.js';
import { go } from '../router.js';

export function openViewer(ids, startIndex = 0) {
  ids = ids.filter((id) => get(id));
  if (!ids.length) return;
  let index = Math.max(0, Math.min(startIndex, ids.length - 1));
  const v = document.createElement('div');
  v.className = 'viewer';
  v.innerHTML = String(html`
    <div class="v-top">
      <button class="icon-btn" data-act="close" aria-label="Schließen">${icon('close')}</button>
      <span class="v-counter"></span>
      <button class="icon-btn" data-act="more" aria-label="Mehr">${icon('more')}</button>
    </div>
    <div class="v-track">${ids.map((id, i) => html`<div class="v-slide" data-i="${i}"><img alt="" draggable="false"></div>`)}</div>
    <div class="v-bottom">
      <div class="v-caption"></div>
      <div class="v-date"></div>
      <div class="v-actions">
        <button data-act="fav">${icon('heartFill')}<span>Favorit</span></button>
        <button data-act="share">${icon('share')}<span>Sichern</span></button>
        <button data-act="caption">${icon('edit')}<span>Text</span></button>
        <button data-act="entry">${icon('sparkles')}<span>Erlebnis</span></button>
      </div>
    </div>`);
  document.body.appendChild(v);
  requestAnimationFrame(() => v.classList.add('show'));

  const track = v.querySelector('.v-track');
  const slides = [...v.querySelectorAll('.v-slide')];
  const W = () => window.innerWidth;
  let zoom = 1, panX = 0, panY = 0;

  function loadAround() {
    for (let i = Math.max(0, index - 1); i <= Math.min(ids.length - 1, index + 1); i++) {
      const img = slides[i].querySelector('img');
      if (img.dataset.loaded) continue;
      img.dataset.loaded = '1';
      photoUrl(ids[i], 'thumb').then((u) => { if (u && !img.dataset.full) img.src = u; });
      photoUrl(ids[i], 'full').then((u) => { if (u) { img.dataset.full = '1'; img.src = u; } });
    }
  }

  function curImg() { return slides[index].querySelector('img'); }
  function applyZoom(animate = false) {
    const img = curImg();
    img.style.transition = animate ? 'transform .25s ease' : 'none';
    img.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  }
  function resetZoom(animate = true) { zoom = 1; panX = panY = 0; applyZoom(animate); }

  function setTrack(dx = 0, animate = true) {
    track.style.transition = animate ? 'transform .32s cubic-bezier(.2,.8,.2,1)' : 'none';
    track.style.transform = `translateX(${-index * W() + dx}px)`;
  }

  function updateInfo() {
    const p = get(ids[index]);
    v.querySelector('.v-counter').textContent = ids.length > 1 ? `${index + 1} / ${ids.length}` : '';
    const entry = p?.data.entryId ? get(p.data.entryId) : null;
    v.querySelector('.v-caption').textContent = p?.data.caption || entry?.data.title || '';
    v.querySelector('.v-date').textContent = p?.data.takenAt ? fmtDateLong(p.data.takenAt) : '';
    v.querySelector('[data-act="fav"]').classList.toggle('on', !!p?.data.favorite);
    const eb = v.querySelector('[data-act="entry"]');
    eb.style.display = entry ? '' : 'none';
    if (entry) eb.querySelector('span').textContent = catOf(entry).label;
  }

  function goTo(i) {
    if (i !== index) { slides[index].querySelector('img').style.transform = ''; zoom = 1; panX = panY = 0; }
    index = Math.max(0, Math.min(ids.length - 1, i));
    setTrack(0, true);
    loadAround();
    updateInfo();
  }

  function close() {
    v.classList.remove('show');
    window.removeEventListener('resize', onResize);
    setTimeout(() => v.remove(), 250);
  }

  // ---------- Gesten ----------
  const pointers = new Map();
  let start = null, mode = null, pinchStart = null, lastTap = 0;

  track.addEventListener('pointerdown', (e) => {
    track.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      start = { x: e.clientX, y: e.clientY, t: performance.now(), panX, panY };
      mode = null;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      mode = 'pinch';
    }
  });
  track.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mode === 'pinch' && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      zoom = Math.max(1, Math.min(4, pinchStart.zoom * (dist / pinchStart.dist)));
      applyZoom();
      return;
    }
    if (!start || pointers.size !== 1) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!mode) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      mode = zoom > 1 ? 'pan' : Math.abs(dx) > Math.abs(dy) ? 'swipe' : dy > 0 ? 'dismiss' : 'none';
    }
    if (mode === 'swipe') {
      const edge = (index === 0 && dx > 0) || (index === ids.length - 1 && dx < 0);
      setTrack(edge ? dx / 3 : dx, false);
    } else if (mode === 'dismiss') {
      track.style.transition = 'none';
      track.style.transform = `translate(${-index * W()}px, ${dy}px) scale(${1 - Math.min(dy, 400) / 1600})`;
      v.style.background = `rgba(0,0,0,${1 - Math.min(dy, 300) / 400})`;
    } else if (mode === 'pan') {
      panX = start.panX + dx; panY = start.panY + dy;
      applyZoom();
    }
  });
  const end = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (mode === 'pinch') {
      if (pointers.size === 0) { mode = null; if (zoom <= 1.05) resetZoom(); }
      else { const [p] = [...pointers.values()]; start = { x: p.x, y: p.y, t: performance.now(), panX, panY }; mode = 'pan'; }
      return;
    }
    if (pointers.size) return;
    const dx = e.clientX - (start?.x ?? e.clientX), dy = e.clientY - (start?.y ?? e.clientY);
    const dt = performance.now() - (start?.t ?? 0);
    if (mode === 'swipe') {
      const vel = Math.abs(dx) / Math.max(dt, 1);
      if ((dx < -W() / 4 || (dx < -30 && vel > 0.4)) && index < ids.length - 1) goTo(index + 1);
      else if ((dx > W() / 4 || (dx > 30 && vel > 0.4)) && index > 0) goTo(index - 1);
      else setTrack(0, true);
    } else if (mode === 'dismiss') {
      if (dy > 120) close();
      else { v.style.background = ''; setTrack(0, true); }
    } else if (!mode) {
      const now = performance.now();
      if (now - lastTap < 280) {
        if (zoom > 1) resetZoom();
        else {
          zoom = 2.5;
          const r = curImg().getBoundingClientRect();
          panX = (r.left + r.width / 2 - e.clientX) * 1.5;
          panY = (r.top + r.height / 2 - e.clientY) * 1.5;
          applyZoom(true);
        }
        lastTap = 0;
      } else {
        lastTap = now;
        setTimeout(() => { if (lastTap === now) v.classList.toggle('chrome-off'); }, 290);
      }
    }
    mode = null;
    start = null;
  };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);

  const onResize = () => setTrack(0, false);
  window.addEventListener('resize', onResize);

  // ---------- Aktionen ----------
  v.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const id = ids[index];
    const p = get(id);
    switch (t.dataset.act) {
      case 'close': close(); break;
      case 'fav':
        await update(id, { favorite: !p.data.favorite });
        updateInfo();
        break;
      case 'share': {
        const ok = await sharePhoto(id);
        if (!ok) toast('Foto nicht verfügbar', { emoji: '📷' });
        break;
      }
      case 'caption': {
        const s = openSheet({
          title: 'Bildunterschrift',
          left: html`<button class="text-btn" data-c="cancel">Abbrechen</button>`,
          right: html`<button class="text-btn strong" data-c="save">Sichern</button>`,
          body: html`<div class="group"><div class="cell col"><textarea id="cap" rows="3" placeholder="Was passiert auf dem Foto?">${p.data.caption || ''}</textarea></div></div>`,
        });
        s.el.style.zIndex = 400;
        s.el.addEventListener('click', async (ev) => {
          const b = ev.target.closest('[data-c]');
          if (!b) return;
          if (b.dataset.c === 'save') { await update(id, { caption: s.body.querySelector('#cap').value.trim() }); updateInfo(); }
          s.close();
        });
        break;
      }
      case 'entry':
        if (p.data.entryId) { close(); go(`/entry/${p.data.entryId}`); }
        break;
      case 'more': {
        const val = await actionSheet({ items: [{ label: 'Foto löschen', icon: 'trash', value: 'delete', danger: true }] });
        if (val === 'delete') {
          const ok = await confirmDialog({ title: 'Foto löschen?', message: 'Das Foto wird auf beiden Handys entfernt.', ok: 'Löschen', danger: true });
          if (!ok) return;
          if (p.data.entryId) {
            const en = get(p.data.entryId);
            if (en) await update(en.id, { photoIds: (en.data.photoIds || []).filter((x) => x !== id), coverId: en.data.coverId === id ? null : en.data.coverId });
          }
          await deletePhotos([id]);
          ids.splice(index, 1);
          slides[index].remove();
          slides.splice(index, 1);
          if (!ids.length) { close(); return; }
          goTo(Math.min(index, ids.length - 1));
        }
        break;
      }
    }
  });

  // Sheets über dem Viewer anzeigen
  const obs = new MutationObserver(() => {
    document.querySelectorAll('.sheet, .backdrop').forEach((n) => { if (+n.style.zIndex < 160) n.style.zIndex = 160 + (+n.style.zIndex % 100); });
  });
  obs.observe(document.body, { childList: true });
  const origRemove = v.remove.bind(v);
  v.remove = () => { obs.disconnect(); origRemove(); };

  setTrack(0, false);
  loadAround();
  updateInfo();
}
