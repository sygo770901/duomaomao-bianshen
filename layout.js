// 每回合家具洗牌：房主抽一個種子，所有人用同一套演算法算出同一張擺法。
// 每件家具只在「原本那個房間」的矩形裡挪位置，朝向不變。
// 固定不挪的：牆上掛的、廚衛管線與流理台、電視牆那一組、走道／電梯廳／空橋這種不能擋的地方，
// 以及本來就放在別的家具上面的小物（跟著底下那件一起走）。

const FIXED = new Set([
  'kitchenFridgeLarge', 'kitchenFridgeSmall', 'kitchenFridge',
  'kitchenCabinet', 'kitchenCabinetDrawer', 'kitchenSink', 'kitchenStoveElectric', 'kitchenStove',
  'kitchenBar', 'kitchenBarEnd', 'washer', 'dryer',
  'bathroomCabinet', 'bathroomCabinetDrawer',
  'toilet', 'toiletSquare', 'bathroomSink', 'bathroomSinkSquare', 'shower', 'showerRound', 'bathtub', 'towelRack',
  'cabinetTelevision', 'lockers', 'vendingMachine', 'snackCabinet', 'waterCooler', 'waterDispenser',
  'piano', 'pingPong', 'foosball', 'arcade', 'gridPanel',
  'woodCounter', 'woodSink', 'kitchenIsland', 'wireRack', 'woodWardrobe',
  'treasureCounter', 'copier', 'glassFridge', 'luckyReception',
]);
// 吊在天花板上的，不跟著桌子走，也不佔地面。
const HANGING = new Set(['goldPendant']);
// 電視櫃旁邊這一組（喇叭、地上的玩具）跟著電視牆留在原地，才不會散到客廳另一頭。
const TV_CLUSTER = new Set(['speaker', 'speakerSmall', 'televisionModern', 'gameConsole', 'handheldGame', 'gameController', 'toyBlocks', 'plushToy', 'toyCar', 'toyBall']);

const KX = (px, ox, k) => (px - ox) * k;
function box(id, x1, z1, x2, z2) {
  return { id, x1: Math.min(x1, x2), x2: Math.max(x1, x2), z1: Math.min(z1, z2), z2: Math.max(z1, z2) };
}
function oBox(id, a, b, c, d) { const k = 0.022; return box(id, KX(a, 1000, k), KX(b, 550, k), KX(c, 1000, k), KX(d, 550, k)); }
function lBox(id, a, b, c, d) { const k = 0.066; return box(id, KX(a, 250, k), KX(b, 209, k), KX(c, 250, k), KX(d, 209, k)); }
function oDoor(horiz, line, g0, g1) {
  const k = 0.022, X = p => KX(p, 1000, k), Z = p => KX(p, 550, k), pad = 0.8;
  if (horiz) { const z = Z(line); return { x1: X(g0) - .1, x2: X(g1) + .1, z1: z - pad, z2: z + pad }; }
  const x = X(line); return { x1: x - pad, x2: x + pad, z1: Z(g0) - .1, z2: Z(g1) + .1 };
}
function lDoor(px, py, pad = 0.7) { const k = 0.066, x = KX(px, 250, k), z = KX(py, 209, k); return { x1: x - pad, x2: x + pad, z1: z - pad, z2: z + pad }; }

const HOME_ROOMS = [
  box('entry', -13.85, -8.9, -12.15, -4.05),
  box('kitchen', -12.05, -8.9, -3.25, -6.05),
  box('dining', -10.6, -6.0, -3.35, -2.55),
  box('living', -13.75, -2.45, -3.35, 5.65),
  box('balcony', -13.7, 6.4, -6.35, 8.85),
  box('bath1', -2.85, -8.9, -0.2, -3.7),
  box('smallbed', 0.2, -8.9, 4.8, -3.7),
  box('laundry', 5.2, -8.9, 7.8, -3.7),
  box('mbath', 8.2, -8.9, 13.9, -3.7),
  box('bedroom', -2.8, 0.8, 4.8, 8.8),
  box('master', 5.2, 0.8, 13.9, 8.8),
];
const HOME_DOORS = [
  { x1: -3.65, x2: -2.35, z1: -7.8, z2: -4.2 },
  { x1: 0.55, x2: 4.45, z1: -4.25, z2: -3.35 },
  { x1: 4.95, x2: 8.05, z1: -4.25, z2: -3.35 },
  { x1: 8.15, x2: 11.85, z1: -4.25, z2: -3.35 },
  { x1: -2.95, x2: 0.75, z1: 0.3, z2: 1.5 },
  { x1: 5.25, x2: 8.95, z1: 0.3, z2: 1.5 },
  { x1: -11.15, x2: -8.45, z1: 5.15, z2: 6.85 },
];

