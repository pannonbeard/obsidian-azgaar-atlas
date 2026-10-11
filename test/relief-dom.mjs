// Optional relief rendering check; requires Happy DOM.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const {Window}=await import(process.env.HAPPY_DOM_MODULE || "happy-dom");
const window=new Window();globalThis.document=window.document;globalThis.DOMParser=window.DOMParser;
const require=createRequire(import.meta.url);
const Core=require("../src/core.js");
const {cleanSVG,restoreRelief,reliefKey}=require("../src/viewer.js");
const file=process.env.AZGAAR_MAP || "../upload/Boury 2026-10-10-18-37.map";
const data=Core.parseMap(await Core.decodeMap(readFileSync(file)),"Boury");
assert.equal(data.relief.icons.length,13849);
assert.equal(data.relief.set,"simple");assert.equal(data.relief.enabled,true);
const svg=cleanSVG(data.svg);assert.equal(svg.querySelector("#terrain").children.length,0);
const restored=restoreRelief(svg,data);assert.equal(restored.drawn,13849);assert.equal(restored.missing,0);
assert.equal(svg.querySelectorAll("#terrain use").length,13849);
assert.ok(svg.querySelectorAll('symbol[id^="atlas-relief-"]').length>=8);
const ids=new Set([...svg.querySelectorAll('symbol[id^="atlas-relief-"]')].map(s=>"#"+s.id));
for(const use of svg.querySelectorAll("#terrain use"))assert.ok(ids.has(use.getAttribute("href")),"Unresolved relief symbol");
assert.equal(restoreRelief(svg,data).drawn,0,"Do not duplicate existing relief");
const hidden=cleanSVG(data.svg);assert.equal(restoreRelief(hidden,{...data,relief:{...data.relief,enabled:false}}).drawn,0);
const art=require("../src/relief-art.js");
const defaults={mount:6,mountSnow:6,vulcan:3,hill:4,dune:1,deciduous:2,conifer:1,coniferSnow:1,acacia:1,palm:1,grass:1,swamp:2,cactus:3,deadTree:2};
const sets=[...new Set(Object.keys(art).map(k=>k.split("/")[0]))];
for(const set of sets)for(const [type,count] of Object.entries(defaults))
  for(let variant=1;variant<=count;variant++)assert.ok(reliefKey({type,variant},set),set+"/"+type+"-"+variant);
console.log("Relief DOM checks passed: all 13,849 Boury symbols resolved, active layer respected, no duplicates, all built-in sets and variants supported.");
await window.happyDOM.close();
