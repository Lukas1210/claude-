// Wunschzettel: eigene Wünsche (sieht der Partner), Wünsche des Partners (mit geheimer „Besorg ich“-Markierung)
// und geheime Geschenkideen. Markierungen und Ideen bleiben nur auf diesem iPhone und werden nie hochgeladen.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { topbar, emptyState } from '../ui/components.js';
import { openSheet, actionSheet, confirmDialog, toast } from '../ui/sheet.js';
import { sparkBurst } from '../ui/fx.js';
import { all, get, save, remove, me, partner, nameOf, getDevice, setDevice } from '../store.js';
import { today, parseDate, isoDate, daysBetween, nextAnnual, fmtMoney } from '../model.js';
import { upcomingOccasions } from '../dateplan.js';
import { hostOf, isUrl } from '../recipe.js';
import { afterPaint } from '../router.js';

const state = { tab: 'mine' };
const PRIO = { 1: 'Nice to have', 2: 'Gern', 3: 'Unbedingt' };

export const myWishes = () => all('giftwish').filter((w) => w.data.owner === me());
export const partnerWishes = () => all('giftwish').filter((w) => w.data.owner === partner());
export const secretIdeas = () => all('giftidea');
const reserved = () => getDevice().reserved || {};

function occasionsLine() {
  const t = today();
  const base = parseDate(t);
  const list = upcomingOccasions(t, 366).filter((o) => o.what.startsWith('Geburtstag von ' + nameOf(partner())) || o.what.endsWith('Jahrestag') || o.what === 'Valentinstag');
  const xmas = nextAnnual(`${base.getFullYear()}-12-24`, base);
  list.push({ what: 'Weihnachten', date: isoDate(xmas), days: daysBetween(base, xmas) });
  return list.sort((a, b) => a.days - b.days).slice(0, 2)
    .map((o) => `${o.what.replace(`Geburtstag von ${nameOf(partner())}`, `${nameOf(partner())}s Geburtstag`)} ${o.days === 0 ? 'heute' : o.days === 1 ? 'morgen' : `in ${o.days} Tagen`}`).join(' · ');
}

function sub(d) {
  return [d.price ? fmtMoney(d.price) : '', isUrl(d.url) ? hostOf(d.url) : '', d.prio ? PRIO[d.prio] : '', d.note || ''].filter(Boolean).join(' · ');
}

function row(w, kind) {
  const d = w.data;
  const res = kind === 'partner' && reserved()[w.id];
  return html`
    <button class="gw ${res ? 'res' : ''} ${d.prio === 3 ? 'must' : ''}" data-gw="${w.id}" data-kind="${kind}">
      <span class="cat-badge" style="--c:${kind === 'secret' ? 'var(--purple)' : 'var(--c-gift)'}">${icon(kind === 'secret' ? 'lock' : res ? 'check' : 'gift')}</span>
      <span class="grow" style="text-align:left">
        <span class="gw-title">${d.title}</span>
        ${sub(d) ? html`<span class="gw-sub">${sub(d)}</span>` : ''}
        ${res ? html`<span class="gw-res">Besorgst du · nur du siehst das</span>` : ''}
      </span>
      ${d.prio === 3 ? html`<span class="badge">!</span>` : ''}
    </button>`;
}

