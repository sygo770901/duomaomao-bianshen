// v17：收緊骰桌鏡頭、縮短骰盤高度，聊天紀錄加高；名牌仍清楚且不蓋住骰子；右欄與左欄同高
import { chromium, devices } from 'playwright-core';
import { readFileSync } from 'fs';
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

const SH = '../shots/';
// 舊版（v15）桌機：clamp(150px, 22vh, 230px)；手機直式：clamp(160px, 42vw, 220px)
const OLD = {
  '1366x768': Math.min(230, Math.max(150, 0.22 * 768)), // 168.96
  '1920x1080': Math.min(230, Math.max(150, 0.22 * 1080)), // 230
  phoneH: Math.min(220, Math.max(160, 0.42 * 390)), // 163.8
  phoneW: 366,
};

const a1366 = await mk('a1366', { viewport: { width: 1366, height: 768 } });
const a1920 = await mk('a1920', { viewport: { width: 1920, height: 1080 } });
const mob = await mk('mob', { ...devices['iPhone 13'], defaultBrowserType: undefined });

await a1366.goto(URL + '?net=local&lowgfx=1&hide=200&seek=200');
await waitFor(a1366, () => __ph.ready, null, 60000);
await a1366.fill('#nameIn', '房主'); await a1366.click('#createBtn');
await a1366.waitForSelector('#lobby:not(.hidden)', { timeout: 20000 });
const code = (await a1366.textContent('#roomCode')).trim();

await a1920.goto(URL + '?net=local&lowgfx=1');
await waitFor(a1920, () => __ph.ready, null, 60000);
await a1920.fill('#nameIn', '寬螢幕'); await a1920.fill('#codeIn', code); await a1920.click('#joinBtn');

await mob.goto(URL + '?net=local&lowgfx=1');
await waitFor(mob, () => __ph.ready, null, 60000);
await mob.fill('#nameIn', '手機'); await mob.fill('#codeIn', code); await mob.tap('#joinBtn');
await waitFor(a1366, () => __ph.state?.players?.length === 3, null, 20000);

function layout(p) {
  return p.evaluate(() => {
    const main = document.querySelector('.lobbyMain'), side = document.getElementById('lobbySide');
    const tray = document.getElementById('diceTray'), chat = document.getElementById('chatBox');
    const log = document.getElementById('chatLog'), inn = document.getElementById('chatIn');
    const mr = main.getBoundingClientRect(), sr = side.getBoundingClientRect();
    const tr = tray.getBoundingClientRect(), cr = chat.getBoundingClientRect();
    const lr = log.getBoundingClientRect(), ir = inn.getBoundingClientRect();
    const over = [...document.querySelectorAll('#lobby *')].filter(e => e.offsetParent && e.getBoundingClientRect().right > innerWidth + 1).map(e => e.id || e.className).slice(0, 5);
    return {
      twoCol: sr.left >= mr.right - 2,
      stacked: sr.top >= mr.bottom - 2,
      diceInLeft: main.contains(tray),
      diceInSide: side.contains(tray),
      chatInSide: side.contains(chat),
      diceAboveChat: tr.bottom <= cr.top + 2,
      hMain: +mr.height.toFixed(2), hSide: +sr.height.toFixed(2),
      dh: Math.abs(mr.height - sr.height), dt: Math.abs(mr.top - sr.top),
      trayW: +tr.width.toFixed(2), trayH: +tr.height.toFixed(2),
      chatH: +cr.height.toFixed(2), logH: +lr.height.toFixed(2),
      inputW: +ir.width.toFixed(2), inputH: +ir.height.toFixed(2),
      inputOn: ir.height > 16 && ir.width > 80 && ir.bottom <= innerHeight + sr.height, // may be below fold
      vw: innerWidth, vh: innerHeight,
      sw: document.documentElement.scrollWidth, over,
    };
  });
}

