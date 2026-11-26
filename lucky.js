// 福貓辦公室・LUCKY CAT 總部（v11）：依 Luxcat 2F 平面圖（/workspace/office-plan/make_plan.py）重建。
// 平面圖單位 → 世界座標：X = (px-250)*K、Z = (py-209)*K（俯視上方 = -z）。平面圖 1 單位約 6 cm；世界 1 單位約 0.9 m（配合 Kenney 家具放大 2.2 倍）。
export const K = 0.066;
const X = px => +((px - 250) * K).toFixed(3);
const Z = py => +((py - 209) * K).toFixed(3);
const WH = 2.72, TI = .14, TO = .3;

// ---------- 房間名稱（之後拿到正確名稱只要改這張表）----------
// sure: false = 平面圖看不清或照片對應是推測
export const ROOMS = [
  { id: 'meeting', name: '會議室', at: [62, 262], sure: true },
  { id: 'boss', name: '老闆辦公室', at: [168, 150], sure: true },
  { id: 'arc', name: '辦公室', at: [88, 172], sure: false },
  { id: 'nw', name: '小辦公室', at: [70, 214], sure: false },
  { id: 'copy', name: '影印區', at: [140, 262], sure: false },
  { id: 'spare', name: '備品室', at: [189, 280], sure: false },
  { id: 'party', name: '生日會客室', at: [236, 276], sure: false },
  { id: 'entry', name: '入口區', at: [306, 262], sure: true },
  { id: 'pantry', name: '茶水間', at: [372, 258], sure: true },
  { id: 'store', name: '儲藏室', at: [440, 262], sure: false },
  { id: 'equip', name: '設備間', at: [473, 262], sure: false },
  { id: 'small', name: '小會議室', at: [452, 124], sure: false },
  { id: 'north', name: '窗邊辦公區', at: [330, 136], sure: false },
  { id: 'read', name: '閱覽區', at: [160, 200], sure: false },
  { id: 'open', name: '開放辦公區', at: [300, 202], sure: true },
  { id: 'cafe', name: 'LUCKY CAT 咖啡角', at: [448, 210], sure: false },
  { id: 'lift', name: '電梯廳', at: [333, 312], sure: false },
];

// ---------- 牆 ----------
// [起點, 終點, 種類, {gaps: [[距起點, 距起點],...]（平面圖單位）}]
// out=外牆 in=隔間 brick=白磚牆（+側） grass=人工草皮牆（-側） glassB=黑框玻璃 glassF=霧面條紋玻璃
const WALLS = [
  [[12, 304], [12, 250], 'out'], [[12, 250], [23, 240], 'out'], [[23, 240], [23, 216], 'out'], [[23, 216], [36, 216], 'out'],
  [[36, 216], [41, 221], 'out'], [[41, 221], [53, 211], 'out'], [[53, 211], [58, 190], 'out'],
  [[108, 152], [122, 151], 'out'], [[122, 151], [128, 142], 'out'], [[128, 142], [158, 124], 'out'], [[158, 124], [172, 112], 'out'],
  [[172, 112], [447, 112], 'out'], [[447, 112], [459, 123], 'out'], [[459, 123], [487, 123], 'out'], [[487, 123], [487, 306], 'out'],
  [[487, 306], [385, 306], 'out'], [[385, 297], [335, 297], 'out'], [[335, 297], [281, 297], 'glassB', { gaps: [[17, 43]] }], [[281, 304], [12, 304], 'out'],
  // 電梯廳（入口外）
  [[281, 297], [281, 322], 'out'], [[281, 322], [385, 322], 'out'], [[385, 322], [385, 297], 'out'],
  // 老闆辦公室
  [[197, 112], [197, 180], 'in'], [[197, 180], [133, 180], 'in', { gaps: [[3, 20]] }], [[133, 180], [124, 152], 'in'],
  // 弧形辦公室、小辦公室
  [[133, 180], [121, 208], 'in', { gaps: [[12, 29]] }], [[58, 190], [121, 208], 'in'], [[121, 208], [113, 240], 'in', { gaps: [[3, 20]] }],
  // 會議室
  [[23, 239], [113, 239], 'in'], [[113, 239], [113, 304], 'in', { gaps: [[2, 19]] }],
  // 影印區／備品室
  [[168, 271], [168, 304], 'in'], [[168, 271], [211, 257], 'in', { gaps: [[14, 31]] }],
  // 生日會客室（白磚牆＋黑框玻璃）
  [[211, 257], [211, 304], 'brick'], [[211, 260], [228, 260], 'glassB'], [[228, 260], [281, 297], 'glassB', { gaps: [[38, 55]] }],
  // 茶水間旁玻璃隔間（大貓貼紙）
  [[335, 268], [335, 297], 'glassB'],
  // 儲藏室／設備間
  [[421, 241], [421, 306], 'in'], [[421, 241], [487, 241], 'in', { gaps: [[3, 20]] }], [[460, 241], [460, 306], 'in', { gaps: [[3, 20]] }],
  // 小會議室（霧面玻璃＋草皮牆）
  [[434, 112], [434, 146], 'glassF', { gaps: [[4, 21]] }], [[434, 146], [487, 178], 'grass'],
];
// 弧形外牆（左上辦公室，下半牆＋玻璃）
const ARC = { c: [109.6, 205.9], r: 54, a0: Math.atan2(190 - 205.9, 58 - 109.6), a1: Math.atan2(152 - 205.9, 108 - 109.6), n: 9 };
const arcPts = () => { const out = []; for (let i = 0; i <= ARC.n; i++) { const a = ARC.a0 + (ARC.a1 - ARC.a0) * i / ARC.n; out.push([ARC.c[0] + ARC.r * Math.cos(a), ARC.c[1] + ARC.r * Math.sin(a)]); } return out; };
const COLUMNS = [[23, 216, 36, 242], [127, 122, 157, 137], [270, 122, 282, 138], [460, 123, 472, 139]];
// 地板分區（照 CAD 地磚圖）
const SHELL = [[12, 304], [12, 250], [23, 240], [23, 216], [36, 216], [41, 221], [53, 211], [58, 190], ...arcPts().slice(1), [122, 151], [128, 142], [158, 124], [172, 112],
  [447, 112], [459, 123], [487, 123], [487, 306], [385, 306], [385, 297], [281, 297], [281, 304]];
const CENT = [[133, 180], [198, 180], [232, 157], [257, 143], [313, 181], [378, 180], [437, 146], [487, 178], [487, 240], [400, 240], [344, 272], [278, 238], [222, 238], [210, 246], [168, 271], [113, 240], [121, 216]];
const BOSS = [[172, 112], [197, 112], [197, 180], [133, 180], [124, 152], [128, 142], [158, 124]];
const LIFT = [[281, 297], [385, 297], [385, 322], [281, 322]];
// 窗：['h'|'v', 牆線, 朝內 +1/-1, 中心, 寬, 窗簾色]
const CURT = '#7f8fa3', CURT_D = '#636b75';
const WIN = [
  ['h', 112, +1, 185, 1.4, CURT], ['h', 112, +1, 216, 1.9, CURT], ['h', 112, +1, 249.5, 1.9, CURT],
  ['h', 112, +1, 302, 1.9, CURT], ['h', 112, +1, 335.5, 1.9, CURT], ['h', 112, +1, 369, 1.9, CURT], ['h', 112, +1, 402.5, 1.9, CURT],
  ['v', 487, -1, 150, 1.4, CURT], ['v', 487, -1, 200, 1.4, CURT_D], ['v', 487, -1, 225, 1.4, CURT_D],
  ['h', 304, -1, 140, 1.5, CURT], ['h', 304, -1, 246, 1.5, CURT], ['h', 306, -1, 440, 1.3, CURT_D],
];
export const WINDOWS = WIN.map(([o, line, s, c, w, curt]) => {
  const face = (o === 'h' ? Z(line) : X(line)) + s * (TO / 2 + .012);
  return o === 'h' ? { x: X(c), z: face, ry: s > 0 ? 0 : Math.PI, w, s, o, curt } : { x: face, z: Z(c), ry: s > 0 ? Math.PI / 2 : -Math.PI / 2, w, s, o, curt };
});
export const WINDOW_HOLES = WINDOWS.map(w => w.o === 'v' ? ['x', w.x, w.z, 1.55, w.w / 2 + .05, .78] : ['z', w.z, w.x, 1.55, w.w / 2 + .05, .78]);
export const BOUNDS = { x1: X(12) + .2, x2: X(487) - .2, z1: Z(112) + .2, z2: Z(322) - .2 };
export const HIDER_SPAWNS = [[232, 144], [262, 144], [300, 144], [340, 144], [232, 202], [300, 202], [342, 202], [306, 258]].map(([a, b]) => [X(a), Z(b)]);
export const SEEKER_SPAWN = [X(305), Z(312)];
export const SEEKER_SPAWN2 = [X(332), Z(312)];
export const LOBBY_AT = [X(300), Z(202)];
export const LIGHTS = [[250, 165], [350, 165], [250, 225], [362, 225], [445, 200], [372, 280], [62, 271], [165, 148]].map(([a, b]) => [X(a), Z(b)]);

