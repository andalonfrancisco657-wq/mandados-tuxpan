// Mandados Tuxpan - prototipo demo (localStorage, sin servidor)
const WA='523190000000'; // EJEMPLO: cambiar por el WhatsApp real del negocio
const ST=['Recibido','En camino a la tienda','Comprando','En camino','Entregado'];
const STP=['Recibido','Recolectando','En camino','Entregado']; // paquetes
const CATS={abarrotes:['🛒','Abarrotes'],farmacia:['💊','Farmacia'],paquetes:['📦','Paquetes chicos'],servicios:['🧾','Pago de servicios']};
const $=s=>document.querySelector(s), mx=n=>'$'+Number(n||0).toFixed(2)+' MXN';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today=()=>new Date().toISOString().slice(0,10);

const SV=2; // versión de datos
const mkP=(arr)=>arr.map((x,i)=>({id:i+1,n:x[0],pres:x[1],p:x[2],sec:x[3],e:x[4],disp:1}));
const AB=[['Tortillas de maíz','1 kg',24,'Básicos','🫓'],['Frijol negro','1 kg',38,'Básicos','🫘'],['Arroz','1 kg',32,'Básicos','🍚'],['Azúcar estándar','1 kg',34,'Básicos','🍬'],['Aceite vegetal','900 ml',42,'Básicos','🫗'],['Huevo blanco','12 pzas',48,'Básicos','🥚'],['Sal de mesa','1 kg',14,'Básicos','🧂'],['Pasta para sopa','200 g',12,'Básicos','🍝'],['Leche entera','1 L',29,'Lácteos','🥛'],['Queso fresco','400 g',62,'Lácteos','🧀'],['Crema','450 ml',39,'Lácteos','🥣'],['Pan de caja blanco','680 g',52,'Panadería','🍞'],['Refresco de cola','2 L',38,'Bebidas','🥤'],['Agua purificada','garrafón 20 L',40,'Bebidas','💧'],['Café soluble','120 g',68,'Bebidas','☕'],['Jitomate','1 kg',30,'Frutas y verduras','🍅'],['Cebolla blanca','1 kg',26,'Frutas y verduras','🧅'],['Plátano','1 kg',22,'Frutas y verduras','🍌'],['Limón','1 kg',35,'Frutas y verduras','🍋'],['Papel higiénico','4 rollos',36,'Limpieza','🧻'],['Detergente en polvo','1 kg',45,'Limpieza','🧼'],['Cloro','1 L',18,'Limpieza','🧴']];
const FA=[['Paracetamol','500 mg, 10 tabletas',35,'Dolor y fiebre','💊'],['Ibuprofeno','400 mg, 10 tabletas',45,'Dolor y fiebre','💊'],['Naproxeno','250 mg, 20 tabletas',55,'Dolor y fiebre','💊'],['Antigripal','12 cápsulas',79,'Gripa y tos','🤧'],['Jarabe para la tos','120 ml',95,'Gripa y tos','🍯'],['Pastillas para garganta','12 pzas',38,'Gripa y tos','🍬'],['Antiácido','12 tabletas masticables',42,'Estómago','🫃'],['Suero oral','500 ml',28,'Estómago','🧃'],['Loperamida','2 mg, 12 tabletas',48,'Estómago','💊'],['Loratadina','10 mg, 10 tabletas',59,'Alergias','🌼'],['Alcohol etílico','250 ml',32,'Botiquín','🧴'],['Gasas estériles','10 pzas',30,'Botiquín','🩹'],['Curitas','20 pzas',35,'Botiquín','🩹'],['Agua oxigenada','230 ml',22,'Botiquín','🫧'],['Termómetro digital','1 pza',89,'Botiquín','🌡️'],['Pañales etapa 3','40 pzas',249,'Bebé','👶'],['Toallitas húmedas','80 pzas',45,'Bebé','🧻'],['Cubrebocas','10 pzas',30,'Cuidado personal','😷'],['Repelente de mosquitos','200 ml',89,'Cuidado personal','🦟'],['Bloqueador solar FPS 50','120 ml',179,'Cuidado personal','☀️']];
function seedStores(){const v=(arr,f)=>mkP(arr.map(x=>[x[0],x[1],Math.round(x[2]*f),x[3],x[4]]));return[
 {id:1,cat:'abarrotes',n:'Abarrotes La Esquina (ejemplo)',tipo:'Tienda de abarrotes',col:'Col. Centro',hor:'7:00 – 22:00',act:1,prods:v(AB,1)},
 {id:2,cat:'abarrotes',n:'Minisúper El Ahorro (ejemplo)',tipo:'Minisúper',col:'Col. Lázaro Cárdenas',hor:'8:00 – 21:00',act:1,prods:v(AB,0.96)},
 {id:3,cat:'abarrotes',n:'Tiendita Don Pepe (ejemplo)',tipo:'Tienda de barrio',col:'Col. Ejidal',hor:'6:30 – 21:30',act:1,prods:v(AB.slice(0,18),1.05)},
 {id:4,cat:'farmacia',n:'Farmacia Salud Total (ejemplo)',tipo:'Farmacia',col:'Col. Centro',hor:'8:00 – 23:00',act:1,prods:v(FA,1)},
 {id:5,cat:'farmacia',n:'Farmacia Bienestar (ejemplo)',tipo:'Farmacia de barrio',col:'Col. Revolución',hor:'9:00 – 21:00',act:1,prods:v(FA,0.95)}]}
