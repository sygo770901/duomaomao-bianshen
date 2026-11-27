// v15：手機鏡頭拉遠、走路時可跳、衝刺鍵按住拖曳轉鏡頭、遊戲中聊天改成半透明小欄且送出後自動收起；大廳骰桌移到右欄、名牌加大且不蓋住骰子
import { chromium, devices } from 'playwright-core';
const URL = process.env.URL || 'http://localhost:8765/';
const results = [];
const ok = (name, cond, info = '') => { results.push([cond ? 'PASS' : 'FAIL', name, info]); console.log(cond ? 'PASS' : 'FAIL', name, info); };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = [];
const waitFor = (p, fn, arg, t = 20000) => p.waitForFunction(fn, arg, { timeout: t });
const pages = [];
const relay = m => { for (const q of pages) q.evaluate(m => window.__localnetIn && window.__localnetIn(m), m).catch(() => { }); };
async function mk(name, opts) {
  const ctx = await b.newContext(opts);
  await ctx.exposeBinding('__relay', (src, m) => relay(m));
  const p = await ctx.newPage();
  pages.push(p);
  p._n = name; p._touch = !!opts.hasTouch;
  p.on('pageerror', e => { errs.push(name + ': ' + e.message); console.log(`[${name} err]`, e.message); });
  return p;
}

const desk = await mk('desk', { viewport: { width: 1280, height: 720 } });
const mob = await mk('mob', { ...devices['iPhone 13'], defaultBrowserType: undefined });

await desk.goto(URL + '?net=local&lowgfx=1&hide=200&seek=200&seekerhost=1');
await waitFor(desk, () => __ph.ready, null, 60000);
await desk.fill('#nameIn', '房主'); await desk.click('#createBtn');
await desk.waitForSelector('#lobby:not(.hidden)', { timeout: 20000 });
const code = (await desk.textContent('#roomCode')).trim();
await mob.goto(URL + '?net=local&lowgfx=1');
await waitFor(mob, () => __ph.ready, null, 60000);
await mob.fill('#nameIn', '手機'); await mob.fill('#codeIn', code); await mob.tap('#joinBtn');
await waitFor(desk, () => __ph.state?.players?.length === 2, null, 20000);

ok('手機被辨識為觸控、電腦不是', await mob.evaluate(() => __ph.isTouch() && document.body.classList.contains('touch'))
  && await desk.evaluate(() => !__ph.isTouch()), '');

// ---- 大廳：骰桌在右欄、與左側設定同高；手機直向改上下堆疊 ----
const SH = '../shots/';
const layDesk = await desk.evaluate(() => {
  const main = document.querySelector('.lobbyMain'), side = document.getElementById('lobbySide');
  const tray = document.getElementById('diceTray'), chat = document.getElementById('chatBox');
  const mr = main.getBoundingClientRect(), sr = side.getBoundingClientRect(), tr = tray.getBoundingClientRect(), cr = chat.getBoundingClientRect();
  return {
    twoCol: sr.left >= mr.right - 2,
    diceInLeft: main.contains(tray),
    diceInSide: side.contains(tray),
    chatInSide: side.contains(chat),
    diceAboveChat: tr.bottom <= cr.top + 2,
    hMain: Math.round(mr.height), hSide: Math.round(sr.height),
    dh: Math.abs(mr.height - sr.height), dt: Math.abs(mr.top - sr.top),
    chatLogH: Math.round(document.getElementById('chatLog').getBoundingClientRect().height),
    trayH: Math.round(tr.height),
  };
});
ok('桌機大廳：3D 骰桌在右欄、不在左側設定區', layDesk.twoCol && !layDesk.diceInLeft && layDesk.diceInSide && layDesk.chatInSide, JSON.stringify(layDesk));
ok('桌機大廳：右欄骰桌在聊天上方，兩欄高度一致', layDesk.diceAboveChat && layDesk.dh <= 2 && layDesk.dt <= 2, JSON.stringify(layDesk));

const layMob = await mob.evaluate(() => {
  const main = document.querySelector('.lobbyMain'), side = document.getElementById('lobbySide');
  const tray = document.getElementById('diceTray'), chat = document.getElementById('chatBox');
  const mr = main.getBoundingClientRect(), sr = side.getBoundingClientRect(), tr = tray.getBoundingClientRect(), cr = chat.getBoundingClientRect();
  const over = [...document.querySelectorAll('#lobby *')].filter(e => e.offsetParent && e.getBoundingClientRect().right > innerWidth + 1).map(e => e.id || e.className).slice(0, 5);
  return {
    stacked: sr.top >= mr.bottom - 2,
    diceInLeft: main.contains(tray),
    diceInSide: side.contains(tray),
    chatInSide: side.contains(chat),
    diceAboveChat: tr.bottom <= cr.top + 2,
    trayW: Math.round(tr.width), trayH: Math.round(tr.height), vw: innerWidth,
    sw: document.documentElement.scrollWidth, over,
  };
});
ok('手機大廳：設定、骰桌、聊天由上而下堆疊，骰桌不在左欄、不撐寬頁面', layMob.stacked && !layMob.diceInLeft && layMob.diceInSide && layMob.chatInSide && layMob.diceAboveChat && layMob.trayW <= layMob.vw && layMob.sw <= layMob.vw + 1 && layMob.over.length === 0 && layMob.trayH >= 120, JSON.stringify(layMob));


