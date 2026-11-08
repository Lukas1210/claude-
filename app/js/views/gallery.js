// Galerie: alle gemeinsamen Fotos, nach Monaten gruppiert.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { get } from '../store.js';
import { CATEGORIES, fmtMonthYear } from '../model.js';
import { allPhotos, processFiles, commitPhotos } from '../photos.js';
import { topbar, emptyState } from '../ui/components.js';
import { toast } from '../ui/sheet.js';
import { afterPaint } from '../router.js';
import { photoInput } from '../main.js';

const state = { filter: 'all' };

export async function addLoosePhotos(files) {
  const hide = toast(`${files.length === 1 ? 'Foto wird' : `${files.length} Fotos werden`} hinzugefügt …`, { emoji: '📸', duration: 0 });
  const pending = await processFiles(files);
  await commitPhotos(pending, null);
  hide();
  toast(pending.length === 1 ? 'Foto gespeichert ♡' : `${pending.length} Fotos gespeichert ♡`, { emoji: '📸' });
}

function filtered() {
  const photos = allPhotos();
  const f = state.filter;
  if (f === 'all') return photos;
  if (f === 'fav') return photos.filter((p) => p.data.favorite);
  if (f === 'loose') return photos.filter((p) => !p.data.entryId || !get(p.data.entryId));
  return photos.filter((p) => p.data.entryId && get(p.data.entryId)?.data.category === f);
}

function paint(el) {
  const photos = allPhotos();
  const list = filtered();
  const favs = photos.filter((p) => p.data.favorite).length;
  const groups = [];
  for (const p of list) {
    const key = String(p.data.takenAt || p.createdAt).slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) groups.push((g = { key, items: [] }));
    g.items.push(p);
  }
  const usedCats = Object.values(CATEGORIES).filter((c) => photos.some((p) => p.data.entryId && get(p.data.entryId)?.data.category === c.key));
  let idx = 0;

  el.innerHTML = String(html`
    ${topbar({ title: 'Galerie', right: html`<button class="icon-btn" data-act="add" aria-label="Fotos hinzufügen">${icon('plus')}</button>` })}
    <div class="page">
      <h1 class="large-title">Galerie</h1>
      <p class="page-sub">${photos.length ? `${photos.length} ${photos.length === 1 ? 'Foto' : 'Fotos'} · ${favs} ${favs === 1 ? 'Favorit' : 'Favoriten'}` : 'Alle eure gemeinsamen Momente'}</p>
      ${photos.length ? html`
        <div class="chips" style="margin-bottom:6px">
          <button class="chip ${state.filter === 'all' ? 'active' : ''}" data-f="all">Alle</button>
          <button class="chip ${state.filter === 'fav' ? 'active' : ''}" data-f="fav">♥ Favoriten</button>
          ${usedCats.map((c) => html`<button class="chip ${state.filter === c.key ? 'active' : ''}" data-f="${c.key}">${c.emoji} ${c.plural}</button>`)}
          <button class="chip ${state.filter === 'loose' ? 'active' : ''}" data-f="loose">📸 Einfach so</button>
        </div>` : ''}
      ${!photos.length
        ? emptyState({ emoji: '📸', title: 'Noch keine Fotos', text: 'Fügt eure Lieblingsfotos hinzu – oder hängt sie direkt an ein Erlebnis.', action: html`<button class="btn primary" data-act="add">${icon('camera')} Fotos hinzufügen</button>` })
        : !list.length
          ? emptyState({ emoji: '🫶', title: 'Hier ist noch nichts', text: 'In dieser Auswahl gibt es noch keine Fotos.' })
          : groups.map((g) => html`
            <div class="gallery-month"><h3>${fmtMonthYear(g.key + '-01')}</h3><span>${g.items.length}</span></div>
            <div class="gallery-grid">
              ${g.items.map((p) => html`<button class="g" data-idx="${idx++}" aria-label="Foto öffnen"><img data-photo="${p.id}" data-size="thumb" alt="">${p.data.favorite ? html`<span class="fav">${icon('heartFill')}</span>` : ''}</button>`)}
            </div>`)}
    </div>`);
  afterPaint(el);
  return list;
}

export function render(el) {
  let list = paint(el);
  const onClick = async (e) => {
    const t = e.target.closest('[data-act], [data-f], [data-idx]');
    if (!t) return;
    if (t.dataset.act === 'add') { photoInput().click(); return; }
    if (t.dataset.f) { state.filter = t.dataset.f; list = paint(el); return; }
    if (t.dataset.idx != null) {
      const { openViewer } = await import('./photo-viewer.js');
      openViewer(list.map((p) => p.id), +t.dataset.idx);
    }
  };
  el.addEventListener('click', onClick);
  return () => el.removeEventListener('click', onClick);
}
