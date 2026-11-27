// v11 福貓辦公室（LUCKY CAT 總部）e2e：選圖同步、預設 4 分鐘、載入/出生/家具數、碰撞（門口可走、出生點不卡、站上長桌）、
// 新家具的複合碰撞、變身＋掛牆、破壞（小件會碎、大件不會）、快速一局到鬼贏、回大廳保留地圖。
import { chromium, devices } from 'playwright-core';
const URL = process.env.URL || 'http://localhost:8765/';
const NET = 'net=local&lowgfx=1';
const qs = q => '?' + [q, NET].filter(Boolean).join('&');
const allPages = []; const chains = new Map(); const latestState = new Map();
function relay(m) { for (const p of allPages) {
  if (m.type === 'data' && m.data?.t === 's') { const had = latestState.has(p); latestState.set(p, m); if (had) continue;
    const prev = chains.get(p) || Promise.resolve(); chains.set(p, prev.then(() => { const mm = latestState.get(p); latestState.delete(p); return p.evaluate(m => window.__localnetIn && window.__localnetIn(m), mm); }).catch(() => { })); continue; }
  const prev = chains.get(p) || Promise.resolve(); chains.set(p, prev.then(() => p.evaluate(m => window.__localnetIn && window.__localnetIn(m), m)).catch(() => { })); } }
const SH = process.env.SHOTS || '../shots/';
const results = []; const ok = (name, cond, info = '') => { results.push([cond ? 'PASS' : 'FAIL', name, info]); console.log(cond ? 'PASS' : 'FAIL', name, info); };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
const mk = async (name, opts) => { const ctx = await b.newContext(opts); await ctx.exposeBinding('__relay', (src, m) => relay(m)); const p = await ctx.newPage(); allPages.push(p); p._n = name; p._touch = !!opts.hasTouch;
  p.on('pageerror', e => { errs.push(name + ': ' + e.message); console.log(`[${name} err]`, e.message); }); return p; };
const A = await mk('A-host-seeker', { viewport: { width: 1280, height: 800 } });
const B = await mk('B-desktop', { viewport: { width: 1280, height: 800 } });
const C = await mk('C-mobile', { ...devices['iPhone 13'], defaultBrowserType: undefined });
const pages = [A, B, C];
const st = p => p.evaluate(() => { const s = __ph.state; return s && { map: s.map, phase: s.phase, hp: s.hp, winner: s.winner, seekMs: s.seekMs, smashed: s.smashed, players: s.players }; });
const myId = p => p.evaluate(() => __ph.net.myId);
const waitFor = (p, fn, arg, t = 20000) => p.waitForFunction(fn, arg, { timeout: t });
const allWait = (fn, arg, t = 8000) => Promise.all(pages.map(p => waitFor(p, fn, arg, t)));
const press = async (p, key, btn) => { if (p._touch) await p.evaluate(b => document.getElementById(b).click(), btn); else await p.keyboard.press(key); };

await A.goto(URL + qs('hide=14&seekerhost=1')); await waitFor(A, () => __ph.ready, null, 60000);
await A.fill('#nameIn', '房主A'); await A.click('#createBtn'); await A.waitForSelector('#lobby:not(.hidden)', { timeout: 20000 });
const code = (await A.textContent('#roomCode')).trim();
await B.goto(URL + qs('')); await waitFor(B, () => __ph.ready, null, 60000); await B.fill('#nameIn', '桌機B'); await B.fill('#codeIn', code); await B.click('#joinBtn');
await C.goto(URL + qs('room=' + code)); await waitFor(C, () => __ph.ready, null, 60000); await C.fill('#nameIn', '手機C'); await C.tap('#joinBtn');
await allWait(() => __ph.state?.players?.length === 3, null, 20000);
const ids = { A: await myId(A), B: await myId(B), C: await myId(C) };

