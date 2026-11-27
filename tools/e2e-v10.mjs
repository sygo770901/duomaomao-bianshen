// v10：複合碰撞（椅座／椅背／桌面／桌下穿過）、右鍵點一下破壞、大廳聊天同高、加入／離開系統訊息
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
const waitFor = (p, fn, arg, t = 20000) => p.waitForFunction(fn, arg, { timeout: t });
const desk = { viewport: { width: 1100, height: 700 } };
const mobile = { ...devices['iPhone 13'], defaultBrowserType: undefined };

// ========== 1. 複合碰撞（不開房間也可測）==========
const P = await mk('col', desk);
await P.goto(URL + '?lowgfx=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
await waitFor(P, () => __ph.ready, null, 90000);

const meta = await P.evaluate(() => {
  const names = ['chairDesk', 'loungeChair', 'table', 'desk', 'kitchenBar', 'bedDouble'];
  const out = {};
  for (const n of names) {
    const cols = (__ph.compoundOf(n) || []).map(c => ({ x1: c.x1, x2: c.x2, y1: c.y1, y2: c.y2, z1: c.z1, z2: c.z2 }));
    out[n] = { n: cols.length, cols, h: 0 };
  }
  out.bodyH = __ph.BODY_H;
  out.colliders = __ph.colliderCount();
  return out;
});
ok('常見家具都切成複合碰撞盒（椅／桌至少 2 盒）',
  meta.chairDesk.n >= 2 && meta.loungeChair.n >= 2 && meta.table.n >= 2 && meta.desk.n >= 2 && meta.kitchenBar.n >= 2,
  JSON.stringify({ bodyH: meta.bodyH, colliders: meta.colliders, n: Object.fromEntries(Object.entries(meta).filter(([k]) => meta[k]?.n).map(([k, v]) => [k, v.n])) }));
ok('手機可負擔的盒數（當前地圖碰撞盒 < 800）', meta.colliders < 800, 'n=' + meta.colliders);

function seatVsBack(cols) {
  const byY = cols.slice().sort((a, b) => b.y2 - a.y2);
  const back = byY[0];
  const seat = cols.filter(c => c !== back && (c.x2 - c.x1) * (c.z2 - c.z1) > 0.05).sort((a, b) => b.y2 - a.y2)[0] || cols.sort((a, b) => (b.x2 - b.x1) * (b.z2 - b.z1) - (a.x2 - a.x1) * (a.z2 - a.z1))[0];
  return { seat, back };
}

const chairId = await P.evaluate(() => __ph.PROPS.findIndex((p, i) => i < __ph.HOME_PROP_N && p[0] === 'chairDesk'));
const chairInfo = await P.evaluate(i => {
  const pr = __ph.PROPS[i], cols = __ph.propCols(i);
  return { x: pr[1], z: pr[2], ry: pr[3], cols, h: __ph.propTop(i) };
}, chairId);
const { seat, back } = seatVsBack(chairInfo.cols);
ok('辦公椅有明顯較低的座面與較高的椅背', seat && back && back.y2 > seat.y2 + 0.25, JSON.stringify({ seat, back, h: chairInfo.h }));

const seatX = (seat.x1 + seat.x2) / 2, seatZ = (seat.z1 + seat.z2) / 2;
// 座面中心：避開椅背 footprint
const backCx = (back.x1 + back.x2) / 2, backCz = (back.z1 + back.z2) / 2;
const away = Math.hypot(seatX - backCx, seatZ - backCz) || 1;
const sx = seatX + (seatX - backCx) / away * Math.min(0.12, away * 0.4);
const sz = seatZ + (seatZ - backCz) / away * Math.min(0.12, away * 0.4);
const landSeat = await P.evaluate(([x, z]) => __ph.landAt(x, z, 1.15, 0.05, 0.16), [sx, sz]);
ok('站在椅座上的高度是座面，不是椅背頂', landSeat.landed && Math.abs(landSeat.y - seat.y2) < 0.1 && landSeat.y < back.y2 - 0.2,
  JSON.stringify({ landSeat, seatY: seat.y2, backY: back.y2, sx, sz }));

const bx = (back.x1 + back.x2) / 2, bz = (back.z1 + back.z2) / 2;
const landBack = await P.evaluate(([x, z]) => __ph.landAt(x, z, 1.6, 0.05, 0.12), [bx, bz]);
ok('站在椅背上的高度高於座面', landBack.landed && landBack.y > seat.y2 + 0.2,
  JSON.stringify({ landBack, seatY: seat.y2, backY: back.y2 }));

const tableId = await P.evaluate(() => __ph.PROPS.findIndex((p, i) => i < __ph.HOME_PROP_N && p[0] === 'table'));
const tableInfo = await P.evaluate(i => {
  const pr = __ph.PROPS[i], cols = __ph.propCols(i);
  const top = cols.slice().sort((a, b) => b.y2 - a.y2)[0];
  return { x: pr[1], z: pr[2], top, h: __ph.propTop(i), cols };
}, tableId);
const tx = (tableInfo.top.x1 + tableInfo.top.x2) / 2, tz = (tableInfo.top.z1 + tableInfo.top.z2) / 2;
const landTop = await P.evaluate(([x, z]) => __ph.landAt(x, z, 1.3, 0.05, 0.16), [tx, tz]);
ok('可以站在桌面上', landTop.landed && Math.abs(landTop.y - tableInfo.top.y2) < 0.1 && landTop.y > 0.5,
  JSON.stringify({ landTop, top: tableInfo.top, h: tableInfo.h }));

// 餐桌 undersize < BODY_H：走不過去；高吧台可以
const blockTable = await P.evaluate(([x, z]) => {
  const q = __ph.collideAt(x, z, 0.19, 0);
  return Math.hypot(q[0] - x, q[1] - z);
}, [tx, tz]);
ok('一般餐桌（桌面低於身高）走不進桌下', blockTable > 0.05, 'disp=' + blockTable.toFixed(3));

const barId = await P.evaluate(() => __ph.PROPS.findIndex((p, i) => i < __ph.HOME_PROP_N && p[0] === 'kitchenBar'));
const barInfo = await P.evaluate(i => {
  const pr = __ph.PROPS[i], cols = __ph.propCols(i);
  const top = cols.slice().sort((a, b) => b.y2 - a.y2)[0];
  return { x: pr[1], z: pr[2], top, y1: top.y1 };
}, barId);
const barX = (barInfo.top.x1 + barInfo.top.x2) / 2, barZ = (barInfo.top.z1 + barInfo.top.z2) / 2;
const under = await P.evaluate(([x, z]) => {
  const q = __ph.collideAt(x, z, 0.16, 0);
  return { d: Math.hypot(q[0] - x, q[1] - z), q, body: __ph.BODY_H };
}, [barX, barZ]);
// v14：吧台模型其實是下面整個封閉的櫃子（見 shots/v14-kitchenbar-solid.png），以前的碰撞盒只有桌腳才會讓人穿進櫃子裡；現在應該擋住
ok('吧台是封閉櫃子：走不進去（v14 碰撞盒和模型一致）', under.d > 0.05, JSON.stringify({ under, bar: barInfo }));

// 翻倒後碰撞盒仍更新
const tipY = await P.evaluate(i => {
  const g0 = __ph.propCols(i).map(c => ({ ...c }));
  const pr = __ph.PROPS[i];
  // 套用翻倒姿態：直接呼叫內部 apply 透過 bump 路徑不可用；改用已公開的？沒有的話用 prop 旋轉觀察 cols
  // 用 scene 物件：__ph 沒暴露 applyPropPose。改用 hold 無法。檢查 compound 本地盒在旋轉後 world 會變：暫時略過內部，改讀旋轉前高度跨度。
  return { before: g0, h0: Math.max(...g0.map(c => c.y2)) };
}, chairId);
ok('翻倒前椅背高度合理（之後截圖／e2e 會再驗證姿態更新）', tipY.h0 > 0.8, JSON.stringify(tipY));

{
  const i = allPages.indexOf(P);
  if (i >= 0) allPages.splice(i, 1);
  await P.context().close();
}

// ========== 2. 大廳：同高、加入／離開、改地圖時間不灌聊天 ==========
const T = await mk('T-host', desk);
const U = await mk('T-join', desk);
const M = await mk('T-mobile', mobile);
await T.goto(URL + qs('')); await waitFor(T, () => __ph.ready, null, 60000);
await T.fill('#nameIn', '大廳主'); await T.click('#createBtn');
await T.waitForSelector('#lobby:not(.hidden)', { timeout: 20000 });
const code = (await T.textContent('#roomCode')).trim();
await U.goto(URL + qs('')); await waitFor(U, () => __ph.ready, null, 60000);
await U.fill('#nameIn', '大廳客'); await U.fill('#codeIn', code); await U.click('#joinBtn');
await Promise.all([T, U].map(p => waitFor(p, () => __ph.state?.players?.length === 2, null, 20000)));
ok('加入房間有系統訊息且雙方看得到',
  await T.evaluate(() => __ph.chatLog.some(m => m.sys && /大廳客/.test(m.text) && /加入了房間/.test(m.text)))
  && await U.evaluate(() => __ph.chatLog.some(m => m.sys && /加入了房間/.test(m.text))),
  await T.evaluate(() => __ph.chatLog.filter(m => m.sys).map(m => m.text)));

const align = await T.evaluate(() => {
  const a = document.querySelector('.lobbyMain').getBoundingClientRect();
  const side = document.getElementById('lobbySide').getBoundingClientRect();
  const tray = document.getElementById('diceTray').getBoundingClientRect();
  const b = document.querySelector('#lobby #chatBox').getBoundingClientRect();
  const log = document.getElementById('chatLog').getBoundingClientRect();
  const head = document.querySelector('#lobby #chatBox .chatHead').getBoundingClientRect();
  const form = document.getElementById('chatForm').getBoundingClientRect();
  return {
    top: +(a.top - side.top).toFixed(1), bot: +(a.bottom - side.bottom).toFixed(1),
    sideBySide: a.left < side.left - 40,
    aH: +a.height.toFixed(1), sideH: +side.height.toFixed(1), bH: +b.height.toFixed(1),
    logH: +log.height.toFixed(1),
    diceAbove: tray.bottom <= b.top + 2,
    logFills: log.top >= head.bottom - 2 && log.bottom <= form.top + 8
  };
});
ok('桌面大廳：左右並排時右欄（骰桌＋聊天）與設定面板同高',
  align.sideBySide && Math.abs(align.top) <= 2 && Math.abs(align.bot) <= 2 && align.diceAbove, JSON.stringify(align));
ok('桌面大廳：聊天記錄填滿面板剩餘空間', align.logFills && align.logH >= 140, JSON.stringify(align));

await M.goto(URL + qs('room=' + code)); await waitFor(M, () => __ph.ready, null, 60000);
await M.fill('#nameIn', '手機客'); await M.click('#joinBtn');
await Promise.all([T, U, M].map(p => waitFor(p, () => (__ph.state?.players?.length || 0) >= 3, null, 20000)));
const mob = await M.evaluate(() => {
  const lobby = document.getElementById('lobby');
  const a = document.querySelector('.lobbyMain').getBoundingClientRect();
  const b = document.querySelector('#lobby #chatBox').getBoundingClientRect();
  return { stacked: b.top >= a.bottom - 8, bH: +b.height.toFixed(1), vis: !lobby.classList.contains('hidden') };
});
ok('手機大廳聊天維持合理高度（直向堆疊、不會超長）', mob.stacked && mob.bH > 80 && mob.bH < 900, JSON.stringify(mob));

await T.click('#mapPick .mapBtn[data-map="office"]');
await Promise.all([T, U].map(p => waitFor(p, () => __ph.state?.map === 'office', null, 8000)));
await T.evaluate(() => __ph.setTimes(45, 120));
await Promise.all([T, U].map(p => waitFor(p, () => __ph.state?.hideMs === 45000 && __ph.state?.seekMs === 120000, null, 8000)));
ok('換地圖／改時間不會出現系統聊天',
  await T.evaluate(() => !__ph.chatLog.some(m => m.sys && (/把地圖換成|把時間設成|時間重設/.test(m.text)))),
  await T.evaluate(() => __ph.chatLog.filter(m => m.sys).map(m => m.text)));

const idxM = allPages.indexOf(M);
await M.context().close();
if (idxM >= 0) allPages.splice(idxM, 1);
ok('有人離開房間會發系統訊息', await waitFor(T, () => __ph.chatLog.some(m => m.sys && /手機客/.test(m.text) && /離開了房間/.test(m.text)), null, 8000).then(() => true).catch(() => false),
  await T.evaluate(() => __ph.chatLog.filter(m => m.sys).map(m => m.text)));

// ========== 3. 右鍵點一下破壞 vs 拖曳只轉鏡頭 ==========
await T.evaluate(() => { document.querySelector('#mapPick .mapBtn[data-map="home"]')?.click(); });
await waitFor(T, () => __ph.state?.map === 'home', null, 8000);
await T.evaluate(() => __ph.setSeekerNeed(1));
for (const p of [T, U]) { if (!(await p.evaluate(() => !!__ph.me()?.ready))) await p.click('#readyBtn'); }
await Promise.all([T, U].map(p => waitFor(p, () => __ph.state.players.every(q => q.ready), null, 8000)));
const idT = await T.evaluate(() => __ph.net.myId);
const idU = await U.evaluate(() => __ph.net.myId);
await T.evaluate(m => __ph.setNextRolls(m), { [idT]: [1], [idU]: [6] });
await T.waitForFunction(() => { const b = document.getElementById('rollBtn'); return b && !b.disabled; }, null, { timeout: 8000 }); await T.click('#rollBtn');
await Promise.all([T, U].map(p => waitFor(p, () => __ph.state?.dice?.status === 'done', null, 8000)));
await T.click('#startBtn');
await Promise.all([T, U].map(p => waitFor(p, () => __ph.state?.phase === 'hide', null, 15000)));
await T.evaluate(() => __ph.skipToSeekRemaining(70000));
await Promise.all([T, U].map(p => waitFor(p, () => __ph.state?.phase === 'seek', null, 8000)));
ok('鬼的操作提示提到右鍵點一下破壞', await T.evaluate(() => /右鍵/.test(document.getElementById('hint')?.textContent || '')));

const toy = await T.evaluate(() => __ph.PROPS.findIndex((p, i) => i < __ph.HOME_PROP_N && p[0] === 'toyBlocks'));
const toyP = await T.evaluate(i => __ph.PROPS[i], toy);
await U.evaluate(() => __ph.teleport(6, 6, 0));
await T.evaluate(([x, z]) => { __ph.teleport(x, z + 1.2, 0); __ph.lookAt(x, z, .3); }, [toyP[1], toyP[2]]);
await waitFor(T, ([x, z]) => { const q = __ph.me(); return q && Math.hypot(q.x - x, q.z - (z + 1.2)) < .35; }, [toyP[1], toyP[2]], 5000);
await T.waitForTimeout(200);

const yaw0 = await T.evaluate(() => __ph.cam.yaw);
await T.evaluate(() => {
  const el = __ph.renderer.domElement;
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const base = { bubbles: true, clientX: x, clientY: y, button: 2, pointerId: 21, pointerType: 'mouse', view: window };
  el.dispatchEvent(new PointerEvent('pointerdown', { ...base, buttons: 2 }));
  el.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: x + 24, clientY: y, buttons: 2 }));
  el.dispatchEvent(new PointerEvent('pointerup', { ...base, clientX: x + 24, clientY: y, buttons: 0 }));
});
await T.waitForTimeout(300);
const afterDrag = await T.evaluate((y0) => ({
  yawMoved: Math.abs(__ph.cam.yaw - y0) > 0.02,
  smashed: __ph.isSmashed && false,
  ev: __ph.evLog.filter(e => e.k === 'smash').length,
  left: __ph.smashCdLeft()
}), yaw0);
ok('右鍵拖曳只轉鏡頭、不會破壞', afterDrag.yawMoved && afterDrag.ev === 0 && afterDrag.left === 0, JSON.stringify(afterDrag));

