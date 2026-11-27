// v7/v9：地圖找人時限、6 人 2 鬼、獨立血量、聲響波紋、三級靠近提示
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
const st = p => p.evaluate(() => { const s = __ph.state; return s && { map: s.map, phase: s.phase, rem: s.rem, hp: s.hp, hps: s.hps, winner: s.winner, reason: s.reason, round: s.round, players: s.players, dice: s.dice }; });
const myId = p => p.evaluate(() => __ph.net.myId);
const waitFor = (p, fn, arg, t = 20000) => p.waitForFunction(fn, arg, { timeout: t });
const desk = { viewport: { width: 1100, height: 700 } };

async function closeAllBut() { /* pages stay; we start fresh rooms */ }

// ========== A. 時限：不覆寫 ?seek=，確認設定值與實際倒數 ==========
const T = await mk('T-host', desk);
const U = await mk('T-join', desk);
const tpages = [T, U];
const tallWait = (fn, arg, t = 8000) => Promise.all(tpages.map(p => waitFor(p, fn, arg, t)));
await T.goto(URL + qs('hide=3&seekerhost=1')); await waitFor(T, () => __ph.ready, null, 60000);
ok('預設找人時限：小家 3 分鐘、辦公室 5 分鐘（未覆寫 ?seek=）', await T.evaluate(() => __ph.seekMs('home') === 180000 && __ph.seekMs('office') === 300000 && __ph.HIDE_MS === 3000), await T.evaluate(() => [__ph.seekMs('home'), __ph.seekMs('office'), __ph.HIDE_MS]));
await T.fill('#nameIn', '時限主'); await T.click('#createBtn'); await T.waitForSelector('#lobby:not(.hidden)', { timeout: 20000 });
const codeT = (await T.textContent('#roomCode')).trim();
await U.goto(URL + qs('')); await waitFor(U, () => __ph.ready, null, 60000);
await U.fill('#nameIn', '時限客'); await U.fill('#codeIn', codeT); await U.click('#joinBtn');
await tallWait(() => __ph.state?.players?.length === 2, null, 20000);
await T.click('#startBtn'); await tallWait(() => __ph.state?.phase === 'hide', null, 15000);
await tallWait(() => __ph.state?.phase === 'seek', null, 15000);
let s = await st(T);
ok('小家開局找人倒數約 3 分鐘', s.map === 'home' && s.phase === 'seek' && s.rem > 175000 && s.rem <= 180000, `map=${s.map} rem=${s.rem}`);
await T.evaluate(() => __ph.skipToSeekRemaining(0));
await tallWait(() => __ph.state?.phase === 'lobby', null, 20000);
await T.click('#mapPick .mapBtn[data-map="office"]');
await tallWait(() => __ph.curMap === 'office');
await T.click('#startBtn'); await tallWait(() => __ph.state?.phase === 'hide', null, 15000);
await tallWait(() => __ph.state?.phase === 'seek', null, 15000);
s = await st(T);
ok('辦公室開局找人倒數約 5 分鐘', s.map === 'office' && s.phase === 'seek' && s.rem > 295000 && s.rem <= 300000, `map=${s.map} rem=${s.rem}`);
await T.evaluate(() => __ph.sbDeleteRoom());
await T.evaluate(() => __ph.skipToSeekRemaining(0));
await tallWait(() => __ph.state?.phase === 'lobby', null, 20000).catch(() => {});
// 從轉送列表拿掉這兩頁，避免干擾後面房間
for (const p of [T, U]) { const i = allPages.indexOf(p); if (i >= 0) allPages.splice(i, 1); await p.context().close(); }

