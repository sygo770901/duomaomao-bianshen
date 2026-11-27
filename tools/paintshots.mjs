// 顏料槍截圖：2 個桌機視窗，鬼連開幾槍，拍飛行中與留在家具/牆上的顏料
import { chromium } from 'playwright-core';
const URL = 'http://localhost:8765/'; const allPages = []; const chains = new Map(); const latest = new Map();
function relay(m) { for (const p of allPages) { if (m.type === 'data' && m.data?.t === 's') { const had = latest.has(p); latest.set(p, m); if (had) continue;
  chains.set(p, (chains.get(p) || Promise.resolve()).then(() => { const mm = latest.get(p); latest.delete(p); return p.evaluate(m => window.__localnetIn(m), mm); }).catch(() => { })); continue; }
  chains.set(p, (chains.get(p) || Promise.resolve()).then(() => p.evaluate(m => window.__localnetIn(m), m)).catch(() => { })); } }
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const mk = async (q) => { const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); await ctx.exposeBinding('__relay', (s, m) => relay(m)); const p = await ctx.newPage(); allPages.push(p); return p; };
const A = await mk(), B = await mk();
await A.goto(URL + '?net=local&hide=2&seek=90&seekerhost=1'); await A.waitForFunction(() => __ph.ready); await A.click('#createBtn'); await A.waitForSelector('#lobby:not(.hidden)');
const code = (await A.textContent('#roomCode')).trim();
await B.goto(URL + '?room=' + code + '&net=local&lowgfx=1'); await B.waitForFunction(() => __ph.ready); await B.click('#joinBtn');
await A.waitForFunction(() => __ph.state?.players.length === 2);
await A.click('#startBtn'); await A.waitForFunction(() => __ph.state?.phase === 'seek', null, { timeout: 15000 });
console.log('A role', await A.evaluate(() => __ph.me().role));
await A.evaluate(() => { __ph.teleport(-7.2, 3.6); __ph.lookAt(-5.2, 1.5); }); await A.waitForTimeout(500);
const targets = [['prop', 'loungeSofa'], ['prop', 'bookcaseClosedWide'], ['point', [-6.5, 0, 0.5]], ['prop', 'tableCoffee']];
for (const [k, t] of targets) {
  const sp = await A.evaluate(([k, t]) => k === 'prop' ? __ph.screenOf('prop', __ph.PROPS.findIndex(p => p[0] === t)) : __ph.screenOfPoint(...t), [k, t]);
  await A.mouse.click(sp.x, sp.y + (k === 'prop' ? 20 : 0)); await A.waitForTimeout(150);
  if (t === 'bookcaseClosedWide') await A.screenshot({ path: '../shots/v2-desktop-seeker-paint-flying.png' });
  await A.waitForTimeout(800);
}
await A.evaluate(() => { __ph.cam.pitch = .35; }); await A.waitForTimeout(400);
await A.screenshot({ path: '../shots/v2-desktop-seeker-splats.png' });
console.log('splats', await A.evaluate(() => __ph.splatCount()), 'hp', await A.evaluate(() => __ph.state.hp));
await b.close();
