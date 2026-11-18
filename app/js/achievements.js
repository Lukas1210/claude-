// Erfolge: Abzeichen in Bronze, Silber und Gold – berechnet aus euren Daten (reine Funktionen).
import { travelStats, ratingStats, monthStreak } from './insights.js';
import { daysBetween } from './model.js';

export const TIER_NAMES = ['', 'Bronze', 'Silber', 'Gold'];

const count = (cat) => (ctx) => ctx.entries.filter((e) => e.data.category === cat).length;

export const ACHIEVEMENTS = [
  { id: 'laender', title: 'Weltenbummler', icon: 'globe', tiers: [3, 10, 25], unit: 'Länder', value: (c) => c.travel.countries },
  { id: 'km', title: 'Kilometerfresser', icon: 'plane', tiers: [1000, 10000, 40075], unit: 'km', value: (c) => c.travel.km, hint: 'Gold = einmal um die Erde' },
  { id: 'orte', title: 'Entdecker', icon: 'pin', tiers: [10, 30, 75], unit: 'Orte', value: (c) => c.travel.places },
  { id: 'dates', title: 'Date-Profis', icon: 'glass', tiers: [10, 25, 50], unit: 'Dates', value: count('date') },
  { id: 'essen', title: 'Foodies', icon: 'fork', tiers: [10, 25, 50], unit: 'Restaurants & Cafés', value: count('food') },
  { id: 'kochen', title: 'Küchenteam', icon: 'chef', tiers: [5, 15, 30], unit: 'Rezepte', value: count('recipe') },
  { id: 'filme', title: 'Couch-Kritiker', icon: 'film', tiers: [5, 20, 50], unit: 'Filme & Serien', value: count('movie') },
  { id: 'aktiv', title: 'Unternehmungslustig', icon: 'ticket', tiers: [5, 20, 40], unit: 'Aktivitäten', value: count('activity') },
  { id: 'reisen', title: 'Koffer gepackt', icon: 'plane', tiers: [3, 8, 15], unit: 'Reisen', value: count('trip') },
  { id: 'geschenke', title: 'Schenk-Talent', icon: 'gift', tiers: [3, 10, 20], unit: 'Geschenke', value: count('gift') },
  { id: 'fotos', title: 'Fotografen', icon: 'camera', tiers: [50, 250, 1000], unit: 'Fotos', value: (c) => c.photos },
  { id: 'bewertet', title: 'Strenge Jury', icon: 'heartFill', tiers: [10, 50, 100], unit: 'gemeinsam bewertet', value: (c) => c.ratings.both },
  { id: 'einig', title: 'Ein Herz und eine Seele', icon: 'check', tiers: [5, 15, 30], unit: 'exakt gleich bewertet', value: (c) => c.ratings.exactSame },
  { id: 'bucket', title: 'Bucket-Killer', icon: 'star', tiers: [3, 10, 25], unit: 'Wünsche erledigt', value: (c) => c.wishesDone },
  { id: 'planer', title: 'Gut geplant', icon: 'calendar', tiers: [5, 20, 50], unit: 'Termine', value: (c) => c.events },
  { id: 'listen', title: 'Teamwork', icon: 'todo', tiers: [10, 50, 150], unit: 'Aufgaben erledigt', value: (c) => c.todosDone },
  { id: 'serie', title: 'Dranbleiber', icon: 'flame', tiers: [3, 6, 12], unit: 'Monate in Folge', value: (c) => c.streak.best },
  { id: 'jahre', title: 'Langstrecke', icon: 'ring', tiers: [1, 3, 5], unit: 'Jahre zusammen', value: (c) => c.years },
];

/** Daten für die Auswertung aus Store-Listen zusammenstellen. */
export function buildContext({ entries = [], photos = 0, wishes = [], events = 0, todos = [], settings = {}, today }) {
  const days = settings.startDate && today ? daysBetween(settings.startDate, today) : 0;
  return {
    entries,
    photos,
    events,
    travel: travelStats(entries, settings.home),
    ratings: ratingStats(entries),
    wishesDone: wishes.filter((w) => w.data.done).length,
    todosDone: todos.filter((t) => t.data.done).length,
    streak: monthStreak(entries, today),
    years: Math.floor(days / 365.25),
  };
}

/** Stand je Erfolg: erreichte Stufe (0–3), nächstes Ziel und Fortschritt dorthin (0–1). */
export function evaluate(ctx) {
  return ACHIEVEMENTS.map((def) => {
    const value = Math.max(0, Math.round(def.value(ctx) || 0));
    const tier = def.tiers.filter((t) => value >= t).length;
    const next = def.tiers[tier] ?? null;
    const prev = tier ? def.tiers[tier - 1] : 0;
    const progress = next == null ? 1 : Math.max(0, Math.min(1, (value - prev) / (next - prev)));
    return { def, value, tier, next, progress };
  });
}

/** Neue Stufen seit dem letzten Stand `seen` ({ id: stufe }). */
export function newlyUnlocked(results, seen) {
  return results.filter((r) => r.tier > (seen[r.def.id] || 0));
}
