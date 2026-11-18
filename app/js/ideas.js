// Date-Ideen: kuratierte Bibliothek + eure eigenen Ideen (Bucket-Liste, Restaurants & Rezepte „nochmal“).
// Filter nach Ort (zu Hause/unterwegs), Wetter (drinnen/draußen), Budget, Stimmung, Dauer und Jahreszeit.

export const MOODS = [
  { key: 'gemuetlich', label: 'Gemütlich', icon: 'moon' },
  { key: 'aktiv', label: 'Aktiv', icon: 'bolt' },
  { key: 'abenteuer', label: 'Abenteuer', icon: 'map' },
  { key: 'lustig', label: 'Lustig', icon: 'sparkles' },
  { key: 'kulinarisch', label: 'Kulinarisch', icon: 'fork' },
  { key: 'kultur', label: 'Kultur', icon: 'ticket' },
  { key: 'entspannt', label: 'Entspannt', icon: 'sun' },
  { key: 'kreativ', label: 'Kreativ', icon: 'wand' },
  { key: 'besonders', label: 'Etwas Besonderes', icon: 'star' },
];
export const BUDGETS = [
  { key: 0, label: 'Gratis' },
  { key: 1, label: '€' },
  { key: 2, label: '€€' },
  { key: 3, label: '€€€' },
];
export const DURATIONS = [
  { key: 'short', label: '1–3 Std.' },
  { key: 'evening', label: 'Abend' },
  { key: 'day', label: 'Ganzer Tag' },
];
export const moodOf = (k) => MOODS.find((m) => m.key === k);
export const budgetLabel = (b) => (b == null ? '' : BUDGETS.find((x) => x.key === b)?.label || '');
export const durationLabel = (d) => DURATIONS.find((x) => x.key === d)?.label || '';

