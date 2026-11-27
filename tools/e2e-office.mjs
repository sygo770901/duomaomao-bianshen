// v6 辦公室地圖 e2e：房主選圖同步、辦公室回合（變身/無限變身/燈/白板/跳躍/推擠/抓人/勝負）、回大廳保留地圖、換回小家仍可玩。
import { chromium, devices } from 'playwright-core';
const URL = process.env.URL || 'http://localhost:8765/';
const NET = 'net=local&lowgfx=1';
const qs = q => '?' + [q, NET].filter(Boolean).join('&');
const allPages = []; const chains = new Map(); const latestState = new Map(); let latestRooms = null;
function relay(m) { if (m?.type === 'rooms') latestRooms = m; for (const p of allPages) {
  if (m.type === 'data' && m.data?.t === 's') { const had = latestState.has(p); latestState.set(p, m); if (had) continue;
    const prev = chains.get(p) || Promise.resolve(); chains.set(p, prev.then(() => { const mm = latestState.get(p); latestState.delete(p); return p.evaluate(m => window.__localnetIn && window.__localnetIn(m), mm); }).catch(() => { })); continue; }
  const prev = chains.get(p) || Promise.resolve(); chains.set(p, prev.then(() => p.evaluate(m => window.__localnetIn && window.__localnetIn(m), m)).catch(() => { })); } }
const SH = process.env.SHOTS || '../shots/';
const results = []; const ok = (name, cond, info = '') => { results.push([cond ? 'PASS' : 'FAIL', name, info]); console.log(cond ? 'PASS' : 'FAIL', name, info); };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const mk = async (name, opts) => { const ctx = await b.newContext(opts); await ctx.exposeBinding('__relay', (src, m) => relay(m)); const p = await ctx.newPage(); allPages.push(p); p._n = name; p._touch = !!opts.hasTouch;
  p.on('pageerror', e => console.log(`[${name} err]`, e.message)); p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) console.log(`[${name} console]`, m.text()); }); return p; };
const A = await mk('A-host-seeker', { viewport: { width: 1280, height: 800 } });
const B = await mk('B-desktop', { viewport: { width: 1280, height: 800 } });
const C = await mk('C-mobile', { ...devices['iPhone 13'], defaultBrowserType: undefined });
const pages = [A, B, C];
const st = p => p.evaluate(() => { const s = __ph.state; return s && { map: s.map, phase: s.phase, hp: s.hp, winner: s.winner, round: s.round, players: s.players }; });
const myId = p => p.evaluate(() => __ph.net.myId);
const waitFor = (p, fn, arg, t = 20000) => p.waitForFunction(fn, arg, { timeout: t });
const allWait = (fn, arg, t = 8000) => Promise.all(pages.map(p => waitFor(p, fn, arg, t)));

await A.goto(URL + qs('hide=16&seek=80&seekerhost=1')); await waitFor(A, () => __ph.ready, null, 60000);
await A.fill('#nameIn', '房主A'); await A.click('#createBtn'); await A.waitForSelector('#lobby:not(.hidden)', { timeout: 20000 });
const code = (await A.textContent('#roomCode')).trim();
await B.goto(URL + qs('')); await waitFor(B, () => __ph.ready, null, 60000); await B.fill('#nameIn', '桌機B'); await B.fill('#codeIn', code); await B.click('#joinBtn');
await C.goto(URL + qs('room=' + code)); await waitFor(C, () => __ph.ready, null, 60000); await C.fill('#nameIn', '手機C'); await C.tap('#joinBtn');
await allWait(() => __ph.state?.players?.length === 3, null, 20000);
const ids = { A: await myId(A), B: await myId(B), C: await myId(C) };

