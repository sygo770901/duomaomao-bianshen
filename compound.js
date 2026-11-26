// 家具複合碰撞盒：載入時把 glb／程序模型切成少數 AABB（座位、椅背、桌面＋腳、層板…）。
// 優先用手調覆寫常見件，其餘做體素／切片分析。結果是模型本地座標（腳底 y=0、xz 置中）。

const MAX_BOXES = 8;

function box(x1, x2, y1, y2, z1, z2) {
  return { x1: +x1, x2: +x2, y1: +y1, y2: +y2, z1: +z1, z2: +z2 };
}
function vol(b) { return Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1) * Math.max(0, b.z2 - b.z1); }
function areaXZ(b) { return Math.max(0, b.x2 - b.x1) * Math.max(0, b.z2 - b.z1); }
function clampBox(b, pad = 0) {
  if (b.x1 > b.x2) [b.x1, b.x2] = [b.x2, b.x1];
  if (b.y1 > b.y2) [b.y1, b.y2] = [b.y2, b.y1];
  if (b.z1 > b.z2) [b.z1, b.z2] = [b.z2, b.z1];
  if (pad) { b.x1 += pad; b.x2 -= pad; b.z1 += pad; b.z2 -= pad; }
  if (b.x2 - b.x1 < .04) { const c = (b.x1 + b.x2) / 2; b.x1 = c - .02; b.x2 = c + .02; }
  if (b.z2 - b.z1 < .04) { const c = (b.z1 + b.z2) / 2; b.z1 = c - .02; b.z2 = c + .02; }
  if (b.y2 - b.y1 < .03) b.y2 = b.y1 + .03;
  return b;
}

function classify(name) {
  const n = name || '';
  if (/^bed/i.test(n) || n === 'bedBunk' || n === 'bedSingle' || n === 'bedDouble') return 'bed';
  if (/loungeSofa$/.test(n)) return 'sofa';
  if (/chair|stool|bench|loungeChair|beanBag/i.test(n)) return 'chair';
  if (/^(table|desk|confTable|pingPong|kitchenBar|kitchenBarEnd|sideTable|tableRound|tableCoffee|tableCoffeeGlass|receptionDesk|longDesk|ovalTable|bistroTable|highTable)$/.test(n)) return 'table';
  if (/bookcaseClosed|lockers|filingCabinet|snackCabinet|tallCabinet|woodWardrobe/.test(n)) return 'solid';
  if (/bookcase|shelfBoxes|wireRack/.test(n)) return 'shelf';
  return 'solid';
}

// ---------- 體素化 ----------
function voxelize(root, size, THREE) {
  const bb = new THREE.Box3().setFromObject(root);
  if (bb.isEmpty()) return null;
  const min = bb.min.clone(), max = bb.max.clone();
  const ex = Math.max(.04, max.x - min.x), ey = Math.max(.04, max.y - min.y), ez = Math.max(.04, max.z - min.z);
  const nx = Math.max(6, Math.min(28, Math.round(ex / .055)));
  const ny = Math.max(6, Math.min(36, Math.round(ey / .045)));
  const nz = Math.max(6, Math.min(28, Math.round(ez / .055)));
  const cw = ex / nx, ch = ey / ny, cd = ez / nz;
  const occ = new Uint8Array(nx * ny * nz);
  const at = (x, y, z) => (y * nz + z) * nx + x;
  const stamp = (wx, wy, wz) => {
    const ix = Math.floor((wx - min.x) / cw), iy = Math.floor((wy - min.y) / ch), iz = Math.floor((wz - min.z) / cd);
    if (ix < 0 || iy < 0 || iz < 0 || ix >= nx || iy >= ny || iz >= nz) return;
    occ[at(ix, iy, iz)] = 1;
  };
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  const mid = (p, q, out) => out.set((p.x + q.x) * .5, (p.y + q.y) * .5, (p.z + q.z) * .5);
  const mab = new THREE.Vector3(), mbc = new THREE.Vector3(), mca = new THREE.Vector3();
  const stampTri = (a, b, c, depth) => {
    stamp(a.x, a.y, a.z); stamp(b.x, b.y, b.z); stamp(c.x, c.y, c.z);
    const lim = Math.max(cw, ch, cd) * 1.15;
    if (depth > 7) return;
    if (a.distanceTo(b) > lim || b.distanceTo(c) > lim || c.distanceTo(a) > lim) {
      mid(a, b, mab); mid(b, c, mbc); mid(c, a, mca);
      // recurse with clones because mab/mbc/mca are reused
      const ab = mab.clone(), bc = mbc.clone(), ca = mca.clone();
      stampTri(a, ab, ca, depth + 1);
      stampTri(ab, b, bc, depth + 1);
      stampTri(ca, bc, c, depth + 1);
      stampTri(ab, bc, ca, depth + 1);
    } else {
      stamp((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3, (a.z + b.z + c.z) / 3);
    }
  };
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position;
    const idx = o.geometry.index;
    const ntri = idx ? (idx.count / 3) : (pos.count / 3);
    const apply = (v, i) => { v.fromBufferAttribute(pos, i); if (o.matrixWorld) v.applyMatrix4(o.matrixWorld); };
    for (let t = 0; t < ntri; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      apply(va, i0); apply(vb, i1); apply(vc, i2);
      stampTri(va, vb, vc, 0);
    }
  });
  return { occ, nx, ny, nz, at, min, cw, ch, cd };
}

