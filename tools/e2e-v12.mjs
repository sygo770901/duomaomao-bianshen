// v12 觀戰：被抓的人預設跟隨觀戰、換人（鍵盤/點畫面/手機按鈕）、V/Tab 切自由飛、目標被抓自動換人、
// 只有被抓的人看得到躲藏者發光外框＋名字（鬼和還活著的躲藏者看不到）、手機按鈕不重疊。
import { chromium, devices } from 'playwright-core';
const URL = process.env.URL || 'http://localhost:8765/';
const NET = 'net=local&lowgfx=1';
const qs = q => '?' + [q, NET].filter(Boolean).join('&');
const allPages = []; const chains = new Map(); const latestState = new Map();
function relay(m) { for (const p of allPages) {
  if (m.type === 'data' && m.data?.t === 's') { const key = p._n + '>' + m.to; const had = latestState.has(key); latestState.set(key, m); if (had) continue; // 只合併同一個收件人的狀態
    const prev = chains.get(p) || Promise.resolve(); chains.set(p, prev.then(() => { const mm = latestState.get(key); latestState.delete(key); return p.evaluate(m => window.__localnetIn && window.__localnetIn(m), mm); }).catch(() => { })); continue; }
  const prev = chains.get(p) || Promise.resolve(); chains.set(p, prev.then(() => p.evaluate(m => window.__localnetIn && window.__localnetIn(m), m)).catch(() => { })); } }
const SH = process.env.SHOTS || '../shots/';
const results = []; const ok = (name, cond, info = '') => { results.push([cond ? 'PASS' : 'FAIL', name, info]); console.log(cond ? 'PASS' : 'FAIL', name, info); };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
const mk = async (name, opts) => { const ctx = await b.newContext(opts); await ctx.exposeBinding('__relay', (src, m) => relay(m)); const p = await ctx.newPage(); allPages.push(p); p._n = name; p._touch = !!opts.hasTouch;
  p.on('pageerror', e => { errs.push(name + ': ' + e.message); console.log(`[${name} err]`, e.message); }); return p; };
const A = await mk('A-seeker', { viewport: { width: 1280, height: 800 } });
const B = await mk('B-desktop', { viewport: { width: 1280, height: 800 } });
const C = await mk('C-mobile', { ...devices['iPhone 13'], defaultBrowserType: undefined });
const D = await mk('D-desktop', { viewport: { width: 1280, height: 800 } });
const pages = [A, B, C, D];
const st = p => p.evaluate(() => { const s = __ph.state; return s && { phase: s.phase, winner: s.winner, players: s.players }; });
const myId = p => p.evaluate(() => __ph.net.myId);
const waitFor = (p, fn, arg, t = 20000) => p.waitForFunction(fn, arg, { timeout: t });
const allWait = (fn, arg, t = 8000) => Promise.all(pages.map(p => waitFor(p, fn, arg, t)));
const spec = p => p.evaluate(() => __ph.spec);

await A.goto(URL + qs('hide=14&seek=200&seekerhost=1')); await waitFor(A, () => __ph.ready, null, 60000);
await A.fill('#nameIn', '鬼A'); await A.click('#createBtn'); await A.waitForSelector('#lobby:not(.hidden)', { timeout: 20000 });
const code = (await A.textContent('#roomCode')).trim();
for (const [p, n] of [[B, '桌機B'], [D, '桌機D']]) { await p.goto(URL + qs('')); await waitFor(p, () => __ph.ready, null, 60000); await p.fill('#nameIn', n); await p.fill('#codeIn', code); await p.click('#joinBtn'); }
await C.goto(URL + qs('room=' + code)); await waitFor(C, () => __ph.ready, null, 60000); await C.fill('#nameIn', '手機C'); await C.tap('#joinBtn');
await allWait(() => __ph.state?.players?.length === 4, null, 20000).catch(async e => { console.log('JOIN', JSON.stringify(await Promise.all(pages.map(p => p.evaluate(() => [__ph.state?.players?.length, document.getElementById('homeMsg')?.textContent]))))); throw e; });
const ids = { A: await myId(A), B: await myId(B), C: await myId(C), D: await myId(D) };
await A.waitForSelector('#startBtn:not([disabled])', { timeout: 15000 }); await A.waitForTimeout(300); await A.click('#startBtn'); await allWait(() => __ph.state?.phase === 'hide', null, 15000);
let s = await st(A);
ok('A 是鬼，B/C/D 是躲藏者', s.players.find(q => q.id === ids.A).role === 'seeker' && [ids.B, ids.C, ids.D].every(id => s.players.find(q => q.id === id).role === 'hider'));
ok('開局沒有人在觀戰', (await Promise.all(pages.map(spec))).every(x => !x.on));
ok('開局觀戰列隱藏', (await Promise.all(pages.map(p => p.evaluate(() => document.getElementById('specBar').classList.contains('hidden'))))).every(Boolean));

