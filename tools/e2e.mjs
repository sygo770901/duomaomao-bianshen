// 3 個瀏覽器（2 桌機 + 1 手機）同一房間，測：房號加入、網址加入、階段計時、變身、噴漆、跳躍、衝刺、推擠、牆上掛飾、鬼點錯扣血、抓人、勝負。
import { chromium, devices } from 'playwright-core';
const URL = process.env.URL || 'http://localhost:8765/';
const NET = (process.env.REALNET ? '' : 'net=local') + (process.env.FULLGFX ? '' : '&lowgfx=1'); // 盒子的 Chrome 政策擋 WebRTC，預設用測試傳輸層
const qs = (q) => '?' + [q, NET].filter(Boolean).join('&');
const allPages = []; const chains = new Map();
// 轉送：狀態封包 (t:'s') 只保留最新一包，避免慢的分頁越積越多
const latestState = new Map();
let latestRooms = null;
function relay(m) { if (m?.type === 'rooms') latestRooms = m; for (const p of allPages) {
  if (m.type === 'data' && m.data?.t === 's') { const key = p; const had = latestState.has(key); latestState.set(key, m); if (had) continue;
    const prev = chains.get(p) || Promise.resolve(); chains.set(p, prev.then(() => { const mm = latestState.get(key); latestState.delete(key); return p.evaluate(m => window.__localnetIn && window.__localnetIn(m), mm); }).catch(() => { })); continue; }
  const prev = chains.get(p) || Promise.resolve(); chains.set(p, prev.then(() => p.evaluate(m => window.__localnetIn && window.__localnetIn(m), m)).catch(() => { })); } }
const SH = process.env.SHOTS || '../shots/';
const results = []; const ok = (name, cond, info = '') => { results.push([cond ? 'PASS' : 'FAIL', name, info]); console.log(cond ? 'PASS' : 'FAIL', name, info); };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
const mk = async (name, opts) => { const ctx = await b.newContext(opts); if (NET) await ctx.exposeBinding('__relay', (src, m) => relay(m)); const p = await ctx.newPage(); allPages.push(p); p.on('load', () => { if (latestRooms) p.evaluate(m => window.__localnetIn && window.__localnetIn(m), latestRooms).catch(() => {}); }); p._n = name; p._touch = !!opts.hasTouch;
  p.on('pageerror', e => console.log(`[${name} err]`, e.message)); p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) console.log(`[${name} console]`, m.text()); }); return p; };
const A = await mk('A-desktop-host', { viewport: { width: 1280, height: 800 } });
const B = await mk('B-desktop-code', { viewport: { width: 1280, height: 800 } });
const C = await mk('C-mobile-url', { ...devices['iPhone 13'], defaultBrowserType: undefined });
const pages = [A, B, C];
const st = p => p.evaluate(() => { const s = __ph.state; return s && { phase: s.phase, rem: s.rem, hp: s.hp, winner: s.winner, reason: s.reason, round: s.round, players: s.players, dice: s.dice }; });
const myId = p => p.evaluate(() => __ph.net.myId);
const waitFor = (p, fn, arg, t = 20000) => p.waitForFunction(fn, arg, { timeout: t });

// 1. 房主建立房間（測試用短時間：躲 8 秒、找 60 秒）
await A.goto(URL + qs('hide=22&seek=70')); await waitFor(A, () => __ph.ready);
await A.fill('#nameIn', '房主A'); await A.click('#createBtn');
await A.waitForSelector('#lobby:not(.hidden)', { timeout: 20000 });
const code = (await A.textContent('#roomCode')).trim(); ok('建立房間拿到 4 碼房號', /^[A-Z0-9]{4}$/.test(code), code);
ok('分享連結含 ?room=', (await A.inputValue('#shareUrl')).includes('?room=' + code), await A.inputValue('#shareUrl'));

// 2. B 在首頁公開房間列表看到 A 開的房間，點一下直接加入
await B.goto(URL + qs('')); await waitFor(B, () => __ph.ready);
await B.fill('#nameIn', '桌機B');
await B.waitForFunction(c => [...document.querySelectorAll('#roomList .roomItem')].some(el => el.dataset.code === c && /房主A/.test(el.textContent) && /等待中/.test(el.textContent)), code, { timeout: 8000 });
await B.screenshot({ path: SH + 'v5-home-roomlist.png' });
ok('首頁公開房間列表顯示房主A的房間', true);
await B.click(`#roomList .roomItem[data-code="${code}"]`);
await B.waitForSelector('#lobby:not(.hidden)', { timeout: 20000 }).catch(async e => { console.log('B msg:', await B.textContent('#homeMsg')); throw e; }); ok('從公開列表點擊直接加入', true);
// 3. C（手機）用網址加入
await C.goto(URL + qs('room=' + code)); await waitFor(C, () => __ph.ready);
ok('網址自動帶入房號', (await C.inputValue('#codeIn')) === code, await C.textContent('#joinBtn'));
await C.screenshot({ path: SH + 'v3-mobile-join-by-url.png' });
await C.fill('#nameIn', '手機C'); await C.tap('#joinBtn');
await C.waitForSelector('#lobby:not(.hidden)', { timeout: 20000 }); ok('用網址加入', true);
await waitFor(A, () => __ph.state?.players.length === 3);
ok('房主看到 3 位玩家', (await st(A)).players.length === 3, (await st(A)).players.map(p => p.name).join(','));
ok('非房主看不到開始鈕', await B.isHidden('#startBtn'));

const ids = { A: await myId(A), B: await myId(B), C: await myId(C) };
const byId = id => pages[Object.values(ids).indexOf(id)];
const namesOn = async p => p.evaluate(() => [...document.querySelectorAll('#pList li')].map(li => li.textContent));
const lists = await Promise.all(pages.map(namesOn));
ok('所有人畫面都看得到三人暱稱', lists.every(l => ['房主A', '桌機B', '手機C'].every(n => l.some(t => t.includes(n)))), JSON.stringify(lists));
// 顏色與頭像可自由混搭、隨時更換（不鎖定）
await B.click('#lobbyColors button:nth-child(1)');
await B.click('#lobbyAvatars button:nth-child(4)');
await B.waitForTimeout(250);
const bLook1 = await B.evaluate(() => [__ph.me().color, __ph.me().avatar]);
await B.click('#lobbyColors button:nth-child(2)');
await B.click('#lobbyAvatars button:nth-child(5)');
await B.waitForTimeout(250);
const bLook2 = await B.evaluate(() => [__ph.me().color, __ph.me().avatar]);
ok('大廳顏色與頭像可自由混搭且可再次更換', bLook1[0] !== bLook2[0] && bLook1[1] !== bLook2[1] && (await B.evaluate(() => [...document.querySelectorAll('#lobbyColors button, #lobbyAvatars button')].every(b => !b.disabled))), JSON.stringify([bLook1, bLook2]));
// 甚至跟別人選同色不同頭像也可
const aColor = (await st(A)).players.find(q => q.id === ids.A).color;
await B.click(`#lobbyColors button[data-color="${aColor}"]`);
await B.waitForTimeout(250);
ok('可選跟別人同顏色自由搭配不同頭像', (await st(A)).players.find(q => q.id === ids.B).color === aColor);
const colors = (await st(A)).players.map(p => p.color);
ok('三端顏色同步一致', (await Promise.all(pages.map(st))).every(s => s.players.map(p => p.color).join() === colors.join()), JSON.stringify(colors));
const avatars = (await st(A)).players.map(p => p.avatar);
const lists2 = await Promise.all(pages.map(namesOn));
ok('每人有頭像，且三端看得到', avatars.every(Boolean) && lists2.every(l => avatars.every(a => l.some(t => t.includes(a)))), JSON.stringify(avatars));

// 一鍵複製房號按鈕
await A.context().grantPermissions(['clipboard-read', 'clipboard-write']);
await A.click('#copyCodeBtn');
const clipCode = await A.evaluate(() => navigator.clipboard.readText().catch(() => ''));
ok('一鍵複製房號鈕可複製房號', clipCode === code, clipCode + ' vs ' + code);

// 聊天室高度加大
const chatH_px = await A.evaluate(() => document.getElementById('chatLog').getBoundingClientRect().height);
ok('大廳聊天視窗高度夠高', chatH_px >= 200, 'h=' + Math.round(chatH_px));