function greedyBoxes(vx) {
  if (!vx) return [];
  const { occ, nx, ny, nz, at, min, cw, ch, cd } = vx;
  const seen = new Uint8Array(occ.length);
  const out = [];
  const filled = (x0, x1, y0, y1, z0, z1) => {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (!occ[at(x, y, z)] || seen[at(x, y, z)]) return false;
    }
    return true;
  };
  const mark = (x0, x1, y0, y1, z0, z1) => {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) seen[at(x, y, z)] = 1;
  };
  for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
    if (!occ[at(x, y, z)] || seen[at(x, y, z)]) continue;
    let x1 = x;
    while (x1 + 1 < nx && occ[at(x1 + 1, y, z)] && !seen[at(x1 + 1, y, z)]) x1++;
    let z1 = z;
    while (z1 + 1 < nz && filled(x, x1, y, y, z, z1 + 1)) z1++;
    let y1 = y;
    while (y1 + 1 < ny && filled(x, x1, y, y1 + 1, z, z1)) y1++;
    mark(x, x1, y, y1, z, z1);
    out.push(box(
      min.x + x * cw, min.x + (x1 + 1) * cw,
      min.y + y * ch, min.y + (y1 + 1) * ch,
      min.z + z * cd, min.z + (z1 + 1) * cd
    ));
  }
  return out;
}

function sliceBoxes(vx) {
  if (!vx) return [];
  const { occ, nx, ny, nz, at, min, cw, ch, cd } = vx;
  const slices = [];
  for (let y = 0; y < ny; y++) {
    let x0 = nx, x1 = -1, z0 = nz, z1 = -1, count = 0;
    for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) if (occ[at(x, y, z)]) {
      count++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    const cells = count ? (x1 - x0 + 1) * (z1 - z0 + 1) : 0;
    slices.push({ y, x0, x1, z0, z1, count, fill: cells ? count / cells : 0, area: count * cw * cd });
  }
  const runs = [];
  let cur = null;
  const similar = (a, b) => {
    if (!a.count || !b.count) return false;
    const ax = (a.x0 + a.x1) / 2, bx = (b.x0 + b.x1) / 2;
    const az = (a.z0 + a.z1) / 2, bz = (b.z0 + b.z1) / 2;
    if (Math.abs(ax - bx) > 1.6 || Math.abs(az - bz) > 1.6) return false;
    const aw = a.x1 - a.x0 + 1, bw = b.x1 - b.x0 + 1;
    const ad = a.z1 - a.z0 + 1, bd = b.z1 - b.z0 + 1;
    if (Math.max(aw, bw) / Math.max(1, Math.min(aw, bw)) > 1.45) return false;
    if (Math.max(ad, bd) / Math.max(1, Math.min(ad, bd)) > 1.45) return false;
    return Math.abs(a.fill - b.fill) < .35;
  };
  for (const s of slices) {
    if (!s.count) { cur = null; continue; }
    if (cur && similar(cur, s)) {
      cur.y1 = s.y;
      cur.x0 = Math.min(cur.x0, s.x0); cur.x1 = Math.max(cur.x1, s.x1);
      cur.z0 = Math.min(cur.z0, s.z0); cur.z1 = Math.max(cur.z1, s.z1);
      cur.fill = Math.max(cur.fill, s.fill);
      cur.area = Math.max(cur.area, s.area);
    } else {
      cur = { y0: s.y, y1: s.y, x0: s.x0, x1: s.x1, z0: s.z0, z1: s.z1, fill: s.fill, area: s.area };
      runs.push(cur);
    }
  }
  return runs.map(r => {
    const b = box(
      min.x + r.x0 * cw, min.x + (r.x1 + 1) * cw,
      min.y + r.y0 * ch, min.y + (r.y1 + 1) * ch,
      min.z + r.z0 * cd, min.z + (r.z1 + 1) * cd
    );
    b._fill = r.fill; b._area = r.area;
    return b;
  });
}

