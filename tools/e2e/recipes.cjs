// Rezepte: Formular, Detail mit Zutaten-Umrechnung, Liste & Suche, Wunsch → Rezept, Termin → Rezept.
const { openApp, onboard, makeImages } = require('./lib.cjs');

exports.run = async ({ server, check }) => {
  const app = await openApp(server);
  const { p, S, go, shot } = app;
  try {
    await onboard(app);
    const images = await makeImages(app);

    await p.click('#fab'); await p.waitForTimeout(500);
    check('"+"-Menü hat Rezept', !!(await p.$('.action-item:has-text("Rezept")')));
    await p.click('.action-item:has-text("Rezept")'); await p.waitForTimeout(700);
    check('Kein Ort-Feld bei Rezepten', !(await p.$('#place-cell')));
    check('Datum heißt "Gekocht am"', (await p.textContent('.sheet .group')).includes('Gekocht am'));
    await p.setInputFiles('#file', [images.pizza.path]); await p.waitForTimeout(900);
    await p.fill('#title', 'Pasta Aglio e Olio');
    const hs = await p.$$('[data-hearts]');
    const h0 = await (await hs[0].$('.h:nth-child(5)')).boundingBox();
    await p.mouse.click(h0.x + h0.width - 5, h0.y + h0.height / 2);
    const h1 = await (await hs[1].$('.h:nth-child(4)')).boundingBox();
    await p.mouse.click(h1.x + h1.width - 5, h1.y + h1.height / 2);
    await p.fill('[data-comment="b"]', 'Etwas weniger Chili beim nächsten Mal');
    check('"Gekocht von: Zusammen" vorausgewählt', (await p.getAttribute('[data-x="cook"][data-v="both"]', 'class')).includes('active'));
    await p.click('[data-x="course"][data-v="🍝 Hauptgericht"]');
    await p.fill('[data-xi="time"]', '20');
    await p.fill('[data-xi="servings"]', '2');
    await p.click('[data-x="difficulty"][data-v="🙂 Einfach"]');
    await p.fill('[data-xi="cuisine"]', 'Italienisch');
    await p.fill('[data-xi="ingredients"]', '200 g Spaghetti\n3 Knoblauchzehen\n1/2 TL Chiliflocken\n4 EL Olivenöl\nZum Servieren:\n1 Handvoll Petersilie\nParmesan');
    await p.fill('[data-xi="steps"]', '1. Spaghetti in Salzwasser al dente kochen.\n2. Knoblauch in Scheiben schneiden und mit Chili im Öl langsam anbraten.\n3. Nudeln mit etwas Nudelwasser in die Pfanne geben, schwenken, Petersilie drüber.');
    await p.fill('[data-xi="tips"]', 'Knoblauch nicht braun werden lassen!');
    await p.fill('[data-xi="source"]', 'https://www.chefkoch.de/rezepte/aglio-olio');
    await p.click('[data-x="again"][data-v="yes"]');
    await p.check('#fav');
    await shot('recipe-form');
    await p.click('[data-act="save"]'); await p.waitForTimeout(1500);
    const rec = await S(async () => (await import('./js/store.js')).all('entry').find((e) => e.data.category === 'recipe'));
    check('Rezept gespeichert', rec && rec.data.title === 'Pasta Aglio e Olio' && rec.data.extra.time === '20' && rec.data.extra.cook === 'both' && rec.data.ratings.a.value === 5 && rec.data.ratings.b.value === 4 && rec.data.photoIds.length === 1 && rec.data.place === null);

    await p.waitForTimeout(400);
    await shot('recipe-detail');
    const txt = await p.textContent('#view');
    check('Fakten: Zeit, Portionen, Zusammen', txt.includes('20 Min.') && txt.includes('2 Port.') && txt.includes('Zusammen'));
    const ingCount = (await p.$$('.ing')).length;
    check('Zutatenliste (6 Zutaten + Zwischenüberschrift)', ingCount === 6 && (await p.textContent('.ing-head')) === 'Zum Servieren', `${ingCount}`);
    check('3 nummerierte Schritte ohne doppelte Nummern', (await p.$$('.rstep')).length === 3 && !(await p.textContent('.rstep .tx')).startsWith('1.'));
    check('Quelle als Link', (await p.textContent('#recipe-box')).includes('chefkoch.de'));
    await p.click('[data-act="srv+"]'); await p.click('[data-act="srv+"]'); await p.waitForTimeout(200);
    const ingTexts = await p.$$eval('.ing span:last-child', (els) => els.map((e) => e.textContent));
    check('Auf 4 Portionen umgerechnet', ingTexts[0] === '400 g Spaghetti' && ingTexts[2] === '1 TL Chiliflocken' && ingTexts[5] === 'Parmesan', ingTexts.slice(0, 3).join(' | '));
    await p.click('.ing[data-ing="0"]'); await p.click('.rstep[data-step="0"]'); await p.waitForTimeout(200);
    check('Zutat & Schritt abhaken', (await p.getAttribute('.ing[data-ing="0"]', 'class')).includes('done') && (await p.getAttribute('.rstep[data-step="0"]', 'class')).includes('done'));

    await go('/entries?cat=recipe', 900);
    check('Rezepte-Filter mit Gang & Zeit', (await p.textContent('#list')).includes('Hauptgericht · 20 Min.'));
    await p.click('[data-cat="all"]'); await p.waitForTimeout(300);
    await p.fill('#q', 'knoblauch'); await p.waitForTimeout(700);
    check('Suche findet Rezept über Zutat', (await p.$$('#list .entry-card')).length === 1);
    await p.fill('#q', ''); await p.waitForTimeout(600);

    // Wunsch -> Rezept
    await go('/bucket');
    await p.click('[data-act="add"] >> nth=0'); await p.waitForTimeout(500);
    await p.fill('#wt', 'Ramen selbst machen');
    await p.click('[data-c="recipe"]');
    await p.fill('#wn', 'Brühe am Vortag kochen');
    await p.click('.sheet [data-act="save"]'); await p.waitForTimeout(800);
    await p.click('[data-check]'); await p.waitForTimeout(500);
    await p.click('.action-row:has-text("Als Erinnerung festhalten")'); await p.waitForTimeout(800);
    check('Wunsch öffnet Rezept-Formular', (await p.inputValue('#title')) === 'Ramen selbst machen' && !(await p.$('#place-cell')) && (await p.inputValue('[data-xi="tips"]')) === 'Brühe am Vortag kochen');
    await p.click('.sheet [data-act="cancel"]'); await p.waitForTimeout(400);
    if (await p.$('.dialog.show')) { await p.click('.dialog [data-v="1"]'); await p.waitForTimeout(400); }

    // Kalender: Kochen -> Rezept
    const past = await app.iso(-1);
    const evId = await S(async (date) => (await (await import('./js/store.js')).save('event', { title: 'Zusammen Lasagne kochen', category: 'cook', date, time: '18:00', endDate: date, endTime: '20:00', allDay: false, repeat: 'none', rsvp: { a: 'yes' }, entries: {} })).id, past);
    await go(`/event/${evId}`, 800);
    await p.click('[data-act="memory"]'); await p.waitForTimeout(800);
    check('Termin "Kochen" wird zum Rezept', (await p.inputValue('#title')) === 'Zusammen Lasagne kochen' && !(await p.$('#place-cell')));
    await p.click('.sheet [data-act="cancel"]'); await p.waitForTimeout(400);

    await go('/', 900);
    const tile = await p.textContent('a.tile[href="#/entries?cat=recipe"]');
    check('Startseite: Rezepte-Kachel', tile.includes('1 ausprobiert'), tile.replace(/\s+/g, ' ').trim());
    await go('/stats', 900);
    check('Statistik: Bestes Rezept', (await p.textContent('#view')).includes('Bestes Rezept'));
    return app.errors;
  } finally {
    await app.close();
  }
};
