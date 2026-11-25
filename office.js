// 辦公室地圖（v6）：依 2F 平面圖 floorplan-office.jpg 配置，風格改成科技新創辦公室。
// 平面圖像素 → 世界座標：X = (px-1000)*K、Z = (py-550)*K（俯視上方 = -z）
export const K = 0.022;
const X = px => +((px - 1000) * K).toFixed(3);
const Z = py => +((py - 550) * K).toFixed(3);
const TI = .22, TO = .3, WH = 2.72; // 內牆／外牆厚度、牆高（直接頂到天花板）

// ---------- 牆 ----------
// [x1,y1,x2,y2, 門洞(px) [[a,b],...], {outer, col, h}]
const C_IN = '#f4f1ea', C_OUT = '#e6e0d4', C_ACC = '#cfe0ee', C_WARM = '#f6dcc4', C_GREEN = '#d5e8cf';
export const WALLS = [
  // 外牆（主樓）
  [135, 95, 580, 95, [], { outer: 1 }], [580, 95, 580, 240, [], { outer: 1 }], [580, 240, 1263, 240, [], { outer: 1 }],
  [1263, 240, 1263, 1005, [[470, 545], [660, 735]], { outer: 1 }],
  [600, 1005, 1263, 1005, [], { outer: 1 }], [440, 940, 600, 940, [], { outer: 1 }],
  [250, 712, 250, 815, [], { outer: 1 }], [135, 712, 250, 712, [], { outer: 1 }], [135, 95, 135, 712, [], { outer: 1 }],
  // 員工廚房
  [295, 95, 295, 330, [[120, 178]]], [135, 330, 215, 330, []], [215, 330, 295, 330, [[225, 285]]],
  // 樓梯間（左）、貨梯、文具角
  [215, 330, 215, 530, [[345, 402]]], [135, 530, 290, 530, []],
  // 大會議室（十二人包房）
  [135, 600, 350, 600, [[285, 340]], { col: C_ACC }], [350, 600, 350, 712, []], [250, 712, 350, 712, []],
  // 洗手間（左下）
  [350, 712, 350, 815, []], [250, 815, 350, 815, [[262, 322]]], [300, 712, 300, 752, [], { h: 2.0 }],
  // 儲藏室
  [350, 607, 432, 607, []], [432, 607, 432, 815, []], [350, 815, 432, 815, [[365, 420]]],
  // 樓梯間（下）
  [460, 870, 600, 870, [[470, 527]]], [460, 870, 460, 940, []],
  // 會議室 A/B/C 隔間（正面是玻璃，見 GLASS）
  [600, 850, 600, 1005, [], { col: C_ACC }], [698, 850, 698, 1005, [], { col: C_ACC }], [796, 850, 796, 1005, [], { col: C_ACC }], [894, 850, 894, 1005, [], { col: C_ACC }],
  // 休息艙區（睡洞）
  [894, 850, 1094, 850, [[925, 990]], { col: C_WARM }], [1017, 930, 1017, 1005, [], { col: C_WARM }], [1140, 930, 1140, 1005, [], { col: C_WARM }],
  // 遊戲室（甜品房）
  [664, 464, 785, 464, [], { col: C_GREEN }], [664, 464, 664, 556, [], { col: C_GREEN }], [785, 464, 785, 556, [], { col: C_GREEN }], [664, 556, 785, 556, [[700, 760]], { col: C_GREEN }],
  // 零食室（飲料櫃）
  [929, 457, 1038, 457, []], [929, 457, 929, 556, []], [1038, 457, 1038, 556, []], [929, 556, 1038, 556, [[958, 1015]]],
  // 閱讀區（書吧）
  [929, 690, 1038, 690, [[955, 1012]], { col: C_WARM }], [929, 690, 929, 790, [], { col: C_WARM }], [1038, 690, 1038, 790, [], { col: C_WARM }], [929, 790, 1038, 790, [], { col: C_WARM }],
  // 右上洗手間（清潔間／女／男）
  [1035, 240, 1035, 400, []], [1035, 400, 1263, 400, [[1060, 1112], [1193, 1245]]], [1150, 240, 1150, 400, []],
  [1093, 240, 1093, 300, [], { h: 2.0 }], [1207, 240, 1207, 300, [], { h: 2.0 }],
  // ---- 右翼 ----
  [1440, 240, 1575, 240, [], { outer: 1 }], [1440, 240, 1440, 580, [[470, 545]], { outer: 1 }], [1440, 580, 1575, 580, [[1460, 1530]], { outer: 1 }],
  [1575, 400, 1575, 580, [[468, 530]]], [1440, 400, 1575, 400, [[1480, 1537]]],
  [1575, 580, 1745, 580, [], { outer: 1 }], [1745, 400, 1745, 580, [], { outer: 1 }],
  [1455, 580, 1455, 660, [], { outer: 1 }], [1535, 580, 1535, 660, [], { outer: 1 }],
  [1440, 660, 1850, 660, [[1460, 1530]], { outer: 1 }], [1440, 660, 1440, 1015, [[665, 735]], { outer: 1 }],
  [1440, 1015, 1850, 1015, [], { outer: 1 }], [1850, 660, 1850, 1015, [], { outer: 1 }],
  [1658, 660, 1658, 840, [], { col: C_ACC }], [1745, 660, 1745, 840, []],
  [1570, 840, 1850, 840, [[1590, 1642], [1678, 1730], [1770, 1830]]],
  [1570, 900, 1850, 900, [[1590, 1642], [1680, 1730], [1772, 1830]]],
  [1570, 900, 1570, 1015, []], [1660, 900, 1660, 1015, []], [1745, 900, 1745, 1015, []],
];
// 玻璃隔間 [x1,y1,x2,y2, 門洞]
export const GLASS = [
  [600, 850, 894, 850, [[630, 686], [728, 784], [826, 882]]], // 會議室 A/B/C 正面
  [1263, 470, 1440, 470, []], [1263, 545, 1440, 545, []],       // 上空橋
  [1263, 660, 1440, 660, []], [1263, 735, 1440, 735, []],       // 下空橋
  [1570, 660, 1570, 840, []],                                    // 會議室 D 面向大廳
];
// 曲線：外立面玻璃帷幕（左下圓弧）＋中庭弧形矮花台（h 是高度）
export const CURVES = [
  { pts: [[250, 815], [256, 840], [268, 862], [288, 885], [315, 905], [350, 922], [395, 935], [440, 941]], glass: 1, h: WH },
  { pts: [[840, 465], [815, 510], [800, 545]], h: 1.1, col: '#b9d7a8' },
  { pts: [[640, 615], [648, 680], [660, 780]], h: 1.1, col: '#b9d7a8' },
  { pts: [[765, 630], [782, 700], [800, 780]], h: 1.1, col: '#b9d7a8' },
  { pts: [[890, 520], [920, 560], [954, 612]], h: 1.1, col: '#b9d7a8' },
  { pts: [[890, 682], [905, 730], [925, 781]], h: 1.1, col: '#b9d7a8' },
  { pts: [[655, 668], [612, 672], [580, 690], [612, 708], [655, 712]], h: .4, col: '#e9a873', bench: 1 }, // 弧形長凳（可踩上去）
];
// 實心區塊（貨梯、電梯/機電核心、空調機房）[x1,y1,x2,y2,顏色]
export const SOLIDS = [
  [225, 395, 290, 465, '#c9ced6'],
  [1094, 740, 1263, 850, '#d9d4cb'],
  [1575, 170, 1745, 400, '#c4c8cc'],
];
// 樓梯：[x1,y1,x2,y2, 往哪邊升高 'x+'|'x-'|'z+'|'z-', 階數]
export const STAIRS = [
  [140, 412, 210, 525, 'z+', 7],   // 左上樓梯間
  [500, 880, 595, 935, 'x+', 6],   // 下方樓梯間
  [682, 614, 730, 696, 'z-', 6],   // 中庭通往三樓的樓梯
];
// 地板 [x1,y1,x2,y2,顏色]（互不重疊）
export const FLOORS = [
  [135, 95, 295, 330, '#e8e3d8'],   // 廚房磁磚
  [295, 95, 350, 330, '#c79a6b'],   // 咖啡吧台
  [135, 330, 350, 600, '#d6d2cb'],  // 後場／樓梯／走廊
  [135, 600, 350, 712, '#9fb3c8'],  // 大會議室地毯
  [250, 712, 350, 815, '#cfe6ee'],  // 洗手間
  [350, 95, 580, 240, '#bfc8d2'], [350, 240, 1035, 530, '#bfc8d2'],  // 開放辦公區地毯（含窗邊）
  [1035, 240, 1263, 400, '#d4e9ef'],// 右上洗手間
  [1035, 400, 1263, 740, '#b48c64'],// 酒吧＋卡座＋電梯廳 木地板
  [350, 530, 1035, 850, '#e1c39b'], // 中庭木地板
  [460, 870, 600, 940, '#cfcac2'], [460, 850, 600, 870, '#e1c39b'],  // 樓梯間
  [600, 850, 894, 1005, '#a9b8c9'], // 會議室
  [894, 850, 1263, 1005, '#cdbfe0'],// 休息艙
  [135, 712, 250, 1005, '#cdb08a'], [250, 815, 600, 1005, '#cdb08a'], // 戶外露台
  [1263, 470, 1440, 545, '#d0d4d8'], [1263, 660, 1440, 735, '#d0d4d8'], // 空橋
  [1440, 240, 1575, 580, '#c9d6c2'], [1575, 400, 1745, 580, '#f0d9b5'], [1455, 580, 1535, 660, '#d0d4d8'],
  [1440, 660, 1850, 1015, '#c3ccd6'],
];
// 天花板矩形
export const CEILS = [[135, 95, 580, 240], [135, 240, 1263, 1005], [1263, 470, 1440, 545], [1263, 660, 1440, 735],
  [1440, 240, 1575, 580], [1575, 170, 1745, 580], [1455, 580, 1535, 660], [1440, 660, 1850, 1015]];
