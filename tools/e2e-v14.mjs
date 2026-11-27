// v14：(1) 擲骰桌在各種視窗大小都完整看得到、整個擲骰過程有畫面在動（逐格比對像素）；只有房主擲骰
//      (2) 每種落地家具從正面＋兩側直直走進去：沒有上下抖動、身體不會明顯穿進家具、鏡頭不會被家具擋住或在家具裡
//      (3) 變身成家具的玩家也一樣
import { chromium, devices } from 'playwright-core';
const URL = process.env.URL || 'http://localhost:8765/';
const SKIP_SWEEP = !!process.env.SKIP_SWEEP;
const results = []; const ok = (name, cond, info = '') => { results.push([cond ? 'PASS' : 'FAIL', name, info]); console.log(cond ? 'PASS' : 'FAIL', name, info); };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = [];
const waitFor = (p, fn, arg, t = 20000) => p.waitForFunction(fn, arg, { timeout: t });
async function newPage(opts, name) { const ctx = await b.newContext(opts); const p = await ctx.newPage(); p._n = name; p.on('pageerror', e => { errs.push(name + ': ' + e.message); console.log(`[${name} err]`, e.message); }); return p; }
// 在頁面裡解碼截圖、算像素統計
async function stats(p, buf, prevB64) {
  return p.evaluate(async ([b64, prev]) => {
    const load = async s => { const im = await createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob()); const c = new OffscreenCanvas(im.width, im.height); const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height).data; };
    const a = await load(b64); let n = a.length / 4, felt = 0, colorful = 0, sum = 0, sum2 = 0;
    for (let i = 0; i < a.length; i += 4) { const r = a[i], g = a[i + 1], bl = a[i + 2], l = .3 * r + .59 * g + .11 * bl; sum += l; sum2 += l * l;
      if (g > r + 25 && g > bl + 10 && g < 190) felt++; if (Math.max(r, g, bl) - Math.min(r, g, bl) > 60) colorful++; }
    const sd = Math.sqrt(sum2 / n - (sum / n) ** 2); let diff = null;
    if (prev) { const q = await load(prev); if (q.length === a.length) { let d = 0; for (let i = 0; i < a.length; i += 4) d += Math.abs(a[i] - q[i]) + Math.abs(a[i + 1] - q[i + 1]) + Math.abs(a[i + 2] - q[i + 2]); diff = d / n / 3; } }
    return { felt: felt / n, colorful: colorful / n, sd, diff };
  }, [buf.toString('base64'), prevB64]);
}

// ---------- 1. 擲骰桌：多種視窗 ----------
const VIEWS = [['1366x768', { viewport: { width: 1366, height: 768 } }], ['1920x1080', { viewport: { width: 1920, height: 1080 } }], ['1280x720', { viewport: { width: 1280, height: 720 } }],
  ['iPhone13直', { ...devices['iPhone 13'], defaultBrowserType: undefined }], ['iPhone13橫', { ...devices['iPhone 13 landscape'], defaultBrowserType: undefined }]];
