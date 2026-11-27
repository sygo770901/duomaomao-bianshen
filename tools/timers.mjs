// 用正式時間（躲 30 秒、找 3 分鐘）跑一局，確認時間到 → 躲藏者贏
import { chromium } from 'playwright-core';
const URL = 'http://localhost:8765/'; const allPages = []; const chains = new Map();
function relay(m) { for (const p of allPages) { const prev = chains.get(p) || Promise.resolve(); chains.set(p, prev.then(() => p.evaluate(m => window.__localnetIn && window.__localnetIn(m), m)).catch(() => { })); } }
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const mk = async () => { const ctx = await b.newContext({ viewport: { width: 640, height: 400 } }); await ctx.exposeBinding('__relay', (s, m) => relay(m)); const p = await ctx.newPage(); allPages.push(p); return p; };
const A = await mk(), B = await mk();
await A.goto(URL + '?net=local'); await A.waitForFunction(() => __ph.ready); await A.click('#createBtn'); await A.waitForSelector('#lobby:not(.hidden)');
const code = (await A.textContent('#roomCode')).trim();
await B.goto(URL + '?room=' + code + '&net=local'); await B.waitForFunction(() => __ph.ready); await B.click('#joinBtn');
await A.waitForFunction(() => __ph.state?.players.length === 2);
await A.evaluate(() => { window.__pt = {}; setInterval(() => { const ph = __ph.state?.phase; if (ph && !__pt[ph]) __pt[ph] = performance.now(); }, 20); });
await A.click('#startBtn'); await A.waitForFunction(() => __ph.state?.phase === 'hide');
console.log('hide rem', (await A.evaluate(() => __ph.state.rem)));
await A.waitForFunction(() => __ph.state?.phase === 'end', null, { timeout: 240000 });
const r = await A.evaluate(() => ({ pt: __pt, s: { winner: __ph.state.winner, reason: __ph.state.reason, hp: __ph.state.hp } }));
console.log('hide ms', Math.round(r.pt.seek - r.pt.hide), 'seek ms', Math.round(r.pt.end - r.pt.seek), JSON.stringify(r.s));
await A.screenshot({ path: '../shots/desktop-end-timeout-hiders-win.png' });
await b.close();
