// Hash-Router mit Tab-Navigation, Seitenübergängen und Scroll-Gedächtnis.
import { subscribe } from './store.js';
import { hydrate } from './photos.js';
import { debounce } from './ui/dom.js';

const routes = [];
let current = null; // { route, params, query, cleanup, key }
const scrollMemory = new Map();
const historyStack = [];
let scroller, viewEl;

export const TABS = ['home', 'timeline', 'entries', 'globe', 'gallery'];

export function route(pattern, loader, { tab = null, fab = true, root = false } = {}) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }).replace(/\//g, '\\/') + '\\/?$');
  routes.push({ pattern, re, keys, loader, tab, fab, root });
}

function parseHash() {
  const h = decodeURI(location.hash.replace(/^#/, '')) || '/';
  const [path, qs] = h.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  for (const r of routes) {
    const m = r.re.exec(path);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { route: r, params, query, path, key: h };
    }
  }
  return null;
}

export function go(path, { replace = false } = {}) {
  const target = '#' + path;
  if (replace) location.replace(target);
  else location.hash = path;
}

export function back(fallback = '/') {
  if (historyStack.length > 1) history.back();
  else go(fallback, { replace: true });
}

function updateChrome(r) {
  if (r.route.tab) document.querySelectorAll('#tabbar .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === r.route.tab));
  const fab = document.getElementById('fab');
  fab && fab.classList.toggle('hide', !r.route.fab);
}

function bindTopbar() {
  const onScroll = () => {
    const bar = viewEl.querySelector('.topbar');
    if (bar) bar.classList.toggle('scrolled', scroller.scrollTop > +(bar.dataset.threshold || 34));
  };
  onScroll();
  scroller.onscroll = onScroll;
}

async function render(r, mode) {
  if (current && current.key !== r.key) scrollMemory.set(current.key, scroller.scrollTop);
  if (current?.cleanup) { try { current.cleanup(); } catch (e) { console.error(e); } }
  const mod = await r.route.loader();
  viewEl.className = '';
  viewEl.innerHTML = '';
  viewEl.dataset.route = r.route.pattern;
  updateChrome(r);
  const state = { ...r, mod, cleanup: null };
  current = state;
  const result = await mod.render(viewEl, r.params, r.query);
  if (current !== state) return; // inzwischen weiter navigiert
  state.cleanup = typeof result === 'function' ? result : null;
  hydrate(viewEl);
  bindTopbar();
  const y = mode === 'pop' ? scrollMemory.get(r.key) || 0 : 0;
  scroller.scrollTop = y;
  void viewEl.offsetWidth;
  viewEl.classList.add(mode === 'push' ? 'enter-push' : mode === 'pop' ? 'enter-pop' : 'enter-tab');
}

/** Aktuelle Ansicht nach Datenänderung neu zeichnen (Scrollposition bleibt). */
export async function refresh() {
  if (!current || current.mod.live === false) return;
  const y = scroller.scrollTop;
  if (current.cleanup) { try { current.cleanup(); } catch (e) { console.error(e); } }
  const state = current;
  viewEl.innerHTML = '';
  const result = await state.mod.render(viewEl, state.params, state.query);
  if (current !== state) return;
  state.cleanup = typeof result === 'function' ? result : null;
  hydrate(viewEl);
  bindTopbar();
  scroller.scrollTop = y;
}

export const currentRoute = () => current;

/** Nach einem internen Neuzeichnen einer Ansicht aufrufen. */
export function afterPaint(root = viewEl) {
  hydrate(root);
  scroller?.onscroll?.();
}

export function startRouter() {
  scroller = document.getElementById('scroller');
  viewEl = document.getElementById('view');

  const onHash = () => {
    const r = parseHash();
    if (!r) { go('/', { replace: true }); return; }
    let mode;
    if (historyStack.length > 1 && historyStack[historyStack.length - 2] === r.key) {
      historyStack.pop();
      mode = 'pop';
    } else if (r.route.root) {
      historyStack.length = 0;
      historyStack.push(r.key);
      mode = 'tab';
    } else {
      historyStack.push(r.key);
      mode = current ? 'push' : 'tab';
    }
    render(r, mode);
  };
  window.addEventListener('hashchange', onHash);

  // Klicks auf "Zurück"
  viewEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act="back"]');
    if (b) { e.preventDefault(); back(b.dataset.fallback || '/'); }
  });

  const debouncedRefresh = debounce(() => refresh(), 120);
  subscribe((evt) => {
    if (evt.types.includes('device')) return;
    debouncedRefresh();
  });

  onHash();
}