// ========== B. 6 人擲骰：兩鬼與平手重擲（3 個真實分頁 + 3 個主機測試玩家；6 個 WebGL 分頁在本機無法穩定同步狀態）==========
const names = ['房主A', '玩家B', '玩家C', '玩家D', '玩家E', '玩家F'];
const P = [];
for (let i = 0; i < 3; i++) P.push(await mk('P' + i, { viewport: { width: 1100, height: 700 } }));
const allWait = (fn, arg, t = 8000) => Promise.all(P.map(p => waitFor(p, fn, arg, t)));
await P[0].goto(URL + qs('hide=8&seek=90')); await waitFor(P[0], () => __ph.ready, null, 60000);
await P[0].fill('#nameIn', names[0]); await P[0].click('#createBtn'); await P[0].waitForSelector('#lobby:not(.hidden)', { timeout: 20000 });
const code = (await P[0].textContent('#roomCode')).trim();
for (let i = 1; i < 3; i++) {
  await P[i].goto(URL + qs('room=' + code)); await waitFor(P[i], () => __ph.ready, null, 60000);
  await P[i].fill('#nameIn', names[i]); await P[i].click('#joinBtn');
  await P[i].waitForSelector('#lobby:not(.hidden)', { timeout: 20000 });
}
await allWait(() => __ph.state?.players?.length === 3, null, 20000);
await P[0].evaluate(list => __ph.addTestPlayers(list), [
  { name: '玩家D', color: '#c3a6ff', avatar: '🦊' },
  { name: '玩家E', color: '#ffb37e', avatar: '🐼' },
  { name: '玩家F', color: '#7fe0d8', avatar: '🐧' }
]);
await allWait(() => __ph.state?.players?.length === 6, null, 10000);
ok('6 人進房（3 位真人 + 3 位測試玩家）', (await st(P[0])).players.length === 6, (await st(P[0])).players.map(q => q.name).join(','));
const byName = name => (s => s.players.find(q => q.name === name)?.id);
let s0 = await st(P[0]);
const ids = {};
for (let i = 0; i < 6; i++) ids[i] = byName(names[i])(s0);
async function readyHumans() {
  for (const p of P) { const r = await p.evaluate(() => !!__ph.me()?.ready); if (!r) await p.click('#readyBtn'); }
  await allWait(() => __ph.state.players.filter(q => ['房主A','玩家B','玩家C'].includes(q.name)).every(q => q.ready), null, 8000);
}
async function rollAll() {
  // v14：只有房主擲（一次幫大家擲）；鍵還在停用（上一輪骰子還在滾）就用測試鉤子
  const can = await P[0].evaluate(() => { const b = document.getElementById('rollBtn'); return b && !b.disabled && !b.classList.contains('hidden'); });
  if (can) await P[0].click('#rollBtn'); else await P[0].evaluate(() => __ph.hostRoll());
}
async function setRolls(seq) {
  const map = {};
  for (let i = 0; i < seq.length; i++) map[ids[i]] = Array.isArray(seq[i]) ? seq[i].slice() : [seq[i]];
  await P[0].evaluate(m => __ph.setNextRolls(m), map);
}
async function resetAndRoll(seq) {
  await P[0].evaluate(() => __ph.resetDice());
  await allWait(() => !__ph.state.dice || __ph.state.dice.status === 'idle' || __ph.state.players.every(q => !q.roll), null, 8000);
  await setRolls(seq);
  await rollAll();
}

await readyHumans();
ok('6 人時大廳提示要選兩個鬼', /兩人當鬼/.test(await P[1].textContent('#diceMsg')), await P[1].textContent('#diceMsg'));

// B1 明確最低兩人：1,2,3,4,5,6
await setRolls([1, 2, 3, 4, 5, 6]);
await rollAll();
await allWait(() => __ph.state?.dice?.status === 'done', null, 8000);
s = await st(P[0]);
ok('點數 1 與 2 的兩人當鬼（無需重擲）', s.dice.status === 'done' && s.dice.need === 2 && s.dice.seekers.length === 2 && s.dice.seekers.includes(ids[0]) && s.dice.seekers.includes(ids[1]), JSON.stringify(s.dice));
ok('聊天與說明寫出兩位鬼（所有真人畫面）', (await Promise.all(P.map(p => p.evaluate(() => document.getElementById('diceMsg').textContent + '|' + document.getElementById('chatLog').textContent)))).every(t => /房主A/.test(t) && /玩家B/.test(t) && /當鬼/.test(t)));
await P[0].screenshot({ path: SH + 'v7-lobby-2seekers.png' });
await P[1].screenshot({ path: SH + 'v7-lobby-2seekers-other.png' });