// 1. 大廳：三張地圖、選福貓辦公室同步、預設 4 分鐘
ok('大廳有三個地圖按鈕', (await Promise.all(pages.map(p => p.evaluate(() => [...document.querySelectorAll('#mapPick .mapBtn')].map(b => b.dataset.map).join()))) ).every(v => v === 'home,office,lucky'));
const btnBox = await C.evaluate(() => [...document.querySelectorAll('#mapPick .mapBtn')].map(b => { const r = b.getBoundingClientRect(); return [r.left, r.right, r.width]; }));
ok('手機上三個按鈕都在畫面內', btnBox.every(([l, r, w]) => l >= 0 && r <= 390 + .5 && w > 60), JSON.stringify(btnBox));
await A.click('#mapPick .mapBtn[data-map="lucky"]');
await allWait(() => __ph.curMap === 'lucky' && __ph.mapGroupVisible('lucky') && !__ph.mapGroupVisible('office') && !__ph.mapGroupVisible('home'));
ok('房主選福貓辦公室 → 所有人同步', (await Promise.all(pages.map(p => p.evaluate(() => document.querySelector('#mapPick .mapBtn.sel')?.dataset.map)))).every(v => v === 'lucky'));
ok('非房主看到「地圖：🐱 福貓辦公室・LUCKY CAT 總部」', /福貓辦公室・LUCKY CAT 總部/.test(await B.textContent('#mapLabel')), await B.textContent('#mapLabel'));
ok('福貓辦公室預設找人 4 分鐘', (await st(A)).seekMs === 240000 && /4 分鐘/.test(await B.textContent('#seekTimeVal')), await B.textContent('#seekTimeVal'));
await C.screenshot({ path: SH + 'v11-mobile-lobby-map.png' });

// 2. 靜態檢查：家具數、範圍、複合碰撞、出生點、門口
const M = await A.evaluate(() => { const L = __ph.LUCKY_START, N = __ph.LUCKY_N, P = __ph.PROPS, Mp = __ph.MAPS.lucky;
  const names = [...new Set(P.slice(L, L + N).map(p => p[0]))];
  return { L, N, office: L - __ph.HOME_PROP_N, total: P.length, rooms: __ph.LUCKY_ROOMS.length, bounds: Mp.bounds, hiders: Mp.hiders, seekers: Mp.seekers, lobbyAt: Mp.lobbyAt,
    outOfBounds: P.slice(L, L + N).filter(p => p[1] < Mp.bounds.x1 - .5 || p[1] > Mp.bounds.x2 + .5 || p[2] < Mp.bounds.z1 - .5 || p[2] > Mp.bounds.z2 + .5).map(p => p[0]),
    mapOf: [__ph.propMap(L - 1), __ph.propMap(L), __ph.propMap(L + N - 1)],
    noCols: names.filter(n => !(__ph.compoundOf(n) || []).length), names: names.length }; });
ok('福貓辦公室家具數與新創辦公室相近', M.N >= M.office * .75 && M.N <= M.office * 1.25, `lucky=${M.N} office=${M.office}`);
ok('家具索引分到正確地圖', M.mapOf.join() === 'office,lucky,lucky', M.mapOf.join());
ok('房間名稱表有資料', M.rooms >= 12, M.rooms);
ok('所有家具都在地圖範圍內', M.outOfBounds.length === 0, M.outOfBounds.join());
ok('每種家具都有複合碰撞盒', M.noCols.length === 0, `${M.names} kinds; missing: ${M.noCols.join()}`);
const freeAt = (x, z) => A.evaluate(([x, z]) => { const q = __ph.collideAt(x, z); return Math.hypot(q[0] - x, q[1] - z) < .01; }, [x, z]);
const spawnFree = []; for (const [x, z] of [...M.hiders, ...M.seekers, M.lobbyAt]) spawnFree.push(await freeAt(x, z));
ok('出生點／大廳位置都不卡在家具或牆裡', spawnFree.every(Boolean), JSON.stringify(spawnFree));
const K = .066, X = px => (px - 250) * K, Z = py => (py - 209) * K;
const doors = { 入口: [305, 297], 老闆: [184, 180], 弧形: [124.9, 198.8], 小辦公室: [119, 220], 會議室: [113, 250], 備品: [190, 265], 生日: [266.1, 286.6], 儲藏: [433, 241], 設備: [460, 252.5], 草皮辦公區: [445, 146] };
const doorFree = {}; for (const [k, [px, py]] of Object.entries(doors)) doorFree[k] = await freeAt(X(px), Z(py));
ok('每個門口都能通過', Object.values(doorFree).every(Boolean), JSON.stringify(doorFree));
const wallBlock = await A.evaluate(([x, z]) => { const q = __ph.collideAt(x, z); return Math.hypot(q[0] - x, q[1] - z) > .05; }, [X(211), Z(275)]);
ok('白磚牆／玻璃牆會擋人', wallBlock);
const lineFree = []; for (let py = 312; py >= 250; py -= 3) lineFree.push(await freeAt(X(305), Z(py)));
ok('鬼從電梯廳直直走進入口區不會卡住', lineFree.every(Boolean), JSON.stringify(lineFree.map(Number).join('')));

