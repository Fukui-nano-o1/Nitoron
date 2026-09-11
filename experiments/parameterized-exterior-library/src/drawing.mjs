import {validateRecipe,FAMILIES,refOf} from './catalog.mjs';
const esc=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
export function drawingSVG(input){const r=validateRecipe(input),p=r.params;if(r.family==='archedLoft')throw Error('曲面の模式図出力は未対応です。断面値はレシピJSONで保存してください');let shape='';
 if(r.family==='bolt')shape='<path d="M125 35 L195 35 L205 60 L195 85 L125 85 L115 60 Z"/><rect x="142" y="85" width="36" height="135"/>'+Array.from({length:12},(_,i)=>'<path d="M142 '+(96+i*10)+' l36 -6"/>').join('');
 else if(r.family==='nut')shape='<path d="M160 35 L234 78 L234 163 L160 206 L86 163 L86 78 Z"/><circle cx="160" cy="120" r="48"/>';
 else if(r.family==='washer')shape='<circle cx="160" cy="120" r="88"/><circle cx="160" cy="120" r="46"/>';
 else if(r.family==='cable')shape='<path d="M60 180 C100 20 220 210 260 50"/><path d="M70 183 C110 23 230 213 270 53"/>';
 else shape='<rect x="65" y="55" width="190" height="130"/>'+Array.from({length:Math.min(p.ribCount,20)},(_,i)=>'<rect x="'+(75+i*170/Math.min(p.ribCount,20))+'" y="45" width="5" height="150"/>').join('');
 const fields=Object.entries(p).map(([k,v],i)=>'<text x="330" y="'+(60+i*29)+'">'+esc(k)+' = '+v+(k==='ribCount'?'':' mm')+'</text>').join('');
 return '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="440" viewBox="0 0 720 440"><rect width="720" height="440" fill="white"/><g font-family="sans-serif" fill="#213e35"><text x="30" y="28" font-size="17">'+esc(r.label)+'</text><g transform="translate(0 45)" fill="none" stroke="#326c56" stroke-width="2">'+shape+'</g><g font-size="14" transform="translate(0 30)">'+fields+'</g><text x="30" y="340">'+esc(FAMILIES[r.family])+'</text><text x="30" y="370" font-size="12">'+esc(refOf(r))+'</text><text x="30" y="400" font-size="13">再利用レシピの模式図（縮尺なし）。製造図面・規格適合・実機採用の証明ではありません。</text></g></svg>';
}