// 1. 地圖選擇（房主選、大家同步）
ok('大廳預設地圖是溫馨小家（所有人）', (await Promise.all(pages.map(p => p.evaluate(() => __ph.curMap + '|' + document.querySelector('#mapPick .mapBtn.sel')?.dataset.map)))).every(v => v === 'home|home'));
ok('只有房主可以點地圖按鈕', await A.evaluate(() => [...document.querySelectorAll('#mapPick .mapBtn')].every(b => !b.disabled)) && (await Promise.all([B, C].map(p => p.evaluate(() => [...document.querySelectorAll('#mapPick .mapBtn')].every(b => b.disabled))))).every(Boolean));
await B.evaluate(() => __ph.selectMap('office')); await A.waitForTimeout(500);
ok('非房主送出換圖請求會被主機忽略', (await st(A)).map === 'home');
await A.click('#mapPick .mapBtn[data-map="office"]');
await allWait(() => __ph.curMap === 'office' && __ph.mapGroupVisible('office') && !__ph.mapGroupVisible('home'));
ok('房主選辦公室 → 所有人同步切換並顯示選擇', (await Promise.all(pages.map(p => p.evaluate(() => document.querySelector('#mapPick .mapBtn.sel')?.dataset.map)))).every(v => v === 'office'));
ok('換圖不發系統聊天（看大廳設定即可）', (await Promise.all(pages.map(p => p.evaluate(() => {
  const t = document.getElementById('chatLog')?.textContent || '';
  return !/把地圖換成/.test(t) && !__ph.chatLog.some(m => m.sys && /新創辦公室|把地圖換成/.test(m.text || ''));
})))).every(Boolean), await A.evaluate(() => (__ph.chatLog || []).filter(m => m.sys).map(m => m.text)));
ok('非房主看到「地圖：新創辦公室（房主選擇）」', /新創辦公室/.test(await B.textContent('#mapLabel')), await B.textContent('#mapLabel'));
await A.screenshot({ path: SH + 'v6-desktop-lobby-map.png' }); await C.screenshot({ path: SH + 'v6-mobile-lobby-map.png' });

// 2. 開局：辦公室
await A.click('#startBtn'); await allWait(() => __ph.state?.phase === 'hide', null, 15000);
let s = await st(A);
const OFF = await A.evaluate(() => ({ hiders: __ph.MAPS.office.hiders, seeker: __ph.MAPS.office.seeker, N: __ph.HOME_PROP_N, home: { hiders: __ph.MAPS.home.hiders, seeker: __ph.MAPS.home.seeker } }));
const pA = s.players.find(q => q.id === ids.A), pB = s.players.find(q => q.id === ids.B), pC = s.players.find(q => q.id === ids.C);
ok('開局載入辦公室地圖（state.map=office）', s.map === 'office' && (await Promise.all(pages.map(p => p.evaluate(() => __ph.curMap)))).every(m => m === 'office'));
ok('鬼出生在辦公室電梯廳', pA.role === 'seeker' && Math.hypot(pA.sx - OFF.seeker[0], pA.sz - OFF.seeker[1]) < .01, JSON.stringify([pA.sx, pA.sz]));
ok('躲藏者出生在辦公室中庭', [pB, pC].every(q => OFF.hiders.some(h => Math.hypot(h[0] - q.sx, h[1] - q.sz) < .01)), JSON.stringify([[pB.sx, pB.sz], [pC.sx, pC.sz]]));
ok('出生點都不在家具／牆裡', await A.evaluate(() => [...__ph.MAPS.office.hiders, __ph.MAPS.office.seeker].every(([x, z]) => { const q = __ph.collideAt(x, z); return Math.hypot(q[0] - x, q[1] - z) < .01; })));
for (const p of [B, C]) { const a = await p.evaluate(() => [__ph.local.x, __ph.local.z]); await p.evaluate(() => { __ph.holdMove.iz = -1; }); await p.waitForTimeout(600); await p.evaluate(() => { __ph.holdMove.iz = 0; }); const c = await p.evaluate(() => [__ph.local.x, __ph.local.z]);
  ok('辦公室裡可以走動 ' + p._n, Math.hypot(c[0] - a[0], c[1] - a[1]) > .4, JSON.stringify([a, c])); }
