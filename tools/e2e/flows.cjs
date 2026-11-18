// Grundabläufe: Erlebnis anlegen/bewerten/bearbeiten/löschen, Bucket-Liste, Meilenstein,
// Brief-Zeitkapsel, Jahrestag, Backup-Export/-Import, Suche.
const fs = require('fs');
const path = require('path');
const { openApp, onboard, makeImages, TMP } = require('./lib.cjs');

exports.run = async ({ server, check }) => {
  const app = await openApp(server);
  const { p, S, go } = app;
  try {
    await onboard(app);
    const images = await makeImages(app);

    // Date anlegen über Formular, ohne Ort
    await p.click('#fab'); await p.waitForTimeout(500);
    await p.click('.action-item:has-text("Date")'); await p.waitForTimeout(600);
    await p.fill('#title', 'Kino & Popcorn');
    await p.click('[data-act="save"]'); await p.waitForTimeout(1200);
    check('Date gespeichert und Detail geöffnet', p.url().includes('#/entry/'));
    const id = p.url().split('/entry/')[1];

    // Bewertung über "Jetzt bewerten"
    await p.click('[data-act="rate"]'); await p.waitForTimeout(600);
    const h = await (await p.$('#rh .h:nth-child(4)')).boundingBox();
    await p.mouse.click(h.x + h.width - 5, h.y + h.height / 2);
    await p.fill('#rc', 'Lustiger Film');
    await p.click('.sheet [data-act="save"]'); await p.waitForTimeout(900);
    const rating = await S(async (id) => (await import('./js/store.js')).get(id).data.ratings.a, id);
    check('Bewertung über Detailseite gespeichert', rating.value === 4 && rating.comment === 'Lustiger Film', JSON.stringify(rating));
    check('Detailseite zeigt Bewertung', (await p.textContent('.rating-pair')).includes('Lustiger Film'));

    // Bearbeiten
    await p.click('.detail-float-bar [data-act="edit"]'); await p.waitForTimeout(700);
    await p.fill('#title', 'Kino & Popcorn 🍿');
    await p.click('[data-act="save"]'); await p.waitForTimeout(1000);
    check('Bearbeiten speichert Titel', (await p.textContent('.detail-head h1')).includes('🍿'));

    // Abbrechen mit Änderungen fragt nach
    await p.click('.detail-float-bar [data-act="edit"]'); await p.waitForTimeout(700);
    await p.fill('#title', 'xxx');
    await p.click('[data-act="cancel"]'); await p.waitForTimeout(500);
    check('Verwerfen-Dialog erscheint', !!(await p.$('.dialog.show')));
    await p.click('.dialog [data-v="1"]'); await p.waitForTimeout(700);
    check('Titel unverändert nach Verwerfen', (await S(async (id) => (await import('./js/store.js')).get(id).data.title, id)) === 'Kino & Popcorn 🍿');

    // Löschen über Mehr-Menü
    await p.click('[data-act="more"]'); await p.waitForTimeout(500);
    await p.click('.action-row:has-text("Löschen")'); await p.waitForTimeout(500);
    await p.click('.dialog [data-v="1"]'); await p.waitForTimeout(1000);
    check('Erlebnis gelöscht', await S(async (id) => !(await import('./js/store.js')).get(id), id));

    // Wunsch anlegen -> als Erinnerung festhalten
    await go('/bucket');
    await p.click('[data-act="add"] >> nth=0'); await p.waitForTimeout(500);
    await p.fill('#wt', 'Heißluftballon fahren');
    await p.click('[data-c="activity"]');
    await p.click('.sheet [data-act="save"]'); await p.waitForTimeout(800);
    await p.click('[data-check]'); await p.waitForTimeout(500);
    await p.click('.action-row:has-text("Als Erinnerung festhalten")'); await p.waitForTimeout(800);
    check('Formular mit Wunsch vorausgefüllt', (await p.inputValue('#title')) === 'Heißluftballon fahren');
    await p.click('[data-act="save"]'); await p.waitForTimeout(1200);
    const wish = await S(async () => (await import('./js/store.js')).all('wish')[0].data);
    check('Wunsch erfüllt & verknüpft', wish.done === true && !!wish.entryId);

    // Zufallsauswahl mit offenem Wunsch
    await go('/bucket');
    await p.click('[data-act="add"] >> nth=0'); await p.waitForTimeout(500);
    await p.fill('#wt', 'Polarlichter sehen');
    await p.click('[data-c="trip"]');
    await p.click('.sheet [data-act="save"]'); await p.waitForTimeout(800);
    await p.click('[data-act="surprise"]'); await p.waitForTimeout(800);
    check('Zufallsauswahl zeigt Wunsch', (await p.textContent('#sw-t')) === 'Polarlichter sehen');
    await p.click('[data-s="go"]'); await p.waitForTimeout(500);

    // Meilenstein
    await go('/timeline');
    await p.click('.topbar [data-act="add"]'); await p.waitForTimeout(600);
    await p.click('[data-emoji="💍"]');
    await p.fill('#mt', 'Verlobung');
    await p.fill('#md', '2026-09-20');
    await p.fill('#mx', 'Sie hat Ja gesagt!');
    await p.setInputFiles('#mf', [images.us.path]); await p.waitForTimeout(1200);
    await p.click('.sheet [data-act="save"]'); await p.waitForTimeout(1000);
    check('Meilenstein in Timeline', (await p.textContent('.tl')).includes('Verlobung'));
    const msPhotoDate = await S(async () => { const s = await import('./js/store.js'); const m = s.all('milestone')[0]; return s.get(m.data.photoIds[0]).data.takenAt; });
    check('Meilenstein-Foto bekommt Datum des Meilensteins', msPhotoDate === '2026-09-20', msPhotoDate);
    await p.click('[data-filter="milestone"]'); await p.waitForTimeout(400);
    check('Filter blendet Meilensteine aus', !(await p.textContent('.tl')).includes('Verlobung'));
    await p.click('[data-filter="milestone"]'); await p.waitForTimeout(400);

    // Brief als Zeitkapsel
    await go('/letters');
    await p.click('[data-act="write"] >> nth=0'); await p.waitForTimeout(600);
    await p.fill('#lt', 'Bis bald!');
    await p.check('#lc');
    await p.fill('#lo', '2030-01-01');
    await p.click('.sheet [data-act="send"]'); await p.waitForTimeout(900);
    await p.click('[data-tab="from"]'); await p.waitForTimeout(400);
    check('Brief in "Von mir"', (await p.$$('.envelope')).length === 1);
    await S(async () => (await import('./js/store.js')).setDevice({ me: 'b' }));
    await go('/');
    await go('/letters');
    await p.click('[data-tab="to"]'); await p.waitForTimeout(400);
    await p.click('.envelope >> nth=0'); await p.waitForTimeout(600);
    check('Zeitkapsel bleibt verschlossen', !(await p.$('.letter-paper')) && (await p.textContent('#toasts')).includes('Geduld'));
    await S(async () => (await import('./js/store.js')).setDevice({ me: 'a' }));

    // Jahrestag in Einstellungen
    await go('/settings', 1200);
    await p.click('[data-act="anniv-add"]'); await p.waitForTimeout(500);
    await p.fill('#at', 'Erster Kuss');
    await p.fill('#ad', '2022-03-19');
    await p.click('.sheet [data-act="save"]'); await p.waitForTimeout(1000);
    check('Jahrestag gespeichert', (await p.textContent('#view')).includes('Erster Kuss'));
    await go('/', 900);
    check('Countdown auf Startseite', (await p.textContent('.countdowns')).includes('Erster Kuss'));

    // Backup exportieren -> alles löschen -> importieren
    await go('/settings', 1200);
    const before = await S(async () => (await import('./js/store.js')).all().length);
    await p.click('[data-act="export"]'); await p.waitForTimeout(500);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.action-row:has-text("Komplett mit Fotos")')]);
    const file = path.join(TMP, 'backup.json');
    await dl.saveAs(file);
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    check('Backup enthält Einträge & Fotos', json.items.length === before && Object.keys(json.photos).length >= 1, `${json.items.length} Einträge, ${Object.keys(json.photos).length} Fotos`);
    await S(async () => { const db = await import('./js/db.js'); await db.itemsDB.clear(); await db.blobsDB.clear(); });
    await p.reload(); await p.waitForTimeout(1500);
    check('Daten gelöscht (nur Gerät bleibt eingerichtet)', (await S(async () => (await import('./js/store.js')).all().length)) === 0);
    await go('/settings', 1200);
    await p.setInputFiles('#imp', file); await p.waitForTimeout(600);
    await p.click('.dialog [data-v="1"]'); await p.waitForTimeout(1500);
    const after = await S(async () => (await import('./js/store.js')).all().length);
    check('Import stellt alles wieder her', after === before, `${after}/${before}`);
    const blobOk = await S(async () => { const s = await import('./js/store.js'); const P = await import('./js/photos.js'); const ph = s.all('photo')[0]; return !!(await P.getBlob(ph.id, 'full')); });
    check('Fotos nach Import vorhanden', blobOk);

    // Suche
    await go('/entries');
    await p.fill('#q', 'ballon'); await p.waitForTimeout(700);
    check('Suche findet Eintrag', (await p.$$('#list .entry-card')).length === 1);
    check('Suchfeld behält Fokus', await p.evaluate(() => document.activeElement?.id === 'q'));
    return app.errors;
  } finally {
    await app.close();
  }
};
