// Date-Planer, Zufalls-Date (mit simuliertem Wetter) und Listen (To-dos/Einkauf mit Zuweisung).
const { openApp, onboard } = require('./lib.cjs');

function forecast(days = 14, rainy = new Set()) {
  const time = [], code = [], tmax = [], tmin = [], rain = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    const z = (x) => String(x).padStart(2, '0');
    const iso = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
    time.push(iso); code.push(rainy.has(i) ? 63 : 1); tmax.push(rainy.has(i) ? 9 : 17); tmin.push(5); rain.push(rainy.has(i) ? 85 : 10);
  }
  return { daily: { time, weather_code: code, temperature_2m_max: tmax, temperature_2m_min: tmin, precipitation_probability_max: rain } };
}

exports.run = async ({ server, check }) => {
  const app = await openApp(server);
  const { p, S, go, iso, shot } = app;
  let weatherCalls = 0;
  await app.ctx.route('**/api.open-meteo.com/**', (route) => { weatherCalls++; route.fulfill({ json: forecast(14, new Set([1])) }); });
  try {
    await onboard(app);
    await S(async () => (await import('./js/store.js')).saveSettings({ home: { name: 'München', label: 'Bayern, Deutschland', city: 'München', lat: 48.1351, lng: 11.582, country: 'Deutschland', countryCode: 'DE' } }));

    // ---------- Zufalls-Date ----------
    await go('/ideas', 900);
    const t1 = (await p.textContent('.idea-title')).trim();
    check('Ideen-Seite zeigt eine Idee', t1.length > 2, t1);
    await p.click('[data-act="roll"]'); await p.waitForTimeout(900);
    const t2 = (await p.textContent('.idea-title')).trim();
    check('Würfeln zeigt eine andere Idee', t2 && t2 !== t1, `${t1} → ${t2}`);
    await p.click('[data-f="where"][data-v="home"]'); await p.waitForTimeout(300);
    await p.click('[data-f="budget"][data-v="0"]'); await p.waitForTimeout(300);
    let ok = true;
    for (let i = 0; i < 6; i++) {
      const idea = await S(async () => { const D = await import('./js/views/dateplanner.js'); const st = JSON.parse(sessionStorage.getItem('cj-ideas')); return D.ideaPool().find((x) => x.id === st.ideaId); });
      if (!idea || (idea.where === 'out') || (idea.budget != null && idea.budget > 0)) { ok = false; break; }
      await p.click('[data-act="roll"]'); await p.waitForTimeout(750);
    }
    check('Filter „Zu Hause“ + „Gratis“ werden eingehalten', ok);
    await p.click('[data-f="where"][data-v="any"]'); await p.click('[data-f="budget"][data-v="any"]'); await p.waitForTimeout(300);

    // Wetter: morgen Regen → nichts für draußen
    await p.click('[data-f="when"][data-v="tomorrow"]'); await p.waitForTimeout(1200);
    const wxText = await p.textContent('.wx-row');
    check('Wetter für morgen wird angezeigt (Regen → drinnen)', weatherCalls > 0 && wxText.includes('Lieber drinnen') && wxText.includes('Regen'), wxText.replace(/\s+/g, ' ').trim());
    let indoor = true;
    for (let i = 0; i < 8; i++) {
      const idea = await S(async () => { const D = await import('./js/views/dateplanner.js'); const st = JSON.parse(sessionStorage.getItem('cj-ideas')); return D.ideaPool().find((x) => x.id === st.ideaId); });
      if (idea?.sky === 'out') { indoor = false; break; }
      await p.click('[data-act="roll"]'); await p.waitForTimeout(750);
    }
    check('Bei Regen keine Draußen-Ideen', indoor);
    await shot('ideas');

    // Merken → Bucket-Liste
    const ideaTitle = (await p.textContent('.idea-title')).trim();
    await p.click('[data-act="keep"]'); await p.waitForTimeout(500);
    check('„Merken“ legt einen Wunsch an', await S(async (t) => (await import('./js/store.js')).all('wish').some((w) => w.data.title === t), ideaTitle));

    // Planen → Kalender
    await p.click('[data-act="plan"]'); await p.waitForTimeout(700);
    check('Planer-Sheet öffnet mit Tagen', (await p.$$('.sheet [data-slot]')).length >= 1);
    const tomorrow = await iso(1);
    const slotBtn = await p.$(`.sheet [data-slot="${tomorrow}"]`);
    if (slotBtn) await slotBtn.click();
    await p.waitForTimeout(200);
    const plannedTitle = (await p.textContent('.plan-idea-title')).trim();
    await p.click('.sheet [data-act="go"]'); await p.waitForTimeout(900);
    const formTitle = await p.inputValue('#et');
    check('Terminformular mit Idee & Tag vorausgefüllt', formTitle === plannedTitle.replace(/^(Wieder hin|Nochmal kochen): /, '') && (await p.inputValue('#sd')) === tomorrow, `${formTitle} · ${await p.inputValue('#sd')}`);
    await p.click('.sheet [data-act="save"]'); await p.waitForTimeout(900);
    const planned = await S(async (t) => (await import('./js/store.js')).all('event').find((e) => e.data.title === t), formTitle);
    check('Date als Termin gespeichert', !!planned && planned.data.date === tomorrow, planned && `${planned.data.category} ${planned.data.time}`);

    // ---------- Date-Hinweis auf der Startseite ----------
    await S(async () => { const s = await import('./js/store.js'); for (const e of s.all('event')) await s.remove(e.id); });
    const ago = await iso(-20);
    await S(async (date) => (await import('./js/store.js')).save('entry', { category: 'date', title: 'Kino', date, ratings: {}, extra: {}, photoIds: [], place: null, notes: '' }), ago);
    await go('/', 900);
    const nudge = await p.$('#nudge');
    check('Hinweis „Zeit für ein Date“ (20 Tage, Rhythmus 14)', !!nudge && (await nudge.textContent()).includes('20 Tage her'), nudge ? (await nudge.textContent()).replace(/\s+/g, ' ').slice(0, 80) : 'kein Hinweis');
    check('Hinweis schlägt freie Abende vor', (await p.$$('#nudge [data-nudge-slot]')).length >= 1);
    await shot('home-nudge');
    await p.click('#nudge [data-act="nudge-later"]'); await p.waitForTimeout(400);
    check('„Später“ blendet den Hinweis aus', !(await p.$('#nudge')));
    await S(async () => (await import('./js/store.js')).setDevice({ nudgeSnooze: null }));
    // Geplantes Date → kein Hinweis
    const in3 = await iso(3);
    const evId = await S(async (date) => (await (await import('./js/store.js')).save('event', { title: 'Sushi', category: 'food', date, time: '19:00', endDate: date, endTime: '21:00', allDay: false, repeat: 'none', rsvp: { a: 'yes' }, entries: {} })).id, in3);
    await go('/calendar'); await go('/', 800);
    check('Geplantes Date → kein Hinweis', !(await p.$('#nudge')));
    // Anlass: Geburtstag in 10 Tagen → Hinweis trotz Plan
    const bday = await S(() => { const d = new Date(); d.setDate(d.getDate() + 10); d.setFullYear(1999); const z = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; });
    await S(async (b) => (await import('./js/store.js')).saveSettings({ birthdays: { a: null, b } }), bday);
    await go('/calendar'); await go('/', 800);
    const occ = await p.$('#nudge');
    check('Anlass: „Geburtstag von Mia · in 10 Tagen“', !!occ && (await occ.textContent()).includes('Geburtstag von Mia') && (await occ.textContent()).includes('in 10 Tagen'));
    // Rhythmus „Aus“ in den Einstellungen
    await S(async () => (await import('./js/store.js')).saveSettings({ birthdays: { a: null, b: null } }));
    await S(async (id) => (await import('./js/store.js')).remove(id), evId);
    await go('/settings', 900);
    await p.click('[data-rhythm="0"]'); await p.waitForTimeout(500);
    check('Date-Rhythmus „Aus“ gespeichert', (await S(async () => (await import('./js/store.js')).settings().dateRhythm)) === 0);
    await go('/', 800);
    check('Rhythmus aus → kein Hinweis', !(await p.$('#nudge')));
    await S(async () => (await import('./js/store.js')).saveSettings({ dateRhythm: 14 }));

    // Freie Abende überspringen belegte Abende
    const slots = await S(async () => {
      const s = await import('./js/store.js'); const D = await import('./js/dateplan.js'); const M = await import('./js/model.js');
      const d = new Date(); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
      const fri = M.isoDate(d);
      await s.save('event', { title: 'Belegt', category: 'other', date: fri, time: '19:00', endDate: fri, endTime: '23:00', allDay: false, repeat: 'none', rsvp: {}, entries: {} });
      return { fri, slots: D.freeSlots(M.today(), { days: 14, max: 20 }).map((x) => x.date) };
    });
    check('Freie Abende: belegter Freitag fehlt', !slots.slots.includes(slots.fri) && slots.slots.length > 3, `${slots.fri} · ${slots.slots.length} frei`);

    // ---------- Listen ----------
    await go('/lists', 900);
    await p.click('#add-who'); await p.waitForTimeout(200);
    check('Zuweisung beim Anlegen: „Du kümmerst dich“', (await p.textContent('#add-hint')).includes('Du kümmerst dich'));
    await p.fill('#nt', 'Müll rausbringen');
    await p.press('#nt', 'Enter'); await p.waitForTimeout(500);
    await p.fill('#nt', 'Geschenk für Oma besorgen');
    await p.press('#nt', 'Enter'); await p.waitForTimeout(500);
    check('Eingabefeld bleibt offen (Fokus bleibt)', await p.evaluate(() => document.activeElement?.id === 'nt'));
    check('Aufgaben unter „Du kümmerst dich um“', (await p.textContent('#todo-body')).includes('Du kümmerst dich um') && (await p.$$('#todo-body .todo')).length === 2);
    const first = await S(async () => (await import('./js/store.js')).all('todo').find((t) => t.data.text === 'Müll rausbringen').id);
    await p.click(`[data-assign="${first}"]`); await p.waitForTimeout(400);
    check('Tippen aufs Symbol weist Mia zu', (await S(async (id) => (await import('./js/store.js')).get(id).data.assignee, first)) === 'b' && (await p.textContent('#todo-body')).includes('Mia kümmert sich um'));
    await p.click(`[data-check="${first}"]`); await p.waitForTimeout(400);
    check('Abhaken markiert als erledigt', (await S(async (id) => (await import('./js/store.js')).get(id).data.done, first)) === true && (await p.textContent('#todo-body')).includes('Erledigt · 1'));
    await shot('lists');
    await go('/', 800);
    check('Startseite: „Für dich: Geschenk für Oma besorgen“', (await p.textContent('#view')).includes('Für dich: Geschenk für Oma besorgen'));

    // Rezept → Einkaufsliste (umgerechnet)
    const recipeId = await S(async () => (await (await import('./js/store.js')).save('entry', { category: 'recipe', title: 'Pasta', date: '2026-10-01', ratings: {}, photoIds: [], place: null, notes: '', extra: { servings: '2', ingredients: '200 g Spaghetti\n3 Knoblauchzehen\nFür oben:\nParmesan' } })).id);
    await go(`/entry/${recipeId}`, 1000);
    await p.click('[data-act="srv+"]'); await p.click('[data-act="srv+"]'); await p.waitForTimeout(200);
    await p.click('[data-act="shop"]'); await p.waitForTimeout(600);
    check('Auswahl zeigt 3 Zutaten (ohne Zwischenüberschrift)', (await p.$$('.sheet .ing.pick')).length === 3);
    await p.click('.sheet [data-act="add-shop"]'); await p.waitForTimeout(600);
    const shop = await S(async () => (await import('./js/store.js')).all('todo').filter((t) => t.data.list === 'shop').map((t) => t.data.text).sort());
    check('Einkaufsliste: auf 4 Portionen umgerechnet', shop.includes('400 g Spaghetti') && shop.includes('6 Knoblauchzehen') && shop.includes('Parmesan'), shop.join(' | '));
    await p.click('#toasts button'); await p.waitForTimeout(900);
    check('„Ansehen“ öffnet den Einkauf mit Rezept-Gruppe', p.url().endsWith('#/lists') && (await p.textContent('#todo-body')).includes('Für: Pasta'));
    await shot('lists-shop');
    return app.errors;
  } finally {
    await app.close();
  }
};
