import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,writeFileSync,readFileSync,mkdirSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,dirname} from 'node:path'
import {defaultBubbles,definition,moduleOf,parseDefinition,parseBubbles,moveModule,ClickQueue,weightedPick} from '../src/bubbles.ts'
import {NotificationQueue,parseEvents} from '../src/notifications.ts'
import {emptyState,observe,units,dayKey,history,reconcile,bookKey} from '../src/accounting.ts'
import {loadState,saveState,archivedState} from '../src/persistence.ts'
import {ResourceStore,sniff} from '../src/resources.ts'
import {pricingSnapshot} from '../src/pricing.ts'
import {Engine} from '../src/engine.ts'
import type {CallRecord,Notification,NotificationKind,Source,BalanceView} from '../src/shared.ts'
import type {Context} from '../src/host.ts'
const temporary=()=>mkdtempSync(join(tmpdir(),'whale-parity-'))
const call=(id:string,at=Date.now()):CallRecord=>({id,at,session:'fixture',turn:1,source:'api-key',scope:'key-scope',model:'unknown',usage:{inputTokens:1,cacheReadTokens:0,cacheWriteTokens:0,outputTokens:1},costs:null})
const notice=(id:string,kind:NotificationKind,seq:number):Notification=>({id,kind,seq,at:seq,session:'fixture',title:'test',pending:['question','approval'].includes(kind)})
const ctx:Context={get:()=>undefined,on:()=>()=>{},inject:()=>{},effect:()=>{}}

