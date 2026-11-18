// Geschmacks-Duell: Wie einig seid ihr euch? Wer bewertet strenger? Dazu eine Rangliste (S bis D).
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { topbar, hearts, emptyState, catBadge, catIcon } from '../ui/components.js';
import { countUpAll } from '../ui/fx.js';
import { all, nameOf } from '../store.js';
import { CATEGORIES, avgRating, fmtRating, catOf } from '../model.js';
import { coverOf } from '../photos.js';
import { ratingStats, controversial, agreementByCategory, favoriteCategory, tierList, TIERS } from '../insights.js';
import { afterPaint } from '../router.js';

const state = { tab: 'duel', cat: 'all' };

function ring(pct) {
  const r = 52, c = 2 * Math.PI * r;
  return html`<svg class="ring" viewBox="0 0 120 120" aria-hidden="true">
    <circle cx="60" cy="60" r="${r}" class="ring-bg"/>
    <circle cx="60" cy="60" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}"/>
  </svg>`;
}

function duelHtml(entries) {
  const r = ratingStats(entries);
  if (r.both < 1) return emptyState({ icon: 'swords', title: 'Noch kein Duell', text: 'Sobald ihr beide dasselbe Erlebnis bewertet habt, wird es hier spannend.' });
  const diff = r.avgA != null && r.avgB != null ? r.avgA - r.avgB : 0;
  const verdict = Math.abs(diff) < 0.15 ? 'Ihr bewertet fast gleich.' : `${nameOf(diff < 0 ? 'a' : 'b')} bewertet strenger, ${nameOf(diff < 0 ? 'b' : 'a')} großzügiger.`;
  const favA = favoriteCategory(entries, 'a'), favB = favoriteCategory(entries, 'b');
  const hot = controversial(entries, 5);
  const byCat = agreementByCategory(entries);
  return html`
    <div class="duel-hero">
      <div class="ring-wrap">${ring(r.agreement)}<div class="ring-num"><b data-count="${r.agreement}">${r.agreement}</b><span>%</span></div></div>
      <div class="grow">
        <div class="kicker">Übereinstimmung</div>
        <div class="duel-title">${r.agreement >= 85 ? 'Ihr tickt gleich.' : r.agreement >= 70 ? 'Meistens einig.' : 'Ihr streitet gern.'}</div>
        <div class="muted" style="font-size:14px;margin-top:4px">bei ${r.both} gemeinsam bewerteten Erlebnissen · ${r.exactSame}× exakt gleich</div>
      </div>
    </div>

    <div class="section">
      <div class="section-head"><h2 class="section-title small">Wer bewertet strenger?</h2></div>
      <div class="card">
        <div class="versus">
          <div><span class="muted" style="font-size:15px">${nameOf('a')}</span><b>${fmtRating(r.avgA)}</b>${hearts(r.avgA)}</div>
          <div class="vs">vs.</div>
          <div><span class="muted" style="font-size:15px">${nameOf('b')}</span><b>${fmtRating(r.avgB)}</b>${hearts(r.avgB)}</div>
        </div>
        <p class="center muted" style="margin-top:12px;font-size:14.5px">${verdict}</p>
      </div>
    </div>

    ${favA || favB ? html`
      <div class="section">
        <div class="section-head"><h2 class="section-title small">Lieblingskategorie</h2></div>
        <div class="card-grid">
          ${[['a', favA], ['b', favB]].map(([s, f]) => html`
            <div class="tile">
              ${f ? catBadge(f.c) : html`<span class="cat-badge">${icon('star')}</span>`}
              <div><div class="tile-title">${nameOf(s)}</div><div class="tile-sub">${f ? `${f.c.plural} · Ø ${fmtRating(f.avg)}` : 'noch zu wenig bewertet'}</div></div>
            </div>`)}
        </div>
      </div>` : ''}

    ${hot.length ? html`
      <div class="section">
        <div class="section-head"><h2 class="section-title small">Am umstrittensten</h2></div>
        <div class="entry-list">${hot.map((x) => html`
          <a class="hot card-link" href="#/entry/${x.e.id}">
            <div class="grow">
              <div class="entry-title">${x.e.data.title}</div>
              <div class="entry-meta">${catIcon(catOf(x.e))} ${catOf(x.e).label}</div>
            </div>
            <div class="hot-scores">
              <span><small>${nameOf('a')}</small><b>${fmtRating(x.a)}</b></span>
              <span class="hot-diff">Δ ${fmtRating(x.diff)}</span>
              <span><small>${nameOf('b')}</small><b>${fmtRating(x.b)}</b></span>
            </div>
          </a>`)}</div>
      </div>` : ''}

    ${byCat.length ? html`
      <div class="section">
        <div class="section-head"><h2 class="section-title small">Einigkeit nach Kategorie</h2></div>
        <div class="card">${byCat.map((x) => html`<div class="hbar"><span class="lbl">${catIcon(x.c)} ${x.c.plural}</span><span class="track"><i style="width:${x.agreement}%"></i></span><span class="n">${x.agreement}%</span></div>`)}</div>
      </div>` : ''}`;
}

