// Kalender: Monatsansicht mit Tagesliste und Agenda-Liste.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { all, nameOf, me, partner } from '../store.js';
import { today, parseDate, isoDate, fmtDate, daysBetween } from '../model.js';
import { expandEvents, occurrencesOnDay, specialDays, eventCat, fmtTime, eventDuration, relativeDay, occEnd } from '../events.js';
import { topbar } from '../ui/components.js';
import { afterPaint } from '../router.js';
import { openEventForm } from './event-form.js';
import { shortPlace } from '../geo.js';

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const state = { mode: 'month', month: null, sel: null, showPast: false, lastQ: null };
let viewEl = null;

const firstOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

function initials(slot) { return (nameOf(slot) || '?').trim().charAt(0).toUpperCase(); }

function rsvpDots(ev) {
  const r = ev.data.rsvp || {};
  return html`<span class="rs">${['a', 'b'].map((s) => html`<span class="rsvp-dot ${r[s] || ''}" title="${nameOf(s)}">${initials(s)}</span>`)}</span>`;
}

export function eventRow({ ev, occ }, { showDate = false } = {}) {
  const d = ev.data;
  const c = eventCat(d.category);
  const multi = eventDuration(d) > 0;
  const past = occEnd(ev, occ) < new Date();
  let time;
  if (d.allDay) time = html`ganzer<small>Tag</small>`;
  else if (multi && occ !== d.date) time = html`${fmtTime(d.time)}<small>ab ${fmtDate(occ, { day: 'numeric', month: 'short' })}</small>`;
  else time = html`${fmtTime(d.time)}<small>${fmtTime(d.endTime)}</small>`;
  const meta = [showDate ? relativeDay(occ) : null, d.place ? shortPlace(d.place) : null, d.repeat && d.repeat !== 'none' ? '↻' : null].filter(Boolean).join(' · ');
  const needsMe = !d.rsvp?.[me()] && !past;
  return html`
    <a class="event-row card-link ${past ? 'past' : ''}" href="#/event/${ev.id}?d=${occ}">
      <span class="bar" style="background:${c.color}"></span>
      <span class="time">${time}</span>
      <span class="body">
        <span class="t" style="display:block">${c.emoji} ${d.title}</span>
        <span class="m" style="display:block">${meta || c.label}${needsMe ? html` · <span class="rose">Zusage offen</span>` : ''}</span>
      </span>
      ${rsvpDots(ev)}
    </a>`;
}

function specialRow(s) {
  return html`<div class="event-row readonly"><span class="bar" style="background:var(--purple)"></span><span class="time">ganzer<small>Tag</small></span><span class="body"><span class="t" style="display:block">${s.emoji} ${s.title}</span><span class="m" style="display:block">Jährlich</span></span></div>`;
}

function entryRow(e) {
  return html`<a class="event-row readonly card-link" href="#/entry/${e.id}"><span class="bar" style="background:var(--text3)"></span><span class="time">erlebt</span><span class="body"><span class="t" style="display:block">✨ ${e.data.title}</span><span class="m" style="display:block">Erinnerung ansehen</span></span></a>`;
}

