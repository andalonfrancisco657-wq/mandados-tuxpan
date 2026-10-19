# Importar productos (tienda) + aprobación en bloque (dueño). Requiere server :8000, MT_TEST_STORE (tienda de prueba con
# un producto "Producto mapa (test)") y usuarios mt-test-due / mt-test-cli. Solo toca la tienda de prueba.
import os,sys,time,openpyxl,csv
from playwright.sync_api import sync_playwright
B='http://localhost:8000/';PW='Prueba-12345';SID=int(os.environ['MT_TEST_STORE']);SH='shots/';TMP='/tmp/mt_imp.xlsx'
fails=0
def ck(c,m):
    global fails;print('OK  ' if c else 'FAIL',m);fails+=0 if c else 1
def wait(p,js,t=20000): p.wait_for_function(js,timeout=t);return True
wb=openpyxl.Workbook();ws=wb.active;ws.append(['Lista de precios Tienda Prueba']);ws.append([])
ws.append(['Descripción','Costo','EAN','Inventario','Presentación','Departamento'])
for r in [['Producto mapa (test)',19.5,None,10,'1 pza','General'],['PRODUCTO  MAPA (TEST)',21,None,3,'',''],['Refresco prueba (test)','$15.00',7500000000017,24,'600 ml','Bebidas'],
          ['',10,None,1,'',''],['Papas prueba (test)','abc',None,5,'',''],['Jabón prueba (test)',22,None,'no','1 pza','Limpieza'],['Sin precio nuevo (test)',None,None,2,'','']]: ws.append(r)
