from playwright.sync_api import sync_playwright
B='http://localhost:8000/'
def wait(p,js,t=15):
    for _ in range(t*4):
        try:
            if p.evaluate(js): return True
        except Exception: pass
        p.wait_for_timeout(250)
    return False
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--headless=new'])
    ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block');p=ctx.new_page();errs=[]
    p.on('pageerror',lambda e:errs.append(str(e)));p.on('console',lambda m:m.type=='error' and errs.append(m.text))
    p.goto(B);wait(p,"BK.ready");p.click('text=Pedir como invitado');wait(p,"BK.ME&&BK.ME.anon")
    p.evaluate("sel='paquetes';go('nuevo')");p.wait_for_timeout(400)
    for k,v in {'de':'Col. Centro','a':'Col. Ejidal','nom':'Invitado E2E','tel':'3192223333','dir':'Calle Inv 5'}.items(): p.fill('#'+k,v)
    p.click('text=Confirmar pedido')
    print('guest order', wait(p,"DB.orders.length&&DB.orders[0].srv&&DB.orders[0].src==='invitado'"), p.evaluate("track"), p.evaluate("Object.keys(JSON.parse(localStorage.getItem('mt_guest_tokens')||'{}'))"))
    p.reload();print('after reload still sees order', wait(p,"BK.ready&&DB.orders.length===1&&myOrd(DB.orders[0])"))
    print('errors',errs)
