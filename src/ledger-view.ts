import {el,button,input,select,field,check,dialog,report} from './ui.ts'
import type {Client} from './ui.ts'
import type {CallRecord,BookPreferences,Source,Currency} from './shared.ts'
import {bookKey,SCALE,units} from './accounting.ts'
import {money,sourceName,costText} from './bubble-view.ts'
import type {HistoryRow} from './bubble-view.ts'
type HistoryResult={rows:HistoryRow[];records:CallRecord[];models:{source:Source;scope:string;model:string;count:number;tokens:number}[];total:number;more:boolean}

export function bookPreferences(root:ShadowRoot,client:Client,row:HistoryRow):void {
  const d=dialog(root,sourceName(row.source)+' · '+row.scope.slice(0,8)+' · '+row.currency+' 提醒设置')
  void report(d,async()=>{
    const all=await client.api<Record<string,BookPreferences>>('/book-preferences'),p=all[bookKey(row.source,row.scope,row.currency)]??{low:client.context().snapshot.settings.lowBalance[row.currency],budget:0,budgetOn:false}
    const low=input(String(p.low),'number'),budget=input(String(p.budget),'number');for(const n of [low,budget]){n.min='0';n.step='.01'}
    d.body.append(field('低余额阈值（'+row.currency+'）',low),field('今日消费预算（'+row.currency+'）',budget),check('启用这个账本的预算提醒',p.budgetOn,v=>p.budgetOn=v),el('p','此配置只属于该来源、账户作用域和币种。预算提示同时需要在“提醒与音效”里开启；消费按余额观测或校正值判断。','muted'))
    d.footer.append(button('取消',d.close),button('保存账本提醒',()=>{void report(d,async()=>{await client.api('/book-preferences',{source:row.source,scope:row.scope,currency:row.currency,low:Number(low.value),budget:Number(budget.value),budgetOn:p.budgetOn},'PUT');await client.reload();d.close()})}))
  })
}

export function correction(root:ShadowRoot,client:Client,initial:HistoryRow,updated:()=>Promise<void>):void {
  let row=initial,confirmed=false
  const d=dialog(root,'校正 · '+initial.day+' · '+sourceName(initial.source)+' · '+initial.currency),numbers=el('div'),credits=input('0'),other=input('0'),result=el('div'),confirm=check('已核对本区间全部到账和非调用扣减',false,v=>confirmed=v)
  const draw=()=>{numbers.replaceChildren(el('p','账户作用域：'+row.scope.slice(0,12)),el('p','观测区间：'+new Date(row.firstAt).toLocaleString()+' 至 '+new Date(row.lastAt).toLocaleString()),el('p','期初 '+money(row.opening,row.currency,8)+' · 期末 '+money(row.last,row.currency,8)),el('p','原始下降 '+money(row.debit,row.currency,8)+' · 原始增加 '+money(row.credit,row.currency,8)),el('p','当前消费 '+money(row.amount,row.currency,8)+(row.correction?'（已校正）':'')));preview()}
  const preview=()=>{try{result.textContent='校正消费 = 期初 + 累计到账 − 非调用扣减 − 期末 = '+money(row.opening+units(credits.value)-units(other.value)-row.last,row.currency,8)}catch{result.textContent='请输入非负金额，最多 8 位小数'}}
  async function refresh(){const data=await client.api<{rows:HistoryRow[]}>('/adjustments?'+new URLSearchParams({source:row.source,scope:row.scope,currency:row.currency})),fresh=data.rows.find(r=>r.day===row.day);if(!fresh)throw new Error('找不到这一天的观测记录');row=fresh;credits.value=String((row.correction?.credits??row.credit)/SCALE);other.value=String((row.correction?.otherDebits??0)/SCALE);draw()}
  credits.oninput=other.oninput=preview;d.body.append(numbers,field('统计区间累计到账（充值、赠金、退款等）',credits),field('非调用扣减',other),result,confirm,el('p','保存当日校正会独立刷新对应来源；余额发生改变时要求重新核对。保留原始观测与校正历史；撤销恢复原始下降统计。','muted'),button('刷新并重新核对',()=>{void report(d,refresh)}))
  async function apply(reset=false){await client.api('/adjustments',{source:row.source,scope:row.scope,currency:row.currency,day:row.day,revision:row.revision,credits:credits.value,otherDebits:other.value,confirmed,reset},'PUT');await client.reload();await updated();d.close()}
  d.footer.append(button('取消',d.close),button('撤销校正',()=>{void report(d,()=>apply(true))}),button('保存校正',()=>{void report(d,()=>apply())}));draw();void report(d,refresh)
}

