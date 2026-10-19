// v32: vehículo y licencia. Uso (desde /workspace/t): SID= PID= node vehicle_license.mjs  (imprime IDS para limpiar)
import {createClient as cc} from '@supabase/supabase-js';import WS from 'ws';
const U='https://qloxsilnuhqbgkgfdktx.supabase.co',K='sb_publishable_olBgCzXsfTndbBVe-QrMMg_RgR6w3Iv',SID=+process.env.SID,PID=+process.env.PID;let f=0;const orders=[],anons=[];
const ck=(c,m)=>{console.log(c?'OK  ':'FAIL',m);if(!c)f++};const mk=()=>cc(U,K,{auth:{persistSession:false},realtime:{transport:WS}});
const rpc=async(c,fn,a)=>{const {data,error}=await c.rpc(fn,a||{});return error?{err:error.message}:(data??{ok:1})};
const login=async e=>{const c=mk();const {data}=await c.auth.signInWithPassword({email:e,password:'Prueba-12345'});c.uid=data.user.id;return c};
const due=await login('mt-test-due@mandados-test.dev'),dir=await login('mt-test-dir@mandados-test.dev'),rep=await login('mt-test-rep@mandados-test.dev'),old=await login('mt-test-rep2@mandados-test.dev');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
const up=async(c,key)=>{const path=c.uid+'/'+key.replace(/[^a-zA-Z0-9._-]/g,'_')+'.jpg';const {error}=await c.storage.from('ine').upload(path,png,{upsert:true,contentType:'image/jpeg'});if(error)throw error;await rpc(c,'photo_register',{p_key:key,p_bucket:'ine',p_path:path});return key};
const fut=n=>new Date(Date.now()+n*864e5).toISOString().slice(0,10);
const RN='MT Test Moto',base={id:'rmtmoto',nombre:RN,st:'pendiente',t:Date.now(),tel:'3196660031',calle:'Test',num:'1',col:'Centro',ciudad:'Tuxpan',fotos:{},mtTest:1};
// registro nuevo: vehículo obligatorio
let r=await rpc(rep,'rep_register',{p_nombre:RN,p_data:base});ck(r.err?.includes('vehículo'),'registro sin vehículo rechazado');
r=await rpc(rep,'rep_register',{p_nombre:RN,p_data:{...base,veh:'moto'}});ck(r.err?.includes('licencia'),'moto sin licencia rechazada');
const lf=await up(rep,'reg:rmtmoto:licF-a'),lr=await up(rep,'reg:rmtmoto:licR-a');
r=await rpc(rep,'rep_register',{p_nombre:RN,p_data:{...base,veh:'moto',lic:{num:'NAY12345',tipo:'Motociclista',vence:fut(-1),fotos:{licF:lf,licR:lr}}}});ck(r.err?.includes('vencida'),'licencia vencida rechazada');
r=await rpc(rep,'rep_register',{p_nombre:RN,p_data:{...base,veh:'moto',lic:{num:'NAY12345',tipo:'Motociclista',vence:fut(400),fotos:{licF:'reg:otro:licF',licR:lr}}}});ck(r.err?.includes('fotos'),'fotos que no son suyas rechazadas');
r=await rpc(rep,'rep_register',{p_nombre:RN,p_data:{...base,veh:'moto',placas:'ABC-123-D',lic:{num:'NAY12345',tipo:'Motociclista',vence:fut(400),fotos:{licF:lf,licR:lr}}}});ck(!r.err,'registro con moto y licencia '+(r.err||''));
// privacidad de las fotos
ck((await rpc(due,'photo_lookup',{p_key:lf}))?.bucket==='ine','dueño puede abrir la foto de la licencia');
const anon=mk();const {data:ad}=await anon.auth.signInAnonymously();anons.push(ad.user.id);
ck(!(await anon.rpc('photo_lookup',{p_key:lf})).data,'otro usuario no puede abrir la licencia');
ck((await anon.storage.from('ine').download(rep.uid+'/reg_rmtmoto_licF-a.jpg')).error!=null,'descarga directa bloqueada para otros');
ck((await anon.from('repartidor_registrations').select('nombre').eq('nombre',RN)).data?.length===0,'RLS: otros no ven el registro');
// el dueño aprueba y ve los datos
let {data:rg}=await dir.from('repartidor_registrations').select('data').eq('nombre',RN).single();ck(rg.data.veh==='moto'&&rg.data.lic.num==='NAY12345'&&rg.data.placas==='ABC-123-D','directivo ve vehículo, licencia y placas');
await rpc(due,'review_rep_registration',{p_nombre:RN,p_ok:true});
// el blob viejo no puede cambiar la licencia
await rpc(rep,'sync_docs',{coll:'regs',entries:{[RN]:{...rg.data,lic:{...rg.data.lic,vence:'2099-01-01'}}}});({data:rg}=await due.from('repartidor_registrations').select('data').eq('nombre',RN).single());ck(rg.data.lic.vence===fut(400),'no se cambia la licencia por el blob');
// pedido para probar aceptación
const cli=mk();const {data:cd}=await cli.auth.signInAnonymously();anons.push(cd.user.id);
const mkO=async()=>{const o=await cli.rpc('create_order',{p:{cat:'abarrotes',det:{storeId:SID,items:[{pid:PID,q:1}]},nombre:'Cliente veh (test)',tel:'3196660032',dir:'Calle test 32',zona:0,pago:'tarjeta',sinUbic:1}});if(o.data?.id)orders.push(o.data.id);return o.data};
// licencia vencida (se simula moviendo la fecha del registro de prueba)
const exp=async d=>{await fetch;};
console.log('EXPIRE_NOW');await new Promise(r=>{process.stdin.once('data',r)});
const o1=await mkO();r=await rpc(rep,'sync_order',{p:{id:o1.id,rep:RN}});ck(r.err!=null,'licencia vencida: no puede aceptar pedidos ('+(r.err||'')+')');
// renovación
r=await rpc(rep,'rep_vehicle_update',{p_data:{veh:'moto',lic:{num:'NAY99999',tipo:'Motociclista',vence:fut(-3),fotos:{licF:lf,licR:lr}}}});ck(r.err?.includes('vencida'),'renovación con fecha vencida rechazada');
const lf2=await up(rep,'reg:rmtmoto:licF-b'),lr2=await up(rep,'reg:rmtmoto:licR-b');
r=await rpc(rep,'rep_vehicle_update',{p_data:{veh:'moto',placas:'ABC-123-D',lic:{num:'NAY99999',tipo:'Motociclista',vence:fut(800),fotos:{licF:lf2,licR:lr2}}}});ck(r.vehPend?.lic?.num==='NAY99999'&&r.lic.num==='NAY12345','renovación queda en revisión (la anterior sigue)');
ck((await rpc(rep,'review_vehicle',{p_nombre:RN,p_ok:true})).err!=null,'el repartidor no se aprueba solo');
r=await rpc(due,'review_vehicle',{p_nombre:RN,p_ok:true});ck(r.lic?.num==='NAY99999'&&!r.vehPend&&r.vehRev.por==='Dueño','dueño aprueba la renovación');
const o2=await mkO();r=await rpc(rep,'sync_order',{p:{id:o2.id,rep:RN}});ck(!r.err,'con licencia vigente vuelve a aceptar pedidos '+(r.err||''));
// repartidor viejo sin vehículo: sigue igual; completa → revisión; bici sin licencia
const o3=await mkO();r=await rpc(old,'sync_order',{p:{id:o3.id,rep:'MT Test Viejo'}});ck(!r.err,'repartidor existente sin vehículo no se bloquea '+(r.err||''));
r=await rpc(old,'rep_vehicle_update',{p_data:{veh:'bici'}});ck(r.vehPend?.veh==='bici'&&r.st==='aprobado'&&!r.veh,'existente completa (bici, sin licencia) → en revisión sin cambiar su estado');
r=await rpc(dir,'review_vehicle',{p_nombre:'MT Test Viejo',p_ok:false,p_mot:'Prueba de rechazo'});ck(r.vehRej?.mot==='Prueba de rechazo'&&!r.vehPend,'directivo rechaza con motivo');
r=await rpc(old,'rep_vehicle_update',{p_data:{veh:'bici'}});r=await rpc(dir,'review_vehicle',{p_nombre:'MT Test Viejo',p_ok:true});ck(r.veh==='bici'&&!r.lic,'aprobado: bicicleta sin licencia');
const {data:au}=await due.from('audit_log').select('data').in('key',['rep:'+RN,'rep:MT Test Viejo']);const acc=(au||[]).map(a=>a.data.acc);ck(acc.includes('Licencia/vehículo aprobado')&&acc.includes('Licencia/vehículo rechazado'),'auditoría');
console.log('ORDERS='+orders.join(','));console.log('ANONS='+anons.join(','));console.log(f?f+' FALLOS':'TODO OK');process.exit(f?1:0)
