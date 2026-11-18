// Startseite „Wir“: Tage-Zähler, Kennzahlen als Bento-Kacheln, nächster Termin, Countdowns,
// Erinnerungen, Bereiche und ein Fun Fact aus euren Daten.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { all, settings, nameOf, me, getDevice, setDevice } from '../store.js';
import { daysBetween, ymd, nextAnnual, fmtDate, fmtDayMonth, fmtNumber, fmtRating, today, parseDate, isoDate, sortByDateDesc, catOf, avgRating } from '../model.js';
import { entryHero, emptyState, hearts, catBadge, catIcon } from '../ui/components.js';
import { confetti, countUpAll } from '../ui/fx.js';
import { coverOf } from '../photos.js';
import { openAddMenu } from '../main.js';
import { upcoming, eventCat, fmtWhen, countdownText, expandEvents } from '../events.js';
import { shortPlace } from '../geo.js';
import { travelStats, ratingStats, bestEntry, funFacts } from '../insights.js';
import { dateNudge, freeSlots, slotLabel } from '../dateplan.js';
import { pickIdea } from '../ideas.js';
import { ideaPool, ideaBadge, openDatePlanner } from './dateplanner.js';
import { myOpenTodos, openTodos } from './lists.js';
import { refresh } from '../router.js';

const DAY_MILESTONES = (() => {
  const s = new Set([100, 200, 300, 500, 666, 777, 888]);
  for (let n = 1000; n <= 20000; n += 500) s.add(n);
  for (let d = 1; d <= 9; d++) s.add(d * 1111);
  return [...s].sort((a, b) => a - b);
})();

let countedAt = 0;
let factIndex = null;
let nudgeRoll = 0;