function dropTiny(boxes, kind) {
  const maxA = Math.max(0, ...boxes.map(areaXZ));
  return boxes.filter(b => {
    const w = b.x2 - b.x1, h = b.y2 - b.y1, d = b.z2 - b.z1, a = w * d, v = w * h * d;
    if (a >= .035 && h >= .025) return true; // 桌面／坐墊／層板
    if (v >= .006) return true;
    if (kind === 'table' && Math.min(w, d) >= .04 && h >= .2) return true; // 桌腳
    if (maxA > 0 && a >= maxA * .15 && h >= .04) return true;
    return false;
  });
}

function capBoxes(boxes) {
  if (boxes.length <= MAX_BOXES) return boxes;
  return boxes.slice().sort((a, b) => vol(b) - vol(a)).slice(0, MAX_BOXES);
}

function aabbOf(root, THREE) {
  const bb = new THREE.Box3().setFromObject(root);
  if (bb.isEmpty()) return [box(-.2, .2, 0, .4, -.2, .2)];
  const pad = (bb.max.y - bb.min.y) > .45 ? .06 : .02;
  return [clampBox(box(bb.min.x, bb.max.x, Math.max(0, bb.min.y), bb.max.y, bb.min.z, bb.max.z), pad)];
}

// ---------- 依種類整理 ----------
function refineChair(boxes, size, slices) {
  const h = size.y || 1;
  const src = (slices && slices.length ? slices : boxes).slice();
  if (!src.length) return fallbackChair(size);
  const seatMax = Math.min(.62, h * .7);
  let seats = src.filter(b => b.y2 > .28 && b.y2 <= seatMax + .02 && areaXZ(b) >= .02);
  if (!seats.length) seats = src.filter(b => b.y2 > .22 && b.y2 < h * .75).sort((a, b) => areaXZ(b) - areaXZ(a)).slice(0, 1);
  seats.sort((a, b) => areaXZ(b) - areaXZ(a));
  const seat = seats[0];
  if (!seat) return fallbackChair(size);
  const seatBox = clampBox(box(seat.x1, seat.x2, Math.max(0, seat.y1), seat.y2, seat.z1, seat.z2));
  // 忽略坐墊以下的細腳
  const backs = src.filter(b => b.y2 > seatBox.y2 + .06 && areaXZ(b) >= .012);
  const out = [seatBox];
  if (backs.length) {
    // 合併椅背
    let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity, z1 = Infinity, z2 = -Infinity;
    for (const b of backs) { x1 = Math.min(x1, b.x1); x2 = Math.max(x2, b.x2); y1 = Math.min(y1, b.y1); y2 = Math.max(y2, b.y2); z1 = Math.min(z1, b.z1); z2 = Math.max(z2, b.z2); }
    // 椅背通常只佔一側，避免又變成整張椅的包圍盒
    const sw = seatBox.x2 - seatBox.x1, sd = seatBox.z2 - seatBox.z1;
    const bw = x2 - x1, bd = z2 - z1;
    if (bw > sw * .85 && bd > sd * .85) {
      // 縮成較窄的一側（佔用中心偏哪邊）
      const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
      const scx = (seatBox.x1 + seatBox.x2) / 2, scz = (seatBox.z1 + seatBox.z2) / 2;
      if (Math.abs(cz - scz) >= Math.abs(cx - scx)) {
        if (cz >= scz) z1 = seatBox.z2 - Math.min(sd * .28, .16);
        else z2 = seatBox.z1 + Math.min(sd * .28, .16);
      } else {
        if (cx >= scx) x1 = seatBox.x2 - Math.min(sw * .28, .16);
        else x2 = seatBox.x1 + Math.min(sw * .28, .16);
      }
    }
    out.push(clampBox(box(x1, x2, Math.max(seatBox.y2 - .04, y1), Math.max(y2, seatBox.y2 + .2), z1, z2)));
  } else if (h > seatBox.y2 + .18) {
    out.push(...fallbackChairBack(seatBox, size));
  }
  return out;
}

