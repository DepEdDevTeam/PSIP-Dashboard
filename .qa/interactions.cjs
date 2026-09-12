const {chromium}=require('C:/Users/test/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
const b=await chromium.launch({headless:true,executablePath:'C:/Users/test/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'});const p=await b.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>console.log('ERROR',e.message));
await p.goto('http://localhost:3000/',{waitUntil:'networkidle'});
await p.evaluate(()=>{window.samples=[];const start=performance.now();function sample(){const a=document.querySelector('a[href="/dashboard"]');window.samples.push({t:Math.round(performance.now()-start),s:a?.getAttribute('style'),h:document.querySelector('#home')?.getAttribute('style')});if(performance.now()-start<900)requestAnimationFrame(sample)};document.querySelector('a[href="/dashboard"]').addEventListener('click',sample,{once:true})});
await p.getByRole('link',{name:'TRACK PROJECTS',exact:true}).click();await p.waitForTimeout(1200);console.log('CLICK SAMPLES',JSON.stringify(await p.evaluate(()=>window.samples)));await p.waitForTimeout(2000);
console.log('REVEALS',await p.locator('[data-reveal]').count());
await p.getByRole('button',{name:'Map overview',exact:true}).click();await p.waitForTimeout(1200);console.log('DRAWER',await p.locator('#map-filter-panel').getAttribute('style'));await p.screenshot({path:'.qa/map.png'});
await p.getByRole('button',{name:'Hide map filters',exact:true}).click();await p.waitForTimeout(70);console.log('CLOSING',await p.locator('#map-filter-panel').getAttribute('style'));await p.waitForTimeout(350);console.log('CLOSED',await p.locator('#map-filter-panel').isVisible());
await p.getByRole('button',{name:'Submit Site Photo',exact:true}).click();await p.waitForTimeout(100);await p.screenshot({path:'.qa/dialog.png'});console.log('DIALOG',await p.getByRole('dialog').count());await p.keyboard.press('Escape');await p.waitForTimeout(500);console.log('DIALOG CLOSED',await p.getByRole('dialog').count());
await b.close();})().catch(e=>{console.error(e);process.exit(1)});
