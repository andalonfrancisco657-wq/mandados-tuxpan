# v32: paso de vehículo/licencia, revisión del dueño, aviso de vencimiento, repartidor existente. Uso: MT_BASE=<url> python3 tests/vehicle_license_ui.py
import os,time
from playwright.sync_api import sync_playwright
B=os.environ.get('MT_BASE','http://localhost:8000/');SH=os.environ.get('MT_SHOTS','shots');IMG='/tmp/doc.jpg';fails=0;N3='MT Test Carro Tres'
def ck(c,m):
    global fails;print('OK  ' if c else 'FAIL',m);fails+=0 if c else 1
def ctx(b,vp):
    p=b.new_context(service_workers='block',viewport=vp).new_page();p.on('dialog',lambda x:x.accept());return p
def login(p,path,email):
    p.goto(B+path);p.wait_for_function("window.BK&&BK.ready");p.fill('#bke',email);p.fill('#bkp','Prueba-12345');p.click('#bkgo');time.sleep(3.5)
def wait(p,js,t=12):
    t0=time.time()
    while time.time()-t0<t:
        if p.evaluate(js):return True
        time.sleep(.4)
    return False
M={'width':390,'height':844}
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    # A. registro nuevo con carro
    p=ctx(b,M);login(p,'repartidor/','mt-test-rep3@mandados-test.dev');p.click('#regstart');time.sleep(.5)
    p.fill('#rn',N3);p.fill('#rc','Calle Prueba');p.fill('#rnum','5');p.fill('#rcol','Centro');p.fill('#rtel','3196660041');p.click('#rnext');time.sleep(.5)
    p.set_input_files('#f_ineF',IMG);time.sleep(1);p.set_input_files('#f_ineR',IMG);time.sleep(1);p.click('#rnext');time.sleep(.5)
    ck(p.query_selector('#vehcard') is not None and 'Vehículo y licencia' in p.inner_text('#app'),'paso "Vehículo y licencia" después de la INE')
    p.click('#rnext');time.sleep(.3);ck('tipo de vehículo' in p.inner_text('#rerr'),'exige elegir vehículo')
    p.click('#veh-bici');time.sleep(.3);ck(p.query_selector('#vlnum') is None,'bicicleta: sin licencia')
    p.click('#veh-carro');time.sleep(.3);ck(p.query_selector('#vlnum') and p.query_selector('#g_licF') and p.query_selector('#f_licF'),'carro: pide licencia con 📷 Tomar foto y 🖼️ Galería')
    p.fill('#vlnum','NAY-777888');p.fill('#vltipo','B');p.fill('#vplacas','xyz-98-76');p.fill('#vlvence','2020-01-01');p.click('#rnext');time.sleep(.3);ck('vencida' in p.inner_text('#rerr'),'rechaza licencia vencida')
    p.fill('#vlvence','2029-06-30');p.click('#rnext');time.sleep(.3);ck('foto' in p.inner_text('#rerr'),'exige fotos de la licencia')
    p.set_input_files('#g_licF',IMG);time.sleep(1);p.set_input_files('#f_licR',IMG);time.sleep(1)
    p.screenshot(path=SH+'/veh1_registro.png',full_page=True)
    p.click('#rnext');time.sleep(.5);ck(p.query_selector('#vehcard') is None,'pasa al siguiente paso')
    p.evaluate("RG.selfie=RG.ineF;render()");p.click('#rnext');time.sleep(.5)
    if p.query_selector('#rp1'):p.fill('#rp1','1234');p.fill('#rp2','1234')
    p.evaluate("RG.bioSkip=true");p.click('#rnext');time.sleep(.5);p.check('#racepta');p.check('#rreglas');p.click('#rnext');time.sleep(6)
    ck(p.evaluate(f"!!(DB.regs['{N3}']&&DB.regs['{N3}'].veh==='carro')"),'registro enviado con carro y licencia')
    # B. dueño revisa
    d=ctx(b,M);login(d,'dueno/','mt-test-due@mandados-test.dev');d.evaluate(f"BK.pull()");time.sleep(2);d.evaluate(f"solSel='{N3}';solBack='sol';go('solic')");time.sleep(3)
    t=d.inner_text('#vehadm') if d.query_selector('#vehadm') else '';ck('Carro' in t and 'NAY-777888' in t and 'XYZ-98-76' in t and '2029-06-30' in t and 'Vigente' in t,'dueño ve vehículo, placas, licencia, tipo y vencimiento')
    ck(wait(d,"[...document.querySelectorAll('#vehadm img[data-foto]')].every(i=>i.src.startsWith('data:')||i.src.startsWith('blob:'))&&document.querySelectorAll('#vehadm img[data-foto]').length===2"),'dueño ve las fotos de la licencia')
    d.screenshot(path=SH+'/veh2_dueno_revision.png',full_page=True)
    d.click('#aprobar');time.sleep(3)
    # C. aviso de vencimiento (MT Test Moto vence en 10 días)
    r=ctx(b,M);login(r,'repartidor/','mt-test-rep@mandados-test.dev');r.evaluate("(async()=>{localStorage.setItem('rep_local',JSON.stringify({name:'MT Test Moto',hash:await sha('pin:1234')}));myRep='MT Test Moto';unlock();go('home')})()");time.sleep(3)
    ck(r.query_selector('#licpronto') is not None and 'vence en' in r.inner_text('#licpronto'),'repartidor ve aviso 30 días antes');r.screenshot(path=SH+'/veh3_aviso_repartidor.png')
    d.evaluate("go('sol')");time.sleep(1.5);e=d.query_selector('[data-lic="MT Test Moto"]');ck(e is not None and 'Vence en' in e.inner_text(),'dueño ve "Vence en N días"')
    d.evaluate("document.getElementById('liccard').scrollIntoView()");time.sleep(.3);d.screenshot(path=SH+'/veh4_aviso_dueno.png')
    # D. repartidor existente sin vehículo: se le pide al abrir
    o=ctx(b,M);login(o,'repartidor/','mt-test-rep2@mandados-test.dev');o.evaluate("(async()=>{localStorage.setItem('rep_local',JSON.stringify({name:'MT Test Viejo',hash:await sha('pin:1234')}));myRep='MT Test Viejo';unlock();go('home')})()");time.sleep(3)
    ck(o.evaluate("view")=='vehform' or o.query_selector('#vehfalta') is not None,'existente sin vehículo: se le pide completarlo')
    if o.evaluate("view")!='vehform':o.click('#vehgo');time.sleep(.5)
    o.click('#veh-moto');o.fill('#vlnum','NAY-111222');o.fill('#vltipo','Motociclista');o.fill('#vlvence','2028-01-31');o.set_input_files('#g_licF',IMG);time.sleep(1);o.set_input_files('#g_licR',IMG);time.sleep(1)
    o.click('#vehsend');time.sleep(5);ck(o.query_selector('#vehpend') is not None,'enviado: "en revisión" y sigue trabajando')
    ck(o.evaluate("repOk(myRep)"),'su estado actual no cambia (sigue aprobado)')
    d.evaluate("BK.pull()");time.sleep(2);d.evaluate("solSel='MT Test Viejo';solBack='sol';go('solic')");time.sleep(2);ck(d.query_selector('#vehok') is not None,'dueño ve la actualización con Aprobar/Rechazar')
    d.click('#vehok');time.sleep(3);ck(d.evaluate("DB.regs['MT Test Viejo'].veh==='moto'"),'dueño aprueba la licencia')
print('FALLOS',fails) if fails else print('TODO OK')