function seed(){const t=Date.now();return{
 cfg:{zonas:[{n:'Centro',f:30},{n:'Colonias cercanas',f:40},{n:'Orillas / Ejidos',f:60}],comServ:15},
 v:SV,stores:seedStores(),reps:['Juan (ejemplo)','Lupita (ejemplo)'],
 orders:[
 {id:1001,ej:1,cat:'abarrotes',det:{storeId:1,tienda:'Abarrotes La Esquina (ejemplo)',items:[{n:'Tortillas de maíz',pres:'1 kg',p:24,q:2},{n:'Leche entera',pres:'1 L',p:29,q:1},{n:'Huevo blanco',pres:'12 pzas',p:48,q:1}],extra:'',extraEst:0},dir:'Calle Morelos 120, Centro',tel:'3191234567',zona:0,fee:30,pago:'efectivo',pagaCon:500,st:1,rep:'Juan (ejemplo)',cobrado:0,t:t-3600e3,d:today()},
 {id:1002,ej:1,cat:'farmacia',det:{storeId:4,tienda:'Farmacia Salud Total (ejemplo)',items:[{n:'Paracetamol',pres:'500 mg, 10 tabletas',p:35,q:1}],extra:'',extraEst:0},dir:'Av. Juárez 45, Col. Centro',tel:'3197654321',zona:0,fee:30,pago:'tarjeta',st:4,rep:'Lupita (ejemplo)',cobrado:0,t:t-7200e3,d:today()},
 {id:1003,ej:1,cat:'servicios',det:{tipo:'CFE (luz)',ref:'123456789012',monto:450},dir:'Calle Hidalgo 8, Col. Lázaro Cárdenas',tel:'3195551122',zona:1,fee:55,pago:'efectivo',pagaCon:600,st:0,rep:'',cobrado:0,t:t-600e3,d:today()}],
 mine:[1001,1002,1003]}}
let DB=JSON.parse(localStorage.getItem('mandados')||'null');
if(!DB||DB.v!==SV){const n=seed();if(DB){n.cfg=DB.cfg||n.cfg;n.reps=DB.reps||n.reps;const old=(DB.orders||[]).filter(o=>!o.ej&&o.det);n.orders=n.orders.concat(old);n.mine=n.mine.concat((DB.mine||[]).filter(id=>old.some(o=>o.id===id)))}DB=n}
const save=()=>localStorage.setItem('mandados',JSON.stringify(DB));save();
let edSt=null;let role=window.APP_ROLE||'cliente', view='home', sel=null, track=null, myRep=DB.reps[0];
const toast=m=>{const e=$('#toast');e.textContent=m;e.style.display='block';clearTimeout(e._t);e._t=setTimeout(()=>e.style.display='none',2200)};
const steps=o=>o.cat==='paquetes'?STP:ST;
const stName=o=>{const s=steps(o);return s[Math.min(o.st,s.length-1)]};
const done=o=>o.st>=steps(o).length-1;
const tag=o=>`${o.ej?'<span class="tag ex">EJEMPLO</span> ':''}<span class="tag ${done(o)?'ok':''}">${stName(o)}</span>`;
function summary(o){const d=o.det;if(d.items)return itemsHtml(o);return o.cat==='paquetes'?`De: ${esc(d.de)} → A: ${esc(d.a)} (${esc(d.tam)})`:o.cat==='servicios'?`${esc(d.tipo)} · Ref ${esc(d.ref)} · ${mx(d.monto)}`:esc(d.lista).replace(/\n/g,', ')+(d.tienda?` · ${esc(d.tienda)}`:'')+(d.receta?' · 📷 receta':'')}
const sub=o=>o.det.items?o.det.items.reduce((a,i)=>a+i.p*i.q,0)+Number(o.det.extraEst||0):0;
const total=o=>o.fee+(o.cat==='servicios'?Number(o.det.monto||0):0)+sub(o);
function itemsHtml(o){const d=o.det;return `🏪 <b>${esc(d.tienda)}</b><br>`+d.items.map(i=>`• ${i.q} × ${esc(i.n)} (${esc(i.pres)}) – ${mx(i.p*i.q)}`).join('<br>')+(d.extra?`<br>• Extra: ${esc(d.extra)} – <i>${mx(d.extraEst)} est. (por confirmar)</i>`:'')+(d.receta?'<br>📷 Receta adjunta':'')+`<br><b>Productos: ${mx(sub(o))}</b>`}
const card=(o,extra='')=>`<div class="card"><div class="row"><b>${CATS[o.cat][0]} #${o.id} ${CATS[o.cat][1]}</b>${tag(o)}</div>
<div class="muted">${summary(o)}</div><div class="muted">📍 ${esc(o.dir)} · 📞 ${esc(o.tel)}</div>
<div class="row"><span class="muted">${o.pago==='tarjeta'?'💳 Tarjeta (demo)':'💵 Efectivo'+(o.pagaCon?` · paga con ${mx(o.pagaCon)}`:'')}${o.rep?' · 🛵 '+esc(o.rep):''}</span><b>${o.det.items||o.cat==='servicios'?'Total '+mx(total(o)):'Envío '+mx(o.fee)}</b></div>${extra}</div>`;