// C、D 變身後走到空地；B 不變身
const PROPS = await A.evaluate(() => __ph.PROPS); const HN = await A.evaluate(() => __ph.HOME_PROP_N);
const pid = (n, x, z) => PROPS.findIndex((p, i) => i < HN && p[0] === n && Math.hypot(p[1] - x, p[2] - z) < .2);
const plantC = pid('pottedPlant', -3.5, -3.0), plantD = pid('pottedPlant', -6.4, 5.5);
async function disguise(p, id, at) { const pr = PROPS[id]; await p.evaluate(([x, z]) => __ph.teleport(x, z, 0), [pr[1] + .9, pr[2]]); await p.waitForTimeout(300);
  await p.evaluate(i => __ph.tryTransform(i), id); await p.waitForTimeout(700); await p.evaluate(([x, z]) => __ph.teleport(x, z, 0), at); }
await disguise(C, plantC, [-7.0, 0]); await disguise(D, plantD, [-11, 3]);
await B.evaluate(() => __ph.teleport(-6.5, 2.8, 0));
s = await st(A);
ok('C、D 已變身', s.players.find(q => q.id === ids.C).prop === plantC && s.players.find(q => q.id === ids.D).prop === plantD, JSON.stringify([plantC, plantD]));
await B.waitForTimeout(500);
ok('還活著的躲藏者看不到外框／觀戰名字', (await Promise.all([B, C, D].map(p => p.evaluate(() => __ph.visibleHullCount() + __ph.visibleSpecTagCount())))).every(n => n === 0));