const PROPS = await A.evaluate(() => __ph.PROPS); const NP = PROPS.length;
const oid = (name, x, z) => PROPS.findIndex((p, i) => i >= OFF.N && p[0] === name && Math.hypot(p[1] - x, p[2] - z) < .35);
const I = { plant: oid('pottedPlant', -8.5, 1.0), bean: oid('beanBag', -6.2, 4.6), lamp: oid('lampRoundFloor', -3.6, 2.1), wb: PROPS.findIndex((p, i) => i >= OFF.N && p[0] === 'whiteboard' && p[3] === -90 && Math.abs(p[1] - .63) < .2),
  sofa: oid('loungeSofa', -3.0, 3.6), bean2: oid('beanBag', -3.0, 5.35), desk: oid('desk', -7.92, -6.11) };
ok('找到測試用辦公室家具', Object.values(I).every(i => i >= OFF.N), JSON.stringify(I));
const counts = () => Promise.all(pages.map(p => p.evaluate(() => __ph.visiblePropCount())));
const visAll = id => Promise.all(pages.map(p => p.evaluate(i => __ph.propVisible(i), id)));
ok('開局時所有家具都在', (await counts()).every(n => n === NP));
const press = async (p, key, btn) => { if (p._touch) await p.evaluate(b => document.getElementById(b).click(), btn); else await p.keyboard.press(key); };
async function tf(p, id) { await p.waitForTimeout(450); await p.evaluate(i => __ph.setTarget(i), id); await press(p, 'KeyF', 'tfBtn'); await p.waitForTimeout(500); }

// 3. 變身（辦公室盆栽）＋不能變成另一張地圖的家具
await B.evaluate(([x, z]) => { __ph.teleport(x, z); __ph.lookAt(-8.5, 1.0, .4); }, [-7.6, 1.6]);
await B.evaluate(() => __ph.setTarget(0)); await press(B, 'KeyF', 'tfBtn'); await B.waitForTimeout(500);
ok('不能變成另一張地圖（小家）的家具', (await st(A)).players.find(q => q.id === ids.B).prop === -1);
await B.evaluate(i => { const q = __ph.propPos(i); __ph.teleport(q[0] + 0.95, q[2] + 0.55); __ph.lookAt(q[0], q[2], .4); }, I.plant);
await tf(B, I.plant);
s = await st(A); let PB = s.players.find(q => q.id === ids.B);
ok('辦公室變身成功（盆栽）', PB.prop === I.plant, JSON.stringify([PB.prop, PB.tf]));
await Promise.all(pages.map(p => waitFor(p, i => __ph.propVisible(i) === false, I.plant, 4000).catch(() => {})));
ok('變身＝取代：原本盆栽所有人看不到', (await visAll(I.plant)).every(v => v === false));
// 無限變身：走一段再換成懶骨頭 → 盆栽留在剛才位置
await B.evaluate(() => { __ph.lookAt(-8.5, 3.5, .3); __ph.holdMove.iz = -1; }); await B.waitForTimeout(450); await B.evaluate(() => { __ph.holdMove.iz = 0; });
await B.waitForTimeout(300);
await B.evaluate(i => { const q = __ph.propPos(i); __ph.teleport(q[0] + 0.75, q[2] + 0.55); __ph.lookAt(q[0], q[2], .3); }, I.bean);
await B.waitForTimeout(200);
const plantDrop = await B.evaluate(() => [__ph.local.x, __ph.local.z]);
await tf(B, I.bean);
s = await st(A); PB = s.players.find(q => q.id === ids.B);
ok('再次變身（懶骨頭）成功', PB.prop === I.bean && PB.tf === 2, JSON.stringify([PB.prop, PB.tf]));
await Promise.all(pages.map(p => waitFor(p, ([i, x, z]) => { const q = __ph.propPos(i); return __ph.propVisible(i) && Math.hypot(q[0] - x, q[2] - z) < .3; }, [I.plant, ...plantDrop], 4000).catch(() => {})));
const plantNow = await Promise.all(pages.map(p => p.evaluate(i => [__ph.propVisible(i), __ph.propPos(i)], I.plant)));
ok('上一件（盆栽）留在剛才的位置，所有人同步', plantNow.every(([v, q]) => v && Math.hypot(q[0] - plantDrop[0], q[2] - plantDrop[1]) < .3) && Math.hypot(plantDrop[0] + 8.5, plantDrop[1] - 1.0) > .3, JSON.stringify([plantDrop, plantNow]));
ok('家具總數 = 原本 - 1（盆栽回來，懶骨頭被取代）', (await counts()).every(n => n === NP - 1), JSON.stringify(await counts()));