// 3. 開局
await A.click('#startBtn'); await allWait(() => __ph.state?.phase === 'hide', null, 15000);
let s = await st(A);
const pA = s.players.find(q => q.id === ids.A), pB = s.players.find(q => q.id === ids.B), pC = s.players.find(q => q.id === ids.C);
ok('開局載入福貓辦公室', s.map === 'lucky' && (await Promise.all(pages.map(p => p.evaluate(() => __ph.curMap)))).every(m => m === 'lucky'));
ok('鬼出生在電梯廳', pA.role === 'seeker' && Math.hypot(pA.sx - M.seekers[0][0], pA.sz - M.seekers[0][1]) < .01, JSON.stringify([pA.sx, pA.sz]));
ok('躲藏者出生在開放辦公區', [pB, pC].every(q => M.hiders.some(h => Math.hypot(h[0] - q.sx, h[1] - q.sz) < .01)));
const counts = () => Promise.all(pages.map(p => p.evaluate(() => __ph.activePropCount())));
ok('所有人看到同樣多的福貓辦公室家具', (await counts()).every(n => n === M.N), JSON.stringify(await counts()));
for (const p of [B, C]) {
  const a = await p.evaluate(() => [__ph.local.x, __ph.local.z]);
  let c = a;
  // 洗牌後預設面向可能頂到家具，換個方向再走，確認人沒有被卡死。
  for (const [iz, ix] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    await p.evaluate(([iz, ix]) => { __ph.holdMove.iz = iz; __ph.holdMove.ix = ix; }, [iz, ix]);
    await p.waitForTimeout(450);
    await p.evaluate(() => { __ph.holdMove.iz = 0; __ph.holdMove.ix = 0; });
    c = await p.evaluate(() => [__ph.local.x, __ph.local.z]);
    if (Math.hypot(c[0] - a[0], c[1] - a[1]) > .4) break;
  }
  ok('可以走動 ' + p._n, Math.hypot(c[0] - a[0], c[1] - a[1]) > .4, JSON.stringify([a, c]));
}
const PROPS = await A.evaluate(() => __ph.PROPS);
const lid = (name, px, py) => PROPS.findIndex((p, i) => i >= M.L && p[0] === name && Math.hypot(p[1] - X(px), p[2] - Z(py)) < .3);
const I = { desk: lid('longDesk', 262.5, 236), chair: lid('meshChair', 254.2, 245.1 + 0) , ac: lid('wallAC', 452, 241), statue: lid('luckyCatStatue', 413.5, 262), geode: lid('geode', 448, 119.2),
  metal: lid('metalChair', 246, 268), white: lid('whiteDesk', 462, 140) };
