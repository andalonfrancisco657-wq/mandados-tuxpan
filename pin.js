// v25: el cliente marca su casa en el mapa; el repartidor asignado la ve; el dueño ve los pines activos.
(function(){
const TUX=[21.9447,-105.2964],FAR_KM=8;
let LL=null;const loadL=()=>window.L?Promise.resolve():LL||(LL=new Promise((ok,ko)=>{const c=document.createElement('link');c.rel='stylesheet';c.href=APP_BASE+'vendor/leaflet/leaflet.css';document.head.appendChild(c);
 const s=document.createElement('script');s.src=APP_BASE+'vendor/leaflet/leaflet.js';s.onload=ok;s.onerror=e=>{LL=null;ko(e)};document.head.appendChild(s)}));
const km=(a,b,c,d)=>{const r=x=>x*Math.PI/180,R=6371,dl=r(c-a),dn=r(d-b),h=Math.sin(dl/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
const gm=(a,b)=>`https://www.google.com/maps/dir/?api=1&destination=${(+a).toFixed(6)},${(+b).toFixed(6)}`;
window.PIN={lat:null,lng:null,set:false,fail:false,dir:null};
function pinInit(){if(PIN.dir!=null)return;const a=typeof acct==='function'&&acct();const d=a&&a.dirs&&a.dirs[0];if(d&&d.lat!=null){PIN.lat=d.lat;PIN.lng=d.lng;PIN.set=true}PIN.dir=0}
window.pinFromDir=(d,i)=>{PIN.dir=i;if(d&&d.lat!=null){PIN.lat=d.lat;PIN.lng=d.lng;PIN.set=true}else{PIN.set=false}pinSync()};
const far=()=>PIN.set&&km(TUX[0],TUX[1],PIN.lat,PIN.lng)>FAR_KM;
const stTxt=()=>PIN.fail?'<span class="tag bad">Sin ubicación</span> El mapa no está disponible: puedes pedir igual, el repartidor se guiará por la dirección y las señas.':PIN.set?`✅ Ubicación marcada${far()?' · <b class="bad">⚠️ Está lejos de Tuxpan (más de '+FAR_KM+' km): revisa que sea tu casa; puede estar fuera de la zona de servicio.</b>':''}`:'👆 <b>Toca el mapa o arrastra el pin</b> hasta tu casa, o usa tu ubicación actual.';
window.pinBox=()=>{pinInit();return `<div id="pinwrap"><label>📍 Ubicación de tu casa en el mapa (obligatoria)</label><div id="pinslot" class="mapslot pinslot"></div><div class="muted" id="pinst">${stTxt()}</div>
 <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sec sm" style="margin:0" id="pinhere" type="button" onclick="pinHere()">📍 Usar mi ubicación actual</button>${PIN.fail?'':`<button class="btn sec sm" style="margin:0" id="pinno" type="button" onclick="pinNo()">No puedo usar el mapa</button>`}</div></div>`};
let map=null,mk=null,div=null;
function pinSync(){const e=document.getElementById('pinst');if(e)e.innerHTML=stTxt();if(map&&mk){if(PIN.set){mk.setLatLng([PIN.lat,PIN.lng]);mk.setOpacity(1)}else mk.setOpacity(.5)}}
function place(lat,lng,zoom){PIN.lat=+lat.toFixed(6);PIN.lng=+lng.toFixed(6);PIN.set=true;PIN.fail=false;if(map){mk.setLatLng([PIN.lat,PIN.lng]);if(zoom)map.setView([PIN.lat,PIN.lng],17)}pinSync()}
window.pinHere=()=>{if(!navigator.geolocation)return toast('Tu celular no permite ubicación: arrastra el pin');toast('Buscando tu ubicación…');
 navigator.geolocation.getCurrentPosition(p=>{place(p.coords.latitude,p.coords.longitude,1);toast('Listo. Revisa que el pin esté en tu casa')},()=>toast('No se pudo obtener tu ubicación: arrastra el pin hasta tu casa'),{enableHighAccuracy:true,timeout:10000,maximumAge:30000})};
window.pinNo=()=>{if(!confirm('¿Pedir sin marcar tu casa en el mapa? El repartidor se guiará solo por la dirección y las señas.'))return;PIN.fail=true;PIN.set=false;render()};
async function attach(){const slot=document.getElementById('pinslot');if(!slot)return;try{await loadL()}catch(e){PIN.fail=true;slot.style.display='none';pinSync();const b=document.getElementById('pinno');if(b)b.remove();return}
 const s2=document.getElementById('pinslot');if(!s2)return;if(!div){div=document.createElement('div');div.style.cssText='width:100%;height:100%'}s2.appendChild(div);
 if(!map){map=L.map(div).setView(PIN.set?[PIN.lat,PIN.lng]:TUX,PIN.set?17:14);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
  mk=L.marker(PIN.set?[PIN.lat,PIN.lng]:TUX,{draggable:true,opacity:PIN.set?1:.5}).addTo(map);mk.on('dragend',()=>{const p=mk.getLatLng();place(p.lat,p.lng)});map.on('click',e=>place(e.latlng.lat,e.latlng.lng))}
 else if(PIN.set)map.setView([PIN.lat,PIN.lng],Math.max(map.getZoom(),16));setTimeout(()=>map.invalidateSize(),30);pinSync()}
window.pinGate=()=>{if(!document.getElementById('pinwrap'))return true;if(PIN.set||PIN.fail)return true;toast('Marca tu casa en el mapa (o toca “No puedo usar el mapa”)');document.getElementById('pinwrap').scrollIntoView({behavior:'smooth',block:'center'});return false};
window.pinPut=o=>{if(!document.getElementById('pinwrap'))return;if(PIN.set){o.lat=PIN.lat;o.lng=PIN.lng;
  try{const a=acct();if(a){const A=accts(),x=A[a.email],i=+(document.getElementById('dsel')?.value??PIN.dir??0);if(x&&x.dirs&&x.dirs[i]&&(x.dirs[i].lat!==PIN.lat||x.dirs[i].lng!==PIN.lng)){x.dirs[i].lat=PIN.lat;x.dirs[i].lng=PIN.lng;saveAccts(A)}}}catch(e){}}
 else o.sinUbic=1};
// repartidor asignado: mapa pequeño del domicilio
let rmap=null,rdiv=null,rmk=null;
window.repPinBox=o=>{if(!o||o.dlat==null)return o&&o.sinUbic&&o.rep?'<div class="muted">📍 El cliente no marcó su casa en el mapa: guíate por la dirección y las señas.</div>':'';
 return `<div class="card" id="rpin"><b>📍 Domicilio del cliente</b><div id="rpinslot" class="mapslot rpinslot" data-lat="${o.dlat}" data-lng="${o.dlng}"></div><a class="btn sec sm" id="rpingm" href="${gm(o.dlat,o.dlng)}" target="_blank" rel="noopener">🧭 Abrir en Google Maps</a></div>`};
async function rattach(){const s=document.getElementById('rpinslot');if(!s)return;try{await loadL()}catch(e){s.style.display='none';return}const s2=document.getElementById('rpinslot');if(!s2)return;const ll=[+s2.dataset.lat,+s2.dataset.lng];
 if(!rdiv){rdiv=document.createElement('div');rdiv.style.cssText='width:100%;height:100%'}s2.appendChild(rdiv);
 if(!rmap){rmap=L.map(rdiv).setView(ll,16);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(rmap);rmk=L.marker(ll).addTo(rmap).bindTooltip('🏠 Cliente',{permanent:true,direction:'top',offset:[0,-30]})}
 else{rmk.setLatLng(ll);rmap.setView(ll,rmap.getZoom())}setTimeout(()=>rmap.invalidateSize(),30)}
if(typeof advBtn==='function'&&window.APP_ROLE==='repartidor'){const _b=advBtn;advBtn=function(o,inP){const h=_b(o,inP);if(inP)return repPinBox(o)+h;return (o.dlat!=null?`<a class="btn sec sm" href="${gm(o.dlat,o.dlng)}" target="_blank" rel="noopener">🧭 Domicilio en Google Maps</a>`:'')+h}}
const _ar=afterR;afterR=function(){_ar();try{attach();rattach()}catch(e){}};
window.PINDBG={km,gm};
})();