// B2 兩個同為最低：1,1,3,4,5,6 → 直接兩人，不重擲
await resetAndRoll([1, 1, 3, 4, 5, 6]);
await allWait(() => __ph.state?.dice?.status === 'done', null, 8000);
s = await st(P[0]);
ok('兩個最低分相同時兩人直接當鬼、不必重擲', s.dice.status === 'done' && s.dice.seekers.includes(ids[0]) && s.dice.seekers.includes(ids[1]) && !(s.dice.tied || []).length, JSON.stringify(s.dice));

// B3 第二名平手：1,2,2,3,4,5 → 1 已當定，兩個 2 重擲
await resetAndRoll([1, 2, 2, 3, 4, 5]);
await allWait(() => __ph.state?.dice?.status === 'tie', null, 8000);
s = await st(P[0]);
ok('第二名平手：已確定 1 個鬼，平手的兩人重擲', s.dice.status === 'tie' && (s.dice.seekers || []).length === 1 && s.dice.seekers[0] === ids[0] && s.dice.tied.sort().join() === [ids[1], ids[2]].sort().join(), JSON.stringify(s.dice));
await P[0].waitForFunction(() => !document.getElementById('rollBtn').disabled, null, { timeout: 8000 }).catch(() => {});
ok('平手時只有房主有重擲鈕（幫平手的人一起擲）', await P[0].evaluate(() => { const b = document.getElementById('rollBtn'); return !b.disabled && !b.classList.contains('hidden') && /平手/.test(b.textContent); }) && await P[1].evaluate(() => document.getElementById('rollBtn').classList.contains('hidden')) && await P[2].evaluate(() => document.getElementById('rollBtn').classList.contains('hidden')));
await setRolls([1, 6, 1, 3, 4, 5]); // B 擲 6、C 擲 1 → C 成為第二個鬼
await P[0].waitForFunction(() => { const b = document.getElementById('rollBtn'); return b && !b.disabled; }, null, { timeout: 8000 }); await P[0].click('#rollBtn');
await allWait(() => __ph.state?.dice?.status === 'done', null, 8000);
s = await st(P[0]);
ok('重擲後選出第二個鬼', s.dice.status === 'done' && s.dice.seekers.includes(ids[0]) && s.dice.seekers.includes(ids[2]) && !s.dice.seekers.includes(ids[1]), JSON.stringify(s.dice));

// B4 三個同最低：1,1,1,4,5,6 → 三人重擲，再擲 2,3,5 → 前兩低當鬼
await resetAndRoll([1, 1, 1, 4, 5, 6]);
await allWait(() => __ph.state?.dice?.status === 'tie', null, 8000);
s = await st(P[0]);
ok('三個最低分平手：三人重擲、尚未確定鬼', s.dice.status === 'tie' && (s.dice.seekers || []).length === 0 && s.dice.tied.length === 3, JSON.stringify(s.dice));
await setRolls([2, 3, 5, 4, 5, 6]);
await P[0].waitForFunction(() => { const b = document.getElementById('rollBtn'); return b && !b.disabled; }, null, { timeout: 8000 }); await P[0].click('#rollBtn');
await allWait(() => __ph.state?.dice?.status === 'done', null, 8000);
s = await st(P[0]);
ok('三人重擲後由較低的兩人當鬼', s.dice.status === 'done' && s.dice.seekers.includes(ids[0]) && s.dice.seekers.includes(ids[1]) && !s.dice.seekers.includes(ids[2]), JSON.stringify(s.dice));