// 窗戶：[x 或 px..., 牆線, 'h'|'v', 朝內方向 +1/-1, 中心(px)]
const WIN = [
  ['h', 95, +1, 400], ['h', 95, +1, 500],
  ['h', 240, +1, 640], ['h', 240, +1, 740], ['h', 240, +1, 840], ['h', 240, +1, 940],
  ['h', 712, -1, 185], ['v', 135, +1, 640],
  ['h', 1005, -1, 1060], ['h', 1005, -1, 1200], ['h', 1005, -1, 650], ['h', 1005, -1, 845],
  ['v', 1440, +1, 300], ['h', 240, +1, 1508], ['v', 1745, -1, 490],
  ['h', 1015, -1, 1615], ['h', 1015, -1, 1702], ['h', 1015, -1, 1797], ['v', 1850, -1, 750], ['v', 1850, -1, 960], ['h', 1015, -1, 1475],
];
export const WINDOWS = WIN.map(([o, line, s, c]) => {
  const outerFace = (o === 'h' ? Z(line) : X(line)) + s * (TO / 2 + .01);
  return o === 'h' ? { x: X(c), z: outerFace, ry: s > 0 ? 0 : Math.PI, w: 1.6 } : { x: outerFace, z: Z(c), ry: s > 0 ? Math.PI / 2 : -Math.PI / 2, w: 1.6 };
});
export const WINDOW_HOLES = WINDOWS.map(w => Math.abs(Math.sin(w.ry)) > .5 ? ['x', w.x, w.z, 1.55, .8, .55] : ['z', w.z, w.x, 1.55, .8, .55]);
export const BOUNDS = { x1: X(135) + .2, x2: X(1850) - .2, z1: Z(95) + .2, z2: Z(1015) - .2 };
export const HIDER_SPAWNS = [[575, 588], [620, 590], [665, 592], [560, 625], [595, 622], [740, 600], [520, 590], [700, 720]].map(([a, b]) => [X(a), Z(b)]);
export const SEEKER_SPAWN = [X(1180), Z(675)];
// 點光源（電腦全開；手機 0 盞，用環境光）
export const LIGHTS = [[-11.6, -5.2], [-4.2, -4.6], [-6.4, 3.2], [-0.4, 2.6], [3.8, -1.4], [-5.5, 8.3], [11.1, -2.4], [14.2, 6.6]];

