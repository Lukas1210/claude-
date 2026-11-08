// Orte: Suche & Rückwärtssuche über OpenStreetMap (Nominatim), Standort, Distanzen.

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const regionNames = (() => {
  try { return new Intl.DisplayNames(['de'], { type: 'region' }); } catch { return null; }
})();

export function countryName(code) {
  if (!code) return '';
  try { return regionNames?.of(code.toUpperCase()) || code.toUpperCase(); } catch { return code.toUpperCase(); }
}

export function flag(code) {
  if (!code || code.length !== 2) return '🌍';
  return String.fromCodePoint(...code.toUpperCase().split('').map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

function toPlace(r) {
  const a = r.address || {};
  const locality = a.city || a.town || a.village || a.municipality || a.hamlet || a.suburb || a.county || '';
  const name = r.name || locality || (r.display_name || '').split(',')[0];
  const parts = [];
  if (locality && locality !== name) parts.push(locality);
  if (a.state && a.state !== name && a.state !== locality && !a.city) parts.push(a.state);
  if (a.country && a.country !== name) parts.push(a.country);
  return {
    name,
    label: parts.join(', '),
    city: locality || name,
    lat: +(+r.lat).toFixed(5),
    lng: +(+r.lon).toFixed(5),
    country: a.country || '',
    countryCode: (a.country_code || '').toUpperCase(),
  };
}

export async function searchPlaces(q, { signal } = {}) {
  q = q.trim();
  if (q.length < 2) return [];
  const url = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=6&accept-language=de&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Ortssuche nicht erreichbar');
  const data = await res.json();
  return data.map(toPlace);
}

export async function reversePlace(lat, lng) {
  const url = `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&zoom=14&accept-language=de&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Ort nicht gefunden');
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  const p = toPlace(data);
  p.lat = +(+lat).toFixed(5);
  p.lng = +(+lng).toFixed(5);
  return p;
}

export function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Standort nicht verfügbar'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(new Error('Standort-Zugriff nicht erlaubt')),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
    );
  });
}

export function distanceKm(a, b) {
  if (!a || !b) return 0;
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function placeLabel(p) {
  if (!p) return '';
  return p.label ? `${p.name}, ${p.label}` : p.name;
}

export function shortPlace(p) {
  if (!p) return '';
  if (p.city && p.city !== p.name) return `${p.name}, ${p.city}`;
  if (p.country && p.country !== p.name) return `${p.name}, ${p.country}`;
  return p.name;
}
