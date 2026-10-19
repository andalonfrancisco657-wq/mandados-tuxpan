// Mandados Tuxpan · capa de datos con Supabase (servidor compartido entre las 5 versiones)
// Solo se usa la llave pública (publishable). Los permisos los aplica el servidor (RLS + funciones).
(function(){
const SB_URL='https://qloxsilnuhqbgkgfdktx.supabase.co',SB_KEY='sb_publishable_olBgCzXsfTndbBVe-QrMMg_RgR6w3Iv';
const R=window.APP_ROLE||'cliente';
const sb=supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'mt-auth-'+R}});
const DICTS=['regs','sanc','bank','pagos','credito','notes'],LISTS=['quejas','cashIn','tReq','pChg'];
const J=x=>JSON.stringify(x===undefined?null:x),clone=x=>x==null?x:JSON.parse(J(x));
const noTab=s=>{const c=Object.assign({},s);delete c.tab;return c};
const BK={sb,ME:null,boot:null,ready:false,snap:null,err:null};
window.BK=BK;
BK._chk=null;
// v26: si la sesión guardada ya no existe en el servidor (usuario borrado, sesión revocada), se limpia y se sigue como nuevo.
BK.checkSession=()=>BK._chk||(BK._chk=(async()=>{try{const ss=(await sb.auth.getSession()).data.session;if(!ss)return;const {data,error}=await sb.auth.getUser();
  // v27: solo se limpia si el servidor responde de forma definitiva que el usuario ya no existe (nunca por red caída, sin internet o token vencido)
  if(error&&(error.code==='user_not_found'||(error.status===403&&/does not exist/i.test(error.message||'')))){console.warn('sesión inválida, se reinicia',error&&error.message);
   try{await sb.auth.signOut({scope:'local'})}catch(_){}try{Object.keys(localStorage).filter(k=>k==='mt-auth-'+R||k.startsWith('mt-auth-'+R+'-')).forEach(k=>localStorage.removeItem(k))}catch(_){}BK.ME=null;BK.stale=true}}catch(e){}})());
BK.session=async()=>{await BK.checkSession();return (await sb.auth.getSession()).data.session};
BK.rpc=async(fn,args,_r)=>{await BK.checkSession();const {data,error}=await sb.rpc(fn,args||{});
 if(error&&!_r&&/^Sin sesi[oó]n$/.test(error.message)){BK._chk=null;await BK.checkSession();if(BK.stale&&!(await sb.auth.getSession()).data.session&&['tienda','cliente'].includes(window.APP_ROLE)){BK.stale=false;const a=await sb.auth.signInAnonymously();if(!a.error){try{BK.boot=await BK.rpc('app_bootstrap',{},1);BK.ME=BK.boot.me}catch(_){}return BK.rpc(fn,args,1)}}}
 if(error)throw new Error(error.message);return data};
const snapOf=()=>clone(Object.assign({orders:DB.orders,stores:(DB.stores||[]).map(noTab),cfg:DB.cfg,dirCfg:DB.dirCfg,audit:DB.audit},...DICTS.concat(LISTS).map(k=>({[k]:DB[k]}))));
function apply(bs,orders){
 if(bs){BK.boot=bs;BK.ME=bs.me||null;
  if(bs.stores)DB.stores=bs.stores;if(bs.cfg)DB.cfg=bs.cfg;if(bs.dirCfg)DB.dirCfg=Object.assign({tarde:60,mrgSug:10},bs.dirCfg);
  DB.reps=bs.reps||[];DB.duenos=bs.duenos||[];
  DICTS.forEach(k=>DB[k]=bs[k]||{});LISTS.forEach(k=>DB[k]=bs[k]||[]);DB.audit=bs.audit||[];
  if(R==='repartidor'&&BK.ME&&BK.ME.role==='repartidor')myRep=BK.ME.nombre}
 if(orders){const pend=(DB.orders||[]).filter(o=>!o.srv&&!o.ej);DB.orders=orders.concat(pend);DB.mine=R==='cliente'?orders.map(o=>o.id):[]}}
