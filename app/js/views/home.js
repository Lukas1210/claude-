// Startseite „Wir“: Zähler, Countdowns, Heute vor X Jahren, letzte Erlebnisse, Kacheln.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { all, settings, nameOf, me, getDevice, setDevice } from '../store.js';
import { daysBetween, ymd, nextAnnual, fmtDate, fmtDayMonth, fmtNumber, today, parseDate, isoDate, sortByDateDesc, LOVE_LINES, catOf, avgRating } from '../model.js';
import { entryHero, emptyState, hearts } from '../ui/components.js';
import { heartRain } from '../ui/fx.js';
import { coverOf } from '../photos.js';
import { openAddMenu } from '../main.js';
import { upcoming, eventCat, fmtWhen, countdownText, expandEvents } from '../events.js';
import { shortPlace } from '../geo.js';

const DAY_MILESTONES = (() => {
  const s = new Set([100, 200, 300, 500, 666, 777, 888]);
  for (let n = 1000; n <= 20000; n += 500) s.add(n);
  for (let d = 1; d <= 9; d++) s.add(d * 1111);
  return [...s].sort((a, b) => a - b);
})();

function hashDay(str) {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function isStandalone() {
  return window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
}

export function countdowns() {
  const s = settings();
  const now = new Date();
  const base = parseDate(today());
  const list = [];
  if (s.startDate) {
    const next = nextAnnual(s.startDate, now);
    const years = next.getFullYear() - parseDate(s.startDate).getFullYear();
    if (years > 0) list.push({ emoji: '💞', what: `${years}. Jahrestag`, date: isoDate(next), days: daysBetween(base, next) });
    const together = daysBetween(s.startDate, base);
    const nm = DAY_MILESTONES.find((m) => m >= together);
    if (nm) {
      const d = new Date(parseDate(s.startDate));
      d.setDate(d.getDate() + nm);
      list.push({ emoji: '✨', what: `${fmtNumber(nm)} Tage zusammen`, date: isoDate(d), days: nm - together });
    }
  }
  for (const slot of ['a', 'b']) {
    const b = s.birthdays?.[slot];
    if (b) {
      const next = nextAnnual(b, now);
      list.push({ emoji: '🎂', what: `Geburtstag ${nameOf(slot)}`, date: isoDate(next), days: daysBetween(base, next) });
    }
  }
  for (const a of s.anniversaries || []) {
    if (!a.date) continue;
    const next = nextAnnual(a.date, now);
    list.push({ emoji: a.emoji || '📅', what: a.title, date: isoDate(next), days: daysBetween(base, next) });
  }
  const vday = nextAnnual(`${now.getFullYear()}-02-14`, now);
  list.push({ emoji: '💘', what: 'Valentinstag', date: isoDate(vday), days: daysBetween(base, vday) });
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
  const emoji = isMile ? it.data.emoji || '💞' : catOf(it).emoji;
  const avg = isMile ? null : avgRating(it);
  return html`
    <a class="card card-link glow" href="${href}" style="display:flex;gap:14px;align-items:center">
      <div class="entry-thumb" style="width:84px;height:84px">${cover ? html`<img data-photo="${cover}" data-size="thumb" alt="">` : emoji}</div>
      <div class="grow">
        <div class="faint" style="font-size:12.5px;text-transform:uppercase;letter-spacing:.06em">${label}</div>
        <div style="font-family:var(--font-serif);font-size:19px;font-weight:600;margin-top:2px;line-height:1.2">${it.data.title}</div>
        <div class="muted" style="font-size:13.5px;margin-top:3px">${emoji} ${fmtDate(it.data.date)}</div>
        ${avg != null ? html`<div style="margin-top:4px">${hearts(avg)}</div>` : ''}
      </div>
    </a>`;
}

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
  const quote = LOVE_LINES[hashDay(todayStr) % LOVE_LINES.length];
  const dev = getDevice();
  const showInstall = !isStandalone() && !dev.installHintDismissed;
  const cds = countdowns().slice(0, 6);
  const nextEv = upcoming(1)[0];
  const photoCount = all('photo').length;
  const recipes = entries.filter((e) => e.data.category === 'recipe');
  const bestRecipe = recipes.filter((e) => avgRating(e) != null).sort((x, y) => avgRating(y) - avgRating(x))[0];
  const pendingRsvp = expandEvents(todayStr, isoDate(new Date(Date.now() + 365 * 86400000))).filter((o) => !o.ev.data.rsvp?.[me()] && o.ev.createdBy !== me()).length;

  el.innerHTML = String(html`
    <div class="page">
      <div class="home-hero">
        <div class="home-actions">
          <a class="icon-btn" href="#/settings" aria-label="Einstellungen">${icon('settings')}</a>
        </div>
        <div class="names"><span>${nameOf('a')}</span><span class="amp">&amp;</span><span>${nameOf('b')}</span></div>
        ${start ? html`<div class="since">zusammen seit ${fmtDate(start, { day: 'numeric', month: 'long', year: 'numeric' })}</div>` : ''}
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

      ${nextEv ? (() => {
        const c = eventCat(nextEv.ev.data.category);
        const d = parseDate(nextEv.occ);
        return html`
        <a class="next-event card-link" href="#/event/${nextEv.ev.id}?d=${nextEv.occ}">
          <div class="datebox"><div class="mo" style="background:${c.color}">${d.toLocaleDateString('de-DE', { month: 'short' }).replace('.', '')}</div><div class="d">${d.getDate()}</div></div>
          <div class="grow">
            <div class="lbl">Als Nächstes · ${countdownText(nextEv.ev, nextEv.occ)}</div>
            <div class="t ellipsis">${c.emoji} ${nextEv.ev.data.title}</div>
            <div class="m ellipsis">${fmtWhen(nextEv.ev, nextEv.occ, { long: false }).split(' · ').slice(-1)[0]}${nextEv.ev.data.place ? ` · ${shortPlace(nextEv.ev.data.place)}` : ''}</div>
          </div>
          <span class="chev faint">${icon('chevron')}</span>
        </a>`;
      })() : ''}
      ${pendingRsvp ? html`<a class="card card-link" href="#/calendar" style="display:flex;align-items:center;gap:12px;margin-top:10px;padding:12px 14px"><span style="font-size:22px">📅</span><span class="grow" style="font-size:15px">${pendingRsvp === 1 ? `${nameOf(me() === 'a' ? 'b' : 'a')} hat einen Termin geplant – deine Zusage fehlt` : `${pendingRsvp} Termine warten auf deine Zusage`}</span><span class="badge">${pendingRsvp}</span></a>` : ''}

      ${start ? html`
        <div class="card counter-card">
          <span class="beat">${icon('heartFill')}</span>
          <div class="big">${fmtNumber(days)}</div>
          <div class="lbl">${isAnniversary ? html`<strong class="rose">Alles Gute zum ${parts.y}. Jahrestag! 🥂</strong>` : 'Tage voller Liebe'}</div>
          <div class="parts">
            <div><b>${parts.y}</b><span>${parts.y === 1 ? 'Jahr' : 'Jahre'}</span></div>
            <div><b>${parts.m}</b><span>${parts.m === 1 ? 'Monat' : 'Monate'}</span></div>
            <div><b>${parts.d}</b><span>${parts.d === 1 ? 'Tag' : 'Tage'}</span></div>
          </div>
        </div>` : ''}

      ${unread ? html`
        <a class="card card-link section" href="#/letters" style="display:flex;align-items:center;gap:14px;margin-top:16px">
          <span style="font-size:34px">💌</span>
          <div class="grow"><div style="font-weight:600">${unread === 1 ? 'Ein Liebesbrief wartet auf dich' : `${unread} Liebesbriefe warten auf dich`}</div><div class="muted" style="font-size:14px">von ${nameOf(me() === 'a' ? 'b' : 'a')}</div></div>
          <span class="badge">${unread}</span>
        </a>` : ''}

      <div class="section">
        <div class="section-head"><h2 class="section-title">Bald ist es so weit</h2></div>
        <div class="h-scroll countdowns">
          ${cds.map((c) => html`
            <div class="countdown ${c.days === 0 ? 'today' : ''}">
              <div class="em">${c.emoji}</div>
              <div class="days">${c.days === 0 ? 'Heute!' : fmtNumber(c.days)}${c.days > 0 ? html`<small>${c.days === 1 ? 'Tag' : 'Tage'}</small>` : ''}</div>
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
          <div class="section-head"><h2 class="section-title">Erinnerung des Tages</h2></div>
          ${memoryCard(random, 'Weißt du noch?')}
        </div>` : ''}

      <div class="section">
        <div class="section-head">
          <h2 class="section-title">Zuletzt erlebt</h2>
          ${entries.length ? html`<a class="section-link" href="#/entries">Alle ${entries.length}</a>` : ''}
        </div>
        ${recent.length
          ? html`<div class="h-scroll">${recent.map((e) => entryHero(e))}</div>`
          : html`<div class="card">${emptyState({ emoji: '🌹', title: 'Euer erstes Erlebnis', text: 'Haltet euer letztes Date, ein Lieblingsessen oder eine Reise fest – mit Fotos und Herzen.', action: html`<button class="btn primary" data-act="add">Erinnerung hinzufügen</button>` })}</div>`}
      </div>

      <div class="section">
        <a class="tile card-link" href="#/entries?cat=recipe" style="flex-direction:row;align-items:center;min-height:0;margin-bottom:12px">
          <span class="tile-emoji" style="font-size:30px">👩‍🍳</span>
          <div class="grow">
            <div class="tile-title">Unsere Rezepte</div>
            <div class="tile-sub ellipsis">${recipes.length ? `${recipes.length} ausprobiert${bestRecipe ? ` · Favorit: ${bestRecipe.data.title}` : ''}` : 'Was wir zusammen gekocht haben – mit Fotos & Herzen'}</div>
          </div>
          <span class="faint">${icon('chevron')}</span>
        </a>
        <div class="card-grid">
          <a class="tile card-link" href="#/bucket">
            <span class="tile-emoji">🌠</span>
            <div><div class="tile-title">Bucket-Liste</div><div class="tile-sub">${wishes.length ? `${wishDone} von ${wishes.length} erfüllt` : 'Gemeinsame Träume'}</div></div>
          </a>
          <a class="tile card-link" href="#/letters">
            <span class="tile-emoji">💌</span>
            ${unread ? html`<span class="badge">${unread}</span>` : ''}
            <div><div class="tile-title">Liebesbriefe</div><div class="tile-sub">${letters.length ? `${letters.length} ${letters.length === 1 ? 'Brief' : 'Briefe'}` : 'Zeitkapseln & Grüße'}</div></div>
          </a>
          <a class="tile card-link" href="#/stats">
            <span class="tile-emoji">📊</span>
            <div><div class="tile-title">Statistik</div><div class="tile-sub">Wer bewertet strenger?</div></div>
          </a>
          <a class="tile card-link" href="#/gallery">
            <span class="tile-emoji">🖼️</span>
            <div><div class="tile-title">Galerie</div><div class="tile-sub">${photoCount ? `${photoCount} ${photoCount === 1 ? 'Foto' : 'Fotos'}` : 'Eure Fotos'}</div></div>
          </a>
        </div>
      </div>

      <div class="divider-heart">${icon('heartFill')}</div>
      <p class="quote">„${quote}“</p>
    </div>`);

  const onClick = async (e) => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'dismiss-install') await setDevice({ installHintDismissed: true });
    if (a.dataset.act === 'add') openAddMenu();
  };
  el.addEventListener('click', onClick);

  if (isAnniversary) {
    const key = `anniv-${todayStr}`;
    if (!sessionStorage.getItem(key)) {
      try { sessionStorage.setItem(key, '1'); } catch {}
      setTimeout(() => heartRain(40), 500);
    }
  }
  return () => el.removeEventListener('click', onClick);
}