const OFFICE_ROOMS = [
  oBox('kit', 145, 108, 290, 322),
  oBox('coffee', 298, 108, 445, 325),
  oBox('utility', 248, 348, 345, 515),
  oBox('meetBig', 148, 612, 340, 700),
  oBox('wcL', 258, 724, 342, 805),
  oBox('store', 358, 620, 424, 800),
  oBox('open', 455, 108, 1028, 446),
  oBox('piano', 548, 450, 658, 542),
  oBox('game', 672, 472, 778, 548),
  oBox('snack', 937, 468, 1030, 548),
  oBox('read', 937, 700, 1030, 782),
  oBox('wcNE', 1043, 252, 1255, 390),
  oBox('bar', 1043, 410, 1258, 542),
  oBox('booth', 1043, 552, 1215, 672),
  oBox('atrium', 440, 568, 900, 828),
  oBox('meetA', 608, 862, 690, 998),
  oBox('meetB', 706, 862, 788, 998),
  oBox('meetC', 804, 862, 886, 998),
  oBox('nap1', 902, 862, 1006, 998),
  oBox('nap2', 1028, 940, 1130, 998),
  oBox('nap3', 1150, 940, 1254, 998),
  oBox('wingGame', 1448, 255, 1566, 392),
  oBox('ping', 1456, 408, 1736, 568),
  oBox('reception', 1450, 672, 1562, 830),
  oBox('meetD', 1578, 672, 1650, 830),
  oBox('meetE', 1668, 672, 1736, 830),
  oBox('copy', 1754, 672, 1840, 830),
  oBox('off1', 1578, 912, 1650, 1006),
  oBox('off2', 1668, 912, 1736, 1006),
  oBox('boss', 1754, 912, 1840, 1006),
];
const OFFICE_DOORS = [
  oDoor(false, 295, 120, 178), oDoor(true, 330, 225, 285), oDoor(false, 215, 345, 402),
  oDoor(true, 600, 285, 340), oDoor(true, 815, 262, 322), oDoor(true, 815, 365, 420),
  oDoor(true, 850, 630, 686), oDoor(true, 850, 728, 784), oDoor(true, 850, 826, 882),
  oDoor(true, 850, 925, 990), oDoor(true, 556, 700, 760), oDoor(true, 556, 958, 1015),
  oDoor(true, 690, 955, 1012), oDoor(true, 400, 1060, 1112), oDoor(true, 400, 1193, 1245),
  oDoor(true, 580, 1460, 1530), oDoor(true, 660, 1460, 1530), oDoor(false, 1440, 470, 545),
  oDoor(false, 1440, 665, 735), oDoor(true, 840, 1590, 1642), oDoor(true, 840, 1678, 1730),
  oDoor(true, 840, 1770, 1830), oDoor(true, 900, 1590, 1642), oDoor(true, 900, 1680, 1730),
  oDoor(true, 900, 1772, 1830),
];

const LUCKY_ROOMS = [
  lBox('meet', 28, 248, 108, 298),
  lBox('boss', 138, 118, 192, 172),
  lBox('arc', 56, 158, 126, 204),
  lBox('nw', 42, 214, 116, 234),
  lBox('copy', 118, 248, 163, 298),
  lBox('spare', 174, 264, 206, 298),
  lBox('party', 216, 264, 274, 298),
  lBox('entry', 286, 252, 330, 292),
  lBox('pantry', 340, 248, 414, 292),
  lBox('store', 426, 248, 454, 300),
  lBox('equip', 466, 248, 482, 300),
  lBox('small', 440, 128, 482, 170),
  lBox('north', 208, 116, 426, 150),
  // 影印機在老闆東牆外側、北窗長桌西端。範圍小於窗邊辦公區，重疊時以這裡為準。
  lBox('copyNook', 196, 122, 220, 176),
  lBox('open', 202, 158, 428, 244),
  lBox('read', 126, 184, 192, 236),
  lBox('cafe', 426, 182, 482, 236),
];
const LUCKY_DOORS = [
  lDoor(305, 297, 0.85), lDoor(184, 180), lDoor(124.9, 198.8), lDoor(119, 220), lDoor(113, 250),
  lDoor(190, 265), lDoor(266.1, 286.6), lDoor(433, 241), lDoor(460, 252.5), lDoor(434, 124.5),
  // 從電梯廳走進開放辦公區的直走道，不要被家具堵住
  { x1: KX(292, 250, 0.066), x2: KX(318, 250, 0.066), z1: KX(248, 209, 0.066), z2: KX(318, 209, 0.066) },
];