const dDist = await desk.evaluate(() => __ph.camIdealDist());
const mDist = await mob.evaluate(() => __ph.camIdealDist());
ok('手機第三人稱鏡頭理想距離明顯大於電腦', mDist > dDist + 1.0 && mDist >= 4.0 && dDist === 2.8, JSON.stringify({ dDist, mDist }));

// 等一幀讓鏡頭走到新距離（大廳也能走）
await mob.evaluate(() => { __ph.teleport(-6, 0, 0); __ph.lookAt(-10, 0, .35); });
await desk.evaluate(() => { __ph.teleport(-6, 0, 0); __ph.lookAt(-10, 0, .35); });
await mob.waitForTimeout(450); await desk.waitForTimeout(450);
const dPull = await desk.evaluate(() => __ph.camPullDist());
const mPull = await mob.evaluate(() => __ph.camPullDist());
ok('開闊處實際鏡頭距離：手機明顯比電腦遠', mPull > dPull + 0.8, JSON.stringify({ dDist, mDist, dPull, mPull }));

// ---- 開局後才有跳／衝刺／遊戲聊天（大廳 HUD 是關的）----
const pids = await desk.evaluate(() => Object.fromEntries(__ph.state.players.map(q => [q.name, q.id])));
await desk.evaluate(m => { __ph.setNextRolls(m); }, { [pids['房主']]: [2], [pids['手機']]: [6] });
await desk.click('#readyBtn'); await mob.tap('#readyBtn');
await waitFor(desk, () => !document.getElementById('rollBtn').disabled, null, 8000).catch(() => {});
await desk.click('#rollBtn');
await waitFor(desk, () => __ph.state?.dice?.status === 'done', null, 20000);

await desk.waitForTimeout(400);
const tagsDesk = await desk.evaluate(() => {
  const pr = __ph.diceTray.projected();
  const inside = p => Math.abs(p[0]) <= 1.02 && Math.abs(p[1]) <= 1.02;
  const sz = __ph.diceTray.tagSize();
  return {
    n: pr.dice.length,
    overlapDie: pr.dice.filter(d => d.overlapDie).map(d => d.id),
    tagOverlap: !!pr.tagOverlap,
    allIn: pr.corners.every(inside) && pr.dice.every(d => inside(d.p) && inside(d.tag)),
    tagSize: sz,
    minPxH: Math.min(...pr.dice.map(d => +d.tagPx.h.toFixed(1))),
    minPxW: Math.min(...pr.dice.map(d => +d.tagPx.w.toFixed(1))),
    dice: pr.dice.map(d => ({ id: d.id, p: d.p.map(v => +v.toFixed(2)), tag: d.tag.map(v => +v.toFixed(2)), overlapDie: d.overlapDie, tagPx: { w: +d.tagPx.w.toFixed(1), h: +d.tagPx.h.toFixed(1) } })),
  };
});
ok('桌機大廳：名牌不蓋住骰子、名牌互不重疊，且都在畫布內', tagsDesk.n === 2 && tagsDesk.overlapDie.length === 0 && !tagsDesk.tagOverlap && tagsDesk.allIn, JSON.stringify(tagsDesk));
ok('桌機大廳：名牌明顯放大、看得清楚（約 2 倍）', tagsDesk.minPxH >= 28 && tagsDesk.minPxW >= 70, JSON.stringify(tagsDesk));
const tagsMob = await mob.evaluate(() => {
  const pr = __ph.diceTray.projected();
  const inside = p => Math.abs(p[0]) <= 1.02 && Math.abs(p[1]) <= 1.02;
  const sz = __ph.diceTray.tagSize();
  return {
    n: pr.dice.length,
    overlapDie: pr.dice.filter(d => d.overlapDie).map(d => d.id),
    tagOverlap: !!pr.tagOverlap,
    allIn: pr.corners.every(inside) && pr.dice.every(d => inside(d.p) && inside(d.tag)),
    tagSize: sz,
    minPxH: Math.min(...pr.dice.map(d => +d.tagPx.h.toFixed(1))),
    minPxW: Math.min(...pr.dice.map(d => +d.tagPx.w.toFixed(1))),
  };
});
ok('手機大廳：名牌不蓋住骰子、名牌互不重疊，且都在畫布內', tagsMob.n === 2 && tagsMob.overlapDie.length === 0 && !tagsMob.tagOverlap && tagsMob.allIn, JSON.stringify(tagsMob));
ok('手機大廳：名牌明顯放大、看得清楚（約 2 倍）', tagsMob.minPxH >= 26 && tagsMob.minPxW >= 70, JSON.stringify(tagsMob));
await desk.evaluate(() => document.getElementById('lobby').scrollTo?.(0, 0));
await desk.screenshot({ path: SH + 'v15-lobby-desktop.png' });
await mob.evaluate(() => document.getElementById('lobby').scrollTo?.(0, 0));
await mob.screenshot({ path: SH + 'v15-lobby-phone.png' });
await mob.evaluate(() => document.getElementById('lobbySide').scrollIntoView({ block: 'start' }));
await mob.waitForTimeout(200);
await mob.screenshot({ path: SH + 'v15-lobby-phone-side.png' });
await desk.evaluate(() => document.getElementById('diceTray').scrollIntoView({ block: 'center' }));
await desk.waitForTimeout(150);
await desk.locator('#diceTray').screenshot({ path: SH + 'v15-lobby-dice-tags.png' });
await mob.evaluate(() => document.getElementById('diceTray').scrollIntoView({ block: 'center' }));
await mob.waitForTimeout(150);
await mob.locator('#diceTray').screenshot({ path: SH + 'v15-lobby-dice-tags-phone.png' });

