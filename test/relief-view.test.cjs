const {test}=require('node:test');
const assert=require('node:assert/strict');
const {makeIndex,threshold,intersects}=require('../src/relief-view');
test('terrain index respects zoom thresholds, disabled types, edge overlap and paint order',()=>{
  const icons=[{type:'mount',x:-10,y:0,s:20},{type:'deciduous',x:10,y:10,s:10},{type:'mount',x:200,y:200,s:20}];
  const index=makeIndex(icons,1);
  assert.deepEqual(index.query([0,0,50,50],1).map(i=>i.id),[0]);
  assert.deepEqual(index.query([0,0,50,50],3).map(i=>i.id),[0,1]);
  assert.deepEqual(index.query([0,0,50,50],1,{mount:null,deciduous:0}).map(i=>i.id),[1]);
  assert.deepEqual(index.query([200,200,20,20],1).map(i=>i.id),[2]);
});
test('spatial queries match a full scan including large icons and size scaling',()=>{
  const icons=Array.from({length:1500},(_,i)=>({type:i%2?'hill':'mount',x:(i*73)%2500-100,y:(i*131)%1900-100,s:i===0?2000:10+i%20}));
  const index=makeIndex(icons,1.5);
  for(const view of [[0,0,100,80],[700,700,300,500],[-200,-200,90,100],[-10000,-10000,20000,20000]]){
    for(const zoom of [1,2,4]){
      const expected=icons.map((icon,id)=>{const size=icon.s*1.5,shift=(size-icon.s)/2;return {id,left:icon.x-shift,top:icon.y-shift,right:icon.x-shift+size,bottom:icon.y-shift+size,type:icon.type};}).filter(i=>zoom>=threshold(i.type)&&intersects(i,view)).map(i=>i.id);
      assert.deepEqual(index.query(view,zoom).map(i=>i.id),expected);
    }
  }
});