// ---------- 家具（可變身）：[模型, x, z, 轉角, 高度y] ----------
const P = [];
const A = (n, px, py, r = 0, y) => P.push(y != null ? [n, X(px), Z(py), r, y] : [n, X(px), Z(py), r]);
const W_ = (n, x, z, r = 0, y) => P.push(y != null ? [n, +x.toFixed(3), +z.toFixed(3), r, y] : [n, +x.toFixed(3), +z.toFixed(3), r]);
// 貼牆掛飾：牆線（px）、哪一側（+1 = 牆的 +x/+z 那側）、沿牆位置（px）、中心高度
function onWall(n, orient, line, side, along, y, outer = false) {
  const face = (orient === 'h' ? Z(line) : X(line)) + side * ((outer ? TO : TI) / 2 + .03);
  if (orient === 'h') W_(n, X(along), face, side > 0 ? 0 : 180, y); else W_(n, face, Z(along), side > 0 ? 90 : -90, y);
}
// 一張辦公桌（含椅子、螢幕或筆電、鍵盤）。r = 桌子轉角（0：人坐在 +z 那側）
let deskN = 0;
function desk(x, z, r) {
  const a = r * Math.PI / 180, dx = Math.sin(a), dz = Math.cos(a);
  W_('desk', x, z, r);
  W_('chairDesk', x + dx * 1.0, z + dz * 1.0, r + 180);
  const k = deskN++ % 3;
  if (k === 2) W_('laptop', x + dx * .05, z + dz * .05, r, .85);
  else { W_('computerScreen', x - dx * .17, z - dz * .17, r, .85); W_('computerKeyboard', x + dx * .2, z + dz * .2, r, .85); }
  if (k === 1) W_('mugSet', x + dx * .05 + dz * .6, z + dz * .05 - dx * .6, r, .85);
}