await desk.waitForSelector('#startBtn:not([disabled])', { timeout: 15000 });
await desk.click('#startBtn');
await waitFor(mob, () => __ph.state?.phase === 'hide', null, 15000);
await mob.waitForSelector('#moveBtns:not(.hidden)', { timeout: 8000 });
ok('遊戲中看得到跳與衝刺鈕', await mob.evaluate(() => {
  const m = document.getElementById('moveBtns');
  return m && !m.classList.contains('hidden') && getComputedStyle(m).display !== 'none';
}));

const ev = (sel, type, x, y, id) => mob.dispatchEvent(sel, type, { pointerId: id, pointerType: 'touch', isPrimary: id === 21, clientX: x, clientY: y, bubbles: true, buttons: 1 });

// ---- 走路時可跳：先按住搖桿，再 pointerdown 跳躍 ----
await mob.evaluate(() => { __ph.teleport(-6, 0, 0); __ph.lookAt(-10, 0, .35); __ph.local.y = 0; __ph.local.vy = 0; __ph.local.grounded = true; });
await mob.waitForTimeout(150);
const joyBox = await mob.locator('#joy').boundingBox();
const jmpBox = await mob.locator('#jumpBtn').boundingBox();
if (!joyBox || !jmpBox) {
  ok('按住搖桿時跳躍鈕仍能跳起來', false, 'missing ' + JSON.stringify({ joyBox, jmpBox }));
} else {
  await ev('#joy', 'pointerdown', joyBox.x + joyBox.width / 2, joyBox.y + joyBox.height / 2, 21);
  await ev('#joy', 'pointermove', joyBox.x + joyBox.width / 2, joyBox.y + 20, 21);
  await mob.waitForTimeout(80);
  const joyBefore = await mob.evaluate(() => ({ jx: __ph.joy.x, jy: __ph.joy.y, y: __ph.local.y, vy: __ph.local.vy ?? 0, q: __ph.jumpQueued }));
  await ev('#jumpBtn', 'pointerdown', jmpBox.x + jmpBox.width / 2, jmpBox.y + jmpBox.height / 2, 22);
  await mob.waitForTimeout(200);
  const joyAfter = await mob.evaluate(() => ({ jx: __ph.joy.x, jy: __ph.joy.y, y: __ph.local.y, vy: __ph.local.vy ?? 0, q: __ph.jumpQueued }));
  ok('按住搖桿時跳躍鈕仍能跳起來', (joyAfter.vy > 1 || joyAfter.y > 0.15) && (Math.abs(joyBefore.jy) > 0.1 || Math.abs(joyAfter.jy) > 0.1), JSON.stringify({ joyBefore, joyAfter }));
  await ev('#jumpBtn', 'pointerup', jmpBox.x + jmpBox.width / 2, jmpBox.y + jmpBox.height / 2, 22);
  await ev('#joy', 'pointerup', joyBox.x + joyBox.width / 2, joyBox.y + 20, 21);
}
await mob.evaluate(() => { __ph.joy.x = 0; __ph.joy.y = 0; });

