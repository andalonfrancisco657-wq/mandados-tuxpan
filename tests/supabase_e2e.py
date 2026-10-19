import time,re
from playwright.sync_api import sync_playwright
B='http://localhost:8000/';PW='Prueba-12345';fails=[];errs=[]
def ck(c,m):
    print(('OK  ' if c else 'FAIL'),m)
    if not c: fails.append(m)
def mk(b,tag):
    ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block');p=ctx.new_page()
    p.on('console',lambda m:(m.type=='error') and errs.append(tag+': '+m.text));p.on('pageerror',lambda e:errs.append(tag+' pageerror: '+str(e)));p.on('dialog',lambda d:d.accept())
    return p
def wait(p,js,t=15):
    for _ in range(t*4):
        try:
            if p.evaluate(js): return True
        except Exception: pass
        p.wait_for_timeout(250)
    return False
def login(p,url,email):
    p.goto(B+url);wait(p,"BK.ready");p.fill('#bke',email);p.fill('#bkp',PW);p.click('#bkgo');return wait(p,"!locked()")
EM=lambda r:'mt-test-%s@mandados-test.dev'%r
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--headless=new'])
    # cliente nuevo con cuenta
    c=mk(b,'cli');c.goto(B);wait(c,"BK.ready")
    c.click('text=Crear cuenta');c.wait_for_timeout(300)
    for k,v in {'sn':'Cliente E2E','se':EM('e2e'),'sp':PW,'sp2':PW,'st':'3197778888','sc':'Calle Prueba 10, Centro','sr':'portón verde'}.items(): c.fill('#'+k,v)
    c.evaluate("doSignup()");ck(wait(c,"BK.ME&&BK.ME.email==='%s'&&view==='home'"%EM('e2e')),'cliente crea cuenta en Supabase')
    ck(c.evaluate("acct().dirs[0].calle")=='Calle Prueba 10, Centro','perfil con dirección guardado en el servidor')
    c.evaluate("sel='abarrotes';go('nuevo')");c.evaluate("pickStore(1)");pid=c.evaluate("store(1).prods[0].id");pid2=c.evaluate("store(1).prods[2].id")
    c.evaluate(f"setQ({pid},1);setQ({pid},1);setQ({pid2},1);go('carrito')");c.wait_for_timeout(300)
    c.click('text=Confirmar pedido')
    ck(wait(c,"DB.orders.length&&DB.orders[0].srv&&DB.orders[0].id>2000"),'pedido creado en el servidor');oid=c.evaluate("DB.orders[0].id");print('  pedido',oid)
    # dueño genera código de tablet
    d=mk(b,'due');ck(login(d,'dueno/',EM('due')),'dueño entra con su cuenta')
    d.evaluate("tabGen(1)");ck(wait(d,"typeof tabShow!=='undefined'&&tabShow&&tabShow.code"),'dueño genera código de tablet');code=d.evaluate("tabShow.code")
    ck(wait(d,f"DB.orders.some(o=>o.id==={oid})"),'dueño ve el pedido')
    # tablet
    t=mk(b,'tienda');t.goto(B+'tienda/');wait(t,"BK.ready");t.select_option('#tsel','1');t.fill('#tcode',code);t.click('#tenter')
    ck(wait(t,"tSessOk()"),'tablet entra con código (sesión anónima + RPC)')
    ck(wait(t,f"DB.orders.some(o=>o.id==={oid})"),'tienda recibe el pedido')
    to=t.evaluate(f"O({oid})");ck(to['tel']=='' and to['dir']=='' and to['fee']==0,'tienda sin teléfono/domicilio/envío')
    t.evaluate(f"tAccept({oid})");t.wait_for_timeout(1500)
    n=t.evaluate(f"O({oid}).det.items.length")
    for k in range(n): t.evaluate(f"tSurt({oid},{k},'ok')");t.wait_for_timeout(400)
    t.evaluate(f"tNota({oid})");t.wait_for_timeout(800);t.evaluate(f"tReady({oid})")
    ck(wait(t,f"O({oid}).prep&&O({oid}).nota&&O({oid}).nota.fin"),'tienda surte, genera nota y marca listo')
    ck(wait(c,f"O({oid})&&O({oid}).prep",20),'cliente recibe "listo para recoger" en tiempo real')
    # repartidor
    r=mk(b,'rep');ck(login(r,'repartidor/',EM('rep')),'repartidor entra con su cuenta')
    ck(wait(r,f"DB.orders.some(o=>o.id==={oid})"),'repartidor ve el pedido disponible')
    ro=r.evaluate(f"O({oid})");ck(all('p' not in i and 'pc' not in i for i in ro['det']['items']) and 'nota' in ro and 'total' not in ro['nota'],'repartidor sin precios ni total de nota')
    r.evaluate(f"tomar({oid})");ck(wait(r,f"O({oid}).rep==='Test Repartidor'&&!BK.pushing"),'repartidor acepta')
    r.evaluate(f"adv({oid})");wait(r,f"O({oid}).st===1&&!BK.pushing");r.evaluate(f"adv({oid})");ck(wait(r,f"O({oid}).st===2&&!BK.pushing"),'repartidor avanza a Comprando/recoger');r.wait_for_timeout(800)
    r.evaluate(f"tkFoto='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';tkFor={oid};saveRec({oid})")
    ck(wait(r,f"O({oid}).compra&&O({oid}).st>=3&&!BK.pushing"),'repartidor confirma recolección con foto de la nota')
    # chat
    c.evaluate(f"track={oid};go('track')");c.wait_for_timeout(500)
    c.evaluate(f"oSel={oid}");
    r.evaluate(f"oSel={oid};go('pedido')");r.wait_for_timeout(500)
    if r.query_selector('#chatin'): r.fill('#chatin','Ya llegué, salgo?');r.evaluate(f"sendChat({oid},'rep')")
    ck(wait(c,f"O({oid}).chat.some(m=>m.txt==='Ya llegué, salgo?')",20),'chat repartidor → cliente en tiempo real')
    r.evaluate("go('home')");r.wait_for_timeout(300)
    r.evaluate(f"adv({oid})");ck(wait(r,f"O({oid}).st===4"),'repartidor marca entregado')
    ck(wait(c,f"O({oid}).st===4",20),'cliente ve "Entregado" en tiempo real')
    tot=r.evaluate(f"total(O({oid}))");r.evaluate(f"go('home')");r.wait_for_timeout(500)
    if r.query_selector(f'#cm{oid}'): r.fill(f'#cm{oid}',str(tot));r.evaluate(f"cobrar({oid})")
    ck(wait(d,f"O({oid}).cobrado===1&&O({oid}).cobradoMonto==={tot}",20),'dueño ve efectivo cobrado (%s)'%tot)
    ck(d.evaluate(f"O({oid}).compra.monto")>0,'dueño ve monto de la nota (crédito con tienda)')
    ck(c.evaluate(f"O({oid}).compra?O({oid}).compra.monto:0")==0,'cliente no ve monto pagado a la tienda')
    # directivo
    x=mk(b,'dir');ck(login(x,'directivo/',EM('dir')),'directivo entra')
    for v in ['home','cli','rep','due','quejas','mas']: x.evaluate(f"go('{v}')");x.wait_for_timeout(300)
    ck(x.evaluate("Object.keys(accts()).includes('%s')"%EM('e2e')),'directivo ve clientes registrados')
    x.evaluate("go('mas')");x.wait_for_timeout(300)
    if x.query_selector('#ndue'): x.fill('#ndue',EM('cli2'));x.evaluate("bkAddDueno()")
    ck(wait(x,"DB.duenos.includes('Test cli2')"),'directivo promueve dueño por correo')
    # sanción desde UI
    x.evaluate("pKey='cli:%s';go('persona')"%EM('e2e'));x.wait_for_timeout(400);x.select_option('#sacc','Suspender');x.select_option('#sdias','1');x.select_option('#smot',index=1);x.evaluate("sancionar()")
    ck(wait(c,"!!DB.sanc['cli:%s']"%EM('e2e'),40) or (c.reload() or wait(c,"BK.ready&&!!DB.sanc['cli:%s']"%EM('e2e'))),'sanción del directivo llega al cliente')
    # dueño cambia un precio de venta -> cliente lo ve
    d.evaluate("const s=DB.stores.find(x=>x.id===1);s.prods[5].p=99.5;save()");
    ck(wait(d,"!BK.pushing&&BK.snap&&BK.snap.stores.find(x=>x.id===1).prods[5].p===99.5"),'dueño guarda precio en el servidor')
    c.reload();ck(wait(c,"BK.ready&&store(1).prods[5].p===99.5"),'cliente ve el precio nuevo')
    # tienda cambia precio de compra -> precio venta recalculado
    t.evaluate("const s=myStore();s.prods[6].pc=50;save()");ck(wait(t,"!BK.pushing&&myStore().prods[6].pc===50&&myStore().prods[6].p>=55"),'tienda cambia precio de compra; venta se recalcula con margen')
    print('console errors:',errs[:8])
    print(len(fails),'fallas');b.close()
