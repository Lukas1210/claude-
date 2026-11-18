// Auswertungen als reine Rechenfunktionen (ohne DOM): Reisen, Bewertungen, Bestwerte, Fun Facts.
// Genutzt von Startseite und Statistik; später auch von Duell, Erfolgen und Rückblick.
import { distanceKm } from './geo.js';
import { ratingValue, avgRating, daysBetween, fmtNumber, fmtRating, fmtDate, CATEGORIES } from './model.js';

export const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const firstDate = (g) => g.entries.reduce((m, e) => (String(e.data.date) < m ? String(e.data.date) : m), '9999');

/** Einträge mit Ort, gruppiert nach Orten (gerundet auf ca. 5 km). */
export function placeGroups(entries) {
  const groups = new Map();
  for (const e of entries) {
    const p = e.data.place;
    if (!p || p.lat == null || p.lng == null) continue;
    const key = `${Math.round(p.lat * 20) / 20},${Math.round(p.lng * 20) / 20}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { key, lat: p.lat, lng: p.lng, entries: [], trip: false, place: p }));
    g.entries.push(e);
    if (e.data.category === 'trip') g.trip = true;
  }
  return [...groups.values()];
}

/** Länder, Orte und gereiste Kilometer (Hin- und Rückweg von Zuhause, sonst Reisen nacheinander). */
export function travelStats(entries, home) {
  const groups = placeGroups(entries);
  const codes = new Set(groups.map((g) => g.place.countryCode).filter(Boolean));
  const trips = groups.filter((g) => g.trip).sort((a, b) => firstDate(a).localeCompare(firstDate(b)));
  let km = 0;
  if (home?.lat != null) {
    for (const t of trips) { const d = distanceKm(home, t); if (d > 30) km += d * 2; }
  } else {
    for (let i = 1; i < trips.length; i++) km += distanceKm(trips[i - 1], trips[i]);
  }
  return { countries: codes.size, countryCodes: [...codes], places: groups.length, trips: trips.length, km: Math.round(km) };
}

/** Bewertungen beider Personen im Vergleich. */
export function ratingStats(entries) {
  const ra = entries.map((e) => ratingValue(e, 'a')).filter((v) => v != null);
  const rb = entries.map((e) => ratingValue(e, 'b')).filter((v) => v != null);
  const both = entries.filter((e) => ratingValue(e, 'a') != null && ratingValue(e, 'b') != null);
  const diffs = both.map((e) => Math.abs(ratingValue(e, 'a') - ratingValue(e, 'b')));
  const diff = mean(diffs);
  return {
    avgA: mean(ra), avgB: mean(rb), countA: ra.length, countB: rb.length,
    both: both.length, diff,
    agreement: diff != null ? Math.round((1 - diff / 4.5) * 100) : null,
    exactSame: diffs.filter((d) => d === 0).length,
    avg: mean(entries.map(avgRating).filter((v) => v != null)),
  };
}

/** Bestbewerteter Eintrag (optional nur einer Kategorie). */
export function bestEntry(entries, category = null) {
  return entries
    .filter((e) => (!category || e.data.category === category) && avgRating(e) != null)
    .sort((a, b) => avgRating(b) - avgRating(a) || String(b.data.date).localeCompare(String(a.data.date)))[0] || null;
}

/** Monat mit den meisten Einträgen: { key: 'YYYY-MM', n }. */
export function busiestMonth(entries) {
  const map = new Map();
  for (const e of entries) { const k = String(e.data.date || '').slice(0, 7); if (k.length === 7) map.set(k, (map.get(k) || 0) + 1); }
  const top = [...map.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0];
  return top ? { key: top[0], n: top[1] } : null;
}

/** Nächste runde Tageszahl (500er-Schritte). */
export function nextDayMark(days) {
  const step = days < 1000 ? 100 : 500;
  const next = Math.floor(days / step) * step + step;
  return { next, inDays: next - days };
}

const EARTH_KM = 40075;

/** Kurze, sachliche Fakten aus euren Daten – für die Startseite. */
export function funFacts({ entries = [], photos = 0, startDate = null, home = null, names = { a: 'A', b: 'B' }, today }) {
  const facts = [];
  if (startDate && today) {
    const days = daysBetween(startDate, today);
    if (days > 0) {
      const m = nextDayMark(days);
      facts.push(`Heute ist Tag ${fmtNumber(days)}. In ${fmtNumber(m.inDays)} ${m.inDays === 1 ? 'Tag' : 'Tagen'} knackt ihr die ${fmtNumber(m.next)}.`);
    }
  }
  const t = travelStats(entries, home);
  if (t.km > 0) {
    facts.push(t.km >= EARTH_KM
      ? `Ihr seid zusammen ${fmtNumber(t.km)} km gereist – mehr als einmal um die Erde.`
      : `Ihr seid zusammen ${fmtNumber(t.km)} km gereist – ${Math.round((t.km / EARTH_KM) * 100)} % einer Erdumrundung.`);
  }
  if (t.countries > 1) facts.push(`${t.countries} Länder abgehakt. Bleiben noch ${195 - t.countries}.`);
  const r = ratingStats(entries);
  if (r.avgA != null && r.avgB != null && r.countA > 2 && r.countB > 2) {
    const d = r.avgA - r.avgB;
    if (Math.abs(d) >= 0.15) {
      const [hi, lo] = d > 0 ? ['a', 'b'] : ['b', 'a'];
      facts.push(`${names[hi]} vergibt im Schnitt ${fmtRating(Math.abs(d))} Herzen mehr als ${names[lo]}.`);
    } else facts.push('Ihr bewertet fast identisch – im Schnitt kaum ein halbes Herz Unterschied.');
  }
  if (r.agreement != null && r.both >= 3) facts.push(`Bei ${r.both} gemeinsam bewerteten Erlebnissen seid ihr euch zu ${r.agreement} % einig.`);
  const food = bestEntry(entries, 'food');
  if (food) facts.push(`Bestes Essen bisher: ${food.data.title} mit ${fmtRating(avgRating(food))} Herzen.`);
  const recipes = entries.filter((e) => e.data.category === 'recipe');
  const bestRecipe = bestEntry(recipes);
  if (recipes.length > 1 && bestRecipe) facts.push(`${recipes.length} Rezepte gekocht. Spitzenreiter: ${bestRecipe.data.title}.`);
  const bm = busiestMonth(entries);
  if (bm && bm.n > 1) facts.push(`Euer stärkster Monat: ${fmtDate(`${bm.key}-01`, { month: 'long', year: 'numeric' })} mit ${bm.n} Erlebnissen.`);
  if (photos >= 10) facts.push(`${fmtNumber(photos)} Fotos gesammelt.`);
  const gifts = entries.filter((e) => e.data.category === 'gift');
  if (gifts.length > 1) {
    const ga = gifts.filter((g) => g.data.extra?.from === 'a').length, gb = gifts.filter((g) => g.data.extra?.from === 'b').length;
    facts.push(`Geschenke-Stand: ${names.a} ${ga} · ${names.b} ${gb}.`);
  }
  const cats = Object.values(CATEGORIES).map((c) => ({ c, n: entries.filter((e) => e.data.category === c.key).length })).sort((a, b) => b.n - a.n);
  if (cats[0]?.n > 2) facts.push(`Am häufigsten tragt ihr ${cats[0].c.plural} ein: ${cats[0].n} Stück.`);
  return facts;
}

// ---------- Duell & Rangliste ----------

/** Erlebnisse, bei denen ihr am weitesten auseinanderliegt. */
export function controversial(entries, n = 5) {
  return entries
    .map((e) => ({ e, a: ratingValue(e, 'a'), b: ratingValue(e, 'b') }))
    .filter((x) => x.a != null && x.b != null && x.a !== x.b)
    .map((x) => ({ ...x, diff: Math.abs(x.a - x.b) }))
    .sort((x, y) => y.diff - x.diff || String(y.e.data.date).localeCompare(String(x.e.data.date)))
    .slice(0, n);
}

/** Einigkeit je Kategorie (nur Kategorien mit mindestens einem gemeinsam bewerteten Eintrag). */
export function agreementByCategory(entries) {
  return Object.values(CATEGORIES).map((c) => {
    const r = ratingStats(entries.filter((e) => e.data.category === c.key));
    return { c, both: r.both, agreement: r.agreement };
  }).filter((x) => x.both > 0).sort((a, b) => b.agreement - a.agreement);
}

/** Lieblingskategorie einer Person: höchster Schnitt bei mindestens `min` eigenen Bewertungen. */
export function favoriteCategory(entries, slot, min = 2) {
  let best = null;
  for (const c of Object.values(CATEGORIES)) {
    const vals = entries.filter((e) => e.data.category === c.key).map((e) => ratingValue(e, slot)).filter((v) => v != null);
    if (vals.length < min) continue;
    const avg = mean(vals);
    if (!best || avg > best.avg) best = { c, avg, n: vals.length };
  }
  return best;
}

export const TIERS = [
  { key: 'S', min: 4.75, label: 'Legendär' },
  { key: 'A', min: 4, label: 'Top' },
  { key: 'B', min: 3, label: 'Gut' },
  { key: 'C', min: 2, label: 'Geht so' },
  { key: 'D', min: 0, label: 'Lieber nicht' },
];

/** Rangliste nach Ø-Herzen: { S: [...], A: [...], … } (bestbewertete zuerst). */
export function tierList(entries) {
  const out = Object.fromEntries(TIERS.map((t) => [t.key, []]));
  for (const e of entries) {
    const avg = avgRating(e);
    if (avg == null) continue;
    out[TIERS.find((t) => avg >= t.min).key].push(e);
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => avgRating(b) - avgRating(a) || String(b.data.date).localeCompare(String(a.data.date)));
  return out;
}

// ---------- Serien ----------
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Monate in Folge mit mindestens einem Erlebnis. current zählt bis zum Vormonat weiter, solange dieser Monat noch läuft. */
export function monthStreak(entries, todayStr) {
  const months = new Set(entries.map((e) => String(e.data.date || '').slice(0, 7)).filter((k) => k.length === 7));
  const t = todayStr ? new Date(`${todayStr}T12:00:00`) : new Date();
  const cur = new Date(t.getFullYear(), t.getMonth(), 1);
  const thisMonth = months.has(monthKey(cur));
  let current = 0;
  const d = new Date(cur);
  if (!thisMonth) d.setMonth(d.getMonth() - 1);
  while (months.has(monthKey(d))) { current++; d.setMonth(d.getMonth() - 1); }
  let best = 0, run = 0, prev = null;
  for (const k of [...months].sort()) {
    const [y, m] = k.split('-').map(Number);
    const idx = y * 12 + m;
    run = prev != null && idx === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = idx;
  }
  return { current, best, thisMonth };
}
