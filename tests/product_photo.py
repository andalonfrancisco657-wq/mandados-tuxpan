# Foto de producto: botones Tomar foto / Elegir de galería, subida a product-photos desde la tablet, y bloqueo a carpetas ajenas
import os,urllib.request
from playwright.sync_api import sync_playwright
B=os.environ.get('MT_BASE','http://localhost:8000/');SID=int(os.environ['MT_TEST_STORE']);PW='Prueba-12345';SH=os.path.join(os.path.dirname(__file__),'..','shots');fails=[];errs=[]
def ck(c,m):
    print(('OK  ' if c else 'FAIL'),m)
    if not c: fails.append(m)
def wait(p,js,t=15):
    for _ in range(t*4):
        try:
            if p.evaluate(js): return True
        except Exception: pass
        p.wait_for_timeout(250)
    return False
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--headless=new'])
    mk=lambda:b.new_context(viewport={'width':390,'height':844},service_workers='block').new_page()
    d=mk();d.on('dialog',lambda x:x.accept());d.goto(B+'dueno/');wait(d,"BK.ready");d.fill('#bke','mt-test-due@mandados-test.dev');d.fill('#bkp',PW);d.click('#bkgo');wait(d,"!locked()")
    code=d.evaluate(f"BK.rpc('gen_tablet_code',{{p_store:{SID}}})")
    t=mk();t.on('pageerror',lambda e:errs.append(str(e)));t.goto(B+'tienda/');wait(t,"BK.ready");t.select_option('#tsel',str(SID));t.fill('#tcode',code);t.click('#tenter');ck(wait(t,"tSessOk()"),'tablet de prueba entra')
    t.evaluate("go('sol')");t.wait_for_timeout(500)
    cam=t.query_selector('#tfc');gal=t.query_selector('#tf')
    ck(cam and cam.get_attribute('capture')=='environment' and cam.get_attribute('accept')=='image/*','📷 Tomar foto usa capture=environment')
    ck(gal and gal.get_attribute('capture') is None,'🖼️ Elegir de galería sin capture')
    t.screenshot(path=SH+'/tienda_foto_botones.png',full_page=True)
    gal.set_input_files('/tmp/prod.jpg');ck(wait(t,"!!document.querySelector('#tfpv')"),'vista previa de la foto')
    for k,v in {'tn':'Producto foto prueba (test)','tpr':'1 pza','tpp':'10'}.items():
        if t.query_selector('#'+k): t.fill('#'+k,v)
    ids=t.evaluate("[...document.querySelectorAll('#app input,#app select,#app textarea')].map(e=>e.id)");print('  campos',ids)
    t.evaluate("tReqNew()");ck(wait(t,"DB.tReq.some(r=>r.foto&&r.foto.startsWith('preq:%d:'))"%SID),'solicitud de producto con foto guardada')
    key=t.evaluate("DB.tReq.find(r=>r.foto&&r.foto.startsWith('preq:%d:')).foto"%SID);url=t.evaluate(f"BK.prodUrl('{key}')")
    ok=False
    for _ in range(20):
        try: ok=urllib.request.urlopen(url).status==200;break
        except Exception: t.wait_for_timeout(500)
    ck(ok,'foto pública en product-photos: '+url.split('/object/')[-1])
    ck(wait(d,"BK.pull()&&false",2) or True,'')
    r=t.evaluate("""(async()=>{const b=await (await fetch('data:image/jpeg;base64,/9j/4AAQ')).blob();const x=await BK.sb.storage.from('product-photos').upload('1/hack_mt_test.jpg',b,{upsert:true});return x.error?x.error.message:'subió'})()""")
    ck(r!='subió','tablet no puede subir a la carpeta de otra tienda ('+r+')')
    d.evaluate("go('tiendas')");d.wait_for_timeout(300);ck(d.evaluate(f"(async()=>{{const v=await fget('{key}');return !!v}})()"),'dueño puede ver la foto (descarga desde el servidor)')
    print('errors',errs[:5],'\n',len(fails),'fallas');print('KEY',key)