function monthView() {
  const m = state.month;
  const gridStart = addDays(m, -((m.getDay() + 6) % 7)); // Montag als Wochenstart
  const lastDay = new Date(m.getFullYear(), m.getMonth() + 1, 0);
  const cells = Math.ceil((((m.getDay() + 6) % 7) + lastDay.getDate()) / 7) * 7;
  const gridEnd = addDays(gridStart, cells - 1);
  const from = isoDate(gridStart), to = isoDate(gridEnd);
  const occs = expandEvents(from, to);
  const specials = specialDays(from, to);
  const dots = new Map();
  const addDot = (day, color) => { const l = dots.get(day) || []; if (l.length < 3 && !l.includes(color)) l.push(color); dots.set(day, l); };
  for (const o of occs) {
    const dur = eventDuration(o.ev.data);
    for (let i = 0; i <= dur; i++) addDot(isoDate(addDays(parseDate(o.occ), i)), eventCat(o.ev.data.category).color);
  }
  for (const s of specials) addDot(s.date, 'var(--purple)');
  const t = today();
  const days = [];
  for (let i = 0; i < cells; i++) {
    const d = addDays(gridStart, i);
    const iso = isoDate(d);
    const cls = [
      d.getMonth() !== m.getMonth() ? 'other' : '',
      iso === t ? 'today' : '',
      iso === state.sel ? 'sel' : '',
      i % 7 >= 5 ? 'weekend' : '',
    ].join(' ');
    days.push(html`<button class="cal-day ${cls}" data-day="${iso}" aria-label="${fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long' })}"><span class="n">${d.getDate()}</span><span class="dots">${(dots.get(iso) || []).map((c) => html`<i style="background:${c}"></i>`)}</span></button>`);
  }

  const sel = state.sel;
  const dayOccs = occurrencesOnDay(sel);
  const daySpecials = specialDays(sel, sel);
  const dayEntries = all('entry').filter((e) => e.data.date === sel);
  const n = daysBetween(t, sel);
  const rel = n === 0 ? 'Heute' : n === 1 ? 'Morgen' : n === -1 ? 'Gestern' : '';
  const next = expandEvents(t, isoDate(addDays(new Date(), 120))).filter((o) => occEnd(o.ev, o.occ) >= new Date() && o.occ !== sel).slice(0, 4);

  return html`
    <div class="cal-head">
      <h2>${MONTHS[m.getMonth()]} <span>${m.getFullYear()}</span></h2>
      <div class="cal-nav">
        <button class="today-btn" data-act="today">Heute</button>
        <button class="icon-btn" data-act="prev" aria-label="Vorheriger Monat">${icon('back')}</button>
        <button class="icon-btn" data-act="next" aria-label="Nächster Monat">${icon('chevron')}</button>
      </div>
    </div>
    <div class="card cal-card">
      <div class="cal-week">${WEEKDAYS.map((w) => html`<span>${w}</span>`)}</div>
      <div class="cal-grid" id="cal-grid">${days}</div>
    </div>

    <div class="day-title"><span>${rel ? `${rel}, ` : ''}${fmtDate(sel, { weekday: rel ? undefined : 'long', day: 'numeric', month: 'long' })}</span>${dayOccs.length ? html`<small>${dayOccs.length} ${dayOccs.length === 1 ? 'Termin' : 'Termine'}</small>` : ''}</div>
    <div class="event-list">
      ${daySpecials.map(specialRow)}
      ${dayOccs.map((o) => eventRow(o))}
      ${dayEntries.map(entryRow)}
      ${!dayOccs.length && !daySpecials.length && !dayEntries.length ? html`
        <button class="event-row readonly" data-act="add" style="justify-content:center;color:var(--accent);font-weight:600">${icon('calendarPlus')}&nbsp;Termin am ${fmtDate(sel, { day: 'numeric', month: 'long' })} planen</button>` : ''}
    </div>

    ${next.length ? html`
      <div class="section">
        <div class="section-head"><h2 class="section-title small">Als Nächstes</h2><button class="section-link" data-mode="list">Alle</button></div>
        <div class="event-list">${next.map((o) => eventRow(o, { showDate: true }))}</div>
      </div>` : ''}`;
}

function listView() {
  const t = today();
  const from = state.showPast ? isoDate(addDays(new Date(), -180)) : t;
  const to = isoDate(addDays(new Date(), 365));
  const occs = expandEvents(from, to).filter((o) => state.showPast || occEnd(o.ev, o.occ) >= new Date());
  const specials = specialDays(t, isoDate(addDays(new Date(), 120)));
  const groups = new Map();
  for (const o of occs) { if (!groups.has(o.occ)) groups.set(o.occ, { events: [], specials: [] }); groups.get(o.occ).events.push(o); }
  for (const s of specials) { if (!groups.has(s.date)) groups.set(s.date, { events: [], specials: [] }); groups.get(s.date).specials.push(s); }
  const keys = [...groups.keys()].sort();
  return html`
    <button class="btn small block" data-act="past" style="margin-bottom:6px">${state.showPast ? 'Vergangene ausblenden' : 'Vergangene Termine anzeigen'}</button>
    ${!occs.length ? html`<div class="empty"><span class="em">📅</span><h3>Noch nichts geplant</h3><p>Plant euer nächstes Date, einen Ausflug oder einfach einen gemütlichen Abend.</p><button class="btn primary" data-act="add">${icon('plus')} Termin planen</button></div>` : ''}
    ${keys.map((k) => {
      const g = groups.get(k);
      if (!g.events.length && !occs.length) return '';
      return html`
        <div class="agenda-date ${k === t ? 'today' : ''}">${relativeDay(k)}${daysBetween(t, k) > 1 && daysBetween(t, k) < 7 ? ` · ${fmtDate(k, { day: 'numeric', month: 'short' })}` : ''}</div>
        <div class="event-list">${g.specials.map(specialRow)}${g.events.map((o) => eventRow(o))}</div>`;
    })}`;
}

