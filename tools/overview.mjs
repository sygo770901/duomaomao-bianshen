import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('[err]', e.message));
await p.goto('http://localhost:8765/');
await p.waitForFunction(() => window.__ph?.ready, null, { timeout: 30000 });
await p.evaluate(() => { document.getElementById('home').classList.add('hidden'); });
for (const [n,c] of [['v5-ov-top',[[0,40,1],[0,0,0.9]]],['v5-room-living',[[-7.8,2.6,3.2],[-12.8,0.4,1.5]]],['v5-room-kitchen',[[-6.8,3.6,-3.2],[-6.8,0.7,-7.6]]],['v3-room-entrance',[[-9,5,-4],[-13,0,-7.5]]],['v3-room-balcony',[[-10,2.8,12.2],[-10,0.9,7.2]]],['v3-room-bath1',[[-1.5,6,-3],[-1.5,0,-7]]],['v3-room-smallbed',[[2.5,6,-2.8],[2.5,0,-7]]],['v3-room-laundry',[[6.5,6,-2.5],[6.5,0,-7.5]]],['v3-room-bath2',[[10.5,6.5,-2.2],[11.5,0,-7]]],['v3-room-midbed',[[0,6,0],[1.5,0,6]]],['v3-room-master',[[9.2,5.2,3.2],[9,0.6,8.0]]],['v3-room-hallway',[[-4,4,-1.5],[10,0,-1.5]]]]) {
  await p.evaluate(c => __ph.setDebugCam(c), c); await p.waitForTimeout(500); await p.screenshot({ path: `../shots/${n}.png` }); }
await b.close();