await waitFor(A, () => __ph.state?.phase === 'seek', null, 30000);
async function shootPlayer(id) {
  for (const off of [[0, 2.0], [-1.8, .2], [1.8, .5], [0, -2.0]]) {
    const q = (await st(A)).players.find(p => p.id === id);
    await A.evaluate(([x, z, lx, lz]) => { __ph.teleport(x, z); __ph.lookAt(lx, lz); }, [q.x + off[0], q.z + off[1], q.x, q.z]);
    await waitFor(A, i => __ph.screenOf('player', i)?.onScreen, id, 4000).catch(() => {}); await A.waitForTimeout(250);
    const sc = await A.evaluate(i => __ph.screenOf('player', i), id); if (sc) await A.mouse.click(sc.x, sc.y);
    await A.waitForTimeout(1000); if (!(await st(A)).players.find(p => p.id === id).alive) return true;
  } return false;
}
// 1. 抓到 B → B 預設跟隨觀戰
ok('鬼抓到 B', await shootPlayer(ids.B));
await waitFor(B, () => __ph.spec.on && __ph.spec.target, null, 5000).catch(() => {});
let sb = await spec(B);
const alive = async () => (await st(A)).players.filter(q => q.alive && q.id !== ids.B).map(q => q.id);
ok('B 被抓後進入觀戰（預設跟隨）', sb.on && sb.mode === 'follow' && (await alive()).includes(sb.target), JSON.stringify(sb));
ok('B 觀戰列顯示正在看的人名字', await B.evaluate(() => !document.getElementById('specBar').classList.contains('hidden') && /正在看/.test(document.getElementById('specName').textContent)), await B.textContent('#specName'));
ok('B 角色文字是跟隨觀戰', /跟隨觀戰/.test(await B.textContent('#role')), await B.textContent('#role'));
const camNear = async (p, id) => { await p.waitForTimeout(600); const c = await p.evaluate(() => __ph.camPos()); const t = (await st(A)).players.find(q => q.id === id); return Math.hypot(c[0] - t.x, c[2] - t.z); };
const d0 = await camNear(B, sb.target);
ok('鏡頭跟著被看的人', d0 < 3.6, d0.toFixed(2));
// 2. 換人
const t0 = sb.target;
await B.keyboard.press('ArrowRight'); await B.waitForTimeout(200); const t1 = (await spec(B)).target;
await B.keyboard.press('KeyQ'); await B.waitForTimeout(200); const t2 = (await spec(B)).target;
await B.keyboard.press('KeyE'); await B.waitForTimeout(200); const t3 = (await spec(B)).target;
ok('→ 換下一位、Q 換回上一位、E 再下一位', t1 !== t0 && t2 === t0 && t3 === t1, JSON.stringify([t0, t1, t2, t3]));
const nm = await B.textContent('#specName'); const tq = (await st(A)).players.find(q => q.id === t3);
ok('名字跟著換', nm.includes(tq.name), nm);
await B.mouse.click(640, 400); await B.waitForTimeout(250); const t4 = (await spec(B)).target;
ok('點畫面也會換下一位', t4 !== t3 && (await alive()).includes(t4), JSON.stringify([t3, t4]));
ok('跟隨時看得到被看的人（鏡頭跟上）', (await camNear(B, t4)) < 3.6);
// 3. 外框：只有觀戰者看得到
await B.waitForTimeout(400);
ok('觀戰者 B 看得到 C、D 的發光外框', await B.evaluate(([c, d]) => __ph.hullVisible(c) && __ph.hullVisible(d), [ids.C, ids.D]));
ok('觀戰者 B 看得到 C、D 的名字標籤', await B.evaluate(([c, d]) => __ph.specTagVisible(c) && __ph.specTagVisible(d), [ids.C, ids.D]));
ok('鬼 A 看不到任何外框／觀戰名字', await A.evaluate(() => __ph.visibleHullCount() === 0 && __ph.visibleSpecTagCount() === 0));
ok('還活著的 C、D 看不到任何外框／觀戰名字', (await Promise.all([C, D].map(p => p.evaluate(() => __ph.visibleHullCount() === 0 && __ph.visibleSpecTagCount() === 0)))).every(Boolean));
// 跟隨 D 截圖
while ((await spec(B)).target !== ids.D) { await B.keyboard.press('ArrowRight'); await B.waitForTimeout(150); }
await B.evaluate(() => { __ph.cam.pitch = .45; }); await B.waitForTimeout(700);
await B.screenshot({ path: SH + 'v12-follow-desktop.png' });
// 4. 切自由飛（V）再回來（Tab）
await B.keyboard.press('KeyV'); await B.waitForTimeout(300);
sb = await spec(B);
ok('V → 自由飛', sb.on && sb.mode === 'free' && /自由飛/.test(await B.textContent('#specName')), JSON.stringify(sb));
const f0 = await B.evaluate(() => [__ph.local.x, __ph.local.z]);
await B.evaluate(() => { __ph.holdMove.iz = -1; }); await B.waitForTimeout(600); await B.evaluate(() => { __ph.holdMove.iz = 0; });
const f1 = await B.evaluate(() => [__ph.local.x, __ph.local.z]);
ok('自由飛可以自己移動', Math.hypot(f1[0] - f0[0], f1[1] - f0[1]) > .3, JSON.stringify([f0, f1]));
ok('自由飛時仍看得到外框', await B.evaluate(([c, d]) => __ph.hullVisible(c) && __ph.hullVisible(d), [ids.C, ids.D]));
await B.evaluate(() => { __ph.teleport(-9, 5.2, 0); __ph.lookAt(-9, 0, .55); }); await B.waitForTimeout(800);
await B.screenshot({ path: SH + 'v12-freefly-highlight.png' });
await B.keyboard.press('Tab'); await B.waitForTimeout(300);
sb = await spec(B);
ok('Tab → 回到跟隨', sb.mode === 'follow' && (await alive()).includes(sb.target), JSON.stringify(sb));
// 5. 被看的人被抓 → 自動換下一位
while ((await spec(B)).target !== ids.C) { await B.keyboard.press('ArrowRight'); await B.waitForTimeout(150); }
ok('鬼抓到 C（B 正在看 C）', await shootPlayer(ids.C));
await waitFor(B, c => __ph.spec.target && __ph.spec.target !== c, ids.C, 5000).catch(() => {});
sb = await spec(B);
ok('目標被抓 → 自動換到下一位還活著的人', sb.mode === 'follow' && sb.target !== ids.C && (await alive()).includes(sb.target), JSON.stringify(sb));
ok('被抓的 C 外框消失', !(await B.evaluate(c => __ph.hullVisible(c), ids.C)));
s = await st(A); ok('還有人躲著，遊戲繼續', s.phase === 'seek', s.phase);
// 6. 手機：C 也在觀戰
await waitFor(C, () => __ph.spec.on, null, 5000).catch(() => {});
const sc0 = await spec(C);
ok('手機 C 被抓後也是跟隨觀戰', sc0.on && sc0.mode === 'follow' && !!sc0.target, JSON.stringify(sc0));
const rects = () => C.evaluate(() => { const r = id => { const e = document.getElementById(id); if (!e) return null; const cs = getComputedStyle(e); if (cs.display === 'none' || e.classList.contains('hidden')) return null; const b = e.getBoundingClientRect(); return b.width && b.height ? [b.left, b.top, b.right, b.bottom] : null; };
  return { prev: r('specPrev'), next: r('specNext'), mode: r('specMode'), name: r('specName'), bar: r('specBar'), joy: r('joy'), move: r('moveBtns'), btns: r('btns'), chat: r('chatHudBtns'), feed: r('chatFeed'), vw: innerWidth, vh: innerHeight }; });
