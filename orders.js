// v33: Pedidos del dueño con selector Activos / En proceso / Entregados / Cancelados
(function(){
const RS=o=>o.cat==='paquetes'?1:2;
window.odCls=o=>{if(o.cancel)return 'can';if(done(o))return 'ent';if(o.st>RS(o)||(o.recog&&o.recog.tienda))return 'pro';return 'act'};
const OPT=[['act','Activos','Nuevos, esperando repartidor, en la tienda o listos para recoger'],['pro','En proceso','Recogidos y en camino al cliente'],['ent','Entregados','Entregados al cliente'],['can','Cancelados','Cancelados o rechazados']];
const EMPTY={act:'No hay pedidos activos ahora.',pro:'Ningún pedido va en camino ahora.',ent:'Todavía no hay pedidos entregados.',can:'No hay pedidos cancelados.'};
let sel=localStorage.getItem('mt-odsel')||'act',open=false;if(!OPT.some(x=>x[0]===sel))sel='act';
const cnt=()=>{const c={act:0,pro:0,ent:0,can:0};DB.orders.forEach(o=>c[odCls(o)]++);return c};
const revisar=o=>!!(o.verif&&o.verif.entrega&&o.verif.entrega.revisar);
window.ODhead=()=>{const c=cnt(),cur=OPT.find(x=>x[0]===sel);const nr=DB.orders.filter(o=>odCls(o)==='ent'&&revisar(o)).length;
 return `<div class="oddrop" style="position:relative;margin:4px 0 12px"><button class="f" id="odbtn" aria-haspopup="listbox" aria-expanded="${open}" onclick="ODtog()" style="width:100%;display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:16px;padding:12px 14px;background:#fff;border:2px solid #0f766e;border-radius:12px;cursor:pointer">
 <span>${cur[1]} (${c[sel]})</span><span style="font-size:13px;transition:transform .15s;${open?'transform:rotate(180deg)':''}">▼</span></button>
 ${open?`<div id="odmenu" role="listbox" style="position:absolute;left:0;right:0;top:100%;z-index:30;background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.15);margin-top:4px;overflow:hidden">${OPT.map(([k,l,d])=>`<div role="option" id="odopt-${k}" aria-selected="${k===sel}" onclick="ODset('${k}')" style="padding:12px 14px;cursor:pointer;border-bottom:1px solid #f1f5f9;${k===sel?'background:#f0fdfa':''}"><div style="display:flex;justify-content:space-between"><b>${k===sel?'✓ ':''}${l}</b><span class="tag ${k==='act'&&c[k]?'bad':''}">${c[k]}</span></div><div class="muted" style="font-size:12px">${d}${k==='ent'&&nr?` · <b>⚠️ ${nr} por revisar</b>`:''}</div></div>`).join('')}</div>`:''}</div>`};
window.ODtog=()=>{open=!open;render()};
window.ODset=k=>{sel=k;open=false;localStorage.setItem('mt-odsel',k);render();scrollTo(0,0)};
document.addEventListener('click',e=>{if(open&&!e.target.closest('.oddrop')){open=false;render()}});
window.ODsel=()=>{const L=DB.orders.filter(o=>odCls(o)===sel);return L.sort((a,b)=>sel==='act'||sel==='pro'?a.t-b.t:b.t-a.t)};
window.ODbadge=o=>odCls(o)==='ent'&&revisar(o)?`<div class="odrev" data-odrev="${o.id}" style="margin:10px 0 -6px"><span class="tag bad">⚠️ Entregado (sin código) – por revisar</span></div>`:'';
window.ODempty=()=>ODsel().length?'':`<p class="muted empty" id="odempty">${EMPTY[sel]}</p>`;
})();