// 開一局確認兩個鬼出生、閉眼、躲藏者對兩名鬼都沒有名牌
await P[0].click('#startBtn'); await allWait(() => __ph.state?.phase === 'hide', null, 15000);
s = await st(P[0]);
const sks = s.players.filter(q => q.role === 'seeker');
const hds = s.players.filter(q => q.role === 'hider');
ok('6 人開局有剛好 2 個鬼、4 個躲藏者', sks.length === 2 && hds.length === 4, JSON.stringify(s.players.map(q => [q.name, q.role])));
const realById = {};
for (let i = 0; i < 3; i++) realById[ids[i]] = P[i];
ok('兩個鬼都在閉眼（真人鬼）', (await Promise.all(sks.filter(q => realById[q.id]).map(q => realById[q.id].isVisible('#blind')))).every(Boolean) && sks.filter(q => realById[q.id]).length === 2);
const skPage = realById[sks[0].id], skPage2 = realById[sks[1].id];
ok('鬼看不到躲藏者名牌（兩名鬼都是）',
  !(await skPage.evaluate(ids => ids.some(id => __ph.labelVisible(id)), hds.map(h => h.id)))
  && !(await skPage2.evaluate(ids => ids.some(id => __ph.labelVisible(id)), hds.map(h => h.id))));
const hdPage = realById[hds.find(h => realById[h.id])?.id] || P[2];
ok('躲藏者看得到鬼的名牌', await hdPage.evaluate(ids => ids.every(id => __ph.labelVisible(id)), sks.map(q => q.id)));
const spawns = await P[0].evaluate(() => __ph.MAPS.home.seekers);
ok('兩個鬼不重疊且在鬼出生點附近', Math.hypot(sks[0].sx - sks[1].sx, sks[0].sz - sks[1].sz) > 1.0 && sks.every(q => spawns.some(sp => Math.hypot(q.sx - sp[0], q.sz - sp[1]) < .05)), JSON.stringify(sks.map(q => [q.sx, q.sz])));
await skPage.screenshot({ path: SH + 'v7-2seekers-blind.png' });

await P[0].evaluate(() => __ph.sbDeleteRoom());
for (const p of P) { const i = allPages.indexOf(p); if (i >= 0) allPages.splice(i, 1); await p.context().close(); }

// ========== C. 3 人 + 強制 2 鬼：獨立血量、噴漆只糊被打中的鬼、聲響波紋 ==========
const A = await mk('A-sk', desk);
const B = await mk('B-sk', desk);
const C = await mk('C-hd', { ...devices['iPhone 13'], defaultBrowserType: undefined });
const pages = [A, B, C];
const cWait = (fn, arg, t = 8000) => Promise.all(pages.map(p => waitFor(p, fn, arg, t)));
await A.goto(URL + qs('hide=4&seek=80')); await waitFor(A, () => __ph.ready, null, 60000);
await A.fill('#nameIn', '鬼甲'); await A.click('#createBtn'); await A.waitForSelector('#lobby:not(.hidden)', { timeout: 20000 });
const codeC = (await A.textContent('#roomCode')).trim();
await B.goto(URL + qs('')); await waitFor(B, () => __ph.ready, null, 60000);
await B.fill('#nameIn', '鬼乙'); await B.fill('#codeIn', codeC); await B.click('#joinBtn');
await C.goto(URL + qs('room=' + codeC)); await waitFor(C, () => __ph.ready, null, 60000);
await C.fill('#nameIn', '躲藏丙'); await C.tap('#joinBtn');
await cWait(() => __ph.state?.players?.length === 3, null, 20000);
const idA = await myId(A), idB = await myId(B), idC = await myId(C);
await A.evaluate(() => __ph.setSeekerNeed(2));
await A.waitForTimeout(300);
ok('測試鉤子可在不足 6 人時改為要 2 個鬼', (await st(A)).dice?.need === 2);
for (const p of pages) { await p.click(p._touch ? '#readyBtn' : '#readyBtn'); }
await cWait(() => __ph.state.players.every(q => q.ready));
await A.evaluate(m => __ph.setNextRolls(m), { [idA]: [1], [idB]: [2], [idC]: [6] });
await A.waitForFunction(() => { const b = document.getElementById('rollBtn'); return b && !b.disabled; }, null, { timeout: 8000 }); await A.click('#rollBtn');
await cWait(() => __ph.state?.dice?.status === 'done');
s = await st(A);
ok('3 人強制 2 鬼：最低兩人當鬼', s.dice.seekers.includes(idA) && s.dice.seekers.includes(idB) && !s.dice.seekers.includes(idC), JSON.stringify(s.dice));
await A.click('#startBtn'); await cWait(() => __ph.state?.phase === 'hide', null, 15000);
await A.evaluate(() => __ph.skipToSeekRemaining(70000));
await cWait(() => __ph.state?.phase === 'seek', null, 8000);
s = await st(A);
ok('兩個鬼都有顏料槍', await A.evaluate(id => !!__ph.hasGun(id), idA) && await B.evaluate(id => !!__ph.hasGun(id), idB));
ok('找人開始時兩人血量都是 100', s.hps?.length === 2 && s.hps.every(r => r[1] === 100), JSON.stringify(s.hps));