wb.save(TMP)
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True)
    def mk(w=390,h=844):
        c=b.new_context(viewport={'width':w,'height':h},service_workers='block',accept_downloads=True);p=c.new_page();p.on('dialog',lambda d:d.accept());p.on('pageerror',lambda e:print('PAGEERR',e));return p
    d=mk();d.goto(B+'dueno/');wait(d,"window.BK&&BK.ready");d.fill('#bke','mt-test-due@mandados-test.dev');d.fill('#bkp',PW);d.click('#bkgo');wait(d,"!locked()");time.sleep(2)
    code=d.evaluate(f"BK.rpc('gen_tablet_code',{{p_store:{SID}}})")
    t=mk(820,1180);t.goto(B+'tienda/');wait(t,"BK.ready");t.select_option('#tsel',str(SID));t.fill('#tcode',code);t.click('#tenter');ck(wait(t,"tSessOk()"),'tablet de prueba entra')
    t.evaluate("go('prods')");wait(t,"!!document.querySelector('#impopen')");ck(True,'botón Importar productos visible')
    t.evaluate("document.querySelector('#impopen').scrollIntoView({block:'center'})");time.sleep(.3);t.screenshot(path=SH+'tienda_importar_boton.png')
    t.click('#impopen');wait(t,"!!document.querySelector('#impplant')")
    with t.expect_download() as dl: t.click('#impplant')
    f=dl.value;pth='/tmp/mt_tpl.xlsx';f.save_as(pth);ck(f.suggested_filename=='plantilla_productos_mandados.xlsx' and [c.value for c in openpyxl.load_workbook(pth).active[1]][:2]==['Nombre','Precio'],'plantilla Excel descargada')
    t.set_input_files('#impf',TMP);wait(t,"!!document.querySelector('#impsum')",30000)
    m=t.evaluate("IMPDBG().map");ck(m=={'n':0,'pc':1,'cb':2,'stk':3,'pres':4,'sec':5},'columnas detectadas solas '+str(m))
    t.select_option('#map-pres','-1');ck(t.evaluate("IMPDBG().map.pres")==-1,'mapeo manual de columnas');t.select_option('#map-pres','4')
    s=t.inner_text('#impsum');print(s.replace('\n',' | '))
    ck(t.locator('tr.imperr').count()==3 and t.locator('tr.impdup').count()==1,'3 errores resaltados y 1 repetido')
    ck('7500000000017' in t.inner_text('#imprev'),'código de barras largo leído completo')
    t.screenshot(path=SH+'tienda_importar_vista_previa.png',full_page=True)
    t.click('#impgo');wait(t,"!!document.querySelector('#impres')",60000);r=t.inner_text('#impres');print(r.replace('\n',' | '))
    R=t.evaluate("IMPDBG().res");ck(R['upd']==1 and R['nuevos']==2 and not R.get('fail'),'resultado: 1 actualizado, 2 nuevos '+str({k:R[k] for k in ('upd','same','nuevos','dup')}))
    t.screenshot(path=SH+'tienda_importar_resultado.png')
    p=t.evaluate("myStore().prods.find(p=>p.n=='Producto mapa (test)')");ck(p['pc']==19.5 and p.get('stk')==10 and p['disp'],'existente: precio y existencia actualizados directo')
    ck(t.evaluate("myStore().revT>Date.now()-120000"),'cuenta como confirmación de precios')
    ck(t.evaluate("DB.tReq.filter(r=>r.storeId==%d&&r.imp&&r.st=='pendiente').length"%SID)==2,'nuevos quedan como solicitudes pendientes')
    e=t.evaluate("BK.rpc('import_store_products',{p_store:1,p_rows:[{n:'x',pc:1}]}).then(()=>'ok',e=>e.message)");ck(e!='ok','tablet no puede importar en otra tienda')
    e=t.evaluate("BK.rpc('import_store_products',{p_store:%d,p_rows:Array.from({length:501},(_,i)=>({n:'z'+i,pc:1}))}).then(()=>'ok',e=>e.message)"%SID);ck('500' in e,'límite de filas por envío en el servidor')
    t.click('text=Importar otro archivo');t.set_input_files('#impf',TMP);wait(t,"!!document.querySelector('#impsum')",30000)
    ck(t.locator('tr.impdup').count()==3,'al re-subir, los nuevos aparecen como “Ya está en revisión”')
    c=mk();c.goto(B);wait(c,"window.BK&&BK.ready")
    # dueño: aprobación en bloque solo de las solicitudes de la tienda de prueba
    d.evaluate("BK.pull()");time.sleep(2);d.evaluate("go('treq')");wait(d,"!!document.querySelector('#trbar')")
    ids=d.evaluate("DB.tReq.filter(r=>r.storeId==%d&&r.st=='pendiente'&&r.tipo=='nuevo').map(r=>r.id)"%SID);ck(len(ids)==2,'dueño ve las 2 solicitudes importadas')
    for i in ids: d.check(f'.trsel[data-id="{i}"]')
    others=d.evaluate("[...document.querySelectorAll('.trsel:checked')].map(c=>+c.dataset.id)");ck(sorted(others)==sorted(ids),'solo las de prueba seleccionadas')
    ck('(2)' in d.inner_text('#trbulk'),'contador de seleccionados');d.evaluate("scrollTo(0,0)");time.sleep(.3);d.screenshot(path=SH+'dueno_aprobacion_bloque.png')
    d.click('#trbulk');time.sleep(4)
    P=d.evaluate("store(%d).prods.filter(p=>/prueba \\(test\\)/.test(p.n)).map(p=>({n:p.n,pc:p.pc,p:p.p,cb:p.cb||null,sec:p.sec,disp:p.disp}))"%SID);print(P)
    ck(len(P)==2 and any(x['cb']=='7500000000017' and x['sec']=='Bebidas' and x['p']>=x['pc'] for x in P),'productos creados con código, categoría y precio sugerido')
    d.evaluate("BK.pull()");time.sleep(2);ck(d.evaluate("DB.tReq.filter(r=>r.storeId==%d&&r.st=='aprobado').length"%SID)==2,'solicitudes aprobadas guardadas en el servidor')
    b.close()
print('TODO OK' if not fails else f'{fails} FALLAS');sys.exit(1 if fails else 0)
