// Wettervorhersage über Open-Meteo (kostenlos, ohne Konto). Es werden nur Koordinaten übertragen.
// Ergebnis wird eine Stunde zwischengespeichert.
const API = 'https://api.open-meteo.com/v1/forecast';
const TTL = 60 * 60 * 1000;
const mem = new Map();

// WMO-Wettercodes → Text & Icon
const CODES = [
  [[0], 'Klar', 'sun'],
  [[1, 2], 'Heiter', 'cloudSun'],
  [[3], 'Bewölkt', 'cloud'],
  [[45, 48], 'Nebel', 'cloud'],
  [[51, 53, 55, 56, 57], 'Niesel', 'rain'],
  [[61, 63, 65, 66, 67, 80, 81, 82], 'Regen', 'rain'],
  [[71, 73, 75, 77, 85, 86], 'Schnee', 'snow'],
  [[95, 96, 99], 'Gewitter', 'storm'],
];
const describe = (code) => {
  const hit = CODES.find(([list]) => list.includes(code));
  return hit ? { label: hit[1], icon: hit[2] } : { label: 'Wetter', icon: 'cloud' };
};

export async function getForecast(lat, lng, { fetcher = fetch } = {}) {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const now = Date.now();
  const hit = mem.get(key);
  if (hit && now - hit.at < TTL) return hit.data;
  try {
    const s = JSON.parse(sessionStorage.getItem(`cj-wx-${key}`) || 'null');
    if (s && now - s.at < TTL) { mem.set(key, s); return s.data; }
  } catch {}
  const url = `${API}?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=14`;
  const res = await fetcher(url);
  if (!res.ok) throw new Error(`Wetter nicht verfügbar (${res.status})`);
  const data = await res.json();
  const entry = { at: now, data };
  mem.set(key, entry);
  try { sessionStorage.setItem(`cj-wx-${key}`, JSON.stringify(entry)); } catch {}
  return data;
}

/** Wetter für einen Tag (YYYY-MM-DD) aus der Vorhersage – oder null, wenn der Tag nicht enthalten ist. */
export function dayWeather(forecast, date) {
  const d = forecast?.daily;
  if (!d?.time) return null;
  const i = d.time.indexOf(date);
  if (i < 0) return null;
  const code = d.weather_code?.[i] ?? 3;
  const tmax = Math.round(d.temperature_2m_max?.[i] ?? 15);
  const tmin = Math.round(d.temperature_2m_min?.[i] ?? 8);
  const rain = d.precipitation_probability_max?.[i] ?? 0;
  const { label, icon } = describe(code);
  const wet = rain >= 50 || [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 71, 73, 75, 77, 85, 86, 95, 96, 99].includes(code);
  const outdoorOk = !wet && tmax >= 8;
  return { date, code, label, icon, tmax, tmin, rain, outdoorOk, hint: outdoorOk ? 'Draußen geht' : wet ? 'Lieber drinnen – Regen wahrscheinlich' : 'Lieber drinnen – zu kalt' };
}
