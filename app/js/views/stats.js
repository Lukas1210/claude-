// Statistik: Zahlen, Vergleiche und Bestenlisten.
import { html } from '../ui/dom.js';
import { all, settings, nameOf } from '../store.js';
import { CATEGORIES, avgRating, ratingValue, fmtRating, fmtNumber, daysBetween, today, fmtDate } from '../model.js';
import { topbar, hearts, emptyState } from '../ui/components.js';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const BEST_LABEL = { food: 'Bestes Essen', date: 'Bestes Date', activity: 'Beste Aktivität', trip: 'Beste Reise', gift: 'Bestes Geschenk' };
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

export function render(el) {
  const entries = all('entry');
  const photos = all('photo');
  const wishes = all('wish');
  const s = settings();
  const days = s.startDate ? daysBetween(s.startDate, today()) : null;
  const countries = new Set(entries.map((e) => e.data.place?.countryCode).filter(Boolean));

  const ra = entries.map((e) => ratingValue(e, 'a')).filter((v) => v != null);
  const rb = entries.map((e) => ratingValue(e, 'b')).filter((v) => v != null);
  const avgA = mean(ra), avgB = mean(rb);
  const both = entries.filter((e) => ratingValue(e, 'a') != null && ratingValue(e, 'b') != null);
  const diff = mean(both.map((e) => Math.abs(ratingValue(e, 'a') - ratingValue(e, 'b'))));
  const agree = diff != null ? Math.round((1 - diff / 4.5) * 100) : null;
  let verdict = '';
  if (avgA != null && avgB != null) {
    if (Math.abs(avgA - avgB) < 0.15) verdict = 'Ihr bewertet fast gleich – ein eingespieltes Team ♡';
    else verdict = `${nameOf(avgA < avgB ? 'a' : 'b')} bewertet strenger, ${nameOf(avgA < avgB ? 'b' : 'a')} großzügiger.`;
  }

  // Aktivität der letzten 12 Monate
  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ key, label: MONTHS_SHORT[d.getMonth()], n: entries.filter((e) => String(e.data.date).startsWith(key)).length });
  }
  const maxM = Math.max(1, ...months.map((m) => m.n));

  const catCounts = Object.values(CATEGORIES).map((c) => ({ c, n: entries.filter((e) => e.data.category === c.key).length }));
  const maxC = Math.max(1, ...catCounts.map((x) => x.n));

  const best = (cat) => entries.filter((e) => e.data.category === cat && avgRating(e) != null).sort((a, b) => avgRating(b) - avgRating(a))[0];
  const tops = ['food', 'date', 'activity', 'trip', 'gift'].map((k) => ({ k, e: best(k) })).filter((x) => x.e);

  const byA = entries.filter((e) => e.createdBy === 'a').length;
  const byB = entries.filter((e) => e.createdBy === 'b').length;
  const giftsA = entries.filter((e) => e.data.category === 'gift' && e.data.extra?.from === 'a').length;
  const giftsB = entries.filter((e) => e.data.category === 'gift' && e.data.extra?.from === 'b').length;
  const bestMonth = (() => {
    const map = new Map();
    entries.forEach((e) => { const k = String(e.data.date).slice(0, 7); map.set(k, (map.get(k) || 0) + 1); });
    const top = [...map.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? { key: top[0], n: top[1] } : null;
  })();

  el.innerHTML = String(html`
    ${topbar({ title: 'Statistik', back: true })}
    <div class="page">
      <h1 class="large-title">Unsere <em>Zahlen</em></h1>
      <p class="page-sub">Liebe lässt sich nicht messen – aber ein bisschen zählen schon.</p>

      <div class="stat-grid">
        <div class="stat"><b>${fmtNumber(entries.length)}</b><span>Erlebnisse</span></div>
        <div class="stat"><b>${fmtNumber(photos.length)}</b><span>Fotos</span></div>
        <div class="stat"><b>${countries.size}</b><span>${countries.size === 1 ? 'Land' : 'Länder'}</span></div>
        <div class="stat"><b>${days != null ? fmtNumber(days) : '–'}</b><span>Tage</span></div>
        <div class="stat"><b>${all('milestone').length}</b><span>Meilensteine</span></div>
        <div class="stat"><b>${wishes.filter((w) => w.data.done).length}/${wishes.length}</b><span>Wünsche</span></div>
      </div>

      ${!entries.length ? html`<div class="section">${emptyState({ emoji: '📊', title: 'Noch keine Daten', text: 'Sobald ihr Erlebnisse bewertet, wird es hier spannend.' })}</div>` : html`
        <div class="section">
          <div class="section-head"><h2 class="section-title small">Wer bewertet strenger?</h2></div>
          <div class="card">
            <div class="versus">
              <div><span class="serif italic" style="font-size:17px">${nameOf('a')}</span><b>${fmtRating(avgA)}</b>${hearts(avgA)}</div>
              <div class="vs">vs.</div>
              <div><span class="serif italic" style="font-size:17px">${nameOf('b')}</span><b>${fmtRating(avgB)}</b>${hearts(avgB)}</div>
            </div>
            ${verdict ? html`<p class="center muted" style="margin-top:14px;font-size:14.5px">${verdict}</p>` : ''}
            ${agree != null ? html`<p class="center" style="margin-top:8px;font-size:14.5px">Ihr seid euch zu <strong class="rose">${agree}%</strong> einig</p>` : ''}
          </div>
        </div>

        <div class="section">
          <div class="section-head"><h2 class="section-title small">Die letzten 12 Monate</h2>${bestMonth ? html`<span class="faint" style="font-size:13px">Rekord: ${fmtDate(bestMonth.key + '-01', { month: 'short', year: 'numeric' })}</span>` : ''}</div>
          <div class="card">
            <div class="bars">${months.map((m) => html`<div class="bar" title="${m.n}"><i style="height:${(m.n / maxM) * 100}%"></i><span>${m.label}</span></div>`)}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-head"><h2 class="section-title small">Was wir am liebsten machen</h2></div>
          <div class="card">${catCounts.map(({ c, n }) => html`<div class="hbar"><span class="lbl">${c.emoji} ${c.plural}</span><span class="track"><i style="width:${(n / maxC) * 100}%"></i></span><span class="n">${n}</span></div>`)}</div>
        </div>

        ${tops.length ? html`
          <div class="section">
            <div class="section-head"><h2 class="section-title small">Unsere Bestenliste</h2></div>
            <div class="entry-list">${tops.map(({ k, e }) => html`
              <a class="entry-card card-link" href="#/entry/${e.id}">
                <div class="entry-thumb" style="width:56px;height:56px;font-size:26px">${CATEGORIES[k].emoji}</div>
                <div class="entry-body">
                  <div class="faint" style="font-size:12px;text-transform:uppercase;letter-spacing:.06em">${BEST_LABEL[k]}</div>
                  <div class="entry-title">${e.data.title}</div>
                  <div class="entry-rating">${hearts(avgRating(e))}<span class="rating-num">${fmtRating(avgRating(e))}</span></div>
                </div>
              </a>`)}</div>
          </div>` : ''}

        <div class="section">
          <div class="section-head"><h2 class="section-title small">Fleißige Herzen</h2></div>
          <div class="card">
            <div class="hbar"><span class="lbl">✍️ ${nameOf('a')}</span><span class="track"><i style="width:${(byA / Math.max(1, byA + byB)) * 100}%"></i></span><span class="n">${byA}</span></div>
            <div class="hbar"><span class="lbl">✍️ ${nameOf('b')}</span><span class="track"><i style="width:${(byB / Math.max(1, byA + byB)) * 100}%"></i></span><span class="n">${byB}</span></div>
            <div class="hbar"><span class="lbl">🎁 ${nameOf('a')}</span><span class="track"><i style="width:${(giftsA / Math.max(1, giftsA + giftsB)) * 100}%"></i></span><span class="n">${giftsA}</span></div>
            <div class="hbar"><span class="lbl">🎁 ${nameOf('b')}</span><span class="track"><i style="width:${(giftsB / Math.max(1, giftsA + giftsB)) * 100}%"></i></span><span class="n">${giftsB}</span></div>
            <p class="faint" style="font-size:12.5px;margin-top:8px">Einträge angelegt & Geschenke gemacht</p>
          </div>
        </div>`}
    </div>`);
}

