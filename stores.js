// v29: pestañas de tiendas (Activas / Inactivas / Eliminadas / Buscar) para dueño y directivo
(function(){
const SAof=id=>((window.TPWSA&&TPWSA())||{})[id]||{};
window.STst=s=>s.del?'del':(!s.act||SAof(s.id).blocked)?'in':'act';
let tab=localStorage.getItem('mt-stab')||'act',q='';
window.STtab=()=>tab;
const TABS=[['act','Activas'],['in','Inactivas'],['del','Eliminadas'],['q','Buscar']];
window.STtabs=()=>{const c={act:0,in:0,del:0};DB.stores.forEach(s=>c[STst(s)]++);
 return `<div class="sttabs" style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0">${TABS.map(([k,l])=>`<button class="btn sm ${tab===k?'':'sec'}" id="sttab-${k}" style="margin:0;flex:1 1 auto" onclick="STgo('${k}')">${k==='q'?'🔍 ':''}${l}${k==='q'?'':` (${c[k]})`}</button>`).join('')}</div>`};
window.STgo=k=>{tab=k;localStorage.setItem('mt-stab',k);render();if(k==='q')setTimeout(()=>{const i=document.getElementById('stq');if(i)i.focus()},0)};
const fd=t=>t?fdt(t):'—';
function reason(s){const a=SAof(s.id),r=[];if(s.del)return `Eliminada ${fd(s.del)}${s.delPor?' por '+esc(s.delPor):''}`;
 if(!s.act)r.push(s.inMot?esc(s.inMot):s.ej?'Tienda de ejemplo':'Desactivada');if(s.act===0&&s.inT)r.push(fd(s.inT)+(s.inPor?' por '+esc(s.inPor):''));if(a.blocked)r.push('Tablet bloqueada');return r.join(' · ')}
const badge=s=>({act:'<span class="tag ok">Activa</span>',in:'<span class="tag bad">Inactiva</span>',del:'<span class="tag bad">🗑️ Eliminada</span>'})[STst(s)];
const reqOf=s=>(BK.sreq||[]).find(r=>r.store_id===s.id)||(BK.sreq||[]).find(r=>s.solId&&r.id===s.solId);
function card(s,dir){const st=STst(s),r=reqOf(s),icon=s.cat==='farmacia'?'💊':'🏪';
 const btns=st==='act'?`<button class="btn sec sm" id="stoff${s.id}" onclick="event.stopPropagation();STact(${s.id},'deactivate')">⏸️ Desactivar</button><button class="btn sec sm" id="stdel${s.id}" onclick="event.stopPropagation();STact(${s.id},'delete')">🗑️ Eliminar</button>`
  :st==='in'?`<button class="btn sm" id="ston${s.id}" onclick="event.stopPropagation();STact(${s.id},'reactivate')">✅ Reactivar</button><button class="btn sec sm" id="stdel${s.id}" onclick="event.stopPropagation();STact(${s.id},'delete')">🗑️ Eliminar</button>`
  :`<button class="btn sm" id="stres${s.id}" onclick="event.stopPropagation();STact(${s.id},'restore')">♻️ Restaurar</button>`;
 return `<div class="card stc" data-st="${s.id}"><div class="row"><b>${icon} ${esc(s.n)}</b>${badge(s)}</div><div class="muted">${esc(s.tipo||'')}${s.col?' · 📍 '+esc(s.col):''}</div>
 ${r&&(r.encargado||r.tel)?`<div class="muted">👤 ${esc(r.encargado||'—')}${r.tel?' · 📞 '+esc(r.tel):''}</div>`:''}${st!=='act'?`<div class="muted"><b>Estado:</b> ${reason(s)}</div>`:''}
 <div class="muted">Productos: ${(s.prods||[]).length}${dir&&st!=='del'?` · <a href="#" onclick="dSt=${s.id};dBack='dtiendas';go('dtienda');return false">Ver tienda ›</a>`:''}</div>${btns}</div>`}
const norm=x=>String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
function match(s){if(!q.trim())return true;const r=reqOf(s)||{};const h=norm([s.n,s.tipo,s.cat,s.col,r.direccion,r.encargado,r.tel].join(' '));return norm(q).split(/\s+/).every(w=>h.includes(w)||(w.replace(/\D/g,'')&&String(r.tel||'').replace(/\D/g,'').includes(w.replace(/\D/g,''))))}
function results(dir){const L=DB.stores.filter(match);return `<div class="muted" id="stqn" style="margin:6px 0">${L.length} ${L.length===1?'tienda':'tiendas'}</div>`+(L.map(s=>card(s,dir)).join('')||'<p class="muted empty">Sin resultados.</p>')}
window.STlist=dir=>{if(tab==='q')return `<input class="f" id="stq" placeholder="Nombre, tipo, dirección, encargado o teléfono" value="${esc(q)}" oninput="STq(this.value,${dir})"><div id="stres">${results(dir)}</div>`;
 const L=DB.stores.filter(s=>STst(s)===tab);return L.map(s=>card(s,dir)).join('')||`<p class="muted empty">${tab==='in'?'No hay tiendas inactivas.':'No hay tiendas eliminadas.'}</p>`};
window.STq=(v,dir)=>{q=v;const e=document.getElementById('stres');if(e)e.innerHTML=results(dir)};
const ASK={deactivate:'¿Desactivar esta tienda? Los clientes dejan de verla y su tablet no podrá entrar.',delete:'¿Eliminar esta tienda? Se oculta para todos y su tablet sale. Los pedidos y el historial se conservan y podrás restaurarla desde “Eliminadas”.',
 reactivate:'¿Reactivar esta tienda? Vuelve a aparecer a los clientes y se desbloquea su tablet.',restore:'¿Restaurar esta tienda? Quedará en “Inactivas” para que la revises y la reactives.'};
const OK={deactivate:'Tienda desactivada',delete:'Tienda eliminada',reactivate:'Tienda reactivada',restore:'Tienda restaurada (inactiva)'};
window.STact=async(id,a)=>{let m='';if(a==='deactivate'||a==='delete'){m=prompt(ASK[a]+'\n\nMotivo (opcional):','');if(m===null)return}else if(!confirm(ASK[a]))return;
 try{const cat=await BK.rpc('store_state',{p_store:id,p_action:a,p_motivo:m||''});if(Array.isArray(cat))DB.stores=cat;toast(OK[a]);await BK.pull();render()}catch(e){toast(e.message)}};
})();
// v30: cortina (acordeón): una fila por tienda; al tocar se abre su tarjeta completa; solo una abierta
(function(){
let open=+localStorage.getItem('mt-stopen')||0;
const css=document.createElement('style');css.textContent=`.sth{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;margin:6px 0;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.08);cursor:pointer;user-select:none}
.sth b{font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sth .chev{transition:transform .2s;color:#64748b}.sth.on{border-radius:12px 12px 0 0;margin-bottom:0}.sth.on .chev{transform:rotate(90deg)}
.stbody{display:none;margin-top:0!important;border-radius:0 0 12px 12px!important}.stbody.on{display:block;animation:stIn .18s ease-out}@keyframes stIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}`;document.head.appendChild(css);
const badge=s=>({act:'<span class="tag ok">Activa</span>',in:'<span class="tag bad">Inactiva</span>',del:'<span class="tag bad">Eliminada</span>'})[STst(s)];
window.STfold=root=>{root=root||document;root.querySelectorAll('.stc[data-st],.dts[data-dt]').forEach(c=>{if(c.dataset.fold)return;const id=+(c.dataset.st||c.dataset.dt),s=store(id);if(!s)return;c.dataset.fold=1;
 const h=document.createElement('div');h.className='sth';h.id='sth'+id;h.dataset.sth=id;h.innerHTML=`<b>${s.cat==='farmacia'?'💊':'🏪'} ${esc(s.n)}</b><span style="display:flex;gap:6px;align-items:center">${badge(s)}<span class="chev">›</span></span>`;
 h.onclick=()=>STopen(id);c.parentNode.insertBefore(h,c);c.classList.add('stbody');if(id===open){c.classList.add('on');h.classList.add('on')}})};
window.STopen=id=>{open=open===id?0:id;localStorage.setItem('mt-stopen',open);document.querySelectorAll('.sth').forEach(h=>{const on=+h.dataset.sth===open;h.classList.toggle('on',on);const c=h.nextElementSibling;if(c)c.classList.toggle('on',on)});
 if(open){const h=document.getElementById('sth'+open);if(h){const r=h.getBoundingClientRect();if(r.top<60||r.top>innerHeight-120)h.scrollIntoView({behavior:'smooth',block:'start'})}}};
const R=render;render=function(){R.apply(this,arguments);if(view==='tiendas'||view==='dtiendas')STfold()};
const Q=STq;STq=function(){Q.apply(this,arguments);STfold(document.getElementById('stres'))};
})();