// 大廳聊天（雙向）
await A.fill('#chatIn', '大家好，我是房主');
await A.click('#chatSend');
await Promise.all(pages.map(p => p.waitForFunction(() => /大家好，我是房主/.test(document.getElementById('chatLog').textContent), null, { timeout: 8000 })));
await C.fill('#chatIn', '手機也看到了 👋');
await C.tap('#chatSend');
await Promise.all(pages.map(p => p.waitForFunction(() => /手機也看到了/.test(document.getElementById('chatLog').textContent), null, { timeout: 8000 })));
ok('大廳聊天雙向同步', true);
await A.screenshot({ path: SH + 'v5-desktop-lobby.png' });
await C.screenshot({ path: SH + 'v5-mobile-lobby.png' });

// 還沒準備／擲骰時不能開始
ok('未準備時開始鈕停用', await A.evaluate(() => document.getElementById('startBtn').disabled));
await A.click('#startBtn', { force: true });
await A.waitForTimeout(300);
ok('未準備按開始不會開局', (await st(A)).phase === 'lobby');

async function clickReady(p) {
  const on = await p.evaluate(() => !!__ph.me()?.ready);
  if (on) return;
  if (p._touch) await p.tap('#readyBtn'); else await p.click('#readyBtn');
}
async function clickRoll(p) {
  // v14：只有房主有擲骰鍵（一次幫大家擲）；房主的鍵在骰子還在滾時會暫時停用
  if (p !== A) return false;
  const enabled = await p.waitForFunction(() => { const b = document.getElementById('rollBtn'); return b && !b.disabled; }, null, { timeout: 6000 }).then(() => true, () => false);
  if (!enabled) return false;
  if (p._touch) await p.tap('#rollBtn'); else await p.click('#rollBtn');
  return true;
}
async function allReadyAndRoll(map) {
  await A.evaluate(m => __ph.setNextRolls(m), map);
  await A.waitForTimeout(120);
  for (const p of pages) await clickReady(p);
  await waitFor(A, () => __ph.state.players.every(q => q.ready), null, 8000);
  for (let i = 0; i < 6; i++) {
    const s0 = await st(A);
    if (s0.dice?.status === 'done') break;
    for (const p of pages) await clickRoll(p);
    await A.waitForTimeout(350);
  }
  await waitFor(A, () => __ph.state.dice?.status === 'done', null, 8000);
}

// 準備後還沒擲骰，仍不能開始
for (const p of pages) await clickReady(p);
await waitFor(A, () => __ph.state.players.every(q => q.ready));
ok('都準備但還沒擲骰，開始鈕仍停用', await A.evaluate(() => document.getElementById('startBtn').disabled));

// 擲骰：先讓 A、B 平手最低，再重擲分出 B 當鬼
await A.evaluate(() => { for (const q of __ph.state.players) { /* 還原準備即可，骰子尚未擲 */ } });
// 若已按過準備，setNextRolls 後再擲
const rollMap = { [ids.A]: [2, 5], [ids.B]: [2, 1], [ids.C]: [6] };
await A.evaluate(m => __ph.setNextRolls(m), rollMap);
await A.waitForTimeout(120);
for (const p of pages) await clickRoll(p);
await waitFor(A, () => __ph.state.dice?.status === 'tie', null, 8000);
let sDice = await st(A);
ok('最低分平手時進入重擲', sDice.dice?.status === 'tie' && (sDice.dice.tied || []).length === 2, JSON.stringify(sDice.dice));
const tiedNames = (sDice.dice.tied || []).map(id => sDice.players.find(q => q.id === id)?.name).sort();
ok('平手的是擲出 2 點的兩人', tiedNames.join() === '房主A,桌機B', JSON.stringify(tiedNames));
await Promise.all(pages.map(p => p.waitForFunction(() => /平手/.test(document.getElementById('diceMsg').textContent), null, { timeout: 4000 })));
ok('平手訊息大家看得到', (await Promise.all(pages.map(p => p.evaluate(() => document.getElementById('diceMsg').textContent)))).every(t => /平手/.test(t)));
// C 不應再擲；A、B 再擲 → B 得到 1、A 得到 5
await A.waitForTimeout(200);
for (const p of [A, B]) await clickRoll(p);
await Promise.all(pages.map(p => waitFor(p, () => __ph.state?.dice?.status === 'done', null, 8000)));
sDice = await st(A);
ok('重擲後點數同步到所有人', (await Promise.all(pages.map(st))).every(s => s.players.every(q => q.roll === sDice.players.find(x => x.id === q.id).roll)));
ok('最低分成為鬼（狀態已標示）', sDice.dice.seeker === ids.B && sDice.players.find(q => q.id === ids.B).roll === 1, JSON.stringify(sDice.dice));
await Promise.all(pages.map(p => p.waitForFunction(() => /當鬼/.test(document.getElementById('diceMsg').textContent), null, { timeout: 4000 }).catch(() => {})));
ok('擲骰結果說明大家看得到', (await Promise.all(pages.map(p => p.evaluate(() => document.getElementById('diceMsg').textContent)))).every(t => /桌機B/.test(t) && /當鬼/.test(t)));
await A.screenshot({ path: SH + 'v4-dice-result.png' });
ok('擲骰結果與平手重擲同步到聊天系統訊息', await A.evaluate(() => { const t = document.getElementById('chatLog').textContent; return /擲出了/.test(t) && /平手/.test(t) && /當鬼/.test(t); }));
ok('擲骰完成後房主可以開始', await A.evaluate(() => !document.getElementById('startBtn').disabled));

// 4. 開始 → 躲藏階段
await A.evaluate(() => { window.__pt = {}; setInterval(() => { const ph = __ph.state?.phase; if (ph && !__pt[ph]) __pt[ph] = performance.now(); }, 20); });
const t0 = Date.now(); await A.click('#startBtn');
await waitFor(A, () => __ph.state?.phase === 'hide');
let s = await st(A);
const seekerId = s.players.find(p => p.role === 'seeker').id; const seeker = byId(seekerId);
const hiders = pages.filter(p => p !== seeker);
ok('擲骰最低分當鬼、另外兩人躲藏', seekerId === ids.B && s.players.filter(p => p.role === 'seeker').length === 1 && s.players.filter(p => p.role === 'hider').length === 2, 'seeker=' + seeker._n);
ok('躲藏倒數約 22 秒', s.rem > 20000 && s.rem <= 22000, s.rem + 'ms');
ok('鬼的畫面被遮住（閉眼）', await seeker.isVisible('#blind'));
await seeker.screenshot({ path: SH + 'v3-' + (seeker._touch ? 'mobile' : 'desktop') + '-seeker-blind.png' });
// 鬼在躲藏階段不能動
const sPos0 = await seeker.evaluate(() => [__ph.local.x, __ph.local.z]);
if (!seeker._touch) { await seeker.keyboard.down('KeyW'); await seeker.waitForTimeout(600); await seeker.keyboard.up('KeyW'); }
else { await joystick(seeker, 0, -50, 600); }
const sPos1 = await seeker.evaluate(() => [__ph.local.x, __ph.local.z]);

ok('鬼閉眼時不能移動', sPos0[0] === sPos1[0] && sPos0[1] === sPos1[1]);

