// Formular zum Anlegen/Bearbeiten eines Erlebnisses (Date, Aktivität, Essen, Reise, Geschenk).
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openSheet, confirmDialog, toast, actionSheet } from '../ui/sheet.js';
import { mountHeartInput } from '../ui/components.js';
import { heartBurst } from '../ui/fx.js';
import { pickPlace } from '../ui/place-picker.js';
import { CATEGORIES, EXTRA_FIELDS, today } from '../model.js';
import { get, save, update, uuid, me, partner, nameOf } from '../store.js';
import { processFiles, commitPhotos, discardPending, deletePhotos, photoUrl } from '../photos.js';
import { reversePlace, flag } from '../geo.js';
import { go } from '../router.js';

const TITLE_HINT = {
  date: 'Was habt ihr gemacht?',
  activity: 'Was habt ihr erlebt?',
  food: 'Restaurant oder Gericht',
  trip: 'Wohin ging die Reise?',
  gift: 'Was war das Geschenk?',
  recipe: 'Welches Gericht habt ihr gekocht?',
};

export function openEntryForm({ category = 'date', id = null, prefill = {}, wishId = null, onSaved = null } = {}) {
  const existing = id ? get(id) : null;
  const d = existing ? structuredClone(existing.data) : {};
  const st = {
    id: existing?.id || uuid(),
    category: d.category || category,
    title: d.title ?? prefill.title ?? '',
    date: d.date || prefill.date || today(),
    endDate: d.endDate || '',
    place: d.place || prefill.place || null,
    ratings: d.ratings || { a: { value: null, comment: '' }, b: { value: null, comment: '' } },
    notes: d.notes ?? prefill.notes ?? '',
    favorite: !!d.favorite,
    extra: d.extra || {},
    photoIds: (d.photoIds || []).filter((pid) => get(pid)),
    coverId: d.coverId || null,
  };
  if (st.category === 'gift' && !st.extra.from) st.extra.from = me();
  if (!existing && st.category === 'recipe' && prefill.notes && !st.extra.tips) st.extra.tips = prefill.notes;
  if (!existing && st.category === 'recipe' && !st.extra.cook) st.extra.cook = 'both';
  const removedPhotos = [];
  let pending = [];
  let dateTouched = !!existing;
  let dirty = false;
  let saved = false;

  const sheet = openSheet({
    title: existing ? 'Bearbeiten' : 'Neue Erinnerung',
    full: true,
    left: html`<button class="text-btn" data-act="cancel">Abbrechen</button>`,
    right: html`<button class="text-btn strong" data-act="save">Sichern</button>`,
    body: '',
    beforeClose: async () => {
      if (saved || (!dirty && !pending.length)) return true;
      const ok = await confirmDialog({ title: 'Änderungen verwerfen?', message: 'Deine Eingaben gehen verloren.', ok: 'Verwerfen', danger: true });
      return ok;
    },
    onClose: () => { if (!saved && pending.length) discardPending(pending); },
  });
  const body = sheet.body;

  // ---------- Felder ----------
  const extraField = (f) => {
    const v = st.extra[f.key];
    const opt = (val, label) => html`<button type="button" class="opt ${v === val ? 'active' : ''}" data-x="${f.key}" data-v="${val}">${label}</button>`;
    switch (f.type) {
      case 'text':
        return html`<div class="cell"><label>${f.label}</label><input data-xi="${f.key}" placeholder="${f.placeholder || ''}" value="${v || ''}"></div>`;
      case 'textarea':
        return html`<div class="cell col"><textarea data-xi="${f.key}" rows="${f.rows || 3}" placeholder="${f.placeholder || ''}">${v || ''}</textarea></div>`;
      case 'number':
        return html`<div class="cell"><label>${f.label}</label><input data-xi="${f.key}" inputmode="numeric" pattern="[0-9]*" placeholder="${f.placeholder || ''}" value="${v ?? ''}" style="text-align:right"><span class="muted">${f.unit || ''}</span></div>`;
      case 'who':
        return html`<div class="cell col"><label>${f.label}</label><div class="opt-row">${opt('a', nameOf('a'))}${opt('b', nameOf('b'))}${opt('both', '👫 Zusammen')}</div></div>`;
      case 'money':
        return html`<div class="cell"><label>${f.label}</label><input data-xi="${f.key}" inputmode="decimal" placeholder="0" value="${v ?? ''}" style="text-align:right"><span class="muted">€</span></div>`;
      case 'select':
        return html`<div class="cell col"><label>${f.label}</label><div class="opt-row">${f.options.map((o) => opt(o, o))}</div></div>`;
      case 'price':
        return html`<div class="cell col"><label>${f.label}</label><div class="opt-row">${[1, 2, 3, 4].map((n) => opt(String(n), '€'.repeat(n)))}</div></div>`;
      case 'yesno':
        return html`<div class="cell col"><label>${f.label}</label><div class="opt-row">${opt('yes', '👍 Unbedingt')}${opt('maybe', '🤔 Vielleicht')}${opt('no', '👎 Eher nicht')}</div></div>`;
      case 'partner':
        return html`<div class="cell col"><label>${f.label}</label><div class="opt-row">${opt('a', `${nameOf('a')} → ${nameOf('b')}`)}${opt('b', `${nameOf('b')} → ${nameOf('a')}`)}</div></div>`;
      case 'toggle':
        return html`<div class="cell"><label>${f.label}</label><span class="toggle"><input type="checkbox" data-xt="${f.key}" ${v ? 'checked' : ''}><span></span></span></div>`;
      default: return '';
    }
  };

  function renderPhotos() {
    const strip = body.querySelector('#photos');
    const ids = [...st.photoIds, ...pending.map((p) => p.id)];
    const cover = st.coverId && ids.includes(st.coverId) ? st.coverId : ids[0];
    strip.innerHTML = String(html`
      <button type="button" class="photo-add" data-act="add-photo" aria-label="Fotos hinzufügen">${icon('camera')}</button>
      ${ids.map((pid) => html`<div class="photo-slot" data-pid="${pid}"><img data-pimg="${pid}" alt=""><button type="button" class="rm" data-rm="${pid}" aria-label="Entfernen">${icon('close')}</button>${pid === cover && ids.length > 1 ? html`<span class="cover-tag">Titelbild</span>` : ''}</div>`)}`);
    strip.querySelectorAll('img[data-pimg]').forEach(async (img) => {
      const u = await photoUrl(img.dataset.pimg, 'thumb');
      if (u) img.src = u;
    });
  }

  function renderPlace() {
    const cell = body.querySelector('#place-cell');
    if (!cell) return;
    cell.innerHTML = String(st.place
      ? html`<span class="cell-icon">${st.place.countryCode ? flag(st.place.countryCode) : icon('pin')}</span><span class="grow"><span>${st.place.name}</span>${st.place.label ? html`<small class="faint" style="display:block;font-size:13px">${st.place.label}</small>` : ''}</span><span class="chev">${icon('chevron')}</span>`
      : html`<span class="cell-icon">${icon('pin')}</span><span class="grow muted">Ort hinzufügen</span><span class="chev">${icon('chevron')}</span>`);
  }

  function ratingBlock(slot) {
    const r = st.ratings[slot] || {};
    return html`
      <div class="cell col">
        <label style="font-weight:600;font-size:15px;color:var(--text)">${nameOf(slot)}${slot === me() ? ' (du)' : ''}</label>
        <div data-hearts="${slot}"></div>
        <input data-comment="${slot}" placeholder="Kommentar (optional)" value="${r.comment || ''}" style="font-size:15px">
      </div>`;
  }

  function render() {
    const cat = CATEGORIES[st.category];
    const fields = EXTRA_FIELDS[st.category] || [];
    const shortFields = fields.filter((f) => f.type !== 'textarea');
    const longFields = fields.filter((f) => f.type === 'textarea');
    body.innerHTML = String(html`
      <div class="form">
        ${!existing ? html`<div class="chips" style="margin-top:-4px">${Object.values(CATEGORIES).map((c) => html`<button type="button" class="chip ${st.category === c.key ? 'active' : ''}" data-cat="${c.key}">${c.emoji} ${c.label}</button>`)}</div>` : ''}

        <div>
          <div class="photo-strip" id="photos"></div>
          <div id="photo-progress" class="faint" style="font-size:13px;margin-top:4px"></div>
        </div>

        <input class="title-input" id="title" placeholder="${TITLE_HINT[st.category]}" value="${st.title}" maxlength="120" enterkeyhint="done">

        <div>
          <div class="group">
            <div class="cell"><label>${st.category === 'trip' ? 'Von' : st.category === 'recipe' ? 'Gekocht am' : 'Datum'}</label><input type="date" id="date" value="${st.date}"></div>
            ${st.category === 'trip' ? html`<div class="cell"><label>Bis</label><input type="date" id="endDate" value="${st.endDate}" min="${st.date}"></div>` : ''}
            ${st.category !== 'recipe' ? html`<button type="button" class="cell link" id="place-cell" data-act="place" style="width:100%;text-align:left"></button>` : ''}
          </div>
        </div>

        <div>
          <div class="group-label">Bewertung</div>
          <div class="group">${ratingBlock(me())}${ratingBlock(partner())}</div>
          <div class="group-foot">Tippe oder wische über die Herzen – die linke Hälfte gibt ein halbes Herz.</div>
        </div>

        ${shortFields.length ? html`
          <div>
            <div class="group-label">${cat.label}</div>
            <div class="group">${shortFields.map(extraField)}</div>
          </div>` : ''}

        ${longFields.map((f) => html`
          <div>
            <div class="group-label">${f.label}</div>
            <div class="group">${extraField(f)}</div>
            ${f.key === 'ingredients' ? html`<div class="group-foot">Mengen am Zeilenanfang (z. B. „200 g“, „1/2 TL“) rechnet die App später auf andere Portionen um.</div>` : ''}
          </div>`)}

        ${st.category !== 'recipe' ? html`
        <div>
          <div class="group-label">Notizen</div>
          <div class="group"><div class="cell col"><textarea id="notes" rows="4" placeholder="Was wir nicht vergessen wollen …">${st.notes}</textarea></div></div>
        </div>` : ''}

        <div class="group">
          <div class="cell"><span class="cell-icon amber">${icon('starFill')}</span><label>${st.category === 'recipe' ? 'Lieblingsrezept' : 'Lieblingsmoment'}</label><span class="toggle"><input type="checkbox" id="fav" ${st.favorite ? 'checked' : ''}><span></span></span></div>
        </div>

        ${existing ? html`<button type="button" class="btn danger block" data-act="delete">${icon('trash')} Erinnerung löschen</button>` : ''}
        <input type="file" id="file" accept="image/*" multiple hidden>
      </div>`);
    renderPhotos();
    renderPlace();
    requestAnimationFrame(() => body.querySelectorAll('textarea').forEach(autosize));
    body.querySelectorAll('[data-hearts]').forEach((h) => {
      const slot = h.dataset.hearts;
      mountHeartInput(h, {
        value: st.ratings[slot]?.value ?? null,
        onChange: (v) => { st.ratings[slot] = { ...(st.ratings[slot] || {}), value: v }; dirty = true; },
      });
    });
  }

  function readInputs() {
    const q = (s) => body.querySelector(s);
    st.title = q('#title').value.trim();
    st.date = q('#date').value || st.date;
    if (q('#endDate')) st.endDate = q('#endDate').value;
    if (q('#notes')) st.notes = q('#notes').value.trim();
    st.favorite = q('#fav').checked;
    body.querySelectorAll('[data-comment]').forEach((i) => {
      const slot = i.dataset.comment;
      st.ratings[slot] = { ...(st.ratings[slot] || {}), comment: i.value.trim() };
    });
    body.querySelectorAll('[data-xi]').forEach((i) => { st.extra[i.dataset.xi] = i.value.trim(); });
    body.querySelectorAll('[data-xt]').forEach((i) => { st.extra[i.dataset.xt] = i.checked; });
  }

  async function addFiles(files) {
    if (!files.length) return;
    const prog = body.querySelector('#photo-progress');
    const before = pending.length;
    const res = await processFiles(files, { onProgress: (i, n) => { prog.textContent = `Fotos werden vorbereitet … ${i}/${n}`; } });
    prog.textContent = '';
    pending.push(...res);
    dirty = true;
    renderPhotos();
    // Datum & Ort aus den Fotos vorschlagen
    const fresh = pending.slice(before);
    if (!existing && !dateTouched) {
      const dates = fresh.filter((p) => p.data.exifDate).map((p) => p.data.takenAt).filter(Boolean).sort();
      if (dates[0]) {
        st.date = dates[0];
        body.querySelector('#date').value = st.date;
        if (st.category === 'trip' && dates.length > 1 && dates[dates.length - 1] !== dates[0]) {
          st.endDate = dates[dates.length - 1];
          const ed = body.querySelector('#endDate');
          if (ed) ed.value = st.endDate;
        }
      }
    }
    if (!st.place) {
      const g = fresh.find((p) => p.data.gps)?.data.gps;
      if (g) {
        try {
          st.place = await reversePlace(g.lat, g.lng);
          renderPlace();
          toast(`Ort aus Foto: ${st.place.name}`, { emoji: '📍' });
        } catch {}
      }
    }
  }

  async function doSave() {
    readInputs();
    if (!st.title) {
      toast('Bitte gib einen Titel ein', { emoji: '✍️' });
      body.querySelector('#title').focus();
      return;
    }
    if (st.category === 'trip' && st.endDate && st.endDate < st.date) st.endDate = '';
    const btn = sheet.el.querySelector('[data-act="save"]');
    btn.disabled = true;
    try {
      const committed = await commitPhotos(pending, st.id, st.date);
      const photoIds = [...st.photoIds, ...committed.map((c) => c.id)];
      if (removedPhotos.length) await deletePhotos(removedPhotos);
      const data = {
        category: st.category,
        title: st.title,
        date: st.date,
        endDate: st.category === 'trip' ? st.endDate || null : null,
        place: st.category === 'recipe' ? null : st.place,
        ratings: st.ratings,
        notes: st.notes,
        favorite: st.favorite,
        extra: Object.fromEntries((EXTRA_FIELDS[st.category] || []).map((f) => [f.key, st.extra[f.key] ?? null])),
        photoIds,
        coverId: st.coverId && photoIds.includes(st.coverId) ? st.coverId : photoIds[0] || null,
        wishId: existing?.data.wishId || wishId || null,
      };
      await save('entry', data, { id: st.id });
      // Fotos ohne Eintrag (z. B. aus der Galerie) zuordnen
      for (const pid of photoIds) {
        const p = get(pid);
        if (p && p.data.entryId !== st.id) await update(pid, { entryId: st.id });
      }
      if (wishId && get(wishId)) await update(wishId, { done: true, doneAt: today(), entryId: st.id });
      if (onSaved) await onSaved(st.id);
      saved = true;
      const r = btn.getBoundingClientRect();
      heartBurst(r.left + r.width / 2, r.top + r.height / 2, 14);
      toast(existing ? 'Gespeichert' : 'Erinnerung gespeichert ♡', { emoji: CATEGORIES[st.category].emoji });
      sheet.close(undefined, true);
      if (!existing) setTimeout(() => go(`/entry/${st.id}`), 250);
    } catch (e) {
      console.error(e);
      toast('Speichern fehlgeschlagen: ' + e.message, { emoji: '⚠️', duration: 4000 });
      btn.disabled = false;
    }
  }

  // ---------- Events ----------
  sheet.el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act], [data-cat], [data-x], [data-rm], .photo-slot');
    if (!t) return;
    if (t.dataset.rm) {
      e.stopPropagation();
      const pid = t.dataset.rm;
      const pi = pending.findIndex((p) => p.id === pid);
      if (pi >= 0) { await discardPending([pending[pi]]); pending.splice(pi, 1); }
      else { st.photoIds = st.photoIds.filter((x) => x !== pid); removedPhotos.push(pid); }
      dirty = true;
      renderPhotos();
      return;
    }
    if (t.classList.contains('photo-slot')) {
      const v = await actionSheet({ items: [{ label: 'Als Titelbild verwenden', icon: 'star', value: 'cover' }] });
      if (v === 'cover') { st.coverId = t.dataset.pid; dirty = true; renderPhotos(); }
      return;
    }
    if (t.dataset.cat) {
      readInputs();
      st.category = t.dataset.cat;
      if (st.category === 'gift' && !st.extra.from) st.extra.from = me();
      render();
      return;
    }
    if (t.dataset.x) {
      const k = t.dataset.x, v = t.dataset.v;
      st.extra[k] = st.extra[k] === v ? null : v;
      t.parentElement.querySelectorAll('.opt').forEach((o) => o.classList.toggle('active', o.dataset.v === st.extra[k]));
      dirty = true;
      return;
    }
    switch (t.dataset.act) {
      case 'cancel': sheet.close(); break;
      case 'save': doSave(); break;
      case 'add-photo': body.querySelector('#file').click(); break;
      case 'place': {
        const p = await pickPlace({ current: st.place });
        if (p !== undefined) { st.place = p; dirty = true; renderPlace(); }
        break;
      }
      case 'delete': {
        const ok = await confirmDialog({ title: 'Erinnerung löschen?', message: 'Auch die zugehörigen Fotos werden gelöscht. Das kann nicht rückgängig gemacht werden.', ok: 'Löschen', danger: true });
        if (!ok) return;
        const { deleteEntry } = await import('./entry-detail.js');
        saved = true;
        sheet.close(undefined, true);
        await deleteEntry(existing.id);
        break;
      }
    }
  });
  const autosize = (ta) => { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight + 2, 520)}px`; };
  body.addEventListener('input', (e) => {
    if (e.target.matches('textarea')) autosize(e.target);
    dirty = true;
    if (e.target.id === 'date') dateTouched = true;
  });
  body.addEventListener('change', (e) => {
    if (e.target.id === 'file') {
      const files = Array.from(e.target.files || []);
      e.target.value = '';
      addFiles(files);
    }
    if (e.target.id === 'date') {
      dateTouched = true;
      const ed = body.querySelector('#endDate');
      if (ed) ed.min = e.target.value;
    }
  });
  body.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'title') { e.preventDefault(); e.target.blur(); }
  });

  render();
  if (!existing && !st.title) setTimeout(() => body.querySelector('#title')?.focus({ preventScroll: true }), 450);
  return sheet;
}

