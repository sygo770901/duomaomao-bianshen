// 躲貓貓變身 – MVP。純靜態網站：Three.js 畫面 + PeerJS（建立房間的人的瀏覽器當主機）。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LocalPeer } from './localnet.js';
import * as OFFICE from './office.js';
import * as LUCKY from './lucky.js';
import { buildCompound } from './compound.js';

// ---------- 設定 ----------
const Q = new URLSearchParams(location.search);
const CFG = {
  HIDE_MS: (+Q.get('hide') || 30) * 1000,   // ?hide=  ?seek= 只給測試用（秒）
  SEEK_MS: (+Q.get('seek') || 180) * 1000,
  SEEK_MS_HOME: 180 * 1000,
  SEEK_MS_OFFICE: 300 * 1000,
  SEEK_MS_LUCKY: 240 * 1000, // 福貓辦公室：面積介於小家和新創辦公室之間 → 4 分鐘
  CHIRP_WINDOW: 60 * 1000, // 找人最後 1 分鐘開始發出聲響
  CHIRP_EVERY: 20 * 1000,
  NEAR_RANGE: 5, // 鬼附近提示最遠距離（世界單位＝公尺）
  NEAR_MID: 3,
  NEAR_CLOSE: 1,
  NEAR_HYST: 0.3, // 邊界滯後，避免在門檻來回閃爍
  SMASH_RANGE: 3, // 破壞技能半徑（公尺）
  SMASH_ANGLE: 60 * Math.PI / 180, // 水平半角 ±60°
  SMASH_VANGLE: 60 * Math.PI / 180, // 垂直半角 ±60°（從瞄準方向量到物件中心／最近点）
  SMASH_CD: 10000,
  SMASH_LOCK: 5000, // 被打回原形後不能變身的時間
  END_MS: 7000, MAX_PLAYERS: 8, HP: 100, MISS: 10, WALL_MISS: 2, MAX_TF: Infinity,
  TAUNT_CD: 9000, TAUNT_MS: 3500, // 躲藏者噴漆：冷卻 9 秒、糊住鬼畫面 3.5 秒
  SHOT_SPEED: 14, SHOT_CD: 600, SHOT_RANGE: 35, ROT_SPEED: 2.6,
  JUMP_V: 7.4, GRAVITY: 20, STEP_UP: .42, // 跳躍約 1.35 米，可踩上矮櫃／床／桌
  BODY_H: .8, // 角色碰撞身高（可從夠高的桌下穿過）
  PITCH_MIN: -80 * Math.PI / 180, PITCH_MAX: 70 * Math.PI / 180, // 可抬頭看天花板／櫃子頂
  SPRINT: 1.6, STAMINA: 3, STAMINA_REGEN: 4, STAMINA_DELAY: .5, STAMINA_RESTART: .3, // 衝刺 3 秒，停 0.5 秒後 4 秒回滿；耗盡要回到 30% 才能再衝
  TF_RANGE: 4.0, PREFIX: 'cozyhouse-prophunt-v1-',
};
const PeerImpl = Q.get('net') === 'local' ? LocalPeer : window.Peer; // ?net=local 只給自動化測試
function defaultHideMs() { return 30 * 1000; }
function defaultSeekMs(map) { return (map === 'office' ? CFG.SEEK_MS_OFFICE : map === 'lucky' ? CFG.SEEK_MS_LUCKY : CFG.SEEK_MS_HOME); }
function seekMsFor(map) {
  if (Q.get('seek')) return Math.max(1000, (+Q.get('seek') || 180) * 1000);
  return defaultSeekMs(map);
}
function roomHideMs() { return Q.get('hide') ? Math.max(1000, (+Q.get('hide') || 30) * 1000) : (H?.hideMs ?? defaultHideMs()); }
function roomSeekMs(map) { return Q.get('seek') ? seekMsFor(map) : (H?.seekMs ?? defaultSeekMs(map || H?.map)); }
function activeHideMs() { return Q.get('hide') ? CFG.HIDE_MS : (G.s?.hideMs || defaultHideMs()); }
function clampHideS(s) { s = Math.round((+s || 30) / 15) * 15; return Math.max(15, Math.min(90, s)); }
function clampSeekS(s) { s = Math.round((+s || 180) / 60) * 60; return Math.max(60, Math.min(600, s)); }
const S = 2.2; // Kenney 模型放大倍率
const COLORS = ['#ff8fa3', '#7ec8ff', '#ffd36e', '#a8e6cf', '#c3a6ff', '#ffb37e', '#7fe0d8', '#f7a1e0'];
const AVATARS = ['🐱', '🐶', '🐰', '🐻', '🐧', '🐥', '🦊', '🐼'];
const DIE_FACE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const CHAT_EMOJIS = ['😀', '😂', '👍', '❤️', '👻', '🪑', '🎲', '🎉', '😱', '👋'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SB_URL = 'https://fulzguhwckqbiitffbbo.supabase.co';
const SB_KEY = 'sb_publishable_Fl_QfdMozc-6EYZFLEOJkA_1mO_bSdl';
const IS_LOCAL_NET = Q.get('net') === 'local';
const $ = id => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const LOW = isTouch || Q.get('lowgfx') === '1'; // 省電畫質（手機）
if (isTouch) document.body.classList.add('touch');

// ---------- 地圖：三房兩廳一陽台兩衛浴的公寓（依參考平面圖 floorplan-map1）----------
// 俯視時上方 = -z。左半部是開放空間：玄關(左上) → 廚房(沿上牆) → 餐桌 → 客廳(電視牆在左) → 陽台(左下)
// 上排 (z -9~-3.5)：浴室1 x -3~0｜小臥室 x 0~5｜洗衣間 x 5~8｜主浴室(乾濕分離) x 8~14
// 走道 z -3.5~0.5（4 米寬）   下排 (z 0.5~9)：臥室 x -3~5｜主臥 x 5~14
// 可變身家具 [模型, x, z, 轉角(度), 高度y(放在桌櫃上的小物)]  轉角 0 = 正面朝 +z（朝下）
const CT = .99; // 流理台高度
const PROPS = [
  // 玄關：鞋櫃、穿鞋椅、衣帽架、盆栽
  ['shoeRack', -13.55, -7.2, 90], ['benchCushion', -13.6, -5.6, 90], ['coatRackStanding', -13.45, -8.45, 0], ['pottedPlant', -13.4, -4.4, 0],
  // 廚房（沿上牆一字型長廚房）：大冰箱 + 7 段流理台
  ['kitchenFridgeLarge', -10.4, -8.4, 0], ['kitchenCabinetDrawer', -9.355, -8.35, 0], ['kitchenCabinet', -8.405, -8.35, 0],
  ['kitchenSink', -7.455, -8.35, 0], ['kitchenCabinet', -6.505, -8.35, 0], ['kitchenStoveElectric', -5.555, -8.35, 0],
  ['kitchenCabinetDrawer', -4.605, -8.35, 0], ['kitchenCabinet', -3.655, -8.35, 0],
  ['kitchenCoffeeMachine', -9.355, -8.5, 0, CT], ['toaster', -8.405, -8.55, 0, CT], ['kitchenBlender', -6.505, -8.6, 0, CT],
  ['kitchenMicrowave', -3.655, -8.5, 0, CT], ['trashcan', -11.5, -8.5, 0],
  // 廚房餐具（可變身）
  ['mugSet', -9.35, -8.12, 0, CT], ['plateStack', -8.40, -8.12, 0, CT], ['cuttingBoard', -6.50, -8.12, 12, CT],
  ['cookingPot', -5.72, -8.35, 0, CT], ['fryingPan', -5.36, -8.25, 25, CT],
  ['kettle', -4.72, -8.45, -20, CT], ['sauceBottles', -4.42, -8.16, 0, CT], ['bowlStack', -3.65, -8.10, 0, CT],
  // 餐廳：吧台 + 長餐桌 + 4 張椅子 + 餐具
  ['kitchenBar', -8.45, -6.5, 180], ['kitchenBar', -7.5, -6.5, 180], ['table', -8.0, -4.4, 90],
  ['cupSet', -8.55, -6.50, 15, .924], ['plateStack', -7.95, -6.50, 0, .924], ['mugSet', -7.35, -6.50, -15, .924],
  ['plateStack', -8.18, -4.9, 0, .719], ['bowlStack', -7.82, -4.9, 10, .719], ['cupSet', -8.18, -3.9, -10, .719], ['sauceBottles', -7.82, -3.9, 25, .719],
  ['chairCushion', -8.95, -4.9, 90], ['chairCushion', -8.95, -3.9, 90], ['chairCushion', -7.05, -4.9, -90], ['chairCushion', -7.05, -3.9, -90],
  ['plantSmall1', -8.0, -4.4, 0, .72], ['pottedPlant', -3.5, -3.0, 0],
  // 客廳：電視牆在左、電視前玩具與電玩設備（可變身）、沙發在右、單椅、腳凳、邊桌、落地燈、書櫃
  ['cabinetTelevision', -13.6, 1.5, 90], ['televisionModern', -13.6, 1.5, 90, .68], ['speaker', -13.6, -0.2, 90], ['speaker', -13.6, 3.2, 90],
  ['gameConsole', -13.55, 0.84, 90, .682], ['handheldGame', -13.55, 2.16, 90, .682],
  ['gameController', -12.55, 1.15, 75], ['gameController', -12.45, 1.85, 110],
  ['toyBlocks', -12.15, 2.55, 20], ['plushToy', -12.15, 0.45, 65], ['toyCar', -11.65, 2.1, -35], ['toyBall', -11.65, 0.9, 0],
  ['loungeSofa', -5.2, 1.5, -90], ['pillowBlue', -5.05, 0.9, -90, .45], ['pillowBlue', -5.05, 2.1, -90, .45],
  ['tableCoffee', -8.6, 1.5, 90], ['loungeChair', -9.0, 4.6, 180], ['loungeSofaOttoman', -9.0, -1.6, 0],
  ['sideTable', -5.25, 3.35, 90], ['lampRoundTable', -5.25, 3.45, 0, .85], ['lampRoundFloor', -13.4, 5.3, 0],
  ['bookcaseClosedWide', -3.45, 5.2, -90], ['pottedPlant', -6.4, 5.5, 0],
  // 陽台：曬衣架靠左、小桌椅靠右（不擋落地門走道）、大小盆栽沿欄杆
  ['laundryRack', -12.35, 7.7, 15], ['loungeChairRelax', -8.15, 7.85, 200], ['sideTable', -9.05, 7.85, 20],
  ['pottedPlant', -13.45, 8.45, 0], ['pottedPlant', -6.55, 8.45, 0],
  ['plantSmall1', -13.5, 6.55, 0], ['plantSmall2', -10.4, 8.65, 0], ['plantSmall3', -7.35, 8.65, 0],
  // 浴室1（餐廳旁）：馬桶、洗手台、淋浴、毛巾架
  ['toilet', -2.3, -8.4, 0], ['bathroomSink', -0.7, -8.55, 0], ['showerRound', -0.75, -4.3, 0], ['towelRack', -2.7, -4.3, 90],
  // 小臥室：書桌在左上、單人床靠上牆、床頭櫃+檯燈（不再把落地燈塞在窗前）
  ['bedSingle', 3.8, -7.6, 0], ['desk', 1.2, -8.45, 0], ['chairDesk', 1.2, -7.35, 180], ['computerScreen', 1.2, -8.6, 0, .85],
  ['cabinetBedDrawerTable', 4.62, -8.48, 0], ['lampSquareTable', 4.62, -8.48, 0, .58],
  ['bookcaseOpenLow', 0.4, -5.2, 90], ['books', 0.4, -5.2, 90, .88],
  // 洗衣間：洗衣烘衣沿上牆；側牆置物架、洗衣籃、燙衣板、掃帚（不擋門）
  ['washer', 5.55, -8.45, 0], ['dryer', 6.45, -8.45, 0], ['bathroomCabinetDrawer', 7.38, -8.5, 0],
  ['detergent', 7.38, -8.55, 0, .62],
  ['laundryBasket', 5.28, -6.55, 90], ['laundryBasket', 5.28, -5.7, 90],
  ['shelfBoxes', 7.72, -7.05, -90], ['cardboardBoxOpen', 7.55, -6.15, -90],
  ['ironBoard', 7.78, -4.85, -90], ['broom', 5.28, -4.15, 90],
  // 主浴室（乾濕分離）：乾區 馬桶、浴櫃洗手台、毛巾架；濕區（玻璃隔間內）浴缸、淋浴
  ['toilet', 8.7, -8.4, 0], ['bathroomSinkSquare', 10.15, -8.5, 0], ['towelRack', 8.4, -5.6, 90], ['trashcan', 8.45, -7.2, 90],
  ['bathtub', 12.6, -8.3, 0], ['shower', 13.2, -5.6, -90],
  // 臥室（下中）：床頭靠右牆、兩側床頭櫃+檯燈、上方衣櫃、書桌靠下牆
  ['bedDouble', 3.6, 5.0, -90], ['cabinetBedDrawerTable', 4.6, 3.3, -90], ['cabinetBedDrawerTable', 4.6, 6.7, -90],
  ['lampSquareTable', 4.6, 3.3, 0, .58], ['lampSquareTable', 4.6, 6.7, 0, .58],
  ['bookcaseClosedDoors', 1.6, 1.0, 0], ['bookcaseClosedDoors', 2.5, 1.0, 0], ['desk', -1.0, 8.5, 180], ['chairDesk', -1.0, 7.4, 0],
  ['laptop', -1.0, 8.55, 180, .85], ['bookcaseOpenLow', -2.57, 5.0, 90], ['pottedPlant', -2.5, 8.4, 0],
  // 主臥（右下）：床頭靠左牆、床尾椅、右牆整排衣櫃、閱讀角
  ['bedDouble', 6.4, 5.0, 90], ['cabinetBedDrawerTable', 5.45, 3.2, 90], ['cabinetBedDrawerTable', 5.45, 6.8, 90],
  ['lampRoundTable', 5.45, 3.2, 90, .58], ['lampRoundTable', 5.45, 6.8, 90, .58], ['benchCushion', 8.15, 5.0, 90],
  ['bookcaseClosedDoors', 13.6, 2.2, -90], ['bookcaseClosedDoors', 13.6, 3.1, -90], ['bookcaseClosedDoors', 13.6, 4.0, -90],
  ['sideTableDrawers', 11.0, 8.6, 180], ['loungeChair', 12.6, 7.6, -140], ['lampRoundFloor', 13.4, 8.5, 0], ['pottedPlant', 13.4, 1.0, 0],
  // 主臥下牆空區（沙發椅左、分隔牆右）：靠牆書櫃，旁邊地上幾本書
  ['bookcaseFilled', 8.55, 8.72, 180], ['booksFloor', 7.45, 8.15, 28], ['booksFloor', 9.45, 8.22, -50],
  // 走道盡頭
  ['bookcaseOpenLow', 13.6, -1.5, -90], ['plantSmall3', 13.6, -1.5, 0, .88],
  // 牆上掛飾（可變身）：掛畫、時鐘、熊頭。變成它們會掛在原位，可沿牆面滑動，跳躍才落地
  ['frameA', -13.97, 1.5, 90, 2.1], ['frameB', -3.18, 5.2, -90, 2.05], ['clock', -13.97, -2.5, 90, 2.0],
  ['frameB', -3.18, -4.0, -90, 1.5], ['frameA', 11.0, 0.32, 180, 1.5], ['frameB', -1.0, -3.32, 0, 1.5], ['frameA', 12.7, -3.32, 0, 1.5],
  ['bear', 5.42, 5.0, 90, 1.6],
];
// 不能變身的裝飾（地毯、吊櫃、抽油煙機、鏡櫃）：[模型, x, z, 轉角, 高度y]
const DECOR = [
  ['rugDoormat', -12.6, -8.2, 0], ['rugRectangle', -8.6, 1.5, 90], ['rugSquare', -8.0, -4.4, 0], ['rugRound', 0.6, 5.0, 0],
  ['rugRound', 9.6, 5.0, 0], ['bathMat', 10.4, -5.0, 0],
  ['kitchenCabinetUpper', -9.355, -8.76, 0, 1.55], ['kitchenCabinetUpper', -8.405, -8.76, 0, 1.55], ['kitchenCabinetUpper', -7.455, -8.76, 0, 1.55],
  ['kitchenCabinetUpper', -6.505, -8.76, 0, 1.55], ['hoodModern', -5.555, -8.68, 0, 1.55], ['kitchenCabinetUpper', -4.605, -8.76, 0, 1.55],
  ['kitchenCabinetUpper', -3.655, -8.76, 0, 1.55],
  ['bathroomCabinet', 10.15, -8.85, 0, 1.45], ['bathroomCabinet', -0.7, -8.85, 0, 1.45],
  ['kitchenCabinetUpper', 5.55, -8.76, 0, 1.55], ['kitchenCabinetUpper', 6.45, -8.76, 0, 1.55], ['kitchenCabinetUpper', 7.38, -8.76, 0, 1.55],
];
const HOME_PROP_N = PROPS.length; // 0..HOME_PROP_N-1 = 家（原本的地圖），之後 = 辦公室
PROPS.push(...OFFICE.PROPS);
const LUCKY_START = PROPS.length; // 之後 = 福貓辦公室
PROPS.push(...LUCKY.PROPS);
const propMap = i => i < HOME_PROP_N ? 'home' : i < LUCKY_START ? 'office' : 'lucky';
const WALL_PROP = new Set(['frameA', 'frameB', 'clock', 'bear', ...OFFICE.OFFICE_WALL, ...LUCKY.LUCKY_WALL]);
// 窗戶在牆面上的禁區 [axis, pos, tCenter, yCenter, halfT, halfY]（掛飾不可滑進去）
let WINDOW_HOLES = [
  ['z', 8.98, 1.5, 1.55, .8, .55], ['z', 8.98, 11.0, 1.55, .8, .55],
  ['z', -8.98, 2.6, 1.55, .8, .55], ['z', -8.98, 12.6, 1.55, .8, .55],
  ['x', -13.98, -6.5, 1.55, .8, .55],
  ['z', -8.98, -12.6, 1.05, .62, 1.05], // 大門門板禁區
];
const LAMP_GLOW = { lampRoundFloor: .9, lampSquareFloor: .9, lampRoundTable: .85, lampSquareTable: .85, lampWall: .5 };
// 可被撞開、衝撞會翻倒的小物件（床、衣櫃、沙發、桌子、廚具、衛浴保持固定）
const SMALL = new Set(['chairCushion','chairDesk','stoolBar','loungeChair','loungeChairRelax','loungeSofaOttoman','sideTable',
  'plantSmall1','plantSmall2','plantSmall3','pottedPlant','cardboardBoxClosed','cardboardBoxOpen','books','booksFloor',
  'detergent','laundryBasket','broom','ironBoard','trashcan','pillowBlue','toaster','kitchenBlender','kitchenCoffeeMachine',
  'kitchenMicrowave','laptop','computerScreen','lampRoundTable','lampSquareTable','lampRoundFloor','lampSquareFloor',
  'speaker','coatRackStanding','laundryRack','towelRack','shoeRack','benchCushion',
  'gameConsole','handheldGame','gameController','toyBlocks','plushToy','toyCar','toyBall',
  'plateStack','bowlStack','cupSet','mugSet','cookingPot','fryingPan','cuttingBoard','kettle','sauceBottles', ...OFFICE.OFFICE_SMALL, ...LUCKY.LUCKY_SMALL]);
const SHELF_YS = { bookcaseFilled: [.46, .84, 1.22, 1.6], shelfBoxes: [.52, 1.0, 1.44] };
// 破壞技能打不破的大件：床、沙發、衣櫃／櫃子、桌子／書桌，以及大型家電與固定設備
const SMASH_IMMUNE = new Set([
  'bedSingle', 'bedDouble', 'bedBunk', 'loungeSofa',
  'desk', 'table', 'tableRound', 'kitchenBar', 'receptionDesk', 'confTable', 'pingPong',
  'bathroomCabinet', 'bathroomCabinetDrawer', 'cabinetBedDrawerTable', 'cabinetTelevision',
  'kitchenCabinet', 'kitchenCabinetDrawer', 'kitchenCabinetUpper', 'sideTableDrawers',
  'bookcaseClosedDoors', 'bookcaseClosedWide', 'bookcaseFilled', 'bookcaseOpenLow', 'bookcaseOpen', 'bookcaseClosed',
  'shelfBoxes', 'snackCabinet', 'filingCabinet', 'lockers',
  'kitchenFridgeLarge', 'kitchenFridgeSmall', 'washer', 'dryer',
  'bathtub', 'shower', 'showerRound', 'toilet', 'toiletSquare',
  'bathroomSink', 'bathroomSinkSquare', 'kitchenSink', 'kitchenStoveElectric', 'hoodModern',
  'televisionModern', 'piano', 'arcade', 'vendingMachine', ...LUCKY.LUCKY_IMMUNE,
]);
function canSmashProp(name) { return !!name && !SMASH_IMMUNE.has(name); }

let HIDER_SPAWNS = [[-7, 0], [-6.5, 2.8], [-10, 0], [-7.5, -1.5], [-11, 3], [-6.8, -0.5], [-10.5, -1.5], [-7, 3.5]];
let SEEKER_SPAWN = [7.1, -1.5];
let BOUNDS = { x1: -13.8, x2: 13.8, z1: -8.8, z2: 8.8 };
// 每個房間的燈（電腦全開，手機只開前 3 盞）
const ROOM_LIGHTS = [[-8.5, 1.5], [-7.5, -6.0], [5, -1.5], [-12.5, -7], [2.5, -6.2], [0.8, 4.8], [9.6, 4.8], [-1.5, -6.2], [11, -6.2], [6.5, -6.2], [-10, 7.6]];

// ---------- Three.js 場景 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !LOW;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('app').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#bfe6ff');
scene.fog = new THREE.Fog('#bfe6ff', 35, 70);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
const listener = new THREE.AudioListener();
camera.add(listener); scene.add(camera);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .9;
scene.add(new THREE.HemisphereLight('#ffe9cc', '#9c7a5c', 1.1)); // 溫暖柔和的環境光
const amb = new THREE.AmbientLight('#ffdcb0', LOW ? .55 : .25); scene.add(amb);
const sun = new THREE.DirectionalLight('#ffd9a8', 1.5); // 傍晚暖陽
sun.position.set(8, 20, 10); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.position.set(-10, 18, 14);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, far: 50 });
sun.shadow.bias = -0.0005;
scene.add(sun);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); placeHudCenter(); });

// 每張地圖各自一份：碰撞、牆面 mesh、可變身家具 mesh、天花板。切換地圖時整組換掉（另一張圖隱藏、完全不互動）
let colliders = [];   // {x1,x2,z1,z2}
let wallMeshes = [];  // 給鏡頭碰撞與點擊判定
let pickProps = [];   // 每個家具的 mesh
const propObjs = [];    // 家具 Group（index = prop id）
let houseCeiling = [];
const MAP_IDS = ['home', 'office', 'lucky'];
const MAP_NAMES = { home: '🏠 溫馨小家', office: '🏢 新創辦公室', lucky: '🐱 福貓辦公室・LUCKY CAT 總部' };
const MAPS = {
  home: { group: new THREE.Group(), colliders: [], wallMeshes: [], pickProps: [], ceilings: [], bounds: BOUNDS, holes: WINDOW_HOLES, hiders: HIDER_SPAWNS, seeker: SEEKER_SPAWN,
    seekers: [SEEKER_SPAWN, [5.5, -1.5]], sun: [-10, 18, 14], shadow: 16, lobbyAt: [-6, 3] },
  office: { group: new THREE.Group(), colliders: [], wallMeshes: [], pickProps: [], ceilings: [], bounds: OFFICE.BOUNDS, holes: OFFICE.WINDOW_HOLES, hiders: OFFICE.HIDER_SPAWNS, seeker: OFFICE.SEEKER_SPAWN,
    seekers: [OFFICE.SEEKER_SPAWN, [3.96, 1.15]], sun: [-12, 22, 16], shadow: 24, lobbyAt: [-6.2, 1.0] },
  lucky: { group: new THREE.Group(), colliders: [], wallMeshes: [], pickProps: [], ceilings: [], bounds: LUCKY.BOUNDS, holes: LUCKY.WINDOW_HOLES, hiders: LUCKY.HIDER_SPAWNS, seeker: LUCKY.SEEKER_SPAWN,
    seekers: [LUCKY.SEEKER_SPAWN, LUCKY.SEEKER_SPAWN2], sun: [-10, 24, 14], shadow: 18, lobbyAt: LUCKY.LOBBY_AT },
};
let ROOT = MAPS.home.group, curMap = 'home';
function useMap(id) { // 建圖時：把全域陣列指到這張圖
  const M = MAPS[id]; ROOT = M.group; colliders = M.colliders; wallMeshes = M.wallMeshes; pickProps = M.pickProps; houseCeiling = M.ceilings;
}
function setMap(id) {
  if (!MAPS[id]) id = 'home';
  const M = MAPS[id]; curMap = id; useMap(id);
  BOUNDS = M.bounds; WINDOW_HOLES = M.holes; HIDER_SPAWNS = M.hiders; SEEKER_SPAWN = M.seeker;
  for (const k of MAP_IDS) MAPS[k].group.visible = k === id;
  sun.position.set(...M.sun); Object.assign(sun.shadow.camera, { left: -M.shadow, right: M.shadow, top: M.shadow * .75, bottom: -M.shadow * .75 }); sun.shadow.camera.updateProjectionMatrix();
  target = null; if (typeof highlight !== 'undefined') highlight.visible = false;
}
for (const k of MAP_IDS) scene.add(MAPS[k].group);

