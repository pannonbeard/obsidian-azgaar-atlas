// Optional public-viewer regression test; requires Happy DOM.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const {Window}=await import(process.env.HAPPY_DOM_MODULE || "happy-dom");
const window=new Window({url:"https://example.org/garden/maps/boury-map"});
// When supplied, execute Quartz's emitted JS rather than the pre-build source.
const runtime=process.env.QUARTZ_EMITTED_RUNTIME
  ? readFileSync(process.env.QUARTZ_EMITTED_RUNTIME,"utf8")
  : JSON.parse(readFileSync("quartz5/azgaarAtlas.runtime.ts","utf8").replace(/^export default /,"").trim());
const data={
  schema:1,title:"Boury",sourceVersion:"1.154.0",
  svg:'<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600"><defs><mask id="land"/></defs><g id="ocean"><rect width="1000" height="600" fill="#466eab"/></g><g id="landmass"><rect width="1000" height="600"/></g></svg>',
  settlements:[{id:"burg-1",name:"Baldura",x:100,y:100}],pins:[],
  regions:[{id:"region-1",name:"West Reach",color:"#58a6c9",points:[[1,1],[10,1],[10,10]]}],
  links:{"region-1":"notes/published-place"},viewSettings:{showSettlements:false},
  relief:{set:"simple",size:1,enabled:true,icons:[{type:"mount",x:50,y:60,s:20},{type:"deciduous",x:70,y:80,s:15}]}
};
const requests=[],cleanup=[],navigations=[];
window.fetch=async url=>{requests.push(String(url));return {ok:true,json:async()=>structuredClone(data)};};
window.addCleanup=fn=>cleanup.push(fn);
window.location.assign=url=>navigations.push(url);
const host=()=>{
  const el=window.document.createElement("div");el.className="azgaar-atlas-public";
  el.dataset.atlasRoot="..";el.dataset.atlasUrl="_atlas/test.json";window.document.body.append(el);return el;
};
const first=host();window.eval(runtime);
window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
await new Promise(resolve=>setTimeout(resolve,20));
assert.equal(first.dataset.atlasMounted,"ready");
assert.deepEqual(requests,["https://example.org/garden/_atlas/test.json"]);
const shadow=first.firstElementChild.shadowRoot;
assert.equal(shadow.querySelector(".atlas-settlements").style.display,"none");
assert.equal(shadow.querySelectorAll(".region-shape").length,1);
assert.equal(shadow.querySelectorAll("#terrain use").length,1);
assert.ok(shadow.querySelector("#atlas-relief-simple-mount-1"));
const treeMinimum=shadow.querySelector('[aria-label="Deciduous trees minimum zoom"]');
assert.equal(treeMinimum.value,"3");treeMinimum.value="0";treeMinimum.dispatchEvent(new window.Event("change"));
assert.equal(shadow.querySelectorAll("#terrain use").length,2);
for(const label of ["Add pin","Draw region","Create note","Link existing note"]){
  assert.ok(![...shadow.querySelectorAll(".bar button,.detail button")].some(b=>b.textContent===label));
}
shadow.querySelector(".region-shape").dispatchEvent(new window.Event("click"));
const note=[...shadow.querySelectorAll("button")].find(b=>b.textContent==="Open note");note.click();
await new Promise(resolve=>setTimeout(resolve,0));
assert.deepEqual(navigations,["https://example.org/garden/notes/published-place"]);
shadow.querySelector(".pin").dispatchEvent(new window.Event("click"));
assert.equal([...shadow.querySelectorAll("button")].find(b=>b.textContent==="No published note").disabled,true);
window.document.dispatchEvent(new window.CustomEvent("nav"));
await new Promise(resolve=>setTimeout(resolve,0));assert.equal(requests.length,1);
cleanup.forEach(fn=>fn());window.document.body.replaceChildren();
const second=host();window.document.dispatchEvent(new window.CustomEvent("nav"));
await new Promise(resolve=>setTimeout(resolve,20));
assert.equal(second.dataset.atlasMounted,"ready");assert.equal(requests.length,2);
assert.equal(second.firstElementChild.shadowRoot.querySelector("#landmass").getAttribute("mask"),"url(#land)");
console.log("Quartz DOM checks passed: read-only viewer, bundled relief, subpath assets and note links, hidden settlements, saved regions, deduplicated mounts and SPA navigation.");
await window.happyDOM.close();
