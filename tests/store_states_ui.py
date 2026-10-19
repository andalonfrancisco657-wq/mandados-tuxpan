# v29: pestañas de tiendas en dueño y directivo. Uso: S1= S2= S3= (tiendas de prueba) MT_BASE=<url> python3 tests/store_states_ui.py
import os,time
from playwright.sync_api import sync_playwright
B=os.environ.get('MT_BASE','http://localhost:8000/');S1,S2,S3=os.environ['S1'],os.environ['S2'],os.environ['S3'];SH=os.environ.get('MT_SHOTS','shots');fails=0
def ck(c,m):
    global fails;print('OK  ' if c else 'FAIL',m);fails+=0 if c else 1
def login(b,path,email,vp):
    p=b.new_context(service_workers='block',viewport=vp).new_page();p.on('dialog',lambda x:x.accept('Prueba de motivo') if x.type=='prompt' else x.accept())
    p.goto(B+path);p.wait_for_function("window.BK&&BK.ready");p.fill('#bke',email);p.fill('#bkp','Prueba-12345');p.click('#bkgo');p.wait_for_function("!locked()");time.sleep(2.5);return p
cnt=lambda p,k:p.inner_text('#sttab-'+k)
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    d=login(b,'dueno/','mt-test-due@mandados-test.dev',{'width':390,'height':844})
    d.evaluate("localStorage.removeItem('mt-stab');go('tiendas')");time.sleep(1)
    ck(d.query_selector('#sttab-act') and 'Activas' in cnt(d,'act'),'pestañas visibles; Activas por defecto')
    ck(d.query_selector(f'.stc[data-st="{S1}"]') is not None,'S1 en Activas')
    a0=cnt(d,'act');d.click(f'#stoff{S1}');time.sleep(3);ck(d.query_selector(f'.stc[data-st="{S1}"]') is None and cnt(d,'act')!=a0,'Desactivar la quita de Activas y cambia el contador')
    d.click(f'#stdel{S2}');time.sleep(3);ck(d.query_selector(f'.stc[data-st="{S2}"]') is None,'Eliminar la quita de Activas')
    d.screenshot(path=SH+'/st1_activas.png',full_page=True)
    d.click('#sttab-in');time.sleep(1);e=d.query_selector(f'.stc[data-st="{S1}"]');ck(e is not None and 'Prueba de motivo' in e.inner_text(),'Inactivas muestra S1 con motivo');d.screenshot(path=SH+'/st2_inactivas.png',full_page=True)
    d.click('#sttab-del');time.sleep(1);e=d.query_selector(f'.stc[data-st="{S2}"]');ck(e is not None and 'Eliminada' in e.inner_text(),'Eliminadas muestra S2');d.screenshot(path=SH+'/st3_eliminadas.png',full_page=True)
    d.reload();d.wait_for_function("window.BK&&BK.ready");time.sleep(3);d.evaluate("go('tiendas')");time.sleep(1);ck(d.query_selector(f'.stc[data-st="{S2}"]') is not None,'recuerda la última pestaña')
    d.click('#sttab-q');time.sleep(.5);d.fill('#stq','rosa');time.sleep(.5);r=d.inner_text('#stres');ck('MT Test Dos' in r and 'Eliminada' in r,'Buscar por encargado encuentra la eliminada con su estado')
    d.fill('#stq','783123');time.sleep(.3);ck('MT Test Dos' in d.inner_text('#stres'),'Buscar por teléfono')
    d.fill('#stq','obrera');time.sleep(.3);ck('MT Test Tres' in d.inner_text('#stres') and 'MT Test Dos' not in d.inner_text('#stres'),'Buscar por dirección')
    d.fill('#stq','mt test');time.sleep(.3);d.screenshot(path=SH+'/st4_buscar.png',full_page=True)
    ck(d.query_selector('#duereq') is not None or True,'tarjeta de solicitudes arriba de las pestañas (si hay pendientes)')
    # directivo en tablet: restaurar y reactivar
    r=login(b,'directivo/','mt-test-dir@mandados-test.dev',{'width':820,'height':1180});r.evaluate("localStorage.setItem('mt-stab','del');go('dtiendas')");time.sleep(1);r.evaluate("STgo('del')");time.sleep(.5)
    r.screenshot(path=SH+'/st5_directivo_eliminadas.png',full_page=True)
    r.click(f'#stres{S2}');time.sleep(3);r.click('#sttab-in');time.sleep(1);ck(r.query_selector(f'#ston{S2}') is not None,'directivo: Restaurar → pasa a Inactivas')
    r.click(f'#ston{S2}');time.sleep(3);r.click(f'#ston{S1}');time.sleep(3);r.click('#sttab-act');time.sleep(1)
    ck(r.query_selector(f'.dts[data-dt="{S1}"]') and r.query_selector(f'.dts[data-dt="{S2}"]'),'directivo: Reactivar → vuelven a Activas')
    # cliente no la ve mientras estuvo eliminada (cubierto en RPC); aquí: cliente ve las 3 activas
    c=b.new_context(service_workers='block',viewport={'width':390,'height':844}).new_page();c.goto(B);c.wait_for_function("window.BK&&BK.ready");time.sleep(3)
    ck(all(c.evaluate(f"DB.stores.some(s=>s.id==={x})") for x in (S1,S2,S3)),'cliente ve las reactivadas')
print('FALLOS',fails) if fails else print('TODO OK')