function fallbackChair(size) {
  const hx = (size.x || .4) * .48, hz = (size.z || .4) * .48, h = size.y || 1;
  const seatY = Math.min(.48, Math.max(.34, h * .42));
  const seat = box(-hx, hx, Math.max(0, seatY - .08), seatY, -hz, hz);
  const back = box(-hx, hx, seatY - .02, h, hz - Math.min(.14, hz * .45), hz);
  return [clampBox(seat), clampBox(back)];
}
function fallbackChairBack(seat, size) {
  const h = size.y || 1;
  const d = seat.z2 - seat.z1, w = seat.x2 - seat.x1;
  // 預設椅背在 +z（Kenney 常見）；若深度比較窄則仍用 +z
  const thick = Math.min(.14, Math.max(.07, d * .28));
  return [clampBox(box(seat.x1, seat.x2, seat.y2 - .02, h, seat.z2 - thick, seat.z2))];
}

function refineTable(boxes, size, slices, vx) {
  const h = size.y || .8;
  const src = (slices && slices.length ? slices : boxes).slice();
  if (!src.length) return fallbackTable(size);
  // 桌面＝最高的大面積薄／中層
  const maxY = Math.max(...src.map(b => b.y2));
  // 桌面取接近頂部、面積最大的那層（避免乒乓球桌的網被當成桌面）
  const tops = src.filter(b => areaXZ(b) >= .05 && b.y2 > Math.max(h * .45, maxY - .18))
    .sort((a, b) => areaXZ(b) - areaXZ(a) || b.y2 - a.y2);
  const top = tops[0] || src.sort((a, b) => areaXZ(b) - areaXZ(a))[0];
  const topH = Math.max(.04, Math.min(.12, (top.y2 - top.y1) || .06));
  const topBox = clampBox(box(top.x1, top.x2, Math.max(0, top.y2 - topH), top.y2, top.z1, top.z2), .01);
  const out = [topBox];
  // 若桌面以下幾乎是實心（櫃子桌），保留實心座；否則放四隻細腳或忽略細腳
  const under = src.filter(b => b.y2 <= topBox.y1 + .06 && b.y1 < topBox.y1 - .02);
  const underFill = under.length ? under.reduce((s, b) => s + (b._fill || 0), 0) / under.length : 0;
  const underArea = under.reduce((s, b) => s + areaXZ(b), 0);
  if (underFill > .72 && underArea > areaXZ(topBox) * .45) {
    // 實心底座（電視櫃／帶抽屜邊桌）
    let x1 = Infinity, x2 = -Infinity, y1 = 0, y2 = topBox.y1, z1 = Infinity, z2 = -Infinity;
    for (const b of under) { x1 = Math.min(x1, b.x1); x2 = Math.max(x2, b.x2); y1 = Math.min(y1, b.y1); y2 = Math.max(y2, b.y2); z1 = Math.min(z1, b.z1); z2 = Math.max(z2, b.z2); }
    out.unshift(clampBox(box(x1, x2, 0, Math.min(y2, topBox.y1), z1, z2)));
  } else {
    // 四角桌腳（夠粗才加，否則忽略，方便從中間走過）
    const legW = Math.min(.07, Math.max(.045, Math.min(topBox.x2 - topBox.x1, topBox.z2 - topBox.z1) * .08));
    if (topBox.y1 > .35 && (topBox.x2 - topBox.x1) > .35 && (topBox.z2 - topBox.z1) > .35) {
      const xs = [topBox.x1, topBox.x2 - legW], zs = [topBox.z1, topBox.z2 - legW];
      for (const x of xs) for (const z of zs) out.push(clampBox(box(x, x + legW, 0, topBox.y1, z, z + legW)));
    }
  }
  return out;
}

