import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.goto('http://localhost:8765/?lowgfx=1'); await p.waitForFunction(() => window.__ph?.ready, null, { timeout: 60000 });
console.log(await p.evaluate(() => { __ph.setMapLocal('office'); const M = __ph.MAPS.office; const out = [];
  for (const [x, z] of [[10.0, -5.0], [11.2, -3.9]]) out.push(`${x},${z}: ` + JSON.stringify(M.colliders.filter(c => x + .33 > c.x1 && x - .33 < c.x2 && z + .33 > c.z1 && z - .33 < c.z2).map(c => ({ ...c, n: c.prop != null ? __ph.PROPS[c.prop][0] : '' }))));
  return out.join('\n'); }));
await b.close();
