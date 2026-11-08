// Bottom-Sheets, Aktionsmenüs, Dialoge und Toasts im iOS-Stil.
import { html, esc, nextFrame } from './dom.js';
import { icon } from './icons.js';

let zBase = 100;
const openSheets = [];

/**
 * Öffnet ein Bottom-Sheet.
 * @returns {{el: HTMLElement, body: HTMLElement, close: Function, closed: Promise}}
 */
export function openSheet({ title = '', left = '', right = '', body = '', full = false, className = '', beforeClose, onClose } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';
  const sheet = document.createElement('div');
  sheet.className = `sheet ${full ? 'full' : ''} ${className}`;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  zBase += 2;
  backdrop.style.zIndex = zBase;
  sheet.style.zIndex = zBase + 1;
  sheet.innerHTML = String(html`
    <div class="sheet-handle"></div>
    <div class="sheet-head">
      <div class="l">${left}</div>
      <div class="title">${title}</div>
      <div class="r">${right}</div>
    </div>
    <div class="sheet-body"></div>`);
  const bodyEl = sheet.querySelector('.sheet-body');
  if (body instanceof Node) bodyEl.appendChild(body);
  else bodyEl.innerHTML = String(body);
  document.body.append(backdrop, sheet);

  let resolveClosed;
  const closed = new Promise((r) => (resolveClosed = r));
  let isClosed = false;

  async function close(result, force = false) {
    if (isClosed) return;
    if (!force && beforeClose && (await beforeClose()) === false) {
      sheet.style.transform = '';
      return;
    }
    isClosed = true;
    sheet.classList.remove('show');
    backdrop.classList.remove('show');
    sheet.style.transform = '';
    const idx = openSheets.indexOf(api);
    if (idx >= 0) openSheets.splice(idx, 1);
    setTimeout(() => {
      sheet.remove();
      backdrop.remove();
    }, 420);
    onClose && onClose(result);
    resolveClosed(result);
  }

  backdrop.addEventListener('click', () => close());

  // Wisch-Geste zum Schließen (am Griff / Kopfbereich)
  const head = sheet.querySelector('.sheet-head');
  const handle = sheet.querySelector('.sheet-handle');
  let startY = 0, dy = 0, dragging = false, startT = 0;
  const down = (e) => {
    if (e.target.closest('button, input, a')) return;
    dragging = true; startY = e.clientY; dy = 0; startT = performance.now();
    sheet.classList.add('dragging');
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!dragging) return;
    dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  };
  const up = () => {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove('dragging');
    const v = dy / Math.max(1, performance.now() - startT);
    if (dy > 140 || v > 0.6) close();
    else sheet.style.transform = '';
  };
  for (const t of [head, handle]) {
    t.addEventListener('pointerdown', down);
    t.addEventListener('pointermove', move);
    t.addEventListener('pointerup', up);
    t.addEventListener('pointercancel', up);
  }

  const api = { el: sheet, body: bodyEl, head, close, closed };
  openSheets.push(api);
  nextFrame().then(() => {
    backdrop.classList.add('show');
    sheet.classList.add('show');
  });
  return api;
}

export function closeAllSheets() {
  [...openSheets].forEach((s) => s.close(undefined, true));
}

export const hasOpenSheet = () => openSheets.length > 0;

/** Aktionsmenü mit Kacheln (grid) oder Zeilen (list). Liefert den gewählten Wert. */
export function actionSheet({ title = '', items = [], layout = 'list' }) {
  return new Promise((resolve) => {
    let chosen;
    const body = layout === 'grid'
      ? html`<div class="action-grid">${items.map((it, i) => html`<button class="action-item" data-i="${i}"><span class="em">${it.emoji || ''}</span><span>${it.label}</span></button>`)}</div>`
      : html`<div class="action-list">${items.map((it, i) => html`<button class="action-row ${it.danger ? 'danger' : ''}" data-i="${i}">${it.icon ? icon(it.icon) : ''}${it.emoji ? html`<span>${it.emoji}</span>` : ''}<span>${it.label}</span></button>`)}</div>`;
    const s = openSheet({ title, body, className: 'action-sheet', onClose: () => resolve(chosen) });
    s.body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const it = items[+b.dataset.i];
      if (it.onSelect) it.onSelect(); // synchron, z. B. für Datei-Auswahl auf iOS
      chosen = it.value;
      s.close();
    });
  });
}

/** iOS-Alert. Liefert true/false. */
export function confirmDialog({ title, message = '', ok = 'OK', cancel = 'Abbrechen', danger = false }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'dialog-wrap';
    wrap.style.zIndex = 500;
    const bd = document.createElement('div');
    bd.className = 'backdrop';
    bd.style.zIndex = 499;
    wrap.innerHTML = String(html`
      <div class="dialog" role="alertdialog">
        <div class="d-body"><h3>${title}</h3>${message ? html`<p>${message}</p>` : ''}</div>
        <div class="d-actions">
          ${cancel ? html`<button data-v="0">${cancel}</button>` : ''}
          <button data-v="1" class="${danger ? 'danger' : 'strong'}">${ok}</button>
        </div>
      </div>`);
    document.body.append(bd, wrap);
    const dlg = wrap.querySelector('.dialog');
    nextFrame().then(() => { bd.classList.add('show'); dlg.classList.add('show'); });
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      dlg.classList.remove('show');
      bd.classList.remove('show');
      setTimeout(() => { wrap.remove(); bd.remove(); }, 250);
      resolve(b.dataset.v === '1');
    });
  });
}

/** Kurze Nachricht oben. */
export function toast(message, { actionLabel, onAction, duration = 2600, emoji } = {}) {
  let host = document.getElementById('toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    document.body.appendChild(host);
  }
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `${emoji ? `<span>${esc(emoji)}</span>` : ''}<span>${esc(message)}</span>${actionLabel ? `<button>${esc(actionLabel)}</button>` : ''}`;
  host.appendChild(t);
  const hide = () => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 400);
  };
  if (actionLabel) {
    t.querySelector('button').addEventListener('click', () => { hide(); onAction && onAction(); });
  }
  nextFrame().then(() => t.classList.add('show'));
  if (duration) setTimeout(hide, duration);
  return hide;
}
