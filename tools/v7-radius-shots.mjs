import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', e => console.log('[err]', e.message));
await p.goto('http://localhost:8765/?lowgfx=1');
await p.waitForFunction(() => window.__ph?.ready, null, { timeout: 60000 });
await p.evaluate(() => { document.getElementById('home').classList.add('hidden'); __ph.scene.fog = null; });

const shots = [
  // 客廳中央：沙發與茶几之間
  { file: 'v7-radius-home', map: 'home', pos: [-7.0, 1.5], cam: [[-7.0, 7.2, 5.4], [-7.0, 0, 1.5]] },
  // 辦公室開放座位走道（窗邊辦公桌與內側桌組之間）
  { file: 'v7-radius-office', map: 'office', pos: [-8.6, -4.2], cam: [[-8.6, 8.0, 0.6], [-8.6, 0, -4.2]] },
];
const report = {};
for (const s of shots) {
  await p.evaluate(({ map, pos, cam }) => {
    __ph.setMapLocal(map);
    __ph.teleport(pos[0], pos[1], 0);
    __ph.setDebugRadius(true);
    __ph.setDebugCam(cam);
  }, s);
  await p.waitForTimeout(800);
  const inside = await p.evaluate(([x, z]) => __ph.propsWithin(x, z, __ph.NEAR_RANGE), s.pos);
  report[s.file] = { pos: s.pos, inside };
  await p.screenshot({ path: `/workspace/prop-hunt/shots/${s.file}.png` });
  console.log('shot', s.file, 'inside', inside.length);
  console.log(JSON.stringify(inside));
}
await b.close();
