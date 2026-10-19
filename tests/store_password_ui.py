# v28: UI de contraseña de tienda. Uso: MT_TEST_STORE=<tienda prueba> MT_BASE=<url> python3 tests/store_password_ui.py
import os,time
from playwright.sync_api import sync_playwright
B=os.environ.get('MT_BASE','http://localhost:8000/');SID=os.environ['MT_TEST_STORE'];SH=os.environ.get('MT_SHOTS','shots');fails=0;uids=[]
def ck(c,m):
    global fails;print('OK  ' if c else 'FAIL',m);fails+=0 if c else 1
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    d=b.new_context(service_workers='block',viewport={'width':820,'height':1300}).new_page();d.on('dialog',lambda x:x.accept())
    d.goto(B+'dueno/');d.wait_for_function("window.BK&&BK.ready");d.fill('#bke','mt-test-due@mandados-test.dev');d.fill('#bkp','Prueba-12345');d.click('#bkgo');d.wait_for_function("!locked()");time.sleep(2)
    d.evaluate(f"openTab[{SID}]=true;go('tiendas')");time.sleep(1.5)
    d.wait_for_selector(f'#tpwclose{SID}');
    if d.query_selector(f'#tpwreset{SID}'):d.click(f'#tpwreset{SID}');time.sleep(2)
    ck(d.evaluate(f"TPWSA()[{SID}].hasPw")==False,'dueño: Restablecer contraseña (botón)')
    code=d.evaluate(f"BK.rpc('gen_tablet_code',{{p_store:{SID}}})")
    t=b.new_context(service_workers='block',viewport={'width':820,'height':1180}).new_page()
    t.goto(B+'tienda/');t.wait_for_function("window.BK&&BK.ready");time.sleep(2)
    if t.query_selector('#tmodecode'):t.click('#tmodecode')
    t.select_option('#tsel',SID);t.fill('#tcode',code);t.click('#tenter');t.wait_for_selector('#tpwcard',timeout=15000)
    uids.append(t.evaluate("BK.sb.auth.getSession().then(r=>r.data.session.user.id)"))
    ck('Crea la contraseña de tu tienda' in t.inner_text('#tpwcard'),'tras el código pide crear contraseña');t.screenshot(path=SH+'/pw1_crear.png')
    t.fill('#tpn1','Corta');t.fill('#tpn2','Corta');t.click('#tpsave');time.sleep(1);ck(t.query_selector('#tpwcard') is not None,'rechaza menos de 8')
    t.fill('#tpn1','MiTienda-2026');t.click("#tpwcard button:has-text('Mostrar')");ck(t.get_attribute('#tpn1','type')=='text','mostrar/ocultar')
    t.fill('#tpn2','MiTienda-2026');t.click('#tpsave');time.sleep(2.5)
    ck(t.query_selector('#tpwcard') is None and t.evaluate('tSessOk()'),'contraseña creada, entra a la tienda');ck(t.query_selector('#tpwchg') is not None,'botón Cambiar contraseña')
    t.reload();t.wait_for_function("window.BK&&BK.ready");time.sleep(3);ck(t.query_selector('#tpwcard') is None and t.evaluate('tSessOk()'),'al reabrir no vuelve a pedir crear')
    t.click("button:has-text('Salir')");time.sleep(3);t.wait_for_selector('#tpw',timeout=10000)
    ck(t.query_selector('#tmodepw') is not None,'Salir → pantalla de entrada, opción contraseña por defecto');t.select_option('#tpsel',SID)
    t.fill('#tpw','equivocada1');t.click('#tpenter');time.sleep(2);ck(not t.evaluate('tSessOk()'),'contraseña incorrecta no entra')
    uids.append(t.evaluate("BK.sb.auth.getSession().then(r=>r.data.session&&r.data.session.user.id)"))
    t.fill('#tpw','MiTienda-2026');t.screenshot(path=SH+'/pw2_entrar.png');t.click('#tpenter');time.sleep(3)
    ck(t.evaluate('tSessOk()'),'entra con contraseña');uids.append(t.evaluate("BK.sb.auth.getSession().then(r=>r.data.session.user.id)"))
    t.click('#tpwchg');t.wait_for_selector('#tpcur');t.fill('#tpcur','MiTienda-2026');t.fill('#tpn1','MiTienda-2027');t.fill('#tpn2','MiTienda-2027');t.click('#tpsave');time.sleep(2)
    ck(t.query_selector('#tpwcard') is None,'cambiar contraseña con la actual');t.screenshot(path=SH+'/pw3_dentro.png')
    d.evaluate("BK.pull()");time.sleep(2);d.evaluate(f"openTab[{SID}]=true;go('tiendas')");time.sleep(1.5)
    e=d.query_selector(f'[data-tpw="{SID}"]');e.scroll_into_view_if_needed();d.query_selector(f'.tabc[data-tab="{SID}"]').screenshot(path=SH+'/pw4_dueno.png')
    d.click(f'#tpwclose{SID}');time.sleep(2);t.evaluate("BK.pull()");time.sleep(3);ck(not t.evaluate('tSessOk()'),'dueño: Cerrar sesiones saca a la tablet')
    d.click(f'#tpwblock{SID}');time.sleep(2);t.reload();t.wait_for_function("window.BK&&BK.ready");time.sleep(2)
    ck(t.query_selector(f'#tpsel option[value="{SID}"]') is None,'tienda bloqueada no aparece para entrar')
    d.click(f'#tpwblock{SID}');time.sleep(2)
print('UIDS='+','.join(u for u in uids if u));print('FALLOS',fails) if fails else print('TODO OK')
