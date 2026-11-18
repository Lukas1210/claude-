// Bucket-Liste: Was ihr noch machen wollt – erledigt wird es zum Erlebnis.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { all, get, save, update, remove, uuid, nameOf } from '../store.js';
import { WISH_CATEGORIES, CATEGORIES, fmtDate, today } from '../model.js';
import { topbar, emptyState, catBadge, catIcon } from '../ui/components.js';
import { openSheet, actionSheet, confirmDialog, toast } from '../ui/sheet.js';
import { sparkBurst } from '../ui/fx.js';
import { afterPaint } from '../router.js';

const state = { tab: 'open', cat: 'all' };
const wcat = (k) => WISH_CATEGORIES.find((c) => c.key === k) || WISH_CATEGORIES[WISH_CATEGORIES.length - 1];

function paint(el) {
  const everything = all('wish');
  const wishes = state.cat === 'all' ? everything : everything.filter((w) => (w.data.category || 'other') === state.cat);
  const usedCats = WISH_CATEGORIES.filter((c) => everything.some((w) => (w.data.category || 'other') === c.key));
  const isWatch = state.cat === 'movie';
  const done = wishes.filter((w) => w.data.done);
  const open = wishes.filter((w) => !w.data.done);
  const list = (state.tab === 'open' ? open : done).sort((a, b) => state.tab === 'open' ? String(b.createdAt).localeCompare(String(a.createdAt)) : String(b.data.doneAt).localeCompare(String(a.data.doneAt)));
  const pct = wishes.length ? Math.round((done.length / wishes.length) * 100) : 0;

  el.innerHTML = String(html`
    ${topbar({ title: isWatch ? 'Watchlist' : 'Bucket-Liste', back: true, right: html`<button class="icon-btn" data-act="add" aria-label="Wunsch hinzufügen">${icon('plus')}</button>` })}
    <div class="page">
      <h1 class="large-title">${isWatch ? html`Watch<em>list</em>` : html`Bucket-<em>Liste</em>`}</h1>
      <p class="page-sub">${isWatch ? 'Filme und Serien, die ihr noch schauen wollt.' : 'Was ihr noch zusammen machen wollt.'}</p>
      ${usedCats.length > 1 ? html`
        <div class="chips" style="margin-bottom:14px">
          <button class="chip ${state.cat === 'all' ? 'active' : ''}" data-wcat="all">Alle</button>
          ${usedCats.map((c) => html`<button class="chip ${state.cat === c.key ? 'active' : ''}" data-wcat="${c.key}">${catIcon(c)} ${c.key === 'movie' ? 'Watchlist' : c.label}</button>`)}
        </div>` : ''}
      ${wishes.length ? html`
        <div class="card" style="margin-bottom:16px">
          <div class="row between" style="margin-bottom:10px"><span><strong>${done.length}</strong> <span class="muted">von ${wishes.length} erledigt</span></span><span class="champ" style="font-weight:600">${pct}%</span></div>
          <div class="progress"><div style="width:${pct}%"></div></div>
        </div>
        ${open.length ? html`<button class="btn primary block" data-act="surprise" style="margin-bottom:16px">${icon('dice')} ${isWatch ? 'Zufall: Was schauen wir?' : 'Zufall: Was machen wir?'}</button>` : ''}
        <div class="seg" style="margin-bottom:16px">
          <button class="${state.tab === 'open' ? 'active' : ''}" data-tab="open">Offen · ${open.length}</button>
          <button class="${state.tab === 'done' ? 'active' : ''}" data-tab="done">Erledigt · ${done.length}</button>
        </div>` : ''}
      ${!wishes.length
        ? emptyState({ icon: 'star', title: 'Noch keine Wünsche', text: 'Polarlichter? Sushi-Kurs? Fallschirmspringen? Sammelt hier, was ihr noch machen wollt.', action: html`<button class="btn primary" data-act="add">${icon('plus')} Wunsch hinzufügen</button>` })
        : !list.length
          ? emptyState({ icon: state.tab === 'open' ? 'trophy' : 'check', title: state.tab === 'open' ? 'Alles erledigt' : 'Noch nichts erledigt', text: state.tab === 'open' ? 'Zeit für neue Ideen.' : 'Hakt euren ersten Wunsch ab.' })
          : html`<div>${list.map((w) => html`
            <div class="wish ${w.data.done ? 'done' : ''}">
              <button class="check" data-check="${w.id}" aria-label="${w.data.done ? 'Wieder öffnen' : 'Erledigt'}">${icon('check')}</button>
              <button class="grow" data-edit="${w.id}" style="text-align:left">
                <div class="w-title">${w.data.title}</div>
                <div class="w-note">${w.data.done ? `Erledigt am ${fmtDate(w.data.doneAt)}` : w.data.note || `Wunsch von ${nameOf(w.createdBy || 'a')}`}</div>
              </button>
              ${w.data.entryId && get(w.data.entryId) ? html`<a class="icon-btn" href="#/entry/${w.data.entryId}" aria-label="Erinnerung ansehen">${icon('chevron')}</a>` : catBadge(wcat(w.data.category), { size: 'sm' })}
            </div>`)}</div>`}
    </div>`);
  afterPaint(el);
}

async function complete(w, btn) {
  const entryCat = CATEGORIES[w.data.category] ? w.data.category : null;
  const v = await actionSheet({
    title: w.data.title,
    items: [
      { label: 'Als Erinnerung festhalten', icon: 'camera', value: 'entry' },
      { label: 'Nur abhaken', icon: 'check', value: 'check' },
    ],
  });
  if (v === 'check') {
    await update(w.id, { done: true, doneAt: today() });
    const r = btn.getBoundingClientRect();
    sparkBurst(r.left + r.width / 2, r.top + r.height / 2, 14);
    toast('Erledigt', { icon: 'check' });
  }
  if (v === 'entry') {
    const { openEntryForm } = await import('./entry-form.js');
    openEntryForm({ category: entryCat || 'activity', prefill: { title: w.data.title, notes: w.data.note || '' }, wishId: w.id });
  }
}

