// v9：大廳時間設定同步、鬼破壞技能（3m、水平/垂直 ±60°）
import { chromium, devices } from 'playwright-core';
const URL = process.env.URL || 'http://localhost:8765/';
const NET = 'net=local&lowgfx=1';
const qs = q => '?' + [q, NET].filter(Boolean).join('&');
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
const SH = process.env.SHOTS || '../shots/';
const results = [];
const ok = (name, cond, info = '') => { results.push([cond ? 'PASS' : 'FAIL', name, info]); console.log(cond ? 'PASS' : 'FAIL', name, info); };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const mk = async (name, opts) => {
  const ctx = await b.newContext(opts);
  await ctx.exposeBinding('__relay', (src, m) => relay(m));
  const p = await ctx.newPage(); allPages.push(p); p._n = name;
  p.on('pageerror', e => console.log(`[${name} err]`, e.message));
  p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) console.log(`[${name} console]`, m.text()); });
  return p;
};
const st = p => p.evaluate(() => {
  const s = __ph.state; return s && { map: s.map, phase: s.phase, rem: s.rem, hideMs: s.hideMs, seekMs: s.seekMs, smashed: s.smashed, players: s.players, winner: s.winner };
});
const waitFor = (p, fn, arg, t = 20000) => p.waitForFunction(fn, arg, { timeout: t });
const desk = { viewport: { width: 1100, height: 700 } };

function timesOf(p) {
  return p.evaluate(() => ({
    hide: document.getElementById('hideTimeVal')?.textContent,
    seek: document.getElementById('seekTimeVal')?.textContent,
    hideMs: __ph.state?.hideMs, seekMs: __ph.state?.seekMs, map: __ph.state?.map,
  }));
}
async function chatHas(p, re) {
  return p.evaluate(re => __ph.chatLog.some(m => m.sys && new RegExp(re).test(m.text)), re);
}

// ========== A. 大廳時間設定 ==========
const T = await mk('T-host', desk);
const U = await mk('T-join', desk);
await T.goto(URL + qs('')); await waitFor(T, () => __ph.ready, null, 60000);
await T.fill('#nameIn', '時限主'); await T.click('#createBtn');
await T.waitForSelector('#lobby:not(.hidden)', { timeout: 20000 });
const codeT = (await T.textContent('#roomCode')).trim();
await U.goto(URL + qs('')); await waitFor(U, () => __ph.ready, null, 60000);
await U.fill('#nameIn', '時限客'); await U.fill('#codeIn', codeT); await U.click('#joinBtn');
await Promise.all([T, U].map(p => waitFor(p, () => __ph.state?.players?.length === 2, null, 20000)));
ok('有人加入房間會發系統聊天', await chatHas(T, '時限客') && await chatHas(T, '加入了房間') && await chatHas(U, '加入了房間'), await T.evaluate(() => __ph.chatLog.filter(m => m.sys).map(m => m.text)));

let t0 = await timesOf(T), u0 = await timesOf(U);
ok('預設：小家躲藏 30 秒、找人 3 分鐘（雙方一致）',
  t0.hideMs === 30000 && t0.seekMs === 180000 && t0.hide === '30 秒' && t0.seek === '3 分鐘'
  && u0.hideMs === 30000 && u0.seekMs === 180000 && u0.hide === '30 秒' && u0.seek === '3 分鐘',
  JSON.stringify({ t0, u0 }));

await T.click('#mapPick .mapBtn[data-map="office"]');
await Promise.all([T, U].map(p => waitFor(p, () => __ph.state?.map === 'office' && __ph.state?.seekMs === 300000, null, 8000)));
let t1 = await timesOf(T), u1 = await timesOf(U);
ok('換辦公室且未改過時間 → 重設為 30 秒 / 5 分鐘',
  t1.hideMs === 30000 && t1.seekMs === 300000 && u1.seekMs === 300000 && t1.seek === '5 分鐘', JSON.stringify({ t1, u1 }));