// ---------- 家具（可變身）：[模型, x, z, 轉角, 高度y] ----------
const P = [];
const A = (n, px, py, r = 0, y) => P.push(y != null ? [n, X(px), Z(py), r, y] : [n, X(px), Z(py), r]);
// 貼牆掛飾：'h'|'v'、牆線、哪一側（+1 = 牆的 +x/+z 側）、沿牆位置、中心高度
function onWall(n, orient, line, side, along, y, outer = false) {
  const face = (orient === 'h' ? Z(line) : X(line)) + side * ((outer ? TO : TI) / 2 + .03);
  if (orient === 'h') P.push([n, X(along), +face.toFixed(3), side > 0 ? 0 : 180, y]);
  else P.push([n, +face.toFixed(3), Z(along), side > 0 ? 90 : -90, y]);
}
const CLUTTER = ['tissueBox', 'penCup', 'fileTray', 'deskPhone'];
let deskN = 0;
// 兩人共用長桌（木桌面黑腳）＋兩張黑色網椅＋兩台螢幕。faceZ = +1：人坐在 +z 側（桌子 r=0）
function longDesk(px, py, faceZ) {
  const r = faceZ > 0 ? 0 : 180, k = deskN++;
  A('longDesk', px, py, r);
  for (const sx of [-8.3, 8.3]) {
    A('meshChair', px + sx + (k % 2 ? .6 : -.6), py + faceZ * 9.6, faceZ > 0 ? 180 : 0);
    A('computerScreen', px + sx, py - faceZ * 2.4, r, .73);
  }
  A(CLUTTER[k % 4], px + (k % 3 - 1) * 2.2, py + faceZ * 2.2, r + (k % 2 ? 12 : -8), .73);
  if (k % 2 === 0) A('pedestal', px + (k % 4 ? -12.5 : 12.5), py + faceZ * .6, r);
  else if (k % 5 === 1) A('cardboardBoxClosed', px + 12.5, py - faceZ * .5, 10);
}
// 背對背雙排（中間白色格柵隔板）
function deskCluster(xs, seamY) {
  for (const x of xs) { longDesk(x, seamY - 6.3, -1); longDesk(x, seamY + 6.3, +1); }
}

// 窗邊一排（面窗）
for (const x of [216, 249.5, 302, 335.5, 369, 402.5]) longDesk(x, 120.5, +1);
// 中間兩組雙排
deskCluster([229, 262.5], 173.75); deskCluster([306, 339.5, 373], 173.75);
deskCluster([229, 262.5], 229.75); deskCluster([347, 380.5], 229.75);
A('gridPanel', 245.75, 173.75, 0); A('gridPanel', 339.5, 173.75, 0); A('gridPanel', 245.75, 229.75, 0); A('gridPanel', 363.75, 229.75, 0);
A('tallCabinet', 202.6, 146, 90); A('tallCabinet', 202.6, 160, 90);
A('standFan', 424, 152, -120); A('pottedPlant', 205, 132, 0); A('pottedPlant', 286, 132, 0); A('trashcan', 283, 202, 0);
A('printer', 205.5, 205, 90); A('pottedPlant', 403, 202, 0);
onWall('clock', 'h', 112, +1, 276, 2.2, true);
// LUCKY CAT 草皮牆前：長木凳＋黑色小圓桌＋X 背椅；窗邊高桌與木櫃吧台
A('woodBench', 446.6, 162.6, -31.1); A('woodBench', 466.9, 174.8, -31.1);
for (const [x, z] of [[426, 184], [452, 198]]) { A('bistroTable', x, z, 0); A('bistroChair', x - 8, z, 90); A('bistroChair', x + 8, z, -90); A('cupSet', x, z, 0, .74); }
for (const x of [451, 464.6, 478.2]) A('woodCounter', x, 235.4, 180);
A('dishRack', 451, 235.4, 180, .9); A('kitchenCoffeeMachine', 464.6, 236, 180, .9); A('plateStack', 478.2, 235, 0, .9);
for (const [x, z] of [[446, 220], [472, 214]]) { A('highTable', x, z, 0); A('stoolBar', x - 7.5, z + 3, 60); A('stoolBar', x + 7.5, z - 3, -120); }
A('standFan', 482, 198, -90);
// 閱覽區
A('bookcaseOpen', 145, 184.5, 0); A('bookcaseOpen', 160, 184.5, 0); A('books', 152, 184, 0, .95);
A('loungeChair', 148, 212, 150); A('loungeChair', 172, 214, -150); A('sideTable', 160, 224, 0); A('plantSmall2', 156, 224, 0, .85);
A('lampRoundFloor', 132, 196, 0); A('pottedPlant', 186, 192, 0);
// 影印區（無標示）
A('printer', 150, 296, 180); A('paperStack', 150, 296, 180, .83); A('filingCabinet', 117.6, 268, 90); A('filingCabinet', 117.6, 279, 90);
A('tallCabinet', 163.6, 284, -90); A('cardboardBoxClosed', 128, 297, 20); A('trashcan', 160, 298, 0); A('waterDispenser', 118, 293, 90);
// 備品室
A('shelfBoxes', 206.4, 282, -90); A('shelfBoxes', 206.4, 296, -90); A('tallCabinet', 171.5, 291, 90);
A('cardboardBoxClosed', 186, 299, 0); A('cardboardBoxOpen', 188, 290, 90); A('drawerTower', 174, 278, 90); A('broom', 196, 274, 0);
// 生日會客室：紫晶洞、黑色鐵椅、小圓桌
A('geode', 217.5, 268, 90); A('geode', 217.5, 298, 90);
A('bistroTable', 236, 286, 0); A('metalChair', 228, 286, 90); A('metalChair', 244, 286, -90);
A('bistroTable', 258, 297.5, 0); A('metalChair', 250, 297.5, 90); A('metalChair', 266, 297.5, -90); A('plantSmall1', 236, 286, 0, .74);
// 入口區：白色百葉屏風、接待櫃台、植物
A('foldScreen', 298, 287, 0); A('luckyReception', 322, 277, -90); A('computerScreen', 324.5, 277, -90, 1.08);
A('pottedPlant', 286.5, 291, 0); A('meshChair', 330.5, 283, -90);
// 電梯廳
A('pottedPlant', 290, 316, 0); A('trashcan', 376, 316, 0); A('woodBench', 360, 318.5, 0);
// 茶水間
A('woodCounter', 344, 290.6, 180); A('woodSink', 357.6, 290.6, 180); A('woodCounter', 371.2, 290.6, 180);
A('kitchenCoffeeMachine', 344, 291, 180, .9); A('kitchenMicrowave', 371.2, 291, 180, .9); A('kettle', 350, 290, 0, .9);
A('kitchenFridgeLarge', 394, 299.2, 180); A('waterDispenser', 404.2, 301.5, 180); A('wireRack', 413.4, 301, 180);
A('kitchenIsland', 371.5, 267.5, 0); A('fryingPan', 367, 267.5, 20, .9); A('bowlStack', 379, 266, 0, .9); A('cupSet', 376, 270, 0, .9); A('dishRack', 364, 270, 0, .9);
A('luckyCatStatue', 413.5, 262, -90); onWall('foodFrame', 'v', 421, -1, 274, 1.45);
onWall('potShelf', 'h', 297, -1, 349, 1.55, true); onWall('potShelf', 'h', 297, -1, 366, 1.55, true);
A('trashcan', 342, 276, 0); A('standFan', 396, 270, -60);
// 儲藏室：兩側木紋高櫃、紙箱
for (const y of [258.6, 273.8, 289]) A('woodWardrobe', 426.3, y, 90);
for (const y of [276, 291.2]) A('woodWardrobe', 454.7, y, -90);
A('cardboardBoxClosed', 437, 300, 0); A('cardboardBoxClosed', 444, 300, 15); A('cardboardBoxOpen', 440, 291, 90); A('cardboardBoxClosed', 437, 300, 8, .62);
onWall('wallAC', 'h', 241, +1, 452, 2.32);
// 設備間
A('wireRack', 481.3, 256, -90); A('wireRack', 481.3, 271, -90); A('cardboardBoxClosed', 470, 297, 0); A('broom', 466, 300, 0); A('drawerTower', 468, 283, 90);
// 小會議室（照片 6）：白色橢圓桌、白色鐵椅、黑色辦公椅、黑色小圓桌
A('ovalTable', 449, 141, 0); A('tolixChair', 443, 130.5, 0); A('tolixChair', 455, 130.5, 0); A('tolixChair', 441, 151, 160);
A('meshChair', 466, 147, -90); A('bistroTable', 478, 133, 0); A('computerScreen', 449, 138.5, 0, .73);
onWall('wallAC', 'h', 123, +1, 478, 2.32, true);
// 老闆辦公室（粉紅長條地板）
A('desk', 180, 140, 180); A('chairDesk', 180, 125, 0); A('computerScreen', 182, 142.6, 180, .85); A('laptop', 172, 139, 200, .85);
A('loungeSofa', 152, 169, 180); A('tableCoffee', 152, 154, 0); A('bookcaseClosed', 192.6, 160, -90); A('pottedPlant', 190.5, 118, 0);
A('plantSmall3', 152, 154, 0, .51); onWall('wallAC', 'v', 197, -1, 128, 2.32);
// 弧形辦公室
A('desk', 81.9, 177.1, 43.9); A('chairDesk', 81.9 + 10.5, 177.1 + 10.9, 223.9); A('computerScreen', 80.1, 175.2, 43.9, .85);
A('desk', 102.2, 166.6, 10.7); A('chairDesk', 105, 181.5, 190.7); A('laptop', 102, 167, 10.7, .85);
A('bookcaseOpenLow', 70, 196.5, 16); A('pottedPlant', 113, 158, 0); A('filingCabinet', 123.5, 168, -70);
// 小辦公室（名稱不清）
A('desk', 62, 232.3, 180); A('chairDesk', 62, 217.3, 0); A('computerScreen', 62, 234.6, 180, .85);
A('desk', 88, 232.3, 180); A('chairDesk', 88, 217.3, 0); A('laptop', 88, 233, 180, .85);
A('pottedPlant', 43, 230, 0); A('drawerTower', 104, 232, 180);
// 大會議室
A('confTable', 45, 271, 0); A('confTable', 81.4, 271, 0);
for (const x of [33, 45, 57, 69, 81, 93]) { A('meshChair', x, 255.5, 0); A('meshChair', x, 286.5, 180); }
A('cabinetTelevision', 18.6, 271, 90); A('televisionModern', 18.6, 271, 90, .68); A('laptop', 52, 270, 10, .8); A('paperStack', 76, 272, 0, .8);
onWall('whiteboard', 'v', 113, -1, 284, 1.45); onWall('wallAC', 'h', 239, +1, 62, 2.32); A('pottedPlant', 105, 297, 0); A('pottedPlant', 19, 297, 0);
export const PROPS = P;
// 不能變身的裝飾
export const DECOR = [
  ['rugRectangle', X(158), Z(212), 0],
];

