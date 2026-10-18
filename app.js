// Mandados Tuxpan - prototipo demo (localStorage, sin servidor)
const WA='523190000000'; // EJEMPLO: cambiar por el WhatsApp real del negocio
const ST=['Recibido','En camino a la tienda','Comprando','En camino','Entregado'];
const STP=['Recibido','Recolectando','En camino','Entregado']; // paquetes
const CATS={abarrotes:['🛒','Abarrotes'],farmacia:['💊','Farmacia'],paquetes:['📦','Paquetes chicos'],servicios:['🧾','Pago de servicios']};
const $=s=>document.querySelector(s), mx=n=>'$'+Number(n||0).toFixed(2)+' MXN';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today=()=>new Date().toISOString().slice(0,10);

const SV=5; // versión de datos (v5: chat del pedido)
const mkP=(arr)=>arr.map((x,i)=>({id:i+1,n:x[0],pres:x[1],p:x[2],sec:x[3],e:x[4],disp:1}));
const AB=[['Tortillas de maíz','1 kg',24,'Básicos','🫓'],['Frijol negro','1 kg',38,'Básicos','🫘'],['Arroz','1 kg',32,'Básicos','🍚'],['Azúcar estándar','1 kg',34,'Básicos','🍬'],['Aceite vegetal','900 ml',42,'Básicos','🫗'],['Huevo blanco','12 pzas',48,'Básicos','🥚'],['Sal de mesa','1 kg',14,'Básicos','🧂'],['Pasta para sopa','200 g',12,'Básicos','🍝'],['Leche entera','1 L',29,'Lácteos','🥛'],['Queso fresco','400 g',62,'Lácteos','🧀'],['Crema','450 ml',39,'Lácteos','🥣'],['Pan de caja blanco','680 g',52,'Panadería','🍞'],['Refresco de cola','2 L',38,'Bebidas','🥤'],['Agua purificada','garrafón 20 L',40,'Bebidas','💧'],['Café soluble','120 g',68,'Bebidas','☕'],['Jitomate','1 kg',30,'Frutas y verduras','🍅'],['Cebolla blanca','1 kg',26,'Frutas y verduras','🧅'],['Plátano','1 kg',22,'Frutas y verduras','🍌'],['Limón','1 kg',35,'Frutas y verduras','🍋'],['Papel higiénico','4 rollos',36,'Limpieza','🧻'],['Detergente en polvo','1 kg',45,'Limpieza','🧼'],['Cloro','1 L',18,'Limpieza','🧴']];
const FA=[['Paracetamol','500 mg, 10 tabletas',35,'Dolor y fiebre','💊'],['Ibuprofeno','400 mg, 10 tabletas',45,'Dolor y fiebre','💊'],['Naproxeno','250 mg, 20 tabletas',55,'Dolor y fiebre','💊'],['Antigripal','12 cápsulas',79,'Gripa y tos','🤧'],['Jarabe para la tos','120 ml',95,'Gripa y tos','🍯'],['Pastillas para garganta','12 pzas',38,'Gripa y tos','🍬'],['Antiácido','12 tabletas masticables',42,'Estómago','🫃'],['Suero oral','500 ml',28,'Estómago','🧃'],['Loperamida','2 mg, 12 tabletas',48,'Estómago','💊'],['Loratadina','10 mg, 10 tabletas',59,'Alergias','🌼'],['Alcohol etílico','250 ml',32,'Botiquín','🧴'],['Gasas estériles','10 pzas',30,'Botiquín','🩹'],['Curitas','20 pzas',35,'Botiquín','🩹'],['Agua oxigenada','230 ml',22,'Botiquín','🫧'],['Termómetro digital','1 pza',89,'Botiquín','🌡️'],['Pañales etapa 3','40 pzas',249,'Bebé','👶'],['Toallitas húmedas','80 pzas',45,'Bebé','🧻'],['Cubrebocas','10 pzas',30,'Cuidado personal','😷'],['Repelente de mosquitos','200 ml',89,'Cuidado personal','🦟'],['Bloqueador solar FPS 50','120 ml',179,'Cuidado personal','☀️']];
function seedStores(){const v=(arr,f)=>mkP(arr.map(x=>[x[0],x[1],Math.round(x[2]*f),x[3],x[4]]));return[
 {id:1,cat:'abarrotes',n:'Abarrotes La Esquina (ejemplo)',tipo:'Tienda de abarrotes',col:'Col. Centro',hor:'7:00 – 22:00',act:1,prods:v(AB,1)},
 {id:2,cat:'abarrotes',n:'Minisúper El Ahorro (ejemplo)',tipo:'Minisúper',col:'Col. Lázaro Cárdenas',hor:'8:00 – 21:00',act:1,prods:v(AB,0.96)},
 {id:3,cat:'abarrotes',n:'Tiendita Don Pepe (ejemplo)',tipo:'Tienda de barrio',col:'Col. Ejidal',hor:'6:30 – 21:30',act:1,prods:v(AB.slice(0,18),1.05)},
 {id:4,cat:'farmacia',n:'Farmacia Salud Total (ejemplo)',tipo:'Farmacia',col:'Col. Centro',hor:'8:00 – 23:00',act:1,prods:v(FA,1)},
 {id:5,cat:'farmacia',n:'Farmacia Bienestar (ejemplo)',tipo:'Farmacia de barrio',col:'Col. Revolución',hor:'9:00 – 21:00',act:1,prods:v(FA,0.95)}]}
function seed(){const d=seed0();addV4(d);addV5(d);d.v=SV;return d}
function seed0(){const t=Date.now();return{
 cfg:{zonas:[{n:'Centro',f:30},{n:'Colonias cercanas',f:40},{n:'Orillas / Ejidos',f:60}],comServ:15},
 v:SV,stores:seedStores(),reps:['Juan (ejemplo)','Lupita (ejemplo)'],
 orders:[
 {id:1001,ej:1,cat:'abarrotes',det:{storeId:1,tienda:'Abarrotes La Esquina (ejemplo)',items:[{n:'Tortillas de maíz',pres:'1 kg',p:24,q:2},{n:'Leche entera',pres:'1 L',p:29,q:1},{n:'Huevo blanco',pres:'12 pzas',p:48,q:1}],extra:'',extraEst:0},dir:'Calle Morelos 120, Centro',tel:'3191234567',zona:0,fee:30,pago:'efectivo',pagaCon:500,st:1,rep:'Juan (ejemplo)',cobrado:0,t:t-3600e3,d:today()},
 {id:1002,ej:1,cat:'farmacia',det:{storeId:4,tienda:'Farmacia Salud Total (ejemplo)',items:[{n:'Paracetamol',pres:'500 mg, 10 tabletas',p:35,q:1}],extra:'',extraEst:0},dir:'Av. Juárez 45, Col. Centro',tel:'3197654321',zona:0,fee:30,pago:'tarjeta',st:4,rep:'Lupita (ejemplo)',cobrado:0,t:t-7200e3,d:today()},
 {id:1003,ej:1,cat:'servicios',det:{tipo:'CFE (luz)',ref:'123456789012',monto:450},dir:'Calle Hidalgo 8, Col. Lázaro Cárdenas',tel:'3195551122',zona:1,fee:55,pago:'efectivo',pagaCon:600,st:0,rep:'',cobrado:0,t:t-600e3,d:today()}],
 mine:[1001,1002,1003]}}
let DB=JSON.parse(localStorage.getItem('mandados')||'null');
if(DB&&DB.v===2){DB.v=3}
if(DB&&DB.v===3){addV4(DB);DB.v=4}
if(DB&&DB.v===4){addV5(DB);DB.v=5} // v4→v5: agrega chat a cada pedido sin borrar datos // v3→v4: agrega directivo sin borrar datos // v2→v3: conserva tiendas, productos, zonas, repartidores
if(!DB||DB.v!==SV){const n=seed();if(DB){n.cfg=DB.cfg||n.cfg;n.reps=DB.reps||n.reps;const old=(DB.orders||[]).filter(o=>!o.ej&&o.det);n.orders=n.orders.concat(old);n.mine=n.mine.concat((DB.mine||[]).filter(id=>old.some(o=>o.id===id)))}DB=n}
let lastRaw=null;const save=()=>{lastRaw=JSON.stringify(DB);localStorage.setItem('mandados',lastRaw)};save();
let edSt=null;let role=window.APP_ROLE||'cliente', view='home', sel=null, track=null, myRep=DB.reps[0];
const toast=m=>{const e=$('#toast');e.textContent=m;e.style.display='block';clearTimeout(e._t);e._t=setTimeout(()=>e.style.display='none',2200)};
const steps=o=>o.cat==='paquetes'?STP:ST;
const stName=o=>{const s=steps(o);return s[Math.min(o.st,s.length-1)]};
const done=o=>o.st>=steps(o).length-1||!!o.cancel;
const tag=o=>`${o.ej?'<span class="tag ex">EJEMPLO</span> ':''}<span class="tag ${done(o)?'ok':''}">${o.cancel?'Cancelado':stName(o)}</span>${typeof isLate!=='undefined'&&isLate(o)?' <span class="tag bad">⏰ Tarde ('+durMin(o)+' min)</span>':''}${typeof overch!=='undefined'&&overch(o)?' <span class="tag bad">⚠️ Cobró de más: '+mx(o.cobradoMonto)+'</span>':''}`;
function summary(o){const d=o.det;if(d.items)return itemsHtml(o);return o.cat==='paquetes'?`De: ${esc(d.de)} → A: ${esc(d.a)} (${esc(d.tam)})`:o.cat==='servicios'?`${esc(d.tipo)} · Ref ${esc(d.ref)} · ${mx(d.monto)}`:esc(d.lista).replace(/\n/g,', ')+(d.tienda?` · ${esc(d.tienda)}`:'')+(d.receta?' · 📷 receta':'')}
const sub=o=>o.det.items?o.det.items.reduce((a,i)=>a+(i.quit?0:i.p*i.q),0)+Number(o.det.extraEst||0):0;
const total=o=>o.fee+(o.cat==='servicios'?Number(o.det.monto||0):0)+sub(o);
function itemsHtml(o){const d=o.det;return `🏪 <b>${esc(d.tienda)}</b><br>`+d.items.map(i=>`• ${i.quit?'<s>':''}${i.q} × ${esc(i.n)} (${esc(i.pres)}) – ${mx(i.p*i.q)}${i.quit?'</s> <span class="tag bad">Quitado</span>':i.na?(i.res==='cambiar'?' <span class="tag ex">🔁 Cambiar por similar</span>':' <span class="tag ex">⚠️ No disponible</span>'):''}`).join('<br>')+(d.extra?`<br>• Extra: ${esc(d.extra)} – <i>${mx(d.extraEst)} est. (por confirmar)</i>`:'')+(d.receta?'<br>📷 Receta adjunta':'')+`<br><b>Productos: ${mx(sub(o))}</b>`}
const card=(o,extra='')=>`<div class="card"><div class="row"><b>${CATS[o.cat][0]} #${o.id} ${CATS[o.cat][1]}</b><span>${tag(o)}${bdg(o)}</span></div>
<div class="muted">${summary(o)}</div><div class="muted">${o.src==='invitado'?'<span class="tag ex">Invitado</span>':o.src==='cuenta'?'<span class="tag ok">Cuenta</span>':''} 👤 ${esc(o.nombre||'')} · 📞 <a href="tel:${esc(o.tel)}">${esc(o.tel)}</a></div><div class="muted">📍 ${esc(o.dir)}</div>
<div class="row"><span class="muted">${o.pago==='tarjeta'?'💳 Tarjeta (demo)':'💵 Efectivo'+(o.pagaCon?` · paga con ${mx(o.pagaCon)}`:'')}${o.rep?' · 🛵 '+esc(o.rep):''}</span><b>${o.det.items||o.cat==='servicios'?'Total '+mx(total(o)):'Envío '+mx(o.fee)}</b></div>${extra}</div>`;

