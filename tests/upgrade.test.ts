import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {DEFAULT_SETTINGS,parseSettings,parseSnap} from '../src/shared.ts'
import type {BalanceView,CallRecord,Notification} from '../src/shared.ts'
import {moduleOf,parseModule,moveRow,insertModule,definition} from '../src/bubbles.ts'
import {emptyState,observe,units} from '../src/accounting.ts'
import {loadState} from '../src/persistence.ts'
import {Engine} from '../src/engine.ts'
import type {Context} from '../src/host.ts'
import {AudioPlayer} from '../src/audio.ts'
import type {Catalog} from '../src/resources.ts'
import {anchorFor,placed,snapPoint,flipBoundary,bounds} from '../src/position.ts'
import {modelStats,modelShare,modelMatches,recentDays} from '../src/ledger-stats.ts'
const ctx:Context={get:()=>undefined,on:()=>()=>{},inject:()=>{},effect:()=>{}}
const temp=()=>mkdtempSync(join(tmpdir(),'whale-v3-'))
const flush=async()=>{await Promise.resolve();await Promise.resolve()}

test('v2 migration preserves imported role, records, legacy gradients, events and orientation; exact backup and idempotence',()=>{
  const dir=temp(),path=join(dir,'state.json'),s=emptyState()
  try{
    s.settings.character='user-00000000-0000-0000-0000-000000000001';s.settings.flip=true;s.settings.x=24;s.settings.y=81;s.settings.volume=.8
    observe(s,'account','a','CNY',units(10),Date.now());s.bubbles.steps[0].options[0].bubble.rows[0][0].style.gradient='macaron'
    const legacy=JSON.parse(JSON.stringify(s));legacy.version=2;delete legacy.soundPlayed
    for(const key of ['outlineColor','anchor','waitCharClose','pressSound'])delete legacy.settings[key]
    legacy.settings.snap={enabled:true,unit:'percent',top:5,right:6,bottom:7,left:8}
    for(const def of [...legacy.bubbles.steps.flatMap((step:{options:{bubble:unknown}[]})=>step.options.map(o=>o.bubble)),...Object.values(legacy.settings.events).map((e:unknown)=>(e as {content:unknown}).content)] as {rows:Record<string,unknown>[][]}[])for(const m of def.rows.flat()){for(const key of ['imageScale','peakStyle','peakPaint','offPaint'])delete m[key];delete (m.style as Record<string,unknown>).backgroundGradient}
    const raw=JSON.stringify(legacy);writeFileSync(path,raw);const next=loadState(path)
    assert.equal(next.version,3);assert.equal(next.settings.character,s.settings.character);assert.equal(next.settings.flip,true);assert.equal(next.settings.x,24);assert.equal(next.settings.y,81);assert.equal(next.settings.volume,.8);assert.equal(next.settings.outlineColor,'#ffffff');assert.equal(next.settings.waitCharClose,false);assert.equal(next.settings.pressSound,true);assert.deepEqual(next.books,s.books);assert.deepEqual(next.settings.snap.percent,{top:5,right:6,bottom:7,left:8,flip:15});assert.equal(next.bubbles.steps[0].options[0].bubble.rows[0][0].style.gradient,'legacy-macaron');assert.equal(next.bubbles.steps[0].options[0].bubble.rows[3][0].peakStyle,'inherit');assert.equal(readFileSync(path+'.v2.bak','utf8'),raw)
    const bytes=readFileSync(path,'utf8');assert.deepEqual(loadState(path),next);assert.equal(readFileSync(path,'utf8'),bytes)
    delete legacy.notifications;const bad=JSON.stringify(legacy);writeFileSync(path,bad);assert.throws(()=>loadState(path));assert.equal(readFileSync(path,'utf8'),bad)
  }finally{rmSync(dir,{recursive:true,force:true})}
})

