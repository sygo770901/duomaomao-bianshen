// v18 福貓辦公室：中段／右側依實地照片修正（草皮牆、Meeting Room、挖寶網、影印機、中島）
import { chromium, devices } from 'playwright-core';
const URL = process.env.URL || 'http://localhost:8765/';
const NET = 'net=local&lowgfx=1';
const qs = q => '?' + [q, NET].filter(Boolean).join('&');
const allPages = []; const chains = new Map(); const latestState = new Map();
function relay(m) { for (const p of allPages) {
  if (m.type === 'data' && m.data?.t === 's') { const had = latestState.has(p); latestState.set(p, m); if (had) continue;
    const prev = chains.get(p) || Promise.resolve(); chains.set(p, prev.then(() => { const mm = latestState.get(p); latestState.delete(p); return p.evaluate(m => window.__localnetIn && window.__localnetIn(m), mm); }).catch(() => { })); continue; }
  const prev = chains.get(p) || Promise.resolve(); chains.set(p, prev.then(() => p.evaluate(m => window.__localnetIn && window.__localnetIn(m), m)).catch(() => { })); } }
const results = []; const ok = (name, cond, info = '') => { results.push([cond ? 'PASS' : 'FAIL', name, info]); console.log(cond ? 'PASS' : 'FAIL', name, info); };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
const mk = async (name, opts) => { const ctx = await b.newContext(opts); await ctx.exposeBinding('__relay', (src, m) => relay(m)); const p = await ctx.newPage(); allPages.push(p); p._n = name;
  p.on('pageerror', e => { errs.push(name + ': ' + e.message); console.log(`[${name} err]`, e.message); }); return p; };
const A = await mk('A-host', { viewport: { width: 1280, height: 800 } });
const B = await mk('B', { viewport: { width: 1280, height: 800 } });
const pages = [A, B];
const st = p => p.evaluate(() => { const s = __ph.state; return s && { map: s.map, phase: s.phase, hp: s.hp, winner: s.winner, players: s.players }; });
const myId = p => p.evaluate(() => __ph.net.myId);
const waitFor = (p, fn, arg, t = 20000) => p.waitForFunction(fn, arg, { timeout: t });
const allWait = (fn, arg, t = 8000) => Promise.all(pages.map(p => waitFor(p, fn, arg, t)));

await A.goto(URL + qs('hide=12&seekerhost=1')); await waitFor(A, () => __ph.ready, null, 60000);
await A.fill('#nameIn', '房主A'); await A.click('#createBtn'); await A.waitForSelector('#lobby:not(.hidden)', { timeout: 20000 });
const code = (await A.textContent('#roomCode')).trim();
await B.goto(URL + qs('')); await waitFor(B, () => __ph.ready, null, 60000); await B.fill('#nameIn', 'B'); await B.fill('#codeIn', code); await B.click('#joinBtn');
await allWait(() => __ph.state?.players?.length === 2, null, 20000);

await A.click('#mapPick .mapBtn[data-map="lucky"]');
await allWait(() => __ph.curMap === 'lucky' && __ph.mapGroupVisible('lucky'));
ok('選福貓辦公室同步', (await Promise.all(pages.map(p => p.evaluate(() => document.querySelector('#mapPick .mapBtn.sel')?.dataset.map)))).every(v => v === 'lucky'));

