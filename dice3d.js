// v13 大廳 3D 擲骰桌：所有人的骰子丟到同一張桌上，會翻滾、彈跳、互相碰撞。
// 主機決定點數；每次丟骰先「離線」算完整段物理軌跡（固定種子），再把骰面貼圖預先轉好，讓停下來時朝上的就是主機的點數。
// 停下來的骰子之後當成固定障礙（不會再被撞翻），所以點數不會變。

const H = .5;                 // 骰子半邊長（骰子邊長 1）
const TX = 5.0, TZ = 2.75;    // 桌面內側半寬／半深
const G = 32, DT = 1 / 120, MAX_STEPS = 120 * 7;
const E_FLOOR = .42, E_WALL = .5, E_DIE = .4, MU = .32;
// 骰面：本地軸 → 點數（對面相加 = 7）
const FACE_AXES = { 1: [0, 1, 0], 6: [0, -1, 0], 2: [1, 0, 0], 5: [-1, 0, 0], 3: [0, 0, 1], 4: [0, 0, -1] };
const BOX_ORDER = [2, 5, 1, 6, 3, 4]; // BoxGeometry 面順序：+x -x +y -y +z -z
const CORNERS = []; for (const x of [-H, H]) for (const y of [-H, H]) for (const z of [-H, H]) CORNERS.push([x, y, z]);

function rng(seed) { let a = seed >>> 0 || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// 小型向量／四元數（避免在物理迴圈裡建立 THREE 物件）
const v3 = (x = 0, y = 0, z = 0) => [x, y, z];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
function qmul(a, b) { return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]; }
function qrot(q, v) { const [x, y, z, w] = q; const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]; }
const qconj = q => [-q[0], -q[1], -q[2], q[3]];
function qnorm(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; }
function qaxis(ax, an) { const s = Math.sin(an / 2), l = len(ax) || 1; return [ax[0] / l * s, ax[1] / l * s, ax[2] / l * s, Math.cos(an / 2)]; }
function qfromTo(a, b) { // 單位向量 a → b
  const d = dot(a, b); if (d > .999999) return [0, 0, 0, 1];
  if (d < -.999999) { let ax = cross([1, 0, 0], a); if (len(ax) < 1e-6) ax = cross([0, 1, 0], a); return qaxis(ax, Math.PI); }
  const c = cross(a, b); return qnorm([c[0], c[1], c[2], 1 + d]);
}
function upAxis(q) { // 哪個本地軸朝上 → 點數
  let best = 1, bd = -2; for (const [n, ax] of Object.entries(FACE_AXES)) { const d = qrot(q, ax)[1]; if (d > bd) { bd = d; best = +n; } } return { n: best, d: bd };
}

