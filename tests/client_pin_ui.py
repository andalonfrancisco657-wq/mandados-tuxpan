# v25 UI: el cliente marca su casa; el repartidor asignado ve el mapa; el dueño ve la distancia. Requiere :8000, MT_TEST_STORE, MT_TEST_PROD
# y un pedido entregado con foto (de client_pin.mjs) para la vista del dueño.
import os,sys,time,json,subprocess
from playwright.sync_api import sync_playwright
B='http://localhost:8000/';PW='Prueba-12345';SID=int(os.environ['MT_TEST_STORE']);PID=int(os.environ['MT_TEST_PROD']);SH='shots/';CLI=os.environ.get('MT_CLI_UI','cli2')
fails=0
def ck(c,m):
    global fails;print('OK  ' if c else 'FAIL',m);fails+=0 if c else 1
def wait(p,js,t=20000): p.wait_for_function(js,timeout=t);return True
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True)
    def mk(lat,lng):
        c=b.new_context(viewport={'width':390,'height':844},service_workers='block',geolocation={'latitude':lat,'longitude':lng,'accuracy':10},permissions=['geolocation'])
        p=c.new_page();p.on('dialog',lambda d:d.accept());p.on('pageerror',lambda e:print('PAGEERR',e));return p
    c=mk(21.9480,-105.2920);c.goto(B);wait(c,"window.BK&&BK.ready");c.evaluate("go('login')");c.fill('#le',f'mt-test-{CLI}@mandados-test.dev');c.fill('#lp',PW);c.evaluate("doLogin()");wait(c,"BK.ME&&BK.ME.email")
    c.evaluate(f"sel='abarrotes';go('nuevo')");time.sleep(1);c.evaluate(f"pickStore({SID})");c.evaluate(f"setQ({PID},1);go('carrito')");wait(c,"!!document.querySelector('#pinslot .leaflet-container')",30000)
    c.fill('#dir','Calle Pin 5, Centro (test)');c.fill('#senas','portón café (test)');c.fill('#nom','Cliente Pin (test)');c.fill('#tel','3196660005')
    n0=c.evaluate("DB.orders.length");c.click('text=Confirmar pedido');time.sleep(1.5);ck(c.evaluate("DB.orders.length")==n0,'sin pin no deja confirmar')
    c.click('#pinhere');wait(c,"PIN.set");ck(abs(c.evaluate("PIN.lat")-21.948)<1e-4,'“Usar mi ubicación actual” coloca el pin')
    box=c.query_selector('#pinslot').bounding_box();c.mouse.click(box['x']+box['width']/2+30,box['y']+box['height']/2+20);time.sleep(.5);lat=c.evaluate("PIN.lat");ck(lat!=21.948,'tocar el mapa mueve el pin')
    c.evaluate("document.querySelector('#pinwrap').scrollIntoView({block:'center'})");time.sleep(1.5);c.screenshot(path=SH+'cliente_pin_casa.png')
    c.click('text=Confirmar pedido');wait(c,"DB.orders.some(o=>o.srv&&o.dlat!=null&&o.id>2000)",30000);oid=c.evaluate("DB.orders.find(o=>o.srv&&o.dlat!=null).id")
    ck(abs(c.evaluate(f"O({oid}).dlat")-lat)<1e-5,'pedido creado con la ubicación del domicilio');print('ORDER_UI='+str(oid))
    r=mk(21.9450,-105.2962);r.goto(B+'repartidor/');wait(r,"window.BK&&BK.ready");r.fill('#bke','mt-test-rep2@mandados-test.dev');r.fill('#bkp',PW);r.click('#bkgo');wait(r,"!locked()");r.evaluate("BK.pull()");time.sleep(2)
    ck(r.evaluate(f"(()=>{{const o=O({oid});return !!o&&o.dlat===undefined}})()"),'repartidor que no lo ha aceptado no ve el pin')
    r.evaluate(f"(async()=>{{await BK.sb.rpc('sync_order',{{p:{{id:{oid},rep:'Test Rep Dos'}}}});await BK.pull();oSel={oid};go('pedido')}})()");wait(r,"!!document.querySelector('#rpinslot .leaflet-container')",30000)
    ck(r.evaluate("document.querySelector('#rpingm').href").startswith('https://www.google.com/maps/dir/?api=1&destination='),'mapa del domicilio + Abrir en Google Maps')
    time.sleep(1.5);r.evaluate("document.querySelector('#rpin').scrollIntoView({block:'center'})");time.sleep(.5);r.screenshot(path=SH+'repartidor_mapa_cliente.png')
    d=mk(21.9447,-105.2964);d.goto(B+'dueno/');wait(d,"window.BK&&BK.ready");d.fill('#bke','mt-test-due@mandados-test.dev');d.fill('#bkp',PW);d.click('#bkgo');wait(d,"!locked()");time.sleep(3)
    d.evaluate("go('vivo')");wait(d,"!!document.querySelector('#vrev')");ck('m del domicilio' in d.inner_text('#vrev'),'dueño ve la distancia al domicilio en la entrega')
    d.evaluate("document.querySelector('#vrev').scrollIntoView()");time.sleep(.4);d.screenshot(path=SH+'dueno_distancia_entrega.png')
    d.evaluate("go('mapa')");wait(d,"!!document.querySelector('.leaflet-container')",30000);time.sleep(2);ck(d.evaluate("document.querySelectorAll('.leaflet-interactive').length")>0,'mapa del dueño con pines')
    b.close()
print('TODO OK' if not fails else f'{fails} FALLAS');sys.exit(1 if fails else 0)