// 甲打到客廳沙發：先等到位置同步到主機再射
const sofa = await A.evaluate(() => __ph.PROPS.findIndex((p, i) => i < __ph.HOME_PROP_N && p[0] === 'loungeSofa'));
const sofaP = await A.evaluate(i => __ph.PROPS[i], sofa);
const stand = [sofaP[1] - 2.3, sofaP[2]]; // 茶几這一側，避免站到沙發背後的牆裡
await A.evaluate(([x, z, lx, lz]) => { __ph.teleport(x, z, 0); __ph.lookAt(lx, lz, .35); }, [...stand, sofaP[1], sofaP[2]]);
await waitFor(A, ([x, z]) => { const q = __ph.me(); return q && Math.hypot(q.x - x, q.z - z) < .25; }, stand, 5000);
await A.waitForTimeout(300);
let hitMiss = false;
for (const pitch of [.35, .2, .5]) {
  await A.evaluate(v => { __ph.lookAt(-5.2, 1.5, v); }, pitch);
  await A.waitForTimeout(200);
  const spSofa = await A.evaluate(i => __ph.screenOf('prop', i), sofa);
  if (!spSofa?.onScreen) continue;
  const n0 = await A.evaluate(() => __ph.evLog.filter(e => e.k === 'miss' || e.k === 'wallhit').length);
  await A.mouse.click(spSofa.x, spSofa.y);
  await waitFor(A, n => __ph.evLog.filter(e => e.k === 'miss' || e.k === 'wallhit').length > n, n0, 4000).catch(() => {});
  const last = await A.evaluate(() => __ph.evLog.filter(e => e.k === 'miss' || e.k === 'wallhit').slice(-1)[0]);
  if (last?.k === 'miss') { hitMiss = true; break; }
}
s = await st(A);
const hpA = (s.hps || []).find(r => r[0] === idA)?.[1];
const hpB = (s.hps || []).find(r => r[0] === idB)?.[1];
ok('打到真家具只扣開槍的鬼 10 血，另一個仍 100', hitMiss && hpA === 90 && hpB === 100, JSON.stringify({ hitMiss, hps: s.hps }));

// 丙噴漆打中鬼甲（客廳空地，兩人面對面），只有甲有畫面糊住
await C.evaluate(() => { __ph.teleport(-7.0, 2.5, 0); });
await A.evaluate(() => { __ph.teleport(-7.0, 0.6, 0); });
await B.evaluate(() => { __ph.teleport(7.1, -1.5, 0); });
await waitFor(A, () => { const q = __ph.me(); return q && Math.hypot(q.x + 7, q.z - .6) < .25; }, null, 5000);
await waitFor(C, () => { const q = __ph.me(); return q && Math.hypot(q.x + 7, q.z - 2.5) < .25; }, null, 5000);
await C.evaluate(() => { __ph.lookAt(-7.0, 0.6, .2); __ph.tauntAt(-7.0, 0.55, 0.6); });
await waitFor(A, () => __ph.overlayOpacity() >= 0.5 || __ph.evLog.some(e => e.k === 'painted'), null, 6000).catch(() => {});
const ovA = await A.evaluate(() => __ph.overlayOpacity());
const ovB = await B.evaluate(() => __ph.overlayOpacity());
const ovC = await C.evaluate(() => __ph.overlayOpacity());
ok('噴漆只糊被打中的那名鬼，另一名沒有遮罩', ovA >= 0.5 && ovB < 0.05 && ovC < 0.05, JSON.stringify({ ovA, ovB, ovC }));

