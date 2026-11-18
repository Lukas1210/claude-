// Erscheinungsbild: automatisch (wie das iPhone), hell oder dunkel – plus Farbwelt. Pro Gerät gespeichert.
const KEY = 'cj-theme';
const PALETTE_KEY = 'cj-palette';
export const DEFAULT_PALETTE = 'indigo';

/** Farbwelten: Name, Statusleisten-/Hintergrundfarbe und Vorschau-Farben (hell/dunkel). */
export const PALETTES = {
  indigo: { name: 'Indigo', light: { bg: '#F2F2F7', swatch: ['#5856D6', '#E5342A'] }, dark: { bg: '#000000', swatch: ['#24236B', '#8E8CFF'] } },
  night: { name: 'Nachtblau & Gold', light: { bg: '#F2F4F9', swatch: ['#14213D', '#E2A93B'] }, dark: { bg: '#070B17', swatch: ['#0F1A36', '#F0B44C'] } },
  ocean: { name: 'Petrol & Koralle', light: { bg: '#EFF5F4', swatch: ['#0F766E', '#FF7A66'] }, dark: { bg: '#051110', swatch: ['#0A2A27', '#2DD4BF'] } },
  polaroid: { name: 'Polaroid', light: { bg: '#F1F1F1', swatch: ['#111111', '#E94B3C'] }, dark: { bg: '#000000', swatch: ['#161616', '#FF5A4D'] } },
  neon: { name: 'Schwarz & Neon', light: { bg: '#F3F3F1', swatch: ['#0B0B0C', '#C6F432'] }, dark: { bg: '#0A0A0B', swatch: ['#0E0E10', '#C6F432'] } },
};

const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function getThemePref() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function getPalette() {
  try {
    const v = localStorage.getItem(PALETTE_KEY);
    return PALETTES[v] ? v : DEFAULT_PALETTE;
  } catch {
    return DEFAULT_PALETTE;
  }
}

export function effectiveTheme() {
  const p = getThemePref();
  if (p !== 'system') return p;
  return mq && mq.matches ? 'dark' : 'light';
}

export function applyTheme() {
  const p = getThemePref();
  const root = document.documentElement;
  if (p === 'system') delete root.dataset.theme;
  else root.dataset.theme = p;
  const pal = getPalette();
  if (pal === 'neon') delete root.dataset.palette;
  else root.dataset.palette = pal;
  const bgs = PALETTES[pal];
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  metas.forEach((m) => {
    const media = m.getAttribute('media') || '';
    const mode = p !== 'system' ? p : media.includes('dark') ? 'dark' : media.includes('light') ? 'light' : effectiveTheme();
    m.setAttribute('content', bgs[mode].bg);
  });
  window.dispatchEvent(new CustomEvent('themechange', { detail: effectiveTheme() }));
}

export function setThemePref(v) {
  try {
    if (v === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, v);
  } catch {}
  applyTheme();
}

export function setPalette(v) {
  try {
    if (!PALETTES[v] || v === DEFAULT_PALETTE) localStorage.removeItem(PALETTE_KEY);
    else localStorage.setItem(PALETTE_KEY, v);
  } catch {}
  applyTheme();
}

if (mq) {
  const onChange = () => { if (getThemePref() === 'system') applyTheme(); };
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);
}
