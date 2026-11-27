// v14：每種落地家具，從正面＋兩側直直走進去 → 量上下抖動、身體穿進家具多少、鏡頭有沒有被家具擋住
import { chromium } from 'playwright-core';
const URL = process.env.URL || 'http://localhost:8765/';
const DISGUISE = process.env.DISGUISE; // 例如 DISGUISE=1 → 用變身家具的半徑（目前只量本體）
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(URL + '?net=local&lowgfx=1'); await p.waitForFunction(() => __ph.ready, null, { timeout: 60000 });
await p.fill('#nameIn', 'T'); await p.click('#createBtn'); await p.waitForSelector('#lobby:not(.hidden)');
await p.evaluate(() => { document.getElementById('lobby').style.display = 'none'; });
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const models = await p.evaluate(([only, process_all]) => { const seen = new Map();
  __ph.PROPS.forEach((pr, i) => { const m = __ph.propMap(i); const key = m + ':' + pr[0]; if ((pr[4] || 0) !== 0 || (!process_all && __ph.isSmall(i)) || __ph.WALL_PROP.has(pr[0]) || seen.has(key)) return; if (only && !new RegExp(only).test(pr[0])) return; seen.set(key, [i, pr[0], m]); });
  return [...seen.values()]; }, [process.env.ONLY || null, !!process.env.ALL]);
console.log('models', models.length);
const rows = [];
for (const [i, name, map] of models) {
  await p.evaluate(m => { __ph.selectMap(m); __ph.setMapLocal(m); }, map); /* 房間的地圖也要換，不然大廳狀態會把地圖切回去 */
  await p.waitForFunction(m => __ph.curMap === m && __ph.state?.map === m, map, { timeout: 8000 }); await p.waitForTimeout(300);
  const res = await p.evaluate(async i => {
    const pr = __ph.PROPS[i], pos = __ph.propPos(i), ry = pr[3] * Math.PI / 180, sz = __ph.modelSize(pr[0]);
    const out = [];
    for (const [side, ang] of [['front', 0], ['left', Math.PI / 2], ['right', -Math.PI / 2]]) {
      const a = ry + ang, fx = Math.sin(a), fz = Math.cos(a), ext = Math.abs(fx) * sz[0] / 2 + Math.abs(fz) * sz[2] / 2; // 粗估
      const halfX = Math.abs(Math.sin(ang)) > .5 ? sz[0] / 2 : sz[2] / 2;
      let sx = null, sz2 = null; for (const dd of [.9, .6, .45, 1.3]) { const x = pos[0] + fx * (halfX + dd), z = pos[2] + fz * (halfX + dd); const c = __ph.collideAt(x, z, .19, 0); if (Math.hypot(c[0] - x, c[1] - z) < .01) { sx = x; sz2 = z; break; } }
      if (sx == null) { out.push({ side, skip: 'start blocked' }); continue; }
      __ph.teleport(sx, sz2, 0); __ph.lookAt(pos[0], pos[2], .45); __ph.local.vy = 0; __ph.holdMove.iz = -1;
      const ys = [], pens = []; let side_ = 0, sink = 0, who = null; const t0 = performance.now(); let lastPen = 0;
      await new Promise(res => { const f = () => { const t = performance.now() - t0;
        if (t > 500) ys.push(__ph.local.y);
        if (t - lastPen > 90) { lastPen = t; const bp = __ph.bodyPen(.15); if (bp.side > side_) { side_ = bp.side; who = bp.who; } if (bp.sink > sink) { sink = bp.sink; who = bp.who; } }
        if (t > 1500) return res(); requestAnimationFrame(f); }; f(); });
      __ph.holdMove.iz = 0;
      let osc = 0, last = 0; for (let k = 1; k < ys.length; k++) { const d = ys[k] - ys[k - 1]; if (Math.abs(d) < .004) continue; const sg = Math.sign(d); if (last && sg !== last) osc++; last = sg; }
      // 鏡頭轉到家具那一側（鏡頭在角色和家具後面）
      __ph.cam.yaw += Math.PI; await new Promise(r => setTimeout(r, 250)); const occ = __ph.camOccluded(); __ph.cam.yaw -= Math.PI;
      out.push({ side, osc, yr: +(Math.max(...ys) - Math.min(...ys)).toFixed(3), endY: +__ph.local.y.toFixed(2), pen: side_, sink, who, cam: occ ? occ.by + '@' + occ.at + '/' + occ.camDist : null });
    }
    return out;
  }, i);
  for (const r of res) { rows.push([map, name, i, r]); const bad = !r.skip && (r.osc >= 2 || r.pen > .06 || r.sink > .06 || r.cam);
    console.log(bad ? 'BAD ' : 'ok  ', map, name, JSON.stringify(r)); }
}
import('fs').then(fs => fs.writeFileSync('/tmp/v14-sweep.json', JSON.stringify(rows)));
await new Promise(r => setTimeout(r, 200));
await b.close();
