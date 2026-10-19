// v29: estados de tienda. Uso (desde /workspace/t): S1=<prueba> S2=<prueba> S3=<prueba> node store_states.mjs
import {createClient as cc} from '@supabase/supabase-js';import WS from 'ws';
const U='https://qloxsilnuhqbgkgfdktx.supabase.co',K='sb_publishable_olBgCzXsfTndbBVe-QrMMg_RgR6w3Iv',S1=+process.env.S1,S2=+process.env.S2,S3=+process.env.S3;let f=0;const uids=[];
const ck=(c,m)=>{console.log(c?'OK  ':'FAIL',m);if(!c)f++};const mk=()=>cc(U,K,{auth:{persistSession:false},realtime:{transport:WS}});
const rpc=async(c,fn,a)=>{const {data,error}=await c.rpc(fn,a||{});return error?{err:error.message}:data};
const login=async e=>{const c=mk();await c.auth.signInWithPassword({email:e,password:'Prueba-12345'});return c};
const anon=async()=>{const c=mk();const {data}=await c.auth.signInAnonymously();uids.push(data.user.id);return c};
const due=await login('mt-test-due@mandados-test.dev'),dir=await login('mt-test-dir@mandados-test.dev'),cli=await anon(),pub=mk();
const ids=L=>(Array.isArray(L)?L:[]).map(s=>s.id);
// tablet de S2 con sesión
const code=await rpc(due,'gen_tablet_code',{p_store:S2});const tab=await anon();ck(await rpc(tab,'redeem_tablet_code',{p_store:S2,p_code:code})===true,'tablet S2 entra');
ck((await rpc(cli,'store_state',{p_store:S1,p_action:'deactivate'})).err!=null,'cliente no puede cambiar estado');
ck((await rpc(tab,'store_state',{p_store:S2,p_action:'delete'})).err!=null,'tablet no puede eliminar');
let c=await rpc(due,'store_state',{p_store:S1,p_action:'deactivate',p_motivo:'Cerrada por vacaciones'});const s1=c.find(s=>s.id===S1);ck(s1.act===0&&s1.inMot==='Cerrada por vacaciones','dueño desactiva con motivo');
c=await rpc(due,'store_state',{p_store:S2,p_action:'delete',p_motivo:'Prueba'});const s2=c.find(s=>s.id===S2);ck(s2.del>0&&s2.act===0,'dueño elimina (borrado suave)');
const cat=await rpc(cli,'get_catalog');ck(!ids(cat).includes(S1)&&!ids(cat).includes(S2)&&ids(cat).includes(S3),'cliente no ve inactiva ni eliminada');
const {data:raw}=await pub.from('stores').select('id').in('id',[S1,S2,S3]);ck(raw&&raw.length===1&&raw[0].id===S3,'RLS: anónimo solo ve la activa');
const ll=await rpc(pub,'store_login_list');ck(!ids(ll).includes(S2)&&!ids(ll).includes(S1),'lista de tablets sin inactiva/eliminada');
ck((await rpc(tab,'my_store_auth'))===null,'la tablet de la eliminada queda fuera');
const t2=await anon();ck((await rpc(t2,'redeem_tablet_code',{p_store:S2,p_code:code})).err!=null||false,'no se puede entrar a la eliminada');
const ad=await rpc(due,'get_catalog');ck(ids(ad).includes(S1)&&ids(ad).includes(S2),'dueño sí ve inactiva y eliminada');
// sync de un cliente viejo no revive la eliminada
const st=ad.find(s=>s.id===S2);await rpc(due,'sync_catalog',{p_stores:[{...st,act:1}]});ck((await rpc(due,'get_catalog')).find(s=>s.id===S2).act===0,'guardar catálogo viejo no reactiva la eliminada');
ck((await rpc(due,'store_state',{p_store:S2,p_action:'reactivate'})).err?.includes('restaura'),'no se reactiva sin restaurar');
c=await rpc(dir,'store_state',{p_store:S2,p_action:'restore'});ck(c.find(s=>s.id===S2).del==null&&c.find(s=>s.id===S2).act===0,'directivo restaura → queda inactiva');
c=await rpc(dir,'store_state',{p_store:S2,p_action:'reactivate'});ck(c.find(s=>s.id===S2).act===1,'directivo reactiva');
c=await rpc(due,'store_state',{p_store:S1,p_action:'reactivate'});ck(c.find(s=>s.id===S1).act===1&&!c.find(s=>s.id===S1).inMot,'dueño reactiva S1');
ck(ids(await rpc(cli,'get_catalog')).includes(S2),'cliente vuelve a ver la reactivada');
const {data:au}=await dir.from('audit_log').select('data').in('key',['tienda:MT Test Uno','tienda:MT Test Dos']);const acc=(au||[]).map(a=>a.data.acc);
ck(['Tienda desactivada','Tienda eliminada','Tienda restaurada','Tienda reactivada'].every(x=>acc.includes(x)),'auditoría registrada');
console.log('UIDS='+uids.join(','));console.log(f?f+' FALLOS':'TODO OK');process.exit(f?1:0)