function box(w, h, d, color, x, y, z, kind = 'wall') {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: .9 }));
  m.position.set(x, y, z); m.receiveShadow = true; m.castShadow = kind === 'wall';
  m.userData.kind = kind; ROOT.add(m); wallMeshes.push(m); return m;
}
function buildHouse() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#9bd68a' }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; ground.userData.kind = 'floor';
  ROOT.add(ground); wallMeshes.push(ground);
  const floor = (x1, x2, z1, z2, c) => box(x2 - x1, .1, z2 - z1, c, (x1 + x2) / 2, -.05, (z1 + z2) / 2, 'floor');
  floor(-14, -3, -9, 6, '#e0b98f');   // 玄關＋廚房＋餐廳＋客廳（開放空間，木地板）
  box(3, .1, 3.2, '#d8cfc4', -12.5, -.04, -7.4, 'floor'); // 玄關磁磚
  // 陽台戶外磁磚（一張重複貼圖，不額外增加很多 mesh）
  { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#8f989f'; x.fillRect(0, 0, 256, 256);
    [[4, 4, '#c5cdd3'], [132, 4, '#b7bfc6'], [4, 132, '#b0b8c0'], [132, 132, '#c9d0d6']].forEach(([u, v, col]) => { x.fillStyle = col; x.fillRect(u, v, 120, 120); });
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(8, 3);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), new THREE.MeshStandardMaterial({ map: tex, roughness: .92 }));
    fl.rotation.x = -Math.PI / 2; fl.position.set(-10, .015, 7.5); fl.receiveShadow = true; fl.userData.kind = 'floor'; ROOT.add(fl); wallMeshes.push(fl); }
  floor(-6, -3, 6, 9, '#e0b98f');
  floor(-3, 14, -3.5, 0.5, '#ead7bd'); // 走道（4 米寬）
  floor(-3, 0, -9, -3.5, '#c4e7ef');  // 浴室1
  floor(0, 5, -9, -3.5, '#d9c8f0');   // 小臥室
  floor(5, 8, -9, -3.5, '#e3e3e3');   // 洗衣間
  floor(8, 14, -9, -3.5, '#dfeff2');  // 主浴室 乾區
  box(3, .1, 4.4, '#a9d3dc', 12.5, -.04, -6.8, 'floor'); // 濕區磁磚
  floor(-3, 5, 0.5, 9, '#f6d1d8');    // 臥室
  floor(5, 14, 0.5, 9, '#d6e6c3');    // 主臥
  const T = .3, C = '#fff4e0';
  const wall = (x1, z1, x2, z2, H = 2.6, col = C) => {
    const w = Math.abs(x2 - x1) || T, d = Math.abs(z2 - z1) || T;
    box(w, H, d, col, (x1 + x2) / 2, H / 2, (z1 + z2) / 2);
    box(w + .04, .12, d + .04, '#f2b8a0', (x1 + x2) / 2, H + .06, (z1 + z2) / 2, 'trim');
    colliders.push({ x1: (x1 + x2) / 2 - w / 2, x2: (x1 + x2) / 2 + w / 2, z1: (z1 + z2) / 2 - d / 2, z2: (z1 + z2) / 2 + d / 2, y1: 0, y2: H, wall: true });
  };
  const glass = (x1, z1, x2, z2) => { // 浴室玻璃隔間
    const w = Math.abs(x2 - x1) || .06, d = Math.abs(z2 - z1) || .06;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2.1, d), new THREE.MeshStandardMaterial({ color: '#cfeff7', transparent: true, opacity: .28, roughness: .1, depthWrite: false }));
    m.position.set((x1 + x2) / 2, 1.05, (z1 + z2) / 2); m.userData.kind = 'glass'; ROOT.add(m); wallMeshes.push(m);
    box(w + .03, .05, d + .03, '#b0bec5', (x1 + x2) / 2, 2.12, (z1 + z2) / 2, 'trim');
    colliders.push({ x1: (x1 + x2) / 2 - w / 2, x2: (x1 + x2) / 2 + w / 2, z1: (z1 + z2) / 2 - d / 2, z2: (z1 + z2) / 2 + d / 2, y1: 0, y2: 2.1 });
  };
  // 外牆：陽台外緣改成 1.1 米矮欄杆，其餘維持實牆
  wall(-14.15, -9.15, 14.15, -9.15); // 上
  wall(-6, 9.15, 14.15, 9.15);       // 下（從陽台右牆開始）
  wall(-14.15, -9.15, -14.15, 6);    // 左（到陽台開始）
  wall(14.15, -9.15, 14.15, 9.15);   // 右
  box(1.2, 2.1, .08, '#a9744f', -12.6, 1.05, -8.98, 'wall'); // 大門（玄關，裝飾）
  // 陽台與客廳：兩側實牆 + 中間落地滑門（留走路缺口）
  wall(-14, 6, -12.5, 6); wall(-7.5, 6, -6, 6); wall(-6, 6, -6, 9.15);
  // 陽台矮欄杆（玻璃＋金屬立柱＋扶手，約 1.1 米）
  const railH = 1.1;
  const rail = (x1, z1, x2, z2) => {
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz) || .01;
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    const w = Math.abs(dx) || .06, d = Math.abs(dz) || .06;
    const n = Math.max(2, Math.round(len / .8) + 1);
    for (let i = 0; i < n; i++) { const t = i / (n - 1); box(.055, railH, .055, '#6d7a84', x1 + dx * t, railH / 2, z1 + dz * t, 'wall'); }
    const glassM = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(dx) || .04, .92, Math.abs(dz) || .04),
      new THREE.MeshStandardMaterial({ color: '#d7eef7', transparent: true, opacity: .28, roughness: .08, metalness: .15, depthWrite: false }));
    glassM.position.set(cx, .52, cz); glassM.userData.kind = 'glass'; ROOT.add(glassM); wallMeshes.push(glassM);
    box(w || .08, .05, d || .08, '#5c6770', cx, railH, cz, 'trim');
    colliders.push({ x1: cx - w / 2, x2: cx + w / 2, z1: cz - d / 2, z2: cz + d / 2, y1: 0, y2: railH });
  };
  rail(-14.15, 6.0, -14.15, 9.15); // 西
  rail(-14.15, 9.15, -6.0, 9.15);  // 南
  // 落地滑門：左右各一扇（略錯開軌道），中間約 1.6 米走道
  { const z = 6;
    box(5.1, .18, .14, '#eceff1', -10, 2.5, z, 'trim'); // 門楣
    box(5.0, .05, .24, '#90a4ae', -10, .03, z, 'trim'); // 門檻
    const pane = (x1, x2, zoff) => {
      const ww = x2 - x1, cx = (x1 + x2) / 2;
      const g = new THREE.Mesh(new THREE.BoxGeometry(ww - .04, 2.22, .04), new THREE.MeshStandardMaterial({ color: '#cfeff7', transparent: true, opacity: .32, roughness: .08, depthWrite: false }));
      g.position.set(cx, 1.16, z + zoff); g.userData.kind = 'glass'; ROOT.add(g); wallMeshes.push(g);
      box(ww, .04, .06, '#90a4ae', cx, 2.28, z + zoff, 'trim');
      box(ww, .04, .06, '#90a4ae', cx, .08, z + zoff, 'trim');
      box(.04, 2.22, .06, '#90a4ae', x1, 1.16, z + zoff, 'trim');
      box(.04, 2.22, .06, '#90a4ae', x2, 1.16, z + zoff, 'trim');
      box(.03, 2.22, .05, '#90a4ae', cx, 1.16, z + zoff, 'trim');
      colliders.push({ x1, x2, z1: z + zoff - .05, z2: z + zoff + .05, y1: 0, y2: 2.3 });
    };
    pane(-12.48, -10.55, .07);  // 靠客廳這一側
    pane(-8.95, -7.52, -.07);   // 靠陽台這一側
  }
  // 陽台外幾棵簡易樹木，讓欄杆看出去有景
  const tree = (x, z, s) => {
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(.12 * s, .16 * s, 1.1 * s, 6), new THREE.MeshStandardMaterial({ color: '#8d6e4c', roughness: .95 }));
    tr.position.set(x, .55 * s, z); tr.castShadow = true; ROOT.add(tr);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(.7 * s, 10, 8), new THREE.MeshStandardMaterial({ color: '#6aa84f', roughness: .9 }));
    leaf.position.set(x, 1.35 * s, z); leaf.castShadow = true; ROOT.add(leaf);
  };
  tree(-16.6, 11.2, 1.5); tree(-11.2, 13.0, 1.15); tree(-18.2, 7.2, 1.3); tree(-7.2, 12.4, 1.05); tree(-14.8, 14.2, .9);
  // x=-3：浴室1 左牆（門洞 z -7.5~-4.5 通餐廳）、臥室左牆
  wall(-3, -9, -3, -7.5); wall(-3, -4.5, -3, -3.5); wall(-3, 0.5, -3, 9);
  // 上排房間底牆 z=-3.5（門洞：小臥 x 1~4、洗衣 x 5.3~7.7、主浴 x 8.5~11.5）
  wall(-3, -3.5, 1, -3.5); wall(4, -3.5, 5.3, -3.5); wall(7.7, -3.5, 8.5, -3.5); wall(11.5, -3.5, 14, -3.5);
  for (const x of [0, 5, 8]) wall(x, -9, x, -3.5);
  // 下排房間頂牆 z=0.5（門洞：臥室 x -2.6~0.4、主臥 x 5.6~8.6）
  wall(-3, 0.5, -2.6, 0.5); wall(0.4, 0.5, 5.6, 0.5); wall(8.6, 0.5, 14, 0.5);
  wall(5, 0.5, 5, 9);
  // 主浴室乾濕分離：玻璃隔間（入口在 x=11, z -6~-4.6）
  glass(11, -8.85, 11, -6.0); glass(11, -4.6, 13.85, -4.6);
  // 窗戶 + 光束
  for (const [x, z, ry] of [[1.5, 8.98, 0], [11.0, 8.98, 0], [2.6, -8.98, 0], [12.6, -8.98, 0], [-13.98, -6.5, Math.PI / 2]]) addWindow(x, z, ry);
  addShaft(-10, 6.0, 0, 4.6); // 陽台落地門灑進來的光
  // 室內天花板（陽台上空著）。除錯俯視時會暫時隱藏，避免擋住房間
  const ceilMat = new THREE.MeshStandardMaterial({ color: '#fff4e0', roughness: .95, side: THREE.DoubleSide });
  const addCeil = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceilMat);
    m.rotation.x = Math.PI / 2; m.position.set(x, 2.72, z); m.userData.kind = 'ceiling'; ROOT.add(m); wallMeshes.push(m); houseCeiling.push(m);
  };
  addCeil(28.3, 15.2, 0, -1.5);       // 主體（到 z=6）
  addCeil(20.2, 3.2, 4, 7.5);         // 陽台右側室內
}
function addWindow(x, z, _r, w = 1.6, glassPane = true) {
  // 依位置判斷朝內的方向：下牆朝 -z、上牆朝 +z、左牆朝 +x
  const ry = Math.abs(x) > 13.5 ? Math.PI / 2 : z > 0 ? Math.PI : 0;
  const g = new THREE.Group(); g.position.set(x, 1.55, z); g.rotation.y = ry; ROOT.add(g);
  if (glassPane) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + .15, 1.25, .06), new THREE.MeshStandardMaterial({ color: '#ffffff' }));
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.1), new THREE.MeshBasicMaterial({ color: '#dff4ff' }));
    pane.position.z = .035; g.add(frame, pane);
  }
  // 光束：斜斜往室內地板灑
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(w, 2.6, .9), new THREE.MeshBasicMaterial({ color: '#fff1c2', transparent: true, opacity: .055, blending: THREE.AdditiveBlending, depthWrite: false }));
  shaft.position.set(0, -.55, .95); shaft.rotation.x = -.55; g.add(shaft);
}
function addShaft(x, z, _r, w) { addWindow(x, z, 0, w, false); }
function addLights() {
  const n = LOW ? 0 : 6; // 手機不開動態點光源（靠暖色環境光＋燈罩光暈），電腦開 6 盞
  ROOM_LIGHTS.slice(0, n).forEach(([x, z]) => { const l = new THREE.PointLight('#ffc98a', 7, 10, 1.6); l.position.set(x, 2.35, z); ROOT.add(l); });
}

// 套件裡沒有的東西，用簡單幾何自己做（曬衣架、毛巾架、鞋櫃、掛畫、時鐘、腳踏墊）
const PROC = [...OFFICE.OFFICE_PROC, ...LUCKY.LUCKY_PROC, 'laundryRack', 'towelRack', 'shoeRack', 'frameA', 'frameB', 'clock', 'bathMat', 'detergent', 'laundryBasket', 'ironBoard', 'broom', 'shelfBoxes', 'bookcaseFilled', 'booksFloor',
  'gameConsole', 'handheldGame', 'gameController', 'toyBlocks', 'plushToy', 'toyCar', 'toyBall',
  'plateStack', 'bowlStack', 'cupSet', 'mugSet', 'cookingPot', 'fryingPan', 'cuttingBoard', 'kettle', 'sauceBottles'];
const WALL_PROC = new Set(['frameA', 'frameB', 'clock', ...OFFICE.OFFICE_WALL, ...LUCKY.LUCKY_WALL]); // 掛牆的：y 是中心高度
function procModel(name) {
  const g = new THREE.Group(); const m = c => new THREE.MeshStandardMaterial({ color: c, roughness: .7 });
  const add = (w, h, d, c, x, y, z, rz = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m(c)); b.position.set(x, y, z); b.rotation.z = rz; b.castShadow = true; g.add(b); };
  if (name === 'laundryRack') {
    for (const x of [-.8, .8]) { add(.05, 1.35, .05, '#cfd8dc', x, .65, .25, 0); add(.05, 1.35, .05, '#cfd8dc', x, .65, -.25, 0); }
    for (const z of [-.25, .25]) add(1.65, .04, .04, '#cfd8dc', 0, 1.3, z);
    add(.42, .55, .03, '#ff8fa3', -.45, 1.0, .25); add(.36, .5, .03, '#7ec8ff', .1, 1.03, .25);
    add(.5, .7, .03, '#ffd36e', -.1, .94, -.25); add(.3, .3, .03, '#a8e6cf', .55, 1.13, -.25);
  } else if (name === 'shoeRack') { // 鞋櫃（上面放幾雙鞋）
    add(.95, .55, .35, '#d9b48c', 0, .275, 0); add(.9, .02, .3, '#c49a6c', 0, .3, .02);
    [['#ff8fa3', -.3], ['#7ec8ff', -.05], ['#ffd36e', .22]].forEach(([c, x]) => { add(.11, .08, .26, c, x - .06, .6, 0); add(.11, .08, .26, c, x + .06, .6, 0); });
  } else if (name === 'frameA' || name === 'frameB') { // 掛畫
    const A = name === 'frameA'; add(A ? .9 : .6, A ? .6 : .75, .04, '#8d6e63', 0, 0, 0);
    add(A ? .8 : .5, A ? .5 : .65, .02, A ? '#9ad0ec' : '#f7c6a3', 0, 0, .025);
    add(A ? .5 : .3, A ? .18 : .3, .01, A ? '#7fbf7f' : '#ff8fa3', A ? -.1 : 0, A ? -.12 : .05, .04);
  } else if (name === 'clock') {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .05, 24), m('#ffffff')); c.rotation.x = Math.PI / 2; g.add(c);
    const r = new THREE.Mesh(new THREE.TorusGeometry(.22, .025, 8, 24), m('#ff8fa3')); g.add(r);
    add(.02, .14, .01, '#333', 0, .06, .035); add(.1, .02, .01, '#333', .05, 0, .035);
  } else if (name === 'bathMat') { add(.9, .02, .55, '#ffb3c1', 0, .01, 0);
  } else if (name === 'towelRack') {
    add(.6, .05, .3, '#b0bec5', 0, .03, 0); add(.05, 1.3, .05, '#b0bec5', -.25, .65, 0); add(.05, 1.3, .05, '#b0bec5', .25, .65, 0);
    add(.6, .04, .04, '#b0bec5', 0, 1.25, 0); add(.26, .7, .06, '#7fe0d8', -.12, .92, 0); add(.24, .6, .06, '#ffb37e', .14, .97, .02);
  } else if (name === 'detergent') { // 洗衣精／柔軟精瓶子（一組）
    const bot = (x, h, r, body, cap) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 10), m(body)); b.position.set(x, h / 2, 0); g.add(b);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(r * .45, r * .5, .07, 8), m(cap)); c.position.set(x, h + .03, 0); g.add(c);
    };
    bot(-.12, .28, .055, '#4fc3f7', '#1565c0'); bot(.02, .22, .045, '#81c784', '#2e7d32'); bot(.15, .2, .04, '#ffb74d', '#ef6c00');
  } else if (name === 'laundryBasket') { // 圓形洗衣籃，裡面有幾件衣服
    const bask = m('#e8a15a');
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(.22, .2, .3, 16, 1, true), bask); wall.position.y = .18; g.add(wall);
    const bot = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .03, 16), bask); bot.position.y = .03; g.add(bot);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.22, .016, 8, 16), m('#d4894a')); rim.rotation.x = Math.PI / 2; rim.position.y = .33; g.add(rim);
    add(.18, .05, .14, '#7ec8ff', 0, .28, 0, .4); add(.15, .04, .12, '#ff8fa3', .03, .32, .02, -.3);
  } else if (name === 'ironBoard') { // 折起來靠牆的燙衣板
    add(1.22, .05, .36, '#d8c8a8', 0, 1.05, 0); // 板面（直立、略離地）
    add(.05, 1.0, .05, '#90a4ae', -.45, .5, .12); add(.05, 1.0, .05, '#90a4ae', .45, .5, .12);
    add(.05, .7, .05, '#90a4ae', -.45, .35, -.1); add(.05, .7, .05, '#90a4ae', .45, .35, -.1);
    add(.16, .08, .1, '#78909c', .2, 1.12, 0); // 熨斗停放處
  } else if (name === 'broom') {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(.018, .02, 1.15, 8), m('#a1887f')); stick.position.set(0, .85, 0); g.add(stick);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, .28, 10), m('#c4a574')); head.position.set(0, .2, 0); g.add(head);
    add(.04, .04, .04, '#6d4c41', 0, 1.44, 0);
  } else if (name === 'shelfBoxes') { // 置物架，架上有紙箱與雜物
    add(.7, .04, .32, '#c8a882', 0, .02, 0); add(.7, .04, .32, '#c8a882', 0, .5, 0); add(.7, .04, .32, '#c8a882', 0, .98, 0); add(.7, .04, .32, '#c8a882', 0, 1.42, 0);
    add(.04, 1.42, .32, '#c8a882', -.33, .71, 0); add(.04, 1.42, .32, '#c8a882', .33, .71, 0); add(.04, 1.42, .3, '#c8a882', 0, .71, -.14);
    add(.28, .22, .22, '#c4a574', -.12, .15, 0); add(.22, .2, .2, '#b08968', .16, .14, .02);
    add(.24, .2, .2, '#d2b48c', -.1, .64, 0); add(.18, .16, .16, '#a5845c', .16, .62, .02);
    add(.2, .18, .18, '#c4a574', 0, 1.11, 0);
  } else if (name === 'bookcaseFilled') { // 靠牆開放書櫃，架子上排滿書
    const W = 1.55, D = .32, H = 1.82;
    add(W, .05, D, '#b08968', 0, .025, 0); add(W, .05, D, '#b08968', 0, H - .025, 0);
    add(.05, H, D, '#b08968', -W / 2 + .025, H / 2, 0); add(.05, H, D, '#b08968', W / 2 - .025, H / 2, 0);
    add(W - .04, H - .04, .03, '#a07858', 0, H / 2, -D / 2 + .02); // 背板
    for (const y of [.42, .8, 1.18, 1.56]) add(W - .06, .04, D - .02, '#b08968', 0, y, 0);
    const cols = ['#c0392b', '#2471a3', '#1e8449', '#7d3c98', '#b9770e', '#1a5276', '#922b21', '#196f3d', '#6c3483', '#af601a', '#5d6d7e', '#1abc9c'];
    const shelves = [.05, .44, .82, 1.2, 1.58];
    shelves.forEach((y0, si) => {
      let x = -W / 2 + .1;
      let k = si * 5;
      while (x < W / 2 - .12) {
        const bw = .05 + ((k * 7) % 5) * .012, bh = .26 + ((k * 3) % 6) * .02, bc = cols[k % cols.length];
        add(bw, bh, .18, bc, x + bw / 2, y0 + bh / 2, .02);
        if (k % 9 === 0) add(.16, .04, .2, cols[(k + 3) % cols.length], x + .1, y0 + .04, .03); // 偶爾一本橫放
        x += bw + .012; k++;
      }
    });
  } else if (name === 'booksFloor') { // 地上攤著／疊著的幾本書
    add(.28, .04, .2, '#2471a3', 0, .02, 0, .2); add(.26, .04, .18, '#c0392b', .05, .06, .04, -.3);
    add(.24, .035, .17, '#1e8449', -.04, .1, -.02, .5);
  } else if (name === 'gameConsole') { // 電視遊戲機
    add(.34, .08, .24, '#eceff1', 0, .05, 0); add(.3, .06, .2, '#263238', 0, .055, .01);
    const led = new THREE.Mesh(new THREE.BoxGeometry(.26, .015, .015), new THREE.MeshBasicMaterial({ color: '#40c4ff' })); led.position.set(0, .07, .12); g.add(led);
    add(.22, .02, .18, '#455a64', 0, .01, 0);
  } else if (name === 'handheldGame') { // 掌上型電玩
    add(.26, .03, .12, '#4dd0e1', 0, .015, 0); add(.13, .008, .085, '#263238', 0, .032, 0);
    add(.035, .012, .035, '#37474f', -.09, .032, 0); add(.018, .012, .018, '#ff5252', .09, .032, -.02); add(.018, .012, .018, '#ffd740', .11, .032, .01);
  } else if (name === 'gameController') { // 電玩手把
    add(.22, .04, .11, '#263238', 0, .035, 0);
    add(.06, .045, .1, '#37474f', -.09, .025, .04, .25); add(.06, .045, .1, '#37474f', .09, .025, .04, -.25);
    add(.035, .015, .035, '#cfd8dc', -.06, .058, -.01); add(.018, .015, .018, '#4fc3f7', .06, .058, -.025);
    add(.018, .015, .018, '#ff8a65', .08, .058, 0); add(.018, .015, .018, '#81c784', .06, .058, .025);
  } else if (name === 'toyBlocks') { // 彩色積木堆
    add(.12, .12, .12, '#ef5350', -.08, .06, .03); add(.12, .12, .12, '#42a5f5', .07, .06, -.02);
    add(.12, .12, .12, '#ffca28', -.01, .18, 0, .15); add(.1, .1, .1, '#66bb6a', .01, .29, .02, -.2);
  } else if (name === 'plushToy') { // 可愛玩偶熊
    const fur = m('#f4a6b8'), ear = m('#ffd3df');
    const bod = new THREE.Mesh(new THREE.SphereGeometry(.14, 14, 12), fur); bod.scale.set(1, 1.15, .9); bod.position.y = .14; g.add(bod);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(.12, 14, 12), fur); hd.position.y = .33; g.add(hd);
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 8), ear); e.position.set(sx * .095, .43, 0); g.add(e);
      const ey = new THREE.Mesh(new THREE.SphereGeometry(.016, 8, 8), m('#2b2b2b')); ey.position.set(sx * .045, .35, .105); g.add(ey);
      const ft = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 8), fur); ft.position.set(sx * .08, .045, .07); g.add(ft);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(.025, 8, 8), m('#fff5f7')); nose.position.set(0, .315, .115); g.add(nose);
  } else if (name === 'toyCar') { // 玩具小車
    add(.3, .07, .16, '#ef5350', 0, .065, 0); add(.16, .06, .13, '#4fc3f7', -.02, .125, 0);
    add(.05, .02, .15, '#ffd54f', -.14, .11, 0);
    for (const sx of [-.095, .095]) for (const sz of [-.085, .085]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .03, 12), m('#263238')); w.rotation.x = Math.PI / 2; w.position.set(sx, .04, sz); g.add(w);
    }
  } else if (name === 'toyBall') { // 彩色遊戲球
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d');
    ['#ff5252', '#ffeb3b', '#40c4ff', '#69f0ae', '#ff5252', '#ffeb3b'].forEach((col, i) => { x.fillStyle = col; x.fillRect(i * 22, 0, 22, 64); });
    const sp = new THREE.Mesh(new THREE.SphereGeometry(.16, 18, 14), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), roughness: .5 }));
    sp.position.y = .16; sp.castShadow = true; g.add(sp);
  } else if (name === 'plateStack') { // 疊起的餐盤
    for (let i = 0; i < 4; i++) {
      const p0 = new THREE.Mesh(new THREE.CylinderGeometry(.14, .11, .016, 18), m(i % 2 ? '#ffffff' : '#e3f2fd')); p0.position.y = .012 + i * .022; p0.castShadow = true; g.add(p0);
    }
  } else if (name === 'bowlStack') { // 疊起的飯碗
    for (let i = 0; i < 3; i++) {
      const bw = new THREE.Mesh(new THREE.CylinderGeometry(.095, .055, .055, 16), m(i === 2 ? '#ffe082' : '#fff8e1')); bw.position.y = .03 + i * .032; bw.castShadow = true; g.add(bw);
    }
  } else if (name === 'cupSet') { // 一組玻璃水杯
    for (const [cx, cz, col] of [[-.07, -.03, '#b3e5fc'], [.06, .03, '#b2dfdb'], [-.01, .07, '#ffe0b2']]) {
      const cp = new THREE.Mesh(new THREE.CylinderGeometry(.04, .033, .11, 14), m(col)); cp.position.set(cx, .055, cz); cp.castShadow = true; g.add(cp);
    }
  } else if (name === 'mugSet') { // 馬克杯組
    for (const [cx, col] of [[-.08, '#ff8fa3'], [.07, '#7ec8ff']]) {
      const mg = new THREE.Mesh(new THREE.CylinderGeometry(.048, .045, .105, 14), m(col)); mg.position.set(cx, .052, 0); mg.castShadow = true; g.add(mg);
      const hd = new THREE.Mesh(new THREE.TorusGeometry(.032, .009, 8, 12), m(col)); hd.position.set(cx + .048, .055, 0); g.add(hd);
    }
  } else if (name === 'cookingPot') { // 湯鍋
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(.145, .135, .14, 18), m('#b0bec5')); pot.position.y = .07; pot.castShadow = true; g.add(pot);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(.14, .145, .025, 18), m('#cfd8dc')); lid.position.y = .15; g.add(lid);
    add(.04, .03, .04, '#546e7a', 0, .175, 0); add(.04, .02, .05, '#546e7a', -.16, .1, 0); add(.04, .02, .05, '#546e7a', .16, .1, 0);
  } else if (name === 'fryingPan') { // 平底鍋
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(.155, .14, .045, 18), m('#455a64')); pan.position.y = .025; pan.castShadow = true; g.add(pan);
    add(.22, .022, .032, '#6d4c41', .23, .04, 0, .15);
  } else if (name === 'cuttingBoard') { // 木砧板＋刀
    add(.36, .024, .24, '#d7a86e', 0, .012, 0); add(.08, .024, .06, '#d7a86e', .21, .012, 0);
    add(.16, .01, .035, '#cfd8dc', -.03, .03, .02, .05); add(.08, .016, .024, '#5d4037', .08, .03, .03);
  } else if (name === 'kettle') { // 熱水壺
    const bd = new THREE.Mesh(new THREE.CylinderGeometry(.085, .1, .19, 16), m('#eceff1')); bd.position.y = .095; bd.castShadow = true; g.add(bd);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(.065, .085, .03, 16), m('#607d8b')); top.position.y = .205; g.add(top);
    add(.04, .07, .02, '#455a64', .09, .11, 0); add(.06, .04, .025, '#cfd8dc', -.09, .15, 0, .5);
  } else if (name === 'sauceBottles') { // 調味料瓶組
    for (const [bx, bh, br, bc, cc] of [[-.07, .2, .035, '#8d6e63', '#4e342e'], [.01, .18, .032, '#ffd54f', '#f57f17'], [.08, .16, .03, '#ef5350', '#b71c1c']]) {
      const bt = new THREE.Mesh(new THREE.CylinderGeometry(br, br * 1.05, bh, 12), m(bc)); bt.position.set(bx, bh / 2, 0); bt.castShadow = true; g.add(bt);
      const cp = new THREE.Mesh(new THREE.CylinderGeometry(br * .5, br * .55, .04, 10), m(cc)); cp.position.set(bx, bh + .02, 0); g.add(cp);
    }
  } else if (LUCKY.LUCKY_PROC.includes(name)) LUCKY.luckyProc(THREE, name, g, add, m);
  else OFFICE.officeProc(THREE, name, g, add, m);
  g.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(g); if (!WALL_PROC.has(name)) g.position.y = -bb.min.y;
  return { obj: g, size: bb.getSize(new THREE.Vector3()) };
}

