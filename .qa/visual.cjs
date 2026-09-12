const {chromium}=require('C:/Users/test/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/test/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'});
const page=await browser.newPage({viewport:{width:1440,height:900}});
page.on('pageerror',e=>console.log('PAGEERROR',e.message));
page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text().slice(0,500))});
await page.goto('http://localhost:3000/',{waitUntil:'networkidle',timeout:60000});
console.log('REDUCED',await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches));
await page.screenshot({path:'.qa/landing.png'});
await page.getByRole('link',{name:'TRACK PROJECTS',exact:true}).click();
await page.waitForTimeout(150);
console.log('CLICK',page.url(),await page.locator('#home').getAttribute('style').catch(()=>null));
await page.waitForTimeout(4000);
console.log('BODY',await page.locator('body').innerText());
await page.screenshot({path:'.qa/dashboard.png'});
await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
