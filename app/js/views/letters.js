// Liebesbriefe & Zeitkapseln.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { all, get, save, update, remove, uuid, me, partner, nameOf } from '../store.js';
import { fmtDate, fmtDateLong, today, daysBetween } from '../model.js';
import { topbar, emptyState } from '../ui/components.js';
import { openSheet, confirmDialog, toast, actionSheet } from '../ui/sheet.js';
import { heartBurst } from '../ui/fx.js';
import { afterPaint } from '../router.js';

const state = { tab: 'to' };
const isLocked = (l) => l.data.openAt && l.data.openAt > today();

function paint(el) {
  const letters = all('letter').sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const toMe = letters.filter((l) => l.data.to === me());
  const fromMe = letters.filter((l) => l.data.from === me());
  const list = state.tab === 'to' ? toMe : fromMe;
  const unread = toMe.filter((l) => !l.data.readAt && !isLocked(l)).length;

  el.innerHTML = String(html`
    ${topbar({ title: 'Liebesbriefe', back: true, right: html`<button class="icon-btn" data-act="write" aria-label="Brief schreiben">${icon('edit')}</button>` })}
    <div class="page">
      <h1 class="large-title">Liebes<em>briefe</em></h1>
      <p class="page-sub">Kleine Worte, große Gefühle – auch als Zeitkapsel für später.</p>
      <div class="seg" style="margin-bottom:18px">
        <button class="${state.tab === 'to' ? 'active' : ''}" data-tab="to">An mich${unread ? ` · ${unread} neu` : ''}</button>
        <button class="${state.tab === 'from' ? 'active' : ''}" data-tab="from">Von mir</button>
      </div>
      ${!list.length
        ? emptyState({
          emoji: '💌',
          title: state.tab === 'to' ? 'Noch keine Post' : 'Schreib den ersten Brief',
          text: state.tab === 'to' ? `Sobald ${nameOf(partner())} dir schreibt, liegt der Brief hier.` : `Überrasche ${nameOf(partner())} mit ein paar lieben Zeilen – oder einer Zeitkapsel für euren nächsten Jahrestag.`,
          action: html`<button class="btn primary" data-act="write">${icon('edit')} Brief schreiben</button>`,
        })
        : html`<div class="letters">${list.map((l) => {
          const locked = isLocked(l);
          const unreadL = l.data.to === me() && !l.data.readAt && !locked;
          return html`
            <button class="envelope ${l.data.readAt ? 'read' : ''} ${locked ? 'locked' : ''}" data-open="${l.id}">
              ${unreadL ? html`<span class="badge new-dot">neu</span>` : ''}
              <span class="seal">${locked ? icon('lock') : icon('heartFill')}</span>
              <span class="to"><small>${state.tab === 'to' ? `von ${nameOf(l.data.from)}` : `an ${nameOf(l.data.to)}`}</small>${locked ? `ab ${fmtDate(l.data.openAt)}` : fmtDate(l.createdAt)}</span>
            </button>`;
        })}</div>`}
      <button class="btn ghost block" data-act="write" style="margin-top:24px">${icon('edit')} Neuen Brief schreiben</button>
    </div>`);
  afterPaint(el);
}

function openLetter(l, from) {
  const locked = isLocked(l);
  if (locked && l.data.to === me()) {
    const d = daysBetween(today(), l.data.openAt);
    toast(d === 1 ? 'Nur noch 1 Tag Geduld …' : `Noch ${d} Tage Geduld …`, { emoji: '🔒', duration: 3000 });
    return;
  }
  const sheet = openSheet({
    title: '',
    full: true,
    right: l.data.from === me() ? html`<button class="icon-btn" data-act="more" aria-label="Mehr">${icon('more')}</button>` : '',
    left: html`<button class="text-btn" data-act="close">Schließen</button>`,
    body: html`
      <div class="letter-paper">
        <div class="greet">Für ${nameOf(l.data.to)} ♡</div>
        <div class="txt">${l.data.text}</div>
        <div class="sign">— ${nameOf(l.data.from)}</div>
        <div class="when">${fmtDateLong(l.createdAt)}${l.data.openAt ? ` · Zeitkapsel bis ${fmtDate(l.data.openAt)}` : ''}</div>
      </div>`,
  });
  if (l.data.to === me() && !l.data.readAt) {
    update(l.id, { readAt: new Date().toISOString() });
    setTimeout(() => {
      if (from) { const r = from.getBoundingClientRect(); heartBurst(r.left + r.width / 2, r.top + r.height / 2, 16); }
    }, 400);
  }
  sheet.el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    if (t.dataset.act === 'close') sheet.close();
    if (t.dataset.act === 'more') {
      const v = await actionSheet({ items: [{ label: 'Bearbeiten', icon: 'edit', value: 'edit' }, { label: 'Löschen', icon: 'trash', value: 'delete', danger: true }] });
      if (v === 'edit') { sheet.close(); openLetterForm({ id: l.id }); }
      if (v === 'delete' && await confirmDialog({ title: 'Brief löschen?', ok: 'Löschen', danger: true })) { await remove(l.id); sheet.close(); }
    }
  });
}