// 5. 躲藏者變身（取代原本的家具）
const PROPS = await A.evaluate(() => __ph.PROPS); const NP = PROPS.length;
const pid = (name, nth = 0) => PROPS.map((p, i) => [p[0], i]).filter(p => p[0] === name)[nth][1];
const I = { chair: pid('loungeChair'), bench: pid('benchCushion', 1), plant: pid('pottedPlant'), lamp: pid('lampRoundFloor'), sofa: pid('loungeSofa'), stove: pid('kitchenStoveElectric'), frame: pid('frameA'), bed: pid('bedDouble'), ottoman: pid('loungeSofaOttoman'), toy: pid('toyCar'), pot: pid('cookingPot'), console: pid('gameConsole'), kettle: pid('kettle'), ball: pid('toyBall') };
const counts = () => Promise.all(pages.map(p => p.evaluate(() => __ph.visiblePropCount())));
const visAll = id => Promise.all(pages.map(p => p.evaluate(i => __ph.propVisible(i), id)));
async function aimAndTransform(p, propId, standAt) {
  const pitch = (PROPS[propId][4] || 0) > 1 ? -0.4 : 0.5;
  // 家具每局會在原房間裡換位置。先試原本的相對站位；若那邊穿進牆或跑出地圖，就改站到這件家具旁邊走得進去的空位。
  await p.evaluate(async ([id, sx, sz, pitch]) => {
    const q = __ph.propPos(id), pr = __ph.PROPS[id];
    let dx = sx - pr[1], dz = sz - pr[2];
    const len = Math.hypot(dx, dz) || 1;
    const dirs = [[dx / len, dz / len]];
    for (let k = 0; k < 8; k++) dirs.push([Math.sin(k * Math.PI / 4), Math.cos(k * Math.PI / 4)]);
    const clear = (px, pz) => { const c = __ph.collideAt(px, pz, 0.28, 0); return Math.hypot(c[0] - px, c[1] - pz) < 0.08; };
    const cands = [];
    const prefer = [q[0] + dirs[0][0] * Math.min(1.7, len), q[2] + dirs[0][1] * Math.min(1.7, len)];
    if (clear(prefer[0], prefer[1])) cands.push(prefer);
    for (const [ux, uz] of dirs) for (const dist of [1.5, 1.2, 2.0, 2.4]) {
      const nx = q[0] + ux * dist, nz = q[2] + uz * dist;
      if (clear(nx, nz)) cands.push([nx, nz]);
    }
    if (!cands.length) cands.push(prefer);
    let chosen = cands[0];
    for (const [x, z] of cands) {
      __ph.teleport(x, z, 0);
      __ph.lookAt(q[0], q[2], pitch);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const sp = __ph.screenOf('prop', id);
      const u = sp && sp.onScreen ? __ph.pickAt(sp.x, sp.y) : null;
      if (u && u.kind === 'prop' && u.id === id) { chosen = [x, z]; break; }
    }
    __ph.teleport(chosen[0], chosen[1], 0);
    __ph.lookAt(q[0], q[2], pitch);
  }, [propId, standAt[0], standAt[1], pitch]);
  await p.waitForTimeout(300);
  const sp = await p.evaluate(id => __ph.screenOf('prop', id), propId);
  if (p._touch) await p.touchscreen.tap(sp.x, sp.y); else await p.mouse.click(sp.x, sp.y);
  await p.waitForTimeout(150);
  // 準心每一幀都會重算。讀到目標和按下變身如果隔著一次 await，慢機器上準心可能先清掉，F 就沒送出。
  // 在同一個回合裡讀目標並按 F，仍要求點到的就是這一件（沒點到就不會變身）。
  const tgt = await p.evaluate(() => {
    const id = __ph.target;
    if (id != null && !document.getElementById('tfBtn')?.disabled) {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF', key: 'f', bubbles: true }));
    }
    return id;
  });
  await p.waitForTimeout(500);
  return tgt;
}
async function defocus(p) {
  await p.evaluate(() => { document.querySelectorAll('input,textarea,button,select').forEach(el => el.blur()); document.activeElement && document.activeElement.blur(); });
}
async function joystick(p, dx, dy, ms) {
  const bb = await p.locator('#joy').boundingBox(); const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
  const ev = (type, x, y) => p.dispatchEvent('#joy', type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true });
  await ev('pointerdown', cx, cy); await ev('pointermove', cx + dx, cy + dy); await p.waitForTimeout(ms); await ev('pointerup', cx + dx, cy + dy);
}
async function moveTest(p, label) {
  const a = await p.evaluate(() => [__ph.local.x, __ph.local.z]);
  if (p._touch) await joystick(p, 0, -50, 600); else { await p.keyboard.down('KeyW'); await p.waitForTimeout(600); await p.keyboard.up('KeyW'); }
  const c = await p.evaluate(() => [__ph.local.x, __ph.local.z]);
  ok(label + (p._touch ? '（手機搖桿）' : '（WASD）'), Math.hypot(c[0] - a[0], c[1] - a[1]) > .5, JSON.stringify([a, c]));
}
const [H1, H2] = hiders; const h1 = await myId(H1), h2 = await myId(H2);
for (const h of hiders) await moveTest(h, '躲藏者可移動');
ok('開始時所有家具都在', (await counts()).every(n => n === NP), JSON.stringify(await counts()) + ' / ' + NP);

// 人物建模縮小至少一半（鬼 <= 0.68, 人 <= 0.50）
const scSk = await A.evaluate(id => __ph.buddyScale(id), seekerId);
const scH1 = await A.evaluate(id => __ph.buddyScale(id), h1);
ok('鬼與人未變身建模縮小一半以上', scSk > 0 && scSk <= 0.68 && scH1 > 0 && scH1 <= 0.50, JSON.stringify([scSk, scH1]));

// 頭上名稱：人看得到人，鬼看不到任何躲藏者名稱
ok('躲藏者看得到隊友頭上名稱', await H1.evaluate(id => __ph.labelVisible(id), h2));
ok('鬼看不到躲藏者頭上名稱', !(await seeker.evaluate(([a, b]) => __ph.labelVisible(a) || __ph.labelVisible(b), [h1, h2])));


// 遊戲中聊天：桌機 Enter 打開輸入，輸入不觸發按鍵，Enter 送出回到遊戲，Esc 取消，左上常駐訊息可顯示/隱藏
const chatH = H1; // H1 是桌機 A（B 是鬼）
await defocus(chatH);
await chatH.keyboard.press('Enter');
const openedByEnter = await chatH.evaluate(() => !document.getElementById('chatBox')?.classList.contains('collapsed') && document.activeElement === document.getElementById('chatIn'));
ok('桌機按 Enter 打開並聚焦聊天輸入框', openedByEnter);
await chatH.fill('#chatIn', '遊戲中也能聊天');
const posChat0 = await chatH.evaluate(() => [__ph.local.x, __ph.local.z, __ph.local.y]);
await chatH.keyboard.down('KeyW'); await chatH.waitForTimeout(400); await chatH.keyboard.up('KeyW');
await chatH.keyboard.press('Space'); await chatH.keyboard.press('KeyF'); await chatH.keyboard.press('KeyT');
const posChat1 = await chatH.evaluate(() => [__ph.local.x, __ph.local.z, __ph.local.y]);
ok('輸入聊天時不會觸發走路或技能', posChat0[0] === posChat1[0] && posChat0[1] === posChat1[1], JSON.stringify([posChat0, posChat1]));
await chatH.keyboard.press('Enter');
const returnedToGame = await chatH.evaluate(() => document.activeElement !== document.getElementById('chatIn') && document.getElementById('chatBox')?.classList.contains('collapsed'));
ok('再按 Enter 送出並回到遊戲', returnedToGame);
// Esc 取消
await chatH.keyboard.press('Enter');
await chatH.keyboard.press('Escape');
ok('按 Esc 取消聊天輸入', await chatH.evaluate(() => document.activeElement !== document.getElementById('chatIn') && document.getElementById('chatBox')?.classList.contains('collapsed')));

await Promise.all(pages.map(p => p.waitForFunction(() => /遊戲中也能聊天/.test(document.getElementById('chatFeed').textContent), null, { timeout: 8000 })));
// 手機端（C）用按鈕回覆
await C.tap('#chatToggle');
await C.fill('#chatIn', '收到訊息了');
await C.tap('#chatSend');
await Promise.all(pages.map(p => p.waitForFunction(() => /收到訊息了/.test(document.getElementById('chatFeed').textContent), null, { timeout: 8000 })));
ok('遊戲中聊天在畫面左上常駐顯示且雙向同步', true);
// 不會淡出、左上不重疊
await A.waitForTimeout(1200);
const feedBoxA = await A.evaluate(() => { const f = document.getElementById('chatFeed').getBoundingClientRect(); const tb = document.getElementById('topbar').getBoundingClientRect(); return { fx: f.x, fy: f.y, fr: f.right, tx: tb.left, op: getComputedStyle(document.querySelector('.chatFeedLine')).opacity }; });
const feedBoxC = await C.evaluate(() => { const f = document.getElementById('chatFeed').getBoundingClientRect(); const tb = document.getElementById('topbar').getBoundingClientRect(); return { fx: f.x, fy: f.y, fr: f.right, tx: tb.left }; });
ok('遊戲中聊天訊息不會自動淡出且在左上不重疊計分板', feedBoxA.op === '1' && feedBoxA.fx < 40 && feedBoxA.fr < feedBoxA.tx && feedBoxC.fr < feedBoxC.tx, JSON.stringify([feedBoxA, feedBoxC]));
await C.evaluate(() => document.getElementById('chatBox')?.classList.add('collapsed'));
await A.screenshot({ path: SH + 'v5-desktop-ingame-chat.png' });
await C.screenshot({ path: SH + 'v5-mobile-ingame-chat.png' });
// 顯示／隱藏開關並記住選擇
await A.click('#chatFeedToggle');
ok('可隱藏畫面聊天訊息並記住設定', await A.evaluate(() => document.getElementById('chatFeed').classList.contains('hidden') && localStorage.getItem('ph-chatfeed') === '0'));
await A.click('#chatFeedToggle');
ok('可重新顯示畫面聊天訊息', await A.evaluate(() => !document.getElementById('chatFeed').classList.contains('hidden') && localStorage.getItem('ph-chatfeed') === '1'));

