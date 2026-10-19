// RLS: cliente/repartidor/sin sesión no leen solicitudes de tiendas ni pueden revisarlas
import {createClient as cc} from '@supabase/supabase-js';import WS from 'ws';
const U='https://qloxsilnuhqbgkgfdktx.supabase.co',K='sb_publishable_olBgCzXsfTndbBVe-QrMMg_RgR6w3Iv';
const mk=()=>cc(U,K,{auth:{persistSession:false},realtime:{transport:WS}});let f=0;const ck=(c,m)=>{console.log(c?'OK  ':'FAIL',m);if(!c)f++};
const login=async r=>{const c=mk();await c.auth.signInWithPassword({email:`mt-test-${r}@mandados-test.dev`,password:'Prueba-12345'});return c};
const nos=mk();let r=await nos.rpc('request_store_activation',{p:{nombre:'X tienda',tipo:'otro',direccion:'Calle 12345',encargado:'Nadie',tel:'3190000009'}});ck(!!r.error,'sin sesión no puede enviar');
r=await nos.from('store_activation_requests').select('*');ck(!!r.error||r.data.length===0,'sin sesión no lee');
for(const k of ['cli','rep']){const c=await login(k);r=await c.from('store_activation_requests').select('*');ck(!r.error&&r.data.length===0,k+' no lee solicitudes');
 r=await c.rpc('review_store_request',{p_id:1,p_approve:true});ck(!!r.error,k+' no puede aprobar');
 r=await c.from('store_activation_requests').insert({nombre:'x',tipo:'otro',direccion:'x',encargado:'x',tel:'1'});ck(!!r.error,k+' no inserta directo');
 r=await c.rpc('app_bootstrap');ck(!/3195550001|Rosa P|encargado|telEnc/.test(JSON.stringify(r.data)),k+' bootstrap sin datos de solicitudes')}
const a=mk();await a.auth.signInAnonymously();r=await a.rpc('request_store_activation',{p:{nombre:'Anon tienda',tipo:'otro',direccion:'Calle 12345',encargado:'Anon',tel:'3190000008'}});ck(!r.error,'anónimo envía vía RPC');
r=await a.from('store_activation_requests').select('*');ck(r.data.length===0,'anónimo no lee la tabla');r=await a.rpc('my_store_requests');ck(r.data.length===1,'anónimo ve solo su estado');
r=await a.from('store_activation_requests').update({status:'aprobada'}).gt('id',0);ck(!!r.error,'anónimo no actualiza');
const d=await login('due');r=await d.from('store_activation_requests').select('*');ck(r.data.length>=1,'dueño lee solicitudes');
console.log(f?f+' FALLAS':'TODO OK');process.exit(f?1:0);