// 4. 燈：C 變成立燈 → 帶著燈光
await C.evaluate(i => { const q = __ph.propPos(i); __ph.teleport(q[0] - 0.9, q[2] - 0.7); __ph.lookAt(q[0], q[2], .4); }, I.lamp);
await tf(C, I.lamp);
s = await st(A); let PC = s.players.find(q => q.id === ids.C);
ok('辦公室立燈變身成功', PC.prop === I.lamp);
await A.waitForTimeout(400);
ok('變成燈後別人看到它會發光（含點光源）', await A.evaluate(id => __ph.disguiseHasLight(id) && __ph.disguisePointLightCount(id) === 1, ids.C));
// 5. 白板（牆上掛飾）：變身後掛在牆上，可沿牆滑動，跳躍下來
const wbP = PROPS[I.wb];
await C.evaluate(([x, z]) => { __ph.teleport(x, z); __ph.lookAt(.63, -4.2, -.3); }, [wbP[1] - 2.2, wbP[2]]);
await tf(C, I.wb);
s = await st(A); PC = s.players.find(q => q.id === ids.C);
ok('辦公室白板變身成功並掛在牆上', PC.prop === I.wb && PC.mnt === 1, JSON.stringify([PC.prop, PC.mnt, PC.y]));
const wb0 = await C.evaluate(() => [__ph.local.x, __ph.local.y, __ph.local.z, __ph.mounted]);
await C.evaluate(z => { __ph.lookAt(2, z, .3); __ph.slideWall(.6, -1, 0); }, wbP[2]);
const wb1 = await C.evaluate(() => [__ph.local.x, __ph.local.y, __ph.local.z, __ph.mounted]);
ok('白板可沿牆滑動且不離開牆', Math.abs(wb1[2] - wb0[2]) > .25 && wb1[3] && Math.abs(wb1[0] - wbP[1]) < .15, JSON.stringify([wb0, wb1]));
await C.evaluate(() => { __ph.cam.pitch = .5; __ph.slideWall(.25, 0, 1); }); const wbDown = await C.evaluate(() => __ph.local.y);
ok('白板 S 往下', wbDown < wb1[1] - .15, JSON.stringify([wb1[1], wbDown]));
await press(C, 'Space', 'jumpBtn'); await C.waitForTimeout(1100);
ok('跳躍後從牆上下來', (await C.evaluate(() => __ph.mounted)) === false);

// 6. 跳躍：跳上窗邊辦公桌
const deskTop = await B.evaluate(i => __ph.propTop(i), I.desk);
await B.evaluate(i => {
  const q = __ph.propPos(i), pr = __ph.PROPS[i], a = pr[3] * Math.PI / 180, px = -Math.cos(a), pz = Math.sin(a);
  __ph.teleport(q[0] + px * 1.35, q[2] + pz * 1.35, 0); __ph.lookAt(q[0], q[2], .2);
}, I.desk);
await B.waitForTimeout(200);
await B.evaluate(() => { __ph.holdMove.iz = -1; }); await B.keyboard.press('Space'); await B.waitForTimeout(800); await B.evaluate(() => { __ph.holdMove.iz = 0; });
const landY = await B.evaluate(() => __ph.local.y);
ok('跳上辦公桌（落在桌面）', landY > deskTop - .15 && landY < deskTop + .35, `y=${landY.toFixed(2)} top=${deskTop.toFixed(2)}`);