for (const p of pages) {
  await p.evaluate(() => document.getElementById('chatBox')?.classList.add('collapsed'));
  await defocus(p);
}


// 跳躍：走到床邊跳上去
await defocus(H1);
const bedTop = await H1.evaluate(i => __ph.propTop(i), I.bed);
await H1.evaluate(i => {
  const q = __ph.propPos(i), ry = __ph.PROPS[i][3] * Math.PI / 180;
  let x = q[0], z = q[2] - 1.55;
  const free = (px, pz) => { const c = __ph.collideAt(px, pz, .2, 0); return Math.hypot(c[0] - px, c[1] - pz) < .05; };
  if (!free(x, z)) {
    outer: for (const ang of [Math.PI, 0, 1.2, -1.2, Math.PI / 2, -Math.PI / 2]) for (const dist of [1.45, 1.15, 1.85]) {
      const nx = q[0] + Math.sin(ry + ang) * dist, nz = q[2] + Math.cos(ry + ang) * dist;
      if (free(nx, nz)) { x = nx; z = nz; break outer; }
    }
  }
  __ph.teleport(x, z, 0); __ph.lookAt(q[0], q[2], .2);
}, I.bed);
await H1.waitForTimeout(200);
if (H1._touch) { await H1.tap('#jumpBtn'); await H1.evaluate(() => { /* 手機同時往前 */ }); await joystick(H1, 0, -50, 700); }
else { await H1.keyboard.down('KeyW'); await H1.keyboard.press('Space'); await H1.waitForTimeout(800); await H1.keyboard.up('KeyW'); }
const landY = await H1.evaluate(() => __ph.local.y);
ok('跳上床舖（落在床面）', landY > 0.35 && landY < bedTop + 0.35, `y=${landY.toFixed(2)} top=${bedTop.toFixed(2)}`);

// 推擠：小件會動、大件不動
const ott0 = await A.evaluate(i => __ph.propPos(i), I.ottoman);
const sofa0 = await A.evaluate(i => __ph.propPos(i), I.sofa);
await H1.evaluate(([x, z, lx, lz]) => { __ph.teleport(x, z, 0); __ph.lookAt(lx, lz); }, [ott0[0], ott0[2] + 1.4, ott0[0], ott0[2]]);
if (H1._touch) await joystick(H1, 0, -50, 700); else { await H1.keyboard.down('KeyW'); await H1.waitForTimeout(700); await H1.keyboard.up('KeyW'); }
await A.waitForTimeout(500);
const ott1 = await A.evaluate(i => __ph.propPos(i), I.ottoman);
await Promise.all(pages.map(p => p.waitForFunction(([i, x, z]) => { const q = __ph.propPos(i); return Math.hypot(q[0] - x, q[2] - z) < 0.25; }, [I.ottoman, ott1[0], ott1[2]], { timeout: 4000 }).catch(() => {})));
const ott1o = await Promise.all(pages.map(p => p.evaluate(i => __ph.propPos(i), I.ottoman)));
ok('撞到小家具會被推開', Math.hypot(ott1[0] - ott0[0], ott1[2] - ott0[2]) > .15, JSON.stringify([ott0, ott1]));
ok('被推開的位置同步到所有人', ott1o.every(p => Math.hypot(p[0] - ott1[0], p[2] - ott1[2]) < .2), JSON.stringify(ott1o));
// 衝刺撞倒小家具後，再慢慢撞推它仍維持倒地狀態
await H1.evaluate(([x, z, lx, lz]) => { __ph.teleport(x, z, 0); __ph.lookAt(lx, lz); __ph.local.stam = 3; __ph.local.exhausted = false; __ph.holdMove.iz = -1; __ph.holdMove.sprint = true; }, [ott1[0], ott1[2] + 1.0, ott1[0], ott1[2]]);
await H1.waitForTimeout(450);
await H1.evaluate(() => { __ph.holdMove.iz = 0; __ph.holdMove.sprint = false; });
await A.waitForTimeout(250);
const ottTip1 = await A.evaluate(i => __ph.propTip(i), I.ottoman);
const ott2 = await A.evaluate(i => __ph.propPos(i), I.ottoman);
await H1.evaluate(([x, z, lx, lz]) => { __ph.teleport(x, z, 0); __ph.lookAt(lx, lz); __ph.holdMove.iz = -1; }, [ott2[0], ott2[2] + 0.9, ott2[0], ott2[2]]);
await H1.waitForTimeout(450);
await H1.evaluate(() => { __ph.holdMove.iz = 0; });
await A.waitForTimeout(250);
const ott3 = await A.evaluate(i => __ph.propPos(i), I.ottoman);
const ottTip2 = await A.evaluate(i => __ph.propTip(i), I.ottoman);
ok('推倒後再推移動仍保持倒地不立正', Math.abs(ottTip1) > 1.2 && Math.abs(ottTip2) > 1.2 && Math.hypot(ott3[0] - ott2[0], ott3[2] - ott2[2]) > .08, JSON.stringify([ottTip1, ottTip2, ott2, ott3]));

await H1.evaluate(([x, z, lx, lz]) => { __ph.teleport(x, z, 0); __ph.lookAt(lx, lz); }, [sofa0[0] + 2.2, sofa0[2], sofa0[0], sofa0[2]]);
if (H1._touch) await joystick(H1, 0, -50, 700); else { await H1.keyboard.down('KeyW'); await H1.waitForTimeout(700); await H1.keyboard.up('KeyW'); }
await A.waitForTimeout(300);
const sofa1 = await A.evaluate(i => __ph.propPos(i), I.sofa);
ok('撞到大家具（沙發）不會被推走', Math.hypot(sofa1[0] - sofa0[0], sofa1[2] - sofa0[2]) < .05, JSON.stringify([sofa0, sofa1]));

// 衝刺：比走路快，消耗體力
await defocus(H1);
await H1.evaluate(() => { __ph.teleport(-6, -1.5, 0); __ph.lookAt(10, -1.5); __ph.local.stam = 3; __ph.local.exhausted = false; __ph.local.stamWait = 0; __ph.holdMove.iz = -1; __ph.holdMove.sprint = true; });
const sp0 = await H1.evaluate(() => [__ph.local.x, __ph.local.z, __ph.local.stam]);
if (H1._touch) { await H1.evaluate(() => { __ph.holdMove.iz = 0; __ph.holdMove.sprint = false; }); const bb = await H1.locator('#sprintBtn').boundingBox(); await H1.dispatchEvent('#sprintBtn', 'pointerdown', { pointerId: 11, pointerType: 'touch', clientX: bb.x + 5, clientY: bb.y + 5 }); await joystick(H1, 0, -50, 800); await H1.dispatchEvent('#sprintBtn', 'pointerup', { pointerId: 11, pointerType: 'touch' }); }
else { await H1.waitForFunction(() => Math.hypot(__ph.local.x + 6, __ph.local.z + 1.5) > 3.0 && __ph.local.stam < 2.7, null, { timeout: 4000 }).catch(() => {}); await H1.evaluate(() => { __ph.holdMove.iz = 0; __ph.holdMove.sprint = false; }); }
const sp1 = await H1.evaluate(() => [__ph.local.x, __ph.local.z, __ph.local.stam]);
const sprintDist = Math.hypot(sp1[0] - sp0[0], sp1[1] - sp0[1]);
ok('衝刺比走路快', sprintDist > 3.0, `dist=${sprintDist.toFixed(2)} stam ${sp0[2].toFixed(2)}→${sp1[2].toFixed(2)}`);
ok('衝刺會消耗體力', sp1[2] < sp0[2] - 0.3, `stam=${sp1[2]}`);

