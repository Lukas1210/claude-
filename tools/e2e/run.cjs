#!/usr/bin/env node
// End-to-End-Tests (Chromium im iPhone-Format).
// Aufruf:  node tools/e2e/run.cjs                 → alle Testgruppen
//          node tools/e2e/run.cjs calendar recipes → nur diese
//          node tools/e2e/run.cjs tour             → Screenshot-Rundgang (tools/e2e/shots/)
const { startServer, makeChecker } = require('./lib.cjs');

const ALL = ['flows', 'calendar', 'recipes', 'planner', 'extras'];

(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
  const server = await startServer();
  const results = [];
  for (const name of names) {
    const st = makeChecker(name);
    console.log(`\n▶ ${name}`);
    const t0 = Date.now();
    try {
      const errors = (await require(`./${name}.cjs`).run({ server, check: st.check })) || [];
      st.check('keine Fehler in der Konsole', !errors.length, errors.slice(0, 4).join(' | '));
    } catch (e) {
      st.check('läuft ohne Absturz', false, String(e && e.message).split('\n')[0]);
    }
    console.log(`  → ${st.passed} ok, ${st.failed} fehlgeschlagen (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    results.push(st);
  }
  await server.close();
  const failed = results.reduce((n, r) => n + r.failed, 0);
  const passed = results.reduce((n, r) => n + r.passed, 0);
  console.log(`\n${failed ? '✗' : '✓'} ${passed} Prüfungen bestanden, ${failed} fehlgeschlagen`);
  for (const r of results) for (const f of r.failures) console.log(`  ✗ [${r.name}] ${f}`);
  process.exit(failed ? 1 : 0);
})();
