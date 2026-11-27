import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
p.on('pageerror', e => console.log('[err]', e.message));
await p.goto('http://localhost:8765/?lowgfx=1');
await p.waitForFunction(() => window.__ph?.ready, null, { timeout: 60000 });
await p.evaluate(() => { document.getElementById('home').classList.add('hidden'); __ph.scene.fog = null; });

const shots = [
  { file: 'v8-radius-home', map: 'home', pos: [-7.0, 1.5], cam: [[-7.0, 18, 2.3], [-7.0, 0, 1.5]] },
  { file: 'v8-radius-office', map: 'office', pos: [-8.6, -4.2], cam: [[-8.6, 22, -3.4], [-8.6, 0, -4.2]] },
];
for (const s of shots) {
  await p.evaluate(({ map, pos, cam }) => {
    __ph.setMapLocal(map);
    __ph.teleport(pos[0], pos[1], 0);
    __ph.setDebugRadius(true);
    __ph.setDebugCam(cam);
  }, s);
  await p.waitForTimeout(800);
  const r = await p.evaluate(([x, z]) => ({ range: __ph.NEAR_RANGE, inside: __ph.propsWithin(x, z, __ph.NEAR_RANGE) }), s.pos);
  console.log('SHOT', s.file, 'range', r.range, 'count', r.inside.length);
  console.log(JSON.stringify(r.inside));
  await p.screenshot({ path: `/workspace/prop-hunt/shots/${s.file}.png` });
}
await b.close();
