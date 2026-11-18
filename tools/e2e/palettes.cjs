// Vorschau der Farbwelten: gleiche Beispieldaten, je Farbwelt Startseite/Erlebnisse/Globus hell & dunkel.
// Ergebnis: tools/e2e/shots/pal-<farbwelt>-<modus>-<ansicht>.png
const { openApp, onboard, makeImages, seed } = require('./lib.cjs');

const PALETTES = (process.env.PALETTES || 'night,ocean,indigo,polaroid,neon').split(',');

exports.run = async ({ server, check }) => {
  const app = await openApp(server, { dpr: +(process.env.DPR || 1), notch: true });
  const { p, go, shot, scroll } = app;
  try {
    await onboard(app);
    await seed(app, await makeImages(app));
    await go('/', 1500);
    for (const pal of PALETTES) {
      for (const mode of ['light', 'dark']) {
        await p.evaluate(async ([pal, mode]) => { const T = await import('./js/theme.js'); T.setPalette(pal); T.setThemePref(mode); }, [pal, mode]);
        await go('/entries', 500);
        await go('/', 900);
        await scroll(0, 300);
        await shot(`pal-${pal}-${mode}-home`);
        await scroll(560, 300);
        await shot(`pal-${pal}-${mode}-home2`);
        await go('/entries', 700);
        await shot(`pal-${pal}-${mode}-entries`);
        await go('/globe', 2600);
        await shot(`pal-${pal}-${mode}-globe`);
        const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
        check(`${pal} ${mode} angewendet`, (await p.evaluate(() => document.documentElement.dataset.palette || 'neon')) === pal, bg);
      }
    }
    await p.evaluate(async () => { const T = await import('./js/theme.js'); T.setPalette('neon'); T.setThemePref('system'); });
    return app.errors;
  } finally {
    await app.close();
  }
};