test('temporary cache requires the same verified identity; auth/configuration/signout/change/unknown identity clear it without observations',async()=>{
  const dir=temp(),e=new Engine(ctx,dir);let identity:string|null='a';const fresh=(source:'account'|'api-key'):BalanceView=>({source,label:source,status:'ready',scope:source==='account'?'a':'k',wallets:[{currency:source==='account'?'CNY':'USD',total:units(20),recharge:units(20),bonus:0}],updatedAt:Date.now(),message:''})
  e.sources.identity=async()=>identity
  try{
    e.sources.fetch=async source=>fresh(source);await e.initialize();const raw=JSON.stringify(e.state.books),time=e.balances.account.updatedAt
    e.sources.fetch=async source=>({source,label:source,status:'failed',scope:null,wallets:[],updatedAt:null,message:'offline',failure:'temporary'})
    const cached=await e.refresh('account');assert.equal(cached.stale,true);assert.equal(cached.updatedAt,time);assert.equal(cached.wallets[0].total,units(20));assert.match(cached.message,/缓存/);assert.equal(JSON.stringify(e.state.books),raw);assert.equal(e.balances['api-key'].status,'ready')
    for(const id of ['other',null]){identity=id;assert.equal((await e.refresh('account')).wallets.length,0);e.sources.fetch=async source=>fresh(source);await e.refresh('account');e.sources.fetch=async source=>({source,label:source,status:'failed',scope:null,wallets:[],updatedAt:null,message:'offline',failure:'temporary'})}
    identity='a';for(const failure of ['credentials','configuration','identity'] as const){e.sources.fetch=async source=>fresh(source);await e.refresh('account');e.sources.fetch=async source=>({source,label:source,status:'failed',scope:null,wallets:[],updatedAt:null,message:'invalid',failure});assert.equal((await e.refresh('account')).wallets.length,0)}
    e.sources.fetch=async source=>({source,label:source,status:'signed-out',scope:null,wallets:[],updatedAt:null,message:'signed out',failure:'credentials'});assert.equal((await e.refresh('account')).wallets.length,0);assert.equal(e.balances['api-key'].wallets[0].currency,'USD')
  }finally{e.closed=true;rmSync(dir,{recursive:true,force:true})}
})

test('atomic sound claim persists across restarts/windows; cancelled waits, muted and dismissed notices cannot ring',async()=>{
  const dir=temp(),e=new Engine(ctx,dir);e.state.settings.sound=true;e.state.settings.events.question.enabled=true;e.state.settings.events.question.sound=true
  const notice=(id:string,kind:'complete'|'question',pending=false):Omit<Notification,'seq'>=>({id,kind,pending,at:Date.now(),session:'s',title:'fixture'})
  try{
    e.notify(notice('c','complete'));assert.deepEqual(await Promise.all([Promise.resolve().then(()=>e.claimSound('c')),Promise.resolve().then(()=>e.claimSound('c'))]),[true,false]);const restart=new Engine(ctx,dir);assert.equal(restart.claimSound('c'),false);restart.closed=true
    e.notify(notice('q','question'));assert.equal(e.claimSound('q'),false);e.notify(notice('dismiss','question',true));e.dismiss('dismiss');assert.equal(e.claimSound('dismiss'),false)
    e.state.settings.sound=false;e.notify(notice('mute','complete'));assert.equal(e.claimSound('mute'),false);e.state.settings.sound=true;assert.equal(e.claimSound('mute'),false)
    e.state.notifications=[];e.save();e.notify(notice('c','complete'));assert.equal(e.claimSound('c'),false)
  }finally{e.closed=true;rmSync(dir,{recursive:true,force:true})}
})

