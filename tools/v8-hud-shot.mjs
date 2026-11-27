import { chromium, devices } from 'playwright-core';
const URL = 'http://localhost:8765/';
const allPages = []; const chains = new Map(); const latestState = new Map();
function relay(m) { for (const p of allPages) {
  if (m.type === 'data' && m.data?.t === 's') { const had = latestState.has(p); latestState.set(p, m); if (had) continue;
    const prev = chains.get(p) || Promise.resolve(); chains.set(p, prev.then(() => { const mm = latestState.get(p); latestState.delete(p); return p.evaluate(m => window.__localnetIn && window.__localnetIn(m), mm); }).catch(() => {})); continue; }
  const prev = chains.get(p) || Promise.resolve(); chains.set(p, prev.then(() => p.evaluate(m => window.__localnetIn && window.__localnetIn(m), m)).catch(() => {})); } }
function hits(a,b){ return a.width && b.width && !(a.right<=b.left || a.left>=b.right || a.bottom<=b.top || a.top>=b.bottom); }
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const mk = async (opts) => { const ctx = await b.newContext(opts); await ctx.exposeBinding('__relay', (src, m) => relay(m)); const p = await ctx.newPage(); allPages.push(p); return p; };
const A = await mk({ viewport: { width: 1280, height: 800 } });
const C = await mk({ ...devices['iPhone 13'], defaultBrowserType: undefined });
await A.goto(URL + '?net=local&lowgfx=1&hide=30&seek=80&seekerhost=1');
await A.waitForFunction(() => __ph.ready, null, { timeout: 60000 });
await A.fill('#nameIn', '鬼甲'); await A.click('#createBtn'); await A.waitForSelector('#lobby:not(.hidden)');
const code = (await A.textContent('#roomCode')).trim();
await C.goto(URL + '?net=local&lowgfx=1&room=' + code);
await C.waitForFunction(() => __ph.ready, null, { timeout: 60000 });
await C.fill('#nameIn', '躲藏乙'); await C.tap('#joinBtn');
await A.waitForFunction(() => __ph.state?.players?.length === 2, null, { timeout: 20000 });
await A.click('#startBtn');
await A.waitForFunction(() => __ph.state?.phase === 'hide', null, { timeout: 15000 });
// put hider close immediately so badge is on while start toasts are up, then jump to seek (「鬼出動了」)
await A.evaluate(() => { __ph.teleport(-7.0, 1.5, 0); __ph.lookAt(-7.0, 4.5, .4); });
await C.evaluate(() => { __ph.teleport(-7.0, 4.5, 0); });
await A.evaluate(() => __ph.skipToSeekRemaining(70000));
await A.waitForFunction(() => __ph.state?.phase === 'seek' && __ph.nearHintVisible(), null, { timeout: 8000 });
await A.waitForTimeout(400);
async function report(p, name) {
  const info = await p.evaluate(() => {
    const hit = (a, b) => a.width && b.width && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    const box = id => document.getElementById(id)?.getBoundingClientRect();
    const badge = box('nearHint'), role = box('role'), topbar = box('topbar');
    const toasts = [...document.querySelectorAll('#toasts .toast')].map(t => ({ t: t.textContent, r: t.getBoundingClientRect() }));
    const rows = [];
    if (badge && !document.getElementById('nearHint').classList.contains('hidden')) {
      if (role) rows.push(['badge-role', hit(badge, role)]);
      if (topbar) rows.push(['badge-topbar', hit(badge, topbar)]);
      for (const t of toasts) rows.push(['badge-toast '+t.t, hit(badge, t.r)]);
    }
    if (role && topbar) rows.push(['role-topbar', hit(role, topbar)]);
    for (const t of toasts) {
      if (role) rows.push(['role-toast '+t.t, hit(role, t.r)]);
      if (topbar) rows.push(['topbar-toast '+t.t, hit(topbar, t.r)]);
    }
    return { toasts: toasts.map(t => t.t), badgeOn: !document.getElementById('nearHint').classList.contains('hidden'), rows };
  });
  console.log(name, JSON.stringify(info));
  return info;
}
await A.screenshot({ path: '/workspace/prop-hunt/shots/v8-near-hint.png' });
await C.screenshot({ path: '/workspace/prop-hunt/shots/v8-near-hint-hider-mobile.png' });
const desk = await report(A, 'desktop-seeker');
const mob = await report(C, 'mobile-hider');
const bad = [...desk.rows, ...mob.rows].filter(r => r[1]);
console.log(bad.length ? 'OVERLAP '+JSON.stringify(bad) : 'NO_OVERLAP');
await A.evaluate(() => __ph.sbDeleteRoom());
await b.close();
