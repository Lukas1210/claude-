// Kategorien, Felder und Formatierungs-Helfer.
import { settings, nameOf } from './store.js';

export const APP_VERSION = '1.0.0';

export const CATEGORIES = {
  date: { key: 'date', label: 'Date', plural: 'Dates', emoji: '🌹', hint: 'Ein besonderer Abend zu zweit' },
  activity: { key: 'activity', label: 'Aktivität', plural: 'Aktivitäten', emoji: '🎡', hint: 'Ausflüge, Konzerte, Sport …' },
  food: { key: 'food', label: 'Essen', plural: 'Essen', emoji: '🍝', hint: 'Restaurants, Cafés, Gekochtes' },
  trip: { key: 'trip', label: 'Reise', plural: 'Reisen', emoji: '✈️', hint: 'Urlaube & Wochenendtrips' },
  gift: { key: 'gift', label: 'Geschenk', plural: 'Geschenke', emoji: '🎁', hint: 'Was wir uns geschenkt haben' },
};
export const CATEGORY_KEYS = Object.keys(CATEGORIES);

const MOODS = ['😍 Verliebt', '🌙 Romantisch', '🥰 Gemütlich', '😂 Lustig', '🤩 Aufregend', '😌 Entspannt', '🥳 Ausgelassen'];
const OCCASIONS = ['🎂 Geburtstag', '💞 Jahrestag', '🎄 Weihnachten', '💘 Valentinstag', '🌷 Einfach so', '🎓 Erfolg', '✨ Sonstiges'];
const TRANSPORT = ['✈️ Flug', '🚆 Zug', '🚗 Auto', '🚌 Bus', '⛴️ Fähre', '🚲 Fahrrad', '🚶 Zu Fuß'];
const MEALS = ['🥐 Frühstück', '🥗 Mittag', '🍷 Abendessen', '🍰 Café & Kuchen', '🍸 Drinks', '🏠 Selbst gekocht', '🛵 Bestellt'];

/** Kategorie-spezifische Felder. type: text | textarea | select | price | money | yesno | partner | toggle */
export const EXTRA_FIELDS = {
  date: [
    { key: 'mood', label: 'Stimmung', type: 'select', options: MOODS },
    { key: 'cost', label: 'Kosten', type: 'money' },
  ],
  activity: [
    { key: 'mood', label: 'Stimmung', type: 'select', options: MOODS },
    { key: 'cost', label: 'Kosten', type: 'money' },
  ],
  food: [
    { key: 'meal', label: 'Art', type: 'select', options: MEALS },
    { key: 'cuisine', label: 'Küche', type: 'text', placeholder: 'z. B. Italienisch' },
    { key: 'dish', label: 'Highlight', type: 'text', placeholder: 'Bestes Gericht' },
    { key: 'price', label: 'Preis', type: 'price' },
    { key: 'again', label: 'Wieder hin?', type: 'yesno' },
  ],
  trip: [
    { key: 'transport', label: 'Anreise', type: 'select', options: TRANSPORT },
    { key: 'highlights', label: 'Highlights', type: 'textarea', placeholder: 'Was war am schönsten?' },
  ],
  gift: [
    { key: 'from', label: 'Von', type: 'partner' },
    { key: 'occasion', label: 'Anlass', type: 'select', options: OCCASIONS },
    { key: 'handmade', label: 'Selbst gemacht', type: 'toggle' },
    { key: 'cost', label: 'Preis', type: 'money' },
  ],
};

export const MILESTONE_EMOJIS = ['💞', '💋', '💌', '🌹', '💍', '🏡', '🔑', '🐶', '✈️', '🎉', '👶', '🎓', '🌅', '⭐️', '🥂', '📸'];

export const WISH_CATEGORIES = [
  { key: 'trip', emoji: '✈️', label: 'Reise' },
  { key: 'food', emoji: '🍝', label: 'Essen' },
  { key: 'activity', emoji: '🎡', label: 'Erlebnis' },
  { key: 'date', emoji: '🌹', label: 'Date' },
  { key: 'other', emoji: '✨', label: 'Sonstiges' },
];

// ---------- Bewertungen ----------
export function ratingValue(entry, slot) {
  const r = entry?.data?.ratings?.[slot];
  return r && typeof r.value === 'number' && r.value > 0 ? r.value : null;
}

