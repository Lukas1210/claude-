// Date-Planer: Wann ist es wieder Zeit für etwas Besonderes? Letztes Date, Anlässe und freie Abende.
import { all, settings, nameOf } from './store.js';
import { today, parseDate, isoDate, daysBetween, nextAnnual, fmtDate } from './model.js';
import { expandEvents, occStart, occEnd } from './events.js';

export const SPECIAL_ENTRY = ['date', 'activity', 'food', 'trip'];
export const SPECIAL_EVENT = ['date', 'food', 'cook', 'activity', 'trip'];
export const RHYTHMS = [
  { days: 7, label: 'Jede Woche' },
  { days: 14, label: 'Alle 2 Wochen' },
  { days: 30, label: 'Jeden Monat' },
  { days: 0, label: 'Aus' },
];
export const DEFAULT_RHYTHM = 14;
export const rhythm = () => {
  const v = settings().dateRhythm;
  return v === undefined || v === null ? DEFAULT_RHYTHM : v;
};

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const declined = (ev) => ev.data.rsvp && Object.values(ev.data.rsvp).includes('no');

/** Letztes gemeinsames Erlebnis: Eintrag (Date, Aktivität, Essen, Reise) oder vergangener Termin. */
export function lastSpecial(t = today()) {
  let best = null;
  for (const e of all('entry')) {
    if (!SPECIAL_ENTRY.includes(e.data.category)) continue;
    const d = e.data.category === 'trip' && e.data.endDate ? e.data.endDate : e.data.date;
    if (d && d <= t && (!best || d > best.date)) best = { date: d, title: e.data.title, kind: 'entry', id: e.id };
  }
  for (const o of expandEvents(isoDate(addDays(parseDate(t), -180)), t)) {
    if (!SPECIAL_EVENT.includes(o.ev.data.category) || o.occ > t || declined(o.ev)) continue;
    if (!best || o.occ > best.date) best = { date: o.occ, title: o.ev.data.title, kind: 'event', id: o.ev.id };
  }
  return best;
}

/** Nächster geplanter besonderer Termin (ohne Absage). */
export function nextSpecial(t = today(), days = 60) {
  const now = new Date();
  return expandEvents(t, isoDate(addDays(parseDate(t), days)))
    .find((o) => SPECIAL_EVENT.includes(o.ev.data.category) && occEnd(o.ev, o.occ) >= now && !declined(o.ev)) || null;
}

/** Ist rund um ein Datum (± Tage) schon etwas Besonderes geplant? */
export function planAround(date, spread = 2) {
  const d = parseDate(date);
  return expandEvents(isoDate(addDays(d, -spread)), isoDate(addDays(d, spread)))
    .some((o) => SPECIAL_EVENT.includes(o.ev.data.category) && !declined(o.ev));
}

/** Anstehende Anlässe: Jahrestag, Geburtstage, eigene Jahrestage, Valentinstag. */
export function upcomingOccasions(t = today(), within = 21) {
  const s = settings();
  const base = parseDate(t);
  const list = [];
  const add = (what, icon, d) => {
    const days = daysBetween(base, d);
    if (days >= 0 && days <= within) list.push({ what, icon, date: isoDate(d), days });
  };
  if (s.startDate) {
    const next = nextAnnual(s.startDate, base);
    const years = next.getFullYear() - parseDate(s.startDate).getFullYear();
    if (years > 0) add(`${years}. Jahrestag`, 'ring', next);
  }
  for (const slot of ['a', 'b']) if (s.birthdays?.[slot]) add(`Geburtstag von ${nameOf(slot)}`, 'cake', nextAnnual(s.birthdays[slot], base));
  for (const a of s.anniversaries || []) if (a.date) add(a.title, 'star', nextAnnual(a.date, base));
  add('Valentinstag', 'gift', nextAnnual(`${base.getFullYear()}-02-14`, base));
  return list.sort((a, b) => a.days - b.days);
}

/**
 * Hinweis für die Startseite – oder null.
 * kind 'occasion': ein Anlass steht an und es ist noch nichts geplant.
 * kind 'rhythm': das letzte Date ist länger her als euer Date-Rhythmus.
 */
export function dateNudge(t = today()) {
  const occ = upcomingOccasions(t, 21).find((o) => !planAround(o.date));
  if (occ) return { kind: 'occasion', occasion: occ };
  const r = rhythm();
  if (!r) return null;
  if (nextSpecial(t, Math.max(r, 7))) return null;
  const last = lastSpecial(t);
  const since = last ? daysBetween(last.date, t) : null;
  if (since != null && since < r) return null;
  return { kind: 'rhythm', since, last, rhythm: r };
}

/**
 * Freie Zeitfenster in den nächsten `days` Tagen: Abende (18–23 Uhr ohne Termin) und
 * freie Wochenendtage. Freitag/Samstag und Wochenenden werden bevorzugt.
 */
export function freeSlots(t = today(), { days = 14, max = 3, now = new Date() } = {}) {
  const start = parseDate(t);
  const occs = expandEvents(t, isoDate(addDays(start, days)));
  const out = [];
  for (let i = 0; i <= days; i++) {
    const day = addDays(start, i);
    const ds = isoDate(day);
    const at = (h, m = 0) => { const x = new Date(day); x.setHours(h, m, 0, 0); return x; };
    if (i === 0 && now > at(17, 30)) continue;
    const onDay = occs.filter((o) => o.occ <= ds && o.occEnd >= ds);
    const busy = (a, b) => onDay.some((o) => occStart(o.ev, o.occ) < b && occEnd(o.ev, o.occ) > a);
    const wd = day.getDay();
    if ((wd === 0 || wd === 6) && !busy(at(10), at(23))) out.push({ date: ds, start: '11:00', kind: 'day', score: 3 - i * 0.04 });
    else if (!busy(at(18), at(23))) out.push({ date: ds, start: '19:30', kind: 'evening', score: (wd === 5 || wd === 6 ? 2.4 : 1) - i * 0.04 });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, max).sort((a, b) => a.date.localeCompare(b.date));
}

export function slotLabel(slot, t = today()) {
  const rel = slot.date === t ? 'Heute' : slot.date === isoDate(addDays(parseDate(t), 1)) ? 'Morgen' : fmtDate(slot.date, { weekday: 'short', day: 'numeric', month: 'numeric' });
  return `${rel} · ${slot.kind === 'day' ? 'ganzer Tag' : 'abends'}`;
}

/** Nächster Samstag (heute zählt, wenn heute Samstag ist). */
export function nextSaturday(t = today()) {
  const d = parseDate(t);
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  return isoDate(d);
}