const over = (a, b) => a && b && a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
const inView = (a, R) => a && a[0] >= 0 && a[1] >= 0 && a[2] <= R.vw + .5 && a[3] <= R.vh + .5;
let R = await rects();
ok('手機觀戰按鈕 ◀ ▶ 切換 都在畫面內', ['prev', 'next', 'mode'].every(k => inView(R[k], R)), JSON.stringify(R));
ok('手機跟隨時觀戰列不蓋到其他按鈕', !['joy', 'move', 'btns', 'chat'].some(k => over(R.bar, R[k])), JSON.stringify(R));
await C.screenshot({ path: SH + 'v12-mobile-follow.png' });
const c0 = sc0.target; await C.tap('#specNext'); await C.waitForTimeout(250); const c1 = (await spec(C)).target;
await C.tap('#specPrev'); await C.waitForTimeout(250); const c2 = (await spec(C)).target;
ok('手機 ▶ / ◀ 換人', c1 !== c0 && c2 === c0, JSON.stringify([c0, c1, c2]));
await C.tap('#specMode'); await C.waitForTimeout(400);
ok('手機切換鈕 → 自由飛', (await spec(C)).mode === 'free');
R = await rects();
ok('手機自由飛：搖桿與移動鈕出現且不被觀戰列擋住', R.joy && R.move && !over(R.bar, R.joy) && !over(R.bar, R.move), JSON.stringify(R));
await C.screenshot({ path: SH + 'v12-mobile-free.png' });
await C.setViewportSize({ width: 844, height: 390 }); await C.waitForTimeout(500);
R = await rects();
ok('手機橫向自由飛：觀戰列不蓋到搖桿／按鈕／聊天鈕', ['prev', 'mode'].every(k => !R[k] || inView(R[k], R)) && inView(R.mode, R) && !['joy', 'move', 'btns', 'chat'].some(k => over(R.bar, R[k])), JSON.stringify(R));
await C.setViewportSize({ width: 390, height: 664 }); await C.waitForTimeout(400);
await C.tap('#specMode'); await C.waitForTimeout(300);
ok('手機切換鈕 → 回到跟隨', (await spec(C)).mode === 'follow');
ok('鬼 A 仍然看不到外框（有兩個觀戰者時）', await A.evaluate(() => __ph.visibleHullCount() === 0 && __ph.visibleSpecTagCount() === 0));
ok('還活著的 D 仍然看不到外框', await D.evaluate(() => __ph.visibleHullCount() === 0 && __ph.visibleSpecTagCount() === 0));
// 7. 結束 → 觀戰結束
ok('鬼抓到 D', await shootPlayer(ids.D));
await waitFor(A, () => __ph.state?.phase === 'end', null, 6000).catch(() => {});
await B.waitForTimeout(400);
ok('回合結束後不再觀戰、觀戰列隱藏', (await Promise.all(pages.map(p => p.evaluate(() => !__ph.spec.on && document.getElementById('specBar').classList.contains('hidden'))))).every(Boolean));
ok('回合結束後沒有外框', (await Promise.all(pages.map(p => p.evaluate(() => __ph.visibleHullCount()))).then(a => a.every(n => n === 0))));
ok('沒有頁面錯誤', errs.length === 0, errs.join(' | '));
const f = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - f} passed, ${f} failed`);
await b.close(); process.exit(f ? 1 : 0);