test('host replay clears questions by content id/fallback and approvals by cancellation; replay never revives waits',async()=>{
  const dir=temp(),e=new Engine(ctx,dir),services:Record<string,unknown>={llm:{listConfigurableProviders:()=>[{provider:'deepseek-official',settingsNs:'key',settingsPath:[]}]},settings:{describe:()=>[{ns:'key',value:{baseURL:'https://api.deepseek.com'}}]}}
  e.sources.ctx={...ctx,get:n=>services[n]};e.sources.identity=async()=> 'k';let seq=0
  const send=(type:string,data:Record<string,unknown>={})=>e.event({id:'s'},{type,seq:++seq,time:Date.now(),data:{turn:1,step:0,...data}})
  try{
    await send('assistant/message',{message:{source:{provider:'deepseek-official',model:'unknown'}},usage:{inputTokens:1}})
    await send('tool/call',{name:'ask_user_question',message:{callId:'q'}});await send('tool/result',{message:{content:[{toolCallId:'q'}]}});assert.equal(e.notifications(0).pending.length,0)
    await send('tool/call',{name:'ask_user_question',message:{callId:'q'}});assert.equal(e.notifications(0).pending.length,0)
    await send('tool/call',{name:'ask_user_question',message:{callId:'q2'}});await send('tool/result');assert.equal(e.notifications(0).pending.length,0)
    await send('approval/asked',{id:'a'});await send('approval/cancelled',{id:'a'});assert.equal(e.notifications(0).pending.length,0)
    await send('approval/asked',{id:'b'});await send('turn/start');assert.equal(e.notifications(0).pending.length,0)
  }finally{e.closed=true;rmSync(dir,{recursive:true,force:true})}
})

class FakeAudio {
  onended:(()=>void)|null=null;onerror:(()=>void)|null=null;volume=0;paused=false;src=true
  url:string;constructor(url:string){this.url=url}
  play(){return Promise.resolve()}pause(){this.paused=true}removeAttribute(){this.src=false}load(){}
  end(){this.onended?.()}
}
test('sound groups play complete press→release sequence, physical phases individually, preview cancellation and silence stop all playback',async()=>{
  const catalog={assets:['press','release'].map(id=>({id,kind:'audio',url:id})),groups:[{id:'g',press:'press',release:'release'}]} as Catalog,list:FakeAudio[]=[]
  const player=new AudioPlayer(()=>catalog,url=>{const a=new FakeAudio(url);list.push(a);return a as unknown as HTMLAudioElement});let silenced=0;player.onSilence(()=>silenced++)
  player.play('g',.4);assert.deepEqual(list.map(a=>a.url),['press']);list[0].end();await flush();assert.deepEqual(list.map(a=>a.url),['press','release']);list[1].end();await flush()
  player.play('g',.3,'release');assert.equal(list.at(-1)?.url,'release');assert.equal(list.at(-1)?.volume,.3);list.at(-1)!.end();await flush()
  const first=player.previewAudio('g',.4);player.previewAudio('g',.5,'release');assert.equal(list.at(-2)?.paused,true);assert.equal(list.at(-2)?.src,false);first.stop();player.stopPreview();await flush();assert.equal(list.at(-1)?.paused,true)
  player.play('g',.8);const total=list.length;player.stopAll();await flush();assert.equal(list.length,total);assert.equal(list.at(-1)?.paused,true);assert.equal(silenced,1)
})

test('v3 controls, independent snap units and edge anchors preserve margins across resize and scale',()=>{
  const s=parseSettings({scale:2.5,outlineColor:'#ABCDEF',waitCharClose:true,pressSound:false},DEFAULT_SETTINGS);assert.equal(s.outlineColor,'#abcdef');assert.equal(s.scale,2.5);assert.equal(s.pressSound,false);assert.throws(()=>parseSettings({outlineColor:'red'},s));assert.throws(()=>parseSettings({scale:2.6},s))
  const one=parseSnap({enabled:true,unit:'px',top:12,right:13,bottom:14,left:15}),two=parseSnap({enabled:true,unit:'percent',top:1,right:2,bottom:3,left:4},one);assert.equal(two.px.left,15);assert.equal(two.percent.left,4)
  const small={width:1000,height:700},large={width:1500,height:1000},settings=structuredClone(DEFAULT_SETTINGS),b=bounds(settings,small),point={x:b.right-20,y:b.bottom-30};settings.anchor=anchorFor(point,settings,small);assert.deepEqual(placed(settings,small),point);assert.equal(bounds(settings,large).right-placed(settings,large).x,20);assert.equal(bounds(settings,large).bottom-placed(settings,large).y,30);settings.scale=2;assert.equal(bounds(settings,large).right-placed(settings,large).x,20)
  settings.scale=1;assert.equal(snapPoint({x:5,y:55},settings,small).x,0);settings.snap.px.flip=130;assert.equal(flipBoundary(settings,large),130);settings.snap.unit='percent';assert.equal(flipBoundary(settings,small),150)
})

