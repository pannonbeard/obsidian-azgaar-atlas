// Optional DOM regression check: npm install --no-save happy-dom
// Then: node test/viewer-dom.mjs
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const {Window}=await import(process.env.HAPPY_DOM_MODULE || "happy-dom");
const window=new Window();
globalThis.document=window.document;
globalThis.DOMParser=window.DOMParser;
const require=createRequire(import.meta.url);
const {mount,cleanSVG}=require("../src/viewer.js");
const {parseMap}=require("../src/core.js");
const source='<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600"><g id="biomes" style="display:inline"><path/></g><g id="regions" display="none"><path/></g><g id="terrain" style="display:none"><path/></g><g id="rivers"><path/></g></svg>';
const data=parseMap(source);
data.settlements=[{id:"burg-1",name:"Baldura",x:100,y:200}];
data.pins=[{id:"pin-1",name:"Camp",x:300,y:400}];
const host=document.createElement("div");document.body.append(host);
const saved=[];
let dispose=mount(host,data,{setSettlements:show=>saved.push(show)});
const root=host.shadowRoot;
const settlement=root.querySelector(".atlas-settlements");
const custom=root.querySelector(".atlas-custom-pins");
const toggle=root.querySelector(".settlement-toggle input");
assert.equal(root.querySelector(".layers"),null);
assert.equal(toggle.checked,false);
assert.equal(settlement.style.display,"none");
assert.equal(settlement.querySelectorAll(".pin").length,1);
assert.notEqual(custom.style.display,"none");
assert.equal(custom.querySelectorAll(".pin").length,1);
function checkOriginalLayers(){
  assert.equal(root.querySelector("#biomes").getAttribute("style"),"display:inline");
  assert.equal(root.querySelector("#regions").getAttribute("display"),"none");
  assert.equal(root.querySelector("#terrain").getAttribute("style"),"display:none");
  assert.equal(root.querySelector("#rivers").getAttribute("style"),null);
}
checkOriginalLayers();
toggle.checked=true;toggle.dispatchEvent(new window.Event("change"));
assert.equal(settlement.style.display,"inline");
checkOriginalLayers();
toggle.checked=false;toggle.dispatchEvent(new window.Event("change"));
assert.equal(settlement.style.display,"none");
assert.notEqual(custom.style.display,"none");checkOriginalLayers();
assert.deepEqual(saved,[true,false]);
const zoom=root.querySelector('[aria-label="Zoom in"]');zoom.click();
const view=root.querySelector(".stage > svg").getAttribute("viewBox");
root.querySelector(".pin.custom").dispatchEvent(new window.Event("click"));
const state=dispose.getState();dispose();
// Rerendering after a persisted settings change keeps zoom and selection.
const host2=document.createElement("div");document.body.append(host2);
data.viewSettings={showSettlements:true};
dispose=mount(host2,data,{setSettlements:()=>{}},state);
assert.equal(host2.shadowRoot.querySelector(".settlement-toggle input").checked,true);
assert.equal(host2.shadowRoot.querySelector(".atlas-settlements").style.display,"inline");
assert.equal(host2.shadowRoot.querySelector(".stage > svg").getAttribute("viewBox"),view);
assert.ok(host2.shadowRoot.querySelector(".detail").textContent.includes("Camp"));
dispose();
console.log("DOM checks passed: saved source layers untouched; settlement pins toggle independently; saved preference, zoom and selection restored.");
// Real .map SVGs rely on masks provided by Azgaar's application stylesheet.
const water=cleanSVG('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><defs><mask id="land"/><mask id="water"/></defs><g id="landmass"><rect width="100" height="100"/></g><g id="lakes"/><g id="coastline"/></svg>');
assert.equal(water.querySelector("#landmass").getAttribute("mask"),"url(#land)");
assert.equal(water.querySelector("#lakes").getAttribute("mask"),"url(#water)");
assert.equal(water.querySelector("#coastline").getAttribute("fill"),"none");
const explicit=cleanSVG('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><defs><mask id="land"/></defs><g id="landmass" mask="url(#custom)"/></svg>');
assert.equal(explicit.querySelector("#landmass").getAttribute("mask"),"url(#custom)");
// Exercise drawing with an identity screen transform; layout math is browser-only.
const host3=document.createElement("div");document.body.append(host3);
const draws=[];
dispose=mount(host3,data,{
  setSettlements:()=>{},
  saveRegion:(points,region)=>draws.push({points,region}),
  removeRegion:region=>draws.push({deleted:region.id})
});
const rt=host3.shadowRoot,sv=rt.querySelector(".stage > svg");
sv.createSVGPoint=()=>({x:0,y:0,matrixTransform(){return {x:this.x,y:this.y};}});
sv.getScreenCTM=()=>({inverse:()=>({})});sv.setPointerCapture=()=>{};sv.releasePointerCapture=()=>{};
const press=(type,x,y)=>sv.dispatchEvent(new window.PointerEvent(type,{button:0,clientX:x,clientY:y,pointerId:1,bubbles:true}));
const clickButton=(label)=>[...rt.querySelectorAll("button")].find(b=>b.textContent===label).click();
clickButton("Draw region");
assert.equal(rt.querySelector(".drawing").hidden,false);
const finish=[...rt.querySelectorAll("button")].find(b=>b.textContent==="Finish region");
assert.equal(finish.disabled,true);
for(const [x,y] of [[10,10],[80,10],[80,80]]){press("pointerdown",x,y);press("pointerup",x,y);}
assert.equal(finish.disabled,false);clickButton("Finish region");
assert.deepEqual(draws[0].points,[[10,10],[80,10],[80,80]]);
assert.equal(rt.querySelector(".drawing").hidden,true);
clickButton("Draw region");
const mode=rt.querySelector("select");mode.value="freehand";mode.dispatchEvent(new window.Event("change"));
press("pointerdown",10,10);press("pointermove",30,10);press("pointermove",30,30);press("pointerup",10,30);
clickButton("Finish region");assert.equal(draws[1].points.length,4);
dispose();
data.regions=[{id:"region-1",name:"West Reach",color:"#58a6c9",points:draws[0].points}];
const host4=document.createElement("div");document.body.append(host4);
dispose=mount(host4,data,{saveRegion:(points,region)=>draws.push({edited:region.id}),removeRegion:region=>draws.push({deleted:region.id})});
const r4=host4.shadowRoot;assert.equal(r4.querySelectorAll(".region-shape").length,1);
r4.querySelector(".region-shape").dispatchEvent(new window.Event("click"));
assert.ok(r4.querySelector(".detail").textContent.includes("West Reach"));
[...r4.querySelectorAll("button")].find(b=>b.textContent==="Edit region").click();
assert.equal(draws.at(-1).edited,"region-1");
[...r4.querySelectorAll("button")].find(b=>b.textContent==="Delete region").click();
assert.equal(draws.at(-1).deleted,"region-1");
dispose();
console.log("DOM checks passed: restored water masks, polygon and freehand drawing, region selection, editing and deletion.");
await window.happyDOM.close();
