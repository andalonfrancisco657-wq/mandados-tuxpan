// Mapa: RLS de ubicaciones y alertas. Uso: MT_TEST_STORE=<id> MT_TEST_PROD=<id> node map_rls.mjs  (imprime ORDER=<id>)
import {createClient as cc} from '@supabase/supabase-js';import WS from 'ws';
const U='https://qloxsilnuhqbgkgfdktx.supabase.co',K='sb_publishable_olBgCzXsfTndbBVe-QrMMg_RgR6w3Iv',SID=+process.env.MT_TEST_STORE,PID=+process.env.MT_TEST_PROD;
const mk=()=>cc(U,K,{auth:{persistSession:false},realtime:{transport:WS}});let f=0;const ck=(c,m)=>{console.log(c?'OK  ':'FAIL',m);if(!c)f++};
const login=async r=>{const c=mk();const x=await c.auth.signInWithPassword({email:`mt-test-${r}@mandados-test.dev`,password:'Prueba-12345'});if(x.error)throw x.error;return c};
const cli=await login('cli'),rep=await login('rep'),rep2=await login('rep2'),due=await login('due');
let r=await rep.rpc('update_my_location',{p_lat:21.9460,p_lng:-105.2950,p_acc:12});ck(!r.error,'repartidor comparte ubicación');
r=await rep2.rpc('update_my_location',{p_lat:21.9300,p_lng:-105.3100,p_acc:20});ck(!r.error,'repartidor 2 comparte ubicación');
r=await cli.rpc('update_my_location',{p_lat:1,p_lng:1});ck(!!r.error,'cliente no puede publicar ubicación');
for(const [n,c] of [['cliente',cli],['otro repartidor',rep2]]){r=await c.from('driver_locations').select('*');ck(!r.error&&r.data.length===0,n+' no lee ubicaciones');
 r=await c.rpc('get_driver_locations');ck(!!r.error,n+' no puede usar get_driver_locations')}
const tab=mk();await tab.auth.signInAnonymously();r=await tab.from('driver_locations').select('*');ck(r.data.length===0,'tablet/anónimo no lee ubicaciones');
r=await mk().from('driver_locations').select('*');ck(!!r.error||r.data.length===0,'sin sesión no lee ubicaciones');
r=await due.rpc('get_driver_locations');ck(!r.error&&r.data.filter(d=>/Test Rep/.test(d.nombre)).length===2,'dueño ve ubicaciones');
// pedido de prueba en la tienda de prueba
const o=await cli.rpc('create_order',{p:{cat:'abarrotes',det:{storeId:SID,items:[{pid:PID,q:1}]},nombre:'Cliente mapa (test)',tel:'3196660001',dir:'Calle test 1',zona:0,pago:'efectivo'}});ck(!o.error,'pedido de prueba creado');
const rid=(await rep.auth.getUser()).data.user.id;
r=await cli.rpc('send_driver_alert',{p_driver:rid,p_store:SID,p_order:o.data.id});ck(!!r.error,'cliente no puede enviar alertas');
r=await rep2.rpc('send_driver_alert',{p_driver:rid,p_store:SID,p_order:o.data.id});ck(!!r.error,'repartidor no puede enviar alertas');
r=await due.rpc('send_driver_alert',{p_driver:rid,p_store:SID,p_order:o.data.id,p_msg:'prueba rls'});ck(!r.error,'dueño envía alerta');const aid=r.data;
r=await rep2.from('driver_alerts').select('*');ck(r.data.length===0,'otro repartidor no ve alertas ajenas');
r=await cli.from('driver_alerts').select('*');ck(r.data.length===0,'cliente no ve alertas');
r=await rep2.rpc('respond_driver_alert',{p_id:aid,p_status:'aceptada'});ck(!!r.error,'otro repartidor no puede aceptar la alerta');
r=await rep.from('driver_alerts').select('*');ck(r.data.some(a=>a.id===aid),'repartidor ve su alerta');
r=await rep.rpc('respond_driver_alert',{p_id:aid,p_status:'rechazada'});ck(!r.error,'repartidor rechaza la alerta (la del navegador usará una nueva)');
r=await cli.rpc('app_bootstrap');ck(!/21\.946|driver_loc/.test(JSON.stringify(r.data)),'bootstrap del cliente sin ubicaciones');
r=await rep2.rpc('stop_sharing_location');ck(!r.error,'repartidor 2 deja de compartir');
console.log('ORDER='+o.data.id+' ALERT='+aid);console.log(f?f+' FALLAS':'TODO OK');process.exit(f?1:0);
