// v13 3D 擲骰桌：每個用戶端都看到所有人的骰子、停下來的點數 = 主機點數、平手重擲有動畫、鬼的骰子高亮、手機直式版面、lowgfx。
import { chromium, devices } from 'playwright-core';
const URL = process.env.URL || 'http://localhost:8765/';
const SH = process.env.SHOTS || '../shots/';
const allPages = []; const chains = new Map(); const latestState = new Map();
function relay(m) { for (const p of allPages) {
  if (m.type === 'data' && m.data?.t === 's') { const key = p._n + '>' + m.to; const had = latestState.has(key); latestState.set(key, m); if (had) continue;
    const prev = chains.get(p) || Promise.resolve(); chains.set(p, prev.then(() => { const mm = latestState.get(key); latestState.delete(key); return p.evaluate(m => window.__localnetIn && window.__localnetIn(m), mm); }).catch(() => { })); continue; }
  const prev = chains.get(p) || Promise.resolve(); chains.set(p, prev.then(() => p.evaluate(m => window.__localnetIn && window.__localnetIn(m), m)).catch(() => { })); } }
const results = []; const ok = (name, cond, info = '') => { results.push([cond ? 'PASS' : 'FAIL', name, info]); console.log(cond ? 'PASS' : 'FAIL', name, info); };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
const mk = async (name, opts) => { const ctx = await b.newContext(opts); await ctx.exposeBinding('__relay', (src, m) => relay(m)); const p = await ctx.newPage(); allPages.push(p); p._n = name;
  p.on('pageerror', e => { errs.push(name + ': ' + e.message); console.log(`[${name} err]`, e.message); }); return p; };
const A = await mk('A-host', { viewport: { width: 1280, height: 800 } });
const B = await mk('B-desktop', { viewport: { width: 1280, height: 800 } });
const C = await mk('C-mobile', { ...devices['iPhone 13'], defaultBrowserType: undefined });
const D = await mk('D-lowgfx', { viewport: { width: 1100, height: 760 } });
const pages = [A, B, C, D];
const waitFor = (p, fn, arg, t = 20000) => p.waitForFunction(fn, arg, { timeout: t });
const allWait = (fn, arg, t = 8000) => Promise.all(pages.map(p => waitFor(p, fn, arg, t)));
const myId = p => p.evaluate(() => __ph.net.myId);
const list = p => p.evaluate(() => __ph.diceTray.list());

