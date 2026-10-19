// v24: comprobantes por paso. El estado del repartidor solo cambia con public.rep_step (validado en el servidor).
(function(){
const geo=()=>new Promise(ok=>{if(!navigator.geolocation)return ok(null);let done=0;const fin=v=>{if(!done){done=1;ok(v)}};setTimeout(()=>fin(null),9000);
 navigator.geolocation.getCurrentPosition(p=>fin({lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy}),()=>fin(null),{enableHighAccuracy:true,timeout:8000,maximumAge:20000})});
const isP=o=>o.cat==='paquetes',RS=o=>isP(o)?1:2,MX=o=>isP(o)?3:4;
let busy=0,dFoto={},dOpen={};
async function step(id,action,extra={}){if(busy)return;busy=1;const o=O(id);try{const g=(action==='avanzar')?null:await geo();
  const r=await BK.rpc('rep_step',{p_id:id,p_action:action,p_code:extra.code||null,p_lat:g&&g.lat,p_lng:g&&g.lng,p_acc:g&&g.acc,p_photo:extra.photo||null,p_monto:extra.monto||null});
  if(!r||!r.ok){toast((r&&r.msg)||'No se pudo');if(r&&r.locked){dOpen[id]=1}busy=0;await BK.pull();render();return false}
  toast(action==='avanzar'?'Estado: '+steps(o)[o.st+1]:action==='recogido'?'✅ Recogido · vas en camino':'🎉 Pedido entregado');await BK.pull();busy=0;render();return true}
 catch(e){busy=0;toast(e.message||'Error');return false}}
window.repStep=step;
const _adv=adv;adv=function(id){if(role==='repartidor')return step(id,'avanzar');return _adv(id)};
function cashBox(o){if(o.pago!=='efectivo'||o.cobrado)return '';return `<label>💵 Cobré (efectivo, sin contar el cambio; total ${mx(total(o))})</label><input id="dm${o.id}" type="number" inputmode="decimal" placeholder="${total(o)}">`}
advBtn=function(o,inP){const pay=repPayHint(o),rs=RS(o),mx_=MX(o);
 if(o.cancel||o.st>=mx_)return pay;
 if(o.st<rs)return pay+`<button class="btn sm" data-adv="${o.id}" onclick="adv(${o.id})">➡️ Pasar a “${steps(o)[o.st+1]}”</button>`;
 if(o.st===rs){if(needRec(o)&&!o.compra)return pay+`<div class="warn recneed">🧾 Paso 1 de 2 para recoger: sube la ${recKind(o)==='paq'?'foto del paquete':'foto de la nota / ticket'}.</div>`+(inP?`<button class="btn sm" onclick="document.getElementById('recform').scrollIntoView({behavior:'smooth'})">🧾 Ir a recolección</button>`:`<button class="btn sm" data-rec="${o.id}" onclick="oSel=${o.id};go('pedido')">🧾 Recolección: subir foto</button>`);
  const st=o.det&&o.det.storeId,tc=o.recog&&o.recog.tienda;
  return pay+`<div class="card pick" id="pick${o.id}"><h3>📦 Confirmar recogido</h3>${st?(tc?`<div class="okbox">✅ La tienda ya marcó <b>“Entregado al repartidor”</b>. Confirma desde la tienda (se registra tu ubicación).</div>`:`<div class="muted">Pide a la tienda que toque <b>“🤝 Entregado al repartidor”</b> en su tablet, o escribe el <b>código de 6 dígitos</b> que aparece en su tablet para este pedido.</div><input id="hc${o.id}" inputmode="numeric" maxlength="6" placeholder="Código de la tienda (6 dígitos)" autocomplete="off">`):'<div class="muted">Se registra tu ubicación al confirmar.</div>'}
   <button class="btn" id="pickgo${o.id}" onclick="repPick(${o.id})">✅ Ya lo recogí</button><div class="muted">📍 Debes estar en la tienda: se verifica tu ubicación (a menos de 150 m).</div></div>`}
 const L=o.delivTries>=5;
 return pay+`<div class="card deliv" id="deliv${o.id}"><h3>🏠 Entregar</h3>${cashBox(o)}
  ${L?'<div class="warn">🔒 El código se bloqueó por intentos fallidos. Usa la entrega con foto.</div>':`<div class="okbox"><b>🔑 Pide al cliente su código de entrega</b> (4 dígitos, lo ve en su app en “Seguimiento”). Escríbelo aquí solo cuando le entregues el pedido.</div>
  <input id="dc${o.id}" inputmode="numeric" maxlength="4" placeholder="Código de entrega" autocomplete="off" style="font-size:22px;letter-spacing:6px;text-align:center"><button class="btn" id="delgo${o.id}" onclick="repDeliver(${o.id})">✅ Entregado</button>`}
  ${L||dOpen[o.id]?`<div class="card" id="dfb${o.id}"><b>📷 Entrega sin código</b><div class="muted">Toma una foto del pedido entregado (en la puerta del domicilio). Se guarda tu ubicación y el dueño la revisará: quedará como <b>“Entregado (sin código) – por revisar”</b>.</div>${dFoto[o.id]?`<img class="regimg" src="${dFoto[o.id]}" alt="">`:''}<label class="btn sec" style="text-align:center">📷 Tomar foto<input id="df${o.id}" type="file" accept="image/*" capture="environment" style="display:none" onchange="repDFile(${o.id},this)"></label><button class="btn sec" id="dfgo${o.id}" ${dFoto[o.id]?'':'disabled'} onclick="repDeliverFoto(${o.id})">Entregar sin código</button></div>`:`<button class="btn sec sm" id="dfopen${o.id}" onclick="repDOpen(${o.id})">El cliente no puede mostrar el código</button>`}</div>`};
const mon=o=>{if(o.pago!=='efectivo'||o.cobrado)return {};const v=+(($('#dm'+o.id)||{}).value||0);return v>0?{monto:v}:null};
window.repPick=id=>step(id,'recogido',{code:(($('#hc'+id)||{}).value||'').trim()});
window.repDeliver=id=>{const o=O(id),m=mon(o);if(!m)return toast('Escribe cuánto cobraste en efectivo');const c=(($('#dc'+id)||{}).value||'').trim();if(!/^\d{4}$/.test(c))return toast('Escribe el código de 4 dígitos del cliente');return step(id,'entregado',{code:c,...m})};
window.repDOpen=id=>{dOpen[id]=1;render()};
window.repDFile=async(id,inp)=>{const f=inp.files[0];if(!f)return;try{dFoto[id]=await shrink(f,1200,.75)}catch(e){return toast('No se pudo leer la foto')}render()};
window.repDeliverFoto=async id=>{const o=O(id),m=mon(o);if(!m)return toast('Escribe cuánto cobraste en efectivo');if(!dFoto[id])return toast('Toma la foto de la entrega');
 if(!confirm('Se marcará como “Entregado (sin código) – por revisar” y se avisará al dueño. ¿Continuar?'))return;const key='tk:entrega:'+id+':'+Date.now();
 try{await BK.upPhoto(key,dFoto[id])}catch(e){return toast('No se pudo subir la foto: '+(e.message||e))}if(await step(id,'entregado_foto',{photo:key,...m}))delete dFoto[id]};
// cliente: código de entrega
window.cliCode=o=>{if(!o||o.cancel||done(o)||!o.delivCode)return '';return `<div class="card" id="delivcode" style="text-align:center;border:2px solid #0f766e"><div class="muted">🔑 Tu código de entrega</div><div style="font-size:40px;font-weight:800;letter-spacing:10px" id="dcode">${esc(o.delivCode)}</div><div class="muted">Dáselo al repartidor <b>solo cuando tengas tu pedido en la mano</b>. Nadie de Mandados te lo pedirá por teléfono.</div></div>`};
// tienda: entregado al repartidor por el servidor + código de respaldo
if(typeof tEntr==='function'){tEntr=async function(id){const [s,o]=tMine(id);if(!o||!o.prep)return render();if(!o.rep)return toast('Aún no hay repartidor asignado');if(o.recog&&o.recog.tienda)return toast('Ya está marcado como entregado al repartidor');
 try{await BK.rpc('tienda_handoff',{p_id:id});toast('Listo: el repartidor ya puede confirmar el recogido');await BK.pull()}catch(e){toast(e.message)}render()}}
const hBox=o=>o.handoff&&o.prep&&!(o.recog&&o.recog.tienda)&&!o.cancel?`<div class="okbox thand" id="thand${o.id}">🔑 Código para el repartidor: <b style="font-size:22px;letter-spacing:3px">${esc(o.handoff)}</b><br><small>Toca “🤝 Entregado al repartidor” al darle el pedido. Si no puedes, díctale este código.</small></div>`:'';
if(typeof TV!=='undefined'&&TV.nota){const _n=TV.nota;TV.nota=function(){let h=_n();const o=(typeof tMine==='function'&&tSel!=null)?tMine(tSel)[1]:null;if(o){const x=hBox(o);if(x)h=h.includes('<button class="btn" id="tentr"')?h.replace('<button class="btn" id="tentr"',x+'<button class="btn" id="tentr"'):h.replace('<div class="nfirm">',x+'<div class="nfirm">')}return h}}
if(typeof tOrd==='function'){const _t=tOrd;tOrd=function(o,s){const h=_t(o,s),x=hBox(o);return x?h.replace(/<\/div>\s*$/,x+'</div>'):h}}
// dueño/directivo: cómo se verificó cada paso
const dTxt=v=>v.dist!=null?` · 📍 a ${v.dist} m`:v.gps?' · 📍 GPS registrado':'';
window.vfyHtml=o=>{const V=o.verif||{},r=V.recog,e=V.entrega,L=[];
 if(r)L.push(`<div class="vf ${r.ok?'ok':'bad'}" data-vf="recog">📦 Recogido: ${r.m==='tienda'?'🏪 tienda confirmó':r.m==='codigo'?'🔑 código de la tienda':r.m==='sin_tablet'?'🧾 foto de la nota (tienda sin tablet)':'🧾 foto'}${dTxt(r)}${r.sinUbic?' · <b>⚠️ sin verificación de ubicación</b>':''}</div>`);
 else if(o.st>=RS(o)+1&&!o.cancel)L.push('<div class="vf bad" data-vf="recog">📦 Recogido: ⚠️ sin comprobante (marcado antes de v24 o manual)</div>');
 if(e)L.push(`<div class="vf ${e.ok?'ok':'bad'}" data-vf="entrega">🏠 Entregado: ${e.m==='codigo'?'🔑 código del cliente':'📷 foto, sin código'}${e.gps?' · 📍 GPS registrado':' · sin GPS'}${e.revisar?' · <b>⚠️ por revisar</b>':e.rev?' · ✅ revisado por '+esc(e.rev.por||''):''}${e.foto?` <a href="#" onclick="event.preventDefault();vfFoto('${esc(e.foto)}')">ver foto</a>`:''}${e.lat!=null?` <a href="https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lng}" target="_blank" rel="noopener">ubicación</a>`:''}${e.revisar?` <button class="btn sec sm" onclick="vfRev(${o.id})">Marcar revisado</button>`:''}</div>`);
 Object.keys(V).filter(k=>/^manual/.test(k)).forEach(k=>L.push(`<div class="vf bad">✋ Paso “${steps(o)[+k.slice(6)]||k}” cambiado manualmente por ${esc(V[k].por||'')}</div>`));
 if(o.delivTries)L.push(`<div class="vf bad">🔑 ${o.delivTries} código${o.delivTries===1?'':'s'} de entrega incorrecto${o.delivTries===1?'':'s'}</div>`);
 return L.length?`<div class="vfy">${L.join('')}</div>`:''};
window.vfFoto=async k=>{try{const u=await fget(k);if(u){const w=window.open();w.document.write('<img src="'+u+'" style="max-width:100%">')}else toast('Foto no disponible')}catch(e){toast('Foto no disponible')}};
window.vfRev=async id=>{const n=prompt('Nota de la revisión (opcional):','');if(n===null)return;try{await BK.rpc('review_delivery',{p_id:id,p_nota:n});toast('Marcado como revisado');await BK.pull()}catch(e){toast(e.message)}render()};
if(typeof vivoView==='function'&&typeof A!=='undefined'){const _v=vivoView;const nv=function(){const R=DB.orders.filter(o=>o.verif&&o.verif.entrega&&o.verif.entrega.revisar);let h=_v();
  if(R.length)h=h.replace('<div id="vlist">',`<div class="card" id="vrev" style="border:2px solid #b45309"><h3>⚠️ Entregado (sin código) – por revisar (${R.length})</h3>${R.map(o=>`<div class="line" data-rv="${o.id}"><b>${CATS[o.cat][0]} #${o.id}</b> · 🛵 ${esc(o.rep||'')}${vfyHtml(o)}</div>`).join('')}</div><div id="vlist">`);return h};vivoView=nv;A.vivo=nv;D.vivo=nv}
})();
