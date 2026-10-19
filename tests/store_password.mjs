// v28: contraseña de tienda. Uso (desde /workspace/t): A=<tienda prueba> B=<tienda prueba> node store_password.mjs ; imprime UIDS= para limpiar
import {createClient as cc} from '@supabase/supabase-js';import WS from 'ws';
const U='https://qloxsilnuhqbgkgfdktx.supabase.co',K='sb_publishable_olBgCzXsfTndbBVe-QrMMg_RgR6w3Iv',A=+process.env.A,B=+process.env.B;let f=0;const uids=[];
const ck=(c,m)=>{console.log(c?'OK  ':'FAIL',m);if(!c)f++};
const mk=()=>cc(U,K,{auth:{persistSession:false},realtime:{transport:WS}});
const anon=async()=>{const c=mk();const {data,error}=await c.auth.signInAnonymously();if(error)throw error;uids.push(data.user.id);return c};
const rpc=async(c,fn,a)=>{const {data,error}=await c.rpc(fn,a||{});return error?{err:error.message}:data};
const due=mk();await due.auth.signInWithPassword({email:'mt-test-due@mandados-test.dev',password:'Prueba-12345'});
const codeA=await rpc(due,'gen_tablet_code',{p_store:A}),codeB=await rpc(due,'gen_tablet_code',{p_store:B});
// primera vez: código -> sin contraseña -> crear
const t1=await anon();ck(await rpc(t1,'redeem_tablet_code',{p_store:A,p_code:codeA})===true,'entra con código');
let a=await rpc(t1,'my_store_auth');ck(a&&a.hasPw===false&&a.store===A,'sin contraseña aún');
ck((await rpc(t1,'set_store_password',{p_new:'corta'})).err?.includes('8'),'mínimo 8 caracteres');
a=await rpc(t1,'set_store_password',{p_new:'TiendaA-2026'});ck(a&&a.hasPw&&a.via==='pw','contraseña creada; la sesión pasa a contraseña');
const tb=await anon();await rpc(tb,'redeem_tablet_code',{p_store:B,p_code:codeB});await rpc(tb,'set_store_password',{p_new:'TiendaB-2026'});
// el hash no se puede leer
ck((await t1.from('store_auth').select('*')).error!=null,'tabla de contraseñas no accesible desde la API');
const L=await rpc(mk(),'store_login_list');ck(Array.isArray(L)&&L.find(s=>s.id===A)?.pw===true&&!JSON.stringify(L).includes('$2'),'lista pública sin hash');
// login con contraseña
const t2=await anon();ck((await rpc(t2,'login_store_password',{p_store:A,p_pw:'TiendaA-2026'})).ok===true,'entra con contraseña');
ck((await rpc(t2,'my_store_auth'))?.store===A,'sesión ligada a la tienda A');
// contraseña de otra tienda
const t3=await anon();ck((await rpc(t3,'login_store_password',{p_store:A,p_pw:'TiendaB-2026'})).ok===false,'contraseña de la tienda B no abre la A');
ck((await rpc(t3,'my_store_auth'))===null,'sin tienda tras fallar');
// bloqueo tras 5 intentos
for(let i=0;i<4;i++)await rpc(t3,'login_store_password',{p_store:A,p_pw:'mala-'+i});
let r=await rpc(t3,'login_store_password',{p_store:A,p_pw:'TiendaA-2026'});ck(r.ok===false&&/Demasiados/.test(r.msg),'5 fallos → bloqueado aunque ahora sea correcta ('+r.msg+')');
const t4=await anon();ck((await rpc(t4,'login_store_password',{p_store:A,p_pw:'TiendaA-2026'})).ok===true,'otra sesión sigue pudiendo entrar (bloqueo por tienda+sesión)');
// código nuevo NO saca a las sesiones con contraseña
await rpc(due,'gen_tablet_code',{p_store:A});ck((await rpc(t2,'my_store_auth'))?.store===A,'generar código nuevo no cierra la sesión con contraseña');
// cambiar contraseña requiere la actual
ck((await rpc(t2,'set_store_password',{p_new:'TiendaA-nueva1',p_current:'x'})).err?.includes('actual'),'cambiar exige contraseña actual');
ck((await rpc(t2,'set_store_password',{p_new:'TiendaA-nueva1',p_current:'TiendaA-2026'})).hasPw===true,'cambio con la actual correcta');
// salir y volver a entrar
await t2.auth.signOut();const t5=await anon();ck((await rpc(t5,'login_store_password',{p_store:A,p_pw:'TiendaA-nueva1'})).ok===true,'Salir y volver a entrar con la contraseña nueva');
// no-admin no puede usar controles
ck((await rpc(t5,'store_auth_action',{p_store:A,p_action:'close_sessions'})).err!=null,'la tablet no puede usar controles del dueño');
// cerrar sesiones
let sa=await rpc(due,'store_auth_action',{p_store:A,p_action:'close_sessions'});ck(sa[A].ses===0,'dueño: cerrar sesiones');
ck((await rpc(t5,'my_store_auth'))===null&&(await rpc(t4,'my_store_auth'))===null,'tablets fuera tras cerrar sesiones');
ck((await rpc(tb,'my_store_auth'))?.store===B,'la tienda B no se ve afectada');
// bloqueo
await rpc(due,'store_auth_action',{p_store:A,p_action:'block'});const t6=await anon();
r=await rpc(t6,'login_store_password',{p_store:A,p_pw:'TiendaA-nueva1'});ck(r.ok===false&&/bloqueada/.test(r.msg),'tienda bloqueada: contraseña rechazada');
const c2=await rpc(due,'gen_tablet_code',{p_store:A});r=await rpc(t6,'redeem_tablet_code',{p_store:A,p_code:c2});ck(r.err&&/bloqueada/.test(r.err),'tienda bloqueada: código rechazado');
await rpc(due,'store_auth_action',{p_store:A,p_action:'unblock'});
// restablecer
ck((await rpc(t6,'login_store_password',{p_store:A,p_pw:'TiendaA-nueva1'})).ok===true,'desbloqueada: entra');
sa=await rpc(due,'store_auth_action',{p_store:A,p_action:'reset_pw'});ck(sa[A].hasPw===false,'dueño: restablecer contraseña');
ck((await rpc(t6,'my_store_auth'))===null,'restablecer saca a la tablet');
const t7=await anon();r=await rpc(t7,'login_store_password',{p_store:A,p_pw:'TiendaA-nueva1'});ck(r.ok===false&&/código/.test(r.msg),'sin contraseña: debe usar código');
ck((await rpc(t7,'redeem_tablet_code',{p_store:A,p_code:c2}))!==true,'el código anterior quedó desactivado');
const c3=await rpc(due,'gen_tablet_code',{p_store:A});ck(await rpc(t7,'redeem_tablet_code',{p_store:A,p_code:c3})===true,'código nuevo funciona');
ck((await rpc(t7,'my_store_auth'))?.hasPw===false,'y pide crear contraseña otra vez');
// recuperación: con contraseña y entrando por código, se puede cambiar sin la actual
await rpc(t7,'set_store_password',{p_new:'TiendaA-otra22'});const t8=await anon();await rpc(t8,'redeem_tablet_code',{p_store:A,p_code:c3});
ck((await rpc(t8,'set_store_password',{p_new:'TiendaA-recup1'})).hasPw===true,'recuperación por código: cambia sin la actual');
console.log('UIDS='+uids.join(','));console.log(f?f+' FALLOS':'TODO OK');process.exit(f?1:0)
