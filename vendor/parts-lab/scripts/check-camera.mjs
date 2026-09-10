import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3,MOUSE,TOUCH} from '../dist/vendor/three.module.js';
import {OrbitControls} from '../dist/vendor/OrbitControls.js';
import {configureInspectionControls,setInspectionDragMode} from '../dist/camera-rig.js';
const camera=new PerspectiveCamera(34,1.5,.001,100),controls=new OrbitControls(camera,null);
configureInspectionControls(controls,true);
camera.position.set(0,-2,.1);controls.update();
assert.ok(camera.position.y<0&&controls.getPolarAngle()>Math.PI/2,'Underside must be reachable');
camera.position.set(1,.5,1);controls.target.set(0,0,0);controls.update();
// Exercise the vendored OrbitControls pan math, without a browser or renderer.
controls.domElement={clientHeight:600,clientWidth:900};
const before=controls.target.clone();controls._pan(120,-80);controls.update();
assert.ok(controls.target.distanceTo(before)>.01,'Pan must move the orbit target away from the machine center');
setInspectionDragMode(controls,true);assert.equal(controls.touches.ONE,TOUCH.PAN);assert.equal(controls.mouseButtons.LEFT,MOUSE.PAN);
setInspectionDragMode(controls,false);assert.equal(controls.touches.ONE,TOUCH.ROTATE);
assert.equal(controls.touches.TWO,TOUCH.DOLLY_PAN);
controls.enableDamping=false;controls.target.set(.8,.4,-.4);camera.position.copy(controls.target).add(new Vector3(0,0,.04));controls.update();
assert.ok(camera.position.distanceTo(controls.target)<.05,'Small internal parts must allow a close view');
console.log('Camera checks passed: underside, movable orbit target, pan/rotate modes and close inspection');
