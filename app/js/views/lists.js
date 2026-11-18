// Listen: gemeinsame To-dos und Einkaufsliste – mit Zuweisung („Du kümmerst dich um …“).
// Jeder Punkt ist ein eigener Eintrag vom Typ "todo" → sauberer Abgleich, auch wenn beide gleichzeitig abhaken.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { topbar, emptyState } from '../ui/components.js';
import { openSheet, confirmDialog, toast } from '../ui/sheet.js';
import { sparkBurst } from '../ui/fx.js';
import { all, get, save, saveMany, update, remove, me, partner, nameOf, subscribe } from '../store.js';
import { today, fmtDate, daysBetween } from '../model.js';
import { afterPaint } from '../router.js';

const KEY = 'cj-lists';
const state = { list: 'todo', showDone: false, assignee: null };
try { Object.assign(state, JSON.parse(sessionStorage.getItem(KEY) || '{}')); } catch {}
const persist = () => { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch {} };

/** Beim nächsten Öffnen diese Liste zeigen (z. B. nach „Zutaten hinzufügen“). */
export function showList(list) { state.list = list; persist(); }

export const todos = (list) => all('todo').filter((t) => (t.data.list || 'todo') === list);
export const openTodos = (list) => todos(list).filter((t) => !t.data.done);
export const myOpenTodos = () => openTodos('todo').filter((t) => t.data.assignee === me());

const initial = (slot) => (nameOf(slot) || '?').charAt(0).toUpperCase();
const nextAssignee = (a) => (a == null ? me() : a === me() ? partner() : null);
export const assigneeText = (a) => (a == null ? 'Für euch beide' : a === me() ? 'Du kümmerst dich' : `${nameOf(a)} kümmert sich`);

function dueInfo(due) {
  if (!due) return null;
  const d = daysBetween(today(), due);
  if (d < 0) return { text: `überfällig seit ${fmtDate(due, { day: 'numeric', month: 'short' })}`, cls: 'late' };
  if (d === 0) return { text: 'heute', cls: 'soon' };
  if (d === 1) return { text: 'morgen', cls: 'soon' };
  return { text: `bis ${fmtDate(due, { weekday: 'short', day: 'numeric', month: 'numeric' })}`, cls: '' };
}

const sortTodos = (a, b) => (a.data.due || '9999').localeCompare(b.data.due || '9999') || String(a.createdAt).localeCompare(String(b.createdAt));

function row(t) {
  const d = t.data;
  const due = dueInfo(d.due);
  const sub = [due ? html`<span class="due ${due.cls}">${due.text}</span>` : '', d.note ? d.note : '', d.list === 'shop' && d.assignee ? assigneeText(d.assignee) : ''].filter(Boolean);
  return html`
    <div class="todo ${d.done ? 'done' : ''}">
      <button class="check" data-check="${t.id}" aria-label="${d.done ? 'Wieder öffnen' : 'Erledigt'}">${icon('check')}</button>
      <button class="grow todo-main" data-edit="${t.id}">
        <span class="todo-text">${d.text}</span>
        ${sub.length ? html`<span class="todo-sub">${sub.map((x, i) => html`${i ? ' · ' : ''}${x}`)}</span>` : ''}
      </button>
      <button class="assignee ${d.assignee == null ? 'both' : d.assignee === me() ? 'me' : 'partner'}" data-assign="${t.id}" aria-label="${assigneeText(d.assignee)} – tippen zum Ändern">${d.assignee == null ? icon('people') : initial(d.assignee)}</button>
    </div>`;
}

function section(title, list, sub = '') {
  if (!list.length) return '';
  return html`<div class="todo-section"><div class="group-label">${title}${sub ? html` <span class="faint">· ${sub}</span>` : ''}</div><div class="todo-group">${list.map(row)}</div></div>`;
}

function counts() {
  return {
    mine: myOpenTodos().length,
    theirs: openTodos('todo').filter((t) => t.data.assignee === partner()).length,
    shopOpen: openTodos('shop').length,
    todoOpen: openTodos('todo').length,
  };
}

const whoBtn = (a) => html`<button type="button" id="add-who" data-act="add-who" class="assignee ${a == null ? 'both' : a === me() ? 'me' : 'partner'}" aria-label="${assigneeText(a)} – tippen zum Ändern">${a == null ? icon('people') : initial(a)}</button>`;