// 員工廚房
W_('kitchenFridgeLarge', -18.31, -9.41, 0); W_('kitchenSink', -17.2, -9.37, 0); W_('kitchenStove', -16.2, -9.37, 0);
W_('kitchenCabinet', -18.385, -8.4, 90); W_('kitchenCabinet', -18.385, -7.45, 90); W_('kitchenFridge', -18.56, -6.4, 90);
W_('kitchenCoffeeMachine', -18.4, -8.4, 90, .99); W_('kitchenMicrowave', -18.4, -7.45, 90, .99); W_('cookingPot', -16.4, -9.35, 0, .99);
W_('kitchenBar', -16.75, -7.35, 90); W_('kitchenBar', -16.75, -6.4, 90);
W_('cuttingBoard', -16.75, -7.5, 90, .92); W_('plateStack', -16.75, -6.6, 0, .92); W_('kettle', -16.75, -6.15, 0, .92);
W_('fryingPan', -15.95, -9.3, 0, .99); W_('trashcan', -15.95, -5.25, 0); W_('sauceBottles', -18.4, -6.95, 90, .99);
// 咖啡吧台（明檔）
for (const z of [-9.4, -8.45, -7.5]) { W_('kitchenBar', -14.42, z, -90); W_('stoolBar', -13.75, z, -90); }
W_('kitchenCoffeeMachine', -14.42, -9.4, -90, .92); W_('cupSet', -14.42, -8.5, 0, .92); W_('fruitBowl', -14.42, -7.55, 0, .92);
W_('kitchenFridgeSmall', -15.08, -6.2, 90); W_('waterCooler', -15.1, -5.3, 90);
// 後場：印表機角、文具角、置物櫃
W_('printer', -15.25, -2.95, 90); W_('paperStack', -15.25, -2.95, 90, .92); W_('filingCabinet', -15.32, -2.1, 90);
W_('shelfBoxes', -16.55, -.85, 180); W_('cardboardBoxClosed', -15.95, -1.35, 15); W_('cardboardBoxOpen', -16.7, -1.3, 0);
W_('waterCooler', -14.65, -.95, -90);
W_('pottedPlant', -15.7, .2, 0);
// 大會議室
W_('confTable', -16.6, 2.33, 0);
for (const x of [-17.3, -16.6, -15.9]) { W_('chairModernCushion', x, 1.5, 0); W_('chairModernCushion', x, 3.16, 180); }
W_('cabinetTelevision', -18.6, 2.33, 90); W_('televisionModern', -18.62, 2.33, 90, .68);
W_('laptop', -17.0, 2.18, 0, .75); W_('paperStack', -16.1, 2.43, 20, .75); W_('pottedPlant', -14.75, 3.15, 0);
onWall('whiteboard', 'v', 350, -1, 650, 1.45); onWall('clock', 'h', 600, +1, 200, 2.0);
// 洗手間（左下）
W_('toiletSquare', -16.0, 4.1, 0); W_('toiletSquare', -14.85, 4.1, 0); W_('bathroomSink', -16.03, 5.15, 90); W_('trashcan', -14.6, 5.45, 0);
// 儲藏室
W_('shelfBoxes', -13.95, 2.0, 90); W_('shelfBoxes', -13.95, 3.1, 90); W_('cardboardBoxClosed', -12.95, 1.85, 0); W_('cardboardBoxOpen', -13.0, 3.6, 90);
W_('broom', -12.85, 4.7, 0); W_('filingCabinet', -13.95, 4.35, 90);
// 零食吧（水果吧 L 型吧台）
W_('kitchenBar', -11.9, 1.41, 0); W_('kitchenBarEnd', -11.32, 1.41, 0);
for (const z of [2.35, 3.3, 4.25]) W_('kitchenBar', -11.2, z, 90);
W_('kitchenCoffeeMachine', -11.2, 2.35, 90, .92); W_('snackBox', -11.2, 3.3, 0, .92); W_('fruitBowl', -11.9, 1.41, 0, .92); W_('mugSet', -11.2, 4.25, 90, .92);
for (const z of [2.35, 3.3, 4.25]) W_('stoolBarSquare', -10.62, z, 0);
// 窗邊休憩區（吸菸區改）
W_('beanBag', -13.8, 7.0, 30); W_('beanBag', -12.55, 7.8, -20); W_('pottedPlant', -14.6, 6.35, 0); W_('sideTable', -12.85, 6.3, 0); W_('plantSmall2', -12.85, 6.3, 0, .85);
// 開放辦公區：窗邊一排面窗的桌子
for (const px of [640, 750, 860, 970]) desk(X(px), Z(240) + TO / 2 + .45, 0);
// 西側：咖啡座＋兩組四人島
W_('tableRound', -11.6, -8.4, 0);
W_('chairRounded', -11.6, -9.45, 0); W_('chairRounded', -11.6, -7.35, 180); W_('chairRounded', -12.55, -8.4, 90); W_('chairRounded', -10.65, -8.4, -90);
W_('plantSmall1', -11.6, -8.4, 0, .81);
for (const cz of [-5.3, -1.2]) for (const cx of [-12.6, -10.98]) { desk(cx, cz - .43, 180); desk(cx, cz + .43, 0); }
// 東側：兩組兩人對桌（桌子轉 90°）
for (const cx of [-6.4, -2.1]) { desk(cx - .43, -3.3, -90); desk(cx + .43, -3.3, 90); }
onWall('whiteboard', 'v', 1035, -1, 300, 1.45); onWall('posterA', 'v', 580, -1, 170, 1.6, true); onWall('clock', 'h', 95, +1, 450, 2.0, true);
W_('pottedPlant', -9.7, -6.2, 0); W_('pottedPlant', 0.4, -2.6, 0); W_('printer', -1.0, -2.65, 180); W_('trashcan', -13.6, -3.4, 0);
// 鋼琴休憩角
W_('piano', -7.8, -1.85, -90); W_('loungeDesignChair', -9.0, -2.0, 0); W_('tableCoffeeGlass', -9.0, -.9, 0); W_('loungeChair', -9.0, .3, 180);
W_('books', -9.3, -.9, 30, .51); W_('plantSmall3', -8.6, -.85, 0, .51);
// 遊戲室（甜品房）
W_('foosball', -5.8, -.8, 0); W_('arcade', -6.9, -1.4, 90); W_('gameController', -5.3, -1.6, 0); W_('plushToy', -7.0, -.4, 45);
onWall('posterB', 'h', 464, +1, 735, 1.6);
// 中庭：弧形花台之間的沙發、懶骨頭、植物
W_('loungeSofa', -3.0, 3.6, -90);
W_('tableCoffee', -3.95, 3.6, 90); W_('beanBag', -3.0, 5.35, 10); W_('beanBag', -6.2, 4.6, -30); W_('pottedPlant', -8.5, 1.0, 0); W_('pottedPlant', -2.9, -.3, 0);
W_('toyBall', -9.9, 5.1, 0); W_('pottedPlant', -10.05, 5.7, 0); W_('lampRoundFloor', -3.6, 2.1, 0);
W_('loungeDesignChair', -8.9, 4.8, 90); W_('sideTable', -9.95, 4.05, 90);
// 零食室（飲料櫃）
W_('vendingMachine', -.95, -1.55, 0); W_('snackCabinet', .2, -1.72, 0); W_('kitchenFridgeSmall', .41, -.55, -90); W_('waterCooler', -1.25, -.3, 0); W_('snackBox', .2, -1.72, 0, 1.0);
// 閱讀區（書吧）
W_('bookcaseOpen', -.95, 4.89, 180); W_('bookcaseClosed', -.05, 4.89, 180); W_('loungeChair', -1.05, 3.8, 90); W_('lampRoundFloor', .2, 3.45, 0);
W_('booksFloor', -.35, 3.6, 0); W_('beanBag', .3, 4.15, -15);
onWall('posterA', 'v', 929, +1, 740, 1.6);
// 酒吧＋卡座
W_('kitchenBar', 3.6, -2.03, 180); W_('kitchenBar', 4.55, -2.03, 180); W_('kitchenBar', 3.6, -1.57, 0); W_('kitchenBar', 4.55, -1.57, 0);
W_('cupSet', 3.5, -1.8, 0, .92); W_('sauceBottles', 4.65, -1.8, 0, .92); W_('kitchenCoffeeMachine', 4.08, -1.8, 0, .92);
for (const x of [3.6, 4.55]) { W_('stoolBar', x, -2.75, 180); W_('stoolBar', x, -.85, 0); }
W_('radio', 2.35, -2.95, 0);
W_('loungeSofa', 2.95, .3, 0); W_('tableCoffee', 2.95, 1.25, 0); W_('loungeDesignChair', 4.8, .3, 0); W_('plantSmall2', 2.95, 1.25, 0, .51);
// 電梯廳
W_('bench', 2.6, 3.75, 0); W_('pottedPlant', 5.45, 3.8, 0); W_('trashcan', 2.0, 2.0, 0);
onWall('clock', 'h', 740, -1, 1178, 2.15); onWall('posterB', 'h', 740, -1, 1120, 1.55);
// 右上洗手間
W_('toiletSquare', 1.5, -6.13, 0); W_('toiletSquare', 2.6, -6.13, 0); W_('bathroomSink', 2.87, -4.3, -90);
W_('toiletSquare', 4.0, -6.13, 0); W_('toiletSquare', 5.1, -6.13, 0); W_('bathroomSink', 3.73, -4.3, 90); W_('trashcan', 1.15, -3.75, 0);
// 會議室 A / B / C（下排）
W_('table', -7.7, 8.4, 90); for (const z of [7.95, 8.85]) { W_('chairModernFrameCushion', -8.33, z, 90); W_('chairModernFrameCushion', -7.07, z, -90); }
W_('laptop', -7.7, 8.2, 90, .72); onWall('whiteboard', 'h', 1005, -1, 649, 1.45, true);
W_('tableRound', -5.55, 8.45, 0); W_('chairRounded', -5.55, 7.45, 180); W_('chairRounded', -6.35, 8.6, 90); W_('chairRounded', -4.75, 8.6, -90);
W_('plantSmall1', -5.55, 8.45, 0, .81); onWall('posterA', 'v', 698, +1, 960, 1.6);
W_('table', -3.4, 8.4, 90); for (const z of [7.95, 8.85]) { W_('chairModernFrameCushion', -4.03, z, 90); W_('chairModernFrameCushion', -2.77, z, -90); }
W_('paperStack', -3.4, 8.7, 0, .72); onWall('whiteboard', 'h', 1005, -1, 845, 1.45, true);
// 休息艙
W_('bedSingle', -1.0, 9.2, 90); W_('pillowBlue', -.1, 9.2, 90, .55); W_('sideTable', -1.5, 8.25, 0); W_('lampSquareTable', -1.85, 8.25, 0, .85);
W_('bedBunk', 1.72, 9.2, 90); W_('beanBag', 3.9, 9.35, 20); W_('beanBag', 4.95, 9.25, -25); W_('lampRoundFloor', 5.2, 8.2, 0);
for (const x of [1.0, 1.9, 2.8, 3.7]) W_('lockers', x, 6.96, 0);
W_('coatRackStanding', 4.9, 7.05, 0); onWall('posterB', 'h', 1005, -1, 1155, 1.6, true);
// 上空橋
W_('pottedPlant', 7.7, -1.5, 0); W_('pottedPlant', 7.7, 3.8, 0);
// 右翼：桌遊室
W_('table', 11.2, -5.0, 90); for (const z of [-5.45, -4.55]) { W_('chairCushion', 10.45, z, 90); W_('chairCushion', 11.95, z, -90); }
W_('toyBlocks', 11.2, -5.3, 0, .72); W_('handheldGame', 11.15, -4.6, 30, .72); W_('shelfBoxes', 12.0, -6.27, 0); W_('bookcaseFilled', 10.7, -6.25, 0);
onWall('posterA', 'v', 1440, +1, 352, 1.6, true);
// 右翼大廳
W_('waterCooler', 12.3, -3.0, -90); W_('pottedPlant', 10.0, -2.8, 0); W_('coatRackStanding', 12.2, -.1, 0); W_('bench', 11.1, .3, 0);
// 遊戲室（乒乓球）
W_('pingPong', 14.9, -1.3, 90); W_('arcade', 13.1, -2.8, 0); W_('arcade', 13.85, -2.8, 0); W_('beanBag', 15.8, .15, 0); W_('toyBall', 15.9, -2.7, 0);
onWall('posterB', 'v', 1575, +1, 555, 1.6);
// 右下：接待大廳
W_('receptionDesk', 11.35, 4.7, -90); W_('chairDesk', 12.05, 4.7, -90); W_('computerScreen', 11.4, 4.7, -90, 1.05);
W_('loungeSofa', 10.4, 6.0, 90); W_('pottedPlant', 12.2, 2.85, 0); W_('plantSmall3', 11.35, 4.25, 0, 1.05);
// 會議室 D / E
W_('tableRound', 13.5, 4.3, 0); W_('chairRounded', 13.5, 3.3, 180); W_('chairRounded', 12.95, 5.2, 0); W_('chairRounded', 14.05, 5.2, 0);
onWall('whiteboard', 'h', 660, +1, 1614, 1.45, true);
W_('table', 15.43, 4.45, 90); for (const z of [4.0, 4.9]) { W_('chairModernFrameCushion', 14.8, z, 90); W_('chairModernFrameCushion', 16.06, z, -90); }
onWall('whiteboard', 'h', 660, +1, 1700, 1.45, true); W_('laptop', 15.43, 4.2, 90, .72);
// 影印室
W_('printer', 18.2, 3.3, -90); W_('printer', 18.2, 4.4, -90); W_('filingCabinet', 18.25, 5.5, -90); W_('paperStack', 16.9, 2.9, 0); W_('cardboardBoxClosed', 16.9, 3.7, 10);
// 小辦公室 ×2 ＋ 主管辦公室
for (const px of [1615, 1702]) { const x = X(px); desk(x, Z(1015) - TO / 2 - .45, 180); W_('plantSmall2', x + .7, Z(1015) - TO / 2 - .45, 0, .85); }
W_('bookcaseOpenLow', 12.95, 8.15, 90); W_('pottedPlant', 16.0, 8.2, 0);
W_('desk', 17.5, 9.6, 180); W_('chairDesk', 17.5, 8.6, 0); W_('computerScreen', 17.5, 9.77, 180, .85); W_('laptop', 16.95, 9.5, 200, .85); W_('pottedPlant', 16.8, 8.0, 0);
W_('bookcaseClosed', 18.27, 8.3, -90); onWall('clock', 'v', 1850, -1, 950, 2.0, true);
// 休閒遊戲區（右下）
W_('cabinetTelevision', 12.15, 8.9, -90); W_('televisionModern', 12.17, 8.9, -90, .68); W_('gameConsole', 12.15, 8.3, -90, .68); W_('speakerSmall', 12.15, 9.55, -90, .68);
W_('loungeSofa', 10.3, 8.9, 90); W_('beanBag', 11.3, 9.55, -30); W_('gameController', 11.2, 8.6, 0);
export const PROPS = P;
// 不能變身的裝飾
export const DECOR = [
  ['rugRectangle', -8.95, -1.0, 90], ['rugRound', -2.0, 3.5, 0], ['rugRectangle', 11.2, 8.9, 90], ['rugRound', 14.9, -1.3, 0],
  ['bathroomMirror', -16.3, 5.15, 90, 1.35], ['bathroomMirror', 3.15, -4.3, -90, 1.35], ['bathroomMirror', 3.45, -4.3, 90, 1.35],
  ['kitchenCabinetUpper', -17.2, -9.75, 0, 1.55], ['hoodModern', -16.2, -9.68, 0, 1.55],
];

