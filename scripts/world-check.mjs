import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
import {serve} from './serve.mjs';
const server=serve(4176), browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--enable-unsafe-swiftshader']});
mkdirSync('memory/world-preview',{recursive:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('console',m=>{if(m.type()==='error')console.log(m.text());});page.on('pageerror',e=>console.log(e.message));
 await page.goto('http://127.0.0.1:4176/cloud-portfolio/');
 await page.waitForFunction(()=>document.body.classList.contains('gl'));
 assert.equal(await page.locator('#mode,#theme,#calm').count(),0,'No global climate/time controls');
 await page.waitForTimeout(2200);
 await page.screenshot({path:'memory/world-preview/capital.png'});
 for(const id of ['security-compliance','containers-kubernetes','finops','networking']) {
   await page.locator(`[data-region="${id}"]`).click();
   await page.waitForTimeout(1400);
   assert.equal(await page.locator('#panel').isVisible(),true);
   await page.screenshot({path:`memory/world-preview/${id}.png`});
 }
 await page.locator('#overview').click();await page.waitForTimeout(1500);
 await page.screenshot({path:'memory/world-preview/overview.png'});
 const fallback=await browser.newContext({javaScriptEnabled:false});const plain=await fallback.newPage();
 await plain.goto('http://127.0.0.1:4176/cloud-portfolio/');await plain.locator('.fallback summary').click();
 assert.equal(await plain.locator('.fallback section').count(),12);
 await fallback.close();
 console.log('3D rendering, four regional camera visits, overview, absence of global controls and no-JS region list passed.');
} finally {await browser.close();server.close();}