// 三級靠近提示：以最近一名還在躲的人距離分 5／3／1 公尺；只有靠近的鬼看得到
function overlapInfo() {
  return (async p => p.evaluate(() => {
    const hit = (a, b) => a.width && b.width && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    const badge = document.getElementById('nearHint')?.getBoundingClientRect();
    const role = document.getElementById('role')?.getBoundingClientRect();
    const topbar = document.getElementById('topbar')?.getBoundingClientRect();
    const toasts = [...document.querySelectorAll('#toasts .toast')].map(t => ({ t: t.textContent, r: t.getBoundingClientRect() }));
    const rows = [];
    if (badge && role) rows.push({ pair: 'badge-role', hit: hit(badge, role) });
    if (badge && topbar) rows.push({ pair: 'badge-topbar', hit: hit(badge, topbar) });
    if (role && topbar) rows.push({ pair: 'role-topbar', hit: hit(role, topbar) });
    for (const t of toasts) {
      if (badge) rows.push({ pair: 'badge-toast:' + t.t, hit: hit(badge, t.r) });
      if (role) rows.push({ pair: 'role-toast:' + t.t, hit: hit(role, t.r) });
      if (topbar) rows.push({ pair: 'topbar-toast:' + t.t, hit: hit(topbar, t.r) });
    }
    return { vis: !document.getElementById('nearHint').classList.contains('hidden'), text: document.getElementById('nearHint')?.textContent, tier: window.__ph?.nearHintTier?.(), rows };
  }));
}
async function injectStartToasts(p) {
  await p.evaluate(() => {
    const box = document.getElementById('toasts');
    box.querySelectorAll('.toast').forEach(d => d.remove());
    for (const t of ['你是鬼！先閉眼 30 秒', '👀 鬼出動了！']) {
      const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; box.appendChild(d);
    }
  });
  await p.waitForTimeout(250);
}
async function placeHider(z) {
  await C.evaluate(z => { __ph.teleport(-7.0, z, 0); }, z);
  await waitFor(A, z => { const q = __ph.state.players.find(p => p.role === 'hider' && p.alive); return q && Math.hypot(q.x + 7, q.z - z) < .3; }, z, 5000);
  await A.waitForTimeout(220);
}
const AX = -7.0, AZ = 1.5;
await A.evaluate(() => { __ph.teleport(-7.0, 1.5, 0); });
await B.evaluate(() => { __ph.teleport(7.1, -1.5, 0); });
await waitFor(A, () => { const q = __ph.me(); return q && Math.hypot(q.x + 7, q.z - 1.5) < .25; }, null, 5000);

// ~4 m → 5 公尺檔
await placeHider(AZ + 4.0); // C at z=5.5, dist 4.0
await A.evaluate(() => { __ph.lookAt(-7.0, 5.5, .45); });
await A.waitForTimeout(200);
const t4 = await A.evaluate(() => ({ vis: __ph.nearHintVisible(), tier: __ph.nearHintTier(), text: __ph.nearHintText(), cfg: [__ph.NEAR_RANGE, __ph.NEAR_MID, __ph.NEAR_CLOSE, __ph.NEAR_HYST] }));
ok('約 4 公尺：靠近的鬼看到「👀 附近有人」（5 公尺檔）', t4.vis && t4.tier === 5 && t4.text === '👀 附近有人' && t4.cfg[0] === 5 && t4.cfg[1] === 3 && t4.cfg[2] === 1, JSON.stringify(t4));
ok('另一名較遠的鬼看不到提示', !(await B.evaluate(() => __ph.nearHintVisible())));
ok('躲藏者自己看不到提示（4 公尺）', !(await C.evaluate(() => __ph.nearHintVisible())) && await C.evaluate(() => document.getElementById('nearHint').classList.contains('hidden')));
await A.screenshot({ path: SH + 'v9-near-5m.png' });
await C.screenshot({ path: SH + 'v9-near-5m-hider.png' });