ok('換地圖／時間不發系統聊天（看大廳設定即可）', !(await chatHas(T, '時間重設')) && !(await chatHas(T, '把地圖換成')) && !(await chatHas(U, '把地圖換成')), await T.evaluate(() => __ph.chatLog.filter(m => m.sys).map(m => m.text)));

await T.click('#mapPick .mapBtn[data-map="home"]');
await Promise.all([T, U].map(p => waitFor(p, () => __ph.state?.map === 'home' && __ph.state?.seekMs === 180000, null, 8000)));

await T.evaluate(() => __ph.setTimes(45, 120));
await Promise.all([T, U].map(p => waitFor(p, () => __ph.state?.hideMs === 45000 && __ph.state?.seekMs === 120000, null, 8000)));
let t2 = await timesOf(T), u2 = await timesOf(U);
ok('房主把時間改成 45 秒 / 2 分鐘，雙方大廳同步',
  t2.hide === '45 秒' && t2.seek === '2 分鐘' && u2.hide === '45 秒' && u2.seek === '2 分鐘', JSON.stringify({ t2, u2 }));
ok('改時間不同步成系統聊天', !(await chatHas(T, '把時間設成')) && !(await chatHas(U, '把時間設成')) && !(await chatHas(T, '45 秒')), await T.evaluate(() => __ph.chatLog.filter(m => m.sys).map(m => m.text)));

await T.click('#mapPick .mapBtn[data-map="office"]');
await Promise.all([T, U].map(p => waitFor(p, () => __ph.state?.map === 'office', null, 8000)));
await T.waitForTimeout(300);
let t3 = await timesOf(T), u3 = await timesOf(U);
ok('改過時間後再換地圖 → 保留 45 秒 / 2 分鐘',
  t3.hideMs === 45000 && t3.seekMs === 120000 && u3.hideMs === 45000 && u3.seekMs === 120000, JSON.stringify({ t3, u3 }));

await T.screenshot({ path: SH + 'v9-lobby-times.png' });

await T.click('#mapPick .mapBtn[data-map="home"]');
await Promise.all([T, U].map(p => waitFor(p, () => __ph.state?.map === 'home', null, 8000)));
await T.evaluate(() => __ph.setTimes(15, 60));
await Promise.all([T, U].map(p => waitFor(p, () => __ph.state?.hideMs === 15000 && __ph.state?.seekMs === 60000, null, 8000)));
for (const p of [T, U]) { const r = await p.evaluate(() => !!__ph.me()?.ready); if (!r) await p.click('#readyBtn'); }
await Promise.all([T, U].map(p => waitFor(p, () => __ph.state.players.every(q => q.ready), null, 8000)));
const idT = await T.evaluate(() => __ph.net.myId);
const idU = await U.evaluate(() => __ph.net.myId);
await T.evaluate((m) => __ph.setNextRolls(m), { [idT]: [1], [idU]: [6] });
await T.waitForFunction(() => { const b = document.getElementById('rollBtn'); return b && !b.disabled; }, null, { timeout: 8000 }); await T.click('#rollBtn');
await Promise.all([T, U].map(p => waitFor(p, () => __ph.state?.dice?.status === 'done', null, 8000)));
await T.click('#startBtn');
await Promise.all([T, U].map(p => waitFor(p, () => __ph.state?.phase === 'hide', null, 15000)));
let sH = await st(T);
ok('開局躲藏倒數約 15 秒（大廳設定）', sH.phase === 'hide' && sH.rem > 12000 && sH.rem <= 15000, `rem=${sH.rem}`);
await waitFor(T, () => __ph.state?.phase === 'seek', null, 20000);
let sS = await st(T);
ok('進入找人後倒數約 1 分鐘（大廳設定）', sS.phase === 'seek' && sS.rem > 55000 && sS.rem <= 60000, `rem=${sS.rem}`);
await T.evaluate(() => __ph.sbDeleteRoom());
await T.evaluate(() => __ph.skipToSeekRemaining(0));
await Promise.all([T, U].map(p => waitFor(p, () => __ph.state?.phase === 'lobby' || __ph.state?.phase === 'end', null, 15000))).catch(() => {});
for (const p of [T, U]) { const i = allPages.indexOf(p); if (i >= 0) allPages.splice(i, 1); await p.context().close(); }