function fallbackTable(size) {
  const hx = (size.x || .8) * .48, hz = (size.z || .8) * .48, h = size.y || .75;
  const topH = Math.min(.08, h * .12);
  const top = box(-hx, hx, h - topH, h, -hz, hz);
  const out = [clampBox(top)];
  if (h > .4) {
    const legW = .055;
    for (const x of [-hx, hx - legW]) for (const z of [-hz, hz - legW]) out.push(clampBox(box(x, x + legW, 0, h - topH, z, z + legW)));
  }
  return out;
}

function refineSofa(boxes, size, slices) {
  const h = size.y || 1;
  const src = (slices && slices.length ? slices : boxes).slice();
  const seatY = Math.min(.5, Math.max(.34, h * .42));
  let seat = src.filter(b => b.y2 > .28 && b.y2 < .62).sort((a, b) => areaXZ(b) - areaXZ(a))[0];
  if (!seat) seat = box(-(size.x || 1) * .48, (size.x || 1) * .48, 0, seatY, -(size.z || 1) * .48, (size.z || 1) * .48);
  const seatBox = clampBox(box(seat.x1, seat.x2, 0, Math.max(seat.y2, seatY * .85), seat.z1, seat.z2));
  const out = [seatBox];
  const backs = src.filter(b => b.y2 > seatBox.y2 + .08);
  if (backs.length) {
    let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity, z1 = Infinity, z2 = -Infinity;
    for (const b of backs) { x1 = Math.min(x1, b.x1); x2 = Math.max(x2, b.x2); y1 = Math.min(y1, b.y1); y2 = Math.max(y2, b.y2); z1 = Math.min(z1, b.z1); z2 = Math.max(z2, b.z2); }
    const sw = seatBox.x2 - seatBox.x1, sd = seatBox.z2 - seatBox.z1;
    // 縮成靠背厚度
    if ((x2 - x1) > (z2 - z1)) {
      if ((z1 + z2) / 2 >= (seatBox.z1 + seatBox.z2) / 2) z1 = seatBox.z2 - Math.min(.2, sd * .28);
      else z2 = seatBox.z1 + Math.min(.2, sd * .28);
    } else {
      if ((x1 + x2) / 2 >= (seatBox.x1 + seatBox.x2) / 2) x1 = seatBox.x2 - Math.min(.2, sw * .28);
      else x2 = seatBox.x1 + Math.min(.2, sw * .28);
    }
    out.push(clampBox(box(x1, x2, seatBox.y2 - .02, Math.max(y2, h * .85), z1, z2)));
  }
  // 扶手：座位兩側、比座位高一點的窄盒
  const arms = src.filter(b => b.y2 > seatBox.y2 + .04 && b.y2 < h * .85 && areaXZ(b) < areaXZ(seatBox) * .45);
  for (const b of arms) {
    const cx = (b.x1 + b.x2) / 2, cz = (b.z1 + b.z2) / 2;
    const onSide = cx < seatBox.x1 + .1 || cx > seatBox.x2 - .1 || cz < seatBox.z1 + .1 || cz > seatBox.z2 - .1;
    if (onSide) out.push(clampBox(box(b.x1, b.x2, seatBox.y2 - .02, b.y2, b.z1, b.z2)));
  }
  return capBoxes(out);
}