function bodyHtml() {
  const isShop = state.list === 'shop';
  const items = todos(state.list);
  const open = items.filter((t) => !t.data.done).sort(sortTodos);
  const done = items.filter((t) => t.data.done).sort((a, b) => String(b.data.doneAt).localeCompare(String(a.data.doneAt)));
  let groups;
  if (!isShop) {
    groups = html`
      ${section('Du kümmerst dich um', open.filter((t) => t.data.assignee === me()))}
      ${section(`${nameOf(partner())} kümmert sich um`, open.filter((t) => t.data.assignee === partner()))}
      ${section('Wer hat Zeit?', open.filter((t) => t.data.assignee == null))}`;
  } else {
    const byRecipe = new Map();
    for (const t of open) {
      const k = t.data.recipeTitle || '';
      if (!byRecipe.has(k)) byRecipe.set(k, []);
      byRecipe.get(k).push(t);
    }
    groups = html`${[...byRecipe.entries()].sort((a, b) => (a[0] ? 1 : 0) - (b[0] ? 1 : 0) || a[0].localeCompare(b[0])).map(([k, list]) => section(k ? `Für: ${k}` : 'Einkauf', list))}`;
  }
  return html`
    ${open.length ? groups : emptyState({
      icon: isShop ? 'cart' : 'todo',
      title: isShop ? 'Einkaufsliste ist leer' : 'Nichts zu tun',
      text: isShop ? 'Tragt ein, was fehlt – oder übernehmt die Zutaten direkt aus einem Rezept.' : 'Neue Aufgaben oben eintragen und per Tipp aufs Symbol zuweisen.',
    })}
    ${done.length ? html`
      <div class="row between" style="margin-top:18px">
        <button class="text-btn" data-act="toggle-done">${icon(state.showDone ? 'chevronDown' : 'chevron')} Erledigt · ${done.length}</button>
        ${state.showDone ? html`<button class="text-btn" data-act="clear-done" style="color:var(--danger)">Löschen</button>` : ''}
      </div>
      ${state.showDone ? html`<div class="todo-group">${done.map(row)}</div>` : ''}` : ''}`;
}

/** Nur Zähler, Umschalter und Liste neu zeichnen – das Eingabefeld bleibt erhalten (Tastatur bleibt offen). */
function paintBody(el) {
  const c = counts();
  const isShop = state.list === 'shop';
  const sub = el.querySelector('#lists-sub');
  if (!sub) return;
  sub.textContent = `${c.mine} für dich · ${c.theirs} für ${nameOf(partner())} · ${c.shopOpen} im Einkauf`;
  el.querySelector('#lists-seg').innerHTML = String(html`
    <button class="${!isShop ? 'active' : ''}" data-list="todo">To-dos${c.todoOpen ? ` · ${c.todoOpen}` : ''}</button>
    <button class="${isShop ? 'active' : ''}" data-list="shop">Einkauf${c.shopOpen ? ` · ${c.shopOpen}` : ''}</button>`);
  const input = el.querySelector('#nt');
  input.placeholder = isShop ? 'Was fehlt? z. B. 2 Zitronen' : 'Neue Aufgabe …';
  el.querySelector('#add-who').outerHTML = String(whoBtn(state.assignee));
  el.querySelector('#add-hint').textContent = assigneeText(state.assignee);
  el.querySelector('#todo-body').innerHTML = String(bodyHtml());
  afterPaint(el);
}

function paint(el) {
  el.innerHTML = String(html`
    ${topbar({ title: 'Listen', back: true })}
    <div class="page">
      <h1 class="large-title"><em>Listen</em></h1>
      <p class="page-sub" id="lists-sub"></p>
      <div class="seg" id="lists-seg" style="margin-bottom:14px"></div>
      <form class="todo-add" id="add">
        <input id="nt" autocomplete="off" enterkeyhint="done" maxlength="140" aria-label="Neuer Eintrag">
        <span id="add-who"></span>
        <button type="submit" class="add-btn" aria-label="Hinzufügen">${icon('plus')}</button>
      </form>
      <div class="todo-add-hint faint" id="add-hint"></div>
      <div id="todo-body"></div>
    </div>`);
  paintBody(el);
}