export async function openLedger(root:ShadowRoot,client:Client):Promise<void>{
  let generation=0,offset=0,result:HistoryResult={rows:[],records:[],models:[],total:0,more:false}
  const d=dialog(root,'余额账本与本机调用'),tools=el('div','','tools'),days=el('div'),models=el('div'),records=el('div'),more=button('加载更多调用',()=>{offset+=50;void report(d,()=>load(true))})
  const range=select([['today','今日'],['week','近七天'],['all','全部（含归档）']],'today'),source=select([['','两种来源'],['account','登录账号'],['api-key','API Key']],''),currency=select([['CNY','CNY'],['USD','USD']],'CNY'),scope=select([['','全部作用域']],''),search=input('');search.placeholder='搜索模型';search.setAttribute('aria-label','搜索模型')
  const selectedDay=input('','date');selectedDay.setAttribute('aria-label','按日期筛选');tools.append(range,source,currency,scope,search,selectedDay,button('清除日期',()=>{selectedDay.value='';void report(d,()=>load())}))
  d.body.append(tools,el('p','余额变化与本机调用估算分开显示；不同来源、作用域和币种分别记账。费用是已核实峰谷费率的估算区间，未知模型不猜价格。','muted'),days,models,records,more)
  for(const control of [range,source,currency,scope,search,selectedDay])control.onchange=()=>{void report(d,()=>load())}
  async function load(append=false){const own=++generation;if(!append)offset=0;const q=new URLSearchParams({range:range.value,source:source.value,currency:currency.value,scope:scope.value,model:search.value,day:selectedDay.value,offset:String(offset)}),data=await client.api<HistoryResult>('/history?'+q);if(own!==generation||!d.mask.isConnected)return;result={...data,records:append?[...result.records,...data.records]:data.records};draw()}
  function draw(){
    const current=scope.value,scopes=new Set(result.rows.map(r=>r.scope));scope.replaceChildren(new Option('全部作用域',''));for(const s of scopes)scope.add(new Option(s.slice(0,12),s));if(scopes.has(current))scope.value=current
    days.replaceChildren();for(const row of result.rows){
      const item=el('details','','section'),summary=el('summary',row.day+' · '+sourceName(row.source)+' ['+row.scope.slice(0,8)+'] · '+row.currency+' · '+(row.observed?money(row.amount,row.currency,4):'无余额观测'));item.append(summary,el('p','本机估算 '+money(row.estimate.low,row.currency,6)+'–'+money(row.estimate.high,row.currency,6)+' · '+row.estimate.tokens+' tokens'+(row.estimate.unknown?' · '+row.estimate.unknown+' 次费用未知':'')))
      if(row.observed){item.append(el('p','原始余额下降 '+money(row.debit,row.currency,4)+' · 余额增加 '+money(row.credit,row.currency,4)+(row.needsReview?' · 有余额增加待核对':'')),el('p','观测从 '+new Date(row.firstAt).toLocaleString()+' 开始，最近 '+new Date(row.lastAt).toLocaleString(),'muted'),button('校正／撤销',()=>correction(root,client,row,()=>load())),button('账本提醒',()=>bookPreferences(root,client,row)));for(const log of row.correctionLog??[])item.append(el('p',new Date(log.at).toLocaleString()+' · '+(log.next?'校正 '+money(log.next.amount,row.currency,8):'撤销校正'),'muted'))}
      item.append(button('查看这一天的调用',()=>{selectedDay.value=row.day;source.value=row.source;currency.value=row.currency;scope.value=row.scope;void report(d,()=>load())}));days.append(item)
    }
    if(!result.rows.length)days.append(el('p','此筛选下还没有余额观测或调用记录。'))
    models.replaceChildren(el('h3','模型占比（此筛选全部调用的 token 数）'))
    const counts=new Map<string,number>();for(const model of result.models){const key=sourceName(model.source)+' ['+model.scope.slice(0,8)+'] · '+model.model;counts.set(key,model.tokens)}const total=[...counts.values()].reduce((a,b)=>a+b,0)
    for(const [key,count]of [...counts].sort((a,b)=>b[1]-a[1])){const bar=el('div','','model-bar');bar.style.width=(total?count/total*100:0)+'%';models.append(el('div',key+' · '+(total?count/total*100:0).toFixed(1)+'%'),bar)}
    records.replaceChildren(el('h3','逐轮调用 · '+result.total+' 条'))
    for(const call of result.records){const item=el('div','','record');item.append(el('strong',sourceName(call.source)+' ['+call.scope.slice(0,8)+'] · '+call.model),el('div',new Date(call.at).toLocaleString()+' · 第 '+call.turn+' 轮 · 会话 '+call.session.slice(0,8),'muted'),el('div',costText([call],currency.value as Currency)),el('div','输入 '+call.usage.inputTokens+' · 缓存命中 '+call.usage.cacheReadTokens+' · 缓存写入 '+call.usage.cacheWriteTokens+' · 输出 '+call.usage.outputTokens,'muted'));records.append(item)}more.hidden=!result.more
  }
  d.footer.append(button('关闭',d.close));await report(d,()=>load())
}
