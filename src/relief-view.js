const labels={mount:"Mountains",mountSnow:"Snowy mountains",vulcan:"Volcanoes",hill:"Hills",dune:"Dunes",deciduous:"Deciduous trees",conifer:"Conifers",coniferSnow:"Snowy conifers",acacia:"Acacias",palm:"Palms",grass:"Grass",swamp:"Swamps",cactus:"Cacti",deadTree:"Dead trees"};
const defaults={mount:1,mountSnow:1,vulcan:1,hill:2,dune:2,deciduous:3,conifer:3,coniferSnow:3,acacia:3,palm:3,grass:4,swamp:4,cactus:3,deadTree:3};
function iconType(icon){
  return icon.type||icon.icon?.match(/^#?relief-[a-z]+-([\w]+)-\d+$/)?.[1]||"custom";
}
function threshold(type,settings={}){
  if(Object.hasOwn(settings,type))return settings[type];
  return defaults[type]??3;
}
function intersects(item,view){
  return item.right>=view[0] && item.left<=view[0]+view[2] && item.bottom>=view[1] && item.top<=view[1]+view[3];
}
function makeIndex(icons,size,cellSize=64){
  const buckets=new Map(),large=[],items=icons.map((icon,id)=>{
    const drawn=icon.s*size,shift=(drawn-icon.s)/2;
    return {id,icon,type:iconType(icon),left:icon.x-shift,top:icon.y-shift,right:icon.x-shift+drawn,bottom:icon.y-shift+drawn,size:drawn};
  });
  for(const item of items){
    const x0=Math.floor(item.left/cellSize),x1=Math.floor(item.right/cellSize),y0=Math.floor(item.top/cellSize),y1=Math.floor(item.bottom/cellSize);
    if((x1-x0+1)*(y1-y0+1)>256){large.push(item);continue;}
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
      const key=x+","+y;
      if(!buckets.has(key))buckets.set(key,[]);
      buckets.get(key).push(item);
    }
  }
  return {types:[...new Set(items.map(i=>i.type))],query(view,zoom,settings={}){
    const x0=Math.floor(view[0]/cellSize),x1=Math.floor((view[0]+view[2])/cellSize);
    const y0=Math.floor(view[1]/cellSize),y1=Math.floor((view[1]+view[3])/cellSize);
    const found=new Map();
    const add=item=>{
      const min=threshold(item.type,settings);
      if(min!==null && zoom+1e-9>=min && intersects(item,view))found.set(item.id,item);
    };
    if((x1-x0+1)*(y1-y0+1)>4096)items.forEach(add);
    else{
      for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)(buckets.get(x+","+y)||[]).forEach(add);
      large.forEach(add);
    }
    return [...found.values()].sort((a,b)=>a.id-b.id);
  }};
}
module.exports={labels,defaults,iconType,threshold,intersects,makeIndex};