// 牆上掛飾：H2 先變成掛畫（之後再換成板凳，不佔 H1 的兩次變身）
await H2.evaluate(([x, z, i, fx, fz]) => { __ph.teleport(x, z); __ph.lookAt(fx, fz, -0.55); }, [-12.4, 1.5, I.frame, PROPS[I.frame][1], PROPS[I.frame][2]]);
await H2.waitForTimeout(250);
const spW = await H2.evaluate(id => __ph.screenOf('prop', id), I.frame);
if (spW) { if (H2._touch) await H2.touchscreen.tap(spW.x, spW.y); else await H2.mouse.click(spW.x, spW.y); }
await H2.waitForTimeout(150);
let tgW = await H2.evaluate(() => __ph.target);
if (tgW !== I.frame) await H2.evaluate(i => __ph.setTarget(i), I.frame);
if (H2._touch) await H2.tap('#tfBtn'); else await H2.keyboard.press('KeyF');
await H2.waitForTimeout(500);
s = await st(A); let PW = s.players.find(p => p.id === h2);
ok('可變成牆上掛畫', PW.prop === I.frame && PW.mnt === 1, JSON.stringify([tgW, PW.prop, PW.mnt, PW.y]));
try {
  for (const pg of pages) await pg.waitForFunction(i => __ph.propVisible(i) === false, I.frame, { timeout: 4000 });
  ok('掛畫被取代（所有人看不到原本的）', true);
} catch (err) { ok('掛畫被取代（所有人看不到原本的）', false, JSON.stringify(await visAll(I.frame))); }
const w0 = await H2.evaluate(() => [__ph.local.x, __ph.local.y, __ph.local.z, __ph.mounted]);
ok('變成掛畫後掛在原來的牆上位置', Math.abs(w0[0] - PROPS[I.frame][1]) < .15 && Math.abs(w0[1] - (PROPS[I.frame][4] || 0)) < .2 && w0[3] === true, JSON.stringify(w0));
// 沿牆左右（A/D）及上下（W=上、S=下，不受俯仰影響）
await H2.evaluate(([z]) => { __ph.lookAt(-14.5, z, 0.5); __ph.slideWall(0.6, -1, 0); }, [PROPS[I.frame][2]]);
const w1 = await H2.evaluate(() => [__ph.local.x, __ph.local.y, __ph.local.z, __ph.mounted]);
ok('掛在牆上可沿牆左右滑動', Math.abs(w1[2] - w0[2]) > .25, JSON.stringify([w0, w1]));
// 往下 (S: iz=+1) 再往上 (W: iz=-1)，即使俯仰角為正也必須 W 往上、S 往下
await H2.evaluate(() => { __ph.cam.pitch = 0.55; __ph.slideWall(0.25, 0, 1); });
const wDown = await H2.evaluate(() => __ph.local.y);
await H2.evaluate(() => { __ph.cam.pitch = 0.55; __ph.slideWall(0.15, 0, -1); });
const wUp = await H2.evaluate(() => __ph.local.y);
ok('牆上 S 往下、W 往上（方向直覺）', wDown < w1[1] - .2 && wUp > wDown + .2, JSON.stringify([w1[1], wDown, wUp]));
ok('沿牆滑動時不會離開牆面', Math.abs(w1[0] - PROPS[I.frame][1]) < .15 && w1[3] === true, JSON.stringify(w1));
// 朝房間內走，仍應留在牆上
await H2.evaluate(([x, z]) => { __ph.lookAt(x, z, 0); __ph.slideWall(0.4, 1, 0); }, [-10, w1[2]]);
const w2 = await H2.evaluate(() => [__ph.local.x, __ph.local.y, __ph.local.z, __ph.mounted]);
ok('往房間方向走也不會離開牆', Math.abs(w2[0] - PROPS[I.frame][1]) < .15 && w2[3] === true, JSON.stringify(w2));
await seeker.waitForFunction(([id, x, z]) => { const q = __ph.disguisePos(id); return q && Math.hypot(q[0] - x, q[1] - z) < 0.45; }, [h2, w2[0], w2[2]], { timeout: 3000 }).catch(() => {});
const wSeen = await seeker.evaluate(id => __ph.disguisePos(id), h2);
ok('牆上位置同步到鬼的畫面', wSeen && Math.hypot(wSeen[0] - w2[0], wSeen[1] - w2[2]) < .45, JSON.stringify([w2, wSeen]));
// 跳躍落地後可自由走，再往牆面跳可重新貼上牆
await H2.evaluate(() => { __ph.local.z = 3.6; });
if (H2._touch) await H2.tap('#jumpBtn'); else await H2.keyboard.press('Space');
await H2.waitForTimeout(1050);
const w3 = await H2.evaluate(() => [__ph.local.x, __ph.local.y, __ph.local.z, __ph.mounted]);
ok('跳躍後從牆上落地（自由移動）', w3[3] === false && w3[0] > PROPS[I.frame][1] + .15 && w3[1] < 1.15, JSON.stringify(w3));
// 往牆面跳躍，重新貼回牆上
await H2.evaluate(() => { __ph.teleport(-13.5, 4.1, 0); __ph.lookAt(-14.2, 4.1, 0); __ph.local.vy = 5.5; __ph.local.grounded = false; __ph.local.reMountAt = 0; __ph.holdMove.iz = -1; });
await H2.waitForFunction(() => __ph.mounted === true, null, { timeout: 2500 }).catch(() => {});
await H2.evaluate(() => { __ph.holdMove.iz = 0; });
const wRe = await H2.evaluate(() => [__ph.local.x, __ph.local.y, __ph.local.z, __ph.mounted]);
ok('往牆壁跳躍可重新貼上牆面', wRe[3] === true && Math.abs(wRe[0] - PROPS[I.frame][1]) < .2, JSON.stringify(wRe));
await A.waitForTimeout(300);

// H2 不瞬移直接選附近立燈變身：掛畫留在剛才牆上的新位置（不歸回原位）
const frameDropPos = await H2.evaluate(() => [__ph.local.x, __ph.local.y, __ph.local.z]);
await H2.evaluate(([bx, bz, i]) => { __ph.lookAt(bx, bz, 0.2); __ph.setTarget(i); }, [PROPS[I.ball][1], PROPS[I.ball][2], I.ball]);
await H2.waitForTimeout(150);
await H2.evaluate(i => { __ph.setTarget(i); }, I.ball);
if (H2._touch) await H2.evaluate(() => document.getElementById('tfBtn').click()); else await H2.keyboard.press('KeyF');
await H2.waitForTimeout(500);
// 接著再換成板凳供後面找人階段使用
const tg2 = await aimAndTransform(H2, I.bench, [9.8, 3.2]);
s = await st(A); let P2 = s.players.find(p => p.id === h2);
ok('H2 變身成功', P2.prop === I.bench && P2.tf === 3, JSON.stringify([tg2, P2.prop, P2.tf]));
await A.waitForTimeout(350);
const frameAfter = await A.evaluate(i => __ph.propPos(i), I.frame);
ok('牆掛飾換成別的家具後留在牆上新位置', (await visAll(I.frame)).every(v => v === true) && Math.hypot(frameAfter[2] - frameDropPos[2], frameAfter[1] - frameDropPos[1]) < .35, JSON.stringify([frameDropPos, frameAfter]));

const chairAt = await A.evaluate(i => __ph.propPos(i), I.chair);
const tg1 = await aimAndTransform(H1, I.chair, [-10.3, 3.0]);
s = await st(A); let P1 = s.players.find(p => p.id === h1);
ok('H1 點家具選取目標', tg1 === I.chair, 'target=' + tg1); ok('H1 變身成功（第 1 次）', P1.prop === I.chair && P1.tf === 1, JSON.stringify([P1.prop, P1.tf]));
await A.waitForTimeout(300);
// 各分頁（軟體算圖很慢）套用房主狀態的時間不一，改成輪詢等到所有人都看到椅子消失、位置到位，再判定（原本固定等 300ms 偶發失敗）
for (let k = 0; k < 40; k++) { const vs = await visAll(I.chair), cs = await counts(), dp = await seeker.evaluate(id => __ph.disguisePos(id), h1);
  if (vs.every(v => v === false) && cs.every(n => n === NP - 2) && dp && Math.hypot(dp[0] - chairAt[0], dp[1] - chairAt[2]) < .3) break; await A.waitForTimeout(100); }
