// 家具頂面：網格往下打射線（視覺高度） vs 碰撞盒站立高度
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 600, height: 400 } });
await p.goto('http://localhost:8765/?net=local&lowgfx=1'); await p.waitForFunction(() => __ph.ready, null, { timeout: 60000 });
await p.fill('#nameIn', 'T'); await p.click('#createBtn'); await p.waitForSelector('#lobby:not(.hidden)');
const ids = process.env.NAME ? [await p.evaluate(n => __ph.PROPS.findIndex(pr => pr[0] === n), process.env.NAME)] : (process.env.IDS || '53').split(',').map(Number);
for (const i of ids) {
  const r = await p.evaluate(i => { __ph.setMapLocal(__ph.propMap(i)); const pr = __ph.PROPS[i]; const pos = __ph.propPos(i); const sz = __ph.modelSize(pr[0]); const ry = pr[3] * Math.PI / 180;
    const cols = __ph.propCols(i).map(c => [c.x1, c.x2, c.y1, c.y2, c.z1, c.z2].map(v => +v.toFixed(2)));
    const rows = []; const ex = Math.max(sz[0], sz[2]) / 2 + .1;
    for (let lz = ex; lz >= -ex; lz -= .15) { let row = ''; for (let lx = -ex; lx <= ex; lx += .15) {
      const wx = pos[0] + lx * Math.cos(ry) + lz * Math.sin(ry), wz = pos[2] - lx * Math.sin(ry) + lz * Math.cos(ry);
      const vis = __ph.visTopAt(wx, wz, i); const col = __ph.landAt(wx, wz, 1.6, .001, .01).y;
      row += (vis == null ? ' .. ' : (Math.round(vis * 100) + '').padStart(3) + (Math.abs(vis - col) > .08 ? '!' : ' ')); } rows.push(row); }
    return { name: pr[0], sz, cols, rows }; }, i);
  console.log(r.name, JSON.stringify(r.sz)); for (const c of r.cols) console.log('  col', JSON.stringify(c)); for (const row of r.rows) console.log('  ' + row);
}
await b.close();
