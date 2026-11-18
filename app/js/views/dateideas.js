// Zufalls-Date: Idee würfeln – passend zu Wetter, Budget, Stimmung, Dauer und Ort.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { topbar } from '../ui/components.js';
import { toast } from '../ui/sheet.js';
import { sparkBurst } from '../ui/fx.js';
import { save, settings, getDevice, setDevice } from '../store.js';
import { today, parseDate, isoDate, fmtDate } from '../model.js';
import { MOODS, BUDGETS, DURATIONS, SOURCE_LABEL, moodOf, pickIdea, matches } from '../ideas.js';
import { getForecast, dayWeather } from '../weather.js';
import { currentPosition } from '../geo.js';
import { nextSaturday } from '../dateplan.js';
import { ideaPool, ideaBadge, ideaMeta, openDatePlanner } from './dateplanner.js';
import { afterPaint } from '../router.js';

const KEY = 'cj-ideas';
const state = { when: 'any', where: 'any', budget: 'any', mood: 'any', dur: 'any', ideaId: null, exclude: [], relaxed: [] };
try { Object.assign(state, JSON.parse(sessionStorage.getItem(KEY) || '{}')); } catch {}
const persist = () => { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
let wx = { status: 'idle', day: null, data: null, error: '' };

const WISH_CAT = { cook: 'recipe', food: 'food', trip: 'trip', activity: 'activity', date: 'date' };
const RELAX_LABEL = { dur: 'Dauer', mood: 'Stimmung', budget: 'Budget', where: 'Ort' };

function whenDate() {
  const t = today();
  if (state.when === 'today') return t;
  if (state.when === 'tomorrow') { const d = parseDate(t); d.setDate(d.getDate() + 1); return isoDate(d); }
  if (state.when === 'weekend') return nextSaturday(t);
  return null;
}

function filters() {
  return {
    where: state.where, budget: state.budget === 'any' ? 'any' : +state.budget, mood: state.mood, dur: state.dur,
    outdoorOk: wx.status === 'ok' && wx.data ? wx.data.outdoorOk : undefined,
  };
}

function location() {
  const h = settings().home;
  if (h?.lat != null) return { lat: h.lat, lng: h.lng, source: 'home' };
  const d = getDevice().wxLoc;
  return d?.lat != null ? { ...d, source: 'device' } : null;
}

async function loadWeather(el) {
  const day = whenDate();
  if (!day) { wx = { status: 'idle', day: null, data: null }; return; }
  const loc = location();
  if (!loc) { wx = { status: 'noloc', day, data: null }; return; }
  if (wx.status === 'ok' && wx.day === day) return;
  wx = { status: 'loading', day, data: null };
  if (el.isConnected) paint(el);
  try {
    const f = await getForecast(loc.lat, loc.lng);
    const w = dayWeather(f, day);
    wx = w ? { status: 'ok', day, data: w } : { status: 'error', day, data: null, error: 'Für diesen Tag gibt es noch keine Vorhersage.' };
  } catch (e) {
    wx = { status: 'error', day, data: null, error: 'Wetter gerade nicht verfügbar.' };
  }
  if (el.isConnected) { ensureIdea(); paint(el); }
}

function currentIdea(pool) {
  return pool.find((i) => i.id === state.ideaId) || null;
}

function ensureIdea(force = false) {
  const pool = ideaPool();
  const f = filters();
  const cur = currentIdea(pool);
  const d = whenDate() ? parseDate(whenDate()) : new Date();
  if (!force && cur && matches(cur, f, d)) return cur;
  const res = pickIdea(pool, f, { exclude: [...state.exclude, ...(cur ? [cur.id] : [])], date: d });
  state.ideaId = res?.idea.id || null;
  state.relaxed = res?.relaxed || [];
  persist();
  return res?.idea || null;
}

const seg = (key, opts) => html`<div class="seg">${opts.map(([v, l]) => html`<button class="${String(state[key]) === String(v) ? 'active' : ''}" data-f="${key}" data-v="${v}">${l}</button>`)}</div>`;

function weatherRow() {
  const day = whenDate();
  if (!day) return html`<div class="wx-row faint">${icon('cloudSun')} Wähle einen Tag, dann berücksichtigt die App das Wetter.</div>`;
  const label = fmtDate(day, { weekday: 'short', day: 'numeric', month: 'numeric' });
  if (wx.status === 'noloc') return html`<button class="wx-row link" data-act="locate">${icon('locate')} <span class="grow">Standort fürs Wetter nutzen</span><span class="chev">${icon('chevron')}</span></button>`;
  if (wx.status === 'loading') return html`<div class="wx-row faint">${icon('cloud')} Wetter für ${label} wird geladen …</div>`;
  if (wx.status === 'error') return html`<div class="wx-row faint">${icon('cloud')} ${wx.error}</div>`;
  if (wx.status === 'ok') {
    const w = wx.data;
    return html`<div class="wx-row ${w.outdoorOk ? 'good' : 'bad'}">${icon(w.icon)} <span class="grow"><b>${label}</b> · ${w.tmax}°${['Regen', 'Niesel'].includes(w.label) ? '' : ` · ${w.label}`}${w.rain >= 20 ? ` · ${w.rain} % Regenrisiko` : ''}</span><span class="wx-hint">${w.outdoorOk ? 'Draußen geht' : 'Lieber drinnen'}</span></div>`;
  }
  return '';
}

function paint(el) {
  const pool = ideaPool();
  const idea = currentIdea(pool) || ensureIdea();
  const d = whenDate() ? parseDate(whenDate()) : new Date();
  const count = pool.filter((i) => matches(i, filters(), d)).length;
  el.innerHTML = String(html`
    ${topbar({ title: 'Date-Ideen', back: true })}
    <div class="page">
      <h1 class="large-title">Zufalls-<em>Date</em></h1>
      <p class="page-sub">Würfelt eine Idee – passend zu Wetter, Budget und Stimmung.</p>

      <div class="idea-card" id="idea-card">
        ${idea ? html`
          <div class="row between" style="align-items:flex-start">
            ${ideaBadge(idea, 'xl')}
            <span class="kicker">${SOURCE_LABEL[idea.source] || 'Idee'}</span>
          </div>
          <h2 class="idea-title">${idea.title}</h2>
          <p class="idea-text">${idea.text}</p>
          <div class="idea-tags">
            ${ideaMeta(idea) ? html`<span class="chip static">${icon('wallet')} ${ideaMeta(idea)}</span>` : ''}
            ${idea.sky === 'out' ? html`<span class="chip static">${icon('sun')} draußen</span>` : idea.sky === 'in' ? html`<span class="chip static">${icon('door')} drinnen</span>` : ''}
            ${idea.moods.map((m) => html`<span class="chip static">${icon(moodOf(m)?.icon || 'sparkles')} ${moodOf(m)?.label || m}</span>`)}
          </div>
          ${state.relaxed.length ? html`<p class="faint" style="font-size:12.5px;margin-top:10px">Kein exakter Treffer – gelockert: ${state.relaxed.map((k) => RELAX_LABEL[k]).join(', ')}</p>` : ''}
        ` : html`<p class="muted">Keine Idee gefunden. Lockert ein paar Filter.</p>`}
      </div>

      <div class="idea-actions">
        <button class="btn primary block" data-act="roll">${icon('dice')} Würfeln</button>
        <div class="row" style="gap:8px">
          <button class="btn small grow" data-act="plan" ${idea ? '' : 'disabled'}>${icon('calendarPlus')} Planen</button>
          ${idea && idea.source !== 'bucket' ? html`<button class="btn small grow" data-act="keep">${icon('star')} Merken</button>` : ''}
          <button class="btn small" data-act="nope" aria-label="Passt nicht" ${idea ? '' : 'disabled'}>${icon('x')}</button>
        </div>
      </div>

      <div class="form" style="margin-top:22px">
        <div>
          <div class="group-label">Wann?</div>
          ${seg('when', [['any', 'Egal'], ['today', 'Heute'], ['tomorrow', 'Morgen'], ['weekend', 'Wochenende']])}
          ${weatherRow()}
        </div>
        <div><div class="group-label">Wo?</div>${seg('where', [['any', 'Egal'], ['home', 'Zu Hause'], ['out', 'Unterwegs']])}</div>
        <div><div class="group-label">Budget</div>${seg('budget', [['any', 'Egal'], ...BUDGETS.map((b) => [b.key, b.label])])}</div>
        <div><div class="group-label">Dauer</div>${seg('dur', [['any', 'Egal'], ...DURATIONS.map((x) => [x.key, x.label])])}</div>
        <div>
          <div class="group-label">Stimmung</div>
          <div class="chips wrap-chips">
            <button class="chip ${state.mood === 'any' ? 'active' : ''}" data-f="mood" data-v="any">Egal</button>
            ${MOODS.map((m) => html`<button class="chip ${state.mood === m.key ? 'active' : ''}" data-f="mood" data-v="${m.key}">${icon(m.icon)} ${m.label}</button>`)}
          </div>
        </div>
        <p class="faint center" style="font-size:13px">${count} ${count === 1 ? 'Idee passt' : 'Ideen passen'} – inklusive eurer Bucket-Liste und Lieblingsorte.</p>
      </div>
    </div>`);
  afterPaint(el);
}

function rollAnimation(el, done) {
  const titleEl = el.querySelector('.idea-title');
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!titleEl || reduced) { done(); return; }
  const pool = ideaPool();
  const card = el.querySelector('#idea-card');
  card.classList.add('rolling');
  let n = 0;
  const timer = setInterval(() => {
    titleEl.textContent = pool[Math.floor(Math.random() * pool.length)].title;
    if (++n >= 9) { clearInterval(timer); card.classList.remove('rolling'); done(); }
  }, 55);
}

