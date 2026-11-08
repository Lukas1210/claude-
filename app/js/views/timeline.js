// Timeline: Eure Geschichte ab dem ersten Tag – Meilensteine, Erlebnisse, automatische Jahrestage.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { all, get, save, remove, settings, uuid } from '../store.js';
import { CATEGORIES, MILESTONE_EMOJIS, fmtDate, fmtNumber, today, parseDate, isoDate, daysBetween, catOf, avgRating, fmtRange } from '../model.js';
import { topbar, hearts, emptyState } from '../ui/components.js';
import { openSheet, confirmDialog, toast, actionSheet } from '../ui/sheet.js';
import { processFiles, commitPhotos, discardPending, deletePhotos, photoUrl, coverOf } from '../photos.js';
import { heartBurst } from '../ui/fx.js';
import { afterPaint } from '../router.js';

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const state = { order: 'asc', hidden: new Set() };
try {
  const s = JSON.parse(sessionStorage.getItem('cj-tl') || '{}');
  if (s.order) state.order = s.order;
  if (s.hidden) state.hidden = new Set(s.hidden);
} catch {}
const persist = () => { try { sessionStorage.setItem('cj-tl', JSON.stringify({ order: state.order, hidden: [...state.hidden] })); } catch {} };

function autoMarks(start) {
  const out = [];
  if (!start) return out;
  const t = today();
  const s = parseDate(start);
  for (let y = 1; y < 100; y++) {
    const d = isoDate(new Date(s.getFullYear() + y, s.getMonth(), s.getDate()));
    if (d > t) break;
    out.push({ kind: 'auto', date: d, emoji: '🥂', text: `${y}. Jahrestag` });
  }
  const total = daysBetween(start, t);
  for (const n of [100, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000]) {
    if (n > total) break;
    const d = new Date(s);
    d.setDate(d.getDate() + n);
    out.push({ kind: 'auto', date: isoDate(d), emoji: '✨', text: `${fmtNumber(n)} Tage zusammen` });
  }
  return out;
}

function collect() {
  const s = settings();
  const items = [];
  if (!state.hidden.has('milestone')) all('milestone').forEach((m) => items.push({ kind: 'milestone', date: m.data.date, it: m }));
  all('entry').forEach((e) => { if (!state.hidden.has(e.data.category)) items.push({ kind: 'entry', date: e.data.date, it: e }); });
  if (!state.hidden.has('auto')) items.push(...autoMarks(s.startDate));
  items.sort((a, b) => String(a.date).localeCompare(String(b.date)) || (a.kind === 'auto' ? -1 : 1));
  if (state.order === 'desc') items.reverse();
  return items;
}

function milestoneCard(m) {
  const d = m.data;
  const photos = (d.photoIds || []).filter((p) => get(p)).slice(0, 3);
  return html`
    <div class="tl-item milestone">
      <button class="tl-mile card-link" data-mile="${m.id}" style="width:100%;text-align:left">
        <div class="row between"><span class="em">${d.emoji || '💞'}</span><span class="date">${fmtDate(d.date, { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
        <h3>${d.title}</h3>
        ${d.text ? html`<p>${d.text}</p>` : ''}
        ${photos.length ? html`<div class="tl-photos">${photos.map((p) => html`<div class="ph-wrap"><img data-photo="${p}" data-size="thumb" alt=""></div>`)}</div>` : ''}
      </button>
    </div>`;
}

function entryItem(e) {
  const c = catOf(e);
  const cover = coverOf(e);
  const avg = avgRating(e);
  return html`
    <div class="tl-item">
      <a class="tl-card card-link" href="#/entry/${e.id}">
        <div class="tl-thumb">${cover ? html`<img data-photo="${cover}" data-size="thumb" alt="">` : c.emoji}</div>
        <div class="grow">
          <div class="date">${c.emoji} ${e.data.category === 'trip' ? fmtRange(e.data.date, e.data.endDate) : fmtDate(e.data.date, { day: 'numeric', month: 'long' })}</div>
          <div class="t">${e.data.title}</div>
          ${avg != null ? html`<div style="margin-top:3px">${hearts(avg)}</div>` : ''}
        </div>
      </a>
    </div>`;
}