// ---------- 物理 ----------
function applyImpulse(A, B, c, n, e, mu, ev) {
  const rA = sub(c, A.x), rB = B ? sub(c, B.x) : null;
  const vA = add(A.v, cross(A.w, rA)), vB = B ? add(B.v, cross(B.w, rB)) : v3();
  const vr = sub(vA, vB), vn = dot(vr, n); if (vn >= 0) return 0;
  const iA = A.static ? 0 : 1, iB = B && !B.static ? 1 : 0, II = 6; // 質量 1、立方體慣量 1/6
  const kA = iA ? 1 + II * dot(cross(rA, n), cross(rA, n)) : 0, kB = iB ? 1 + II * dot(cross(rB, n), cross(rB, n)) : 0;
  const j = -(1 + (Math.abs(vn) < .6 ? 0 : e)) * vn / ((kA + kB) || 1);
  const t0 = sub(vr, mul(n, vn)), tl = len(t0);
  let jt = 0, t = null; if (tl > 1e-5) { t = mul(t0, 1 / tl); const ktA = iA ? 1 + II * dot(cross(rA, t), cross(rA, t)) : 0, ktB = iB ? 1 + II * dot(cross(rB, t), cross(rB, t)) : 0; jt = Math.max(-mu * j, -tl / ((ktA + ktB) || 1)); }
  const P = add(mul(n, j), t ? mul(t, jt) : v3());
  if (iA) { A.v = add(A.v, P); A.w = add(A.w, mul(cross(rA, P), II)); }
  if (iB) { B.v = sub(B.v, P); B.w = sub(B.w, mul(cross(rB, P), II)); }
  if (ev && -vn > 1.2) ev.push({ k: ev.kind, s: -vn });
  return -vn;
}
const PLANES = [[[0, 1, 0], 0, E_FLOOR], [[1, 0, 0], -TX, E_WALL], [[-1, 0, 0], -TX, E_WALL], [[0, 0, 1], -TZ, E_WALL], [[0, 0, -1], -TZ, E_WALL]];
function stepWorld(bodies, events) {
  for (const b of bodies) if (!b.static && !b.asleep) { b.v[1] -= G * DT; }
  for (let it = 0; it < 2; it++) {
    for (const b of bodies) { if (b.static || b.asleep) continue;
      for (const [n, d, e] of PLANES) { let deepest = 0, cs = [0, 0, 0], cn = 0;
        for (const lc of CORNERS) { const c = add(b.x, qrot(b.q, lc)); const pen = d - dot(c, n);
          if (pen > 0) { cs = add(cs, c); cn++; if (pen > deepest) deepest = pen; } }
        if (!cn) continue; // 同一面多個角接觸時，在接觸點的中心施一次衝量（平躺時不會產生亂轉的扭力）
        const s = applyImpulse(b, null, mul(cs, 1 / cn), n, e, MU, null);
        if (it === 0 && s > 1.2) events.push({ id: b.id, k: n[1] ? 'floor' : 'wall', s, first: !b.landed && n[1] === 1 }); if (n[1] === 1 && s > 1.2) b.landed = true;
        b.x = add(b.x, mul(n, deepest * .6)); } }
    for (let i = 0; i < bodies.length; i++) for (let j = 0; j < bodies.length; j++) { if (i === j) continue;
      const A = bodies[i], B = bodies[j]; if ((A.static || A.asleep) && (B.static || B.asleep)) continue;
      if (len(sub(A.x, B.x)) > 1.8) continue;
      const qi = qconj(B.q);
      for (const lc of CORNERS) { const c = add(A.x, qrot(A.q, lc)); const p = qrot(qi, sub(c, B.x));
        const dx = H - Math.abs(p[0]), dy = H - Math.abs(p[1]), dz = H - Math.abs(p[2]); if (dx <= 0 || dy <= 0 || dz <= 0) continue;
        let ln; if (dx < dy && dx < dz) ln = [Math.sign(p[0]), 0, 0]; else if (dy < dz) ln = [0, Math.sign(p[1]), 0]; else ln = [0, 0, Math.sign(p[2])];
        const n = qrot(B.q, ln), pen = Math.min(dx, dy, dz);
        if (A.asleep && !A.static) A.asleep = false; if (B.asleep && !B.static) B.asleep = false;
        const s = applyImpulse(A, B, c, n, E_DIE, .3, null); if (it === 0 && s > 1.2) events.push({ id: A.id, k: 'die', s });
        const sa = A.static ? 0 : B.static ? 1 : .5, sb = B.static ? 0 : A.static ? 1 : .5; A.x = add(A.x, mul(n, pen * sa * .6)); B.x = sub(B.x, mul(n, pen * sb * .6)); } }
  }
  for (const b of bodies) { if (b.static || b.asleep) continue;
    const low = b.x[1] < H * 1.75; // 貼著桌面：滾動阻力，越慢阻力越大，才會真的停
    if (low && len(b.v) < .9) { b.v = mul(b.v, .982); b.w = mul(b.w, .955); } else { b.v = mul(b.v, .998); b.w = mul(b.w, low ? .985 : .997); }
    b.x = add(b.x, mul(b.v, DT));
    const wl = len(b.w); if (wl > 1e-6) b.q = qnorm(qmul(qaxis(b.w, wl * DT), b.q));
    // 判斷停下：用一段時間內的位移／轉動量（接觸點的小抖動不算在動）
    b.age = (b.age || 0) + 1;
    if (b.age % 15 === 0) { const moved = b.anchor ? len(sub(b.x, b.anchor.x)) : 1, turned = b.anchor ? Math.abs(b.q[0] * b.anchor.q[0] + b.q[1] * b.anchor.q[1] + b.q[2] * b.anchor.q[2] + b.q[3] * b.anchor.q[3]) : 0;
      b.still = moved < .03 && (turned > .998 || b.x[1] < H + .08) && b.x[1] < 2.2 ? (b.still || 0) + 15 : 0; b.anchor = { x: [...b.x], q: [...b.q] }; }
    if (b.still > 20) { const u = upAxis(b.q); if (u.d > .97) { b.asleep = true; b.v = v3(); b.w = v3(); } else if (b.still > 90) { b.w = add(b.w, [(b.rnd() - .5) * 6, 0, (b.rnd() - .5) * 6]); b.v[1] += 2.5; b.still = 0; } } }
}