for (const [vn, opts] of VIEWS) {
  const p = await newPage(opts, vn);
  await p.goto(URL + '?net=local'); await waitFor(p, () => __ph.ready, null, 60000);
  await p.fill('#nameIn', '房主'); await (opts.hasTouch ? p.tap('#createBtn') : p.click('#createBtn')); await p.waitForSelector('#lobby:not(.hidden)', { timeout: 20000 });
  await p.evaluate(() => __ph.addTestPlayers([{ name: '阿華', color: '#7cc4ff' }, { name: '小美', color: '#b9a3ff' }, { name: '大雄', color: '#9be3c8' }])); await p.waitForTimeout(500);
  const before = await p.evaluate(() => { const e = document.getElementById('rollBtn'); return { dis: e.disabled, hidden: e.classList.contains('hidden') }; });
  await p.evaluate(() => document.getElementById('readyBtn').scrollIntoView({ block: 'center' }));
  await (opts.hasTouch ? p.tap('#readyBtn') : p.click('#readyBtn'));
  await waitFor(p, () => !document.getElementById('rollBtn').disabled, null, 8000).catch(() => {});
  ok(`[${vn}] 房主：大家準備好前擲骰鍵不能按、之後可以按`, before.dis && !before.hidden && await p.evaluate(() => !document.getElementById('rollBtn').disabled), JSON.stringify(before));
  // 把擲骰鍵捲到畫面下緣附近（模擬骰桌可能在畫面外），按下去後要自動讓骰桌進到畫面
  await p.evaluate(() => document.getElementById('rollBtn').scrollIntoView({ block: 'end' }));
  // 在頁面裡從按下擲骰開始，每 ~200ms 讀回一次骰桌像素，直到全部停下
  await p.evaluate(() => { window.__snaps = []; const t0 = performance.now(); const f = () => { const t = performance.now() - t0; const sn = __ph.diceTray.snap();
    __snaps.push({ t: Math.round(t), rolling: __ph.diceTray.rolling(), grid: sn?.grid, sd: sn?.sd, felt: sn?.felt, top: Math.round(document.getElementById('diceTray').getBoundingClientRect().top), bot: Math.round(document.getElementById('diceTray').getBoundingClientRect().bottom) });
    if (t < 4500) setTimeout(f, 200); }; setTimeout(f, 0); });
  await (opts.hasTouch ? p.tap('#rollBtn') : p.click('#rollBtn'));
  const shot0 = await (await p.$('#diceCanvas')).screenshot(); await p.screenshot({ path: `../shots/v14-dice-${vn}-midroll.png` });
  await p.waitForTimeout(4800);
  const snaps = await p.evaluate(() => __snaps);
  const roll = snaps.filter(x => x.rolling && x.grid); const rollMs = roll.length ? roll[roll.length - 1].t - roll[0].t : 0;
  const gd = (a, b2) => a.reduce((s, v, i) => s + Math.abs(v - b2[i]), 0) / a.length; const diffs = []; for (let k = 1; k < roll.length; k++) diffs.push(+gd(roll[k].grid, roll[k - 1].grid).toFixed(2));
  const moving = diffs.filter(d => d > .3).length;
  ok(`[${vn}] 整個擲骰動畫有播（約 ${(rollMs / 1000).toFixed(1)} 秒，${roll.length} 次取樣，${moving} 次畫面在動）`, rollMs >= 1300 && rollMs <= 4500 && moving >= Math.max(2, diffs.length * .6), JSON.stringify(diffs));
  ok(`[${vn}] 擲骰期間骰桌一直在畫面內`, roll.length > 0 && roll.every(x => x.top >= -1 && x.bot <= (opts.viewport?.height || 9999) + 1 && x.sd > 12 && x.felt > .1), JSON.stringify(roll.map(x => [x.t, x.top, x.bot, Math.round(x.sd)]).slice(0, 4)));
  await waitFor(p, () => !__ph.diceTray.rolling() && __ph.diceTray.list().length === 4 && __ph.diceTray.list().every(d => d.settled), null, 30000).catch(() => {});
  await p.waitForTimeout(500);
  const el = await p.$('#diceCanvas'); const fin = await stats(p, await el.screenshot(), shot0.toString('base64'));
  ok(`[${vn}] 實際螢幕畫面：骰桌不是空白，且剛擲出時和停下後不同`, fin.felt > .15 && fin.sd > 12 && fin.colorful > .2 && fin.diff > 1, JSON.stringify(fin));
  const pr = await p.evaluate(() => __ph.diceTray.projected());
  const inside = a => Math.abs(a[0]) <= 1 && Math.abs(a[1]) <= 1;
  ok(`[${vn}] 桌子四角、每顆骰子和名牌都在畫布內`, pr.corners.every(inside) && pr.dice.length === 4 && pr.dice.every(d => inside(d.p) && inside(d.tag)), JSON.stringify({ c: pr.corners.map(a => a.map(v => +v.toFixed(2))), fov: await p.evaluate(() => __ph.diceTray.fov()) }));
  const faces = await p.evaluate(() => { const r = Object.fromEntries(__ph.state.players.map(q => [q.id, q.roll])); return __ph.diceTray.list().every(d => d.face === r[d.id]); });
  ok(`[${vn}] 骰面 = 房主點數`, faces);
  await p.evaluate(() => document.getElementById('diceTray').scrollIntoView({ block: 'center' })); await p.waitForTimeout(200);
  await p.screenshot({ path: `../shots/v14-dice-${vn}.png` });
  await p.context().close();
}

