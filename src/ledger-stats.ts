import type {CallRecord,Currency,Source} from './shared.ts'
import {dayKey} from './accounting.ts'
export interface ModelStat {source:Source;scope:string;currency:Currency;model:string;count:number;tokens:number;low:number;high:number;unknown:number}
export function modelLabel(model:string):string {
  if(model==='deepseek-flash')return 'DeepSeek V4.1 Flash'
  if(['deepseek-v4-flash','deepseek-v4-flash-vision-exp'].includes(model))return model+'（旧名 · 同 V4.1 Flash）'
  if(model==='deepseek-v4-pro')return 'DeepSeek V4 Pro'
  return model
}
export function modelMatches(model:string,query:string):boolean{return model.toLowerCase().includes(query.toLowerCase())||modelLabel(model).toLowerCase().includes(query.toLowerCase())}
export function modelStats(records:CallRecord[],currency?:Currency):ModelStat[] {
  const result=new Map<string,ModelStat>()
  for(const call of records)for(const c of currency?[currency]:['CNY','USD'] as const){const key=[call.source,call.scope,c,call.model].join(':'),m=result.get(key)??{source:call.source,scope:call.scope,currency:c,model:call.model,count:0,tokens:0,low:0,high:0,unknown:0};m.count++;m.tokens+=Object.values(call.usage).reduce((a,b)=>a+b,0);m.low+=call.costs?.[c].low??0;m.high+=call.costs?.[c].high??0;m.unknown+=Number(call.costs===null);result.set(key,m)}
  return [...result.values()]
}
export function modelShare(model:ModelStat,group:ModelStat[],metric:'cost'|'tokens'):{low:number;high:number}|null {
  const same=group.filter(m=>m.source===model.source&&m.scope===model.scope&&m.currency===model.currency)
  if(metric==='tokens'){const sum=same.reduce((n,m)=>n+m.tokens,0);return sum?{low:model.tokens/sum*100,high:model.tokens/sum*100}:null}
  if(model.unknown===model.count)return null
  const low=same.reduce((n,m)=>n+m.low,0),high=same.reduce((n,m)=>n+m.high,0);if(!high)return null
  // Independent historical intervals: never apportion observed wallet changes to models.
  return {low:model.low/(model.low+high-model.high||1)*100,high:model.high/(model.high+low-model.low||1)*100}
}
export function recentDays(now=Date.now()):string[]{return Array.from({length:30},(_,i)=>dayKey(now-(29-i)*86400000))}