export function avgRating(entry) {
  const vals = ['a', 'b'].map((s) => ratingValue(entry, s)).filter((v) => v != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export const fmtRating = (v) => (v == null ? '–' : (Math.round(v * 10) / 10).toLocaleString('de-DE', { maximumFractionDigits: 1 }));

// ---------- Datum ----------
/** 'YYYY-MM-DD' als lokales Datum interpretieren. */
export function parseDate(s) {
  if (!s) return null;
  if (s instanceof Date) return s;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

export function isoDate(d = new Date()) {
  const dt = d instanceof Date ? d : parseDate(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

export const today = () => isoDate(new Date());

export function fmtDate(s, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const d = parseDate(s);
  return d ? d.toLocaleDateString('de-DE', opts) : '';
}
export const fmtDateLong = (s) => fmtDate(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const fmtMonthYear = (s) => fmtDate(s, { month: 'long', year: 'numeric' });
export const fmtDayMonth = (s) => fmtDate(s, { day: 'numeric', month: 'long' });

export function fmtRange(a, b) {
  if (!b || b === a) return fmtDate(a);
  const da = parseDate(a), db = parseDate(b);
  if (!da || !db) return fmtDate(a);
  if (da.getFullYear() === db.getFullYear()) {
    if (da.getMonth() === db.getMonth()) return `${da.getDate()}.–${fmtDate(b)}`;
    return `${fmtDate(a, { day: 'numeric', month: 'short' })} – ${fmtDate(b)}`;
  }
  return `${fmtDate(a)} – ${fmtDate(b)}`;
}

export function daysBetween(a, b) {
  const da = parseDate(a), db = parseDate(b);
  const ua = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const ub = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((ub - ua) / 86400000);
}

/** Jahre/Monate/Tage zwischen zwei Daten. */
export function ymd(from, to = new Date()) {
  const a = parseDate(from), b = parseDate(to);
  let y = b.getFullYear() - a.getFullYear();
  let m = b.getMonth() - a.getMonth();
  let d = b.getDate() - a.getDate();
  if (d < 0) {
    m -= 1;
    d += new Date(b.getFullYear(), b.getMonth(), 0).getDate();
  }
  if (m < 0) { y -= 1; m += 12; }
  return { y, m, d };
}

/** Nächstes Vorkommen eines jährlichen Datums (heute zählt). */
export function nextAnnual(dateStr, from = new Date()) {
  const d = parseDate(dateStr);
  if (!d) return null;
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let n = new Date(base.getFullYear(), d.getMonth(), d.getDate());
  if (n < base) n = new Date(base.getFullYear() + 1, d.getMonth(), d.getDate());
  return n;
}

export const relDays = (n) => (n === 0 ? 'heute' : n === 1 ? 'morgen' : n === -1 ? 'gestern' : n > 0 ? `in ${n} Tagen` : `vor ${-n} Tagen`);

export function fmtNumber(n) {
  return Number(n).toLocaleString('de-DE');
}

export function fmtMoney(v) {
  if (v == null || v === '') return '';
  const n = Number(String(v).replace(',', '.'));
  if (isNaN(n)) return String(v);
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 });
}

// ---------- Einträge ----------
export function entryDate(it) {
  return it?.data?.date || it?.data?.takenAt || it?.createdAt?.slice(0, 10);
}

export function sortByDateDesc(list) {
  return list.slice().sort((x, y) => String(entryDate(y)).localeCompare(String(entryDate(x))) || String(y.createdAt).localeCompare(String(x.createdAt)));
}

export function catOf(entry) {
  return CATEGORIES[entry?.data?.category] || CATEGORIES.date;
}

export function giftLine(entry) {
  const from = entry.data.extra?.from;
  if (!from) return '';
  const to = from === 'a' ? 'b' : 'a';
  return `${nameOf(from)} → ${nameOf(to)}`;
}

export function startDate() {
  return settings().startDate;
}

// ---------- Kleine Liebesgrüße für die Startseite ----------
export const LOVE_LINES = [
  'Mit dir ist jeder Tag ein kleines Abenteuer.',
  'Zuhause ist da, wo du bist.',
  'Lieblingsmensch – heute, morgen, immer.',
  'Die schönsten Erinnerungen haben wir noch vor uns.',
  'Du und ich – das ist meine liebste Geschichte.',
  'Ich würde dich jedes Mal wieder finden.',
  'Mit dir ist sogar Alltag schön.',
  'Danke für jedes Lachen, das wir teilen.',
  'Wir sammeln Momente, keine Dinge.',
  'Hand in Hand ist der schönste Weg.',
  'Du bist mein Lieblingsplatz auf der Welt.',
  'Ein Leben ist zu kurz, um es nicht mit dir zu verbringen.',
];
