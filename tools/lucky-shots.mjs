// 福貓辦公室截圖：node lucky-shots.mjs [lowgfx] [name=[[cam],[look]] ...]
import { chromium } from 'playwright-core';
const low = process.argv.includes('lowgfx');
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 800 } });
p.on('pageerror', e => console.log('[err]', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text()); });
await p.goto('http://localhost:8765/' + (low ? '?lowgfx=1' : ''));
await p.waitForFunction(() => window.__ph?.ready, null, { timeout: 60000 });
await p.evaluate(() => { document.getElementById('home').classList.add('hidden'); __ph.setMapLocal('lucky'); __ph.scene.fog = null; });
const shots = process.argv.slice(2).filter(a => a.includes('=')).map(a => { const i = a.indexOf('='); return [a.slice(0, i), JSON.parse(a.slice(i + 1))]; });
if (!shots.length) shots.push(['v11-ov-top', [[0, 34, 2.2], [0, 0, 2.1]]]);
for (const [n, c] of shots) { await p.evaluate(c => __ph.setDebugCam(c), c); await p.waitForTimeout(700); await p.screenshot({ path: `../shots/${n}.png` }); console.log('shot', n, JSON.stringify(await p.evaluate(() => __ph.renderInfo()))); }
console.log('lucky props', await p.evaluate(() => __ph.LUCKY_N), 'colliders', await p.evaluate(() => __ph.MAPS.lucky.colliders.length));
await b.close();
