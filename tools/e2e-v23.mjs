// v23：每回合家具在原房間內自動洗牌。
// 檢查：兩位玩家座標一致、換一局擺法不同、每件還在自己的房間、地面家具不重疊、出生點沒被堵住。
import { chromium } from 'playwright-core';
const URL = process.env.URL || 'http://localhost:8765/';
const allPages = []; const chains = new Map(); const latestState = new Map();
function relay(m) { for (const p of allPages) {
  if (m.type === 'data' && m.data?.t === 's') { const had = latestState.has(p); latestState.set(p, m); if (had) continue;
    const prev = chains.get(p) || Promise.resolve(); chains.set(p, prev.then(() => { const mm = latestState.get(p); latestState.delete(p); return p.evaluate(m => window.__localnetIn && window.__localnetIn(m), mm); }).catch(() => { })); continue; }
  const prev = chains.get(p) || Promise.resolve(); chains.set(p, prev.then(() => p.evaluate(m => window.__localnetIn && window.__localnetIn(m), m)).catch(() => { })); } }
const results = []; const ok = (name, cond, info = '') => { results.push([cond ? 'PASS' : 'FAIL', name, info]); console.log(cond ? 'PASS' : 'FAIL', name, info); };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
const mk = async name => { const ctx = await b.newContext({ viewport: { width: 1100, height: 700 } }); await ctx.exposeBinding('__relay', (src, m) => relay(m)); const p = await ctx.newPage(); allPages.push(p); p.on('pageerror', e => errs.push(name + ': ' + e.message)); return p; };
const A = await mk('A'), B = await mk('B');
const waitFor = (p, fn, arg, t = 20000) => p.waitForFunction(fn, arg, { timeout: t });

function foot(x, z, ry, sz) {
  const a = Math.abs(ry || 0) * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const hx = (sz[0] * c + sz[2] * s) / 2, hz = (sz[0] * s + sz[2] * c) / 2;
  return { x1: x - hx, x2: x + hx, z1: z - hz, z2: z + hz };
}
function overlapArea(a, b) {
  const w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const d = Math.min(a.z2, b.z2) - Math.max(a.z1, b.z1);
  return w > 0 && d > 0 ? w * d : 0;
}
function audit(snap, label) {
  const badRoom = [], badOverlap = [], badFixed = [];
  let moved = 0;
  for (const r of snap.rows) {
    const d = Math.hypot(r.x - r.ox, r.z - r.oz);
    if (d > 0.4) moved++;
    if (r.kind === 'wall' || r.kind === 'out' || r.kind === 'fixed') {
      if (d > 0.08) badFixed.push(`${r.name}#${r.i} d=${d.toFixed(2)}`);
    }
    if (r.kind === 'rider') {
      const s = snap.rows.find(q => q.i === r.support);
      if (s && Math.hypot((r.x - r.ox) - (s.x - s.ox), (r.z - r.oz) - (s.z - s.oz)) > 0.08) badRoom.push(`rider ${r.name}#${r.i} left its support`);
    } else if (r.room) {
      const m = 0.55;
      if (r.x < r.room.x1 - m || r.x > r.room.x2 + m || r.z < r.room.z1 - m || r.z > r.room.z2 + m) badRoom.push(`${r.kind} ${r.name}#${r.i} (${r.x.toFixed(2)},${r.z.toFixed(2)}) ${r.room.id}`);
    } else if (d > 0.08) badRoom.push(`no-room ${r.name}#${r.i} moved ${d.toFixed(2)}`);
  }
  const floor = snap.rows.filter(r => r.kind !== 'rider' && r.kind !== 'wall');
  for (let i = 0; i < floor.length; i++) for (let j = i + 1; j < floor.length; j++) {
    const a = floor[i], b = floor[j];
    const live = overlapArea(foot(a.x, a.z, a.ry, a.sz), foot(b.x, b.z, b.ry, b.sz));
    const orig = overlapArea(foot(a.ox, a.oz, a.ry, a.sz), foot(b.ox, b.oz, b.ry, b.sz));
    if (live > 0.05 && live > orig + 0.03) badOverlap.push(`${a.name}#${a.i} x ${b.name}#${b.i} ${live.toFixed(3)}`);
  }
  ok(`${label} 兩人種子相同且不是 0`, snap.lay > 0, 'lay=' + snap.lay);
  ok(`${label} 至少有 4 件家具離開原位`, moved >= 4, 'moved=' + moved + '/' + snap.rows.length);
  ok(`${label} 固定／牆上／走道的家具留在原地`, badFixed.length === 0, badFixed.slice(0, 8).join(' | '));
  ok(`${label} 每件家具還在自己的房間`, badRoom.length === 0, badRoom.slice(0, 8).join(' | '));
  ok(`${label} 地面家具沒有新的重疊`, badOverlap.length === 0, badOverlap.slice(0, 6).join(' | '));
  ok(`${label} 出生點沒被家具堵住`, snap.spawnFree.every(Boolean), JSON.stringify(snap.spawnFree));
  return moved;
}