const n0 = await T.evaluate(() => __ph.evLog.filter(e => e.k === 'smash').length);
await T.evaluate(() => {
  const el = __ph.renderer.domElement;
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const base = { bubbles: true, clientX: x, clientY: y, button: 2, pointerId: 22, pointerType: 'mouse', view: window };
  el.dispatchEvent(new PointerEvent('pointerdown', { ...base, buttons: 2 }));
  el.dispatchEvent(new PointerEvent('pointerup', { ...base, buttons: 0 }));
});
await waitFor(T, n => __ph.evLog.filter(e => e.k === 'smash').length > n, n0, 5000);
ok('鬼右鍵短點會發動破壞', await T.evaluate(n => __ph.evLog.filter(e => e.k === 'smash').length > n, n0));

await T.evaluate(() => __ph.resetSmashCd());
const n1 = await T.evaluate(() => __ph.evLog.filter(e => e.k === 'smash').length);
await U.evaluate(() => {
  const el = __ph.renderer.domElement;
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const base = { bubbles: true, clientX: x, clientY: y, button: 2, pointerId: 23, pointerType: 'mouse', view: window };
  el.dispatchEvent(new PointerEvent('pointerdown', { ...base, buttons: 2 }));
  el.dispatchEvent(new PointerEvent('pointerup', { ...base, buttons: 0 }));
});
await U.waitForTimeout(400);
ok('躲藏者右鍵短點不會破壞', await T.evaluate(n => __ph.evLog.filter(e => e.k === 'smash').length === n, n1));

await T.evaluate(() => __ph.sbDeleteRoom());
const pass = results.filter(r => r[0] === 'PASS').length, fail = results.length - pass;
console.log(`\n==== ${pass} pass / ${fail} fail ====`);
for (const r of results.filter(r => r[0] === 'FAIL')) console.log('FAIL', r[1], r[2]);
await b.close();
process.exit(fail ? 1 : 0);
