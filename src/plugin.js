const {Plugin, MarkdownRenderChild, Modal, Notice, TFile, MarkdownView, normalizePath} = require("obsidian");
class PromptModal extends Modal {
  constructor(app,title,fields,submit){super(app);this.title=title;this.fields=fields;this.submit=submit;}
  onOpen(){
    this.contentEl.createEl("h2",{text:this.title});const inputs={};
    for(const f of this.fields){
      const label=this.contentEl.createEl("label",{text:f.label});label.style.display="block";
      const input=this.contentEl.createEl("input",{type:"text",value:f.value||""});input.style.width="100%";inputs[f.key]=input;
    }
    const error=this.contentEl.createEl("p");
    const save=this.contentEl.createEl("button",{text:"Save"});
    save.addEventListener("click",async()=>{
      save.disabled=true;
      try{await this.submit(Object.fromEntries(Object.entries(inputs).map(([k,v])=>[k,v.value.trim()])));this.close();}
      catch(e){error.setText(e.message);save.disabled=false;}
    });
    this.contentEl.createEl("button",{text:"Cancel"}).addEventListener("click",()=>this.close());
    Object.values(inputs)[0]?.focus();
  }
  onClose(){this.contentEl.empty();}
}
class MapModal extends Modal {
  constructor(plugin,path){super(plugin.app);this.plugin=plugin;this.path=path;}
  onOpen(){
    this.modalEl.style.width="95vw";this.modalEl.style.maxWidth="1400px";
    this.modalEl.style.height="90vh";this.contentEl.style.setProperty("--atlas-height","65vh");
    this.child=new AtlasChild(this.contentEl,this.plugin,this.path,true);this.plugin.addChild(this.child);
  }
  onClose(){if(this.child)this.plugin.removeChild(this.child);this.contentEl.empty();}
}
class AtlasChild extends MarkdownRenderChild {
  constructor(el,plugin,path,expanded=false){super(el);this.plugin=plugin;this.path=path;this.expanded=expanded;this.generation=0;}
  onload(){
    this.registerEvent(this.plugin.app.vault.on("modify",file=>{if(file.path===this.path)this.render();}));
    this.registerEvent(this.plugin.app.vault.on("delete",file=>{if(file.path===this.path)this.render();}));
    this.registerEvent(this.plugin.app.vault.on("rename",(file,old)=>{if(old===this.path){this.path=file.path;this.render();}}));
    this.render();
  }
  onunload(){this.generation++;this.dispose?.();}
  async render(){
    const gen=++this.generation;
    this.viewerState=this.dispose?.getState?.()||this.viewerState;
    this.dispose?.();this.containerEl.empty();
    try{
      const file=this.plugin.app.vault.getAbstractFileByPath(this.path);
      if(!(file instanceof TFile))throw Error("Map file not found: "+this.path);
      const data=Core.validateAtlas(JSON.parse(await this.plugin.app.vault.read(file)));
      if(gen!==this.generation)return;
      const host=this.containerEl.createDiv({cls:"azgaar-atlas-host"});
      const p=this.plugin,change=fn=>p.update(this.path,fn);
      const handle=fn=>(...args)=>Promise.resolve().then(()=>fn(...args)).catch(e=>new Notice(e.message));
      this.dispose=Viewer.mount(host,data,{
        expand:()=>new MapModal(p,this.path).open(),
        setSettlements:handle(show=>change(d=>{
          d.viewSettings={...d.viewSettings,showSettlements:show};
        })),
        setReliefZoom:handle(settings=>change(d=>{
          d.viewSettings={...d.viewSettings,reliefMinZoom:settings};
        })),
        saveRegion:(points,region)=>new PromptModal(p.app,region?"Edit region":"Name drawn region",[
          {key:"name",label:"Region name",value:region?.name||""},
          {key:"color",label:"Color (#RRGGBB)",value:region?.color||"#58a6c9"}
        ],async v=>{
          if(!v.name)throw Error("Enter a region name.");
          if(!/^#[0-9a-f]{6}$/i.test(v.color))throw Error("Use a color like #58a6c9.");
          await change(d=>{
            const saved={id:region?.id||"region-"+crypto.randomUUID(),name:v.name,color:v.color,points};
            const index=d.regions.findIndex(r=>r.id===saved.id);
            if(index>=0)d.regions[index]=saved;else d.regions.push(saved);
          });
        }).open(),
        removeRegion:handle(region=>change(d=>{
          d.regions=d.regions.filter(r=>r.id!==region.id);delete d.links[region.id];
        })),
        addPin:(x,y)=>new PromptModal(p.app,"Add map pin",[{key:"name",label:"Pin name"}],async v=>{
          if(!v.name)throw Error("Enter a pin name.");
          await change(d=>d.pins.push({id:"pin-"+crypto.randomUUID(),name:v.name,x,y}));
        }).open(),
        open:handle(async point=>{
          const current=Core.validateAtlas(JSON.parse(await p.app.vault.read(file)));
          if(current.links[point.id]){await p.app.workspace.openLinkText(current.links[point.id],this.path);return;}
          const folder=this.path.slice(0,this.path.lastIndexOf("/"))+"/Locations";
          await p.ensureFolder(folder);
          const notePath=await p.unusedPath(folder+"/"+Core.safeName(point.name),".md");
          const note=await p.app.vault.create(notePath,
            "# "+point.name.replace(/[\r\n]/g," ")+"\n\n"+(point.state?"State: "+point.state+"\n\n":"")+
            "Map: [["+this.path.replace(/\.atlas\.json$/,"")+" Map]]\n\nCoordinates: "+point.x+", "+point.y+"\n");
          await change(d=>{d.links[point.id]=note.path;});
          await p.app.workspace.getLeaf(false).openFile(note);
        }),
        link:point=>new PromptModal(p.app,"Link "+point.name,[{key:"note",label:"Existing note path or name",value:data.links[point.id]||""}],async v=>{
          const note=p.app.metadataCache.getFirstLinkpathDest(v.note,this.path);
          if(!(note instanceof TFile)||note.extension!=="md")throw Error("Choose an existing Markdown note in this vault.");
          await change(d=>{d.links[point.id]=note.path;});
        }).open(),
        unlink:handle(point=>change(d=>{delete d.links[point.id];})),
        removePin:handle(point=>change(d=>{d.pins=d.pins.filter(pin=>pin.id!==point.id);delete d.links[point.id];}))
      },this.viewerState);
    }catch(e){if(gen===this.generation)this.containerEl.createEl("p",{text:"Azgaar Atlas: "+e.message});}
  }
}
module.exports = class AzgaarAtlas extends Plugin {
  async onload(){
    this.queues=new Map();
    this.addCommand({id:"import-map",name:"Import Azgaar map or SVG",callback:()=>this.chooseFile()});
    this.addCommand({id:"refresh-artwork",name:"Restore relief artwork from Azgaar .map",callback:()=>{
      const view=this.app.workspace.getActiveViewOfType(MarkdownView);
      const match=view?.getViewData().match(/```azgaar-map\s*\n([^\n]+)\n```/);
      new PromptModal(this.app,"Restore map relief artwork",[
        {key:"path",label:"Existing .atlas.json path",value:match?.[1]?.trim()||""}
      ],async v=>{
        const file=this.app.vault.getAbstractFileByPath(normalizePath(v.path));
        if(!(file instanceof TFile)||!file.path.endsWith(".atlas.json"))throw Error("Choose an existing .atlas.json map file.");
        this.chooseFile(file.path);
      }).open();
    }});
    this.registerMarkdownCodeBlockProcessor("azgaar-map",(source,el,ctx)=>{
      const path=source.trim();
      if(!path||path.includes("\n")){el.createEl("p",{text:"Use one vault-relative .atlas.json path in this block."});return;}
      ctx.addChild(new AtlasChild(el,this,normalizePath(path)));
    });
    this.registerEvent(this.app.vault.on("rename",(file,old)=>{
      if(file instanceof TFile && file.extension==="md"){
        for(const map of this.app.vault.getFiles().filter(f=>f.path.endsWith(".atlas.json")))
          this.update(map.path,d=>{for(const id of Object.keys(d.links))if(d.links[id]===old)d.links[id]=file.path;}).catch(e=>new Notice("Atlas note link update: "+e.message));
      }
    }));
  }
  chooseFile(refreshPath=null){
    const input=document.createElement("input");input.type="file";input.accept=refreshPath?".map":".map,.svg";input.style.display="none";document.body.append(input);
    const cleanup=()=>input.remove();input.addEventListener("cancel",cleanup,{once:true});
    input.addEventListener("change",async()=>{
      try{
        const file=input.files?.[0];if(!file)return;
        if(file.size>100*1024*1024)throw Error("Map is over 100 MB. Try a smaller SVG export.");
        const data=Core.parseMap(await Core.decodeMap(await file.arrayBuffer()),file.name.replace(/\.(map|svg)$/i,""));
        if(refreshPath){
          if(!data.relief)throw Error("This file has no separate relief data. Select the original Azgaar .map file.");
          await this.update(refreshPath,d=>{d.relief=data.relief;});
          new Notice("Restored "+data.relief.icons.length+" relief symbols. Sync the updated atlas file to Quartz and rebuild.");
          return;
        }
        // Validate and sanitize before saving; no imported SVG scripts or external fonts run.
        data.svg=new XMLSerializer().serializeToString(Viewer.cleanSVG(data.svg));
        await this.ensureFolder("Maps");
        const base=await this.unusedPath("Maps/"+Core.safeName(data.title),".atlas.json");
        const notePath=base.replace(/\.atlas\.json$/," Map.md");
        if(await this.app.vault.adapter.exists(notePath))throw Error("A map note with this name already exists; rename the source file and retry.");
        await this.app.vault.create(base,JSON.stringify(data));
        const note=await this.app.vault.create(notePath,"# "+data.title.replace(/[\r\n]/g," ")+"\n\n```azgaar-map\n"+base+"\n```\n");
        await this.app.workspace.getLeaf(false).openFile(note);
        new Notice("Imported "+data.settlements.length+" settlements. Switch to Reading view to explore.");
      }catch(e){new Notice("Map import failed: "+e.message);}finally{cleanup();}
    },{once:true});input.click();
  }
  async ensureFolder(path){
    const parts=normalizePath(path).split("/");let current="";
    for(const part of parts){current=current?current+"/"+part:part;if(!await this.app.vault.adapter.exists(current))await this.app.vault.createFolder(current);}
  }
  async unusedPath(base,extension){
    let path=base+extension,i=2;
    while(await this.app.vault.adapter.exists(path)){path=base+" "+i+extension;i++;}
    return path;
  }
  update(path,fn){
    const previous=this.queues.get(path)||Promise.resolve();
    const next=previous.catch(()=>{}).then(async()=>{
      const file=this.app.vault.getAbstractFileByPath(path);if(!(file instanceof TFile))throw Error("Map data file is missing.");
      await this.app.vault.process(file,text=>{const d=Core.validateAtlas(JSON.parse(text));fn(d);return JSON.stringify(d);});
    });
    this.queues.set(path,next);next.finally(()=>{if(this.queues.get(path)===next)this.queues.delete(path);}).catch(()=>{});
    return next;
  }
};