function tabs(){const T={cliente:[['home','🏠','Inicio'],['nuevo','➕','Pedir'],['hist','📋','Mis pedidos']],repartidor:[['home','📦','Pedidos']],admin:[['home','📊','Resumen'],['todos','📋','Pedidos'],['tiendas','🏪','Tiendas'],['cfg','⚙️','Tarifas']]}[role];
 $('#tabs').innerHTML=T.map(([v,i,l])=>`<button class="${view===v?'on':''}" onclick="go('${v}')"><b>${i}</b>${l}</button>`).join('')}
function go(v){view=v;render();scrollTo(0,0)}
function render(){if(locked()){$('#tabs').innerHTML='';$('#app').innerHTML=gateView();return}tabs();$('#app').innerHTML=({cliente:C,repartidor:R,admin:A}[role][view]||(()=>''))()}


let shop=null, cart={}, secF='', q='';
const store=id=>DB.stores.find(x=>x.id===id);
const cartItems=()=>{const st=store(shop);return st?Object.entries(cart).filter(([,n])=>n>0).map(([id,n])=>({...st.prods.find(p=>p.id==id),q:n})).filter(x=>x.n):[]};
const cartCount=()=>cartItems().reduce((a,i)=>a+i.q,0);
const curSub=()=>(view==='carrito')?cartItems().reduce((a,i)=>a+i.p*i.q,0)+Number($('#extraEst')?.value||0):0;
function setQ(id,d){cart[id]=Math.max(0,(cart[id]||0)+d);const e=document.getElementById('q'+id);if(e)e.textContent=cart[id];const b=$('#cartbar');if(b)b.innerHTML=cartBar();if(view==='carrito')render()}
const cartBar=()=>{const n=cartCount();return n?`<button class="btn" style="margin:0" onclick="go('carrito')">🛒 Ver carrito (${n}) · ${mx(cartItems().reduce((a,i)=>a+i.p*i.q,0))}</button>`:''};
function pickStore(id){if(shop!==id){cart={};}shop=id;secF='';q='';go('catalogo')}
function storesView(c){const L=DB.stores.filter(s=>s.cat===c&&s.act);return `<h3>Elige la ${c==='farmacia'?'farmacia':'tienda'}</h3>`+(L.map(s=>`<div class="card store" onclick="pickStore(${s.id})"><div class="row"><b>${c==='farmacia'?'💊':'🏪'} ${esc(s.n)}</b><span class="tag">${s.prods.filter(p=>p.disp).length} productos</span></div><div class="muted">${esc(s.tipo)} · 📍 ${esc(s.col)}</div><div class="muted">🕒 ${esc(s.hor)}</div></div>`).join('')||'<p class="muted">No hay tiendas activas.</p>')
 +`<button class="btn sec" onclick="shop=0;go('libre')">✍️ Prefiero escribir mi lista</button>`}
