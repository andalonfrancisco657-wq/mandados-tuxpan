// v28: contraseña de la tienda (tablet) + controles del dueño
(function(){
const TPW={list:null,mode:null,auth:null,show:false,busy:false};window.TPW=TPW;
try{TPW.auth=JSON.parse(localStorage.getItem('mt-tauth')||'null')}catch(_){}
const eye=id=>`<button type="button" class="btn sec sm" style="margin:4px 0" onclick="TPWeye('${id}',this)">👁 Mostrar</button>`;
window.TPWeye=(id,b)=>{const i=document.getElementById(id);if(!i)return;const h=i.type==='password';i.type=h?'text':'password';b.textContent=h?'🙈 Ocultar':'👁 Mostrar'};
async function loadList(){try{TPW.list=await BK.rpc('store_login_list')||[]}catch(e){TPW.list=TPW.list||[]}if(role==='tienda'&&!tSessOk()&&!document.querySelector('#tpw:focus,#tcode:focus'))render()}
async function loadAuth(){if(role!=='tienda')return;if(!(BK.ME&&BK.ME.role==='tienda')){TPW.auth=null;localStorage.removeItem('mt-tauth');return}
 try{const a=await BK.rpc('my_store_auth');TPW.auth=a;if(a)localStorage.setItem('mt-tauth',JSON.stringify(a));else localStorage.removeItem('mt-tauth')}catch(_){} }
window.TPWload=loadList;
// ---- pantalla de entrada
const origGate=tGate;
tGate=function(){if(tRq)return origGate();if(!TPW.list){loadList();return '<div class="card tlogin"><h2>Tablet de la tienda</h2><p class="muted">Cargando…</p></div>'}
 const P=TPW.list.filter(s=>s.pw),last=+localStorage.getItem('tienda_last')||0;let m=TPW.mode||(P.length?'pw':'code');
 const tabs=`<div class="row" style="gap:6px;margin-bottom:8px"><button class="btn sm ${m==='pw'?'':'sec'}" id="tmodepw" style="margin:0" onclick="TPW.mode='pw';render()">🔒 Entrar con contraseña</button><button class="btn sm ${m==='code'?'':'sec'}" id="tmodecode" style="margin:0" onclick="TPW.mode='code';render()">🔑 Entrar con código de activación</button></div>`;
 if(m==='code'){const g=origGate();return tabs+g.replace('Entra con el código que te dio Mandados Tuxpan. Cada tienda tiene el suyo.','Usa el código de 6 dígitos la primera vez o si olvidaste la contraseña. Te lo da el dueño de Mandados Tuxpan.')}
 return tabs+(P.length?`<div class="card tlogin"><h2>Entrar con contraseña</h2><label>¿Qué tienda eres?</label><select class="f" id="tpsel">${P.map(s=>`<option value="${s.id}" ${s.id===last?'selected':''}>${s.cat==='farmacia'?'💊':'🏪'} ${esc(s.n)}</option>`).join('')}</select>
 <label>Contraseña de la tienda</label><input id="tpw" type="password" autocomplete="current-password" onkeydown="event.key==='Enter'&&TPWlogin()">${eye('tpw')}<button class="btn" id="tpenter" onclick="TPWlogin()">Entrar</button>
 <p class="muted">¿Primera vez u olvidaste la contraseña? Usa <a href="#" onclick="TPW.mode='code';render();return false">Entrar con código de activación</a>.</p></div>`
 :`<div class="card tlogin"><h2>Entrar con contraseña</h2><p>Ninguna tienda ha creado su contraseña todavía.</p><p class="muted">La primera vez entra con el código de activación y crea la contraseña.</p></div>`)+`<div class="card"><p class="muted">¿Tu tienda aún no tiene código?</p><button class="btn sec" id="treqbtn" onclick="tRq='form';render()">🆕 Solicitar activación</button></div>${tReqStatus()}`};
window.TPWlogin=async function(){const id=+gv('tpsel'),p=$('#tpw').value;if(!p)return toast('Escribe la contraseña');const b=$('#tpenter');b.disabled=true;
 try{await BK.anon(true);const r=await BK.rpc('login_store_password',{p_store:id,p_pw:p});if(!r||!r.ok){b.disabled=false;return toast((r&&r.msg)||'Contraseña incorrecta')}
  localStorage.setItem('tienda_last',id);await BK.pull();await loadAuth();view='prods';render()}catch(e){const b2=$('#tpenter');if(b2)b2.disabled=false;toast(e.message)}};
// ---- crear / cambiar contraseña
function pwForm(first){const a=TPW.auth||{},needCur=!first&&a.via==='pw';
 return `<div class="card tlogin" id="tpwcard"><h2>${first?'Crea la contraseña de tu tienda':'Cambiar contraseña'}</h2>${first?'<p class="muted">Desde ahora la tablet entrará con esta contraseña. El código de activación solo se usará si la olvidas.</p>':''}
 ${needCur?`<label>Contraseña actual</label><input id="tpcur" type="password" autocomplete="current-password">`:''}
 <label>Nueva contraseña (mínimo 8 caracteres)</label><input id="tpn1" type="password" autocomplete="new-password">${eye('tpn1')}
 <label>Confirma la contraseña</label><input id="tpn2" type="password" autocomplete="new-password" onkeydown="event.key==='Enter'&&TPWsave(${first})">
 <button class="btn" id="tpsave" onclick="TPWsave(${first})">Guardar contraseña</button>${first?'':`<button class="btn sec" onclick="view='prods';render()">Cancelar</button>`}</div>`}
window.TPWsave=async function(first){const n1=$('#tpn1').value,n2=$('#tpn2').value,c=$('#tpcur')?$('#tpcur').value:null;
 if(n1.length<8)return toast('La contraseña debe tener al menos 8 caracteres');if(n1!==n2)return toast('Las contraseñas no coinciden');
 $('#tpsave').disabled=true;try{const a=await BK.rpc('set_store_password',{p_new:n1,p_current:c});TPW.auth=a;localStorage.setItem('mt-tauth',JSON.stringify(a));TPW.list=null;toast(first?'Contraseña creada ✅':'Contraseña cambiada ✅');view='prods';render()}
 catch(e){const b=$('#tpsave');if(b)b.disabled=false;toast(e.message)}};
const origRender=render;
render=function(){if(role==='tienda'&&tSessOk()){if(TPW.auth&&TPW.auth.hasPw===false){$('#tabs').innerHTML='';$('#app').innerHTML=tHead(tSess()&&store(tSess().id))+pwForm(true);return}
  if(view==='tpw'){$('#tabs').innerHTML='';$('#app').innerHTML=pwForm(false);return}}
 origRender();
 if(role==='tienda'&&tSessOk()){const h=document.querySelector('.thead .row');if(h&&!document.getElementById('tpwchg')&&TPW.auth&&TPW.auth.hasPw){const b=document.createElement('button');b.id='tpwchg';b.className='btn sec sm';b.style.margin='0';b.textContent='🔒 Cambiar contraseña';b.onclick=()=>{view='tpw';render()};h.insertBefore(b,h.lastElementChild)}}};
const origLogout=tLogout;tLogout=async function(){TPW.auth=null;localStorage.removeItem('mt-tauth');TPW.list=null;TPW.mode=null;await origLogout()};
// ---- dueño / directivo
let SA={};window.TPWSA=()=>SA;
async function loadSA(){if(role!=='admin'&&role!=='dir')return;try{SA=await BK.rpc('store_auth_admin')||{};}catch(_){}}
const origCard=tabCard;
tabCard=function(s){const a=SA[s.id]||{},h=origCard(s);
 const box=`<div class="tpwadm" data-tpw="${s.id}" style="margin-top:8px;border-top:1px solid #e5e7eb;padding-top:8px"><div class="row"><b>🔒 Contraseña de la tienda</b>${a.blocked?'<span class="tag bad">⛔ Tablet bloqueada</span>':a.hasPw?'<span class="tag ok">Creada</span>':'<span class="tag">Sin crear</span>'}</div>
 <div class="muted">${a.hasPw&&a.pwT?'Creada/cambiada '+fdt(a.pwT)+' · ':''}Tablets con sesión: ${a.ses||0}</div>
 ${a.hasPw?`<button class="btn sec sm" id="tpwreset${s.id}" onclick="TPWact(${s.id},'reset_pw')">♻️ Restablecer contraseña</button>`:''}
 <button class="btn sec sm" id="tpwclose${s.id}" onclick="TPWact(${s.id},'close_sessions')">🚪 Cerrar sesiones de la tablet</button>
 <button class="btn sec sm" id="tpwblock${s.id}" onclick="TPWact(${s.id},'${a.blocked?'unblock':'block'}')">${a.blocked?'✅ Desbloquear tablet':'⛔ Bloquear tablet'}</button></div>`;
 return h.replace(/<\/div>$/,box+'</div>')};
const ASK={reset_pw:'¿Restablecer la contraseña? Se borra la contraseña, se cierran las sesiones y se desactiva el código. La tienda tendrá que entrar con un código nuevo y crear otra contraseña.',
 close_sessions:'¿Cerrar sesión en todas las tablets de esta tienda? Tendrán que volver a entrar con la contraseña (o el código).',block:'¿Bloquear la tablet? La tienda no podrá entrar de ninguna forma hasta que la desbloquees.',unblock:'¿Desbloquear la tablet de esta tienda?'};
const OK={reset_pw:'Contraseña restablecida',close_sessions:'Sesiones cerradas',block:'Tablet bloqueada',unblock:'Tablet desbloqueada'};
window.TPWact=async function(sid,act){if(!confirm(ASK[act]))return;try{SA=await BK.rpc('store_auth_action',{p_store:sid,p_action:act})||SA;toast(OK[act]);await BK.pull();render()}catch(e){toast(e.message)}};
tabGen=async function(sid){const s=store(sid);if(!s)return;if(s.tab&&s.tab.act&&!confirm('¿Generar un código nuevo? El anterior deja de funcionar. Las tablets que entran con contraseña siguen dentro (para sacarlas usa "Cerrar sesiones de la tablet").'))return;
 let code;try{code=await BK.rpc('gen_tablet_code',{p_store:sid})}catch(e){return toast(e.message)}tabShow={sid,code};openTab[sid]=true;await BK.pull();render()};
// enganchar al pull
const origPull=BK.pull;BK.pull=async function(){const r=await origPull.apply(this,arguments);const h0=JSON.stringify([TPW.auth,SA]);await Promise.all([loadAuth(),loadSA()]);if(role==='tienda'&&!tSessOk())TPW.list=null;if(JSON.stringify([TPW.auth,SA])!==h0)try{render()}catch(_){}return r};
{const h0=JSON.stringify([TPW.auth,SA]);Promise.all([loadAuth(),loadSA()]).then(()=>{if(JSON.stringify([TPW.auth,SA])!==h0)try{render()}catch(_){}})}
})();
