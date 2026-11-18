// Erfolge & Serien: Abzeichen mit Fortschrittsring, Monats-Serie.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { topbar } from '../ui/components.js';
import { openSheet } from '../ui/sheet.js';
import { all, settings, getDevice, setDevice } from '../store.js';
import { today, fmtNumber } from '../model.js';
import { ACHIEVEMENTS, TIER_NAMES, buildContext, evaluate, newlyUnlocked } from '../achievements.js';
import { afterPaint } from '../router.js';

export function currentResults() {
  const ctx = buildContext({
    entries: all('entry'), photos: all('photo').length, wishes: all('wish'), events: all('event').length,
    todos: all('todo'), settings: settings(), today: today(),
  });
  return { ctx, results: evaluate(ctx) };
}

/** Neue Stufen erkennen (einmalig melden). Beim allerersten Mal wird nur der Stand gemerkt. */
export async function checkUnlocks() {
  const { results } = currentResults();
  const dev = getDevice();
  const now = Object.fromEntries(results.map((r) => [r.def.id, r.tier]));
  if (!dev.seenAch) { await setDevice({ seenAch: now }); return []; }
  const fresh = newlyUnlocked(results, dev.seenAch);
  if (fresh.length) await setDevice({ seenAch: { ...dev.seenAch, ...now } });
  return fresh;
}

function badge(r) {
  const R = 30, C = 2 * Math.PI * R;
  const pct = r.tier === 3 ? 1 : r.progress;
  return html`
    <button class="award t${r.tier}" data-award="${r.def.id}">
      <span class="award-ring">
        <svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="${R}" class="ring-bg"/><circle cx="36" cy="36" r="${R}" class="ring-fg" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg>
        <span class="award-ico">${icon(r.def.icon)}</span>
      </span>
      <span class="award-title">${r.def.title}</span>
      <span class="award-tier">${r.tier ? TIER_NAMES[r.tier] : 'Noch offen'}</span>
      <span class="award-sub">${r.next == null ? `${fmtNumber(r.value)} ${r.def.unit}` : `${fmtNumber(r.value)} / ${fmtNumber(r.next)}`}</span>
    </button>`;
}

function openDetail(r) {
  openSheet({
    title: r.def.title,
    body: html`
      <div class="form center">
        <div class="award-detail">${badge(r)}</div>
        <p class="muted">${fmtNumber(r.value)} ${r.def.unit}${r.def.hint ? ` · ${r.def.hint}` : ''}</p>
        <div class="group" style="text-align:left">
          ${r.def.tiers.map((t, i) => html`<div class="cell"><span class="tier-dot t${i + 1}"></span><span class="grow">${TIER_NAMES[i + 1]}</span><span class="value">${fmtNumber(t)} ${r.def.unit}</span>${r.value >= t ? html`<span class="rose">${icon('check')}</span>` : ''}</div>`)}
        </div>
      </div>`,
  });
}

export function render(el) {
  const { ctx, results } = currentResults();
  const unlocked = results.filter((r) => r.tier > 0).length;
  const medals = results.reduce((n, r) => n + r.tier, 0);
  const s = ctx.streak;
  el.innerHTML = String(html`
    ${topbar({ title: 'Erfolge', back: true })}
    <div class="page">
      <h1 class="large-title"><em>Erfolge</em></h1>
      <p class="page-sub">${unlocked} von ${ACHIEVEMENTS.length} freigeschaltet · ${medals} von ${ACHIEVEMENTS.length * 3} Stufen</p>
      <div class="streak-card">
        <span class="streak-ico">${icon('flame')}</span>
        <div class="grow">
          <div class="kicker">Serie</div>
          <div class="streak-num">${s.current} ${s.current === 1 ? 'Monat' : 'Monate'} in Folge</div>
          <div class="muted" style="font-size:13.5px;margin-top:2px">${s.thisMonth ? 'Diesen Monat schon dabei.' : s.current ? 'Tragt diesen Monat noch etwas ein, sonst reißt die Serie.' : 'Ein Erlebnis pro Monat – und die Serie läuft.'} Bester Lauf: ${s.best}.</div>
        </div>
      </div>
      <div class="award-grid">${[...results].sort((a, b) => b.tier - a.tier || b.progress - a.progress).map(badge)}</div>
    </div>`);
  afterPaint(el);
  const onClick = (e) => {
    const b = e.target.closest('[data-award]');
    if (b) openDetail(results.find((r) => r.def.id === b.dataset.award));
  };
  el.addEventListener('click', onClick);
  return () => el.removeEventListener('click', onClick);
}
