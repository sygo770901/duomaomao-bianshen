import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage();
p.on('response', r => { if (r.status() >= 400) console.log(r.status(), r.url()); });
await p.goto('http://localhost:8765/'); await p.waitForFunction(() => window.__ph?.ready, null, { timeout: 60000 });
await b.close();
