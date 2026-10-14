// Runs once per document; Quartz's nav event mounts fresh maps after SPA navigation.
function bootAtlas() {
  for(const container of document.querySelectorAll(".azgaar-atlas-public")){
    if(container.dataset.atlasMounted)continue;
    container.dataset.atlasMounted="loading";
    const root=new URL(container.dataset.atlasRoot+"/",window.location.href);
    const url=new URL(container.dataset.atlasUrl,root);
    container.textContent="Loading fantasy map…";
    fetch(url).then(response=>{
      if(!response.ok)throw Error("Map data could not be loaded ("+response.status+").");
      return response.json();
    }).then(raw=>{
      if(!container.isConnected)return;
      const data=Core.validateAtlas(raw);
      container.replaceChildren();
      const host=document.createElement("div");container.append(host);
      const dispose=Viewer.mount(host,data,{
        readOnly:true,
        setReliefZoom:settings=>{data.viewSettings={...data.viewSettings,reliefMinZoom:settings};},
        setSettlements:show=>{data.viewSettings={...data.viewSettings,showSettlements:show};},
        open:point=>{
          const link=data.links[point.id];
          if(link){const destination=new URL(link,root);if(destination.origin===location.origin)window.location.assign(destination.href);}
        },
        expand:()=>{if(container.requestFullscreen)container.requestFullscreen().catch(()=>{});}
      });
      container.dataset.atlasMounted="ready";
      container._atlasDispose=dispose;
      window.addCleanup?.(()=>{dispose();delete container.dataset.atlasMounted;});
    }).catch(error=>{
      container.dataset.atlasMounted="error";container.textContent="Azgaar Atlas: "+error.message;
    });
  }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bootAtlas,{once:true});
else bootAtlas();
document.addEventListener("nav",bootAtlas);
