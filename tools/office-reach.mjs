import fs from 'fs';
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('[err]', e.message));
await p.goto('http://localhost:8765/?lowgfx=1'); await p.waitForFunction(() => window.__ph?.ready, null, { timeout: 60000 });
const r = await p.evaluate(() => {
  __ph.setMapLocal('office'); const M = __ph.MAPS.office; const B = M.bounds; const R = .33, step = .1;
  const cols = M.colliders.filter(c => !c.small && (c.y2 ?? 3) > .42);
  const blocked = (x, z) => cols.some(c => x + R > c.x1 && x - R < c.x2 && z + R > c.z1 && z - R < c.z2);
  const nx = Math.ceil((B.x2 - B.x1) / step), nz = Math.ceil((B.z2 - B.z1) / step);
  const seen = new Uint8Array(nx * nz); const q = [];
  const idx = (i, j) => j * nx + i; const toI = x => Math.round((x - B.x1) / step), toJ = z => Math.round((z - B.z1) / step);
  const [sx, sz] = M.seeker; q.push([toI(sx), toJ(sz)]); seen[idx(toI(sx), toJ(sz))] = 1;
  while (q.length) { const [i, j] = q.pop(); for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]) { const a = i + di, c = j + dj; if (a < 0 || c < 0 || a >= nx || c >= nz || seen[idx(a, c)]) continue;
    const x = B.x1 + a * step, z = B.z1 + c * step; if (blocked(x, z)) { seen[idx(a, c)] = 2; continue; } seen[idx(a, c)] = 1; q.push([a, c]); } }
  const pts = { kitchen: [-17.2, -8.0], coffeeBehindBar: [-15.0, -8.0], stairRoom: [-18.1, -4.0], print: [-14.8, -2.0], corridor: [-17, 0.5], board: [-15.2, 2.3], wc1: [-15.4, 5.2], storage: [-13.3, 5.0], snackBarIn: [-11.9, 3.5], lounge: [-13.2, 6.6], stairwell: [-11.2, 7.5],
    meetA: [-7.7, 7.2], meetB: [-5.55, 7.2], meetC: [-3.4, 7.2], napCorr: [0, 7.5], pod1: [-1.0, 8.2], pod3: [4.4, 8.2], gameRoom: [-6.5, -.2], snackRoom: [-.4, -.5], library: [-.6, 4.4], wcW: [2.0, -4.5], wcM: [4.6, -4.5], bar: [3.0, -2.6], boardGame: [11.2, -6.1], hallA: [11, -2.5], pingpong: [13.4, -.2], lobby: [11, 3.5], meetD: [13.5, 6.0], meetE: [15.4, 6.0], copy: [17.5, 6.0], off1: [13.5, 8.3], off2: [15.4, 8.3], ceo: [17.5, 8.0], lounge2: [11.1, 8.8], windowDesk: [-5.5, -5.2], westPod: [-11.8, -3.3], atrium: [-6, 1], elevHall: [4, 2.5], bridgeU: [7.7, -.9], bridgeL: [7.7, 3.2] };
  const res = {}; for (const [k, [x, z]] of Object.entries(pts)) { const i = toI(x), j = toJ(z); let ok = false; for (let a = -3; a <= 3 && !ok; a++) for (let c = -3; c <= 3 && !ok; c++) if (seen[idx(i + a, j + c)] === 1) ok = true; res[k] = ok; }
  let reach = 0; for (const v of seen) if (v === 1) reach++;
  const cv = document.createElement('canvas'); cv.width = nx; cv.height = nz; const g = cv.getContext('2d'); const im = g.createImageData(nx, nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const v = seen[idx(i, j)], o = (j * nx + i) * 4; const col = v === 1 ? [140, 220, 140] : v === 2 ? [230, 120, 120] : (blocked(B.x1 + i * step, B.z1 + j * step) ? [120, 60, 60] : [200, 200, 200]); im.data.set([...col, 255], o); }
  g.putImageData(im, 0, 0); g.fillStyle = '#000'; g.font = '9px sans-serif';
  for (const [k, [x, z]] of Object.entries(pts)) { g.fillRect(toI(x) - 1, toJ(z) - 1, 3, 3); g.fillText(k, toI(x) + 2, toJ(z)); }
  let ascii = ''; const S2 = 3; const keys = Object.keys(pts);
  const mark = {}; keys.forEach((k, n) => { const [x, z] = pts[k]; mark[Math.round(toI(x) / S2) + ',' + Math.round(toJ(z) / S2)] = String.fromCharCode(n < 26 ? 65 + n : 97 + n - 26); });
  for (let j = 0; j < nz; j += S2) { for (let i = 0; i < nx; i += S2) { const m = mark[(i / S2) + ',' + (j / S2)]; const v = seen[idx(i, j)]; ascii += m || (v === 1 ? '.' : blocked(B.x1 + i * step, B.z1 + j * step) ? '#' : ' '); } ascii += '\n'; }
  ascii += keys.map((k, n) => String.fromCharCode(n < 26 ? 65 + n : 97 + n - 26) + '=' + k).join(' ');
  return { ascii, res, reachArea: (reach * step * step).toFixed(1), png: cv.toDataURL() }; });
fs.writeFileSync('/workspace/prop-hunt/shots/v6-dev-reach.png', Buffer.from(r.png.split(',')[1], 'base64')); delete r.png;
console.log(r.ascii); delete r.ascii; console.log(JSON.stringify(r, null, 0));
console.log('UNREACHABLE:', Object.entries(r.res).filter(([, v]) => !v).map(([k]) => k).join(', ') || 'none');
await b.close();
