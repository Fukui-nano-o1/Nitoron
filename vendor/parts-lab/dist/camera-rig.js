import {MOUSE,TOUCH} from './vendor/three.module.js';
export function configureInspectionControls(controls,isSKP){
 controls.enableDamping=true;controls.dampingFactor=.14;
 controls.enablePan=true;controls.screenSpacePanning=true;
 controls.rotateSpeed=.28;controls.panSpeed=.55;controls.zoomSpeed=.55;
 controls.zoomToCursor=true;controls.minDistance=isSKP?.025:.15;
 controls.maxDistance=35;controls.minPolarAngle=.002;controls.maxPolarAngle=Math.PI-.002;
 controls.touches.TWO=TOUCH.DOLLY_PAN;
 setInspectionDragMode(controls,false);
}
export function setInspectionDragMode(controls,pan){
 controls.touches.ONE=pan?TOUCH.PAN:TOUCH.ROTATE;
 controls.mouseButtons.LEFT=pan?MOUSE.PAN:MOUSE.ROTATE;
}