const ROOMS = { home: HOME_ROOMS, office: OFFICE_ROOMS, lucky: LUCKY_ROOMS };
const DOORS = { home: HOME_DOORS, office: OFFICE_DOORS, lucky: LUCKY_DOORS };

function mulberry32(a) {
  a >>>= 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function sizeOf(sizes, name) {
  const s = sizes && sizes[name];
  if (!s) return { x: 0.45, y: 0.5, z: 0.45 };
  const r = v => Math.round((+v || 0.45) * 1000) / 1000;
  return { x: Math.max(.12, r(s.x)), y: Math.max(.05, r(s.y)), z: Math.max(.12, r(s.z)) };
}
function footprint(sizes, name, x, z, ry) {
  const s = sizeOf(sizes, name);
  const a = Math.abs(+ry || 0) * Math.PI / 180;
  const c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
  const hx = (s.x * c + s.z * sn) / 2, hz = (s.x * sn + s.z * c) / 2;
  return { x1: x - hx, x2: x + hx, z1: z - hz, z2: z + hz };
}
function overlap(a, b, pad) {
  const p = pad || 0;
  return a.x1 - p < b.x2 && a.x2 + p > b.x1 && a.z1 - p < b.z2 && a.z2 + p > b.z1;
}
function hitCircle(box, x, z, r) {
  const cx = Math.max(box.x1, Math.min(x, box.x2)), cz = Math.max(box.z1, Math.min(z, box.z2));
  const dx = cx - x, dz = cz - z;
  return dx * dx + dz * dz < r * r;
}
function areaOf(r) { return Math.abs((r.x2 - r.x1) * (r.z2 - r.z1)); }
function roomAt(map, x, z) {
  const list = ROOMS[map] || [];
  let best = null, bestA = Infinity;
  for (const r of list) {
    if (x < r.x1 || x > r.x2 || z < r.z1 || z > r.z2) continue;
    const a = areaOf(r);
    if (a < bestA) { best = r; bestA = a; }
  }
  return best;
}
function supportOf(i, props, propMap, sizes) {
  const p = props[i];
  const y = p[4] || 0;
  if (y < 0.18) return -1;
  const map = propMap(i);
  let best = -1, bestD = 1.15;
  for (let j = 0; j < props.length; j++) {
    if (j === i || propMap(j) !== map) continue;
    const q = props[j];
    if ((q[4] || 0) > 0.05) continue;
    const d = Math.hypot(p[1] - q[1], p[2] - q[2]);
    const s = sizeOf(sizes, q[0]);
    const reach = Math.max(s.x, s.z) * 0.55 + 0.2;
    if (d <= reach && d < bestD) { best = j; bestD = d; }
  }
  return best;
}

export function classifyIndex(i, opts) {
  const { props, propMap, sizes, wallNames } = opts;
  const p = props[i];
  const map = propMap(i);
  const room = roomAt(map, p[1], p[2]);
  const support = supportOf(i, props, propMap, sizes);
  if (wallNames && wallNames.has(p[0])) return { kind: 'wall', room, support: -1 };
  if (HANGING.has(p[0])) return { kind: 'wall', room, support: -1 };
  if (FIXED.has(p[0])) return { kind: 'fixed', room, support: -1 };
  if ((p[4] || 0) >= 0.18 && support >= 0) return { kind: 'rider', room, support };
  if (!room) return { kind: 'out', room: null, support: -1 };
  if (TV_CLUSTER.has(p[0])) {
    for (let j = 0; j < props.length; j++) {
      if (propMap(j) !== map || props[j][0] !== 'cabinetTelevision') continue;
      if (Math.hypot(p[1] - props[j][1], p[2] - props[j][2]) <= 2.15) return { kind: 'fixed', room, support: -1 };
    }
  }
  return { kind: 'free', room, support: -1 };
}

function prepGrid(room, staticCols) {
  const margin = 0.7, step = 0.5;
  const x0 = room.x1 - margin, z0 = room.z1 - margin;
  const nx = Math.max(2, Math.ceil((room.x2 - room.x1 + margin * 2) / step));
  const nz = Math.max(2, Math.ceil((room.z2 - room.z1 + margin * 2) / step));
  const base = new Uint8Array(nx * nz);
  const inside = new Uint8Array(nx * nz);
  const idx = (ix, iz) => iz * nx + ix;
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const x = x0 + (ix + .5) * step, z = z0 + (iz + .5) * step;
    const i = idx(ix, iz);
    if (x >= room.x1 && x <= room.x2 && z >= room.z1 && z <= room.z2) inside[i] = 1;
    for (const c of staticCols) {
      if (x >= c.x1 && x <= c.x2 && z >= c.z1 && z <= c.z2) { base[i] = 1; break; }
    }
  }
  return { step, x0, z0, nx, nz, base, inside, idx };
}
function floodCount(grid, boxes) {
  const { step, x0, z0, nx, nz, base, inside, idx } = grid;
  const blk = new Uint8Array(base);
  for (const b of boxes) {
    const ix0 = Math.max(0, Math.floor((b.x1 - x0) / step));
    const ix1 = Math.min(nx - 1, Math.floor((b.x2 - x0) / step));
    const iz0 = Math.max(0, Math.floor((b.z1 - z0) / step));
    const iz1 = Math.min(nz - 1, Math.floor((b.z2 - z0) / step));
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      const x = x0 + (ix + .5) * step, z = z0 + (iz + .5) * step;
      if (x >= b.x1 && x <= b.x2 && z >= b.z1 && z <= b.z2) blk[idx(ix, iz)] = 1;
    }
  }
  const seen = new Uint8Array(nx * nz);
  const q = [];
  const push = i => { if (seen[i] || blk[i]) return; seen[i] = 1; q.push(i); };
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const i = idx(ix, iz);
    if (inside[i] || blk[i]) continue;
    push(i); // 房間矩形外、沒被牆擋住的格子＝可以走進來的入口
  }
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi], ix = i % nx, iz = (i / nx) | 0;
    if (ix > 0) push(i - 1);
    if (ix + 1 < nx) push(i + 1);
    if (iz > 0) push(i - nx);
    if (iz + 1 < nz) push(i + nx);
  }
  let count = 0;
  for (let i = 0; i < seen.length; i++) if (seen[i] && inside[i]) count++;
  return { seen, count, nx, nz, step, x0, z0, idx };
}
function touches(box, fl) {
  if (!fl) return true;
  const mx = (box.x1 + box.x2) / 2, mz = (box.z1 + box.z2) / 2;
  const pts = [[mx, box.z1 - .48], [mx, box.z2 + .48], [box.x1 - .48, mz], [box.x2 + .48, mz]];
  for (const [x, z] of pts) {
    const ix = Math.floor((x - fl.x0) / fl.step), iz = Math.floor((z - fl.z0) / fl.step);
    if (ix < 0 || iz < 0 || ix >= fl.nx || iz >= fl.nz) continue;
    if (fl.seen[fl.idx(ix, iz)]) return true;
  }
  return false;
}