const loader = new GLTFLoader();
const modelCache = {};
async function loadModels() {
  for (const n of PROC) { const r = procModel(n); modelCache[n] = { obj: flattenModel(r.obj), size: r.size }; }
  const names = [...new Set([...PROPS, ...DECOR, ...OFFICE.DECOR, ...LUCKY.DECOR].map(p => p[0]))].filter(n => !modelCache[n]);
  await Promise.all(names.map(n => new Promise((res, rej) => loader.load(`models/${n}.glb`, g => {
    const inner = g.scene; inner.scale.setScalar(S); inner.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(inner); const c = bb.getCenter(new THREE.Vector3());
    inner.position.set(-c.x, -bb.min.y, -c.z);
    inner.traverse(o => { if (o.isMesh) { o.castShadow = !LOW; o.receiveShadow = !LOW;
      if (LOW) o.material = new THREE.MeshLambertMaterial({ color: o.material.color, map: o.material.map, name: o.material.name }); } });
    modelCache[n] = { obj: flattenModel(inner), size: bb.getSize(new THREE.Vector3()) }; res();
  }, undefined, rej))));
}
// 效能：把一個模型的多個 mesh 依材質種類合併成 1~3 個（顏色改存在頂點色），大幅減少 draw call，外觀不變
function flattenModel(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map(); const keep = [];
  root.traverse(o => { if (!o.isMesh) return; const mt = o.material;
    if (Array.isArray(mt) || mt.map || !o.geometry.attributes.normal) { keep.push(o); return; }
    const lamp = /lamp|light|bulb|shade/i.test(mt.name || '');
    const key = `${mt.type}|${mt.transparent}|${mt.opacity}|${mt.roughness}|${mt.metalness}|${lamp ? 'lamp' : ''}|${mt.side}`;
    if (!groups.has(key)) groups.set(key, { mat: mt, geos: [] });
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = mt.color.r; c[i * 3 + 1] = mt.color.g; c[i * 3 + 2] = mt.color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); groups.get(key).geos.push(g);
  });
  const out = new THREE.Group(); out.position.copy(root.position); out.quaternion.copy(root.quaternion); out.scale.copy(root.scale);
  for (const { mat, geos } of groups.values()) {
    const m2 = mat.clone(); m2.vertexColors = true; m2.color = new THREE.Color(1, 1, 1);
    const geo = mergeGeometries(geos); // 座標已換到 root 本地（root 的縮放由 out 帶）
    const mesh = new THREE.Mesh(geo, m2); mesh.castShadow = !LOW; mesh.receiveShadow = !LOW; out.add(mesh);
  }
  for (const o of keep) { const c = o.clone(); c.matrixAutoUpdate = true; new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld).decompose(c.position, c.quaternion, c.scale); out.add(c); }
  return out;
}
function makeModel(name) { const g = new THREE.Group(); g.add(modelCache[name].obj.clone(true)); return g; }
function tagMeshes(root, data) { root.traverse(o => { if (o.isMesh) Object.assign(o.userData, data); }); }

let glowTex = null;
function addGlow(g, name, isDisguise = false) { // 燈具發光：光暈＋自發光＋點光源（變身成燈也會帶著燈光）
  const h = LAMP_GLOW[name]; if (!h) return;
  if (!glowTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,236,190,1)'); gr.addColorStop(.35, 'rgba(255,214,150,.55)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(c); }
  const ly = modelCache[name].size.y * h;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sp.scale.setScalar(name === 'lampWall' ? .7 : .95); sp.material.opacity = .8; sp.position.y = ly; sp.raycast = () => { }; g.add(sp);
  if (isDisguise || !LOW) {
    const pt = new THREE.PointLight('#ffd296', isDisguise ? 4.0 : 2.2, 6.5, 1.6);
    pt.position.set(0, ly, 0); g.add(pt);
  }
  g.traverse(o => { if (o.isMesh && /lamp|light|bulb|shade/i.test(o.material?.name || '')) { o.material = o.material.clone(); o.material.emissive = new THREE.Color('#ffd08a'); o.material.emissiveIntensity = .85; } });
}
const _c8 = new THREE.Vector3();
function worldColsFrom(g, locals) {
  g.updateMatrixWorld(true);
  const m = g.matrixWorld;
  return locals.map(b => {
    let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity, z1 = Infinity, z2 = -Infinity;
    for (const x of [b.x1, b.x2]) for (const y of [b.y1, b.y2]) for (const z of [b.z1, b.z2]) {
      _c8.set(x, y, z).applyMatrix4(m);
      if (_c8.x < x1) x1 = _c8.x; if (_c8.x > x2) x2 = _c8.x;
      if (_c8.y < y1) y1 = _c8.y; if (_c8.y > y2) y2 = _c8.y;
      if (_c8.z < z1) z1 = _c8.z; if (_c8.z > z2) z2 = _c8.z;
    }
    return { x1, x2, y1, y2, z1, z2 };
  });
}
function syncPropCols(g) {
  const locals = g.userData.localCols; if (!locals || !locals.length) return;
  const world = worldColsFrom(g, locals);
  const cols = g.userData.cols;
  if (cols && cols.length === world.length) {
    for (let i = 0; i < cols.length; i++) { const w = world[i]; cols[i].x1 = w.x1; cols[i].x2 = w.x2; cols[i].y1 = w.y1; cols[i].y2 = w.y2; cols[i].z1 = w.z1; cols[i].z2 = w.z2; }
  }
}
function bakeCompounds() {
  for (const n of Object.keys(modelCache)) {
    const m = modelCache[n]; if (m.cols) continue;
    const g = makeModel(n); g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.updateMatrixWorld(true);
    try { m.cols = buildCompound(n, g, m.size, THREE); }
    catch (e) { m.cols = null; }
  }
}
function placeProps() {
  PROPS.forEach(([n, x, z, r, y = 0], i) => {
    useMap(propMap(i)); const g = makeModel(n); g.userData.map = propMap(i); g.position.set(x, y, z); g.rotation.y = r * Math.PI / 180; addGlow(g, n);
    tagMeshes(g, { kind: 'prop', id: i }); ROOT.add(g); propObjs[i] = g;
    g.traverse(o => o.isMesh && pickProps.push(o));
    const sz = modelCache[n].size;
    g.userData.height = sz.y; g.userData.radius = Math.max(sz.x, sz.z) / 2; g.userData.small = SMALL.has(n); g.userData.baseY = y;
    if (y === 0) {
      const locals = (modelCache[n].cols && modelCache[n].cols.length) ? modelCache[n].cols.map(b => ({ ...b })) : null;
      g.userData.localCols = locals;
      if (locals) {
        const cols = worldColsFrom(g, locals).map(w => ({ ...w, prop: i, small: SMALL.has(n) }));
        for (const c of cols) colliders.push(c);
        g.userData.cols = cols; g.userData.col = cols[0];
      } else {
        g.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(g);
        const pad = sz.y > .45 ? .08 : .02;
        const col = { x1: bb.min.x + pad, x2: bb.max.x - pad, z1: bb.min.z + pad, z2: bb.max.z - pad, y1: 0, y2: sz.y, prop: i, small: SMALL.has(n) };
        colliders.push(col); g.userData.col = col; g.userData.cols = [col];
      }
      const col0 = g.userData.col;
      let shelves = (SHELF_YS[n] || []).map(sy => ({ x1: col0.x1, x2: col0.x2, z1: col0.z1, z2: col0.z2, y: sy, needSmall: true }));
      if (!shelves.length && g.userData.cols) {
        shelves = g.userData.cols.filter(c => (c.y2 - (c.y1 || 0)) < .18 && (c.x2 - c.x1) * (c.z2 - c.z1) > .04)
          .map(c => ({ x1: c.x1, x2: c.x2, z1: c.z1, z2: c.z2, y: c.y2, needSmall: true }));
      }
      g.userData.shelves = shelves;
    }
  });
  for (const [id, list] of [['home', DECOR], ['office', OFFICE.DECOR], ['lucky', LUCKY.DECOR]]) { useMap(id);
    list.forEach(([n, x, z, r, y = 0]) => {
      const g = makeModel(n); g.position.set(x, y, z); g.rotation.y = r * Math.PI / 180; addGlow(g, n);
      tagMeshes(g, { kind: 'deco' }); ROOT.add(g); g.traverse(o => o.isMesh && wallMeshes.push(o));
    }); }
  setMap(curMap);
}