// ---------- 程式產生的福貓辦公室家具 ----------
export const LUCKY_PROC = ['longDesk', 'meshChair', 'pedestal', 'drawerTower', 'tissueBox', 'fileTray', 'penCup', 'deskPhone', 'gridPanel', 'tallCabinet',
  'woodCounter', 'woodSink', 'waterDispenser', 'wireRack', 'kitchenIsland', 'dishRack', 'standFan', 'luckyCatStatue', 'geode', 'bistroTable', 'bistroChair',
  'highTable', 'tolixChair', 'metalChair', 'ovalTable', 'luckyReception', 'foldScreen', 'wallAC', 'foodFrame', 'potShelf', 'woodWardrobe', 'woodBench'];
export const LUCKY_WALL = ['wallAC', 'foodFrame', 'potShelf'];
export const LUCKY_SMALL = ['meshChair', 'bistroChair', 'tolixChair', 'metalChair', 'tissueBox', 'fileTray', 'penCup', 'deskPhone', 'dishRack', 'standFan', 'drawerTower', 'foldScreen'];
export const LUCKY_IMMUNE = ['longDesk', 'tallCabinet', 'woodCounter', 'woodSink', 'kitchenIsland', 'luckyReception', 'woodWardrobe', 'wireRack', 'luckyCatStatue', 'ovalTable', 'geode', 'bistroTable', 'highTable', 'woodBench'];
function tex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
const WOOD = '#c9a27c', BLACK = '#262626', WHITE = '#f4f4f2';

// 福貓（黃色老虎紋招財貓，戴面罩）— 貼紙／海報共用
function drawCat(x, cx, cy, s, opt = {}) {
  x.save(); x.translate(cx, cy); x.scale(s, s); x.lineJoin = 'round';
  const Y = opt.frost ? 'rgba(255,255,255,.85)' : '#ffc425', O = opt.frost ? 'rgba(255,255,255,.55)' : '#e8740c', L = opt.frost ? 'rgba(255,255,255,.95)' : '#3a2412';
  x.lineWidth = 6; x.strokeStyle = L;
  if (opt.body) { x.fillStyle = Y; x.beginPath(); x.ellipse(0, 120, 70, 85, 0, 0, 6.3); x.fill(); x.stroke();
    x.fillStyle = opt.frost ? 'rgba(255,255,255,.4)' : '#fff3d1'; x.beginPath(); x.ellipse(0, 132, 40, 55, 0, 0, 6.3); x.fill();
    x.fillStyle = Y; x.beginPath(); x.ellipse(78, 70, 22, 34, -.6, 0, 6.3); x.fill(); x.stroke(); // 揮手
    x.beginPath(); x.ellipse(-60, 150, 20, 30, .4, 0, 6.3); x.fill(); x.stroke();
    x.fillStyle = O; for (const sy of [90, 120, 150]) { x.fillRect(-68, sy, 22, 7); x.fillRect(46, sy, 22, 7); } }
  x.fillStyle = Y; x.beginPath(); x.moveTo(-62, -40); x.lineTo(-50, -100); x.lineTo(-12, -62); x.closePath(); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(62, -40); x.lineTo(50, -100); x.lineTo(12, -62); x.closePath(); x.fill(); x.stroke();
  x.beginPath(); x.ellipse(0, 0, 78, 66, 0, 0, 6.3); x.fill(); x.stroke();
  x.fillStyle = O; x.fillRect(-8, -64, 16, 26); x.fillRect(-30, -60, 10, 20); x.fillRect(20, -60, 10, 20);
  x.fillRect(-78, -6, 20, 7); x.fillRect(-78, 10, 18, 7); x.fillRect(58, -6, 20, 7); x.fillRect(60, 10, 18, 7);
  if (opt.mask !== false) { x.fillStyle = opt.frost ? 'rgba(255,255,255,.6)' : '#1e3a8a'; x.beginPath(); x.moveTo(-70, -8); x.quadraticCurveTo(0, -36, 70, -8); x.lineTo(62, 14); x.quadraticCurveTo(0, -2, -62, 14); x.closePath(); x.fill(); }
  x.fillStyle = '#fff'; x.beginPath(); x.arc(-28, 0, 9, 0, 6.3); x.arc(28, 0, 9, 0, 6.3); x.fill();
  x.fillStyle = L; x.beginPath(); x.arc(-28, 1, 4.5, 0, 6.3); x.arc(28, 1, 4.5, 0, 6.3); x.fill();
  x.fillStyle = '#ff8fa3'; x.beginPath(); x.arc(0, 18, 6, 0, 6.3); x.fill();
  x.strokeStyle = L; x.lineWidth = 4; x.beginPath(); x.arc(-10, 26, 10, 0, 3.1); x.arc(10, 26, 10, 0, 3.1); x.stroke();
  if (opt.hat) { x.fillStyle = opt.frost ? 'rgba(255,255,255,.75)' : '#ff6fa8'; x.beginPath(); x.moveTo(-22, -62); x.lineTo(6, -140); x.lineTo(30, -58); x.closePath(); x.fill(); x.lineWidth = 5; x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(6, -142, 9, 0, 6.3); x.fill(); }
  x.restore();
}

