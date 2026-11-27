import { chromium, devices } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
for (const [n, opts] of [['desktop', { viewport: { width: 1280, height: 800 } }], ['mobile', { ...devices['iPhone 13'], defaultBrowserType: undefined }]]) {
  const ctx = await b.newContext(opts); const p = await ctx.newPage();
  await p.goto((process.env.URL || 'http://localhost:8765/') + '?lowgfx=1'); await p.waitForFunction(() => window.__ph?.ready, null, { timeout: 60000 });
  await p.evaluate(() => { const d = document.querySelector('details.help'); d.open = true; d.scrollIntoView({ block: 'start' }); });
  await p.waitForTimeout(500);
  const info = await p.evaluate(() => { const d = document.querySelector('details.help'); const r = d.getBoundingClientRect(); return { h: Math.round(r.height), vh: innerHeight, items: d.querySelectorAll('li').length, chars: d.textContent.replace(/\s/g, '').length }; });
  console.log(n, JSON.stringify(info));
  await p.screenshot({ path: `../shots/v12-help-${n}.png` }); await ctx.close();
}
await b.close();