function geomOK(box, room, staticCols, doors, spawns, occupied) {
  if (box.x1 < room.x1 - 1e-4 || box.x2 > room.x2 + 1e-4 || box.z1 < room.z1 - 1e-4 || box.z2 > room.z2 + 1e-4) return false;
  for (const c of staticCols) {
    if (c.x2 < box.x1 - .05 || c.x1 > box.x2 + .05 || c.z2 < box.z1 - .05 || c.z1 > box.z2 + .05) continue;
    if (overlap(box, c, 0.02)) return false;
  }
  for (const d of doors) if (overlap(box, d, 0)) return false;
  for (const s of spawns) if (hitCircle(box, s[0], s[1], 1.55)) return false;
  for (const o of occupied) if (o && overlap(box, o, 0.07)) return false;
  return true;
}

export function computeLayout(opts) {
  const { map, seed, props, propMap, sizes, staticCols, spawns, wallNames } = opts;
  if (!seed || !ROOMS[map]) return null;
  const rng = mulberry32(seed);
  const doors = DOORS[map] || [];
  const cols = staticCols || [];
  const spawnList = spawns || [];
  const byRoom = new Map();
  const info = new Array(props.length);
  for (let i = 0; i < props.length; i++) {
    if (propMap(i) !== map) continue;
    const c = classifyIndex(i, { props, propMap, sizes, wallNames });
    info[i] = c;
    if (!c.room || c.kind === 'rider') continue;
    if (!byRoom.has(c.room.id)) byRoom.set(c.room.id, { room: c.room, fixed: [], free: [] });
    const g = byRoom.get(c.room.id);
    const fp = footprint(sizes, props[i][0], props[i][1], props[i][2], props[i][3]);
    if (c.kind === 'free') g.free.push({ i, fp });
    else g.fixed.push(fp);
  }
  const deltas = {};
  // 沒被分到房間的家具留在原地，但也要佔住地面，別的房間不能挪上來。
  const world = [];
  const slotted = new Set();
  for (const g of byRoom.values()) for (const f of g.free) slotted.add(f.i);
  for (let i = 0; i < props.length; i++) {
    if (propMap(i) !== map) continue;
    const c = info[i];
    if (!c || c.kind === 'rider' || c.kind === 'wall') continue;
    const fp = footprint(sizes, props[i][0], props[i][1], props[i][2], props[i][3]);
    const b = { ...fp, i };
    world.push(b);
    if (slotted.has(i)) {
      for (const g of byRoom.values()) for (const f of g.free) if (f.i === i) f.slot = b;
    }
  }
  for (const g of byRoom.values()) {
    const room = g.room;
    const grid = prepGrid(room, cols);
    const occ = world.filter(b => overlap(b, { x1: room.x1 - .2, x2: room.x2 + .2, z1: room.z1 - .2, z2: room.z2 + .2 }, 0));
    const slots = g.free.map(f => f.slot);
    const base = floodCount(grid, occ).count;
    g.free.sort((a, b) => {
      const aa = (a.fp.x2 - a.fp.x1) * (a.fp.z2 - a.fp.z1);
      const bb = (b.fp.x2 - b.fp.x1) * (b.fp.z2 - b.fp.z1);
      return bb - aa || a.i - b.i;
    });
    for (const f of g.free) {
      const pr = props[f.i];
      const s = sizeOf(sizes, pr[0]);
      const a = Math.abs(pr[3] || 0) * Math.PI / 180;
      const c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
      const hx = (s.x * c + s.z * sn) / 2, hz = (s.x * sn + s.z * c) / 2;
      const spanX = room.x2 - room.x1 - hx * 2, spanZ = room.z2 - room.z1 - hz * 2;
      const slot = slots.find(b => b.i === f.i);
      let placed = null;
      for (let t = 0; t < 24; t++) {
        const u = rng(), v = rng();
        if (spanX < 0.05 || spanZ < 0.05) break;
        const x = room.x1 + hx + u * spanX;
        const z = room.z1 + hz + v * spanZ;
        const dist = Math.hypot(x - pr[1], z - pr[2]);
        if (t < 18 && dist < 0.55) continue;
        if (dist < 0.18) continue;
        const boxN = footprint(sizes, pr[0], x, z, pr[3]);
        const others = world.filter(o => o !== slot);
        if (!geomOK(boxN, room, cols, doors, spawnList, others)) continue;
        const fl = floodCount(grid, others.concat([boxN]));
        if (base > 6 && fl.count < base * 0.72) continue;
        if (!touches(boxN, fl)) continue;
        placed = { x, z, box: boxN };
        break;
      }
      if (placed) {
        deltas[f.i] = { x: placed.x, z: placed.z };
        slot.x1 = placed.box.x1; slot.x2 = placed.box.x2; slot.z1 = placed.box.z1; slot.z2 = placed.box.z2;
      }
    }
  }
  for (let i = 0; i < props.length; i++) {
    if (propMap(i) !== map) continue;
    const c = info[i];
    if (!c || c.kind !== 'rider' || c.support < 0 || !deltas[c.support]) continue;
    const pr = props[i], sp = props[c.support], d = deltas[c.support];
    deltas[i] = { x: pr[1] + (d.x - sp[1]), z: pr[2] + (d.z - sp[2]) };
  }
  return deltas;
}
