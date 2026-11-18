// Swipe-Match: Jeder wischt für sich durch Ideen. Wischen beide nach rechts → Match (direkt planbar).
// Stimmen liegen in zwei Einträgen mit fester ID je Person → keine Konflikte beim Abgleich.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { topbar, emptyState } from '../ui/components.js';
import { toast } from '../ui/sheet.js';
import { confetti } from '../ui/fx.js';
import { get, save, me, nameOf, getDevice, setDevice, subscribe } from '../store.js';
import { inSeason, SOURCE_LABEL } from '../ideas.js';
import { isConfigured } from '../sync.js';
import { ideaPool, ideaBadge, ideaMeta, openDatePlanner } from './dateplanner.js';
import { afterPaint, go } from '../router.js';

export const VOTES_ID = { a: '00000000-0000-4000-8000-0000000000a1', b: '00000000-0000-4000-8000-0000000000b1' };
export const votesOf = (slot) => get(VOTES_ID[slot])?.data.votes || {};

export async function vote(slot, ideaId, v) {
  const cur = votesOf(slot);
  await save('votes', { slot, votes: { ...cur, [ideaId]: { v, at: new Date().toISOString() } } }, { id: VOTES_ID[slot] });
}

/** Ideen, die beide mit „Lust“ markiert haben (neueste zuerst). */
export function matches(pool = ideaPool()) {
  const a = votesOf('a'), b = votesOf('b');
  return pool
    .filter((i) => a[i.id]?.v === 1 && b[i.id]?.v === 1)
    .sort((x, y) => String([a[y.id].at, b[y.id].at].sort().at(-1)).localeCompare(String([a[x.id].at, b[x.id].at].sort().at(-1))));
}

/** Für den Abgleich: neue Matches einmalig melden (z. B. wenn der Partner gerade gewischt hat). */
export async function notifyNewMatches() {
  const list = matches();
  const seen = new Set(getDevice().seenMatches || []);
  const fresh = list.filter((i) => !seen.has(i.id));
  if (!fresh.length) return;
  await setDevice({ seenMatches: [...seen, ...fresh.map((i) => i.id)].slice(-500) });
  confetti(60);
  toast(fresh.length === 1 ? `Neues Match: ${fresh[0].title}` : `${fresh.length} neue Matches`, { icon: 'cards', actionLabel: 'Ansehen', duration: 5000, onAction: () => go('/match?tab=matches') });
}

const state = { tab: 'swipe', swiper: null, order: null };

function swiper() {
  return state.swiper || me();
}

function deck() {
  const pool = ideaPool().filter((i) => inSeason(i));
  const mine = votesOf(swiper());
  if (!state.order) {
    const ids = pool.map((i) => i.id);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    // Eigene Ideen (Bucket-Liste, Watchlist, Lieblingsorte) nach vorne
    state.order = [...ids.filter((id) => !id.startsWith('idea:')), ...ids.filter((id) => id.startsWith('idea:'))];
  }
  const byId = new Map(pool.map((i) => [i.id, i]));
  const ordered = state.order.map((id) => byId.get(id)).filter(Boolean);
  for (const i of pool) if (!state.order.includes(i.id)) ordered.unshift(i);
  return ordered.filter((i) => !mine[i.id]);
}

function card(i, depth) {
  return html`
    <div class="swipe-card" data-id="${i.id}" style="--d:${depth}">
      <span class="stamp yes">Lust</span><span class="stamp no">Nö</span>
      <div class="row between" style="align-items:flex-start">${ideaBadge(i, 'xl')}<span class="kicker">${SOURCE_LABEL[i.source] || 'Idee'}</span></div>
      <h2 class="idea-title">${i.title}</h2>
      <p class="idea-text">${i.text}</p>
      ${ideaMeta(i) ? html`<div class="faint" style="font-size:13.5px;margin-top:10px">${ideaMeta(i)}</div>` : ''}
    </div>`;
}

function paint(el) {
  const list = deck();
  const m = matches();
  const pVotes = votesOf(swiper() === 'a' ? 'b' : 'a');
  const partnerDone = Object.keys(pVotes).length;
  el.innerHTML = String(html`
    ${topbar({ title: 'Match', back: true })}
    <div class="page match-page">
      <h1 class="large-title">Swipe-<em>Match</em></h1>
      <div class="seg" style="margin:4px 0 12px">
        <button class="${state.tab === 'swipe' ? 'active' : ''}" data-tab="swipe">Swipen</button>
        <button class="${state.tab === 'matches' ? 'active' : ''}" data-tab="matches">Matches${m.length ? ` · ${m.length}` : ''}</button>
      </div>
      ${state.tab === 'swipe' ? html`
        ${!isConfigured() ? html`
          <div class="seg small-seg" style="margin-bottom:10px">
            <button class="${swiper() === 'a' ? 'active' : ''}" data-swiper="a">${nameOf('a')} wischt</button>
            <button class="${swiper() === 'b' ? 'active' : ''}" data-swiper="b">${nameOf('b')} wischt</button>
          </div>
          <p class="faint" style="font-size:12.5px;margin:-2px 4px 10px">Ohne Sync: Handy weitergeben und oben umschalten.</p>` : html`<p class="page-sub">${nameOf(swiper() === 'a' ? 'b' : 'a')} hat schon ${partnerDone} Ideen bewertet.</p>`}
        ${list.length ? html`
          <div class="deck" id="deck">${list.slice(0, 3).map((i, k) => card(i, k)).reverse()}</div>
          <div class="swipe-actions">
            <button class="sw-btn no" data-act="no" aria-label="Nö">${icon('x')}</button>
            <span class="faint" style="font-size:13px">${list.length} übrig</span>
            <button class="sw-btn yes" data-act="yes" aria-label="Lust">${icon('check')}</button>
          </div>` : emptyState({ icon: 'cards', title: 'Alles gewischt', text: 'Neue Ideen kommen über die Bucket-Liste, die Watchlist und eure Lieblingsorte dazu.', action: html`<button class="btn" data-act="reset">${icon('refresh')} Meine Stimmen zurücksetzen</button>` })}`
      : m.length ? html`<div class="entry-list">${m.map((i) => html`
          <div class="match-row">
            ${ideaBadge(i, 'md')}
            <div class="grow"><div class="entry-title">${i.title}</div><div class="entry-meta">${ideaMeta(i) || SOURCE_LABEL[i.source]}</div></div>
            <button class="btn small" data-plan="${i.id}">${icon('calendarPlus')} Planen</button>
          </div>`)}</div>`
        : emptyState({ icon: 'cards', title: 'Noch keine Matches', text: `Sobald ihr beide bei derselben Idee „Lust“ wischt, landet sie hier.` })}
    </div>`);
  afterPaint(el);
  bindDrag(el);
}

