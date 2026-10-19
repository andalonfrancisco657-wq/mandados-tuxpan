// Ayudante para step_proofs_ui.py: crea un pedido de prueba y lo deja en el paso pedido. Uso: node step_helper.mjs <store> <prod> <hasta: recoger|camino> [handoff]
import {createClient as cc} from '@supabase/supabase-js';import WS from 'ws';
const U='https://qloxsilnuhqbgkgfdktx.supabase.co',K='sb_publishable_olBgCzXsfTndbBVe-QrMMg_RgR6w3Iv';const [SID,PID,HASTA,HO]=process.argv.slice(2);
const mk=()=>cc(U,K,{auth:{persistSession:false},realtime:{transport:WS}});const login=async r=>{const c=mk();await c.auth.signInWithPassword({email:`mt-test-${r}@mandados-test.dev`,password:'Prueba-12345'});return c};
const cli=await login(process.env.MT_CLI||'cli'),rep=await login('rep'),due=await login('due');
const o=(await cli.rpc('create_order',{p:{cat:'abarrotes',det:{storeId:+SID,items:[{pid:+PID,q:1}]},nombre:'Cliente UI (test)',tel:'3196660003',dir:'Calle test 3',zona:0,pago:'efectivo'}})).data;const id=o.id;
await rep.rpc('sync_order',{p:{id,rep:'Test Rep Uno'}});await rep.rpc('rep_step',{p_id:id,p_action:'avanzar'});await rep.rpc('rep_step',{p_id:id,p_action:'avanzar'});
if(HASTA!=='recoger')await rep.rpc('sync_order',{p:{id,compra:{kind:'tienda',foto:'tk:ui',monto:0,t:Date.now()}}});
let tabId='';if(HO||HASTA==='camino'){const code=(await due.rpc('gen_tablet_code',{p_store:+SID})).data;const tab=mk();await tab.auth.signInAnonymously();tabId=(await tab.auth.getUser()).data.user.id;await tab.rpc('redeem_tablet_code',{p_store:+SID,p_code:code});
 await tab.rpc('sync_order',{p:{id,tacc:{t:Date.now()},prep:{t:Date.now()}}});if(HASTA==='camino'||HO==='handoff')await tab.rpc('tienda_handoff',{p_id:id})}
if(HASTA==='camino')await rep.rpc('rep_step',{p_id:id,p_action:'recogido'});
console.log(JSON.stringify({id,code:o.order.delivCode,tab:tabId}));process.exit()