// ~2 m → 3 公尺檔
await placeHider(AZ + 2.0); // z=3.5, dist 2.0
await A.evaluate(() => { __ph.lookAt(-7.0, 3.5, .4); });
await A.waitForTimeout(200);
const t2 = await A.evaluate(() => ({ vis: __ph.nearHintVisible(), tier: __ph.nearHintTier(), text: __ph.nearHintText() }));
ok('約 2 公尺：靠近的鬼看到「👀 很近了」（3 公尺檔）', t2.vis && t2.tier === 3 && t2.text === '👀 很近了', JSON.stringify(t2));
ok('躲藏者自己看不到提示（2 公尺）', !(await C.evaluate(() => __ph.nearHintVisible())));
await A.screenshot({ path: SH + 'v9-near-3m.png' });

// ~0.8 m → 1 公尺檔
await placeHider(AZ + 0.8); // z=2.3, dist 0.8
await A.evaluate(() => { __ph.lookAt(-7.0, 2.3, .3); });
await A.waitForTimeout(200);
const t08 = await A.evaluate(() => ({ vis: __ph.nearHintVisible(), tier: __ph.nearHintTier(), text: __ph.nearHintText() }));
ok('約 0.8 公尺：靠近的鬼看到「‼️ 就在旁邊！」（1 公尺檔）', t08.vis && t08.tier === 1 && t08.text === '‼️ 就在旁邊！', JSON.stringify(t08));
ok('躲藏者自己看不到提示（0.8 公尺）', !(await C.evaluate(() => __ph.nearHintVisible())));
await A.screenshot({ path: SH + 'v9-near-1m.png' });

// 桌機：最強烈那檔疊上開局 toast，確認不重疊
await injectStartToasts(A);
const ovDesk = await overlapInfo()(A);
ok('桌機：1 公尺提示不與 toast／角色列／頂欄重疊', ovDesk.vis && ovDesk.tier === 1 && ovDesk.rows.every(r => !r.hit), JSON.stringify(ovDesk));

// 手機尋求者（把 B 改成窄視窗走到 0.8 公尺）看最長徽章不重疊
await B.setViewportSize({ width: 390, height: 844 });
await B.waitForTimeout(200);
await B.evaluate(() => { __ph.teleport(-7.0, 3.1, 0); }); // 離丙 0.8 m
await waitFor(B, () => __ph.nearHintTier() === 1, null, 5000);
await injectStartToasts(B);
const ovPhoneSk = await overlapInfo()(B);
ok('手機：1 公尺提示不與 toast／角色列／頂欄重疊', ovPhoneSk.vis && ovPhoneSk.tier === 1 && ovPhoneSk.rows.every(r => !r.hit), JSON.stringify(ovPhoneSk));
await B.screenshot({ path: SH + 'v9-near-1m-mobile.png' });
await B.evaluate(() => { __ph.teleport(7.1, -1.5, 0); });
await waitFor(B, () => !__ph.nearHintVisible(), null, 5000);
await B.setViewportSize({ width: 1100, height: 700 });

