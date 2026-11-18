// Unit-Tests für Auswertungen, Erfolge, Ideen und Date-Planer-Logik (reine Funktionen, ohne Browser).
// Aufruf: node tools/test-insights.mjs
import { travelStats, ratingStats, controversial, agreementByCategory, favoriteCategory, tierList, monthStreak, funFacts, nextDayMark } from '../app/js/insights.js';
import { buildContext, evaluate, newlyUnlocked, ACHIEVEMENTS } from '../app/js/achievements.js';
import { IDEAS, pickIdea, matches, inSeason, ownIdeas } from '../app/js/ideas.js';
import { dayWeather } from '../app/js/weather.js';

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` (${extra})` : ''}`); if (!ok) failed++; };

const R = (a, b) => ({ a: a == null ? null : { value: a }, b: b == null ? null : { value: b } });
let n = 0;
const E = (category, date, ra, rb, extra = {}, place = null) => ({ id: `e${++n}`, type: 'entry', createdAt: date, data: { category, title: `${category}-${n}`, date, ratings: R(ra, rb), extra, place } });
const pl = (lat, lng, countryCode) => ({ name: 'x', lat, lng, countryCode });
const home = { lat: 48.1351, lng: 11.582 };

const entries = [
  E('trip', '2024-05-01', 5, 4.5, {}, pl(41.9, 12.5, 'IT')),
  E('trip', '2024-09-10', 4.5, 5, {}, pl(38.72, -9.14, 'PT')),
  E('food', '2024-10-01', 2, 4, { again: 'yes' }, pl(48.14, 11.57, 'DE')),
  E('food', '2024-11-03', 4.5, 4.5, {}, pl(48.15, 11.58, 'DE')),
  E('date', '2024-12-12', 5, 5),
  E('date', '2025-01-20', 3, 4),
  E('recipe', '2025-02-02', 5, 4, { again: 'yes' }),
  E('movie', '2025-03-03', 4, 1.5),
];

// Reisen
const t = travelStats(entries, home);
check('Länder aus countryCode', t.countries === 3, `${t.countries}`);
check('Orte gruppiert (Raster ~5 km): Rom, Lissabon, 2× München', t.places === 4, `${t.places}`);
check('km: Hin- und Rückweg ab Zuhause für Reisen > 30 km', t.km > 5000 && t.km < 5600, `${t.km}`);

// Bewertungen
const r = ratingStats(entries);
check('Gemeinsam bewertet', r.both === 8);
check('Exakt gleich bewertet', r.exactSame === 2, `${r.exactSame}`);
check('Übereinstimmung zwischen 0 und 100', r.agreement > 50 && r.agreement < 100, `${r.agreement}`);
const hot = controversial(entries, 3);
check('Umstrittenstes zuerst (Film: 4 vs. 1,5)', hot[0].e.data.category === 'movie' && hot[0].diff === 2.5);
check('Einigkeit je Kategorie sortiert', agreementByCategory(entries)[0].agreement >= agreementByCategory(entries).at(-1).agreement);
check('Lieblingskategorie von A = Reisen', favoriteCategory(entries, 'a')?.c.key === 'trip');

// Rangliste
const tl = tierList(entries);
check('S-Stufe enthält 5/5-Date', tl.S.some((e) => e.data.category === 'date'));
check('D-Stufe leer, C hat den Film (Ø 2,75)', tl.D.length === 0 && tl.C.some((e) => e.data.category === 'movie'));

// Serien
const s = monthStreak(entries, '2025-03-20');
check('Serie: Sept. 2024 – März 2025 = 7 Monate', s.current === 7 && s.thisMonth, JSON.stringify(s));
const s2 = monthStreak(entries, '2025-04-05');
check('Serie zählt weiter, solange der Monat läuft', s2.current === 7 && !s2.thisMonth, JSON.stringify(s2));
const s3 = monthStreak(entries, '2025-06-01');
check('Serie gerissen nach leerem Monat', s3.current === 0 && s3.best === 7, JSON.stringify(s3));

// Fun Facts & Tagesmarken
check('Nächste runde Tageszahl', nextDayMark(1712).next === 2000 && nextDayMark(950).next === 1000);
const facts = funFacts({ entries, photos: 12, startDate: '2022-03-12', home, names: { a: 'Lukas', b: 'Mia' }, today: '2026-11-18' });
check('Fun Facts vorhanden und ohne Kitsch', facts.length >= 6 && !facts.some((f) => /liebe|♡|schatz/i.test(f)), `${facts.length}`);

// Erfolge
const ctx = buildContext({ entries, photos: 60, wishes: [{ data: { done: true } }, { data: { done: true } }, { data: { done: true } }], events: 5, todos: [], settings: { startDate: '2022-03-12', home }, today: '2026-11-18' });
const res = evaluate(ctx);
const by = Object.fromEntries(res.map((x) => [x.def.id, x]));
check('Alle Erfolge ausgewertet', res.length === ACHIEVEMENTS.length);
check('Weltenbummler Bronze (3 Länder)', by.laender.tier === 1 && by.laender.next === 10);
check('Fotografen Bronze (60 Fotos)', by.fotos.tier === 1);
check('Langstrecke Silber (4 Jahre)', by.jahre.tier === 2, `${by.jahre.value}`);
check('Fortschritt zwischen 0 und 1', res.every((x) => x.progress >= 0 && x.progress <= 1));
check('Neu freigeschaltet erkannt', newlyUnlocked(res, { laender: 0, fotos: 1 }).some((x) => x.def.id === 'laender') && !newlyUnlocked(res, { laender: 1, fotos: 1, jahre: 2, bucket: 1, planer: 1, serie: 2, km: 1, bewertet: 0, einig: 0 }).some((x) => x.def.id === 'fotos'));

// Ideen
const winter = new Date('2026-01-10T12:00:00');
const summer = new Date('2026-07-10T12:00:00');
check('Jahreszeiten: Badesee nur im Sommer', !inSeason(IDEAS.find((i) => i.id === 'idea:badesee'), winter) && inSeason(IDEAS.find((i) => i.id === 'idea:badesee'), summer));
check('Weihnachtsmarkt nur 20.11.–23.12.', inSeason(IDEAS.find((i) => i.id === 'idea:weihnachtsmarkt'), new Date('2026-12-01T12:00:00')) && !inSeason(IDEAS.find((i) => i.id === 'idea:weihnachtsmarkt'), new Date('2026-12-28T12:00:00')));
const home0 = IDEAS.filter((i) => matches(i, { where: 'home', budget: 0 }, summer));
check('Filter zu Hause + gratis', home0.length > 3 && home0.every((i) => i.where !== 'out' && (i.budget == null || i.budget === 0)));
const rain = IDEAS.filter((i) => matches(i, { outdoorOk: false }, summer));
check('Bei Regen keine Draußen-Ideen', rain.every((i) => i.sky !== 'out'));
const relaxed = pickIdea(IDEAS, { mood: 'kreativ', dur: 'day', where: 'home', budget: 0 }, { date: summer, rnd: () => 0 });
check('Unmögliche Kombination wird gelockert', relaxed && relaxed.relaxed.length >= 1, relaxed && relaxed.relaxed.join(','));
const own = ownIdeas({ wishes: [{ id: 'w1', data: { title: 'Dune', category: 'movie', done: false } }], entries: [E('food', '2025-01-01', 4, 4, { again: 'yes', price: '2' })] });
check('Eigene Ideen: Watchlist & Restaurant', own.some((i) => i.title === 'Schauen: Dune' && i.where === 'home') && own.some((i) => i.title.startsWith('Wieder hin:') && i.budget === 2));

// Wetter
const fc = { daily: { time: ['2026-11-19', '2026-11-20'], weather_code: [63, 1], temperature_2m_max: [9, 15], temperature_2m_min: [3, 6], precipitation_probability_max: [80, 5] } };
check('Wetter: Regen → drinnen', dayWeather(fc, '2026-11-19').outdoorOk === false && dayWeather(fc, '2026-11-19').icon === 'rain');
check('Wetter: heiter & 15° → draußen', dayWeather(fc, '2026-11-20').outdoorOk === true);
check('Wetter: unbekannter Tag → null', dayWeather(fc, '2026-12-01') === null);

console.log(failed ? `\n${failed} Test(s) fehlgeschlagen` : '\nAlle Auswertungs-Tests bestanden');
process.exit(failed ? 1 : 0);
