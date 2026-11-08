// Wiederverwendbare UI-Bausteine.
import { html, raw } from './dom.js';
import { icon, iconStr } from './icons.js';
import { CATEGORIES, avgRating, ratingValue, fmtRating, fmtDate, fmtRange, catOf, giftLine } from '../model.js';
import { coverOf } from '../photos.js';
import { shortPlace } from '../geo.js';
import { nameOf } from '../store.js';
import { heartBurst } from './fx.js';

/** Herzen-Anzeige (0–5, halbe Schritte). */
export function hearts(value, { lg = false } = {}) {
  const v = value || 0;
  const parts = [];
  for (let i = 1; i <= 5; i++) {
    if (v >= i) parts.push(iconStr('heartFill'));
    else if (v >= i - 0.5) parts.push(iconStr('heartHalf'));
    else parts.push(`<span class="h-empty">${iconStr('heartFill')}</span>`);
  }
  return raw(`<span class="hearts ${lg ? 'lg' : ''}" aria-label="${fmtRating(value)} von 5 Herzen">${parts.join('')}</span>`);
}

/** Interaktive Herz-Bewertung. Tippen/Wischen; linke Herzhälfte = halbes Herz. */
export function mountHeartInput(host, { value = null, onChange } = {}) {
  let val = value;
  host.classList.add('heart-input');
  host.innerHTML = [1, 2, 3, 4, 5].map((i) => `<span class="h" data-i="${i}"></span>`).join('') + '<span class="val"></span><button type="button" class="clear">Leeren</button>';
  const hs = [...host.querySelectorAll('.h')];
  const valEl = host.querySelector('.val');
  const clearBtn = host.querySelector('.clear');

  function paint() {
    hs.forEach((h, idx) => {
      const i = idx + 1;
      const v = val || 0;
      h.classList.toggle('on', v >= i - 0.5);
      h.innerHTML = v >= i ? iconStr('heartFill') : v >= i - 0.5 ? iconStr('heartHalf') : iconStr('heartFill');
      if (v < i - 0.5) h.classList.remove('on');
    });
    valEl.textContent = val ? fmtRating(val) : '';
    clearBtn.style.visibility = val ? 'visible' : 'hidden';
  }

  function valueAt(clientX) {
    for (let idx = 0; idx < hs.length; idx++) {
      const r = hs[idx].getBoundingClientRect();
      if (clientX <= r.right || idx === hs.length - 1) {
        if (clientX < r.left && idx === 0) return 0.5;
        const half = clientX < r.left + r.width / 2;
        return idx + (half ? 0.5 : 1);
      }
    }
    return 5;
  }

  let dragging = false;
  const set = (v, fromUser) => {
    const prev = val;
    val = Math.max(0.5, Math.min(5, v));
    paint();
    if (fromUser && prev !== val) {
      const h = hs[Math.ceil(val) - 1];
      h.classList.add('pop');
      setTimeout(() => h.classList.remove('pop'), 180);
      onChange && onChange(val);
    }
  };
  host.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.clear')) return;
    dragging = true;
    host.setPointerCapture?.(e.pointerId);
    set(valueAt(e.clientX), true);
  });
  host.addEventListener('pointermove', (e) => { if (dragging) set(valueAt(e.clientX), true); });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    if (val === 5) {
      const r = hs[4].getBoundingClientRect();
      heartBurst(r.left + r.width / 2, r.top + r.height / 2, 12);
    }
  };
  host.addEventListener('pointerup', end);
  host.addEventListener('pointercancel', end);
  clearBtn.addEventListener('click', () => { val = null; paint(); onChange && onChange(null); });
  paint();
  return { get: () => val, set: (v) => { val = v; paint(); } };
}

export function photoImg(id, { size = 'thumb', cls = '', alt = '' } = {}) {
  return html`<div class="ph-wrap ${cls}"><img data-photo="${id}" data-size="${size}" alt="${alt}"></div>`;
}

export function thumb(entry, emoji) {
  const cover = coverOf(entry);
  return cover
    ? html`<img data-photo="${cover}" data-size="thumb" alt="">`
    : html`<span>${emoji || catOf(entry).emoji}</span>`;
}

