// Nitoron display presets. These are NOT manufacturer disassembly instructions.
// IDs/steps survive geometry replacement; geometry providers do not own these.
export const DISPLAY_STEPS = Object.freeze([
  {id:'overview',label:'全体',group:'crawler',transparency:0,wholeExploded:false,detailExploded:false,view:'photo'},
  {id:'assemblies',label:'構成',group:'engine',transparency:0,wholeExploded:true,detailExploded:false,view:'photo'},
  {id:'exterior',label:'外装',group:'engine',transparency:1,wholeExploded:false,detailExploded:false,view:'photo'},
  {id:'cables',label:'ケーブル',group:'handle',transparency:2,wholeExploded:false,detailExploded:false,view:'photo'},
  {id:'power',label:'エンジン',group:'engine',transparency:3,wholeExploded:false,detailExploded:true,view:'opposite'},
].map(Object.freeze));
export const TRANSPARENCY_LABELS = Object.freeze(['透過なし','外装を透過','外装＋ケーブルを透過','外装＋ケーブル＋エンジンを透過']);
export function layerFor(name,group){
  if(/control-cable|starter-cord/.test(name))return 'cables';
  if(/cowling|vent-cover|vent-slot|belt-cover|belt-inset|cover-round|cover-fastener|pivot-console|mudguard|rubber-skirt|rotor-deck/.test(name))return 'exterior';
  return group==='engine'?'engine':'structure';
}
