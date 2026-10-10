import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync, rmSync, readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {emptyState, units, observe, dayKey, estimate, totals, history} from '../src/accounting.ts'
import {parseSettings, DEFAULT_SETTINGS, initialMode} from '../src/shared.ts'
import type {BalanceView, Source} from '../src/shared.ts'
import type {Context, SessionEvent} from '../src/host.ts'
import {Sources, fingerprint, officialEndpoint} from '../src/sources.ts'
import {Engine} from '../src/engine.ts'
function context() {
  let signedIn=true, key='test-key', baseURL='https://api.deepseek.com/anthropic'
  const services: Record<string,unknown> = {
    llm:{listConfigurableProviders:()=>[{provider:'deepseek-account',settingsNs:'account',settingsPath:[]},{provider:'deepseek-official',settingsNs:'key',settingsPath:[]}]},
    settings:{describe:()=>[{ns:'account',value:{baseURL}},{ns:'key',value:{baseURL,apiKeyEnv:'CUSTOM_KEY'}}]},
    credentials:{resolve:async(ref:string)=>{assert.equal(ref,'CUSTOM_KEY');return key?{value:key}:undefined}},
    deepseekAccount:{
      getState:async()=>({status:signedIn?'credential-stored':'signed-out'}),
      getPlatformSession:async()=>signedIn?{origin:'https://platform.deepseek.com',token:'account-secret',userId:'user-1'}:null,
      getProfile:async()=>({status:'ready',value:{id:'user-1',name:'测试账户'}}),
      getBalance:async()=>signedIn?{status:'ready',value:[],bonusWallets:[{currency:'CNY',balance:'12.3'}]}:null,
    },
  }
  const ctx:Context={get:n=>services[n],on:()=>()=>{},inject:()=>{},effect:()=>{}}
  return {ctx,services,setSignedIn:(v:boolean)=>{signedIn=v},setKey:(v:string)=>{key=v},setBase:(v:string)=>{baseURL=v}}
}
test('fixed-point zero, credits, currency/account/source isolation and midnight baseline',()=>{
  const s=emptyState(), at=Date.parse('2026-10-10T15:50:00Z')
  assert.equal(units('0.00000001'),1); assert.equal(units('0'),0); assert.throws(()=>units('NaN'))
  assert.equal(units('1.004700000000e2'), units('100.47'))
  assert.equal(units('-.000000015'), -2); assert.equal(units('0.0000000049'), 0)
  assert.throws(()=>units('e2')); assert.throws(()=>units('1e1001'))
  observe(s,'account','a','CNY',units('10'),at)
  observe(s,'account','a','CNY',units('8'),at+1)
  observe(s,'account','a','CNY',units('18'),at+2)
  observe(s,'account','a','CNY',units('17'),at+3)
  observe(s,'api-key','b','USD',units('50'),at)
  observe(s,'account','a','USD',0,at)
  observe(s,'account','different','CNY',units('20'),at)
  observe(s,'account','a','CNY',units('99'),at+1)
  const row=history(s,'account','a').find(r=>r.currency==='CNY')!
  assert.equal(row.debit,units('3'));assert.equal(row.credit,units('10'));assert.equal(row.last,units('17'))
  observe(s,'account','a','CNY',units('16'),Date.parse('2026-10-10T16:01:00Z'))
  assert.equal(dayKey(Date.parse('2026-10-10T16:01:00Z')),'2026-10-11')
  assert.equal(history(s,'account','a').find(r=>r.day==='2026-10-11')!.debit,0)
  assert.equal(Object.keys(s.books).length,4)
})
test('known pricing interval; reasoning is already included; unknown prices stay unknown',()=>{
  const u={inputTokens:1000000,cacheReadTokens:1000000,cacheWriteTokens:0,outputTokens:1000000}
  assert.deepEqual(estimate('deepseek-flash',u)?.CNY,{low:units('5.02'),high:units('10.04')})
  assert.deepEqual(estimate('deepseek-v4-pro',u)?.USD,{low:units('2.662'),high:units('5.324')})
  assert.equal(estimate('other-model',u),null)
  assert.equal(estimate('deepseek-v4-flash',u)?.CNY.low,units('5.02'))
})
test('display settings persist both mode and reject invalid/path inputs',()=>{
  const next=parseSettings({displayMode:'both',character:'lumine',sound:true},DEFAULT_SETTINGS)
  assert.equal(next.displayMode,'both');assert.equal(next.character,'lumine')
  assert.throws(()=>parseSettings({character:'../secret'},next));assert.throws(()=>parseSettings({scale:Infinity},next))
  assert.throws(()=>parseSettings({lowBalance:{CNY:-1,USD:1}},next))
})
test('official endpoints only, including custom credential reference',async()=>{
  assert.equal(officialEndpoint('https://api.deepseek.com/anthropic'),true)
  for(const u of ['https://api.deepseek.com.evil.test','http://api.deepseek.com','https://user:pass@api.deepseek.com','https://proxy.test'])assert.equal(officialEndpoint(u),false)
  const f=context(), sources=new Sources(f.ctx)
  assert.equal(await sources.identity('api-key'),fingerprint('key:test-key'))
  f.setBase('https://proxy.test');assert.equal(await sources.identity('api-key'),null)
})
test('account bonus-only balance and sign-out independent of key',async()=>{
  const f=context(),s=new Sources(f.ctx)
  const view=await s.fetch('account');assert.equal(view.status,'ready');assert.equal(view.wallets[0].total,units('12.3'))
  assert.equal(view.label,'测试账户');assert.equal(JSON.stringify(view).includes('account-secret'),false)
  f.setSignedIn(false);assert.equal((await s.fetch('account')).status,'signed-out')
  assert.ok(await s.identity('api-key'));f.setKey('');assert.equal((await s.fetch('api-key')).status,'missing-key')
})
test('API key balance errors are not zero and raw credentials never reach renderer',async()=>{
  const f=context(),s=new Sources(f.ctx), original=globalThis.fetch
  try {
    globalThis.fetch=async(_url,init)=>{assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer test-key');return new Response(JSON.stringify({is_available:true,balance_infos:[{currency:'USD',total_balance:'52.5',topped_up_balance:'50',granted_balance:'2.5'}]}))}
    const view=await s.fetch('api-key');assert.equal(view.wallets[0].total,units('52.5'));assert.equal(view.wallets[0].currency,'USD')
    assert.equal(JSON.stringify(view).includes('test-key'),false)
    globalThis.fetch=async()=>new Response('',{status:401})
    const failed=await s.fetch('api-key');assert.equal(failed.status,'failed');assert.deepEqual(failed.wallets,[])
    globalThis.fetch=async()=>{f.setKey('new-key');return new Response(JSON.stringify({is_available:true,balance_infos:[{currency:'CNY',total_balance:'1',topped_up_balance:'1',granted_balance:'0'}]}))}
    assert.equal((await s.fetch('api-key')).status,'failed')
  } finally {globalThis.fetch=original}
})
test('two different balances, one-sided failure, mode persistence, zero and concurrent source refresh',async()=>{
  const f=context(),home=mkdtempSync(join(tmpdir(),'whale-')),engine=new Engine(f.ctx,home)
  try {
    let count=0
    engine.sources.fetch=async(source:Source):Promise<BalanceView>=>{count++;return {source,label:source,status:'ready',message:'',scope:source,updatedAt:Date.now(),wallets:[{currency:source==='account'?'CNY':'USD',total:source==='account'?units('12'):units('90'),recharge:0,bonus:0}]}}
    await engine.initialize();assert.equal(initialMode(engine.balances),'both');assert.equal(engine.state.settings.displayMode,'both')
    assert.equal(engine.balances.account.wallets[0].total,units('12'));assert.equal(engine.balances['api-key'].wallets[0].total,units('90'))
    engine.settings({displayMode:'both'});await Promise.all([engine.refresh('account'),engine.refresh('account')]);assert.equal(count,3)
    engine.sources.fetch=async source=>({source,label:source,status:'failed',message:'failed',scope:null,updatedAt:null,wallets:[]})
    await engine.refresh('account');assert.equal(engine.balances.account.status,'failed');assert.equal(engine.balances['api-key'].status,'ready')
    assert.equal(engine.state.settings.displayMode,'both')
    assert.equal(new Engine(f.ctx,home).state.settings.displayMode,'both')
  }finally {engine.closed=true;rmSync(home,{recursive:true,force:true})}
})
test('concurrent turns, duplicate/replayed events, mixed sources, key changes and hidden source accounting',async()=>{
  const f=context(),home=mkdtempSync(join(tmpdir(),'whale-')),engine=new Engine(f.ctx,home),now=Date.now()
  const event=(type:string,seq:number,turn:number,extra:Record<string,unknown>={}):SessionEvent=>({type,seq,time:now+seq,data:{turn,step:0,...extra}})
  const message=(provider:string,model='deepseek-flash')=>({message:{source:{kind:'model',provider,model}},usage:{inputTokens:10,cacheReadTokens:20,outputTokens:30,reasoningTokens:25}})
  engine.sources.fetch=async source=>({source,label:source,status:'failed',message:'offline',scope:null,updatedAt:null,wallets:[]})
  try {
    engine.settings({displayMode:'account'})
    await engine.event({id:'a'},event('step/start',0,1)); f.setKey('replacement')
    await engine.event({id:'a'},event('assistant/message',1,1,message('deepseek-official')))
    await engine.event({id:'a'},event('assistant/message',1,1,message('deepseek-official')))
    await engine.event({id:'a'},event('assistant/message',2,1,message('deepseek-account','unknown')))
    await engine.event({id:'b'},event('assistant/message',0,1,message('deepseek-account')))
    await engine.event({id:'b'},event('turn/end',1,1));await engine.event({id:'a'},event('turn/end',3,1));await engine.event({id:'a'},event('turn/end',3,1))
    assert.equal(engine.state.calls.length,3);assert.equal(engine.state.completions.length,2)
    assert.equal(engine.state.calls[0].scope,fingerprint('key:test-key'));assert.equal(engine.state.calls[1].costs,null)
    assert.equal(totals(engine.state.calls,'CNY').tokens,180)
    await engine.event({id:'a'},event('assistant/message',4,2,message('other-provider')))
    f.setBase('https://proxy.test');await engine.event({id:'a'},event('assistant/message',5,2,message('deepseek-official')))
    assert.equal(engine.state.calls.length,3)
    const file=readFileSync(engine.path,'utf8');assert.equal(file.includes('account-secret'),false);assert.equal(file.includes('replacement'),false)
    assert.equal(engine.rows().every(r=>!r.observed),true)
  }finally {engine.closed=true;rmSync(home,{recursive:true,force:true})}
})