function showMatch(el, idea) {
  confetti(90);
  const ov = document.createElement('div');
  ov.className = 'match-overlay';
  ov.innerHTML = String(html`
    <div class="match-box">
      <div class="kicker">Match</div>
      <div class="match-title">Ihr beide habt Lust auf</div>
      <div class="match-idea">${ideaBadge(idea, 'xl')}<h2 class="idea-title">${idea.title}</h2></div>
      <button class="btn primary block" data-m="plan">${icon('calendarPlus')} Gleich planen</button>
      <button class="btn block" data-m="close">Weiter wischen</button>
    </div>`);
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));
  const close = () => { ov.classList.remove('show'); setTimeout(() => ov.remove(), 250); };
  ov.addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]');
    if (!b && e.target !== ov) return;
    close();
    if (b?.dataset.m === 'plan') openDatePlanner({ idea });
  });
}

async function decide(el, v, cardEl) {
  const top = cardEl || el.querySelector('#deck .swipe-card:last-child');
  if (!top) return;
  const id = top.dataset.id;
  const idea = ideaPool().find((i) => i.id === id);
  const dir = v === 1 ? 1 : -1;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!reduced) {
    top.style.transition = 'transform .32s cubic-bezier(.2,.8,.2,1), opacity .32s ease';
    top.style.transform = `translate(${dir * 130}%, -6%) rotate(${dir * 18}deg)`;
    top.style.opacity = '0';
    await new Promise((r) => setTimeout(r, 260));
  }
  const slot = swiper();
  await vote(slot, id, v);
  const other = votesOf(slot === 'a' ? 'b' : 'a');
  if (v === 1 && other[id]?.v === 1 && idea) {
    const seen = getDevice().seenMatches || [];
    if (!seen.includes(id)) await setDevice({ seenMatches: [...seen, id].slice(-500) });
    showMatch(el, idea);
  }
  paint(el);
}

function bindDrag(el) {
  const top = el.querySelector('#deck .swipe-card:last-child');
  if (!top) return;
  let x0 = 0, y0 = 0, dx = 0, active = false;
  const yes = top.querySelector('.stamp.yes'), no = top.querySelector('.stamp.no');
  top.addEventListener('pointerdown', (e) => { active = true; x0 = e.clientX; y0 = e.clientY; dx = 0; top.setPointerCapture?.(e.pointerId); top.style.transition = 'none'; });
  top.addEventListener('pointermove', (e) => {
    if (!active) return;
    dx = e.clientX - x0;
    const dy = (e.clientY - y0) * 0.3;
    top.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`;
    yes.style.opacity = Math.max(0, Math.min(1, dx / 90));
    no.style.opacity = Math.max(0, Math.min(1, -dx / 90));
  });
  const end = () => {
    if (!active) return;
    active = false;
    if (Math.abs(dx) > 100) { decide(el, dx > 0 ? 1 : -1, top); return; }
    top.style.transition = 'transform .3s cubic-bezier(.32,1.25,.5,1)';
    top.style.transform = '';
    yes.style.opacity = 0; no.style.opacity = 0;
  };
  top.addEventListener('pointerup', end);
  top.addEventListener('pointercancel', end);
}

export const live = false;

export function render(el, _p, query, opts = {}) {
  if (!opts.refresh && query?.tab === 'matches') state.tab = 'matches';
  state.order = null;
  paint(el);
  let timer;
  const unsub = subscribe((evt) => {
    if (evt.source !== 'remote' || !evt.types.some((t) => t === 'votes' || t === 'wish' || t === 'entry')) return;
    clearTimeout(timer);
    timer = setTimeout(() => paint(el), 200);
  });
  const onClick = async (e) => {
    const t = e.target.closest('[data-tab], [data-act], [data-swiper], [data-plan]');
    if (!t) return;
    if (t.dataset.tab) { state.tab = t.dataset.tab; paint(el); return; }
    if (t.dataset.swiper) { state.swiper = t.dataset.swiper; state.order = null; paint(el); return; }
    if (t.dataset.plan) { const idea = ideaPool().find((i) => i.id === t.dataset.plan); if (idea) openDatePlanner({ idea }); return; }
    if (t.dataset.act === 'yes') decide(el, 1);
    if (t.dataset.act === 'no') decide(el, -1);
    if (t.dataset.act === 'reset') { await save('votes', { slot: swiper(), votes: {} }, { id: VOTES_ID[swiper()] }); state.order = null; paint(el); }
  };
  el.addEventListener('click', onClick);
  return () => { unsub(); clearTimeout(timer); el.removeEventListener('click', onClick); };
}