// where: home | out · sky: in | out | any (drinnen, draußen, egal) · season: summer | winter | xmas
// cat: passende Kalender-Kategorie beim Planen
const I = (id, title, text, o) => ({ id: `idea:${id}`, title, text, source: 'library', ...o });
export const IDEAS = [
  // Zu Hause
  I('kochduell', 'Kochduell', 'Jeder kocht einen Gang mit denselben Zutaten – der andere bewertet in der App.', { icon: 'chef', where: 'home', sky: 'in', budget: 1, moods: ['lustig', 'kulinarisch'], dur: 'evening', cat: 'cook' }),
  I('blindtasting', 'Blind-Tasting', 'Wein, Schokolade oder Chips blind probieren und Punkte vergeben. Wer erkennt mehr?', { icon: 'glass', where: 'home', sky: 'in', budget: 1, moods: ['lustig', 'kulinarisch'], dur: 'short', cat: 'date' }),
  I('themenfilm', 'Filmabend mit Länder-Thema', 'Ein Film aus einem Land – und das passende Essen dazu.', { icon: 'film', where: 'home', sky: 'in', budget: 1, moods: ['gemuetlich'], dur: 'evening', cat: 'date' }),
  I('pizza', 'Pizza-Challenge', 'Teig selbst machen, jeder belegt eine Hälfte nach eigenem Rezept.', { icon: 'chef', where: 'home', sky: 'in', budget: 1, moods: ['kulinarisch', 'lustig'], dur: 'evening', cat: 'cook' }),
  I('spieleabend', 'Spieleabend-Turnier', 'Drei Spiele, Punkte zählen – wer verliert, macht morgen Frühstück.', { icon: 'dice', where: 'home', sky: 'in', budget: 0, moods: ['lustig'], dur: 'evening', cat: 'date' }),
  I('spa', 'Spa-Abend zu Hause', 'Masken, Tee, ruhige Musik und Handy aus.', { icon: 'sun', where: 'home', sky: 'in', budget: 1, moods: ['entspannt'], dur: 'evening', cat: 'date' }),
  I('fotoabend', 'Foto-Throwback', 'Alte Fotos durchgehen und die besten Momente in der App nachtragen.', { icon: 'gallery', where: 'home', sky: 'in', budget: 0, moods: ['gemuetlich'], dur: 'short', cat: 'date' }),
  I('cocktails', 'Cocktail-Abend', 'Zwei neue Rezepte, selbst gemixt – inklusive Bewertung.', { icon: 'glass', where: 'home', sky: 'in', budget: 2, moods: ['lustig', 'besonders'], dur: 'evening', cat: 'date' }),
  I('sushi', 'Sushi selbst rollen', 'Reis, Nori, Lieblingsfüllungen – und dann wird gerollt.', { icon: 'chef', where: 'home', sky: 'in', budget: 2, moods: ['kulinarisch'], dur: 'evening', cat: 'cook' }),
  I('karaoke', 'Karaoke im Wohnzimmer', 'Playlist aufmachen, Mikro ist optional.', { icon: 'sparkles', where: 'home', sky: 'in', budget: 0, moods: ['lustig'], dur: 'evening', cat: 'date' }),
  I('neueküche', 'Unbekannte Küche kochen', 'Ein Gericht aus einem Land, das ihr noch nie gekocht habt.', { icon: 'chef', where: 'home', sky: 'in', budget: 1, moods: ['kulinarisch', 'abenteuer'], dur: 'evening', cat: 'cook' }),
  I('quiz', 'Quiz über euch', 'Jeder schreibt zehn Fragen über den anderen – wer weiß mehr?', { icon: 'sparkles', where: 'home', sky: 'in', budget: 0, moods: ['lustig'], dur: 'short', cat: 'date' }),
  I('wohnzimmerpicknick', 'Picknick im Wohnzimmer', 'Decke auf den Boden, Fingerfood, Kerzen – Tisch ist verboten.', { icon: 'moon', where: 'home', sky: 'in', budget: 1, moods: ['gemuetlich'], dur: 'evening', cat: 'date' }),
  I('diy', 'DIY-Abend', 'Kerzen gießen, Leinwand bemalen oder etwas für die Wohnung bauen.', { icon: 'wand', where: 'home', sky: 'in', budget: 1, moods: ['kreativ'], dur: 'evening', cat: 'date' }),
  I('raclette', 'Raclette oder Fondue', 'Langsam essen, lange reden.', { icon: 'fork', where: 'home', sky: 'in', budget: 2, moods: ['kulinarisch', 'gemuetlich'], dur: 'evening', cat: 'cook', season: 'winter' }),
  I('balkonsterne', 'Sterne vom Balkon', 'Sternbild-App auf, Decke um, Tee dazu.', { icon: 'moon', where: 'home', sky: 'out', budget: 0, moods: ['entspannt'], dur: 'short', cat: 'date' }),
  I('backen', 'Zimtschnecken backen', 'Oder Brot, oder Kekse – Hauptsache, die Wohnung duftet.', { icon: 'chef', where: 'home', sky: 'in', budget: 1, moods: ['gemuetlich', 'kulinarisch'], dur: 'short', cat: 'cook' }),
  I('podcastpuzzle', 'Puzzle & Podcast', '1000 Teile, ein guter Podcast und keine Eile.', { icon: 'sparkles', where: 'home', sky: 'in', budget: 0, moods: ['entspannt', 'gemuetlich'], dur: 'evening', cat: 'date' }),
  // Unterwegs, drinnen
  I('escape', 'Escape Room', '60 Minuten, ein Rätsel, ein Team.', { icon: 'key', where: 'out', sky: 'in', budget: 2, moods: ['abenteuer', 'lustig'], dur: 'short', cat: 'activity' }),
  I('bowling', 'Bowling', 'Wer verliert, zahlt die Pommes.', { icon: 'sparkles', where: 'out', sky: 'in', budget: 1, moods: ['lustig'], dur: 'short', cat: 'activity' }),
  I('spaetkino', 'Spätvorstellung im Kino', 'Letzte Vorstellung, große Popcorn-Tüte.', { icon: 'film', where: 'out', sky: 'in', budget: 1, moods: ['gemuetlich'], dur: 'evening', cat: 'date' }),
  I('museum', 'Museum & Café', 'Eine Ausstellung, danach Kuchen und Diskussion.', { icon: 'ticket', where: 'out', sky: 'in', budget: 1, moods: ['kultur'], dur: 'short', cat: 'activity' }),
  I('therme', 'Therme', 'Ein halber Tag Wärme, Wasser und Ruhe.', { icon: 'sun', where: 'out', sky: 'in', budget: 2, moods: ['entspannt'], dur: 'day', cat: 'activity' }),
  I('kochkurs', 'Kochkurs', 'Zusammen etwas Neues lernen – und danach zu Hause nachkochen.', { icon: 'chef', where: 'out', sky: 'in', budget: 3, moods: ['kulinarisch', 'besonders'], dur: 'evening', cat: 'activity' }),
  I('comedy', 'Comedy oder Poetry Slam', 'Kleine Bühne, großer Spaß.', { icon: 'ticket', where: 'out', sky: 'in', budget: 1, moods: ['lustig', 'kultur'], dur: 'evening', cat: 'activity' }),
  I('livemusik', 'Livemusik in einer Bar', 'Eine Band, die ihr noch nicht kennt.', { icon: 'ticket', where: 'out', sky: 'in', budget: 1, moods: ['kultur'], dur: 'evening', cat: 'date' }),
  I('bouldern', 'Bouldern', 'Kurze Routen, viel Lachen, Muskelkater garantiert.', { icon: 'bolt', where: 'out', sky: 'in', budget: 1, moods: ['aktiv'], dur: 'short', cat: 'activity' }),
  I('ueberraschungsrestaurant', 'Überraschungs-Restaurant', 'Einer wählt das Restaurant, der andere erfährt es erst vor der Tür.', { icon: 'fork', where: 'out', sky: 'any', budget: 2, moods: ['besonders', 'abenteuer'], dur: 'evening', cat: 'food' }),
  I('barhopping', 'Bar-Hopping', 'Drei Bars, je ein Drink und ein Snack – zu Fuß.', { icon: 'glass', where: 'out', sky: 'any', budget: 2, moods: ['lustig'], dur: 'evening', cat: 'date' }),
  I('schwarzlicht', 'Schwarzlicht-Minigolf', 'Leuchtende Bälle, schräge Bahnen.', { icon: 'sparkles', where: 'out', sky: 'in', budget: 1, moods: ['lustig'], dur: 'short', cat: 'activity' }),
  I('theater', 'Theater oder Musical', 'Schick machen, gute Plätze, danach ein Drink.', { icon: 'ticket', where: 'out', sky: 'in', budget: 3, moods: ['kultur', 'besonders'], dur: 'evening', cat: 'activity' }),
  I('arcade', 'Arcade & Lasertag', 'Wie mit 14, nur mit besserem Taschengeld.', { icon: 'bolt', where: 'out', sky: 'in', budget: 1, moods: ['lustig', 'aktiv'], dur: 'short', cat: 'activity' }),
  I('toepfern', 'Töpferkurs', 'Zwei Tassen, die garantiert schief werden.', { icon: 'wand', where: 'out', sky: 'in', budget: 2, moods: ['kreativ'], dur: 'short', cat: 'activity' }),
  I('brunch', 'Neues Café zum Brunch', 'Ein Café, in dem ihr noch nie wart.', { icon: 'fork', where: 'out', sky: 'any', budget: 1, moods: ['kulinarisch', 'gemuetlich'], dur: 'short', cat: 'food' }),
  I('weinprobe', 'Weinprobe', 'Sechs Weine, eine Rangliste – die App merkt sich eure Favoriten.', { icon: 'glass', where: 'out', sky: 'in', budget: 2, moods: ['kulinarisch', 'besonders'], dur: 'evening', cat: 'activity' }),
  I('planetarium', 'Planetarium', 'Zurücklehnen und durchs Universum fliegen.', { icon: 'moon', where: 'out', sky: 'in', budget: 1, moods: ['kultur', 'entspannt'], dur: 'short', cat: 'activity' }),
  I('tanzkurs', 'Tanzkurs', 'Salsa, Swing oder Tango – Hauptsache gemeinsam.', { icon: 'sparkles', where: 'out', sky: 'in', budget: 2, moods: ['aktiv', 'lustig'], dur: 'evening', cat: 'activity' }),
  I('roesterei', 'Brauerei- oder Röstereiführung', 'Hinter die Kulissen schauen und probieren.', { icon: 'glass', where: 'out', sky: 'in', budget: 2, moods: ['kulinarisch', 'kultur'], dur: 'short', cat: 'activity' }),
  I('eislaufen', 'Eislaufen', 'Händchenhalten ist hier reine Sicherheitsmaßnahme.', { icon: 'snow', where: 'out', sky: 'any', budget: 1, moods: ['aktiv', 'lustig'], dur: 'short', cat: 'activity', season: 'winter' }),
  // Unterwegs, draußen
  I('sonnenaufgang', 'Sonnenaufgang-Wanderung', 'Früh los, oben frühstücken.', { icon: 'sun', where: 'out', sky: 'out', budget: 0, moods: ['aktiv', 'besonders'], dur: 'day', cat: 'activity' }),
  I('parkpicknick', 'Picknick im Park', 'Decke, Snacks, ein Kartenspiel.', { icon: 'sun', where: 'out', sky: 'out', budget: 1, moods: ['gemuetlich', 'entspannt'], dur: 'short', cat: 'date', season: 'summer' }),
  I('radtour', 'Radtour zu einem See', 'Hinradeln, baden oder nur die Füße rein, zurückradeln.', { icon: 'bolt', where: 'out', sky: 'out', budget: 0, moods: ['aktiv'], dur: 'day', cat: 'activity', season: 'summer' }),
  I('sup', 'Kajak oder SUP', 'Eine Stunde auf dem Wasser – nass wird garantiert einer.', { icon: 'sun', where: 'out', sky: 'out', budget: 2, moods: ['aktiv', 'abenteuer'], dur: 'short', cat: 'activity', season: 'summer' }),
  I('flohmarkt', 'Flohmarkt-Challenge', 'Jeder hat 10 €. Wer findet das bessere Teil?', { icon: 'tag', where: 'out', sky: 'out', budget: 1, moods: ['lustig'], dur: 'short', cat: 'activity' }),
  I('streetfood', 'Streetfood-Markt', 'Jeder Stand ein Bissen, am Ende küren.', { icon: 'fork', where: 'out', sky: 'out', budget: 1, moods: ['kulinarisch'], dur: 'short', cat: 'food' }),
  I('fotowalk', 'Foto-Spaziergang', 'Jeder macht zehn Fotos zu einem Thema – danach vergleichen.', { icon: 'camera', where: 'out', sky: 'out', budget: 0, moods: ['kreativ'], dur: 'short', cat: 'activity' }),
  I('neuestadt', 'Tagesausflug in eine neue Stadt', 'Eine Stadt, in der ihr noch nie wart – der Globus freut sich.', { icon: 'plane', where: 'out', sky: 'any', budget: 2, moods: ['abenteuer'], dur: 'day', cat: 'trip' }),
  I('sterne', 'Sterne gucken', 'Raus aus der Stadt, Decke, Thermoskanne.', { icon: 'moon', where: 'out', sky: 'out', budget: 0, moods: ['besonders', 'entspannt'], dur: 'evening', cat: 'date' }),
  I('badesee', 'Badesee-Tag', 'Früh hin, Platz sichern, Eis später.', { icon: 'sun', where: 'out', sky: 'out', budget: 0, moods: ['entspannt'], dur: 'day', cat: 'activity', season: 'summer' }),
  I('weihnachtsmarkt', 'Weihnachtsmarkt', 'Glühwein, gebrannte Mandeln – und ein Becher als Andenken.', { icon: 'tree', where: 'out', sky: 'out', budget: 1, moods: ['gemuetlich'], dur: 'evening', cat: 'date', season: 'xmas' }),
  I('schlitten', 'Schlitten fahren', 'Wer zuerst unten ist, bestimmt das Abendessen.', { icon: 'snow', where: 'out', sky: 'out', budget: 0, moods: ['aktiv', 'lustig'], dur: 'short', cat: 'activity', season: 'winter' }),
  I('geocaching', 'Geocaching', 'Schatzsuche mit dem Handy – die App zeigt, wo.', { icon: 'map', where: 'out', sky: 'out', budget: 0, moods: ['abenteuer'], dur: 'short', cat: 'activity' }),
  I('zoo', 'Zoo oder Tierpark', 'Jeder sucht sich ein Lieblingstier aus.', { icon: 'sun', where: 'out', sky: 'out', budget: 1, moods: ['entspannt'], dur: 'day', cat: 'activity' }),
  I('hochseil', 'Hochseilgarten', 'Gegenseitig sichern – im wahrsten Sinne.', { icon: 'bolt', where: 'out', sky: 'out', budget: 2, moods: ['abenteuer', 'aktiv'], dur: 'day', cat: 'activity', season: 'summer' }),
  I('grillen', 'Grillen am See', 'Einweggrill war gestern – nehmt den guten mit.', { icon: 'fork', where: 'out', sky: 'out', budget: 1, moods: ['gemuetlich'], dur: 'evening', cat: 'food', season: 'summer' }),
  I('openair', 'Open-Air-Kino', 'Film unter freiem Himmel, Decke nicht vergessen.', { icon: 'film', where: 'out', sky: 'out', budget: 1, moods: ['gemuetlich'], dur: 'evening', cat: 'date', season: 'summer' }),
  I('roadtrip', 'Spontaner Roadtrip', 'Eine Stunde in eine Richtung fahren und schauen, was kommt.', { icon: 'map', where: 'out', sky: 'any', budget: 1, moods: ['abenteuer'], dur: 'day', cat: 'trip' }),
  I('wochenendtrip', 'Wochenendtrip planen', 'Zwei Nächte, ein neues Ziel – heute buchen.', { icon: 'plane', where: 'out', sky: 'any', budget: 3, moods: ['besonders', 'abenteuer'], dur: 'day', cat: 'trip' }),
  I('rundflug', 'Rundflug oder Ballonfahrt', 'Die Stadt einmal von oben sehen.', { icon: 'plane', where: 'out', sky: 'out', budget: 3, moods: ['besonders', 'abenteuer'], dur: 'short', cat: 'activity' }),
  I('nachtspaziergang', 'Nachtspaziergang mit Kakao', 'Thermoskanne, leere Straßen, langer Weg.', { icon: 'moon', where: 'out', sky: 'out', budget: 0, moods: ['entspannt'], dur: 'short', cat: 'date' }),
  I('pfluecken', 'Selbst pflücken', 'Erdbeeren, Kirschen oder Äpfel – und danach etwas daraus backen.', { icon: 'sun', where: 'out', sky: 'out', budget: 1, moods: ['gemuetlich'], dur: 'short', cat: 'activity', season: 'summer' }),
  I('touristen', 'Touristen in der eigenen Stadt', 'Stadtführung, Aussichtspunkt, Souvenir kaufen.', { icon: 'camera', where: 'out', sky: 'any', budget: 1, moods: ['lustig', 'kultur'], dur: 'day', cat: 'activity' }),
  I('stadtrallye', 'Stadtrallye', 'Fotoaufgaben in der Stadt: Wer schafft mehr in zwei Stunden?', { icon: 'map', where: 'out', sky: 'out', budget: 0, moods: ['abenteuer', 'lustig'], dur: 'short', cat: 'activity' }),
  I('erstesdate', 'Zurück zum ersten Date', 'Ort des ersten Dates nochmal besuchen – gleiche Bestellung?', { icon: 'flag', where: 'out', sky: 'any', budget: 1, moods: ['besonders'], dur: 'evening', cat: 'date' }),
  I('tierheim', 'Gassi gehen im Tierheim', 'Gutes tun und Hunde knuddeln.', { icon: 'sun', where: 'out', sky: 'out', budget: 0, moods: ['besonders', 'aktiv'], dur: 'short', cat: 'activity' }),
  I('laufen', 'Zusammen laufen gehen', 'Eine Runde, die ihr noch nicht kennt – danach Frühstück.', { icon: 'bolt', where: 'out', sky: 'out', budget: 0, moods: ['aktiv'], dur: 'short', cat: 'activity' }),
];

