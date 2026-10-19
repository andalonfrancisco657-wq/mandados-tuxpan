// v32: tipo de vehículo y licencia de manejo del repartidor
(function(){
const VEH=[['moto','🏍️ Moto'],['carro','🚗 Carro'],['bici','🚲 Bicicleta'],['pie','🚶 A pie']],vl=v=>(VEH.find(x=>x[0]===v)||[,'—'])[1],needLic=v=>v==='moto'||v==='carro';
const hoy=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mazatlan'}).format(new Date());
const dLeft=d=>d?Math.round((Date.parse(d+'T00:00:00Z')-Date.parse(hoy()+'T00:00:00Z'))/864e5):null;
window.licState=r=>{if(!r||!needLic(r.veh))return null;const n=dLeft(r.lic&&r.lic.vence);if(n==null)return null;return n<=0?{st:'vencida',n}:n<=30?{st:'pronto',n}:{st:'ok',n}};
const licTag=r=>{const s=licState(r);return !s?'':s.st==='vencida'?'<span class="tag bad">🪪 Licencia vencida</span>':s.st==='pronto'?`<span class="tag ex">🪪 Vence en ${s.n} día${s.n===1?'':'s'}</span>`:''};
window.licTag=licTag;
// ---- formulario (registro y actualización)
let V=null;const vInit=src=>{V={veh:src?.veh||'',placas:src?.placas||'',num:src?.lic?.num||'',tipo:src?.lic?.tipo||'',vence:src?.lic?.vence||'',licF:null,licR:null}};
const vCollect=()=>{if(!V)return;[['vplacas','placas'],['vlnum','num'],['vltipo','tipo'],['vlvence','vence']].forEach(([i,k])=>{const e=document.getElementById(i);if(e)V[k]=e.value.trim()});V.placas=V.placas.toUpperCase()};
window.vehSel=v=>{vCollect();V.veh=v;render()};
window.vehFile=async(inp,k)=>{const f=inp.files[0];if(!f)return;try{vCollect();V[k]=await shrink(f,1000);render()}catch(e){toast('No se pudo leer la foto, intenta otra vez')}};
const phBox=(k,t)=>`<div class="card"><h3>${t}</h3>${V[k]?`<img class="regimg" id="pv_${k}" src="${V[k]}" alt="${t}">`:'<div class="regph">Sin foto</div>'}
 <div class="row" style="gap:6px;margin-top:8px"><label class="btn sec sm" style="flex:1;text-align:center;margin:0">📷 Tomar foto<input id="f_${k}" type="file" accept="image/*" capture="environment" style="display:none" onchange="vehFile(this,'${k}')"></label><label class="btn sec sm" style="flex:1;text-align:center;margin:0">🖼️ Galería<input id="g_${k}" type="file" accept="image/*" style="display:none" onchange="vehFile(this,'${k}')"></label></div></div>`;
const vForm=()=>`<div class="card" id="vehcard"><h3>Tipo de vehículo</h3><div class="grid">${VEH.map(([v,l])=>`<button type="button" class="btn ${V.veh===v?'':'sec'}" id="veh-${v}" style="margin:0" onclick="vehSel('${v}')">${l}</button>`).join('')}</div>
 ${V.veh&&V.veh!=='pie'?`<label>Placas (opcional)</label><input id="vplacas" value="${esc(V.placas)}" maxlength="15" style="text-transform:uppercase" placeholder="Ej: ABC-123-D">`:''}</div>
 ${needLic(V.veh)?`<div class="card"><h3>🪪 Licencia de manejo</h3><div class="muted">Para moto o carro necesitas licencia vigente.</div><label>Número de licencia</label><input id="vlnum" value="${esc(V.num)}" maxlength="30"><label>Tipo de licencia</label><input id="vltipo" value="${esc(V.tipo)}" maxlength="30" placeholder="Ej: A, B, C o motociclista"><label>Fecha de vencimiento</label><input id="vlvence" type="date" value="${esc(V.vence)}" min="${hoy()}"></div>${phBox('licF','Licencia – frente')}${phBox('licR','Licencia – reverso')}`
 :V.veh?'<div class="muted card">Con bicicleta o a pie no necesitas licencia.</div>':''}`;
const vValid=(fotosOld)=>{vCollect();if(!V.veh)return 'Elige tu tipo de vehículo';if(!needLic(V.veh))return null;if(V.num.length<4)return 'Escribe el número de tu licencia';if(!V.tipo)return 'Escribe el tipo de licencia';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(V.vence))return 'Escribe la fecha de vencimiento';if(dLeft(V.vence)<=0)return 'Tu licencia está vencida: sube una vigente';if(!V.licF||!V.licR)return 'Sube la foto del frente y del reverso de tu licencia';return null};
async function upLic(prefix){const keys={};for(const k of ['licF','licR']){const key=prefix+k+'-'+Date.now().toString(36);await fput(key,V[k]);await BK.upPhoto(key,V[k]);keys[k]=key}return keys}
const payload=fotos=>({veh:V.veh,placas:V.veh==='pie'?'':V.placas,...(needLic(V.veh)?{lic:{num:V.num,tipo:V.tipo,vence:V.vence,fotos}}:{})});
// ---- paso en el registro
if(typeof RSTEPS!=='undefined'&&!RSTEPS.some(x=>x[0]==='veh'))RSTEPS.splice(RSTEPS.findIndex(x=>x[0]==='ine')+1,0,['veh','Vehículo y licencia']);
if(typeof regView==='function'){const oV=regView;regView=function(){if(rgStep==='veh'){if(!V||V._rg!==RG?.id){vInit(regOf(RG.nombre));V._rg=RG?.id}return oV().replace('<div id="rerr"',vForm()+'<div id="rerr"')}return oV()};
 const oVal=rgValid;rgValid=function(){if(rgStep==='veh'){const e=vValid();return e?rgErr(e):true}return oVal()};
 window.vehPayload=async k=>{if(!V||!V.veh)throw new Error('Completa el paso de vehículo');const e=vValid();if(e)throw new Error(e);return payload(needLic(V.veh)?await upLic(k('')):undefined)};}
// ---- repartidor: completar / renovar
const myReg=()=>typeof myRep!=='undefined'&&myRep?regOf(myRep):null;
function repBanner(){const r=myReg();if(!r||r.ej)return '';const s=licState(r);
 if(r.vehPend)return `<div class="card" id="vehpend"><b>⏳ Tu ${r.veh?'licencia/vehículo actualizado':'vehículo y licencia'} está en revisión</b><div class="muted">El dueño o el directivo lo revisan.</div></div>`;
 let h='';if(r.vehRej)h+=`<div class="warn" id="vehrej">❌ Rechazaron tu licencia/vehículo: ${esc(r.vehRej.mot)}${r.vehRej.nota?' · '+esc(r.vehRej.nota):''}. Corrige y vuelve a enviar.</div>`;
 if(!r.veh&&r.st!=='rechazado')return h+`<div class="card" id="vehfalta" style="border:2px solid #fde68a"><b>🛵 Completa tu vehículo y licencia</b><div class="muted">Ahora pedimos el tipo de vehículo y, para moto o carro, tu licencia de manejo.</div><button class="btn" id="vehgo" onclick="go('vehform')">Completar ahora</button></div>`;
 if(s&&s.st==='vencida')return h+`<div class="warn" id="licvenc" style="border:2px solid #fecaca">⛔ <b>Tu licencia venció</b>. No puedes aceptar pedidos hasta que subas la renovada y la aprueben.<br><button class="btn" id="vehgo" onclick="go('vehform')">📤 Subir licencia renovada</button></div>`;
 if(s&&s.st==='pronto')return h+`<div class="warn" id="licpronto">🪪 Tu licencia vence en <b>${s.n} día${s.n===1?'':'s'}</b> (${esc(r.lic.vence)}). Sube la renovada para no quedarte sin pedidos.<br><button class="btn sec sm" id="vehgo" onclick="go('vehform')">📤 Subir licencia renovada</button></div>`;
 return h}
if(typeof R!=='undefined'&&APP_ROLE==='repartidor'){
 const oH=R.home;R.home=()=>repBanner()+oH();
 R.vehform=()=>{const r=myReg();if(!V||V._rg!=='upd'){vInit(r&&r.veh?{veh:r.veh,placas:r.placas,lic:{num:r.lic?.num,tipo:r.lic?.tipo}}:null);V._rg='upd'}
  return `<button class="btn sec sm" style="margin:0 0 8px" onclick="V=null;go('home')">← Volver</button><h2>${r&&r.veh?'Actualizar licencia / vehículo':'Tu vehículo y licencia'}</h2><div class="muted">Lo revisa el dueño o el directivo. Mientras tanto sigues como estás.</div>${vForm()}<div id="rerr" class="err"></div><button class="btn" id="vehsend" onclick="vehSend()">📨 Enviar a revisión</button>`};
 window.vehSend=async()=>{const e=vValid();if(e)return rgErr(e);const b=$('#vehsend');b.disabled=true;
  try{const r=myReg();const fotos=needLic(V.veh)?await upLic('reg:'+(r&&r.id||'x')+':'):undefined;const d=await BK.rpc('rep_vehicle_update',{p_data:payload(fotos)});DB.regs[myRep]=d;V=null;toast('Enviado a revisión');go('home')}catch(x){b.disabled=false;rgErr(x.message)}};
 const oT=tomar;tomar=function(id){const s=licState(myReg());if(s&&s.st==='vencida')return toast('Tu licencia venció: sube la renovada para aceptar pedidos');return oT(id)};
 // pedirlo una vez al abrir
 let asked=false;const oR=render;render=function(){oR.apply(this,arguments);const r=myReg();if(!asked&&r&&!r.ej&&!locked()&&view==='home'&&((!r.veh&&!r.vehPend&&r.st!=='rechazado')||licState(r)?.st==='vencida')){asked=true;setTimeout(()=>{if(view==='home'&&confirm(!r.veh?'Completa tu tipo de vehículo y licencia de manejo. ¿Hacerlo ahora?':'Tu licencia venció. ¿Subir la renovada ahora?'))go('vehform')},400)}};
}
// ---- dueño / directivo: revisión
const lic=(L,pre)=>!L?'':`<span>Licencia</span><b>${esc(L.num)} · Tipo ${esc(L.tipo)}</b><span>Vence</span><b>${esc(L.vence)} ${(()=>{const n=dLeft(L.vence);return n<=0?'<span class="tag bad">Vencida</span>':n<=30?`<span class="tag ex">Vence en ${n} días</span>`:'<span class="tag ok">Vigente</span>'})()}</b>`;
const fotos=(F,id)=>F?`<div class="grid" style="margin-top:8px"><div><div class="muted">Licencia – frente</div><img class="regimg" data-foto="${esc(F.licF)}" alt="Licencia frente"></div><div><div class="muted">Licencia – reverso</div><img class="regimg" data-foto="${esc(F.licR)}" alt="Licencia reverso"></div></div>`:'';
function vehSection(n){const r=regOf(n);if(!r||r.ej)return '';const P=r.vehPend;
 let h=`<div class="card" id="vehadm"><h3>🛵 Vehículo y licencia</h3>${r.veh?`<div class="kv"><span>Vehículo</span><b>${vl(r.veh)}</b>${r.placas?`<span>Placas</span><b>${esc(r.placas)}</b>`:''}${lic(r.lic)}</div>${fotos(r.lic&&r.lic.fotos)}${r.vehRev?`<div class="muted">Aprobado por ${esc(r.vehRev.por)} el ${fdt(r.vehRev.t)}</div>`:''}`
  :'<div class="warn">Este repartidor aún no ha registrado su vehículo ni licencia (registro anterior a este requisito).</div>'}`;
 if(P)h+=`<div class="card" id="vehpendadm" style="box-shadow:none;border:2px solid #fde68a;margin-top:10px"><h3>⏳ ${r.veh?'Actualización':'Datos nuevos'} en revisión</h3><div class="kv"><span>Vehículo</span><b>${vl(P.veh)}</b>${P.placas?`<span>Placas</span><b>${esc(P.placas)}</b>`:''}${lic(P.lic)}<span>Enviado</span><b>${fdt(P.t)}</b></div>${fotos(P.lic&&P.lic.fotos)}
  ${r.st==='pendiente'?'<div class="muted">Se revisa junto con el registro (abajo).</div>':`<button class="btn" id="vehok" onclick="vehRev('${jsq(n)}',true)">✅ Aprobar licencia/vehículo</button><label>Motivo del rechazo</label><input id="vehmot" placeholder="Ej: la foto no se lee"><button class="btn sec" id="vehno" onclick="vehRev('${jsq(n)}',false)">❌ Rechazar</button>`}</div>`;
 if(r.vehRej&&!P)h+=`<div class="muted">Último rechazo: ${esc(r.vehRej.mot)} (${esc(r.vehRej.por)}, ${fdt(r.vehRej.t)})</div>`;
 return h+'</div>'}
window.vehRev=async(n,ok)=>{const m=ok?'':($('#vehmot').value||'').trim();if(!ok&&!m)return toast('Escribe el motivo del rechazo');if(ok&&!confirm('¿Aprobar la licencia/vehículo de '+n+'?'))return;
 try{DB.regs[n]=await BK.rpc('review_vehicle',{p_nombre:n,p_ok:ok,p_mot:m});toast(ok?'Aprobado':'Rechazado');await BK.pull();render()}catch(e){toast(e.message)}};
if(APP_ROLE==='admin'||APP_ROLE==='dir'){
 const oD=regDetail;regDetail=function(n){return vehSection(n)+oD(n)};
 const oS=A.sol;const sol=function(){let h=oS();const L=Object.values(DB.regs||{}).filter(r=>!r.ej);const X=L.filter(r=>licState(r)&&licState(r).st!=='ok'),P=L.filter(r=>r.vehPend&&r.st!=='pendiente'),F=L.filter(r=>!r.veh&&r.st==='aprobado'&&!r.vehPend);
  h=h.replace(/(<div class="card store sol" data-sol="([^"]*)"[^>]*><div class="row"><b>[^<]*<\/b>)/g,(m,a,n)=>{const r=Object.values(DB.regs||{}).find(x=>esc(x.nombre)===n);return r?a+licTag(r)+(r.vehPend&&r.st!=='pendiente'?'<span class="tag ex">⏳ Licencia en revisión</span>':''):a});
  const row=(r,t)=>`<div class="line lic" data-lic="${esc(r.nombre)}" onclick="solSel='${jsq(r.nombre)}';solBack='sol';go('solic')" style="cursor:pointer"><div class="row"><b>${esc(r.nombre)}</b>${t}</div></div>`;
  return h+`<div class="card" id="liccard"><h3>🪪 Licencias de manejo</h3>${X.map(r=>row(r,licTag(r))).join('')}${P.map(r=>row(r,'<span class="tag ex">⏳ En revisión</span>')).join('')}${F.map(r=>row(r,'<span class="tag">Sin vehículo registrado</span>')).join('')||''}${X.length+P.length+F.length?'':'<p class="muted">Todas las licencias están vigentes.</p>'}</div>`};
 A.sol=sol;D.sol=sol;
}
})();