// ---- 衝刺：按住並拖曳會轉鏡頭，而且仍保持衝刺 ----
await mob.evaluate(() => { __ph.teleport(-6, 0, 0); __ph.lookAt(-10, 0, .35); __ph.local.y = 0; __ph.local.vy = 0; });
await mob.waitForTimeout(150);
const yaw0 = await mob.evaluate(() => __ph.cam.yaw);
const spBox = await mob.locator('#sprintBtn').boundingBox();
if (!spBox) {
  ok('按住衝刺並拖曳會轉鏡頭，且仍保持衝刺', false, 'no sprintBtn box');
  ok('放開衝刺鈕後停止衝刺', false, '');
} else {
  const sx = spBox.x + spBox.width / 2, sy = spBox.y + spBox.height / 2;
  await ev('#sprintBtn', 'pointerdown', sx, sy, 31);
  await mob.waitForTimeout(40);
  const holding = await mob.evaluate(() => __ph.sprintHold);
  await ev('#sprintBtn', 'pointermove', sx + 80, sy, 31);
  await ev('#sprintBtn', 'pointermove', sx + 160, sy, 31);
  await mob.waitForTimeout(80);
  const afterDash = await mob.evaluate(() => ({ hold: __ph.sprintHold, yaw: __ph.cam.yaw }));
  ok('按住衝刺並拖曳會轉鏡頭，且仍保持衝刺', holding && afterDash.hold && Math.abs(afterDash.yaw - yaw0) > 0.15, JSON.stringify({ yaw0, holding, afterDash }));
  await ev('#sprintBtn', 'pointerup', sx + 160, sy, 31);
  const afterUp = await mob.evaluate(() => __ph.sprintHold);
  ok('放開衝刺鈕後停止衝刺', afterUp === false, '');
}

await mob.waitForSelector('#chatToggle:not(.hidden)', { timeout: 8000 });

const closed0 = await mob.evaluate(() => document.getElementById('chatBox').classList.contains('collapsed'));
ok('進遊戲時聊天欄是收合的', closed0);

await mob.tap('#chatToggle');
await mob.waitForTimeout(250);
const layout = await mob.evaluate(() => {
  const box = document.getElementById('chatBox');
  const r = box.getBoundingClientRect();
  const cx = innerWidth / 2, cy = innerHeight / 2;
  const coversCenter = r.left < cx && r.right > cx && r.top < cy && r.bottom > cy;
  const cs = getComputedStyle(box);
  const bg = cs.backgroundColor;
  const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
  const alpha = m ? (m[4] != null ? +m[4] : 1) : 1;
  return { t: +r.top.toFixed(1), b: +r.bottom.toFixed(1), h: +r.height.toFixed(1), w: +r.width.toFixed(1), coversCenter, alpha, collapsed: box.classList.contains('collapsed'), vw: innerWidth, vh: innerHeight, hideBtn: getComputedStyle(document.getElementById('chatHide')).display };
});
ok('手機遊戲中聊天是精簡半透明欄，不蓋住畫面中央，也不用按收合', !layout.collapsed && !layout.coversCenter && layout.h < layout.vh * 0.4 && layout.alpha > 0 && layout.alpha <= 0.7 && layout.hideBtn === 'none', JSON.stringify(layout));
await mob.screenshot({ path: '../shots/v15-chat-open.png' });

await mob.fill('#chatIn', '手機短訊');
await mob.tap('#chatSend');
await mob.waitForTimeout(300);
const afterSend = await mob.evaluate(() => ({
  collapsed: document.getElementById('chatBox').classList.contains('collapsed'),
  focused: document.activeElement === document.getElementById('chatIn'),
  feed: document.getElementById('chatFeed')?.textContent || '',
}));
ok('送出訊息後聊天欄自動收合，不必再按收合', afterSend.collapsed && !afterSend.focused && /手機短訊/.test(afterSend.feed), JSON.stringify(afterSend));

// 電腦端聊天仍是側欄、送出後收合（回歸）
await desk.keyboard.press('Enter');
await desk.waitForTimeout(150);
const deskOpen = await desk.evaluate(() => !document.getElementById('chatBox').classList.contains('collapsed'));
await desk.fill('#chatIn', '桌機還是側欄');
await desk.keyboard.press('Enter');
await desk.waitForTimeout(200);
const deskAfter = await desk.evaluate(() => document.getElementById('chatBox').classList.contains('collapsed'));
ok('電腦版遊戲中聊天仍是側欄，送出後會收合', deskOpen && deskAfter);

ok('沒有頁面錯誤', errs.length === 0, errs.join(' | '));
const fail = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - fail} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
