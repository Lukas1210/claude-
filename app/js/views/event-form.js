// Termin anlegen / bearbeiten.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openSheet, confirmDialog, toast } from '../ui/sheet.js';
import { pickPlace } from '../ui/place-picker.js';
import { get, save, remove, uuid, me } from '../store.js';
import { today, parseDate, isoDate } from '../model.js';
import { EVENT_CATEGORIES, REPEATS, REMINDERS, RSVP } from '../events.js';
import { flag } from '../geo.js';
import { go, currentRoute, back } from '../router.js';

const pad = (n) => String(n).padStart(2, '0');
const toMin = (t) => { const [h, m] = (t || '00:00').split(':').map(Number); return h * 60 + m; };
const dt = (date, time) => { const d = parseDate(date); const m = toMin(time); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d; };
const splitDT = (d) => ({ date: isoDate(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` });

function defaultStart(date) {
  if (date && date !== today()) return '19:00';
  const now = new Date();
  const h = Math.min(23, now.getHours() + 1);
  return `${pad(h)}:00`;
}

export function openEventForm({ id = null, date = null, prefill = {} } = {}) {
  const existing = id ? get(id) : null;
  const d = existing ? structuredClone(existing.data) : {};
  const startDate = d.date || date || prefill.date || today();
  const startTime = d.time || prefill.time || defaultStart(startDate);
  const endDefault = new Date(dt(startDate, startTime).getTime() + 2 * 3600 * 1000);
  const st = {
    id: existing?.id || uuid(),
    title: d.title ?? prefill.title ?? '',
    category: d.category || prefill.category || 'date',
    allDay: d.allDay ?? !!prefill.allDay,
    date: startDate,
    time: startTime,
    endDate: d.endDate || splitDT(endDefault).date,
    endTime: d.endTime || splitDT(endDefault).time,
    repeat: d.repeat || 'none',
    repeatUntil: d.repeatUntil || '',
    reminder: d.reminder !== undefined ? d.reminder : 60,
    place: d.place || prefill.place || null,
    notes: d.notes ?? prefill.notes ?? '',
    rsvp: { ...(d.rsvp || {}) },
  };
  if (!existing) st.rsvp[me()] = 'yes';
  if (st.allDay && !d.endDate) st.endDate = st.date;
  let dirty = false;
  let saved = false;

  const sheet = openSheet({
    title: existing ? 'Termin bearbeiten' : 'Neuer Termin',
    full: true,
    left: html`<button class="text-btn" data-act="cancel">Abbrechen</button>`,
    right: html`<button class="text-btn strong" data-act="save">${existing ? 'Sichern' : 'Hinzufügen'}</button>`,
    beforeClose: async () => {
      if (saved || !dirty) return true;
      return confirmDialog({ title: 'Änderungen verwerfen?', ok: 'Verwerfen', danger: true });
    },
  });
  const body = sheet.body;

  const placeCell = () => (st.place
    ? html`<span class="cell-icon blue">${icon('pin')}</span><span class="grow"><span>${st.place.countryCode ? flag(st.place.countryCode) + ' ' : ''}${st.place.name}</span>${st.place.label ? html`<small class="faint" style="display:block;font-size:13px">${st.place.label}</small>` : ''}</span><span class="chev">${icon('chevron')}</span>`
    : html`<span class="cell-icon blue">${icon('pin')}</span><span class="grow muted">Ort hinzufügen</span><span class="chev">${icon('chevron')}</span>`);

  function render() {
    body.innerHTML = String(html`
      <div class="form">
        <input class="title-input" id="et" placeholder="Was habt ihr vor?" value="${st.title}" maxlength="120" enterkeyhint="done">

        <div class="opt-row">${EVENT_CATEGORIES.map((c) => html`<button type="button" class="opt ${st.category === c.key ? 'active' : ''}" data-cat="${c.key}" style="${st.category === c.key ? `background:${c.color};color:#fff` : ''}">${c.emoji} ${c.label}</button>`)}</div>

        <div>
          <div class="group">
            <div class="cell"><span class="cell-icon amber">${icon('sun')}</span><label>Ganztägig</label><span class="toggle"><input type="checkbox" id="ad" ${st.allDay ? 'checked' : ''}><span></span></span></div>
            <div class="cell"><label style="min-width:0">Beginn</label><span class="grow"></span><input type="date" class="pill" id="sd" value="${st.date}">${st.allDay ? '' : html`<input type="time" class="pill" id="stt" value="${st.time}">`}</div>
            <div class="cell"><label style="min-width:0">Ende</label><span class="grow"></span><input type="date" class="pill" id="ed" value="${st.endDate}" min="${st.date}">${st.allDay ? '' : html`<input type="time" class="pill" id="ett" value="${st.endTime}">`}</div>
          </div>
        </div>

        <div>
          <div class="group">
            <div class="cell"><span class="cell-icon purple">${icon('repeat')}</span><label>Wiederholen</label><select id="rep">${REPEATS.map((r) => html`<option value="${r.key}" ${st.repeat === r.key ? 'selected' : ''}>${r.label}</option>`)}</select></div>
            ${st.repeat !== 'none' ? html`<div class="cell"><label style="min-width:0">Endet am</label><span class="grow faint" style="font-size:14px">${st.repeatUntil ? '' : 'nie'}</span><input type="date" class="pill" id="ru" value="${st.repeatUntil}" min="${st.date}"></div>` : ''}
            <div class="cell"><span class="cell-icon danger">${icon('bell')}</span><label>Erinnerung</label><select id="rem">${REMINDERS.map((r) => html`<option value="${r.min ?? ''}" ${st.reminder === r.min ? 'selected' : ''}>${r.label}</option>`)}</select></div>
          </div>
          <div class="group-foot">Die Erinnerung kommt vom iPhone-Kalender, sobald du den Termin dort hinzufügst.</div>
        </div>

        <div class="group">
          <button type="button" class="cell link" id="place-cell" data-act="place" style="width:100%;text-align:left">${placeCell()}</button>
          <div class="cell col"><textarea id="en" rows="3" placeholder="Notizen, Treffpunkt, Reservierung, Tickets …">${st.notes}</textarea></div>
        </div>

        <div>
          <div class="group-label">Meine Zusage</div>
          <div class="rsvp-actions" style="margin-top:0">
            ${Object.entries(RSVP).map(([k, r]) => html`<button type="button" class="${k} ${st.rsvp[me()] === k ? 'on' : ''}" data-rsvp="${k}">${r.label}</button>`)}
          </div>
        </div>

        ${existing ? html`<button type="button" class="btn danger block" data-act="delete">${icon('trash')} Termin löschen</button>` : ''}
      </div>`);
  }

  function read() {
    const q = (s) => body.querySelector(s);
    st.title = q('#et').value.trim();
    st.allDay = q('#ad').checked;
    st.date = q('#sd').value || st.date;
    st.endDate = q('#ed').value || st.date;
    if (q('#stt')) st.time = q('#stt').value || st.time;
    if (q('#ett')) st.endTime = q('#ett').value || st.endTime;
    st.repeat = q('#rep').value;
    st.repeatUntil = q('#ru') ? q('#ru').value : '';
    const rem = q('#rem').value;
    st.reminder = rem === '' ? null : Number(rem);
    st.notes = q('#en').value.trim();
  }

  // Beginn verschieben -> Ende behält die Dauer
  let durMs = dt(st.endDate, st.endTime) - dt(st.date, st.time);
  let durDays = Math.round((parseDate(st.endDate) - parseDate(st.date)) / 86400000);
  function shiftEnd() {
    if (st.allDay) {
      const e = parseDate(st.date);
      e.setDate(e.getDate() + Math.max(0, durDays));
      st.endDate = isoDate(e);
    } else {
      const e = new Date(dt(st.date, st.time).getTime() + Math.max(15 * 60000, durMs));
      ({ date: st.endDate, time: st.endTime } = splitDT(e));
    }
    const ed = body.querySelector('#ed');
    const ett = body.querySelector('#ett');
    if (ed) { ed.value = st.endDate; ed.min = st.date; }
    if (ett) ett.value = st.endTime;
  }

  body.addEventListener('input', () => { dirty = true; });
  body.addEventListener('change', (e) => {
    dirty = true;
    const id = e.target.id;
    if (id === 'sd' || id === 'stt') { read(); shiftEnd(); }
    if (id === 'ed' || id === 'ett') {
      read();
      if (dt(st.endDate, st.allDay ? '23:59' : st.endTime) < dt(st.date, st.allDay ? '00:00' : st.time)) {
        toast('Das Ende liegt vor dem Beginn', { emoji: '⏰' });
        shiftEnd();
      } else {
        durMs = dt(st.endDate, st.endTime) - dt(st.date, st.time);
        durDays = Math.round((parseDate(st.endDate) - parseDate(st.date)) / 86400000);
      }
    }
    if (id === 'ad' || id === 'rep') { read(); if (id === 'ad' && st.allDay) st.endDate = st.date; render(); }
  });
  body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'et') { e.preventDefault(); e.target.blur(); } });

  sheet.el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act], [data-cat], [data-rsvp]');
    if (!t) return;
    if (t.dataset.cat) { read(); st.category = t.dataset.cat; dirty = true; render(); return; }
    if (t.dataset.rsvp) { read(); st.rsvp[me()] = st.rsvp[me()] === t.dataset.rsvp ? null : t.dataset.rsvp; dirty = true; render(); return; }
    switch (t.dataset.act) {
      case 'cancel': sheet.close(); break;
      case 'place': {
        read();
        const p = await pickPlace({ current: st.place, title: 'Wo trefft ihr euch?' });
        if (p !== undefined) { st.place = p; dirty = true; body.querySelector('#place-cell').innerHTML = String(placeCell()); }
        break;
      }
      case 'delete': {
        const ok = await confirmDialog({ title: 'Termin löschen?', message: existing.data.repeat && existing.data.repeat !== 'none' ? 'Alle Wiederholungen werden gelöscht.' : '', ok: 'Löschen', danger: true });
        if (!ok) return;
        saved = true;
        await remove(existing.id);
        sheet.close(undefined, true);
        toast('Termin gelöscht', { emoji: '🗑️' });
        if (currentRoute()?.route.pattern === '/event/:id') back('/calendar');
        break;
      }
      case 'save': {
        read();
        if (!st.title) { toast('Wie heißt der Termin?', { emoji: '✍️' }); body.querySelector('#et').focus(); return; }
        if (st.endDate < st.date) st.endDate = st.date;
        if (!st.allDay && st.endDate === st.date && toMin(st.endTime) <= toMin(st.time)) {
          ({ date: st.endDate, time: st.endTime } = splitDT(new Date(dt(st.date, st.time).getTime() + 3600000)));
        }
        const data = {
          ...(existing?.data || {}),
          title: st.title,
          category: st.category,
          allDay: st.allDay,
          date: st.date,
          time: st.allDay ? null : st.time,
          endDate: st.endDate,
          endTime: st.allDay ? null : st.endTime,
          repeat: st.repeat,
          repeatUntil: st.repeat !== 'none' && st.repeatUntil ? st.repeatUntil : null,
          exdates: existing?.data.exdates || [],
          reminder: st.reminder,
          place: st.place,
          notes: st.notes,
          rsvp: st.rsvp,
          entries: existing?.data.entries || {},
        };
        await save('event', data, { id: st.id });
        saved = true;
        sheet.close(undefined, true);
        toast(existing ? 'Termin gespeichert' : 'Termin eingetragen', { emoji: '📅' });
        if (!existing) {
          const cur = currentRoute();
          if (cur?.route.pattern === '/calendar') cur.mod.selectDate?.(st.date);
          else go(`/calendar?d=${st.date}`);
        }
        break;
      }
    }
  });

  render();
  if (!existing && !st.title) setTimeout(() => body.querySelector('#et')?.focus({ preventScroll: true }), 450);
  return sheet;
}
