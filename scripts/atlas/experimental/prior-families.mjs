// Experiment v3: category-wide assumptions authored by Codex, 2026-09-11.
// No coordinates here were extracted from a PC752N image or manufacturer CAD.
// Axes/fractions follow the unchanged v2 prior convention: length, height, width.
export const BASE_PRIOR_PROFILE = 'baseline-v2';
export const EXPANDED_PRIOR_PROFILE = 'walk-behind-controls-v3';

const definitions = [
  {id:'main-switch',names:['メインスイッチ'],size:[.035,.045,.055],center:[.02,.64,.27],
    mountingAssumption:'Small control on assumed engine-side control area; actual mounting and side unknown'},
  {id:'choke-lever',names:['チョークレバー'],size:[.045,.035,.05],center:[.10,.56,.29],
    mountingAssumption:'Control near assumed intake area; actual mounting and side unknown'},
  {id:'fuel-cock-lever',names:['燃料コックレバー','燃料コック'],size:[.04,.035,.055],center:[.06,.61,.27],
    mountingAssumption:'Fuel valve below assumed fuel tank; actual mounting and side unknown'},
  {id:'fuel-cap',names:['燃料タンクキャップ','燃料キャップ'],size:[.035,.035,.09],center:[.03,.805,0],
    mountingAssumption:'Cap above assumed fuel tank; actual cap dimensions and offset unknown'},
  {id:'handle-height-lever',names:['ハンドル高さ調節レバー','ハンドル高さ調整レバー'],size:[.06,.05,.08],center:[-.24,.66,0],
    mountingAssumption:'Adjustment control near assumed handle support; actual mounting unknown'},
  {id:'aux-shift-lever',names:['副変速レバー'],size:[.035,.16,.05],center:[-.13,.55,-.10],
    mountingAssumption:'Secondary control near assumed transmission; actual mounting and side unknown'},
  {id:'stand',names:['スタンド'],size:[.05,.22,.35],center:[-.27,.18,0],
    mountingAssumption:'Generic lower support proxy; shape, mounting, number and deployed state unknown'},
  {id:'rope-hook',names:['ロープ掛け用フック','ロープ掛けフック','ロープフック'],size:[.04,.05,.07],center:[-.22,.40,.28],
    mountingAssumption:'Generic external attachment proxy; actual mounting and side unknown'},
];
export const EXTRA_PRIOR_FAMILIES = Object.freeze(definitions.map(d=>Object.freeze({
  ...d,names:Object.freeze(d.names),size:Object.freeze(d.size),center:Object.freeze(d.center),
  shape:'box',shapeBasis:'category-proxy',provenance:'human-authored-category-assumption',
  authoredBy:'Codex',authoredOn:'2026-09-11',documented3d:false,
})));

export function validatePriorProfile(profile) {
  if(profile!==BASE_PRIOR_PROFILE&&profile!==EXPANDED_PRIOR_PROFILE)throw new Error('unknown-prior-profile');
  return profile;
}

export function extraPriorFor(name) {
  // Exact names plus a complete, trailing parenthesized annotation only.
  // Never turn a cap, bracket, bolt, wire or unnamed generic lever into its parent part.
  const value=String(name).normalize('NFKC').trim();
  return EXTRA_PRIOR_FAMILIES.find(d=>d.names.some(n=>value===n||
    (value.startsWith(n+'(')&&/^\([^()]*\)$/.test(value.slice(n.length)))))??null;
}