// ---------- 程式產生的辦公室小物 ----------
export const OFFICE_PROC = ['whiteboard', 'posterA', 'posterB', 'beanBag', 'snackCabinet', 'vendingMachine', 'waterCooler', 'printer', 'lockers', 'filingCabinet',
  'pingPong', 'foosball', 'arcade', 'piano', 'confTable', 'receptionDesk', 'paperStack', 'snackBox', 'fruitBowl'];
export const OFFICE_WALL = ['whiteboard', 'posterA', 'posterB'];
export const OFFICE_SMALL = ['beanBag', 'waterCooler', 'printer', 'paperStack', 'snackBox', 'fruitBowl', 'computerKeyboard', 'computerMouse',
  'chairModernCushion', 'chairModernFrameCushion', 'chairRounded', 'stoolBarSquare', 'radio', 'speakerSmall'];
function tex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
export function officeProc(THREE, name, g, add, m) {
  const texMesh = (w, h, canvas, x, y, z) => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: .6 })); p.position.set(x, y, z); g.add(p); return p; };
  if (name === 'whiteboard') { // 白板：鋁框＋板面字＋筆槽
    add(1.42, .96, .04, '#b0bec5', 0, 0, 0);
    texMesh(1.34, .88, tex(256, 168, (x, w, h) => { x.fillStyle = '#fbfdff'; x.fillRect(0, 0, w, h); x.lineWidth = 4;
      x.strokeStyle = '#1e88e5'; x.beginPath(); x.moveTo(20, 40); x.lineTo(110, 40); x.moveTo(20, 70); x.lineTo(150, 70); x.stroke();
      x.strokeStyle = '#e53935'; x.strokeRect(160, 30, 70, 50); x.strokeStyle = '#43a047'; x.beginPath(); x.moveTo(30, 140); x.lineTo(90, 110); x.lineTo(140, 128); x.lineTo(220, 96); x.stroke();
      x.fillStyle = '#ffd54f'; x.fillRect(180, 110, 34, 34); x.fillStyle = '#80deea'; x.fillRect(196, 124, 34, 34); }), 0, 0, .021);
    add(.5, .03, .07, '#90a4ae', 0, -.49, .04);
  } else if (name === 'posterA' || name === 'posterB') { // 新創海報
    add(.66, .9, .03, '#37474f', 0, 0, 0);
    texMesh(.6, .84, tex(120, 168, (x, w, h) => { const a = name === 'posterA';
      const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, a ? '#7c4dff' : '#ff7043'); gr.addColorStop(1, a ? '#18ffff' : '#ffca28'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
      x.fillStyle = '#fff'; x.font = 'bold 22px sans-serif'; x.textAlign = 'center'; x.fillText(a ? 'SHIP IT' : 'DREAM', w / 2, 42); x.fillText(a ? '🚀' : 'BIG', w / 2, 78);
      x.beginPath(); x.arc(w / 2, 125, 26, 0, 6.3); x.fillStyle = 'rgba(255,255,255,.55)'; x.fill(); }), 0, 0, .017);
  } else if (name === 'beanBag') { // 懶骨頭
    const s = new THREE.Mesh(new THREE.SphereGeometry(.42, 16, 12), m('#ff8a65')); s.scale.set(1, .62, 1); s.position.y = .26; s.castShadow = true; g.add(s);
    const t = new THREE.Mesh(new THREE.SphereGeometry(.26, 12, 10), m('#ff7043')); t.scale.set(1, .7, 1); t.position.set(0, .48, -.12); g.add(t);
  } else if (name === 'snackCabinet') { // 零食櫃：玻璃門層架＋彩色零食
    add(.9, 1.7, .45, '#eceff1', 0, .85, 0);
    for (let i = 0; i < 4; i++) { add(.84, .02, .4, '#cfd8dc', 0, .3 + i * .38, .01);
      ['#ef5350', '#ffca28', '#66bb6a', '#42a5f5', '#ab47bc'].forEach((c, j) => add(.12, .2, .12, c, -.33 + j * .165, .41 + i * .38, .05)); }
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(.86, 1.62), new THREE.MeshStandardMaterial({ color: '#d7f1ff', transparent: true, opacity: .25 })); gl.position.set(0, .86, .228); g.add(gl);
  } else if (name === 'vendingMachine') { // 飲料販賣機
    add(1.0, 1.9, .8, '#e53935', 0, .95, 0); add(.62, 1.3, .02, '#b3e5fc', -.12, 1.15, .41);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) add(.09, .16, .02, ['#ffeb3b', '#4caf50', '#2196f3', '#ff9800'][j], -.36 + j * .16, .65 + i * .3, .425);
    add(.2, .5, .02, '#424242', .36, 1.2, .41); add(.6, .16, .02, '#212121', -.1, .3, .41);
  } else if (name === 'waterCooler') { // 飲水機
    add(.36, .95, .36, '#eceff1', 0, .475, 0); add(.12, .06, .05, '#90a4ae', 0, .78, .2);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, .4, 14), new THREE.MeshStandardMaterial({ color: '#81d4fa', transparent: true, opacity: .75 })); b.position.y = 1.15; g.add(b);
  } else if (name === 'printer') { // 多功能事務機
    add(.66, .7, .56, '#eceff1', 0, .35, 0); add(.6, .1, .5, '#cfd8dc', 0, .75, 0); add(.4, .03, .3, '#fff', 0, .62, .25); add(.18, .06, .02, '#37474f', .2, .79, .26);
  } else if (name === 'lockers') { // 員工置物櫃（三門）
    add(.9, 1.9, .5, '#78909c', 0, .95, 0);
    for (let i = 0; i < 3; i++) { add(.27, 1.8, .02, ['#4fc3f7', '#81c784', '#ffb74d'][i], -.29 + i * .29, .95, .255); add(.04, .1, .02, '#eceff1', -.2 + i * .29, 1.05, .27); }
  } else if (name === 'filingCabinet') { // 檔案櫃
    add(.5, 1.05, .6, '#b0bec5', 0, .525, 0); for (let i = 0; i < 3; i++) add(.3, .03, .02, '#546e7a', 0, .25 + i * .33, .31);
  } else if (name === 'pingPong') { // 乒乓球桌
    add(2.4, .05, 1.3, '#1565c0', 0, .74, 0); add(2.4, .006, .02, '#fff', 0, .768, 0); add(.02, .15, 1.36, '#eceff1', 0, .84, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(.06, .72, .06, '#37474f', sx * 1.05, .36, sz * .55);
  } else if (name === 'foosball') { // 手足球台
    add(1.2, .26, .72, '#6d4c41', 0, .78, 0); add(1.1, .02, .62, '#43a047', 0, .9, 0);
    for (let i = 0; i < 4; i++) add(.03, .03, 1.0, '#cfd8dc', -.42 + i * .28, .96, 0);
    for (const sx of [-1, 1]) add(.1, .65, .62, '#5d4037', sx * .52, .33, 0);
  } else if (name === 'arcade') { // 街機
    add(.7, 1.7, .7, '#3949ab', 0, .85, 0); add(.56, .44, .02, '#00e5ff', 0, 1.3, .36); add(.6, .1, .3, '#212121', 0, .95, .45);
    add(.05, .1, .05, '#ff1744', -.12, 1.03, .45); add(.06, .03, .06, '#ffea00', .1, 1.01, .45); add(.6, .16, .04, '#ff4081', 0, 1.62, .36);
  } else if (name === 'piano') { // 直立式鋼琴
    add(1.45, 1.25, .58, '#212121', 0, .625, 0); add(1.35, .05, .25, '#fafafa', 0, .78, .4); add(1.35, .08, .3, '#212121', 0, .74, .38);
    for (let i = 0; i < 12; i++) add(.035, .02, .14, '#111', -.6 + i * .11, .81, .36);
  } else if (name === 'confTable') { // 長會議桌
    add(2.4, .06, 1.05, '#8d6e63', 0, .74, 0); for (const sx of [-.95, .95]) add(.12, .72, .7, '#5d4037', sx, .36, 0);
    add(.3, .04, .15, '#263238', 0, .78, 0);
  } else if (name === 'receptionDesk') { // 接待櫃台
    add(2.0, 1.05, .55, '#ffffff', 0, .525, 0); add(2.06, .06, .65, '#8d6e63', 0, 1.06, 0); add(1.6, .3, .02, '#26c6da', 0, .65, .28);
  } else if (name === 'paperStack') { // 一疊文件
    for (let i = 0; i < 3; i++) add(.3, .03, .22, ['#ffffff', '#fff9c4', '#e3f2fd'][i], .01 * i, .015 + i * .032, -.01 * i);
  } else if (name === 'snackBox') { // 零食盒
    add(.36, .16, .26, '#ffb74d', 0, .08, 0); for (let i = 0; i < 3; i++) add(.09, .12, .05, ['#e53935', '#43a047', '#1e88e5'][i], -.1 + i * .1, .2, 0);
  } else if (name === 'fruitBowl') { // 水果盤
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.17, .1, .08, 16), m('#eceff1')); b.position.y = .04; g.add(b);
    for (const [fx, fz, c] of [[-.06, 0, '#ef5350'], [.06, .03, '#ffca28'], [0, -.06, '#8bc34a'], [.02, .06, '#ff9800']]) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(.055, 10, 8), m(c)); f.position.set(fx, .11, fz); g.add(f); }
  }
}

