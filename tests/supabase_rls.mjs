import {createClient as cc} from '@supabase/supabase-js';import WS from 'ws';
const U='https://qloxsilnuhqbgkgfdktx.supabase.co',K='sb_publishable_olBgCzXsfTndbBVe-QrMMg_RgR6w3Iv';
const mk=()=>cc(U,K,{auth:{persistSession:false},realtime:{transport:WS}});
let fails=0;const ck=(c,m)=>{console.log(c?'OK  ':'FAIL',m);if(!c)fails++};
const login=async r=>{const c=mk();const {error}=await c.auth.signInWithPassword({email:`mt-test-${r}@mandados-test.dev`,password:'Prueba-12345'});if(error)throw error;return c};
const rpc=async(c,f,a)=>{const {data,error}=await c.rpc(f,a||{});if(error)throw new Error(f+': '+error.message);return data};
const tryr=async(c,f,a)=>{try{return {data:await rpc(c,f,a)}}catch(e){return {error:e.message}}};
const cli=await login('cli'),cli2=await login('cli2'),rep=await login('rep'),due=await login('due'),dir=await login('dir');
// catalog & costs
const cat=await rpc(cli,'get_catalog');ck(cat.length>=5,'cliente ve catálogo ('+cat.length+' tiendas)');
ck(!JSON.stringify(cat).includes('"pc"'),'catálogo del cliente sin precio de compra');
let r=await cli.from('product_costs').select('*').limit(5);ck((r.data||[]).length===0,'cliente no lee product_costs');
r=await due.from('product_costs').select('*').limit(5);ck((r.data||[]).length===5,'dueño lee product_costs');
// escalation
r=await cli.from('profiles').update({role:'directivo'}).eq('id',(await cli.auth.getUser()).data.user.id);ck(!!r.error,'cliente no puede cambiar su rol ('+(r.error&&r.error.message)+')');
r=await tryr(cli,'set_role',{target_email:'mt-test-cli2@mandados-test.dev',new_role:'dueno'});ck(!!r.error,'cliente no puede usar set_role');
r=await tryr(due,'set_role',{target_email:'mt-test-cli2@mandados-test.dev',new_role:'dueno'});ck(!!r.error,'dueño no puede asignar dueños');
r=await tryr(cli,'claim_directivo',{code:'MT-AAAA-BBBB-CCCC'});ck(!!r.error,'código directivo falso rechazado');
r=await tryr(cli,'sync_docs',{coll:'sanc',entries:{'cli:x':{st:'activo'}}});ck(!!r.error,'cliente no puede sancionar');
r=await tryr(cli,'gen_tablet_code',{p_store:1});ck(!!r.error,'cliente no genera códigos de tablet');
// repartidor registration + approval
r=await tryr(rep,'rep_register',{p_nombre:'Test Repartidor',p_data:{nombre:'Test Repartidor',st:'aprobado',tel:'3191231234'}});ck(!r.error,'repartidor se registra');
let bs=await rpc(rep,'app_bootstrap');ck(bs.me.role==='repartidor'&&!bs.me.verified&&bs.regs['Test Repartidor'].st==='pendiente','registro queda pendiente aunque intente aprobarse');
await rpc(rep,'sync_docs',{coll:'regs',entries:{'Test Repartidor':{nombre:'Test Repartidor',st:'aprobado'}}});
bs=await rpc(rep,'app_bootstrap');ck(bs.regs['Test Repartidor'].st==='pendiente'&&!bs.me.verified,'repartidor no puede autoaprobarse');
// order by cliente
const st1=cat.find(s=>s.id===1),p0=st1.prods[0],p1=st1.prods[1];
const o=await rpc(cli,'create_order',{p:{cat:'abarrotes',det:{storeId:1,items:[{pid:p0.id,q:2,p:0.01},{pid:p1.id,q:1}]},nombre:'Cliente Prueba',tel:'3191112222',dir:'Calle Secreta 1',senas:'casa azul',zona:0,pago:'efectivo',pagaCon:500}});
ck(o.id>2000 && o.order.det.items[0].p===p0.p,'pedido creado con precio del servidor (no el del cliente) #'+o.id);
let ol=await rpc(cli2,'get_orders');ck(!ol.some(x=>x.id===o.id),'otro cliente no ve el pedido');
r=await cli2.from('orders').select('*').eq('id',o.id);ck((r.data||[]).length===0,'otro cliente no lee la tabla orders');
r=await cli.from('order_private').select('*');ck(!!r.error||(r.data||[]).length===0,'order_private no accesible directo');
r=await cli.from('order_items').select('*');ck(!!r.error||(r.data||[]).length===0,'order_items no accesible directo');
ol=await rpc(cli,'get_orders');let mine=ol.find(x=>x.id===o.id);ck(mine&&!JSON.stringify(mine.det.items).includes('"pc"'),'cliente ve su pedido sin precio de compra');
// unverified rep cannot see client data or take
ol=await rpc(rep,'get_orders');let ro=ol.find(x=>x.id===o.id);ck(ro&&ro.tel===''&&ro.dir==='','repartidor no aprobado no ve datos del cliente');
r=await tryr(rep,'sync_order',{p:{...ro,rep:'Test Repartidor'}});ck(!!r.error,'repartidor no aprobado no puede tomar pedido');
// approve
const regs=(await rpc(due,'app_bootstrap')).regs;await rpc(due,'sync_docs',{coll:'regs',entries:{'Test Repartidor':{...regs['Test Repartidor'],st:'aprobado'}}});
ol=await rpc(rep,'get_orders');ro=ol.find(x=>x.id===o.id);ck(ro&&ro.tel==='3191112222','repartidor aprobado ve teléfono/domicilio');
const js=JSON.stringify(ro);ck(!js.includes('"pc"')&&ro.det.items.every(i=>i.p===undefined),'repartidor no ve precios de productos');
ck(ro.cobraTotal===30+p0.p*2+p1.p,'repartidor ve solo el monto a cobrar ('+ro.cobraTotal+')');
r=await rpc(rep,'sync_order',{p:{...ro,rep:'Test Repartidor'}});ck(r.rep==='Test Repartidor','repartidor toma el pedido');
// tablet
const code=await rpc(due,'gen_tablet_code',{p_store:1});ck(/^\d{6}$/.test(code),'dueño genera código de tablet');
const tab=mk();await tab.auth.signInAnonymously();
ck((await rpc(tab,'redeem_tablet_code',{p_store:1,p_code:code==='000000'?'111111':'000000'}))===false,'código de tablet incorrecto rechazado');
ck((await rpc(tab,'redeem_tablet_code',{p_store:1,p_code:code}))===true,'tablet entra con código');
ol=await rpc(tab,'get_orders');let to=ol.find(x=>x.id===o.id);
ck(to&&to.tel===''&&to.dir===''&&to.senas===''&&to.nombre==='Cliente','tienda no ve teléfono/domicilio del cliente');
ck(to.det.items[0].pc!==undefined&&to.det.items[0].p===to.det.items[0].pc&&to.fee===0,'tienda ve precio de compra, no el precio al cliente');
r=await tab.from('product_costs').select('store_id');ck(r.data.length>0&&r.data.every(x=>x.store_id===1),'tienda solo lee costos de su tienda');
// tienda surte, marca no disponible, nota
to.det.items[0].surt='ok';to.det.items[1].na=1;to.det.items[1].surt='no';to.tacc={t:Date.now()};to.nota={folio:'N-1',lines:[],total:40,fin:1,t:Date.now()};to.st=4;to.rep='otro';
r=await rpc(tab,'sync_order',{p:to});ck(r.st===0&&r.rep==='Test Repartidor'&&r.det.items[1].na===1&&r.tacc,'tienda actualiza surtido; no puede cambiar estado ni repartidor');
// chat
mine=(await rpc(cli,'get_orders')).find(x=>x.id===o.id);mine.chat.push({id:1,de:'rep',who:'falso',t:Date.now(),txt:'hola desde cliente'});mine.det.items[0].p=0;
r=await rpc(cli,'sync_order',{p:mine});ck(r.chat.some(m=>m.txt==='hola desde cliente'&&m.de==='cli')&&r.det.items[0].p===p0.p,'chat del cliente guardado como cliente; precio no modificable');
// rep advances, cobra
ro=(await rpc(rep,'get_orders')).find(x=>x.id===o.id);ro.st=1;ro.chat.push({de:'rep',t:Date.now()+1,txt:'voy'});r=await rpc(rep,'sync_order',{p:ro});ck(r.st===1&&r.chat.some(m=>m.txt==='voy'),'repartidor avanza y escribe');
ck(!r.chat.some(m=>m.cli),'repartidor no recibe mensajes marcados para cliente');
r=await tryr(cli2,'sync_order',{p:{...ro,cancel:1}});ck(!!r.error,'otro cliente no puede modificar el pedido');
// tienda cannot read other stores' orders; cliente cancels after taken -> not allowed
mine=(await rpc(cli,'get_orders')).find(x=>x.id===o.id);r=await rpc(cli,'sync_order',{p:{...mine,cancel:1}});ck(!r.cancel,'cliente no cancela pedido ya tomado');
// guest
const g=mk();await g.auth.signInAnonymously();const go=await rpc(g,'create_order',{p:{cat:'paquetes',det:{de:'A',a:'B',tam:'Chico'},nombre:'Invitado',tel:'3193334444',dir:'Calle 2',zona:1,pago:'efectivo'}});
ck(go.order.src==='invitado'&&go.order.fee===40,'invitado crea pedido (anónimo)');
ck((await rpc(cli,'get_guest_order',{p_id:go.id,p_token:go.token})).id===go.id,'seguimiento con token');
ck((await rpc(cli,'get_guest_order',{p_id:go.id,p_token:'x'}))===null,'token incorrecto no da datos');
// anon (no session) cannot call order functions
const nos=mk();r=await tryr(nos,'get_orders');ck(!!r.error||(r.data||[]).length===0,'sin sesión no ve pedidos');
r=await nos.from('orders').select('*');ck((r.data||[]).length===0,'sin sesión no lee orders');
// directivo sees all, sanctions block client
ol=await rpc(dir,'get_orders');ck(ol.some(x=>x.id===o.id)&&ol.find(x=>x.id===o.id).det.items[0].pc!==undefined,'directivo ve todo');
await rpc(dir,'sync_docs',{coll:'sanc',entries:{'cli:mt-test-cli2@mandados-test.dev':{st:'suspendido',hasta:Date.now()+864e5,mot:'Prueba'}}});
r=await tryr(cli2,'create_order',{p:{cat:'paquetes',det:{de:'A',a:'B'},nombre:'x',tel:'3195556666',dir:'y',zona:0,pago:'efectivo'}});ck(!!r.error,'cliente suspendido no puede pedir');
// storage
const blob=new Blob([Buffer.from('/9j/4AAQ','base64')],{type:'image/jpeg'});
const ruid=(await rep.auth.getUser()).data.user.id,cuid=(await cli.auth.getUser()).data.user.id;
r=await rep.storage.from('ine').upload(ruid+'/t.jpg',blob,{upsert:true});ck(!r.error,'repartidor sube INE a su carpeta');
r=await rep.storage.from('ine').upload(cuid+'/t.jpg',blob,{upsert:true});ck(!!r.error,'no puede subir a carpeta ajena');
r=await cli.storage.from('ine').download(ruid+'/t.jpg');ck(!!r.error,'cliente no puede ver INE ajena');
r=await due.storage.from('ine').download(ruid+'/t.jpg');ck(!r.error,'dueño ve INE');
console.log(fails?fails+' FALLAS':'TODO OK');process.exit(fails?1:0);