function tiersHtml(entries) {
  const cats = Object.values(CATEGORIES).filter((c) => entries.some((e) => e.data.category === c.key && avgRating(e) != null));
  const list = state.cat === 'all' ? entries : entries.filter((e) => e.data.category === state.cat);
  const tl = tierList(list);
  const any = TIERS.some((t) => tl[t.key].length);
  return html`
    <div class="chips" style="margin-bottom:14px">
      <button class="chip ${state.cat === 'all' ? 'active' : ''}" data-tcat="all">Alle</button>
      ${cats.map((c) => html`<button class="chip ${state.cat === c.key ? 'active' : ''}" data-tcat="${c.key}">${catIcon(c)} ${c.plural}</button>`)}
    </div>
    ${!any ? emptyState({ icon: 'trophy', title: 'Noch keine Rangliste', text: 'Bewertet ein paar Erlebnisse – dann sortiert die App sie in S bis D.' }) : html`
      <div class="tiers">${TIERS.map((t) => html`
        <div class="tier-row">
          <div class="tier-label t-${t.key}"><b>${t.key}</b><small>${t.label}</small></div>
          <div class="tier-items">${tl[t.key].length ? tl[t.key].map((e) => {
            const cover = coverOf(e);
            return html`<a class="tier-item card-link" href="#/entry/${e.id}">
              <div class="tier-thumb">${cover ? html`<img data-photo="${cover}" data-size="thumb" alt="">` : catBadge(catOf(e), { size: 'fill' })}</div>
              <span class="tier-name">${e.data.title}</span>
              <span class="tier-score">${fmtRating(avgRating(e))}</span>
            </a>`;
          }) : html`<span class="faint" style="font-size:13px;padding:8px 4px">–</span>`}</div>
        </div>`)}</div>`}`;
}

function paint(el, animate = false) {
  const entries = all('entry');
  el.innerHTML = String(html`
    ${topbar({ title: state.tab === 'duel' ? 'Duell' : 'Rangliste', back: true })}
    <div class="page">
      <h1 class="large-title">${state.tab === 'duel' ? html`Geschmacks-<em>Duell</em>` : html`<em>Rang</em>liste`}</h1>
      <div class="seg" style="margin:4px 0 16px">
        <button class="${state.tab === 'duel' ? 'active' : ''}" data-tab="duel">Duell</button>
        <button class="${state.tab === 'tiers' ? 'active' : ''}" data-tab="tiers">Rangliste</button>
      </div>
      ${state.tab === 'duel' ? duelHtml(entries) : tiersHtml(entries)}
    </div>`);
  afterPaint(el);
  if (animate) countUpAll(el);
}

export function render(el, _p, query, opts = {}) {
  if (!opts.refresh && query?.tab === 'tiers') state.tab = 'tiers';
  paint(el, !opts.refresh);
  const onClick = (e) => {
    const t = e.target.closest('[data-tab], [data-tcat]');
    if (!t) return;
    if (t.dataset.tab) { state.tab = t.dataset.tab; paint(el, true); }
    if (t.dataset.tcat) { state.cat = t.dataset.tcat; paint(el); }
  };
  el.addEventListener('click', onClick);
  return () => el.removeEventListener('click', onClick);
}
