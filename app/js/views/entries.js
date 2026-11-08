// Erlebnisse: Liste je Kategorie mit Sortierung, Suche und Geschenk-Filter.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { all, nameOf } from '../store.js';
import { CATEGORIES, avgRating, sortByDateDesc, fmtRating, ratingValue } from '../model.js';
import { entryCard, emptyState, topbar } from '../ui/components.js';
import { openEntryForm } from './entry-form.js';
import { afterPaint } from '../router.js';

const state = { cat: 'all', sort: 'date', q: '', giftFrom: 'all' };
try { Object.assign(state, JSON.parse(sessionStorage.getItem('cj-entries') || '{}'), { q: '' }); } catch {}
const persist = () => { try { sessionStorage.setItem('cj-entries', JSON.stringify(state)); } catch {} };

function filtered() {
  let list = all('entry');
  if (state.cat !== 'all') list = list.filter((e) => e.data.category === state.cat);
  if (state.cat === 'gift' && state.giftFrom !== 'all') list = list.filter((e) => e.data.extra?.from === state.giftFrom);
  const q = state.q.trim().toLowerCase();
  if (q) {
    list = list.filter((e) => [e.data.title, e.data.notes, e.data.place?.name, e.data.place?.label, e.data.extra?.cuisine, e.data.extra?.dish, e.data.extra?.highlights]
      .filter(Boolean).join(' ').toLowerCase().includes(q));
  }
  if (state.sort === 'rating') return list.sort((a, b) => (avgRating(b) ?? -1) - (avgRating(a) ?? -1));
  return sortByDateDesc(list);
}

function paint(el) {
  const entries = all('entry');
  const counts = Object.fromEntries(Object.keys(CATEGORIES).map((k) => [k, entries.filter((e) => e.data.category === k).length]));
  const list = filtered();
  const cat = CATEGORIES[state.cat];
  const avgAll = list.map(avgRating).filter((v) => v != null);
  const avg = avgAll.length ? avgAll.reduce((a, b) => a + b, 0) / avgAll.length : null;

  let giftStats = '';
  if (state.cat === 'gift') {
    const gifts = entries.filter((e) => e.data.category === 'gift');
    const from = (s) => gifts.filter((g) => g.data.extra?.from === s);
    const recvAvg = (s) => {
      const to = s === 'a' ? 'b' : 'a';
      const vals = from(s).map((g) => ratingValue(g, to)).filter((v) => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    giftStats = html`
      <div class="card" style="margin-bottom:14px">
        <div class="versus">
          <div><b>${from('a').length}</b><span class="muted" style="font-size:13px">von ${nameOf('a')}</span>${recvAvg('a') != null ? html`<div class="faint" style="font-size:12px">Ø ${fmtRating(recvAvg('a'))} ♥</div>` : ''}</div>
          <div class="vs">vs.</div>
          <div><b>${from('b').length}</b><span class="muted" style="font-size:13px">von ${nameOf('b')}</span>${recvAvg('b') != null ? html`<div class="faint" style="font-size:12px">Ø ${fmtRating(recvAvg('b'))} ♥</div>` : ''}</div>
        </div>
      </div>
      <div class="seg" style="margin-bottom:14px">
        <button class="${state.giftFrom === 'all' ? 'active' : ''}" data-gf="all">Alle</button>
        <button class="${state.giftFrom === 'a' ? 'active' : ''}" data-gf="a">von ${nameOf('a')}</button>
        <button class="${state.giftFrom === 'b' ? 'active' : ''}" data-gf="b">von ${nameOf('b')}</button>
      </div>`;
  }

  el.innerHTML = String(html`
    ${topbar({ title: 'Erlebnisse', right: html`<button class="icon-btn" data-act="sort" aria-label="Sortieren">${icon('sort')}</button>` })}
    <div class="page">
      <h1 class="large-title">Erlebnisse</h1>
      <p class="page-sub">${entries.length ? `${entries.length} gemeinsame Erinnerungen${avg != null && state.cat === 'all' ? ` · Ø ${fmtRating(avg)} ♥` : ''}` : 'Alles, was ihr zusammen erlebt habt'}</p>

      <div class="group" style="margin-bottom:14px">
        <div class="cell" style="min-height:44px">${icon('search')}<input id="q" type="search" placeholder="Suchen …" value="${state.q}" autocomplete="off"></div>
      </div>

      <div class="chips" style="margin-bottom:16px">
        <button class="chip ${state.cat === 'all' ? 'active' : ''}" data-cat="all">✨ Alle <span class="count">${entries.length}</span></button>
        ${Object.values(CATEGORIES).map((c) => html`<button class="chip ${state.cat === c.key ? 'active' : ''}" data-cat="${c.key}">${c.emoji} ${c.plural} <span class="count">${counts[c.key]}</span></button>`)}
      </div>

      ${giftStats}

      <div class="row between" style="margin-bottom:10px">
        <span class="faint" style="font-size:13px">${list.length} ${list.length === 1 ? 'Eintrag' : 'Einträge'} · ${state.sort === 'rating' ? 'nach Bewertung' : 'neueste zuerst'}</span>
        ${state.cat !== 'all' ? html`<button class="text-btn" style="font-size:15px" data-act="add">${icon('plus')} ${cat.label}</button>` : ''}
      </div>

      <div id="list" class="entry-list">
        ${list.length ? list.map((e, i) => state.sort === 'rating' && i < 3 && avgRating(e) != null
          ? html`<div style="position:relative">${entryCard(e)}<span style="position:absolute;top:-6px;left:-4px;font-size:20px">${['🥇', '🥈', '🥉'][i]}</span></div>`
          : entryCard(e))
          : state.q
            ? emptyState({ emoji: '🔍', title: 'Nichts gefunden', text: `Keine Erinnerung passt zu „${state.q}“.` })
            : emptyState({
              emoji: cat?.emoji || '🌹',
              title: cat ? `Noch keine ${cat.plural}` : 'Noch keine Erlebnisse',
              text: cat ? cat.hint : 'Fangt mit eurem letzten Date oder Lieblingsessen an.',
              action: html`<button class="btn primary" data-act="add">${icon('plus')} ${cat ? cat.label : 'Erlebnis'} hinzufügen</button>`,
            })}
      </div>
    </div>`);

  afterPaint(el);
}

export function render(el, _p, query) {
  if (query?.cat && (CATEGORIES[query.cat] || query.cat === 'all')) state.cat = query.cat;
  paint(el);
  const onClick = async (e) => {
    const t = e.target.closest('[data-cat], [data-act], [data-gf]');
    if (!t) return;
    if (t.dataset.cat) { state.cat = t.dataset.cat; persist(); paint(el); return; }
    if (t.dataset.gf) { state.giftFrom = t.dataset.gf; persist(); paint(el); return; }
    if (t.dataset.act === 'add') openEntryForm({ category: state.cat === 'all' ? 'date' : state.cat });
    if (t.dataset.act === 'sort') {
      state.sort = state.sort === 'date' ? 'rating' : 'date';
      persist();
      paint(el);
    }
  };
  let timer;
  const onInput = (e) => {
    if (e.target.id !== 'q') return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const q = el.querySelector('#q');
      state.q = q.value;
      const pos = q.selectionStart;
      paint(el);
      const nq = el.querySelector('#q');
      nq.focus();
      try { nq.setSelectionRange(pos, pos); } catch {}
    }, 250);
  };
  el.addEventListener('click', onClick);
  el.addEventListener('input', onInput);
  return () => { el.removeEventListener('click', onClick); el.removeEventListener('input', onInput); clearTimeout(timer); };
}
