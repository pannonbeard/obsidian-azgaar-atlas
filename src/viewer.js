const NS = "http://www.w3.org/2000/svg";
const reliefArtwork=typeof ReliefArt==="undefined" ? require("./relief-art.js") : ReliefArt;
function reliefKey(icon,set){
  if(icon.icon){
    const match=icon.icon.match(/^#?relief-([a-z]+)-([\w]+-\d+)$/);
    return match && reliefArtwork[match[1]+"/"+match[2]] ? match[1]+"/"+match[2] : null;
  }
  const selected=icon.set||set,variant=icon.variant||1;
  const exact=selected+"/"+icon.type+"-"+variant;
  if(reliefArtwork[exact])return exact;
  const fallback={mountSnow:"mount",vulcan:"mount",coniferSnow:"conifer",cactus:"dune",deadTree:"dune"};
  let type=icon.type;const visited=new Set();
  while(type && !visited.has(type)){
    visited.add(type);
    const candidates=Object.keys(reliefArtwork).filter(key=>key.startsWith(selected+"/"+type+"-"))
      .sort((a,b)=>Number(a.split("-").at(-1))-Number(b.split("-").at(-1)));
    if(candidates.length)return candidates[(variant-1)%candidates.length];
    type=fallback[type];
  }
  return null;
}
const reliefTools=typeof ReliefView==="undefined" ? require("./relief-view.js") : ReliefView;
function createReliefRenderer(svg,data){
  const empty={types:[],update:()=>({drawn:0,missing:0})};
  if(!data.relief?.icons.length || data.relief.enabled===false)return empty;
  let layer=svg.querySelector("#terrain");
  // Complete exported SVG artwork is preserved; indexed rendering uses saved relief data.
  if(layer?.children.length)return empty;
  if(!layer){
    layer=document.createElementNS(NS,"g");layer.id="terrain";layer.setAttribute("stroke","#5c5c70");
    (svg.querySelector("#viewbox")||svg).append(layer);
  }
  let defs=svg.querySelector("defs");
  if(!defs){defs=document.createElementNS(NS,"defs");svg.prepend(defs);}
  layer.setAttribute("data-atlas-relief","true");layer.style.pointerEvents="none";
  const index=reliefTools.makeIndex(data.relief.icons,data.relief.size),symbols=new Map(),nodes=new Map();
  function symbolFor(key){
    if(symbols.has(key))return symbols.get(key);
    const id="atlas-relief-"+key.replace(/\//g,"-");
    const art=cleanSVG(reliefArtwork[key]),symbol=document.createElementNS(NS,"symbol");
    for(const a of [...art.attributes])if(!["xmlns","width","height","version","id"].includes(a.name))symbol.setAttribute(a.name,a.value);
    symbol.id=id;while(art.firstChild)symbol.append(art.firstChild);
    defs.append(symbol);symbols.set(key,id);return id;
  }
  return {types:index.types,update(view,zoom,settings){
    const visible=index.query(view,zoom,settings),wanted=new Set();let missing=0;
    for(const item of visible){
      const key=reliefKey(item.icon,data.relief.set);if(!key){missing++;continue;}
      wanted.add(item.id);
      if(!nodes.has(item.id)){
        const use=document.createElementNS(NS,"use");use.setAttribute("href","#"+symbolFor(key));
        use.setAttribute("x",item.left);use.setAttribute("y",item.top);
        use.setAttribute("width",item.size);use.setAttribute("height",item.size);
        nodes.set(item.id,use);
      }
    }
    for(const [id,node] of nodes)if(!wanted.has(id)){node.remove();nodes.delete(id);}
    let next=layer.firstChild;
    for(const item of visible){
      const node=nodes.get(item.id);if(!node)continue;
      if(node===next)next=next.nextSibling;else layer.insertBefore(node,next);
    }
    return {drawn:nodes.size,missing};
  }};
}
// Full-resolution helper used for artwork coverage checks; the viewer uses indexed updates.
function restoreRelief(svg,data){
  const renderer=createReliefRenderer(svg,data);
  const settings=Object.fromEntries(renderer.types.map(type=>[type,0]));
  return renderer.update([-1e9,-1e9,2e9,2e9],1,settings);
}
function cleanSVG(source, doc = document) {
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
  if (parsed.querySelector("parsererror") || parsed.documentElement.localName !== "svg") throw Error("The map SVG is malformed.");
  const allowed = new Set("svg g defs path rect circle ellipse line polyline polygon text tspan textPath use symbol image clipPath mask pattern linearGradient radialGradient stop filter feGaussianBlur feOffset feBlend feColorMatrix feFlood feComposite feMerge feMergeNode feTurbulence feDisplacementMap feDiffuseLighting feDistantLight feSpecularLighting fePointLight feSpotLight title desc style".split(" "));
  const root = doc.importNode(parsed.documentElement, true);
  function safeCSS(value) {
    return !/@|expression\s*\(|javascript:|https?:|\/\/|\\/i.test(value) &&
      [...value.matchAll(/url\s*\(([^)]*)\)/gi)].every(m => /^\s*['"]?#[\w.-]+['"]?\s*$/.test(m[1]));
  }
  for (const node of [root, ...root.querySelectorAll("*")]) {
    if (!allowed.has(node.localName) || node.namespaceURI !== NS) { node.remove(); continue; }
    for (const a of [...node.attributes]) {
      if (/^on/i.test(a.name) || ["src", "srcset", "tabindex"].includes(a.name)) node.removeAttributeNode(a);
      else if (a.localName === "href" && !/^#[\w.-]+$/.test(a.value) && !(node.localName === "image" && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(a.value))) node.removeAttributeNode(a);
      else if ((a.name === "style" || /url\s*\(/i.test(a.value)) && !safeCSS(a.value)) node.removeAttributeNode(a);
    }
    if (node.localName === "style") {
      if (!safeCSS(node.textContent) || /:host|::slotted/i.test(node.textContent)) node.remove();
    }
  }
  root.querySelector("#viewbox")?.removeAttribute("transform");
  // Azgaar keeps these essential presentation rules in index.css, outside .map SVGs.
  // Restore only missing rules so standalone SVG exports keep their own presentation.
  if(root.querySelector("#land")){
    const land=root.querySelector("#landmass");
    if(land && !land.hasAttribute("mask") && !land.style.mask)land.setAttribute("mask","url(#land)");
  }
  if(root.querySelector("#water")){
    const lakes=root.querySelector("#lakes");
    if(lakes && !lakes.hasAttribute("mask") && !lakes.style.mask)lakes.setAttribute("mask","url(#water)");
  }
  for(const id of ["landmass","oceanLayers","terrs"]){
    const layer=root.querySelector("#"+id);
    if(layer && !layer.hasAttribute("fill-rule") && !layer.style.fillRule)layer.setAttribute("fill-rule","evenodd");
  }
  const coastline=root.querySelector("#coastline");
  if(coastline && !coastline.hasAttribute("fill") && !coastline.style.fill)coastline.setAttribute("fill","none");
  return root;
}
function mount(container, data, actions, previousState) {
  const shadow = container.attachShadow({mode:"open"});
  const css = document.createElement("style");
  css.textContent = `
    :host{display:block;color:var(--text-normal,#dedede);font:14px system-ui}
    *{box-sizing:border-box} button,input{font:inherit;color:inherit;background:var(--background-secondary,#25282f);border:1px solid var(--background-modifier-border,#4a4e59);border-radius:5px;padding:6px 9px}
    button{cursor:pointer}button:disabled{opacity:.55;cursor:default} button[aria-pressed=true]{outline:2px solid #e0b675}
    .bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px}.bar input{flex:1;min-width:120px}
    .stage{height:var(--atlas-height,600px);min-height:240px;position:relative;overflow:hidden;contain:layout paint;background:#1e2931;border-radius:8px;touch-action:none}
    .stage>svg{display:block;width:100%;height:100%;cursor:grab}.stage.adding>svg{cursor:crosshair}
    .settlement-toggle{display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap}
    .terrain-settings{padding:8px;display:flex;flex-wrap:wrap;gap:8px}.terrain-settings[hidden]{display:none}
    .terrain-settings label{display:flex;align-items:center;gap:5px}.terrain-settings input[type=number]{width:75px}.terrain-status{font-size:12px;opacity:.7;padding:0 8px 8px}
    .results{display:flex;flex-wrap:wrap;gap:5px;padding:0 8px}.results:empty{display:none}
    .detail{padding:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.detail span{flex:1}
    .pin{cursor:pointer;fill:#d89c44;stroke:#fff;stroke-width:2;vector-effect:non-scaling-stroke}.pin.custom{fill:#51b5c0}.pin.linked{fill:#996ee5}.pin:focus{stroke:#ffdf87;stroke-width:4}
    .region-shape{cursor:pointer;stroke-width:2;vector-effect:non-scaling-stroke;fill-opacity:.22;stroke-opacity:.9}.region-shape:focus{stroke-width:4}
    .drawing{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px}.drawing[hidden]{display:none}
    .draft{fill:#e0b675;fill-opacity:.15;stroke:#e0b675;stroke-width:2;stroke-dasharray:6 3;vector-effect:non-scaling-stroke;pointer-events:none}
    .hint{padding:0 8px 8px;opacity:.7;font-size:12px}
  `;
  shadow.append(css);
  const make = (tag, parent, text, cls) => { const e = document.createElement(tag); if(text)e.textContent=text; if(cls)e.className=cls; parent.append(e); return e; };
  const bar=make("div",shadow,"","bar");
  const button=(label,parent,fn)=>{const b=make("button",parent,label); b.type="button"; b.addEventListener("click",fn);return b;};
  const search=make("input",bar);search.placeholder="Find a settlement or pin…";search.setAttribute("aria-label","Search map locations");
  const results=make("div",shadow,"","results");
  const stage=make("div",shadow,"","stage");const svg=cleanSVG(data.svg);stage.append(svg);
  const vb = svg.getAttribute("viewBox")?.trim().split(/[ ,]+/).map(Number);
  const width=parseFloat(svg.getAttribute("width")),height=parseFloat(svg.getAttribute("height"));
  const original=vb?.length===4 && vb.every(Number.isFinite) && vb[2]>0 && vb[3]>0 ? vb : [0,0,width,height];
  if(!original.every(Number.isFinite)||original[2]<=0||original[3]<=0)throw Error("SVG must have a valid viewBox or numeric width and height.");
  svg.removeAttribute("width");svg.removeAttribute("height");svg.setAttribute("preserveAspectRatio","xMidYMid meet");
  let view=previousState?.view?.length===4 ? [...previousState.view] : [...original],adding=false,selected=null,drag=null,drawing=null;
  const relief=createReliefRenderer(svg,data);
  let reliefSettings={...data.viewSettings?.reliefMinZoom},frame=null,disposed=false;
  const win=document.defaultView;
  const terrainPanel=make("div",shadow,"","terrain-settings");terrainPanel.hidden=previousState?.terrainSettingsOpen!==true;
  const terrainStatus=make("div",shadow,"","terrain-status");
  function visibleBounds(){
    try{
      const rect=svg.getBoundingClientRect(),inverse=svg.getScreenCTM()?.inverse();
      if(rect.width>0 && rect.height>0 && inverse){
        const a=svg.createSVGPoint(),b=svg.createSVGPoint();
        a.x=rect.left;a.y=rect.top;b.x=rect.right;b.y=rect.bottom;
        const start=a.matrixTransform(inverse),end=b.matrixTransform(inverse);
        return [start.x,start.y,end.x-start.x,end.y-start.y];
      }
    }catch{}
    return view;
  }
  function renderTerrain(){
    if(disposed)return;
    const scale=original[2]/view[2],result=relief.update(visibleBounds(),scale,reliefSettings);
    terrainStatus.textContent=relief.types.length ? `Zoom ${scale.toFixed(2)}× · ${result.drawn.toLocaleString()} terrain symbols` : "";
  }
  function scheduleTerrain(){
    if(frame!==null||disposed)return;
    if(win?.requestAnimationFrame)frame=win.requestAnimationFrame(()=>{frame=null;renderTerrain();});
    else renderTerrain();
  }
  const paint=()=>{svg.setAttribute("viewBox",view.join(" "));scheduleTerrain();};
  if(relief.types.length){
    const control=button("Terrain detail",bar,()=>{terrainPanel.hidden=!terrainPanel.hidden;control.setAttribute("aria-expanded",String(!terrainPanel.hidden));});
    control.setAttribute("aria-expanded",String(!terrainPanel.hidden));
    make("span",terrainPanel,"Minimum zoom (Fit map = 1×; 0 = always):");
    for(const type of relief.types){
      const label=make("label",terrainPanel),enabled=make("input",label);enabled.type="checkbox";
      make("span",label,reliefTools.labels[type]||type);
      const input=make("input",label);input.type="number";input.min="0";input.max="100";input.step="0.25";
      input.setAttribute("aria-label",(reliefTools.labels[type]||type)+" minimum zoom");
      const min=reliefTools.threshold(type,reliefSettings);enabled.checked=min!==null;input.disabled=!enabled.checked;input.value=String(min??reliefTools.defaults[type]??3);
      const save=()=>{
        const value=Number(input.value);
        if(!Number.isFinite(value)||value<0||value>100||input.value.trim()===""){input.value=String(reliefTools.threshold(type,reliefSettings)??reliefTools.defaults[type]??3);return;}
        input.disabled=!enabled.checked;reliefSettings[type]=enabled.checked?value:null;
        data.viewSettings={...data.viewSettings,reliefMinZoom:{...reliefSettings}};
        renderTerrain();actions.setReliefZoom?.({...reliefSettings});
      };
      input.addEventListener("change",save);enabled.addEventListener("change",save);
    }
  }
  const observer=win?.ResizeObserver ? new win.ResizeObserver(scheduleTerrain) : null;
  observer?.observe(stage);
  const zoom=(factor,center=[view[0]+view[2]/2,view[1]+view[3]/2])=>{
    const next=view[2]*factor;if(next<original[2]/100||next>original[2]*4)return;
    view=[center[0]-(center[0]-view[0])*factor,center[1]-(center[1]-view[1])*factor,view[2]*factor,view[3]*factor];paint();
  };
  button("+",bar,()=>zoom(.75)).setAttribute("aria-label","Zoom in");
  button("−",bar,()=>zoom(1.33)).setAttribute("aria-label","Zoom out");
  button("Fit map",bar,()=>{view=[...original];paint();});
  const add=actions.readOnly ? document.createElement("button") : button("Add pin",bar,()=>{if(drawing)cancelDrawing();adding=!adding;add.setAttribute("aria-pressed",String(adding));stage.classList.toggle("adding",adding);});
  const draw=actions.readOnly ? document.createElement("button") : button("Draw region",bar,()=>startDrawing());
  button("Expand",bar,()=>actions.expand());
  paint();
  const drawBar=make("div",shadow,"","drawing");drawBar.hidden=true;
  const mode=make("select",drawBar);mode.setAttribute("aria-label","Drawing mode");
  for(const [value,label] of [["polygon","Polygon: click corners"],["freehand","Freehand: drag outline"]]){
    const option=make("option",mode,label);option.value=value;
  }
  const undo=button("Undo point",drawBar,()=>{if(drawing){drawing.points.pop();drawDraft();}});
  const finish=button("Finish region",drawBar,()=>finishDrawing());
  button("Cancel drawing",drawBar,()=>cancelDrawing());
  const drawHint=make("span",drawBar);
  const draft=document.createElementNS(NS,"polygon");draft.setAttribute("class","draft");svg.append(draft);
  function drawDraft(){
    draft.setAttribute("points",(drawing?.points||[]).map(p=>p.join(",")).join(" "));
    finish.disabled=!drawing||drawing.points.length<3;undo.disabled=!drawing?.points.length;
    drawHint.textContent=drawing ? drawing.points.length+" points · Finish closes the boundary" : "";
  }
  function startDrawing(region=null){
    drawing={points:[],region};adding=false;add.setAttribute("aria-pressed","false");
    draw.setAttribute("aria-pressed","true");drawBar.hidden=false;stage.classList.add("adding");
    drawDraft();
  }
  function cancelDrawing(){
    drawing=null;drawBar.hidden=true;draw.setAttribute("aria-pressed","false");stage.classList.remove("adding");drawDraft();
  }
  function finishDrawing(){
    if(!drawing||drawing.points.length<3)return;
    const {points,region}=drawing;cancelDrawing();actions.saveRegion(points,region);
  }
  function appendPoint(p){
    if(!drawing)return;
    const last=drawing.points.at(-1);
    if(mode.value==="freehand"&&last&&Math.hypot(p[0]-last[0],p[1]-last[1])<view[2]/600)return;
    drawing.points.push(p);drawDraft();
  }
  mode.addEventListener("change",()=>{if(drawing){drawing.points=[];drawDraft();}});
  stage.tabIndex=0;stage.setAttribute("aria-label","Map drawing surface");
  stage.addEventListener("keydown",e=>{
    if(!drawing)return;
    if(e.key==="Escape"){e.preventDefault();cancelDrawing();}
    else if(e.key==="Enter"){e.preventDefault();finishDrawing();}
    else if(e.key==="Backspace"){e.preventDefault();drawing.points.pop();drawDraft();}
  });
  const point=e=>{const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const matrix=svg.getScreenCTM();if(!matrix)throw Error("Map is not visible.");const v=p.matrixTransform(matrix.inverse());return [v.x,v.y];};
  svg.addEventListener("wheel",e=>{e.preventDefault();zoom(e.deltaY>0?1.15:1/1.15,point(e));},{passive:false});
  svg.addEventListener("pointerdown",e=>{
    if(e.button!==0 || (!drawing && !adding && e.target.closest(".atlas-overlay")))return;
    if(drawing){
      stage.focus();svg.setPointerCapture(e.pointerId);
      drag={id:e.pointerId,drawing:true};
      if(mode.value==="freehand")appendPoint(point(e));
      return;
    }
    drag={id:e.pointerId,client:[e.clientX,e.clientY],view:[...view],point:point(e),moved:false};svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointermove",e=>{
    if(!drag||drag.id!==e.pointerId)return;
    if(drag.drawing){if(mode.value==="freehand")appendPoint(point(e));return;}
    if(Math.hypot(e.clientX-drag.client[0],e.clientY-drag.client[1])>4)drag.moved=true;
    const now=point(e);view[0]+=drag.point[0]-now[0];view[1]+=drag.point[1]-now[1];paint();
  });
  svg.addEventListener("pointerup",e=>{
    if(!drag||drag.id!==e.pointerId)return;const was=drag;drag=null;svg.releasePointerCapture(e.pointerId);
    if(was.drawing){appendPoint(point(e));return;}
    if(adding&&!was.moved){const [x,y]=point(e);adding=false;add.setAttribute("aria-pressed","false");stage.classList.remove("adding");actions.addPin(x,y);}
  });
  svg.addEventListener("pointercancel",()=>{drag=null;});
  // The imported SVG owns its layer visibility. Do not force or toggle source layers.
  const overlay=document.createElementNS(NS,"g");overlay.setAttribute("class","atlas-overlay");svg.append(overlay);
  const regionGroup=document.createElementNS(NS,"g");regionGroup.setAttribute("class","atlas-regions");overlay.append(regionGroup);
  // Drawing feedback belongs above saved annotations.
  svg.append(draft);
  const settlements=document.createElementNS(NS,"g");settlements.setAttribute("class","atlas-settlements");overlay.append(settlements);
  const customPins=document.createElementNS(NS,"g");customPins.setAttribute("class","atlas-custom-pins");overlay.append(customPins);
  const toggleLabel=make("label",bar,"","settlement-toggle");
  const toggle=make("input",toggleLabel);toggle.type="checkbox";
  toggle.checked=data.viewSettings?.showSettlements===true;
  toggleLabel.append(document.createTextNode("Show settlement pins"));
  const applySettlements=()=>{settlements.style.display=toggle.checked?"inline":"none";};
  applySettlements();
  toggle.addEventListener("change",()=>{
    applySettlements();
    actions.setSettlements(toggle.checked);
  });
  const regions=(data.regions||[]).map(region=>({...region,region:true,
    x:region.points.reduce((sum,p)=>sum+p[0],0)/region.points.length,
    y:region.points.reduce((sum,p)=>sum+p[1],0)/region.points.length}));
  const points=[...data.settlements,...data.pins,...regions]; const r=original[2]/220;
  const detail=make("div",shadow,"Select a settlement or add a pin to connect a note.","detail");
  function select(p,focus=false){
    selected=p; detail.replaceChildren();
    const text=make("span",detail);text.textContent=p.name+(p.state?" · "+p.state:"")+(p.capital?" · Capital":"")+(data.links[p.id]?" · "+data.links[p.id]:"");
    const action=button(data.links[p.id]?"Open note":actions.readOnly?"No published note":"Create note",detail,async()=>{
      action.disabled=true;
      try{await actions.open(p);}finally{action.disabled=false;}
    });
    if(actions.readOnly && !data.links[p.id])action.disabled=true;
    if(!actions.readOnly)button("Link existing note",detail,()=>actions.link(p));
    if(!actions.readOnly && data.links[p.id])button("Unlink",detail,()=>actions.unlink(p));
    if(!actions.readOnly && data.pins.some(pin=>pin.id===p.id))button("Delete pin",detail,()=>actions.removePin(p));
    if(!actions.readOnly && p.region){
      button("Edit region",detail,()=>actions.saveRegion(p.points,p));
      button("Redraw boundary",detail,()=>startDrawing(p));
      button("Delete region",detail,()=>actions.removeRegion(p));
    }
    if(focus){view=[p.x-original[2]/10,p.y-original[3]/10,original[2]/5,original[3]/5];paint();}
  }
  for(const p of points){
    if(p.region){
      const polygon=document.createElementNS(NS,"polygon");polygon.setAttribute("class","region-shape");
      polygon.setAttribute("points",p.points.map(point=>point.join(",")).join(" "));
      polygon.setAttribute("fill",p.color);polygon.setAttribute("stroke",p.color);
      polygon.setAttribute("tabindex","0");polygon.setAttribute("role","button");polygon.setAttribute("aria-label",p.name);
      const title=document.createElementNS(NS,"title");title.textContent=p.name;polygon.append(title);
      polygon.addEventListener("click",e=>{if(drawing||adding)return;e.stopPropagation();select(p);});
      polygon.addEventListener("keydown",e=>{if(drawing)return;if(e.key==="Enter"||e.key===" "){e.preventDefault();select(p);}});
      regionGroup.append(polygon);continue;
    }
    const circle=document.createElementNS(NS,"circle");
    circle.setAttribute("cx",p.x);circle.setAttribute("cy",p.y);circle.setAttribute("r",r);
    circle.setAttribute("class","pin"+(data.pins.includes(p)?" custom":"")+(data.links[p.id]?" linked":""));
    circle.setAttribute("tabindex","0");circle.setAttribute("role","button");circle.setAttribute("aria-label",p.name);
    const title=document.createElementNS(NS,"title");title.textContent=p.name;circle.append(title);
    circle.addEventListener("click",e=>{if(drawing||adding)return;e.stopPropagation();select(p);});
    circle.addEventListener("keydown",e=>{if(drawing)return;if(e.key==="Enter"||e.key===" "){e.preventDefault();select(p);}});
    (data.pins.includes(p)?customPins:settlements).append(circle);
  }
  search.addEventListener("input",()=>{
    results.replaceChildren();const query=search.value.trim().toLocaleLowerCase();if(!query)return;
    const matches=points.filter(p=>p.name.toLocaleLowerCase().includes(query));
    for(const p of matches.slice(0,30))button(p.name,results,()=>select(p,true));
    if(!matches.length)make("span",results,"No matching locations.");
    if(matches.length>30)make("span",results,"Showing 30; refine your search.");
  });
  if(previousState?.selectedId){
    const p=points.find(point=>point.id===previousState.selectedId);if(p)select(p);
  }
  make("div",shadow,"Scroll to zoom · Drag to pan · Select a pin, then open or link its note. Purple pins have note links.","hint");
  renderTerrain();
  const dispose=()=>{disposed=true;if(frame!==null)win?.cancelAnimationFrame?.(frame);observer?.disconnect();shadow.replaceChildren();};
  dispose.getState=()=>({view:[...view],selectedId:selected?.id,terrainSettingsOpen:!terrainPanel.hidden});
  return dispose;
}
module.exports = {cleanSVG,mount,restoreRelief,reliefKey,createReliefRenderer};