/** Jahreszeit-Filter: summer = Mai–Sept., winter = Nov.–Feb., xmas = 20. Nov.–23. Dez. */
export function inSeason(idea, date = new Date()) {
  if (!idea.season) return true;
  const m = date.getMonth() + 1, d = date.getDate();
  if (idea.season === 'summer') return m >= 5 && m <= 9;
  if (idea.season === 'winter') return m >= 11 || m <= 2;
  if (idea.season === 'xmas') return (m === 11 && d >= 20) || (m === 12 && d <= 23);
  return true;
}

const WISH_MAP = { trip: ['plane', 'trip'], food: ['fork', 'food'], recipe: ['chef', 'cook'], activity: ['ticket', 'activity'], date: ['glass', 'date'], other: ['star', 'activity'] };

/** Eure eigenen Ideen aus den Daten. `items` = { wishes, entries } (aus dem Store). */
export function ownIdeas({ wishes = [], entries = [] } = {}) {
  const out = [];
  for (const w of wishes) {
    if (w.data.done) continue;
    const [icon, cat] = WISH_MAP[w.data.category] || WISH_MAP.other;
    out.push({ id: `wish:${w.id}`, title: w.data.title, text: w.data.note || 'Steht auf eurer Bucket-Liste.', icon, where: w.data.category === 'recipe' ? 'home' : 'any', sky: 'any', budget: null, moods: [], dur: null, cat, source: 'bucket', ref: w.id });
  }
  for (const e of entries) {
    if (e.data.category === 'food' && e.data.extra?.again === 'yes') {
      out.push({ id: `entry:${e.id}`, title: `Wieder hin: ${e.data.title}`, text: 'Ihr wolltet unbedingt nochmal hin.', icon: 'fork', where: 'out', sky: 'any', budget: e.data.extra?.price ? Math.min(3, +e.data.extra.price) : null, moods: ['kulinarisch'], dur: 'evening', cat: 'food', source: 'restaurant', ref: e.id, place: e.data.place || null });
    }
    if (e.data.category === 'recipe' && e.data.extra?.again === 'yes') {
      out.push({ id: `entry:${e.id}`, title: `Nochmal kochen: ${e.data.title}`, text: 'Steht bei euch auf „Nochmal kochen“.', icon: 'chef', where: 'home', sky: 'in', budget: 1, moods: ['kulinarisch', 'gemuetlich'], dur: 'evening', cat: 'cook', source: 'recipe', ref: e.id });
    }
  }
  return out;
}