await seeker.waitForFunction(([id, y]) => { const q = __ph.disguiseYaw(id); return q != null && Math.abs(q - y) < .05; }, [h1, PROPS[I.chair][3] * Math.PI / 180], { timeout: 3000 }).catch(() => {});
ok('變身＝取代：原本那張椅子在所有人畫面消失', (await visAll(I.chair)).every(v => v === false), JSON.stringify(await visAll(I.chair)));
ok('家具總數不變（少 1 件真的，多 1 件假的）', (await counts()).every(n => n === NP - 2), JSON.stringify(await counts()));
const dpos = await seeker.evaluate(id => __ph.disguisePos(id), h1);
ok('H1 站到原本椅子的位置', !!dpos && Math.hypot(dpos[0] - chairAt[0], dpos[1] - chairAt[2]) < .3, JSON.stringify(dpos));
ok('H1 方向＝原本椅子的方向', Math.abs((await seeker.evaluate(id => __ph.disguiseYaw(id), h1)) - PROPS[I.chair][3] * Math.PI / 180) < .05);
// 旋轉
const yaw0 = await H1.evaluate(() => __ph.local.py);
if (H1._touch) { const bb = await H1.locator('#rotR').boundingBox(); await H1.dispatchEvent('#rotR', 'pointerdown', { pointerId: 9, pointerType: 'touch', clientX: bb.x + 5, clientY: bb.y + 5 }); await H1.waitForTimeout(600); await H1.dispatchEvent('#rotR', 'pointerup', { pointerId: 9, pointerType: 'touch' }); }
else { await H1.keyboard.down('KeyE'); await H1.waitForTimeout(600); await H1.keyboard.up('KeyE'); }
const yaw1 = await H1.evaluate(() => __ph.local.py);
await seeker.waitForFunction(([id, y]) => { const q = __ph.disguiseYaw(id); return q != null && Math.abs(Math.atan2(Math.sin(q - y), Math.cos(q - y))) < 0.1; }, [h1, yaw1], { timeout: 3000 }).catch(() => {});
const seenYaw = await seeker.evaluate(id => __ph.disguiseYaw(id), h1);
ok('躲藏者可轉動家具方向' + (H1._touch ? '（手機按鈕）' : '（E 鍵）'), Math.abs(yaw1 - yaw0) > .4, `${yaw0.toFixed(2)} → ${yaw1.toFixed(2)}`);
ok('轉動方向同步到鬼的畫面', seenYaw != null && Math.abs(Math.atan2(Math.sin(seenYaw - yaw1), Math.cos(seenYaw - yaw1))) < .1, `本地 ${yaw1.toFixed(2)} / 鬼看到 ${seenYaw == null ? 'null' : seenYaw.toFixed(2)}`);
// 鎖定：預設鎖定 → 轉鏡頭不影響家具；解鎖 → 家具跟鏡頭
await H1.evaluate(() => { __ph.cam.yaw += 1.2; }); await H1.waitForTimeout(200);
ok('鎖定時轉鏡頭家具不會轉', Math.abs((await H1.evaluate(() => __ph.local.py)) - yaw1) < .01);
if (H1._touch) await H1.tap('#lockBtn'); else await H1.keyboard.press('KeyR');
await H1.waitForTimeout(200);
// 家具朝向是每個畫面幀才跟著鏡頭，慢機器上 200ms 可能還沒更新一幀；輪詢到對齊為止
await H1.waitForFunction(() => { const d = __ph.local.py - (__ph.cam.yaw + Math.PI); return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < .01; }, null, { timeout: 3000 }).catch(() => {});
const fol = await H1.evaluate(() => [__ph.local.py, __ph.cam.yaw + Math.PI]);
ok('解鎖後家具跟著鏡頭方向', Math.abs(Math.atan2(Math.sin(fol[0] - fol[1]), Math.cos(fol[0] - fol[1]))) < .01);
if (H1._touch) await H1.tap('#lockBtn'); else await H1.keyboard.press('KeyR');
s = await st(A); P2 = s.players.find(p => p.id === h2);
ok('兩人變身後家具總數 = 原本 - 2', (await counts()).every(n => n === NP - 2), JSON.stringify(await counts()));
for (const p of hiders) await p.screenshot({ path: SH + 'v3-' + (p._touch ? 'mobile' : 'desktop') + '-hider-disguised.png' });
// 偽裝時頭上名稱規則也成立
ok('偽裝時鬼仍看不到躲藏者頭上名稱', !(await seeker.evaluate(([a, b]) => __ph.labelVisible(a) || __ph.labelVisible(b), [h1, h2])));
ok('偽裝時躲藏者之間看得到名稱', await H1.evaluate(id => __ph.labelVisible(id), h2));

// 移動椅子到 [-11.2, 2.2] 後直接選旁邊的玩具車變身 → 椅子留在 [-11.2, 2.2]，不歸回原位
await H1.evaluate(() => __ph.teleport(-11.2, 2.2, 0));
await A.waitForTimeout(250);
await H1.evaluate(i => __ph.setTarget(i), I.toy);
if (H1._touch) await H1.tap('#tfBtn'); else await H1.keyboard.press('KeyF');
await H1.waitForTimeout(500);
s = await st(A); P1 = s.players.find(p => p.id === h1);
ok('客廳電視前玩具可選為變身（第 2 次）', P1.prop === I.toy && P1.tf === 2, JSON.stringify([P1.prop, P1.tf]));
await seeker.waitForFunction(([i, x, z]) => { const q = __ph.propPos(i); return Math.hypot(q[0] - x, q[2] - z) < 0.4; }, [I.chair, -11.2, 2.2], { timeout: 3000 }).catch(() => {});
const chairDrop = await seeker.evaluate(i => __ph.propPos(i), I.chair);
ok('第 2 次變身：椅子留在剛才的位置（不歸回原位）', (await visAll(I.chair)).every(v => v === true) && Math.hypot(chairDrop[0] - (-11.2), chairDrop[2] - 2.2) < .4, JSON.stringify(chairDrop));
ok('第 2 次變身：玩具車被取代', (await visAll(I.toy)).every(v => v === false));
ok('家具總數仍 = 原本 - 2', (await counts()).every(n => n === NP - 2), JSON.stringify(await counts()));

// 第 3 次變身成燈（無限次數）：移動到 [-12.6, 3.8] 直接選旁邊立燈 → 玩具車留在 [-12.6, 3.8]，燈光跟著玩家亮著！
const lampAt = await A.evaluate(i => __ph.propPos(i), I.lamp);
const lampDrop = [lampAt[0] + 1.05, lampAt[2] + 0.35];
await H1.evaluate(([x, z]) => __ph.teleport(x, z, 0), lampDrop);
await A.waitForTimeout(250);
await H1.evaluate(i => __ph.setTarget(i), I.lamp);
if (H1._touch) await H1.tap('#tfBtn'); else await H1.keyboard.press('KeyF');
await H1.waitForTimeout(500);
s = await st(A); P1 = s.players.find(p => p.id === h1);
ok('第 3 次變身成功（無限次數）', P1.prop === I.lamp && P1.tf === 3, JSON.stringify([P1.prop, P1.tf]));
await seeker.waitForFunction(([i, x, z]) => { const q = __ph.propPos(i); return Math.hypot(q[0] - x, q[2] - z) < 0.4; }, [I.toy, lampDrop[0], lampDrop[1]], { timeout: 3000 }).catch(() => {});
const toyDrop = await seeker.evaluate(i => __ph.propPos(i), I.toy);
ok('第 3 次變身：玩具車留在剛才的位置', (await visAll(I.toy)).every(v => v === true) && Math.hypot(toyDrop[0] - lampDrop[0], toyDrop[2] - lampDrop[1]) < .4, JSON.stringify(toyDrop));
ok('變身按鈕保持可用（無限次）', !(await H1.isDisabled('#tfBtn')) && (await H1.textContent('#tfBtn')).includes('變身'));
const lampLitAll = await Promise.all(pages.map(pg => pg.evaluate(id => __ph.disguiseHasLight(id) && __ph.disguisePointLightCount(id) >= 1, h1)));
ok('變成燈後燈光亮著並同步到所有人', lampLitAll.every(Boolean), JSON.stringify(lampLitAll));
await H1.screenshot({ path: SH + 'v5-lamp-disguise.png' });