function refineBed(boxes, size, slices) {
  const h = size.y || .8;
  const src = (slices && slices.length ? slices : boxes).slice();
  // 床墊：大面積、高度約 0.4–0.7（雙層床會有兩層）
  const mats = src.filter(b => areaXZ(b) >= Math.max(.3, (size.x || 1) * (size.z || 1) * .25) && (b.y2 - b.y1) < .55)
    .sort((a, b) => areaXZ(b) - areaXZ(a));
  const out = [];
  const usedY = [];
  for (const m of mats) {
    if (usedY.some(y => Math.abs(y - m.y2) < .18)) continue;
    usedY.push(m.y2);
    const y1 = usedY.length === 1 && m.y1 < .2 ? 0 : Math.max(0, m.y2 - Math.max(.08, Math.min(.22, m.y2 - m.y1)));
    out.push(clampBox(box(m.x1, m.x2, y1, m.y2, m.z1, m.z2)));
    if (out.length >= 3) break;
  }
  if (!out.length) {
    const mattressY = Math.min(.58, Math.max(.42, h * .45));
    out.push(clampBox(box(-(size.x || 1) * .48, (size.x || 1) * .48, 0, mattressY, -(size.z || 1) * .48, (size.z || 1) * .48)));
  }
  const topMat = out.reduce((a, b) => a.y2 >= b.y2 ? a : b);
  const heads = src.filter(b => b.y2 > topMat.y2 + .12 && areaXZ(b) < areaXZ(topMat) * .7);
  if (heads.length) {
    let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity, z1 = Infinity, z2 = -Infinity;
    for (const b of heads) { x1 = Math.min(x1, b.x1); x2 = Math.max(x2, b.x2); y1 = Math.min(y1, b.y1); y2 = Math.max(y2, b.y2); z1 = Math.min(z1, b.z1); z2 = Math.max(z2, b.z2); }
    const tw = topMat.x2 - topMat.x1, td = topMat.z2 - topMat.z1;
    if (tw >= td) {
      if ((z1 + z2) / 2 >= (topMat.z1 + topMat.z2) / 2) z1 = topMat.z2 - Math.min(.22, td * .18);
      else z2 = topMat.z1 + Math.min(.22, td * .18);
    } else {
      if ((x1 + x2) / 2 >= (topMat.x1 + topMat.x2) / 2) x1 = topMat.x2 - Math.min(.22, tw * .18);
      else x2 = topMat.x1 + Math.min(.22, tw * .18);
    }
    out.push(clampBox(box(x1, x2, Math.max(0, topMat.y2 - .04), Math.max(y2, h * .9), z1, z2)));
  } else if (h > topMat.y2 + .2) {
    const td = topMat.z2 - topMat.z1, tw = topMat.x2 - topMat.x1;
    if (td >= tw) out.push(clampBox(box(topMat.x1, topMat.x2, topMat.y2 - .02, h, topMat.z2 - .16, topMat.z2)));
    else out.push(clampBox(box(topMat.x2 - .16, topMat.x2, topMat.y2 - .02, h, topMat.z1, topMat.z2)));
  }
  return capBoxes(out);
}

function refineShelf(boxes, size, slices) {
  const src = (slices && slices.length ? slices : boxes).slice().sort((a, b) => a.y1 - b.y1);
  if (!src.length) return fallbackShelf(size);
  const out = [];
  // 背板：細的直立盒
  const backs = src.filter(b => {
    const w = b.x2 - b.x1, d = b.z2 - b.z1, h = b.y2 - b.y1;
    return h > .4 && Math.min(w, d) < .18 && Math.max(w, d) > .25;
  });
  for (const b of backs) out.push(clampBox(b));
  // 層板：薄的水平大面積
  const shelves = src.filter(b => (b.y2 - b.y1) < .18 && areaXZ(b) > .04);
  if (shelves.length) {
    for (const s of shelves) {
      const y1 = Math.max(0, s.y2 - Math.max(.03, s.y2 - s.y1));
      out.push(clampBox(box(s.x1, s.x2, y1, s.y2, s.z1, s.z2)));
    }
  } else {
    // 用 slice 高度推層
    for (const s of src) if (areaXZ(s) > .04) out.push(clampBox(s));
  }
  // 側板
  const sides = src.filter(b => {
    const w = b.x2 - b.x1, d = b.z2 - b.z1, h = b.y2 - b.y1;
    return h > .4 && ((w < .14 && d > .15) || (d < .14 && w > .15));
  });
  for (const b of sides) if (!backs.includes(b)) out.push(clampBox(b));
  const uniq = [];
  for (const b of out) {
    if (uniq.some(o => Math.abs(o.x1 - b.x1) < .04 && Math.abs(o.x2 - b.x2) < .04 && Math.abs(o.y1 - b.y1) < .04 && Math.abs(o.y2 - b.y2) < .04 && Math.abs(o.z1 - b.z1) < .04 && Math.abs(o.z2 - b.z2) < .04)) continue;
    uniq.push(b);
  }
  return capBoxes(uniq.length ? uniq : src.map(clampBox));
}

