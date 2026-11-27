import { chromium } from 'playwright-core';
const URL = 'http://localhost:8765/';
const allPages = []; const chains = new Map(); const latestState = new Map();
function relay(m) { for (const p of allPages) {
  if (m.type === 'data' && m.data?.t === 's') { const had = latestState.has(p); latestState.set(p, m); if (had) continue;
    const prev = chains.get(p) || Promise.resolve(); chains.set(p, prev.then(() => { const mm = latestState.get(p); latestState.delete(p); return p.evaluate(m => window.__localnetIn && window.__localnetIn(m), mm); }).catch(() => {})); continue; }
  const prev = chains.get(p) || Promise.resolve(); chains.set(p, prev.then(() => p.evaluate(m => window.__localnetIn && window.__localnetIn(m), m)).catch(() => {})); } }
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const mk = async (name, opts) => { const ctx = await b.newContext(opts); await ctx.exposeBinding('__relay', (src, m) => relay(m)); const p = await ctx.newPage(); allPages.push(p); return p; };
const A = await mk('A', { viewport: { width: 1280, height: 800 } });
const B = await mk('B', { viewport: { width: 1280, height: 800 } });
const qs = '?net=local&lowgfx=1&hide=2&seek=80&seekerhost=1';
await A.goto(URL + qs); await A.waitForFunction(() => __ph.ready, null, { timeout: 60000 });
await A.fill('#nameIn', '鬼甲'); await A.click('#createBtn'); await A.waitForSelector('#lobby:not(.hidden)');
const code = (await A.textContent('#roomCode')).trim();
await B.goto(URL + '?net=local&lowgfx=1'); await B.waitForFunction(() => __ph.ready, null, { timeout: 60000 });
await B.fill('#nameIn', '躲藏乙'); await B.fill('#codeIn', code); await B.click('#joinBtn');
await A.waitForFunction(() => __ph.state?.players?.length === 2, null, { timeout: 20000 });
await A.click('#startBtn');
await A.waitForFunction(() => __ph.state?.phase === 'hide', null, { timeout: 15000 });
await A.evaluate(() => __ph.skipToSeekRemaining(70000));
await A.waitForFunction(() => __ph.state?.phase === 'seek', null, { timeout: 8000 });
await A.evaluate(() => { __ph.teleport(-7.0, 1.5, 0); __ph.lookAt(-7.0, 3.0, .4); });
await B.evaluate(() => { __ph.teleport(-7.0, 3.0, 0); });
await A.waitForFunction(() => { const q = __ph.state.players.find(p => p.role === 'hider' && p.alive); return q && Math.hypot(q.x + 7, q.z - 3) < .3 && __ph.nearHintVisible(); }, null, { timeout: 6000 });
await A.waitForTimeout(300);
await A.screenshot({ path: '/workspace/prop-hunt/shots/v7-near-hint.png' });
await B.screenshot({ path: '/workspace/prop-hunt/shots/v7-near-hint-hider.png' });
console.log('near', await A.evaluate(() => __ph.nearHintVisible()), 'hider', await B.evaluate(() => __ph.nearHintVisible()));
await A.evaluate(() => __ph.sbDeleteRoom());
await b.close();
