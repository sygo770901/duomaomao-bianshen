import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('[err]', e.message));
await p.goto('http://localhost:8765/?lowgfx=1'); await p.waitForFunction(() => window.__ph?.ready, null, { timeout: 60000 });
const r = await p.evaluate(() => {
  __ph.setMapLocal('office'); const M = __ph.MAPS.office; const out = [];
  const statics = M.colliders.filter(c => c.prop == null);
  const props = M.colliders.filter(c => c.prop != null);
  const ov = (a, c) => Math.max(0, Math.min(a.x2, c.x2) - Math.max(a.x1, c.x1)) * Math.max(0, Math.min(a.z2, c.z2) - Math.max(a.z1, c.z1));
  for (const a of props) { const n = __ph.PROPS[a.prop][0];
    for (const c of statics) { const o = ov(a, c); if (o > .01) out.push(`WALL ${a.prop} ${n} @${__ph.PROPS[a.prop][1]},${__ph.PROPS[a.prop][2]} ov=${o.toFixed(3)} ${c.glass ? 'glass' : c.wall ? 'wall' : 'low'}`); }
    for (const c of props) if (c.prop > a.prop) { const o = ov(a, c); if (o > .02) out.push(`PROP ${a.prop} ${n} x ${c.prop} ${__ph.PROPS[c.prop][0]} ov=${o.toFixed(3)}`); } }
  for (const [x, z] of [...M.hiders, M.seeker]) { const q = __ph.collideAt(x, z); if (Math.hypot(q[0] - x, q[1] - z) > .01) out.push(`SPAWN blocked ${x},${z} -> ${q}`); }
  // 牆上掛飾：能否找到牆
  return out; });
console.log(r.join('\n')); console.log('issues', r.length);
await b.close();