function show(){const r=JSON.stringify(DB);localStorage.setItem('mandados',r);
 if(typeof locked==='function'){if(locked()||(R==='cliente'&&typeof AV!=='undefined'&&AV[view])){lastRaw=r;const a=document.activeElement;if(!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)))render()}else{lastRaw=null;syncIn()}}}
function commit(){BK.snap=snapOf();show()}
BK.refresh=commit;
let pulling=false,again=false;
BK.pull=async()=>{if(pulling){again=true;return}pulling=true;
 try{const g0=BK.gen,s=await BK.session();const bs=await BK.rpc('app_bootstrap');const orders=s?await BK.rpc('get_orders'):[];
  const rl=bs&&bs.me&&bs.me.role;BK.sreq=(rl==='dueno'||rl==='directivo')?((await sb.from('store_activation_requests').select('*').order('id',{ascending:false})).data||[]):[];
  BK.myReq=(s&&R==='tienda'&&rl!=='tienda')?await BK.rpc('my_store_requests'):[];
  if(BK.pushing||pt||g0!==BK.gen){again=true;return}apply(bs,orders);BK.ready=true;BK.err=null;BK.fails=0;
  try{if(s&&bs&&bs.me)localStorage.setItem('mt-me-'+R,JSON.stringify({uid:s.user.id,me:bs.me}));else localStorage.removeItem('mt-me-'+R)}catch(_){}commit()}
 catch(e){console.warn('pull',e);BK.err=e.message;BK.fails=(BK.fails||0)+1;clearTimeout(BK._rt);BK._rt=setTimeout(BK.pull,Math.min(30000,2000*BK.fails)); // reintento rápido (p. ej. el celular aún no tiene internet al abrir)
  if(!BK.ready){BK.ready=true;try{render()}catch(_){}}}
 finally{pulling=false;if(again){again=false;setTimeout(BK.pull,300)}}};
