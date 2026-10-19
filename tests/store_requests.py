# Solicitudes de activación de tiendas: Playwright (tablet → dueño/directivo) + chequeo RLS
import json,subprocess,os
from playwright.sync_api import sync_playwright
B=os.environ.get('MT_BASE','http://localhost:8000/');PW='Prueba-12345';fails=[];errs=[];SH=os.path.join(os.path.dirname(__file__),'..','shots')
EM=lambda r:'mt-test-%s@mandados-test.dev'%r
def ck(c,m):
    print(('OK  ' if c else 'FAIL'),m)
    if not c: fails.append(m)
def mk(b,tag):
    ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block');p=ctx.new_page()
    p.on('pageerror',lambda e:errs.append(tag+': '+str(e)));p.on('console',lambda m:m.type=='error' and errs.append(tag+': '+m.text));p.on('dialog',lambda d:d.accept());return p
def wait(p,js,t=15):
    for _ in range(t*4):
        try:
            if p.evaluate(js): return True
        except Exception: pass
        p.wait_for_timeout(250)
    return False
def login(p,url,email):
    p.goto(B+url);wait(p,"BK.ready");p.fill('#bke',email);p.fill('#bkp',PW);p.click('#bkgo');return wait(p,"!locked()")
def fill(t,n,tel):
    t.click('#treqbtn');t.fill('#rqn',n);t.select_option('#rqt','conveniencia');t.fill('#rqd','Av. Insurgentes 45, Col. Centro');t.fill('#rqe','Rosa Pérez');t.fill('#rqtel',tel);t.fill('#rqx','Abrimos de 8 a 22')
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--headless=new'])
    d=mk(b,'due');ck(login(d,'dueno/',EM('due')),'dueño entra');d.evaluate("go('tiendas')")
    t=mk(b,'tienda');t.goto(B+'tienda/');wait(t,"BK.ready")
    ck(t.query_selector('#tenter') is not None or 'código' in t.inner_text('#app'),'login con código intacto');
    fill(t,'Tienda Prueba Activación','3195550001');t.screenshot(path=SH+'/tienda_solicitud_form.png',full_page=True)
    t.click('#rqsend');ck(wait(t,"!!document.querySelector('#treqok')"),'confirmación mostrada')
    ck('El Dueño te contactará y te dará tu código de activación' in t.inner_text('#app'),'texto de confirmación');t.screenshot(path=SH+'/tienda_solicitud_enviada.png',full_page=True)
    ck(wait(d,"sreqPend()>=1&&document.querySelector('#sreqn')&&/1 pendiente/.test(document.querySelector('#sreqn').textContent)",20),'dueño ve la solicitud en tiempo real (badge)')
    d.evaluate("go('streq')");d.wait_for_timeout(400);d.screenshot(path=SH+'/dueno_solicitudes_tiendas.png',full_page=True)
    t.reload();ck(wait(t,"BK.ready&&!!document.querySelector('#treqst')&&/Pendiente/.test(document.querySelector('#treqst').textContent)"),'tablet ve estado pendiente al volver')
    rid=d.evaluate("BK.sreq.find(r=>r.status==='pendiente').id");d.click('#srok%d'%rid)
    ck(wait(d,"DB.stores.some(s=>s.n==='Tienda Prueba Activación')"),'aprobar crea la tienda')
    sid=d.evaluate("DB.stores.find(s=>s.n==='Tienda Prueba Activación').id")
    st=d.evaluate(f"store({sid})");ck(st['tipo']=='Tienda de conveniencia' and st['col'].startswith('Av. Insurgentes') and st['cat']=='abarrotes','tienda prellenada desde la solicitud')
    ck(wait(d,f"!!document.querySelector('#tabgen{sid}')"),'muestra 📲 Código de tablet de la tienda nueva')
    d.click(f'#tabgen{sid}');ck(wait(d,"tabShow&&tabShow.code"),'genera código de tablet');code=d.evaluate("tabShow.code")
    t.reload();ck(wait(t,"BK.ready&&/Aprobada/.test(document.querySelector('#treqst').textContent)"),'tablet ve aprobada')
    t.select_option('#tsel',str(sid));t.fill('#tcode',code);t.click('#tenter');ck(wait(t,"tSessOk()&&myStore().id===%d"%sid),'tablet entra con su código nuevo')
    # rechazo desde directivo
    t2=mk(b,'t2');t2.goto(B+'tienda/');wait(t2,"BK.ready");fill(t2,'Tienda Rechazo','3195550002');t2.click('#rqsend');wait(t2,"!!document.querySelector('#treqok')")
    x=mk(b,'dir');ck(login(x,'directivo/',EM('dir')),'directivo entra');ck(wait(x,"!!document.querySelector('#tsreq')"),'directivo: tarjeta Solicitudes de tiendas en Panel')
    x.click('#tsreq');ck(wait(x,"view==='streq'&&document.querySelector('#tabs .on')&&/Panel/.test(document.querySelector('#tabs .on').textContent)"),'directivo abre la lista (pestaña Panel activa)')
    r2=x.evaluate("BK.sreq.find(r=>r.status==='pendiente').id");x.click('#srno%d'%r2);x.fill('#srmot','Fuera de la zona de reparto');x.click('text=Confirmar rechazo')
    ck(wait(x,"BK.sreq.find(r=>r.id===%d).status==='rechazada'"%r2),'directivo rechaza con motivo')
    t2.reload();ck(wait(t2,"BK.ready&&/Rechazada/.test(document.querySelector('#treqst').textContent)&&/Fuera de la zona/.test(document.querySelector('#treqst').textContent)"),'tablet ve rechazada y motivo')
    # límite
    t2.evaluate("tRq=null");r=t2.evaluate("""(async()=>{let e=[];for(let i=0;i<3;i++){try{await BK.rpc('request_store_activation',{p:{nombre:'Spam '+i,tipo:'otro',direccion:'Calle 12345',encargado:'Spam',tel:'3195550002'}})}catch(x){e.push(x.message)}}return e})()""")
    ck(len(r)>=1 and 'varias solicitudes' in r[-1],'límite de solicitudes por día')
    print('errors',errs[:5]);print(len(fails),'fallas')