// ---------- 2. 家具掃描 ----------
if (!SKIP_SWEEP) {
  const p = await newPage({ viewport: { width: 900, height: 600 } }, 'sweep');
  await p.goto(URL + '?net=local&lowgfx=1'); await waitFor(p, () => __ph.ready, null, 60000);
  await p.fill('#nameIn', 'T'); await p.click('#createBtn'); await p.waitForSelector('#lobby:not(.hidden)');
  await p.evaluate(() => { document.getElementById('lobby').style.display = 'none'; });
  const models = await p.evaluate(() => { const seen = new Map(); __ph.PROPS.forEach((pr, i) => { const m = __ph.propMap(i); const key = m + ':' + pr[0]; if ((pr[4] || 0) !== 0 || __ph.isSmall(i) || __ph.WALL_PROP.has(pr[0]) || seen.has(key)) return; seen.set(key, [i, pr[0], m]); }); return [...seen.values()]; });
  const bad = { jitter: [], pen: [], cam: [] }; let tested = 0;
  for (const [i, name, map] of models) {
    await p.evaluate(m => { __ph.selectMap(m); __ph.setMapLocal(m); }, map); /* 房間的地圖也要換，不然大廳狀態會把地圖切回去 */
    await p.waitForFunction(m => __ph.curMap === m && __ph.state?.map === m, map, { timeout: 8000 }); await p.waitForTimeout(300);
    const res = await p.evaluate(async i => {
      const pr = __ph.PROPS[i], pos = __ph.propPos(i), ry = pr[3] * Math.PI / 180, sz = __ph.modelSize(pr[0]); const out = [];
      for (const [side, ang] of [['正面', 0], ['左側', Math.PI / 2], ['右側', -Math.PI / 2]]) {
        const a = ry + ang, fx = Math.sin(a), fz = Math.cos(a), half = Math.abs(Math.sin(ang)) > .5 ? sz[0] / 2 : sz[2] / 2;
        let sx = null, sz2 = null; for (const dd of [.9, .6, .45, 1.3]) { const x = pos[0] + fx * (half + dd), z = pos[2] + fz * (half + dd); const c = __ph.collideAt(x, z, .19, 0); if (Math.hypot(c[0] - x, c[1] - z) < .01) { sx = x; sz2 = z; break; } }
        if (sx == null) continue;
        __ph.teleport(sx, sz2, 0); __ph.lookAt(pos[0], pos[2], .45); __ph.local.vy = 0; __ph.holdMove.iz = -1;
        const ys = []; let pen = 0, sink = 0, who = null, lastPen = 0; const t0 = performance.now();
        await new Promise(res => { const f = () => { const t = performance.now() - t0; if (t > 500) ys.push(__ph.local.y);
          if (t > 200 && t - lastPen > 90) { /* 剛瞬移的那幾幀角色模型還在舊位置，先不量 */ lastPen = t; const bp = __ph.bodyPen(.15); if (bp.side > pen) { pen = bp.side; who = bp.who; } if (bp.sink > sink) { sink = bp.sink; who = bp.who; } }
          if (t > 1500) return res(); requestAnimationFrame(f); }; f(); });
        __ph.holdMove.iz = 0;
        let osc = 0, last = 0; for (let k = 1; k < ys.length; k++) { const d = ys[k] - ys[k - 1]; if (Math.abs(d) < .004) continue; const sg = Math.sign(d); if (last && sg !== last) osc++; last = sg; }
        __ph.cam.yaw += Math.PI; await new Promise(r => setTimeout(r, 250)); const occ = __ph.camOccluded(); __ph.cam.yaw -= Math.PI;
        out.push({ side, osc, pen, sink, who, cam: occ ? occ.by : null });
      }
      return out; }, i);
    for (const r of res) { tested++; const tag = `${map}/${name}/${r.side}`;
      if (r.osc >= 2) bad.jitter.push(`${tag} osc=${r.osc}`);
      if (r.pen > .08 || r.sink > .08) bad.pen.push(`${tag} pen=${r.pen.toFixed(2)} sink=${r.sink.toFixed(2)} (${r.who})`);
      if (r.cam) bad.cam.push(`${tag} (${r.cam})`); }
  }
  console.log('掃描', models.length, '種家具、', tested, '個方向');
  ok(`走進家具不會上下抖動（${models.length} 種家具 × 3 面）`, bad.jitter.length === 0, bad.jitter.join(' | '));
  ok('身體不會明顯穿進家具（側面 / 往下陷 ≤ 8 公分）', bad.pen.length === 0, bad.pen.join(' | '));
  ok('鏡頭轉向家具那側時，鏡頭和角色之間沒有不透明的家具', bad.cam.length === 0, bad.cam.join(' | '));
  // 沙發正面：最常被回報的情況，額外檢查站著不動時的 y 變化
  const sofaY = await p.evaluate(async () => { const out = [];
    for (let i = 0; i < __ph.PROPS.length; i++) { const pr = __ph.PROPS[i]; if (pr[0] !== 'loungeSofa') continue; __ph.setMapLocal(__ph.propMap(i)); const pos = __ph.propPos(i), ry = pr[3] * Math.PI / 180, fx = Math.sin(ry), fz = Math.cos(ry);
      for (const off of [-.5, 0, .5]) { const x = pos[0] + fx * 1.4 - fz * off, z = pos[2] + fz * 1.4 + fx * off; const c = __ph.collideAt(x, z, .19, 0); if (Math.hypot(c[0] - x, c[1] - z) > .01) continue;
        __ph.teleport(x, z, 0); __ph.lookAt(pos[0] - fz * off, pos[2] + fx * off, .45); __ph.holdMove.iz = -1; const ys = []; const t0 = performance.now();
        await new Promise(r => { const f = () => { const t = performance.now() - t0; if (t > 900) ys.push(__ph.local.y); if (t > 2200) return r(); requestAnimationFrame(f); }; f(); }); __ph.holdMove.iz = 0;
        const m = ys.reduce((a, b) => a + b, 0) / ys.length; out.push([i, off, +(ys.reduce((a, b) => a + (b - m) ** 2, 0) / ys.length).toFixed(5), +m.toFixed(2)]); } }
    return out; });
  ok('沙發正面走到底停住後 y 的變異數 ≈ 0（每張沙發、左中右）', sofaY.length >= 3 && sofaY.every(a => a[2] < 1e-4), JSON.stringify(sofaY));
  await p.context().close();
}

