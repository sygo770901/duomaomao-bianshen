import { chromium } from 'playwright-core';
const URL = process.env.URL || 'http://localhost:8765/';
const SH = process.env.SHOTS || '../shots/';
const allPages = []; const chains = new Map(); const latestState = new Map();
function relay(m) {
  for (const pg of allPages) {
    if (m.type === 'data' && m.data?.t === 's') {
      const had = latestState.has(pg); latestState.set(pg, m); if (had) continue;
      const prev = chains.get(pg) || Promise.resolve();
      chains.set(pg, prev.then(() => { const mm = latestState.get(pg); latestState.delete(pg); return pg.evaluate(m => window.__localnetIn && window.__localnetIn(m), mm); }).catch(() => {}));
      continue;
    }
    const prev = chains.get(pg) || Promise.resolve();
    chains.set(pg, prev.then(() => pg.evaluate(m => window.__localnetIn && window.__localnetIn(m), m)).catch(() => {}));
  }
}
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.exposeBinding('__relay', (s, m) => relay(m));
const p = await ctx.newPage(); allPages.push(p);
await p.goto(URL + '?net=local&lowgfx=1&seekerhost=1&hide=8&seek=60', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForFunction(() => window.__ph?.ready, null, { timeout: 90000 });
await p.fill('#nameIn', '椅座'); await p.click('#createBtn');
await p.waitForSelector('#lobby:not(.hidden)', { timeout: 20000 });
await p.evaluate(() => __ph.addTestPlayers([{ name: '陪打', color: '#7fe0d8', avatar: '🐧' }]));
await p.waitForFunction(() => __ph.state?.players?.length >= 2, null, { timeout: 8000 });
await p.click('#startBtn');
await p.waitForFunction(() => __ph.state?.phase === 'hide' || __ph.state?.phase === 'seek', null, { timeout: 15000 });
await p.evaluate(() => { if (__ph.state.phase === 'hide') __ph.skipToSeekRemaining(90000); });
await p.waitForFunction(() => __ph.state?.phase === 'seek', null, { timeout: 8000 });
const info = await p.evaluate(() => {
  const i = __ph.PROPS.findIndex((pr, k) => k < __ph.HOME_PROP_N && pr[0] === 'chairDesk');
  const cols = __ph.propCols(i);
  const back = cols.slice().sort((a, b) => b.y2 - a.y2)[0];
  const seat = cols.filter(c => c !== back).sort((a, b) => (b.x2 - b.x1) * (b.z2 - b.z1) - (a.x2 - a.x1) * (a.z2 - a.z1))[0];
  const scx = (seat.x1 + seat.x2) / 2, scz = (seat.z1 + seat.z2) / 2;
  const bcx = (back.x1 + back.x2) / 2, bcz = (back.z1 + back.z2) / 2;
  const away = Math.hypot(scx - bcx, scz - bcz) || 1;
  const sx = scx + (scx - bcx) / away * 0.08;
  const sz = scz + (scz - bcz) / away * 0.08;
  __ph.teleport(sx, sz, seat.y2 + 0.4);
  return { i, sx, sz, seatY: seat.y2, backY: back.y2, bcx, bcz };
});
await p.waitForTimeout(1000);
const y = await p.evaluate(() => __ph.local.y);
console.log('stand y', y, info);
await p.evaluate(([info, y]) => {
  const { sx, sz, seatY, bcx, bcz } = info;
  __ph.local.y = Math.max(__ph.local.y, seatY);
  __ph.local.grounded = true; __ph.local.vy = 0;
  // 從斜側前方俯看：椅背在後、腳踩在座面上
  const vx = sx - bcx, vz = sz - bcz, vl = Math.hypot(vx, vz) || 1;
  const fx = vx / vl, fz = vz / vl;
  const px = -fz, pz = fx;
  const camX = sx + fx * 1.55 + px * 1.15;
  const camY = seatY + 1.35;
  const camZ = sz + fz * 1.55 + pz * 1.15;
  __ph.setDebugCam([[camX, camY, camZ], [sx, seatY + 0.55, sz]]);
  document.getElementById('chatBox')?.classList.add('collapsed');
  document.getElementById('chatFeed')?.classList.add('hidden');
  document.getElementById('toasts') && (document.getElementById('toasts').innerHTML = '');
  const hint = document.getElementById('hint'); if (hint) hint.style.visibility = 'hidden';
}, [info, y]);
await p.waitForTimeout(400);
await p.screenshot({ path: SH + 'v10-chair-seat.png' });
console.log('wrote', SH + 'v10-chair-seat.png', 'y=' + y);
await p.evaluate(() => __ph.sbDeleteRoom());
await b.close();