// 第 4 次、第 5 次：廚房餐具＋盆栽皆可變身
await aimAndTransform(H1, I.kettle, [-4.72, -7.2]);
s = await st(A); P1 = s.players.find(p => p.id === h1);
ok('廚房餐具可選為變身', P1.prop === I.kettle && P1.tf === 4, JSON.stringify([P1.prop, P1.tf]));
await aimAndTransform(H1, I.plant, [-11.5, -3.4]);
await H1.evaluate(([x, z]) => __ph.teleport(x, z, 0), [PROPS[I.plant][1], PROPS[I.plant][2]]);
// 噴漆（T）改到找人階段測：打中才糊畫面、沒打中沒有遮罩

// 6. 找人階段（顏料槍）
await waitFor(A, () => __ph.state?.phase === 'seek', null, 30000);
const pt = await A.evaluate(() => __pt); const hideDur = Math.round(pt.seek - pt.hide); ok('躲藏階段約 22 秒後進入找人階段', hideDur > 21000 && hideDur < 23500, hideDur + 'ms');
s = await st(A); const sinceSeek = await A.evaluate(() => performance.now() - __pt.seek); ok('找人倒數約 70 秒', Math.abs(s.rem + sinceSeek - 70000) < 800, `rem=${s.rem} 已過=${Math.round(sinceSeek)}`);
await waitFor(seeker, () => document.getElementById('blind').classList.contains('hidden')); ok('鬼張開眼（遮罩消失）', true);
await moveTest(seeker, '鬼找人階段可移動');
ok('鬼手上有顏料槍', await seeker.evaluate(id => !!__ph.hasGun(id), seekerId));

// 躲藏者噴漆：沒打中不糊畫面；打中則 75% 遮罩，約 3.5 秒後消退
async function hiderPaint(hider, standAt, lookAt, pitch = .2) {
  await hider.evaluate(([x, z, lx, lz, pitch]) => { __ph.teleport(x, z); __ph.lookAt(lx, lz, pitch); }, [...standAt, ...lookAt, pitch]);
  await hider.waitForTimeout(300);
  if (hider._touch) await hider.tap('#tauntBtn'); else await hider.keyboard.press('KeyT');
}
const ov = p => p.evaluate(() => __ph.overlayOpacity());
const splatBeforePaint = await A.evaluate(() => __ph.splatCount());
const skPos = await seeker.evaluate(() => [__ph.local.x, __ph.local.z]);
// 沒打中：H2 對牆壁發射，鬼站在遠處
await seeker.evaluate(() => { __ph.teleport(-8, 6, 0); });
await H2.evaluate(() => { __ph.teleport(0, -1.5, 0); });
await H2.evaluate(() => __ph.tauntAt(13, 1.0, -1.5));
await A.waitForTimeout(1800);
ok('噴漆沒打中鬼：鬼的畫面沒有遮罩', (await ov(seeker)) < .05, 'op=' + (await ov(seeker)));
ok('噴漆沒打中：躲藏者也沒有遮罩', (await ov(H2)) < .05);
// 打中：H1 在走道對準鬼的胸口發射（H2 已用過冷卻）
await seeker.evaluate(() => { __ph.teleport(6, -1.5, 0); });
await H1.evaluate(() => { __ph.teleport(-1, -1.5, 0); __ph.lookAt(6, -1.5, 0); });
await H1.waitForTimeout(200);
await H1.evaluate(() => __ph.tauntAt(6, 0.55, -1.5));
await seeker.waitForFunction(() => __ph.overlayOpacity() >= 0.68 || __ph.evLog.some(e => e.k === 'painted'), null, { timeout: 4000 }).catch(() => {});
const evPaint = await seeker.evaluate(() => __ph.evLog.filter(e => e.k === 'painted').length);
const evPaintAll = (await Promise.all(pages.map(p => p.evaluate(() => __ph.evLog.filter(e => e.k === 'painted').length)))).reduce((a, b) => a + b, 0);
const opHit = await ov(seeker);
ok('噴漆打中鬼：畫面約 75% 顏料遮罩（半透明）', (evPaint >= 1 || evPaintAll >= 1) && opHit >= 0.68 && opHit <= 0.82, `op=${opHit} ev=${evPaint} all=${evPaintAll}`);
ok('只有鬼會被糊住，躲藏者畫面正常', (await ov(H1)) < .05);
await seeker.screenshot({ path: SH + 'v3-seeker-overlay.png' });
await A.waitForTimeout(4200);
ok('顏料遮罩約 3–4 秒後消退', (await ov(seeker)) < 0.08, 'op=' + (await ov(seeker)));
// 恢復位置，後面的抓人／閃避測試才準
await H1.evaluate(() => __ph.teleport(-1.2, -1.5, 0));
await H2.evaluate(() => __ph.teleport(3.2, -1.5, 0));
await seeker.evaluate(([x, z]) => { __ph.teleport(x, z, 0); }, skPos);

async function aimFrom(standAt, lookXZ) { await seeker.evaluate(([x, z, lx, lz]) => { __ph.teleport(x, z); __ph.lookAt(lx, lz); }, [...standAt, ...lookXZ]); await seeker.waitForTimeout(400); }
async function fireAt(kind, id) {
  const sp = await seeker.evaluate(([k, i]) => __ph.screenOf(k, i), [kind, id]);
  console.log('  seeker fires at', kind, id, JSON.stringify(sp));
  if (seeker._touch) await seeker.touchscreen.tap(sp.x, sp.y); else await seeker.mouse.click(sp.x, sp.y);
}
const splatsAll = () => Promise.all(pages.map(p => p.evaluate(() => __ph.splatCount())));
// 打到真沙發：顏料要飛一下（不是瞬間判定）→ 落點留下顏料、扣 10 血
const sofaNow = await seeker.evaluate(i => __ph.propPos(i), I.sofa);
await aimFrom([sofaNow[0] - 2.4, sofaNow[2]], [sofaNow[0], sofaNow[2]]);
await fireAt('prop', I.sofa); await seeker.waitForTimeout(60);
const inflight = await Promise.all(pages.map(p => p.evaluate(() => __ph.projCount()))); s = await st(A);
ok('顏料彈在飛（所有人都看得到），還沒判定', inflight.every(n => n >= 1) && s.hp === 100, JSON.stringify(inflight) + ' hp=' + s.hp);
await seeker.screenshot({ path: SH + 'v3-' + (seeker._touch ? 'mobile' : 'desktop') + '-seeker-paint-flying.png' });
await A.waitForTimeout(700); s = await st(A);
ok('打到真家具扣 10 血', s.hp === 90, 'hp=' + s.hp);
const sc1 = await splatsAll(); ok('顏料留在家具上（所有人同步）', sc1.every(n => n >= splatBeforePaint + 1 && n === sc1[0]), JSON.stringify(sc1) + ' before=' + splatBeforePaint);
await seeker.screenshot({ path: SH + 'v3-' + (seeker._touch ? 'mobile' : 'desktop') + '-seeker-splat.png' });
// 打牆：扣 2 血
await aimFrom([-6.8, 2.2], [-6.8, -0.5]);
const wsp = await seeker.evaluate(() => __ph.screenOfPoint(-6.8, 0, -0.3));
if (seeker._touch) await seeker.touchscreen.tap(wsp.x, wsp.y); else await seeker.mouse.click(wsp.x, wsp.y);
await A.waitForTimeout(1500); s = await st(A); ok('顏料打到牆/地板只扣 2 血', s.hp === 88, 'hp=' + s.hp);
// 閃避：鬼對 H2 開槍，H2 馬上移開 → 沒抓到
const P2now = (await st(A)).players.find(p => p.id === h2);
// 兩人都在走道上。沿著走道開槍會先打到另一個人，所以從北側退開，飛行中再橫移。
await aimFrom([P2now.x, P2now.z + 4.5], [P2now.x, P2now.z]);
await fireAt('player', h2); await H2.evaluate(([x, z]) => __ph.teleport(x, z, 0), [P2now.x + 3, P2now.z]);
await A.waitForTimeout(1600); s = await st(A);
ok('顏料飛行中躲開 → 不算抓到', s.players.find(p => p.id === h2).alive === true, 'hp=' + s.hp);
// 命中：H1（盆栽）不動 → 被抓、盆栽放回原位
const h1now = (await st(A)).players.find(p => p.id === h1);
await aimFrom([h1now.x - 4.5, h1now.z], [h1now.x, h1now.z]);
await fireAt('player', h1); await seeker.waitForTimeout(80);
s = await st(A); ok('剛發射時還沒抓到（要等顏料飛到）', s.players.find(p => p.id === h1).alive === true);
await A.waitForTimeout(900); s = await st(A);
ok('顏料打中偽裝的玩家 → 抓到', s.players.find(p => p.id === h1).alive === false, 'hp=' + s.hp);
ok('抓到後左上角聊天有系統訊息（含剩餘人數）', (await Promise.all(pages.map(p => p.evaluate(n => {
  const feed = document.getElementById('chatFeed')?.textContent || '';
  const log = document.getElementById('chatLog')?.textContent || '';
  const t = feed + log;
  return /抓到了/.test(t) && new RegExp('剩 ' + n + ' 人').test(t);
}, '1')))).every(Boolean), await A.evaluate(() => (document.getElementById('chatFeed')?.textContent || '') + ' | ' + (document.getElementById('chatLog')?.textContent || '')));
await A.waitForTimeout(300);
ok('被抓後他取代的盆栽放回原位', (await visAll(I.plant)).every(v => v === true));
ok('被抓的人看到通知/觀戰', (await H1.textContent('#role')).includes('被抓'), await H1.textContent('#role'));
ok('遊戲還沒結束（還有 1 人）', s.phase === 'seek');
// 抓最後一個 H2
const P2b = (await st(A)).players.find(p => p.id === h2);
await aimFrom([P2b.x, 1.8], [P2b.x, P2b.z]); await fireAt('player', h2);
await waitFor(A, () => __ph.state?.phase === 'end', null, 5000).catch(() => { });
s = await st(A); ok('全部抓到 → 鬼贏', s.phase === 'end' && s.winner === 'seeker', JSON.stringify([s.phase, s.winner, s.reason]));
await A.waitForTimeout(300);
ok('回合結束：所有家具恢復', (await counts()).every(n => n === NP), JSON.stringify(await counts()));
const chairReset = await A.evaluate(i => __ph.propPos(i), I.chair);
const frameReset = await A.evaluate(i => __ph.propPos(i), I.frame);
ok('回合結束後留在原地的家具與掛飾都重設回原本位置', Math.hypot(chairReset[0] - PROPS[I.chair][1], chairReset[2] - PROPS[I.chair][2]) < .05 && Math.hypot(frameReset[2] - PROPS[I.frame][2], frameReset[1] - PROPS[I.frame][4]) < .05, JSON.stringify([chairReset, frameReset]));
const sc = await splatsAll(); ok('顏料痕跡整局都留著、每個人一樣', sc.every(n => n === sc[0] && n >= 3), JSON.stringify(sc));
for (const p of pages) await p.screenshot({ path: SH + 'v3-' + (p._touch ? 'mobile' : 'desktop-' + p._n[0]) + '-end-seeker-wins.png' });