export function luckyProc(THREE, name, g, add, m) {
  const mesh = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  const cyl = (rt, rb, h, c, x, y, z, seg = 12) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof c === 'string' ? m(c) : c, x, y, z);
  const texMesh = (w, h, canvas, x, y, z, ry = 0) => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: .6 })); p.position.set(x, y, z); p.rotation.y = ry; g.add(p); return p; };
  if (name === 'longDesk') { // 兩人共用長桌：淺木桌面、黑色鐵腳
    add(2.2, .04, .75, WOOD, 0, .7, 0);
    for (const sx of [-1.04, 1.04]) { for (const sz of [-.31, .31]) add(.05, .68, .05, BLACK, sx, .34, sz); add(.05, .04, .7, BLACK, sx, .02, 0); add(.05, .04, .66, BLACK, sx, .66, 0); }
    add(2.04, .05, .03, BLACK, 0, .62, -.31);
  } else if (name === 'meshChair') { // 黑色網布辦公椅（有輪子）
    add(.56, .04, .07, '#1c1c1c', 0, .07, 0); add(.07, .04, .56, '#1c1c1c', 0, .07, 0);
    for (const [a, b] of [[-.27, 0], [.27, 0], [0, -.27], [0, .27]]) add(.06, .05, .06, '#111', a, .025, b);
    cyl(.03, .03, .32, '#555', 0, .25, 0, 8); add(.5, .08, .48, '#2a2a2a', 0, .47, .02);
    add(.46, .56, .04, '#3a3a3a', 0, .84, -.22); add(.4, .44, .02, '#555b60', 0, .84, -.195);
    for (const sx of [-.25, .25]) { add(.04, .2, .04, '#1c1c1c', sx, .6, -.02); add(.06, .03, .26, '#1c1c1c', sx, .7, 0); }
  } else if (name === 'pedestal') { // 白色三抽活動櫃
    add(.4, .58, .5, '#f5f5f5', 0, .31, 0); for (let i = 0; i < 3; i++) { add(.38, .008, .01, '#bdbdbd', 0, .2 + i * .18, .251); add(.12, .02, .02, '#9e9e9e', 0, .13 + i * .18, .26); }
    for (const sx of [-.15, .15]) for (const sz of [-.18, .18]) add(.04, .03, .04, '#555', sx, .015, sz);
  } else if (name === 'drawerTower') { // 塑膠抽屜櫃
    add(.38, .74, .42, '#eef1f4', 0, .37, 0); ['#cfe8ff', '#ffd6e0', '#d9f2d0', '#fff1c1'].forEach((c, i) => { add(.33, .15, .01, c, 0, .12 + i * .17, .212); add(.1, .025, .02, '#90a4ae', 0, .17 + i * .17, .22); });
  } else if (name === 'tissueBox') { add(.24, .1, .12, '#ffffff', 0, .05, 0); add(.245, .04, .125, '#7ec8ff', 0, .05, 0); add(.06, .05, .04, '#fafafa', 0, .12, 0, .3);
  } else if (name === 'fileTray') { for (let i = 0; i < 3; i++) { add(.32, .015, .25, '#2b2b2b', 0, .02 + i * .09, 0); add(.32, .04, .01, '#2b2b2b', 0, .04 + i * .09, .12); add(.3, .01, .2, ['#ffffff', '#fff9c4', '#e3f2fd'][i], 0, .035 + i * .09, -.01); }
    for (const sx of [-.15, .15]) add(.015, .22, .015, '#444', sx, .11, -.11);
  } else if (name === 'penCup') { cyl(.045, .04, .11, '#333', 0, .055, 0, 12); for (const [px, c, rz] of [[-.015, '#1e88e5', .15], [.012, '#e53935', -.1], [0, '#fdd835', 0]]) add(.012, .14, .012, c, px, .14, 0, rz);
  } else if (name === 'deskPhone') { add(.22, .06, .18, '#2b2b2b', 0, .03, 0); add(.07, .045, .2, '#1f1f1f', -.08, .085, 0); add(.1, .012, .1, '#78909c', .04, .066, .02); add(.06, .02, .03, '#80deea', .04, .07, -.06);
  } else if (name === 'gridPanel') { // 白色格柵隔板（桌子中間）
    const c = '#fbfbfb';
    add(1.2, .04, .035, c, 0, 1.48, 0); add(1.2, .04, .035, c, 0, .02, 0); add(.04, 1.5, .035, c, -.58, .75, 0); add(.04, 1.5, .035, c, .58, .75, 0);
    for (let i = 1; i < 6; i++) add(.012, 1.46, .015, c, -.58 + i * .193, .75, 0);
    for (let j = 1; j < 8; j++) add(1.16, .012, .015, c, 0, .02 + j * .182, 0);
    for (const sx of [-.5, .5]) add(.06, .03, .28, '#e0e0e0', sx, .015, 0);
  } else if (name === 'tallCabinet') { add(.9, 2.0, .45, '#f5f5f3', 0, 1.0, 0); add(.008, 1.94, .01, '#c8c8c8', 0, 1.0, .226); for (const sx of [-.05, .05]) add(.025, .22, .025, '#9e9e9e', sx, 1.05, .24);
    add(.88, .008, .01, '#d0d0d0', 0, .4, .226);
  } else if (name === 'woodWardrobe') { // 儲藏室：整面淺木紋高櫃
    add(1.0, 2.4, .55, '#d9b88c', 0, 1.2, 0); add(.008, 2.34, .01, '#a9875e', 0, 1.2, .276); add(.98, .008, .01, '#a9875e', 0, 1.05, .276);
    for (let i = 0; i < 6; i++) add(.006, 2.2, .005, '#c7a374', -.42 + i * .17, 1.2, .277);
    for (const sx of [-.04, .04]) add(.02, .14, .02, '#d0d0d0', sx, 1.2, .29);
  } else if (name === 'woodCounter' || name === 'woodSink') { // 茶水間：木門下櫃＋白色檯面
    add(.9, .84, .6, '#b5845a', 0, .44, 0); add(.92, .04, .62, '#f4f3ef', 0, .88, 0); add(.88, .06, .02, '#4e342e', 0, .03, .29);
    add(.008, .7, .01, '#8d6e4c', 0, .46, .301); for (const sx of [-.08, .08]) add(.02, .12, .02, '#cfcfcf', sx, .7, .31);
    if (name === 'woodSink') { add(.44, .02, .34, '#b0bec5', 0, .9, 0); add(.38, .03, .28, '#78909c', 0, .895, 0); cyl(.015, .015, .24, '#cfd8dc', 0, 1.02, -.2, 8); add(.02, .02, .16, '#cfd8dc', 0, 1.13, -.13); }
  } else if (name === 'kitchenIsland') { // 中島（電磁爐）
    add(1.4, .84, .7, '#b5845a', 0, .44, 0); add(1.44, .04, .74, '#f4f3ef', 0, .88, 0); add(1.36, .06, .02, '#4e342e', 0, .03, .34);
    add(.55, .012, .4, '#111', .35, .906, 0); for (const sx of [.23, .47]) cyl(.09, .09, .004, '#444', sx, .914, 0, 18);
  } else if (name === 'waterDispenser') { // 黑色冰熱飲水機
    add(.32, 1.0, .33, '#1f1f1f', 0, .5, 0); add(.26, .2, .02, '#333', 0, .76, .17); add(.05, .05, .05, '#e53935', -.06, .76, .19); add(.05, .05, .05, '#1e88e5', .06, .76, .19);
    add(.24, .03, .1, '#888', 0, .55, .17); cyl(.12, .12, .05, '#9e9e9e', 0, 1.03, 0, 14);
  } else if (name === 'wireRack') { // 白色鐵架（擴大機、路由器、紙箱）
    for (const sx of [-.43, .43]) for (const sz of [-.2, .2]) cyl(.012, .012, 1.6, '#f0f0f0', sx, .8, sz, 6);
    for (const y of [.06, .56, 1.06, 1.56]) { add(.9, .015, .44, '#e9e9e9', 0, y, 0); for (let i = 0; i < 5; i++) add(.88, .01, .008, '#d5d5d5', 0, y + .01, -.18 + i * .09); }
    add(.4, .12, .3, '#1c1c1c', -.1, .64, 0); add(.08, .02, .01, '#4fc3f7', .02, .66, .151); add(.25, .04, .15, '#fafafa', .12, 1.1, 0);
    for (const sx of [.04, .12, .2]) add(.012, .14, .012, '#333', sx, 1.19, -.06); add(.35, .3, .3, '#c49a6c', .15, .22, 0);
  } else if (name === 'dishRack') { // 碗盤架
    add(.45, .03, .3, '#9e9e9e', 0, .015, 0); for (const sx of [-.2, .2]) add(.01, .18, .28, '#bdbdbd', sx, .1, 0);
    for (let i = 0; i < 4; i++) { const pl = cyl(.1, .1, .012, '#ffffff', -.12 + i * .06, .12, 0, 16); pl.rotation.z = Math.PI / 2; }
    const bw = cyl(.08, .05, .06, '#ffe0b2', .15, .07, 0, 14); bw.rotation.x = .3;
  } else if (name === 'standFan') { // 古銅色立扇
    const br = new THREE.MeshStandardMaterial({ color: '#a3713f', roughness: .35, metalness: .55 });
    cyl(.2, .22, .04, br, 0, .02, 0, 18); cyl(.022, .022, 1.0, br, 0, .52, 0, 8); cyl(.09, .09, .16, br, 0, 1.08, -.06, 12).rotation.x = Math.PI / 2;
    const ring = mesh(new THREE.TorusGeometry(.22, .012, 6, 24), br, 0, 1.08, .06);
    for (let i = 0; i < 3; i++) add(.07, .18, .01, '#d7b98d', Math.sin(i * 2.09) * .09, 1.08 + Math.cos(i * 2.09) * .09, .05, i * 2.09);
    for (let i = 0; i < 4; i++) { const sp = add(.008, .44, .008, '#a3713f', 0, 1.08, .065, i * .785); }
    void ring;
  } else if (name === 'luckyCatStatue') { // 亮面黃色福貓雕像（比讚、咧嘴笑）
    const gl = c => new THREE.MeshStandardMaterial({ color: c, roughness: .2, metalness: .12 });
    const Y = gl('#ffc21a'), O = gl('#e0780a'), Kc = gl('#2b2118'), Wc = gl('#fff3cf');
    cyl(.3, .32, .06, gl('#6d4c41'), 0, .03, 0, 20);
    const body = mesh(new THREE.SphereGeometry(.3, 16, 12), Y, 0, .44, 0); body.scale.set(1, 1.15, .9);
    const belly = mesh(new THREE.SphereGeometry(.2, 14, 10), Wc, 0, .42, .12); belly.scale.set(1, 1.2, .6);
    const head = mesh(new THREE.SphereGeometry(.27, 18, 14), Y, 0, .98, 0); head.scale.set(1.15, 1, 1);
    for (const sx of [-1, 1]) { const ear = mesh(new THREE.ConeGeometry(.09, .17, 8), Y, sx * .19, 1.2, 0); ear.rotation.z = -sx * .25;
      const ie = mesh(new THREE.ConeGeometry(.05, .1, 8), gl('#ff9fb0'), sx * .19, 1.19, .05); ie.rotation.z = -sx * .25;
      mesh(new THREE.SphereGeometry(.035, 10, 8), Kc, sx * .1, 1.02, .245); mesh(new THREE.SphereGeometry(.04, 10, 8), gl('#ff9fb0'), sx * .19, .93, .2).scale.set(1, .6, .4);
      const ft = mesh(new THREE.SphereGeometry(.1, 12, 8), Y, sx * .13, .1, .1); ft.scale.set(1, .6, 1.3); }
    add(.2, .055, .03, '#2b2118', 0, .9, .25); add(.16, .02, .03, '#ffffff', 0, .92, .262); // 咧嘴
    for (const sx of [-.12, 0, .12]) add(.04, .1, .03, '#e0780a', sx, 1.18, .02);
    for (const sy of [.3, .45, .6]) { add(.07, .03, .2, '#e0780a', -.29, sy, 0); add(.07, .03, .2, '#e0780a', .29, sy, 0); }
    add(.11, .32, .11, '#ffc21a', .33, .66, .06, -.35); mesh(new THREE.SphereGeometry(.08, 10, 8), Y, .38, .84, .1); add(.045, .12, .045, '#ffc21a', .38, .95, .1); // 比讚
    add(.1, .28, .1, '#ffc21a', -.31, .48, .04, .25);
    const tail = cyl(.04, .05, .34, O, -.05, .3, -.3, 8); tail.rotation.x = -.9;
  } else if (name === 'geode') { // 紫晶洞（木座）
    add(.56, .3, .46, '#a1774f', 0, .15, 0); add(.6, .03, .5, '#8b6542', 0, .31, 0);
    const outer = new THREE.MeshStandardMaterial({ color: '#5b4a40', roughness: .95, side: THREE.DoubleSide });
    const inner = new THREE.MeshStandardMaterial({ color: '#6b3fa6', roughness: .55, side: THREE.BackSide });
    const open = 1.9, ps = Math.PI / 2 + open / 2, pl = Math.PI * 2 - open;
    const sh = mesh(new THREE.SphereGeometry(.31, 14, 12, ps, pl), outer, 0, .92, 0); sh.scale.set(1, 1.85, .82);
    const li = mesh(new THREE.SphereGeometry(.29, 14, 12, ps, pl), inner, 0, .92, 0); li.scale.set(1, 1.85, .82);
    const cm = ['#9b6bd6', '#c9a6f0', '#7d4cc0'].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .25, metalness: .1 }));
    const Yv = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 18; i++) { const th = .35 + (i % 6) * .42, ph = ps + .25 + ((i * 7) % 11) / 11 * (pl - .5);
      const px = -.26 * Math.cos(ph) * Math.sin(th), py = .26 * Math.cos(th) * 1.85, pz = .26 * Math.sin(ph) * Math.sin(th) * .82;
      const c = mesh(new THREE.ConeGeometry(.035, .11, 5), cm[i % 3], px, .92 + py, pz);
      c.quaternion.setFromUnitVectors(Yv, new THREE.Vector3(-px, -py * .3, -pz).normalize()); }
  } else if (name === 'bistroTable') { cyl(.32, .32, .03, BLACK, 0, .72, 0, 20); cyl(.025, .025, .7, BLACK, 0, .36, 0, 8); cyl(.2, .22, .03, BLACK, 0, .015, 0, 16);
  } else if (name === 'highTable') { cyl(.34, .34, .035, '#f2f2f2', 0, 1.04, 0, 20); cyl(.03, .03, 1.02, BLACK, 0, .52, 0, 8); cyl(.24, .26, .03, BLACK, 0, .015, 0, 16);
  } else if (name === 'bistroChair') { // 黑色 X 背咖啡椅（木椅面）
    for (const sx of [-.17, .17]) for (const sz of [-.17, .17]) add(.03, .45, .03, BLACK, sx, .225, sz);
    add(.42, .04, .42, '#b8875a', 0, .46, 0); for (const sx of [-.18, .18]) add(.03, .48, .03, BLACK, sx, .7, -.19);
    add(.4, .04, .03, BLACK, 0, .93, -.19); add(.03, .44, .02, BLACK, 0, .7, -.19, .72); add(.03, .44, .02, BLACK, 0, .7, -.19, -.72);
  } else if (name === 'tolixChair' || name === 'metalChair') { // 白色／黑色鐵椅
    const c = name === 'tolixChair' ? '#f7f7f7' : '#242424';
    for (const sx of [-.17, .17]) for (const sz of [-.17, .17]) add(.03, .46, .03, c, sx * 1.08, .23, sz * 1.08);
    add(.4, .03, .4, c, 0, .46, 0); const bk = new THREE.Mesh(new THREE.BoxGeometry(.38, .32, .03), m(c)); bk.position.set(0, .7, -.2); bk.rotation.x = -.12; bk.castShadow = true; g.add(bk);
    for (const sx of [-.17, .17]) add(.025, .3, .025, c, sx, .6, -.19);
  } else if (name === 'ovalTable') { // 白色橢圓會議桌
    const top = cyl(.4, .4, .04, '#f7f7f5', 0, .72, 0, 28); top.scale.x = 1.625;
    for (const sx of [-.35, .35]) { cyl(.05, .05, .7, '#f0f0f0', sx, .35, 0, 10); cyl(.18, .2, .025, '#e8e8e8', sx, .013, 0, 16); }
  } else if (name === 'luckyReception') { // 接待櫃台：白色底座、木頭／橘色飾條、玻璃檯面
    add(1.6, .98, .55, '#ffffff', 0, .49, 0); add(1.66, .05, .62, '#c8945e', 0, 1.0, 0); add(1.6, .08, .02, '#ff8a3d', 0, .86, .28); add(1.6, .04, .02, '#c8945e', 0, .74, .28);
    const gm = new THREE.Mesh(new THREE.BoxGeometry(1.58, .02, .5), new THREE.MeshStandardMaterial({ color: '#d9f3ff', transparent: true, opacity: .45, roughness: .1 })); gm.position.set(0, 1.07, .02); g.add(gm);
    for (const sx of [-.7, .7]) add(.03, .05, .03, '#cfd8dc', sx, 1.045, .2);
    add(1.4, .04, .35, '#c8945e', 0, .72, -.12);
  } else if (name === 'foldScreen') { // 白色百葉折疊屏風
    for (let i = 0; i < 3; i++) { const pg = new THREE.Group(); pg.position.set(-.42 + i * .42, 0, 0); pg.rotation.y = i === 1 ? 0 : (i === 0 ? .45 : -.45);
      const bx = (w, h, d, c, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m(c)); b.position.set(x, y, z); b.castShadow = true; pg.add(b); };
      bx(.04, 1.62, .04, '#fafafa', -.2, .81, 0); bx(.04, 1.62, .04, '#fafafa', .2, .81, 0); bx(.44, .05, .04, '#fafafa', 0, 1.6, 0); bx(.44, .05, .04, '#fafafa', 0, .06, 0);
      for (let j = 0; j < 14; j++) bx(.38, .012, .03, j % 2 ? '#f2f2f2' : '#e6e6e6', 0, .16 + j * .1, 0);
      g.add(pg); }
  } else if (name === 'woodBench') { add(1.6, .05, .42, '#c08a57', 0, .44, 0); for (const sx of [-.7, .7]) add(.06, .42, .36, '#9a6b40', sx, .21, 0); add(1.4, .04, .05, '#9a6b40', 0, .12, 0);
  } else if (name === 'wallAC') { // 壁掛冷氣
    add(.86, .28, .2, '#fbfbfb', 0, 0, .07); add(.72, .03, .02, '#8d8d8d', 0, -.1, .175); add(.84, .02, .01, '#e0e0e0', 0, .06, .172); add(.04, .015, .01, '#66bb6a', .34, .09, .175);
  } else if (name === 'foodFrame') { // 美食照片相框
    add(.62, .47, .03, '#5d4037', 0, 0, 0);
    texMesh(.56, .41, tex(168, 124, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffe0b2'); gr.addColorStop(1, '#ffab91'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
      x.fillStyle = '#f5f5f5'; x.beginPath(); x.ellipse(84, 78, 62, 30, 0, 0, 6.3); x.fill(); x.fillStyle = '#c0392b'; x.beginPath(); x.ellipse(84, 72, 50, 20, 0, 0, 6.3); x.fill();
      x.strokeStyle = '#ffe082'; x.lineWidth = 4; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(44 + i * 14, 64); x.quadraticCurveTo(52 + i * 14, 80, 46 + i * 14, 86); x.stroke(); }
      x.fillStyle = '#fff'; x.beginPath(); x.ellipse(106, 66, 13, 9, 0, 0, 6.3); x.fill(); x.fillStyle = '#ffb300'; x.beginPath(); x.arc(106, 66, 5, 0, 6.3); x.fill();
      x.fillStyle = '#7cb342'; x.fillRect(60, 58, 14, 6); x.fillStyle = '#5d4037'; x.font = 'bold 18px sans-serif'; x.textAlign = 'center'; x.fillText('今日推薦', 84, 24); }), 0, 0, .017);
  } else if (name === 'potShelf') { // 黑色支架木層板＋銅鍋、瓶罐
    add(.9, .035, .24, '#a8774a', 0, -.1, .09); for (const sx of [-.36, .36]) { add(.03, .18, .03, '#222', sx, -.2, -.015); add(.03, .03, .2, '#222', sx, -.13, .08); }
    const cu = new THREE.MeshStandardMaterial({ color: '#c77b3f', roughness: .3, metalness: .6 });
    cyl(.08, .07, .09, cu, -.25, -.035, .1, 14); cyl(.065, .06, .075, cu, -.08, -.04, .1, 14);
    for (const [bx, c, h] of [[.12, '#2e7d32', .2], [.2, '#6d4c41', .17], [.28, '#b3e5fc', .15]]) cyl(.028, .03, h, c, bx, -.08 + h / 2, .09, 10);
  }
}