const info = await A.evaluate(() => {
  const rooms = __ph.LUCKY_ROOMS.map(r => r.id + ':' + r.name + ':' + (r.sure ? '1' : '0'));
  const L = __ph.LUCKY_START, N = __ph.LUCKY_N, P = __ph.PROPS;
  const names = P.slice(L, L + N).map(p => p[0]);
  const count = n => names.filter(x => x === n).length;
  const K = .066, X = px => (px - 250) * K, Z = py => (py - 209) * K;
  const near = (n, px, py, r = .45) => P.slice(L, L + N).some(p => p[0] === n && Math.hypot(p[1] - X(px), p[2] - Z(py)) < r);
  return { rooms, N, count, near: {
    copier: near('copier', 206, 130),
    cert: near('certFrame', 197, 128, .8),
    treasure: near('treasureCounter', 284, 248),
    geodeGrass: near('geode', 448, 119.2),
    geodeMeet: near('geode', 217.5, 268),
    whiteDesk: near('whiteDesk', 462, 140),
    ovalMeet: near('ovalTable', 246, 280),
    statue: near('luckyCatStatue', 413.5, 262),
    island: near('kitchenIsland', 371.5, 267.5),
    cat: near('officeCat', 292, 210),
    pendant: count('goldPendant') >= 4,
    bistroGone: !P.slice(L, L + N).some(p => p[0] === 'bistroChair' && Math.hypot(p[1] - X(444), p[2] - Z(198)) < 1.2),
  }, count: { goldPendant: count('goldPendant'), copier: count('copier'), whiteDesk: count('whiteDesk'), treasureCounter: count('treasureCounter') } };
});
const roomMap = Object.fromEntries(info.rooms.map(s => { const [id, name, sure] = s.split(':'); return [id, { name, sure }]; }));
ok('Meeting Room 已改名且標確定', roomMap.party?.name === 'Meeting Room' && roomMap.party?.sure === '1', JSON.stringify(roomMap.party));
ok('草皮辦公區已改名且標確定', roomMap.small?.name === '草皮辦公區' && roomMap.small?.sure === '1', JSON.stringify(roomMap.small));
ok('福貓挖寶網房間名', roomMap.cafe?.name === '福貓挖寶網' && roomMap.cafe?.sure === '1', JSON.stringify(roomMap.cafe));
ok('影印區改到窗邊西端並標確定', roomMap.copy?.name === '影印區' && roomMap.copy?.sure === '1', JSON.stringify(roomMap.copy));
ok('影印機在老闆東牆外側', info.near.copier);
ok('證書掛在老闆東牆辦公區側', info.near.cert);
ok('福貓挖寶網櫃台在走廊', info.near.treasure);
ok('紫晶洞在草皮辦公區窗邊', info.near.geodeGrass);
ok('Meeting Room 內不再放紫晶洞', !info.near.geodeMeet);
ok('草皮辦公區有白色書桌', info.near.whiteDesk);
ok('Meeting Room 有圓桌', info.near.ovalMeet);
ok('福貓雕像仍在茶水間右側', info.near.statue);
ok('中島仍在入口／茶水間', info.near.island);
ok('辦公室貓在開放辦公區', info.near.cat);
ok('有金色吊燈可變身', info.near.pendant, 'n=' + info.count.goldPendant);
ok('舊咖啡角 X 背椅已撤', info.near.bistroGone);

const K = .066, X = px => (px - 250) * K, Z = py => (py - 209) * K;
const freeAt = (x, z) => A.evaluate(([x, z]) => { const q = __ph.collideAt(x, z); return Math.hypot(q[0] - x, q[1] - z) < .01; }, [x, z]);
const blocked = (x, z) => A.evaluate(([x, z]) => { const q = __ph.collideAt(x, z); return Math.hypot(q[0] - x, q[1] - z) > .05; }, [x, z]);
ok('草皮牆會擋人（西牆中段）', await blocked(X(434), Z(130)));
ok('草皮斜牆開口可進出', await freeAt(X(445), Z(146)));
ok('入口直走 x=305 在挖寶網隔間旁仍可通', await freeAt(X(305), Z(236)));
ok('LUXCAT 玻璃隔間會擋人', await blocked(X(286), Z(236)));
ok('Meeting Room 門口可過', await freeAt(X(266.1), Z(286.6)));
const spawnFree = [];
const M = await A.evaluate(() => ({ hiders: __ph.MAPS.lucky.hiders, seekers: __ph.MAPS.lucky.seekers, lobbyAt: __ph.MAPS.lucky.lobbyAt, bounds: __ph.MAPS.lucky.bounds }));
for (const [x, z] of [...M.hiders, ...M.seekers, M.lobbyAt]) spawnFree.push(await freeAt(x, z));
ok('出生點／大廳位置都不卡', spawnFree.every(Boolean), JSON.stringify(spawnFree));

await A.click('#startBtn'); await allWait(() => __ph.state?.phase === 'hide', null, 15000);
ok('開局載入福貓辦公室', (await st(A)).map === 'lucky');
const PROPS = await A.evaluate(() => __ph.PROPS);
const L = await A.evaluate(() => __ph.LUCKY_START);
const lid = (name, px, py) => PROPS.findIndex((p, i) => i >= L && p[0] === name && Math.hypot(p[1] - X(px), p[2] - Z(py)) < .45);
const tid = lid('treasureCounter', 284, 248);
ok('找得到挖寶網櫃台', tid >= L, String(tid));
const tp = PROPS[tid];
await B.evaluate(([x, z, lx, lz]) => { __ph.teleport(x, z, 0); __ph.lookAt(lx, lz, .3); }, [tp[1], tp[2] + 1.6, tp[1], tp[2]]);
await B.waitForTimeout(400); await B.evaluate(i => __ph.setTarget(i), tid); await B.keyboard.press('KeyF'); await B.waitForTimeout(600);
const idB = await myId(B);
ok('可變身成福貓挖寶網櫃台', (await st(A)).players.find(q => q.id === idB).prop === tid);

const fail = results.filter(r => r[0] === 'FAIL').length;
console.log(`\ne2e-v18 ${results.length - fail}/${results.length}  (fail=${fail})`);
if (errs.length) console.log('page errors', errs);
await b.close();
process.exit(fail ? 1 : 0);