function tabs(){const T={dir:[['home','📊','Panel'],['cli','👥','Clientes'],['rep','🛵','Repart.'],['due','🏪','Dueños'],['quejas','📣','Quejas'],['mas','⚙️','Más']],cliente:[['home','🏠','Inicio'],['nuevo','➕','Pedir'],['hist','📋','Mis pedidos']],repartidor:[['home','📦','Pedidos']],admin:[['home','📊','Resumen'],['todos','📋','Pedidos'],['tiendas','🏪','Tiendas'],['cfg','⚙️','Tarifas']]}[role];
 $('#tabs').innerHTML=T.map(([v,i,l])=>`<button class="${view===v||(v==='home'&&['lista','pedido'].includes(view))?'on':''}" onclick="go('${v}')"><b>${i}</b>${l}</button>`).join('')}
function go(v){if(['home','cli','rep','due','quejas','mas'].includes(v)){pBack=null;oBack=null}if(v!==view&&['cli','rep','due','quejas'].includes(v)){pq='';pf='todos'}view=v;render();scrollTo(0,0)}
function profBtn(){let b=$('#prof');if(!b){b=document.createElement('button');b.id='prof';b.className='profbtn';b.onclick=()=>go(acct()?'perfil':'auth');document.querySelector('.top').appendChild(b)}b.textContent=acct()?'👤 '+acct().nombre.split(' ')[0]:'👤 '+(isGuest()?'Invitado':'Mi cuenta')}
function render(){if(locked()){$('#tabs').innerHTML='';$('#app').innerHTML=gateView();return}if(role==='cliente'){if(!sess()&&!AV[view])view='auth';if(AV[view]){$('#tabs').innerHTML='';$('#app').innerHTML=AV[view]();profBtn();return}profBtn();const a=acct(),x=a&&sancSt('cli:'+a.email);if(x){$('#tabs').innerHTML='';$('#app').innerHTML=blockedView(x,'Cuenta bloqueada')+'<button class="btn sec" onclick="localStorage.removeItem(SESS);go(\'auth\')">Cerrar sesión</button>';return}}
 if(role==='admin'){const x=sancSt('due:'+DB.duenos[0]);if(x){$('#tabs').innerHTML='';$('#app').innerHTML=blockedView(x,'Acceso del dueño bloqueado');return}}tabs();$('#app').innerHTML=({cliente:C,repartidor:R,admin:A,dir:D}[role][view]||(()=>''))()}


let shop=null, cart={}, secF='', q='';
const store=id=>DB.stores.find(x=>x.id===id);
const cartItems=()=>{const st=store(shop);return st?Object.entries(cart).filter(([,n])=>n>0).map(([id,n])=>({...st.prods.find(p=>p.id==id),q:n})).filter(x=>x.n):[]};
const cartCount=()=>cartItems().reduce((a,i)=>a+i.q,0);
const curSub=()=>(view==='carrito')?cartItems().reduce((a,i)=>a+i.p*i.q,0)+Number($('#extraEst')?.value||0):0;
function setQ(id,d){cart[id]=Math.max(0,(cart[id]||0)+d);const e=document.getElementById('q'+id);if(e)e.textContent=cart[id];const b=$('#cartbar');if(b)b.innerHTML=cartBar();if(view==='carrito')render()}
const cartBar=()=>{const n=cartCount();return n?`<button class="btn" style="margin:0" onclick="go('carrito')">🛒 Ver carrito (${n}) · ${mx(cartItems().reduce((a,i)=>a+i.p*i.q,0))}</button>`:''};
function pickStore(id){if(shop!==id){cart={};}shop=id;secF='';q='';go('catalogo')}
function storesView(c){const L=DB.stores.filter(s=>s.cat===c&&s.act);return `<h3>Elige la ${c==='farmacia'?'farmacia':'tienda'}</h3>`+(L.map(s=>`<div class="card store" onclick="pickStore(${s.id})"><div class="row"><b>${c==='farmacia'?'💊':'🏪'} ${esc(s.n)}</b><span class="tag">${s.prods.filter(p=>p.disp).length} productos</span></div><div class="muted">${esc(s.tipo)} · 📍 ${esc(s.col)}</div><div class="muted">🕒 ${esc(s.hor)}</div></div>`).join('')||'<p class="muted">No hay tiendas activas.</p>')}
const catsBar=c=>`<h2>Nuevo pedido</h2><div class="grid" style="grid-template-columns:repeat(4,1fr)">${Object.entries(CATS).map(([k,[i,n]])=>`<div class="cat ${k===c?'sel':''}" style="padding:8px 2px;font-size:11px" onclick="sel='${k}';go('nuevo')"><span style="font-size:24px">${i}</span>${n}</div>`).join('')}</div>`;
function entrega(){const z=DB.cfg.zonas;return `<div class="card"><h3>Entrega</h3>${(()=>{const a=acct();if(a&&a.dirs.length)return `<label>Dirección guardada</label><select class="f" id="dsel" onchange="useDir(+this.value)">${a.dirs.map((d,i)=>`<option value="${i}">${esc(d.calle)}</option>`).join('')}</select>`;return isGuest()?'<div class="muted">Pedido como invitado: nombre, teléfono y dirección son obligatorios.</div>':''})()}
  <label>Nombre de quien recibe</label><input id="nom" value="${esc(acct()?.nombre||'')}"><label>Dirección de entrega</label><input id="dir" placeholder="Calle, número, colonia" value="${esc(acct()?.dirs[0]?dirTxt(acct().dirs[0]):'')}"><label>Teléfono</label><input id="tel" type="tel" inputmode="tel" placeholder="10 dígitos" value="${esc(acct()?.tel||'')}">
  <label>Zona</label><select class="f" id="zona" onchange="calc()">${z.map((x,i)=>`<option value="${i}" ${acct()?.dirs[0]?.zona==i?'selected':''}>${esc(x.n)} – ${mx(x.f)}</option>`).join('')}</select></div>
  <div class="card"><h3>Forma de pago</h3><div class="pay"><label><input type="radio" name="pago" value="efectivo" checked onchange="calc()">💵 Efectivo contra entrega</label><label><input type="radio" name="pago" value="tarjeta" onchange="calc()">💳 Tarjeta de débito</label></div><div id="payx"></div></div>
  <div class="card"><div class="row" id="subrow"><span>Productos</span><b id="sub"></b></div><div class="row"><span>Envío estimado</span><b id="fee"></b></div><div class="row"><span>Total estimado*</span><span class="total" id="tot"></span></div><div class="muted">*El costo de los productos se cobra según el ticket de la tienda.</div></div>
  `}

