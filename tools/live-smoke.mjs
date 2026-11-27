import { chromium } from '/workspace/prop-hunt/tools/node_modules/playwright-core/index.mjs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message));
await p.goto('https://duomaomao-bianshen.netlify.app/?lowgfx=1');
await p.waitForFunction(() => window.__ph?.ready, null, { timeout: 90000 });
console.log(JSON.stringify(await p.evaluate(() => ({ map: __ph.curMap, n: __ph.PROPS.length, homeN: __ph.HOME_PROP_N, btns: document.querySelectorAll('#mapPick .mapBtn').length }))), 'errors', errs.length);
await b.close();
