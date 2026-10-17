// Mandados Tuxpan - prototipo demo (localStorage, sin servidor)
const WA='523190000000'; // EJEMPLO: cambiar por el WhatsApp real del negocio
const ST=['Recibido','En camino a la tienda','Comprando','En camino','Entregado'];
const STP=['Recibido','Recolectando','En camino','Entregado']; // paquetes
const CATS={abarrotes:['🛒','Abarrotes'],farmacia:['💊','Farmacia'],paquetes:['📦','Paquetes chicos'],servicios:['🧾','Pago de servicios']};
const $=s=>document.querySelector(s), mx=n=>'$'+Number(n||0).toFixed(2)+' MXN';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today=()=>new Date().toISOString().slice(0,10);
function seed(){const t=Date.now();return{
 cfg:{zonas:[{n:'Centro',f:30},{n:'Colonias cercanas',f:40},{n:'Orillas / Ejidos',f:60}],comServ:15},
 reps:['Juan (ejemplo)','Lupita (ejemplo)'],
 orders:[
 {id:1001,ej:1,cat:'abarrotes',det:{lista:'2 kg tortillas\n1 L leche\nHuevo (12)',tienda:'Abarrotes Doña Mary'},dir:'Calle Morelos 120, Centro',tel:'3191234567',zona:0,fee:30,pago:'efectivo',pagaCon:500,st:1,rep:'Juan (ejemplo)',cobrado:0,t:t-3600e3,d:today()},
 {id:1002,ej:1,cat:'farmacia',det:{lista:'Paracetamol 500mg'},dir:'Av. Juárez 45, Col. Centro',tel:'3197654321',zona:0,fee:30,pago:'tarjeta',st:4,rep:'Lupita (ejemplo)',cobrado:0,t:t-7200e3,d:today()},
 {id:1003,ej:1,cat:'servicios',det:{tipo:'CFE (luz)',ref:'123456789012',monto:450},dir:'Calle Hidalgo 8, Col. Lázaro Cárdenas',tel:'3195551122',zona:1,fee:55,pago:'efectivo',pagaCon:600,st:0,rep:'',cobrado:0,t:t-600e3,d:today()}],
 mine:[1001,1002,1003]}}
let DB=JSON.parse(localStorage.getItem('mandados')||'null')||seed();
const save=()=>localStorage.setItem('mandados',JSON.stringify(DB));save();
let role=localStorage.getItem('rol')||'cliente', view='home', sel=null, track=null, myRep=DB.reps[0];
const toast=m=>{const e=$('#toast');e.textContent=m;e.style.display='block';clearTimeout(e._t);e._t=setTimeout(()=>e.style.display='none',2200)};
const steps=o=>o.cat==='paquetes'?STP:ST;
const stName=o=>{const s=steps(o);return s[Math.min(o.st,s.length-1)]};
const done=o=>o.st>=steps(o).length-1;
const tag=o=>`${o.ej?'<span class="tag ex">EJEMPLO</span> ':''}<span class="tag ${done(o)?'ok':''}">${stName(o)}</span>`;
function summary(o){const d=o.det;return o.cat==='paquetes'?`De: ${esc(d.de)} → A: ${esc(d.a)} (${esc(d.tam)})`:o.cat==='servicios'?`${esc(d.tipo)} · Ref ${esc(d.ref)} · ${mx(d.monto)}`:esc(d.lista).replace(/\n/g,', ')+(d.tienda?` · ${esc(d.tienda)}`:'')+(d.receta?' · 📷 receta':'')}
const total=o=>o.fee+(o.cat==='servicios'?Number(o.det.monto||0):0);
const card=(o,extra='')=>`<div class="card"><div class="row"><b>${CATS[o.cat][0]} #${o.id} ${CATS[o.cat][1]}</b>${tag(o)}</div>
<div class="muted">${summary(o)}</div><div class="muted">📍 ${esc(o.dir)} · 📞 ${esc(o.tel)}</div>
<div class="row"><span class="muted">${o.pago==='tarjeta'?'💳 Tarjeta (demo)':'💵 Efectivo'+(o.pagaCon?` · paga con ${mx(o.pagaCon)}`:'')}${o.rep?' · 🛵 '+esc(o.rep):''}</span><b>Envío ${mx(o.fee)}</b></div>${extra}</div>`;

