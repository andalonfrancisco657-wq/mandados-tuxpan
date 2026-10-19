# Mapa de repartidores (Playwright, geolocalización simulada). Requiere server en :8000 y
# MT_TEST_STORE / MT_TEST_ORDER (de map_rls.mjs). Usuarios mt-test-*.
import os,sys,time
from playwright.sync_api import sync_playwright
B='http://localhost:8000/';PW='Prueba-12345';SID=int(os.environ['MT_TEST_STORE']);OID=int(os.environ['MT_TEST_ORDER']);SH='shots/'
fails=0
def ck(c,m):
    global fails;print('OK  ' if c else 'FAIL',m);fails+=0 if c else 1
def wait(p,js,t=20000):
    p.wait_for_function(js,timeout=t)
def login(p,url,email):
    p.goto(B+url);wait(p,"window.BK&&BK.ready");p.fill('#bke',email);p.fill('#bkp',PW);p.click('#bkgo');wait(p,"!locked()")
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True)
    def ctx(lat,lng):
        c=b.new_context(viewport={'width':390,'height':844},service_workers='block',geolocation={'latitude':lat,'longitude':lng,'accuracy':15},permissions=['geolocation'])
        p=c.new_page();p.on('dialog',lambda d:d.accept());p.on('pageerror',lambda e:print('PAGEERR',e));return p
    r=ctx(21.9455,-105.2958);login(r,'repartidor/','mt-test-rep@mandados-test.dev')
    wait(r,"!!document.querySelector('#dispbtn')");ck(True,'toggle de disponibilidad visible')
    r.click('#dispbtn');wait(r,"!!document.querySelector('#geoind')")
    ck('Disponible' in r.inner_text('#dispcard'),'repartidor en Disponible y compartiendo');r.screenshot(path=SH+'repartidor_disponible.png')
    d=ctx(21.9447,-105.2964);login(d,'dueno/','mt-test-due@mandados-test.dev')
    time.sleep(3);d.evaluate("go('mapa')");wait(d,"!!document.querySelector('.leaflet-container')",30000)
    wait(d,"MP.drivers.some(x=>x.nombre=='Test Rep Uno')",30000);ck(True,'dueño ve al repartidor en el mapa')
    d.evaluate(f"MP.sel={SID};MP.set={SID};go('mapa')");time.sleep(1.5)
    if not d.query_selector('#mapslot'): print('DBG',d.evaluate("(()=>{try{mapView();return view}catch(e){return view+' '+e.stack}})()"))
    box=d.query_selector('#mapslot').bounding_box();d.mouse.click(box['x']+box['width']/2+25,box['y']+box['height']/2-20)
    wait(d,f"(DB.stores.find(s=>s.id=={SID})||{{}}).lat!=null");ck(True,'ubicación de tienda fijada tocando el mapa')
    d.evaluate("MP.sel=null;go('mapa')");time.sleep(2);d.screenshot(path=SH+'dueno_mapa.png')
    d.evaluate(f"MP.sel={SID};go('mapa')");wait(d,"!!document.querySelector('#selstore .drv')")
    ck(d.evaluate("[...document.querySelectorAll('#selstore a')].some(a=>a.href.startsWith('https://www.google.com/maps/dir/?api=1&destination='))"),'enlace Abrir en Google Maps')
    ck('km' in d.inner_text('#selstore') or ' m' in d.inner_text('#selstore'),'distancias mostradas');time.sleep(1);d.evaluate("document.querySelector('#selstore').scrollIntoView()");time.sleep(.5);d.screenshot(path=SH+'dueno_tienda_repartidores.png')
    rid=r.evaluate("BK.uid||(BK.user&&BK.user.id)") or ''
    rid=d.evaluate("MP.drivers.find(x=>x.nombre=='Test Rep Uno').id");d.click('#alert-'+rid)
    wait(r,"!!document.querySelector('#ralert')",30000);ck(True,'banner de alerta llega al repartidor');time.sleep(.8);r.screenshot(path=SH+'repartidor_alerta.png')
    r.click('#raok');time.sleep(3)
    wait(d,"MP.alerts.some(a=>a.status=='aceptada')",30000);ck(True,'dueño ve alerta aceptada')
    r.evaluate("BK.pull()");time.sleep(2);ck(r.evaluate(f"!!(DB.orders||[]).find(o=>o.id=={OID}&&o.rep)"),'pedido asignado al repartidor')
    r.click('#dispbtn');time.sleep(2);ck(not r.query_selector('#geoind'),'No disponible detiene el envío')
    b.close()
print('TODO OK' if not fails else f'{fails} FALLAS');sys.exit(1 if fails else 0)