function paint(el) {
  const s = settings();
  const items = collect();
  const filters = [
    { key: 'milestone', label: '💞 Meilensteine' },
    ...Object.values(CATEGORIES).map((c) => ({ key: c.key, label: `${c.emoji} ${c.plural}` })),
    { key: 'auto', label: '🥂 Jahrestage' },
  ];
  let lastYear = null, lastMonth = null;
  const rows = [];
  const startNode = s.startDate ? html`
    <div class="tl-item start">
      <div class="tl-mile start-node">
        <span class="em">💫</span>
        <h3>Hier hat alles begonnen</h3>
        <div class="date">${fmtDate(s.startDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>
    </div>` : '';
  const nowNode = html`<div class="tl-now">Heute · ${fmtDate(today(), { day: 'numeric', month: 'long', year: 'numeric' })} ♡</div>`;

  for (const x of items) {
    const y = String(x.date).slice(0, 4), m = +String(x.date).slice(5, 7);
    if (y !== lastYear) { rows.push(html`<div class="tl-year">${y}</div>`); lastYear = y; lastMonth = null; }
    if (m !== lastMonth) { rows.push(html`<div class="tl-month">${MONTHS[m - 1]}</div>`); lastMonth = m; }
    if (x.kind === 'auto') rows.push(html`<div class="tl-item auto"><div class="tl-auto">${x.emoji} ${x.text} <span class="faint">· ${fmtDate(x.date, { day: 'numeric', month: 'short' })}</span></div></div>`);
    else if (x.kind === 'milestone') rows.push(milestoneCard(x.it));
    else rows.push(entryItem(x.it));
  }

  el.innerHTML = String(html`
    ${topbar({ title: 'Timeline', right: html`<button class="icon-btn" data-act="add" aria-label="Meilenstein hinzufügen">${icon('plus')}</button>` })}
    <div class="page">
      <h1 class="large-title">Unsere <em>Geschichte</em></h1>
      <p class="page-sub">Von Anfang an – jeder Meilenstein, jedes Abenteuer.</p>
      <div class="seg" style="margin-bottom:12px">
        <button class="${state.order === 'asc' ? 'active' : ''}" data-order="asc">Von Anfang an</button>
        <button class="${state.order === 'desc' ? 'active' : ''}" data-order="desc">Neueste zuerst</button>
      </div>
      <div class="chips">${filters.map((f) => html`<button class="chip ${state.hidden.has(f.key) ? '' : 'active'}" data-filter="${f.key}">${f.label}</button>`)}</div>

      ${!s.startDate && !items.length ? emptyState({ emoji: '💞', title: 'Eure Timeline', text: 'Tragt in den Einstellungen ein, seit wann ihr zusammen seid, und fügt Meilensteine hinzu.' }) : html`
        <div class="tl">
          ${state.order === 'asc' ? startNode : nowNode}
          ${rows}
          ${state.order === 'asc' ? nowNode : startNode}
        </div>`}
      <button class="btn ghost block" data-act="add">${icon('plus')} Meilenstein hinzufügen</button>
    </div>`);
  afterPaint(el);
}

export function render(el) {
  paint(el);
  const onClick = async (e) => {
    const t = e.target.closest('[data-act], [data-order], [data-filter], [data-mile]');
    if (!t) return;
    if (t.dataset.order) { state.order = t.dataset.order; persist(); paint(el); return; }
    if (t.dataset.filter) {
      const k = t.dataset.filter;
      state.hidden.has(k) ? state.hidden.delete(k) : state.hidden.add(k);
      persist();
      paint(el);
      return;
    }
    if (t.dataset.mile) {
      const m = get(t.dataset.mile);
      const v = await actionSheet({
        title: m.data.title,
        items: [
          ...((m.data.photoIds || []).length ? [{ label: 'Fotos ansehen', icon: 'gallery', value: 'photos' }] : []),
          { label: 'Bearbeiten', icon: 'edit', value: 'edit' },
          { label: 'Löschen', icon: 'trash', value: 'delete', danger: true },
        ],
      });
      if (v === 'edit') openMilestoneForm({ id: m.id });
      if (v === 'photos') { const { openViewer } = await import('./photo-viewer.js'); openViewer(m.data.photoIds, 0); }
      if (v === 'delete' && await confirmDialog({ title: 'Meilenstein löschen?', ok: 'Löschen', danger: true })) {
        await deletePhotos((m.data.photoIds || []).filter((p) => get(p)));
        await remove(m.id);
      }
      return;
    }
    if (t.dataset.act === 'add') openMilestoneForm();
  };
  el.addEventListener('click', onClick);
  return () => el.removeEventListener('click', onClick);
}

