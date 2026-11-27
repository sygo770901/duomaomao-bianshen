import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const W = +(process.env.W || 1280), Hh = +(process.env.H || 800);
const p = await b.newPage({ viewport: { width: W, height: Hh } });
p.on('pageerror', e => console.log('[err]', e.message));
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text()); });
await p.goto('http://localhost:8765/' + (process.env.Q || ''));
await p.waitForFunction(() => window.__ph?.ready, null, { timeout: 60000 });
await p.evaluate(() => { document.getElementById('home').classList.add('hidden'); __ph.setMapLocal('office'); __ph.scene.fog = null; });
const shots = JSON.parse(process.env.SHOTS_JSON || '[]');
for (const [n, c] of shots) { await p.evaluate(c => __ph.setDebugCam(c), c); await p.waitForTimeout(700); await p.screenshot({ path: `/workspace/prop-hunt/shots/${n}.png` }); console.log('shot', n, JSON.stringify(await p.evaluate(() => __ph.renderInfo()))); }
await b.close();