// ---------- 3. 變身成家具 ----------
{
  const allPages = []; const relay = m => { for (const q of allPages) q.evaluate(m => window.__localnetIn && window.__localnetIn(m), m).catch(() => { }); };
  const mk = async name => { const ctx = await b.newContext({ viewport: { width: 1100, height: 700 } }); await ctx.exposeBinding('__relay', (src, m) => relay(m)); const q = await ctx.newPage(); allPages.push(q); q.on('pageerror', e => errs.push(name + ': ' + e.message)); return q; };
  const A = await mk('A'), B = await mk('B');
  await A.goto(URL + '?net=local&lowgfx=1&hide=200&seek=200&seekerhost=1'); await waitFor(A, () => __ph.ready, null, 60000);
  await A.fill('#nameIn', '鬼'); await A.click('#createBtn'); await A.waitForSelector('#lobby:not(.hidden)'); const code = (await A.textContent('#roomCode')).trim();
  await B.goto(URL + '?net=local&lowgfx=1'); await waitFor(B, () => __ph.ready, null, 60000); await B.fill('#nameIn', '躲'); await B.fill('#codeIn', code); await B.click('#joinBtn');
  await waitFor(A, () => __ph.state?.players?.length === 2, null, 20000);
  await A.waitForSelector('#startBtn:not([disabled])', { timeout: 15000 }); await A.click('#startBtn'); await waitFor(B, () => __ph.state?.phase === 'hide', null, 15000);
  const PROPS = await B.evaluate(() => __ph.PROPS);
  const pick = n => PROPS.findIndex((pr, i) => pr[0] === n && i < 300 && (pr[4] || 0) === 0);
  const sofa = PROPS.findIndex(pr => pr[0] === 'loungeSofa'), bed = PROPS.findIndex(pr => pr[0] === 'bedDouble');
  const rows = [];
  for (const n of ['chairCushion', 'pottedPlant', 'cabinetBedDrawerTable']) {
    const id = pick(n); if (id < 0) continue;
    const live = await B.evaluate(i => __ph.propPos(i), id);
    for (const [ox, oz] of [[.8, 0], [-.8, 0], [0, .8], [0, -.8], [.6, .6], [-.6, -.6]]) {
      await B.evaluate(([x, z]) => __ph.teleport(x, z, 0), [live[0] + ox, live[2] + oz]); await B.waitForTimeout(250);
      await B.evaluate(i => __ph.tryTransform(i), id); if (await waitFor(B, i => __ph.me()?.prop === i, id, 2500).then(() => true, () => false)) break; }
    if (!(await B.evaluate(i => __ph.me()?.prop === i, id))) { rows.push([n, 'transform failed']); continue; }
    await B.waitForTimeout(1600);
    for (const tgt of [sofa, bed]) {
      const r = await B.evaluate(async (tgt) => {
        const pr = __ph.PROPS[tgt], pos = __ph.propPos(tgt), ry = pr[3] * Math.PI / 180, fx = Math.sin(ry), fz = Math.cos(ry);
        __ph.teleport(pos[0] + fx * 1.6, pos[2] + fz * 1.6, 0); __ph.lookAt(pos[0], pos[2], .45); __ph.holdMove.iz = -1; const ys = []; const t0 = performance.now();
        await new Promise(res => { const f = () => { const t = performance.now() - t0; if (t > 700) ys.push(__ph.local.y); if (t > 2000) return res(); requestAnimationFrame(f); }; f(); }); __ph.holdMove.iz = 0;
        let osc = 0, last = 0; for (let k = 1; k < ys.length; k++) { const d = ys[k] - ys[k - 1]; if (Math.abs(d) < .004) continue; const sg = Math.sign(d); if (last && sg !== last) osc++; last = sg; }
        __ph.cam.yaw += Math.PI; await new Promise(r => setTimeout(r, 300)); const occ = __ph.camOccluded(); __ph.cam.yaw -= Math.PI; return { osc, cam: occ?.by || null, r: +__ph.playR().toFixed(2) }; }, tgt);
      rows.push([n, PROPS[tgt][0], r]); }
  }
  console.log(JSON.stringify(rows));
  ok('變身成家具走進沙發／床：不抖動、鏡頭不被不透明家具擋住', rows.length >= 6 && rows.every(r => typeof r[2] === 'object' && r[2].osc < 2 && !r[2].cam), JSON.stringify(rows));
}
ok('沒有頁面錯誤', errs.length === 0, errs.join(' | '));
const fail = results.filter(r => r[0] === 'FAIL').length; console.log(`\n${results.length - fail} passed, ${fail} failed`);
await b.close(); process.exit(fail ? 1 : 0);
