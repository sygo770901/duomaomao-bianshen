// v14 前後對照截圖：床（身體陷進去／鏡頭穿進家具）、沙發前抖動、擲骰桌（1366x768）
import { chromium } from 'playwright-core';
const URL = process.env.URL || 'http://localhost:8765/', TAG = process.env.TAG || 'after', SH = '../shots/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(URL + '?net=local'); await p.waitForFunction(() => __ph.ready, null, { timeout: 60000 });
await p.fill('#nameIn', '小明'); await p.click('#createBtn'); await p.waitForSelector('#lobby:not(.hidden)');
// 擲骰桌
await p.evaluate(() => __ph.addTestPlayers([{ name: '阿華', color: '#7cc4ff' }, { name: '小美', color: '#b9a3ff' }, { name: '大雄', color: '#9be3c8' }])); await p.waitForTimeout(500);
if (!(await p.evaluate(() => __ph.me().ready))) await p.click('#readyBtn'); await p.waitForTimeout(400);
await p.evaluate(() => __ph.hostRoll()); await p.waitForTimeout(700);
await p.screenshot({ path: `${SH}v14-dice-${TAG}-1366-midroll.png` });
await p.waitForTimeout(3500); await p.screenshot({ path: `${SH}v14-dice-${TAG}-1366.png` });
// 床：從床側走上去
await p.evaluate(() => { document.getElementById('lobby').classList.add('hidden'); document.getElementById('hud')?.classList.remove('hidden'); });
const bed = await p.evaluate(() => { const i = __ph.PROPS.findIndex(pr => pr[0] === 'bedDouble' && __ph.propMap(__ph.PROPS.indexOf(pr)) === 'home'); return { i, pos: __ph.propPos(i), ry: __ph.PROPS[i][3] }; });
console.log('bed', JSON.stringify(bed));
const ry = bed.ry * Math.PI / 180, sx = Math.cos(ry), sz = -Math.sin(ry); // 床的側邊方向（本地 +x）
await p.evaluate(([x, z, tx, tz]) => { __ph.teleport(x, z, 0); __ph.lookAt(tx, tz, .28); __ph.holdMove.iz = -1; }, [bed.pos[0] + sx * 1.7, bed.pos[2] + sz * 1.7, bed.pos[0], bed.pos[2]]);
await p.waitForTimeout(520); await p.evaluate(() => { __ph.holdMove.iz = 0; }); await p.waitForTimeout(400);
console.log('onBed y', await p.evaluate(() => [__ph.local.y, JSON.stringify(__ph.bodyPen ? __ph.bodyPen(.15, false) : null)]));
await p.screenshot({ path: `${SH}v14-bed-${TAG}.png` });
// 鏡頭轉向家具那側（貼著床頭櫃）
const ns = await p.evaluate(() => { const i = __ph.PROPS.findIndex((pr, k) => pr[0] === 'cabinetBedDrawerTable' && __ph.propMap(k) === 'home'); return { i, pos: __ph.propPos(i), ry: __ph.PROPS[i][3] }; });
const nr = ns.ry * Math.PI / 180, fx = Math.sin(nr), fz = Math.cos(nr);
await p.evaluate(([x, z, tx, tz]) => { __ph.teleport(x, z, 0); __ph.lookAt(tx, tz, .35); __ph.holdMove.iz = -1; }, [ns.pos[0] + fx * 1.2, ns.pos[2] + fz * 1.2, ns.pos[0], ns.pos[2]]);
await p.waitForTimeout(700); await p.evaluate(() => { __ph.holdMove.iz = 0; __ph.cam.yaw += Math.PI * .85; }); await p.waitForTimeout(400);
console.log('cam', JSON.stringify(await p.evaluate(() => __ph.camOccluded ? __ph.camOccluded() : null)));
await p.screenshot({ path: `${SH}v14-camera-${TAG}.png` });
// 沙發正面
const so = await p.evaluate(() => { const i = __ph.PROPS.findIndex((pr, k) => pr[0] === 'loungeSofa' && __ph.propMap(k) === 'home'); return { i, pos: __ph.propPos(i), ry: __ph.PROPS[i][3] }; });
const sr = so.ry * Math.PI / 180, ffx = Math.sin(sr), ffz = Math.cos(sr);
await p.evaluate(() => __ph.cam.yaw = 0);
const ys = await p.evaluate(async ([x, z, tx, tz]) => { __ph.teleport(x, z, 0); __ph.lookAt(tx, tz, .45); __ph.holdMove.iz = -1; const ys = []; const t0 = performance.now();
  await new Promise(r => { const f = () => { const t = performance.now() - t0; if (t > 600) ys.push(+__ph.local.y.toFixed(3)); if (t > 2200) return r(); requestAnimationFrame(f); }; f(); }); __ph.holdMove.iz = 0; return ys; },
  [so.pos[0] + ffx * 1.5 - ffz * .35, so.pos[2] + ffz * 1.5 + ffx * .35, so.pos[0] - ffz * .35, so.pos[2] + ffx * .35]);
console.log('sofa y samples', ys.length, 'distinct', new Set(ys).size, 'min', Math.min(...ys), 'max', Math.max(...ys), JSON.stringify(ys.slice(-30)));
await p.screenshot({ path: `${SH}v14-sofa-${TAG}.png` });
await b.close();