const SYNC='<div class="warn">ℹ️ Los pedidos y los PIN solo se sincronizan entre celulares cuando la app se conecte a un servidor. Por ahora cada celular guarda sus propios datos.</div>';
async function sha(t){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
const SK='unlock_'+role;
const HK=role==='dir'?'dir_hash':'owner_hash',PF=role==='dir'?'dir:':'own:',GT=role==='dir'?'Panel directivo':'Panel del dueño';
function locked(){return role!=='cliente'&&sessionStorage.getItem(SK)!=='1'}
function logout(){sessionStorage.removeItem(SK);render()}
function unlock(){sessionStorage.setItem(SK,'1');view='home';render()}
if(role==='repartidor'){const l=JSON.parse(localStorage.getItem('rep_local')||'null');if(l)myRep=l.name}
function gateView(){
 if(role==='repartidor'){const l=JSON.parse(localStorage.getItem('rep_local')||'null');
  if(!l)return `<h2>Acceso repartidor</h2><div class="card"><p class="muted">Primera vez en este celular: elige tu nombre y crea tu PIN de 4 dígitos.</p><label>¿Quién eres?</label><select class="f" id="gname">${DB.reps.map(r=>`<option>${esc(r)}</option>`).join('')}</select><label>PIN (4 dígitos)</label><input id="gp1" type="password" inputmode="numeric" maxlength="4"><label>Confirma el PIN</label><input id="gp2" type="password" inputmode="numeric" maxlength="4"><button class="btn" onclick="repCreate()">Crear PIN y entrar</button></div>${SYNC}`;
  return `<h2>Acceso repartidor</h2><div class="card"><p>Hola, <b>${esc(l.name)}</b></p><label>Tu PIN</label><input id="gp1" type="password" inputmode="numeric" maxlength="4" onkeydown="event.key==='Enter'&&repLogin()"><button class="btn" onclick="repLogin()">Entrar</button><button class="btn sec" onclick="if(confirm('¿Cambiar de repartidor en este celular? Se borrará el PIN local.')){localStorage.removeItem('rep_local');render()}">No soy ${esc(l.name)}</button></div>${SYNC}`}
 const h=localStorage.getItem(HK);
 if(!h)return `<h2>${GT}</h2><div class="card"><p class="muted">Primera vez en este celular: crea tu contraseña (mínimo 6 caracteres).</p><label>Contraseña</label><input id="gp1" type="password"><label>Confirma la contraseña</label><input id="gp2" type="password"><button class="btn" onclick="ownCreate()">Crear contraseña y entrar</button></div>`;
 return `<h2>${GT}</h2><div class="card"><label>Contraseña</label><input id="gp1" type="password" onkeydown="event.key==='Enter'&&ownLogin()"><button class="btn" onclick="ownLogin()">Entrar</button></div><p class="muted">¿Olvidaste la contraseña? En este prototipo se reinicia borrando los datos del sitio en el navegador.</p>`}
const gv=id=>($('#'+id)?.value||'');
async function repCreate(){const p=gv('gp1');if(!/^\d{4}$/.test(p))return toast('El PIN debe ser de 4 dígitos');if(p!==gv('gp2'))return toast('Los PIN no coinciden');const n=gv('gname');
 const pre=(DB.repPins||{})[n];if(pre&&pre!==await sha('pin:'+p))return toast('Ese repartidor ya tiene un PIN en este celular; usa ese PIN');
 localStorage.setItem('rep_local',JSON.stringify({name:n,hash:await sha('pin:'+p)}));myRep=n;unlock()}
async function repLogin(){const l=JSON.parse(localStorage.getItem('rep_local'));if(await sha('pin:'+gv('gp1'))===l.hash){myRep=l.name;unlock()}else toast('PIN incorrecto')}
async function ownCreate(){const p=gv('gp1');if(p.length<6)return toast('Mínimo 6 caracteres');if(p!==gv('gp2'))return toast('No coinciden');localStorage.setItem(HK,await sha(PF+p));unlock()}
async function ownLogin(){if(await sha(PF+gv('gp1'))===localStorage.getItem(HK))unlock();else toast('Contraseña incorrecta')}
async function ownChange(){if(await sha(PF+gv('op'))!==localStorage.getItem(HK))return toast('Contraseña actual incorrecta');const p=gv('np');if(p.length<6)return toast('Mínimo 6 caracteres');localStorage.setItem(HK,await sha(PF+p));toast('Contraseña cambiada');render()}
async function setPin(i){const p=gv('pin'+i);if(!/^\d{4}$/.test(p))return toast('PIN de 4 dígitos');DB.repPins=DB.repPins||{};DB.repPins[DB.reps[i]]=await sha('pin:'+p);save();toast('PIN guardado en este celular');render()}

const AK='mandados_accounts',SESS='cli_session';
const accts=()=>JSON.parse(localStorage.getItem(AK)||'{}'),saveAccts=a=>localStorage.setItem(AK,JSON.stringify(a));
const sess=()=>JSON.parse(localStorage.getItem(SESS)||'null');
const acct=()=>{const s=sess();return s&&s.type==='acct'?accts()[s.email]||null:null};
const isGuest=()=>sess()?.type==='guest';
const myOrd=o=>{const a=acct();return a?o.email===a.email:(DB.mine.includes(o.id)&&o.src!=='cuenta')};
const dirTxt=d=>d.calle+(d.ref?' ('+d.ref+')':'');
function useDir(i){const d=acct().dirs[i];$('#dir').value=dirTxt(d);$('#zona').value=d.zona;calc()}
let pre=null;
const AUTHNOTE='<div class="warn">Versión de prueba: las cuentas se guardan solo en este celular hasta conectar el servidor.</div>';
const pwField=(id,ph)=>`<div class="row"><input id="${id}" type="password" placeholder="${ph}" autocomplete="new-password"><button class="btn sec sm" style="margin:0" type="button" onclick="const e=$('#${id}');e.type=e.type==='password'?'text':'password';this.textContent=e.type==='password'?'👁️ Ver':'🙈 Ocultar'">👁️ Ver</button></div>`;
const zonaSel=(id,v)=>`<select class="f" id="${id}">${DB.cfg.zonas.map((x,i)=>`<option value="${i}" ${v==i?'selected':''}>${esc(x.n)}</option>`).join('')}</select>`;
const AV={
 auth:()=>`<div style="text-align:center;padding:20px 0"><div style="font-size:60px">🛵</div><h2>Bienvenido a Mandados Tuxpan</h2><p class="muted">Abarrotes, farmacia, paquetes y pago de servicios hasta tu puerta.</p></div>
  <button class="btn" onclick="go('login')">Iniciar sesión</button><button class="btn sec" onclick="pre=null;go('signup')">Crear cuenta</button><button class="btn sec" onclick="localStorage.setItem(SESS,JSON.stringify({type:'guest'}));go('home')">Pedir como invitado</button>${sess()?'<button class="btn sec" onclick="go(\'home\')">← Volver</button>':''}${AUTHNOTE}`,
 login:()=>`<h2>Iniciar sesión</h2><div class="card"><label>Correo electrónico</label><input id="le" type="email" inputmode="email" autocomplete="email"><label>Contraseña</label>${pwField('lp','Tu contraseña')}<div id="lerr" class="err"></div>
  <button class="btn" onclick="doLogin()">Entrar</button><p style="text-align:center"><a href="#" onclick="$('#forgot').style.display='block';return false">¿Olvidaste tu contraseña?</a></p><div id="forgot" class="warn" style="display:none">La recuperación por correo funcionará cuando la app se conecte al servidor. Por ahora, crea una cuenta nueva en este celular.</div></div>
  <button class="btn sec" onclick="go('auth')">← Volver</button>${AUTHNOTE}`,
 signup:()=>{const p=pre||{};return `<h2>Crear cuenta</h2><div class="card"><label>Nombre completo</label><input id="sn" value="${esc(p.nombre||'')}"><label>Correo electrónico</label><input id="se" type="email" inputmode="email"><label>Contraseña (mínimo 8 caracteres)</label>${pwField('sp','Contraseña')}<label>Confirma la contraseña</label>${pwField('sp2','Repite la contraseña')}
  <label>Teléfono (10 dígitos)</label><input id="st" type="tel" inputmode="tel" value="${esc(p.tel||'')}"></div>
  <div class="card"><h3>Dirección</h3><label>Calle, número y colonia</label><input id="sc" value="${esc(p.calle||'')}"><label>Zona</label>${zonaSel('sz',p.zona||0)}<label>Referencias</label><input id="sr" placeholder="Ej: portón verde, frente a la tienda"></div><div id="serr" class="err"></div>
  <button class="btn" onclick="doSignup()">Crear cuenta</button><button class="btn sec" onclick="go('auth')">← Volver</button>${AUTHNOTE}`},
 perfil:()=>{const a=acct();if(!a)return AV.auth();return `<h2>Mi perfil</h2><div class="card"><div class="muted">${esc(a.email)}</div><label>Nombre</label><input id="pn" value="${esc(a.nombre)}"><label>Teléfono</label><input id="pt" type="tel" value="${esc(a.tel)}"></div>
  <div class="card"><h3>Mis direcciones</h3>${a.dirs.map((d,i)=>`<div style="border-bottom:1px solid #f1f5f9;padding-bottom:8px;margin-bottom:8px"><input id="pc${i}" value="${esc(d.calle)}"><div class="grid" style="margin-top:6px">${zonaSel('pz'+i,d.zona)}<input id="pr${i}" value="${esc(d.ref)}" placeholder="Referencias"></div><button class="btn sec sm" onclick="delDir(${i})">🗑️ Quitar</button></div>`).join('')}
  <button class="btn sec sm" onclick="saveProf(true)">➕ Agregar dirección</button></div><button class="btn" onclick="saveProf()">Guardar cambios</button><button class="btn sec" onclick="localStorage.removeItem(SESS);go('auth')">Cerrar sesión</button>${AUTHNOTE}`}
};
async function doSignup(){const g=id=>($('#'+id).value||'').trim(),e=g('se').toLowerCase(),err=m=>{$('#serr').textContent=m;toast(m)};
 if(!g('sn'))return err('Escribe tu nombre');if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e))return err('Correo no válido');if($('#sp').value.length<8)return err('La contraseña debe tener al menos 8 caracteres');if($('#sp').value!==$('#sp2').value)return err('Las contraseñas no coinciden');
 const t=g('st').replace(/\D/g,'');if(!/^\d{10}$/.test(t))return err('El teléfono debe tener 10 dígitos');if(!g('sc'))return err('Escribe tu dirección');const A=accts();if(A[e])return err('Ya existe una cuenta con ese correo');
 const salt=[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('');
 A[e]={email:e,nombre:g('sn'),tel:t,salt,hash:await sha(salt+':'+$('#sp').value),dirs:[{calle:g('sc'),zona:+$('#sz').value,ref:g('sr')}],creado:Date.now()};saveAccts(A);
 localStorage.setItem(SESS,JSON.stringify({type:'acct',email:e}));pre=null;toast('¡Cuenta creada!');go('home')}
async function doLogin(){const e=$('#le').value.trim().toLowerCase(),a=accts()[e];if(a&&await sha(a.salt+':'+$('#lp').value)===a.hash){localStorage.setItem(SESS,JSON.stringify({type:'acct',email:e}));toast('¡Hola, '+a.nombre+'!');go('home')}else{$('#lerr').textContent='Correo o contraseña incorrectos';toast('Correo o contraseña incorrectos')}}
function saveProf(add){const A=accts(),a=A[acct().email];a.nombre=$('#pn').value.trim()||a.nombre;const t=$('#pt').value.replace(/\D/g,'');if(t.length!==10)return toast('Teléfono de 10 dígitos');a.tel=t;
 a.dirs=a.dirs.map((d,i)=>({calle:$('#pc'+i).value.trim(),zona:+$('#pz'+i).value,ref:$('#pr'+i).value.trim()}));if(add)a.dirs.push({calle:'',zona:0,ref:''});saveAccts(A);toast(add?'Escribe la nueva dirección':'Perfil guardado');render()}
function delDir(i){const A=accts(),a=A[acct().email];a.dirs.splice(i,1);saveAccts(A);render()}