BK.pullOrders=async()=>{if(BK.pushing||pt)return BK.soon();try{const g0=BK.gen;if(!(await BK.session()))return;const o=await BK.rpc('get_orders');if(BK.pushing||pt||g0!==BK.gen)return BK.soon();apply(null,o);commit()}catch(e){console.warn(e)}};
BK.soon=()=>{clearTimeout(BK._s);BK._s=setTimeout(BK.pullOrders,500)};
let pt=null;
BK.gen=0;BK.queue=()=>{BK.gen++;if(!BK.snap)return;clearTimeout(pt);pt=setTimeout(()=>{pt=null;BK.push()},200)};
const say=m=>{try{toast(m)}catch(_){}};
async function docs(coll,entries){if(!Object.keys(entries).length)return;try{await BK.rpc('sync_docs',{coll,entries})}catch(e){say('No se guardó en el servidor: '+e.message)}}
BK.push=async()=>{if(BK.pushing){BK.repush=true;return}BK.pushing=true;const S=BK.snap||{},N=clone(S)||{};N.orders=N.orders||[];let any=false;
 const snapO=(id,v)=>{const k=N.orders.findIndex(x=>x.id===id);if(k>=0)N.orders[k]=clone(v);else N.orders.push(clone(v))};
 try{const role=BK.ME&&BK.ME.role;
  for(const o of (DB.orders||[]).filter(o=>!o.srv&&!o.ej)){any=true;const old=o.id;
   try{if(!(await BK.session()))await BK.anon(true);const r=await BK.rpc('create_order',{p:o});
    Object.keys(o).forEach(k=>delete o[k]);Object.assign(o,r.order);snapO(r.id,r.order);if(track===old)track=r.id;
    if(BK.ME&&BK.ME.anon){const T=JSON.parse(localStorage.getItem('mt_guest_tokens')||'{}');T[r.id]=r.token;localStorage.setItem('mt_guest_tokens',JSON.stringify(T))}}
   catch(e){DB.orders.splice(DB.orders.indexOf(o),1);if(track===old){track=null;view='nuevo'}say('No se pudo enviar el pedido: '+e.message)}}
  const So=new Map((S.orders||[]).map(o=>[o.id,J(o)]));
  for(const o of (DB.orders||[]).filter(o=>o.srv)){const sent=J(o);if(So.get(o.id)===sent)continue;any=true;
   try{const r=await BK.rpc('sync_order',{p:JSON.parse(sent)});snapO(o.id,r);if(J(o)===sent){Object.keys(o).forEach(k=>delete o[k]);Object.assign(o,r)}else BK.repush=true}
   catch(e){snapO(o.id,JSON.parse(sent));say('No se guardó el pedido #'+o.id+': '+e.message)}}
  if(['dueno','directivo','tienda'].includes(role)){const Ss=new Map((S.stores||[]).map(s=>[s.id,J(s)]));const cur=(DB.stores||[]).map(noTab),ch=cur.filter(s=>Ss.get(s.id)!==J(s));
   if(ch.length){any=true;const sent=J(cur);N.stores=clone(cur);try{const cat=await BK.rpc('sync_catalog',{p_stores:ch});if(J((DB.stores||[]).map(noTab))===sent){DB.stores=cat;N.stores=cat.map(noTab)}else BK.repush=true}catch(e){say('No se guardó el catálogo: '+e.message)}}}
  if(role){
   for(const k of DICTS){const a=clone(DB[k]||{}),b=S[k]||{},e={};for(const x in a)if(J(a[x])!==J(b[x]))e[x]=a[x];N[k]=a;if(Object.keys(e).length){any=true;await docs(k,e)}}
   for(const k of LISTS){const a=clone(DB[k]||[]),b=new Map((S[k]||[]).map(x=>[x.id,J(x)])),e={};a.forEach(x=>{if(x&&x.id!=null&&b.get(x.id)!==J(x))e[x.id]=x});N[k]=a;if(Object.keys(e).length){any=true;await docs(k,e)}}
   const A=clone(DB.audit||[]),seen=new Set((S.audit||[]).map(J)),na=A.filter(x=>!seen.has(J(x)));N.audit=A;if(na.length){any=true;await docs('audit',Object.fromEntries(na.map((x,i)=>[String(i),x])))}
   const cf=clone(DB.cfg),dc=clone(DB.dirCfg);N.cfg=cf;N.dirCfg=dc;
   if(J(cf)!==J(S.cfg)){any=true;await docs('cfg',{cfg:cf})}
   if(J(dc)!==J(S.dirCfg)){any=true;await docs('dirCfg',{dirCfg:dc})}}
 }finally{BK.pushing=false;if(any){BK.snap=N;show();setTimeout(BK.pull,600)}if(BK.repush){BK.repush=false;setTimeout(BK.push,0)}}};
// ---- sesión
BK.signUp=async(email,password,meta)=>{const {data,error}=await sb.auth.signUp({email,password,options:{data:meta||{}}});if(error)throw new Error(trAuth(error.message));
 if(!data.session)throw new Error('Revisa tu correo para confirmar la cuenta y luego inicia sesión');await BK.pull()};
BK.signIn=async(email,password)=>{const {error}=await sb.auth.signInWithPassword({email,password});if(error)throw new Error(trAuth(error.message));await BK.pull()};
BK.signOut=async()=>{try{await sb.auth.signOut()}catch(e){}BK.ME=null;await BK.pull()};
BK.anon=async(quiet)=>{if(await BK.session())return;const {error}=await sb.auth.signInAnonymously();if(error)throw new Error(trAuth(error.message));if(!quiet)await BK.pull();else{BK.boot=await BK.rpc('app_bootstrap');BK.ME=BK.boot.me}};
const trAuth=m=>/Invalid login/i.test(m)?'Correo o contraseña incorrectos':/already registered|already been registered/i.test(m)?'Ya existe una cuenta con ese correo':/Password should/i.test(m)?'La contraseña debe tener al menos 8 caracteres':/rate limit/i.test(m)?'Demasiados intentos, espera un momento':m;
// ---- cuenta del cliente (perfil en el servidor; tarjetas: solo marca y últimos 4)
BK.accts=()=>{const A=clone((BK.boot&&BK.boot.accounts)||{}),m=BK.ME;if(m&&!m.anon&&m.email)A[m.email]={email:m.email,nombre:m.nombre,tel:m.tel||'',dirs:clone((m.data||{}).dirs||[]),tarjetas:clone((m.data||{}).tarjetas||[]),creado:0};return A};
BK.saveAccts=A=>{const m=BK.ME;if(!m||m.anon)return;const a=A[m.email];if(a)BK.saveProfile(a)};
BK.saveProfile=async a=>{const m=BK.ME;if(!m)return;const data={dirs:a.dirs||[],tarjetas:(a.tarjetas||[]).map(c=>({id:c.id,nombre:c.nombre||'',last4:String(c.last4||'').slice(-4),marca:c.marca||'Débito',exp:c.exp||'',t:c.t||Date.now()}))};
 m.nombre=a.nombre;m.tel=a.tel;m.data=data;const {error}=await sb.from('profiles').update({nombre:a.nombre,tel:a.tel,data}).eq('id',m.id);if(error)say('No se guardó tu perfil: '+error.message)};