export const __sim = { stepWorld, rng, qnorm, upAxis, H, TX, TZ, MAX_STEPS };
export function createDiceTable({ THREE, canvas, low, onSound }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.25 : 2));
  renderer.shadowMap.enabled = !low; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  let lost = false; canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; }); canvas.addEventListener('webglcontextrestored', () => { lost = false; dirty = true; });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 2, .1, 60); camera.position.set(0, 8.4, 5.4); camera.lookAt(0, 0, .25);
  scene.add(new THREE.HemisphereLight('#fff6e8', '#7a5a45', 1.15));
  const sun = new THREE.DirectionalLight('#fff1dc', 1.6); sun.position.set(-3, 10, 5); sun.castShadow = !low; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 5, bottom: -5, near: 1, far: 25 }); scene.add(sun);
  const Mat = low ? THREE.MeshLambertMaterial : THREE.MeshStandardMaterial;
  // 桌子：綠色絨布＋木框
  const felt = new THREE.Mesh(new THREE.PlaneGeometry(TX * 2, TZ * 2), new Mat({ color: '#2f8a5b', roughness: .95 })); felt.rotation.x = -Math.PI / 2; felt.receiveShadow = !low; scene.add(felt);
  const wood = new Mat({ color: '#9a6b42', roughness: .7 });
  for (const [w, d, x, z] of [[TX * 2 + .9, .45, 0, -TZ - .22], [TX * 2 + .9, .45, 0, TZ + .22], [.45, TZ * 2, -TX - .22, 0], [.45, TZ * 2, TX + .22, 0]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, .55, d), wood); m.position.set(x, .27, z); m.castShadow = m.receiveShadow = !low; scene.add(m); }
  const under = new THREE.Mesh(new THREE.BoxGeometry(TX * 2 + 1, .3, TZ * 2 + 1), new Mat({ color: '#6d4a2c' })); under.position.y = -.16; scene.add(under);

  // 骰面貼圖（依玩家顏色快取）
  const faceCache = new Map();
  function faceMats(color) {
    if (faceCache.has(color)) return faceCache.get(color);
    const c = new THREE.Color(color), lum = c.r * .3 + c.g * .59 + c.b * .11, pip = lum > .55 ? '#3a2a20' : '#ffffff';
    const mats = BOX_ORDER.map(n => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
      x.fillStyle = color; x.fillRect(0, 0, 128, 128); x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 8; x.strokeRect(4, 4, 120, 120);
      const P = { 1: [[64, 64]], 2: [[36, 36], [92, 92]], 3: [[34, 34], [64, 64], [94, 94]], 4: [[36, 36], [92, 36], [36, 92], [92, 92]], 5: [[34, 34], [94, 34], [64, 64], [34, 94], [94, 94]], 6: [[36, 32], [92, 32], [36, 64], [92, 64], [36, 96], [92, 96]] }[n];
      x.fillStyle = n === 1 ? '#e8364f' : pip; for (const [px, py] of P) { x.beginPath(); x.arc(px, py, n === 1 ? 17 : 11, 0, 6.3); x.fill(); }
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return new Mat({ map: t, roughness: .45 }); });
    faceCache.set(color, mats); return mats;
  }
  const dieGeo = new THREE.BoxGeometry(1, 1, 1);
  const TAG_W = 3.7, TAG_H = .92; // v15：約為前一版的 2 倍，字要清楚看得見
  const TAG_CW = 640, TAG_CH = 160;
  function makeTag() { const cv = document.createElement('canvas'); cv.width = TAG_CW; cv.height = TAG_CH; const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(TAG_W, TAG_H, 1); s.renderOrder = 5; s.userData = { cv, t, key: '' }; return s; }
  function drawTag(s, text, bg, fg = '#fff') { if (s.userData.key === text + bg) return; s.userData.key = text + bg; const { cv, t } = s.userData, x = cv.getContext('2d');
    x.clearRect(0, 0, TAG_CW, TAG_CH); x.font = 'bold 64px sans-serif'; const w = Math.min(TAG_CW - 16, x.measureText(text).width + 56);
    x.fillStyle = bg; x.beginPath(); x.roundRect(TAG_CW / 2 - w / 2, 8, w, 144, 48); x.fill();
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 8; x.strokeStyle = 'rgba(0,0,0,.35)'; x.strokeText(text, TAG_CW / 2, 80, TAG_CW - 40);
    x.fillStyle = fg; x.fillText(text, TAG_CW / 2, 80, TAG_CW - 40); t.needsUpdate = true;
    s.userData.pill = Math.min(1, w / TAG_CW); }
  const ringGeo = new THREE.RingGeometry(.78, 1.0, 40); ringGeo.rotateX(-Math.PI / 2);

  const dice = new Map(); // id → { body, mesh, inner, tag, ring, n, name, color, settled, pre }
  let plan = null, frame = 0, acc = 0, lastTick = 0, lastW = 0, lastH = 0, status = { seekers: [], tied: [], done: false }, dirty = true;
  // 依畫布比例找最小的視角，讓整張桌子（含木框、骰子名牌）都在畫面內
  const FIT_PTS = []; for (const x of [-TX - .45, TX + .45]) for (const z of [-TZ - .45, TZ + .45]) for (const y of [0, .6]) FIT_PTS.push(new THREE.Vector3(x, y, z));
  for (const x of [-TX + .5, TX - .5]) {
    FIT_PTS.push(new THREE.Vector3(x, 1.95, -TZ + .5), new THREE.Vector3(x, 1.95, TZ - .5));
    FIT_PTS.push(new THREE.Vector3(x, 2.7, -TZ + .5), new THREE.Vector3(x, 2.7, TZ - .5)); // 名牌在骰子上方，鏡頭略留空，但不為了名牌把整張桌拉得很小
  }
  for (const x of [-3.6, 3.6]) FIT_PTS.push(new THREE.Vector3(x, 3.4, .9)); // 剛丟出去、在空中的骰子
  const _fp = new THREE.Vector3();
  const CAM_DIR = new THREE.Vector3(0, 8.4, 5.15).normalize(), CAM_AT = new THREE.Vector3(0, .35, .25);
  function fitCamera() { // 視角固定，往後拉到所有點都在畫面內（不會因為比例奇怪就整張桌變很小或被切掉）
    camera.fov = 36;
    for (let dist = 6; dist <= 40; dist += .2) { camera.position.copy(CAM_AT).addScaledVector(CAM_DIR, dist); camera.lookAt(CAM_AT); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      if (FIT_PTS.every(pt => { _fp.copy(pt).project(camera); return Math.abs(_fp.x) <= .96 && Math.abs(_fp.y) <= .93; })) break; }
    api.fov = camera.fov; api.camDist = camera.position.distanceTo(CAM_AT);
  }
  const quat = new THREE.Quaternion();
  function mkBody(id, x, q, n) { return { id, x, q, v: v3(), w: v3(), static: false, asleep: false, landed: false, rnd: rng(n * 7919 + 3) }; }
  function ensureDie(id, info) {
    let d = dice.get(id);
    if (d && d.color !== info.color) { scene.remove(d.mesh); scene.remove(d.ring); dice.delete(id); d = null; }
    if (!d) { const mesh = new THREE.Group(), inner = new THREE.Mesh(dieGeo, faceMats(info.color)); inner.castShadow = !low; mesh.add(inner);
      const tag = makeTag(); scene.add(tag); const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ff4f8b', transparent: true, opacity: .9, depthWrite: false })); ring.visible = false; scene.add(ring);
      scene.add(mesh); d = { id, mesh, inner, tag, ring, color: info.color, body: null, n: info.n, name: info.name, settled: false, pre: [0, 0, 0, 1] }; dice.set(id, d); }
    d.name = info.name; d.n = info.n; return d;
  }
  // 用目前所有骰子的狀態，離線模擬到全部停下，記錄每一步
  function replan() {
    const bodies = [...dice.values()].filter(d => d.body).map(d => { const b = d.body; return { ...b, x: [...b.x], v: [...b.v], w: [...b.w], q: [...b.q], static: d.settled, asleep: d.settled }; });
    const live = bodies.filter(b => !b.static); if (!live.length) { plan = null; return; }
    const frames = [], events = [];
    for (let s = 0; s < MAX_STEPS; s++) { const ev = []; stepWorld(bodies, ev); frames.push(live.map(b => [b.x[0], b.x[1], b.x[2], b.q[0], b.q[1], b.q[2], b.q[3], b.v[0], b.v[1], b.v[2], b.w[0], b.w[1], b.w[2]])); if (ev.length) events.push([s, ev]); if (live.every(b => b.asleep)) break; }
    // 停穩後扶正（12 格平滑轉到完全平放），並預轉骰面：讓主機點數那一面朝上
    const last = frames[frames.length - 1], fin = live.map((b, i) => { const a = last[i], q = [a[3], a[4], a[5], a[6]], u = upAxis(q);
      return { a, q, qf: qnorm(qmul(qfromTo(qrot(q, FACE_AXES[u.n]), [0, 1, 0]), q)), y: a[1] < H + .12 ? H : a[1], u: u.n }; });
    for (let k = 1; k <= 12; k++) frames.push(fin.map(({ a, q, qf, y }) => { const t = k / 12, qq = slerp(q, qf, t); return [a[0], a[1] + (y - a[1]) * t, a[2], qq[0], qq[1], qq[2], qq[3], 0, 0, 0, 0, 0, 0]; }));
    live.forEach((b, i) => { const d = dice.get(b.id); d.pre = qfromTo(FACE_AXES[d.n], FACE_AXES[fin[i].u]); });
    // 太快停下的話稍微放慢播放（最多慢 30%），讓整個擲骰過程至少約 2 秒，大家都看得清楚
    const durS = frames.length * DT; plan = { ids: live.map(b => b.id), frames, events: new Map(events), start: frame = 0, rate: Math.max(.7, Math.min(1, durS / 2.1)) };
  }
  function slerp(a, b, t) { const qa = new THREE.Quaternion(...a), qb = new THREE.Quaternion(...b); qa.slerp(qb, t); return [qa.x, qa.y, qa.z, qa.w]; }
  function applyFrame(f) { plan.ids.forEach((id, i) => { const d = dice.get(id); if (!d) return; const a = plan.frames[f][i]; if (!a) return; const b = d.body;
    b.x = [a[0], a[1], a[2]]; b.q = [a[3], a[4], a[5], a[6]]; b.v = [a[7], a[8], a[9]]; b.w = [a[10], a[11], a[12]]; }); }


  const _right = new THREE.Vector3(), _up = new THREE.Vector3(), _np = new THREE.Vector3(), _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3();
  function layoutTags(full = true) { // 以畫面座標把名牌放在骰子上方或旁邊：固定像素大小清楚可讀，不超出畫布、不蓋住骰子或彼此
    camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
    _right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    _up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    const list = [...dice.values()].filter(d => d.body);
    const cw = canvas.clientWidth || 1, ch = canvas.clientHeight || 1;
    const targetH = Math.max(36, Math.min(40, ch * 0.24));
    const yMin = (ndcH) => -1 + ndcH * .5 + .03, yMax = (ndcH) => 1 - ndcH * .5 - .03;
    const xMin = (ndcW) => -1 + ndcW * .5 + .03, xMax = (ndcW) => 1 - ndcW * .5 - .03;
    const proj = (x, y, z) => { _np.set(x, y, z).project(camera); return [_np.x, _np.y, _np.z]; };
    const items = list.map(d => {
      const b = d.body, sc = d.mesh.scale.x || 1, dieR = .5 * sc;
      const c = proj(b.x[0], b.x[1], b.x[2]);
      const u = proj(b.x[0] + _up.x * dieR, b.x[1] + _up.y * dieR, b.x[2] + _up.z * dieR);
      const r = proj(b.x[0] + _right.x * dieR, b.x[1] + _right.y * dieR, b.x[2] + _right.z * dieR);
      const dieHh = Math.max(Math.abs(u[1] - c[1]), .02), dieHw = Math.max(Math.abs(r[0] - c[0]), .02);
      _p0.set(b.x[0], b.x[1], b.x[2]).project(camera);
      _p1.set(b.x[0], b.x[1], b.x[2]).addScaledVector(_up, 1).project(camera);
      const pxPer = Math.max(.001, Math.abs(_p1.y - _p0.y) * .5 * ch);
      const frac = Math.max(.55, d.tag.userData.pill || .7);
      const worldH = targetH / pxPer, worldW = worldH * (TAG_W / TAG_H); // 整張貼圖一起縮放，字才不會被左右壓扁
      const ndcH = 2 * targetH / ch, ndcW = 2 * (targetH * (TAG_W / TAG_H) * frac) / cw; // 重疊只用看得見的藥丸寬度
      const hhN = ndcH * .5, hwN = ndcW * .5, padN = 2 * 4 / ch;
      const above = c[1] + dieHh + hhN + padN;
      let x, y;
      if (above <= yMax(ndcH)) { x = c[0]; y = above; }
      else {
        const left = c[0] - dieHw - hwN - padN, right = c[0] + dieHw + hwN + padN;
        x = (Math.abs(left) < Math.abs(right) && left >= xMin(ndcW)) || right > xMax(ndcW) ? left : right;
        y = c[1];
      }
      return { d, c, z: c[2], dieHh, dieHw, worldW, worldH, ndcW, ndcH, hwN, hhN, padN, x, y };
    });
    const clamp = t => { t.x = Math.min(xMax(t.ndcW), Math.max(xMin(t.ndcW), t.x)); t.y = Math.min(yMax(t.ndcH), Math.max(yMin(t.ndcH), t.y)); };
    const overlapXY = (a, b, ox, oy) => ox > 0 && oy > 0;
    const sep = () => {
      let moved = false;
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        const dx = b.x - a.x, dy = b.y - a.y, pad = Math.max(a.padN, b.padN);
        const ox = (a.ndcW + b.ndcW) * .5 + pad - Math.abs(dx), oy = (a.ndcH + b.ndcH) * .5 + pad - Math.abs(dy);
        if (!overlapXY(a, b, ox, oy)) continue;
        const roomUp = Math.max(a.y, b.y) + oy * .6 <= Math.min(yMax(a.ndcH), yMax(b.ndcH));
        if (oy < ox && roomUp) {
          const s = oy * .55; if (dy >= 0) b.y += s; else a.y += s;
        } else {
          const s = (dx === 0 ? (a.x <= b.x ? 1 : -1) : Math.sign(dx)) * ox * .55;
          a.x -= s; b.x += s;
        }
        moved = true;
      }
      return moved;
    };
    const clearDie = () => {
      let moved = false;
      for (const t of items) for (const o of items) {
        const dx = t.x - o.c[0], dy = t.y - o.c[1];
        const ox = t.hwN + o.dieHw + t.padN - Math.abs(dx), oy = t.hhN + o.dieHh + t.padN - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        const canUp = t.y + oy + .01 <= yMax(t.ndcH);
        if (canUp && (oy <= ox || t.d === o.d)) t.y += oy + .01;
        else t.x += (dx === 0 ? 1 : Math.sign(dx)) * (ox + .01);
        moved = true;
      }
      return moved;
    };
    for (const t of items) clamp(t);
    if (full) {
      for (let it = 0; it < 12; it++) { const m = sep() | clearDie(); for (const t of items) clamp(t); if (!m) break; }
    }
    let avgW = 0, avgH = 0;
    for (const t of items) {
      t.d.tag.scale.set(t.worldW, t.worldH, 1);
      _np.set(t.x, t.y, t.z).unproject(camera);
      t.d.tag.position.copy(_np);
      avgW += t.worldW; avgH += t.worldH;
    }
    const n = items.length || 1;
    api._tagScale = { w: avgW / n, h: avgH / n, targetPx: targetH };
  }
  const api = {
    throwDie(id, info) { api.throwMany([[id, info]]); }, // info: { n, color, name, seed, slot }
    throwMany(list) { // 一次丟多顆（同一個物理世界一起算，會互相碰撞）
      if (plan) applyFrame(Math.min(frame, plan.frames.length - 1));
      for (const [id, info] of list) { const d = ensureDie(id, info), r = rng(info.seed || (Math.random() * 2 ** 31));
        const slot = info.slot || 0, col = slot % 4, row = Math.floor(slot / 4) % 2, lay = Math.floor(slot / 8);
        const sx = -3.6 + col * 2.4 + (row ? 1.2 : 0) - (col === 3 && row ? 2.4 * 3.5 : 0), sz = 1.2 - row * 1.0;
        d.body = mkBody(id, [sx, 2.6 + lay * 1.1 + r() * .5, sz], qnorm([r() - .5, r() - .5, r() - .5, r() - .5]), info.n);
        d.body.v = [(r() - .5) * 3.4 - sx * .3, 2.3 + r() * 1.4, -(1.8 + r() * 2.0)]; d.body.w = [(r() - .5) * 30, (r() - .5) * 18, (r() - .5) * 30];
        d.settled = false; d.thrownAt = performance.now(); }
      replan(); frame = 0; acc = 0; lastTick = 0; dirty = true;
    },
    placeDie(id, info) { // 直接放好（晚加入／漏掉事件時）
      const d = ensureDie(id, info), slot = info.slot || 0, yaw = ((info.seed || slot * 977) % 628) / 100;
      const x = -TX + .9 + slot * 1.15, z = -.4 + (slot % 2) * .8; d.body = mkBody(id, [Math.min(TX - .7, x), H, z], qaxis([0, 1, 0], yaw), info.n);
      d.body.asleep = true; d.settled = true; d.pre = qfromTo(FACE_AXES[info.n], [0, 1, 0]); dirty = true;
    },
    removeDie(id) { const d = dice.get(id); if (!d) return; scene.remove(d.mesh); scene.remove(d.tag); scene.remove(d.ring); dice.delete(id); if (plan?.ids.includes(id)) { applyFrame(Math.min(frame, plan.frames.length - 1)); replan(); } dirty = true; },
    has: id => dice.has(id), dieN: id => dice.get(id)?.n,
    setStatus(st) { status = st; dirty = true; },
    clear() { for (const id of [...dice.keys()]) api.removeDie(id); plan = null; },
    rolling: () => !!plan, planLen: () => plan ? plan.frames.length : 0, planSec: () => plan ? plan.frames.length * DT / (plan.rate || 1) : 0, planFrame: () => frame,
    list() { return [...dice.values()].map(d => { d.mesh.updateMatrixWorld(true); const q = d.inner.getWorldQuaternion(new THREE.Quaternion());
      return { id: d.id, n: d.n, face: upAxis([q.x, q.y, q.z, q.w]).n, settled: d.settled, y: +d.mesh.position.y.toFixed(2), x: +d.mesh.position.x.toFixed(2), z: +d.mesh.position.z.toFixed(2), ring: d.ring.visible, tag: d.tag.userData.key }; }); },
    resize() { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return false; if (lastW !== w || lastH !== h) { lastW = w; lastH = h; renderer.setSize(w, h, false); camera.aspect = w / h;
      fitCamera(); dirty = true; } return true; },
    tick(dt) { // 每幀：播放軌跡、更新標籤；有變動才重畫
      const shown = api.resize() !== false;
      const nowMs = performance.now(); dt = lastTick ? Math.min(.25, (nowMs - lastTick) / 1000) : dt; lastTick = nowMs; // 用真實時間播放，慢的手機不會變慢動作
      if (plan) { acc += dt * api.speed * (plan.rate || 1); let steps = 0; while (acc >= DT && steps < 40) { acc -= DT; steps++; frame++;
          const ev = plan.events.get(frame); if (ev) for (const e of ev) onSound?.(e); }
        if (frame >= plan.frames.length - 1) { frame = plan.frames.length - 1; applyFrame(frame); for (const id of plan.ids) { const d = dice.get(id); if (d) { d.settled = true; d.body.asleep = true; d.body.v = v3(); d.body.w = v3(); } } plan = null; onSound?.({ k: 'settle', s: 1 }); }
        else applyFrame(frame); dirty = true;
        if (plan) { api.trace.push(plan.ids.map(id => dice.get(id)?.body?.x.map(v => +v.toFixed(2)).join(',')).join('|')); if (api.trace.length > 300) api.trace.shift(); } }
      const t = performance.now() / 1000;
      for (const d of dice.values()) { if (!d.body) continue; const b = d.body;
        d.mesh.position.set(b.x[0], b.x[1], b.x[2]); d.mesh.quaternion.set(b.q[0], b.q[1], b.q[2], b.q[3]); d.inner.quaternion.set(d.pre[0], d.pre[1], d.pre[2], d.pre[3]);
        const isSk = d.settled && status.done && status.seekers.includes(d.id), tied = d.settled && status.tied.includes(d.id) && !status.done; // 還在滾就先不公布
        const txt = !d.settled ? d.name : isSk ? `👻 ${d.name}  ${d.n}` : `${d.name}  ${d.n}`;
        drawTag(d.tag, txt, isSk ? '#ff4f8b' : tied ? '#ff9f1c' : 'rgba(60,40,28,.78)');
        d.ring.visible = d.settled && (isSk || tied); d.ring.position.set(b.x[0], .02, b.x[2]); d.ring.material.color.set(isSk ? '#ff4f8b' : '#ff9f1c');
        if (d.ring.visible) { const s = 1 + .12 * Math.sin(t * 5); d.ring.scale.set(s, 1, s); dirty = true; }
        d.mesh.scale.setScalar(isSk && d.settled ? 1.12 : 1); }
      layoutTags(!plan);
      if (dirty && shown && !lost) { renderer.render(scene, camera); dirty = false; api.frames++; }
    },
    projected() { // 測試用：骰子／名牌中心與畫面矩形（NDC，-1..1 在畫面內）
      layoutTags(); camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
      _right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
      _up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
      const v = new THREE.Vector3(), out = { dice: [], corners: [] };
      const ndc = p => { v.copy(p).project(camera); return [v.x, v.y]; };
      const rectFrom = (cx, cy, cz, hw, hh) => {
        const pts = [];
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
          pts.push(ndc(_np.set(cx, cy, cz).addScaledVector(_right, sx * hw).addScaledVector(_up, sy * hh)));
        }
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        return { x1: Math.min(...xs), x2: Math.max(...xs), y1: Math.min(...ys), y2: Math.max(...ys) };
      };
      const overlap = (a, b, pad = 0) => a.x1 < b.x2 - pad && a.x2 > b.x1 + pad && a.y1 < b.y2 - pad && a.y2 > b.y1 + pad;
      for (const d of dice.values()) { if (!d.body) continue; const b = d.body, sc = d.mesh.scale.x || 1;
        const p1 = ndc(_np.set(b.x[0], b.x[1], b.x[2]));
        const tp = d.tag.position, p2 = ndc(_np.set(tp.x, tp.y, tp.z));
        const frac = Math.max(.55, d.tag.userData.pill || .7), vfrac = 144 / 160;
        const tw = d.tag.scale.x * frac, th = d.tag.scale.y * vfrac;
        const dieR = rectFrom(b.x[0], b.x[1], b.x[2], .5 * sc, .5 * sc);
        const tagR = rectFrom(tp.x, tp.y, tp.z, tw * .5, th * .5);
        const cw = canvas.clientWidth || 1, ch = canvas.clientHeight || 1;
        const tagPx = { w: (tagR.x2 - tagR.x1) / 2 * cw, h: (tagR.y2 - tagR.y1) / 2 * ch };
        out.dice.push({ id: d.id, p: p1, tag: p2, dieRect: dieR, tagRect: tagR, tagPx, overlapDie: overlap(dieR, tagR, .01) }); }
      out.tagOverlap = out.dice.some((a, i) => out.dice.some((b, j) => j > i && overlap(a.tagRect, b.tagRect, .01)));
      out.tagSize = api._tagScale || { w: TAG_W, h: TAG_H };
      for (const x of [-TX - .45, TX + .45]) for (const z of [-TZ - .45, TZ + .45]) { out.corners.push(ndc(_np.set(x, .55, z))); }
      return out; },
    tagSize() { return api._tagScale || { w: TAG_W, h: TAG_H }; },
    snap() { // 測試用：馬上重畫一次並讀回像素（粗略統計＋32×18 亮度格，用來比對前後兩格有沒有在動）
      if (api.resize() === false || lost) return null; renderer.render(scene, camera); const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); let felt = 0, col = 0, s = 0, s2 = 0; const GW = 32, GH = 18, grid = new Array(GW * GH).fill(0), cnt = new Array(GW * GH).fill(0); const n = w * h;
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { const i = (y * w + x) * 4, r = px[i], g = px[i + 1], b = px[i + 2], l = .3 * r + .59 * g + .11 * b; s += l; s2 += l * l;
        if (g > r + 25 && g > b + 10 && g < 190) felt++; if (Math.max(r, g, b) - Math.min(r, g, b) > 60) col++; const k = Math.floor(y / h * GH) * GW + Math.floor(x / w * GW); grid[k] += l; cnt[k]++; }
      const m = Math.ceil(h / 2) * Math.ceil(w / 2); return { w, h, felt: felt / m, colorful: col / m, sd: Math.sqrt(s2 / m - (s / m) ** 2), grid: grid.map((v, i) => Math.round(v / (cnt[i] || 1))) };
    },
    frames: 0, renderer, speed: 1, trace: [],
  };
  return api;
}