function fallbackShelf(size) {
  const hx = (size.x || .5) * .48, hz = (size.z || .3) * .48, h = size.y || 1.5;
  const out = [];
  const backThick = Math.min(.06, Math.min(hx, hz) * .35);
  // 背板沿較薄軸
  if ((size.z || .3) <= (size.x || .5)) out.push(clampBox(box(-hx, hx, 0, h, -hz, -hz + backThick)));
  else out.push(clampBox(box(-hx, -hx + backThick, 0, h, -hz, hz)));
  const n = h > 1.4 ? 4 : 3;
  for (let i = 0; i < n; i++) {
    const y = (h * (i + 1)) / (n + .2);
    out.push(clampBox(box(-hx, hx, y - .04, y, -hz, hz)));
  }
  return out;
}

function refineSolid(boxes, size) {
  if (!boxes.length) return [clampBox(box(-(size.x || .4) * .48, (size.x || .4) * .48, 0, size.y || .5, -(size.z || .4) * .48, (size.z || .4) * .48))];
  // 實心件：若很多碎盒就合併成包圍盒，或保留少數大盒
  if (boxes.length === 1) return boxes.map(clampBox);
  const big = dropTiny(boxes, 'solid');
  if (big.length <= 3) return big.map(clampBox);
  // 太碎就用整體包圍（冰箱、洗衣機、封閉櫃）
  let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity, z1 = Infinity, z2 = -Infinity;
  for (const b of big) { x1 = Math.min(x1, b.x1); x2 = Math.max(x2, b.x2); y1 = Math.min(y1, b.y1); y2 = Math.max(y2, b.y2); z1 = Math.min(z1, b.z1); z2 = Math.max(z2, b.z2); }
  const merged = box(x1, x2, y1, y2, z1, z2);
  const fillApprox = big.reduce((s, b) => s + vol(b), 0) / Math.max(1e-6, vol(merged));
  if (fillApprox > .55) return [clampBox(merged)];
  return capBoxes(big.map(clampBox));
}

// 手調：在自動結果不理想時覆寫（本地座標，單位公尺）
function handOverride(name, size) {
  // 目前以自動＋分類整理為主；這裡放明確已知比例的微調（可為空）。
  return null;
}

export function buildCompound(name, root, size, THREE) {
  const kind = classify(name);
  const sx = size?.x || .4, sy = size?.y || .4, sz = size?.z || .4;
  // 很小的物件維持單盒
  if (sy < .32 && Math.max(sx, sz) < .55 && kind === 'solid') return aabbOf(root, THREE);

  const hand = handOverride(name, size);
  if (hand && hand.length) return capBoxes(hand.map(b => clampBox({ ...b })));

  const vx = voxelize(root, size, THREE);
  const greedy = greedyBoxes(vx);
  const slices = sliceBoxes(vx);
  let out;
  if (kind === 'chair') out = refineChair(greedy, size, slices);
  else if (kind === 'table') out = refineTable(greedy, size, slices, vx);
  else if (kind === 'sofa') out = refineSofa(greedy, size, slices);
  else if (kind === 'bed') out = refineBed(greedy, size, slices);
  else if (kind === 'shelf') out = refineShelf(greedy, size, slices);
  else out = refineSolid(slices.length ? slices : greedy, size);

  if (!out || !out.length) out = aabbOf(root, THREE);
  out = dropTiny(out, kind);
  if (!out.length) out = aabbOf(root, THREE);
  return capBoxes(out.map(b => clampBox({ ...b })));
}

export function classifyProp(name) { return classify(name); }