function paint(el) {
  const tab = state.tab;
  const p = nameOf(partner());
  const list = tab === 'mine' ? myWishes() : tab === 'partner' ? partnerWishes() : secretIdeas();
  list.sort((a, b) => (b.data.prio || 0) - (a.data.prio || 0) || String(b.createdAt).localeCompare(String(a.createdAt)));
  const occ = occasionsLine();
  el.innerHTML = String(html`
    ${topbar({ title: 'Wunschzettel', back: true, right: tab !== 'partner' ? html`<button class="icon-btn" data-act="add" aria-label="Hinzufügen">${icon('plus')}</button>` : '' })}
    <div class="page">
      <h1 class="large-title">Wunsch<em>zettel</em></h1>
      ${occ ? html`<p class="page-sub">${occ}</p>` : ''}
      <div class="seg" style="margin-bottom:16px">
        <button class="${tab === 'mine' ? 'active' : ''}" data-tab="mine">Meine</button>
        <button class="${tab === 'partner' ? 'active' : ''}" data-tab="partner">Von ${p}</button>
        <button class="${tab === 'secret' ? 'active' : ''}" data-tab="secret">${icon('lock')} Ideen</button>
      </div>
      ${list.length ? html`<div class="gw-list">${list.map((w) => row(w, tab))}</div>` : emptyState({
        icon: tab === 'secret' ? 'lock' : 'gift',
        title: tab === 'mine' ? 'Was wünschst du dir?' : tab === 'partner' ? `${p} hat noch nichts eingetragen` : 'Noch keine Geschenkideen',
        text: tab === 'mine' ? `${p} sieht deinen Wunschzettel – mit Link und Preis ist das Schenken leicht.` : tab === 'partner' ? `Sobald ${p} Wünsche einträgt, erscheinen sie hier.` : `Sammle hier Ideen für ${p}. Sie bleiben geheim.`,
        action: tab !== 'partner' ? html`<button class="btn primary" data-act="add">${icon('plus')} ${tab === 'mine' ? 'Wunsch eintragen' : 'Idee notieren'}</button>` : '',
      })}
      ${tab === 'partner' && list.length ? html`<p class="group-foot center" style="margin-top:12px">Ob du etwas besorgst, sieht nur du – ${p} bekommt davon nichts mit.</p>` : ''}
      ${tab === 'secret' ? html`<p class="group-foot center" style="margin-top:12px">${icon('lock')} Nur auf diesem iPhone gespeichert – ${p} kann die Ideen nie sehen. Im Backup sind sie enthalten.</p>` : ''}
    </div>`);
  afterPaint(el);
}

function openForm({ kind, id = null }) {
  const existing = id ? get(id) : null;
  const d = existing?.data || {};
  const st = { prio: d.prio || 2 };
  const sheet = openSheet({
    title: existing ? 'Bearbeiten' : kind === 'secret' ? 'Neue Idee' : 'Neuer Wunsch',
    left: html`<button class="text-btn" data-act="cancel">Abbrechen</button>`,
    right: html`<button class="text-btn strong" data-act="save">Sichern</button>`,
    body: html`
      <div class="form">
        <input class="title-input" id="gt" placeholder="${kind === 'secret' ? `Idee für ${nameOf(partner())}` : 'z. B. Kopfhörer, Kochkurs …'}" value="${d.title || ''}" maxlength="120">
        <div class="group">
          <div class="cell"><label>Link</label><input id="gu" type="url" inputmode="url" placeholder="https://…" value="${d.url || ''}" autocapitalize="off"></div>
          <div class="cell"><label>Preis</label><input id="gp" inputmode="decimal" placeholder="€" value="${d.price || ''}"></div>
        </div>
        ${kind === 'mine' ? html`<div><div class="group-label">Wie sehr?</div><div class="seg">${[1, 2, 3].map((n) => html`<button class="${st.prio === n ? 'active' : ''}" data-prio="${n}">${PRIO[n]}</button>`)}</div></div>` : ''}
        <div class="group"><div class="cell col"><textarea id="gn" rows="3" placeholder="${kind === 'secret' ? 'Wo gesehen? Größe? Farbe?' : 'Größe, Farbe, Alternativen …'}">${d.note || ''}</textarea></div></div>
        ${existing ? html`<button class="btn danger block" data-act="delete">${icon('trash')} Löschen</button>` : ''}
      </div>`,
  });
  sheet.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act], [data-prio]');
    if (!b) return;
    if (b.dataset.prio) { st.prio = +b.dataset.prio; sheet.body.querySelectorAll('[data-prio]').forEach((x) => x.classList.toggle('active', x === b)); return; }
    if (b.dataset.act === 'cancel') sheet.close();
    if (b.dataset.act === 'delete' && await confirmDialog({ title: 'Löschen?', ok: 'Löschen', danger: true })) { await remove(existing.id); sheet.close(); }
    if (b.dataset.act === 'save') {
      const title = sheet.body.querySelector('#gt').value.trim();
      if (!title) { toast('Bitte einen Titel eingeben', { icon: 'edit' }); return; }
      const data = { ...d, title, url: sheet.body.querySelector('#gu').value.trim(), price: sheet.body.querySelector('#gp').value.trim().replace(',', '.'), note: sheet.body.querySelector('#gn').value.trim() };
      if (kind === 'secret') await save('giftidea', { ...data, for: partner() }, { id: existing?.id, local: true });
      else await save('giftwish', { ...data, owner: d.owner || me(), prio: st.prio }, { id: existing?.id });
      sheet.close();
    }
  });
  setTimeout(() => sheet.body.querySelector('#gt')?.focus({ preventScroll: true }), 400);
}