test('new module fields, random entry style, row ordering/library insertion respect all row/image constraints and immutable drafts',()=>{
  const b=definition('first');b.rows.push([{...moduleOf('text','last'),text:'last'}]);assert.deepEqual(moveRow(b,1,0).rows.map(r=>r[0].text),['last','first']);assert.equal(b.rows[0][0].text,'first')
  const m=moduleOf('random-text');m.choices=[{value:'styled',weight:2,style:{...m.style,gradient:'aurora',backgroundGradient:'rainbow'}}];assert.deepEqual(parseModule(m).choices,m.choices)
  const image=moduleOf('image');image.imageScale=.1;assert.equal(parseModule(image).imageScale,.1);image.imageScale=.09;assert.throws(()=>parseModule(image));assert.throws(()=>insertModule(b,moduleOf('image'),0,0));assert.equal(insertModule(b,moduleOf('image'),1,0,true).rows.length,3)
  for(const type of ['default','liangwen','qiangqiang','count','mini'] as const){const peak=moduleOf('peak');peak.peakStyle=type;assert.equal(parseModule(peak).peakStyle,type)}
})

test('model charts separate source/scope/currency, retain uncertain cost shares, unknowns and friendly/raw searches; 30 Beijing days',()=>{
  const make=(id:string,source:'account'|'api-key',scope:string,model:string,low:number,high:number):CallRecord=>({id,source,scope,model,at:Date.now(),session:'s',turn:1,usage:{inputTokens:10,cacheReadTokens:2,cacheWriteTokens:0,outputTokens:3},costs:low<0?null:{CNY:{low,high},USD:{low:low*2,high:high*2}}})
  const calls=[make('1','account','a','deepseek-flash',10,20),make('2','account','a','deepseek-v4-pro',10,30),make('3','account','a','unknown',-1,-1),make('4','api-key','k','deepseek-flash',100,100),make('5','account','b','deepseek-flash',1000,1000)],all=modelStats(calls),stats=modelStats(calls,'CNY'),m=stats[0]
  assert.equal(all.length,10);assert.equal(stats.length,5);assert.equal(stats[2].unknown,1);assert.equal(modelShare(stats[2],stats,'cost'),null);assert.deepEqual(modelShare(m,stats,'cost'),{low:25,high:2/3*100});assert.deepEqual(modelShare(m,stats,'tokens'),{low:1/3*100,high:1/3*100});assert.deepEqual(modelShare(stats[3],stats,'cost'),{low:100,high:100});assert.equal(modelMatches('deepseek-flash','V4.1 Flash'),true);assert.equal(modelMatches('deepseek-flash','deepseek-flash'),true);const days=recentDays(Date.parse('2026-10-10T16:01:00Z'));assert.equal(days.length,30);assert.equal(days.at(-1),'2026-10-11');assert.equal(new Set(days).size,30)
})

test('each peak display style/countdown uses supplied calendar and unknown calendars never invent prices',async()=>{
  const {peakText,peakRemaining}=await import('../src/bubble-view.ts'),now=Date.now(),snapshot={settings:structuredClone(DEFAULT_SETTINGS),balances:{} as import('../src/shared.ts').Snapshot['balances'],completionSeq:0,title:'test',pricing:{status:'peak' as 'peak'|'off-peak'|'unknown',nextAt:now+61000,calendarYear:2026,holidays:[]}},m=moduleOf('peak')
  for(const [mode,expected]of [['default','高峰时段'],['liangwen','梁文峰'],['qiangqiang','!?峰峰?!'],['count','00:01:01'],['mini','峰']] as const){m.peakStyle=mode;assert.equal(peakText(snapshot,m,now),expected)}
  assert.equal(peakRemaining(snapshot,now+1000),'00:01:00');m.peakStyle='mini';snapshot.pricing.status='off-peak';assert.equal(peakText(snapshot,m,now),'谷');snapshot.pricing.status='unknown';assert.match(peakText(snapshot,m,now),/未知/)
})