/** Listen-Karte für ein Erlebnis. */
export function entryCard(entry) {
  const c = catOf(entry);
  const d = entry.data;
  const avg = avgRating(entry);
  const meta = [d.category === 'trip' ? fmtRange(d.date, d.endDate) : fmtDate(d.date)];
  if (d.category === 'gift') { const g = giftLine(entry); if (g) meta.push(g); }
  else if (d.place) meta.push(shortPlace(d.place));
  return html`
    <a class="entry-card card-link" href="#/entry/${entry.id}">
      <div class="entry-thumb">${thumb(entry)}</div>
      <div class="entry-body">
        <div class="entry-title">${d.favorite ? html`<span class="fav-dot">${icon('starFill')}</span> ` : ''}${d.title || c.label}</div>
        <div class="entry-meta">${c.emoji} ${meta.filter(Boolean).join(' · ')}</div>
        <div class="entry-rating">${hearts(avg)}${avg != null ? html`<span class="rating-num">${fmtRating(avg)}</span>` : html`<span class="faint">noch nicht bewertet</span>`}</div>
      </div>
    </a>`;
}

/** Große Foto-Karte (horizontale Listen). */
export function entryHero(entry, { width = 260 } = {}) {
  const c = catOf(entry);
  const d = entry.data;
  const cover = coverOf(entry);
  const avg = avgRating(entry);
  return html`
    <a class="entry-hero-card card-link" href="#/entry/${entry.id}" style="width:${width}px">
      ${cover ? html`<img data-photo="${cover}" data-size="thumb" alt="">` : html`<div class="emoji-bg">${c.emoji}</div>`}
      <div class="shade"></div>
      <div class="info">
        <div class="faint" style="font-size:12.5px;color:rgba(255,255,255,.75)">${c.emoji} ${fmtDate(d.date)}</div>
        <h3>${d.title || c.label}</h3>
        ${avg != null ? html`<div style="margin-top:4px">${hearts(avg)}</div>` : ''}
      </div>
    </a>`;
}

export function emptyState({ emoji = '💞', title, text = '', action = '' }) {
  return html`<div class="empty"><span class="em">${emoji}</span><h3>${title}</h3>${text ? html`<p>${text}</p>` : ''}${action}</div>`;
}

/** Kopfzeile mit iOS-Verhalten. */
export function topbar({ title = '', back = false, backLabel = 'Zurück', left = '', right = '', alwaysTitle = false, solid = false } = {}) {
  return html`
    <header class="topbar ${alwaysTitle ? 'always-title' : ''} ${solid ? 'solid' : ''}">
      <div class="topbar-left">${back ? html`<button class="back-btn" data-act="back">${icon('back')}<span>${backLabel}</span></button>` : left}</div>
      <div class="topbar-title">${title}</div>
      <div class="topbar-right">${right}</div>
    </header>`;
}

export function ratingPair(entry) {
  const block = (slot) => {
    const v = ratingValue(entry, slot);
    const c = entry.data.ratings?.[slot]?.comment;
    return html`<div class="rating-box"><div class="who">${nameOf(slot)}</div>${hearts(v)}<div class="rating-num" style="margin-top:6px">${v != null ? fmtRating(v) : html`<span class="faint">offen</span>`}</div>${c ? html`<div class="comment">„${c}“</div>` : ''}</div>`;
  };
  const avg = avgRating(entry);
  return html`
    <div class="rating-pair">${block('a')}${block('b')}</div>
    ${avg != null ? html`<div class="rating-avg">Zusammen ${hearts(avg)} <strong>${fmtRating(avg)}</strong></div>` : ''}`;
}

export const categoryChips = (active, counts = {}) => html`
  <div class="chips">
    ${Object.values(CATEGORIES).map((c) => html`<button class="chip ${active === c.key ? 'active' : ''}" data-cat="${c.key}">${c.emoji} ${c.plural}${counts[c.key] != null ? html` <span class="count">${counts[c.key]}</span>` : ''}</button>`)}
  </div>`;
