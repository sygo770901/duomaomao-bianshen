import { chromium, devices } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [name, opts] of [['desk', { viewport: { width: 1280, height: 800 } }], ['mob', { ...devices['iPhone 13'], defaultBrowserType: undefined }]]) {
  const ctx = await b.newContext(opts); const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8765/?net=local'); await p.waitForFunction(() => __ph.ready, null, { timeout: 60000 });
  await p.fill('#nameIn', '小明'); await p.click('#createBtn'); await p.waitForSelector('#lobby:not(.hidden)');
  await p.evaluate(() => __ph.addTestPlayers([{ name: '阿華', color: '#7cc4ff' }, { name: '小美', color: '#b9a3ff' }, { name: '大雄', color: '#9be3c8' }])); await p.waitForTimeout(600);
  await p.evaluate(() => document.getElementById('diceTray').scrollIntoView({ block: 'center' }));
  await p.evaluate(() => __ph.hostRoll()); await p.waitForTimeout(800); await p.screenshot({ path: `/tmp/q-${name}-mid.png` });
  await p.waitForFunction(() => !__ph.diceTray.rolling() && __ph.state?.dice?.status !== 'wait', null, { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(800);
  await p.screenshot({ path: `/tmp/q-${name}-end.png` }); console.log(name, JSON.stringify(await p.evaluate(() => [__ph.state.dice, __ph.diceTray.list().map(d => d.face + '/' + d.n)])));
}
await b.close();
