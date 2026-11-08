// Termin-Detail: Zeit, Ort, Notizen, Zusagen, iPhone-Kalender, Termin -> Erlebnis.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { get, update, remove, nameOf, me } from '../store.js';
import { fmtDate } from '../model.js';
import { eventCat, fmtWhen, repeatLabel, reminderLabel, RSVP, countdownText, occStart, toICS, icsFileName, ENTRY_CATEGORY_FOR, occurrencesInRange } from '../events.js';
import { emptyState } from '../ui/components.js';
import { actionSheet, confirmDialog, toast } from '../ui/sheet.js';
import { placeLabel } from '../geo.js';
import { back } from '../router.js';
import { publishIcs } from '../sync.js';

function mapsUrl(p) {
  const q = encodeURIComponent(p.label ? `${p.name}, ${p.label}` : p.name);
  return p.lat != null ? `https://maps.apple.com/?q=${q}&ll=${p.lat},${p.lng}` : `https://maps.apple.com/?q=${q}`;
}

/** Termin in den iPhone-Kalender übernehmen. */
export async function addToPhoneCalendar(ev) {
  const text = toICS(ev);
  // 1) Mit Sync: als Datei im privaten Speicher ablegen und öffnen -> Safari zeigt „Zum Kalender hinzufügen“
  const url = await publishIcs(ev.id, text);
  if (url) { window.location.href = url; return; }
  // 2) Ohne Sync: Datei direkt herunterladen
  const file = new File([text], icsFileName(ev), { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

async function shareIcs(ev) {
  const file = new File([toICS(ev)], icsFileName(ev), { type: 'text/calendar' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: ev.data.title }); } catch {}
    return;
  }
  toast('Teilen wird hier nicht unterstützt', { emoji: '📤' });
}

export function render(el, { id }, query) {
  const ev = get(id);
  if (!ev) {
    el.innerHTML = String(html`<div class="page" style="padding-top:calc(var(--safe-t) + 20px)"><button class="back-btn" data-act="back" data-fallback="/calendar">${icon('back')}Zurück</button>${emptyState({ emoji: '🗓️', title: 'Termin nicht gefunden', text: 'Dieser Termin wurde gelöscht.' })}</div>`);
    return;
  }
  const d = ev.data;
  const c = eventCat(d.category);
  // Welches Vorkommen? (bei wiederkehrenden Terminen über ?d=)
  let occ = query?.d || d.date;
  if (d.repeat && d.repeat !== 'none' && !occurrencesInRange(ev, occ, occ).includes(occ)) occ = d.date;
  const recurring = d.repeat && d.repeat !== 'none';
  const started = occStart(ev, occ) <= new Date();
  const linkedEntry = d.entries?.[occ] && get(d.entries[occ]);
  const r = d.rsvp || {};
  const stateText = (v) => (v ? RSVP[v].short : 'Noch offen');

  el.innerHTML = String(html`
    <div class="page">
      <div class="row between" style="padding-top:calc(var(--safe-t) + 4px);margin:0 -8px">
        <button class="back-btn" data-act="back" data-fallback="/calendar">${icon('back')}<span>Kalender</span></button>
        <button class="text-btn" data-act="edit">Bearbeiten</button>
      </div>

      <div class="event-hero" style="background:${c.color};background:linear-gradient(135deg, ${c.color}, color-mix(in srgb, ${c.color} 72%, #000))">
        <div class="cat">${c.emoji} ${c.label}</div>
        <h1>${d.title}</h1>
        <div class="when">${fmtWhen(ev, occ)}</div>
        ${recurring ? html`<div class="rep">↻ ${repeatLabel(d.repeat)}${d.repeatUntil ? ` bis ${fmtDate(d.repeatUntil)}` : ''}</div>` : ''}
        <span class="countdown-pill">${countdownText(ev, occ)}</span>
      </div>

      <div class="section">
        <div class="group">
          ${d.place ? html`
            <a class="cell link" href="${mapsUrl(d.place)}" target="_blank" rel="noopener">
              <span class="cell-icon blue">${icon('map')}</span>
              <span class="grow"><span style="display:block">${d.place.name}</span>${d.place.label ? html`<small class="faint" style="font-size:13px">${d.place.label}</small>` : ''}</span>
              <span class="faint" style="font-size:13px">Karten</span><span class="chev">${icon('chevron')}</span>
            </a>` : ''}
          <div class="cell"><span class="cell-icon danger">${icon('bell')}</span><span class="grow">Erinnerung</span><span class="value">${reminderLabel(d.reminder ?? null)}</span></div>
          ${d.place?.lat != null ? html`<a class="cell link" href="#/globe"><span class="cell-icon purple">${icon('globe')}</span><span class="grow">${placeLabel(d.place)}</span><span class="chev">${icon('chevron')}</span></a>` : ''}
        </div>
      </div>

      ${d.notes ? html`<div class="section"><div class="group-label">Notizen</div><div class="card notes">${d.notes}</div></div>` : ''}

      <div class="section">
        <div class="group-label">Wer ist dabei?</div>
        <div class="group">
          ${['a', 'b'].map((s) => html`
            <div class="rsvp-row">
              <span class="rsvp-dot ${r[s] || ''}">${(nameOf(s) || '?').charAt(0).toUpperCase()}</span>
              <span class="who">${nameOf(s)}${s === me() ? ' (du)' : ''}</span>
              <span class="state ${r[s] || ''}">${stateText(r[s])}</span>
            </div>`)}
        </div>
        <div class="rsvp-actions">
          ${Object.entries(RSVP).map(([k, v]) => html`<button class="${k} ${r[me()] === k ? 'on' : ''}" data-rsvp="${k}">${v.label}</button>`)}
        </div>
        ${recurring ? html`<p class="group-foot">Die Zusage gilt für alle Wiederholungen.</p>` : ''}
      </div>

      <div class="section">
        <div class="group">
          <button class="cell link" data-act="ics" style="width:100%;text-align:left"><span class="cell-icon">${icon('calendarPlus')}</span><span class="grow">Zum iPhone-Kalender hinzufügen</span><span class="chev">${icon('chevron')}</span></button>
          <button class="cell link" data-act="share" style="width:100%;text-align:left"><span class="cell-icon gray">${icon('share')}</span><span class="grow">Als Kalender-Datei teilen</span><span class="chev">${icon('chevron')}</span></button>
          ${linkedEntry
            ? html`<a class="cell link" href="#/entry/${linkedEntry.id}"><span class="cell-icon amber">${icon('starFill')}</span><span class="grow">Erinnerung ansehen</span><span class="chev">${icon('chevron')}</span></a>`
            : started ? html`<button class="cell link" data-act="memory" style="width:100%;text-align:left"><span class="cell-icon amber">${icon('sparkles')}</span><span class="grow">Als Erlebnis festhalten & bewerten</span><span class="chev">${icon('chevron')}</span></button>` : ''}
        </div>
        ${!started && !linkedEntry ? html`<p class="group-foot">Nach dem Termin kannst du ihn hier als Erlebnis mit Fotos und Bewertung speichern.</p>` : ''}
      </div>

      <div class="section">
        <button class="btn danger block" data-act="delete">${icon('trash')} ${recurring ? 'Löschen …' : 'Termin löschen'}</button>
        <p class="faint center" style="font-size:12.5px;margin-top:16px">Eingetragen von ${nameOf(ev.createdBy || 'a')} · ${fmtDate(ev.createdAt)}</p>
      </div>
    </div>`);

  const onClick = async (e) => {
    const t = e.target.closest('[data-act], [data-rsvp]');
    if (!t) return;
    if (t.dataset.rsvp) {
      const cur = get(ev.id);
      const v = cur.data.rsvp?.[me()] === t.dataset.rsvp ? null : t.dataset.rsvp;
      await update(ev.id, { rsvp: { ...(cur.data.rsvp || {}), [me()]: v } });
      if (v) toast(v === 'yes' ? 'Zugesagt' : v === 'maybe' ? 'Als „vielleicht“ markiert' : 'Abgesagt', { emoji: v === 'yes' ? '✅' : v === 'maybe' ? '🤔' : '❌' });
      return;
    }
    switch (t.dataset.act) {
      case 'edit': {
        const { openEventForm } = await import('./event-form.js');
        openEventForm({ id: ev.id });
        break;
      }
      case 'ics':
        t.disabled = true;
        await addToPhoneCalendar(get(ev.id));
        t.disabled = false;
        break;
      case 'share': shareIcs(get(ev.id)); break;
      case 'memory': {
        const { openEntryForm } = await import('./entry-form.js');
        openEntryForm({
          category: ENTRY_CATEGORY_FOR[d.category] || 'activity',
          prefill: { title: d.title, date: occ, place: d.place, notes: d.notes },
          onSaved: async (entryId) => {
            const cur = get(ev.id);
            if (cur) await update(ev.id, { entries: { ...(cur.data.entries || {}), [occ]: entryId } });
          },
        });
        break;
      }
      case 'delete': {
        if (recurring) {
          const v = await actionSheet({
            title: 'Wiederkehrender Termin',
            items: [
              { label: `Nur am ${fmtDate(occ, { day: 'numeric', month: 'long' })}`, icon: 'calendar', value: 'one' },
              { label: 'Alle Termine löschen', icon: 'trash', value: 'all', danger: true },
            ],
          });
          if (v === 'one') {
            const cur = get(ev.id);
            await update(ev.id, { exdates: [...new Set([...(cur.data.exdates || []), occ])] });
            toast('Termin entfernt', { emoji: '🗑️' });
            back('/calendar');
          } else if (v === 'all' && await confirmDialog({ title: 'Alle Wiederholungen löschen?', ok: 'Löschen', danger: true })) {
            await remove(ev.id);
            toast('Termin gelöscht', { emoji: '🗑️' });
            back('/calendar');
          }
        } else if (await confirmDialog({ title: 'Termin löschen?', ok: 'Löschen', danger: true })) {
          await remove(ev.id);
          toast('Termin gelöscht', { emoji: '🗑️' });
          back('/calendar');
        }
        break;
      }
    }
  };
  el.addEventListener('click', onClick);
  return () => el.removeEventListener('click', onClick);
}