// ---------- 角色外觀（簡單幾何的可愛小人）----------
function makeLabel(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 7; x.strokeStyle = 'rgba(0,0,0,.55)'; x.strokeText(text, 128, 34); x.fillStyle = color; x.fillText(text, 128, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  s.scale.set(1.4, .35, 1); s.renderOrder = 10; return s;
}
function makeNote() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d');
  x.font = '96px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🎵', 64, 70);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  s.scale.set(.9, .9, 1); s.renderOrder = 11; s.visible = false; return s;
}
function makeBuddy(color, seeker) {
  const g = new THREE.Group(); const m = c => new THREE.MeshStandardMaterial({ color: c, roughness: .6 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.32, .3, 6, 16), m(color)); body.position.y = .5; g.add(body);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.085, 12, 12), m('#ffffff')); eye.position.set(sx * .12, .66, .27); g.add(eye);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 10), m('#2b2b2b')); pu.position.set(sx * .12, .66, .345); g.add(pu);
    const ch = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 8), m('#ff9fb0')); ch.position.set(sx * .2, .55, .27); ch.scale.z = .4; g.add(ch);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(.1, 10, 10), m(color)); foot.position.set(sx * .14, .07, .05); foot.scale.set(1, .6, 1.3); g.add(foot);
  }
  if (seeker) { // 偵探帽
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(.38, .38, .04, 20), m('#6b4a35')); brim.position.y = .96; g.add(brim);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(.22, .25, .25, 20), m('#6b4a35')); top.position.y = 1.1; g.add(top);
    const gun = new THREE.Group(); gun.name = 'gun'; // 顏料槍
    const tank = new THREE.Mesh(new THREE.SphereGeometry(.13, 14, 12), m('#ff5d8f')); tank.position.set(0, .16, -.05); gun.add(tank);
    const bodyG = new THREE.Mesh(new THREE.BoxGeometry(.12, .14, .34), m('#7ec8ff')); gun.add(bodyG);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.04, .055, .3, 12), m('#ffd36e')); barrel.rotation.x = Math.PI / 2; barrel.position.z = .3; gun.add(barrel);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(.08, .16, .08), m('#6b4a35')); grip.position.set(0, -.12, -.06); gun.add(grip);
    gun.position.set(.38, .52, .22); g.add(gun);
    g.scale.setScalar(.62);
  } else {
    g.scale.setScalar(.45);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------- 顏料噴濺音效（WebAudio 即時合成，取代舊的嘲諷怪聲）----------
let splatBuf = null;
function getSplatSound() {
  if (splatBuf) return splatBuf;
  const ctx = listener.context, sr = ctx.sampleRate, n = Math.floor(.3 * sr);
  const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) { const t = i / sr; const env = Math.min(1, t * 90) * Math.exp(-t * 16);
    d[i] = ((Math.random() * 2 - 1) * .55 + Math.sin(2 * Math.PI * (200 - t * 280) * t) * .3) * env; }
  return splatBuf = buf;
}
function playSplatAt(x, y, z) {
  try {
    const o = new THREE.Object3D(); o.position.set(x, y, z); scene.add(o);
    const a = new THREE.PositionalAudio(listener); a.setRefDistance(5); a.setRolloffFactor(1.1);
    a.setBuffer(getSplatSound()); o.add(a); a.play(); a.onEnded = () => { a.isPlaying = false; scene.remove(o); };
  } catch (e) { /* 自動播放政策或尚未解鎖音訊時略過 */ }
}
let chirpBuf = null;
const chirpPulses = [];
function getChirpSound() {
  if (chirpBuf) return chirpBuf;
  const ctx = listener.context, sr = ctx.sampleRate, n = Math.floor(.2 * sr);
  const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const t = i / sr, env = Math.min(1, t * 90) * Math.exp(-t * 18);
    d[i] = Math.sin(2 * Math.PI * (880 + 520 * t) * t) * env * .75;
  }
  return chirpBuf = buf;
}
function playChirpAt(x, y, z) {
  if (me()?.role !== 'seeker') return;
  try {
    const o = new THREE.Object3D(); o.position.set(x, y, z); scene.add(o);
    const a = new THREE.PositionalAudio(listener); a.setRefDistance(6); a.setRolloffFactor(1.15);
    a.setBuffer(getChirpSound()); o.add(a); a.play(); a.onEnded = () => { a.isPlaying = false; scene.remove(o); };
  } catch (e) { /* 尚未解鎖音訊時略過 */ }
}
function spawnChirpPulse(x, y, z) {
  const geo = new THREE.RingGeometry(.15, .32, 28);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, (y || 0) + .08, z);
  mesh.name = 'chirpPulse'; scene.add(mesh);
  chirpPulses.push({ mesh, t: 0 });
}
function updateChirpPulses(dt) {
  for (const p of chirpPulses) {
    p.t += dt; const k = Math.min(1, p.t / 1.2);
    p.mesh.scale.setScalar(1 + k * 5); p.mesh.material.opacity = .9 * (1 - k);
  }
  for (let i = chirpPulses.length - 1; i >= 0; i--) {
    if (chirpPulses[i].t <= 1.2) continue;
    const p = chirpPulses[i]; scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); chirpPulses.splice(i, 1);
  }
}
let hbBuf = null, hbNext = 0, nearActive = false, nearTier = 0, debugRadius = null;
function getHeartbeat() {
  if (hbBuf) return hbBuf;
  const ctx = listener.context, sr = ctx.sampleRate, n = Math.floor(.16 * sr);
  const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const t = i / sr, env = Math.min(1, t * 70) * Math.exp(-t * 14);
    d[i] = (Math.sin(2 * Math.PI * 62 * t) * .7 + Math.sin(2 * Math.PI * 98 * t) * .3) * env * .22;
  }
  return hbBuf = buf;
}
function playHeartbeat(vol = .45) {
  try {
    const a = new THREE.Audio(listener);
    a.setBuffer(getHeartbeat()); a.setVolume(vol); a.play();
    a.onEnded = () => { a.isPlaying = false; };
  } catch { }
}
const NEAR_LABEL = { 5: '👀 附近有人', 3: '👀 很近了', 1: '‼️ 就在旁邊！' };
const NEAR_HB = { 5: 1100, 3: 700, 1: 400 };
const NEAR_VOL = { 5: .45, 3: .58, 1: .72 };
const NEAR_INT = { 0: 0, 5: 1, 3: 2, 1: 3 };
function nearestHiderDist() {
  const s = G.s, self = me();
  if (!s || s.phase !== 'seek' || self?.role !== 'seeker') return Infinity;
  const x = local.x, y = local.y || 0, z = local.z;
  let best = Infinity;
  for (const q of s.players) {
    if (q.role !== 'hider' || !q.alive || q.id === self.id) continue;
    const d = Math.hypot((q.x - x), ((q.y || 0) - y), (q.z - z));
    if (d < best) best = d;
  }
  return best;
}
function nearTierFor(d, cur) {
  if (!isFinite(d)) return 0;
  const up = d <= CFG.NEAR_CLOSE ? 1 : d <= CFG.NEAR_MID ? 3 : d <= CFG.NEAR_RANGE ? 5 : 0;
  if (NEAR_INT[up] > NEAR_INT[cur]) return up;
  const h = CFG.NEAR_HYST;
  const down = d <= CFG.NEAR_CLOSE + h ? 1 : d <= CFG.NEAR_MID + h ? 3 : d <= CFG.NEAR_RANGE + h ? 5 : 0;
  if (NEAR_INT[down] < NEAR_INT[cur]) return down;
  return cur;
}
function hideNearHint() {
  nearActive = false; nearTier = 0;
  const badge = $('nearHint'), glow = $('nearGlow');
  if (badge) { badge.classList.add('hidden'); badge.classList.remove('near-5', 'near-3', 'near-1'); }
  if (glow) { glow.classList.add('hidden'); glow.classList.remove('near-5', 'near-3', 'near-1'); }
}
function updateNearHint() {
  const next = nearTierFor(nearestHiderDist(), nearTier);
  const prev = nearTier;
  if (!next) { if (prev) hideNearHint(); return; }
  nearActive = true; nearTier = next;
  const badge = $('nearHint'), glow = $('nearGlow');
  if (badge) {
    badge.textContent = NEAR_LABEL[next];
    badge.classList.remove('hidden', 'near-5', 'near-3', 'near-1');
    badge.classList.add('near-' + next);
  }
  if (glow) {
    glow.classList.remove('hidden', 'near-5', 'near-3', 'near-1');
    glow.classList.add('near-' + next);
  }
  if (next !== prev) placeHudCenter();
  const now = performance.now(), iv = NEAR_HB[next];
  if (NEAR_INT[next] > NEAR_INT[prev] || now >= hbNext) {
    hbNext = now + iv;
    playHeartbeat(NEAR_VOL[next]);
  }
}
function setDebugRadius(on) {
  if (debugRadius) {
    scene.remove(debugRadius);
    debugRadius.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    debugRadius = null;
  }
  if (!on) return;
  const g = new THREE.Group(); g.name = 'debugRadius';
  const disc = new THREE.Mesh(new THREE.CircleGeometry(CFG.NEAR_RANGE, 72),
    new THREE.MeshBasicMaterial({ color: 0x5ad0ff, transparent: true, opacity: .18, side: THREE.DoubleSide, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2;
  const ring = new THREE.Mesh(new THREE.RingGeometry(CFG.NEAR_RANGE - .07, CFG.NEAR_RANGE + .07, 80),
    new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: .95, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .02;
  const mid = new THREE.Mesh(new THREE.RingGeometry(CFG.NEAR_MID - .06, CFG.NEAR_MID + .06, 64),
    new THREE.MeshBasicMaterial({ color: 0xff9a4d, transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false }));
  mid.rotation.x = -Math.PI / 2; mid.position.y = .018;
  const close = new THREE.Mesh(new THREE.RingGeometry(CFG.NEAR_CLOSE - .05, CFG.NEAR_CLOSE + .05, 48),
    new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: .95, side: THREE.DoubleSide, depthWrite: false }));
  close.rotation.x = -Math.PI / 2; close.position.y = .022;
  g.add(disc, ring, mid, close);
  scene.add(g); debugRadius = g;
}
function updateDebugRadius() {
  if (!debugRadius) return;
  debugRadius.position.set(local.x, 0.03, local.z);
  debugRadius.visible = true;
}

// ---------- 網路（PeerJS，房主當主機）----------
const net = { peer: null, isHost: false, myId: null, code: null, conns: new Map(), hostConn: null };
let H = null; // 只有房主有：權威遊戲狀態
let G = { s: null, lastRound: -1 }; // 每個人：最新收到的狀態

function randCode() { let s = ''; for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; return s; }
function send(msg) { if (net.isHost) hostOnMsg(net.myId, msg); else if (net.hostConn?.open) net.hostConn.send(msg); }
function broadcast(msg) { for (const c of net.conns.values()) if (c.open) c.send(msg); onHostMsg(msg); }

// ---------- 公開房間列表（Supabase REST + ?net=local 測試存根）----------
let roomHbTimer = null, roomPubTimer = null, lastRoomSig = '';
function localRoomsRead() {
  try {
    const raw = JSON.parse(localStorage.getItem('ph-local-rooms') || '{}');
    const now = Date.now(), out = {};
    for (const [k, v] of Object.entries(raw || {})) {
      if (v && now - (Date.parse(v.updated_at) || 0) < 45000) out[k] = v;
    }
    return out;
  } catch { return {}; }
}
function localRoomsWrite(map) {
  try { localStorage.setItem('ph-local-rooms', JSON.stringify(map)); } catch { }
  if (window.__relay) window.__relay({ type: 'rooms', rooms: map });
}
function sbUpsertRoom(force = false) {
  if (!net.isHost || !net.code || !H) return;
  const hostP = H.players[net.myId];
  const row = {
    code: net.code,
    host_name: String(hostP?.name || '房主').slice(0, 20) || '房主',
    host_avatar: String(hostP?.avatar || '').slice(0, 8),
    player_count: Math.max(1, Math.min(CFG.MAX_PLAYERS, H.order.length || 1)),
    max_players: CFG.MAX_PLAYERS,
    status: H.phase === 'lobby' ? 'lobby' : 'playing',
    updated_at: new Date().toISOString()
  };
  const sig = `${row.host_name}|${row.host_avatar}|${row.player_count}|${row.status}`;
  if (!force && sig === lastRoomSig) return;
  lastRoomSig = sig;
  if (IS_LOCAL_NET) {
    const m = localRoomsRead(); m[row.code] = row; localRoomsWrite(m); return;
  }
  fetch(`${SB_URL}/rest/v1/rooms?on_conflict=code`, {
    method: 'POST',
    headers: { apikey: SB_KEY, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(row)
  }).catch(() => {});
}
function sbSchedulePub() {
  if (!net.isHost || !net.code || !H) return;
  const hostP = H.players[net.myId];
  const sig = `${hostP?.name || ''}|${hostP?.avatar || ''}|${H.order.length}|${H.phase === 'lobby' ? 'lobby' : 'playing'}`;
  if (sig === lastRoomSig || roomPubTimer) return;
  roomPubTimer = setTimeout(() => { roomPubTimer = null; sbUpsertRoom(true); }, 350);
}
function sbDeleteRoom() {
  if (!net.isHost || !net.code) return;
  const code = net.code;
  if (IS_LOCAL_NET) { const m = localRoomsRead(); delete m[code]; localRoomsWrite(m); return; }
  fetch(`${SB_URL}/rest/v1/rooms?code=eq.${encodeURIComponent(code)}`, {
    method: 'DELETE', keepalive: true, headers: { apikey: SB_KEY }
  }).catch(() => {});
}
function startRoomHeartbeat() {
  sbUpsertRoom(true);
  clearInterval(roomHbTimer);
  roomHbTimer = setInterval(() => sbUpsertRoom(true), 15000);
}
function renderRoomList(rows) {
  const ul = $('roomList'), em = $('roomsEmpty'); if (!ul || !em) return;
  const list = Array.isArray(rows) ? rows : [];
  em.classList.toggle('hidden', list.length > 0);
  ul.innerHTML = list.map(r => {
    const playing = r.status !== 'lobby';
    const cnt = r.player_count || 1, mx = r.max_players || 8;
    const full = cnt >= mx, dis = playing || full;
    const stateTxt = playing ? '遊戲中' : full ? '已滿' : '等待中';
    return `<li><button type="button" class="roomItem${dis ? ' playing' : ''}" data-code="${esc(r.code)}"${dis ? ' disabled' : ''}>` +
      `<span class="rCode">${esc(r.code)}</span>` +
      `<span class="rHost">${esc((r.host_avatar ? r.host_avatar + ' ' : '') + (r.host_name || '房主'))}</span>` +
      `<span class="rCnt">${cnt}/${mx} 人</span>` +
      `<span class="rState">${stateTxt}</span>` +
      `</button></li>`;
  }).join('');
}
async function sbFetchRooms() {
  if ($('home').classList.contains('hidden')) return;
  if (IS_LOCAL_NET) {
    const rows = Object.values(localRoomsRead()).sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
    return renderRoomList(rows);
  }
  try {
    const cutoff = new Date(Date.now() - 45000).toISOString();
    const res = await fetch(`${SB_URL}/rest/v1/rooms?select=code,host_name,host_avatar,player_count,max_players,status,updated_at&updated_at=gt.${encodeURIComponent(cutoff)}&order=updated_at.desc&limit=24`, {
      headers: { apikey: SB_KEY }
    });
    if (!res.ok) return;
    const rows = await res.json();
    renderRoomList(rows);
  } catch { }
}
addEventListener('pagehide', sbDeleteRoom);
addEventListener('beforeunload', sbDeleteRoom);
addEventListener('storage', e => { if (IS_LOCAL_NET && e.key === 'ph-local-rooms') sbFetchRooms(); });
addEventListener('ph-local-rooms', () => { if (IS_LOCAL_NET) sbFetchRooms(); });

function createRoom(prof, tries = 0) {
  const code = randCode(); homeMsg('建立房間中…');
  const peer = new PeerImpl(CFG.PREFIX + code, { debug: 1 });
  peer.on('open', id => {
    Object.assign(net, { peer, isHost: true, myId: id, code });
    const map0 = MAPS[Q.get('map')] ? Q.get('map') : 'home';
    H = { map: map0, phase: 'lobby', endAt: 0, players: {}, order: [], hp: CFG.HP, hps: {}, winner: null, reason: '', round: 0, lastTaunt: {}, lastShot: {}, lastSmash: {}, smashed: {}, hideMs: defaultHideMs(), seekMs: defaultSeekMs(map0), timeEdited: false, moved: {}, chat: [], dice: { status: 'idle', seeker: null, seekers: [], tied: [], need: 1 }, nextRolls: {}, chirpAt: 0, forceNeed: 0 };
    hostAddPlayer(id, prof); enterLobby(); startRoomHeartbeat(); setInterval(hostTick, 66); hostTick();
  });
  peer.on('connection', conn => {
    conn.on('data', d => { if (d?.t === 'join') { if (!hostAccept(conn, d)) return; } hostOnMsg(conn.peer, d); });
    conn.on('close', () => hostRemovePlayer(conn.peer));
    conn.on('error', () => hostRemovePlayer(conn.peer));
  });
  peer.on('error', e => {
    if (e.type === 'unavailable-id' && tries < 5) { peer.destroy(); createRoom(prof, tries + 1); }
    else if (!net.peer) homeMsg('連線伺服器失敗：' + e.type + '（請檢查網路後重試）');
    else toast('連線問題：' + e.type);
  });
}
function joinRoom(code, prof) {
  homeMsg('連線到房間 ' + code + ' 中…');
  const peer = new PeerImpl({ debug: 1 }); let ok = false;
  const fail = m => { if (!ok) { homeMsg(m); try { peer.destroy(); } catch { } } };
  setTimeout(() => fail('連不上房間 ' + code + '，請確認房號，或房主還開著遊戲嗎？'), 15000);
  peer.on('open', id => {
    Object.assign(net, { peer, isHost: false, myId: id, code });
    const c = peer.connect(CFG.PREFIX + code, { reliable: true }); net.hostConn = c;
    c.on('open', () => c.send({ t: 'join', name: prof.name, color: prof.color, avatar: prof.avatar }));
    c.on('data', d => { if (d.t === 'reject') { ok = true; homeMsg(d.reason); showScreen('home'); peer.destroy(); return; }
      if (!ok) { ok = true; enterLobby(); } onHostMsg(d); });
    c.on('close', () => { if (ok) disconnected(); });
  });
  peer.on('error', e => fail(e.type === 'peer-unavailable' ? '找不到房間 ' + code + '（房號錯了，或房主已離開）' : '連線失敗：' + e.type));
}
function disconnected() { toast('與房主斷線了，回到首頁'); setTimeout(() => location.href = location.pathname + '?room=' + net.code, 1500); }

// ---------- 房主邏輯（權威）----------
function hostAccept(conn, d) {
  const n = H.order.length;
  if (n >= CFG.MAX_PLAYERS) { conn.send({ t: 'reject', reason: '房間已滿（最多 8 人）' }); setTimeout(() => conn.close(), 300); return false; }
  if (H.phase !== 'lobby') { conn.send({ t: 'reject', reason: '這局正在進行中，等這局結束再加入喔' }); setTimeout(() => conn.close(), 300); return false; }
  net.conns.set(conn.peer, conn); hostAddPlayer(conn.peer, d); conn.send({ t: 'chathist', msgs: (H.chat || []).slice(-40) }); return true;
}
function pickUnique(list, want, used) {
  if (want && list.includes(want) && !used.has(want)) return want;
  return list.find(x => !used.has(x)) || list[0];
}
function hostSysChat(text) {
  const msg = { sys: true, text, ts: Date.now() };
  (H.chat = H.chat || []).push(msg); if (H.chat.length > 80) H.chat.splice(0, H.chat.length - 80);
  broadcast({ t: 'chat', ...msg });
}
function hostAddPlayer(id, prof = {}) {
  if (H.players[id]) return;
  const usedC = new Set(Object.values(H.players).map(p => p.color));
  const usedA = new Set(Object.values(H.players).map(p => p.avatar));
  const color = (prof.color && COLORS.includes(prof.color)) ? prof.color : pickUnique(COLORS, null, usedC);
  const avatar = (prof.avatar && AVATARS.includes(prof.avatar)) ? prof.avatar : pickUnique(AVATARS, null, usedA);
  H.players[id] = { id, name: String(prof.name || '玩家').slice(0, 10), color, avatar, ready: false, roll: 0, needReroll: 0, role: 'hider', alive: true, x: (MAPS[H.map] || MAPS.home).lobbyAt[0], z: (MAPS[H.map] || MAPS.home).lobbyAt[1], ry: 0, prop: -1, tf: 0, sx: 0, sz: 0 };
  H.players[id].sx = H.players[id].x; H.players[id].sz = H.players[id].z;
  H.order.push(id);
  if (H.order.length > 1) {
    const p = H.players[id];
    hostSysChat(`👋 ${((p.avatar || '') + ' ' + (p.name || '玩家')).trim()} 加入了房間`);
  }
  hostReresolveIfNeedChanged();
}
function lobbyResetDice() {
  H.dice = { status: 'idle', seeker: null, seekers: [], tied: [], need: hostSeekerNeed() };
  for (const p of Object.values(H.players)) { p.roll = 0; p.needReroll = 0; }
}
function hostSeekerNeed() {
  if (H.forceNeed) return H.forceNeed;
  return H.order.length >= 6 ? 2 : 1;
}
function dicePack() {
  const d = H.dice || {};
  return { status: d.status || 'idle', seeker: d.seeker || null, seekers: d.seekers || [], tied: d.tied || [], need: d.need || hostSeekerNeed() };
}
function hostCanStart() {
  if (H.phase !== 'lobby' || H.order.length < 2) return false;
  if (Q.get('seekerhost') === '1') return true; // 測試截圖用：略過準備與擲骰
  const need = hostSeekerNeed();
  return H.order.every(id => H.players[id].ready) && H.dice?.status === 'done' && (H.dice.seekers?.length || 0) === need;
}
function hostCanRoll(p) {
  if (H.phase !== 'lobby' || !p) return false;
  if (H.dice?.status === 'tie') return H.dice.tied.includes(p.id) && (p.needReroll || !p.roll);
  return !p.roll;
}
function hostAnnounceSeekers(ids) {
  const people = ids.map(id => H.players[id]).filter(Boolean);
  if (!people.length) return;
  if (people.length === 1) {
    const p = people[0];
    broadcast({ t: 'ev', k: 'seekerpick', id: p.id, ids, name: p.name, names: [p.name], n: p.roll });
    hostSysChat(`👻 這局由 ${p.name} 當鬼（擲出 ${p.roll} 點）`);
  } else {
    const names = people.map(p => p.name);
    const parts = people.map(p => `${p.name}（${p.roll} 點）`);
    broadcast({ t: 'ev', k: 'seekerpick', id: people[0].id, ids, name: names.join('、'), names, n: people[0].roll });
    hostSysChat(`👻 這局由 ${parts.join('、')} 當鬼`);
  }
}
function hostResolveDice() {
  const need = hostSeekerNeed();
  const kept = (H.dice?.status === 'tie' && H.dice.seekers?.length) ? H.dice.seekers.filter(id => H.players[id]) : [];
  const pool = (H.dice?.status === 'tie' && H.dice.tied?.length) ? H.dice.tied.filter(id => H.players[id]) : H.order.slice();
  if (pool.some(id => !H.players[id] || !H.players[id].roll || H.players[id].needReroll)) {
    if (H.dice?.status !== 'tie') H.dice = { status: 'wait', seeker: kept[0] || null, seekers: kept, tied: [], need };
    return;
  }
  const groups = new Map();
  for (const id of pool) {
    const n = H.players[id].roll;
    if (!groups.has(n)) groups.set(n, []);
    groups.get(n).push(id);
  }
  const chosen = kept.slice();
  let remaining = need - chosen.length;
  for (const r of [...groups.keys()].sort((a, b) => a - b)) {
    if (remaining <= 0) break;
    const g = groups.get(r);
    if (g.length <= remaining) { chosen.push(...g); remaining -= g.length; }
    else {
      for (const id of g) H.players[id].needReroll = 1;
      H.dice = { status: 'tie', seeker: chosen[0] || null, seekers: chosen, tied: g, need };
      const names = g.map(id => H.players[id].name).join('、');
      const why = remaining === need ? '請再擲一次' : `還要再選 ${remaining} 個鬼，請再擲一次`;
      broadcast({ t: 'ev', k: 'dicetie', names, n: r, tied: g, need: remaining, have: chosen.length });
      hostSysChat(`🎲 平手！${names} 都是 ${r} 點，${why}`);
      return;
    }
  }
  H.dice = { status: 'done', seeker: chosen[0] || null, seekers: chosen, tied: [], need };
  hostAnnounceSeekers(chosen);
}
function hostReresolveIfNeedChanged() {
  if (!H || H.phase !== 'lobby') return;
  const need = hostSeekerNeed();
  const mismatch = (H.dice?.status === 'done' && (H.dice.seekers?.length || 0) !== need)
    || (H.dice?.status === 'tie' && (H.dice.need || 0) !== need);
  if (mismatch) {
    H.dice = { status: 'wait', seeker: null, seekers: [], tied: [], need };
    for (const p of Object.values(H.players)) p.needReroll = 0;
    hostResolveDice();
  } else if (H.dice) H.dice.need = need;
}
function hostDoRoll(id) {
  const p = H.players[id]; if (!hostCanRoll(p)) return;
  const q = (H.nextRolls || {})[id];
  const n = (Array.isArray(q) && q.length) ? q.shift() : (1 + Math.floor(Math.random() * 6));
  p.roll = Math.max(1, Math.min(6, +n || 1)); p.needReroll = 0;
  broadcast({ t: 'ev', k: 'roll', id, name: p.name, avatar: p.avatar, n: p.roll });
  hostSysChat(`🎲 ${p.avatar || ''} ${p.name} 擲出了 ${p.roll} 點`.trim());
  hostResolveDice();
}
function hostRemovePlayer(id) {
  if (!H?.players[id]) return; const leaver = H.players[id]; const name = leaver.name; const avatar = leaver.avatar || '';
  delete H.players[id]; H.order = H.order.filter(x => x !== id); net.conns.delete(id);
  if (H.hps) delete H.hps[id];
  if (H.dice) {
    H.dice.seekers = (H.dice.seekers || []).filter(x => x !== id);
    H.dice.tied = (H.dice.tied || []).filter(x => x !== id);
    if (H.dice.seeker === id) H.dice.seeker = H.dice.seekers[0] || null;
  }
  hostSysChat(`👋 ${(avatar + ' ' + (name || '玩家')).trim()} 離開了房間`);
  broadcast({ t: 'ev', k: 'left', name });
  hostReresolveIfNeedChanged();
  hostCheckWin();
}
function hostStart() {
  if (!hostCanStart()) return;
  H.round++; H.winner = null; H.reason = ''; H.shots = []; H.lastShot = {}; H.moved = {}; H.chirpAt = 0;
  let seekers = (H.dice?.seekers?.length ? H.dice.seekers : (H.dice?.seeker ? [H.dice.seeker] : [H.order[0]])).filter(id => H.players[id]);
  if (Q.get('seekerhost') === '1') seekers = [net.myId]; // 只給截圖測試用
  if (!seekers.length) seekers = [H.order[0]];
  H.hps = {}; for (const id of seekers) H.hps[id] = CFG.HP;
  H.hp = H.hps[seekers[0]];
  let k = 0, sk = 0;
  const M = MAPS[H.map] || MAPS.home;
  const skSpawns = (M.seekers && M.seekers.length) ? M.seekers : [M.seeker];
  for (const id of H.order) { const p = H.players[id];
    const isSk = seekers.includes(id);
    Object.assign(p, { role: isSk ? 'seeker' : 'hider', alive: true, prop: -1, tf: 0, ry: 0, py: 0, y: 0, mnt: 0 });
    const [x, z] = isSk ? skSpawns[sk++ % skSpawns.length] : M.hiders[k++ % M.hiders.length];
    Object.assign(p, { x, z, sx: x, sz: z }); }
  H.smashed = {}; H.lastSmash = {};
  for (const q of Object.values(H.players)) q.tfLockUntil = 0;
  H.phase = 'hide'; H.endAt = Date.now() + roomHideMs();
}
function hostEnd(winner, reason) { if (H.phase === 'end' || H.phase === 'lobby') return; H.phase = 'end'; H.winner = winner; H.reason = reason; H.moved = {}; for (const p of Object.values(H.players)) { p.prop = -1; p.y = 0; p.mnt = 0; p.tfLockUntil = 0; } H.endAt = Date.now() + CFG.END_MS; }
function syncPrimaryHp() {
  const ids = Object.keys(H.hps || {});
  if (!ids.length) { H.hp = 0; return; }
  if (ids.length === 1) H.hp = H.hps[ids[0]];
  else H.hp = H.hps[H.dice?.seeker] ?? H.hps[ids[0]];
}
function hpsList() { return Object.entries(H.hps || {}).map(([id, hp]) => [id, hp]); }
function hostCheckWin() {
  if (H.phase !== 'hide' && H.phase !== 'seek') return;
  const ps = Object.values(H.players);
  const seekers = ps.filter(p => p.role === 'seeker');
  if (!seekers.length) return hostEnd('hiders', '鬼離開了遊戲');
  if (!seekers.some(p => (H.hps[p.id] ?? 0) > 0)) return hostEnd('hiders', '鬼的顏料亂噴太多次，血量歸零！');
  if (!ps.some(p => p.role === 'hider' && p.alive)) return hostEnd('seeker', '所有人都被抓到了！');
}
function hostTick() {
  const now = Date.now();
  if (H.phase === 'hide' && now >= H.endAt) { H.phase = 'seek'; H.endAt = now + roomSeekMs(H.map); H.chirpAt = 0; broadcast({ t: 'ev', k: 'seek' }); }
  else if (H.phase === 'seek' && now >= H.endAt) hostEnd('hiders', '時間到！還有人沒被找到');
  else if (H.phase === 'end' && now >= H.endAt) { H.phase = 'lobby'; H.moved = {}; H.hps = {}; H.chirpAt = 0; H.smashed = {}; H.lastSmash = {}; for (const p of Object.values(H.players)) { p.prop = -1; p.alive = true; p.role = 'hider'; p.y = 0; p.mnt = 0; p.ready = false; p.roll = 0; p.needReroll = 0; p.tfLockUntil = 0; } lobbyResetDice(); }
  if (H.phase === 'seek') {
    const rem = H.endAt - now;
    if (rem <= CFG.CHIRP_WINDOW && rem > 0 && (!H.chirpAt || now >= H.chirpAt)) {
      const list = Object.values(H.players).filter(p => p.role === 'hider' && p.alive)
        .map(p => ({ id: p.id, x: +p.x.toFixed(3), y: +(p.y || 0).toFixed(3), z: +p.z.toFixed(3) }));
      if (list.length) broadcast({ t: 'ev', k: 'chirp', list });
      H.chirpAt = now + CFG.CHIRP_EVERY;
    }
  }
  sbSchedulePub();
  hostSimShots();
  hostCheckWin();
  syncPrimaryHp();
  const moved = Object.entries(H.moved || {}).map(([i, v]) => [+i, +v.x.toFixed(2), +v.z.toFixed(2), v.tip ? 1 : 0, +(v.y ?? (PROPS[i][4] || 0)).toFixed(2), +(v.ry ?? (PROPS[i][3] * Math.PI / 180)).toFixed(3), v.mnt != null ? (v.mnt ? 1 : 0) : (WALL_PROP.has(PROPS[i][0]) ? 1 : 0)]);
  const smashed = Object.keys(H.smashed || {}).map(Number);
  const smashAt = Object.entries(H.lastSmash || {}).map(([id, ts]) => [id, ts]);
  broadcast({ t: 's', map: H.map || 'home', phase: H.phase, rem: Math.max(0, H.endAt - now), hp: H.hp, hps: hpsList(), winner: H.winner, reason: H.reason, round: H.round, code: net.code, moved,
    hideMs: H.hideMs, seekMs: H.seekMs, smashed, smashAt,
    dice: dicePack(),
    players: H.order.map(id => { const p = H.players[id]; return [p.id, p.name, p.color, p.role, p.alive, +p.x.toFixed(2), +p.z.toFixed(2), +p.ry.toFixed(2), p.prop, p.tf, p.sx, p.sz, +(p.py || 0).toFixed(3), +(p.y || 0).toFixed(2), p.mnt ? 1 : 0, p.ready ? 1 : 0, p.avatar || '', p.roll || 0, p.needReroll ? 1 : 0, Math.max(0, (p.tfLockUntil || 0) - now)]; }) });
}
let lastSim = 0;
const segRay = new THREE.Raycaster();
function hostSimShots() {
  const now = performance.now(); const dt = Math.min(.15, lastSim ? (now - lastSim) / 1000 : .066); lastSim = now;
  if (!H.shots?.length) return;
  if (H.phase !== 'seek') { H.shots = []; return; }
  const statics = [...pickProps, ...wallMeshes];
  for (const sh of [...H.shots]) {
    const step = CFG.SHOT_SPEED * dt;
    // 1) 打到牆/家具/地板的距離
    segRay.set(sh.pos, sh.d); segRay.far = step;
    const hs = segRay.intersectObjects(statics, false).find(h => visibleChain(h.object));
    // 躲藏者噴漆：只判定有沒有打中鬼（打牆只留痕跡，不扣血、不抓人）
    if (sh.kind === 'taunt') {
      let hitS = null;
      for (const q of Object.values(H.players)) {
        if (q.role !== 'seeker') continue;
        const r = .42, y0 = q.y || 0, y1 = (q.y || 0) + 1.05;
        const fx = sh.pos.x - q.x, fz = sh.pos.z - q.z, A = sh.d.x ** 2 + sh.d.z ** 2, B = 2 * (fx * sh.d.x + fz * sh.d.z), C = fx * fx + fz * fz - r * r;
        let t = null; if (C <= 0) t = 0; else if (A > 1e-9) { const disc = B * B - 4 * A * C; if (disc >= 0) { const t1 = (-B - Math.sqrt(disc)) / (2 * A); if (t1 >= 0 && t1 <= step) t = t1; } }
        if (t == null) continue; const y = sh.pos.y + sh.d.y * t; if (y < y0 - .05 || y > y1 + .05) continue;
        hitS = { t, q };
      }
      const endT = () => H.shots.splice(H.shots.indexOf(sh), 1);
      if (hitS && (!hs || hitS.t <= hs.distance)) {
        endT(); const pt = sh.pos.clone().addScaledVector(sh.d, hitS.t);
        const n = sh.d.clone().negate();
        broadcast({ t: 'splat', sid: sh.sid, p: pt.toArray().map(v => +v.toFixed(3)), n: n.toArray().map(v => +v.toFixed(3)), c: sh.c });
        broadcast({ t: 'ev', k: 'painted', id: hitS.q.id, sid: sh.sid, p: pt.toArray() }); continue;
      }
      if (hs) {
        endT(); const n = hs.face ? hs.face.normal.clone().transformDirection(hs.object.matrixWorld) : sh.d.clone().negate();
        if (n.dot(sh.d) > 0) n.negate();
        broadcast({ t: 'splat', sid: sh.sid, p: hs.point.toArray().map(v => +v.toFixed(3)), n: n.toArray().map(v => +v.toFixed(3)), c: sh.c });
        broadcast({ t: 'ev', k: 'paintmiss', sid: sh.sid }); continue;
      }
      sh.pos.addScaledVector(sh.d, step); sh.dist += step;
      if (sh.dist > CFG.SHOT_RANGE) { endT(); broadcast({ t: 'pend', sid: sh.sid }); broadcast({ t: 'ev', k: 'paintmiss', sid: sh.sid }); }
      continue;
    }
    // 2) 打到躲藏者（用他「現在」的位置；躲開就打不到）
    let best = null;
    for (const q of Object.values(H.players)) {
      if (q.role !== 'hider' || !q.alive) continue;
      const pr = q.prop >= 0 ? PROPS[q.prop] : null; const sz = pr ? modelCache[pr[0]].size : null;
      const hung = pr && WALL_PROP.has(pr[0]) && !!q.mnt;
      const r = pr ? Math.max(.26, Math.max(sz.x, sz.z) * .45) : .24;
      const y0 = hung ? ((q.y || 0) - sz.y * .5) : (q.y || 0);
      const y1 = hung ? ((q.y || 0) + sz.y * .5) : (y0 + (pr ? sz.y : .62));
      const fx = sh.pos.x - q.x, fz = sh.pos.z - q.z, A = sh.d.x ** 2 + sh.d.z ** 2, B = 2 * (fx * sh.d.x + fz * sh.d.z), C = fx * fx + fz * fz - r * r;
      let t = null; if (C <= 0) t = 0; else if (A > 1e-9) { const disc = B * B - 4 * A * C; if (disc >= 0) { const t1 = (-B - Math.sqrt(disc)) / (2 * A); if (t1 >= 0 && t1 <= step) t = t1; } }
      if (t == null) continue; const y = sh.pos.y + sh.d.y * t; if (y < y0 - .05 || y > y1 + .05) continue;
      if (!best || t < best.t) best = { t, q };
    }
    const end = () => H.shots.splice(H.shots.indexOf(sh), 1);
    if (best && (!hs || best.t <= hs.distance)) {
      end(); const q = best.q; q.alive = false;
      const pt = sh.pos.clone().addScaledVector(sh.d, best.t);
      const left = Object.values(H.players).filter(x => x.role === 'hider' && x.alive).length;
      const shooter = sh.from && H.players[sh.from] ? H.players[sh.from] : null;
      const nSeek = Object.values(H.players).filter(x => x.role === 'seeker').length;
      const catchLine = (nSeek > 1 && shooter)
        ? `🎯 鬼 ${shooter.name} 抓到了 ${q.name}！剩 ${left} 人`
        : `🎯 鬼抓到了 ${q.name}！剩 ${left} 人`;
      hostSysChat(catchLine);
      broadcast({ t: 'ev', k: 'caught', id: q.id, name: q.name, seekerId: shooter?.id, seekerName: shooter?.name, left, hp: H.hp, sid: sh.sid, p: pt.toArray() }); hostCheckWin(); continue;
    }
    if (hs) {
      end(); const n = hs.face ? hs.face.normal.clone().transformDirection(hs.object.matrixWorld) : sh.d.clone().negate();
      if (n.dot(sh.d) > 0) n.negate();
      const kind = hs.object.userData.kind;
      broadcast({ t: 'splat', sid: sh.sid, p: hs.point.toArray().map(v => +v.toFixed(3)), n: n.toArray().map(v => +v.toFixed(3)), c: sh.c });
      const shooter = sh.from && H.players[sh.from] ? sh.from : Object.keys(H.hps || {})[0];
      const dec = kind === 'prop' ? CFG.MISS : CFG.WALL_MISS;
      if (shooter && H.hps[shooter] != null) H.hps[shooter] = Math.max(0, H.hps[shooter] - dec);
      syncPrimaryHp();
      const ev = { t: 'ev', k: kind === 'prop' ? 'miss' : 'wallhit', hp: H.hps[shooter] ?? H.hp, id: kind === 'prop' ? hs.object.userData.id : shooter, seekerId: shooter, name: H.players[shooter]?.name, hps: hpsList() };
      if (kind !== 'prop') ev.id = shooter;
      broadcast(ev);
      hostCheckWin();
      continue;
    }
    sh.pos.addScaledVector(sh.d, step); sh.dist += step;
    if (sh.dist > CFG.SHOT_RANGE) { end(); broadcast({ t: 'pend', sid: sh.sid }); }
  }
}
function hostApplyBump(p, i, x, z, tip) {
  const pr = PROPS[i]; if (!pr || !SMALL.has(pr[0])) return;
  if (!H.moved) H.moved = {};
  const cur = H.moved[i] || { x: pr[1], z: pr[2], tip: 0, y: pr[4] || 0, ry: pr[3] * Math.PI / 180, mnt: 0 };
  if ((cur.y ?? (pr[4] || 0)) > .05) return;
  if (Math.hypot(p.x - cur.x, p.z - cur.z) > 3.2) return;
  if (Math.hypot(x - cur.x, z - cur.z) > 2.5) return;
  if (Math.hypot(x - pr[1], z - pr[2]) > 14) return;
  H.moved[i] = { ...cur, x, z, tip: tip ? 1 : cur.tip };
}
function hostOnMsg(from, m) {

  const p = H.players[from]; if (!p || !m) return;
  const playing = H.phase === 'hide' || H.phase === 'seek';
  switch (m.t) {
    case 'start': if (from === net.myId) hostStart(); break;
    case 'ready': if (H.phase === 'lobby') p.ready = !!m.on; break;
    case 'profile': if (H.phase === 'lobby') {
      if (m.name) p.name = String(m.name).trim().slice(0, 10) || p.name;
      if (m.color && COLORS.includes(m.color)) p.color = m.color;
      if (m.avatar && AVATARS.includes(m.avatar)) p.avatar = m.avatar;
    } break;
    case 'roll': if (H.phase === 'lobby') hostDoRoll(from); break;
    case 'map': if (from === net.myId && H.phase === 'lobby' && MAPS[m.id] && m.id !== H.map) {
      H.map = m.id; H.moved = {}; const [lx, lz] = MAPS[m.id].lobbyAt;
      for (const q of Object.values(H.players)) { q.x = lx; q.z = lz; q.sx = lx; q.sz = lz; }
      // 地圖／時間變更只顯示在大廳設定面板，不再發系統聊天
      if (!H.timeEdited) { H.hideMs = defaultHideMs(); H.seekMs = defaultSeekMs(H.map); }
    } break;
    case 'times': if (from === net.myId && H.phase === 'lobby') {
      const hideS = clampHideS(m.hide), seekS = clampSeekS(m.seek);
      if (hideS * 1000 === H.hideMs && seekS * 1000 === H.seekMs) break;
      H.hideMs = hideS * 1000; H.seekMs = seekS * 1000; H.timeEdited = true;
    } break;
    case 'chat': {
      const text = String(m.text || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 80);
      if (!text) break;
      const msg = { id: from, name: p.name, color: p.color, avatar: p.avatar || '', text, ts: Date.now() };
      (H.chat = H.chat || []).push(msg); if (H.chat.length > 80) H.chat.splice(0, H.chat.length - 80);
      broadcast({ t: 'chat', ...msg });
    } break;
    case 'testdice': if (Q.get('net') === 'local' && m.map && typeof m.map === 'object') H.nextRolls = m.map; break;
    case 'testdicereset': if (Q.get('net') === 'local' && H.phase === 'lobby') lobbyResetDice(); break;
    case 'testadd': if (Q.get('net') === 'local' && H.phase === 'lobby' && Array.isArray(m.list)) {
      for (const prof of m.list) {
        const id = (CFG.PREFIX + 'bot-' + String(prof.name || Math.random())).slice(0, 48);
        if (H.players[id]) continue;
        hostAddPlayer(id, prof); H.players[id].ready = true;
      }
      break; }
    case 'testhostroll': if (Q.get('net') === 'local' && H.phase === 'lobby') {
      const ids = Array.isArray(m.ids) ? m.ids : H.order;
      for (const id of ids) if (H.players[id] && hostCanRoll(H.players[id])) hostDoRoll(id);
      break; }
    case 'testseekneed': if (Q.get('net') === 'local') { H.forceNeed = Math.max(0, +m.n || 0); hostReresolveIfNeedChanged(); } break;
    case 'testseekrem': if (Q.get('net') === 'local') {
      if (H.phase === 'hide') { H.phase = 'seek'; H.chirpAt = 0; broadcast({ t: 'ev', k: 'seek' }); }
      if (H.phase === 'seek') { H.endAt = Date.now() + Math.max(0, +m.ms || 0); H.chirpAt = 0; }
      break; }
    case 'testsmashready': if (Q.get('net') === 'local') H.lastSmash[from] = 0; break;
    case 'p': // 位置；pp = 用戶端認知的變身家具，跟主機不一致時（剛變身）先忽略，避免舊位置蓋掉
      if (!(p.role === 'seeker' && H.phase === 'hide') && (m.pp ?? -1) === p.prop) {
        p.x = +m.x || 0; p.z = +m.z || 0; p.ry = +m.ry || 0; p.py = +m.py || 0; p.y = +m.y || 0; p.mnt = m.mnt ? 1 : 0;
        if (m.bumps) for (const b of m.bumps) hostApplyBump(p, b[0], b[1], b[2], b[3]);
      } break;
    case 'tf': {
      const pr = PROPS[m.id]; if (!playing || p.role !== 'hider' || !p.alive || !pr || p.prop === m.id || propMap(m.id) !== (H.map || 'home')) break;
      if (H.smashed && H.smashed[m.id]) break;
      if ((p.tfLockUntil || 0) > Date.now()) break;
      const mv = H.moved?.[m.id];
      const wall = WALL_PROP.has(pr[0]);
      const cx = mv ? mv.x : pr[1], cz = mv ? mv.z : pr[2];
      const cy = mv && mv.y != null ? mv.y : (wall ? (pr[4] || 1.5) : (pr[4] || 0));
      const cry = mv && mv.ry != null ? mv.ry : pr[3] * Math.PI / 180;
      const cmnt = mv && mv.mnt != null ? mv.mnt : (wall ? 1 : 0);
      if (Math.hypot(cx - p.x, cz - p.z) > CFG.TF_RANGE + 1.5) break;
      if (Object.values(H.players).some(q => q !== p && q.alive && q.role === 'hider' && q.prop === m.id)) break; // 別人已經變成它
      // 再次變身時，先把上一件變身家具留在當下原地（牆掛飾若貼牆就留在牆上）
      if (p.prop >= 0) {
        if (!H.moved) H.moved = {};
        H.moved[p.prop] = { x: p.x, z: p.z, y: p.y || 0, ry: p.py || 0, tip: 0, mnt: p.mnt ? 1 : 0 };
      }
      p.prop = m.id; p.tf++; p.x = cx; p.z = cz; p.py = cry; p.y = cy; p.mnt = cmnt ? 1 : 0; break; }
    case 'hshot': { // 躲藏者噴漆：主機模擬飛行，打中鬼才糊畫面
      if (H.phase !== 'seek' || p.role !== 'hider' || !p.alive) break;
      const now = Date.now(); if (now - (H.lastTaunt[from] || 0) < CFG.TAUNT_CD - 80) break; H.lastTaunt[from] = now;
      const o = new THREE.Vector3(...m.o), a = new THREE.Vector3(...m.a);
      if (Math.hypot(o.x - p.x, o.z - p.z) > 2.8) break;
      const d = a.sub(o); if (d.lengthSq() < 1e-6) break; d.normalize();
      const sid = (H.sidN = (H.sidN || 0) + 1);
      const c = PAINT[sid % PAINT.length];
      H.shots.push({ sid, pos: o.clone(), d, dist: 0, c, kind: 'taunt', from });
      broadcast({ t: 'shot', sid, o: o.toArray().map(v => +v.toFixed(3)), d: d.toArray().map(v => +v.toFixed(4)), c, sp: CFG.SHOT_SPEED, kind: 'taunt' });
      break; }
    case 'shoot': { // 鬼開顏料槍：主機模擬飛行、判定命中
      if (H.phase !== 'seek' || p.role !== 'seeker') break;
      if ((H.hps[from] ?? 0) <= 0) break;
      if (!H.lastShot) H.lastShot = {};
      const now = Date.now(); if (now - (H.lastShot[from] || 0) < CFG.SHOT_CD - 80) break; H.lastShot[from] = now;
      const o = new THREE.Vector3(...m.o), a = new THREE.Vector3(...m.a);
      if (Math.hypot(o.x - p.x, o.z - p.z) > 2.5) break;
      const d = a.sub(o); if (d.lengthSq() < 1e-6) break; d.normalize();
      const sid = (H.sidN = (H.sidN || 0) + 1);
      const c = PAINT[sid % PAINT.length];
      H.shots.push({ sid, pos: o.clone(), d, dist: 0, c, from });
      broadcast({ t: 'shot', sid, o: o.toArray().map(v => +v.toFixed(3)), d: d.toArray().map(v => +v.toFixed(4)), c, sp: CFG.SHOT_SPEED });
      break; }
    case 'smash': {
      if (H.phase !== 'seek' || p.role !== 'seeker') break;
      const nowS = Date.now();
      if (!H.lastSmash) H.lastSmash = {};
      if (nowS - (H.lastSmash[from] || 0) < CFG.SMASH_CD - 80) break;
      if (Math.hypot((+m.x || 0) - p.x, (+m.z || 0) - p.z) > 3.2) break;
      let fx = +m.fx || 0, fy = +m.fy, fz = +m.fz || 0;
      let fl = Math.hypot(fx, Number.isFinite(fy) ? fy : 0, fz);
      if (!Number.isFinite(fy) || fl < .2) {
        fx = Math.sin(p.ry || 0); fy = 0; fz = Math.cos(p.ry || 0); fl = Math.hypot(fx, fz) || 1;
      }
      fx /= fl; fy = (Number.isFinite(fy) ? fy : 0) / fl; fz /= fl;
      const sx = p.x, sz = p.z;
      const sy = Number.isFinite(+m.y) ? +m.y : ((p.y || 0) + .62);
      const inCone = (x, y, z) => inSmashCone(x, y, z, sx, sy, sz, fx, fy, fz);
      if (!H.smashed) H.smashed = {};
      const hits = [];
      for (let i = 0; i < PROPS.length; i++) {
        if (propMap(i) !== (H.map || 'home')) continue;
        if (H.smashed[i]) continue;
        const pr = PROPS[i]; if (!canSmashProp(pr[0])) continue;
        const mv = H.moved?.[i];
        const px = mv ? mv.x : pr[1], pz = mv ? mv.z : pr[2];
        if (!propInSmashCone(i, sx, sy, sz, fx, fy, fz, mv)) continue;
        H.smashed[i] = 1; hits.push({ i, x: +px.toFixed(3), z: +pz.toFixed(3), name: pr[0] });
      }
      const revealed = [];
      for (const q of Object.values(H.players)) {
        if (q.role !== 'hider' || !q.alive || (q.prop ?? -1) < 0) continue;
        const pr = PROPS[q.prop]; if (!pr || !canSmashProp(pr[0])) continue;
        const qy = (q.y || 0) + (modelCache[pr[0]]?.size?.y || .4) * .5;
        const inArea = inCone(q.x, qy, q.z) || hits.some(h => h.i === q.prop);
        if (!inArea) continue;
        const pi = q.prop, px = q.x, pz = q.z;
        if (!H.smashed[pi]) { H.smashed[pi] = 1; hits.push({ i: pi, x: +px.toFixed(3), z: +pz.toFixed(3), name: pr[0] }); }
        q.prop = -1; q.y = 0; q.mnt = 0; q.tfLockUntil = nowS + CFG.SMASH_LOCK;
        revealed.push({ id: q.id, name: q.name, x: +px.toFixed(3), z: +pz.toFixed(3), prop: pi });
      }
      H.lastSmash[from] = nowS;
      p.ry = Math.atan2(fx, fz);
      broadcast({ t: 'ev', k: 'smash', ids: hits.map(h => h.i), hits, revealed, seekerId: from, name: p.name, x: +sx.toFixed(3), y: +sy.toFixed(3), z: +sz.toFixed(3), fx: +fx.toFixed(4), fy: +fy.toFixed(4), fz: +fz.toFixed(4) });
      break; }
  }
}

// ---------- 每個人：接收主機訊息 ----------
const visuals = new Map(); // id -> {root, buddy, disguise, dProp, label, note, tx, tz, tr}
const evLog = [];
const chatLog = [];
function renderChat() {
  const box = $('chatLog'); if (!box) return;
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.innerHTML = chatLog.map(m => {
    if (m.sys) return `<div class="chatLine sys">${esc(m.text)}</div>`;
    return `<div class="chatLine"><span class="who" style="color:${esc(m.color || '#5a3d2b')}">${esc((m.avatar || '') + ' ' + m.name)}</span>${esc(m.text)}</div>`;
  }).join('');
  if (atBottom) box.scrollTop = box.scrollHeight;
}
function appendChatFeed(m) {
  const feed = $('chatFeed'); if (!feed) return;
  const line = document.createElement('div');
  line.className = 'chatFeedLine' + (m.sys ? ' sys' : '');
  line.innerHTML = m.sys ? esc(m.text)
    : `<span class="who" style="color:${esc(m.color || '#ffd36e')}">${esc((m.avatar || '') + ' ' + m.name)}</span>${esc(m.text)}`;
  feed.appendChild(line);
  while (feed.children.length > 6) feed.firstElementChild.remove();
}
function pushChat(m) {
  chatLog.push(m); if (chatLog.length > 80) chatLog.splice(0, chatLog.length - 80);
  renderChat();
  if (G.s && G.s.phase !== 'lobby') appendChatFeed(m);
}

function onHostMsg(m) {
  if (m.t === 's') return onState(m);
  if (m.t === 'chat') { evLog.push(m); return pushChat(m); }
  if (m.t === 'chathist' && Array.isArray(m.msgs)) { chatLog.length = 0; for (const x of m.msgs) chatLog.push(x); return renderChat(); }
  if (m.t === 'shot') { evLog.push(m); return spawnProjectile(m); }
  if (m.t === 'splat') { evLog.push(m); endProjectile(m.sid); return addSplat(m.p, m.n, m.c); }
  if (m.t === 'pend') return endProjectile(m.sid);
  if (m.t === 'ev') { evLog.push(m);
    if (m.k === 'caught') { endProjectile(m.sid); if (m.p) paintBurst(m.p); toast(m.id === net.myId ? '😵 你被抓到了！' : `🎯 鬼抓到了 ${m.name}！`); flash('#ffe14d'); }
    if (m.k === 'miss') { const who = m.name ? `${m.name} ` : '鬼 '; toast(`❌ 顏料打到真的家具！${who}-${CFG.MISS} 血`); if (me()?.id === m.seekerId) flash('#ff4d6d'); }
    if (m.k === 'wallhit') { const who = m.name ? `${m.name} ` : '鬼 '; toast(`💦 顏料打到牆/地板，${who}-${CFG.WALL_MISS} 血`); if (me()?.id === m.seekerId) flash('#ff4d6d'); }
    if (m.k === 'painted') { endProjectile(m.sid); if (m.p) paintBurst(m.p); playSplatAt(...(m.p || [0, 1, 0]));
      toast(net.myId === m.id ? '💦 被顏料糊到眼睛了！' : '🎨 顏料打中鬼了！');
      if (net.myId === m.id) showPaintOverlay(); }
    if (m.k === 'paintmiss') { endProjectile(m.sid); }
    if (m.k === 'seek') toast('👀 鬼出動了！');
    if (m.k === 'left') toast(`${m.name} 離開了`);
    if (m.k === 'roll') { evLog.push(m); showDiePop(m); }
    if (m.k === 'dicetie') { evLog.push(m); toast(`平手！${m.names} 都是 ${m.n} 點，請再擲一次`); }
    if (m.k === 'seekerpick') { evLog.push(m); toast(m.names?.length > 1 ? `👻 這局由 ${m.names.join('、')} 當鬼` : `👻 這局由 ${m.name} 當鬼（擲出 ${m.n} 點）`); }
    if (m.k === 'chirp') {
      evLog.push(m);
      for (const q of (m.list || [])) { spawnChirpPulse(q.x, q.y, q.z); playChirpAt(q.x, q.y + .4, q.z); }
      if (!onHostMsg._chirped) { onHostMsg._chirped = true; toast(me()?.role === 'seeker' ? '🔔 最後 1 分鐘：躲藏者發出了聲響！' : '🔔 最後 1 分鐘：你會發出聲響，小心！'); }
    }
    if (m.k === 'smash') {
      evLog.push(m);
      playSmashSound();
      spawnSmashFan(m.x ?? local.x, m.y ?? ((local.y || 0) + .62), m.z ?? local.z, m.fx || 0, m.fy || 0, m.fz || 1);
      if (G.s) {
        G.s.smashed = [...new Set([...(G.s.smashed || []), ...(m.ids || [])])];
        for (const q of (m.revealed || [])) {
          const p = G.s.players.find(x => x.id === q.id);
          if (p) { p.prop = -1; p.y = 0; p.mnt = 0; p.tfLock = CFG.SMASH_LOCK; }
          if (q.id === net.myId) { local.pp = -1; local.mounted = false; if ((local.y || 0) < .05) local.y = 0; }
        }
      }
      for (const i of (m.ids || [])) { if (propObjs[i]) propObjs[i].userData.smashed = true; }
      if (G.s) syncHiddenProps(G.s.phase, G.s.players);
      for (const h of (m.hits || [])) spawnDebris(h.i, h.x, h.z, h.name);
      const self = me();
      if (self && (m.revealed || []).some(q => q.id === self.id)) toast('💥 變身被破壞了！5 秒內不能再變身');
      else if (self?.id === m.seekerId) toast((m.revealed || []).length ? '💥 破壞成功，把人打回原形了！' : ((m.hits || []).length ? '💥 家具砸碎了！' : '面前沒有可破壞的家具'));
      else if ((m.hits || []).length) toast(`💥 ${m.name || '鬼'} 砸碎了家具`);
    }
  }
}
function me() { return G.s?.players.find(p => p.id === net.myId); }
function onState(m) {
  const players = m.players.map(a => ({ id: a[0], name: a[1], color: a[2], role: a[3], alive: a[4], x: a[5], z: a[6], ry: a[7], prop: a[8], tf: a[9], sx: a[10], sz: a[11], py: a[12], y: a[13] || 0, mnt: a[14] ? 1 : 0, ready: !!a[15], avatar: a[16] || '', roll: a[17] || 0, needReroll: !!a[18], tfLock: a[19] || 0 }));
  const prevPhase = G.s?.phase; G.s = { ...m, players, recvAt: performance.now() };
  const self = me();
  if ((m.map || 'home') !== curMap) { setMap(m.map || 'home'); if (self && m.phase === 'lobby') { local.x = self.x; local.z = self.z; local.y = 0; } }
  if (m.phase === 'lobby' && prevPhase && prevPhase !== 'lobby') clearDebris();
  if (self && m.round !== G.lastRound && m.phase !== 'lobby') { G.lastRound = m.round; onHostMsg._chirped = false; local.x = self.sx; local.z = self.sz; local.y = 0; local.vy = 0; local.grounded = true; local.mounted = false; local.ry = 0; local.stam = CFG.STAMINA; local.stamWait = 0; local.exhausted = false; cam.yaw = Math.PI; cam.pitch = .45; target = null; clearPaint(); clearPaintOverlay(); clearDebris(); lastSmashAt = 0; local.pp = -1; local.lock = true; }
  if (self && (self.prop ?? -1) !== local.pp) { // 剛變身：站到那件家具的位置、用它的方向
    local.pp = self.prop ?? -1; if (local.pp >= 0) { local.x = self.x; local.z = self.z; local.py = self.py; local.mounted = !!self.mnt; local.y = self.y || 0; local.vy = 0; local.grounded = !local.mounted;
      if (local.mounted) { const nx = Math.sin(self.py), nz = Math.cos(self.py); local.mntAxis = Math.abs(nx) > Math.abs(nz) ? 'x' : 'z'; local.mntPos = local.mntAxis === 'x' ? self.x : self.z; local.mntNx = nx; local.mntNz = nz; }
      else { local.mntAxis = null; } } }
  syncMoved(m.moved);
  syncSmashed(m.smashed);
  // 角色外觀
  const ids = new Set(players.map(p => p.id));
  for (const [id, v] of visuals) if (!ids.has(id)) { scene.remove(v.root); visuals.delete(id); }
  for (const p of players) {
    let v = visuals.get(p.id);
    if (!v || v.role !== p.role || v.color !== p.color || v.name !== p.name || v.avatar !== p.avatar) { if (v) scene.remove(v.root);
      const root = new THREE.Group(); const buddy = makeBuddy(p.color, p.role === 'seeker'); root.add(buddy);
      const label = makeLabel(((p.avatar ? p.avatar + ' ' : '') + p.name).trim(), p.color); label.position.y = p.role === 'seeker' ? 1.05 : .72;
      const open0 = m.phase === 'lobby' || m.phase === 'end';
      label.visible = p.id !== net.myId && (open0 || self?.role !== 'seeker' || p.role === 'seeker');
      root.add(label);
      const note = makeNote(); note.position.y = p.role === 'seeker' ? 1.25 : .95; root.add(note);
      tagMeshes(buddy, { kind: 'player', id: p.id });
      v = { root, buddy, label, note, disguise: null, dProp: -1, role: p.role, color: p.color, name: p.name, avatar: p.avatar, tx: p.x, tz: p.z, ty: p.y || 0, tr: p.ry };
      root.position.set(p.x, 0, p.z); scene.add(root); visuals.set(p.id, v); }
    if (v.dProp !== p.prop || (v.dMnt !== !!p.mnt && p.prop >= 0 && WALL_PROP.has(PROPS[p.prop][0]))) {
      if (v.disguise) v.root.remove(v.disguise); v.disguise = null; v.dProp = p.prop; v.dMnt = !!p.mnt;
      if (p.prop >= 0) {
        const pname = PROPS[p.prop][0], sz = modelCache[pname]?.size;
        const d = makeModel(pname); d.rotation.y = p.py; addGlow(d, pname, true);
        const hung = WALL_PROP.has(pname) && !!p.mnt;
        d.position.y = WALL_PROP.has(pname) ? (hung ? 0 : (WALL_PROC.has(pname) && sz ? sz.y * .5 + .02 : 0)) : 0;
        tagMeshes(d, { kind: 'player', id: p.id }); v.root.add(d); v.disguise = d;
      }
      const pH = p.prop >= 0 ? (modelCache[PROPS[p.prop][0]]?.size.y || .6) : 0;
      v.label.position.y = p.prop >= 0 ? Math.max(.72, pH + .32) : (p.role === 'seeker' ? 1.05 : .72);
    }
    if (v.p?.prop !== p.prop) v.root.position.set(p.x, p.y || 0, p.z); // 變身瞬間直接到位
    v.tx = p.x; v.tz = p.z; v.ty = p.y || 0; v.tr = p.ry; v.tpy = p.py; v.p = p;
  }
  syncHiddenProps(m.phase, players);
  if (prevPhase !== m.phase) onPhaseChange(m.phase);
  updateUI();
}

// ---------- 本地玩家移動 / 鏡頭 ----------
const local = { x: -6, z: 3, y: 0, vy: 0, grounded: true, mounted: false, mntAxis: null, mntPos: 0, mntNx: 0, mntNz: 0, reMountAt: 0, ry: 0, py: 0, pp: -1, lock: true, lastSend: 0, stam: 3, stamWait: 0, exhausted: false };
let rotHold = 0; // 手機旋轉按鈕：-1 左轉、1 右轉
let sprintHold = false, jumpQueued = false;
const cam = { yaw: Math.PI, pitch: .45, dist: 4.5 };
const keys = {}; const joy = { x: 0, y: 0 }; const holdMove = { ix: 0, iz: 0, sprint: false }; // 測試用：不受 keyup 干擾
let target = null; // 躲的人：目前瞄準要變身的家具 id
const ray = new THREE.Raycaster();
const tmpV = new THREE.Vector3();
const pendingBumps = new Map();

function playR() {
  const p = me(); if (p?.prop >= 0) { const sz = modelCache[PROPS[p.prop][0]]?.size; if (sz) return Math.max(.1, Math.min(.4, Math.max(sz.x, sz.z) * .4)); }
  return .19;
}
function canSitOnShelf() {
  const p = me(); if (!(p?.prop >= 0)) return true;
  const sz = modelCache[PROPS[p.prop][0]]?.size; return sz ? (Math.max(sz.x, sz.z) < .75 && sz.y < .9) : true;
}
function overCol(x, z, r, c) {
  const cx = Math.max(c.x1, Math.min(x, c.x2)), cz = Math.max(c.z1, Math.min(z, c.z2));
  const dx = x - cx, dz = z - cz; return dx * dx + dz * dz < r * r;
}
function resolveXZ(x, z, r, c) {
  const cx = Math.max(c.x1, Math.min(x, c.x2)), cz = Math.max(c.z1, Math.min(z, c.z2));
  const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return [x, z];
  if (d2 > 1e-6) { const d = Math.sqrt(d2); return [cx + dx / d * r, cz + dz / d * r]; }
  const o = [[c.x1 - r - x, 0], [c.x2 + r - x, 0], [0, c.z1 - r - z], [0, c.z2 + r - z]].sort((a, b) => Math.hypot(...a) - Math.hypot(...b))[0];
  return [x + o[0], z + o[1]];
}
function colBlocksAtY(c, y, h = CFG.BODY_H) {
  if (c.off) return false;
  const y1 = c.y1 ?? 0, y2 = c.y2 ?? 2.6;
  if (y >= y2 - .05) return false; // 已經站在頂面
  if (y + h <= y1 + .02) return false; // 整個人在盒下方（從桌下穿過）
  return true;
}
function collide(x, z, y = 0, r = .33, skipSmall = true) {
  for (const c of colliders) {
    if (skipSmall && c.small) continue;
    if (!colBlocksAtY(c, y)) continue;
    [x, z] = resolveXZ(x, z, r, c);
  }
  return [Math.max(BOUNDS.x1, Math.min(BOUNDS.x2, x)), Math.max(BOUNDS.z1, Math.min(BOUNDS.z2, z))];
}
function applyPropPose(i, x, z, tip, y, ry, mnt) {
  const g = propObjs[i]; if (!g) return;
  const pr = PROPS[i]; const wall = WALL_PROP.has(pr[0]);
  const isMnt = mnt != null ? !!mnt : wall;
  const baseY = y != null ? y : (pr[4] || 0);
  const sz = modelCache[pr[0]]?.size;
  const posY = (wall && !isMnt && WALL_PROC.has(pr[0]) && sz) ? (baseY + sz.y * .5 + .02) : baseY;
  g.rotation.order = 'YXZ';
  g.position.set(x, posY, z);
  g.rotation.y = ry != null ? ry : (pr[3] * Math.PI / 180);
  g.rotation.x = tip ? Math.PI / 2 : 0;
  if (tip) { g.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(g); g.position.y += -bb.min.y; }
  g.updateMatrixWorld(true);
  if (g.userData.localCols) {
    syncPropCols(g);
    const cols = g.userData.cols || [];
    if (g.userData.shelves && SHELF_YS[pr[0]] && cols[0]) {
      const c = cols[0];
      g.userData.shelves = SHELF_YS[pr[0]].map(sy => ({ x1: c.x1, x2: c.x2, z1: c.z1, z2: c.z2, y: baseY + sy, needSmall: true }));
    } else if (cols.length) {
      g.userData.shelves = cols.filter(c => (c.y2 - (c.y1 || 0)) < .18 && (c.x2 - c.x1) * (c.z2 - c.z1) > .04)
        .map(c => ({ x1: c.x1, x2: c.x2, z1: c.z1, z2: c.z2, y: c.y2, needSmall: true }));
    }
  } else {
    const col = g.userData.col; if (col) {
      const bb = new THREE.Box3().setFromObject(g); const pad = .06;
      col.x1 = bb.min.x + pad; col.x2 = bb.max.x - pad; col.z1 = bb.min.z + pad; col.z2 = bb.max.z - pad;
      col.y1 = bb.min.y; col.y2 = Math.max(.08, bb.max.y);
      if (g.userData.shelves && SHELF_YS[pr[0]]) {
        g.userData.shelves = SHELF_YS[pr[0]].map(sy => ({ x1: col.x1, x2: col.x2, z1: col.z1, z2: col.z2, y: baseY + sy, needSmall: true }));
      }
    }
  }
}
function syncMoved(moved) {
  const map = new Map((moved || []).map(a => [a[0], a]));
  propObjs.forEach((g, i) => {
    if (!g) return;
    const pr = PROPS[i]; const m = map.get(i);
    if (m) applyPropPose(i, m[1], m[2], m[3], m[4], m[5], m[6]);
    else { // 回到原位（回合結束或沒被撞過）
      const ry0 = pr[3] * Math.PI / 180, y0 = pr[4] || 0;
      if (Math.abs(g.position.x - pr[1]) > .005 || Math.abs(g.position.z - pr[2]) > .005 || Math.abs(g.position.y - y0) > .005 || Math.abs(g.rotation.y - ry0) > .005 || Math.abs(g.rotation.x) > .005) {
        applyPropPose(i, pr[1], pr[2], 0, y0, ry0, WALL_PROP.has(pr[0]) ? 1 : 0);
      }
    }
  });
}
function pushSmall(x, z, y, r, dt, sprinting) {
  //  bump 小物件：走路推開，衝刺會翻倒。大件在 collide() 裡擋住。每件家具只推一次（可能有多個碰撞盒）。
  const seen = new Set();
  for (const c of colliders) {
    if (!c.small || c.off || c.prop == null || seen.has(c.prop)) continue;
    const g0 = propObjs[c.prop];
    const list = (g0 && g0.userData.cols && g0.userData.cols.length) ? g0.userData.cols : [c];
    const hit = list.find(cc => !cc.off && colBlocksAtY(cc, y) && overCol(x, z, r + .04, cc));
    if (!hit) continue;
    seen.add(c.prop);
    const i = c.prop, g = g0; if (!g || !g.visible) continue;
    const pcx = (hit.x1 + hit.x2) / 2, pcz = (hit.z1 + hit.z2) / 2;
    let nx = x - pcx, nz = z - pcz, nl = Math.hypot(nx, nz) || .001; nx /= nl; nz /= nl;
    const force = (sprinting ? 5.6 : 2.4) * dt;
    let px = g.position.x - nx * force, pz = g.position.z - nz * force;
    const pr = Math.max(.18, (hit.x2 - hit.x1 + hit.z2 - hit.z1) / 4);
    [px, pz] = collide(px, pz, 0, pr, true);
    const tip = sprinting || Math.abs(g.rotation.x) > .1 || !!pendingBumps.get(i)?.[3];
    applyPropPose(i, px, pz, tip);
    pendingBumps.set(i, [i, +px.toFixed(3), +pz.toFixed(3), tip ? 1 : 0]);
    [x, z] = resolveXZ(x, z, r, hit); // 人稍微被擋一下，但物件已經讓路
  }
  return [x, z];
}
function landY(x, z, y, ny, r) {
  let top = 0, landed = ny <= 0;
  if (ny <= 0) return { y: 0, landed: true };
  const consider = (c, t, needSmall) => {
    if (needSmall && !canSitOnShelf()) return;
    if (!overCol(x, z, r, c)) return;
    if (y >= t - .15 && ny <= t && y - t < 1.8 && t >= top) { top = t; landed = true; }
  };
  for (const c of colliders) {
    if (c.off) continue;
    consider(c, c.y2 ?? 0, false);
    const sh = c.prop != null ? propObjs[c.prop]?.userData.shelves : null;
    if (sh) for (const s of sh) consider(s, s.y, s.needSmall);
  }
  return landed ? { y: top, landed: true } : { y: ny, landed: false };
}
function tryStepUp(x, z, y, dx, dz, r) {
  const destX = x + dx, destZ = z + dz;
  let best = null;
  const consider = (c, t, needSmall) => {
    if (needSmall && !canSitOnShelf()) return;
    if (t <= y + .02 || t > y + CFG.STEP_UP) return;
    if (!overCol(destX, destZ, r, { x1: c.x1, x2: c.x2, z1: c.z1, z2: c.z2 })) return;
    if (best == null || t < best) best = t;
  };
  for (const c of colliders) {
    if (c.off) continue;
    consider(c, c.y2 ?? 0, false);
    const sh = c.prop != null ? propObjs[c.prop]?.userData.shelves : null;
    if (sh) for (const s of sh) consider(s, s.y, s.needSmall);
  }
  return best;
}
function canMove() { const s = G.s, p = me(); if (!s || !p) return false;
  if (s.phase === 'lobby') return true; if (s.phase === 'end') return true;
  if (p.role === 'seeker' && s.phase === 'hide') return false; return true; }
function doJump() { if (!canMove()) return; jumpQueued = true; }
function isWallProp(id) { return id >= 0 && WALL_PROP.has(PROPS[id]?.[0]); }
function wallPlane(pr) {
  const rot = (pr[3] || 0) * Math.PI / 180;
  const nx = Math.sin(rot), nz = Math.cos(rot);
  const axis = Math.abs(nx) > Math.abs(nz) ? 'x' : 'z';
  return { axis, pos: axis === 'x' ? pr[1] : pr[2], nx, nz, rot };
}
function findWallSeg(axis, pos, t) {
  let best = null;
  for (const c of colliders) {
    if (c.prop != null || c.small || c.glass || (c.y2 ?? 0) < 2) continue;
    if (axis === 'x') {
      if (Math.abs((c.x1 + c.x2) / 2 - pos) > .45) continue;
      if (t < c.z1 - .08 || t > c.z2 + .08) continue;
      best = { t0: c.z1, t1: c.z2, y0: c.y1 || 0, y1: c.y2 || 2.6 };
    } else {
      if (Math.abs((c.z1 + c.z2) / 2 - pos) > .45) continue;
      if (t < c.x1 - .08 || t > c.x2 + .08) continue;
      best = { t0: c.x1, t1: c.x2, y0: c.y1 || 0, y1: c.y2 || 2.6 };
    }
  }
  return best;
}
function wallBlocked(axis, pos, t, y, hw, hh, skipId) {
  // 窗戶
  for (const [a, p0, tc, yc, ht, hy] of WINDOW_HOLES) {
    if (a !== axis || Math.abs(p0 - pos) > .5) continue;
    if (Math.abs(t - tc) < ht + hw && Math.abs(y - yc) < hy + hh) return true;
  }
  for (let i = 0; i < PROPS.length; i++) {
    const g = propObjs[i]; if (i === skipId || propMap(i) !== curMap || !WALL_PROP.has(PROPS[i][0]) || !g?.visible) continue;
    const nx = Math.sin(g.rotation.y), nz = Math.cos(g.rotation.y);
    const oAxis = Math.abs(nx) > Math.abs(nz) ? 'x' : 'z';
    const oPos = oAxis === 'x' ? g.position.x : g.position.z;
    if (oAxis !== axis || Math.abs(oPos - pos) > .3) continue;
    const ot = axis === 'x' ? g.position.z : g.position.x, oy = g.position.y;
    const sz = modelCache[PROPS[i][0]]?.size; const ohw = sz ? Math.max(sz.x, sz.z) * .5 : .3, ohh = sz ? sz.y * .5 : .3;
    if (Math.abs(t - ot) < hw + ohw + .04 && Math.abs(y - oy) < hh + ohh + .04) return true;
  }
  return false;
}
function slideOnWall(dt, ix, iz, sp, propId) {
  const pr = PROPS[propId];
  const pl = local.mntAxis ? { axis: local.mntAxis, pos: local.mntPos, nx: local.mntNx, nz: local.mntNz } : wallPlane(pr);
  const sz = modelCache[pr[0]]?.size || { x: .6, y: .6, z: .08 };
  const hw = Math.max(sz.x, sz.z) * .5, hh = sz.y * .5;
  const tNow = pl.axis === 'x' ? local.z : local.x;
  // 左右 (A/D)：依鏡頭左右方向投影到牆面；上下 (W/S)：W 固定往上、S 固定往下
  const sin = Math.sin(cam.yaw), cos = Math.cos(cam.yaw);
  let dx = (ix * cos) * sp, dz = (-ix * sin) * sp;
  const dot = dx * pl.nx + dz * pl.nz; dx -= pl.nx * dot; dz -= pl.nz * dot;
  const dy = (-iz) * sp;
  let t = tNow + (pl.axis === 'x' ? dz : dx);
  let y = local.y + dy;
  const seg = findWallSeg(pl.axis, pl.pos, tNow) || findWallSeg(pl.axis, pl.pos, t);
  if (seg) {
    const padT = hw + .05, padY = hh + .05;
    t = Math.max(seg.t0 + padT, Math.min(seg.t1 - padT, t));
    y = Math.max(Math.max(seg.y0, .35) + padY, Math.min(seg.y1 - padY, y));
  } else { t = tNow; y = local.y; }
  // 若新位置撞窗／門／其他掛飾，只取消那個軸
  if (wallBlocked(pl.axis, pl.pos, t, y, hw, hh, propId)) {
    if (!wallBlocked(pl.axis, pl.pos, tNow, y, hw, hh, propId)) t = tNow;
    else if (!wallBlocked(pl.axis, pl.pos, t, local.y, hw, hh, propId)) y = local.y;
    else { t = tNow; y = local.y; }
  }
  if (pl.axis === 'x') { local.x = pl.pos; local.z = t; } else { local.z = pl.pos; local.x = t; }
  local.y = y; local.vy = 0; local.grounded = true;
}
function unmountFromWall(propId) {
  const pl = local.mntAxis ? { nx: local.mntNx, nz: local.mntNz } : wallPlane(PROPS[propId]);
  local.mounted = false; local.mntAxis = null;
  local.reMountAt = performance.now() + 350;
  local.x += pl.nx * .55; local.z += pl.nz * .55;
  local.y = Math.min(local.y, 1.1); local.vy = 1.6; local.grounded = false;
  toast('從牆上跳下來了，往牆面跳躍可再貼上');
}
function tryMountWall(nx, nz, y, r, propId) {
  const pr = PROPS[propId];
  const sz = modelCache[pr[0]]?.size || { x: .6, y: .6, z: .08 };
  const hw = Math.max(sz.x, sz.z) * .5, hh = sz.y * .5;
  for (const c of colliders) {
    if (!c.wall || c.off) continue;
    if (!overCol(nx, nz, r + .14, c)) continue;
    const w = c.x2 - c.x1, d = c.z2 - c.z1;
    const axis = w < d ? 'x' : 'z';
    let pos, mnx, mnz, t;
    if (axis === 'x') {
      const cx = (c.x1 + c.x2) / 2; mnx = local.x >= cx ? 1 : -1; mnz = 0;
      pos = cx + mnx * (w / 2 + .03); t = local.z;
    } else {
      const cz = (c.z1 + c.z2) / 2; mnx = 0; mnz = local.z >= cz ? 1 : -1;
      pos = cz + mnz * (d / 2 + .03); t = local.x;
    }
    const seg = findWallSeg(axis, pos, t); if (!seg) continue;
    const padT = hw + .05, padY = hh + .05;
    t = Math.max(seg.t0 + padT, Math.min(seg.t1 - padT, t));
    const my = Math.max(Math.max(seg.y0, .35) + padY, Math.min(seg.y1 - padY, Math.max(.85, y + hh)));
    if (wallBlocked(axis, pos, t, my, hw, hh, propId)) continue;
    local.mounted = true; local.mntAxis = axis; local.mntPos = pos; local.mntNx = mnx; local.mntNz = mnz;
    if (axis === 'x') { local.x = pos; local.z = t; } else { local.z = pos; local.x = t; }
    local.y = my; local.vy = 0; local.grounded = true;
    local.py = Math.atan2(mnx, mnz);
    toast('貼到牆面上了！WASD 滑動，空白鍵跳下來');
    return true;
  }
  return false;
}

function update(dt) {
  updateChirpPulses(dt);
  updateSmashFans(dt);
  updateNearHint();
  updateDebugRadius();
  const s = G.s, p = me();
  updateOverlay();
  let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x + (holdMove.ix || 0);
  let iz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + joy.y + (holdMove.iz || 0);
  const len = Math.hypot(ix, iz); if (len > 1) { ix /= len; iz /= len; }
  const wantSprint = !!(keys.ShiftLeft || keys.ShiftRight || sprintHold || holdMove.sprint);
  let sprinting = false;
  if (p && canMove() && wantSprint && len > .05 && local.stam > 0 && !local.exhausted) {
    sprinting = true; local.stam = Math.max(0, local.stam - dt); if (local.stam <= 0) { local.stam = 0; local.exhausted = true; } local.stamWait = CFG.STAMINA_DELAY;
  } else {
    if (local.stamWait > 0) local.stamWait -= dt;
    else local.stam = Math.min(CFG.STAMINA, local.stam + dt * (CFG.STAMINA / CFG.STAMINA_REGEN));
    if (local.exhausted && local.stam >= CFG.STAMINA * CFG.STAMINA_RESTART) local.exhausted = false;
  }
  const r = playR();
  if (p && canMove()) {
    if (local.mounted && isWallProp(p.prop)) {
      if (jumpQueued || keys.Space) { unmountFromWall(p.prop); jumpQueued = false; }
      else {
        jumpQueued = false;
        const sp = 3.6 * (sprinting ? CFG.SPRINT : 1) * dt;
        if (len > .05) slideOnWall(dt, ix, iz, sp, p.prop);
      }
    } else {
      if ((jumpQueued || keys.Space) && local.grounded) { local.vy = CFG.JUMP_V; local.grounded = false; }
      jumpQueued = false;
      if (len > .05) {
        const sp = (p.role === 'seeker' ? 4.6 : 4.2) * (sprinting ? CFG.SPRINT : 1) * dt;
        const sin = Math.sin(cam.yaw), cos = Math.cos(cam.yaw);
        const dx = (ix * cos + iz * sin) * sp, dz = (-ix * sin + iz * cos) * sp;
        let nx = local.x + dx, nz = local.z + dz;
        if (isWallProp(p.prop) && (!local.grounded || local.y > .15) && performance.now() > (local.reMountAt || 0) && tryMountWall(nx, nz, local.y, r, p.prop)) {
          // 已貼回牆面
        } else {
          const blocked = collide(nx, nz, local.y, r);
          if (local.grounded && Math.hypot(blocked[0] - nx, blocked[1] - nz) > .001) {
            const step = tryStepUp(local.x, local.z, local.y, dx, dz, r);
            if (step != null) { local.y = step; local.vy = 0; }
          }
          [nx, nz] = collide(local.x + dx, local.z + dz, local.y, r);
          [nx, nz] = pushSmall(nx, nz, local.y, r, dt, sprinting);
          [nx, nz] = collide(nx, nz, local.y, r);
          local.x = nx; local.z = nz; local.ry = Math.atan2(dx, dz);
        }
      }
      if (!local.mounted) {
        // 重力與著地
        local.vy -= CFG.GRAVITY * dt;
        const ny = local.y + local.vy * dt;
        const land = landY(local.x, local.z, local.y, ny, r);
        if (land.landed && local.vy <= 0) { local.y = land.y; local.vy = 0; local.grounded = true; }
        else { local.y = Math.max(0, ny); local.grounded = false; }
      }
    }
  }
  // 變身後轉動家具方向（Q/E 或手機按鈕；解鎖時跟著鏡頭轉）
  if (p && p.prop >= 0 && p.alive) {
    const rot = (keys.KeyE || rotHold > 0 ? -1 : 0) + (keys.KeyQ || rotHold < 0 ? 1 : 0);
    if (rot) local.py += rot * CFG.ROT_SPEED * dt;
    if (!local.lock && !local.mounted) local.py = cam.yaw + Math.PI;
  }
  if (net.myId && performance.now() - local.lastSend > 66) {
    local.lastSend = performance.now();
    if (p) { const bumps = pendingBumps.size ? [...pendingBumps.values()] : undefined; pendingBumps.clear();
      send({ t: 'p', x: local.x, z: local.z, y: local.y, ry: local.ry, py: local.py, pp: local.pp, mnt: local.mounted ? 1 : 0, bumps }); }
  }
  updatePaint(dt);

  // 角色位置（自己用本地，其他人平滑插值）
  const k = 1 - Math.exp(-dt * 12);
  for (const [id, v] of visuals) {
    const vp = v.p; if (!vp) continue;
    if (id === net.myId) { v.root.position.set(local.x, local.y, local.z); v.buddy.rotation.y = local.ry; if (v.disguise) v.disguise.rotation.y = local.py; }
    else { v.root.position.x += (v.tx - v.root.position.x) * k; v.root.position.z += (v.tz - v.root.position.z) * k; v.root.position.y += ((v.ty || 0) - v.root.position.y) * k;
      let dr = v.tr - v.buddy.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); v.buddy.rotation.y += dr * k;
      if (v.disguise) { let dp2 = v.tpy - v.disguise.rotation.y; dp2 = Math.atan2(Math.sin(dp2), Math.cos(dp2)); v.disguise.rotation.y += dp2 * Math.min(1, k * 1.5); } }
    const disguised = vp.prop >= 0;
    const viewer = me(); const iAmSeeker = viewer?.role === 'seeker';
    const visible = vp.alive || s?.phase === 'lobby' || s?.phase === 'end' || id === net.myId;
    v.root.visible = visible;
    v.buddy.visible = !disguised;
    // 名字：鬼看不到躲的人的名字（大廳/結束時大家都看得到）
    const open = s?.phase === 'lobby' || s?.phase === 'end';
    v.label.visible = visible && id !== net.myId && (open || !iAmSeeker || vp.role === 'seeker');
    // 被抓的自己變半透明幽靈
    const ghost = id === net.myId && !vp.alive && s?.phase !== 'lobby' && s?.phase !== 'end';
    v.root.traverse(o => { if (o.isMesh) { o.material.transparent = ghost; o.material.opacity = ghost ? .35 : 1; } });
    if (v.note.visible && performance.now() > v.noteUntil) v.note.visible = false;
    if (v.note.visible) v.note.position.y = (p.role === 'seeker' ? 1.25 : .95) + Math.sin(performance.now() / 120) * .1;
  }

  // 鏡頭
  const myV = visuals.get(net.myId);
  const dp = p?.prop >= 0 ? propObjs[p.prop]?.userData : null;
  const dist = dp ? Math.max(2.3, dp.height * 2.6) : 2.8;
  const focusY = local.mounted ? local.y : ((dp ? Math.max(.45, dp.height * .75) : (p?.role === 'seeker' ? .62 : .42)) + local.y);
  const focus = new THREE.Vector3(local.x, focusY, local.z);
  if (!p) { focus.set(0, 0, 0); }
  const dir = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
  let d = p ? dist : 22;
  if (p) { ray.set(focus, dir); ray.far = dist;
    const solids = wallMeshes.filter(w => w.userData.kind === 'wall' || w.userData.kind === 'ceiling' || w.userData.kind === 'floor');
    const h = ray.intersectObjects(solids, false)[0]; if (h) d = Math.max(.6, h.distance - .25); }
  camera.position.copy(focus).addScaledVector(dir, d); camera.lookAt(focus);
  for (const c of houseCeiling) c.visible = !debugCam || debugCam[2] === true; // debugCam[2]=true：截圖時保留天花板
  if (debugCam) { camera.position.set(...debugCam[0]); camera.lookAt(...debugCam[1]); }

  // 躲的人：準心瞄準家具
  if (p && p.role === 'hider' && p.alive && (s.phase === 'hide' || s.phase === 'seek')) {
    if (target != null && !inRange(target)) target = null;
    if (!tapTargetUntil || performance.now() > tapTargetUntil) {
      ray.setFromCamera({ x: 0, y: 0 }, camera); ray.far = 30;
      const h = ray.intersectObjects(pickProps, false).find(h => inRange(h.object.userData.id));
      target = h ? h.object.userData.id : null;
    }
  } else target = null;
  if (target != null) { if (highlight.userData.t !== target) { highlight.box.setFromObject(propObjs[target]); highlight.box.expandByScalar(.05); highlight.userData.t = target; } highlight.visible = true; }
  else { highlight.visible = false; highlight.userData.t = null; }
}
let tapTargetUntil = 0;
let debugCam = null;
const highlight = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color('#ffe14d')); highlight.visible = false; scene.add(highlight);
function inRange(id) { const o = propObjs[id]; if (!o || o.userData.smashed || (G.s?.smashed || []).includes(id)) return false; return Math.hypot(o.position.x - local.x, o.position.z - local.z) < CFG.TF_RANGE + o.userData.radius * .5; }

// ---------- 動作 ----------
function doTransform() {
  const p = me(); const s = G.s; if (!p || p.role !== 'hider' || !p.alive || !(s.phase === 'hide' || s.phase === 'seek')) return;
  if ((p.tfLock || 0) > 0) return toast(`還不能變身（${Math.ceil(p.tfLock / 1000)} 秒）`);
  if (target == null) return toast('先對準或點一下附近的家具');
  if (target === p.prop) return toast('你已經是這個了');
  if ((s.smashed || []).includes(target)) return toast('這件家具已經被破壞了');
  send({ t: 'tf', id: target });
}
let lastSmashAt = 0;
function smashAim() {
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  return {
    fx: -Math.sin(cam.yaw) * cp,
    fy: -sp,
    fz: -Math.cos(cam.yaw) * cp,
    ox: local.x,
    oy: (local.y || 0) + .62,
    oz: local.z
  };
}
function smashFacing() { const a = smashAim(); return { fx: a.fx, fy: a.fy, fz: a.fz }; }
function inSmashCone(px, py, pz, ox, oy, oz, fx, fy, fz) {
  const dx = px - ox, dy = py - oy, dz = pz - oz;
  const d = Math.hypot(dx, dy, dz);
  if (d <= .08) return true;
  if (d > CFG.SMASH_RANGE + 1e-6) return false;
  const h = Math.hypot(dx, dz);
  const fh = Math.hypot(fx, fz) || 1e-6;
  if (h > .04 && (dx * fx + dz * fz) / (h * fh) < Math.cos(CFG.SMASH_ANGLE) - 1e-9) return false;
  const aimPitch = Math.atan2(fy, fh);
  const propPitch = Math.atan2(dy, Math.max(h, 1e-6));
  if (Math.abs(propPitch - aimPitch) > CFG.SMASH_VANGLE + 1e-9) return false;
  return true;
}
function closestOnCol(ox, oy, oz, c) {
  return {
    x: Math.max(c.x1, Math.min(ox, c.x2)),
    y: Math.max(c.y1 ?? 0, Math.min(oy, c.y2 ?? 0)),
    z: Math.max(c.z1, Math.min(oz, c.z2))
  };
}
function propInSmashCone(i, ox, oy, oz, fx, fy, fz, mv) {
  const pr = PROPS[i], g = propObjs[i];
  const cols = g?.userData.cols;
  if (cols && cols.length) {
    for (const c of cols) {
      if (c.off) continue;
      const p = closestOnCol(ox, oy, oz, c);
      const cx = (c.x1 + c.x2) / 2, cy = ((c.y1 ?? 0) + (c.y2 ?? 0)) / 2, cz = (c.z1 + c.z2) / 2;
      if (inSmashCone(p.x, p.y, p.z, ox, oy, oz, fx, fy, fz) || inSmashCone(cx, cy, cz, ox, oy, oz, fx, fy, fz)) return true;
    }
    return false;
  }
  const px = mv ? mv.x : pr[1], pz = mv ? mv.z : pr[2];
  const py0 = mv && mv.y != null ? mv.y : (pr[4] || 0);
  const hy = (modelCache[pr[0]]?.size?.y || .4) * .5;
  return inSmashCone(px, py0 + hy, pz, ox, oy, oz, fx, fy, fz);
}
function smashCdLeft() {
  const self = me(), s = G.s, now = Date.now();
  let last = lastSmashAt || 0;
  if (s?.smashAt) {
    const row = s.smashAt.find(r => r[0] === (self?.id || net.myId));
    if (row) last = Math.max(last, row[1]);
  }
  return last ? Math.max(0, CFG.SMASH_CD - (now - last)) : 0;
}
function doSmash() {
  const p = me(); const s = G.s;
  if (!p || p.role !== 'seeker' || s?.phase !== 'seek') return;
  const left = smashCdLeft();
  if (left > 0) return toast(`破壞還在冷卻（${Math.ceil(left / 1000)} 秒）`);
  const a = smashAim();
  local.ry = Math.atan2(a.fx, a.fz);
  lastSmashAt = Date.now();
  send({ t: 'smash', fx: a.fx, fy: a.fy, fz: a.fz, x: a.ox, y: a.oy, z: a.oz });
}
let smashBuf = null;
function getSmashSound() {
  if (smashBuf) return smashBuf;
  const ctx = listener.context, sr = ctx.sampleRate, n = Math.floor(.28 * sr);
  const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const t = i / sr, env = Math.exp(-t * 14) * (t < .03 ? t / .03 : 1);
    d[i] = ((Math.random() * 2 - 1) * .7 + Math.sin(2 * Math.PI * (90 + t * 40) * t) * .3) * env * .55;
  }
  return smashBuf = buf;
}
function playSmashSound() {
  try { const a = new THREE.Audio(listener); a.setBuffer(getSmashSound()); a.setVolume(.7); a.play(); a.onEnded = () => { a.isPlaying = false; }; } catch { }
}
const smashFans = [];
function spawnSmashFan(x, y, z, fx, fy, fz) {
  const range = CFG.SMASH_RANGE, hAng = CFG.SMASH_ANGLE, vAng = CFG.SMASH_VANGLE;
  const fl = Math.hypot(fx, fy || 0, fz) || 1; fx /= fl; fy = (fy || 0) / fl; fz /= fl;
  const yaw = Math.atan2(fx, fz);
  const geo = new THREE.BufferGeometry();
  const pos = [];
  const rings = 7, segs = 12;
  const push = (px, py, pz) => { pos.push(px, py, pz); };
  // 水平扇（地面）＋垂直張開的前緣，短促顯示攻擊範圍
  for (let i = 0; i <= segs; i++) {
    const a = yaw - hAng + (2 * hAng * i) / segs;
    const x1 = x + Math.sin(a) * range, z1 = z + Math.cos(a) * range;
    push(x, 0.04, z); push(x1, 0.04, z1);
  }
  const pitch0 = Math.atan2(fy, Math.hypot(fx, fz));
  for (const sign of [-1, 0, 1]) {
    const pit = pitch0 + sign * vAng;
    const cy = Math.cos(pit), sy = Math.sin(pit);
    for (let i = 0; i < segs; i++) {
      const a0 = yaw - hAng + (2 * hAng * i) / segs;
      const a1 = yaw - hAng + (2 * hAng * (i + 1)) / segs;
      const y1 = y + sy * range, y0 = y;
      push(x, y, z);
      push(x + Math.sin(a0) * range * cy, y + sy * range, z + Math.cos(a0) * range * cy);
      push(x, y, z);
      push(x + Math.sin(a1) * range * cy, y + sy * range, z + Math.cos(a1) * range * cy);
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xff8a4a, transparent: true, opacity: .45, depthWrite: false });
  const mesh = new THREE.LineSegments(geo, mat);
  mesh.renderOrder = 8; scene.add(mesh);
  smashFans.push({ mesh, t: 0 });
}
function updateSmashFans(dt) {
  for (let i = smashFans.length - 1; i >= 0; i--) {
    const f = smashFans[i]; f.t += dt;
    const k = 1 - f.t / .45;
    if (f.mesh.material) f.mesh.material.opacity = Math.max(0, k) * .45;
    if (f.t >= .45) {
      scene.remove(f.mesh);
      f.mesh.geometry.dispose(); f.mesh.material.dispose();
      smashFans.splice(i, 1);
    }
  }
}
const debrisPieces = [];
const debrisSeen = new Set();
let debrisGeo = null;
function spawnDebris(i, x, z, name) {
  if (debrisSeen.has(i)) return; debrisSeen.add(i);
  if (!debrisGeo) debrisGeo = new THREE.BoxGeometry(1, 1, 1);
  const pal = ['#c4a574', '#8d6e4c', '#d9c4a0', '#6b5344', '#e8d5b5', '#a67c52', '#7a5a3a'];
  const n = 6;
  for (let k = 0; k < n; k++) {
    const s = .07 + Math.random() * .13;
    const mat = new THREE.MeshStandardMaterial({ color: pal[(i + k) % pal.length], roughness: .85, metalness: 0 });
    const m = new THREE.Mesh(debrisGeo, mat);
    const ang = (k / n) * Math.PI * 2 + Math.random() * .5;
    const r = .12 + Math.random() * .4;
    m.scale.set(s, s * (.5 + Math.random() * .7), s * (.6 + Math.random()));
    m.position.set(x + Math.cos(ang) * r, .03 + Math.random() * .05, z + Math.sin(ang) * r);
    m.rotation.set(Math.random() * .8, Math.random() * Math.PI, Math.random() * .8);
    m.castShadow = !LOW; m.receiveShadow = !LOW;
    scene.add(m); debrisPieces.push(m);
  }
  if (debrisPieces.length > 240) {
    const extra = debrisPieces.splice(0, debrisPieces.length - 240);
    for (const m of extra) { scene.remove(m); if (m.material) m.material.dispose(); }
  }
}
function clearDebris() {
  for (const m of debrisPieces) { scene.remove(m); if (m.material) m.material.dispose(); }
  debrisPieces.length = 0; debrisSeen.clear();
}
function syncSmashed(ids) {
  const set = new Set(ids || []);
  propObjs.forEach((g, i) => { if (g) g.userData.smashed = set.has(i); });
  if (G.s?.phase === 'lobby') { clearDebris(); return; }
  for (const i of set) {
    if (debrisSeen.has(i)) continue;
    const g = propObjs[i], pr = PROPS[i];
    const x = g ? g.position.x : pr?.[1], z = g ? g.position.z : pr?.[2];
    if (x != null) spawnDebris(i, x, z, pr?.[0]);
  }
}
let lastTauntPress = 0, overlayUntil = 0;
function doTaunt(aimPt) {
  const p = me(); const s = G.s;
  if (!p || p.role !== 'hider' || !p.alive) return;
  if (s?.phase !== 'seek') return toast('等鬼出動再噴漆！');
  if (performance.now() - lastTauntPress < CFG.TAUNT_CD) {
    const left = Math.ceil((CFG.TAUNT_CD - (performance.now() - lastTauntPress)) / 1000);
    return toast(`顏料彈還在冷卻（${left} 秒）`);
  }
  if (!aimPt) pickAt(innerWidth / 2, innerHeight / 2); const aim = aimPt || lastPickPoint; if (!aim) return;
  const baseY = local.mounted ? local.y : (local.y + (p.prop >= 0 ? ((modelCache[PROPS[p.prop][0]]?.size.y || .4) * .5) : .38));
  const o = new THREE.Vector3(local.x, baseY, local.z);
  const dir = aim.clone().sub(o); if (dir.lengthSq() < 1e-6) return; dir.normalize();
  o.addScaledVector(dir, .4);
  local.ry = Math.atan2(aim.x - local.x, aim.z - local.z);
  lastTauntPress = performance.now();
  send({ t: 'hshot', o: o.toArray(), a: aim.toArray() });
}
function ensureOverlayTex() {
  const el = $('paintOv'); if (!el || el.dataset.ready) return;
  const c = document.createElement('canvas'); c.width = 1024; c.height = 640; const x = c.getContext('2d');
  const cols = ['#ff4f8b', '#3ec1ff', '#ffd23f', '#7bdc6b', '#b07cff', '#ff8a3d', '#ff6f91'];
  for (let i = 0; i < 18; i++) {
    const cx = Math.random() * 1024, cy = Math.random() * 640, R = 70 + Math.random() * 160;
    x.fillStyle = cols[i % cols.length]; x.beginPath(); x.arc(cx, cy, R * .45, 0, Math.PI * 2); x.fill();
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.random() * .4, r = R * (.4 + Math.random() * .5);
      x.beginPath(); x.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 12 + Math.random() * 22, 0, Math.PI * 2); x.fill(); }
  }
  el.style.backgroundImage = `url(${c.toDataURL()})`; el.dataset.ready = '1';
}
function showPaintOverlay() {
  const el = $('paintOv'); if (!el) return; ensureOverlayTex(); el.style.opacity = '0.75'; overlayUntil = performance.now() + CFG.TAUNT_MS;
}
function clearPaintOverlay() { overlayUntil = 0; const el = $('paintOv'); if (el) el.style.opacity = '0'; }
function updateOverlay() {
  if (!overlayUntil) return; const el = $('paintOv'); if (!el) return;
  const left = overlayUntil - performance.now();
  if (left <= 0) { el.style.opacity = '0'; overlayUntil = 0; }
  else if (left < 800) el.style.opacity = String(0.75 * left / 800);
}
let lastPickPoint = null, lastShotAt = 0;
const PAINT = ['#ff4f8b', '#3ec1ff', '#ffd23f', '#7bdc6b', '#b07cff', '#ff8a3d'];
function toggleLock() { local.lock = !local.lock; toast(local.lock ? '🔒 家具方向已鎖定（Q/E 或按鈕轉）' : '🔓 家具會跟著鏡頭轉'); updateUI(); }
function shootAt(cx, cy) {
  const s = G.s, self = me();
  if (self?.role !== 'seeker' || s?.phase !== 'seek') return;
  const myHp = (s.hps || []).find(r => r[0] === self.id);
  if (myHp && myHp[1] <= 0) { toast('血量歸零，不能再射了'); return; }
  if (performance.now() - lastShotAt < CFG.SHOT_CD) return; lastShotAt = performance.now();
  pickAt(cx, cy); const aim = lastPickPoint;
  const v = visuals.get(net.myId); if (!v) return;
  local.ry = Math.atan2(aim.x - local.x, aim.z - local.z); v.buddy.rotation.y = local.ry; v.root.position.set(local.x, local.y, local.z);
  v.root.updateMatrixWorld(true);
  const gun = v.buddy.getObjectByName('gun'); const o = gun ? gun.localToWorld(new THREE.Vector3(0, 0, .5)) : new THREE.Vector3(local.x, .48 + local.y, local.z);
  send({ t: 'shoot', o: o.toArray(), a: aim.toArray() });
}
const projectiles = new Map(); const splats = []; const bursts = [];
const projGeo = new THREE.SphereGeometry(.11, 12, 10);
let splatTex = null;
function getSplatTex() {
  if (splatTex) return splatTex; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#fff';
  x.beginPath(); x.arc(64, 64, 34, 0, Math.PI * 2); x.fill();
  for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2 + Math.random() * .4, r = 34 + Math.random() * 22, s = 6 + Math.random() * 9;
    x.beginPath(); x.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, s, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.cos(a - .15) * r, 64 + Math.sin(a - .15) * r); x.lineTo(64 + Math.cos(a + .15) * r, 64 + Math.sin(a + .15) * r); x.fill(); }
  return splatTex = new THREE.CanvasTexture(c);
}
function spawnProjectile(m) {
  const mesh = new THREE.Mesh(projGeo, new THREE.MeshBasicMaterial({ color: m.c })); mesh.position.fromArray(m.o); scene.add(mesh);
  projectiles.set(m.sid, { mesh, o: new THREE.Vector3().fromArray(m.o), d: new THREE.Vector3().fromArray(m.d), sp: m.sp, t0: performance.now() });
  if (m.o) playSplatAt(m.o[0], m.o[1], m.o[2]);
}
function endProjectile(sid) { const pr = projectiles.get(sid); if (!pr) return; scene.remove(pr.mesh); projectiles.delete(sid); }
function addSplat(p, n, c) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.75, .75), new THREE.MeshBasicMaterial({ map: getSplatTex(), color: c, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  const nv = new THREE.Vector3().fromArray(n); mesh.position.fromArray(p).addScaledVector(nv, .015);
  mesh.lookAt(mesh.position.clone().add(nv)); mesh.rotateZ(Math.random() * Math.PI * 2); mesh.scale.setScalar(.8 + Math.random() * .5);
  mesh.renderOrder = 2; scene.add(mesh); splats.push(mesh);
  if (splats.length > 160) scene.remove(splats.shift());
}
function paintBurst(p) { for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(projGeo, new THREE.MeshBasicMaterial({ color: PAINT[i % PAINT.length] }));
  m.position.fromArray(p); m.userData.v = new THREE.Vector3(Math.random() - .5, Math.random() * .8 + .3, Math.random() - .5).multiplyScalar(5); m.userData.t = 0; scene.add(m); bursts.push(m); } }