// ========== B. 破壞技能 ==========
const A = await mk('A-sk', desk);
const B = await mk('B-sk', desk);
const C = await mk('C-hd', desk);
const pages = [A, B, C];
const cWait = (fn, arg, t = 8000) => Promise.all(pages.map(p => waitFor(p, fn, arg, t)));
await A.goto(URL + qs('hide=3&seek=80')); await waitFor(A, () => __ph.ready, null, 60000);
await A.fill('#nameIn', '鬼甲'); await A.click('#createBtn');
await A.waitForSelector('#lobby:not(.hidden)', { timeout: 20000 });
const code = (await A.textContent('#roomCode')).trim();
await B.goto(URL + qs('')); await waitFor(B, () => __ph.ready, null, 60000);
await B.fill('#nameIn', '鬼乙'); await B.fill('#codeIn', code); await B.click('#joinBtn');
await C.goto(URL + qs('room=' + code)); await waitFor(C, () => __ph.ready, null, 60000);
await C.fill('#nameIn', '躲藏丙'); await C.click('#joinBtn');
await cWait(() => __ph.state?.players?.length === 3, null, 20000);
const idA = await A.evaluate(() => __ph.net.myId);
const idB = await B.evaluate(() => __ph.net.myId);
const idC = await C.evaluate(() => __ph.net.myId);
await A.evaluate(() => __ph.setSeekerNeed(2));
for (const p of pages) { const r = await p.evaluate(() => !!__ph.me()?.ready); if (!r) await p.click('#readyBtn'); }
await cWait(() => __ph.state.players.every(q => q.ready));
await A.evaluate(m => __ph.setNextRolls(m), { [idA]: [1], [idB]: [2], [idC]: [6] });
await A.waitForFunction(() => { const b = document.getElementById('rollBtn'); return b && !b.disabled; }, null, { timeout: 8000 }); await A.click('#rollBtn');
await cWait(() => __ph.state?.dice?.status === 'done');
await A.click('#startBtn');
await cWait(() => __ph.state?.phase === 'hide', null, 15000);
await A.evaluate(() => __ph.skipToSeekRemaining(70000));
await cWait(() => __ph.state?.phase === 'seek', null, 8000);

ok('破壞參數：半徑 3 公尺、水平 ±60 度、垂直 ±60 度、冷卻 10 秒',
  await A.evaluate(() => __ph.SMASH_RANGE === 3 && Math.abs(__ph.SMASH_ANGLE - Math.PI / 3) < 1e-6 && Math.abs(__ph.SMASH_VANGLE - Math.PI / 3) < 1e-6 && __ph.SMASH_CD === 10000 && __ph.SMASH_LOCK === 5000));

const sofa = await A.evaluate(() => __ph.PROPS.findIndex((p, i) => i < __ph.HOME_PROP_N && p[0] === 'loungeSofa'));
const coffee = await A.evaluate(() => __ph.PROPS.findIndex((p, i) => i < __ph.HOME_PROP_N && p[0] === 'tableCoffee'));
const chair = await A.evaluate(() => __ph.PROPS.findIndex((p, i) => i < __ph.HOME_PROP_N && p[0] === 'loungeChair'));
ok('沙發列入大件免疫、茶几與單椅可破壞',
  await A.evaluate(i => !__ph.canSmashProp(__ph.PROPS[i][0]), sofa)
  && await A.evaluate(i => __ph.canSmashProp(__ph.PROPS[i][0]), coffee)
  && await A.evaluate(i => __ph.canSmashProp(__ph.PROPS[i][0]), chair),
  `sofa=${sofa} coffee=${coffee} chair=${chair}`);