export function openTodoForm(id) {
  const t = get(id);
  if (!t) return;
  const st = { assignee: t.data.assignee ?? null, list: t.data.list || 'todo' };
  const segBtn = (v, l) => html`<button class="${String(st.assignee) === String(v) ? 'active' : ''}" data-who="${v}">${l}</button>`;
  const sheet = openSheet({
    title: st.list === 'shop' ? 'Einkauf' : 'Aufgabe',
    left: html`<button class="text-btn" data-act="cancel">Abbrechen</button>`,
    right: html`<button class="text-btn strong" data-act="save">Sichern</button>`,
    body: html`
      <div class="form">
        <input class="title-input" id="tt" value="${t.data.text}" maxlength="140">
        <div>
          <div class="group-label">Wer kümmert sich?</div>
          <div class="seg" id="who">${segBtn(me(), 'Ich')}${segBtn(partner(), nameOf(partner()))}${segBtn('null', 'Beide')}</div>
        </div>
        <div class="group">
          <div class="cell"><label>Bis wann</label><input type="date" id="td" value="${t.data.due || ''}" placeholder="Kein Datum"></div>
          <div class="cell col"><textarea id="tn" rows="2" placeholder="Notiz">${t.data.note || ''}</textarea></div>
        </div>
        <div class="seg" id="lst"><button class="${st.list === 'todo' ? 'active' : ''}" data-l="todo">To-do</button><button class="${st.list === 'shop' ? 'active' : ''}" data-l="shop">Einkauf</button></div>
        <button class="btn danger block" data-act="delete">${icon('trash')} Löschen</button>
      </div>`,
  });
  sheet.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act], [data-who], [data-l]');
    if (!b) return;
    if (b.dataset.who) {
      st.assignee = b.dataset.who === 'null' ? null : b.dataset.who;
      sheet.body.querySelectorAll('[data-who]').forEach((x) => x.classList.toggle('active', x === b));
      return;
    }
    if (b.dataset.l) {
      st.list = b.dataset.l;
      sheet.body.querySelectorAll('[data-l]').forEach((x) => x.classList.toggle('active', x === b));
      return;
    }
    if (b.dataset.act === 'cancel') sheet.close();
    if (b.dataset.act === 'delete') { await remove(t.id); sheet.close(); }
    if (b.dataset.act === 'save') {
      const text = sheet.body.querySelector('#tt').value.trim();
      if (!text) { toast('Bitte einen Text eingeben', { icon: 'edit' }); return; }
      await update(t.id, { text, assignee: st.assignee, due: sheet.body.querySelector('#td').value || null, note: sheet.body.querySelector('#tn').value.trim(), list: st.list });
      sheet.close();
    }
  });
}

/** Zutaten eines Rezepts auf die Einkaufsliste setzen. `lines` = bereits umgerechnete Texte. */
export async function addShopping(lines, { recipeId = null, recipeTitle = null } = {}) {
  const now = today();
  await saveMany(lines.map((text) => ({ type: 'todo', data: { text, list: 'shop', assignee: null, due: null, done: false, doneAt: null, doneBy: null, note: '', recipeId, recipeTitle, addedAt: now } })));
}

export const live = false;

export function render(el) {
  paint(el);
  let timer;
  const unsub = subscribe((evt) => {
    if (!evt.types.some((t) => t === 'todo' || t === '*' || t === 'settings' || t === 'device')) return;
    clearTimeout(timer);
    timer = setTimeout(() => paintBody(el), 60);
  });
  const onSubmit = async (e) => {
    if (e.target.id !== 'add') return;
    e.preventDefault();
    const input = el.querySelector('#nt');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    await save('todo', { text, list: state.list, assignee: state.assignee, due: null, done: false, doneAt: null, doneBy: null, note: '' });
  };
  const onClick = async (e) => {
    const t = e.target.closest('[data-check], [data-edit], [data-assign], [data-list], [data-act]');
    if (!t) return;
    if (t.dataset.list) { state.list = t.dataset.list; persist(); paintBody(el); return; }
    if (t.dataset.check) {
      const it = get(t.dataset.check);
      if (!it) return;
      const done = !it.data.done;
      if (done) { const r = t.getBoundingClientRect(); sparkBurst(r.left + r.width / 2, r.top + r.height / 2, 8); }
      await update(it.id, { done, doneAt: done ? new Date().toISOString() : null, doneBy: done ? me() : null });
      return;
    }
    if (t.dataset.edit) { openTodoForm(t.dataset.edit); return; }
    if (t.dataset.assign) {
      const it = get(t.dataset.assign);
      if (it) await update(it.id, { assignee: nextAssignee(it.data.assignee ?? null) });
      return;
    }
    switch (t.dataset.act) {
      case 'add-who': state.assignee = nextAssignee(state.assignee); persist(); paintBody(el); break;
      case 'toggle-done': state.showDone = !state.showDone; persist(); paintBody(el); break;
      case 'clear-done': {
        const done = todos(state.list).filter((x) => x.data.done);
        if (!done.length) return;
        if (await confirmDialog({ title: `${done.length} erledigte ${done.length === 1 ? 'Eintrag' : 'Einträge'} löschen?`, ok: 'Löschen', danger: true })) {
          for (const x of done) await remove(x.id);
        }
        break;
      }
    }
  };
  el.addEventListener('submit', onSubmit);
  el.addEventListener('click', onClick);
  return () => { unsub(); clearTimeout(timer); el.removeEventListener('submit', onSubmit); el.removeEventListener('click', onClick); };
}