function clearPaint() { for (const m of splats) scene.remove(m); splats.length = 0; for (const sid of [...projectiles.keys()]) endProjectile(sid); }
function updatePaint(dt) {
  const now = performance.now();
  for (const [sid, pr] of projectiles) { const t = (now - pr.t0) / 1000; pr.mesh.position.copy(pr.o).addScaledVector(pr.d, Math.min(t * pr.sp, CFG.SHOT_RANGE)); if (t > 4) endProjectile(sid); }
  for (const m of [...bursts]) { m.userData.t += dt; m.userData.v.y -= 9.8 * dt; m.position.addScaledVector(m.userData.v, dt); if (m.userData.t > .7) { scene.remove(m); bursts.splice(bursts.indexOf(m), 1); } }
}
// 變身＝取代：被躲藏者變成的那件家具，對所有人隱藏（被抓或回合結束就恢復）
function syncHiddenProps(phase, players) {
  const held = new Set(); if (phase === 'hide' || phase === 'seek') for (const q of players) if (q.role === 'hider' && q.alive && q.prop >= 0) held.add(q.prop);
  const smashed = new Set(G.s?.smashed || []);
  propObjs.forEach((g, i) => { const h = held.has(i) || smashed.has(i); g.visible = !h; if (g.userData.cols) for (const c of g.userData.cols) c.off = h; else if (g.userData.col) g.userData.col.off = h; });
}
function visibleChain(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }
function pickAt(cx, cy) {
  const ndc = { x: cx / innerWidth * 2 - 1, y: -(cy / innerHeight) * 2 + 1 };
  ray.setFromCamera(ndc, camera); ray.far = 60;
  const objs = [...pickProps, ...wallMeshes];
  for (const [id, v] of visuals) if (id !== net.myId) v.root.traverse(o => o.isMesh && objs.push(o));
  const hits = ray.intersectObjects(objs, false).filter(h => visibleChain(h.object));
  lastPickPoint = hits[0] ? hits[0].point.clone() : ray.ray.at(40, new THREE.Vector3());
  return hits[0]?.object.userData || null;
}
function onTap(cx, cy) {
  const s = G.s, p = me(); if (!s || !p) return;
  const u = pickAt(cx, cy);
  if (p.role === 'seeker') {
    if (s.phase !== 'seek' || !p.alive) return;
    shootAt(cx, cy);
  } else if (p.alive && (s.phase === 'hide' || s.phase === 'seek')) {
    if (u?.kind === 'prop') { if (inRange(u.id)) { target = u.id; tapTargetUntil = performance.now() + 4000; toast('選好了！按「變身」'); } else toast('太遠了，走近一點'); }
  }
}