if (I.chair < 0) I.chair = PROPS.findIndex((p, i) => i >= M.L && p[0] === 'meshChair' && Math.hypot(p[1] - X(262.5), p[2] - Z(245.6)) < 1.0);
ok('找到測試用福貓家具', Object.values(I).every(i => i >= M.L), JSON.stringify(I));
// 複合碰撞：長桌下方可鑽（桌面高 ~.72）＋椅子不是整塊
const deskCols = await A.evaluate(i => __ph.propCols(i), I.desk), chairCols = await A.evaluate(i => __ph.propCols(i), I.chair);
ok('長桌是桌面＋桌腳的複合碰撞', deskCols.length >= 2 && deskCols.some(c => c.y1 > .5), JSON.stringify(deskCols.map(c => [+c.y1.toFixed(2), +c.y2.toFixed(2)])));
ok('網椅是多塊碰撞（座位＋椅背）', chairCols.length >= 2, chairCols.length);

// 4. 變身：金屬椅 → 壁掛冷氣（掛牆）→ 福貓雕像
async function tf(p, id) { await p.waitForTimeout(450); await p.evaluate(i => __ph.setTarget(i), id); await press(p, 'KeyF', 'tfBtn'); await p.waitForTimeout(600); }
await B.evaluate(i => { const q = __ph.propPos(i); __ph.teleport(q[0] - 1.2, q[2] + .6); __ph.lookAt(q[0], q[2], .4); }, I.metal);
await tf(B, I.metal);
ok('變身成金屬椅', (await st(A)).players.find(q => q.id === ids.B).prop === I.metal);
const acP = PROPS[I.ac];
await C.evaluate(([x, z, lx, lz]) => { __ph.teleport(x, z); __ph.lookAt(lx, lz, -.3); }, [acP[1], acP[2] + 1.6, acP[1], acP[2]]);
await tf(C, I.ac);
let PC = (await st(A)).players.find(q => q.id === ids.C);
ok('變身成壁掛冷氣並掛在牆上', PC.prop === I.ac && PC.mnt === 1, JSON.stringify([PC.prop, PC.mnt, PC.y]));
const w0 = await C.evaluate(() => [__ph.local.x, __ph.local.y, __ph.local.z, __ph.mounted]);
await C.evaluate(() => { __ph.cam.yaw = Math.PI; __ph.slideWall(.5, 1, 0); });
const w1 = await C.evaluate(() => [__ph.local.x, __ph.local.y, __ph.local.z, __ph.mounted]);
ok('冷氣可沿牆滑動且不離開牆', Math.abs(w1[0] - w0[0]) > .2 && w1[3] && Math.abs(w1[2] - w0[2]) < .1, JSON.stringify([w0, w1]));
await press(C, 'Space', 'jumpBtn'); await C.waitForTimeout(1100);
await C.evaluate(i => { const q = __ph.propPos(i); __ph.teleport(q[0] - 1.3, q[2], 0); __ph.lookAt(q[0], q[2], .3); }, I.statue);
await tf(C, I.statue);
PC = (await st(A)).players.find(q => q.id === ids.C);
ok('變身成福貓雕像', PC.prop === I.statue, JSON.stringify([PC.prop]));
await C.evaluate(([x, z]) => { __ph.teleport(x, z, 0); }, [X(316), Z(205)]);

// 5. 跳上長桌（站在桌面）
const top = await B.evaluate(i => __ph.propTop(i), I.desk);
await B.evaluate(i => { const q = __ph.propPos(i); __ph.teleport(q[0] - 1.75, q[2], 0); __ph.lookAt(q[0], q[2], .2); }, I.desk);
await B.waitForTimeout(200);
await B.evaluate(() => { __ph.holdMove.iz = -1; }); await B.keyboard.press('Space'); await B.waitForTimeout(800); await B.evaluate(() => { __ph.holdMove.iz = 0; });
const ly = await B.evaluate(() => __ph.local.y);
ok('跳上長桌（落在桌面）', ly > top - .15 && ly < top + .35, `y=${ly.toFixed(2)} top=${top.toFixed(2)}`);
await B.evaluate(([x, z]) => { __ph.teleport(x, z, 0); }, [X(291), Z(205)]);

