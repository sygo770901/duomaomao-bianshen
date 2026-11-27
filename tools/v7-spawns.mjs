import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.goto('http://localhost:8765/?lowgfx=1');
await p.waitForFunction(() => window.__ph?.ready, null, { timeout: 60000 });
const r = await p.evaluate(() => {
  const out = {};
  for (const map of ['home','office']) {
    __ph.setMapLocal(map);
    const M = __ph.MAPS[map];
    out[map] = (M.seekers || [M.seeker]).map(([x,z]) => {
      const c = __ph.collideAt(x, z);
      return { x, z, pushed: Math.hypot(c[0]-x, c[1]-z), to: c };
    });
  }
  return out;
});
console.log(JSON.stringify(r, null, 2));
await b.close();