export const SOURCE_LABEL = { library: 'Idee', bucket: 'Von eurer Bucket-Liste', restaurant: 'Euer Restaurant-Tipp', recipe: 'Euer Rezept' };

/** Passt eine Idee zu den Filtern? */
export function matches(idea, f = {}, date = new Date()) {
  if (!inSeason(idea, date)) return false;
  if (f.where && f.where !== 'any' && idea.where !== 'any' && idea.where !== f.where) return false;
  if (f.outdoorOk === false && idea.sky === 'out') return false;
  if (f.budget != null && f.budget !== 'any' && idea.budget != null && idea.budget > f.budget) return false;
  if (f.mood && f.mood !== 'any' && idea.moods.length && !idea.moods.includes(f.mood)) return false;
  if (f.mood && f.mood !== 'any' && !idea.moods.length) return false;
  if (f.dur && f.dur !== 'any' && idea.dur && idea.dur !== f.dur) return false;
  return true;
}

/**
 * Zufällige Idee. Passt nichts, werden Filter schrittweise gelockert (Dauer → Stimmung → Budget → Ort).
 * Liefert { idea, relaxed: [gelockerte Filter] } oder null.
 */
export function pickIdea(pool, filters = {}, { exclude = [], date = new Date(), rnd = Math.random } = {}) {
  const ex = new Set(exclude);
  const order = ['dur', 'mood', 'budget', 'where'];
  let f = { ...filters };
  const relaxed = [];
  for (let step = 0; step <= order.length; step++) {
    let list = pool.filter((i) => !ex.has(i.id) && matches(i, f, date));
    if (!list.length && ex.size) list = pool.filter((i) => matches(i, f, date));
    if (list.length) {
      // Eigene Ideen etwas häufiger zeigen
      const weighted = list.flatMap((i) => (i.source === 'library' ? [i] : [i, i]));
      return { idea: weighted[Math.floor(rnd() * weighted.length)], relaxed, count: list.length };
    }
    const k = order[step];
    if (!k) break;
    if (f[k] != null && f[k] !== 'any') { relaxed.push(k); f = { ...f, [k]: 'any' }; }
  }
  return null;
}