test('bubble row/image constraints, split/merge/reorder, weighted A/B and random no-repeat',()=>{
  const b=definition('a');b.rows[0].push({...moduleOf('text','b'),text:'b'})
  const split=moveModule(b,0,1,1,0,true);assert.deepEqual(split.rows.map(r=>r.map(m=>m.text)),[['a'],['b']])
  assert.deepEqual(moveModule(split,1,0,0,0).rows.map(r=>r.map(m=>m.text)),[['b','a']])
  b.rows[0].push({...moduleOf('text','c'),text:'c'});assert.deepEqual(moveModule(b,0,0,0,2).rows[0].map(m=>m.text),['b','a','c']);assert.deepEqual(moveModule(b,0,0,0,3).rows[0].map(m=>m.text),['b','c','a'])
  assert.throws(()=>parseDefinition({rows:Array.from({length:7},()=>[moduleOf('text')])}))
  assert.throws(()=>parseDefinition({rows:[Array.from({length:7},()=>moduleOf('text'))]}))
  assert.throws(()=>parseDefinition({rows:[[moduleOf('image'),moduleOf('text')]]}))
  assert.throws(()=>parseDefinition({rows:[[moduleOf('image')],[moduleOf('random-image')]]}))
  assert.throws(()=>parseDefinition({rows:[[moduleOf('link')], [{...moduleOf('link'),url:'javascript:alert(1)'}]]}))
  const config=defaultBubbles(),q=new ClickQueue();config.steps[0].options.push({id:'b',weight:9,bubble:definition('B')})
  assert.equal(q.next(config,()=>.8)?.rows[0][0].text,'B');assert.ok(q.next(config));assert.ok(q.next(config));assert.equal(q.next(config),null)
  assert.equal(weightedPick([{weight:99},{weight:1}],x=>x.weight,0,()=>0),1)
  assert.equal(weightedPick([{weight:1}],x=>x.weight,0,()=>0),0)
  assert.throws(()=>parseBubbles({...config,revision:.5}))
  const saved=structuredClone(config),draft=structuredClone(config);draft.steps[0].options[0].bubble.rows[0][0].text='draft';assert.deepEqual(config,saved)
})
test('waiting interactions preempt, other reminders queue, dedup and resolution resume',()=>{
  const q=new NotificationQueue();q.push(notice('c1','complete',1));q.push(notice('c2','complete',2));assert.equal(q.current?.id,'c1')
  q.push(notice('low','low',3));q.push(notice('ask','question',4));assert.equal(q.current?.id,'ask');assert.equal(q.push(notice('ask','question',4)),false)
  q.push(notice('approval','approval',5));q.resolved(new Set(['approval']));assert.equal(q.current?.id,'approval');q.resolved(new Set());assert.equal(q.current?.id,'low');assert.equal(q.next()?.id,'c1');assert.equal(q.next()?.id,'c2');assert.equal(q.next(),null)
  const events=emptyState().settings.events;assert.equal(events.question.enabled,false);assert.equal(events.budget.enabled,false);assert.deepEqual(parseEvents(events),events)
  events.complete.volume=NaN;assert.throws(()=>parseEvents(events))
})
test('v1 migration backs up exact bytes, preserves choices/data and is idempotent; corrupt files protected',()=>{
  const dir=temporary(),path=join(dir,'state.json')
  try{const old=emptyState();observe(old,'account','a','CNY',units('20'),Date.now());old.settings.displayMode='both';old.settings.character='lumine';old.settings.x=23;old.settings.volume=.7;const {bubbles,bookPreferences,notifications,notificationSeq,alertState,dismissed,...v1}=old;const raw=JSON.stringify({...v1,version:1});writeFileSync(path,raw)
    const migrated=loadState(path);assert.equal(migrated.version,3);assert.equal(readFileSync(path+'.v1.bak','utf8'),raw);assert.deepEqual(migrated.books,old.books);assert.equal(migrated.settings.character,'lumine');assert.equal(migrated.settings.x,23);assert.equal(migrated.settings.volume,.7);assert.equal(migrated.settings.displayMode,'both');assert.equal(migrated.settings.events.approval.enabled,false)
    const bytes=readFileSync(path,'utf8');assert.deepEqual(loadState(path),migrated);assert.equal(readFileSync(path,'utf8'),bytes);assert.equal(readFileSync(path+'.v1.bak','utf8'),raw)
    writeFileSync(path,'{broken');assert.throws(()=>loadState(path));assert.equal(readFileSync(path,'utf8'),'{broken')
  }finally{rmSync(dir,{recursive:true,force:true})}
})
test('archive first, retention limits, full retrieval, repeated saves and failed archive keep active records',()=>{
  const dir=temporary(),path=join(dir,'state.json'),now=Date.now(),s=emptyState()
  try{s.calls=[call('old',now-91*86400000),...Array.from({length:20001},(_,i)=>call('recent-'+i,now+i))];observe(s,'account','a','CNY',10,now-366*86400000);saveState(path,s,now);assert.equal(s.calls.length,20000);assert.equal(Object.values(s.books)[0].days[dayKey(now-366*86400000)],undefined);assert.equal(archivedState(path,s).calls.length,20002);assert.equal(history(archivedState(path,s)).some(r=>r.observed),true);saveState(path,s,now);assert.equal(archivedState(path,s).calls.length,20002)
    const failure=emptyState();failure.calls=[call('unsaved',now-100*86400000)];const broken=join(dir,'broken','state.json');mkdirSync(dirname(broken));writeFileSync(join(dirname(broken),'archive'),'blocked');assert.throws(()=>saveState(broken,failure,now));assert.equal(failure.calls.length,1);assert.equal(existsSync(broken),false)
  }finally{rmSync(dir,{recursive:true,force:true})}
})
test('correction retains raw observations, credit/debit formula, conflicts, unchanged refresh, undo and following spend',()=>{
  const s=emptyState(),now=Date.now();observe(s,'account','a','CNY',units('10'),now);observe(s,'account','a','CNY',units('20'),now+1);observe(s,'account','a','CNY',units('17'),now+2)
  let row=history(s)[0];const input={source:row.source,scope:row.scope,currency:row.currency,day:row.day,revision:row.revision,credits:'10',otherDebits:'1',confirmed:true}
  observe(s,'account','a','CNY',units('17'),now+3);reconcile(s,input,now+4);row=history(s)[0];assert.equal(row.amount,units('2'));assert.equal(row.debit,units('3'));assert.equal(row.credit,units('10'));assert.equal(row.correctionLog?.length,1);assert.equal(row.needsReview,false)
  assert.throws(()=>reconcile(s,input),{status:409});observe(s,'account','a','CNY',units('16'),now+5);assert.equal(history(s)[0].amount,units('3'))
  row=history(s)[0];reconcile(s,{...input,revision:row.revision,reset:true});assert.equal(history(s)[0].amount,units('4'));assert.equal(history(s)[0].correctionLog?.length,2)
  assert.throws(()=>reconcile(s,{...input,revision:history(s)[0].revision,confirmed:false}));assert.throws(()=>reconcile(s,{...input,revision:history(s)[0].revision,credits:'1.000000001'}))
})
test('resource import magic bytes, generated paths, local CRUD, pins and sound-group dangling references',()=>{
  const dir=temporary(),store=new ResourceStore(dir),gif=Buffer.from('GIF89a fixture'),wav=Buffer.alloc(48);wav.write('RIFF');wav.write('WAVE',8)
  try{assert.equal(sniff(gif),'gif');assert.equal(sniff(wav),'wav');assert.throws(()=>store.mutate({action:'import',kind:'image',data:'data:image/png;base64,'+gif.toString('base64')}))
    let catalog=store.mutate({action:'import',kind:'image',name:'动图',data:'data:image/gif;base64,'+gif.toString('base64')});const asset=catalog.assets.find(a=>!a.builtin)!;assert.ok(asset.id.startsWith('user-'));assert.deepEqual(store.binary(asset.id).bytes,gif);assert.equal(catalog.assets.find(a=>a.id===asset.id)?.format,'gif')
    store.mutate({action:'pin',id:asset.id,pinned:true});assert.equal(store.catalog().assets[0].id,asset.id);assert.throws(()=>store.mutate({action:'delete',id:'deepseek-smile'}));assert.throws(()=>store.binary('../state.json'))
    catalog=store.mutate({action:'import',kind:'audio',name:'片段',data:'data:audio/wav;base64,'+wav.toString('base64')});const clip=catalog.assets.find(a=>!a.builtin&&a.kind==='audio')!;catalog=store.mutate({action:'group',name:'组',press:clip.id,release:'alert'});const group=catalog.groups.find(g=>!g.builtin)!;store.mutate({action:'delete',id:clip.id});assert.equal(store.catalog().groups.find(g=>g.id===group.id)?.press,'');store.mutate({action:'delete',id:asset.id});assert.throws(()=>store.binary(asset.id));assert.equal(new ResourceStore(dir).catalog().assets.some(a=>a.id===asset.id),false)
  }finally{rmSync(dir,{recursive:true,force:true})}
})
test('peak calendar is centralized, holiday/weekend off-peak, unknown future calendar and next transition',()=>{
  assert.equal(pricingSnapshot(Date.parse('2026-10-09T02:00:00Z')).status,'peak');assert.equal(pricingSnapshot(Date.parse('2026-10-09T05:00:00Z')).status,'off-peak');assert.equal(pricingSnapshot(Date.parse('2026-10-01T02:00:00Z')).status,'off-peak');assert.equal(pricingSnapshot(Date.parse('2026-10-10T02:00:00Z')).status,'off-peak');assert.equal(pricingSnapshot(Date.parse('2027-01-04T02:00:00Z')).status,'unknown');assert.ok(pricingSnapshot(Date.parse('2026-10-09T02:00:00Z')).nextAt)
})
test('scoped budgets/low alerts, cross-day rearming and correction refresh conflict/one-sided failure',async()=>{
  const dir=temporary(),engine=new Engine(ctx,dir),at=Date.now();let amount=units('10'),clock=at
  engine.sources.fetch=async(source:Source):Promise<BalanceView>=>({source,label:source,status:'ready',message:'',scope:source,updatedAt:++clock,wallets:[{currency:'CNY',total:amount,recharge:amount,bonus:0}]})
  try{await engine.initialize();const events=structuredClone(engine.state.settings.events);events.budget.enabled=true;engine.settings({events,displayMode:'account'});engine.setPreferences({source:'api-key',scope:'api-key',currency:'CNY',low:9,budget:1,budgetOn:true});amount=units('8');await engine.refresh('api-key');assert.equal(engine.state.notifications.filter(n=>n.kind==='low').length,1);assert.equal(engine.state.notifications.filter(n=>n.kind==='budget').length,1);await engine.refresh('api-key');assert.equal(engine.state.notifications.filter(n=>n.kind==='budget').length,1)
    let row=engine.rows().find(r=>r.source==='api-key')!;amount=units('7');await assert.rejects(()=>engine.adjust({...row,credits:'0',otherDebits:'0',confirmed:true}),{status:409});assert.equal(engine.state.books[bookKey('api-key','api-key','CNY')].days[row.day].correction,undefined)
    row=engine.rows().find(r=>r.source==='api-key')!;await engine.adjust({...row,credits:'0',otherDebits:'0',confirmed:true});assert.ok(engine.state.books[bookKey('api-key','api-key','CNY')].days[row.day].correction)
    engine.sources.fetch=async source=>({source,label:source,status:'failed',message:'offline',scope:null,updatedAt:null,wallets:[]});await assert.rejects(()=>engine.adjust({...engine.rows().find(r=>r.source==='api-key')!,credits:'0',otherDebits:'0',confirmed:true}),{status:503});assert.equal(engine.balances.account.status,'ready')
    const before=engine.state.notifications.length,next=at+86400000;observe(engine.state,'api-key','api-key','CNY',units('9'),next);observe(engine.state,'api-key','api-key','CNY',units('7'),next+1);engine.checkAlerts('api-key','api-key','CNY',units('7'),next+1);assert.equal(engine.state.notifications.length,before+1)
  }finally{engine.closed=true;rmSync(dir,{recursive:true,force:true})}
})
test('host replay completion, question, approval, identifiers, own-sequence guard and third-party exclusion',async()=>{
  const dir=temporary(),engine=new Engine(ctx,dir),now=Date.now()
  engine.sources.identity=async source=>source;engine.sources.fetch=async source=>({source,label:source,status:'unavailable',message:'offline',scope:null,updatedAt:null,wallets:[]})
  const services:Record<string,unknown>={llm:{listConfigurableProviders:()=>[{provider:'deepseek-official',settingsNs:'key',settingsPath:[]}]},settings:{describe:()=>[{ns:'key',value:{baseURL:'https://api.deepseek.com/anthropic'}}]}}
  engine.sources.ctx={...ctx,get:n=>services[n]}
  let seq=0;const send=(type:string,data:Record<string,unknown>={})=>engine.event({id:'session',isOwnSeq:n=>n>=0},{type,seq:++seq,time:now+seq,data:{turn:1,step:0,...data}})
  try{await send('session/title',{title:'事件回放'});await send('assistant/message',{message:{source:{provider:'deepseek-official',model:'unknown'}},usage:{inputTokens:1}});await send('tool/call',{name:'ask_user_question',message:{callId:'q1'}});await send('tool/call',{name:'ask_user_question',message:{callId:'q1'}});await send('approval/asked',{id:'a1'});assert.equal(engine.notifications(0).pending.length,2);await send('tool/result',{message:{callId:'q1'}});assert.equal(engine.notifications(0).pending.length,1);await send('approval/decided',{id:'a1'});assert.equal(engine.notifications(0).pending.length,0);await send('turn/end',{reason:{kind:'completed'}});assert.equal(engine.state.notifications.filter(n=>n.kind==='complete').length,1)
    await send('assistant/message',{message:{source:{provider:'third-party',model:'unknown'}}});await send('approval/asked',{id:'a2'});assert.equal(engine.state.notifications.some(n=>n.id.endsWith(':a2')),false);engine.disposeSession('session');assert.equal(engine.titles.has('session'),false)
  }finally{engine.closed=true;rmSync(dir,{recursive:true,force:true})}
})
