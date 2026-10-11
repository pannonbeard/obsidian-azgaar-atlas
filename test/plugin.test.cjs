const {test}=require("node:test");
const assert=require("node:assert/strict");
const Module=require("node:module");
const originalLoad=Module._load;
class TFile {constructor(path){this.path=path;}}
Module._load=function(id,...args){
  if(id==="obsidian")return {Plugin:class{},MarkdownRenderChild:class{},Modal:class{},Notice:class{},TFile,normalizePath:p=>p};
  return originalLoad.call(this,id,...args);
};
const Plugin=require("../main.js");
Module._load=originalLoad;
const Core=require("../src/core.js");
test("simultaneous edits preserve all pins and links in vault data",async()=>{
  const plugin=new Plugin();plugin.queues=new Map();
  const file=new TFile("Maps/Test.atlas.json");
  let content=JSON.stringify(Core.parseMap('<svg width="100" height="100"></svg>'));
  plugin.app={vault:{getAbstractFileByPath:()=>file,process:async(f,fn)=>{
    await new Promise(resolve=>setTimeout(resolve,5));content=fn(content);
  }}};
  await Promise.all([
    plugin.update(file.path,d=>d.pins.push({id:"pin-a",name:"A",x:1,y:2})),
    plugin.update(file.path,d=>d.pins.push({id:"pin-b",name:"B",x:3,y:4})),
    plugin.update(file.path,d=>{d.links["pin-a"]="Locations/A.md";}),
    plugin.update(file.path,d=>{d.viewSettings={showSettlements:false};})
  ]);
  const saved=JSON.parse(content);assert.equal(saved.pins.length,2);assert.equal(saved.links["pin-a"],"Locations/A.md");
  assert.equal(saved.viewSettings.showSettlements,false);
});
test("a failed save does not block subsequent edits",async()=>{
  const plugin=new Plugin();plugin.queues=new Map();const file=new TFile("Maps/Test.atlas.json");
  let content=JSON.stringify(Core.parseMap('<svg width="100" height="100"></svg>'));
  plugin.app={vault:{getAbstractFileByPath:()=>file,process:async(f,fn)=>{content=fn(content);}}};
  await assert.rejects(plugin.update(file.path,()=>{throw Error("disk failure");}),/disk failure/);
  await plugin.update(file.path,d=>{d.links["burg-1"]="A.md";});
  assert.equal(JSON.parse(content).links["burg-1"],"A.md");
});