await A.goto(URL + '?net=local'); await waitFor(A, () => __ph.ready, null, 60000);
await A.fill('#nameIn', '主機A'); await A.click('#createBtn'); await A.waitForSelector('#lobby:not(.hidden)', { timeout: 20000 });
const code = (await A.textContent('#roomCode')).trim();
for (const [p, n, q] of [[B, '桌機B', '?net=local'], [D, '省電D', '?net=local&lowgfx=1']]) { await p.goto(URL + q); await waitFor(p, () => __ph.ready, null, 60000); await p.fill('#nameIn', n); await p.fill('#codeIn', code); await p.click('#joinBtn'); }
await C.goto(URL + '?net=local&room=' + code); await waitFor(C, () => __ph.ready, null, 60000); await C.fill('#nameIn', '手機C'); await C.tap('#joinBtn');
await allWait(() => __ph.state?.players?.length === 4, null, 20000);
const ids = { A: await myId(A), B: await myId(B), C: await myId(C), D: await myId(D) };
ok('四個用戶端都有 3D 擲骰桌（WebGL 正常）', (await Promise.all(pages.map(p => p.evaluate(() => __ph.diceTray.ok && !document.getElementById('diceTray').classList.contains('hidden'))))).every(Boolean));
ok('還沒擲骰時桌上沒骰子', (await Promise.all(pages.map(list))).every(l => l.length === 0));
// 安排點數：A5 B2 C2 D4 → B、C 平手最低 → 重擲 B6 C1 → C 當鬼
await A.evaluate(m => __ph.setNextRolls(m), { [ids.A]: [5], [ids.B]: [2, 6], [ids.C]: [2, 1], [ids.D]: [4] });
await A.waitForTimeout(200);
const tap = (p, sel) => p === C ? p.tap(sel) : p.click(sel);
// 1. v14：只有房主有擲骰鍵；大家準備好才能按
const rb = p => p.evaluate(() => { const e = document.getElementById('rollBtn'); return { hidden: e.classList.contains('hidden') || !e.offsetParent, disabled: e.disabled, text: e.textContent }; });
ok('非房主沒有擲骰鍵', (await Promise.all([B, C, D].map(rb))).every(x => x.hidden), JSON.stringify(await rb(B)));
for (const p of [B, C]) await tap(p, '#readyBtn');
await A.waitForTimeout(400);
ok('還有人沒準備時房主的擲骰鍵不能按', (await rb(A)).disabled && !(await rb(A)).hidden, JSON.stringify(await rb(A)));
for (const p of [A, D]) await tap(p, '#readyBtn');
await waitFor(A, () => !document.getElementById('rollBtn').disabled, null, 8000).catch(() => {});
ok('大家都準備好 → 房主的擲骰鍵可以按', !(await rb(A)).disabled, JSON.stringify(await rb(A)));
ok('非房主看到「等房主擲骰」', /等房主擲骰/.test(await B.textContent('#diceMsg')), await B.textContent('#diceMsg'));
await A.evaluate(() => __ph.diceTray.speed(.15)); // 只在 A 放慢播放，好拍「滾到一半」的截圖
await tap(A, '#rollBtn');
await waitFor(A, () => __ph.diceTray.list().length === 4 && __ph.diceTray.rolling(), null, 8000).catch(() => {});
await A.waitForTimeout(1200); await A.screenshot({ path: SH + 'v13-midroll.png' });
const mid = await list(A);
ok('滾動中骰子還沒停（不是直接出結果）', mid.length === 4 && mid.some(d => !d.settled && d.y > .55), JSON.stringify(mid.map(d => [d.id.slice(-4), d.settled, d.y])));
await A.evaluate(() => __ph.diceTray.speed(1));
await allWait(() => __ph.diceTray.stat().throws >= 1, null, 8000).catch(() => {});
const st1 = await Promise.all(pages.map(p => p.evaluate(() => __ph.diceTray.stat())));
ok('房主按一次 → 每個用戶端都把 4 顆骰子一起丟（一次擲骰動畫）', st1.every(x => x.throws === 1 && x.thrown === 4), JSON.stringify(st1));
await allWait(() => __ph.diceTray.list().length === 4 && !__ph.diceTray.rolling() && __ph.diceTray.list().every(d => d.settled), null, 30000).then(() => true).catch(() => false).then(r => ok('四顆骰子在每個用戶端都出現並停下', r));
const tr = await Promise.all(pages.map(p => p.evaluate(() => { const t = __ph.diceTray.trace(); return [t.length, new Set(t).size]; })));
ok('每個用戶端都播放了逐格的翻滾軌跡（位置一直在變）', tr.every(([n, d]) => n >= 5 && d >= n - 2), JSON.stringify(tr));
const host = await A.evaluate(() => Object.fromEntries(__ph.state.players.map(q => [q.id, q.roll])));
ok('主機點數 = 安排的點數', host[ids.A] === 5 && host[ids.B] === 2 && host[ids.C] === 2 && host[ids.D] === 4, JSON.stringify(host));
let lists = await Promise.all(pages.map(list));
ok('每個用戶端：每顆骰子朝上的面 = 主機點數', lists.every(l => l.length === 4 && l.every(d => d.face === host[d.id] && d.n === host[d.id])), JSON.stringify(lists.map(l => l.map(d => d.face + '/' + host[d.id]))));
ok('骰子平躺在桌上（沒卡在牆上或飛出桌外）', lists.every(l => l.every(d => d.y > .45 && d.y < 1.6 && Math.abs(d.x) < 5 && Math.abs(d.z) < 2.75)), JSON.stringify(lists[0].map(d => [d.x, d.y, d.z])));
await allWait(() => __ph.state?.dice?.status === 'tie', null, 5000).catch(() => {});
await A.waitForTimeout(500); lists = await Promise.all(pages.map(list));
ok('平手：B、C 的骰子有橘色圈，其他沒有', lists.every(l => l.every(d => d.ring === (d.id === ids.B || d.id === ids.C))), JSON.stringify(lists[0].map(d => [d.id.slice(-4), d.ring])));
ok('平手時 #diceMsg 文字還在（摘要）', /平手/.test(await A.textContent('#diceMsg')), await A.textContent('#diceMsg'));
ok('平手時房主的鍵變成「平手的人再擲」', /平手的人再擲/.test((await rb(A)).text) && !(await rb(A)).disabled, JSON.stringify(await rb(A)));
// 2. 平手重擲：只丟平手的兩顆、一起丟、有動畫
await tap(A, '#rollBtn');
const reroll = await Promise.all(pages.map(p => waitFor(p, ([b, c]) => __ph.diceTray.rolling() && __ph.diceTray.list().filter(d => !d.settled).map(d => d.id).sort().join() === [b, c].sort().join(), [ids.B, ids.C], 4000).then(() => true).catch(() => false)));
ok('重擲時每個用戶端都看到 B、C 兩顆一起重新滾（A、D 不動）', reroll.every(Boolean), JSON.stringify(reroll));
await allWait(() => __ph.state?.dice?.status === 'done' && !__ph.diceTray.rolling() && __ph.diceTray.list().length === 4 && __ph.diceTray.list().every(d => d.settled), null, 30000).catch(() => {});
await A.waitForTimeout(600);
const st2 = await Promise.all(pages.map(p => p.evaluate(() => __ph.diceTray.stat())));
ok('重擲是第 2 次擲骰、只多丟 2 顆', st2.every(x => x.throws === 2 && x.thrown === 6), JSON.stringify(st2));
const host2 = await A.evaluate(() => Object.fromEntries(__ph.state.players.map(q => [q.id, q.roll])));
lists = await Promise.all(pages.map(list));
ok('重擲後點數 B=6、C=1', host2[ids.B] === 6 && host2[ids.C] === 1, JSON.stringify(host2));
ok('重擲後每個用戶端的骰面 = 主機點數', lists.every(l => l.length === 4 && l.every(d => d.face === host2[d.id])), JSON.stringify(lists.map(l => l.map(d => d.face + '/' + host2[d.id]))));
const sk = await A.evaluate(() => __ph.state.dice.seekers);
ok('最低的 C 是鬼', sk.length === 1 && sk[0] === ids.C, JSON.stringify(sk));
ok('每個用戶端：只有鬼（C）的骰子有粉紅圈＋👻 名牌', lists.every(l => l.every(d => d.ring === (d.id === ids.C) && (d.id === ids.C) === /👻/.test(d.tag))), JSON.stringify(lists[1].map(d => [d.ring, d.tag])));
ok('停下後名牌顯示點數', lists.every(l => l.every(d => d.tag.replace(/(rgba\(.*\)|#[0-9a-f]{6})$/, '').trim().endsWith(String(host2[d.id])))), JSON.stringify(lists[0].map(d => d.tag)));
ok('擲完後房主的擲骰鍵變成不能按', (await rb(A)).disabled, JSON.stringify(await rb(A)));
ok('#diceMsg 摘要寫出鬼', /手機C/.test(await A.textContent('#diceMsg')), await A.textContent('#diceMsg'));
ok('3D 桌在時不跳出舊的全螢幕骰子', (await Promise.all(pages.map(p => p.evaluate(() => { const e = document.getElementById('diePop'); return !e || e.classList.contains('hidden') || getComputedStyle(e).display === 'none'; })))).every(Boolean));
// 3. 音效（只能在無頭瀏覽器裡確認有觸發）
const snd = await Promise.all(pages.map(p => p.evaluate(() => __ph.diceTray.sounds())));
ok('碰撞／落地音效事件有觸發', snd.every(n => n > 3), JSON.stringify(snd));
await B.click('#muteBtn'); const m1 = await B.evaluate(() => [__ph.muted, localStorage.getItem('ph-mute'), document.getElementById('muteBtn').textContent]);
await B.click('#muteBtn'); const m2 = await B.evaluate(() => [__ph.muted, localStorage.getItem('ph-mute')]);
ok('靜音鍵可以切換並記住', m1[0] === true && m1[1] === '1' && m1[2] === '🔇' && m2[0] === false && m2[1] === '0', JSON.stringify([m1, m2]));
// 4. 版面
await A.screenshot({ path: SH + 'v13-settled-desktop.png' });
const lay = async p => p.evaluate(() => { const r = e => document.getElementById(e).getBoundingClientRect(); const t = r('diceTray'), wrap = document.getElementById('lobbySide') || document.querySelector('#lobby .card') || document.getElementById('lobby');
  const c = wrap.getBoundingClientRect(); return { tw: t.width, th: t.height, vw: innerWidth, sw: document.documentElement.scrollWidth, inCard: t.left >= c.left - 1 && t.right <= c.right + 1, cw: document.getElementById('diceCanvas').width }; });
const lc = await lay(C);
ok('手機直式：骰桌在畫面內、不撐寬頁面', lc.tw > 200 && lc.tw <= lc.vw && lc.sw <= lc.vw + 1 && lc.th >= 120 && lc.inCard && lc.cw > 0, JSON.stringify(lc));
const over = await C.evaluate(() => [...document.querySelectorAll('#lobby *')].filter(e => e.offsetParent && e.getBoundingClientRect().right > innerWidth + 1).map(e => e.id || e.className).slice(0, 5));
ok('手機直式：大廳沒有任何東西超出畫面右邊', over.length === 0, JSON.stringify(over));
await C.evaluate(() => document.getElementById('diceTray').scrollIntoView({ block: 'start' })); await C.waitForTimeout(300);
await C.screenshot({ path: SH + 'v13-mobile.png' });
await C.evaluate(() => document.getElementById('lobby').scrollTo?.(0, 0));
await C.evaluate(() => (document.querySelector('#lobby .card') || document.getElementById('lobby')).scrollIntoView({ block: 'start' }));
ok('手機：準備按鈕拿得到', await C.evaluate(() => ['readyBtn'].every(id => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); return r.width > 40 && r.height > 20; })));
const ld = await lay(D);
ok('lowgfx 桌機：骰桌正常', ld.tw > 300 && ld.cw > 0 && ld.sw <= ld.vw + 1, JSON.stringify(ld));
const pix = await Promise.all(pages.map(p => p.evaluate(() => __ph.diceTray.frames())));
ok('每個用戶端都有畫骰桌', pix.every(n => n > 10), JSON.stringify(pix));
// 5. 重新擲骰（主機重設）→ 骰子清空，晚加入補位
await A.evaluate(() => __ph.resetDice()); await allWait(() => __ph.diceTray.list().length === 0, null, 5000).then(() => true).catch(() => false).then(r => ok('主機重設骰子後桌面清空', r));
await A.evaluate(m => __ph.setNextRolls(m), { [ids.A]: [3], [ids.B]: [5], [ids.C]: [6], [ids.D]: [2] });
await A.waitForTimeout(200); await waitFor(A, () => !document.getElementById('rollBtn').disabled, null, 8000).catch(() => {}); await A.click('#rollBtn');
await allWait(() => __ph.state?.dice?.status === 'done' && __ph.diceTray.list().length === 4 && __ph.diceTray.list().every(d => d.settled), null, 30000).catch(() => {});
await A.waitForTimeout(400); lists = await Promise.all(pages.map(list)); const host3 = await A.evaluate(() => Object.fromEntries(__ph.state.players.map(q => [q.id, q.roll])));
ok('四顆同時擲（互相碰撞）也都停在主機點數', lists.every(l => l.length === 4 && l.every(d => d.face === host3[d.id])), JSON.stringify(lists.map(l => l.map(d => d.face + '/' + host3[d.id]))));
ok('同時擲：鬼是 D（2 點）', lists.every(l => l.every(d => d.ring === (d.id === ids.D))), '');
// 開局後骰桌清掉、遊戲正常
await A.waitForSelector('#startBtn:not([disabled])', { timeout: 15000 }).catch(() => {});
await Promise.all([A, B, C, D].map(async p => { if (!(await p.evaluate(() => __ph.state.players.find(q => q.id === __ph.net.myId).ready))) await tap(p, '#readyBtn'); }));
await A.waitForSelector('#startBtn:not([disabled])', { timeout: 15000 }); await A.click('#startBtn');
await allWait(() => __ph.state?.phase === 'hide', null, 15000).then(() => true).catch(() => false).then(r => ok('開局正常，D 是鬼', r));
ok('開局後 D 的角色是鬼', (await A.evaluate(() => __ph.state.players)).find(q => q.id === ids.D).role === 'seeker');
const stEnd = await Promise.all(pages.map(p => p.evaluate(() => __ph.diceTray.stat())));
ok('每個用戶端 3 次擲骰都有動畫、沒用到直接擺好的備援', stEnd.every(x => x.throws === 3 && x.thrown === 10 && x.placed === 0), JSON.stringify(stEnd));
ok('沒有頁面錯誤', errs.length === 0, errs.join(' | '));
const fail = results.filter(r => r[0] === 'FAIL').length; console.log(`\n${results.length - fail} passed, ${fail} failed`);
await b.close(); process.exit(fail ? 1 : 0);