/** Meilenstein anlegen / bearbeiten. */
export function openMilestoneForm({ id = null } = {}) {
  const existing = id ? get(id) : null;
  const st = {
    id: existing?.id || uuid(),
    emoji: existing?.data.emoji || '💞',
    title: existing?.data.title || '',
    date: existing?.data.date || today(),
    text: existing?.data.text || '',
    photoIds: (existing?.data.photoIds || []).filter((p) => get(p)),
  };
  let pending = [];
  const removed = [];
  let saved = false;
  const sheet = openSheet({
    title: existing ? 'Meilenstein bearbeiten' : 'Neuer Meilenstein',
    full: true,
    left: html`<button class="text-btn" data-act="cancel">Abbrechen</button>`,
    right: html`<button class="text-btn strong" data-act="save">Sichern</button>`,
    onClose: () => { if (!saved && pending.length) discardPending(pending); },
    body: html`
      <div class="form">
        <div>
          <div class="group-label">Symbol</div>
          <div class="opt-row" id="emojis">${MILESTONE_EMOJIS.map((e) => html`<button type="button" class="opt ${e === st.emoji ? 'active' : ''}" data-emoji="${e}" style="font-size:22px;padding:6px 10px">${e}</button>`)}</div>
        </div>
        <input class="title-input" id="mt" placeholder="z. B. Unser erster Kuss" value="${st.title}" maxlength="120">
        <div class="group">
          <div class="cell"><label>Datum</label><input type="date" id="md" value="${st.date}"></div>
          <div class="cell col"><textarea id="mx" rows="4" placeholder="Erzählt die Geschichte dazu …">${st.text}</textarea></div>
        </div>
        <div>
          <div class="group-label">Fotos</div>
          <div class="photo-strip" id="mp"></div>
        </div>
        <input type="file" id="mf" accept="image/*" multiple hidden>
      </div>`,
  });
  const body = sheet.body;

  const renderPhotos = () => {
    const ids = [...st.photoIds, ...pending.map((p) => p.id)];
    const strip = body.querySelector('#mp');
    strip.innerHTML = String(html`<button type="button" class="photo-add" data-act="add-photo">${icon('camera')}</button>${ids.map((pid) => html`<div class="photo-slot"><img data-pimg="${pid}" alt=""><button type="button" class="rm" data-rm="${pid}">${icon('close')}</button></div>`)}`);
    strip.querySelectorAll('img[data-pimg]').forEach(async (img) => { const u = await photoUrl(img.dataset.pimg); if (u) img.src = u; });
  };
  renderPhotos();

  sheet.el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act], [data-emoji], [data-rm]');
    if (!t) return;
    if (t.dataset.emoji) {
      st.emoji = t.dataset.emoji;
      body.querySelectorAll('[data-emoji]').forEach((b) => b.classList.toggle('active', b === t));
      return;
    }
    if (t.dataset.rm) {
      const pid = t.dataset.rm;
      const pi = pending.findIndex((p) => p.id === pid);
      if (pi >= 0) { await discardPending([pending[pi]]); pending.splice(pi, 1); }
      else { st.photoIds = st.photoIds.filter((x) => x !== pid); removed.push(pid); }
      renderPhotos();
      return;
    }
    if (t.dataset.act === 'cancel') sheet.close();
    if (t.dataset.act === 'add-photo') body.querySelector('#mf').click();
    if (t.dataset.act === 'save') {
      st.title = body.querySelector('#mt').value.trim();
      st.date = body.querySelector('#md').value || today();
      st.text = body.querySelector('#mx').value.trim();
      if (!st.title) { toast('Bitte gib einen Titel ein', { emoji: '✍️' }); return; }
      const committed = await commitPhotos(pending, null, st.date);
      if (removed.length) await deletePhotos(removed);
      await save('milestone', { emoji: st.emoji, title: st.title, date: st.date, text: st.text, photoIds: [...st.photoIds, ...committed.map((c) => c.id)] }, { id: st.id });
      saved = true;
      const r = t.getBoundingClientRect();
      heartBurst(r.left + r.width / 2, r.top + r.height / 2, 12);
      toast('Meilenstein gespeichert', { emoji: st.emoji });
      sheet.close(undefined, true);
    }
  });
  body.addEventListener('change', async (e) => {
    if (e.target.id !== 'mf') return;
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const res = await processFiles(files);
    pending.push(...res);
    const exifDate = res.find((r) => r.data.exifDate)?.data.takenAt;
    if (!existing && exifDate && body.querySelector('#md').value === today()) body.querySelector('#md').value = exifDate;
    renderPhotos();
  });
  return sheet;
}
