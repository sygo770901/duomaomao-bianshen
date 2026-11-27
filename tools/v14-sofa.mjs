// 重現：走向沙發正面到底，記錄 y 的變化
import { chromium } from 'playwright-core';
const URL = process.env.URL || 'http://localhost:8765/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(URL + '?net=local&lowgfx=1'); await p.waitForFunction(() => __ph.ready, null, { timeout: 60000 });
await p.fill('#nameIn', 'T'); await p.click('#createBtn'); await p.waitForSelector('#lobby:not(.hidden)');
const sofas = await p.evaluate(() => __ph.PROPS.map((pr, i) => [i, pr[0], __ph.propMap(i)]).filter(a => /sofa/i.test(a[1])));
console.log(JSON.stringify(sofas));
const out = [];
for (const [i, name, map] of sofas) {
  await p.evaluate(m => __ph.setMapLocal(m), map);
  const info = await p.evaluate(i => { const cols = __ph.propCols(i); const pos = __ph.propPos(i); const pr = __ph.PROPS[i];
    const ry = pr[3] * Math.PI / 180; return { cols: cols.map(c => [c.x1, c.x2, c.y1, c.y2, c.z1, c.z2].map(v => +v.toFixed(2))), pos, ry }; }, i);
  // 正面 = 模型本地 +z 轉到世界
  for (const side of [0, .35, -.35]) {
    const fx = Math.sin(info.ry), fz = Math.cos(info.ry);
    const sx = info.pos[0] + fx * 1.6 + fz * side, sz = info.pos[2] + fz * 1.6 - fx * side;
    const r = await p.evaluate(async ([sx, sz, tx, tz]) => {
      __ph.teleport(sx, sz, 0); __ph.lookAt(tx, tz, .45); __ph.holdMove.iz = -1;
      const ys = []; const t0 = performance.now();
      await new Promise(res => { const f = () => { const t = performance.now() - t0; if (t > 1600) ys.push(__ph.local.y); if (t > 3200) return res(); requestAnimationFrame(f); }; f(); });
      __ph.holdMove.iz = 0; const mn = Math.min(...ys), mx = Math.max(...ys);
      return { n: ys.length, min: +mn.toFixed(3), max: +mx.toFixed(3), changes: ys.filter((y, k) => k && Math.abs(y - ys[k - 1]) > .005).length, end: [__ph.local.x, __ph.local.z].map(v => +v.toFixed(2)) };
    }, [sx, sz, info.pos[0] + fz * side, info.pos[2] - fx * side]);
    out.push([i, name, map, side, r]); console.log(i, name, map, side, JSON.stringify(r));
  }
}
await b.close();
