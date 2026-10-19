// v31: sanciones y revisión de repartidores por el servidor; el dueño ve el mismo estado (solo lectura)
(function(){
const lbl={cli:'Cliente',inv:'Invitado',rep:'Repartidor',due:'Dueño'};
const stTxt=x=>x.st==='baja'?'Dado de baja':'Suspendido'+(x.hasta?' hasta '+fdt(x.hasta):'');
const sancLine=(k,x)=>`<div class="line sanc" data-sanc="${esc(k)}"><div class="row"><b>${esc(k.replace(/^(cli|inv|rep|due):/,''))}</b><span class="tag ${x.st==='baja'?'bad':'ex'}">${stTxt(x)} por ${esc(x.por||'Directivo')}</span></div>
 <div class="muted">${lbl[k.split(':')[0]]||''}${x.mot?' · Motivo: '+esc(x.mot):''}${x.nota?' · '+esc(x.nota):''}${x.t?' · '+fdt(x.t):''}</div></div>`;
window.PPsancCard=()=>{const L=Object.keys(DB.sanc||{}).filter(k=>sancSt(k));return `<div class="card" id="sanccard"><h3>⚖️ Bajas y suspensiones</h3><div class="muted">Las aplica y las quita solo el Directivo. Aquí ves el mismo estado que él.</div>${L.map(k=>sancLine(k,DB.sanc[k])).join('')||'<p class="muted">Nadie está suspendido ni dado de baja.</p>'}</div>`};
// sanción en el detalle del repartidor (dueño y directivo)
const oDet=regDetail;regDetail=function(n){const x=sancSt('rep:'+n),h=oDet(n);return x?`<div class="warn" id="repsanc">⛔ ${stTxt(x)} por ${esc(x.por||'Directivo')}${x.mot?' · '+esc(x.mot):''}${x.nota?' · '+esc(x.nota):''}${role==='admin'?'<br><small>Solo el Directivo puede quitar esta sanción.</small>':''}</div>`+h:h};
const oSol=solList;const sol=function(){let h=oSol();if(role==='admin')h+=PPsancCard();
 // marca sancionados en la lista
 return h.replace(/(<div class="card store sol" data-sol="([^"]*)"[^>]*><div class="row"><b>[^<]*<\/b>)/g,(m,a,n)=>{const x=sancSt('rep:'+n.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>'));return x?a+`<span class="tag bad">${x.st==='baja'?'Dado de baja':'Suspendido'} por ${esc(x.por||'Directivo')}</span>`:a})};
A.sol=sol;D.sol=sol;
window.solList=sol;
// directivo: sancionar por el servidor
sancionar=async function(){const k=pKey,acc=$('#sacc').value,mot=$('#smot').value,nota=$('#snota').value.trim();if(!mot)return toast('Elige un motivo');if(mot==='Otro'&&!nota)return toast('Escribe la nota del motivo');
 let dias=null;if(acc==='Suspender'){dias=$('#sdias').value==='custom'?+$('#sdc').value:+$('#sdias').value;if(!(dias>0))return toast('Días de suspensión no válidos')}
 if(acc==='Dar de baja'&&!confirm('¿Dar de baja DEFINITIVA a '+kId(k)+'? Esto bloquea su acceso.'))return;
 try{DB.sanc=await BK.rpc('set_sanction',{p_key:k,p_acc:acc,p_dias:dias,p_mot:mot,p_nota:nota})||DB.sanc;toast('Registrado: '+acc);await BK.pull();render()}catch(e){toast(e.message)}};
// aprobar / rechazar registro por el servidor
regDecide=async function(n,ok){const r=regOf(n);if(!r||r.st!=='pendiente')return;let m='',nt='';
 if(ok){if(!confirm('¿Aprobar a '+n+'? Podrá aceptar pedidos.'))return}else{m=$('#rjm').value;nt=$('#rjn').value.trim();if(!m)return toast('Elige el motivo del rechazo');if(m==='Otro'&&!nt)return toast('Escribe la nota del motivo')}
 try{const d=await BK.rpc('review_rep_registration',{p_nombre:n,p_ok:ok,p_mot:m,p_nota:nt});DB.regs[n]=d;toast(ok?'Repartidor aprobado':'Registro rechazado');await BK.pull();render()}catch(e){toast(e.message);BK.pull()}};
// refrescar la vista cuando llegan cambios de sanciones/registros (tiempo real o recarga)
const oP=BK.pull;BK.pull=async function(){const h=JSON.stringify([DB.sanc,DB.regs]);const r=await oP.apply(this,arguments);if(JSON.stringify([DB.sanc,DB.regs])!==h)try{render()}catch(_){}return r};
})();
