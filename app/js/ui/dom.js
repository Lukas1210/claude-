// Kleine DOM-Helfer: sicheres HTML-Templating mit automatischem Escaping.

export class Safe {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

function renderVal(v) {
  if (v == null || v === false || v === true) return '';
  if (v instanceof Safe) return v.s;
  if (Array.isArray(v)) return v.map(renderVal).join('');
  return esc(v);
}

/** Tagged template: html`<p>${userText}</p>` – Werte werden escaped, Safe-Werte nicht. */
export function html(strings, ...vals) {
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < vals.length) out += renderVal(vals[i]);
  }
  return new Safe(out);
}

export const raw = (s) => new Safe(String(s ?? ''));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Event-Delegation: on(root, 'click', '[data-act]', (e, el) => …) */
export function on(root, type, selector, handler, opts) {
  const fn = (e) => {
    const el = e.target.closest(selector);
    if (el && root.contains(el)) handler(e, el);
  };
  root.addEventListener(type, fn, opts);
  return () => root.removeEventListener(type, fn, opts);
}

export function setHTML(el, content) {
  el.innerHTML = String(content);
  return el;
}

export function el(tag, attrs = {}, content) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v != null && v !== false) node.setAttribute(k, v === true ? '' : v);
  }
  if (content != null) node.innerHTML = String(content);
  return node;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
