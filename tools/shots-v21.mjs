import { chromium } from 'playwright-core';
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
const URL = process.env.URL || 'http://localhost:8765/';
const SH = process.env.SHOTS || '/workspace/prop-hunt/shots';
const PH = '/workspace/prop-hunt/office-photos-v18';
mkdirSync(SH, { recursive: true });
const K = .066, X = px => (px - 250) * K, Z = py => (py - 209) * K;
const SHOTS = [
  // bar
  ['v21-p03-island', 'a47358a118fee45da9e9c6b936af1dbae8b7d3914d4724d330c652b139c441ee', [371, 256, 1.25], [371, 286, 0.75]],
  ['v21-p09-from-island', 'd06d3a4d7cdfd5f6b3183a061b097e30c2f55ee11a41b02fdf431eaaa8161910', [372, 268, 1.5], [250, 268, 1.25]],
  ['v21-p10-office', 'f819ca1388ff92ea28b31ffde4c49d551e380d7194b7f9c863b536aa15ee4942', [365, 276, 1.55], [320, 180, 1.15]],
  ['v21-p01-over-island', 'e71662dded827891d26e06afa753be465cb1f6cef9dda007fca14d8c98a1f4d1', [371, 278, 1.5], [330, 180, 1.15]],
  // counter
  ['v21-p12-treasure', 'b9bf50a55444e81635550372fc08b078d328bcd8bd384f1f5ef57277a3e0e0a1', [310, 285, 1.45], [328, 258, 1.0]],
  ['v21-p15-corridor', 'b9b288765159b1599f1d6d52957609b449f8bbb2945c66564db1cdfecf3481c9', [292, 300, 1.5], [318, 250, 1.15]],
  // desks / curtains / mesh
  ['v21-p05-window-desks', 'f85824b229aadb38ef39d4fff5ab137caedf54f364fab532b8be62f2d4843ef6', [400, 200, 1.55], [300, 140, 1.1]],
  ['v21-p04-grass-desks', '9be5fc897cd0bfdf5414dcc43a01d540984a9d5cd5be42fb8cda76402de4569d', [400, 200, 1.5], [430, 160, 1.1]],
  ['v21-desks-zigzag', null, [250, 250, 2.2], [330, 215, 0.6]],
  ['v21-balcony-east', null, [455, 270, 1.6], [490, 280, 1.2]],
];
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', e => console.log('[err]', e.message));
await p.goto(URL + '?lowgfx=0&map=lucky', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__ph?.ready, null, { timeout: 60000 });
await p.evaluate(() => { document.getElementById('home')?.classList.add('hidden'); __ph.setMapLocal?.('lucky'); __ph.scene.fog = null; });
await p.waitForTimeout(1000);
const probe = await p.evaluate(() => {
  const L = __ph.LUCKY_START, P = __ph.PROPS;
  const find = (n, px, py) => {
    const x = (px - 250) * .066, z = (py - 209) * .066;
    const hits = P.map((p, i) => i >= L && p[0] === n ? [i, p[0], Math.hypot(p[1] - x, p[2] - z)] : null).filter(Boolean).sort((a,b)=>a[2]-b[2]);
    return hits.slice(0, 2);
  };
  return {
    treasure: find('treasureCounter', 328, 258),
    upper: find('longDesk', 316.5, 151.7),
    window: find('longDesk', 335.5, 120.5),
    mesh: find('gridPanel', 440, 169),
    lower: find('longDesk', 262.5, 218.3),
    island: find('kitchenIsland', 371.5, 267.5),
    errs: window.__ph_errs || null,
  };
});
console.log('probe', JSON.stringify(probe, null, 2));
function composite(gamePng, photoJpg, outPng, label) {
  const py = `
from PIL import Image, ImageDraw, ImageFont
import sys
g = Image.open(sys.argv[1]).convert('RGB')
ph = Image.open(sys.argv[2]).convert('RGB')
H = 720
def fit(im, h):
    w = int(im.width * h / im.height)
    return im.resize((w, h), Image.Resampling.LANCZOS)
g2, p2 = fit(g, H), fit(ph, H)
pad, gap, cap = 16, 16, 44
W = pad * 2 + g2.width + gap + p2.width
im = Image.new('RGB', (W, H + cap + pad), '#1a1a1a')
im.paste(g2, (pad, cap)); im.paste(p2, (pad + g2.width + gap, cap))
d = ImageDraw.Draw(im)
try: font = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 22)
except Exception:
    try: font = ImageFont.truetype('/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc', 22)
    except Exception: font = ImageFont.load_default()
d.text((pad, 10), '遊戲 v21', fill='#f0e6d0', font=font)
d.text((pad + g2.width + gap, 10), '實地照片  ' + sys.argv[4], fill='#f0e6d0', font=font)
im.save(sys.argv[3], quality=90)
print('wrote', sys.argv[3], im.size)
`;
  const r = spawnSync('python3', ['-c', py, gamePng, photoJpg, outPng, label], { encoding: 'utf8' });
  if (r.status !== 0) console.log('composite fail', r.stderr || r.stdout);
  else process.stdout.write(r.stdout);
}
for (const [n, hash, cam, look] of SHOTS) {
  const camW = [X(cam[0]), cam[2], Z(cam[1])];
  const lookW = [X(look[0]), look[2], Z(look[1])];
  await p.evaluate(c => __ph.setDebugCam(c), [camW, lookW]);
  await p.waitForTimeout(700);
  const raw = path.join(SH, n + '-game.png');
  await p.screenshot({ path: raw });
  console.log('shot', n);
  if (!hash) continue;
  const photo = path.join(PH, hash + '.jpg');
  if (!existsSync(photo)) { console.log('missing photo', photo); continue; }
  composite(raw, photo, path.join(SH, n + '-cmp.png'), n);
}
await p.evaluate(c => __ph.setDebugCam(c), [[0, 34, 2.2], [0, 0, 2.1]]);
await p.waitForTimeout(800);
await p.screenshot({ path: path.join(SH, 'v21-overview-top.png') });
console.log('wrote overview');
await b.close();