// ---- fotos privadas (INE, selfie, tickets)
const bucketOf=k=>/^(prod|preq):\d+:/.test(k)?'product-photos':/^reg:.*:selfie$/.test(k)?'selfies':/^reg:/.test(k)?'ine':/^tk:/.test(k)?'tickets':null;
BK.upPhoto=async(k,v)=>{const b=bucketOf(k),s=await BK.session();if(!b||!s||typeof v!=='string')return;const blob=await (await fetch(v)).blob();
 const path=(b==='product-photos'?k.split(':')[1]:s.user.id)+'/'+k.replace(/[^a-zA-Z0-9._-]/g,'_')+'.jpg';const {error}=await sb.storage.from(b).upload(path,blob,{upsert:true,contentType:blob.type||'image/jpeg'});if(error)throw error;
 if(b!=='product-photos')await BK.rpc('photo_register',{p_key:k,p_bucket:b,p_path:path})};
BK.prodUrl=k=>sb.storage.from('product-photos').getPublicUrl(k.split(':')[1]+'/'+k.replace(/[^a-zA-Z0-9._-]/g,'_')+'.jpg').data.publicUrl;
BK.getPhoto=async k=>{if(bucketOf(k)==='product-photos'){const u=BK.prodUrl(k);try{const r=await fetch(u,{method:'HEAD'});return r.ok?u:null}catch(e){return null}}if(!bucketOf(k)||!(await BK.session()))return null;const r=await BK.rpc('photo_lookup',{p_key:k});if(!r)return null;const {data,error}=await sb.storage.from(r.bucket).download(r.path);if(error)return null;
 return await new Promise(res=>{const f=new FileReader();f.onload=()=>res(f.result);f.readAsDataURL(data)})};
// ---- tiempo real + respaldo cada 30 s
BK.live=async()=>{if(BK.ch){sb.removeChannel(BK.ch);BK.ch=null}if(!(await BK.session()))return;
 BK.ch=sb.channel('mt-'+R+'-'+Math.random().toString(36).slice(2)).on('postgres_changes',{event:'*',schema:'public',table:'orders'},BK.soon).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},BK.soon).on('postgres_changes',{event:'INSERT',schema:'public',table:'order_events'},BK.soon).on('postgres_changes',{event:'*',schema:'public',table:'store_activation_requests'},()=>{clearTimeout(BK._q);BK._q=setTimeout(BK.pull,500)}).subscribe()};
// v27: al abrir, se usa la última identidad conocida de ESTA sesión guardada (sin esperar al servidor ni a internet); el servidor la confirma o la revoca en cuanto responde.
BK.restore=()=>{try{const c=JSON.parse(localStorage.getItem('mt-me-'+R)||'null'),a=JSON.parse(localStorage.getItem('mt-auth-'+R)||'null');const uid=a&&(a.user&&a.user.id||(a.currentSession&&a.currentSession.user&&a.currentSession.user.id));
 if(c&&uid&&c.uid===uid&&c.me&&!BK.ME){BK.ME=c.me;BK.boot=BK.boot||{me:c.me};BK.ready=true;return true}}catch(e){}return false};