// 錐形範圍：3.5 m 打不中、側向 70° 打不中、高處層架上的可砸中
const plant = await A.evaluate(() => __ph.PROPS.findIndex((p, i) => i < __ph.HOME_PROP_N && p[0] === 'plantSmall2' && !(p[4] > 0)));
const plantP = await A.evaluate(i => __ph.PROPS[i], plant);
await B.evaluate(() => { __ph.teleport(7.1, -1.5, 0); });
await C.evaluate(() => { __ph.teleport(-7.0, 7.0, 0); });
await A.evaluate(([x, z]) => { __ph.teleport(x - 3.55, z, 0); __ph.lookAt(x, z, .25); }, [plantP[1], plantP[2]]);
await A.waitForTimeout(250);
const nFar = await A.evaluate(() => __ph.evLog.filter(e => e.k === 'smash').length);
await A.evaluate(() => __ph.doSmash());
await waitFor(A, n => __ph.evLog.filter(e => e.k === 'smash').length > n, nFar, 5000).catch(() => {});
ok('3.5 公尺外的家具不會被砸中', !(await A.evaluate(i => __ph.isSmashed(i), plant)), `plant=${plant} ${JSON.stringify(plantP)}`);

await A.evaluate(() => __ph.resetSmashCd());
await A.waitForTimeout(120);
const ang70 = 70 * Math.PI / 180, d70 = 2.0;
await A.evaluate(([px, pz, d, a]) => {
  const sx = px - Math.sin(a) * d, sz = pz - Math.cos(a) * d;
  __ph.teleport(sx, sz, 0);
  __ph.lookAt(sx, sz + 2, .2); // 朝 +z，與目標夾角 70°
}, [plantP[1], plantP[2], d70, ang70]);
await A.waitForTimeout(250);
const nSide = await A.evaluate(() => __ph.evLog.filter(e => e.k === 'smash').length);
await A.evaluate(() => __ph.doSmash());
await waitFor(A, n => __ph.evLog.filter(e => e.k === 'smash').length > n, nSide, 5000).catch(() => {});
ok('側向 70 度（超出 ±60°）的家具不會被砸中', !(await A.evaluate(i => __ph.isSmashed(i), plant)));

await A.evaluate(() => __ph.resetSmashCd());
await A.waitForTimeout(120);
const high = await A.evaluate(() => {
  for (let i = 0; i < __ph.HOME_PROP_N; i++) {
    const p = __ph.PROPS[i];
    if ((p[4] || 0) >= 0.8 && __ph.canSmashProp(p[0])) return i;
  }
  return -1;
});
ok('找得到架上／桌上可破壞的家具', high >= 0, 'high=' + high);
if (high >= 0) {
  const highP = await A.evaluate(i => __ph.PROPS[i], high);
  await A.evaluate(([x, z, y]) => {
    __ph.teleport(x, z + 1.35, 0);
    __ph.lookAt(x, z, -0.45); // 抬頭瞄準層架
  }, [highP[1], highP[2], highP[4] || 0.9]);
  await A.waitForTimeout(250);
  const nHi = await A.evaluate(() => __ph.evLog.filter(e => e.k === 'smash').length);
  await A.evaluate(() => __ph.doSmash());
  await waitFor(A, n => __ph.evLog.filter(e => e.k === 'smash').length > n, nHi, 5000);
  ok('錐形範圍內高處層架上的家具會被砸中', await A.evaluate(i => __ph.isSmashed(i), high),
    await A.evaluate(i => ({ i, name: __ph.PROPS[i][0], y: __ph.PROPS[i][4], ev: __ph.evLog.filter(e => e.k === 'smash').slice(-1)[0] }), high));
}
await A.evaluate(() => __ph.resetSmashCd());

// 茶几：站在客廳 (-7,1.5) 朝西砸，距離 1.6 m，在 3 m / ±60° 內
await B.evaluate(() => { __ph.teleport(7.1, -1.5, 0); });
await C.evaluate(() => { __ph.teleport(-7.0, 7.0, 0); });
await A.evaluate(() => { __ph.teleport(-7.0, 1.5, 0); __ph.lookAt(-8.6, 1.5, .35); });
await waitFor(A, () => { const q = __ph.me(); return q && Math.hypot(q.x + 7, q.z - 1.5) < .25; }, null, 5000);
await A.waitForTimeout(300);
const nSmash0 = await A.evaluate(() => __ph.evLog.filter(e => e.k === 'smash').length);
await A.evaluate(() => __ph.doSmash());
await waitFor(A, n => __ph.evLog.filter(e => e.k === 'smash').length > n, nSmash0, 5000);
ok('砸中茶几：茶几列入已破壞且有碎片',
  await A.evaluate(i => __ph.isSmashed(i) && __ph.debrisCount() >= 5, coffee),
  await A.evaluate(i => ({ smashed: __ph.smashedIds(), debris: __ph.debrisCount(), ev: __ph.evLog.filter(e => e.k === 'smash').slice(-1)[0] }), coffee));
