// Duell, Rangliste und Erfolge mit Beispieldaten.
const { openApp, onboard, makeImages, seed } = require('./lib.cjs');

exports.run = async ({ server, check }) => {
  const app = await openApp(server);
  const { p, S, go, shot } = app;
  try {
    await onboard(app);
    await seed(app, await makeImages(app));

    await go('/duel', 1200);
    const ring = await p.textContent('.ring-num');
    check('Duell: Übereinstimmung in %', /\d+%/.test(ring.replace(/\s/g, '')), ring.trim());
    check('Duell: Burgerladen ist am umstrittensten', (await p.textContent('.hot >> nth=0')).includes('Burgerladen'));
    check('Duell: Lieblingskategorie je Person', (await p.textContent('#view')).includes('Lieblingskategorie'));
    await shot('duel');
    await p.click('[data-tab="tiers"]'); await p.waitForTimeout(500);
    const s = await p.textContent('.tier-row >> nth=0');
    check('Rangliste: S enthält Paris & New York', s.includes('Paris') && s.includes('New York'));
    await p.click('[data-tcat="food"]'); await p.waitForTimeout(400);
    const foodTiers = await p.textContent('.tiers');
    check('Rangliste nach Kategorie filtern', foodTiers.includes('Trattoria') && !foodTiers.includes('Paris'));
    await shot('tiers');

    await go('/achievements', 900);
    check('Erfolge: Zähler & Serie', (await p.textContent('.page-sub')).includes('freigeschaltet') && (await p.textContent('.streak-card')).includes('in Folge'));
    check('Erfolge: Weltenbummler mit Stufe', (await p.textContent('[data-award="laender"]')).includes('Bronze'));
    await p.click('[data-award="km"]'); await p.waitForTimeout(500);
    check('Detail zeigt alle Stufen', (await p.$$('.sheet .tier-dot')).length === 3);
    await shot('awards');
    await p.click('.sheet-head .l, .backdrop').catch(() => {});
    await p.waitForTimeout(400);

    // Startseite: Entdecken + Meldung bei neuer Stufe
    await go('/', 900);
    check('Startseite: Bereich „Entdecken“', (await p.textContent('.discover')).includes('Duell') && (await p.textContent('.discover')).includes('einig'));
    await S(async () => { const s = await import('./js/store.js'); const seen = { ...(s.getDevice().seenAch || {}) }; seen.laender = 0; await s.setDevice({ seenAch: seen }); });
    await go('/calendar', 500); await go('/', 1200);
    check('Neue Stufe wird gemeldet', (await p.textContent('#toasts')).includes('Weltenbummler'));
    return app.errors;
  } finally {
    await app.close();
  }
};