const l1366 = await layout(a1366);
const need1366 = 2.5 * OLD['1366x768'];
ok('1366x768：骰桌仍夠大且比聊天紀錄矮（把高度讓給聊天）', l1366.trayH >= 260 && l1366.trayH <= 320 && l1366.logH > 200, JSON.stringify({ trayH: l1366.trayH, logH: l1366.logH, v16tray: 422.39, v16log: 279.38 }));
ok('1366x768：骰桌在右欄且佔滿右欄寬度，不在左欄', l1366.twoCol && !l1366.diceInLeft && l1366.diceInSide && l1366.chatInSide && l1366.trayW >= 360, JSON.stringify(l1366));
const sideW1366 = await a1366.evaluate(() => document.getElementById('lobbySide').getBoundingClientRect().width);
ok('1366x768：骰桌寬度等於右欄', Math.abs(l1366.trayW - sideW1366) <= 2, JSON.stringify({ trayW: l1366.trayW, sideW: +sideW1366.toFixed(2) }));
ok('1366x768：右欄（骰桌＋聊天）與左欄同高，骰桌在聊天上方', l1366.diceAboveChat && l1366.dh <= 2 && l1366.dt <= 2, JSON.stringify(l1366));
ok('1366x768：聊天紀錄仍夠高、輸入可見', l1366.logH >= 200 && l1366.inputW >= 80 && l1366.inputH >= 24, JSON.stringify({ logH: l1366.logH, inputW: l1366.inputW, inputH: l1366.inputH, chatH: l1366.chatH }));

const l1920 = await layout(a1920);
const need1920 = 2.5 * OLD['1920x1080'];
ok('1920x1080：骰桌縮短、聊天紀錄至少約 6–8 行（≥150px）', l1920.trayH >= 260 && l1920.trayH <= 320 && l1920.logH >= 150, JSON.stringify({ trayH: l1920.trayH, logH: l1920.logH, chatH: l1920.chatH, v16tray: 575, v16log: 66.78 }));
ok('1920x1080：骰桌在右欄、佔滿右欄寬度，兩欄同高，輸入可見', l1920.twoCol && !l1920.diceInLeft && l1920.diceInSide && l1920.diceAboveChat && l1920.dh <= 2 && l1920.dt <= 2 && l1920.inputW >= 80 && l1920.inputH >= 24 && l1920.trayW >= 360, JSON.stringify(l1920));

const lMob = await layout(mob);
const oldArea = OLD.phoneW * OLD.phoneH, newArea = lMob.trayW * lMob.trayH;
ok('手機直式：骰桌滿寬、高度收緊、不撐寬頁面', lMob.stacked && !lMob.diceInLeft && lMob.diceInSide && lMob.diceAboveChat && lMob.trayW >= lMob.vw * 0.85 && lMob.trayH >= 240 && lMob.trayH <= 320 && lMob.sw <= lMob.vw + 1 && lMob.over.length === 0, JSON.stringify({ gotW: lMob.trayW, gotH: lMob.trayH, v16h: 409.5, ...lMob }));
ok('手機直式：聊天仍可用且紀錄不比 v16 更矮', lMob.logH >= 120 && lMob.inputW >= 80 && lMob.inputH >= 24, JSON.stringify({ logH: lMob.logH, inputW: lMob.inputW, inputH: lMob.inputH, chatH: lMob.chatH }));

