// Rückblick („Wrapped“): Story-Folien im Vollbild – euer Jahr in Zahlen, Highlights, Reisen, Duell.
// Tippen rechts = weiter, links = zurück, gedrückt halten = Pause.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { hearts, catBadge, catIcon } from '../ui/components.js';
import { confetti, countUpAll } from '../ui/fx.js';
import { all, settings, nameOf } from '../store.js';
import { CATEGORIES, avgRating, fmtRating, fmtNumber, fmtDate, today } from '../model.js';
import { coverOf } from '../photos.js';
import { flag, countryName } from '../geo.js';
import { travelStats, ratingStats, bestEntry, busiestMonth } from '../insights.js';
import { back } from '../router.js';

const SLIDE_MS = 6500;
const state = { year: null };

export function availableYears() {
  const ys = new Set(all('entry').map((e) => String(e.data.date || '').slice(0, 4)).filter((y) => /^\d{4}$/.test(y)));
  return [...ys].sort().reverse();
}

export function defaultYear() {
  const ys = availableYears();
  const cur = today().slice(0, 4);
  const n = (y) => all('entry').filter((e) => String(e.data.date).startsWith(y)).length;
  if (n(cur) >= 3) return cur;
  return ys.find((y) => n(y) >= 1) || 'all';
}

