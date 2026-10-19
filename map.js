// Mandados Tuxpan · mapa de repartidores y tiendas (dueño/directivo), ubicación y alertas del repartidor
(function(){
const TUX=[21.9447,-105.2964],STALE=5*60e3;
const km=(a,b,c,d)=>{const R=6371,r=x=>x*Math.PI/180,dl=r(c-a),dn=r(d-b),h=Math.sin(dl/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
const gmaps=(lat,lng)=>`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
const ago=t=>{const m=Math.round((Date.now()-t)/6e4);return m<1?'hace un momento':m<60?`hace ${m} min`:`hace ${Math.round(m/60)} h`};
window.MP={drivers:[],alerts:[],my:[],sel:null,set:null};
const isAdm=()=>(role==='admin'||role==='dir')&&BK.ME&&['dueno','directivo'].includes(BK.ME.role);
const isRep=()=>role==='repartidor'&&BK.ME&&BK.ME.role==='repartidor';
let ch=null,tq=null;
async function mapPull(){try{
 if(isAdm()){MP.drivers=await BK.rpc('get_driver_locations');MP.alerts=(await BK.sb.from('driver_alerts').select('*').gte('created_at',new Date(Date.now()-864e5).toISOString()).order('id',{ascending:false}).limit(100)).data||[]}
 if(isRep()){MP.my=(await BK.sb.from('driver_alerts').select('*').in('status',['enviada','vista']).order('id',{ascending:false}).limit(5)).data||[];repAlert()}
 if(view==='mapa'&&!locked()){const a=document.activeElement;if(!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))){const y=scrollY;render();scrollTo(0,y)}}
}catch(e){console.warn('mapa',e)}}
const soon=()=>{clearTimeout(tq);tq=setTimeout(mapPull,400)};
async function ensureCh(){if(ch||!(isAdm()||isRep()))return;ch=BK.sb.channel('mapa-'+Math.random().toString(36).slice(2));
 if(isAdm())ch.on('postgres_changes',{event:'*',schema:'public',table:'driver_locations'},soon);
 ch.on('postgres_changes',{event:'*',schema:'public',table:'driver_alerts'},soon).subscribe()}
const _pull=BK.pull;BK.pull=async()=>{await _pull();if(!BK.ME&&ch){BK.sb.removeChannel(ch);ch=null}await mapPull();ensureCh();if(isRep())geoSync()};
// ---------- repartidor: disponible + ubicación ----------
let watch=null,last=null,geoErr='';
const dispOn=()=>localStorage.getItem('rep_disp')==='1';
function geoSync(){const want=isRep()&&dispOn()&&!locked();if(want&&watch==null&&navigator.geolocation){geoErr='';
  watch=navigator.geolocation.watchPosition(p=>{const c=p.coords,now=Date.now();if(last&&now-last.t<25e3&&km(last.lat,last.lng,c.latitude,c.longitude)<0.05)return;
   last={t:now,lat:c.latitude,lng:c.longitude};BK.rpc('update_my_location',{p_lat:c.latitude,p_lng:c.longitude,p_acc:c.accuracy}).then(()=>{MP.sent=now;repInd()}).catch(e=>{geoErr=e.message;repInd()})},
   e=>{geoErr=e.code===1?'Permiso de ubicación negado. Actívalo en Chrome: candado → Permisos → Ubicación.':'No se pudo obtener tu ubicación';repInd()},{enableHighAccuracy:true,maximumAge:15000,timeout:30000})}
 else if(!want&&watch!=null){navigator.geolocation.clearWatch(watch);watch=null;last=null}}
window.repDisp=async on=>{if(on&&!confirm('Mientras estés Disponible y la app esté abierta, compartiremos tu ubicación solo con el Dueño y el Directivo para avisarte de pedidos cercanos. Los clientes y las tiendas no la ven. ¿Activar?'))return;
 localStorage.setItem('rep_disp',on?'1':'0');if(!on){try{await BK.rpc('stop_sharing_location')}catch(e){}MP.sent=null}geoSync();render()};
function repInd(){const e=document.getElementById('geoind');if(e)e.innerHTML=indTxt()}
const indTxt=()=>geoErr?`<span class="tag bad">⚠️ ${esc(geoErr)}</span>`:MP.sent?`<span class="tag ok">📡 Compartiendo ubicación · ${ago(MP.sent)}</span>`:'<span class="tag ex">📡 Buscando tu ubicación…</span>';
window.repDispCard=()=>{if(!isRep())return '';const on=dispOn();return `<div class="card" id="dispcard"><div class="row"><b>${on?'🟢 Disponible':'⚪ No disponible'}</b><button class="btn ${on?'sec':''} sm" style="margin:0" id="dispbtn" onclick="repDisp(${!on})">${on?'Ponerme No disponible':'Ponerme Disponible'}</button></div>
 <div class="muted" style="margin-top:6px">${on?`<span id="geoind">${indTxt()}</span><br>Tu ubicación solo la ven el Dueño y el Directivo. Se deja de compartir al ponerte No disponible.`:'Ponte Disponible para recibir alertas de pedidos en tiendas cercanas (compartes tu ubicación mientras la app esté abierta).'}</div></div>`};
if(typeof R!=='undefined'){const _h=R.home;R.home=()=>repDispCard()+_h()}
setInterval(()=>{if(isRep())repInd()},30000);
// ---------- repartidor: alerta "pedido en tienda" ----------
let seen=new Set();
function repAlert(){let b=document.getElementById('ralert');const a=(MP.my||[])[0];if(!a||locked()){if(b)b.remove();return}
 if(!seen.has(a.id)){seen.add(a.id);beep();if(a.status==='enviada')BK.rpc('respond_driver_alert',{p_id:a.id,p_status:'vista'}).catch(()=>{})}
 const s=(DB.stores||[]).find(x=>x.id===a.store_id);if(!b){b=document.createElement('div');b.id='ralert';b.className='tnew ralert';document.body.appendChild(b)}
 b.innerHTML=`<div><b>🔔 Pedido en tienda</b>${a.order_id?' · #'+a.order_id:''}<div>🏪 ${esc(s?s.n:'Tienda')}${s&&s.col?' · '+esc(s.col):''}</div>${a.message?`<div class="muted" style="color:inherit">${esc(a.message)}</div>`:''}${s&&s.lat!=null?`<a href="${gmaps(s.lat,s.lng)}" target="_blank" rel="noopener" style="color:inherit">🧭 Abrir en Google Maps</a>`:''}</div>
 <div class="row" style="gap:6px"><button class="btn sm" style="margin:0" id="raok" onclick="repAlertDo(${a.id},'aceptada')">✅ Aceptar</button><button class="btn sec sm" style="margin:0" id="rano" onclick="repAlertDo(${a.id},'rechazada')">Rechazar</button></div>`}
window.repAlertDo=async(id,st)=>{try{await BK.rpc('respond_driver_alert',{p_id:id,p_status:st});toast(st==='aceptada'?'Pedido aceptado':'Alerta rechazada')}catch(e){toast(e.message)}MP.my=(MP.my||[]).filter(x=>x.id!==id);repAlert();BK.pull()};
// ---------- dueño / directivo: mapa ----------
let LL=null,map=null,lay=null,div=null;
const loadL=()=>LL||(LL=new Promise((ok,ko)=>{const c=document.createElement('link');c.rel='stylesheet';c.href=APP_BASE+'vendor/leaflet/leaflet.css';document.head.appendChild(c);
 const s=document.createElement('script');s.src=APP_BASE+'vendor/leaflet/leaflet.js';s.onload=ok;s.onerror=ko;document.head.appendChild(s)}));
const waitingOf=sid=>(DB.orders||[]).filter(o=>o.det&&o.det.storeId===sid&&!o.cancel&&!done(o)&&!o.compra);
const fresh=d=>Date.now()-d.t<STALE;
function mapView(){const S=(DB.stores||[]),sel=S.find(s=>s.id===MP.sel),W=S.filter(s=>waitingOf(s.id).length),noLoc=S.filter(s=>s.lat==null);
 let h=`<button class="btn sec sm" style="margin:0 0 8px" onclick="MP.sel=null;MP.set=null;go('vivo')">← Seguimiento</button><h2>🗺️ Mapa</h2>
 ${MP.set?`<div class="warn" id="setbanner">📍 Toca el mapa donde está <b>${esc((S.find(s=>s.id===MP.set)||{}).n||'')}</b>. <button class="btn sec sm" style="margin:4px 0 0" onclick="MP.set=null;render()">Cancelar</button></div>`:''}
 <div id="mapslot" class="mapslot"></div><div class="muted mapleg">🟢 Repartidor disponible · ⚪ Sin señal reciente (más de 5 min) · 🏪 Tienda (pedidos por recoger) · 🔵 Domicilio de pedido activo</div>`;
 if(sel){const w=waitingOf(sel.id),free=w.filter(o=>!o.rep),D=(MP.drivers||[]).map(d=>({...d,dist:sel.lat!=null?km(sel.lat,sel.lng,d.lat,d.lng):null})).sort((a,b)=>(a.dist??1e9)-(b.dist??1e9));
  const al=(MP.alerts||[]).filter(a=>a.store_id===sel.id).slice(0,8),dn=id=>(MP.drivers.find(d=>d.id===id)||{}).nombre||'Repartidor';
  h+=`<div class="card" id="selstore"><div class="row"><b>🏪 ${esc(sel.n)}</b><button class="btn sec sm" style="margin:0" onclick="MP.sel=null;render()">✕</button></div><div class="muted">📍 ${esc(sel.col||'')} · ${w.length} pedido${w.length===1?'':'s'} por recoger${free.length?` (${free.length} sin repartidor)`:''}</div>
  <div class="row" style="gap:6px;flex-wrap:wrap">${sel.lat!=null?`<a class="btn sec sm" href="${gmaps(sel.lat,sel.lng)}" target="_blank" rel="noopener">🧭 Abrir en Google Maps</a>`:''}<button class="btn sec sm" onclick="MP.set=${sel.id};render()">📍 ${sel.lat!=null?'Cambiar':'Fijar'} ubicación en el mapa</button><button class="btn sec sm" onclick="mapHere(${sel.id})">📡 Usar mi ubicación actual</button></div>
  <h3>Repartidores cercanos</h3>${sel.lat==null?'<p class="muted">Fija la ubicación de la tienda para ordenar por distancia.</p>':''}
  ${D.map(d=>`<div class="line drv" data-drv="${d.id}"><div class="row"><b>${fresh(d)?'🟢':'⚪'} ${esc(d.nombre)}</b><span>${d.dist!=null?d.dist.toFixed(1)+' km':''}</span></div><div class="muted">${fresh(d)?'Actualizado '+ago(d.t):'Sin señal reciente · '+ago(d.t)}${d.activos?` · ${d.activos} pedido${d.activos===1?'':'s'} en curso`:''}</div>
   <button class="btn sm" id="alert-${d.id}" onclick="mapAlert('${d.id}',${sel.id},${free[0]?free[0].id:'null'})">🔔 Enviar alerta: pedido en tienda${free[0]?' #'+free[0].id:''}</button></div>`).join('')||'<p class="muted">No hay repartidores disponibles compartiendo ubicación.</p>'}
  ${al.length?`<h3>Alertas enviadas</h3>${al.map(a=>`<div class="line"><div class="row"><span>${esc(dn(a.driver_id))}${a.order_id?' · #'+a.order_id:''}</span><span class="tag ${a.status==='aceptada'?'ok':a.status==='rechazada'?'bad':'ex'}">${({enviada:'Enviada',vista:'Vista',aceptada:'Aceptada',rechazada:'Rechazada'})[a.status]}</span></div><div class="muted">${fdt(a.created_at)}${a.note?' · '+esc(a.note):''}</div></div>`).join('')}`:''}</div>`}
 else{h+=`<h3>Tiendas con pedidos por recoger</h3>${W.map(s=>`<div class="card store row" onclick="MP.sel=${s.id};render()"><span>🏪 <b>${esc(s.n)}</b>${s.lat==null?' <span class="tag bad">Sin ubicación</span>':''}</span><span class="tag ok">${waitingOf(s.id).length} por recoger</span></div>`).join('')||'<p class="muted">Ninguna tienda tiene pedidos esperando.</p>'}
  <h3>Repartidores disponibles (${(MP.drivers||[]).length})</h3>${(MP.drivers||[]).map(d=>`<div class="line"><b>${fresh(d)?'🟢':'⚪'} ${esc(d.nombre)}</b> <span class="muted">${fresh(d)?ago(d.t):'sin señal reciente · '+ago(d.t)}</span></div>`).join('')||'<p class="muted">Nadie está Disponible ahora.</p>'}
  ${noLoc.length?`<h3>Tiendas sin ubicación (${noLoc.length})</h3>${noLoc.map(s=>`<div class="line row"><span>${esc(s.n)}</span><button class="btn sec sm" style="margin:0" onclick="MP.sel=${s.id};MP.set=${s.id};render()">📍 Fijar</button></div>`).join('')}`:''}`}
 return h}
function draw(){if(!map)return;lay.clearLayers();const pts=[];
 (DB.stores||[]).filter(s=>s.lat!=null).forEach(s=>{const n=waitingOf(s.id).length;const m=L.marker([s.lat,s.lng],{opacity:n||s.id===MP.sel?1:.55}).addTo(lay).bindTooltip(`🏪 ${s.n}${n?' ('+n+')':''}`,{permanent:!!n||s.id===MP.sel,direction:'top',offset:[0,-30]});m.on('click',()=>{MP.sel=s.id;render()});if(n)pts.push([s.lat,s.lng])});
 (MP.drivers||[]).forEach(d=>{L.circleMarker([d.lat,d.lng],{radius:9,color:'#fff',weight:2,fillColor:fresh(d)?'#16a34a':'#9ca3af',fillOpacity:1}).addTo(lay).bindTooltip(`🛵 ${d.nombre} · ${fresh(d)?ago(d.t):'sin señal reciente'}`,{permanent:true,direction:'right',offset:[10,0]});pts.push([d.lat,d.lng])});
 (DB.orders||[]).filter(o=>o.dlat!=null&&!o.cancel&&!done(o)).forEach(o=>{L.circleMarker([o.dlat,o.dlng],{radius:8,color:'#fff',weight:2,fillColor:'#2563eb',fillOpacity:1}).addTo(lay).bindTooltip(`🏠 #${o.id}${o.rep?' · '+o.rep:''}`,{direction:'top'})});
 const s=(DB.stores||[]).find(x=>x.id===MP.sel);if(s&&s.lat!=null&&!map._mtSel){map.setView([s.lat,s.lng],15);map._mtSel=MP.sel}else if(!map._mtFit&&pts.length){map.fitBounds(pts,{padding:[30,30],maxZoom:15});map._mtFit=1}}
async function attach(){const slot=document.getElementById('mapslot');if(!slot)return;await loadL();if(!document.getElementById('mapslot'))return;
 if(!div){div=document.createElement('div');div.style.cssText='width:100%;height:100%';}
 document.getElementById('mapslot').appendChild(div);
 if(!map){map=L.map(div).setView(TUX,14);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);lay=L.layerGroup().addTo(map);
  map.on('click',e=>{if(MP.set)setLoc(MP.set,e.latlng.lat,e.latlng.lng)})}
 if(map._mtSel!==MP.sel)map._mtSel=undefined;setTimeout(()=>{map.invalidateSize();draw()},30)}
async function setLoc(sid,lat,lng){try{await BK.rpc('set_store_location',{p_store:sid,p_lat:lat,p_lng:lng});MP.set=null;map._mtSel=undefined;toast('Ubicación de la tienda guardada');await BK.pull()}catch(e){toast(e.message)}}
window.mapHere=sid=>{if(!navigator.geolocation)return toast('Este celular no permite ubicación');navigator.geolocation.getCurrentPosition(p=>setLoc(sid,p.coords.latitude,p.coords.longitude),()=>toast('No se pudo obtener tu ubicación'),{enableHighAccuracy:true,timeout:20000})};
window.mapAlert=async(did,sid,oid)=>{const s=(DB.stores||[]).find(x=>x.id===sid);try{await BK.rpc('send_driver_alert',{p_driver:did,p_store:sid,p_order:oid,p_msg:'Pedido en tienda: '+(s?s.n:'')+(oid?' · pedido #'+oid:'')});toast('Alerta enviada');mapPull()}catch(e){toast(e.message)}};
if(typeof A!=='undefined'){A.mapa=mapView;D.mapa=mapView}
const _ar=afterR;afterR=function(){_ar();if(view==='mapa'&&(role==='admin'||role==='dir'))attach();if(role==='repartidor')repAlert()};
window.MAPDBG={mapPull,km};
})();