function addV4(d){const t=Date.now(),H=36e5;d.duenos=d.duenos||['Dueño principal','Dueño sucursal (ejemplo)'];d.sanc=d.sanc||{};d.audit=d.audit||[];d.quejas=d.quejas||[];d.dirCfg=d.dirCfg||{tarde:60};
 d.orders.forEach(o=>{o.ts=o.ts||{0:o.t}});
 if(!d.orders.some(o=>o.id===1005))d.orders.push({id:1005,ej:1,cat:'farmacia',det:{storeId:4,tienda:'Farmacia Salud Total (ejemplo)',items:[{n:'Suero oral',pres:'500 ml',p:28,q:3}],extra:'',extraEst:0},dir:'Calle Allende 12 (ejemplo)',tel:'3190000001',nombre:'Cliente tardado (ejemplo)',src:'invitado',zona:0,fee:30,pago:'tarjeta',st:4,rep:'Juan (ejemplo)',cobrado:0,t:t-3*H,ts:{0:t-3*H,4:t-3*H+95*6e4},d:today()},
  {id:1006,ej:1,cat:'abarrotes',det:{storeId:2,tienda:'Minisúper El Ahorro (ejemplo)',items:[{n:'Arroz',pres:'1 kg',p:31,q:2}],extra:'',extraEst:0},dir:'Av. Hidalgo 40 (ejemplo)',tel:'3190000002',nombre:'Cliente cobro (ejemplo)',src:'invitado',zona:1,fee:40,pago:'efectivo',pagaCon:200,st:4,rep:'Lupita (ejemplo)',cobrado:1,cobradoMonto:150,t:t-2*H,ts:{0:t-2*H,4:t-2*H+40*6e4},d:today()});
 if(!d.quejas.length)d.quejas=[{id:1,ej:1,orderId:1005,tipo:'Llegó tarde',txt:'Tardó más de hora y media (ejemplo)',rep:'Juan (ejemplo)',cli:'inv:3190000001',t:t-2*H,st:'Nueva'},{id:2,ej:1,orderId:1006,tipo:'Me cobraron de más',txt:'Me cobró $150 y eran $102 (ejemplo)',rep:'Lupita (ejemplo)',cli:'inv:3190000002',t:t-H,st:'En revisión'}];
 if(!d.audit.length){d.audit.push({t:t-5*24*H,key:'rep:Lupita (ejemplo)',acc:'Advertencia',mot:'Mal trato',nota:'Sanción de ejemplo',ej:1});}}