function paint(el) {
  const pending = expandEvents(today(), isoDate(addDays(new Date(), 365))).filter((o) => !o.ev.data.rsvp?.[me()] && o.ev.createdBy !== me());
  el.innerHTML = String(html`
    ${topbar({ title: 'Kalender', right: html`<button class="icon-btn" data-act="add" aria-label="Termin hinzufügen">${icon('plus')}</button>` })}
    <div class="page">
      <h1 class="large-title">Kalender</h1>
      <p class="page-sub">${pending.length ? html`<span class="rose">${pending.length === 1 ? `1 Termin von ${nameOf(partner())} wartet auf deine Zusage` : `${pending.length} Termine warten auf deine Zusage`}</span>` : 'Gemeinsame Pläne, Dates und Termine.'}</p>
      <div class="seg" style="margin-bottom:14px">
        <button class="${state.mode === 'month' ? 'active' : ''}" data-mode="month">Monat</button>
        <button class="${state.mode === 'list' ? 'active' : ''}" data-mode="list">Liste</button>
      </div>
      ${state.mode === 'month' ? monthView() : listView()}
    </div>`);
  afterPaint(el);
}

/** Vom "+"-Knopf aufgerufen. */
export function addEvent() {
  openEventForm({ date: state.mode === 'month' && state.sel >= today() ? state.sel : today() });
}

/** Nach dem Anlegen eines Termins: Tag auswählen. */
export function selectDate(iso) {
  state.sel = iso;
  state.month = firstOfMonth(parseDate(iso));
  state.mode = 'month';
  if (viewEl) paint(viewEl);
}

export function render(el, _p, query) {
  viewEl = el;
  if (!state.sel) state.sel = today();
  if (query?.d && query.d !== state.lastQ) { state.sel = query.d; state.lastQ = query.d; }
  state.month = firstOfMonth(parseDate(state.sel));
  paint(el);

  const changeMonth = (delta) => {
    state.month = new Date(state.month.getFullYear(), state.month.getMonth() + delta, 1);
    // Auswahl in den neuen Monat legen (heute, falls sichtbar, sonst der 1.)
    const t = parseDate(today());
    state.sel = t.getFullYear() === state.month.getFullYear() && t.getMonth() === state.month.getMonth() ? today() : isoDate(state.month);
    paint(el);
  };

  const onClick = (e) => {
    const t = e.target.closest('[data-act], [data-day], [data-mode]');
    if (!t) return;
    if (t.dataset.mode) { state.mode = t.dataset.mode; paint(el); document.getElementById('scroller').scrollTo({ top: 0 }); return; }
    if (t.dataset.day) {
      const d = parseDate(t.dataset.day);
      state.sel = t.dataset.day;
      if (d.getMonth() !== state.month.getMonth()) state.month = firstOfMonth(d);
      paint(el);
      return;
    }
    switch (t.dataset.act) {
      case 'prev': changeMonth(-1); break;
      case 'next': changeMonth(1); break;
      case 'today': state.sel = today(); state.month = firstOfMonth(new Date()); paint(el); break;
      case 'add': addEvent(); break;
      case 'past': state.showPast = !state.showPast; paint(el); break;
    }
  };

  // Wischen im Monatsraster wechselt den Monat
  let sx = null, sy = null;
  const onDown = (e) => { if (e.target.closest('#cal-grid')) { sx = e.clientX; sy = e.clientY; } };
  const onUp = (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      changeMonth(dx < 0 ? 1 : -1);
    }
  };

  el.addEventListener('click', onClick);
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointerup', onUp);
  return () => {
    el.removeEventListener('click', onClick);
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointerup', onUp);
    viewEl = null;
  };
}