// Kleiner, reproduzierbarer Zufall (gleiche Idee pro Tag, bis „Andere Idee“ getippt wird)
function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function hashDay(str) {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function isStandalone() {
  return window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
}

/** Anstehende Tage: Jahrestag, runde Tageszahl, Geburtstage, eigene Jahrestage, Valentinstag, Weihnachten. */
export function countdowns() {
  const s = settings();
  const now = new Date();
  const base = parseDate(today());
  const list = [];
  const push = (x) => list.push({ ...x, date: isoDate(x.d), days: daysBetween(base, x.d) });
  if (s.startDate) {
    const next = nextAnnual(s.startDate, now);
    const years = next.getFullYear() - parseDate(s.startDate).getFullYear();
    if (years > 0) push({ icon: 'ring', color: 'var(--purple)', what: `${years}. Jahrestag`, d: next });
    const together = daysBetween(s.startDate, base);
    const nm = DAY_MILESTONES.find((m) => m >= together);
    if (nm) {
      const d = new Date(parseDate(s.startDate));
      d.setDate(d.getDate() + nm);
      push({ icon: 'sparkles', color: 'var(--accent-ink)', what: `${fmtNumber(nm)} Tage zusammen`, d });
    }
  }
  for (const slot of ['a', 'b']) {
    const b = s.birthdays?.[slot];
    if (b) push({ icon: 'cake', color: 'var(--accent2)', what: `Geburtstag ${nameOf(slot)}`, d: nextAnnual(b, now) });
  }
  for (const a of s.anniversaries || []) {
    if (!a.date) continue;
    push({ emoji: a.emoji || '📅', what: a.title, d: nextAnnual(a.date, now) });
  }
  push({ icon: 'gift', color: 'var(--c-gift)', what: 'Valentinstag', d: nextAnnual(`${now.getFullYear()}-02-14`, now) });
  push({ icon: 'tree', color: 'var(--c-activity)', what: 'Weihnachten', d: nextAnnual(`${now.getFullYear()}-12-24`, now) });
  return list.sort((a, b) => a.days - b.days);
}

function onThisDay() {
  const t = today();
  const md = t.slice(5);
  const year = +t.slice(0, 4);
  const items = [...all('entry'), ...all('milestone')]
    .filter((it) => it.data.date && it.data.date.slice(5) === md && +it.data.date.slice(0, 4) < year);
  return sortByDateDesc(items);
}

function randomMemory() {
  const pool = all('entry').filter((e) => e.data.favorite || (avgRating(e) || 0) >= 4);
  const list = pool.length ? pool : all('entry');
  if (!list.length) return null;
  list.sort((a, b) => a.id.localeCompare(b.id));
  return list[hashDay(today()) % list.length];
}

function memoryCard(it, label) {
  const isMile = it.type === 'milestone';
  const href = isMile ? '#/timeline' : `#/entry/${it.id}`;
  const cover = isMile ? (it.data.photoIds || [])[0] : coverOf(it);
  const c = isMile ? { icon: 'flag', color: 'var(--c-milestone)', label: 'Meilenstein' } : catOf(it);
  const avg = isMile ? null : avgRating(it);
  return html`
    <a class="memory card-link" href="${href}">
      <div class="memory-thumb">${cover ? html`<img data-photo="${cover}" data-size="thumb" alt="">` : isMile && it.data.emoji ? html`<span class="memory-emoji">${it.data.emoji}</span>` : catBadge(c, { size: 'fill' })}</div>
      <div class="grow">
        <div class="kicker">${label}</div>
        <div class="memory-title">${it.data.title}</div>
        <div class="muted" style="font-size:13.5px;margin-top:3px">${catIcon(c)} ${fmtDate(it.data.date)}</div>
        ${avg != null ? html`<div style="margin-top:5px">${hearts(avg)}</div>` : ''}
      </div>
    </a>`;
}

const tile = (href, ico, color, title, sub, extra = '') => html`
  <a class="tile card-link" href="${href}">
    <span class="cat-badge" style="--c:${color}">${icon(ico)}</span>
    ${extra}
    <div><div class="tile-title">${title}</div><div class="tile-sub">${sub}</div></div>
  </a>`;

export function render(el) {
  const s = settings();
  const start = s.startDate;
  const todayStr = today();
  const entries = sortByDateDesc(all('entry'));
  const recent = entries.slice(0, 8);
  const wishes = all('wish');
  const wishDone = wishes.filter((w) => w.data.done).length;
  const letters = all('letter');
  const unread = letters.filter((l) => l.data.to === me() && !l.data.readAt && (!l.data.openAt || l.data.openAt <= todayStr)).length;
  const days = start ? daysBetween(start, todayStr) : 0;
  const parts = start ? ymd(start) : null;
  const isAnniversary = start && start.slice(5) === todayStr.slice(5) && start !== todayStr;
  const otd = onThisDay();
  const random = randomMemory();
  const dev = getDevice();
  const showInstall = !isStandalone() && !dev.installHintDismissed;
  const cds = countdowns().slice(0, 8);
  const nextEv = upcoming(1)[0];
  const photoCount = all('photo').length;
  const recipes = entries.filter((e) => e.data.category === 'recipe');
  const bestRecipe = bestEntry(recipes);
  const pendingRsvp = expandEvents(todayStr, isoDate(new Date(Date.now() + 365 * 86400000))).filter((o) => !o.ev.data.rsvp?.[me()] && o.ev.createdBy !== me()).length;
  const travel = travelStats(entries, s.home);
  const rs = ratingStats(entries);
  const partnerName = nameOf(me() === 'a' ? 'b' : 'a');
  const facts = funFacts({ entries, photos: photoCount, startDate: start, home: s.home, names: { a: nameOf('a'), b: nameOf('b') }, today: todayStr });
  if (factIndex == null || factIndex >= facts.length) factIndex = facts.length ? hashDay(todayStr) % facts.length : 0;
  const snoozed = dev.nudgeSnooze && dev.nudgeSnooze > todayStr;
  const nudge = snoozed ? null : dateNudge(todayStr);
  let nudgeIdea = null;
  let nudgeSlots = [];
  if (nudge) {
    nudgeIdea = pickIdea(ideaPool(), nudge.kind === 'occasion' ? { mood: 'besonders' } : {}, { rnd: seeded(hashDay(todayStr) + nudgeRoll * 7919) })?.idea || null;
    nudgeSlots = freeSlots(todayStr, { days: nudge.kind === 'occasion' ? Math.max(2, nudge.occasion.days) : 14, max: 3 });
  }
  const myTodos = myOpenTodos();
  const dueTodos = myTodos.filter((t) => t.data.due && t.data.due <= todayStr).length;
  const todoOpen = openTodos('todo').length;
  const shopOpen = openTodos('shop').length;

  el.innerHTML = String(html`
    <div class="page home">
      <div class="home-hero">
        <div class="home-actions">
          <a class="icon-btn" href="#/settings" aria-label="Einstellungen">${icon('settings')}</a>
        </div>
        ${start ? html`<div class="kicker">Zusammen seit ${fmtDate(start, { day: 'numeric', month: 'long', year: 'numeric' })}</div>` : ''}
        <h1 class="names">${nameOf('a')} <span class="amp">&amp;</span> ${nameOf('b')}</h1>
      </div>

      ${showInstall ? html`
        <div class="install-banner">
          <img src="assets/icons/apple-touch-icon.png" alt="">
          <div class="grow">
            <div class="t">Als App installieren</div>
            <div class="s">In Safari unten auf <span class="share-ico">${icon('share', 'i')}</span> tippen und „Zum Home-Bildschirm“ wählen.</div>
          </div>
          <button class="x" data-act="dismiss-install" aria-label="Ausblenden">${icon('close')}</button>
        </div>` : ''}

      <div class="bento">
        ${start ? html`
          <a class="b-counter card-link" href="#/timeline">
            <div class="kicker">${isAnniversary ? `${parts.y} Jahre – Glückwunsch` : 'Tage zusammen'}</div>
            <div class="big" data-count="${days}">${fmtNumber(days)}</div>
            <div class="parts">
              <span><b>${parts.y}</b> ${parts.y === 1 ? 'Jahr' : 'Jahre'}</span>
              <span><b>${parts.m}</b> ${parts.m === 1 ? 'Monat' : 'Monate'}</span>
              <span><b>${parts.d}</b> ${parts.d === 1 ? 'Tag' : 'Tage'}</span>
            </div>
          </a>` : ''}
        <a class="b-stat card-link" href="#/globe"><span class="b-ico">${icon('globe')}</span><b data-count="${travel.countries}">${travel.countries}</b><span>${travel.countries === 1 ? 'Land' : 'Länder'}</span></a>
        <a class="b-stat card-link" href="#/globe"><span class="b-ico">${icon('plane')}</span><b data-count="${travel.km}">${fmtNumber(travel.km)}</b><span>km gereist</span></a>
        <a class="b-stat card-link" href="#/entries"><span class="b-ico">${icon('sparkles')}</span><b data-count="${entries.length}">${entries.length}</b><span>Erlebnisse</span></a>
        <a class="b-stat card-link" href="#/stats"><span class="b-ico heart">${icon('heartFill')}</span><b>${rs.avg != null ? fmtRating(rs.avg) : '–'}</b><span>Ø Herzen</span></a>
      </div>

      ${nextEv ? (() => {
        const c = eventCat(nextEv.ev.data.category);
        const d = parseDate(nextEv.occ);
        return html`
        <a class="next-event card-link" href="#/event/${nextEv.ev.id}?d=${nextEv.occ}">
          <div class="datebox" style="--c:${c.color}"><div class="mo">${d.toLocaleDateString('de-DE', { month: 'short' }).replace('.', '')}</div><div class="d">${d.getDate()}</div></div>
          <div class="grow">
            <div class="lbl">Als Nächstes · ${countdownText(nextEv.ev, nextEv.occ)}</div>
            <div class="t ellipsis">${catIcon(c)} ${nextEv.ev.data.title}</div>
            <div class="m ellipsis">${fmtWhen(nextEv.ev, nextEv.occ, { long: false }).split(' · ').slice(-1)[0]}${nextEv.ev.data.place ? ` · ${shortPlace(nextEv.ev.data.place)}` : ''}</div>
          </div>
          <span class="chev faint">${icon('chevron')}</span>
        </a>`;
      })() : ''}
      ${pendingRsvp ? html`<a class="notice card-link" href="#/calendar"><span class="cat-badge" style="--c:var(--accent-ink)">${icon('calendar')}</span><span class="grow">${pendingRsvp === 1 ? `${partnerName} hat einen Termin geplant – deine Zusage fehlt` : `${pendingRsvp} Termine warten auf deine Zusage`}</span><span class="badge">${pendingRsvp}</span></a>` : ''}
      ${myTodos.length ? html`<a class="notice card-link" href="#/lists"><span class="cat-badge" style="--c:var(--c-trip)">${icon('todo')}</span><span class="grow">${myTodos.length === 1 ? `Für dich: ${myTodos[0].data.text}` : `${myTodos.length} Aufgaben für dich`}${dueTodos ? html` · <b class="rose">${dueTodos} fällig</b>` : ''}</span><span class="badge">${myTodos.length}</span></a>` : ''}

      ${nudge ? html`
        <div class="nudge" id="nudge">
          <div class="row between">
            <span class="kicker">${nudge.kind === 'occasion' ? `${nudge.occasion.what} · ${nudge.occasion.days === 0 ? 'heute' : nudge.occasion.days === 1 ? 'morgen' : `in ${nudge.occasion.days} Tagen`}` : 'Zeit für ein Date'}</span>
            <button class="later" data-act="nudge-later">Später</button>
          </div>
          <div class="nudge-title">${nudge.kind === 'occasion' ? 'Schon etwas geplant?' : nudge.since == null ? 'Plant euer erstes Date' : `Euer letztes Date ist ${nudge.since} ${nudge.since === 1 ? 'Tag' : 'Tage'} her.`}</div>
          ${nudge.kind === 'rhythm' && nudge.last ? html`<div class="muted" style="font-size:14px;margin-top:3px">Zuletzt: ${nudge.last.title}</div>` : ''}
          ${nudgeIdea ? html`<div class="nudge-idea">${ideaBadge(nudgeIdea, 'md')}<span class="grow">Idee: <b>${nudgeIdea.title}</b></span></div>` : ''}
          ${nudgeSlots.length ? html`<div class="chips wrap-chips">${nudgeSlots.map((sl) => html`<button class="chip" data-nudge-slot="${sl.date}">${slotLabel(sl, todayStr)}</button>`)}</div>` : ''}
          <div class="actions">
            <button class="btn primary small" data-act="nudge-plan">${icon('calendarPlus')} Planen</button>
            <button class="btn small" data-act="nudge-roll">${icon('dice')} Andere Idee</button>
          </div>
        </div>` : ''}

      ${unread ? html`<a class="notice card-link" href="#/letters"><span class="cat-badge" style="--c:var(--purple)">${icon('letter')}</span><span class="grow">${unread === 1 ? `Neuer Brief von ${partnerName}` : `${unread} neue Briefe von ${partnerName}`}</span><span class="badge">${unread}</span></a>` : ''}

      <div class="section">
        <div class="section-head"><h2 class="section-title">Countdowns</h2></div>
        <div class="h-scroll countdowns">
          ${cds.map((c) => html`
            <div class="countdown ${c.days === 0 ? 'today' : ''}">
              ${c.emoji ? html`<span class="cat-badge sm cd-emoji">${c.emoji}</span>` : html`<span class="cat-badge sm" style="--c:${c.color}">${icon(c.icon)}</span>`}
              <div class="days">${c.days === 0 ? 'Heute' : fmtNumber(c.days)}${c.days > 0 ? html`<small>${c.days === 1 ? 'Tag' : 'Tage'}</small>` : ''}</div>
              <div class="what">${c.what}</div>
              <div class="when">${fmtDayMonth(c.date)}</div>
            </div>`)}
        </div>
      </div>

      ${otd.length ? html`
        <div class="section">
          <div class="section-head"><h2 class="section-title">Heute vor …</h2></div>
          <div class="stack">${otd.slice(0, 3).map((it) => {
            const y = +todayStr.slice(0, 4) - +it.data.date.slice(0, 4);
            return memoryCard(it, y === 1 ? 'Heute vor einem Jahr' : `Heute vor ${y} Jahren`);
          })}</div>
        </div>` : random ? html`
        <div class="section">
          <div class="section-head"><h2 class="section-title">Throwback</h2></div>
          ${memoryCard(random, 'Weißt du noch?')}
        </div>` : ''}

      <div class="section">
        <div class="section-head">
          <h2 class="section-title">Zuletzt erlebt</h2>
          ${entries.length ? html`<a class="section-link" href="#/entries">Alle ${entries.length}</a>` : ''}
        </div>
        ${recent.length
          ? html`<div class="h-scroll">${recent.map((e) => entryHero(e))}</div>`
          : html`<div class="card">${emptyState({ icon: 'sparkles', title: 'Noch nichts eingetragen', text: 'Haltet euer letztes Date, ein Restaurant oder eine Reise fest – mit Fotos und Bewertung.', action: html`<button class="btn primary" data-act="add">${icon('plus')} Erster Eintrag</button>` })}</div>`}
      </div>

      <div class="section">
        <div class="section-head"><h2 class="section-title">Bereiche</h2></div>
        <a class="tile wide card-link" href="#/entries?cat=recipe">
          <span class="cat-badge lg" style="--c:var(--c-recipe)">${icon('chef')}</span>
          <div class="grow">
            <div class="tile-title">Rezepte</div>
            <div class="tile-sub ellipsis">${recipes.length ? `${recipes.length} ausprobiert${bestRecipe ? ` · Favorit: ${bestRecipe.data.title}` : ''}` : 'Selbst gekocht – mit Zutaten & Bewertung'}</div>
          </div>
          <span class="faint">${icon('chevron')}</span>
        </a>
        <div class="card-grid">
          ${tile('#/ideas', 'dice', 'var(--accent2)', 'Date-Ideen', 'Würfeln: Was machen wir?')}
          ${tile('#/lists', 'todo', 'var(--c-trip)', 'Listen', todoOpen || shopOpen ? `${todoOpen} To-dos · ${shopOpen} Einkauf` : 'To-dos & Einkauf')}
          ${tile('#/bucket', 'star', 'var(--accent2)', 'Bucket-Liste', wishes.length ? `${wishDone} von ${wishes.length} erledigt` : 'Was ihr noch machen wollt')}
          ${tile('#/letters', 'letter', 'var(--purple)', 'Briefe', letters.length ? `${letters.length} ${letters.length === 1 ? 'Brief' : 'Briefe'}` : 'Zeitkapseln & Nachrichten', unread ? html`<span class="badge">${unread}</span>` : '')}
          ${tile('#/stats', 'chart', 'var(--c-trip)', 'Statistik', 'Wer bewertet strenger?')}
          ${tile('#/gallery', 'gallery', 'var(--c-activity)', 'Galerie', photoCount ? `${photoCount} ${photoCount === 1 ? 'Foto' : 'Fotos'}` : 'Eure Fotos')}
        </div>
      </div>

      ${facts.length ? html`
        <button class="fact-card" data-act="fact">
          <span class="kicker">Fun Fact ${facts.length > 1 ? html`<span class="faint">· ${factIndex + 1}/${facts.length}</span>` : ''}</span>
          <span class="fact-text">${facts[factIndex]}</span>
          ${facts.length > 1 ? html`<span class="fact-next">${icon('shuffle')} Noch einer</span>` : ''}
        </button>` : ''}
    </div>`);

  if (Date.now() - countedAt > 60000) { countUpAll(el); countedAt = Date.now(); }

  const onClick = async (e) => {
    const sl = e.target.closest('[data-nudge-slot]');
    if (sl) { openDatePlanner({ idea: nudgeIdea, slot: nudgeSlots.find((x) => x.date === sl.dataset.nudgeSlot) }); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'dismiss-install') await setDevice({ installHintDismissed: true });
    if (a.dataset.act === 'add') openAddMenu();
    if (a.dataset.act === 'nudge-later') {
      const d = parseDate(todayStr); d.setDate(d.getDate() + 3);
      await setDevice({ nudgeSnooze: isoDate(d) });
      el.querySelector('#nudge')?.remove();
    }
    if (a.dataset.act === 'nudge-roll') { nudgeRoll++; refresh(); }
    if (a.dataset.act === 'nudge-plan') openDatePlanner({ idea: nudgeIdea, slot: nudgeSlots[0] || null });
    if (a.dataset.act === 'fact' && facts.length > 1) {
      factIndex = (factIndex + 1) % facts.length;
      a.querySelector('.fact-text').textContent = facts[factIndex];
      const n = a.querySelector('.kicker .faint');
      if (n) n.textContent = `· ${factIndex + 1}/${facts.length}`;
    }
  };
  el.addEventListener('click', onClick);

  if (isAnniversary) {
    const key = `anniv-${todayStr}`;
    if (!sessionStorage.getItem(key)) {
      try { sessionStorage.setItem(key, '1'); } catch {}
      setTimeout(() => confetti(80), 500);
    }
  }
  return () => el.removeEventListener('click', onClick);
}
