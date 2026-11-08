// Ort auswählen: Suche (OpenStreetMap), aktueller Standort oder freier Text.
import { html } from './dom.js';
import { icon } from './icons.js';
import { openSheet, toast } from './sheet.js';
import { searchPlaces, reversePlace, currentPosition, flag } from '../geo.js';

/** Liefert einen Ort, null (entfernen) oder undefined (abgebrochen). */
export function pickPlace({ current = null, title = 'Ort wählen' } = {}) {
  return new Promise((resolve) => {
    let result;
    const sheet = openSheet({
      title,
      full: true,
      left: html`<button class="text-btn" data-act="cancel">Abbrechen</button>`,
      right: current ? html`<button class="text-btn" data-act="clear" style="color:var(--danger)">Entfernen</button>` : '',
      body: html`
        <div class="group" style="margin-bottom:14px">
          <div class="cell">${icon('search')}<input id="pq" type="search" placeholder="Ort, Restaurant, Stadt …" enterkeyhint="search" autocomplete="off" value="${current?.name || ''}"></div>
        </div>
        <button class="btn block small" data-act="here" style="margin-bottom:10px">${icon('locate')} Aktuellen Standort verwenden</button>
        <div id="pres" class="place-results"></div>
        <p class="faint center" style="font-size:12px;margin-top:20px">Ortsdaten © OpenStreetMap-Mitwirkende</p>`,
      onClose: () => resolve(result),
    });
    const input = sheet.body.querySelector('#pq');
    const resEl = sheet.body.querySelector('#pres');
    let ctrl, timer, results = [];

    const renderResults = (list, q, loading = false, error = '') => {
      results = list;
      resEl.innerHTML = String(html`
        ${loading ? html`<p class="faint center" style="padding:12px">Suche …</p>` : ''}
        ${error ? html`<p class="center" style="padding:12px;color:var(--danger)">${error}</p>` : ''}
        ${list.map((p, i) => html`<button class="place-result" data-i="${i}"><span class="pin">${flag(p.countryCode)}</span><span class="grow"><span>${p.name}</span><small>${p.label}</small></span></button>`)}
        ${q && q.length >= 2 && !loading ? html`<button class="place-result" data-free="1"><span class="pin">${icon('edit')}</span><span class="grow"><span>„${q}“ ohne Karte verwenden</span><small>Erscheint dann nicht auf dem Globus</small></span></button>` : ''}`);
    };

    const search = async () => {
      const q = input.value.trim();
      if (q.length < 2) { renderResults([], q); return; }
      ctrl?.abort();
      ctrl = new AbortController();
      renderResults(results, q, true);
      try {
        const list = await searchPlaces(q, { signal: ctrl.signal });
        renderResults(list, q);
      } catch (e) {
        if (e.name !== 'AbortError') renderResults([], q, false, navigator.onLine ? 'Suche gerade nicht möglich' : 'Offline – Suche nicht möglich');
      }
    };

    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 650); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); search(); input.blur(); } });
    if (current?.name) renderResults([], current.name);
    else setTimeout(() => input.focus(), 400);

    sheet.el.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-act], [data-i], [data-free]');
      if (!t) return;
      if (t.dataset.act === 'cancel') { result = undefined; sheet.close(); }
      else if (t.dataset.act === 'clear') { result = null; sheet.close(); }
      else if (t.dataset.act === 'here') {
        t.disabled = true;
        t.innerHTML = 'Standort wird ermittelt …';
        try {
          const pos = await currentPosition();
          result = await reversePlace(pos.lat, pos.lng).catch(() => ({ name: 'Hier', label: '', lat: pos.lat, lng: pos.lng, country: '', countryCode: '' }));
          sheet.close();
        } catch (err) {
          toast(err.message, { emoji: '📍' });
          t.disabled = false;
          t.innerHTML = String(html`${icon('locate')} Aktuellen Standort verwenden`);
        }
      } else if (t.dataset.i != null) {
        result = results[+t.dataset.i];
        sheet.close();
      } else if (t.dataset.free) {
        result = { name: input.value.trim(), label: '', lat: null, lng: null, country: '', countryCode: '' };
        sheet.close();
      }
    });
  });
}
