// Detailansicht eines Erlebnisses.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { get, remove, update, nameOf, me } from '../store.js';
import { EXTRA_FIELDS, fmtDateLong, fmtRange, fmtMoney, catOf, giftLine, fmtDate } from '../model.js';
import { ratingPair, emptyState, mountHeartInput } from '../ui/components.js';
import { photosOf, deletePhotos } from '../photos.js';
import { placeLabel, flag } from '../geo.js';
import { openSheet, toast, actionSheet, confirmDialog } from '../ui/sheet.js';
import { heartBurst } from '../ui/fx.js';
import { back, go } from '../router.js';

export async function deleteEntry(id) {
  const e = get(id);
  if (!e) return;
  await deletePhotos(photosOf(e));
  await remove(id);
  toast('Erinnerung gelöscht', { emoji: '🗑️' });
  back('/entries');
}

function factValue(f, v) {
  if (v == null || v === '' || v === false) return null;
  switch (f.type) {
    case 'money': return fmtMoney(v);
    case 'price': return '€'.repeat(+v);
    case 'yesno': return { yes: '👍 Unbedingt', maybe: '🤔 Vielleicht', no: '👎 Eher nicht' }[v];
    case 'partner': return `${nameOf(v)} → ${nameOf(v === 'a' ? 'b' : 'a')}`;
    case 'toggle': return v ? 'Ja ♡' : null;
    default: return v;
  }
}

export function openRatingSheet(entry, slot) {
  const r = entry.data.ratings?.[slot] || {};
  let val = r.value ?? null;
  const sheet = openSheet({
    title: `Bewertung von ${nameOf(slot)}`,
    left: html`<button class="text-btn" data-act="cancel">Abbrechen</button>`,
    right: html`<button class="text-btn strong" data-act="save">Sichern</button>`,
    body: html`
      <div class="form">
        <div class="center" style="font-family:var(--font-serif);font-size:21px;margin-top:4px">${entry.data.title}</div>
        <div style="display:flex;justify-content:center"><div id="rh"></div></div>
        <div class="group"><div class="cell col"><textarea id="rc" rows="3" placeholder="Was hat dir gefallen?">${r.comment || ''}</textarea></div></div>
      </div>`,
  });
  mountHeartInput(sheet.body.querySelector('#rh'), { value: val, onChange: (v) => (val = v) });
  sheet.el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    if (t.dataset.act === 'cancel') return sheet.close();
    const ratings = { ...(entry.data.ratings || {}) };
    ratings[slot] = { value: val, comment: sheet.body.querySelector('#rc').value.trim() };
    await update(entry.id, { ratings });
    const b = t.getBoundingClientRect();
    if (val >= 4.5) heartBurst(b.left + b.width / 2, b.top + b.height / 2, 14);
    sheet.close();
  });
}