async function asGift(w, { removeAfter = false } = {}) {
  const { openEntryForm } = await import('./entry-form.js');
  openEntryForm({
    category: 'gift',
    prefill: { title: w.data.title, notes: [w.data.note, w.data.url].filter(Boolean).join('\n') },
    onSaved: async () => { if (removeAfter) await remove(w.id); },
  });
}

export function render(el, _p, query, opts = {}) {
  if (!opts.refresh && query?.tab && ['mine', 'partner', 'secret'].includes(query.tab)) state.tab = query.tab;
  paint(el);
  const onClick = async (e) => {
    const t = e.target.closest('[data-tab], [data-act], [data-gw]');
    if (!t) return;
    if (t.dataset.tab) { state.tab = t.dataset.tab; paint(el); return; }
    if (t.dataset.act === 'add') { openForm({ kind: state.tab === 'secret' ? 'secret' : 'mine' }); return; }
    if (t.dataset.gw) {
      const w = get(t.dataset.gw);
      if (!w) return;
      const kind = t.dataset.kind;
      if (kind === 'mine') { openForm({ kind, id: w.id }); return; }
      if (kind === 'partner') {
        const res = !!reserved()[w.id];
        const v = await actionSheet({
          title: w.data.title,
          items: [
            { label: res ? 'Doch nicht besorgen' : 'Besorg ich', icon: res ? 'x' : 'check', value: 'res' },
            ...(isUrl(w.data.url) ? [{ label: `Link öffnen (${hostOf(w.data.url)})`, icon: 'link', value: 'open' }] : []),
            { label: 'Als Geschenk festhalten', icon: 'gift', value: 'gift' },
          ],
        });
        if (v === 'res') {
          const r = { ...reserved() };
          if (res) delete r[w.id]; else r[w.id] = true;
          await setDevice({ reserved: r });
          if (!res) { const b = t.getBoundingClientRect(); sparkBurst(b.left + 30, b.top + b.height / 2, 10); }
          paint(el);
        }
        if (v === 'open') window.open(w.data.url, '_blank', 'noopener');
        if (v === 'gift') asGift(w);
        return;
      }
      const v = await actionSheet({
        title: w.data.title,
        items: [
          { label: 'Bearbeiten', icon: 'edit', value: 'edit' },
          ...(isUrl(w.data.url) ? [{ label: 'Link öffnen', icon: 'link', value: 'open' }] : []),
          { label: 'Als Geschenk festhalten', icon: 'gift', value: 'gift' },
          { label: 'Löschen', icon: 'trash', value: 'delete', danger: true },
        ],
      });
      if (v === 'edit') openForm({ kind: 'secret', id: w.id });
      if (v === 'open') window.open(w.data.url, '_blank', 'noopener');
      if (v === 'gift') asGift(w, { removeAfter: true });
      if (v === 'delete' && await confirmDialog({ title: 'Idee löschen?', ok: 'Löschen', danger: true })) await remove(w.id);
    }
  };
  el.addEventListener('click', onClick);
  return () => el.removeEventListener('click', onClick);
}