// 7. 推擠：小件（懶骨頭）會動並同步；大件（沙發）不動
const bean0 = await A.evaluate(i => __ph.propPos(i), I.bean2);
await B.evaluate(([x, z, lx, lz]) => { __ph.teleport(x, z, 0); __ph.lookAt(lx, lz); }, [bean0[0], bean0[2] + 1.3, bean0[0], bean0[2]]);
await B.evaluate(() => { __ph.holdMove.iz = -1; }); await B.waitForTimeout(800); await B.evaluate(() => { __ph.holdMove.iz = 0; });
await A.waitForTimeout(500);
const bean1 = await A.evaluate(i => __ph.propPos(i), I.bean2);
await Promise.all(pages.map(p => waitFor(p, ([i, x, z]) => { const q = __ph.propPos(i); return Math.hypot(q[0] - x, q[2] - z) < .25; }, [I.bean2, bean1[0], bean1[2]], 4000).catch(() => {})));
const beanAll = await Promise.all(pages.map(p => p.evaluate(i => __ph.propPos(i), I.bean2)));
ok('辦公室小家具（懶骨頭）被撞開', Math.hypot(bean1[0] - bean0[0], bean1[2] - bean0[2]) > .15, JSON.stringify([bean0, bean1]));
ok('被撞開的位置同步到所有人', beanAll.every(q => Math.hypot(q[0] - bean1[0], q[2] - bean1[2]) < .2));
const sofa0 = await A.evaluate(i => __ph.propPos(i), I.sofa);
await B.evaluate(([x, z, lx, lz]) => { __ph.teleport(x, z, 0); __ph.lookAt(lx, lz); }, [sofa0[0] - 1.6, sofa0[2], sofa0[0], sofa0[2]]);
await B.evaluate(() => { __ph.holdMove.iz = -1; }); await B.waitForTimeout(700); await B.evaluate(() => { __ph.holdMove.iz = 0; });
await A.waitForTimeout(300);
const sofa1 = await A.evaluate(i => __ph.propPos(i), I.sofa);
ok('大家具（沙發）撞不動', Math.hypot(sofa1[0] - sofa0[0], sofa1[2] - sofa0[2]) < .05);
// B 回到懶骨頭狀態留在原地（給鬼抓）；C 變成懶骨頭外的東西：換成盆栽 (C 在白板附近，用印表機)
const printer = PROPS.findIndex((p, i) => i >= OFF.N && p[0] === 'printer' && Math.hypot(p[1] + 1.0, p[2] + 2.65) < .3);
await C.evaluate(i => { const q = __ph.propPos(i); __ph.teleport(q[0] + 1.0, q[2] + 0.55); __ph.lookAt(q[0], q[2], .3); }, printer);
await tf(C, printer);
ok('C 改變成印表機', (await st(A)).players.find(q => q.id === ids.C).prop === printer);
await C.evaluate(() => { __ph.teleport(-7.0, 1.0); }); // 變成印表機後走到中庭空地（鬼才看得到）
const perfOffice = await C.evaluate(() => __ph.renderInfo());
await B.screenshot({ path: SH + 'v6-desktop-office-hider.png' }); await C.screenshot({ path: SH + 'v6-mobile-office-hider.png' });

