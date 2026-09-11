// Standalone 2D predictive diagnostics. No 3D model is created from an affine fit.
export function buildCameraViewer(report,images={}){
  const payload=JSON.stringify({report,images}).replace(/</g,'\\u003c');
  return `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nitoron v4 カメラ予測比較</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f7f8;color:#19313a;font:16px/1.6 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:20px}h1{font-size:24px}section{background:white;border:1px solid #dbe3e6;padding:16px;margin:16px 0;border-radius:12px}select,button{font:inherit;padding:8px;max-width:100%}label{display:inline-block;margin:4px 12px 4px 0}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:8px;border-bottom:1px solid #ddd;white-space:nowrap}svg{display:block;width:100%;min-height:240px;max-height:650px;background:#eee}.note{color:#465b63;font-size:14px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.5 monospace}button{border:1px solid #bdcdd2;border-radius:8px;background:white;color:inherit;cursor:pointer}button[aria-pressed=true]{background:#dbeef1}a{color:#07677c}#selection{overflow-wrap:anywhere}</style>
<main><h1>カメラの予測を比較する / v4</h1><p>資料照合済み3D：0部品。これは固定した3D仮定からの2D予測比較です。新しい3D配置は生成しません。</p>
<p class="note">一般アフィンは、せん断・軸別倍率を許す8係数の写像です。物理的な弱透視カメラとは異なり、誤差から形状だけの良し悪しは判定できません。学習に使わなかった点の予測（LOO）を表示します。</p>
<section><label>領域 <select id="group"></select></label><label>予測 <select id="predictor"><option value="affine">一般アフィン</option><option value="grid">v3 格子カメラ</option><option value="centroid">残りの点の平均</option></select></label><p id="status"></p><p id="metric"></p><p class="note">橙丸＝資料の指し先。青十字＝その点を除外した予測。画像外の予測も含めて縮尺を合わせます。計算不能な予測は描きません。</p><svg id="diagram" role="img" aria-label="資料の点と除外予測の比較"></svg><p id="selection">部品を選ぶと、その検証回の診断を表示します。</p><pre id="diagnostics"></pre></section>
<section><h2>部品ごとの予測誤差</h2><div class="scroll"><table><thead><tr><th>部品</th><th>符号</th><th>アフィン px</th><th>v3 px</th><th>平均 px</th><th>学習点</th><th>rank</th><th>R条件数</th><th>状態</th></tr></thead><tbody id="rows"></tbody></table></div></section>
<section><p>背面が5点の場合、各回の学習は4点。rank=4でも各画像座標の残差自由度は0です。学習誤差が小さいだけでは支持になりません。計算不能な回が1件でもあればアフィン全体RMSEは未計算とします。</p><p class="note">predictionGain は学習側の画素誤差に対する線形増幅係数で、実測の不確かさではありません。前後左右・奥行き・実機一致は未検証です。</p><a href="grid/viewer.html">既存v3の3D仮定を見る（この比較で変更なし）</a></section></main>
<script type="application/json" id="data">${payload}</script><script>
const {report,images}=JSON.parse(document.querySelector('#data').textContent),$=s=>document.querySelector(s);
const ns='http://www.w3.org/2000/svg',fmt=x=>Number.isFinite(x)?x.toFixed(2):'未計算';
const make=(tag,attrs={})=>{const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e};
report.groups.forEach((g,i)=>{const o=document.createElement('option');o.value=i;o.textContent=(g.regionId||g.id)+' / '+g.count+'点';$('#group').append(o)});
let selected=null;
function render(){
 const g=report.groups[Number($('#group').value)||0],kind=$('#predictor').value,svg=$('#diagram');svg.replaceChildren();$('#rows').replaceChildren();$('#diagnostics').textContent='';
 if(!g){$('#status').textContent='計算対象の領域がありません';return}
 $('#status').textContent=g.status+' / 判定: '+g.assessment;
 $('#metric').textContent=g.all?'LOO RMSE：アフィン '+fmt(g.all.affineRmsePx)+' px / v3 '+fmt(g.all.gridRmsePx)+' px / 平均 '+fmt(g.all.centroidRmsePx)+' px':'点数不足のため計算停止';
 const [w,h]=JSON.parse(g.figureKey).slice(-2),predictions=g.folds.map(f=>f[kind].predictionXY).filter(p=>p&&p.every(Number.isFinite));
 const xs=[0,w,...predictions.map(p=>p[0])],ys=[0,h,...predictions.map(p=>p[1])],left=Math.min(...xs),top=Math.min(...ys),width=Math.max(...xs)-left,height=Math.max(...ys)-top;
 const pad=Math.max(width,height)*.025,r=Math.max(width,height)*.005;
 svg.setAttribute('viewBox',[left-pad,top-pad,width+pad*2,height+pad*2].join(' '));
 if(images[g.figureKey])svg.append(make('image',{href:images[g.figureKey],x:0,y:0,width:w,height:h}));
 for(const f of g.folds){
  const holder=make('g',{'data-id':f.id}),a=f.sourceXY,b=f[kind].predictionXY;
  holder.append(make('circle',{cx:a[0],cy:a[1],r,fill:'#d86c00',stroke:'white','stroke-width':r*.25}));
  if(b&&b.every(Number.isFinite)){
   holder.append(make('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:'#177ea2','stroke-width':r*.3}));
   const cross=make('path',{'data-prediction-x':b[0],'data-prediction-y':b[1],d:'M '+(b[0]-r)+' '+b[1]+' h '+(2*r)+' M '+b[0]+' '+(b[1]-r)+' v '+(2*r),stroke:'#06668d','stroke-width':r*.5});holder.append(cross);
  }
  holder.style.cursor='pointer';holder.onclick=()=>choose(f);svg.append(holder);
  const row=document.createElement('tr');row.dataset.id=f.id;
  const first=document.createElement('td'),button=document.createElement('button');button.textContent=f.name;button.setAttribute('aria-pressed',String(selected===f.id));button.onclick=()=>choose(f);first.append(button);row.append(first);
  for(const value of [f.marker??'—',fmt(f.affine.errorPx),fmt(f.grid.errorPx),fmt(f.centroid.errorPx),f.trainingIds.length,f.affine.diagnostics?.rank??'—',fmt(f.affine.diagnostics?.conditionInfR),f.affine.status]){const cell=document.createElement('td');cell.textContent=value;row.append(cell)}$('#rows').append(row);
 }
 function choose(f){selected=f.id;$('#selection').textContent=f.name+' / '+f.id+' / '+(f.added?'v3追加部品':'旧部品');$('#diagnostics').textContent=JSON.stringify({trainingIds:f.trainingIds,affine:f.affine,grid:f.grid,centroid:f.centroid},null,2);for(const b of document.querySelectorAll('#rows button'))b.setAttribute('aria-pressed',String(b.closest('tr').dataset.id===f.id))}
 const current=g.folds.find(f=>f.id===selected);if(current)choose(current);else $('#selection').textContent='部品を選ぶと、その検証回の診断を表示します。';
 window.__cameraReady=true;
}
$('#group').onchange=()=>{selected=null;render()};$('#predictor').onchange=render;render();
</script></html>`;
}
