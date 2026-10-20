# v33: selector de Pedidos del dueño. Uso: IDS=act,ent,pro,rev,can (pedidos de prueba) MT_BASE=<url> python3 tests/orders_filter_ui.py
import os,time,subprocess
from playwright.sync_api import sync_playwright
B=os.environ.get('MT_BASE','http://localhost:8000/');SH=os.environ.get('MT_SHOTS','shots');fails=0
A,E,P,RV,C=os.environ['IDS'].split(',')
def ck(c,m):
    global fails;print('OK  ' if c else 'FAIL',m);fails+=0 if c else 1
def sql(q):subprocess.run(['python3','/workspace/sq.py'],input=q.encode(),capture_output=True)
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/google-chrome');d=b.new_context(service_workers='block',viewport={'width':390,'height':844}).new_page()
    d.goto(B+'dueno/');d.wait_for_function("window.BK&&BK.ready");d.fill('#bke','mt-test-due@mandados-test.dev');d.fill('#bkp','Prueba-12345');d.click('#bkgo');d.wait_for_function("!locked()");time.sleep(3)
    d.evaluate("localStorage.removeItem('mt-odsel')");d.reload();d.wait_for_function("window.BK&&BK.ready");time.sleep(3);d.evaluate("go('todos')");time.sleep(1)
    has=lambda i:d.evaluate(f"document.getElementById('app').innerText.includes('#{i} ')||document.getElementById('app').innerText.includes('#{i}\\n')")
    ids=lambda:d.evaluate("[...document.getElementById('app').innerText.matchAll(/#(\\d{4})\\b/g)].map(m=>+m[1])")
    ck('Activos (' in d.inner_text('#odbtn') and '▼' in d.inner_text('#odbtn'),'selector con ▼ y "Activos (n)" por defecto')
    ck(has(A) and not has(P) and not has(E) and not has(C),'Activos: solo el pedido activo de prueba (no los otros)');d.screenshot(path=SH+'/ped1_cerrado.png')
    L=[x for x in ids() if x>=2000];ck(L==sorted(L),'Activos: el más antiguo primero')
    d.click('#odbtn');time.sleep(.3);t=d.inner_text('#odmenu');ck(all(x in t for x in ['Activos','En proceso','Entregados','Cancelados']) and 'por revisar' in t,'menú abierto con las 4 opciones, conteos y "por revisar"');d.screenshot(path=SH+'/ped2_abierto.png')
    d.click('#odopt-pro');time.sleep(.5);ck(has(P) and not has(A),'En proceso');d.screenshot(path=SH+'/ped3_proceso.png')
    d.click('#odbtn');d.click('#odopt-ent');time.sleep(.5);ck(has(E) and has(RV),'Entregados (con y sin código)');ck(d.query_selector(f'[data-odrev="{RV}"]') is not None and d.query_selector(f'[data-odrev="{E}"]') is None,'badge "Entregado (sin código) – por revisar" solo en el que toca')
    L=[x for x in ids() if x>=2000];ck(L==sorted(L,reverse=True),'Entregados: el más reciente primero');d.screenshot(path=SH+'/ped4_entregados.png')
    d.click('#odbtn');d.click('#odopt-can');time.sleep(.5);ck(has(C),'Cancelados');d.screenshot(path=SH+'/ped5_cancelados.png')
    d.reload();d.wait_for_function("window.BK&&BK.ready");time.sleep(3);d.evaluate("go('todos')");time.sleep(1);ck('Cancelados' in d.inner_text('#odbtn'),'recuerda la última opción')
    d.click('#odbtn');d.click('#odopt-act');time.sleep(.5);n0=d.inner_text('#odbtn')
    sql(f"update orders set st=3 where id={A} and store_id=(select store_id from orders where id={A}) and exists(select 1 from stores where id=store_id and extra->>'mtTest'='1')")
    t0=time.time();ok=False
    while time.time()-t0<15:
        if not has(A):ok=True;break
        time.sleep(.5)
    ck(ok and d.inner_text('#odbtn')!=n0,'tiempo real: el pedido pasa solo de Activos a En proceso')
    d.click('#odbtn');d.click('#odopt-pro');time.sleep(.5);ck(has(A),'aparece en En proceso')
    # vacío
    d.evaluate("DB.orders=DB.orders.filter(o=>!o.cancel);render()");d.click('#odbtn');d.click('#odopt-can');time.sleep(.3);ck('No hay pedidos cancelados' in d.inner_text('#app'),'mensaje cuando la lista está vacía');d.screenshot(path=SH+'/ped6_vacio.png')
print('FALLOS',fails) if fails else print('TODO OK')