function tabs(){const T={cliente:[['home','🏠','Inicio'],['nuevo','➕','Pedir'],['hist','📋','Mis pedidos']],repartidor:[['home','📦','Pedidos']],admin:[['home','📊','Resumen'],['todos','📋','Pedidos'],['cfg','⚙️','Tarifas']]}[role];
 $('#tabs').innerHTML=T.map(([v,i,l])=>`<button class="${view===v?'on':''}" onclick="go('${v}')"><b>${i}</b>${l}</button>`).join('')}
function go(v){view=v;render();scrollTo(0,0)}
function render(){$('#role').value=role;tabs();$('#app').innerHTML=({cliente:C,repartidor:R,admin:A}[role][view]||(()=>''))()}

const C={
 home:()=>{const act=DB.orders.filter(o=>DB.mine.includes(o.id)&&!done(o));return `<h2>¡Hola! ¿Qué mandado necesitas hoy?</h2>
 <div class="grid">${Object.entries(CATS).map(([k,[i,n]])=>`<div class="cat" onclick="sel='${k}';go('nuevo')"><span>${i}</span>${n}</div>`).join('')}</div>
 <h3 style="margin-top:16px">Pedidos activos</h3>${act.map(o=>card(o,`<button class="btn sm" onclick="track=${o.id};go('track')">Ver seguimiento</button>`)).join('')||'<p class="muted">No tienes pedidos activos.</p>'}
 <a class="btn wa" style="text-align:center;text-decoration:none" href="https://wa.me/${WA}?text=${encodeURIComponent('Hola, quiero hacer un mandado')}" target="_blank">💬 Escríbenos por WhatsApp</a>`},
 nuevo:()=>{const c=sel||'abarrotes',z=DB.cfg.zonas;let f='';
  if(c==='abarrotes')f=`<label>Lista de compras</label><textarea id="lista" placeholder="Ej: 1 kg frijol, 2 refrescos..."></textarea><label>Tienda (opcional)</label><input id="tienda" placeholder="Ej: Oxxo, abarrotes de la esquina">`;
  if(c==='farmacia')f=`<label>Medicamentos / productos</label><textarea id="lista" placeholder="Ej: Paracetamol 500 mg"></textarea><label>Foto de receta (opcional)</label><input id="receta" type="file" accept="image/*" capture="environment">`;
  if(c==='paquetes')f=`<label>Dirección de recolección</label><input id="de"><label>Dirección de entrega del paquete</label><input id="a"><label>Tamaño</label><select class="f" id="tam"><option>Chico (sobre/caja de zapatos)</option><option>Mediano (mochila)</option></select>`;
  if(c==='servicios')f=`<label>Servicio</label><select class="f" id="tipo"><option>CFE (luz)</option><option>Agua (OROMAPAS)</option><option>Teléfono / Internet</option><option>Gas</option><option>Otro</option></select><label>Número de referencia / servicio</label><input id="ref" inputmode="numeric"><label>Monto a pagar (MXN)</label><input id="monto" type="number" inputmode="decimal" oninput="calc()"><div class="muted">Se suma la comisión por pago de ${mx(DB.cfg.comServ)}.</div>`;
  return `<h2>Nuevo pedido</h2><div class="grid" style="grid-template-columns:repeat(4,1fr)">${Object.entries(CATS).map(([k,[i,n]])=>`<div class="cat ${k===c?'sel':''}" style="padding:8px 2px;font-size:11px" onclick="sel='${k}';render()"><span style="font-size:24px">${i}</span>${n}</div>`).join('')}</div>
  <div class="card">${f}</div><div class="card"><h3>Entrega</h3><label>Dirección de entrega</label><input id="dir" placeholder="Calle, número, colonia, referencias"><label>Teléfono</label><input id="tel" type="tel" inputmode="tel" placeholder="10 dígitos">
  <label>Zona</label><select class="f" id="zona" onchange="calc()">${z.map((x,i)=>`<option value="${i}">${esc(x.n)} – ${mx(x.f)}</option>`).join('')}</select></div>
  <div class="card"><h3>Forma de pago</h3><div class="pay"><label><input type="radio" name="pago" value="efectivo" checked onchange="calc()">💵 Efectivo contra entrega</label><label><input type="radio" name="pago" value="tarjeta" onchange="calc()">💳 Tarjeta de débito</label></div><div id="payx"></div></div>
  <div class="card"><div class="row"><span>Envío estimado</span><b id="fee"></b></div><div class="row"><span>Total estimado*</span><span class="total" id="tot"></span></div><div class="muted">*El costo de los productos se cobra según el ticket de la tienda.</div></div>
  <button class="btn" onclick="crear()">Confirmar pedido</button>`},
 track:()=>{const o=DB.orders.find(x=>x.id===track);if(!o)return'';const s=steps(o);return `<h2>Seguimiento #${o.id}</h2>${card(o)}
  <div class="card"><ul class="steps">${s.map((n,i)=>`<li class="${i<=o.st?'done':''} ${i===o.st?'cur':''}">${n}</li>`).join('')}</ul></div>
  <a class="btn wa" style="text-align:center;text-decoration:none" href="https://wa.me/${WA}?text=${encodeURIComponent('Hola, pregunto por mi pedido #'+o.id)}" target="_blank">💬 Preguntar por WhatsApp</a><button class="btn sec" onclick="go('hist')">Volver</button>`},
 hist:()=>`<h2>Mis pedidos</h2>`+DB.orders.filter(o=>DB.mine.includes(o.id)).sort((a,b)=>b.t-a.t).map(o=>card(o,`<button class="btn sm" onclick="track=${o.id};go('track')">Ver seguimiento</button>`)).join('')
};
function feeNow(){const z=DB.cfg.zonas[+($('#zona')?.value||0)];return z.f+((sel||'abarrotes')==='servicios'?DB.cfg.comServ:0)}
function calc(){if(!$('#fee'))return;const f=feeNow(),m=(sel==='servicios')?Number($('#monto')?.value||0):0,p=document.querySelector('[name=pago]:checked').value;
 $('#fee').textContent=mx(f);$('#tot').textContent=mx(f+m);
 const px=$('#payx');if(px.dataset.p!==p){px.dataset.p=p;px.innerHTML=p==='efectivo'?`<label>¿Con cuánto pagará? (para llevar cambio)</label><input id="pagaCon" type="number" inputmode="decimal" placeholder="Ej: 500">`:
 `<div class="warn">⚠️ DEMO: no se hace ningún cargo real. No escribas datos reales de tarjeta.</div><label>Número de tarjeta</label><input placeholder="4242 4242 4242 4242" autocomplete="off"><div class="grid"><input placeholder="MM/AA"><input placeholder="CVV"></div>`}}