// ---------- 輸入 ----------
function isTyping(el = document.activeElement) {
  if (!el || el === document.body) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
addEventListener('keydown', e => {
  if (isTyping(e.target)) {
    if (e.key === 'Escape' && e.target === $('chatIn')) {
      e.preventDefault(); $('chatIn').blur();
      if (!$('hud').classList.contains('hidden')) $('chatBox')?.classList.add('collapsed');
    }
    return;
  }
  if (e.key === 'Enter' && !e.repeat && $('home').classList.contains('hidden')) {
    const inGame = !$('hud').classList.contains('hidden');
    if (inGame || e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      if (inGame) { $('chatBox')?.classList.remove('collapsed'); renderChat(); }
      $('chatIn')?.focus();
      return;
    }
  }
  keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) doJump(); }
  if (e.code === 'KeyF') doTransform();
  if (e.code === 'KeyT') doTaunt();
  if (e.code === 'KeyG') doSmash();
  if (e.code === 'KeyR' && !e.repeat) toggleLock();
});
addEventListener('wheel', e => { if (isTyping(e.target)) return; const p = me(); if (p?.prop >= 0 && p.alive) { local.py += Math.sign(e.deltaY) * .26; } }, { passive: true });
addEventListener('keyup', e => { keys[e.code] = false; });
const drags = new Map();
renderer.domElement.addEventListener('pointerdown', e => {
  drags.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), btn: e.button, moved: 0 });
  try { renderer.domElement.setPointerCapture(e.pointerId); } catch { }
});
renderer.domElement.addEventListener('pointermove', e => { const d = drags.get(e.pointerId); if (!d) return;
  d.moved = Math.max(d.moved || 0, Math.hypot(e.clientX - d.sx, e.clientY - d.sy));
  cam.yaw -= (e.clientX - d.x) * .006; cam.pitch = Math.max(CFG.PITCH_MIN, Math.min(CFG.PITCH_MAX, cam.pitch + (e.clientY - d.y) * .005)); d.x = e.clientX; d.y = e.clientY; });
