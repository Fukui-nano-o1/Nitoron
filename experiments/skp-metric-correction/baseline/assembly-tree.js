// Navigation is based on part identity, independently of mesh/material merging.
export function createCatalog(definitions,details={},machineName='機械'){
 const nodes=new Map([['machine',{id:'machine',name:machineName,kind:'machine',parent:null,children:[]}]]);
 const categories=[...new Set(definitions.map(p=>p.category))];
 categories.forEach((name,i)=>{const id='system-'+i,angle=i*Math.PI*2/categories.length;nodes.set(id,{id,name,kind:'system',parent:'machine',children:[],offset:[Math.cos(angle)*.65,.12+(i%2)*.25,Math.sin(angle)*.65],description:'部品群を選び、内部の部品を確認できます。'});nodes.get('machine').children.push(id);});
 for(const p of definitions){const parent='system-'+categories.indexOf(p.category);nodes.set(p.id,{...p,parent,kind:'assembly',children:[]});nodes.get(parent).children.push(p.id);}
 for(const [id,g] of Object.entries(details)){const p=nodes.get(g.userData.partId);if(!p)throw new Error('Missing assembly for '+id);nodes.set(id,{id,name:g.userData.name,kind:'part',parent:g.userData.parentId||p.id,children:[],page:p.page,source:p.source,description:'形状・取付寸法・分解順序は資料で確認できていない模式表現を含みます。'});}
 for(const id of Object.keys(details)){const n=nodes.get(id),p=nodes.get(n.parent);if(!p)throw new Error('Missing parent for '+id);p.children.push(id);}
 const descendants=id=>{const n=nodes.get(id);if(!n)return [];return [id,...n.children.flatMap(descendants)];};
 const path=id=>{const list=[];for(let n=nodes.get(id);n;n=nodes.get(n.parent))list.unshift(n.id);return list;};
 const partIds=id=>descendants(id).filter(key=>nodes.get(key).kind==='assembly');
 const owner=id=>{let n=nodes.get(id);while(n?.kind==='part')n=nodes.get(n.parent);return n?.id;};
 const hit=(scope,partId,detailId)=>{const p=path(detailId||partId),index=p.indexOf(scope);return index<0?null:p[index+1]||null;};
 const relatedParts=id=>nodes.get(id)?.kind==='part'?[owner(id)]:partIds(id);
 return {nodes,descendants,path,partIds,owner,hit,relatedParts};
}

export function positionAssembly(parts,details,catalog,{scope='machine',explode=0,guide=null}){
 for(const [id,g] of Object.entries(parts)){
  const b=g.userData.base;let offset=[0,0,0];
  if(guide||catalog.nodes.get(scope)?.kind==='system')offset=g.userData.explode;
  else if(scope==='machine')offset=catalog.nodes.get(catalog.nodes.get(id).parent).offset;
  g.position.set(...b.map((v,i)=>v+offset[i]*explode));
 }
 for(const g of Object.values(details)){const b=g.userData.base,e=g.userData.explode,amount=!guide&&scope===catalog.nodes.get(g.userData.detailId).parent?explode:0;g.position.set(...b.map((v,i)=>v+e[i]*amount));}
}