ok('沙發（大件）仍完好、不可被破壞標記', !(await A.evaluate(i => __ph.isSmashed(i), sofa)));

const nSmash1 = await A.evaluate(() => __ph.evLog.filter(e => e.k === 'smash').length);
const debris1 = await A.evaluate(() => __ph.debrisCount());
await A.evaluate(() => __ph.doSmash());
await A.waitForTimeout(400);
ok('10 秒冷卻內再砸無效',
  await A.evaluate(n => __ph.evLog.filter(e => e.k === 'smash').length === n, nSmash1)
  && await A.evaluate(n => __ph.debrisCount() === n, debris1)
  && await A.evaluate(() => __ph.smashCdLeft() > 5000));

// 丙不能變成已砸碎的茶几
await C.evaluate(([x, z]) => { __ph.teleport(x, z, 0); }, [-8.6, 1.5]);
await waitFor(C, () => { const q = __ph.me(); return q && Math.hypot(q.x + 8.6, q.z - 1.5) < .35; }, null, 5000);
await C.evaluate(i => __ph.tryTransform(i), coffee);
await C.waitForTimeout(400);
ok('已破壞的家具不能再被選來變身', await C.evaluate(() => (__ph.me()?.prop ?? -1) < 0));

await A.evaluate(() => { __ph.lookAt(-8.6, 1.5, .4); });
await A.waitForTimeout(250);
await A.screenshot({ path: SH + 'v9-smash-debris.png' });

// 免疫：走到沙發前砸，沙發仍在（冷卻先清掉）
await A.evaluate(() => __ph.resetSmashCd());
await A.waitForTimeout(150);
await A.evaluate(() => { __ph.teleport(-6.8, 1.5, 0); __ph.lookAt(-5.2, 1.5, .3); });
await A.waitForTimeout(250);
const nSmash2 = await A.evaluate(() => __ph.evLog.filter(e => e.k === 'smash').length);
await A.evaluate(() => __ph.doSmash());
await waitFor(A, n => __ph.evLog.filter(e => e.k === 'smash').length > n, nSmash2, 5000).catch(() => {});
ok('對著沙發砸：沙發仍免疫、不會被列入破壞', !(await A.evaluate(i => __ph.isSmashed(i), sofa)));

// 變身被打回原形 + 5 秒鎖定
await A.evaluate(() => __ph.resetSmashCd());
await C.evaluate(i => {
  const p = __ph.PROPS[i];
  __ph.teleport(p[1], p[2], 0);
}, chair);
await waitFor(C, i => { const p = __ph.PROPS[i], q = __ph.me(); return q && Math.hypot(q.x - p[1], q.z - p[2]) < .3; }, chair, 5000);
await C.evaluate(i => __ph.tryTransform(i), chair);
await waitFor(C, i => __ph.me()?.prop === i, chair, 5000);
ok('丙先變成單人椅', await C.evaluate(i => __ph.me()?.prop === i, chair));
const chairP = await A.evaluate(i => __ph.PROPS[i], chair); // [-9, 4.6]
await A.evaluate(([x, z]) => { __ph.teleport(x + 1.4, z, 0); __ph.lookAt(x, z, .3); }, [chairP[1], chairP[2]]);
await waitFor(A, ([x, z]) => { const h = __ph.state.players.find(p => p.role === 'hider'); return h && Math.hypot(h.x - x, h.z - z) < .4; }, [chairP[1], chairP[2]], 5000);
await A.waitForTimeout(200);
const nSmash3 = await A.evaluate(() => __ph.evLog.filter(e => e.k === 'smash').length);
await A.evaluate(() => __ph.doSmash());
await waitFor(A, n => __ph.evLog.filter(e => e.k === 'smash').length > n, nSmash3, 5000);
const evRev = await A.evaluate(() => __ph.evLog.filter(e => e.k === 'smash').slice(-1)[0]);
ok('已變身的躲藏者在扇形內被打回原形，且單椅被砸碎',
  await C.evaluate(() => (__ph.me()?.prop ?? -1) < 0)
  && (evRev?.revealed || []).some(q => q.id)
  && await A.evaluate(i => __ph.isSmashed(i), chair),
  JSON.stringify(evRev));