const endDrag = e => { const d = drags.get(e.pointerId); if (!d) return; drags.delete(e.pointerId);
  if (e.type !== 'pointerup') return;
  const dist = Math.hypot(e.clientX - d.sx, e.clientY - d.sy);
  const dt = performance.now() - d.t;
  if (d.btn === 2) {
    // 右鍵：短點＋幾乎沒移動＝破壞（僅鬼）；拖曳只轉鏡頭，不砸
    if (dist < 5 && (d.moved || 0) < 5 && dt < 200 && me()?.role === 'seeker') doSmash();
    return;
  }
  if (dist < 10 && dt < 400) onTap(e.clientX, e.clientY);
};
renderer.domElement.addEventListener('pointerup', endDrag); renderer.domElement.addEventListener('pointercancel', endDrag);
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
{ // 搖桿
  const base = $('joy'), knob = $('knob'); let pid = null;
  const set = e => { const r = base.getBoundingClientRect(); let x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
    const m = r.width / 2 - 20, l = Math.hypot(x, y); if (l > m) { x *= m / l; y *= m / l; }
    knob.style.transform = `translate(${x}px,${y}px)`; joy.x = x / m; joy.y = y / m; };
  base.addEventListener('pointerdown', e => { pid = e.pointerId; try { base.setPointerCapture(pid); } catch { } set(e); });
  base.addEventListener('pointermove', e => { if (e.pointerId === pid) set(e); });
  const up = e => { if (e.pointerId !== pid) return; pid = null; joy.x = joy.y = 0; knob.style.transform = ''; };
  base.addEventListener('pointerup', up); base.addEventListener('pointercancel', up);
}
$('tfBtn').addEventListener('click', doTransform);
$('tauntBtn').addEventListener('click', doTaunt);
$('smashBtn').addEventListener('click', doSmash);
$('lockBtn').addEventListener('click', toggleLock);
for (const [id, dir] of [['rotL', -1], ['rotR', 1]]) { const b = $(id);
  b.addEventListener('pointerdown', e => { rotHold = dir; try { b.setPointerCapture(e.pointerId); } catch { } });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => { if (rotHold === dir) rotHold = 0; }); }
$('jumpBtn').addEventListener('click', doJump);
{ const b = $('sprintBtn');
  b.addEventListener('pointerdown', e => { sprintHold = true; try { b.setPointerCapture(e.pointerId); } catch { } });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => { sprintHold = false; }); }