export function summary(year) {
  const every = all('entry');
  const entries = year === 'all' ? every : every.filter((e) => String(e.data.date).startsWith(year));
  const before = year === 'all' ? [] : every.filter((e) => String(e.data.date) < `${year}-01-01`);
  const home = settings().home;
  const travel = travelStats(entries, home);
  const known = new Set(travelStats(before, home).countryCodes);
  const best = bestEntry(entries);
  const photos = all('photo').filter((p) => year === 'all' || String(p.data.takenAt || p.createdAt).startsWith(year)).length;
  const cats = Object.values(CATEGORIES).map((c) => ({ c, n: entries.filter((e) => e.data.category === c.key).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  return {
    year, label: year === 'all' ? 'Alles' : year, entries, count: entries.length, travel, newCountries: travel.countryCodes.filter((cc) => !known.has(cc)),
    countries: travel.countries, km: travel.km, photos, cats, best, bestAvg: best ? avgRating(best) : null,
    food: bestEntry(entries, 'food'), recipe: bestEntry(entries, 'recipe'), movie: bestEntry(entries, 'movie'),
    nFood: entries.filter((e) => e.data.category === 'food').length, nRecipe: entries.filter((e) => e.data.category === 'recipe').length, nMovie: entries.filter((e) => e.data.category === 'movie').length,
    ratings: ratingStats(entries), agreement: ratingStats(entries).both >= 3 ? ratingStats(entries).agreement : null, month: busiestMonth(entries),
  };
}

function slides(s) {
  const list = [];
  const pair = `${nameOf('a')} & ${nameOf('b')}`;
  list.push({ key: 'intro', html: html`
    <div class="kicker">Rückblick</div>
    <div class="st-year">${s.label}</div>
    <div class="st-lead">${pair}</div>
    <div class="st-sub">${s.count} ${s.count === 1 ? 'Erlebnis' : 'Erlebnisse'}${s.year !== 'all' ? ` in ${s.year}` : ' insgesamt'}. Los geht's.</div>
    <div class="st-years">${[...availableYears(), 'all'].map((y) => html`<button class="chip ${y === s.year ? 'active' : ''}" data-year="${y}">${y === 'all' ? 'Gesamt' : y}</button>`)}</div>` });
  list.push({ key: 'numbers', html: html`
    <div class="kicker">In Zahlen</div>
    <div class="st-grid">
      ${[[s.count, 'Erlebnisse'], [s.countries, s.countries === 1 ? 'Land' : 'Länder'], [s.km, 'km gereist'], [s.photos, 'Fotos']].map(([v, l]) => html`<div><b class="${fmtNumber(v).length >= 6 ? 'long' : ''}" data-count="${v}">${fmtNumber(v)}</b><span>${l}</span></div>`)}
    </div>` });
  if (s.cats.length) {
    const max = s.cats[0].n;
    list.push({ key: 'cats', html: html`
      <div class="kicker">Was ihr gemacht habt</div>
      <div class="st-title">Am häufigsten: ${s.cats[0].c.plural}</div>
      <div class="st-bars">${s.cats.map((x, i) => html`<div class="st-bar"><span class="lbl">${catIcon(x.c)} ${x.c.plural}</span><span class="track"><i style="--w:${(x.n / max) * 100}%;--i:${i}"></i></span><b>${x.n}</b></div>`)}</div>` });
  }
  if (s.best) {
    const cover = coverOf(s.best);
    list.push({ key: 'best', bg: cover, html: html`
      <div class="kicker">Euer Highlight</div>
      ${cover ? '' : html`<div style="margin:10px 0 16px">${catBadge(CATEGORIES[s.best.data.category] || CATEGORIES.date, { size: 'xl' })}</div>`}
      <div class="st-title big">${s.best.data.title}</div>
      <div class="st-sub">${fmtDate(s.best.data.date, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      <div class="st-hearts">${hearts(s.bestAvg, { lg: true })}<b>${fmtRating(s.bestAvg)}</b></div>` });
  }
  if (s.countries || s.km) {
    list.push({ key: 'travel', html: html`
      <div class="kicker">Unterwegs</div>
      <div class="st-title">${fmtNumber(s.km)} km und ${s.countries} ${s.countries === 1 ? 'Land' : 'Länder'}</div>
      <div class="st-flags">${s.travel.countryCodes.map((cc) => html`<span title="${countryName(cc)}">${flag(cc)}</span>`)}</div>
      ${s.newCountries.length && s.year !== 'all' ? html`<div class="st-sub">Neu dabei: ${s.newCountries.map((cc) => countryName(cc)).join(', ')}</div>` : ''}
      ${s.km >= 40075 ? html`<div class="st-sub">Mehr als einmal um die Erde.</div>` : s.km ? html`<div class="st-sub">${Math.round((s.km / 40075) * 100)} % einer Erdumrundung.</div>` : ''}` });
  }
  if (s.food || s.recipe) {
    list.push({ key: 'food', html: html`
      <div class="kicker">Essen & Kochen</div>
      <div class="st-title">${s.nFood} ${s.nFood === 1 ? 'Restaurant' : 'Restaurants'} · ${s.nRecipe} ${s.nRecipe === 1 ? 'Rezept' : 'Rezepte'}</div>
      ${s.food ? html`<div class="st-card">${catIcon(CATEGORIES.food)} <span class="grow">Bestes Essen<b>${s.food.data.title}</b></span><em>${fmtRating(avgRating(s.food))}</em></div>` : ''}
      ${s.recipe ? html`<div class="st-card">${catIcon(CATEGORIES.recipe)} <span class="grow">Bestes Rezept<b>${s.recipe.data.title}</b></span><em>${fmtRating(avgRating(s.recipe))}</em></div>` : ''}` });
  }
  if (s.movie) {
    list.push({ key: 'movie', html: html`
      <div class="kicker">Couch & Kino</div>
      <div class="st-title">${s.nMovie} ${s.nMovie === 1 ? 'Film oder Serie' : 'Filme & Serien'}</div>
      <div class="st-card">${catIcon(CATEGORIES.movie)} <span class="grow">Euer Favorit<b>${s.movie.data.title}</b></span><em>${fmtRating(avgRating(s.movie))}</em></div>` });
  }
  if (s.agreement != null) {
    const r = s.ratings;
    const d = (r.avgA ?? 0) - (r.avgB ?? 0);
    list.push({ key: 'duel', html: html`
      <div class="kicker">Geschmacks-Duell</div>
      <div class="st-year small"><span data-count="${s.agreement}">${s.agreement}</span>%</div>
      <div class="st-title">so einig wart ihr euch</div>
      <div class="st-sub">${Math.abs(d) < 0.15 ? 'Ihr bewertet fast gleich.' : `${nameOf(d < 0 ? 'a' : 'b')} war strenger (Ø ${fmtRating(Math.min(r.avgA, r.avgB))} vs. ${fmtRating(Math.max(r.avgA, r.avgB))}).`}</div>` });
  }
  if (s.month && s.month.n > 1) {
    list.push({ key: 'month', html: html`
      <div class="kicker">Stärkster Monat</div>
      <div class="st-year small">${fmtDate(`${s.month.key}-01`, { month: 'long' })}</div>
      <div class="st-sub">${s.month.n} Erlebnisse in ${fmtDate(`${s.month.key}-01`, { month: 'long', year: 'numeric' })}.</div>` });
  }
  list.push({ key: 'outro', html: html`
    <div class="kicker">${s.year === 'all' ? 'Alles zusammen' : `Das war ${s.year}`}</div>
    <div class="st-title big">${s.count ? 'Starke Bilanz.' : 'Noch ganz am Anfang.'}</div>
    <div class="st-sub">${s.count ? 'Mal sehen, was ihr als Nächstes erlebt.' : 'Tragt eure ersten Erlebnisse ein – dann füllt sich der Rückblick.'}</div>
    <div class="st-actions">
      <button class="btn primary block" data-act="share">${icon('share')} Als Bild teilen</button>
      <button class="btn block st-ghost" data-act="again">${icon('refresh')} Nochmal ansehen</button>
    </div>` });
  return list;
}

export const live = false;

export function render(el, _p, query) {
  const years = availableYears();
  state.year = query?.y && (years.includes(query.y) || query.y === 'all') ? query.y : state.year && (years.includes(state.year) || state.year === 'all') ? state.year : defaultYear();
  let sum = summary(state.year);
  let list = slides(sum);
  let i = 0, timer = null, paused = false, startedAt = 0, remaining = SLIDE_MS;

  el.innerHTML = String(html`
    <div class="story" id="story">
      <div class="story-bars" id="bars"></div>
      <button class="story-close" data-act="close" aria-label="Schließen">${icon('x')}</button>
      <div class="story-bg" id="sbg"></div>
      <div class="story-body" id="sbody"></div>
      <div class="story-hint faint">Tippen: weiter · halten: Pause</div>
    </div>`);
  const story = el.querySelector('#story');

  const schedule = (ms) => { clearTimeout(timer); startedAt = Date.now(); remaining = ms; timer = setTimeout(() => go(i + 1), ms); };
  function paintBars() {
    el.querySelector('#bars').innerHTML = list.map((_, k) => `<span class="${k < i ? 'done' : k === i ? 'run' : ''}"><i style="animation-duration:${SLIDE_MS}ms"></i></span>`).join('');
  }
  function show() {
    const sl = list[i];
    paintBars();
    const bg = el.querySelector('#sbg');
    bg.innerHTML = sl.bg ? `<img data-photo="${sl.bg}" data-size="full" alt=""><div class="shade"></div>` : '';
    story.classList.toggle('has-bg', !!sl.bg);
    const body = el.querySelector('#sbody');
    body.innerHTML = String(sl.html);
    body.classList.remove('in'); void body.offsetWidth; body.classList.add('in');
    countUpAll(body);
    import('../photos.js').then((P) => P.hydrate(el));
    if (sl.key === 'outro') { confetti(70); clearTimeout(timer); story.classList.add('end'); }
    else { story.classList.remove('end'); if (!paused) schedule(SLIDE_MS); }
  }
  function go(n) {
    if (n < 0) n = 0;
    if (n >= list.length) n = list.length - 1;
    i = n;
    show();
  }
  const pause = (on) => {
    if (on === paused || list[i].key === 'outro') return;
    paused = on;
    story.classList.toggle('paused', on);
    if (on) { clearTimeout(timer); remaining -= Date.now() - startedAt; }
    else schedule(Math.max(400, remaining));
  };

  let downAt = 0, holdTimer = null;
  const onDown = (e) => {
    if (e.target.closest('button, a')) return;
    downAt = Date.now();
    holdTimer = setTimeout(() => pause(true), 250);
  };
  const onUp = (e) => {
    clearTimeout(holdTimer);
    if (e.target.closest('button, a')) return;
    if (paused) { pause(false); return; }
    if (Date.now() - downAt > 400) return;
    const x = e.clientX / window.innerWidth;
    go(x < 0.3 ? i - 1 : i + 1);
  };
  const onClick = async (e) => {
    const b = e.target.closest('[data-act], [data-year]');
    if (!b) return;
    if (b.dataset.year) {
      state.year = b.dataset.year;
      sum = summary(state.year); list = slides(sum); paused = false; go(0);
      return;
    }
    if (b.dataset.act === 'close') { clearTimeout(timer); back('/'); }
    if (b.dataset.act === 'again') go(0);
    if (b.dataset.act === 'share') {
      const { wrappedImage, openShareSheet } = await import('../share-image.js');
      openShareSheet(wrappedImage(sum), { filename: `rueckblick-${sum.label}.jpg`.toLowerCase(), title: `Rückblick ${sum.label}` });
    }
  };
  const onKey = (e) => { if (e.key === 'ArrowRight') go(i + 1); if (e.key === 'ArrowLeft') go(i - 1); if (e.key === 'Escape') back('/'); };
  story.addEventListener('pointerdown', onDown);
  story.addEventListener('pointerup', onUp);
  story.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  document.body.classList.add('story-open');
  show();
  return () => {
    clearTimeout(timer); clearTimeout(holdTimer);
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('story-open');
  };
}
