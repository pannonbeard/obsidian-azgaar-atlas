// Browser smoke test. Requires Playwright installed by the developer.
const fs=require("node:fs");
const assert=require("node:assert/strict");
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const page=await browser.newPage({viewport:{width:1200,height:950}});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.setContent('<main id="host"></main>');
 await page.addScriptTag({content:"const module={exports:{}};"+fs.readFileSync("src/viewer.js","utf8")+"; window.Viewer=module.exports;"});
 const data=JSON.parse(fs.readFileSync(process.env.ATLAS_FIXTURE || "/tmp/atlas-1.143.1.json","utf8"));
 await page.evaluate(d=>{
   window.events=[];
   window.Viewer.mount(document.querySelector("#host"),d,{
     expand:()=>events.push("expand"),addPin:(x,y)=>events.push({x,y}),setSettlements:show=>events.push({show}),
     open:p=>events.push({open:p.id}),link:p=>events.push({link:p.id}),unlink:()=>{},removePin:()=>{}
   });
 },data);
 assert.equal(await page.locator(".pin").count(),data.settlements.length);
 await page.getByRole("textbox",{name:"Search map locations"}).fill(data.settlements[0].name);
 await page.locator(".results button").first().click();
 await page.getByRole("button",{name:"Create note",exact:true}).click();
 assert.equal(await page.evaluate(()=>events[0].open),data.settlements[0].id);
 await page.getByRole("button",{name:"Fit map",exact:true}).click();
 const before=await page.locator(".stage > svg").getAttribute("viewBox");
 await page.getByRole("button",{name:"Zoom in",exact:true}).click();
 assert.notEqual(await page.locator(".stage > svg").getAttribute("viewBox"),before);
 await page.getByRole("button",{name:"Fit map",exact:true}).click();
 await page.getByRole("button",{name:"Add pin",exact:true}).click();
 const box=await page.locator(".stage").boundingBox();
 await page.mouse.click(box.x+box.width*.15,box.y+box.height*.15);
 const pin=await page.evaluate(()=>events.find(e=>typeof e==="object" && "x" in e));
 assert.ok(Number.isFinite(pin.x)&&Number.isFinite(pin.y));
 assert.equal(await page.locator(".layers").count(),0);
 const settlements=page.locator(".atlas-settlements");
 assert.equal(await settlements.evaluate(e=>e.style.display),"none");
 const customPins=page.locator(".atlas-custom-pins");
 await page.getByRole("checkbox",{name:"Show settlement pins"}).check();
 assert.equal(await settlements.evaluate(e=>e.style.display),"inline");
 await page.getByRole("checkbox",{name:"Show settlement pins"}).uncheck();
 assert.equal(await settlements.evaluate(e=>e.style.display),"none");
 assert.notEqual(await customPins.evaluate(e=>e.style.display),"none");
 // Unsafe SVG elements, event handlers, styles and external resources are removed.
 const sanitized=await page.evaluate(()=>{
   const s=Viewer.cleanSVG('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" onload="alert(1)"><script>alert(1)</script><foreignObject/><image href="https://example.com/a"/><style>@import "https://example.com";</style><path style="fill:url(https://example.com/a)"/><use href="#safe"/></svg>');
   return new XMLSerializer().serializeToString(s);
 });
 assert.ok(!sanitized.includes("alert")&&!sanitized.includes("foreignObject")&&!sanitized.includes("https://"));
 assert.ok(sanitized.includes("#safe"));assert.deepEqual(errors,[]);
 await page.getByRole("textbox",{name:"Search map locations"}).fill("");
 await page.screenshot({path:"/tmp/azgaar-atlas-qa.png",fullPage:true});
 console.log("Viewer passed: settlement search, note action, zoom, pin placement, settlement visibility, SVG sanitization; no browser errors.");
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