// ---------- 介面 ----------
function homeMsg(t) { $('homeMsg').textContent = t; }
function applyChatFeedPref() {
  const show = localStorage.getItem('ph-chatfeed') !== '0';
  $('chatFeed')?.classList.toggle('hidden', !show);
  const b = $('chatFeedToggle');
  if (b) { b.textContent = show ? '👁 隱藏訊息' : '👁 顯示訊息'; b.classList.toggle('off', !show); }
}
function showScreen(n) {
  $('home').classList.toggle('hidden', n !== 'home'); $('lobby').classList.toggle('hidden', n !== 'lobby'); $('hud').classList.toggle('hidden', n !== 'game');
  const box = $('chatBox');
  if (box && n === 'lobby') { $('lobby').querySelector('.lobbyLayout').appendChild(box); box.classList.remove('collapsed'); if ($('chatFeed')) $('chatFeed').innerHTML = ''; }
  if (box && n === 'game') { $('hud').appendChild(box); box.classList.add('collapsed'); $('chatIn')?.blur(); applyChatFeedPref(); }
  if (box) box.classList.toggle('hidden', n === 'home');
  if (n === 'home') sbFetchRooms();
  $('chatToggle')?.classList.toggle('hidden', n !== 'game');
  $('chatFeedToggle')?.classList.toggle('hidden', n !== 'game');
  $('chatHide')?.classList.toggle('hidden', n !== 'game');
}
function showDiePop(m) {
  const pop = $('diePop'); if (!pop) return;
  // 遊戲中擲骰不會發生；彈窗掛在大廳
  if ($('lobby') && $('lobby').classList.contains('hidden') === false) {
    $('diePopName').textContent = `${m.avatar || ''} ${m.name} 擲出了`.trim();
    const face = $('diePopFace');
    let i = 0; face.textContent = '🎲'; face.classList.remove('spin'); void face.offsetWidth; face.classList.add('spin');
    const t = setInterval(() => { face.textContent = DIE_FACE[i++ % 6]; }, 70);
    setTimeout(() => { clearInterval(t); face.textContent = DIE_FACE[m.n - 1] || '🎲'; $('diePopNum').textContent = m.n + ' 點'; }, 700);
    pop.classList.remove('hidden');
    clearTimeout(showDiePop._t); showDiePop._t = setTimeout(() => pop.classList.add('hidden'), 1600);
  }
}
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; $('toasts').appendChild(d); setTimeout(() => d.remove(), 2600); }
function flash(c) { const d = document.createElement('div'); d.style.cssText = `position:fixed;inset:0;background:${c};opacity:.35;pointer-events:none;z-index:9;transition:opacity .5s`; document.body.appendChild(d); requestAnimationFrame(() => requestAnimationFrame(() => d.style.opacity = 0)); setTimeout(() => d.remove(), 600); }
function shareLink() { return location.origin + location.pathname + '?room=' + net.code + (Q.get('net') === 'local' ? '&net=local' : ''); }
function enterLobby() {
  try { listener.context.resume(); getSplatSound(); } catch { }
  history.replaceState(null, '', location.pathname + '?room=' + net.code + (Q.get('net') === 'local' ? '&net=local' : '') + (net.isHost && (Q.get('hide') || Q.get('seek')) ? `&hide=${CFG.HIDE_MS / 1000}&seek=${CFG.SEEK_MS / 1000}` : ''));
  $('roomCode').textContent = net.code; $('shareUrl').value = shareLink(); showScreen('lobby');
}
function onPhaseChange(ph) {
  if (ph === 'lobby') { showScreen('lobby'); $('endBox').classList.add('hidden'); }
  else showScreen('game');
  if (ph === 'hide') { const p = me(); toast(p?.role === 'seeker' ? '你是鬼！先閉眼 ' + activeHideMs() / 1000 + ' 秒' : '快躲好！對準家具按「變身」'); }
}
function fmt(ms) { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function placeHudCenter() {
  const tb = $('topbar'), c = $('hudCenter');
  if (!tb || !c) return;
  const r = tb.getBoundingClientRect();
  c.style.top = Math.round(r.bottom + 8) + 'px';
}
function renderHp(s) {
  const wrap = $('hpWrap'); if (!wrap) return;
  const rows = (s.hps && s.hps.length) ? s.hps.map(([id, hp]) => {
    const q = s.players.find(p => p.id === id);
    return { id, hp, name: q?.name || '鬼' };
  }) : [{ id: '', hp: s.hp, name: '鬼' }];
  const multi = rows.length > 1;
  wrap.classList.toggle('multi', multi);
  wrap.innerHTML = rows.map(r => `<div class="hpRow"><span class="hpName">${esc(multi ? r.name : '鬼的血量')}</span><div class="hpBar"><div class="hpFill" style="width:${r.hp}%"></div></div><span class="hpNum">${r.hp}</span></div>`).join('');
}
function updateUI() {
  const s = G.s; if (!s) return; const p = me();
  // 大廳
  $('pCount').textContent = `${s.players.length}/8`;
  $('pList').innerHTML = s.players.map(q => {
    const you = q.id === net.myId ? '（你）' : '';
    const host = q.id === CFG.PREFIX + s.code ? ' 👑房主' : '';
    const face = q.roll ? DIE_FACE[q.roll - 1] : (q.needReroll ? '🎲' : '');
    const rdy = q.ready ? '<span class="rdy on">✓ 已準備</span>' : '<span class="rdy off">尚未準備</span>';
    const skIds = s.dice?.seekers?.length ? s.dice.seekers : (s.dice?.seeker ? [s.dice.seeker] : []);
    const isSk = s.dice?.status === 'done' && skIds.includes(q.id);
    return `<li${isSk ? ' class="isSeeker"' : ''}><span class="av">${esc(q.avatar || '🙂')}</span><span class="dot" style="background:${q.color}"></span><span class="nm">${esc(q.name)}${you}${host}${isSk ? ' 👻' : ''}</span>${rdy}${face ? `<span class="dieFace" title="${q.roll} 點">${face}</span>` : ''}</li>`;
  }).join('');
  const allReady = s.players.length >= 2 && s.players.every(q => q.ready);
  const needSk = s.dice?.need || (s.players.length >= 6 ? 2 : 1);
  const diceDone = s.dice?.status === 'done' && ((s.dice.seekers && s.dice.seekers.length === needSk) || (!s.dice.seekers && s.dice.seeker));
  const testSkip = Q.get('seekerhost') === '1';
  const canStart = s.players.length >= 2 && (testSkip || (allReady && diceDone));
  $('startBtn').classList.toggle('hidden', !net.isHost); $('startBtn').disabled = !canStart;
  const selfP = me();
  if ($('readyBtn')) {
    $('readyBtn').textContent = selfP?.ready ? '取消準備' : '準備';
    $('readyBtn').classList.toggle('on', !!selfP?.ready);
  }
  if ($('rollBtn')) {
    const inTie = s.dice?.status === 'tie';
    const canRoll = s.phase === 'lobby' && selfP && (inTie ? (s.dice.tied || []).includes(selfP.id) && (selfP.needReroll || !selfP.roll) : !selfP.roll);
    $('rollBtn').disabled = !canRoll;
    $('rollBtn').textContent = inTie && canRoll ? '再擲一次 🎲' : (selfP?.roll ? `已擲出 ${selfP.roll}` : '擲骰 🎲');
  }
  const skIds = s.dice?.seekers?.length ? s.dice.seekers : (s.dice?.seeker ? [s.dice.seeker] : []);
  const seekerPs = skIds.map(id => s.players.find(q => q.id === id)).filter(Boolean);
  if ($('diceMsg')) {
    const two = needSk >= 2;
    $('diceMsg').textContent = s.dice?.status === 'tie' ? `平手！${(s.dice.tied || []).map(id => s.players.find(q => q.id === id)?.name).filter(Boolean).join('、')} 點數相同，請再擲一次`
      : (diceDone && seekerPs.length ? (seekerPs.length > 1
        ? `👻 這局由 ${seekerPs.map(q => `${q.name}（${q.roll} 點）`).join('、')} 當鬼`
        : `👻 這局由 ${seekerPs[0].name} 當鬼（擲出 ${seekerPs[0].roll} 點）`)
        : (allReady ? (two ? '請大家按「擲骰」，點數最低的兩人當鬼（6 人以上）' : '請大家按「擲骰」，點數最低的當鬼') : ''));
  }
  $('lobbyMsg').textContent = s.players.length < 2 ? '至少要 2 個人才能開始，把房號或連結傳給朋友！'
    : !allReady ? (net.isHost ? '等所有人都按「準備」，並擲骰決定誰當鬼' : '請按「準備」，大家準備好並擲骰後，等房主開始')
    : !diceDone && !testSkip ? (s.dice?.status === 'tie' ? '平手的人再擲一次，才能開始' : '請還沒擲的人按「擲骰」')
    : (net.isHost ? '可以開始遊戲了！' : '等房主按開始…');
  paintLooks();
  for (const b of document.querySelectorAll('#mapPick .mapBtn')) { b.classList.toggle('sel', b.dataset.map === (s.map || 'home')); b.disabled = !net.isHost; }
  if ($('mapLabel')) $('mapLabel').textContent = net.isHost ? '選擇地圖（大家都會看到）' : `地圖：${MAP_NAMES[s.map || 'home']}（房主選擇）`;
  const hideS = Math.round((s.hideMs || defaultHideMs()) / 1000), seekS = Math.round((s.seekMs || defaultSeekMs(s.map || 'home')) / 1000);
  if ($('hideTimeVal')) $('hideTimeVal').textContent = hideS + ' 秒';
  if ($('seekTimeVal')) $('seekTimeVal').textContent = (seekS / 60) + ' 分鐘';
  if ($('timePick')) $('timePick').classList.toggle('isGuest', !net.isHost);
  if ($('timeLabel')) $('timeLabel').textContent = net.isHost ? '遊戲時間（房主設定，大家都會看到）' : `遊戲時間：躲藏 ${hideS} 秒、找人 ${seekS / 60} 分鐘`;
  for (const b of document.querySelectorAll('#timePick .timeBtn')) b.disabled = !net.isHost;
  if (s.phase === 'lobby') { hideNearHint(); if ($('tfLock')) $('tfLock').classList.add('hidden'); return; }
  const rem = s.rem - (performance.now() - s.recvAt);
  $('phase').textContent = s.phase === 'hide' ? '🙈 躲藏時間' : s.phase === 'seek' ? '👀 鬼來找人了' : '結束';
  $('timer').textContent = fmt(Math.max(0, s.phase === 'end' ? 0 : rem));
  renderHp(s);
  const hiders = s.players.filter(q => q.role === 'hider'); $('alive').textContent = `還躲著：${hiders.filter(q => q.alive).length} / ${hiders.length} 人`;
  const seeker = p?.role === 'seeker';
  const nSk = s.players.filter(q => q.role === 'seeker').length;
  $('role').textContent = seeker ? (nSk > 1 ? '🕵️ 你是鬼（本局 2 個鬼）' : '🕵️ 你是鬼') : p?.alive ? (p.prop >= 0 ? '🪑 你是躲藏者（已變身）' : '🐣 你是躲藏者') : '👻 你被抓了（觀戰中）';
  $('hud')?.classList.toggle('has2sk', nSk > 1);
  placeHudCenter();
  const blind = seeker && s.phase === 'hide'; $('blind').classList.toggle('hidden', !blind); $('blindT').textContent = Math.ceil(Math.max(0, rem) / 1000);
  const canAct = !seeker && p?.alive && (s.phase === 'hide' || s.phase === 'seek');
  const canSmash = seeker && s.phase === 'seek';
  $('btns').classList.toggle('hidden', !(canAct || canSmash));
  if ($('tfBtn')) { $('tfBtn').classList.toggle('hidden', !canAct); $('tfBtn').textContent = '變身 (F)'; $('tfBtn').disabled = !canAct || (p?.tfLock || 0) > 0; }
  const cd = Math.max(0, CFG.TAUNT_CD - (performance.now() - lastTauntPress));
  if ($('tauntBtn')) {
    $('tauntBtn').classList.toggle('hidden', !canAct);
    $('tauntBtn').textContent = cd > 0 && lastTauntPress ? `噴漆 (T) ${Math.ceil(cd / 1000)}s` : '噴漆 (T)';
    $('tauntBtn').disabled = !canAct || (cd > 0 && lastTauntPress);
  }
  const scd = canSmash ? smashCdLeft() : 0;
  if ($('smashBtn')) {
    $('smashBtn').classList.toggle('hidden', !canSmash);
    $('smashBtn').textContent = scd > 0 ? `破壞 (G) ${Math.ceil(scd / 1000)}s` : '破壞 (G)';
    $('smashBtn').disabled = !canSmash || scd > 0;
  }
  const lockMs = Math.max(0, (p?.tfLock || 0) - (performance.now() - (s.recvAt || performance.now())));
  if ($('tfLock')) {
    const showLock = !seeker && p?.alive && lockMs > 0 && (s.phase === 'hide' || s.phase === 'seek');
    $('tfLock').classList.toggle('hidden', !showLock);
    if (showLock) $('tfLock').textContent = `⏳ ${Math.ceil(lockMs / 1000)} 秒後才能再變身`;
  }
  placeHudCenter();
  $('rotBox').classList.toggle('hidden', !(canAct && p?.prop >= 0 && !local.mounted));
  $('lockBtn').textContent = local.lock ? '🔒 鎖定 (R)' : '🔓 跟鏡頭 (R)';
  $('crosshair').classList.toggle('hidden', !canAct);
  const canGo = canMove() && !blind;
  $('moveBtns').classList.toggle('hidden', !(isTouch && canGo && s.phase !== 'end'));
  $('stamWrap').classList.toggle('hidden', s.phase === 'end');
  $('stamFill').style.width = (local.stam / CFG.STAMINA * 100) + '%';
  $('stamFill').style.background = local.exhausted ? '#ff8fa3' : '#7fe0d8';
  const lastMin = s.phase === 'seek' && rem <= CFG.CHIRP_WINDOW;
  $('hint').textContent = seeker ? (isTouch ? '點畫面發射顏料｜打中假家具就抓到｜破壞可砸碎面前家具｜空白鍵/跳 可上家具｜衝刺會耗體力' : 'WASD 走｜Shift 衝刺｜空白鍵跳｜拖曳轉鏡頭（可抬頭）｜點擊發射顏料（真家具 -10、牆地 -2）｜G 或右鍵點一下破壞面前家具') + (lastMin ? '｜最後 1 分鐘聽聲響找人' : '')
    : canAct ? (isTouch ? (local.mounted ? '在牆上滑動｜跳下來後往牆跳可再貼上' : '點家具 → 變身｜跳上家具｜衝刺｜噴漆可糊住鬼') : (local.mounted ? 'W/S 上下、A/D 左右沿牆滑動，空白鍵跳下來（往牆跳可再貼牆）' : 'WASD 走｜Shift 衝刺｜空白鍵跳｜F 無限變身｜Q/E 轉家具｜T 噴漆｜Enter 聊天')) + (lastMin ? '｜最後 1 分鐘會發出聲響' : '') : '可以到處看看誰還沒被抓';
  const end = s.phase === 'end'; $('endBox').classList.toggle('hidden', !end);
  if (end) { const win = (s.winner === 'seeker') === seeker; $('endTitle').textContent = (s.winner === 'seeker' ? '🕵️ 鬼贏了！' : '🐣 躲藏者贏了！') + (p ? (win ? ' 你贏了 🎉' : ' 下次加油') : '');
    $('endSub').textContent = s.reason + '（稍後回到大廳）'; }
}
function esc(t) { return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

const NAMES = ['小貓', '小狗', '兔兔', '熊熊', '企鵝', '小雞', '狐狸', '松鼠'];
$('nameIn').value = localStorage.getItem('ph-name') || NAMES[Math.floor(Math.random() * NAMES.length)] + Math.floor(Math.random() * 90 + 10);
const urlRoom = (Q.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
if (urlRoom) { $('codeIn').value = urlRoom; $('joinBtn').textContent = '加入 ' + urlRoom; $('joinBtn').classList.add('primary'); $('joinBox').style.flexDirection = 'column'; }
const getProfile = () => {
  const name = ($('nameIn').value.trim() || '玩家').slice(0, 10);
  const color = localStorage.getItem('ph-color') || COLORS[0];
  const avatar = localStorage.getItem('ph-avatar') || AVATARS[0];
  localStorage.setItem('ph-name', name);
  localStorage.setItem('ph-color', color);
  localStorage.setItem('ph-avatar', avatar);
  return { name, color, avatar };
};
function paintLooks() {
  const mine = localStorage.getItem('ph-color') || COLORS[0];
  const myA = localStorage.getItem('ph-avatar') || AVATARS[0];
  for (const [rowId, kind] of [['homeColors', 'color'], ['lobbyColors', 'color'], ['homeAvatars', 'avatar'], ['lobbyAvatars', 'avatar']]) {
    const row = $(rowId); if (!row) continue;
    if (!row.dataset.ready) {
      row.innerHTML = (kind === 'color' ? COLORS : AVATARS).map(v => kind === 'color'
        ? `<button type="button" class="colorBtn" data-color="${v}" style="background:${v}" title="${v}"></button>`
        : `<button type="button" class="avatarBtn" data-avatar="${v}">${v}</button>`).join('');
      row.dataset.ready = '1';
      row.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        const self = me();
        if (kind === 'color') { localStorage.setItem('ph-color', b.dataset.color); if (self) self.color = b.dataset.color; }
        else { localStorage.setItem('ph-avatar', b.dataset.avatar); if (self) self.avatar = b.dataset.avatar; }
        paintLooks(); sendProfile();
      });
    }
    for (const b of row.querySelectorAll('button')) {
      const v = kind === 'color' ? b.dataset.color : b.dataset.avatar;
      b.classList.toggle('sel', v === (kind === 'color' ? mine : myA));
      b.disabled = false;
    }
  }
}
function sendProfile() {
  if (!net.myId) return;
  const prof = getProfile();
  send({ t: 'profile', name: prof.name, color: prof.color, avatar: prof.avatar });
}
if (!localStorage.getItem('ph-color')) localStorage.setItem('ph-color', COLORS[Math.floor(Math.random() * COLORS.length)]);
if (!localStorage.getItem('ph-avatar')) localStorage.setItem('ph-avatar', AVATARS[Math.floor(Math.random() * AVATARS.length)]);
paintLooks();
$('nameIn').addEventListener('change', () => { getProfile(); sendProfile(); });
$('chatEmojis').innerHTML = CHAT_EMOJIS.map(e => `<button type="button" data-emoji="${e}">${e}</button>`).join('');
$('chatEmojis').addEventListener('click', e => { const b = e.target.closest('button'); if (b) sendChat(b.dataset.emoji); });
$('chatForm').addEventListener('submit', e => {
  e.preventDefault();
  sendChat($('chatIn').value); $('chatIn').value = '';
  if (!$('hud').classList.contains('hidden')) {
    $('chatIn').blur();
    if (!isTouch) $('chatBox').classList.add('collapsed');
  }
});
function sendChat(text) { const t = String(text || '').trim(); if (!t || !net.myId) return; send({ t: 'chat', text: t }); }
$('chatToggle').onclick = () => { $('chatBox').classList.toggle('collapsed'); if (!$('chatBox').classList.contains('collapsed')) { renderChat(); $('chatIn').focus(); } };
$('chatHide').onclick = () => $('chatBox').classList.add('collapsed');
$('chatFeedToggle').onclick = () => {
  const show = localStorage.getItem('ph-chatfeed') === '0';
  localStorage.setItem('ph-chatfeed', show ? '1' : '0');
  applyChatFeedPref();
};
applyChatFeedPref();
$('readyBtn').onclick = () => { const on = !me()?.ready; send({ t: 'ready', on }); };
$('rollBtn').onclick = () => send({ t: 'roll' });

let busy = false;
$('createBtn').onclick = () => { if (busy || !ready) return; busy = true; try { listener.context.resume(); } catch { } createRoom(getProfile()); setTimeout(() => busy = false, 4000); };
$('joinBtn').onclick = () => { if (busy || !ready) return; const c = $('codeIn').value.trim().toUpperCase(); if (c.length !== 4) return homeMsg('房號是 4 個字');
  busy = true; try { listener.context.resume(); } catch { } joinRoom(c, getProfile()); setTimeout(() => busy = false, 4000); };
$('codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('joinBtn').click(); });
$('roomsRefreshBtn')?.addEventListener('click', () => sbFetchRooms());
$('roomList')?.addEventListener('click', e => {
  const b = e.target.closest('button.roomItem');
  if (!b || b.disabled || busy || !ready) return;
  const c = (b.dataset.code || '').trim().toUpperCase();
  if (c.length !== 4) return;
  $('codeIn').value = c;
  busy = true; try { listener.context.resume(); } catch { } joinRoom(c, getProfile()); setTimeout(() => busy = false, 4000);
});
sbFetchRooms();
setInterval(() => { if (!$('home').classList.contains('hidden')) sbFetchRooms(); }, 4000);
$('copyBtn').onclick = async () => { try { await navigator.clipboard.writeText(shareLink()); toast('已複製連結！'); } catch { $('shareUrl').select(); document.execCommand('copy'); } };
$('copyCodeBtn').onclick = async () => { try { await navigator.clipboard.writeText(net.code || ''); toast('已複製房號！'); } catch { toast('房號：' + (net.code || '')); } };
$('startBtn').onclick = () => send({ t: 'start' });
$('mapPick').addEventListener('click', e => { const b = e.target.closest('.mapBtn'); if (!b || b.disabled || !net.isHost) return; send({ t: 'map', id: b.dataset.map }); });
$('timePick')?.addEventListener('click', e => {
  const b = e.target.closest('.timeBtn'); if (!b || b.disabled || !net.isHost) return;
  const s = G.s; if (!s || s.phase !== 'lobby') return;
  let hideS = Math.round((s.hideMs || defaultHideMs()) / 1000);
  let seekS = Math.round((s.seekMs || defaultSeekMs(s.map || 'home')) / 1000);
  const d = +b.dataset.d || 0;
  if (b.dataset.k === 'hide') hideS = clampHideS(hideS + d);
  else seekS = clampSeekS(seekS + d);
  send({ t: 'times', hide: hideS, seek: seekS });
});

// ---------- 主迴圈 ----------
let ready = false, last = performance.now();
function loop(t) { const dt = Math.min(.1, (t - last) / 1000); last = t; update(dt); if (G.s && G.s.phase !== 'lobby') updateUI(); renderer.render(scene, camera); requestAnimationFrame(loop); }
useMap('home'); buildHouse(); addLights();
useMap('office'); OFFICE.buildOfficeShell({ THREE, root: ROOT, colliders, wallMeshes, ceilings: houseCeiling, LOW, mergeGeometries });
useMap('lucky'); LUCKY.buildLuckyShell({ THREE, root: ROOT, colliders, wallMeshes, ceilings: houseCeiling, LOW, mergeGeometries });
setMap('home');
homeMsg('載入家具中…');
loadModels().then(() => { bakeCompounds(); placeProps(); ready = true; homeMsg(''); }).catch(e => homeMsg('載入失敗：' + e));
cam.yaw = Math.PI * .8; cam.pitch = .9;
requestAnimationFrame(loop);

// 測試用（自動化測試會讀這些，不影響遊戲）
window.__ph = { net, get state() { return G.s; }, me, evLog, local, cam, propObjs, PROPS,
  get target() { return target; }, setTarget(id) { target = id; tapTargetUntil = id == null ? 0 : performance.now() + 4000; }, get ready() { return ready; },
  pickAt: (x, y) => pickAt(x, y),
  visiblePropCount: () => propObjs.filter(g => g.visible).length, propVisible: i => propObjs[i]?.visible,
  scene, renderer, screenOfPoint(x, y, z) { const c = new THREE.Vector3(x, y, z).project(camera); return { x: (c.x + 1) / 2 * innerWidth, y: (1 - c.y) / 2 * innerHeight }; },
  renderInfo: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
  hasGun: id => !!visuals.get(id)?.buddy.getObjectByName('gun'), splatCount: () => splats.length, projCount: () => projectiles.size,
  disguiseYaw: id => visuals.get(id)?.disguise?.rotation.y ?? null, disguisePos: id => { const v = visuals.get(id); return v ? [v.root.position.x, v.root.position.z] : null; },
  setDebugCam(c) { debugCam = c; },
  teleport(x, z, y) { local.x = x; local.z = z; if (y != null) { local.y = y; local.vy = 0; local.grounded = y <= .05; } },
  screenOf(kind, id) { const o = kind === 'prop' ? propObjs[id] : visuals.get(id)?.root; if (!o) return null;
    const bb = new THREE.Box3(); o.traverse(m => { if (m.isMesh && visibleChain(m)) bb.expandByObject(m); }); const c = bb.getCenter(new THREE.Vector3()); c.project(camera);
    return { x: (c.x + 1) / 2 * innerWidth, y: (1 - c.y) / 2 * innerHeight, onScreen: Math.abs(c.x) < 1 && Math.abs(c.y) < 1 && c.z < 1 }; },
  lookAt(x, z, pitch) { cam.yaw = Math.atan2(local.x - x, local.z - z); cam.pitch = pitch != null ? pitch : .5; },
  overlayOpacity: () => { const e = $('paintOv'); return e ? (parseFloat(getComputedStyle(e).opacity) || 0) : 0; },
  propPos: i => { const g = propObjs[i]; return g ? [g.position.x, g.position.y, g.position.z] : null; },
  propTop: i => propObjs[i]?.userData.height ?? 0,
  propTip: i => propObjs[i]?.rotation.x || 0,
  isSmall: i => !!propObjs[i]?.userData.small,
  get mounted() { return !!local.mounted; }, keys, holdMove,
  tauntAt(x, y, z) { doTaunt(new THREE.Vector3(x, y, z)); },
  slideWall(dt, ix, iz) { if (local.mounted && isWallProp(local.pp)) slideOnWall(dt, ix, iz, 3.6 * dt, local.pp); },
  SMALL, WALL_PROP, COLORS, AVATARS, chatLog,
  setNextRolls(map) { if (Q.get('net') === 'local') send({ t: 'testdice', map }); },
  resetDice() { if (Q.get('net') === 'local') send({ t: 'testdicereset' }); },
  addTestPlayers(list) { if (Q.get('net') === 'local') send({ t: 'testadd', list }); },
  hostRoll(ids) { if (Q.get('net') === 'local') send({ t: 'testhostroll', ids }); },
  isTyping, sbFetchRooms, sbDeleteRoom,
  labelVisible: id => !!visuals.get(id)?.label?.visible,
  disguiseHasLight: id => { const d = visuals.get(id)?.disguise; if (!d) return false; let ok = false; d.traverse(o => { if (o.isLight || o.isSprite) ok = true; }); return ok; },
  disguisePointLightCount: id => { const d = visuals.get(id)?.disguise; if (!d) return 0; let n = 0; d.traverse(o => { if (o.isLight) n++; }); return n; },
  buddyScale: id => visuals.get(id)?.buddy?.scale.x ?? null,
  get curMap() { return curMap; }, HOME_PROP_N, LUCKY_START, LUCKY_N: LUCKY.PROPS.length, LUCKY_ROOMS: LUCKY.ROOMS, propMap, MAPS,
  mapGroupVisible: id => !!MAPS[id]?.group.visible, activePropCount: () => propObjs.filter((g, i) => propMap(i) === curMap && g.visible).length,
  colliderCount: () => colliders.length, collideAt: (x, z, r, y) => collide(x, z, y ?? 0, r ?? .33),
  BODY_H: CFG.BODY_H,
  propCols: i => propObjs[i]?.userData.cols || [],
  compoundOf: n => modelCache[n]?.cols || [],
  modelSize: n => { const z = modelCache[n]?.size; return z ? [+z.x.toFixed(3), +z.y.toFixed(3), +z.z.toFixed(3)] : null; },
  landAt: (x, z, y, ny, r) => landY(x, z, y, ny, r ?? playR()),
  inSmashCone, smashAim, propInSmashCone,

  selectMap(id) { send({ t: 'map', id }); },
  setMapLocal(id) { setMap(id); },
  seekMs: seekMsFor, HIDE_MS: CFG.HIDE_MS,
  setTimes(hideS, seekS) { send({ t: 'times', hide: hideS, seek: seekS }); },
  tryTransform(id) { send({ t: 'tf', id }); },
  doSmash, smashCdLeft, smashFacing,
  isSmashed: i => !!(G.s?.smashed || []).includes(i) || !!propObjs[i]?.userData.smashed,
  smashedIds: () => [...(G.s?.smashed || [])],
  debrisCount: () => debrisPieces.length,
  canSmashProp, SMASH_IMMUNE, SMASH_RANGE: CFG.SMASH_RANGE, SMASH_ANGLE: CFG.SMASH_ANGLE, SMASH_VANGLE: CFG.SMASH_VANGLE, SMASH_CD: CFG.SMASH_CD, SMASH_LOCK: CFG.SMASH_LOCK,
  tfLockRem: () => me()?.tfLock || 0,
  resetSmashCd() { if (Q.get('net') === 'local') send({ t: 'testsmashready' }); lastSmashAt = 0; },
  setSeekerNeed(n) { if (Q.get('net') === 'local') send({ t: 'testseekneed', n }); },
  skipToSeekRemaining(ms) { if (Q.get('net') === 'local') send({ t: 'testseekrem', ms }); },
  chirpPulseCount: () => chirpPulses.length,
  chirpPulsePositions: () => chirpPulses.map(p => [p.mesh.position.x, p.mesh.position.y, p.mesh.position.z]),
  nearHintVisible: () => nearActive && !!$('nearHint') && !$('nearHint').classList.contains('hidden'),
  nearHintTier: () => nearTier,
  nearHintText: () => $('nearHint')?.textContent || '',
  NEAR_RANGE: CFG.NEAR_RANGE,
  NEAR_MID: CFG.NEAR_MID,
  NEAR_CLOSE: CFG.NEAR_CLOSE,
  NEAR_HYST: CFG.NEAR_HYST,
  setDebugRadius,
  propsWithin(x, z, r) {
    const out = [];
    for (let i = 0; i < PROPS.length; i++) {
      if (propMap(i) !== curMap) continue;
      const p = PROPS[i], d = Math.hypot(p[1] - x, p[2] - z);
      if (d <= r) out.push({ i, name: p[0], x: p[1], z: p[2], d: +d.toFixed(3), y: p[4] || 0 });
    }
    return out.sort((a, b) => a.d - b.d);
  },
};
