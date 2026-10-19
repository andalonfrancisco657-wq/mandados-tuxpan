# v24 UI: recogido / entrega con código / entrega con foto / vista del dueño. Requiere :8000, MT_TEST_STORE (con lat/lng), MT_TEST_PROD.
import os,sys,time,json,subprocess
from playwright.sync_api import sync_playwright
B='http://localhost:8000/';PW='Prueba-12345';SID=os.environ['MT_TEST_STORE'];PID=os.environ['MT_TEST_PROD'];SH='shots/'
fails=0;made=[]
def ck(c,m):
    global fails;print('OK  ' if c else 'FAIL',m);fails+=0 if c else 1
def helper(*a,cli='cli'):
    r=json.loads(subprocess.check_output(['node','step_helper.mjs',SID,PID,*a],cwd='/workspace/t',stderr=subprocess.DEVNULL,env={**os.environ,'MT_CLI':cli}).decode().strip().splitlines()[-1]);made.append(r);return r
def wait(p,js,t=20000): p.wait_for_function(js,timeout=t);return True
def login(p,url,email):
    p.goto(B+url);wait(p,"window.BK&&BK.ready");p.fill('#bke',email);p.fill('#bkp',PW);p.click('#bkgo');wait(p,"!locked()")
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True)
    def mk(lat=21.9449,lng=-105.2962):
        c=b.new_context(viewport={'width':390,'height':844},service_workers='block',geolocation={'latitude':lat,'longitude':lng,'accuracy':10},permissions=['geolocation'])
        p=c.new_page();p.on('dialog',lambda d:d.accept());p.on('pageerror',lambda e:print('PAGEERR',e));return p
    C=helper('recoger',cli=os.environ.get('MT_CLI_UI','cli2'));oid=C['id']
    # tienda marca entregado al repartidor
    t=b.new_context(viewport={'width':820,'height':1180},service_workers='block').new_page();t.on('dialog',lambda d:d.accept())
    d=mk();login(d,'dueno/','mt-test-due@mandados-test.dev');time.sleep(2);code=d.evaluate(f"BK.rpc('gen_tablet_code',{{p_store:{SID}}})")
    t.goto(B+'tienda/');wait(t,"BK.ready");t.select_option('#tsel',SID);t.fill('#tcode',code);t.click('#tenter');wait(t,"tSessOk()")
    made.append({'tab':t.evaluate("BK.sb.auth.getUser().then(r=>r.data.user.id)")})
    t.evaluate("BK.pull()");time.sleep(2)
    for js in [f"tAccept({oid})",f"tSurt({oid},0,'ok')",f"tNota({oid})",f"tReady({oid})"]: t.evaluate(js);time.sleep(1.5)
    t.evaluate(f"tSel={oid};go('nota')");time.sleep(2)
    0 and print('DBG',t.evaluate(f"JSON.stringify({{v:view,o:(()=>{{const o=O({oid});return o&&{{prep:o.prep,nota:!!o.nota,handoff:o.handoff,tacc:o.tacc,recog:o.recog}}}})()}})"));t.screenshot(path='/tmp/dbg.png')
    wait(t,f"!!document.querySelector('#thand{oid}')")
    t.evaluate(f"document.querySelector('#thand{oid}').scrollIntoView({{block:'center'}})");time.sleep(.3);t.screenshot(path=SH+'tienda_codigo_repartidor.png')
    r=mk();login(r,'repartidor/','mt-test-rep@mandados-test.dev')
    r.evaluate(f"BK.sb.rpc('sync_order',{{p:{{id:{oid},compra:{{kind:'tienda',foto:'tk:ui',monto:0,t:Date.now()}}}}}}).then(()=>BK.pull())");wait(r,f"!!document.querySelector('#pick{oid}')")
    ck(not r.query_selector('[data-adv="%d"]'%oid),'no hay botón para saltar el recogido')
    r.evaluate(f"oSel={oid};go('pedido')");wait(r,f"!!document.querySelector('#pick{oid}')");r.fill(f'#hc{oid}','111111');r.click(f'#pickgo{oid}');time.sleep(2.5)
    ck(r.evaluate(f"O({oid}).st")==2,'código de tienda incorrecto: sigue en Comprando')
    r.evaluate(f"document.querySelector('#pick{oid}').scrollIntoView({{block:'center'}})");time.sleep(.3);r.screenshot(path=SH+'repartidor_recoger.png')
    t.click('#tentr');wait(t,f"O({oid}).recog&&O({oid}).recog.tienda")
    ck(True,'tienda marca “Entregado al repartidor”')
    r.evaluate("BK.pull()");wait(r,f"O({oid}).recog&&O({oid}).recog.tienda");r.click(f'#pickgo{oid}');wait(r,f"O({oid}).st===3")
    ck(r.evaluate(f"O({oid}).verif.recog.m")=='tienda','recogido confirmado (tienda + GPS) → En camino')
    # cliente ve su código
    c=mk();c.goto(B);wait(c,"window.BK&&BK.ready");c.evaluate("go('login')");c.fill('#le','mt-test-'+os.environ.get('MT_CLI_UI','cli2')+'@mandados-test.dev');c.fill('#lp',PW);c.evaluate("doLogin()");time.sleep(3)
    c.evaluate(f"BK.pull().then(()=>{{track={oid};go('track')}})");wait(c,"!!document.querySelector('#delivcode')")
    ck(c.inner_text('#dcode').strip()==C['code'],'cliente ve su código de entrega en Seguimiento');c.screenshot(path=SH+'cliente_codigo_entrega.png')
    # repartidor entrega
    wait(r,f"!!document.querySelector('#dc{oid}')");r.fill(f'#dm{oid}','45');r.fill(f'#dc{oid}','0000' if C['code']!='0000' else '1111');r.click(f'#delgo{oid}');time.sleep(2.5)
    ck(r.evaluate(f"O({oid}).st")==3 and r.evaluate(f"O({oid}).delivTries")==1,'código incorrecto: no se entrega')
    r.fill(f'#dm{oid}','45');r.fill(f'#dc{oid}',C['code'][:2])
    r.evaluate(f"document.querySelector('#deliv{oid}').scrollIntoView({{block:'center'}})");time.sleep(.3);r.screenshot(path=SH+'repartidor_codigo_entrega.png')
    r.fill(f'#dc{oid}',C['code']);r.click(f'#delgo{oid}');wait(r,f"O({oid}).st===4")
    ck(r.evaluate(f"O({oid}).verif.entrega.m")=='codigo' and r.evaluate(f"O({oid}).cobrado")==1,'entregado con el código del cliente + cobro')
    # entrega sin código (foto)
    E=helper('camino',cli='cli');eid=E['id'];r.evaluate("BK.pull().then(()=>go('home'))");wait(r,f"!!document.querySelector('#dfopen{eid}')");r.click(f'#dfopen{eid}')
    open('/tmp/mt_door.jpg','wb').write(open('shots/tienda_foto_botones.png','rb').read()) if False else None
    r.set_input_files(f'#df{eid}','shots/tienda_foto_botones.png');wait(r,f"!document.querySelector('#dfgo{eid}').disabled",15000);r.fill(f'#dm{eid}','45');r.click(f'#dfgo{eid}');wait(r,f"O({eid}).st===4",30000)
    ck(r.evaluate(f"O({eid}).verif.entrega.revisar")==True,'entrega con foto → por revisar')
    F=helper('camino',cli='cli')  # activo en camino, recogido sin GPS
    d.evaluate("BK.pull()");time.sleep(2);d.evaluate("go('vivo')");wait(d,"!!document.querySelector('#vrev')")
    ck(str(eid) in d.inner_text('#vrev'),'dueño ve la entrega por revisar');ck('tienda confirmó' in d.inner_text('#vlist') and 'sin verificación de ubicación' in d.inner_text('#vlist'),'dueño ve cómo se verificó cada paso')
    d.screenshot(path=SH+'dueno_verificacion.png',full_page=True)
    b.close()
print('MADE='+json.dumps(made));print('TODO OK' if not fails else f'{fails} FALLAS');sys.exit(1 if fails else 0)