// ---------- 建立外殼（牆、玻璃、地板、天花板、樓梯、窗戶、燈）----------
export function buildOfficeShell(api) {
  const { THREE, root, colliders, wallMeshes, ceilings, LOW, mergeGeometries } = api;
  const geoBy = new Map(); // 顏色 → 幾何（合併成一個 mesh，省 draw call）
  const addGeo = (key, geo) => { if (!geoBy.has(key)) geoBy.set(key, []); geoBy.get(key).push(geo); };
  const boxGeo = (w, h, d, x, y, z, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); return g; };
  const col = (x1, x2, z1, z2, y2, extra = {}) => colliders.push({ x1, x2, z1, z2, y1: 0, y2, ...extra });
  // 牆
  for (const [x1p, y1p, x2p, y2p, gaps = [], o = {}] of WALLS) {
    const t = o.outer ? TO : TI, h = o.h || WH, c = o.outer ? C_OUT : (o.col || C_IN);
    const horiz = y1p === y2p; const a0 = horiz ? Math.min(x1p, x2p) : Math.min(y1p, y2p), a1 = horiz ? Math.max(x1p, x2p) : Math.max(y1p, y2p);
    const segs = []; let s = a0; for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) { if (g0 > s) segs.push([s, g0]); s = Math.max(s, g1); } if (s < a1) segs.push([s, a1]);
    const conv = horiz ? X : Z; const line = horiz ? Z(y1p) : X(x1p);
    for (const [s0, s1] of segs) {
      const u0 = conv(s0) - (s0 === a0 ? t / 2 : 0), u1 = conv(s1) + (s1 === a1 ? t / 2 : 0);
      const len = u1 - u0, mid = (u0 + u1) / 2;
      if (horiz) { addGeo(c, boxGeo(len, h, t, mid, h / 2, line)); col(u0, u1, line - t / 2, line + t / 2, h, { wall: h >= 2.4 }); }
      else { addGeo(c, boxGeo(t, h, len, line, h / 2, mid)); col(line - t / 2, line + t / 2, u0, u1, h, { wall: h >= 2.4 }); }
    }
    if (h >= 2.4) for (const [g0, g1] of gaps) { // 門楣
      const u0 = conv(g0), u1 = conv(g1), mid = (u0 + u1) / 2, len = u1 - u0;
      if (horiz) addGeo(c, boxGeo(len, WH - 2.25, t, mid, (WH + 2.25) / 2, line)); else addGeo(c, boxGeo(t, WH - 2.25, len, line, (WH + 2.25) / 2, mid));
    }
  }
  // 實心區塊
  for (const [x1p, y1p, x2p, y2p, c] of SOLIDS) { const x1 = X(x1p), x2 = X(x2p), z1 = Z(y1p), z2 = Z(y2p);
    addGeo(c, boxGeo(x2 - x1, WH, z2 - z1, (x1 + x2) / 2, WH / 2, (z1 + z2) / 2)); col(x1, x2, z1, z2, WH, { wall: true }); }
  // 電梯門（核心北面）、貨梯門、機房門
  for (const x of [2.8, 3.9, 5.0]) { addGeo('#9eaab4', boxGeo(.95, 2.15, .04, x, 1.075, Z(740) - .02)); addGeo('#5f6b75', boxGeo(.02, 2.15, .05, x, 1.075, Z(740) - .03)); }
  addGeo('#9eaab4', boxGeo(.04, 2.0, 1.0, X(290) + .02, 1.0, Z(430))); addGeo('#78858f', boxGeo(1.0, 2.1, .04, X(1660), 1.05, Z(400) + .02));
  // 曲線（玻璃帷幕／矮花台／弧形長凳）
  const glassMat = new THREE.MeshStandardMaterial({ color: '#cfeff7', transparent: true, opacity: .26, roughness: .08, depthWrite: false });
  const glassGeos = [];
  for (const cv of CURVES) {
    const pts = cv.pts.map(([a, b]) => [X(a), Z(b)]); const th = cv.glass ? .12 : (cv.bench ? .5 : .26);
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx);
      const cx = (ax + bx) / 2, cz = (az + bz) / 2;
      if (cv.glass) { glassGeos.push(boxGeo(len + .02, cv.h, th, cx, cv.h / 2, cz, ry)); addGeo('#8fa1ad', boxGeo(.07, cv.h, .14, ax, cv.h / 2, az)); }
      else { addGeo(cv.col, boxGeo(len + .1, cv.h, th, cx, cv.h / 2, cz, ry)); if (!cv.bench) addGeo('#6fa15a', boxGeo(len, .14, th * .7, cx, cv.h + .07, cz, ry)); }
      const n = Math.max(1, Math.ceil(len / .22)); const hw = th / 2 + .04;
      for (let k = 0; k <= n; k++) { const px = ax + dx * k / n, pz = az + dz * k / n; col(px - hw, px + hw, pz - hw, pz + hw, cv.h, cv.glass ? { glass: true } : {}); }
    }
  }
  // 玻璃隔間（直線）
  for (const [x1p, y1p, x2p, y2p, gaps = []] of GLASS) {
    const horiz = y1p === y2p; const a0 = horiz ? x1p : y1p, a1 = horiz ? x2p : y2p; const conv = horiz ? X : Z; const line = horiz ? Z(y1p) : X(x1p);
    const segs = []; let s = a0; for (const [g0, g1] of gaps) { if (g0 > s) segs.push([s, g0]); s = g1; } if (s < a1) segs.push([s, a1]);
    for (const [s0, s1] of segs) { const u0 = conv(s0), u1 = conv(s1), mid = (u0 + u1) / 2, len = u1 - u0;
      if (horiz) { glassGeos.push(boxGeo(len, 2.3, .06, mid, 1.15, line)); col(u0, u1, line - .06, line + .06, WH, { glass: true }); addGeo('#8fa1ad', boxGeo(.06, WH, .1, u0, WH / 2, line)); addGeo('#8fa1ad', boxGeo(.06, WH, .1, u1, WH / 2, line)); }
      else { glassGeos.push(boxGeo(.06, 2.3, len, line, 1.15, mid)); col(line - .06, line + .06, u0, u1, WH, { glass: true }); addGeo('#8fa1ad', boxGeo(.1, WH, .06, line, WH / 2, u0)); addGeo('#8fa1ad', boxGeo(.1, WH, .06, line, WH / 2, u1)); }
    }
    const u0 = conv(a0), u1 = conv(a1), mid = (u0 + u1) / 2, len = u1 - u0; // 上框
    if (horiz) addGeo('#8fa1ad', boxGeo(len, WH - 2.3, .1, mid, (WH + 2.3) / 2, line)); else addGeo('#8fa1ad', boxGeo(.1, WH - 2.3, len, line, (WH + 2.3) / 2, mid));
  }
  if (glassGeos.length) { const gm = new THREE.Mesh(mergeGeometries(glassGeos), glassMat); gm.userData.kind = 'glass'; root.add(gm); wallMeshes.push(gm); }
  // 樓梯（可以一階一階走上去）
  for (const [x1p, y1p, x2p, y2p, dir, n] of STAIRS) {
    const x1 = X(x1p), x2 = X(x2p), z1 = Z(y1p), z2 = Z(y2p), rise = .27;
    for (let i = 0; i < n; i++) { const h = rise * (i + 1); let a, b, c, d;
      if (dir[0] === 'x') { const w = (x2 - x1) / n; const k = dir[1] === '+' ? i : n - 1 - i; a = x1 + w * k; b = a + w; c = z1; d = z2; }
      else { const w = (z2 - z1) / n; const k = dir[1] === '+' ? i : n - 1 - i; c = z1 + w * k; d = c + w; a = x1; b = x2; }
      addGeo(i % 2 ? '#a1887f' : '#bcaaa4', boxGeo(b - a, h, d - c, (a + b) / 2, h / 2, (c + d) / 2)); col(a, b, c, d, h);
    }
  }
  // 牆、樓梯等合併成 mesh
  for (const [c, geos] of geoBy) { const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ color: c, roughness: .9 }));
    mesh.castShadow = !LOW; mesh.receiveShadow = !LOW; mesh.userData.kind = 'wall'; root.add(mesh); wallMeshes.push(mesh); }
  // 地板
  const fl = new Map();
  for (const [x1p, y1p, x2p, y2p, c] of FLOORS) { if (x1p === x2p || y1p === y2p) continue; const x1 = X(x1p), x2 = X(x2p), z1 = Z(y1p), z2 = Z(y2p);
    if (!fl.has(c)) fl.set(c, []); fl.get(c).push(boxGeo(x2 - x1, .1, z2 - z1, (x1 + x2) / 2, -.05, (z1 + z2) / 2)); }
  for (const [c, geos] of fl) { const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ color: c, roughness: .92 })); mesh.receiveShadow = !LOW; mesh.userData.kind = 'floor'; root.add(mesh); wallMeshes.push(mesh); }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#a5cf8f' }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; ground.receiveShadow = true; ground.userData.kind = 'floor'; root.add(ground); wallMeshes.push(ground);
  // 天花板＋嵌燈面板
  const ceilMat = new THREE.MeshStandardMaterial({ color: '#fbf8f2', roughness: .95, side: THREE.DoubleSide });
  const panels = [];
  for (const [x1p, y1p, x2p, y2p] of CEILS) { const x1 = X(x1p), x2 = X(x2p), z1 = Z(y1p), z2 = Z(y2p);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), ceilMat); m.rotation.x = Math.PI / 2; m.position.set((x1 + x2) / 2, WH, (z1 + z2) / 2);
    m.userData.kind = 'ceiling'; root.add(m); wallMeshes.push(m); ceilings.push(m);
    for (let x = x1 + 1.4; x < x2 - .6; x += 2.8) for (let z = z1 + 1.3; z < z2 - .6; z += 2.6) panels.push(boxGeo(1.1, .03, .55, x, WH - .02, z)); }
  if (panels.length) { const pm = new THREE.Mesh(mergeGeometries(panels), new THREE.MeshBasicMaterial({ color: '#fff6e0' })); root.add(pm); ceilings.push(pm); }
  // 窗戶（窗框＋天空色玻璃）
  const winGeos = [], paneGeos = [];
  for (const w of WINDOWS) { const f = boxGeo(w.w + .15, 1.25, .06, 0, 0, 0); f.rotateY(w.ry); f.translate(w.x, 1.55, w.z); winGeos.push(f);
    const p = new THREE.PlaneGeometry(w.w, 1.1); p.translate(0, 0, .035); p.rotateY(w.ry); p.translate(w.x, 1.55, w.z); paneGeos.push(p); }
  root.add(new THREE.Mesh(mergeGeometries(winGeos), new THREE.MeshStandardMaterial({ color: '#ffffff' })));
  root.add(new THREE.Mesh(mergeGeometries(paneGeos), new THREE.MeshBasicMaterial({ color: '#dff4ff' })));
  // 戶外幾棵樹（兩翼之間的庭院）
  const treeG = [], leafG = [];
  for (const [x, z, s] of [[7.7, -5.5, 1.3], [7.4, 7.5, 1.2], [-20.5, 6.5, 1.4], [-16.5, 11.5, 1.2], [3.0, -12.5, 1.3], [-4.0, -12.0, 1.1], [14.0, -10.0, 1.2], [21.0, 2.0, 1.3]]) {
    const t = new THREE.CylinderGeometry(.12 * s, .16 * s, 1.1 * s, 6); t.translate(x, .55 * s, z); treeG.push(t);
    const l = new THREE.SphereGeometry(.7 * s, 10, 8); l.translate(x, 1.35 * s, z); leafG.push(l); }
  const tm = new THREE.Mesh(mergeGeometries(treeG), new THREE.MeshStandardMaterial({ color: '#8d6e4c' })); tm.castShadow = !LOW; root.add(tm);
  const lm = new THREE.Mesh(mergeGeometries(leafG), new THREE.MeshStandardMaterial({ color: '#6aa84f' })); lm.castShadow = !LOW; root.add(lm);
  // 燈光：明亮溫暖的辦公室
  root.add(new THREE.AmbientLight('#fff1dc', LOW ? .45 : .3));
  const n = LOW ? 0 : LIGHTS.length;
  for (const [x, z] of LIGHTS.slice(0, n)) { const l = new THREE.PointLight('#ffe2b8', 7, 12, 1.5); l.position.set(x, 2.4, z); root.add(l); }
}