export function render(el) {
  paint(el);
  const onClick = (e) => {
    const t = e.target.closest('[data-act], [data-tab], [data-open]');
    if (!t) return;
    if (t.dataset.tab) { state.tab = t.dataset.tab; paint(el); return; }
    if (t.dataset.open) { openLetter(get(t.dataset.open), t); return; }
    if (t.dataset.act === 'write') openLetterForm();
  };
  el.addEventListener('click', onClick);
  return () => el.removeEventListener('click', onClick);
}

export function openLetterForm({ id = null } = {}) {
  const existing = id ? get(id) : null;
  const to = existing?.data.to || partner();
  const sheet = openSheet({
    title: `Brief an ${nameOf(to)}`,
    full: true,
    left: html`<button class="text-btn" data-act="cancel">Abbrechen</button>`,
    right: html`<button class="text-btn strong" data-act="send">${existing ? 'Sichern' : 'Senden'}</button>`,
    beforeClose: async () => {
      const txt = sheet.body.querySelector('#lt')?.value.trim();
      if (!txt || txt === (existing?.data.text || '')) return true;
      return confirmDialog({ title: 'Brief verwerfen?', ok: 'Verwerfen', danger: true });
    },
    body: html`
      <div class="form">
        <div class="letter-paper" style="animation:none">
          <div class="greet">Für ${nameOf(to)} ♡</div>
          <textarea id="lt" class="input" rows="10" placeholder="Schreib, was du fühlst …">${existing?.data.text || ''}</textarea>
          <div class="sign">— ${nameOf(me())}</div>
        </div>
        <div>
          <div class="group">
            <div class="cell"><span class="cell-icon purple">${icon('lock')}</span><label>Zeitkapsel</label><span class="toggle"><input type="checkbox" id="lc" ${existing?.data.openAt ? 'checked' : ''}><span></span></span></div>
            <div class="cell ${existing?.data.openAt ? '' : 'hidden'}" id="lo-cell"><label>Öffnen ab</label><input type="date" id="lo" min="${today()}" value="${existing?.data.openAt || ''}"></div>
          </div>
          <div class="group-foot">Als Zeitkapsel bleibt der Brief bis zum gewählten Tag verschlossen – perfekt für Jahrestage oder Geburtstage.</div>
        </div>
      </div>`,
  });
  const body = sheet.body;
  body.querySelector('#lc').addEventListener('change', (e) => body.querySelector('#lo-cell').classList.toggle('hidden', !e.target.checked));
  sheet.el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    if (t.dataset.act === 'cancel') sheet.close();
    if (t.dataset.act === 'send') {
      const text = body.querySelector('#lt').value.trim();
      if (!text) { toast('Dein Brief ist noch leer', { emoji: '✍️' }); return; }
      const capsule = body.querySelector('#lc').checked;
      const openAt = capsule ? body.querySelector('#lo').value : null;
      if (capsule && !openAt) { toast('Wann darf der Brief geöffnet werden?', { emoji: '📅' }); return; }
      await save('letter', { ...(existing?.data || {}), from: existing?.data.from || me(), to, text, openAt: openAt || null }, { id: existing?.id || uuid() });
      const r = t.getBoundingClientRect();
      heartBurst(r.left + r.width / 2, r.top + r.height / 2, 16);
      toast(existing ? 'Brief gespeichert' : capsule ? 'Zeitkapsel versiegelt 🔒' : `Brief an ${nameOf(to)} gesendet 💌`, { emoji: '💌' });
      sheet.close(undefined, true);
    }
  });
  setTimeout(() => body.querySelector('#lt')?.focus({ preventScroll: true }), 450);
}