// 8. 找人：鬼抓人
await waitFor(A, () => __ph.state?.phase === 'seek', null, 30000);
const near = (q, d) => [q.x + d[0], q.z + d[1]];
async function shootPlayer(id, standOff) {
  const q = (await st(A)).players.find(p => p.id === id);
  await A.evaluate(([x, z, lx, lz]) => { __ph.teleport(x, z); __ph.lookAt(lx, lz); }, [...near(q, standOff), q.x, q.z]); await A.waitForTimeout(400);
  const sp = await A.evaluate(i => __ph.screenOf('player', i), id); await A.mouse.click(sp.x, sp.y);
}
for (const off of [[0, 2.0], [0, -2.0], [2.0, .3], [-2.0, .3]]) { await shootPlayer(ids.B, off); await A.waitForTimeout(900); if (!(await st(A)).players.find(q => q.id === ids.B).alive) break; }
s = await st(A); ok('鬼在辦公室抓到躲藏者 B', s.players.find(q => q.id === ids.B).alive === false, 'hp=' + s.hp);
ok('辦公室抓到後聊天訊息顯示剩 1 人', await A.evaluate(() => {
  const t = (document.getElementById('chatFeed')?.textContent || '') + (document.getElementById('chatLog')?.textContent || '');
  return /抓到了/.test(t) && /剩 1 人/.test(t);
}), await A.evaluate(() => (document.getElementById('chatFeed')?.textContent || '') + ' | ' + (document.getElementById('chatLog')?.textContent || '')));
await A.screenshot({ path: SH + 'v6-desktop-office-seeker.png' });
for (const off of [[0, 2.0], [-1.8, .2], [1.8, .5]]) { await shootPlayer(ids.C, off); await A.waitForTimeout(800); if (!(await st(A)).players.find(q => q.id === ids.C).alive) break; } // 第三人稱鏡頭可能被旁邊的真家具擋住，換個角度
if (process.env.DBG) { const q = (await st(A)).players.find(p => p.id === ids.C); console.log('DBG C', JSON.stringify({x:q.x,z:q.z,y:q.y,alive:q.alive,prop:q.prop}), JSON.stringify(await A.evaluate(i => __ph.screenOf('player', i), ids.C)), JSON.stringify(await A.evaluate(() => [__ph.local.x, __ph.local.z]))); await A.screenshot({ path: SH + 'dbg-shootC.png' }); }
await waitFor(A, () => __ph.state?.phase === 'end', null, 6000).catch(() => {});
s = await st(A); ok('全部抓到 → 鬼贏（辦公室）', s.phase === 'end' && s.winner === 'seeker', JSON.stringify([s.phase, s.winner]));
let endCounts = await counts();
for (let i = 0; i < 8 && !endCounts.every(n => n === NP); i++) { await A.waitForTimeout(250); endCounts = await counts(); }
ok('回合結束家具恢復', endCounts.every(n => n === NP), JSON.stringify(endCounts));
const plantReset = await A.evaluate(i => __ph.propPos(i), I.plant);
ok('留在原地的家具重設回原位', Math.hypot(plantReset[0] - PROPS[I.plant][1], plantReset[2] - PROPS[I.plant][2]) < .05);

// 9. 回大廳保留地圖
await allWait(() => __ph.state?.phase === 'lobby', null, 15000);
ok('回到大廳仍是辦公室地圖（所有人）', (await Promise.all(pages.map(p => p.evaluate(() => __ph.state.map + '|' + __ph.curMap + '|' + document.querySelector('#mapPick .mapBtn.sel')?.dataset.map)))).every(v => v === 'office|office|office'));

// 10. 換回小家再開一局：小家照常
await A.click('#mapPick .mapBtn[data-map="home"]');
await allWait(() => __ph.curMap === 'home' && __ph.mapGroupVisible('home') && !__ph.mapGroupVisible('office'));
ok('換回溫馨小家同步', true);
await A.click('#startBtn'); await allWait(() => __ph.state?.phase === 'hide', null, 15000);
s = await st(A);
ok('第 2 局在小家、鬼在小家出生點', s.map === 'home' && Math.hypot(s.players.find(q => q.id === ids.A).sx - OFF.home.seeker[0], s.players.find(q => q.id === ids.A).sz - OFF.home.seeker[1]) < .01);
const homeChair = PROPS.findIndex(p => p[0] === 'loungeChair');
await B.evaluate(i => { const q = __ph.propPos(i); __ph.teleport(q[0] + 1.15, q[2] + 0.7); __ph.lookAt(q[0], q[2], .4); }, homeChair); await tf(B, homeChair);
ok('小家照常可變身', (await st(A)).players.find(q => q.id === ids.B).prop === homeChair);
const perfHome = await C.evaluate(() => __ph.renderInfo());
console.log('perf (mobile lowgfx, C view) office', JSON.stringify(perfOffice), 'home', JSON.stringify(perfHome));
ok('手機省電畫質辦公室 draw call 合理（< 450）', perfOffice.calls < 450, JSON.stringify({ perfOffice, perfHome }));

await A.evaluate(() => __ph.sbDeleteRoom());
const pass = results.filter(r => r[0] === 'PASS').length, fail = results.length - pass;
console.log(`\n==== ${pass} pass / ${fail} fail ====`); for (const r of results.filter(r => r[0] === 'FAIL')) console.log('FAIL', r[1], r[2]);
await b.close();
