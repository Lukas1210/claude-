// Screenshot-Rundgang mit Beispieldaten, hell und dunkel → tools/e2e/shots/
// Umgebungsvariablen: SCHEME=light|dark|both (Standard both), DPR=1|2
const { openApp, onboard, makeImages, seed } = require('./lib.cjs');

async function tour(server, scheme, check) {
  const app = await openApp(server, { scheme, dpr: +(process.env.DPR || 1), notch: true });
  const { p, go, shot, scroll } = app;
  const s = (n) => shot(`${scheme}-${n}`);
  try {
    await onboard(app);
    await seed(app, await makeImages(app));
    await go('/timeline'); await go('/', 1200);
    await s('01-home');
    await scroll(640); await s('02-home-2');
    await scroll(1300); await s('03-home-3');
    await go('/calendar', 900); await s('10-calendar');
    const evId = await p.evaluate(async () => (await import('./js/store.js')).all('event').find((e) => e.data.title === 'Wochenende in Wien').id);
    await go(`/event/${evId}`, 900); await s('11-event');
    await go('/timeline', 900); await s('20-timeline');
    await go('/entries', 900); await s('30-entries');
    const rome = await p.evaluate(async () => (await import('./js/store.js')).all('entry').find((e) => e.data.title === 'Rom').id);
    await go(`/entry/${rome}`, 1400); await s('31-detail');
    await scroll(520); await s('32-detail-2');
    const recipe = await p.evaluate(async () => (await import('./js/store.js')).all('entry').find((e) => e.data.category === 'recipe').id);
    await go(`/entry/${recipe}`, 1400); await scroll(420); await s('33-recipe');
    await go('/globe', 3500); await s('40-globe');
    await go('/gallery', 1500); await s('50-gallery');
    await go('/bucket', 900); await s('51-bucket');
    await go('/letters', 900); await s('52-letters');
    await go('/stats', 900); await s('53-stats');
    await go('/settings', 1000); await s('54-settings');
    await go('/', 800);
    await p.click('#fab'); await p.waitForTimeout(700); await s('60-add-menu');
    await p.click('.action-item >> nth=0'); await p.waitForTimeout(800); await s('61-entry-form');
    check(`Rundgang ${scheme}`, true);
    return app.errors;
  } finally {
    await app.close();
  }
}

exports.run = async ({ server, check }) => {
  const sc = process.env.SCHEME || 'both';
  const errors = [];
  for (const scheme of sc === 'both' ? ['light', 'dark'] : [sc]) errors.push(...(await tour(server, scheme, check)));
  return errors;
};