// ---------- 建立外殼 ----------
export function buildLuckyShell(api) {
  const { THREE, root, colliders, wallMeshes, ceilings, LOW, mergeGeometries } = api;
  const geoBy = new Map(); const addGeo = (key, geo) => { if (!geoBy.has(key)) geoBy.set(key, []); geoBy.get(key).push(geo); };
  const boxGeo = (w, h, d, x, y, z, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); return g; };
  const cylGeo = (r1, r2, h, x, y, z, seg = 10) => { const g = new THREE.CylinderGeometry(r1, r2, h, seg); g.translate(x, y, z); return g; };
  const col = (x1, x2, z1, z2, y2, extra = {}) => colliders.push({ x1, x2, z1, z2, y1: 0, y2, ...extra });
  const glassGeos = [];
  const mkTex = (canvas, rep) => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } t.anisotropy = 4; return t; };
  const addMesh = (geo, mat, kind, list = wallMeshes) => { const me = new THREE.Mesh(geo, mat); me.receiveShadow = !LOW; me.userData.kind = kind; root.add(me); if (list) list.push(me); return me; };
  const C_OUT = '#ece6dc', C_IN = '#f6f3ee';
  // 一段牆的碰撞：正交 → 一個盒子（可掛飾），斜的 → 一串小方塊
  function wallCols(ax, az, bx, bz, th, extra) {
    if (Math.abs(az - bz) < 1e-4) { col(Math.min(ax, bx), Math.max(ax, bx), az - th / 2, az + th / 2, WH, extra); return; }
    if (Math.abs(ax - bx) < 1e-4) { col(ax - th / 2, ax + th / 2, Math.min(az, bz), Math.max(az, bz), WH, extra); return; }
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(len / .14)), hw = th / 2 + .04;
    for (let k = 0; k <= n; k++) { const px = ax + (bx - ax) * k / n, pz = az + (bz - az) * k / n; col(px - hw, px + hw, pz - hw, pz + hw, WH, { ...extra, wall: false }); }
  }
  const segs = (len, gaps) => { const out = []; let s = 0; for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) { if (g0 > s) out.push([s, g0]); s = Math.max(s, g1); } if (s < len) out.push([s, len]); return out; };
  const faces = [];
  for (const [[ax, ay], [bx, by], kind, o = {}] of WALLS) {
    const lenP = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / lenP, uy = (by - ay) / lenP;
    const at = d => [X(ax + ux * d), Z(ay + uy * d)];
    const glass = kind === 'glassB' || kind === 'glassF';
    const th = kind === 'out' ? TO : kind === 'grass' ? .3 : glass ? .06 : TI;
    const ry = Math.atan2(-(Z(by) - Z(ay)), X(bx) - X(ax));
    for (const [s0, s1] of segs(lenP, o.gaps || [])) {
      const ext0 = s0 === 0 && !glass ? th / 2 : 0, ext1 = s1 === lenP && !glass ? th / 2 : 0;
      const [x0, z0] = at(s0), [x1, z1] = at(s1);
      const len = Math.hypot(x1 - x0, z1 - z0); if (len < .02) continue;
      const ex0 = x0 - Math.cos(ry) * ext0, ez0 = z0 + Math.sin(ry) * ext0, ex1 = x1 + Math.cos(ry) * ext1, ez1 = z1 - Math.sin(ry) * ext1;
      const cx = (ex0 + ex1) / 2, cz = (ez0 + ez1) / 2, L = len + ext0 + ext1;
      if (!glass) { addGeo(kind === 'out' ? C_OUT : C_IN, boxGeo(L, WH, th, cx, WH / 2, cz, ry)); wallCols(ex0, ez0, ex1, ez1, th, { wall: true }); }
      else {
        const fc = kind === 'glassB' ? '#1f1f1f' : '#9aa7b0';
        glassGeos.push(boxGeo(len, 2.34, .04, cx, 1.2, cz, ry));
        addGeo(fc, boxGeo(len, .06, .07, cx, .03, cz, ry)); addGeo(fc, boxGeo(len, .06, .07, cx, 2.4, cz, ry));
        addGeo(C_IN, boxGeo(len, WH - 2.43, .1, cx, (WH + 2.43) / 2, cz, ry));
        const nm = Math.max(1, Math.round(len / 1.15));
        for (let k = 0; k <= nm; k++) { const t = k / nm, px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t; addGeo(fc, boxGeo(.05, 2.4, .07, px, 1.2, pz, ry)); }
        if (kind === 'glassF') for (const yb of [.95, 1.25, 1.55]) addGeo('#ffffff', boxGeo(len, .12, .05, cx, yb, cz, ry));
        wallCols(x0, z0, x1, z1, .1, { glass: true });
      }
    }
    // 門楣
    for (const [g0, g1] of o.gaps || []) { const [x0, z0] = at(g0), [x1, z1] = at(g1); const len = Math.hypot(x1 - x0, z1 - z0);
      addGeo(glass ? '#1f1f1f' : (kind === 'out' ? C_OUT : C_IN), boxGeo(len, WH - 2.25, glass ? .08 : th, (x0 + x1) / 2, (WH + 2.25) / 2, (z0 + z1) / 2, ry)); }
    if (kind === 'brick' || kind === 'grass') faces.push({ kind, a: [X(ax), Z(ay)], b: [X(bx), Z(by)], th, s: kind === 'brick' ? 1 : -1 });
  }
  // 弧形外牆：下半段牆＋玻璃帶＋上方牆
  { const pts = arcPts().map(([a, b]) => [X(a), Z(b)]);
    for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(-(bz - az), bx - ax), cx = (ax + bx) / 2, cz = (az + bz) / 2;
      addGeo(C_OUT, boxGeo(len + .12, .8, TO, cx, .4, cz, ry)); addGeo(C_OUT, boxGeo(len + .12, WH - 2.3, TO, cx, (WH + 2.3) / 2, cz, ry));
      glassGeos.push(boxGeo(len + .02, 1.5, .05, cx, 1.55, cz, ry)); addGeo('#ffffff', boxGeo(.07, 1.5, .1, ax, 1.55, az));
      wallCols(ax, az, bx, bz, TO, {}); } }
  // 柱子（灰色結構柱）
  for (const [x1p, y1p, x2p, y2p] of COLUMNS) { const x1 = X(x1p), x2 = X(x2p), z1 = Z(y1p), z2 = Z(y2p);
    addGeo('#b9b9b6', boxGeo(x2 - x1, WH, z2 - z1, (x1 + x2) / 2, WH / 2, (z1 + z2) / 2)); col(x1, x2, z1, z2, WH, { wall: true }); }
  // 開放辦公區：淺木方柱、黑色圓柱管
  for (const [px, py] of [[393, 173.75], [207.5, 229.75], [400.5, 229.75]]) { const x = X(px), z = Z(py);
    addGeo('#dcc29b', boxGeo(.2, WH, .2, x, WH / 2, z)); col(x - .1, x + .1, z - .1, z + .1, WH); }
  { const x = X(284), z = Z(173.75); addGeo('#1e1e1e', cylGeo(.12, .12, WH, x, WH / 2, z, 14)); col(x - .12, x + .12, z - .12, z + .12, WH); }
  // 電梯門（電梯廳北牆）
  for (const px of [312, 354]) { const x = X(px), z = Z(322) - TO / 2 - .02;
    addGeo('#b0bac2', boxGeo(1.05, 2.15, .04, x, 1.075, z)); addGeo('#6b7780', boxGeo(.02, 2.15, .05, x, 1.075, z - .005)); addGeo('#37474f', boxGeo(.36, .14, .03, x, 2.35, z));
    addGeo('#cfd8dc', boxGeo(.08, .16, .03, x + .7, 1.15, z)); }

  // 合併的牆
  for (const [c, geos] of geoBy) { const me = addMesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ color: c, roughness: .9 }), 'wall'); me.castShadow = !LOW; }
  if (glassGeos.length) addMesh(mergeGeometries(glassGeos), new THREE.MeshStandardMaterial({ color: '#cfeff7', transparent: true, opacity: .24, roughness: .08, depthWrite: false }), 'glass');

  // ---- 地板（多邊形，依 CAD 地磚分區）----
  const tileTex = mkTex(tex(256, 256, (x, w, h) => { const greys = ['#cfcdc8', '#c6c4bf', '#d6d4cf', '#c2c0ba'];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = greys[(i * 3 + j * 5) % 4]; x.fillRect(i * 64, j * 64, 64, 64);
      for (let k = 0; k < 26; k++) { x.fillStyle = `rgba(${k % 2 ? 255 : 90},${k % 2 ? 255 : 90},${k % 2 ? 255 : 90},.08)`; x.fillRect(i * 64 + (k * 37) % 60, j * 64 + (k * 23) % 60, 3, 2); } }
    x.strokeStyle = '#a9a7a1'; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, h); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke(); } }), true);
  tileTex.repeat.set(1 / 2.4, 1 / 2.4);
  const plankTex = (cols) => { const t = mkTex(tex(256, 256, (x, w, h) => { for (let r = 0; r < 8; r++) { let px = -((r * 53) % 120);
      while (px < w) { const L = 70 + ((r * 31 + px) % 60); x.fillStyle = cols[(r + Math.abs(px)) % cols.length]; x.fillRect(px, r * 32, L, 32); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(px, r * 32, 2, 32); px += L; }
      x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(0, r * 32, w, 2); } }), true); t.repeat.set(1 / 2.4, 1 / 2.4); t.rotation = 62 * Math.PI / 180; return t; };
  const floorMat = (map, off) => new THREE.MeshStandardMaterial({ map, roughness: .85, polygonOffset: off > 0, polygonOffsetFactor: -off, polygonOffsetUnits: -off * 2 });
  const shapeGeo = (pts, y) => { const sh = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(X(a), -Z(b)))); const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g; };
  addMesh(shapeGeo(SHELL, 0), floorMat(tileTex, 0), 'floor');
  addMesh(shapeGeo(LIFT, 0), new THREE.MeshStandardMaterial({ color: '#bfc1c0', roughness: .7 }), 'floor');
  addMesh(shapeGeo(CENT, .003), floorMat(plankTex(['#9b8472', '#8f7867', '#a58e7b', '#86705f']), 1), 'floor');
  addMesh(shapeGeo(BOSS, .006), floorMat(plankTex(['#eab9c7', '#dda3b5', '#f2cbd6', '#e3adbf']), 2), 'floor');
  const ground = addMesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#c9d3d8' }), 'floor'); ground.rotation.x = -Math.PI / 2; ground.position.y = -.03;
  // 天花板
  { const sh = new THREE.Shape([...SHELL, ...[]].map(([a, b]) => new THREE.Vector2(X(a), Z(b)))); const g = new THREE.ShapeGeometry(sh); g.rotateX(Math.PI / 2); g.translate(0, WH, 0);
    const cm = addMesh(g, new THREE.MeshStandardMaterial({ color: '#fbfaf7', roughness: .95, side: THREE.DoubleSide }), 'ceiling'); ceilings.push(cm);
    const lg = new THREE.ShapeGeometry(new THREE.Shape(LIFT.map(([a, b]) => new THREE.Vector2(X(a), Z(b))))); lg.rotateX(Math.PI / 2); lg.translate(0, WH, 0);
    const lm = addMesh(lg, cm.material, 'ceiling'); ceilings.push(lm); }

  // ---- 牆面：白磚＋生日貼紙、LUCKY CAT 草皮牆 ----
  for (const f of faces) {
    const [ax, az] = f.a, [bx, bz] = f.b, len = Math.hypot(bx - ax, bz - az);
    const nx = f.s * (bz - az) / len, nz = -f.s * (bx - ax) / len; // (dy,-dx) 方向
    const off = f.th / 2 + .012, cx = (ax + bx) / 2 + nx * off, cz = (az + bz) / 2 + nz * off;
    let canvas;
    if (f.kind === 'brick') canvas = tex(LOW ? 512 : 768, LOW ? 400 : 600, (x, w, h) => {
      x.fillStyle = '#f7f5f0'; x.fillRect(0, 0, w, h); const bh = h / 30, bw = bh * 2.6;
      for (let r = 0; r < 30; r++) for (let c = -1; c < w / bw + 1; c++) { x.fillStyle = (r * 7 + c * 3) % 5 ? '#ffffff' : '#f0eee8'; x.fillRect(c * bw + (r % 2) * bw / 2 + 2, r * bh + 2, bw - 4, bh - 4); }
      const wh = h * (.9 / WH); for (let i = 0; i < 14; i++) { x.fillStyle = i % 2 ? '#4e342e' : '#5d4037'; x.fillRect(i * w / 14, h - wh, w / 14 - 2, wh); }
      x.fillStyle = '#3e2723'; x.fillRect(0, h - wh - 6, w, 6);
      const cols = ['#ff5d8f', '#ffb000', '#4caf50', '#29b6f6', '#ab47bc', '#ff7043'];
      x.font = `bold ${Math.round(h * .085)}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      const word = 'Happy Birthday'; let tx = w * .5 - x.measureText(word).width / 2;
      for (let i = 0; i < word.length; i++) { const ch = word[i], cw = x.measureText(ch).width; x.fillStyle = cols[i % cols.length]; x.save(); x.translate(tx + cw / 2, h * .2 + Math.sin(i) * 6); x.rotate(Math.sin(i * 1.7) * .12); x.fillText(ch, 0, 0); x.restore(); tx += cw; }
      for (let i = 0; i < 12; i++) { const px = w * .12 + i * w * .065; x.fillStyle = cols[i % cols.length]; x.beginPath(); x.moveTo(px, h * .07); x.lineTo(px + w * .05, h * .07); x.lineTo(px + w * .025, h * .12); x.fill(); }
      x.strokeStyle = '#8d6e63'; x.lineWidth = 2; x.beginPath(); x.moveTo(w * .12, h * .07); x.lineTo(w * .9, h * .07); x.stroke();
      drawCat(x, w * .5, h * .5, h / 620, { body: true, hat: true });
      for (let i = 0; i < 6; i++) { x.fillStyle = cols[(i + 2) % 6]; x.beginPath(); x.ellipse(w * (.18 + (i % 3) * .05), h * (.36 + Math.floor(i / 3) * .14), 18, 23, 0, 0, 6.3); x.fill(); x.strokeStyle = '#999'; x.beginPath(); x.moveTo(w * (.18 + (i % 3) * .05), h * (.36 + Math.floor(i / 3) * .14) + 23); x.lineTo(w * .2, h * .62); x.stroke(); }
    });
    else canvas = tex(LOW ? 640 : 1024, LOW ? 428 : 683, (x, w, h) => {
      x.fillStyle = '#4caf50'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < (LOW ? 2600 : 6000); i++) { const px = (i * 97.13) % w, py = (i * 57.77 + (i % 13) * 31) % h; x.strokeStyle = ['#66bb6a', '#388e3c', '#7cc576', '#2e7d32', '#81c784'][i % 5]; x.lineWidth = 2; x.beginPath(); x.moveTo(px, py); x.lineTo(px + ((i % 7) - 3), py - 7 - (i % 5)); x.stroke(); }
      x.font = `900 ${Math.round(h * .19)}px "Arial Black", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let d = 9; d > 0; d--) { x.fillStyle = '#b0bec5'; x.fillText('LUCKY CAT', w / 2 + d * .9, h * .36 + d * .9); }
      x.fillStyle = '#ffffff'; x.fillText('LUCKY CAT', w / 2, h * .36);
      const fish = (cx, cy, s, c, flip) => { x.save(); x.translate(cx, cy); x.scale(flip ? -s : s, s); x.fillStyle = c; x.beginPath(); x.ellipse(0, 0, 40, 20, 0, 0, 6.3); x.fill(); x.beginPath(); x.moveTo(34, 0); x.lineTo(62, -20); x.lineTo(62, 20); x.closePath(); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(-20, -4, 6, 0, 6.3); x.fill(); x.fillStyle = '#222'; x.beginPath(); x.arc(-21, -4, 3, 0, 6.3); x.fill(); x.restore(); };
      fish(w * .14, h * .16, 1.2, '#ff8a3d', false); fish(w * .86, h * .17, 1.1, '#29b6f6', true); fish(w * .1, h * .66, 1.0, '#29b6f6', false); fish(w * .9, h * .62, 1.25, '#ff8a3d', true); fish(w * .55, h * .14, .8, '#ff8a3d', true);
      const tool = (cx, cy, rot, c) => { x.save(); x.translate(cx, cy); x.rotate(rot); x.fillStyle = '#8d6e63'; x.fillRect(-5, -60, 10, 70); x.fillStyle = c; x.beginPath(); x.moveTo(-18, 10); x.lineTo(18, 10); x.lineTo(14, 44); x.lineTo(-14, 44); x.closePath(); x.fill(); x.restore(); };
      tool(w * .3, h * .66, -.4, '#ff8a3d'); tool(w * .38, h * .7, .3, '#29b6f6'); tool(w * .64, h * .68, -.25, '#29b6f6'); tool(w * .72, h * .64, .45, '#ff8a3d');
      x.save(); x.translate(w * .5, h * .7); x.rotate(-.5); x.fillStyle = '#ff7f2a'; x.beginPath(); x.ellipse(0, 30, 44, 50, 0, 0, 6.3); x.fill(); x.beginPath(); x.ellipse(0, -20, 34, 36, 0, 0, 6.3); x.fill();
      x.fillStyle = '#3e2723'; x.beginPath(); x.arc(0, 8, 13, 0, 6.3); x.fill(); x.fillStyle = '#6d4c41'; x.fillRect(-6, -150, 12, 120); x.fillStyle = '#4e342e'; x.fillRect(-10, -170, 20, 26); x.restore();
    });
    const t = mkTex(canvas); const pl = new THREE.Mesh(new THREE.PlaneGeometry(len, WH), new THREE.MeshStandardMaterial({ map: t, roughness: .95 }));
    pl.position.set(cx, WH / 2, cz); pl.rotation.y = Math.atan2(nx, nz); pl.userData.kind = 'wall'; root.add(pl); wallMeshes.push(pl);
  }
  // ---- 玻璃上的貼紙：入口霧面派對貓＋OPEN 貓牌、玻璃隔間大福貓 ----
  const decal = (canvas, w, h, x, y, z, ry, transparent = true) => { const t = mkTex(canvas); const mat = new THREE.MeshBasicMaterial({ map: t, transparent, side: THREE.DoubleSide, depthWrite: false });
    const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); me.position.set(x, y, z); me.rotation.y = ry; me.renderOrder = 2; root.add(me); return me; };
  decal(tex(256, 256, (x) => drawCat(x, 128, 140, .9, { frost: true, hat: true, mask: false })), .95, .95, X(326.5), 1.25, Z(297) - .04, 0);
  decal(tex(200, 140, (x, w, h) => { x.fillStyle = '#fff'; x.beginPath(); x.roundRect(6, 30, w - 12, h - 36, 18); x.fill(); x.strokeStyle = '#3a2412'; x.lineWidth = 5; x.stroke();
    x.fillStyle = '#e8740c'; x.font = 'bold 44px sans-serif'; x.textAlign = 'center'; x.fillText('OPEN', w / 2, 102); drawCat(x, 40, 44, .28, { mask: false });
    x.strokeStyle = '#666'; x.lineWidth = 3; x.beginPath(); x.moveTo(60, 30); x.lineTo(100, 4); x.lineTo(140, 30); x.stroke(); }), .6, .42, X(305), 2.0, Z(297) - .06, Math.PI);
  decal(tex(400, 520, (x) => drawCat(x, 200, 220, 1.2, { body: true })), 1.5, 1.95, X(335) - .035, 1.2, Z(283), -Math.PI / 2);

  // ---- 窗戶（白色格子窗框＋城市景色＋灰藍色綁起來的窗簾）----
  const city = mkTex(tex(512, 256, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#a9dcff'); gr.addColorStop(1, '#e8f6ff'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,.9)'; for (const [cx, cy] of [[80, 50], [300, 36], [440, 70]]) { x.beginPath(); x.ellipse(cx, cy, 40, 14, 0, 0, 6.3); x.ellipse(cx + 26, cy - 8, 26, 14, 0, 0, 6.3); x.fill(); }
    const bc = ['#b0bec5', '#cfd8dc', '#90a4ae', '#d7ccc8', '#bcaaa4', '#e0e0e0']; let px = 0;
    while (px < w) { const bw = 34 + (px * 7) % 40, bh = 70 + (px * 13) % 120; x.fillStyle = bc[(px / 7 | 0) % bc.length]; x.fillRect(px, h - bh, bw, bh);
      x.fillStyle = 'rgba(255,255,255,.55)'; for (let yy = h - bh + 8; yy < h - 6; yy += 14) for (let xx = px + 5; xx < px + bw - 6; xx += 10) x.fillRect(xx, yy, 5, 7); px += bw + 3; } }));
  const winFrame = [], panes = [], curt = new Map();
  for (const wd of WINDOWS) {
    const { x, z, ry, w } = wd;
    const p = new THREE.PlaneGeometry(w, 1.5); p.rotateY(ry); p.translate(x, 1.55, z); panes.push(p);
    const fb = (bw, bh, ox, oy) => { const g = boxGeo(bw, bh, .05, 0, 0, 0); g.translate(ox, oy, .02); g.rotateY(ry); g.translate(x, 0, z); winFrame.push(g); };
    fb(w + .1, .06, 0, .8); fb(w + .1, .06, 0, 2.3); fb(.06, 1.56, -w / 2, 1.55); fb(.06, 1.56, w / 2, 1.55); fb(w, .04, 0, 1.95);
    const nm = Math.max(1, Math.round(w / .5)); for (let k = 1; k < nm; k++) fb(.035, 1.5, -w / 2 + k * w / nm, 1.55);
    if (!curt.has(wd.curt)) curt.set(wd.curt, []);
    for (const sx of [-1, 1]) { const g = new THREE.CylinderGeometry(.07, .13, 2.05, 8); g.translate(sx * (w / 2 + .1), 1.3, .12); g.rotateY(ry); g.translate(x, 0, z); curt.get(wd.curt).push(g);
      const tie = new THREE.TorusGeometry(.1, .02, 5, 10); tie.rotateX(Math.PI / 2); tie.translate(sx * (w / 2 + .1), 1.05, .12); tie.rotateY(ry); tie.translate(x, 0, z); curt.get(wd.curt).push(tie); }
    const rod = boxGeo(w + .5, .03, .03, 0, 2.42, .12); rod.rotateY(ry); rod.translate(x, 0, z); winFrame.push(rod);
  }
  root.add(new THREE.Mesh(mergeGeometries(panes), new THREE.MeshBasicMaterial({ map: city })));
  root.add(new THREE.Mesh(mergeGeometries(winFrame), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .5 })));
  for (const [c, gs] of curt) root.add(new THREE.Mesh(mergeGeometries(gs), new THREE.MeshStandardMaterial({ color: c, roughness: .95 })));

  // ---- 天花板設備：金色洞洞吊燈、黑色軌道燈、吊扇、LED 燈管、外露白色管線、監視器 ----
  const deco = new Map(); const dg = (k, g) => { if (!deco.has(k)) deco.set(k, []); deco.get(k).push(g); };
  const pend = [[229, 173.75], [262.5, 173.75], [306, 173.75], [339.5, 173.75], [373, 173.75], [229, 229.75], [262.5, 229.75], [347, 229.75], [380.5, 229.75], [306, 268], [362, 267.5], [381, 267.5], [426, 184], [452, 198]];
  for (const [px, py] of pend) { const x = X(px), z = Z(py); dg('cord', cylGeo(.006, .006, .52, x, WH - .26, z, 4)); dg('gold', cylGeo(.13, .13, .32, x, WH - .68, z, 16)); dg('glow', cylGeo(.1, .1, .02, x, WH - .845, z, 12)); }
  for (const [x1p, x2p, py] of [[200, 430, 128], [210, 400, 202], [24, 110, 271], [118, 165, 282], [430, 485, 270]]) { const x1 = X(x1p), x2 = X(x2p), z = Z(py); dg('tube', boxGeo(x2 - x1, .04, .06, (x1 + x2) / 2, WH - .03, z)); }
  for (const [x1p, x2p, py] of [[290, 322, 255], [420, 482, 205]]) { const x1 = X(x1p), x2 = X(x2p), z = Z(py); dg('black', boxGeo(x2 - x1, .04, .05, (x1 + x2) / 2, WH - .03, z));
    for (let k = 0; k < 4; k++) { const sx = x1 + (x2 - x1) * (k + .5) / 4; dg('black', cylGeo(.045, .055, .14, sx, WH - .13, z, 10)); } }
  for (const [px, py] of [[300, 285], [312, 285], [140, 290], [190, 290], [440, 270], [473, 285], [40, 225], [90, 222], [85, 175], [62, 255], [62, 288], [452, 128], [165, 165]]) dg('black', cylGeo(.07, .07, .1, X(px), WH - .05, Z(py), 12));
  if (!LOW) for (const [px, py] of [[283, 148], [230, 202], [360, 202]]) { const x = X(px), z = Z(py); dg('fanW', cylGeo(.1, .1, .1, x, WH - .38, z, 12)); dg('fanW', cylGeo(.015, .015, .32, x, WH - .17, z, 6));
    for (let k = 0; k < 4; k++) { const b = boxGeo(.62, .015, .13, .38, 0, 0); b.rotateY(k * Math.PI / 2 + .3); b.translate(x, WH - .42, z); dg('fanB', b); } }
  for (const [x1p, x2p, py] of [[200, 484, 150], [126, 484, 214], [300, 300, 0]]) { if (x1p === x2p) continue; const x1 = X(x1p), x2 = X(x2p); const g = new THREE.CylinderGeometry(.055, .055, x2 - x1, 8); g.rotateZ(Math.PI / 2); g.translate((x1 + x2) / 2, WH - .2, Z(py)); dg('pipe', g); }
  { const g = new THREE.CylinderGeometry(.055, .055, 1.0, 8); g.translate(X(484) - .1, WH - .7, Z(214)); dg('pipe', g); }
  for (const [px, py] of [[425, 236], [288, 262]]) { dg('pipe', boxGeo(.12, .1, .18, X(px), WH - .12, Z(py))); dg('black', cylGeo(.05, .05, .06, X(px), WH - .2, Z(py) + .05, 10)); }
  const dotTex = mkTex(tex(64, 64, (x, w, h) => { x.fillStyle = '#c9a24a'; x.fillRect(0, 0, w, h); x.fillStyle = '#5a4415'; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.beginPath(); x.arc(4 + i * 8, 4 + j * 8, 2, 0, 6.3); x.fill(); } }), true); dotTex.repeat.set(3, 2);
  const dmat = { cord: new THREE.MeshBasicMaterial({ color: '#222' }), gold: new THREE.MeshStandardMaterial({ map: dotTex, metalness: .6, roughness: .35, emissive: '#3a2a08' }), glow: new THREE.MeshBasicMaterial({ color: '#fff3c4' }),
    tube: new THREE.MeshBasicMaterial({ color: '#ffffff' }), black: new THREE.MeshStandardMaterial({ color: '#1d1d1d', roughness: .6 }), fanW: new THREE.MeshStandardMaterial({ color: '#f5f5f5' }), fanB: new THREE.MeshStandardMaterial({ color: '#efe7da' }),
    pipe: new THREE.MeshStandardMaterial({ color: '#f7f7f7', roughness: .5 }) };
  for (const [k, gs] of deco) { const me = new THREE.Mesh(mergeGeometries(gs), dmat[k]); me.raycast = () => { }; root.add(me); ceilings.push(me); }

  // ---- 房間名稱吊牌（名稱改上面的 ROOMS 表）----
  for (const rm of ROOMS) {
    const c = tex(256, 72, (x, w, h) => { x.fillStyle = rm.sure ? 'rgba(90,61,43,.82)' : 'rgba(110,90,80,.7)'; x.beginPath(); x.roundRect(2, 2, w - 4, h - 4, 18); x.fill();
      x.fillStyle = '#fff'; x.font = `bold ${rm.name.length > 7 ? 26 : 32}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(rm.name, w / 2, h / 2 + 2); });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mkTex(c), transparent: true, depthWrite: false })); sp.scale.set(1.25, .35, 1); sp.position.set(X(rm.at[0]), 2.32, Z(rm.at[1])); sp.raycast = () => { }; sp.userData.room = rm.id; root.add(sp);
  }
  // 燈光
  root.add(new THREE.AmbientLight('#fff1dc', LOW ? .5 : .32));
  for (const [x, z] of LIGHTS.slice(0, LOW ? 0 : LIGHTS.length)) { const l = new THREE.PointLight('#ffe2b8', 6.5, 11, 1.5); l.position.set(x, 2.35, z); root.add(l); }
}
