import * as T from '../../../vendor/parts-lab/dist/vendor/three.module.js';
import {createSKP} from '../../../vendor/parts-lab/dist/skp-model.js';
import {PARTS} from '../../../vendor/parts-lab/dist/skp-parts.js';
import {createCatalog,positionAssembly} from '../../../vendor/parts-lab/dist/assembly-tree.js';
import {resolveMachineRef, ROOT_PART_ID} from '../catalog.js';

const RED = new T.Color(0xd31d32);
const HOME_DIRECTION = new T.Vector3(1,.4,1.12).normalize();
const ZOOM_MS = 320;
const PULSE_MS = 2200;

/** No DOM, RAF, renderer, network, persistence or React dependencies.
 * A host owns the one renderer and calls update only while it returns true.
 */
export function createMachineScene({aspect=1,reducedMotion=false}={}) {
  const {root,parts,details} = createSKP();
  const catalog = createCatalog(PARTS, details, 'SKP-101W');
  const camera = new T.PerspectiveCamera(34, Number.isFinite(aspect) && aspect>0 ? aspect : 1, .0001, 100);
  const target = new T.Vector3();
  const scene = new T.Scene();
  scene.add(root, new T.HemisphereLight(0xffffff,0xb2b5ac,1.8));
  for (const [color,power,position] of [[0xffffff,3.4,[4,7,4]],[0xd3e9ff,2.1,[-4,3,-4]],[0xffffff,1.3,[-2,5,4]]]) {
    const light = new T.DirectionalLight(color,power);
    light.position.set(...position); scene.add(light);
  }
  const meshes = [];
  const original = new Map();
  root.traverse(object => {
    if (!object.isMesh) return;
    meshes.push(object);
    const m = object.material;
    original.set(object,{color:m.color.clone(),emissive:m.emissive.clone(),intensity:m.emissiveIntensity,visible:object.visible});
  });
  let disposed=false, selected=null, selectedMeshes=[], pulseStart=null, motion=null, clock=0, scope=ROOT_PART_ID;
  let resolution={status:'unselected',node:null};
  let reduce=Boolean(reducedMotion);

  function alive() { if(disposed) throw new Error('Machine scene is disposed'); }
  function timestamp(now) { if(!Number.isFinite(now)) throw new TypeError('now must be finite milliseconds'); return now; }
  function targets(id) {
    if(id===ROOT_PART_ID) return [root];
    const n=catalog.nodes.get(id);
    return n.kind==='system' ? catalog.partIds(id).map(key=>parts[key]) : [details[id] || parts[id]];
  }
  function bounds(id) {
    root.updateMatrixWorld(true);
    const box=new T.Box3();
    for(const object of targets(id)) box.union(new T.Box3().setFromObject(object, true));
    if(box.isEmpty()) throw new Error('Empty geometry for '+id);
    return box;
  }
  function frame(id, now, instant) {
    const box=bounds(id), center=box.getCenter(new T.Vector3());
    const right=new T.Vector3(0,1,0).cross(HOME_DIRECTION).normalize();
    const up=HOME_DIRECTION.clone().cross(right).normalize();
    const tangent=Math.tan(T.MathUtils.degToRad(camera.fov)/2), margin=1.18;
    let distance=.025;
    for(const x of [box.min.x,box.max.x]) for(const y of [box.min.y,box.max.y]) for(const z of [box.min.z,box.max.z]) {
      const delta=new T.Vector3(x,y,z).sub(center), depth=delta.dot(HOME_DIRECTION);
      distance=Math.max(distance,depth+margin*Math.abs(delta.dot(right))/(tangent*camera.aspect),depth+margin*Math.abs(delta.dot(up))/tangent);
    }
    const end=center.clone().addScaledVector(HOME_DIRECTION,distance);
    motion=instant||reduce ? null : {start:now,from:camera.position.clone(),fromTarget:target.clone(),end,center};
    if(!motion) {camera.position.copy(end);target.copy(center);camera.lookAt(target);camera.updateMatrixWorld(true);}
  }
  function restoreColors() {
    for(const mesh of meshes) {
      const saved=original.get(mesh), material=mesh.material;
      mesh.visible=saved.visible;
      material.color.copy(saved.color);material.emissive.copy(saved.emissive);material.emissiveIntensity=saved.intensity;
    }
    selected=null;selectedMeshes=[];pulseStart=null;
  }
  function restore() {
    restoreColors();scope=ROOT_PART_ID;
    positionAssembly(parts,details,catalog,{scope,explode:0});
  }
  function belongs(mesh,id) {
    const node=catalog.nodes.get(id);
    return node.kind==='part' ? catalog.descendants(id).includes(mesh.userData.detailId) : catalog.relatedParts(id).includes(mesh.userData.partId);
  }
  function setScope(id,{explode=0,now=clock}={}) {
    alive();clock=timestamp(now);
    if(!catalog.nodes.has(id)) return false;
    restore();scope=id;resolution={status:'unselected',node:null};
    positionAssembly(parts,details,catalog,{scope,explode:Number.isFinite(explode)?Math.max(0,Math.min(1,explode)):0});
    for(const mesh of meshes) mesh.visible=belongs(mesh,id);
    frame(id,now,true);return true;
  }
  function selectInScope(ref,{now=clock}={}) {
    alive();clock=timestamp(now);
    const result=resolveMachineRef(ref);
    if(!result.node || !catalog.descendants(scope).includes(result.node.id)) return false;
    const visible=meshes.map(m=>m.visible);restoreColors();meshes.forEach((m,i)=>m.visible=visible[i]);
    resolution=result;selected=result.node.id;selectedMeshes=meshes.filter(m=>m.visible&&belongs(m,selected));
    pulseStart=now;paint(now);return result;
  }
  function pick(x,y) {
    alive();
    if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>1||Math.abs(y)>1) return null;
    root.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(x,y),camera);
    for(const hit of ray.intersectObjects(meshes.filter(m=>m.visible),false)) {
      const id=catalog.hit(scope,hit.object.userData.partId,hit.object.userData.detailId);
      if(id) return id;
    }
    return null;
  }
  function paint(now) {
    if(pulseStart==null) return;
    const elapsed=Math.max(0,now-pulseStart);
    const strength=reduce||elapsed>=PULSE_MS ? 1 : .72+.28*(.5+.5*Math.cos(elapsed/PULSE_MS*Math.PI*4));
    for(const mesh of selectedMeshes) {
      mesh.material.color.copy(RED).multiplyScalar(strength);
      mesh.material.emissive.copy(RED);mesh.material.emissiveIntensity=.28*strength;
    }
  }
  function update(now) {
    alive();clock=timestamp(now);
    if(motion) {
      const t=Math.min(1,Math.max(0,(now-motion.start)/ZOOM_MS)), ease=1-(1-t)**3;
      camera.position.lerpVectors(motion.from,motion.end,ease);
      target.lerpVectors(motion.fromTarget,motion.center,ease);
      camera.lookAt(target);camera.updateMatrixWorld(true);
      if(t===1) motion=null;
    }
    paint(now);
    return Boolean(motion || (!reduce && pulseStart!=null && now-pulseStart<PULSE_MS));
  }
  function focus(ref,{now=clock,instant=false}={}) {
    alive();clock=timestamp(now);restore();resolution=resolveMachineRef(ref);
    if(!resolution.node) {frame(ROOT_PART_ID,now,instant);return resolution;}
    selected=resolution.node.id;
    const node=catalog.nodes.get(selected), descendants=new Set(catalog.descendants(selected));
    const assemblies=new Set(catalog.relatedParts(selected));
    selectedMeshes=meshes.filter(mesh => node.kind==='part' ? descendants.has(mesh.userData.detailId) : assemblies.has(mesh.userData.partId));
    // Hide context for a part close-up. This exposes internal geometry without
    // asserting an unverified service disassembly or introducing transparency sorting.
    const keep=new Set(selectedMeshes);
    if(selected!==ROOT_PART_ID) for(const mesh of meshes) mesh.visible=keep.has(mesh);
    pulseStart=now+(instant||reduce ? 0 : ZOOM_MS);frame(selected,now,instant);paint(now);
    return resolution;
  }
  function reset({now=clock,instant=false}={}) {
    alive();clock=timestamp(now);restore();resolution={status:'unselected',node:null};frame(ROOT_PART_ID,now,instant);
  }
  function resize(width,height,{now=clock}={}) {
    alive();timestamp(now);
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0) return false;
    camera.aspect=width/height;camera.updateProjectionMatrix();frame(selected||scope,now,true);return true;
  }
  function setReducedMotion(value) {
    alive();reduce=Boolean(value);
    if(reduce && motion) {camera.position.copy(motion.end);target.copy(motion.center);motion=null;camera.lookAt(target);camera.updateMatrixWorld(true);}
    paint(clock);
  }
  function dispose() {
    if(disposed) return;
    restore();motion=null;
    const geometries=new Set(meshes.map(mesh=>mesh.geometry)), materials=new Set(meshes.map(mesh=>mesh.material));
    for(const geometry of geometries) geometry.dispose();
    for(const material of materials) material.dispose();
    scene.clear();root.clear();disposed=true;
  }
  frame(ROOT_PART_ID,0,true);
  return {scene,root,camera,target,focus,reset,resize,update,setReducedMotion,dispose,setScope,selectInScope,pick,
    stopCameraMotion(){alive();motion=null;},
    get state(){return {selected,scope,status:resolution.status,reducedMotion:reduce,disposed};}};
}
