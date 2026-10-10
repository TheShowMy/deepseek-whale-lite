import {join} from 'node:path'
import type {Context,Session,SessionEvent} from './host.ts'
import {object} from './host.ts'
import type {BalanceView,Source,State,Snapshot,Notification,BookPreferences,Currency} from './shared.ts'
import {SOURCES,initialMode,parseSettings} from './shared.ts'
import {observe,validUsage,estimate,history,bookKey,dayKey,units,correctedAmount,reconcile} from './accounting.ts'
import {Sources,providerConfig} from './sources.ts'
import {loadState,saveState,archivedState} from './persistence.ts'
import {ResourceStore} from './resources.ts'
import {parseBubbles} from './bubbles.ts'
import {parseEvents} from './notifications.ts'
import {pricingSnapshot} from './pricing.ts'
export class Engine {
  state:State;sources:Sources;resources:ResourceStore;path:string;closed=false
  balances:Record<Source,BalanceView>;flights:Partial<Record<Source,Promise<BalanceView>>>={};queue:Promise<void>=Promise.resolve()
  titles=new Map<string,string>();providers=new Map<string,Source|null>()
  constructor(ctx:Context,home:string){this.sources=new Sources(ctx);this.path=join(home,'deepseek-whale-lite','state.json');this.state=loadState(this.path);this.resources=new ResourceStore(home)
    const pending=(source:Source):BalanceView=>({source,label:source==='account'?'DeepSeek 账号':'API Key',status:'failed',message:'等待刷新',wallets:[],updatedAt:null,scope:null});this.balances={account:pending('account'),'api-key':pending('api-key')}
  }
  save():void {if(!this.closed)saveState(this.path,this.state)}
  refresh(source:Source):Promise<BalanceView>{const running=this.flights[source];if(running)return running
    const promise=this.sources.fetch(source).then(view=>{if(this.closed)return view;this.balances[source]=view
      if(view.status==='ready'&&view.scope&&view.updatedAt)for(const w of view.wallets){observe(this.state,source,view.scope,w.currency,w.total,view.updatedAt);this.checkAlerts(source,view.scope,w.currency,w.total,view.updatedAt)}
      this.save();return view
    }).catch(()=>{const view:BalanceView={source,label:source==='account'?'DeepSeek 账号':'API Key',status:'failed',message:'余额或账本更新失败，请稍后重试',scope:null,updatedAt:null,wallets:[]};if(!this.closed)this.balances[source]=view;return view}).finally(()=>{delete this.flights[source]})
    this.flights[source]=promise;return promise
  }
  async initialize():Promise<void>{await Promise.all(SOURCES.map(s=>this.refresh(s)));if(this.state.settings.displayMode===null){this.state.settings.displayMode=initialMode(this.balances);this.save()}}
  snapshot():Snapshot & {pricing:ReturnType<typeof pricingSnapshot>;title:string}{return {settings:this.state.settings,balances:this.balances,completionSeq:this.state.completionSeq,pricing:pricingSnapshot(),title:[...this.titles.values()].at(-1)??'当前对话'}}
  settings(input:unknown):void {
    const patch=object(input),events='events' in patch?parseEvents(patch.events):this.state.settings.events
    const next=parseSettings(input,this.state.settings,this.resources.catalog().assets.filter(a=>a.kind==='role').map(a=>a.id));next.events=events
    if(!this.resources.catalog().groups.some(g=>g.id===next.pressGroup))throw new Error('按压音效组不存在')
    for(const e of Object.values(events))if(e.audio&&this.resources.asset(e.audio)?.kind!=='audio'&&!this.resources.catalog().groups.some(g=>g.id===e.audio))throw new Error('提醒音效不存在')
    this.state.settings=next;for(const source of SOURCES){const v=this.balances[source];if(v.scope)for(const w of v.wallets)this.checkAlerts(source,v.scope,w.currency,w.total,v.updatedAt??Date.now())}this.save()
  }
  bubbles(input:unknown):void {const next=parseBubbles(input);if(next.revision!==this.state.bubbles.revision)throw Object.assign(new Error('气泡配置已更新，请重新打开编辑器'),{status:409});next.revision++;this.state.bubbles=next;this.save()}
  rows(all=false){return history(all?archivedState(this.path,this.state):this.state)}
  records(all=false){return (all?archivedState(this.path,this.state):this.state).calls}
  preferences(source:Source,scope:string,currency:Currency):BookPreferences{return this.state.bookPreferences[bookKey(source,scope,currency)]??{low:this.state.settings.lowBalance[currency],budget:0,budgetOn:false}}
  setPreferences(input:unknown):void {
    const v=object(input),source=v.source as Source,currency=v.currency as Currency,scope=String(v.scope),key=bookKey(source,scope,currency)
    if(!this.state.books[key]||typeof v.budgetOn!=='boolean'||[v.low,v.budget].some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>1000000))throw new Error('账本提醒设置无效')
    this.state.bookPreferences[key]={low:v.low as number,budget:v.budget as number,budgetOn:v.budgetOn}
    const balance=this.balances[source];if(balance.scope===scope){const wallet=balance.wallets.find(w=>w.currency===currency);if(wallet)this.checkAlerts(source,scope,currency,wallet.total,balance.updatedAt??Date.now())}this.save()
  }
  checkAlerts(source:Source,scope:string,currency:Currency,balance:number,at:number):void {
    const key=bookKey(source,scope,currency),prefs=this.preferences(source,scope,currency),row=this.state.books[key]?.days[dayKey(at)]
    for(const [kind,active,amount,id] of [['low',balance<units(prefs.low),balance,'low:'+key],['budget',prefs.budgetOn&&prefs.budget>0&&!!row&&correctedAmount(row)>=units(prefs.budget),row?correctedAmount(row):0,'budget:'+key+':'+dayKey(at)]] as const){
      const on=active&&this.state.settings.events[kind].enabled
      if(on&&!this.state.alertState[id])this.notify({id:id+':'+at,kind,at,session:'',title:'',source,scope,currency,amount,pending:false})
      this.state.alertState[id]=on
    }
  }
  notify(value:Omit<Notification,'seq'>):void {if(this.state.notifications.some(n=>n.id===value.id))return;this.state.notifications.push({...value,seq:++this.state.notificationSeq})}
  dismiss(id:string):void {if(!this.state.notifications.some(n=>n.id===id))return;if(!this.state.dismissed.includes(id))this.state.dismissed.push(id);this.save()}
  notifications(after:number){return {seq:this.state.notificationSeq,items:this.state.notifications.filter(n=>n.seq>after&&!this.state.dismissed.includes(n.id)),pending:this.state.notifications.filter(n=>n.pending&&!this.state.dismissed.includes(n.id))}}
  async adjust(input:unknown){const v=object(input),source=v.source as Source,currency=v.currency as Currency,scope=String(v.scope),day=String(v.day)
    if(!SOURCES.includes(source)||!['CNY','USD'].includes(currency)||!this.state.books[bookKey(source,scope,currency)]||typeof v.revision!=='string')throw new Error('校正账本无效')
    const book=this.state.books[bookKey(source,scope,currency)]
    if(!book.days[day]){const old=archivedState(this.path,this.state).books[bookKey(source,scope,currency)]?.days[day];if(old)book.days[day]=old}
    if(day===dayKey()){const fresh=await this.refresh(source);if(fresh.status!=='ready')throw Object.assign(new Error('暂时无法刷新余额，请稍后保存'),{status:503});if(fresh.scope!==scope||!fresh.wallets.some(w=>w.currency===currency))throw Object.assign(new Error('当前来源身份已改变，请重新核对'),{status:409})}
    const row=reconcile(this.state,{source,scope,currency,day,revision:v.revision,credits:String(v.credits??''),otherDebits:String(v.otherDebits??'0'),confirmed:v.confirmed===true,reset:v.reset===true});if(day===dayKey()){const wallet=this.balances[source].wallets.find(w=>w.currency===currency);if(wallet)this.checkAlerts(source,scope,currency,wallet.total,Date.now())}this.save();return row
  }
  event(session:Session,event:SessionEvent):Promise<void>{this.queue=this.queue.then(()=>this.handle(session,event)).catch(()=>{console.warn('[deepseek-whale-lite] 会话统计失败，请检查本地数据目录')});return this.queue}
  async handle(session:Session,event:SessionEvent):Promise<void>{
    if(this.closed||!Number.isSafeInteger(event.seq)||event.seq<0||(session.isOwnSeq&&!session.isOwnSeq(event.seq)))return
    const data=object(event.data),turn=data.turn,step=data.step,sid=session.id
    if(event.type==='session/title'){if(typeof data.title==='string')this.titles.set(sid,data.title.slice(0,120));return}
    try{const service=this.sources.ctx.get('sessionTitle') as {get?:(s:Session)=>unknown}|undefined;const title=object(service?.get?.(session)).title;if(typeof title==='string')this.titles.set(sid,title.slice(0,120))}catch{/* optional title service */}
    const cid=String(object(data.message).callId??data.callId??data.id??'')
    if(event.type==='tool/result'){for(const n of this.state.notifications)if(n.pending&&n.session===sid&&n.kind==='question'&&n.id==='question:'+sid+':'+cid)n.pending=false;this.save();return}
    if(event.type==='approval/decided'){for(const n of this.state.notifications)if(n.pending&&n.session===sid&&n.id==='approval:'+sid+':'+cid)n.pending=false;this.save();return}
    if((event.type==='tool/call'&&String(data.name??data.toolName)==='ask_user_question')||event.type==='approval/asked'){
      const source=this.providers.get(sid);if(!source||!cid)return
      const kind=event.type==='approval/asked'?'approval':'question';this.notify({id:kind+':'+sid+':'+cid,kind,at:event.time,session:sid,title:this.titles.get(sid)??'当前对话',source,pending:true});this.save();return
    }
    if(!Number.isSafeInteger(turn))return
    const key=sid+':'+String(turn)
    if(event.type==='step/start'){const scopes:Partial<Record<Source,string>>={};await Promise.all(SOURCES.map(async s=>{try{const id=await this.sources.identity(s);if(id)scopes[s]=id}catch{/* unavailable source */}}));this.state.turnScopes[key+':'+String(step)]=scopes;return}
    if(event.type==='assistant/message'){
      const id=sid+':'+event.seq;if((this.state.seen[sid]??-1)>=event.seq||this.state.calls.some(c=>c.id===id))return
      const src=object(object(data.message).source),source=src.provider==='deepseek-account'?'account':src.provider==='deepseek-official'?'api-key':null
      const official=source&&providerConfig(this.sources.ctx,source).official;this.providers.set(sid,official?source:null)
      const usage=validUsage(data.usage);if(!source||!official||!usage||typeof src.model!=='string')return
      const scope=this.state.turnScopes[key+':'+String(step)]?.[source]??await this.sources.identity(source);if(!scope)return
      this.state.calls.push({id,session:sid,turn:turn as number,at:event.time,source,scope,model:src.model,usage,costs:estimate(src.model,usage)});this.save()
    }
    if(event.type==='turn/end'){
      if((this.state.seen[sid]??-1)>=event.seq)return
      const calls=this.state.calls.filter(c=>c.session===sid&&c.turn===turn)
      if(calls.length){const completion={seq:++this.state.completionSeq,session:sid,turn:turn as number,at:event.time,reason:String(object(data.reason).kind??'completed'),calls};this.state.completions.push(completion);this.notify({id:'complete:'+key,kind:'complete',at:event.time,session:sid,title:this.titles.get(sid)??'当前对话',completion,pending:false})}
      for(const n of this.state.notifications)if(n.pending&&n.session===sid)n.pending=false
      this.providers.delete(sid);this.state.seen[sid]=event.seq;for(const k of Object.keys(this.state.turnScopes))if(k.startsWith(key+':'))delete this.state.turnScopes[k]
      this.save();for(const source of new Set(calls.map(c=>c.source)))void this.refresh(source)
    }
  }
  disposeSession(id:string):void {this.titles.delete(id);this.providers.delete(id);for(const n of this.state.notifications)if(n.session===id)n.pending=false;for(const k of Object.keys(this.state.turnScopes))if(k.startsWith(id+':'))delete this.state.turnScopes[k];this.save()}
}