// 手機躲藏者（C 本來就是 iPhone）始終沒有徽章，角色列不與頂欄重疊
await injectStartToasts(C);
const ovPhoneHd = await C.evaluate(() => {
  const hit = (a, b) => a.width && b.width && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  const role = document.getElementById('role')?.getBoundingClientRect();
  const topbar = document.getElementById('topbar')?.getBoundingClientRect();
  const badge = document.getElementById('nearHint');
  const badgeHidden = !badge || badge.classList.contains('hidden');
  const toasts = [...document.querySelectorAll('#toasts .toast')].map(t => t.getBoundingClientRect());
  return { badgeHidden, roleTopbar: role && topbar ? hit(role, topbar) : false,
    toastHits: toasts.map(t => ({ role: hit(role, t), topbar: hit(topbar, t) })) };
});
ok('手機：躲藏者看不到提示，且角色列不與頂欄／toast 重疊', ovPhoneHd.badgeHidden && !ovPhoneHd.roleTopbar && ovPhoneHd.toastHits.every(t => !t.role && !t.topbar), JSON.stringify(ovPhoneHd));

// 滯後：從裡面走到約 5.15 m 仍顯示 5 公尺檔；再走到約 5.6 m 才消失
await placeHider(AZ + 5.15);
const tHyst = await A.evaluate(() => ({ vis: __ph.nearHintVisible(), tier: __ph.nearHintTier(), text: __ph.nearHintText() }));
ok('走出 5 公尺後仍在滯後區間 → 仍顯示「附近有人」', tHyst.vis && tHyst.tier === 5 && tHyst.text === '👀 附近有人', JSON.stringify(tHyst));
await placeHider(AZ + 5.6); // 5.6 m，超過 5+0.3
const tOut = await A.evaluate(() => ({ vis: __ph.nearHintVisible(), tier: __ph.nearHintTier() }));
ok('躲藏者走到 5 公尺外（超過滯後）→ 提示消失', !tOut.vis && tOut.tier === 0, JSON.stringify(tOut));

// 最後 1 分鐘聲響
await A.evaluate(() => __ph.skipToSeekRemaining(60000));
await cWait(() => __ph.evLog.some(e => e.k === 'chirp'), null, 8000);
const chirp1 = await A.evaluate(() => __ph.evLog.filter(e => e.k === 'chirp').map(e => e.list));
ok('進入最後 1 分鐘立刻發出聲響（含還在躲的人）', chirp1.length >= 1 && chirp1[0].some(q => q.id === idC), JSON.stringify(chirp1[0]));
await A.waitForTimeout(400);
ok('聲響位置有可見的波紋', (await A.evaluate(() => __ph.chirpPulseCount())) >= 1, 'pulses=' + await A.evaluate(() => __ph.chirpPulseCount()));
await A.evaluate(() => { // 把鏡頭轉到波紋附近好截圖
  const s = __ph.state, me = s.players.find(p => p.id === __ph.net.myId);
  const h = s.players.find(p => p.role === 'hider' && p.alive);
  if (h) { __ph.teleport(h.x + 2.2, h.z + 2.2, 0); __ph.lookAt(h.x, h.z, .9); }
});
await A.waitForTimeout(300);
await A.screenshot({ path: SH + 'v7-chirp-pulse.png' });
await C.screenshot({ path: SH + 'v7-chirp-pulse-hider.png' });

// 等到下一輪（約 20 秒）再叫一次
const n0 = chirp1.length;
await waitFor(A, n => __ph.evLog.filter(e => e.k === 'chirp').length > n, n0, 25000);
const chirp2 = await A.evaluate(() => __ph.evLog.filter(e => e.k === 'chirp'));
ok('約 20 秒後再發出一次聲響', chirp2.length >= n0 + 1, 'count=' + chirp2.length);

// 時間到還有人躲著 → 躲藏者贏
await A.evaluate(() => __ph.skipToSeekRemaining(0));
await cWait(() => __ph.state?.phase === 'end', null, 8000);
s = await st(A);
ok('時間到仍有人躲著 → 躲藏者贏', s.phase === 'end' && s.winner === 'hiders', JSON.stringify([s.phase, s.winner, s.reason]));

await A.evaluate(() => __ph.sbDeleteRoom());
const pass = results.filter(r => r[0] === 'PASS').length, fail = results.length - pass;
console.log(`\n==== ${pass} pass / ${fail} fail ====`);
for (const r of results.filter(r => r[0] === 'FAIL')) console.log('FAIL', r[1], r[2]);
await b.close();
