// Kalender: Termine, Wiederholungen, besondere Tage und Export für den iPhone-Kalender (.ics).
import { all, settings, nameOf } from './store.js';
import { parseDate, isoDate, daysBetween, fmtDate, today } from './model.js';

export const EVENT_CATEGORIES = [
  { key: 'date', label: 'Date', emoji: '🌹', color: '#ff375f' },
  { key: 'meet', label: 'Treffen', emoji: '🤝', color: '#0a84ff' },
  { key: 'food', label: 'Essen', emoji: '🍝', color: '#ff9f0a' },
  { key: 'activity', label: 'Aktivität', emoji: '🎡', color: '#30d158' },
  { key: 'trip', label: 'Reise', emoji: '✈️', color: '#40c8e0' },
  { key: 'people', label: 'Familie & Freunde', emoji: '👨‍👩‍👧', color: '#bf5af2' },
  { key: 'other', label: 'Sonstiges', emoji: '📌', color: '#8e8e93' },
];
export const eventCat = (key) => EVENT_CATEGORIES.find((c) => c.key === key) || EVENT_CATEGORIES[EVENT_CATEGORIES.length - 1];

/** Passende Erlebnis-Kategorie, wenn ein Termin als Erinnerung festgehalten wird. */
export const ENTRY_CATEGORY_FOR = { date: 'date', meet: 'activity', food: 'food', activity: 'activity', trip: 'trip', people: 'activity', other: 'activity' };

export const REPEATS = [
  { key: 'none', label: 'Nie' },
  { key: 'daily', label: 'Täglich' },
  { key: 'weekly', label: 'Jede Woche' },
  { key: 'biweekly', label: 'Alle 2 Wochen' },
  { key: 'monthly', label: 'Jeden Monat' },
  { key: 'yearly', label: 'Jedes Jahr' },
];
export const repeatLabel = (key) => (REPEATS.find((r) => r.key === key) || REPEATS[0]).label;

export const REMINDERS = [
  { min: null, label: 'Keine' },
  { min: 0, label: 'Zur Startzeit' },
  { min: 15, label: '15 Minuten vorher' },
  { min: 60, label: '1 Stunde vorher' },
  { min: 180, label: '3 Stunden vorher' },
  { min: 1440, label: '1 Tag vorher' },
  { min: 10080, label: '1 Woche vorher' },
];
export const reminderLabel = (min) => (REMINDERS.find((r) => r.min === min) || REMINDERS[0]).label;

export const RSVP = {
  yes: { label: 'Bin dabei', short: 'Zugesagt', icon: '✓' },
  maybe: { label: 'Vielleicht', short: 'Vielleicht', icon: '?' },
  no: { label: 'Kann nicht', short: 'Abgesagt', icon: '✕' },
};

// ---------- Datum & Zeit ----------
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const pad = (n) => String(n).padStart(2, '0');

export function fmtTime(t) { return t ? t.slice(0, 5) : ''; }

export function eventDuration(d) {
  return Math.max(0, daysBetween(d.date, d.endDate || d.date));
}

/** Liefert alle Startdaten (YYYY-MM-DD) von Vorkommen, die den Zeitraum [from, to] berühren. */
export function occurrencesInRange(ev, from, to) {
  const d = ev.data;
  if (!d.date) return [];
  const dur = eventDuration(d);
  const start = parseDate(d.date);
  const fromD = parseDate(from), toD = parseDate(to);
  const until = d.repeat && d.repeat !== 'none' && d.repeatUntil ? parseDate(d.repeatUntil) : null;
  const ex = new Set(d.exdates || []);
  const out = [];
  const push = (occ) => {
    const s = isoDate(occ);
    if (ex.has(s)) return;
    const e = addDays(occ, dur);
    if (e >= fromD && occ <= toD) out.push(s);
  };
  const rep = d.repeat || 'none';
  if (rep === 'none') { push(start); return out; }
  let guard = 0;
  if (rep === 'daily' || rep === 'weekly' || rep === 'biweekly') {
    const step = rep === 'daily' ? 1 : rep === 'weekly' ? 7 : 14;
    // direkt in die Nähe des Zeitraums springen
    let k = Math.max(0, Math.floor((daysBetween(start, fromD) - dur) / step));
    for (;;) {
      const occ = addDays(start, k * step);
      if (occ > toD || (until && occ > until) || guard++ > 2000) break;
      push(occ);
      k++;
    }
  } else if (rep === 'monthly') {
    const day = start.getDate();
    let k = Math.max(0, (fromD.getFullYear() - start.getFullYear()) * 12 + fromD.getMonth() - start.getMonth() - 1);
    for (;;) {
      const occ = new Date(start.getFullYear(), start.getMonth() + k, day);
      k++;
      if (occ.getDate() !== day) { if (guard++ > 2000) break; continue; } // z. B. 31. im Februar überspringen
      if (occ > toD || (until && occ > until) || guard++ > 2000) break;
      push(occ);
    }
  } else if (rep === 'yearly') {
    let y = Math.max(start.getFullYear(), fromD.getFullYear() - 1);
    for (;;) {
      const occ = new Date(y, start.getMonth(), start.getDate());
      y++;
      if (occ.getMonth() !== start.getMonth()) { if (guard++ > 200) break; continue; } // 29. Februar
      if (occ > toD || (until && occ > until) || guard++ > 200) break;
      if (occ >= start) push(occ);
    }
  }
  return out;
}

