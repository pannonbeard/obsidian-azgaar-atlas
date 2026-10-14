/* No runtime dependencies. CommonJS keeps the importer testable outside Obsidian. */
async function decodeMap(bytes) {
  let data = new Uint8Array(bytes);
  if (data[0] === 31 && data[1] === 139) {
    if (typeof DecompressionStream === "undefined") throw Error("Gzip is unavailable here. Export an uncompressed SVG from Azgaar instead.");
    data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
  }
  let text = new TextDecoder().decode(data).replace(/^\uFEFF/, "").trim();
  if (!text.includes("<svg") && !text.slice(0, 20).includes("|")) {
    try { text = decodeURIComponent(atob(text)); } catch { throw Error("Not an Azgaar .map or SVG file."); }
  }
  return text;
}
function parseMap(text, title = "Fantasy map") {
  let start=-1,end=-1,depth=0;
  for(const tag of text.matchAll(/<\/?svg\b[^>]*>/gi)){
    if(tag[0].startsWith("</")){
      if(start>=0 && --depth===0){end=tag.index+tag[0].length;break;}
    }else{
      if(start<0)start=tag.index;
      if(!tag[0].endsWith("/>"))depth++;
      else if(depth===0){end=tag.index+tag[0].length;break;}
    }
  }
  if(start<0||end<0)throw Error("This file contains no SVG map. Export a .map or SVG from Azgaar.");
  const match=[text.slice(start,end)];
  // Protect line breaks within the SVG before splitting the legacy record format.
  const records = text.replace(match[0], "__ATLAS_SVG__").split(/\r?\n/);
  const standalone = /^\s*(?:<\?xml[^>]*>\s*)?(?:<!DOCTYPE[^>]*>\s*)?<svg\b/i.test(text);
  const header = records[0].split("|");
  let settlements = [],relief;
  if (!standalone) {
    if (!header[0] || !header[0].match(/^\d+\.\d+/) || records[5] !== "__ATLAS_SVG__")
      throw Error("Unsupported Azgaar record layout. Export an SVG instead, or send this .map for compatibility testing.");
    let burgs, states;
    try { burgs = JSON.parse(records[15]); states = JSON.parse(records[14]); }
    catch { throw Error("Settlement data is invalid or this .map format is unsupported. Try an SVG export."); }
    if (!Array.isArray(burgs) || !Array.isArray(states)) throw Error("Invalid settlement arrays.");
    settlements = burgs.filter(b => b && b.i && !b.removed && Number.isFinite(b.x) && Number.isFinite(b.y))
      .map(b => ({id: "burg-" + b.i, name: String(b.name || "Settlement " + b.i), x:b.x, y:b.y,
        state: String(states[b.state]?.name || ""), capital: !!b.capital, population: Number(b.population) || 0}));
    if(records[49]?.trim().startsWith("[")){
      try{
        const icons=JSON.parse(records[49]);
        const style=records[48]?JSON.parse(records[48]):{};
        const layers=records[50]?JSON.parse(records[50]):null;
        relief={icons,set:style.relief?.options?.set||"simple",size:style.relief?.options?.size??1,
          enabled:Array.isArray(layers?.active)?layers.active.includes("relief"):true};
      }catch{throw Error("Invalid relief data in this .map file.");}
    }
  }
  return validateAtlas({schema:1, title, sourceVersion:standalone ? "SVG" : header[0], svg:match[0], settlements, pins:[], regions:[], links:{},relief});
}
function validateAtlas(data) {
  if (!data || data.schema !== 1 || typeof data.svg !== "string" || !Array.isArray(data.settlements) || !Array.isArray(data.pins)
    || !data.links || typeof data.links !== "object" || Array.isArray(data.links)) throw Error("Invalid Azgaar Atlas data file.");
  for (const p of [...data.settlements, ...data.pins]) {
    if (!p || typeof p.id !== "string" || typeof p.name !== "string" || !Number.isFinite(p.x) || !Number.isFinite(p.y))
      throw Error("Invalid map pin coordinates.");
  }
  if(data.regions===undefined)data.regions=[];
  if(!Array.isArray(data.regions))throw Error("Invalid map regions.");
  for(const region of data.regions){
    if(!region || typeof region.id!=="string" || typeof region.name!=="string" ||
      !/^#[0-9a-f]{6}$/i.test(region.color) || !Array.isArray(region.points) || region.points.length<3 ||
      region.points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))
      throw Error("Invalid region boundary or color.");
  }
  if(data.relief!==undefined){
    const r=data.relief;
    if(!r || !Array.isArray(r.icons) || typeof r.set!=="string" || !Number.isFinite(r.size) || r.size<=0)
      throw Error("Invalid relief settings.");
    for(const icon of r.icons){
      if(!icon || ![icon.x,icon.y,icon.s].every(Number.isFinite) || icon.s<=0 ||
        (typeof icon.type!=="string" && typeof icon.icon!=="string") ||
        (icon.variant!==undefined && (!Number.isInteger(icon.variant)||icon.variant<1)))
        throw Error("Invalid relief icon data.");
    }
  }
  if(data.viewSettings?.reliefMinZoom!==undefined){
    const settings=data.viewSettings.reliefMinZoom;
    if(!settings || typeof settings!=="object" || Array.isArray(settings) ||
      Object.values(settings).some(v=>v!==null && (!Number.isFinite(v)||v<0||v>100)))
      throw Error("Invalid terrain zoom thresholds (use 0–100 or null to hide).");
  }
  return data;
}
function safeName(name) {
  return String(name).replace(/[\\/:*?"<>|#^\[\]\x00-\x1f]/g, "-").trim().slice(0, 120) || "Fantasy map";
}
module.exports = {decodeMap, parseMap, validateAtlas, safeName};