export function render(el) {
  ensureIdea();
  paint(el);
  loadWeather(el);
  const onClick = async (e) => {
    const t = e.target.closest('[data-act], [data-f]');
    if (!t) return;
    if (t.dataset.f) {
      const k = t.dataset.f;
      state[k] = t.dataset.v;
      persist();
      if (k === 'when') { wx = { status: 'idle' }; paint(el); await loadWeather(el); }
      ensureIdea();
      paint(el);
      return;
    }
    const pool = ideaPool();
    const idea = currentIdea(pool);
    switch (t.dataset.act) {
      case 'roll':
        rollAnimation(el, () => { ensureIdea(true); paint(el); const c = el.querySelector('#idea-card'); if (c) { const r = c.getBoundingClientRect(); sparkBurst(r.left + r.width / 2, r.top + 40, 10); } });
        break;
      case 'nope':
        if (idea) state.exclude = [...state.exclude.slice(-40), idea.id];
        ensureIdea(true);
        paint(el);
        break;
      case 'plan':
        if (idea) openDatePlanner({ idea, date: whenDate(), filters: filters() });
        break;
      case 'keep':
        if (!idea) return;
        await save('wish', { title: idea.title, category: WISH_CAT[idea.cat] || 'activity', note: idea.text, done: false });
        toast('Auf der Bucket-Liste', { icon: 'star' });
        break;
      case 'locate':
        try {
          const pos = await currentPosition();
          await setDevice({ wxLoc: { lat: +pos.lat.toFixed(3), lng: +pos.lng.toFixed(3) } });
          wx = { status: 'idle' };
          await loadWeather(el);
        } catch (err) {
          toast(err.message, { icon: 'info' });
        }
        break;
    }
  };
  el.addEventListener('click', onClick);
  return () => el.removeEventListener('click', onClick);
}

export const live = false;