BK.start=()=>{if(BK.restore()){try{render()}catch(_){}}window.addEventListener('online',()=>BK.pull());sb.auth.onAuthStateChange((ev,s)=>{if(ev==='SIGNED_IN'||ev==='SIGNED_OUT'||ev==='TOKEN_REFRESHED'){if(s)sb.realtime.setAuth(s.access_token);setTimeout(BK.live,0)}});BK.pull().then(BK.live);setInterval(()=>{if(!document.hidden)BK.pull()},30000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)BK.pull()})};
})();
// ---- pantallas de acceso con cuenta (dueño, directivo, repartidor)
let BKM='in';
function bkAuthView(title,sub){return `<h2>${title}</h2><div class="card"><p class="muted">${sub}</p><div class="chips"><span class="chip ${BKM==='in'?'on':''}" id="bkin" onclick="BKM='in';render()">Iniciar sesión</span><span class="chip ${BKM==='up'?'on':''}" id="bkup" onclick="BKM='up';render()">Crear cuenta</span></div>
 ${BKM==='up'?'<label>Nombre completo</label><input id="bkn" autocomplete="name">':''}<label>Correo</label><input id="bke" type="email" autocomplete="email"><label>Contraseña${BKM==='up'?' (mínimo 8)':''}</label><input id="bkp" type="password" autocomplete="${BKM==='up'?'new-password':'current-password'}" onkeydown="event.key==='Enter'&&bkAuth()">
 <div class="err" id="bkerr" style="color:#b91c1c"></div><button class="btn" id="bkgo" onclick="bkAuth()">${BKM==='up'?'Crear cuenta':'Entrar'}</button></div>`}
async function bkAuth(){const e=($('#bke').value||'').trim().toLowerCase(),p=$('#bkp').value,err=m=>{$('#bkerr').textContent=m;toast(m)};
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e))return err('Correo no válido');if(p.length<8)return err('La contraseña debe tener al menos 8 caracteres');
 $('#bkgo').disabled=true;try{if(BKM==='up'){const n=($('#bkn').value||'').trim();if(!n){$('#bkgo').disabled=false;return err('Escribe tu nombre')}await BK.signUp(e,p,{nombre:n})}else await BK.signIn(e,p);view='home';render()}catch(x){err(x.message);const b=$('#bkgo');if(b)b.disabled=false}}
function bkRoleView(){const m=BK.ME,dir=role==='dir';let h=`<h2>${dir?'Panel directivo':'Panel del dueño'}</h2><div class="card"><p>Sesión: <b>${esc(m.email||'')}</b> <span class="tag">${esc(m.role)}</span></p>`;
 if(dir&&BK.boot&&!BK.boot.dirClaimed)h+=`<p class="muted">Primera configuración: escribe el código de directivo que te dieron (solo funciona una vez).</p><label>Código de directivo</label><input id="dcode" autocomplete="off" placeholder="MT-XXXX-XXXX-XXXX"><button class="btn" id="dclaim" onclick="bkClaim()">Activar cuenta de directivo</button>`;
 else h+=dir?'<p class="muted">Esta cuenta no es la del directivo.</p>':'<p class="muted">Esta cuenta todavía no es de dueño. Pide al directivo que te agregue como dueño con tu correo (app Directivo → Dueños → Agregar dueño).</p>';
 return h+'<button class="btn sec" onclick="BK.signOut()">Cerrar sesión</button></div>'}
async function bkClaim(){try{await BK.rpc('claim_directivo',{code:$('#dcode').value});await BK.pull();toast('¡Listo! Ya eres el directivo');view='home';render()}catch(e){toast(e.message)}}
async function bkAddDueno(){const e=($('#ndue').value||'').trim();if(!e)return toast('Escribe el correo de la cuenta');try{await BK.rpc('set_role',{target_email:e,new_role:'dueno'});toast('Dueño agregado');await BK.pull()}catch(x){toast(x.message)}}
async function bkQuitDueno(e){if(!confirm('¿Quitar el acceso de dueño a '+e+'?'))return;try{await BK.rpc('set_role',{target_email:e,new_role:'cliente'});toast('Acceso de dueño quitado');await BK.pull()}catch(x){toast(x.message)}}
function cliOut(){localStorage.removeItem(SESS);BK.signOut();go('auth')}
