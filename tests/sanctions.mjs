// v31: sanciones (directivo) visibles para el dueño; acceso bloqueado. Uso (desde /workspace/t): SID=<tienda prueba> PID=<producto> node sanctions.mjs
import {createClient as cc} from '@supabase/supabase-js';import WS from 'ws';
const U='https://qloxsilnuhqbgkgfdktx.supabase.co',K='sb_publishable_olBgCzXsfTndbBVe-QrMMg_RgR6w3Iv',SID=+process.env.SID,PID=+process.env.PID;let f=0;const orders=[];
const ck=(c,m)=>{console.log(c?'OK  ':'FAIL',m);if(!c)f++};const mk=()=>cc(U,K,{auth:{persistSession:false},realtime:{transport:WS}});
const rpc=async(c,fn,a)=>{const {data,error}=await c.rpc(fn,a||{});return error?{err:error.message}:(data??{ok:1})};
const login=async e=>{const c=mk();await c.auth.signInWithPassword({email:e,password:'Prueba-12345'});return c};
const due=await login('mt-test-due@mandados-test.dev'),dir=await login('mt-test-dir@mandados-test.dev'),rep=await login('mt-test-rep@mandados-test.dev'),cli=await login('mt-test-cli@mandados-test.dev');
const RN='MT Test Rep',CK='cli:mt-test-cli@mandados-test.dev',RK='rep:'+RN;
const order=async()=>{const o=await cli.rpc('create_order',{p:{cat:'abarrotes',det:{storeId:SID,items:[{pid:PID,q:1}]},nombre:'Cliente sanción (test)',tel:'3196660011',dir:'Calle test 11',zona:0,pago:'tarjeta',sinUbic:1}});if(o.data?.id)orders.push(o.data.id);return o};
// realtime del dueño
let rt=0;const ch=due.channel('t-sanc').on('postgres_changes',{event:'*',schema:'public',table:'sanctions'},()=>rt++).on('postgres_changes',{event:'*',schema:'public',table:'repartidor_registrations'},()=>rt++);await new Promise(r=>ch.subscribe(s=>s==='SUBSCRIBED'&&r()));
// registro del repartidor: dueño aprueba por RPC, directivo lo ve
let r=await rpc(rep,'rep_register',{p_nombre:RN,p_data:{nombre:RN,st:'pendiente',t:Date.now(),tel:'3196660012',fotos:{},calle:'Test',num:'1',col:'Centro',ciudad:'Tuxpan'}});ck(!r.err,'repartidor envía registro '+(r.err||''));
ck((await rpc(cli,'review_rep_registration',{p_nombre:RN,p_ok:true})).err!=null,'cliente no puede aprobar');
r=await rpc(due,'review_rep_registration',{p_nombre:RN,p_ok:true});ck(r.st==='aprobado'&&r.rev.por==='Dueño','dueño aprueba (servidor)');
let {data:rg}=await dir.from('repartidor_registrations').select('data').eq('nombre',RN).single();ck(rg.data.st==='aprobado'&&rg.data.rev.por==='Dueño','directivo ve la aprobación del dueño');
ck((await rpc(due,'review_rep_registration',{p_nombre:RN,p_ok:false,p_mot:'x'})).err?.includes('revisado'),'no se revisa dos veces');
await rpc(due,'sync_docs',{coll:'regs',entries:{[RN]:{...rg.data,st:'rechazado'}}});({data:rg}=await dir.from('repartidor_registrations').select('data').eq('nombre',RN).single());ck(rg.data.st==='aprobado','el blob viejo ya no cambia el estado');
// el repartidor aprobado comparte ubicación
ck(!(await rpc(rep,'update_my_location',{p_lat:21.94,p_lng:-105.29,p_acc:10})).err,'repartidor activo comparte ubicación');
// sanciones: solo directivo
ck((await rpc(due,'set_sanction',{p_key:RK,p_acc:'Dar de baja',p_mot:'Prueba'})).err?.includes('directivo'),'dueño no puede dar de baja');
await rpc(due,'sync_docs',{coll:'sanc',entries:{[RK]:{st:'baja'}}});ck(!(await due.from('sanctions').select('key').eq('key',RK)).data?.length,'el blob viejo ya no crea sanciones');
let s=await rpc(dir,'set_sanction',{p_key:RK,p_acc:'Dar de baja',p_mot:'Documentos falsos',p_nota:'Prueba'});ck(s[RK]?.st==='baja'&&s[RK].por==='Directivo','directivo da de baja al repartidor');
const {data:sd}=await due.from('sanctions').select('data').eq('key',RK).single();ck(sd.data.st==='baja'&&sd.data.mot==='Documentos falsos'&&sd.data.por==='Directivo','dueño ve la baja, el motivo y "por Directivo"');
ck((await rpc(rep,'update_my_location',{p_lat:21.94,p_lng:-105.29,p_acc:10})).err!=null,'repartidor dado de baja no comparte ubicación');
const locs=await rpc(due,'get_driver_locations');ck(!JSON.stringify(locs).includes(RN),'ya no aparece en el mapa del dueño');
const {data:own}=await rep.from('sanctions').select('data').eq('key',RK);ck(own?.length===1,'el repartidor ve su propia baja');
const o1=await order();ck(o1.data?.id,'cliente activo hace pedido');
ck((await rpc(rep,'sync_order',{p:{id:o1.data.id,rep:RN}})).err!=null,'repartidor dado de baja no puede tomar pedido');
const {data:oo}=await due.from('orders').select('data').eq('id',o1.data.id).single();ck(!oo||oo.data.rep!==RN,'el pedido no quedó asignado al dado de baja');
// cliente suspendido
s=await rpc(dir,'set_sanction',{p_key:CK,p_acc:'Suspender',p_dias:3,p_mot:'Pedidos falsos'});ck(s[CK]?.st==='suspendido'&&s[CK].hasta>Date.now(),'directivo suspende al cliente 3 días');
const o2=await order();ck(o2.error&&/bloqueado/.test(o2.error.message),'cliente suspendido no puede pedir');
const {data:co}=await cli.from('sanctions').select('data').eq('key',CK);ck(co?.length===1,'el cliente ve su suspensión');
// reactivar solo directivo
ck((await rpc(due,'set_sanction',{p_key:CK,p_acc:'Reactivar',p_mot:'x'})).err!=null,'dueño no puede quitar la suspensión');
s=await rpc(dir,'set_sanction',{p_key:CK,p_acc:'Reactivar',p_mot:'Aclarado'});ck(s[CK].st==='activo','directivo reactiva');const o3=await order();ck(o3.data?.id,'cliente reactivado vuelve a pedir');
await rpc(dir,'set_sanction',{p_key:RK,p_acc:'Reactivar',p_mot:'Aclarado'});ck(!(await rpc(rep,'update_my_location',{p_lat:21.94,p_lng:-105.29,p_acc:10})).err,'repartidor reactivado comparte ubicación');
const {data:au}=await due.from('audit_log').select('data').in('key',[RK,CK]);const acc=(au||[]).map(a=>a.data.acc);
ck(['Registro aprobado','Dar de baja','Suspender (3 días)','Reactivar'].every(x=>acc.includes(x)),'auditoría en el servidor');
await new Promise(r=>setTimeout(r,1500));ck(rt>=4,'el dueño recibe los cambios en tiempo real ('+rt+' eventos)');
await rpc(rep,'stop_sharing_location');
console.log('ORDERS='+orders.join(','));console.log(f?f+' FALLOS':'TODO OK');process.exit(f?1:0)
