// Erscheinungsbild: automatisch (wie das iPhone), hell oder dunkel – pro Gerät gespeichert.
const KEY = 'cj-theme';
const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const BG = { light: '#f2f2f7', dark: '#0b0b0e' };

export function getThemePref() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
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
  const color = BG[effectiveTheme()];
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color));
  window.dispatchEvent(new CustomEvent('themechange', { detail: effectiveTheme() }));
}

export function setThemePref(v) {
  try {
    if (v === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, v);
  } catch {}
  applyTheme();
}

if (mq) {
  const onChange = () => { if (getThemePref() === 'system') applyTheme(); };
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);
}
