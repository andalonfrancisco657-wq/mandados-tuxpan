# v30: cortina de tiendas (dueño 390x844, directivo tablet). Uso: S1= S2= S3= MT_BASE=<url> python3 tests/store_accordion_ui.py
import os,time
from playwright.sync_api import sync_playwright
B=os.environ.get('MT_BASE','http://localhost:8000/');S1,S2,S3=os.environ['S1'],os.environ['S2'],os.environ['S3'];SH=os.environ.get('MT_SHOTS','shots');fails=0
def ck(c,m):
    global fails;print('OK  ' if c else 'FAIL',m);fails+=0 if c else 1
def login(b,path,email,vp):
    p=b.new_context(service_workers='block',viewport=vp).new_page();p.on('dialog',lambda x:x.accept('Prueba') if x.type=='prompt' else x.accept())
    p.goto(B+path);p.wait_for_function("window.BK&&BK.ready");p.fill('#bke',email);p.fill('#bkp','Prueba-12345');p.click('#bkgo');p.wait_for_function("!locked()");time.sleep(2.5);return p
vis=lambda p,s:p.is_visible(s)
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    d=login(b,'dueno/','mt-test-due@mandados-test.dev',{'width':390,'height':844})
    d.evaluate("localStorage.setItem('mt-stab','act');localStorage.removeItem('mt-stopen');go('tiendas')");time.sleep(1)
    n=d.evaluate("document.querySelectorAll('.sth').length");ck(n>=3,f'una fila por tienda ({n})')
    ck(d.evaluate("[...document.querySelectorAll('.stbody')].every(e=>e.offsetParent===null)"),'todas cerradas al inicio')
    d.evaluate(f"document.getElementById('sth{S3}').scrollIntoView({{block:'center'}})");d.screenshot(path=SH+'/acc1_cerradas.png')
    d.click(f'#sth{S1}');time.sleep(.5);ck(vis(d,f'#stoff{S1}'),'tocar abre la tienda con sus controles')
    d.click(f'#sth{S2}');time.sleep(.5);ck(vis(d,f'#stoff{S2}') and not vis(d,f'#stoff{S1}'),'abrir otra cierra la anterior')
    d.evaluate(f"document.getElementById('sth{S2}').scrollIntoView({{block:'start'}});scrollBy(0,-70)");time.sleep(.5);d.screenshot(path=SH+'/acc2_abierta.png')
    d.reload();d.wait_for_function("window.BK&&BK.ready");time.sleep(3);d.evaluate("go('tiendas')");time.sleep(1);ck(vis(d,f'#stoff{S2}'),'recuerda la tienda abierta')
    d.click(f'#sth{S2}');time.sleep(.4);ck(not vis(d,f'#stoff{S2}'),'tocar otra vez la cierra')
    d.click(f'#sth{S1}');d.click(f'#stoff{S1}');time.sleep(3);d.click('#sttab-in');time.sleep(1);ck(d.query_selector(f'#sth{S1}') is not None and vis(d,f'#ston{S1}'),'Inactivas también en cortina (sigue abierta la misma tienda)')
    d.click(f'#sth{S1}');time.sleep(.4);ck(not vis(d,f'#ston{S1}'),'se cierra en Inactivas');d.click(f'#sth{S1}');time.sleep(.4);d.click(f'#ston{S1}');time.sleep(3)
    d.click('#sttab-q');d.fill('#stq','mt test');time.sleep(.5);ck(d.evaluate("document.querySelectorAll('#stres .sth').length")==3,'Buscar: resultados en cortina')
    d.click(f'#stres #sth{S3}');time.sleep(.4);ck(vis(d,f'#stoff{S3}'),'abre resultado de búsqueda');d.screenshot(path=SH+'/acc3_buscar.png')
    r=login(b,'directivo/','mt-test-dir@mandados-test.dev',{'width':820,'height':1180});r.evaluate("localStorage.setItem('mt-stab','act');localStorage.removeItem('mt-stopen');go('dtiendas')");time.sleep(1)
    ck(r.query_selector(f'#sth{S1}') and not vis(r,f'.dts[data-dt="{S1}"]'),'directivo: cortina');r.click(f'#sth{S1}');time.sleep(.4);ck(vis(r,f'.dts[data-dt="{S1}"]'),'directivo: abre');r.screenshot(path=SH+'/acc4_directivo.png')
    r.click(f'.dts[data-dt="{S1}"]');time.sleep(1);ck(r.evaluate("view")=='dtienda','directivo: ver tienda sigue funcionando')
print('FALLOS',fails) if fails else print('TODO OK')
