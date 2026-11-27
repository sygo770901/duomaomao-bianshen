import { chromium, devices } from 'playwright-core';
const URL = 'http://localhost:8765/';
const QS = 'net=local&lowgfx=1&hide=4&seek=80&seekerhost=1';
const SH = process.env.SHOTS || '/workspace/prop-hunt/shots/';

function makeRelay() {
  const allPages = []; const chains = new Map(); const latestState = new Map();
  function relay(m) {
    for (const p of allPages) {
      if (m.type === 'data' && m.data?.t === 's') {
        const had = latestState.has(p); latestState.set(p, m); if (had) continue;
        const prev = chains.get(p) || Promise.resolve();
        chains.set(p, prev.then(() => { const mm = latestState.get(p); latestState.delete(p); return p.evaluate(m => window.__localnetIn && window.__localnetIn(m), mm); }).catch(() => {}));
        continue;
      }
      const prev = chains.get(p) || Promise.resolve();
      chains.set(p, prev.then(() => p.evaluate(m => window.__localnetIn && window.__localnetIn(m), m)).catch(() => {}));
    }
  }
  return { allPages, relay };
}

const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const { allPages, relay } = makeRelay();
const mk = async (opts) => { const ctx = await b.newContext(opts); await ctx.exposeBinding('__relay', (src, m) => relay(m)); const p = await ctx.newPage(); allPages.push(p); return p; };

const A = await mk({ viewport: { width: 1280, height: 800 } });
const H = await mk({ viewport: { width: 800, height: 600 } });
await A.goto(URL + '?' + QS);
await A.waitForFunction(() => __ph.ready, null, { timeout: 60000 });
await A.fill('#nameIn', '鬼甲'); await A.click('#createBtn');
await A.waitForSelector('#lobby:not(.hidden)');
const code = (await A.textContent('#roomCode')).trim();
await H.goto(URL + '?net=local&lowgfx=1&room=' + code);
await H.waitForFunction(() => __ph.ready, null, { timeout: 60000 });
await H.fill('#nameIn', '躲藏乙'); await H.click('#joinBtn');
await A.waitForFunction(() => __ph.state?.players?.length === 2, null, { timeout: 20000 });
await A.click('#startBtn');
await A.waitForFunction(() => __ph.state?.phase === 'hide', null, { timeout: 15000 });
await A.evaluate(() => { __ph.teleport(-7.0, 1.5, 0); });
await A.evaluate(() => __ph.skipToSeekRemaining(70000));
await A.waitForFunction(() => __ph.state?.phase === 'seek', null, { timeout: 8000 });

async function shot(dist, file, expectTier) {
  const z = 1.5 + dist;
  await H.evaluate(z => { __ph.teleport(-7.0, z, 0); }, z);
  await A.waitForFunction(({ z, expectTier }) => {
    const q = __ph.state.players.find(p => p.role === 'hider' && p.alive);
    return q && Math.hypot(q.x + 7, q.z - z) < .25 && __ph.nearHintTier() === expectTier;
  }, { z, expectTier }, { timeout: 8000 });
  await A.evaluate(z => { __ph.lookAt(-7.0, z, .4); }, z);
  await A.evaluate(() => { document.querySelectorAll('#toasts .toast').forEach(d => d.remove()); });
  await A.waitForTimeout(450);
  const info = await A.evaluate(() => ({ vis: __ph.nearHintVisible(), tier: __ph.nearHintTier(), text: __ph.nearHintText() }));
  console.log(file, info);
  await A.screenshot({ path: SH + file });
}

await shot(4.0, 'v9-near-5m.png', 5);
await shot(2.0, 'v9-near-3m.png', 3);
await shot(0.8, 'v9-near-1m.png', 1);
await A.evaluate(() => __ph.sbDeleteRoom());
await b.close();

// mobile seeker at 1 m, with start toasts, overlap check
const b2 = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const r2 = makeRelay();
const mk2 = async (opts) => { const ctx = await b2.newContext(opts); await ctx.exposeBinding('__relay', (src, m) => r2.relay(m)); const p = await ctx.newPage(); r2.allPages.push(p); return p; };
const MS = await mk2({ ...devices['iPhone 13'], defaultBrowserType: undefined });
const HD = await mk2({ viewport: { width: 800, height: 600 } });
await MS.goto(URL + '?' + QS);
await MS.waitForFunction(() => __ph.ready, null, { timeout: 60000 });
await MS.fill('#nameIn', '鬼甲'); await MS.tap('#createBtn');
await MS.waitForSelector('#lobby:not(.hidden)');
const code2 = (await MS.textContent('#roomCode')).trim();
await HD.goto(URL + '?net=local&lowgfx=1&room=' + code2);
await HD.waitForFunction(() => __ph.ready, null, { timeout: 60000 });
await HD.fill('#nameIn', '躲藏乙'); await HD.click('#joinBtn');
await MS.waitForFunction(() => __ph.state?.players?.length === 2, null, { timeout: 20000 });
await MS.tap('#startBtn');
await MS.waitForFunction(() => __ph.state?.phase === 'hide', null, { timeout: 15000 });
await MS.evaluate(() => { __ph.teleport(-7.0, 1.5, 0); __ph.lookAt(-7.0, 2.3, .35); });
await HD.evaluate(() => { __ph.teleport(-7.0, 2.3, 0); });
await MS.evaluate(() => __ph.skipToSeekRemaining(70000));
await MS.waitForFunction(() => __ph.state?.phase === 'seek' && __ph.nearHintTier() === 1, null, { timeout: 8000 });
await MS.evaluate(() => {
  const box = document.getElementById('toasts');
  box.querySelectorAll('.toast').forEach(d => d.remove());
  for (const t of ['你是鬼！先閉眼 30 秒', '👀 鬼出動了！']) {
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; box.appendChild(d);
  }
});
await MS.waitForTimeout(350);
const ov = await MS.evaluate(() => {
  const hit = (a, b) => a.width && b.width && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  const box = id => document.getElementById(id)?.getBoundingClientRect();
  const badge = box('nearHint'), role = box('role'), topbar = box('topbar');
  const toasts = [...document.querySelectorAll('#toasts .toast')].map(t => ({ t: t.textContent, r: t.getBoundingClientRect() }));
  const rows = [];
  if (badge && role) rows.push(['badge-role', hit(badge, role)]);
  if (badge && topbar) rows.push(['badge-topbar', hit(badge, topbar)]);
  if (role && topbar) rows.push(['role-topbar', hit(role, topbar)]);
  for (const t of toasts) {
    if (badge) rows.push(['badge-toast:' + t.t, hit(badge, t.r)]);
    if (role) rows.push(['role-toast:' + t.t, hit(role, t.r)]);
    if (topbar) rows.push(['topbar-toast:' + t.t, hit(topbar, t.r)]);
  }
  return { vis: !document.getElementById('nearHint').classList.contains('hidden'), text: document.getElementById('nearHint')?.textContent, tier: __ph.nearHintTier(), rows };
});
console.log('mobile-1m', JSON.stringify(ov));
console.log(ov.rows.some(r => r[1]) ? 'OVERLAP' : 'NO_OVERLAP');
await MS.screenshot({ path: SH + 'v9-near-1m-mobile.png' });
await MS.evaluate(() => __ph.sbDeleteRoom());
await b2.close();
