// Swipe-Match (inkl. Wischgeste & Match), Rückblick als Story und Teilen als Bild.
const { openApp, onboard, makeImages, seed } = require('./lib.cjs');

exports.run = async ({ server, check }) => {
  const app = await openApp(server);
  const { p, S, go, shot } = app;
  try {
    await onboard(app);
    await seed(app, await makeImages(app));

    // ---------- Swipe-Match ----------
    await go('/match', 900);
    check('Match: Karte & Knöpfe da, ohne Sync mit „wer wischt“', !!(await p.$('#deck .swipe-card')) && !!(await p.$('[data-swiper="b"]')));
    const topId = await p.getAttribute('#deck .swipe-card:last-child', 'data-id');
    await p.click('[data-act="yes"]'); await p.waitForTimeout(700);
    const va = await S(async () => (await import('./js/views/match.js')).votesOf('a'));
    check('„Lust“ speichert Stimme von Lukas', va[topId]?.v === 1, topId);
    // Wischgeste nach links
    const card = await p.$('#deck .swipe-card:last-child');
    const leftId = await card.getAttribute('data-id');
    const box = await card.boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await p.mouse.down();
    for (let k = 1; k <= 8; k++) await p.mouse.move(box.x + box.width / 2 - k * 25, box.y + box.height / 2 + k * 2);
    await p.mouse.up(); await p.waitForTimeout(700);
    check('Wischen nach links = „Nö“', (await S(async () => (await import('./js/views/match.js')).votesOf('a')))[leftId]?.v === -1);
    // Mia wischt: alle anderen eigenen Ideen schon bewertet → Lukas' Idee liegt oben
    await S(async (keep) => {
      const M = await import('./js/views/match.js'); const D = await import('./js/views/dateplanner.js');
      for (const i of D.ideaPool()) if (i.id !== keep) await M.vote('b', i.id, -1);
    }, topId);
    await p.click('[data-swiper="b"]'); await p.waitForTimeout(500);
    check('Handy weitergeben: Mias Stapel', (await p.getAttribute('#deck .swipe-card:last-child', 'data-id')) === topId);
    await p.click('[data-act="yes"]'); await p.waitForTimeout(900);
    check('Beide „Lust“ → Match-Fenster', !!(await p.$('.match-overlay.show')) && (await p.textContent('.match-overlay')).includes('Ihr beide habt Lust'));
    await shot('match');
    const ideaTitle = (await p.textContent('.match-overlay .idea-title')).trim();
    await p.click('[data-m="plan"]'); await p.waitForTimeout(800);
    check('„Gleich planen“ öffnet den Planer mit der Idee', (await p.textContent('.plan-idea-title')).trim() === ideaTitle);
    await p.click('.sheet [data-act="cancel"]'); await p.waitForTimeout(400);
    await p.click('[data-tab="matches"]'); await p.waitForTimeout(400);
    check('Matches-Liste zeigt das Match', (await p.textContent('#view')).includes(ideaTitle));
    await S(async () => (await import('./js/store.js')).setDevice({ seenMatches: [] }));
    await S(async () => (await import('./js/views/match.js')).notifyNewMatches());
    await p.waitForTimeout(400);
    check('Neues Match vom Partner wird gemeldet', (await p.textContent('#toasts')).includes('Neues Match'));

    // ---------- Rückblick ----------
    await go('/', 600);
    await go('/wrapped?y=2025', 1200);
    check('Rückblick startet als Story (2025)', !!(await p.$('.story')) && (await p.textContent('.st-year')).includes('2025'));
    check('Tab-Leiste ist ausgeblendet', await p.evaluate(() => getComputedStyle(document.getElementById('tabbar')).visibility === 'hidden'));
    const bars = (await p.$$('.story-bars span')).length;
    check('Mehrere Folien (≥ 6)', bars >= 6, `${bars}`);
    await shot('wrapped-1');
    await p.mouse.click(330, 500); await p.waitForTimeout(900);
    check('Tippen rechts → Zahlen-Folie', (await p.textContent('.story-body')).includes('In Zahlen'));
    await shot('wrapped-2');
    for (let k = 0; k < bars; k++) await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(900);
    check('Letzte Folie mit „Als Bild teilen“', !!(await p.$('.story [data-act="share"]')));
    await p.click('.story [data-act="share"]'); await p.waitForTimeout(2500);
    const prev = await p.evaluate(() => { const i = document.querySelector('.share-preview img'); return i ? [i.naturalWidth, i.naturalHeight] : null; });
    check('Rückblick-Bild 1080 × 1920 erzeugt', prev && prev[0] === 1080 && prev[1] === 1920, JSON.stringify(prev));
    await shot('wrapped-share');
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), p.click('.sheet [data-act="share"]')]);
    check('Ohne Teilen-Menü wird das Bild gesichert', !!dl && dl.suggestedFilename().endsWith('.jpg'), dl && dl.suggestedFilename());
    await p.click('.sheet [data-act="cancel"]'); await p.waitForTimeout(400);
    await p.click('.story-close'); await p.waitForTimeout(800);
    check('Schließen beendet die Story', !(await p.$('.story')));

    // ---------- Erlebnis als Bild ----------
    const rome = await S(async () => (await import('./js/store.js')).all('entry').find((e) => e.data.title === 'Rom').id);
    await go(`/entry/${rome}`, 1300);
    await p.click('[data-act="more"]'); await p.waitForTimeout(500);
    await p.click('.action-row:has-text("Als Bild teilen")'); await p.waitForTimeout(2500);
    const prev2 = await p.evaluate(() => { const i = document.querySelector('.share-preview img'); return i ? [i.naturalWidth, i.naturalHeight] : null; });
    check('Story-Bild vom Erlebnis (mit Foto) erzeugt', prev2 && prev2[0] === 1080 && prev2[1] === 1920, JSON.stringify(prev2));
    const src = await p.getAttribute('.share-preview img', 'src');
    const b64 = await p.evaluate(async (u) => { const b = await (await fetch(u)).blob(); return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(String(f.result).split(',')[1]); f.readAsDataURL(b); }); }, src);
    require('fs').writeFileSync(require('path').join(require('./lib.cjs').SHOTS, 'story-image.jpg'), Buffer.from(b64, 'base64'));
    return app.errors;
  } finally {
    await app.close();
  }
};