/** Alle Termin-Vorkommen im Zeitraum, sortiert. */
export function expandEvents(from, to) {
  const list = [];
  for (const ev of all('event')) {
    for (const occ of occurrencesInRange(ev, from, to)) {
      const dur = eventDuration(ev.data);
      list.push({ ev, occ, occEnd: isoDate(addDays(parseDate(occ), dur)) });
    }
  }
  return list.sort((a, b) => a.occ.localeCompare(b.occ) || (a.ev.data.allDay ? -1 : 0) - (b.ev.data.allDay ? -1 : 0) || String(a.ev.data.time || '').localeCompare(String(b.ev.data.time || '')));
}

/** Vorkommen an einem bestimmten Tag (inkl. mehrtägiger Termine). */
export function occurrencesOnDay(day) {
  return expandEvents(day, day);
}

export function occStart(ev, occ) {
  const d = parseDate(occ);
  if (!ev.data.allDay && ev.data.time) {
    const [h, m] = ev.data.time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d;
}

export function occEnd(ev, occ) {
  const d = addDays(parseDate(occ), eventDuration(ev.data));
  if (ev.data.allDay || !ev.data.endTime) { d.setHours(23, 59, 59, 0); return d; }
  const [h, m] = ev.data.endTime.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Nächste anstehende (oder gerade laufende) Termine ab jetzt. */
export function upcoming(limit = 5, days = 120) {
  const now = new Date();
  const list = expandEvents(today(), isoDate(addDays(now, days)));
  return list.filter((o) => occEnd(o.ev, o.occ) >= now).slice(0, limit);
}

// ---------- Anzeige ----------
export function fmtWhen(ev, occ, { long = true } = {}) {
  const d = ev.data;
  const dur = eventDuration(d);
  const endDay = isoDate(addDays(parseDate(occ), dur));
  const dayFmt = long ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short' };
  if (d.allDay) {
    if (!dur) return `${fmtDate(occ, dayFmt)} · ganztägig`;
    return `${fmtDate(occ, { day: 'numeric', month: 'short' })} – ${fmtDate(endDay, { day: 'numeric', month: 'short', year: 'numeric' })} · ganztägig`;
  }
  const t = fmtTime(d.time);
  const e = fmtTime(d.endTime);
  if (!dur) return `${fmtDate(occ, dayFmt)} · ${t}${e ? `–${e}` : ''} Uhr`;
  return `${fmtDate(occ, { weekday: 'short', day: 'numeric', month: 'short' })}, ${t} – ${fmtDate(endDay, { weekday: 'short', day: 'numeric', month: 'short' })}, ${e || t} Uhr`;
}

export function relativeDay(occ) {
  const n = daysBetween(today(), occ);
  if (n === 0) return 'Heute';
  if (n === 1) return 'Morgen';
  if (n === -1) return 'Gestern';
  if (n > 1 && n < 7) return fmtDate(occ, { weekday: 'long' });
  return fmtDate(occ, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function countdownText(ev, occ) {
  const now = new Date();
  const s = occStart(ev, occ), e = occEnd(ev, occ);
  if (now >= s && now <= e) return 'Läuft gerade';
  if (now > e) return 'Vorbei';
  const days = daysBetween(today(), occ);
  if (days === 0) {
    const mins = Math.round((s - now) / 60000);
    if (ev.data.allDay || mins <= 0) return 'Heute';
    if (mins < 60) return `In ${mins} Min.`;
    return `In ${Math.round(mins / 60)} Std.`;
  }
  if (days === 1) return 'Morgen';
  return `In ${days} Tagen`;
}

// ---------- Besondere Tage (Geburtstage, Jahrestage) ----------
export function specialDays(from, to) {
  const s = settings();
  const out = [];
  const fromD = parseDate(from), toD = parseDate(to);
  const add = (dateStr, emoji, title, yearly = true) => {
    if (!dateStr) return;
    if (!yearly) { if (dateStr >= from && dateStr <= to) out.push({ date: dateStr, emoji, title }); return; }
    const base = parseDate(dateStr);
    for (let y = fromD.getFullYear(); y <= toD.getFullYear(); y++) {
      const d = new Date(y, base.getMonth(), base.getDate());
      if (d.getMonth() !== base.getMonth() || d < fromD || d > toD || y < base.getFullYear()) continue;
      const n = y - base.getFullYear();
      out.push({ date: isoDate(d), emoji, title: typeof title === 'function' ? title(n) : title });
    }
  };
  if (s.startDate) add(s.startDate, '💞', (n) => (n === 0 ? 'Unser Tag' : `${n}. Jahrestag`));
  for (const slot of ['a', 'b']) if (s.birthdays?.[slot]) add(s.birthdays[slot], '🎂', `Geburtstag ${nameOf(slot)}`);
  for (const a of s.anniversaries || []) add(a.date, a.emoji || '📅', a.title);
  return out.filter((x) => x.date >= from && x.date <= to).sort((a, b) => a.date.localeCompare(b.date));
}


// ---------- Export (.ics) ----------
const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsDate = (iso) => iso.replace(/-/g, '');
const icsDateTime = (iso, time) => `${icsDate(iso)}T${(time || '00:00').replace(':', '')}00`;
function fold(line) {
  const out = [];
  let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ' ' + rest.slice(74); }
  out.push(rest);
  return out.join('\r\n');
}

export function toICS(ev) {
  const d = ev.data;
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const endDate = d.endDate || d.date;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Couple Journal//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT', `UID:${ev.id}@couple-journal`, `DTSTAMP:${stamp}`];
  if (d.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${icsDate(d.date)}`);
    lines.push(`DTEND;VALUE=DATE:${icsDate(isoDate(addDays(parseDate(endDate), 1)))}`);
  } else {
    lines.push(`DTSTART:${icsDateTime(d.date, d.time)}`);
    lines.push(`DTEND:${icsDateTime(endDate, d.endTime || d.time)}`);
  }
  lines.push(`SUMMARY:${icsEsc(d.title)}`);
  if (d.place) {
    const loc = d.place.label ? `${d.place.name}, ${d.place.label}` : d.place.name;
    lines.push(`LOCATION:${icsEsc(loc)}`);
    if (d.place.lat != null) lines.push(`GEO:${d.place.lat};${d.place.lng}`);
  }
  const desc = [d.notes, 'Aus Couple Journal'].filter(Boolean).join('\n\n');
  lines.push(`DESCRIPTION:${icsEsc(desc)}`);
  const rr = { daily: 'FREQ=DAILY', weekly: 'FREQ=WEEKLY', biweekly: 'FREQ=WEEKLY;INTERVAL=2', monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY' }[d.repeat];
  if (rr) {
    lines.push(`RRULE:${rr}${d.repeatUntil ? `;UNTIL=${icsDate(d.repeatUntil)}T235959` : ''}`);
    for (const x of d.exdates || []) lines.push(d.allDay ? `EXDATE;VALUE=DATE:${icsDate(x)}` : `EXDATE:${icsDateTime(x, d.time)}`);
  }
  if (d.reminder != null) {
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(d.title)}`, d.reminder === 0 ? 'TRIGGER:PT0M' : `TRIGGER:-PT${d.reminder}M`, 'END:VALARM');
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function icsFileName(ev) {
  const base = (ev.data.title || 'termin').toLowerCase().replace(/[^a-z0-9äöüß]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'termin';
  return `${base}.ics`;
}