const snapExpr = () => {
  const map = __ph.curMap, rows = [];
  for (let i = 0; i < __ph.PROPS.length; i++) {
    if (__ph.propMap(i) !== map) continue;
    const pr = __ph.PROPS[i], pos = __ph.propPos(i), sz = __ph.modelSize(pr[0]) || [.4, .5, .4];
    const meta = __ph.layoutClass(i);
    const room = meta.room ? { id: meta.room.id, x1: +meta.room.x1.toFixed(3), x2: +meta.room.x2.toFixed(3), z1: +meta.room.z1.toFixed(3), z2: +meta.room.z2.toFixed(3) } : null;
    rows.push({ i, name: pr[0], ox: pr[1], oz: pr[2], ry: pr[3], x: pos[0], z: pos[2], sz, kind: meta.kind, room, support: meta.support });
  }
  const M = __ph.MAPS[map];
  const spawns = [...(M.hiders || []), M.seeker].filter(p => p && p.length >= 2);
  const spawnFree = spawns.map(([x, z]) => { const q = __ph.collideAt(x, z, .33, 0); return Math.hypot(q[0] - x, q[1] - z) < .02; });
  return { map, lay: __ph.state.lay | 0, rows, spawnFree };
};

await A.goto(URL + '?net=local&lowgfx=1&hide=8&seek=8&seekerhost=1');
await B.goto(URL + '?net=local&lowgfx=1');
await waitFor(A, () => __ph.ready, null, 60000);
await waitFor(B, () => __ph.ready, null, 60000);
await A.fill('#nameIn', '房主'); await A.click('#createBtn');
await A.waitForSelector('#lobby:not(.hidden)', { timeout: 20000 });
const code = (await A.textContent('#roomCode')).trim();
await B.fill('#nameIn', '客人'); await B.fill('#codeIn', code); await B.click('#joinBtn');
await waitFor(A, () => __ph.state?.players?.length === 2, null, 20000);

async function playRound(map) {
  if (map !== 'home') {
    await A.click(`#mapPick .mapBtn[data-map="${map}"]`);
    await waitFor(A, m => __ph.curMap === m && __ph.state?.map === m, map, 8000);
    await waitFor(B, m => __ph.curMap === m, map, 8000);
  }
  await A.click('#startBtn');
  await waitFor(A, () => __ph.state?.phase === 'hide', null, 15000);
  await waitFor(B, () => __ph.state?.phase === 'hide', null, 15000);
  await A.waitForTimeout(500);
  const sa = await A.evaluate(snapExpr), sb = await B.evaluate(snapExpr);
  let disagree = 0;
  for (let i = 0; i < sa.rows.length; i++) {
    const a = sa.rows[i], b = sb.rows.find(r => r.i === a.i);
    if (!b || Math.hypot(a.x - b.x, a.z - b.z) > 0.03) disagree++;
  }
  ok(`${map} 兩位玩家看到同一張擺法`, disagree === 0 && sa.lay === sb.lay, `disagree=${disagree} lay=${sa.lay}/${sb.lay}`);
  audit(sa, map);
  await A.evaluate(() => __ph.skipToSeekRemaining(400));
  await waitFor(A, () => __ph.state?.phase === 'lobby', null, 20000);
  await waitFor(B, () => __ph.state?.phase === 'lobby', null, 20000);
  return sa;
}

for (const map of ['home', 'office', 'lucky']) {
  const first = await playRound(map);
  const second = await playRound(map);
  let diff = 0;
  for (const a of first.rows) {
    const b = second.rows.find(r => r.i === a.i);
    if (b && Math.hypot(a.x - b.x, a.z - b.z) > 0.4) diff++;
  }
  ok(`${map} 下一局擺法不一樣`, diff >= 4 && first.lay !== second.lay, `diff=${diff} lay ${first.lay}→${second.lay}`);
}

ok('沒有頁面錯誤', errs.length === 0, errs.join(' | '));
const fail = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - fail} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