// ---- sanciones / directivo (compartido)
const SANC_NOTE='<div class="warn">Versión de prueba: las sanciones solo aplican en este celular hasta conectar el servidor.</div>';
const MOTIVOS=['No entregó a tiempo','Cobró de más','Mal trato','Pedido falso o no pagó','Uso indebido','Otro'];
const fdt=t=>new Date(t).toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'});
function sancSt(k){const x=(DB.sanc||{})[k];if(!x||x.st==='activo')return null;if(x.st==='suspendido'&&x.hasta&&Date.now()>x.hasta)return null;return x}
const sancMsg=x=>x.st==='baja'?`Tu cuenta fue dada de baja. Motivo: ${esc(x.mot)}`:`Tu cuenta está suspendida hasta ${fdt(x.hasta)}. Motivo: ${esc(x.mot)}`;
const blockedView=(x,who)=>`<div class="card" style="text-align:center;border:2px solid #b91c1c"><div style="font-size:48px">⛔</div><h2>${who}</h2><p>${sancMsg(x)}</p>${x.nota?`<p class="muted">${esc(x.nota)}</p>`:''}<p class="muted">Si crees que es un error, contáctanos por WhatsApp.</p></div>`;
const cliKey=o=>o.src==='cuenta'?'cli:'+o.email:'inv:'+o.tel;
const lateMin=()=>(DB.dirCfg||{tarde:60}).tarde;
const endT=o=>(o.ts||{})[steps(o).length-1];
const durMin=o=>endT(o)?Math.round((endT(o)-o.t)/6e4):null;
const isLate=o=>done(o)&&durMin(o)!==null&&durMin(o)>lateMin();
const overch=o=>o.pago==='efectivo'&&o.cobrado&&o.cobradoMonto!=null&&o.cobradoMonto>total(o)+0.009;
const C={
 home:()=>{const act=DB.orders.filter(o=>myOrd(o)&&!done(o));return `<h2>¡Hola! ¿Qué mandado necesitas hoy?</h2>
 <div class="grid">${Object.entries(CATS).map(([k,[i,n]])=>`<div class="cat" onclick="sel='${k}';go('nuevo')"><span>${i}</span>${n}</div>`).join('')}</div>
 <h3 style="margin-top:16px">Pedidos activos</h3>${act.map(o=>card(o,`<button class="btn sm" onclick="track=${o.id};go('track')">Ver seguimiento y 💬 chat</button>`)).join('')||'<p class="muted">No tienes pedidos activos.</p>'}
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
 nuevo:()=>{const c=sel||'abarrotes';if((c==='abarrotes'||c==='farmacia'))return catsBar(c)+storesView(c);return C.otros()},
 otros:()=>{const c=sel||'abarrotes';if(c!=='paquetes'&&c!=='servicios')return C.nuevo();let f=''; // abarrotes y farmacia: solo catálogo de tiendas
  if(c==='paquetes')f=`<label>Dirección de recolección</label><input id="de"><label>Dirección de entrega del paquete</label><input id="a"><label>Tamaño</label><select class="f" id="tam"><option>Chico (sobre/caja de zapatos)</option><option>Mediano (mochila)</option></select>`;
  if(c==='servicios')f=`<label>Servicio</label><select class="f" id="tipo"><option>CFE (luz)</option><option>Agua (OROMAPAS)</option><option>Teléfono / Internet</option><option>Gas</option><option>Otro</option></select><label>Número de referencia / servicio</label><input id="ref" inputmode="numeric"><label>Monto a pagar (MXN)</label><input id="monto" type="number" inputmode="decimal" oninput="calc()"><div class="muted">Se suma la comisión por pago de ${mx(DB.cfg.comServ)}.</div>`;
  return catsBar(c)+`<div class="card">${f}</div>${entrega()}<button class="btn" onclick="crear()">Confirmar pedido</button>`},

 track:()=>{const o=DB.orders.find(x=>x.id===track);if(!o)return'';const s=steps(o);return `<h2>Seguimiento #${o.id}</h2>${card(o)}
  <div class="card"><ul class="steps">${s.map((n,i)=>`<li class="${i<=o.st?'done':''} ${i===o.st?'cur':''}">${n}</li>`).join('')}</ul></div>
  ${chatBox(o,'cli')}
  ${o.st===0&&!o.cancel?`<button class="btn sec" onclick="if(confirm('¿Cancelar este pedido?')){O(${o.id}).cancel=1;save();render()}">Cancelar pedido</button>`:''}
  ${done(o)&&!o.cancel?((DB.quejas||[]).some(q=>q.orderId===o.id)?'<div class="card"><span class="tag">📣 Problema reportado</span> Lo estamos revisando.</div>':`<button class="btn sec" onclick="$('#qform').style.display='block'">📣 Reportar un problema</button><div id="qform" class="card" style="display:none"><label>¿Qué pasó?</label><select class="f" id="qtipo">${['Llegó tarde','Me cobraron de más','Producto incorrecto','Mal trato','Otro'].map(x=>`<option>${x}</option>`).join('')}</select><label>Cuéntanos</label><textarea id="qtxt"></textarea><button class="btn" onclick="queja(${o.id})">Enviar reporte</button></div>`):''}
  <a class="btn wa" style="text-align:center;text-decoration:none" href="https://wa.me/${WA}?text=${encodeURIComponent('Hola, pregunto por mi pedido #'+o.id)}" target="_blank">💬 Preguntar por WhatsApp</a>${o.src==='invitado'&&isGuest()?`<div class="card"><b>¿Quieres pedir más rápido la próxima vez?</b><button class="btn" onclick="pre={nombre:'${esc(o.nombre).replace(/'/g,'')}',tel:'${o.tel}',calle:'${esc(o.dir).replace(/'/g,'')}',zona:${o.zona}};go('signup')">Crear cuenta con estos datos</button></div>`:''}<button class="btn sec" onclick="go('hist')">Volver</button>`},
 hist:()=>`<h2>Mis pedidos</h2>${acct()?'':'<p class="muted">Pedidos hechos como invitado en este celular.</p>'}`+DB.orders.filter(myOrd).sort((a,b)=>b.t-a.t).map(o=>card(o,`<button class="btn sm" onclick="track=${o.id};go('track')">${done(o)?'Ver detalle':'Ver seguimiento y 💬 chat'}</button>`)).join('')
};
function queja(id){const o=O(id),t=$('#qtxt').value.trim();if(!t)return toast('Describe el problema');DB.quejas.push({id:Math.max(0,...DB.quejas.map(q=>q.id))+1,orderId:id,tipo:$('#qtipo').value,txt:t,rep:o.rep,cli:cliKey(o),t:Date.now(),st:'Nueva'});save();toast('Gracias, revisaremos tu reporte');render()}
function feeNow(){const z=DB.cfg.zonas[+($('#zona')?.value||0)];return z.f+((sel||'abarrotes')==='servicios'?DB.cfg.comServ:0)}
function calc(){if(!$('#fee'))return;const f=feeNow(),cs=curSub(),m=((sel==='servicios')?Number($('#monto')?.value||0):0)+cs,p=document.querySelector('[name=pago]:checked').value;
 $('#fee').textContent=mx(f);$('#sub').textContent=mx(cs);$('#subrow').style.display=view==='carrito'?'flex':'none';$('#tot').textContent=mx(f+m);
 const px=$('#payx');if(px.dataset.p!==p){px.dataset.p=p;px.innerHTML=p==='efectivo'?`<label>¿Con cuánto pagará? (para llevar cambio)</label><input id="pagaCon" type="number" inputmode="decimal" placeholder="Ej: 500">`:
 `<div class="warn">⚠️ DEMO: no se hace ningún cargo real. No escribas datos reales de tarjeta.</div><label>Número de tarjeta</label><input placeholder="4242 4242 4242 4242" autocomplete="off"><div class="grid"><input placeholder="MM/AA"><input placeholder="CVV"></div>`}}
function crear(){const c=sel||'abarrotes',v=id=>($('#'+id)?.value||'').trim();let det={};
 if(view==='carrito'){const st=store(shop),it=cartItems();if(!it.length&&!v('extra'))return toast('Agrega productos al carrito');
  det={storeId:st.id,tienda:st.n,items:it.map(i=>({n:i.n,pres:i.pres,p:i.p,q:i.q})),extra:v('extra'),extraEst:+v('extraEst')||0,receta:!!$('#receta')?.files.length}}else{
 if(c!=='paquetes'&&c!=='servicios')return toast('Elige una tienda y agrega productos del catálogo');
 if(c==='paquetes')det={de:v('de'),a:v('a'),tam:v('tam')};
 if(c==='servicios')det={tipo:v('tipo'),ref:v('ref'),monto:+v('monto')};
 }
 const miss=det.items?false:(c==='paquetes'?!det.de||!det.a:c==='servicios'?!det.ref||!det.monto:true);
 if(miss)return toast('Completa los datos del pedido');{const a=acct(),x=a?sancSt('cli:'+a.email):sancSt('inv:'+v('tel').replace(/\D/g,''));if(x)return toast(a?sancMsg(x):'Este número de teléfono está bloqueado. No puede pedir como invitado.')}if(!v('nom'))return toast('Escribe el nombre de quien recibe');if(!/^\d{10}$/.test(v('tel').replace(/\D/g,'')))return toast('Escribe un teléfono de 10 dígitos');if(!v('dir'))return toast('Escribe la dirección de entrega');
 const pago=document.querySelector('[name=pago]:checked').value;
 const o={id:Math.max(...DB.orders.map(x=>x.id),1000)+1,cat:c,det,dir:v('dir'),tel:v('tel'),zona:+v('zona'),fee:feeNow(),pago,pagaCon:pago==='efectivo'?+v('pagaCon')||0:0,st:0,rep:'',cobrado:0,t:Date.now(),ts:{0:Date.now()},d:today(),nombre:v('nom'),src:acct()?'cuenta':'invitado',email:acct()?.email||''};o.tel=o.tel.replace(/\D/g,'');
 DB.orders.push(o);DB.mine.push(o.id);save();if(det.items){cart={};shop=null}track=o.id;toast(pago==='tarjeta'?'Pedido enviado (pago demo, sin cargo)':'¡Pedido enviado!');go('track')}

const R={home:()=>{const mine=DB.orders.filter(o=>o.rep===myRep&&!done(o)),av=DB.orders.filter(o=>!o.rep&&!done(o)),fin=DB.orders.filter(o=>o.rep===myRep&&done(o)&&o.d===today());
 const cash=fin.filter(o=>o.pago==='efectivo'&&o.cobrado).reduce((a,o)=>a+total(o),0);
 const sx=sancSt('rep:'+myRep);return `${sx?blockedView(sx,'Repartidor suspendido')+'<div class="warn">No puedes aceptar pedidos nuevos.</div>':''}<div class="card">${SYNC}<div class="row"><b>🛵 ${esc(myRep)}</b><button class="btn sec sm" style="margin:0" onclick="logout()">Salir</button></div><div class="muted" style="margin-top:6px">Entregados hoy: ${fin.length} · Efectivo cobrado (envío+servicios): ${mx(cash)}</div></div>
 <h3>Mis pedidos asignados</h3>${mine.map(o=>card(o,`<div class="muted">Estado actual: <b>${stName(o)}</b></div><button class="btn sm" onclick="adv(${o.id})">➡️ Pasar a “${steps(o)[o.st+1]}”</button><button class="btn sec sm" onclick="oSel=${o.id};go('pedido')">💬 Chat${o.det.items?' y artículos':''}</button>`)).join('')||'<p class="muted">Sin pedidos asignados.</p>'}
 <h3>Disponibles</h3>${av.map(o=>card(o,`<button class="btn sm" onclick="tomar(${o.id})">✅ Aceptar pedido</button>`)).join('')||'<p class="muted">No hay pedidos disponibles.</p>'}
 <h3>Entregados hoy</h3>${fin.map(o=>card(o,(o.pago==='efectivo'?(o.cobrado?'<span class="tag ok">💵 Efectivo cobrado</span>':`<label>¿Cuánto cobraste? (total sin el cambio, debe ser ${mx(total(o))})</label><input id="cm${o.id}" type="number" inputmode="decimal" value="${total(o)}"><button class="btn sm" onclick="cobrar(${o.id})">💵 Marcar efectivo cobrado</button>`):'<span class="tag">💳 Pagado con tarjeta (demo)</span>')+((o.chat||[]).length?`<button class="btn sec sm" onclick="oSel=${o.id};go('pedido')">💬 Ver chat</button>`:''))).join('')||'<p class="muted">Aún nada.</p>'}`}};
const O=id=>DB.orders.find(o=>o.id===id);
function tomar(id){const x=sancSt('rep:'+myRep);if(x)return toast('Estás suspendido: no puedes aceptar pedidos');O(id).rep=myRep;save();toast('Pedido aceptado');render()}
function adv(id){const o=O(id);o.st=Math.min(o.st+1,steps(o).length-1);o.ts=o.ts||{0:o.t};o.ts[o.st]=Date.now();save();toast('Estado: '+stName(o));render()}
function cobrar(id){const o=O(id),m=+($('#cm'+id)?.value||0);if(!m)return toast('Escribe cuánto cobraste (sin contar el cambio)');o.cobrado=1;o.cobradoMonto=m;save();toast(overch(o)?'⚠️ Registrado: el cobro es mayor al total del pedido':'Efectivo registrado');render()}


// ================= DIRECTIVO =================
let pKey=null,pq='',pf='todos',lst=null,oSel=null,pBack=null,oBack=null;
const kType=k=>k.split(':')[0],kId=k=>k.slice(k.indexOf(':')+1);
const stLabel=k=>{const x=sancSt(k);return x?(x.st==='baja'?'<span class="tag bad">Dado de baja</span>':'<span class="tag ex">Suspendido</span>'):'<span class="tag ok">Activo</span>'};
function clientes(){const A=accts(),L=Object.values(A).map(a=>({k:'cli:'+a.email,n:a.nombre,sub:a.email+' · '+a.tel,tipo:'Cuenta'}));const seen={};DB.orders.filter(o=>o.src!=='cuenta'&&o.tel).forEach(o=>{if(!seen[o.tel]){seen[o.tel]=1;L.push({k:'inv:'+o.tel,n:o.nombre||'Invitado',sub:o.tel,tipo:'Invitado'})}});
 Object.keys(DB.sanc).filter(k=>k.startsWith('inv:')&&!seen[kId(k)]).forEach(k=>L.push({k,n:'Teléfono bloqueado',sub:kId(k),tipo:'Invitado'}));return L}
const people=t=>t==='cli'?clientes():t==='rep'?DB.reps.map(r=>({k:'rep:'+r,n:r,sub:'Repartidor',tipo:'Repartidor'})):DB.duenos.map(d=>({k:'due:'+d,n:d,sub:'Dueño',tipo:'Dueño'}));
const ordersOf=k=>{const t=kType(k),id=kId(k);return DB.orders.filter(o=>t==='rep'?o.rep===id:t==='cli'?(o.src==='cuenta'&&o.email===id):t==='inv'?(o.src!=='cuenta'&&o.tel===id):true)};
function metrics(k){const t=kType(k),O=ordersOf(k);
 if(t==='rep'){const d=O.filter(o=>done(o)&&!o.cancel),dm=d.map(durMin).filter(x=>x!==null);return [['Entregas',d.length],['Tiempo promedio',dm.length?Math.round(dm.reduce((a,b)=>a+b,0)/dm.length)+' min':'—'],['Tardes',d.filter(isLate).length],['Quejas',DB.quejas.filter(q=>q.rep===kId(k)).length],['Efectivo cobrado',mx(O.filter(o=>o.cobrado).reduce((a,o)=>a+(o.cobradoMonto??total(o)),0))],['Cobros de más',O.filter(overch).length]]}
 if(t==='due')return [['Pedidos de la plataforma',DB.orders.length],['Tiendas',DB.stores.length],['Repartidores',DB.reps.length]];
 return [['Pedidos',O.length],['Cancelaciones',O.filter(o=>o.cancel).length],['Quejas hechas',DB.quejas.filter(q=>q.cli===k).length],['Sanciones',DB.audit.filter(a=>a.key===k).length]]}
function listView(t,title){const L=people(t).filter(p=>(!pq||(p.n+' '+p.sub).toLowerCase().includes(pq.toLowerCase()))&&(pf==='todos'||(pf==='activo'?!sancSt(p.k):pf==='sanc'?!!sancSt(p.k):p.tipo===pf)));
 return `<h2>${title}</h2>${SANC_NOTE}<input id="pq" placeholder="🔍 Buscar nombre, correo o teléfono" value="${esc(pq)}" oninput="pq=this.value;const c=this.selectionStart;render();$('#pq').focus();$('#pq').setSelectionRange(c,c)">
 <div class="chips">${[['todos','Todos'],['activo','Activos'],['sanc','Sancionados']].concat(t==='cli'?[['Cuenta','Cuentas'],['Invitado','Invitados']]:[]).map(([v,l])=>`<span class="chip ${pf===v?'on':''}" onclick="pf='${v}';render()">${l}</span>`).join('')}</div>
 ${L.map(p=>`<div class="card store" onclick="pKey='${esc(p.k).replace(/'/g,"\\'")}';go('persona')"><div class="row"><b>${esc(p.n)}</b>${stLabel(p.k)}</div><div class="muted">${p.tipo!=='Repartidor'&&p.tipo!=='Dueño'?`<span class="tag">${p.tipo}</span> `:''}${esc(p.sub)} · ${ordersOf(p.k).length} pedidos</div></div>`).join('')||'<p class="muted">Sin resultados.</p>'}
 ${t==='cli'?`<div class="card"><h3>Bloquear un teléfono de invitado</h3><input id="bph" type="tel" inputmode="tel" placeholder="10 dígitos"><button class="btn sec sm" onclick="const p=$('#bph').value.replace(/\\D/g,'');if(p.length!==10)return toast('10 dígitos');pKey='inv:'+p;go('persona')">Abrir y sancionar</button></div>`:''}`}
function sancionar(){const k=pKey,acc=$('#sacc').value,mot=$('#smot').value,nota=$('#snota').value.trim();if(!mot)return toast('Elige un motivo');if(mot==='Otro'&&!nota)return toast('Escribe la nota del motivo');
 let dias=null,hasta=null;if(acc==='Suspender'){dias=$('#sdias').value==='custom'?+$('#sdc').value:+$('#sdias').value;if(!(dias>0))return toast('Días de suspensión no válidos');hasta=Date.now()+dias*864e5}
 if(acc==='Dar de baja'&&!confirm('¿Dar de baja DEFINITIVA a '+kId(k)+'? Esto bloquea su acceso.'))return;
 DB.sanc[k]=acc==='Advertencia'?(DB.sanc[k]||{st:'activo'}):acc==='Reactivar'?{st:'activo'}:{st:acc==='Suspender'?'suspendido':'baja',hasta,mot,nota};
 DB.audit.push({t:Date.now(),key:k,acc:acc+(dias?` (${dias} días)`:''),mot,nota});save();toast('Registrado: '+acc);render()}
const sancForm=()=>`<div class="card"><h3>⚖️ Aplicar sanción</h3><label>Acción</label><select class="f" id="sacc" onchange="$('#sdw').style.display=this.value==='Suspender'?'block':'none'"><option>Advertencia</option><option>Suspender</option><option>Dar de baja</option><option>Reactivar</option></select>
 <div id="sdw" style="display:none"><label>Duración</label><select class="f" id="sdias" onchange="$('#sdc').style.display=this.value==='custom'?'block':'none'"><option value="1">1 día</option><option value="3">3 días</option><option value="7">7 días</option><option value="30">30 días</option><option value="custom">Personalizado…</option></select><input id="sdc" type="number" placeholder="Días" style="display:none;margin-top:6px"></div>
 <label>Motivo (obligatorio)</label><select class="f" id="smot"><option value="">— Elige un motivo —</option>${MOTIVOS.map(m=>`<option>${m}</option>`).join('')}</select><label>Nota</label><textarea id="snota" placeholder="Detalles de lo que pasó"></textarea><button class="btn" onclick="sancionar()">Aplicar</button></div>`;
const auditRow=a=>`<div class="line"><div class="row"><b>${esc(a.acc)}</b><span class="muted">${fdt(a.t)}</span></div><div class="muted">${esc(a.key.replace(/^cli:|^inv:|^rep:|^due:/,m=>({'cli:':'Cliente ','inv:':'Invitado ','rep:':'Repartidor ','due:':'Dueño '})[m]))}${a.mot?' · Motivo: '+esc(a.mot):''}${a.nota?' · '+esc(a.nota):''}${a.ej?' <span class="tag ex">EJEMPLO</span>':''}</div></div>`;
const qCard=q=>`<div class="card"><div class="row"><b>📣 ${esc(q.tipo)}</b><span class="tag ${q.st==='Resuelta'?'ok':q.st==='Nueva'?'bad':'ex'}">${q.st}</span></div><div class="muted">Pedido #${q.orderId} · ${fdt(q.t)}${q.ej?' · <span class="tag ex">EJEMPLO</span>':''}</div><p>${esc(q.txt)}</p><div class="muted">Repartidor: ${esc(q.rep||'—')} · Cliente: ${esc(kId(q.cli))}</div>
 <div class="chips">${['Nueva','En revisión','Resuelta'].map(s=>`<span class="chip ${q.st===s?'on':''}" onclick="DB.quejas.find(x=>x.id===${q.id}).st='${s}';save();render()">${s}</span>`).join('')}</div>
 ${q.rep?`<button class="btn sm" onclick="pKey='rep:${esc(q.rep)}';go('persona')">⚖️ Sancionar repartidor</button>`:''}<button class="btn sec sm" onclick="pKey='${esc(q.cli)}';go('persona')">👤 Ver cliente</button></div>`;
const D={
 home:()=>{const O=DB.orders,dn=O.filter(o=>done(o)&&!o.cancel),cl=clientes(),fee=a=>a.reduce((s,o)=>s+o.fee,0),ok=O.filter(o=>!o.cancel),ef=ok.filter(o=>o.pago==='efectivo'),tj=ok.filter(o=>o.pago==='tarjeta');
  const st=(v,l,key)=>key?`<div class="card stat tap" role="button" tabindex="0" data-lista="${key}" onclick="openLista('${key}')"><b>${v}</b>${l}<span class="ver">Ver ›</span></div>`:`<div class="card stat"><b>${v}</b>${l}</div>`;
  return `<h2>Panel directivo</h2>${SANC_NOTE}<div class="grid">${st(O.length,'Pedidos','pedidos')+st(cl.length,`Clientes<br><span class="muted">${cl.filter(c=>c.tipo==='Cuenta').length} cuentas · ${cl.filter(c=>c.tipo==='Invitado').length} invitados</span>`)+st(DB.reps.length,'Repartidores')+st(DB.duenos.length,'Dueños')
  +st(dn.filter(o=>!isLate(o)).length,'✅ A tiempo','atiempo')+st(dn.filter(isLate).length,`⏰ Tarde (>${lateMin()} min)`,'tarde')+st(DB.quejas.length,`📣 Quejas (${DB.quejas.filter(q=>q.st!=='Resuelta').length} abiertas)`)+st(O.filter(o=>o.cancel).length,'❌ Cancelaciones','cancel')
  +st(mx(fee(ef)),'💵 Comisiones efectivo','comef')+st(mx(fee(tj)),'💳 Comisiones tarjeta','comtj')+st(O.filter(overch).length,'⚠️ Cobros de más','cobros')+st(Object.keys(DB.sanc).filter(sancSt).length,'⛔ Sancionados','sanc')}</div>
  <div class="card"><h3>Actividad reciente</h3>${DB.audit.slice(-3).reverse().map(auditRow).join('')||'<p class="muted">Sin sanciones.</p>'}</div>`},
 cli:()=>listView('cli','Clientes'),rep:()=>listView('rep','Repartidores'),due:()=>listView('due','Dueños'),
 persona:()=>{const k=pKey,t=kType(k),x=sancSt(k),p=people(t==='inv'?'cli':t).find(z=>z.k===k)||{n:kId(k),sub:''},A=t==='cli'?accts()[kId(k)]:null,O=ordersOf(k).sort((a,b)=>b.t-a.t);
  return `<button class="btn sec sm" style="margin:0 0 8px" onclick="go(pBack||'${t==='inv'?'cli':t}')">${pBack==='lista'?'← Volver a la lista':pBack==='pedido'?'← Volver al pedido':'← Volver'}</button><h2>${esc(p.n)}</h2>${SANC_NOTE}
  <div class="card"><div class="row"><span class="tag">${({cli:'Cliente con cuenta',inv:'Cliente invitado',rep:'Repartidor',due:'Dueño'})[t]}</span>${stLabel(k)}</div>${x?`<div class="warn">${sancMsg(x).replace('Tu cuenta','Cuenta')}${x.nota?' · '+esc(x.nota):''}</div>`:''}
  ${A?`<div class="muted">📧 ${esc(A.email)} · 📞 <a href="tel:${A.tel}">${A.tel}</a><br>📍 ${A.dirs.map(d=>esc(dirTxt(d))).join(' / ')}<br>Alta: ${fdt(A.creado||Date.now())}</div>`:t==='inv'?`<div class="muted">📞 <a href="tel:${esc(kId(k))}">${esc(kId(k))}</a></div>`:''}</div>
  <div class="grid">${metrics(k).map(([l,v])=>`<div class="card stat"><b>${v}</b>${l}</div>`).join('')}</div>
  ${sancForm()}
  <div class="card"><h3>Notas internas</h3><textarea id="pnote">${esc((DB.notes||{})[k]||'')}</textarea><button class="btn sec sm" onclick="DB.notes=DB.notes||{};DB.notes[pKey]=$('#pnote').value;save();toast('Nota guardada')">Guardar nota</button></div>
  <div class="card"><h3>Historial de sanciones</h3>${DB.audit.filter(a=>a.key===k).reverse().map(auditRow).join('')||'<p class="muted">Sin sanciones.</p>'}</div>
  <h3>Pedidos</h3>${t==='due'?'<p class="muted">Ver pedidos en el resumen.</p>':O.map(o=>card(o)).join('')||'<p class="muted">Sin pedidos.</p>'}`},
 quejas:()=>{const L=DB.quejas.slice().sort((a,b)=>b.t-a.t).filter(q=>pf==='todos'||!['Nueva','En revisión','Resuelta'].includes(pf)||q.st===pf);return `<h2>Quejas</h2>${SANC_NOTE}<div class="chips">${['todos','Nueva','En revisión','Resuelta'].map(v=>`<span class="chip ${pf===v?'on':''}" onclick="pf='${v}';render()">${v==='todos'?'Todas':v}</span>`).join('')}</div>${L.map(qCard).join('')||'<p class="muted">Sin quejas.</p>'}`},
 mas:()=>`<h2>Bitácora y ajustes</h2>${SANC_NOTE}<div class="card"><h3>📜 Bitácora de auditoría</h3>${DB.audit.slice().reverse().map(auditRow).join('')||'<p class="muted">Vacía.</p>'}</div>
  <div class="card"><h3>Ajustes</h3><label>Minutos para marcar un pedido como tarde</label><input id="xmin" type="number" value="${lateMin()}" onchange="DB.dirCfg.tarde=+this.value||60;save();toast('Guardado')"></div>
  <div class="card"><h3>Dueños</h3>${DB.duenos.map(d=>`<div>${esc(d)}</div>`).join('')}<div class="muted">El panel /dueno/ de este celular corresponde a "${esc(DB.duenos[0])}".</div><input id="ndue" placeholder="Nombre" style="margin-top:6px"><button class="btn sec sm" onclick="const n=$('#ndue').value.trim();if(n){DB.duenos.push(n);save();render()}">➕ Agregar dueño</button></div>
  <div class="card"><h3>Contraseña del directivo</h3><label>Actual</label><input id="op" type="password"><label>Nueva</label><input id="np" type="password"><button class="btn sec" onclick="ownChange()">Cambiar contraseña</button><button class="btn sec" onclick="logout()">Cerrar sesión</button></div>`
};
// ---- listas del panel directivo (cuadros tocables)
const ordDesc=a=>a.slice().sort((x,y)=>y.t-x.t);
function dirLists(){const O=DB.orders,dn=O.filter(o=>done(o)&&!o.cancel),ok=O.filter(o=>!o.cancel),fee=a=>a.reduce((s,o)=>s+o.fee,0),ef=ok.filter(o=>o.pago==='efectivo'),tj=ok.filter(o=>o.pago==='tarjeta');
 return {pedidos:{t:'📦 Todos los pedidos',L:O},atiempo:{t:'✅ Pedidos entregados a tiempo',L:dn.filter(o=>!isLate(o)),sub:`Entregados en ${lateMin()} minutos o menos.`},tarde:{t:'⏰ Pedidos entregados tarde',L:dn.filter(isLate),sub:`Tardaron más de ${lateMin()} minutos (lo puedes cambiar en "Más").`},
  cancel:{t:'❌ Pedidos cancelados',L:O.filter(o=>o.cancel)},comef:{t:'💵 Comisiones en efectivo',L:ef,com:1,sum:fee(ef),sub:'Pedidos pagados en efectivo (sin cancelados) y la comisión de envío de cada uno.'},comtj:{t:'💳 Comisiones con tarjeta',L:tj,com:1,sum:fee(tj),sub:'Pedidos pagados con tarjeta (sin cancelados) y la comisión de envío de cada uno.'},
  cobros:{t:'⚠️ Cobros de más',L:O.filter(overch),cob:1,sub:'El repartidor cobró en efectivo más del total del pedido.'},sanc:{t:'⛔ Personas sancionadas',P:Object.keys(DB.sanc).filter(sancSt)}}}
function openLista(k){lst=k;oBack=null;pBack=null;go('lista')}
const jsq=s=>esc(s).replace(/'/g,"\\'");
const pName=k=>{const t=kType(k),p=people(t==='inv'?'cli':t).find(z=>z.k===k);return p?p.n:kId(k)};
const ordRow=(o,x={})=>`<div class="card store ord" data-oid="${o.id}" onclick="oSel=${o.id};oBack='lista';go('pedido')"><div class="row"><b>${CATS[o.cat][0]} #${o.id}</b><span class="muted">${fdt(o.t)}</span></div>
 <div style="margin:4px 0">${tag(o)}</div><div class="muted">👤 ${esc(o.nombre||'Cliente '+o.tel)} · 🛵 ${esc(o.rep||'Sin asignar')}</div>
 <div class="row"><span class="muted">${o.pago==='tarjeta'?'💳 Tarjeta':'💵 Efectivo'}${(o.chat||[]).length?` · 💬 ${o.chat.length} mensajes`:''}</span><b>Total ${mx(total(o))}</b></div>
 ${x.com?`<div class="row"><span class="muted">Comisión de envío</span><b class="money">${mx(o.fee)}</b></div>`:''}
 ${x.cob?`<div class="warn">Cobró ${mx(o.cobradoMonto)} · Total ${mx(total(o))} · De más: <b>${mx(o.cobradoMonto-total(o))}</b><br>Repartidor: ${esc(o.rep||'—')}</div>`:''}
 <div class="muted" style="text-align:right">Ver detalle ›</div></div>`;
D.lista=()=>{const d=dirLists()[lst];if(!d)return D.home();const back=`<button class="btn sec sm" style="margin:0 0 8px" onclick="go('home')">← Volver al panel</button>`;
 if(d.P){const P=d.P.map(k=>{const x=sancSt(k);return `<div class="card store per" onclick="pKey='${jsq(k)}';pBack='lista';go('persona')"><div class="row"><b>${esc(pName(k))}</b>${stLabel(k)}</div><div class="muted">${({cli:'Cliente con cuenta',inv:'Cliente invitado',rep:'Repartidor',due:'Dueño'})[kType(k)]} · Motivo: ${esc(x.mot||'—')}${x.st==='suspendido'?' · Hasta '+fdt(x.hasta):''}</div>${x.nota?`<div class="muted">${esc(x.nota)}</div>`:''}<div class="muted" style="text-align:right">Ver ficha ›</div></div>`}).join('');
  return `${back}<h2>${d.t}</h2>${SANC_NOTE}<div class="muted" id="lcount" style="margin:8px 0">${d.P.length} ${d.P.length===1?'persona':'personas'}</div>${P||'<p class="muted empty">No hay personas sancionadas en este momento.</p>'}`}
 const L=ordDesc(d.L);return `${back}<h2>${d.t}</h2>${SANC_NOTE}${d.sub?`<div class="muted" style="margin-top:8px">${d.sub}</div>`:''}
 <div class="card row" style="margin-top:10px"><span id="lcount"><b>${L.length}</b> ${L.length===1?'pedido':'pedidos'}</span>${d.com?`<span>Total comisiones: <b id="lsum">${mx(d.sum)}</b></span>`:''}</div>
 ${L.map(o=>ordRow(o,d)).join('')||'<p class="muted empty">No hay pedidos en esta lista</p>'}`};
D.pedido=()=>{const o=DB.orders.find(x=>x.id===oSel);if(!o)return D.home();const ck=cliKey(o),S=steps(o),Q=DB.quejas.filter(q=>q.orderId===o.id);
 const back=oBack==='lista'?`<button class="btn sec sm" style="margin:0 0 8px" onclick="go('lista')">← Volver a la lista</button>`:'';
 return `${back}<button class="btn sec sm" style="margin:0 0 8px" onclick="go('home')">← Volver al panel</button><h2>${CATS[o.cat][0]} Pedido #${o.id}</h2>
 <div class="card"><div style="margin-bottom:6px">${tag(o)}</div><div class="muted">${CATS[o.cat][1]} · Hecho el ${fdt(o.t)}${durMin(o)!==null?` · Tardó ${durMin(o)} min`:''}</div></div>
 <div class="card"><h3>Personas</h3><div class="line"><div class="row"><span>👤 <b>${esc(o.nombre||'Cliente '+o.tel)}</b> <span class="tag">${o.src==='cuenta'?'Cuenta':'Invitado'}</span></span>${stLabel(ck)}</div><div class="muted">📞 <a href="tel:${esc(o.tel)}">${esc(o.tel)}</a> · 📍 ${esc(o.dir)}</div><button class="btn sec sm" id="vcli" onclick="pKey='${jsq(ck)}';pBack='pedido';go('persona')">Ver ficha del cliente ›</button></div>
 <div class="line"><div class="row"><span>🛵 <b>${esc(o.rep||'Sin asignar')}</b></span>${o.rep?stLabel('rep:'+o.rep):''}</div>${o.rep?`<button class="btn sec sm" id="vrep" onclick="pKey='rep:${jsq(o.rep)}';pBack='pedido';go('persona')">Ver ficha del repartidor ›</button>`:''}</div></div>
 <div class="card"><h3>Detalle</h3><div class="muted">${summary(o)}</div></div>
 ${chatBox(o,null)}
 <div class="card"><h3>Pago</h3><div class="row"><span>Forma de pago</span><b>${o.pago==='tarjeta'?'💳 Tarjeta (demo)':'💵 Efectivo'}</b></div>${o.pagaCon?`<div class="row"><span>Paga con</span><b>${mx(o.pagaCon)}</b></div>`:''}
  <div class="row"><span>Comisión de envío</span><b>${mx(o.fee)}</b></div><div class="row"><span>Total del pedido</span><b>${mx(total(o))}</b></div>
  ${o.cobrado&&o.cobradoMonto!=null?`<div class="row"><span>Cobrado por el repartidor</span><b>${mx(o.cobradoMonto)}</b></div>`:''}${overch(o)?`<div class="warn">⚠️ Cobró ${mx(o.cobradoMonto-total(o))} de más.</div>`:''}</div>
 <div class="card"><h3>Seguimiento</h3>${o.cancel?'<p><span class="tag bad">Cancelado</span></p>':''}<ul class="steps">${S.map((n,i)=>`<li class="${o.st>=i?'done':''}">${n}${(o.ts||{})[i]?` <span class="muted">· ${fdt(o.ts[i])}</span>`:''}</li>`).join('')}</ul></div>
 <div class="card"><h3>Quejas de este pedido</h3>${Q.map(q=>`<div class="line"><div class="row"><b>${esc(q.tipo)}</b><span class="tag ${q.st==='Resuelta'?'ok':q.st==='Nueva'?'bad':'ex'}">${q.st}</span></div><div class="muted">${esc(q.txt)}</div></div>`).join('')||'<p class="muted">Sin quejas.</p>'}</div>`};

const A={
 home:()=>{const h=DB.orders.filter(o=>o.d===today()),sum=a=>a.reduce((s,o)=>s+o.fee,0),ef=h.filter(o=>o.pago==='efectivo'),tj=h.filter(o=>o.pago==='tarjeta');
 return `<h2>Resumen de hoy</h2><div class="grid"><div class="card stat"><b>${h.length}</b>Pedidos</div><div class="card stat"><b>${h.filter(done).length}</b>Entregados</div>
 <div class="card stat"><b>${mx(sum(h))}</b>Total envíos</div><div class="card stat"><b>${h.filter(o=>!o.rep).length}</b>Sin asignar</div>
 <div class="card stat"><b>${mx(sum(ef))}</b>💵 Efectivo (${ef.length})</div><div class="card stat"><b>${mx(sum(tj))}</b>💳 Tarjeta (${tj.length})</div></div>
 <div class="card"><h3>Por repartidor</h3>${DB.reps.map(r=>{const x=h.filter(o=>o.rep===r);return `<div class="row"><span>${esc(r)}</span><span>${x.length} pedidos · ${mx(sum(x))}</span></div>`}).join('')}</div>
 <button class="btn sec" onclick="if(confirm('¿Borrar todo y volver a los datos de ejemplo?')){DB=seed();save();render()}">Reiniciar datos de ejemplo</button>`},
 todos:()=>`<h2>Todos los pedidos</h2>`+DB.orders.slice().sort((a,b)=>b.t-a.t).map(o=>card(o,`<label>Asignar repartidor</label><select class="f" onchange="O(${o.id}).rep=this.value;save();toast('Asignado');render()"><option value="">— Sin asignar —</option>${DB.reps.map(r=>`<option ${r===o.rep?'selected':''}>${esc(r)}</option>`).join('')}</select>${(o.chat||[]).length?`<details class="chatd" ${openCh[o.id]?'open':''} ontoggle="openCh[${o.id}]=this.open"><summary>💬 Ver chat del pedido (${o.chat.length} mensajes)</summary>${chatBox(o,null)}</details>`:'<div class="muted" style="margin-top:8px">💬 Sin mensajes en el chat.</div>'}`)).join(''),

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
// ================= CHAT DEL PEDIDO (cliente ↔ repartidor) =================
function addV5(d){(d.orders||[]).forEach(o=>{o.chat=o.chat||[];o.leido=o.leido||{}});const o=(d.orders||[]).find(x=>x.id===1001&&x.ej);
 if(o&&!o.chat.length){const t=Date.now();o.chat=[{id:1,de:'rep',who:o.rep,t:t-20*6e4,txt:'Ya voy en camino a la tienda (ejemplo)'},{id:2,de:'cli',who:'Cliente',t:t-18*6e4,txt:'Toca el timbre por favor'},{id:3,de:'rep',who:o.rep,t:t-5*6e4,txt:'Ya voy en camino'}];o.leido={rep:t-5*6e4,cli:t-18*6e4}}}
const CHATNOTE='<div class="warn">Versión de prueba: los mensajes solo se ven en este celular hasta conectar el servidor.</div>';
const QR={rep:['Este producto no se encuentra disponible','¿Lo cambio por otra marca similar?','El precio es diferente, ¿lo compro?','Ya voy en camino','Ya llegué, estoy afuera','No encuentro la dirección'],cli:['Sí, cámbialo por otro similar','No, quítalo del pedido','Sí, cómpralo','Ya salgo','Toca el timbre por favor']};
const hm=t=>new Date(t).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
const unread=(o,me)=>(o.chat||[]).filter(m=>m.de!==me&&m.t>((o.leido||{})[me]||0)).length;
const iName=i=>i.n+(i.pres?' '+i.pres:'');
let chatDraft={},openCh={};
const bdgMe=o=>role==='cliente'?'cli':(role==='repartidor'&&o.rep===myRep)?'rep':null;
const bdgIn=o=>{const me=bdgMe(o),n=me&&!done(o)?unread(o,me):0;return n?` <span class="tag bad">💬 ${n} nuevo${n>1?'s':''}</span>`:''};
const bdg=o=>`<span data-badge="${o.id}">${bdgIn(o)}</span>`;
function msgsHtml(o,me){const L=o.chat||[];if(!L.length)return '<p class="muted empty">Aún no hay mensajes.</p>';
 return L.map(m=>{const mine=me?m.de===me:m.de==='rep',who=m.de==='cli'?'👤 '+(me==='cli'?'Tú':(o.nombre||m.who||'Cliente')):'🛵 '+(me==='rep'?'Tú':(m.who||o.rep||'Repartidor'));
  const it=m.kind==='na'&&o.det.items?o.det.items[m.item]:null;
  const ans=it&&me==='cli'&&!it.res&&!done(o)?`<div class="na-btns"><button class="btn sm" onclick="answerNA(${o.id},${m.item},'cambiar')">🔁 Cambiar por similar</button><button class="btn sec sm" onclick="answerNA(${o.id},${m.item},'quitar')">🗑️ Quitar del pedido</button></div>`:'';
  const st=it&&it.res?`<div class="muted">✔️ Respuesta del cliente: ${it.res==='quitar'?'quitar del pedido':'cambiar por similar'}</div>`:it&&!done(o)?'<div class="muted">Esperando respuesta del cliente…</div>':'';
  return `<div class="msg ${m.kind==='sys'?'sys':mine?'mine':'theirs'}${m.kind==='na'?' na':''}"><div class="who">${m.kind==='sys'?'🧾 Aviso':esc(who)} · ${hm(m.t)}</div><div>${esc(m.txt)}</div>${me==='cli'?ans:''}${me==='cli'&&ans?'':st}</div>`}).join('')}
function chatBox(o,me){const closed=done(o);
 return `<div class="card chat" id="chat${o.id}"><div class="row"><h3 style="margin:0">💬 Chat del pedido</h3>${closed?'<span class="tag">🔒 Cerrado</span>':!me?'<span class="tag">👁️ Solo lectura</span>':''}</div>
 ${me==='cli'&&!o.rep&&!closed?'<div class="muted" style="margin-top:6px">Aún no hay repartidor asignado. Verá tus mensajes en cuanto acepte el pedido.</div>':''}
 <div class="msgs" data-chat="${o.id}"${me?` data-me="${me}"`:''}>${msgsHtml(o,me)}</div>
 ${closed?`<div class="muted">🔒 El chat se cerró porque el pedido fue ${o.cancel?'cancelado':'entregado'}. Queda guardado como registro.</div>`:me?`<div class="chips qr">${QR[me].map((t,i)=>`<span class="chip" onclick="quick(${o.id},'${me}',${i})">${esc(t)}</span>`).join('')}</div><div class="row"><input id="chatin" placeholder="Escribe un mensaje…" value="${esc(chatDraft[o.id]||'')}" oninput="chatDraft[${o.id}]=this.value" onkeydown="event.key==='Enter'&&sendChat(${o.id},'${me}')"><button class="btn sm" id="chatsend" style="margin:0" onclick="sendChat(${o.id},'${me}')">Enviar</button></div>`:'<div class="muted">Vista de supervisión: puedes leer la conversación para revisar disputas.</div>'}
 ${CHATNOTE}</div>`}
function pushMsg(o,me,txt,x={}){o.chat=o.chat||[];const t=Date.now();o.chat.push({id:o.chat.reduce((a,m)=>Math.max(a,m.id||0),0)+1,de:me,who:me==='rep'?myRep:(o.nombre||'Cliente'),t,txt,...x});o.leido=o.leido||{};o.leido[me]=t}
function canChat(o,me){if(!o||done(o)){toast('El chat de este pedido está cerrado');return false}if(me==='rep'&&o.rep!==myRep){toast('Este pedido no está asignado a ti');return false}return true}
function sendChat(id,me){const o=O(id),t=($('#chatin')?.value||'').trim();if(!t)return toast('Escribe un mensaje');if(!canChat(o,me))return;pushMsg(o,me,t);chatDraft[id]='';save();render()}
function quick(id,me,k){const o=O(id);if(!canChat(o,me))return;pushMsg(o,me,QR[me][k]);save();render()}
function markNA(id,k){const o=O(id),it=o&&o.det.items?o.det.items[k]:null;if(!it||!canChat(o,'rep'))return;if(it.na)return toast('Ya está marcado como no disponible');it.na=1;
 pushMsg(o,'rep',`⚠️ No disponible: ${iName(it)}. ¿Lo cambio por otro similar o lo quito?`,{kind:'na',item:k});save();toast('Aviso enviado al cliente');render()}
function answerNA(id,k,res){const o=O(id),it=o&&o.det.items?o.det.items[k]:null;if(!it||it.res||!canChat(o,'cli'))return;const before=total(o);it.res=res;if(res==='quitar')it.quit=1;
 pushMsg(o,'cli',res==='quitar'?`🗑️ No, quítalo del pedido: ${iName(it)}`:`🔁 Sí, cámbialo por otro similar: ${iName(it)}`);
 if(res==='quitar')pushMsg(o,'cli',`Se quitó ${iName(it)} del pedido. Total actualizado: ${mx(total(o))} (antes ${mx(before)}).`,{kind:'sys'});
 save();toast(res==='quitar'?'Producto quitado. Nuevo total: '+mx(total(o)):'Le avisamos al repartidor');render()}
R.pedido=()=>{const o=O(oSel);if(!o||o.rep!==myRep)return R.home();const act=!done(o);
 return `<button class="btn sec sm" style="margin:0 0 8px" onclick="go('home')">← Mis pedidos</button><h2>Pedido #${o.id}</h2>${card(o,act?`<button class="btn sm" onclick="adv(${o.id})">➡️ Pasar a “${steps(o)[o.st+1]}”</button>`:'')}
 ${o.det.items&&act?`<div class="card"><h3>Artículos</h3><div class="muted">Si un producto no está en la tienda, márcalo y el cliente decide si lo cambias o lo quitas.</div>${o.det.items.map((it,k)=>`<div class="row line"><span>${it.quit?'<s>':''}${it.q} × ${esc(iName(it))}${it.quit?'</s>':''}</span>${it.quit?'<span class="tag bad">Quitado</span>':it.res==='cambiar'?'<span class="tag ex">🔁 Cambiar por similar</span>':it.na?'<span class="tag ex">Esperando al cliente</span>':`<button class="btn sec sm" style="margin:0" data-na="${k}" onclick="markNA(${o.id},${k})">⚠️ No disponible</button>`}</div>`).join('')}</div>`:''}
 ${chatBox(o,'rep')}`};
function afterR(){document.querySelectorAll('[data-chat]').forEach(e=>{e.scrollTop=e.scrollHeight;const me=e.dataset.me,o=O(+e.dataset.chat);if(me&&o&&unread(o,me)){o.leido=o.leido||{};o.leido[me]=Date.now();save();document.querySelectorAll(`[data-badge="${o.id}"]`).forEach(b=>b.innerHTML=bdgIn(o))}})}
// sincroniza otra pestaña / ventana (mismo celular): evento storage + revisión cada 2.5 s
const LIVE={cliente:['home','hist','track'],repartidor:['home','pedido'],admin:['home','todos'],dir:['home','lista','pedido']};
function syncIn(){const r=localStorage.getItem('mandados');if(!r||r===lastRaw)return;let n;try{n=JSON.parse(r)}catch(e){return}if(!n||n.v!==SV)return;lastRaw=r;DB=n;if(locked())return;
 const a=document.activeElement,typing=a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
 if(!typing&&(LIVE[role]||[]).includes(view)&&!(role==='cliente'&&AV[view])){const y=scrollY;render();scrollTo(0,y);return}
 document.querySelectorAll('[data-chat]').forEach(e=>{const o=O(+e.dataset.chat);if(o)e.innerHTML=msgsHtml(o,e.dataset.me||null)});
 document.querySelectorAll('[data-badge]').forEach(e=>{const o=O(+e.dataset.badge);if(o)e.innerHTML=bdgIn(o)});afterR()}
addEventListener('storage',e=>{if(e.key==='mandados')syncIn()});setInterval(syncIn,2500);
const _r=render;render=function(){_r();calc();afterR()};render();
if('serviceWorker' in navigator)navigator.serviceWorker.register(window.APP_BASE+'sw.js',{scope:window.APP_BASE});
