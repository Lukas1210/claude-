// Kalender: Termine, Wiederholungen, Zusagen, iCal, Termin → Erlebnis, Darstellung.
const fs = require('fs');
const path = require('path');
const { openApp, onboard, TMP } = require('./lib.cjs');

const SUSHI = [{ name: 'Sushi Sano', lat: 48.13, lon: 11.57, address: { city: 'München', country: 'Deutschland', country_code: 'de' } }];

exports.run = async ({ server, check }) => {
  const app = await openApp(server, { nominatim: SUSHI });
  const { p, S, go, iso } = app;
  try {
    await onboard(app);

    const tabs = await p.$$eval('#tabbar .tab span', (els) => els.map((e) => e.textContent));
    check('Tabs: Wir · Kalender · Timeline · Erlebnisse · Globus', tabs.join(',') === 'Wir,Kalender,Timeline,Erlebnisse,Globus', tabs.join(','));

    // Termin über Kalender anlegen (wöchentlich)
    await p.click('#tabbar [data-tab="calendar"]'); await p.waitForTimeout(700);
    const tomorrow = await iso(1);
    await p.click(`.cal-day[data-day="${tomorrow}"]`).catch(async () => { await p.click('[data-act="next"]'); await p.waitForTimeout(300); await p.click(`.cal-day[data-day="${tomorrow}"]`); });
    await p.waitForTimeout(300);
    await p.click('#fab'); await p.waitForTimeout(700);
    check('"+" im Kalender öffnet Terminformular', !!(await p.$('#et')));
    check('Formular übernimmt gewählten Tag', (await p.inputValue('#sd')) === tomorrow, await p.inputValue('#sd'));
    await p.fill('#et', 'Sushi-Abend');
    await p.click('[data-cat="food"]');
    await p.fill('#stt', '19:30');
    await p.dispatchEvent('#stt', 'change');
    await p.waitForTimeout(200);
    check('Ende rückt mit (+2 Std.)', (await p.inputValue('#ett')) === '21:30', await p.inputValue('#ett'));
    await p.selectOption('#rep', 'weekly'); await p.waitForTimeout(300);
    await p.selectOption('#rem', '1440');
    await p.click('#place-cell'); await p.waitForTimeout(400);
    await p.fill('#pq', 'Sushi'); await p.waitForTimeout(1200);
    await p.click('.place-result[data-i="0"]'); await p.waitForTimeout(400);
    await p.fill('#en', 'Tisch reserviert');
    await p.click('.sheet [data-act="save"]'); await p.waitForTimeout(1000);
    const ev = await S(async () => (await import('./js/store.js')).all('event')[0]);
    check('Termin gespeichert', ev && ev.data.title === 'Sushi-Abend' && ev.data.time === '19:30' && ev.data.repeat === 'weekly' && ev.data.reminder === 1440 && ev.data.place?.name === 'Sushi Sano');
    check('Eigene Zusage automatisch "dabei"', ev.data.rsvp.a === 'yes');
    check('Termin erscheint in Tagesliste', (await p.textContent('.event-list')).includes('Sushi-Abend'));
    const nextWeek = await iso(8);
    const occ = await S(async ([id, a, b]) => { const E = await import('./js/events.js'); const S = await import('./js/store.js'); return E.occurrencesInRange(S.get(id), a, b); }, [ev.id, tomorrow, nextWeek]);
    check('Wiederholung: nächste Woche wieder', occ.length === 2 && occ[1] === nextWeek, occ.join(','));

    // Detail, Zusage, iCal
    await go(`/event/${ev.id}?d=${nextWeek}`, 900);
    check('Detail zeigt Wiederholung', (await p.textContent('.event-hero')).includes('Jede Woche'));
    await S(async () => (await import('./js/store.js')).setDevice({ me: 'b' }));
    await go('/calendar'); await go(`/event/${ev.id}?d=${nextWeek}`, 900);
    await p.click('[data-rsvp="maybe"]'); await p.waitForTimeout(600);
    check('Partner-Zusage "vielleicht" gespeichert', (await S(async (id) => (await import('./js/store.js')).get(id).data.rsvp.b, ev.id)) === 'maybe');
    await S(async () => (await import('./js/store.js')).setDevice({ me: 'a' }));
    const ics = await S(async (id) => { const E = await import('./js/events.js'); const S = await import('./js/store.js'); return E.toICS(S.get(id)); }, ev.id);
    check('iCal: Wiederholung, Erinnerung, Ort', /RRULE:FREQ=WEEKLY/.test(ics) && /TRIGGER:-PT1440M/.test(ics) && /LOCATION:Sushi Sano/.test(ics) && /DTSTART:\d{8}T193000/.test(ics));
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), p.click('[data-act="ics"]')]);
    if (dl) {
      const file = path.join(TMP, 't.ics');
      await dl.saveAs(file);
      check('Kalender-Datei wird erzeugt (ohne Sync)', dl.suggestedFilename().endsWith('.ics') && fs.readFileSync(file, 'utf8').includes('BEGIN:VEVENT'), dl.suggestedFilename());
    } else check('Kalender-Datei wird erzeugt (ohne Sync)', false, 'kein Download');

    // Einzelnen Termin einer Serie löschen
    await go('/calendar'); await go(`/event/${ev.id}?d=${nextWeek}`, 900);
    await p.click('[data-act="delete"]'); await p.waitForTimeout(500);
    await p.click('.action-row:has-text("Nur am")'); await p.waitForTimeout(900);
    const ex = await S(async (id) => (await import('./js/store.js')).get(id).data.exdates, ev.id);
    check('Nur ein Termin der Serie gelöscht', ex.length === 1 && ex[0] === nextWeek, ex.join(','));

    // Vergangener Termin -> Erlebnis
    const past = await iso(-2);
    const pastId = await S(async (date) => (await (await import('./js/store.js')).save('event', { title: 'Bowling', category: 'activity', date, time: '20:00', endDate: date, endTime: '22:00', allDay: false, repeat: 'none', rsvp: { a: 'yes' }, entries: {} })).id, past);
    await go(`/event/${pastId}`, 900);
    await p.click('[data-act="memory"]'); await p.waitForTimeout(800);
    check('Erlebnis-Formular vorausgefüllt', (await p.inputValue('#title')) === 'Bowling' && (await p.inputValue('#date')) === past);
    await p.click('.sheet [data-act="save"]'); await p.waitForTimeout(1300);
    const linked = await S(async (id) => { const s = await import('./js/store.js'); const e = s.get(id); const eid = Object.values(e.data.entries || {})[0]; return eid && s.get(eid)?.data.category; }, pastId);
    check('Termin mit Erlebnis verknüpft', linked === 'activity', linked);
    await go(`/event/${pastId}`, 800);
    check('Detail zeigt "Erinnerung ansehen"', (await p.textContent('#view')).includes('Erinnerung ansehen'));

    // Ganztägiger mehrtägiger Termin
    const in10 = await iso(10), in12 = await iso(12);
    await S(async ([a, b]) => (await import('./js/store.js')).save('event', { title: 'Wien', category: 'trip', allDay: true, date: a, endDate: b, repeat: 'none', rsvp: {}, entries: {} }), [in10, in12]);
    const on11 = await S(async (d) => (await import('./js/events.js')).occurrencesOnDay(d).map((o) => o.ev.data.title), await iso(11));
    check('Mehrtägiger Termin an jedem Tag sichtbar', on11.includes('Wien'), on11.join(','));

    // Monatswechsel
    await go('/calendar', 700);
    const m1 = await p.textContent('.cal-head h2');
    await p.click('[data-act="next"]'); await p.waitForTimeout(300);
    const m2 = await p.textContent('.cal-head h2');
    await p.click('[data-act="today"]'); await p.waitForTimeout(300);
    check('Monat vor/zurück & Heute', m1 !== m2 && (await p.textContent('.cal-head h2')) === m1, `${m1} → ${m2}`);

    // Monatlich am 31. & 29. Februar
    const edge = await S(async () => {
      const E = await import('./js/events.js');
      const m = { id: 'x', data: { date: '2027-01-31', repeat: 'monthly' } };
      const y = { id: 'y', data: { date: '2028-02-29', repeat: 'yearly' } };
      return [E.occurrencesInRange(m, '2027-01-01', '2027-05-31'), E.occurrencesInRange(y, '2028-01-01', '2033-12-31')];
    });
    check('Monatlich am 31. überspringt kurze Monate', edge[0].join(',') === '2027-01-31,2027-03-31,2027-05-31', edge[0].join(','));
    check('Jährlich am 29.2. nur in Schaltjahren', edge[1].join(',') === '2028-02-29,2032-02-29', edge[1].join(','));

    // Startseite: nächster Termin
    await go('/', 900);
    check('Startseite zeigt "Als Nächstes"', (await p.textContent('.next-event')).includes('Sushi-Abend'));

    // Darstellung
    const bg = () => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await go('/settings', 1000);
    await p.click('[data-theme-pref="dark"]'); await p.waitForTimeout(300);
    check('Dunkel erzwingen', (await p.evaluate(() => document.documentElement.dataset.theme)) === 'dark' && (await bg()) === 'rgb(7, 11, 23)', await bg());
    await p.reload(); await p.waitForTimeout(1000);
    check('Dunkel bleibt nach Neustart', (await p.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
    await go('/settings', 1000);
    await p.click('[data-theme-pref="system"]'); await p.waitForTimeout(300);
    check('Automatisch folgt dem System (hell)', !(await p.evaluate(() => document.documentElement.dataset.theme)) && (await bg()) === 'rgb(242, 244, 249)', await bg());

    // Galerie über Startseite erreichbar
    await go('/', 800);
    await p.click('a.tile[href="#/gallery"]'); await p.waitForTimeout(800);
    check('Galerie über Kachel erreichbar, mit Zurück', p.url().endsWith('#/gallery') && !!(await p.$('.topbar [data-act="back"]')));
    return app.errors;
  } finally {
    await app.close();
  }
};
