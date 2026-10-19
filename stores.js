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
