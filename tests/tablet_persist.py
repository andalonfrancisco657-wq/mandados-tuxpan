# v27: la tablet sigue dentro al cerrar y reabrir (contexto persistente), al abrir sin internet y con el token vencido.
# Uso: MT_TEST_STORE=<tienda de prueba> MT_BASE=<url> python3 tests/tablet_persist.py
import os,sys,time,json,shutil,tempfile
from playwright.sync_api import sync_playwright
B=os.environ.get('MT_BASE','http://localhost:8000/');SID=os.environ['MT_TEST_STORE'];fails=0;made=[]
def ck(c,m):
    global fails;print('OK  ' if c else 'FAIL',m);fails+=0 if c else 1
UD=tempfile.mkdtemp(prefix='mt_tab_')
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    d=b.new_context(service_workers='block').new_page();d.goto(B+'dueno/');d.wait_for_function("window.BK&&BK.ready");d.fill('#bke','mt-test-due@mandados-test.dev');d.fill('#bkp','Prueba-12345');d.click('#bkgo');d.wait_for_function("!locked()");time.sleep(2)
    code=d.evaluate(f"BK.rpc('gen_tablet_code',{{p_store:{SID}}})")
    def open_ctx(offline=False):
        c=pw.chromium.launch_persistent_context(UD,executable_path='/usr/bin/google-chrome',viewport={'width':820,'height':1180},offline=offline)
        p=c.pages[0] if c.pages else c.new_page();return c,p
    def state(p,wait=8):
        try:p.wait_for_function("window.BK&&BK.ready",timeout=20000)
        except Exception as e:return 'noready'
        t0=time.time()
        while time.time()-t0<wait:
            if p.evaluate("tSessOk()"):return 'dentro'
            time.sleep(.5)
        return 'pide código'
    c,p=open_ctx();p.goto(B+'tienda/');p.wait_for_function("window.BK&&BK.ready",timeout=20000)
    p.select_option('#tsel',SID);p.fill('#tcode',code);p.click('#tenter');ck(state(p)=='dentro','entra con el código')
    made.append(p.evaluate("BK.sb.auth.getSession().then(r=>r.data.session.user.id)"));c.close()
    c,p=open_ctx();p.goto(B+'tienda/');ck(state(p)=='dentro','al cerrar y reabrir sigue dentro');c.close()
    c,p=open_ctx(offline=True)
    try:p.goto(B+'tienda/',timeout=15000);s=state(p)
    except Exception as e:s='sin página offline: '+str(e)[:80]
    ck(s=='dentro','al abrir SIN internet sigue dentro ('+s+')');c.close()
    c,p=open_ctx()
    # token vencido: se fuerza expires_at en el pasado (como si pasaran horas)
    p.goto(B+'tienda/');p.wait_for_function("window.BK&&BK.ready",timeout=20000)
    p.evaluate("(()=>{for(const k of Object.keys(localStorage))if(k.startsWith('mt-auth-tienda')){try{const v=JSON.parse(localStorage.getItem(k));if(v&&v.expires_at){v.expires_at=Math.floor(Date.now()/1000)-7200;localStorage.setItem(k,JSON.stringify(v))}}catch(e){}}})()")
    c.close();c,p=open_ctx();p.goto(B+'tienda/');ck(state(p,12)=='dentro','con el token vencido sigue dentro (se renueva solo)')
    uid2=p.evaluate("BK.sb.auth.getSession().then(r=>r.data.session&&r.data.session.user.id)");ck(uid2==made[0],'misma sesión (no se creó otra)')
    # sin internet y token vencido
    p.evaluate("(()=>{for(const k of Object.keys(localStorage))if(k.startsWith('mt-auth-tienda')){const v=JSON.parse(localStorage.getItem(k));v.expires_at=Math.floor(Date.now()/1000)-7200;localStorage.setItem(k,JSON.stringify(v))}})()");c.close()
    c,p=open_ctx(offline=True)
    try:p.goto(B+'tienda/',timeout=15000);s=state(p)
    except Exception as e:s='sin página offline'
    ck(s=='dentro','sin internet y token vencido sigue dentro ('+s+')');c.close()
    c,p=open_ctx();p.goto(B+'tienda/');ck(state(p,12)=='dentro','al volver el internet sigue dentro');ck(p.evaluate("BK.sb.auth.getSession().then(r=>r.data.session&&r.data.session.user.id)")==made[0],'sesión conservada');c.close()
    d.evaluate(f"BK.rpc('gen_tablet_code',{{p_store:{SID}}})")
    c,p=open_ctx();p.goto(B+'tienda/');p.wait_for_function("window.BK&&BK.ready",timeout=20000);time.sleep(6);ck(not p.evaluate("tSessOk()"),'si el dueño genera un código nuevo, la tablet vieja vuelve a pedir código');c.close()
    b.close()
shutil.rmtree(UD,ignore_errors=True)
print('MADE='+json.dumps(made));print('TODO OK' if not fails else f'{fails} FALLAS');sys.exit(1 if fails else 0)
