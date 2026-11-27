// v19 福貓辦公室：櫃台／吧台重做＋平面標註 1–7（門、草皮、窗邊雜物、連續桌、陽台、晶洞會客室、機房）
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
    copier: near('copier', 255.6, 147.9),
    cert: near('certFrame', 197, 128, .8),
    treasure: near('treasureCounter', 297.6, 263),
    geodeGrass: near('geode', 448, 119.2),
    geodeMeet: near('geode', 217.5, 268),
    whiteDesk: near('whiteDesk', 462, 140),
    ovalMeet: near('ovalTable', 246, 280),
    statue: near('luckyCatStatue', 346, 280),
    island: near('kitchenIsland', 371.5, 267.5),
    cat: near('officeCat', 292, 198),
    windowDesk: near('longDesk', 340.33, 135),
    upperDesk: near('longDesk', 316.5, 163.7),
    aisleMesh: near('gridPanel', 350.4, 187),
    lowerDesk: near('longDesk', 328.3, 226.0),
    pendant: count('goldPendant') >= 4,
    bistroGone: !P.slice(L, L + N).some(p => p[0] === 'bistroChair' && Math.hypot(p[1] - X(444), p[2] - Z(198)) < 1.2),
  }, count: { goldPendant: count('goldPendant'), copier: count('copier'), whiteDesk: count('whiteDesk'), treasureCounter: count('treasureCounter') } };
});
const roomMap = Object.fromEntries(info.rooms.map(s => { const [id, name, sure] = s.split(':'); return [id, { name, sure }]; }));
ok('晶洞會客室已改名且標確定', roomMap.party?.name === '晶洞會客室' && roomMap.party?.sure === '1', JSON.stringify(roomMap.party));
ok('草皮辦公區已改名且標確定', roomMap.small?.name === '草皮辦公區' && roomMap.small?.sure === '1', JSON.stringify(roomMap.small));
ok('福貓挖寶網房間名', roomMap.cafe?.name === '福貓挖寶網' && roomMap.cafe?.sure === '1', JSON.stringify(roomMap.cafe));
ok('影印區改到窗邊西端並標確定', roomMap.copy?.name === '影印區' && roomMap.copy?.sure === '1', JSON.stringify(roomMap.copy));
ok('影印機在新標註位置', info.near.copier);
ok('證書掛在老闆東牆辦公區側', info.near.cert);
ok('福貓挖寶網櫃台在走廊', info.near.treasure);
ok('紫晶洞在草皮辦公區窗邊', info.near.geodeGrass);
ok('晶洞會客室有紫晶洞', info.near.geodeMeet);
ok('草皮辦公區有白色書桌', info.near.whiteDesk);
ok('晶洞會客室有圓桌', info.near.ovalMeet);
ok('福貓雕像在中島右側', info.near.statue);
ok('中島仍在入口／茶水間', info.near.island);
ok('辦公室貓在開放辦公區', info.near.cat);
ok('有金色吊燈可變身', info.near.pendant, 'n=' + info.count.goldPendant);
ok('舊咖啡角 X 背椅已撤', info.near.bistroGone);

const K = .066, X = px => (px - 250) * K, Z = py => (py - 209) * K;
const freeAt = (x, z) => A.evaluate(([x, z]) => { const q = __ph.collideAt(x, z); return Math.hypot(q[0] - x, q[1] - z) < .01; }, [x, z]);
const blocked = (x, z) => A.evaluate(([x, z]) => { const q = __ph.collideAt(x, z); return Math.hypot(q[0] - x, q[1] - z) > .05; }, [x, z]);
ok('草皮房西門可進出', await freeAt(X(434), Z(130)));
ok('草皮斜牆東端開口可進出', await freeAt(X(476), Z(178)));
ok('草皮西牆門洞兩側仍擋人', await blocked(X(434), Z(116)) && await blocked(X(434), Z(142)));
ok('機房已改名且標確定', roomMap.spare?.name === '機房' && roomMap.spare?.sure === '1', JSON.stringify(roomMap.spare));
ok('陽台已改名且標確定', roomMap.equip?.name === '陽台' && roomMap.equip?.sure === '1', JSON.stringify(roomMap.equip));
ok('窗邊不再是獨立房間', !roomMap.north, JSON.stringify(roomMap.north));
ok('陽台東側半高牆會擋人', await blocked(X(487), Z(270)));
ok('陽台內可走', await freeAt(X(470), Z(262)));

ok('靠窗有辦公桌椅', info.near.windowDesk);
ok('北側內桌列仍在', info.near.upperDesk);
ok('兩排之間有白色鐵網', info.near.aisleMesh);
ok('南側桌列已連成一排', info.near.lowerDesk);
ok('新白牆會擋人', await blocked(X(240), Z(140)));
ok('櫃台西側走道可過', await freeAt(X(250), Z(263)));
ok('櫃台本身會擋原 x=305 走道', await blocked(X(298), Z(263)));
ok('白牆以南大廳可繞行', await freeAt(X(269), Z(248)));
ok('舊白牆位置已可通過', await freeAt(X(269), Z(180)));
ok('舊牆切開的南側桌列缺口可過', await freeAt(X(262), Z(220)));
ok('窗邊與草皮牆之間走道可過', await freeAt(X(420), Z(150)) && await freeAt(X(420), Z(170)) && await freeAt(X(420), Z(135)));
ok('儲藏室北牆真門可進出', await freeAt(X(427), Z(241)));
ok('儲藏室北牆舊門洞已封', await blocked(X(440), Z(241)));

ok('原 L 形玻璃南側走道可過', await freeAt(X(334), Z(248)));
ok('會客室門口可過', await freeAt(X(266.1), Z(286.6)));
const spawnFree = [];
const M = await A.evaluate(() => ({ hiders: __ph.MAPS.lucky.hiders, seekers: __ph.MAPS.lucky.seekers, lobbyAt: __ph.MAPS.lucky.lobbyAt, bounds: __ph.MAPS.lucky.bounds }));
for (const [x, z] of [...M.hiders, ...M.seekers, M.lobbyAt]) spawnFree.push(await freeAt(x, z));
ok('出生點／大廳位置都不卡', spawnFree.every(Boolean), JSON.stringify(spawnFree));

await A.click('#startBtn'); await allWait(() => __ph.state?.phase === 'hide', null, 15000);
ok('開局載入福貓辦公室', (await st(A)).map === 'lucky');
const PROPS = await A.evaluate(() => __ph.PROPS);
const L = await A.evaluate(() => __ph.LUCKY_START);
const lid = (name, px, py) => PROPS.findIndex((p, i) => i >= L && p[0] === name && Math.hypot(p[1] - X(px), p[2] - Z(py)) < .45);
const tid = lid('treasureCounter', 297.6, 263);
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