// 6. 找人：破壞小件（網椅）會碎、長桌不會；抓人 → 鬼贏
await waitFor(A, () => __ph.state?.phase === 'seek', null, 30000);
await A.evaluate(i => { const q = __ph.propPos(i); __ph.teleport(q[0], q[2] + 1.4); __ph.lookAt(q[0], q[2], .3); __ph.resetSmashCd(); }, I.chair);
await A.waitForTimeout(300);
const n0 = await A.evaluate(() => __ph.evLog.filter(e => e.k === 'smash').length);
await A.evaluate(() => __ph.doSmash());
await waitFor(A, n => __ph.evLog.filter(e => e.k === 'smash').length > n, n0, 5000).catch(() => {});
await A.waitForTimeout(400);
const tableId = PROPS.findIndex((p, i) => i >= M.L && p[0] === 'ovalTable');
ok('破壞：網椅碎掉', await A.evaluate(i => __ph.isSmashed(i), I.chair), JSON.stringify(await A.evaluate(() => __ph.smashedIds())));
ok('破壞：橢圓會議桌（大件）不會碎', !(await A.evaluate(i => __ph.isSmashed(i), tableId)));
async function shootPlayer(id, standOff) {
  const q = (await st(A)).players.find(p => p.id === id);
  await A.evaluate(([x, z, lx, lz]) => { __ph.teleport(x, z); __ph.lookAt(lx, lz); }, [q.x + standOff[0], q.z + standOff[1], q.x, q.z]); await A.waitForTimeout(400);
  await waitFor(A, i => __ph.screenOf('player', i)?.onScreen, id, 4000).catch(() => {}); await A.waitForTimeout(200);
  const sc = await A.evaluate(i => __ph.screenOf('player', i), id); if (process.env.DBG) console.log('sc', id, JSON.stringify(sc), JSON.stringify(await A.evaluate(() => [__ph.local.x, __ph.local.z, __ph.state.phase]))); if (sc) await A.mouse.click(sc.x, sc.y);
}
for (const id of [ids.B, ids.C]) for (const off of [[0, 2.0], [-1.8, .2], [1.8, .5], [0, -2.0]]) { await shootPlayer(id, off); await A.waitForTimeout(900); if (!(await st(A)).players.find(q => q.id === id).alive) break; }
if (process.env.DBG) { await A.screenshot({ path: SH + 'dbg-lucky-shoot.png' }); console.log('DBG', JSON.stringify(await A.evaluate(i => __ph.screenOf('player', i), ids.B)), JSON.stringify(await A.evaluate(() => [__ph.local.x, __ph.local.z, __ph.state.hp, __ph.evLog.slice(-6)]))); }
s = await st(A);
ok('鬼在福貓辦公室抓到兩位躲藏者', [ids.B, ids.C].every(id => !s.players.find(q => q.id === id).alive), 'hp=' + JSON.stringify(s.hp) + ' ' + JSON.stringify(s.players.map(q => [q.name, q.alive, +q.x.toFixed(2), +q.z.toFixed(2), q.prop])));
ok('抓人訊息寫進聊天', await A.evaluate(() => /抓到了/.test((document.getElementById('chatFeed')?.textContent || '') + (document.getElementById('chatLog')?.textContent || ''))));
await waitFor(A, () => __ph.state?.phase === 'end', null, 6000).catch(() => {});
s = await st(A); ok('全部抓到 → 鬼贏', s.phase === 'end' && s.winner === 'seeker', JSON.stringify([s.phase, s.winner]));
await allWait(() => __ph.state?.phase === 'lobby', null, 15000);
ok('回大廳仍是福貓辦公室', (await Promise.all(pages.map(p => p.evaluate(() => __ph.state.map + '|' + __ph.curMap)))).every(v => v === 'lucky|lucky'));
ok('回合後家具全部恢復', (await counts()).every(n => n === M.N), JSON.stringify(await counts()));
const perf = await C.evaluate(() => __ph.renderInfo());
ok('手機 lowgfx draw calls 合理', perf.calls < 900, JSON.stringify(perf));
ok('沒有頁面錯誤', errs.length === 0, errs.join(' | '));
const f = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - f} passed, ${f} failed`);
await b.close(); process.exit(f ? 1 : 0);
