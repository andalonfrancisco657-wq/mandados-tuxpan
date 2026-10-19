# v26: la app se recupera si su sesión anónima guardada ya no existe en el servidor (tablet y cliente invitado).
# Uso: MT_TEST_STORE=<tienda de prueba> MT_BASE=<url> python3 tests/stale_session.py   (borra SOLO el usuario anónimo que crea, por id)
import os,sys,time,subprocess,json
from playwright.sync_api import sync_playwright
B=os.environ.get('MT_BASE','http://localhost:8000/');SID=os.environ['MT_TEST_STORE'];fails=0;made=[]
def ck(c,m):
    global fails;print('OK  ' if c else 'FAIL',m);fails+=0 if c else 1
def sql(q): return json.loads(subprocess.check_output(['python3','/workspace/sq.py'],input=q.encode()))
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    d=b.new_context(service_workers='block').new_page();d.goto(B+'dueno/');d.wait_for_function("window.BK&&BK.ready");d.fill('#bke','mt-test-due@mandados-test.dev');d.fill('#bkp','Prueba-12345');d.click('#bkgo');d.wait_for_function("!locked()");time.sleep(2)
    c=b.new_context(viewport={'width':820,'height':1180},service_workers='block');t=c.new_page();E=[];t.on('pageerror',lambda e:E.append(str(e)))
    t.goto(B+'tienda/');t.wait_for_function("window.BK&&BK.ready",timeout=20000);t.evaluate("BK.anon(true)");time.sleep(1)
    uid=t.evaluate("BK.sb.auth.getSession().then(r=>r.data.session.user.id)");made.append(uid);print('anon',uid)
    sql(f"delete from auth.users where id='{uid}' and is_anonymous");ck(sql(f"select count(*) n from auth.users where id='{uid}'")[0]['n']==0,'sesión anónima borrada en el servidor (simula la limpieza)')
    t.reload();t.wait_for_function("window.BK&&BK.ready",timeout=20000);time.sleep(1)
    code=d.evaluate(f"BK.rpc('gen_tablet_code',{{p_store:{SID}}})");t.select_option('#tsel',SID);t.fill('#tcode',code);t.click('#tenter');time.sleep(5)
    ok=t.evaluate("tSessOk()");body=t.inner_text('body')[:200];ck(ok,'la tablet entra con su código aunque la sesión guardada ya no exista');print(' ',body.replace('\n',' | '))
    new=t.evaluate("BK.sb.auth.getSession().then(r=>r.data.session&&r.data.session.user.id)");made.append(new);ck(new and new!=uid,'se creó una sesión nueva automáticamente')
    ck(not E,'sin errores JS '+str(E))
    b.close()
print('MADE='+json.dumps(made));print('TODO OK' if not fails else f'{fails} FALLAS');sys.exit(1 if fails else 0)
