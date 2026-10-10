import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {apply} from '../src/index.ts'
import type {Context,Route} from '../src/host.ts'
test('early nonfatal loader, real HTTP route trust, methods, settings validation and disposal',async()=>{
  const home=mkdtempSync(join(tmpdir(),'whale-routes-'))
  const routes=new Map<string,Route>(), effects:(()=>void)[]=[], listeners=new Map<string,((...args:unknown[])=>void)[]>()
  let initialize:((ctx:Context)=>void)|undefined
  const services:Record<string,unknown>={
    profileContext:{name:'desktop',home}, credentials:{resolve:async()=>undefined},
    llm:{listConfigurableProviders:()=>[]}, settings:{describe:()=>[]},
    connection:{requestRejection:(req:{headers:Record<string,string>})=>req.headers['x-test-trust']==='yes'?undefined:403},
    webServer:{register:(route:Route)=>{routes.set(route.path,route);return()=>routes.delete(route.path)}},
  }
  const ctx:Context={get:name=>services[name],on:(name,fn)=>{listeners.set(name,[...(listeners.get(name)??[]),fn]);return()=>{}},inject:(_names,fn)=>{initialize=fn},effect:fn=>{effects.push(fn())}}
  const server=createServer((req,res)=>{const route=routes.get(new URL(req.url||'/','http://localhost').pathname);if(!route){res.writeHead(404);res.end();return}void route.handler(req,res)})
  try{
    apply(ctx)
    assert.equal(routes.size,0)
    const rows:{kind:string;text:string}[]=[]
    for(const fn of listeners.get('webserver/index-inject')??[])fn(rows)
    assert.equal(rows.length,1);assert.equal(rows[0].kind,'script');assert.ok(rows[0].text.includes('s.onerror=function(){}'))
    for(const fn of listeners.get('webserver/index-inject')??[])fn(rows)
    assert.equal(rows.length,1)
    initialize!(ctx)
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
    const port=(server.address() as {port:number}).port, url='http://127.0.0.1:'+port+'/deepseek-whale-lite'
    assert.equal((await fetch(url+'/state')).status,403)
    const headers={'x-test-trust':'yes','Content-Type':'application/json'}
    assert.equal((await fetch(url+'/state',{method:'POST',headers})).status,405)
    assert.equal((await fetch(url+'/settings',{method:'PUT',headers,body:JSON.stringify({displayMode:'both'})})).status,200)
    assert.equal((await fetch(url+'/settings',{method:'PUT',headers,body:JSON.stringify({character:'../secret'})})).status,400)
    const state=await (await fetch(url+'/state',{headers})).json()
    assert.equal(state.settings.displayMode,'both')
    assert.equal(state.balances.account.status,'unavailable');assert.equal(state.balances['api-key'].status,'unavailable')
    assert.equal((await fetch(url+'/balance?source=unknown',{headers})).status,400)
    assert.equal((await fetch(url+'/completions?after=0',{headers})).status,200)
    for(const dispose of effects.reverse())dispose()
    assert.equal(routes.size,0)
    assert.equal((await fetch(url+'/state',{headers})).status,404)
  }finally{for(const dispose of effects)dispose();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));rmSync(home,{recursive:true,force:true})}
})