export function render(el, _p, query, opts = {}) {
  if (!opts.refresh) state.cat = query?.cat && WISH_CATEGORIES.some((c) => c.key === query.cat) ? query.cat : 'all';
  paint(el);
  const onClick = async (e) => {
    const t = e.target.closest('[data-act], [data-tab], [data-check], [data-edit], [data-wcat]');
    if (!t) return;
    if (t.dataset.tab) { state.tab = t.dataset.tab; paint(el); return; }
    if (t.dataset.wcat) { state.cat = t.dataset.wcat; paint(el); return; }
    if (t.dataset.check) {
      const w = get(t.dataset.check);
      if (w.data.done) await update(w.id, { done: false, doneAt: null });
      else complete(w, t);
      return;
    }
    if (t.dataset.edit) { openWishForm({ id: t.dataset.edit }); return; }
    if (t.dataset.act === 'add') openWishForm({ category: state.cat === 'all' ? null : state.cat });
    if (t.dataset.act === 'surprise') surprise(state.cat === 'all' ? null : state.cat);
  };
  el.addEventListener('click', onClick);
  return () => el.removeEventListener('click', onClick);
}

/** Zufällige Auswahl aus den offenen Wünschen (optional nur einer Kategorie, z. B. der Watchlist). */
export async function surprise(cat = null) {
  const open = all('wish').filter((w) => !w.data.done && (!cat || (w.data.category || 'other') === cat));
  if (!open.length) return;
  let w = open[Math.floor(Math.random() * open.length)];
  const sheet = openSheet({
    title: cat === 'movie' ? 'Heute schaut ihr …' : 'Wie wär\'s mit …',
    body: html`
      <div class="center" style="padding:10px 0 6px">
        <div id="sw-em">${catBadge(wcat(w.data.category), { size: 'xl' })}</div>
        <h2 id="sw-t" class="display" style="font-size:30px;margin-top:12px">${w.data.title}</h2>
        <p id="sw-n" class="muted" style="margin-top:6px">${w.data.note || ''}</p>
        <div class="actions" style="display:flex;flex-direction:column;gap:10px;margin-top:22px">
          <button class="btn primary block" data-s="go">Machen wir</button>
          ${open.length > 1 ? html`<button class="btn block" data-s="again">${icon('shuffle')} Etwas anderes</button>` : ''}
        </div>
      </div>`,
  });
  sheet.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-s]');
    if (!b) return;
    if (b.dataset.s === 'again') {
      const others = open.filter((x) => x.id !== w.id);
      w = others[Math.floor(Math.random() * others.length)];
      sheet.body.querySelector('#sw-em').innerHTML = String(catBadge(wcat(w.data.category), { size: 'xl' }));
      sheet.body.querySelector('#sw-t').textContent = w.data.title;
      sheet.body.querySelector('#sw-n').textContent = w.data.note || '';
    } else {
      sheet.close();
      toast('Viel Spaß!', { icon: 'sparkles' });
    }
  });
}

export function openWishForm({ id = null, category = null } = {}) {
  const existing = id ? get(id) : null;
  const st = { category: existing?.data.category || category || 'activity' };
  const sheet = openSheet({
    title: existing ? 'Wunsch bearbeiten' : 'Neuer Wunsch',
    left: html`<button class="text-btn" data-act="cancel">Abbrechen</button>`,
    right: html`<button class="text-btn strong" data-act="save">Sichern</button>`,
    body: html`
      <div class="form">
        <input class="title-input" id="wt" placeholder="z. B. Polarlichter sehen" value="${existing?.data.title || ''}" maxlength="120">
        <div class="opt-row">${WISH_CATEGORIES.map((c) => html`<button type="button" class="opt ${st.category === c.key ? 'active' : ''}" data-c="${c.key}">${catIcon(c)} ${c.label}</button>`)}</div>
        <div class="group"><div class="cell col"><textarea id="wn" rows="3" placeholder="Details, Ideen, Links …">${existing?.data.note || ''}</textarea></div></div>
        ${existing ? html`<button class="btn danger block" data-act="delete">${icon('trash')} Wunsch löschen</button>` : ''}
      </div>`,
  });
  sheet.el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act], [data-c]');
    if (!t) return;
    if (t.dataset.c) {
      st.category = t.dataset.c;
      sheet.body.querySelectorAll('[data-c]').forEach((b) => b.classList.toggle('active', b === t));
      return;
    }
    if (t.dataset.act === 'cancel') sheet.close();
    if (t.dataset.act === 'delete') {
      if (await confirmDialog({ title: 'Wunsch löschen?', ok: 'Löschen', danger: true })) { await remove(existing.id); sheet.close(); }
    }
    if (t.dataset.act === 'save') {
      const title = sheet.body.querySelector('#wt').value.trim();
      if (!title) { toast('Was wollt ihr machen?', { icon: 'edit' }); return; }
      await save('wish', { ...(existing?.data || { done: false }), title, category: st.category, note: sheet.body.querySelector('#wn').value.trim() }, { id: existing?.id || uuid() });
      toast(existing ? 'Gespeichert' : 'Wunsch gespeichert', { icon: 'star' });
      sheet.close();
    }
  });
  setTimeout(() => sheet.body.querySelector('#wt')?.focus({ preventScroll: true }), 400);
}
