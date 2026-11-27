import { chromium, devices } from 'playwright-core';
const URL = process.env.URL || 'http://localhost:8765/';
const tag = process.argv[2] || 'before';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const hostCtx = await b.newContext({ viewport: { width: 1100, height: 700 } });
const mobCtx = await b.newContext({ ...devices['iPhone 13'], defaultBrowserType: undefined });
const relay = m => { for (const q of [host, mob]) q.evaluate(m => window.__localnetIn && window.__localnetIn(m), m).catch(() => {}); };
await hostCtx.exposeBinding('__relay', (s, m) => relay(m));
await mobCtx.exposeBinding('__relay', (s, m) => relay(m));
const host = await hostCtx.newPage(), mob = await mobCtx.newPage();
await host.goto(URL + '?net=local&lowgfx=1&hide=200&seek=200&seekerhost=1');
await host.waitForFunction(() => __ph?.ready, null, { timeout: 60000 });
await host.fill('#nameIn', '房主'); await host.click('#createBtn');
await host.waitForSelector('#lobby:not(.hidden)');
const code = (await host.textContent('#roomCode')).trim();
await mob.goto(URL + '?net=local&lowgfx=1');
await mob.waitForFunction(() => __ph?.ready, null, { timeout: 60000 });
await mob.fill('#nameIn', '手機'); await mob.fill('#codeIn', code); await mob.tap('#joinBtn');
await host.waitForFunction(() => __ph.state?.players?.length === 2, null, { timeout: 20000 });
await host.evaluate(() => __ph.setNextRolls('home'));
await host.click('#readyBtn'); await mob.tap('#readyBtn');
await host.waitForFunction(() => !document.getElementById('rollBtn').disabled, null, { timeout: 8000 });
await host.click('#rollBtn');
await host.waitForFunction(() => __ph.state?.dice?.status === 'done', null, { timeout: 20000 });
await host.waitForSelector('#startBtn:not([disabled])', { timeout: 15000 });
await host.click('#startBtn');
await mob.waitForFunction(() => __ph.state?.phase === 'hide', null, { timeout: 15000 });
await mob.evaluate(tag => {
    __ph.cam.forceIdeal = tag === 'before' ? 2.8 : 0;
    __ph.teleport(-6, 0, 0); __ph.lookAt(-10, 0, .35);
  }, tag);
await mob.waitForTimeout(600);
await mob.screenshot({ path: `../shots/v15-camera-${tag}.png` });
if (tag === 'before' || tag === 'after' || tag === 'open') {
  await mob.tap('#chatToggle');
  await mob.waitForTimeout(400);
  await mob.screenshot({ path: tag === 'before' ? '../shots/v15-chat-before.png' : '../shots/v15-chat-open.png' });
}
const info = await mob.evaluate(() => ({
  ideal: __ph.camIdealDist?.() ?? null,
  pull: __ph.camPullDist?.() ?? null,
  pos: __ph.camPos(),
  isTouch: document.body.classList.contains('touch'),
  chat: (() => { const b = document.getElementById('chatBox').getBoundingClientRect(); return { t: +b.top.toFixed(1), b: +b.bottom.toFixed(1), h: +b.height.toFixed(1), collapsed: b.height === 0 || document.getElementById('chatBox').classList.contains('collapsed') }; })(),
  vw: innerWidth, vh: innerHeight,
}));
console.log(JSON.stringify({ tag, info }));
await b.close();
