const {test}=require("node:test");
const assert=require("node:assert/strict");
const {gzipSync}=require("node:zlib");
const {decodeMap,parseMap,validateAtlas,safeName}=require("../src/core.js");
const svg='<svg xmlns="http://www.w3.org/2000/svg" id="map" width="1000" height="600">\r\n<g id="viewbox"><path d="M0 0L1 1"/></g>\r\n</svg>';
function fixture(){
  const records=Array(53).fill("");
  records[0]="1.153.1|File can be loaded in azgaar|2026-10-10|seed|1000|600";
  records[5]=svg;records[14]=JSON.stringify([{i:0},{i:1,name:"Aster"}]);
  records[15]=JSON.stringify([{i:0},{i:1,name:"Baldura",x:120,y:200,state:1,capital:1,population:4},
    {i:2,name:"Removed",x:20,y:20,removed:true}]);
  return records.join("\r\n");
}
test("imports record format without splitting multiline SVG",()=>{
  const d=parseMap(fixture(),"Ausri");assert.equal(d.settlements.length,1);assert.equal(d.settlements[0].state,"Aster");
  assert.equal(d.svg,svg);assert.equal(d.settlements[0].id,"burg-1");assert.equal(validateAtlas(d),d);
});
test("imports plain, base64 and gzip map data",async()=>{
  for(const bytes of [Buffer.from(fixture()),Buffer.from(btoa(encodeURIComponent(fixture()))),gzipSync(fixture())])
    assert.equal(parseMap(await decodeMap(bytes)).settlements[0].name,"Baldura");
});
test("standalone SVG supports custom pins without settlement metadata",()=>{
  const d=parseMap(svg);assert.equal(d.sourceVersion,"SVG");assert.equal(d.settlements.length,0);
  const nested='<svg width="100" height="100"><svg width="10" height="10"><path/></svg><path/></svg>';
  assert.equal(parseMap(nested).svg,nested);
});
test("corrupt and unsupported files produce actionable errors",()=>{
  assert.throws(()=>parseMap("{}"),/no SVG/);
  assert.throws(()=>parseMap("1.0|test\n"+svg),/Unsupported/);
  assert.throws(()=>validateAtlas({}),/Invalid/);
  const d=parseMap(svg);d.pins.push({id:"pin",name:"bad",x:Infinity,y:0});assert.throws(()=>validateAtlas(d),/coordinates/);
});
test("map and note filenames cannot escape their folder",()=>{
  assert.equal(safeName("../../A:B"),"..-..-A-B");assert.equal(safeName(""),"Fantasy map");
});
test("old atlas files gain optional regions and malformed boundaries are rejected",()=>{
  const d=parseMap(svg);delete d.regions;assert.deepEqual(validateAtlas(d).regions,[]);
  d.regions.push({id:"region-1",name:"West",color:"#58a6c9",points:[[1,2],[3,4],[5,6]]});
  assert.equal(validateAtlas(d).regions.length,1);
  d.regions[0].points[0][0]=Infinity;assert.throws(()=>validateAtlas(d),/boundary/);
  d.regions[0].points[0][0]=1;d.regions[0].color="url(https://example.com)";
  assert.throws(()=>validateAtlas(d),/color/);
});
test("relief import keeps icon placement, set, size and saved visibility",()=>{
  const records=fixture().replace(svg,"SVG").split("\r\n");
  records[5]=svg;
  records[48]=JSON.stringify({relief:{options:{set:"illustrated",size:1.5}}});
  records[49]=JSON.stringify([{type:"mount",x:10,y:20,s:30,variant:2}]);
  records[50]=JSON.stringify({active:["biomes","relief"]});
  const d=parseMap(records.join("\r\n"));
  assert.equal(d.relief.set,"illustrated");assert.equal(d.relief.size,1.5);assert.equal(d.relief.enabled,true);
  assert.deepEqual(d.relief.icons[0],{type:"mount",x:10,y:20,s:30,variant:2});
  records[50]=JSON.stringify({active:["biomes"]});
  assert.equal(parseMap(records.join("\r\n")).relief.enabled,false);
  d.relief.icons[0].s=-1;assert.throws(()=>validateAtlas(d),/relief/);
});
