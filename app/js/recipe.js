// Rezepte: Zutaten aufbereiten und auf andere Portionen umrechnen, Schritte zerlegen.

const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
// Menge am Zeilenanfang: "2", "1,5", "0.5", "1/2", "1 1/2", "½", "1½", "2-3"
const QTY = /^\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+[.,]?\d*\s*[½¼¾⅓⅔⅛]?|[½¼¾⅓⅔⅛])(\s*[-–]\s*(\d+[.,]?\d*))?/;

function parseNum(str) {
  str = str.trim();
  let m;
  if ((m = /^(\d+)\s+(\d+)\/(\d+)$/.exec(str))) return +m[1] + +m[2] / +m[3];
  if ((m = /^(\d+)\/(\d+)$/.exec(str))) return +m[1] / +m[2];
  if ((m = /^(\d+[.,]?\d*)\s*([½¼¾⅓⅔⅛])$/.exec(str))) return parseFloat(m[1].replace(',', '.')) + FRACTIONS[m[2]];
  if (FRACTIONS[str] != null) return FRACTIONS[str];
  return parseFloat(str.replace(',', '.'));
}

export function fmtQty(n) {
  if (!isFinite(n)) return '';
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  const nice = [[0.25, '¼'], [0.5, '½'], [0.75, '¾'], [1 / 3, '⅓'], [2 / 3, '⅔']].find(([v]) => Math.abs(frac - v) < 0.02);
  if (Math.abs(frac) < 0.02) return String(whole);
  if (nice && n < 10) return whole ? `${whole}${nice[1]}` : nice[1];
  return (Math.round(n * 10) / 10).toLocaleString('de-DE', { maximumFractionDigits: 1 });
}

/** Zutatenliste aus dem Freitext: [{ qty, qtyMax, rest, raw, heading }] */
export function parseIngredients(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•*·]\s*/, '').trim())
    .filter(Boolean)
    .map((raw) => {
      if (/:$/.test(raw)) return { raw, heading: raw.replace(/:$/, '') }; // "Für die Soße:"
      const m = QTY.exec(raw);
      if (!m) return { raw, qty: null, rest: raw };
      return { raw, qty: parseNum(m[1]), qtyMax: m[3] ? parseNum(m[3]) : null, rest: raw.slice(m[0].length).trim() };
    });
}

export function scaleIngredient(ing, factor) {
  if (ing.heading || ing.qty == null || !isFinite(ing.qty)) return ing.raw;
  const q = fmtQty(ing.qty * factor);
  const qm = ing.qtyMax != null ? `–${fmtQty(ing.qtyMax * factor)}` : '';
  return `${q}${qm} ${ing.rest}`.trim();
}

/** Schritte: eine Zeile bzw. ein Absatz pro Schritt, vorhandene Nummerierung wird entfernt. */
export function parseSteps(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(\d+[.)]|[-•*·])\s*/, '').trim())
    .filter(Boolean);
}

export const isUrl = (s) => /^https?:\/\/\S+$/i.test(String(s || '').trim());

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

/** Bildschirm beim Kochen anlassen (Screen Wake Lock, wenn verfügbar). */
let wakeLock = null;
export async function setKeepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener?.('release', () => { wakeLock = null; });
      return true;
    }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch {
    return false;
  }
  return !!wakeLock;
}
export const keepAwakeSupported = () => 'wakeLock' in navigator;
export const isKeepingAwake = () => !!wakeLock;