function crear(){const c=sel||'abarrotes',v=id=>($('#'+id)?.value||'').trim();let det={};
 if(c==='abarrotes')det={lista:v('lista'),tienda:v('tienda')};
 if(c==='farmacia')det={lista:v('lista'),receta:!!$('#receta').files.length};
 if(c==='paquetes')det={de:v('de'),a:v('a'),tam:v('tam')};
 if(c==='servicios')det={tipo:v('tipo'),ref:v('ref'),monto:+v('monto')};
 const miss=(c==='paquetes'?!det.de||!det.a:c==='servicios'?!det.ref||!det.monto:!det.lista);
 if(miss||!v('dir')||v('tel').replace(/\D/g,'').length<10)return toast('Completa los datos del pedido, dirección y teléfono (10 dígitos)');
 const pago=document.querySelector('[name=pago]:checked').value;
 const o={id:Math.max(...DB.orders.map(x=>x.id),1000)+1,cat:c,det,dir:v('dir'),tel:v('tel'),zona:+v('zona'),fee:feeNow(),pago,pagaCon:pago==='efectivo'?+v('pagaCon')||0:0,st:0,rep:'',cobrado:0,t:Date.now(),d:today()};
 DB.orders.push(o);DB.mine.push(o.id);save();track=o.id;toast(pago==='tarjeta'?'Pedido enviado (pago demo, sin cargo)':'¡Pedido enviado!');go('track')}

const R={home:()=>{const mine=DB.orders.filter(o=>o.rep===myRep&&!done(o)),av=DB.orders.filter(o=>!o.rep&&!done(o)),fin=DB.orders.filter(o=>o.rep===myRep&&done(o)&&o.d===today());
 const cash=fin.filter(o=>o.pago==='efectivo'&&o.cobrado).reduce((a,o)=>a+total(o),0);
 return `<div class="card"><label style="margin-top:0">Soy:</label><select class="f" onchange="myRep=this.value;render()">${DB.reps.map(r=>`<option ${r===myRep?'selected':''}>${esc(r)}</option>`).join('')}</select><div class="muted" style="margin-top:6px">Entregados hoy: ${fin.length} · Efectivo cobrado (envío+servicios): ${mx(cash)}</div></div>
 <h3>Mis pedidos asignados</h3>${mine.map(o=>card(o,`<div class="muted">Estado actual: <b>${stName(o)}</b></div><button class="btn sm" onclick="adv(${o.id})">➡️ Pasar a “${steps(o)[o.st+1]}”</button>`)).join('')||'<p class="muted">Sin pedidos asignados.</p>'}
 <h3>Disponibles</h3>${av.map(o=>card(o,`<button class="btn sm" onclick="tomar(${o.id})">✅ Aceptar pedido</button>`)).join('')||'<p class="muted">No hay pedidos disponibles.</p>'}
 <h3>Entregados hoy</h3>${fin.map(o=>card(o,o.pago==='efectivo'?(o.cobrado?'<span class="tag ok">💵 Efectivo cobrado</span>':`<button class="btn sm" onclick="cobrar(${o.id})">💵 Marcar efectivo cobrado</button>`):'<span class="tag">💳 Pagado con tarjeta (demo)</span>')).join('')||'<p class="muted">Aún nada.</p>'}`}};
