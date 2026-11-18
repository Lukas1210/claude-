// Filme & Serien (inkl. Watchlist & Zufall) und Wunschzettel (inkl. geheimer, nur lokaler Ideen).
const { openApp, onboard } = require('./lib.cjs');

exports.run = async ({ server, check }) => {
  const app = await openApp(server);
  const { p, S, go, shot } = app;
  try {
    await onboard(app);

    // ---------- Filme & Serien ----------
    await p.click('#fab'); await p.waitForTimeout(500);
    check('„+“-Menü hat „Film & Serie“', !!(await p.$('.action-item:has-text("Film & Serie")')));
    await p.click('.action-item:has-text("Film & Serie")'); await p.waitForTimeout(700);
    check('Kein Ort bei Filmen, Datum heißt „Geschaut am“', !(await p.$('#place-cell')) && (await p.textContent('.sheet .group')).includes('Geschaut am'));
    await p.fill('#title', 'Dark');
    await p.click('[data-x="kind"][data-v="📺 Serie"]');
    await p.click('[data-x="platform"][data-v="Netflix"]');
    await p.fill('[data-xi="season"]', 'Staffel 1');
    await p.click('[data-x="again"][data-v="yes"]');
    await p.click('[data-act="save"]'); await p.waitForTimeout(1200);
    const mv = await S(async () => (await import('./js/store.js')).all('entry').find((e) => e.data.category === 'movie'));
    check('Serie gespeichert', mv && mv.data.extra.kind === '📺 Serie' && mv.data.extra.platform === 'Netflix' && mv.data.place === null);
    await go('/entries?cat=movie', 900);
    check('Liste zeigt „Serie · Netflix“', (await p.textContent('#list')).includes('Serie · Netflix'));
    // Watchlist
    await go('/bucket?cat=movie', 800);
    check('Bucket-Liste als „Watchlist“', (await p.textContent('.large-title')).includes('Watchlist'));
    await p.click('[data-act="add"] >> nth=0'); await p.waitForTimeout(500);
    check('Neuer Wunsch ist schon „Film/Serie“', (await p.getAttribute('[data-c="movie"]', 'class')).includes('active'));
    await p.fill('#wt', 'Oppenheimer');
    await p.click('.sheet [data-act="save"]'); await p.waitForTimeout(700);
    await go('/entries?cat=movie', 900);
    check('Filme-Kopf zeigt Watchlist', (await p.textContent('#view')).includes('1 auf der Watchlist'));
    await p.click('[data-act="watch-pick"]'); await p.waitForTimeout(700);
    check('„Was schauen wir heute?“ wählt aus der Watchlist', (await p.textContent('.sheet')).includes('Heute schaut ihr') && (await p.textContent('#sw-t')) === 'Oppenheimer');
    await p.click('[data-s="go"]'); await p.waitForTimeout(400);
    const inPool = await S(async () => (await import('./js/views/dateplanner.js')).ideaPool().some((i) => i.title === 'Schauen: Oppenheimer' && i.where === 'home'));
    check('Watchlist landet in den Date-Ideen', inPool);
    // Termin „Film/Serie“ → Film-Eintrag
    const evId = await S(async (date) => (await (await import('./js/store.js')).save('event', { title: 'Kinoabend', category: 'movie', date, time: '20:00', endDate: date, endTime: '22:30', allDay: false, repeat: 'none', rsvp: { a: 'yes' }, entries: {} })).id, await app.iso(-1));
    await go(`/event/${evId}`, 800);
    await p.click('[data-act="memory"]'); await p.waitForTimeout(800);
    check('Termin „Film/Serie“ wird zum Film-Eintrag', (await p.inputValue('#title')) === 'Kinoabend' && (await p.textContent('.sheet .group')).includes('Geschaut am'));
    await p.click('.sheet [data-act="cancel"]'); await p.waitForTimeout(400);
    if (await p.$('.dialog.show')) { await p.click('.dialog [data-v="1"]'); await p.waitForTimeout(500); }
    check('Formular geschlossen', !(await p.$('.sheet.show')));

    // ---------- Wunschzettel ----------
    await go('/wishlist', 800);
    await p.click('[data-act="add"] >> nth=0'); await p.waitForTimeout(500);
    await p.fill('#gt', 'Kopfhörer');
    await p.fill('#gu', 'https://www.example.com/kopfhoerer');
    await p.fill('#gp', '149');
    await p.click('[data-prio="3"]');
    await p.click('.sheet [data-act="save"]'); await p.waitForTimeout(700);
    check('Eigener Wunsch erscheint (Preis, Shop, „Unbedingt“)', (await p.textContent('.gw-list')).includes('Kopfhörer') && (await p.textContent('.gw-list')).includes('149') && (await p.textContent('.gw-list')).includes('example.com') && (await p.textContent('.gw-list')).includes('Unbedingt'));
    const wishSynced = await S(async () => (await import('./js/store.js')).dirtyItems().some((i) => i.type === 'giftwish'));
    check('Wunsch wird synchronisiert (zum Hochladen markiert)', wishSynced);

    // Als Mia: Wunsch von Lukas „besorgen“ – nur lokal
    await S(async () => (await import('./js/store.js')).setDevice({ me: 'b' }));
    await go('/'); await go('/wishlist?tab=partner', 800);
    check('Mia sieht „Von Lukas“ mit dem Wunsch', (await p.textContent('.gw-list')).includes('Kopfhörer'));
    await p.click('.gw >> nth=0'); await p.waitForTimeout(500);
    await p.click('.action-row:has-text("Besorg ich")'); await p.waitForTimeout(600);
    const res = await S(async () => { const s = await import('./js/store.js'); return { dev: Object.keys(s.getDevice().reserved || {}).length, dirtyRes: s.dirtyItems().some((i) => JSON.stringify(i.data).includes('reserved')) }; });
    check('„Besorg ich“ nur auf diesem iPhone gespeichert', res.dev === 1 && !res.dirtyRes && (await p.textContent('.gw-list')).includes('nur du siehst das'));
    await shot('wishlist-partner');

    // Geheime Idee: nur lokal, wird nie hochgeladen
    await p.click('[data-tab="secret"]'); await p.waitForTimeout(400);
    await p.click('[data-act="add"] >> nth=0'); await p.waitForTimeout(500);
    await p.fill('#gt', 'Wochenende in Wien');
    await p.fill('#gn', 'Im Frühling, Hotel nahe Naschmarkt');
    await p.click('.sheet [data-act="save"]'); await p.waitForTimeout(700);
    const secret = await S(async () => { const s = await import('./js/store.js'); const it = s.all('giftidea')[0]; return { local: !!it?.local, dirty: s.dirtyItems().some((i) => i.type === 'giftidea'), id: it?.id }; });
    check('Geheime Idee: lokal und nie zum Hochladen markiert', secret.local && !secret.dirty);
    await S(async () => { const s = await import('./js/store.js'); await s.markAllDirty(); });
    check('Auch „alles neu hochladen“ lässt die Idee aus', !(await S(async () => (await import('./js/store.js')).dirtyItems().some((i) => i.type === 'giftidea'))));
    await shot('wishlist-secret');
    // Idee → Geschenk-Eintrag, danach verschwindet die Idee
    await p.click('.gw >> nth=0'); await p.waitForTimeout(500);
    await p.click('.action-row:has-text("Als Geschenk festhalten")'); await p.waitForTimeout(800);
    check('Geschenk-Formular mit Idee vorausgefüllt', (await p.inputValue('#title')) === 'Wochenende in Wien');
    await p.click('.sheet [data-act="save"]'); await p.waitForTimeout(1200);
    const after = await S(async (id) => { const s = await import('./js/store.js'); return { gone: !s.getRaw(id), gift: s.all('entry').find((e) => e.data.category === 'gift')?.data.extra?.from }; }, secret.id);
    check('Idee nach dem Festhalten entfernt, Geschenk „von Mia“', after.gone && after.gift === 'b', JSON.stringify(after));
    await S(async () => (await import('./js/store.js')).setDevice({ me: 'a' }));
    return app.errors;
  } finally {
    await app.close();
  }
};