export function render(el, { id }) {
  const entry = get(id);
  if (!entry) {
    el.innerHTML = String(html`<div class="page" style="padding-top:calc(var(--safe-t) + 20px)"><button class="back-btn" data-act="back">${icon('back')}Zurück</button>${emptyState({ emoji: '🕊️', title: 'Nicht gefunden', text: 'Diese Erinnerung wurde gelöscht.' })}</div>`);
    return;
  }
  const d = entry.data;
  const c = catOf(entry);
  const photos = photosOf(entry);
  const cover = d.coverId && photos.includes(d.coverId) ? d.coverId : photos[0];
  const ordered = cover ? [cover, ...photos.filter((p) => p !== cover)] : photos;
  const facts = (EXTRA_FIELDS[d.category] || []).map((f) => ({ f, v: factValue(f, d.extra?.[f.key]) })).filter((x) => x.v != null && x.f.type !== 'textarea');
  const longTexts = (EXTRA_FIELDS[d.category] || []).filter((f) => f.type === 'textarea' && d.extra?.[f.key]);
  const myMissing = !d.ratings?.[me()]?.value;

  el.innerHTML = String(html`
    <header class="topbar overlay" data-threshold="${ordered.length ? 300 : 120}">
      <div class="topbar-left"><button class="back-btn" data-act="back" data-fallback="/entries">${icon('back')}</button></div>
      <div class="topbar-title">${d.title}</div>
      <div class="topbar-right"><button class="icon-btn" data-act="edit" aria-label="Bearbeiten">${icon('edit')}</button></div>
    </header>
    <div class="page">
      <div class="detail-hero ${ordered.length ? '' : 'no-photo'}">
        <div class="detail-float-bar">
          <button class="icon-btn" data-act="back" data-fallback="/entries" aria-label="Zurück">${icon('back')}</button>
          <div class="row" style="gap:8px">
            <button class="icon-btn" data-act="more" aria-label="Mehr">${icon('more')}</button>
            <button class="icon-btn" data-act="edit" aria-label="Bearbeiten">${icon('edit')}</button>
          </div>
        </div>
        ${ordered.length ? html`
          <div class="slides">${ordered.map((pid, i) => html`<div class="slide" data-slide="${i}"><div class="ph-wrap" style="width:100%;height:100%"><img data-photo="${pid}" data-size="full" alt=""></div></div>`)}</div>
          <div class="shade"></div>
          ${ordered.length > 1 ? html`<div class="dots">${ordered.map((_, i) => html`<span class="${i === 0 ? 'on' : ''}"></span>`)}</div>` : ''}
        ` : html`<div class="big-em">${c.emoji}</div>`}
      </div>

      <div class="detail-head">
        <div class="row" style="gap:8px;margin-bottom:8px">
          <span class="chip static active">${c.emoji} ${c.label}</span>
          ${d.favorite ? html`<span class="chip static" style="color:var(--champ)">${icon('starFill')} Lieblingsmoment</span>` : ''}
        </div>
        <h1>${d.title}</h1>
        <div class="detail-meta">
          <span>${icon('calendar')} ${d.category === 'trip' && d.endDate ? fmtRange(d.date, d.endDate) : fmtDateLong(d.date)}</span>
          ${d.place ? (d.place.lat != null
            ? html`<a href="#/globe?focus=${entry.id}">${d.place.countryCode ? flag(d.place.countryCode) : icon('pin')} ${placeLabel(d.place)}</a>`
            : html`<span>${icon('pin')} ${d.place.name}</span>`) : ''}
          ${d.category === 'gift' && giftLine(entry) ? html`<span>${icon('gift')} ${giftLine(entry)}</span>` : ''}
        </div>
      </div>

      <div class="section">
        <div class="section-head"><h2 class="section-title small">Unsere Bewertung</h2></div>
        <div data-act="rate-area">${ratingPair(entry)}</div>
        ${myMissing ? html`<button class="btn primary block" data-act="rate" data-slot="${me()}" style="margin-top:12px">${icon('heartFill')} Jetzt bewerten</button>` : ''}
      </div>

      ${facts.length ? html`
        <div class="section">
          <div class="facts">${facts.map(({ f, v }) => html`<div class="fact"><div class="k">${f.label}</div><div class="v">${v}</div></div>`)}</div>
        </div>` : ''}

      ${longTexts.map((f) => html`<div class="section"><div class="section-head"><h2 class="section-title small">${f.label}</h2></div><div class="card notes">${d.extra[f.key]}</div></div>`)}

      ${d.notes ? html`
        <div class="section">
          <div class="section-head"><h2 class="section-title small">Notizen</h2></div>
          <div class="card notes">${d.notes}</div>
        </div>` : ''}

      <p class="faint center" style="font-size:12.5px;margin-top:28px">Hinzugefügt von ${nameOf(entry.createdBy || 'a')} · ${fmtDate(entry.createdAt)}</p>
    </div>`);

  // Karussell-Punkte
  const slides = el.querySelector('.slides');
  if (slides) {
    const dots = el.querySelectorAll('.dots span');
    slides.addEventListener('scroll', () => {
      const i = Math.round(slides.scrollLeft / slides.clientWidth);
      dots.forEach((dd, k) => dd.classList.toggle('on', k === i));
    }, { passive: true });
  }

  const onClick = async (e) => {
    const t = e.target.closest('[data-act], [data-slide], .rating-box');
    if (!t) return;
    if (t.dataset.slide != null) {
      const { openViewer } = await import('./photo-viewer.js');
      openViewer(ordered, +t.dataset.slide);
      return;
    }
    if (t.classList.contains('rating-box')) {
      const boxes = [...el.querySelectorAll('.rating-box')];
      openRatingSheet(entry, boxes.indexOf(t) === 0 ? 'a' : 'b');
      return;
    }
    switch (t.dataset.act) {
      case 'edit': {
        const { openEntryForm } = await import('./entry-form.js');
        openEntryForm({ id: entry.id });
        break;
      }
      case 'rate': openRatingSheet(entry, t.dataset.slot); break;
      case 'more': {
        const v = await actionSheet({
          items: [
            { label: d.favorite ? 'Kein Lieblingsmoment mehr' : 'Als Lieblingsmoment markieren', icon: 'star', value: 'fav' },
            ...(d.place?.lat != null ? [{ label: 'Auf dem Globus zeigen', icon: 'globe', value: 'globe' }] : []),
            { label: 'Löschen', icon: 'trash', value: 'delete', danger: true },
          ],
        });
        if (v === 'fav') await update(entry.id, { favorite: !d.favorite });
        if (v === 'globe') go(`/globe?focus=${entry.id}`);
        if (v === 'delete') {
          const ok = await confirmDialog({ title: 'Erinnerung löschen?', message: 'Auch die zugehörigen Fotos werden gelöscht.', ok: 'Löschen', danger: true });
          if (ok) deleteEntry(entry.id);
        }
        break;
      }
    }
  };
  el.addEventListener('click', onClick);
  return () => el.removeEventListener('click', onClick);
}

