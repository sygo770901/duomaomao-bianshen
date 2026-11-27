// 每種家具：視覺頂面 vs 碰撞站立高度 的差異統計
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 600, height: 400 } });
await p.goto((process.env.URL || 'http://localhost:8765/') + '?net=local&lowgfx=1'); await p.waitForFunction(() => __ph.ready, null, { timeout: 60000 });
await p.fill('#nameIn', 'T'); await p.click('#createBtn'); await p.waitForSelector('#lobby:not(.hidden)');
const res = await p.evaluate(() => { const seen = new Set(), out = [];
  __ph.PROPS.forEach((pr, i) => { if ((pr[4] || 0) !== 0 || __ph.WALL_PROP.has(pr[0]) || seen.has(pr[0])) return; seen.add(pr[0]); __ph.setMapLocal(__ph.propMap(i));
    const pos = __ph.propPos(i), sz = __ph.modelSize(pr[0]), ry = pr[3] * Math.PI / 180; let n = 0, bad = 0, maxUp = 0, maxDown = 0;
    for (let lz = -sz[2] / 2 + .05; lz <= sz[2] / 2 - .05; lz += .1) for (let lx = -sz[0] / 2 + .05; lx <= sz[0] / 2 - .05; lx += .1) {
      const wx = pos[0] + lx * Math.cos(ry) + lz * Math.sin(ry), wz = pos[2] - lx * Math.sin(ry) + lz * Math.cos(ry);
      const vis = __ph.visTopAt(wx, wz, i); if (vis == null || vis < .06) continue; n++;
      const col = __ph.landAt(wx, wz, 1.6, .001, .01).y; const d = vis - col; if (Math.abs(d) > .08) bad++; maxUp = Math.max(maxUp, d); maxDown = Math.min(maxDown, d); }
    out.push([pr[0], __ph.isSmall(i) ? 'S' : '', __ph.propCols(i).length, n, bad, +(bad / Math.max(1, n)).toFixed(2), +maxUp.toFixed(2), +maxDown.toFixed(2), sz.map(v => +v.toFixed(2)).join('x')]); });
  return out; });
for (const r of res.sort((a, b) => b[5] - a[5])) console.log(r.join('\t'));
await b.close();