const catsBar=c=>`<h2>Nuevo pedido</h2><div class="grid" style="grid-template-columns:repeat(4,1fr)">${Object.entries(CATS).map(([k,[i,n]])=>`<div class="cat ${k===c?'sel':''}" style="padding:8px 2px;font-size:11px" onclick="sel='${k}';go('nuevo')"><span style="font-size:24px">${i}</span>${n}</div>`).join('')}</div>`;
function entrega(){const z=DB.cfg.zonas;return `<div class="card"><h3>Entrega</h3><label>Dirección de entrega</label><input id="dir" placeholder="Calle, número, colonia, referencias"><label>Teléfono</label><input id="tel" type="tel" inputmode="tel" placeholder="10 dígitos">
  <label>Zona</label><select class="f" id="zona" onchange="calc()">${z.map((x,i)=>`<option value="${i}">${esc(x.n)} – ${mx(x.f)}</option>`).join('')}</select></div>
  <div class="card"><h3>Forma de pago</h3><div class="pay"><label><input type="radio" name="pago" value="efectivo" checked onchange="calc()">💵 Efectivo contra entrega</label><label><input type="radio" name="pago" value="tarjeta" onchange="calc()">💳 Tarjeta de débito</label></div><div id="payx"></div></div>
  <div class="card"><div class="row" id="subrow"><span>Productos</span><b id="sub"></b></div><div class="row"><span>Envío estimado</span><b id="fee"></b></div><div class="row"><span>Total estimado*</span><span class="total" id="tot"></span></div><div class="muted">*El costo de los productos se cobra según el ticket de la tienda.</div></div>
  `}