// ---------- v14：用「往下打射線的高度圖」校正碰撞盒 ----------
// 問題：自動切出來的盒子有時比看到的低（坐墊、床墊會陷進去）或漏掉部分（沙發扶手、床頭板）。
// 做法：在模型本地座標每 6 公分打一條往下的射線，得到每格「看得到的頂面」與「最低的面」；
//  1) 貼地的盒子：頂面改成盒內格子的中位數高度（平均看到的高度）；
//  2) 沒被任何盒子蓋到、又明顯凸起的格子（扶手、床頭板…）合併成新的盒子補上。
export function refineWithHeightfield(root, cols, size, THREE, opts = {}) {
  if (!cols || !cols.length) return cols;
  const step = opts.step || .06, ext = Math.max(size.x, size.z) * .5 + .02;
  const meshes = []; root.updateMatrixWorld(true); root.traverse(o => { if (o.isMesh && o.visible !== false && !o.isSprite) meshes.push(o); });
  if (!meshes.length) return cols;
  const saved = new Map(); for (const m of meshes) for (const mat of [].concat(m.material)) if (mat && !saved.has(mat)) { saved.set(mat, mat.side); mat.side = THREE.DoubleSide; }
  const rc = new THREE.Raycaster(), o = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0), top0 = size.y + .5;
  const nx = Math.ceil(ext * 2 / step), nz = nx, cells = [];
  try {
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const x = -ext + (ix + .5) * step, z = -ext + (iz + .5) * step;
      o.set(x, top0, z); rc.set(o, down); rc.far = top0 + .1;
      const hs = rc.intersectObjects(meshes, false);
      if (!hs.length) { cells.push(null); continue; }
      const top = hs[0].point.y, low = hs[hs.length - 1].point.y;
      cells.push(top < .1 ? null : { x, z, top, low: low < .1 ? 0 : low, ix, iz });
    }
  } finally { for (const [mat, side] of saved) mat.side = side; }
  const inBox = (b, c) => c.x >= b.x1 && c.x <= b.x2 && c.z >= b.z1 && c.z <= b.z2;
  // 1) 貼地盒子的頂面 = 盒內格子的中位數
  for (const b of cols) {
    if ((b.y1 || 0) > .15 || (b.x2 - b.x1) * (b.z2 - b.z1) < .02) continue;
    const ts = cells.filter(c => c && inBox(b, c) && c.top > (b.y1 || 0) + .03).map(c => c.top).sort((p, q) => p - q);
    if (ts.length < 3) continue;
    const med = ts[Math.floor(ts.length / 2)];
    if (Math.abs(med - b.y2) > .06) b.y2 = Math.max((b.y1 || 0) + .05, med);
  }
  // 2) 沒蓋到的凸起：合併成新盒子
  const covered = c => cols.some(b => inBox(b, c) && b.y2 >= c.top - .08 && (b.y1 || 0) <= c.low + .1); // 要從格子的底部一路蓋到頂
  const res = new Map(); for (const c of cells) if (c && c.top > .15 && !covered(c)) res.set(c.iz * nx + c.ix, c);
  const extra = [];
  while (res.size && extra.length < (opts.maxExtra || 40)) {
    const [k0, c0] = res.entries().next().value; res.delete(k0);
    let x0 = c0.ix, x1 = c0.ix, z0 = c0.iz, z1 = c0.iz, top = c0.top, low = c0.low;
    const ok = c => c && Math.abs(c.top - c0.top) < .2 && (c.low === 0) === (c0.low === 0);
    const grab = (ix, iz) => { const k = iz * nx + ix, c = res.get(k); return ok(c) ? c : null; };
    let grow = true;
    while (grow) { grow = false;
      // 往 +x 擴
      { const col = []; for (let iz = z0; iz <= z1; iz++) col.push(grab(x1 + 1, iz)); if (col.every(Boolean)) { x1++; for (const c of col) { res.delete(c.iz * nx + c.ix); top = Math.max(top, c.top); low = Math.min(low, c.low); } grow = true; } }
      { const col = []; for (let iz = z0; iz <= z1; iz++) col.push(grab(x0 - 1, iz)); if (col.every(Boolean)) { x0--; for (const c of col) { res.delete(c.iz * nx + c.ix); top = Math.max(top, c.top); low = Math.min(low, c.low); } grow = true; } }
      { const row = []; for (let ix = x0; ix <= x1; ix++) row.push(grab(ix, z1 + 1)); if (row.every(Boolean)) { z1++; for (const c of row) { res.delete(c.iz * nx + c.ix); top = Math.max(top, c.top); low = Math.min(low, c.low); } grow = true; } }
      { const row = []; for (let ix = x0; ix <= x1; ix++) row.push(grab(ix, z0 - 1)); if (row.every(Boolean)) { z0--; for (const c of row) { res.delete(c.iz * nx + c.ix); top = Math.max(top, c.top); low = Math.min(low, c.low); } grow = true; } }
    }
    const cellsN = (x1 - x0 + 1) * (z1 - z0 + 1); if (cellsN < 2 && !(low === 0 && top > .3)) continue; // 單一格的小裝飾不加（但落地的高邊緣，例如浴缸邊，要加）
    extra.push({ x1: -ext + x0 * step, x2: -ext + (x1 + 1) * step, y1: low, y2: top, z1: -ext + z0 * step, z2: -ext + (z1 + 1) * step, hf: true });
  }
  return cols.concat(extra);
}