function tags(p) {
  return p.evaluate(() => {
    const pr = __ph.diceTray.projected();
    const inside = x => Math.abs(x[0]) <= 1.02 && Math.abs(x[1]) <= 1.02;
    const sz = __ph.diceTray.tagSize() || pr.tagSize;
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
}

const pids = await a1366.evaluate(() => Object.fromEntries(__ph.state.players.map(q => [q.name, q.id])));
await a1366.evaluate(m => __ph.setNextRolls(m), { [pids['房主']]: [2], [pids['寬螢幕']]: [5], [pids['手機']]: [6] });
await a1366.click('#readyBtn'); await a1920.click('#readyBtn'); await mob.tap('#readyBtn');
await waitFor(a1366, () => !document.getElementById('rollBtn').disabled, null, 8000).catch(() => {});
await a1366.evaluate(() => document.getElementById('diceTray').scrollIntoView({ block: 'center' }));
await a1366.waitForTimeout(200);

// mid-roll screenshot: start sampling then click
await a1366.evaluate(() => { window.__rolled = false; });
const rollP = a1366.click('#rollBtn');
await waitFor(a1366, () => __ph.diceTray.rolling() || (__ph.diceTray.list() || []).length > 0, null, 8000).catch(() => {});
await a1366.waitForTimeout(350);
await a1366.locator('#diceTray').screenshot({ path: SH + 'v17-midroll-a.png' });
await a1366.waitForTimeout(280);
await a1366.locator('#diceTray').screenshot({ path: SH + 'v17-midroll.png' });

const midChanged = (() => {
  const A = readFileSync(SH + 'v17-midroll-a.png'), B = readFileSync(SH + 'v17-midroll.png');
  if (A.length !== B.length) return true;
  for (let i = 0; i < Math.min(A.length, B.length); i += 73) if (A[i] !== B[i]) return true;
  return false;
})();
ok('擲骰過程畫面有變化（兩張 mid-roll 不一樣）', midChanged, 'a=' + readFileSync(SH + 'v17-midroll-a.png').length + ' b=' + readFileSync(SH + 'v17-midroll.png').length);
await rollP.catch(() => {});
await waitFor(a1366, () => __ph.state?.dice?.status === 'done', null, 25000);
await a1366.waitForTimeout(400);

const t1366 = await tags(a1366);
ok('1366x768：名牌清楚、不蓋住骰子、互不重疊、都在畫布內', t1366.n === 3 && t1366.overlapDie.length === 0 && !t1366.tagOverlap && t1366.allIn && t1366.minPxH >= 28 && t1366.minPxW >= 70, JSON.stringify(t1366));
const t1920 = await tags(a1920);
ok('1920x1080：名牌清楚、不蓋住骰子、互不重疊、都在畫布內', t1920.n === 3 && t1920.overlapDie.length === 0 && !t1920.tagOverlap && t1920.allIn && t1920.minPxH >= 28 && t1920.minPxW >= 70, JSON.stringify(t1920));
const tMob = await tags(mob);
ok('手機：名牌清楚、不蓋住骰子、互不重疊、都在畫布內', tMob.n === 3 && tMob.overlapDie.length === 0 && !tMob.tagOverlap && tMob.allIn && tMob.minPxH >= 26 && tMob.minPxW >= 70, JSON.stringify(tMob));

function fill(p) {
  return p.evaluate(() => {
    const pr = __ph.diceTray.projected();
    const xs = [...pr.corners.map(c => c[0]), ...pr.dice.flatMap(d => [d.p[0], d.tag[0]])];
    const ys = [...pr.corners.map(c => c[1]), ...pr.dice.flatMap(d => [d.p[1], d.tag[1]])];
    return {
      xSpan: +(Math.max(...xs) - Math.min(...xs)).toFixed(3),
      ySpan: +(Math.max(...ys) - Math.min(...ys)).toFixed(3),
      yMax: +Math.max(...ys).toFixed(3),
      yMin: +Math.min(...ys).toFixed(3),
      xMin: +Math.min(...xs).toFixed(3),
      xMax: +Math.max(...xs).toFixed(3),
    };
  });
}
const f1366 = await fill(a1366);
const f1920 = await fill(a1920);
const fMob = await fill(mob);
ok('1366：桌面偏上、名牌有空間，橫向填滿', f1366.xSpan >= 1.7 && f1366.yMax >= 0.55 && f1366.yMax <= 0.9, JSON.stringify(f1366));
ok('1920：桌面偏上、名牌有空間，橫向填滿', f1920.xSpan >= 1.7 && f1920.yMax >= 0.55 && f1920.yMax <= 0.9, JSON.stringify(f1920));
ok('手機：桌面偏上、名牌有空間，橫向填滿', fMob.xSpan >= 1.7 && fMob.yMax >= 0.50 && fMob.yMax <= 0.95, JSON.stringify(fMob));

await a1920.evaluate(() => document.getElementById('lobby').scrollTo?.(0, 0));
await a1920.screenshot({ path: SH + 'v17-lobby-desktop.png' });
await a1366.evaluate(() => document.getElementById('lobby')?.scrollTo?.(0, 0));
await a1366.screenshot({ path: SH + 'v17-lobby-1366.png' });
await mob.evaluate(() => document.getElementById('lobbySide')?.scrollIntoView({ block: 'start' }));
await mob.waitForTimeout(200);
await mob.screenshot({ path: SH + 'v17-lobby-phone.png' });

ok('沒有頁面錯誤', errs.length === 0, errs.join(' | '));
const fail = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - fail} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