ok('被打回原形後有約 5 秒變身鎖定', await C.evaluate(() => __ph.tfLockRem() > 3500 && __ph.tfLockRem() <= 5000), await C.evaluate(() => __ph.tfLockRem()));
await C.evaluate(i => __ph.tryTransform(i), chair); // smashed anyway
// try a different intact prop nearby: plant or ottoman?
const ottoman = await C.evaluate(() => __ph.PROPS.findIndex((p, i) => i < __ph.HOME_PROP_N && p[0] === 'loungeSofaOttoman'));
await C.evaluate(i => {
  const p = __ph.PROPS[i]; __ph.teleport(p[1], p[2], 0); __ph.tryTransform(i);
}, ottoman);
await C.waitForTimeout(350);
ok('鎖定期間不能再變身', await C.evaluate(() => (__ph.me()?.prop ?? -1) < 0 && __ph.tfLockRem() > 0));
await waitFor(C, () => __ph.tfLockRem() === 0, null, 7000);
await C.evaluate(i => {
  const p = __ph.PROPS[i]; __ph.teleport(p[1], p[2], 0); __ph.tryTransform(i);
}, ottoman);
await waitFor(C, i => __ph.me()?.prop === i, ottoman, 5000);
ok('5 秒鎖定結束後可以再變身', await C.evaluate(i => __ph.me()?.prop === i, ottoman));
await A.screenshot({ path: SH + 'v9-smash-reveal.png' });

// 兩名鬼獨立冷卻：甲還在冷卻時，乙可以砸
await B.evaluate(() => { __ph.teleport(-11.2, 2.1, 0); __ph.lookAt(-11.65, 2.1, .3); }); // 面向玩具車
await B.waitForTimeout(250);
const nB0 = await B.evaluate(() => __ph.evLog.filter(e => e.k === 'smash').length);
await B.evaluate(() => __ph.doSmash());
await waitFor(B, n => __ph.evLog.filter(e => e.k === 'smash').length > n, nB0, 5000);
ok('另一名鬼有自己的破壞冷卻，甲在冷卻時乙仍可砸',
  await B.evaluate(() => __ph.evLog.filter(e => e.k === 'smash').slice(-1)[0]?.seekerId === __ph.net.myId)
  && await A.evaluate(() => __ph.smashCdLeft() > 0));

// 砸人不是抓到、不扣血
sS = await st(A);
ok('破壞不算抓到、也不扣鬼的血',
  sS.phase === 'seek' && (sS.players.find(q => q.id === idC)?.alive) && (sS.players.find(q => q.id === idC)?.prop ?? -1) !== undefined
  && (await A.evaluate(() => (__ph.state.hps || []).every(r => r[1] === 100))),
  JSON.stringify({ phase: sS.phase, hps: await A.evaluate(() => __ph.state.hps), c: await C.evaluate(() => ({ alive: __ph.me()?.alive, prop: __ph.me()?.prop })) }));

await A.evaluate(() => __ph.sbDeleteRoom());
const pass = results.filter(r => r[0] === 'PASS').length, fail = results.length - pass;
console.log(`\n==== ${pass} pass / ${fail} fail ====`);
for (const r of results.filter(r => r[0] === 'FAIL')) console.log('FAIL', r[1], r[2]);
await b.close();
process.exit(fail ? 1 : 0);