const SYNC='<div class="warn">ℹ️ Los pedidos y los PIN solo se sincronizan entre celulares cuando la app se conecte a un servidor. Por ahora cada celular guarda sus propios datos.</div>';
async function sha(t){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
const SK='unlock_'+role;
function locked(){return role!=='cliente'&&sessionStorage.getItem(SK)!=='1'}
function logout(){sessionStorage.removeItem(SK);render()}
function unlock(){sessionStorage.setItem(SK,'1');view='home';render()}
if(role==='repartidor'){const l=JSON.parse(localStorage.getItem('rep_local')||'null');if(l)myRep=l.name}
function gateView(){
 if(role==='repartidor'){const l=JSON.parse(localStorage.getItem('rep_local')||'null');
  if(!l)return `<h2>Acceso repartidor</h2><div class="card"><p class="muted">Primera vez en este celular: elige tu nombre y crea tu PIN de 4 dígitos.</p><label>¿Quién eres?</label><select class="f" id="gname">${DB.reps.map(r=>`<option>${esc(r)}</option>`).join('')}</select><label>PIN (4 dígitos)</label><input id="gp1" type="password" inputmode="numeric" maxlength="4"><label>Confirma el PIN</label><input id="gp2" type="password" inputmode="numeric" maxlength="4"><button class="btn" onclick="repCreate()">Crear PIN y entrar</button></div>${SYNC}`;
  return `<h2>Acceso repartidor</h2><div class="card"><p>Hola, <b>${esc(l.name)}</b></p><label>Tu PIN</label><input id="gp1" type="password" inputmode="numeric" maxlength="4" onkeydown="event.key==='Enter'&&repLogin()"><button class="btn" onclick="repLogin()">Entrar</button><button class="btn sec" onclick="if(confirm('¿Cambiar de repartidor en este celular? Se borrará el PIN local.')){localStorage.removeItem('rep_local');render()}">No soy ${esc(l.name)}</button></div>${SYNC}`}
 const h=localStorage.getItem('owner_hash');
 if(!h)return `<h2>Panel del dueño</h2><div class="card"><p class="muted">Primera vez en este celular: crea tu contraseña (mínimo 6 caracteres).</p><label>Contraseña</label><input id="gp1" type="password"><label>Confirma la contraseña</label><input id="gp2" type="password"><button class="btn" onclick="ownCreate()">Crear contraseña y entrar</button></div>`;
 return `<h2>Panel del dueño</h2><div class="card"><label>Contraseña</label><input id="gp1" type="password" onkeydown="event.key==='Enter'&&ownLogin()"><button class="btn" onclick="ownLogin()">Entrar</button></div><p class="muted">¿Olvidaste la contraseña? En este prototipo se reinicia borrando los datos del sitio en el navegador.</p>`}
const gv=id=>($('#'+id)?.value||'');
async function repCreate(){const p=gv('gp1');if(!/^\d{4}$/.test(p))return toast('El PIN debe ser de 4 dígitos');if(p!==gv('gp2'))return toast('Los PIN no coinciden');const n=gv('gname');
 const pre=(DB.repPins||{})[n];if(pre&&pre!==await sha('pin:'+p))return toast('Ese repartidor ya tiene un PIN en este celular; usa ese PIN');
 localStorage.setItem('rep_local',JSON.stringify({name:n,hash:await sha('pin:'+p)}));myRep=n;unlock()}
async function repLogin(){const l=JSON.parse(localStorage.getItem('rep_local'));if(await sha('pin:'+gv('gp1'))===l.hash){myRep=l.name;unlock()}else toast('PIN incorrecto')}
async function ownCreate(){const p=gv('gp1');if(p.length<6)return toast('Mínimo 6 caracteres');if(p!==gv('gp2'))return toast('No coinciden');localStorage.setItem('owner_hash',await sha('own:'+p));unlock()}
async function ownLogin(){if(await sha('own:'+gv('gp1'))===localStorage.getItem('owner_hash'))unlock();else toast('Contraseña incorrecta')}
async function ownChange(){if(await sha('own:'+gv('op'))!==localStorage.getItem('owner_hash'))return toast('Contraseña actual incorrecta');const p=gv('np');if(p.length<6)return toast('Mínimo 6 caracteres');localStorage.setItem('owner_hash',await sha('own:'+p));toast('Contraseña cambiada');render()}
async function setPin(i){const p=gv('pin'+i);if(!/^\d{4}$/.test(p))return toast('PIN de 4 dígitos');DB.repPins=DB.repPins||{};DB.repPins[DB.reps[i]]=await sha('pin:'+p);save();toast('PIN guardado en este celular');render()}
const C={
 home:()=>{const act=DB.orders.filter(o=>DB.mine.includes(o.id)&&!done(o));return `<h2>¡Hola! ¿Qué mandado necesitas hoy?</h2>
 <div class="grid">${Object.entries(CATS).map(([k,[i,n]])=>`<div class="cat" onclick="sel='${k}';go('nuevo')"><span>${i}</span>${n}</div>`).join('')}</div>
 <h3 style="margin-top:16px">Pedidos activos</h3>${act.map(o=>card(o,`<button class="btn sm" onclick="track=${o.id};go('track')">Ver seguimiento</button>`)).join('')||'<p class="muted">No tienes pedidos activos.</p>'}
 <a class="btn wa" style="text-align:center;text-decoration:none" href="https://wa.me/${WA}?text=${encodeURIComponent('Hola, quiero hacer un mandado')}" target="_blank">💬 Escríbenos por WhatsApp</a>`},
 catalogo:()=>{const st=store(shop);if(!st)return C.nuevo();const secs=[...new Set(st.prods.filter(p=>p.disp).map(p=>p.sec))];
  const L=st.prods.filter(p=>p.disp&&(!secF||p.sec===secF)&&(!q||(p.n+' '+p.pres).toLowerCase().includes(q.toLowerCase())));
  return `<button class="btn sec sm" style="margin:0 0 8px" onclick="go('nuevo')">← Tiendas</button><h2 style="margin-bottom:2px">${esc(st.n)}</h2><div class="muted">📍 ${esc(st.col)} · 🕒 ${esc(st.hor)}</div><div class="warn">Precios de ejemplo; pueden variar en tienda.</div>
  ${st.cat==='farmacia'?'<div class="warn">💊 Solo medicamentos de venta libre. Los medicamentos controlados o antibióticos requieren receta (súbela en el carrito).</div>':''}
  <input id="busca" placeholder="🔍 Buscar producto" value="${esc(q)}" oninput="q=this.value;const p=this.selectionStart;render();const b=$('#busca');b.focus();b.setSelectionRange(p,p)" style="margin-top:10px">
  <div class="chips"><span class="chip ${!secF?'on':''}" onclick="secF='';render()">Todo</span>${secs.map(x=>`<span class="chip ${secF===x?'on':''}" onclick="secF='${esc(x)}';render()">${esc(x)}</span>`).join('')}</div>
  <div class="grid">${L.map(p=>`<div class="card prod"><div class="emo">${p.e||'🛍️'}</div><b>${esc(p.n)}</b><div class="muted">${esc(p.pres)}</div><div class="price">${mx(p.p)}</div><div class="qty"><button onclick="setQ(${p.id},-1)">−</button><span id="q${p.id}">${cart[p.id]||0}</span><button onclick="setQ(${p.id},1)">+</button></div></div>`).join('')||'<p class="muted">Sin resultados.</p>'}</div>
  <div id="cartbar" class="cartbar">${cartBar()}</div>`},
 carrito:()=>{const st=store(shop);if(!st)return C.nuevo();const it=cartItems();return `<button class="btn sec sm" style="margin:0 0 8px" onclick="go('catalogo')">← Seguir comprando</button><h2>Tu carrito</h2>
  <div class="card"><b>🏪 ${esc(st.n)}</b>${it.map(i=>`<div class="row line"><span>${i.e} ${esc(i.n)}<br><span class="muted">${esc(i.pres)} · ${mx(i.p)}</span></span><span class="qty"><button onclick="setQ(${i.id},-1)">−</button><span>${i.q}</span><button onclick="setQ(${i.id},1)">+</button></span></div>`).join('')||'<p class="muted">Tu carrito está vacío.</p>'}</div>
  <div class="card"><h3>No encuentro mi producto / artículo extra</h3><textarea id="extra" oninput="cart._extra=this.value" placeholder="Ej: 1 bolsa de hielo, marca específica...">${esc(cart._extra||'')}</textarea><label>Precio estimado (MXN)</label><input id="extraEst" type="number" inputmode="decimal" value="${cart._est||''}" oninput="cart._est=this.value;calc()"><div class="muted">⚠️ Precio estimado, se confirma con el ticket de la tienda.</div>
  ${st.cat==='farmacia'?'<label>Foto de receta (opcional)</label><input id="receta" type="file" accept="image/*" capture="environment"><div class="muted">Los medicamentos controlados requieren receta médica.</div>':''}</div>
  ${entrega()}<button class="btn" onclick="crear()">Confirmar pedido</button>`},
 nuevo:()=>{const c=sel||'abarrotes';if((c==='abarrotes'||c==='farmacia'))return catsBar(c)+storesView(c);return C.libre()},
 libre:()=>{const c=sel||'abarrotes',z=DB.cfg.zonas;let f='';
  if(c==='abarrotes')f=`<label>Lista de compras</label><textarea id="lista" placeholder="Ej: 1 kg frijol, 2 refrescos..."></textarea><label>Tienda (opcional)</label><input id="tienda" placeholder="Ej: Oxxo, abarrotes de la esquina">`;
  if(c==='farmacia')f=`<label>Medicamentos / productos</label><textarea id="lista" placeholder="Ej: Paracetamol 500 mg"></textarea><label>Foto de receta (opcional)</label><input id="receta" type="file" accept="image/*" capture="environment">`;
  if(c==='paquetes')f=`<label>Dirección de recolección</label><input id="de"><label>Dirección de entrega del paquete</label><input id="a"><label>Tamaño</label><select class="f" id="tam"><option>Chico (sobre/caja de zapatos)</option><option>Mediano (mochila)</option></select>`;
  if(c==='servicios')f=`<label>Servicio</label><select class="f" id="tipo"><option>CFE (luz)</option><option>Agua (OROMAPAS)</option><option>Teléfono / Internet</option><option>Gas</option><option>Otro</option></select><label>Número de referencia / servicio</label><input id="ref" inputmode="numeric"><label>Monto a pagar (MXN)</label><input id="monto" type="number" inputmode="decimal" oninput="calc()"><div class="muted">Se suma la comisión por pago de ${mx(DB.cfg.comServ)}.</div>`;
  return catsBar(c)+`<div class="card">${f}</div>${entrega()}<button class="btn" onclick="crear()">Confirmar pedido</button>`},

 track:()=>{const o=DB.orders.find(x=>x.id===track);if(!o)return'';const s=steps(o);return `<h2>Seguimiento #${o.id}</h2>${card(o)}
  <div class="card"><ul class="steps">${s.map((n,i)=>`<li class="${i<=o.st?'done':''} ${i===o.st?'cur':''}">${n}</li>`).join('')}</ul></div>
  <a class="btn wa" style="text-align:center;text-decoration:none" href="https://wa.me/${WA}?text=${encodeURIComponent('Hola, pregunto por mi pedido #'+o.id)}" target="_blank">💬 Preguntar por WhatsApp</a><button class="btn sec" onclick="go('hist')">Volver</button>`},
 hist:()=>`<h2>Mis pedidos</h2>`+DB.orders.filter(o=>DB.mine.includes(o.id)).sort((a,b)=>b.t-a.t).map(o=>card(o,`<button class="btn sm" onclick="track=${o.id};go('track')">Ver seguimiento</button>`)).join('')
};
function feeNow(){const z=DB.cfg.zonas[+($('#zona')?.value||0)];return z.f+((sel||'abarrotes')==='servicios'?DB.cfg.comServ:0)}
function calc(){if(!$('#fee'))return;const f=feeNow(),cs=curSub(),m=((sel==='servicios')?Number($('#monto')?.value||0):0)+cs,p=document.querySelector('[name=pago]:checked').value;
 $('#fee').textContent=mx(f);$('#sub').textContent=mx(cs);$('#subrow').style.display=view==='carrito'?'flex':'none';$('#tot').textContent=mx(f+m);
 const px=$('#payx');if(px.dataset.p!==p){px.dataset.p=p;px.innerHTML=p==='efectivo'?`<label>¿Con cuánto pagará? (para llevar cambio)</label><input id="pagaCon" type="number" inputmode="decimal" placeholder="Ej: 500">`:
 `<div class="warn">⚠️ DEMO: no se hace ningún cargo real. No escribas datos reales de tarjeta.</div><label>Número de tarjeta</label><input placeholder="4242 4242 4242 4242" autocomplete="off"><div class="grid"><input placeholder="MM/AA"><input placeholder="CVV"></div>`}}
function crear(){const c=sel||'abarrotes',v=id=>($('#'+id)?.value||'').trim();let det={};
 if(view==='carrito'){const st=store(shop),it=cartItems();if(!it.length&&!v('extra'))return toast('Agrega productos al carrito');
  det={storeId:st.id,tienda:st.n,items:it.map(i=>({n:i.n,pres:i.pres,p:i.p,q:i.q})),extra:v('extra'),extraEst:+v('extraEst')||0,receta:!!$('#receta')?.files.length}}else{
 if(c==='abarrotes')det={lista:v('lista'),tienda:v('tienda')};
 if(c==='farmacia')det={lista:v('lista'),receta:!!$('#receta').files.length};
 if(c==='paquetes')det={de:v('de'),a:v('a'),tam:v('tam')};
 if(c==='servicios')det={tipo:v('tipo'),ref:v('ref'),monto:+v('monto')};
 }
 const miss=det.items?false:(c==='paquetes'?!det.de||!det.a:c==='servicios'?!det.ref||!det.monto:!det.lista);
 if(miss||!v('dir')||v('tel').replace(/\D/g,'').length<10)return toast('Completa los datos del pedido, dirección y teléfono (10 dígitos)');
 const pago=document.querySelector('[name=pago]:checked').value;
 const o={id:Math.max(...DB.orders.map(x=>x.id),1000)+1,cat:c,det,dir:v('dir'),tel:v('tel'),zona:+v('zona'),fee:feeNow(),pago,pagaCon:pago==='efectivo'?+v('pagaCon')||0:0,st:0,rep:'',cobrado:0,t:Date.now(),d:today()};
 DB.orders.push(o);DB.mine.push(o.id);save();if(det.items){cart={};shop=null}track=o.id;toast(pago==='tarjeta'?'Pedido enviado (pago demo, sin cargo)':'¡Pedido enviado!');go('track')}

const R={home:()=>{const mine=DB.orders.filter(o=>o.rep===myRep&&!done(o)),av=DB.orders.filter(o=>!o.rep&&!done(o)),fin=DB.orders.filter(o=>o.rep===myRep&&done(o)&&o.d===today());
 const cash=fin.filter(o=>o.pago==='efectivo'&&o.cobrado).reduce((a,o)=>a+total(o),0);
 return `<div class="card">${SYNC}<div class="row"><b>🛵 ${esc(myRep)}</b><button class="btn sec sm" style="margin:0" onclick="logout()">Salir</button></div><div class="muted" style="margin-top:6px">Entregados hoy: ${fin.length} · Efectivo cobrado (envío+servicios): ${mx(cash)}</div></div>
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

 tiendas:()=>`<h2>Tiendas asociadas</h2>`+DB.stores.map((t,i)=>`<div class="card"><div class="row"><b>${t.cat==='farmacia'?'💊':'🏪'} ${esc(t.n)}</b><label class="sw"><input type="checkbox" ${t.act?'checked':''} onchange="DB.stores[${i}].act=+this.checked;save()"> Activa</label></div>
  <label>Nombre</label><input value="${esc(t.n)}" onchange="DB.stores[${i}].n=this.value;save()"><div class="grid"><div><label>Tipo</label><input value="${esc(t.tipo)}" onchange="DB.stores[${i}].tipo=this.value;save()"></div><div><label>Categoría</label><select class="f" onchange="DB.stores[${i}].cat=this.value;save()"><option value="abarrotes" ${t.cat==='abarrotes'?'selected':''}>Abarrotes</option><option value="farmacia" ${t.cat==='farmacia'?'selected':''}>Farmacia</option></select></div>
  <div><label>Colonia / dirección</label><input value="${esc(t.col)}" onchange="DB.stores[${i}].col=this.value;save()"></div><div><label>Horario</label><input value="${esc(t.hor)}" onchange="DB.stores[${i}].hor=this.value;save()"></div></div>
  <button class="btn sm" onclick="edSt=${t.id};go('prods')">📦 Productos (${t.prods.length})</button><button class="btn sec sm" onclick="if(confirm('¿Eliminar esta tienda?')){DB.stores.splice(${i},1);save();render()}">🗑️ Eliminar</button></div>`).join('')
  +`<button class="btn" onclick="DB.stores.push({id:Math.max(0,...DB.stores.map(x=>x.id))+1,cat:'abarrotes',n:'Nueva tienda',tipo:'Tienda',col:'Col. ',hor:'8:00 – 21:00',act:1,prods:[]});save();render()">➕ Agregar tienda</button>`,
 prods:()=>{const t=store(edSt);if(!t)return A.tiendas();const k=DB.stores.indexOf(t);return `<button class="btn sec sm" style="margin:0 0 8px" onclick="go('tiendas')">← Tiendas</button><h2>${esc(t.n)}</h2><div class="muted">Precios de ejemplo, edítalos con tus precios reales. Se guardan al salir del campo.</div>`
  +t.prods.map((p,i)=>`<div class="card"><div class="row"><b>${p.e||'🛍️'} ${esc(p.n)}</b><label class="sw"><input type="checkbox" ${p.disp?'checked':''} onchange="DB.stores[${k}].prods[${i}].disp=+this.checked;save()"> Disponible</label></div>
  <div class="grid" style="grid-template-columns:2fr 1fr"><input value="${esc(p.n)}" placeholder="Nombre" onchange="DB.stores[${k}].prods[${i}].n=this.value;save()"><input type="number" value="${p.p}" aria-label="Precio" onchange="DB.stores[${k}].prods[${i}].p=+this.value;save()">
  <input value="${esc(p.pres)}" placeholder="Presentación" onchange="DB.stores[${k}].prods[${i}].pres=this.value;save()"><input value="${esc(p.e)}" placeholder="Emoji" onchange="DB.stores[${k}].prods[${i}].e=this.value;save()"></div>
  <div class="row" style="margin-top:8px"><input value="${esc(p.sec)}" placeholder="Sección" onchange="DB.stores[${k}].prods[${i}].sec=this.value;save()"><button class="btn sec sm" style="margin:0" onclick="DB.stores[${k}].prods.splice(${i},1);save();render()">🗑️</button></div></div>`).join('')
  +`<button class="btn" onclick="DB.stores[${k}].prods.push({id:Math.max(0,...DB.stores[${k}].prods.map(x=>x.id))+1,n:'Nuevo producto',pres:'1 pza',p:0,sec:'General',e:'🛍️',disp:1});save();render()">➕ Agregar producto</button>`},
 cfg:()=>`<h2>Tarifas y zonas</h2><div class="card"><h3>Envío por zona (MXN)</h3>${DB.cfg.zonas.map((z,i)=>`<div class="grid" style="grid-template-columns:2fr 1fr auto;margin-bottom:8px"><input value="${esc(z.n)}" onchange="DB.cfg.zonas[${i}].n=this.value;save()"><input type="number" value="${z.f}" onchange="DB.cfg.zonas[${i}].f=+this.value;save()"><button class="btn sec sm" style="margin:0" onclick="DB.cfg.zonas.length>1&&DB.cfg.zonas.splice(${i},1);save();render()">🗑️</button></div>`).join('')}
 <button class="btn sec sm" onclick="DB.cfg.zonas.push({n:'Nueva zona',f:50});save();render()">➕ Agregar zona</button>
 <label>Comisión extra por pago de servicios</label><input type="number" value="${DB.cfg.comServ}" onchange="DB.cfg.comServ=+this.value;save()"><div class="muted">Valores de ejemplo, ajústalos a tus precios. Se guardan al salir del campo.</div></div>
 ${SYNC}<div class="card"><h3>Repartidores y PIN</h3>${DB.reps.map((r,i)=>`<div class="row" style="margin-bottom:6px"><span>${esc(r)} ${(DB.repPins||{})[r]?'🔒':''}</span><span class="row"><input id="pin${i}" type="password" inputmode="numeric" maxlength="4" placeholder="PIN" style="width:80px"><button class="btn sec sm" style="margin:0" onclick="setPin(${i})">Guardar</button></span></div>`).join('')}<input id="nrep" placeholder="Nombre" style="margin-top:8px"><button class="btn sec sm" onclick="const n=$('#nrep').value.trim();if(n){DB.reps.push(n);save();render()}">➕ Agregar repartidor</button></div>
 <div class="card"><h3>Cambiar contraseña del dueño</h3><label>Contraseña actual</label><input id="op" type="password"><label>Nueva contraseña</label><input id="np" type="password"><button class="btn sec" onclick="ownChange()">Cambiar contraseña</button><button class="btn sec" onclick="logout()">Cerrar sesión</button></div>`
};
const _r=render;render=function(){_r();calc()};render();
if('serviceWorker' in navigator)navigator.serviceWorker.register(window.APP_BASE+'sw.js',{scope:window.APP_BASE});