// 7. 第 2 局：鬼一直打真家具，血量歸零 → 躲藏者贏
await waitFor(A, () => __ph.state?.phase === 'lobby', null, 12000); ok('結束後回到大廳', true);
const lobby2 = await st(A);
ok('回到大廳仍保留暱稱與顏色', lobby2.players.every(q => q.name && q.color) && lobby2.players.map(q => q.name).sort().join() === '房主A,手機C,桌機B', JSON.stringify(lobby2.players.map(q => [q.name, q.color, q.ready, q.roll])));
ok('新一局準備與骰子已重置', lobby2.players.every(q => !q.ready && !q.roll) && lobby2.dice?.status !== 'done', JSON.stringify(lobby2.dice));
ok('回到大廳聊天還在', await A.evaluate(() => /大家好，我是房主/.test(document.getElementById('chatLog').textContent) && /遊戲中也能聊天/.test(document.getElementById('chatLog').textContent)));
await allReadyAndRoll({ [ids.A]: [4], [ids.B]: [6], [ids.C]: [2] });
await A.click('#startBtn'); await waitFor(A, () => __ph.state?.phase === 'hide', null, 15000); await A.waitForTimeout(300);
ok('第 2 局擲骰最低分當鬼', (await st(A)).players.find(q => q.role === 'seeker')?.id === ids.C);
ok('新回合清掉上回合的顏料', (await splatsAll()).every(n => n === 0), JSON.stringify(await splatsAll()));
await waitFor(A, () => __ph.state?.phase === 'seek', null, 30000);
s = await st(A); const seeker2Id = s.players.find(p => p.role === 'seeker').id; const sk2 = byId(seeker2Id);
ok('第 2 局重新開始、血量回滿', s.hp === 100 && s.round === 2, 'seeker=' + sk2._n);
await sk2.evaluate(([x, z, lx, lz]) => { __ph.teleport(x, z); __ph.lookAt(lx, lz); }, [-5.555, -6.9, -5.555, -8.35]); await sk2.waitForTimeout(400);
for (let i = 0; i < 14 && (await st(A)).phase === 'seek'; i++) { const sp = await sk2.evaluate(i => __ph.screenOf('prop', i), I.stove); if (sk2._touch) await sk2.touchscreen.tap(sp.x, sp.y); else await sk2.mouse.click(sp.x, sp.y); await sk2.waitForTimeout(720); }
await waitFor(A, () => __ph.state?.phase === 'end', null, 5000).catch(() => { });
s = await st(A); ok('鬼血量歸零 → 躲藏者贏', s.hp === 0 && s.winner === 'hiders', JSON.stringify([s.hp, s.winner, s.reason]));
await C.screenshot({ path: SH + 'v3-mobile-end-hp-zero.png' });

// 8. 房間滿員/進行中不能加入：遊戲中第 4 人加入應被拒
const D = await mk('D-late', { viewport: { width: 800, height: 600 } });
await waitFor(A, () => __ph.state?.phase === 'lobby', null, 12000);
await allReadyAndRoll({ [ids.A]: [1], [ids.B]: [3], [ids.C]: [5] });
await A.click('#startBtn'); await waitFor(A, () => __ph.state?.phase === 'hide');
await D.goto(URL + qs('')); await waitFor(D, () => __ph.ready);
await D.waitForFunction(c => { const b = document.querySelector(`#roomList .roomItem[data-code="${c}"]`); return b && b.disabled && /遊戲中/.test(b.textContent) && /3\/8/.test(b.textContent); }, code, { timeout: 8000 });
ok('遊戲中房間在列表灰掉顯示遊戲中且不可點', true);
await D.fill('#codeIn', code.toLowerCase()); await D.click('#joinBtn');
await D.waitForFunction(() => /進行中/.test(document.getElementById('homeMsg').textContent), null, { timeout: 15000 }).then(() => ok('遊戲中加入會被告知等下一局', true)).catch(async () => ok('遊戲中加入會被告知等下一局', false, await D.textContent('#homeMsg') + ' / phase=' + (await st(A)).phase));
// 錯誤房號
await D.goto(URL + qs('')); await waitFor(D, () => __ph.ready); await D.fill('#codeIn', 'ZZZZ'); await D.click('#joinBtn');
await D.waitForFunction(() => /找不到|連不上/.test(document.getElementById('homeMsg').textContent), null, { timeout: 20000 }).then(() => ok('錯誤房號顯示找不到房間', true)).catch(() => ok('錯誤房號顯示找不到房間', false));
// 遊戲畫面截圖（找人階段，桌機 + 手機）
await waitFor(A, () => __ph.state?.phase === 'seek', null, 30000);
for (const p of pages) await p.screenshot({ path: SH + 'v3-' + (p._touch ? 'mobile' : 'desktop-' + p._n[0]) + '-seek-phase.png' });

await A.evaluate(() => __ph.sbDeleteRoom());
await D.evaluate(() => __ph.sbFetchRooms());
await D.waitForFunction(c => !document.querySelector(`#roomList .roomItem[data-code="${c}"]`), code, { timeout: 5000 });
ok('房主關閉後房間從公開列表移除', true);

console.log('\n==== SUMMARY ====');
console.log(results.filter(r => r[0] === 'PASS').length + ' pass / ' + results.filter(r => r[0] === 'FAIL').length + ' fail');
for (const r of results) if (r[0] === 'FAIL') console.log('FAIL:', r[1], r[2]);
await b.close();
