# v31: Directivo da de baja → Dueño lo ve en otra sesión (tiempo real). Uso: MT_BASE=<url> python3 tests/sanctions_ui.py
import os,time
from playwright.sync_api import sync_playwright
B=os.environ.get('MT_BASE','http://localhost:8000/');SH=os.environ.get('MT_SHOTS','shots');fails=0;RN='MT Test Rep'
def ck(c,m):
    global fails;print('OK  ' if c else 'FAIL',m);fails+=0 if c else 1
def login(b,path,email,vp):
    p=b.new_context(service_workers='block',viewport=vp).new_page();p.on('dialog',lambda x:x.accept())
    p.goto(B+path);p.wait_for_function("window.BK&&BK.ready");p.fill('#bke',email);p.fill('#bkp','Prueba-12345');p.click('#bkgo');p.wait_for_function("!locked()");time.sleep(3);return p
def wait(p,js,t=12):
    t0=time.time()
    while time.time()-t0<t:
        if p.evaluate(js):return True
        time.sleep(.5)
    return False
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    d=login(b,'dueno/','mt-test-due@mandados-test.dev',{'width':390,'height':844});d.evaluate("go('sol')");time.sleep(1)
    r=login(b,'directivo/','mt-test-dir@mandados-test.dev',{'width':820,'height':1180})
    r.evaluate(f"pKey='rep:{RN}';go('persona')");time.sleep(1);r.select_option('#sacc','Dar de baja');r.select_option('#smot',index=1);r.fill('#snota','Prueba de baja');r.click("button:has-text('Aplicar')");time.sleep(3)
    ck(r.evaluate(f"!!sancSt('rep:{RN}')"),'directivo: baja aplicada');r.screenshot(path=SH+'/sanc1_directivo.png',full_page=True)
    ok=wait(d,f"!!document.querySelector('[data-sanc=\"rep:{RN}\"]')");ck(ok,'dueño la ve sin recargar (tiempo real)')
    t=d.inner_text('#sanccard');ck('Dado de baja por Directivo' in t and 'Prueba de baja' in t,'dueño ve estado, motivo y "por Directivo"')
    d.evaluate("document.getElementById('sanccard').scrollIntoView()");time.sleep(.3);d.screenshot(path=SH+'/sanc2_dueno_lista.png')
    d.evaluate(f"solSel='{RN}';solBack='sol';go('solic')");time.sleep(1);ck('Solo el Directivo puede quitar' in d.inner_text('#repsanc'),'detalle del repartidor en dueño: solo Directivo la quita');d.screenshot(path=SH+'/sanc3_dueno_detalle.png')
    ck(d.query_selector('#sacc') is None,'dueño no tiene formulario de sanción')
    r.evaluate(f"pKey='rep:{RN}';go('persona')");time.sleep(1);r.select_option('#sacc','Reactivar');r.select_option('#smot',index=1);r.click("button:has-text('Aplicar')");time.sleep(3)
    d.evaluate("go('sol')");ok=wait(d,f"!document.querySelector('[data-sanc=\"rep:{RN}\"]')");ck(ok,'reactivación también llega al dueño')
print('FALLOS',fails) if fails else print('TODO OK')