const O=id=>DB.orders.find(o=>o.id===id);
function tomar(id){O(id).rep=myRep;save();toast('Pedido aceptado');render()}
function adv(id){const o=O(id);o.st=Math.min(o.st+1,steps(o).length-1);save();toast('Estado: '+stName(o));render()}
function cobrar(id){O(id).cobrado=1;save();toast('Efectivo registrado');render()}

const A={
 home:()=>{const h=DB.orders.filter(o=>o.d===today()),sum=a=>a.reduce((s,o)=>s+o.fee,0),ef=h.filter(o=>o.pago==='efectivo'),tj=h.filter(o=>o.pago==='tarjeta');
 return `<h2>Resumen de hoy</h2><div class="grid"><div class="card stat"><b>${h.length}</b>Pedidos</div><div class="card stat"><b>${h.filter(done).length}</b>Entregados</div>
 <div class="card stat"><b>${mx(sum(h))}</b>Total envíos</div><div class="card stat"><b>${h.filter(o=>!o.rep).length}</b>Sin asignar</div>
 <div class="card stat"><b>${mx(sum(ef))}</b>💵 Efectivo (${ef.length})</div><div class="card stat"><b>${mx(sum(tj))}</b>💳 Tarjeta (${tj.length})</div></div>
 <div class="card"><h3>Por repartidor</h3>${DB.reps.map(r=>{const x=h.filter(o=>o.rep===r);return `<div class="row"><span>${esc(r)}</span><span>${x.length} pedidos · ${mx(sum(x))}</span></div>`}).join('')}</div>
 <button class="btn sec" onclick="if(confirm('¿Borrar todo y volver a los datos de ejemplo?')){DB=seed();save();render()}">Reiniciar datos de ejemplo</button>`},
 todos:()=>`<h2>Todos los pedidos</h2>`+DB.orders.slice().sort((a,b)=>b.t-a.t).map(o=>card(o,`<label>Asignar repartidor</label><select class="f" onchange="O(${o.id}).rep=this.value;save();toast('Asignado');render()"><option value="">— Sin asignar —</option>${DB.reps.map(r=>`<option ${r===o.rep?'selected':''}>${esc(r)}</option>`).join('')}</select>`)).join(''),
 cfg:()=>`<h2>Tarifas y zonas</h2><div class="card"><h3>Envío por zona (MXN)</h3>${DB.cfg.zonas.map((z,i)=>`<div class="grid" style="grid-template-columns:2fr 1fr auto;margin-bottom:8px"><input value="${esc(z.n)}" onchange="DB.cfg.zonas[${i}].n=this.value;save()"><input type="number" value="${z.f}" onchange="DB.cfg.zonas[${i}].f=+this.value;save()"><button class="btn sec sm" style="margin:0" onclick="DB.cfg.zonas.length>1&&DB.cfg.zonas.splice(${i},1);save();render()">🗑️</button></div>`).join('')}
 <button class="btn sec sm" onclick="DB.cfg.zonas.push({n:'Nueva zona',f:50});save();render()">➕ Agregar zona</button>
 <label>Comisión extra por pago de servicios</label><input type="number" value="${DB.cfg.comServ}" onchange="DB.cfg.comServ=+this.value;save()"><div class="muted">Valores de ejemplo, ajústalos a tus precios. Se guardan al salir del campo.</div></div>
 <div class="card"><h3>Repartidores</h3>${DB.reps.map(r=>`<div class="row"><span>${esc(r)}</span></div>`).join('')}<input id="nrep" placeholder="Nombre" style="margin-top:8px"><button class="btn sec sm" onclick="const n=$('#nrep').value.trim();if(n){DB.reps.push(n);save();render()}">➕ Agregar repartidor</button></div>`
};
$('#role').onchange=e=>{role=e.target.value;localStorage.setItem('rol',role);view='home';render()};
const _r=render;render=function(){_r();calc()};render();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
