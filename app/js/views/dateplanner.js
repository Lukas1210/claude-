// Date planen: freien Abend wählen, Idee würfeln, mit einem Tipp in den Kalender.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openSheet } from '../ui/sheet.js';
import { catBadge } from '../ui/components.js';
import { all } from '../store.js';
import { today } from '../model.js';
import { IDEAS, ownIdeas, pickIdea, budgetLabel, durationLabel } from '../ideas.js';
import { freeSlots, slotLabel } from '../dateplan.js';

export const ideaPool = () => [...IDEAS, ...ownIdeas({ wishes: all('wish'), entries: all('entry') })];
export const ideaBadge = (idea, size = 'lg') => catBadge({ icon: idea.icon, color: idea.source === 'library' ? 'var(--accent-ink)' : 'var(--accent2)' }, { size });
export const ideaMeta = (idea) => [budgetLabel(idea.budget), durationLabel(idea.dur), idea.where === 'home' ? 'Zu Hause' : idea.where === 'out' ? 'Unterwegs' : ''].filter(Boolean).join(' · ');

/** Sheet zum Planen. `idea` optional (sonst wird gewürfelt), `date` optional (z. B. aus dem Generator). */
export function openDatePlanner({ idea = null, date = null, slot = null, filters = {} } = {}) {
  const t = today();
  const slots = freeSlots(t, { days: 14, max: 4 });
  if (slot && !slots.some((s) => s.date === slot.date)) slots.unshift(slot);
  if (date && !slots.some((s) => s.date === date)) slots.unshift({ date, start: '19:30', kind: 'evening' });
  slots.sort((a, b) => a.date.localeCompare(b.date));
  const st = {
    idea: idea || pickIdea(ideaPool(), filters)?.idea || null,
    slot: slot ? slots.find((s) => s.date === slot.date) : date ? slots.find((s) => s.date === date) : slots[0] || null,
    custom: '',
    exclude: [],
  };

  const sheet = openSheet({
    title: 'Date planen',
    left: html`<button class="text-btn" data-act="cancel">Abbrechen</button>`,
    body: '',
  });

  function render() {
    const i = st.idea;
    sheet.body.innerHTML = String(html`
      <div class="form">
        <div>
          <div class="group-label">Wann?</div>
          <div class="chips wrap-chips">
            ${slots.map((s) => html`<button class="chip ${st.slot && !st.custom && st.slot.date === s.date ? 'active' : ''}" data-slot="${s.date}">${slotLabel(s, t)}</button>`)}
            <button class="chip ${st.custom ? 'active' : ''}" data-act="custom">${icon('calendar')} Anderer Tag</button>
          </div>
          ${!slots.length ? html`<p class="group-foot">In den nächsten zwei Wochen ist jeder Abend belegt – wählt einen anderen Tag.</p>` : ''}
          <div class="group ${st.custom ? '' : 'hidden'}" id="custom-cell" style="margin-top:10px">
            <div class="cell"><label>Datum</label><input type="date" id="pd" min="${t}" value="${st.custom || ''}" placeholder="Datum wählen"></div>
          </div>
        </div>
        <div>
          <div class="group-label">Was?</div>
          ${i ? html`
            <div class="plan-idea">
              ${ideaBadge(i)}
              <div class="grow">
                <div class="plan-idea-title">${i.title}</div>
                <div class="muted" style="font-size:14px;margin-top:2px">${i.text}</div>
                ${ideaMeta(i) ? html`<div class="faint" style="font-size:12.5px;margin-top:4px">${ideaMeta(i)}</div>` : ''}
              </div>
            </div>` : html`<p class="muted">Keine passende Idee gefunden.</p>`}
          <button class="btn block" data-act="reroll" style="margin-top:10px">${icon('dice')} Andere Idee</button>
        </div>
        <button class="btn primary block" data-act="go" ${i && (st.slot || st.custom) ? '' : 'disabled'}>${icon('calendarPlus')} In den Kalender eintragen</button>
      </div>`);
  }
  render();

  sheet.body.addEventListener('change', (e) => {
    if (e.target.id === 'pd') { st.custom = e.target.value; render(); }
  });
  sheet.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-slot], [data-act]');
    if (!b) return;
    if (b.dataset.slot) { st.slot = slots.find((s) => s.date === b.dataset.slot); st.custom = ''; render(); return; }
    switch (b.dataset.act) {
      case 'cancel': sheet.close(); break;
      case 'custom': st.custom = st.custom || st.slot?.date || t; render(); sheet.body.querySelector('#pd')?.focus(); break;
      case 'reroll': {
        if (st.idea) st.exclude.push(st.idea.id);
        st.idea = pickIdea(ideaPool(), filters, { exclude: st.exclude })?.idea || st.idea;
        render();
        break;
      }
      case 'go': {
        const i = st.idea;
        const when = st.custom ? { date: st.custom, start: '19:30' } : st.slot;
        if (!i || !when) return;
        sheet.close();
        const { openEventForm } = await import('./event-form.js');
        openEventForm({ prefill: { title: i.title.replace(/^(Wieder hin|Nochmal kochen|Schauen): /, ''), category: i.cat || 'date', date: when.date, time: when.start, place: i.place || null, notes: i.source === 'library' ? i.text : '' } });
        break;
      }
    }
  });
  return sheet;
}
