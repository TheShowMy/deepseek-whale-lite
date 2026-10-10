import type {Source, Currency} from './shared.ts'
export type ModuleType = 'text'|'link'|'random-text'|'image'|'random-image'|'balance'|'recharge'|'bonus'|'today'|'peak'|'session'|'cost'|'effect'
export interface ModuleStyle {font: string; size: number; bold: boolean; italic: boolean; underline: boolean; color: string; background: string; gradient: 'none'|'rainbow'|'macaron'|'bamboo'}
export interface BubbleModule {
  id: string; type: ModuleType; source: Source|'visible'; style: ModuleStyle
  text: string; url: string; assetId: string; choices: {value: string; weight: number}[]
  length: number; currency: Currency|'auto'; effect: 'pet'|'coins'
}
export interface BubbleDefinition {rows: BubbleModule[][]}
export interface BubbleOption {id: string; weight: number; bubble: BubbleDefinition}
export interface BubbleStep {id: string; options: BubbleOption[]}
export interface BubbleConfig {revision: number; steps: BubbleStep[]; library: {id: string; name: string; module: BubbleModule}[]}
export const MODULE_LABELS: Record<ModuleType,string> = {text:'文本',link:'超链接','random-text':'随机语句',image:'图片／动图','random-image':'随机图片',balance:'总余额',recharge:'充值余额',bonus:'赠金',today:'今日消费',peak:'峰谷时段',session:'对话名',cost:'本轮费用',effect:'内置动效'}
export const DEFAULT_STYLE: ModuleStyle = {font:'system-ui',size:14,bold:false,italic:false,underline:false,color:'#536ba9',background:'',gradient:'none'}
export function moduleOf(type: ModuleType, id: string = globalThis.crypto.randomUUID()): BubbleModule {
  return {id,type,source:'visible',style:{...DEFAULT_STYLE},text:type==='text'?'你好呀！':'{value}',url:'https://www.deepseek.com',assetId:'',choices:[],length:12,currency:'auto',effect:'pet'}
}
export function definition(text: string): BubbleDefinition {const m=moduleOf('text');m.text=text;return {rows:[[m]]}}
export function defaultBubbles(): BubbleConfig {
  const title=moduleOf('text','title');title.text='DeepSeek 余额';title.style.bold=true;title.style.size=15
  const balance=moduleOf('balance','balances');balance.text='{source} {value}';balance.style.bold=true;balance.style.size=18
  const today=moduleOf('today','today');today.text='{source} 今日 {value}';today.style.size=9
  const peak=moduleOf('peak','peak');peak.style.size=9
  const random=moduleOf('random-text','greeting');random.choices=['鲸鲸帮你看好余额。','今天也要开心地写代码！','休息一下，喝口水吧。','两个账户，分别记账。'].map(value=>({value,weight:1}))
  const pet=moduleOf('effect','pet');pet.effect='pet'
  const coins=moduleOf('effect','coins');coins.effect='coins'
  const step=(id:string,bubble:BubbleDefinition):BubbleStep=>({id,options:[{id:id+'-a',weight:1,bubble}]})
  return {revision:0,steps:[step('balance',{rows:[[title],[balance],[today],[peak]]}),step('greeting',{rows:[[random]]}),{id:'effects',options:[{id:'pet',weight:1,bubble:{rows:[[pet]]}},{id:'coins',weight:1,bubble:{rows:[[coins]]}}]}],library:[]}
}
function record(value:unknown): Record<string,unknown> {if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('气泡配置无效');return value as Record<string,unknown>}
function text(value:unknown,max=4000): string {if(typeof value!=='string'||value.length>max)throw new Error('文本过长或格式无效');return value}
function num(value:unknown,min:number,max:number): number {if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error('气泡数值无效');return value}
export function safeLink(url:string): boolean {try{return ['https:','http:'].includes(new URL(url).protocol)}catch{return false}}
export function parseModule(value:unknown): BubbleModule {
  const v=record(value),type=text(v.type) as ModuleType
  if(!(type in MODULE_LABELS))throw new Error('未知模块类型')
  const m=moduleOf(type,text(v.id,100));if(!/^[\w-]+$/.test(m.id))throw new Error('模块 ID 无效')
  if(!['account','api-key','visible'].includes(String(v.source)))throw new Error('模块来源无效')
  m.source=v.source as BubbleModule['source'];m.text=text(v.text);m.url=text(v.url,2048);m.assetId=text(v.assetId,100)
  if(type==='link'&&!safeLink(m.url))throw new Error('链接须为 HTTP 或 HTTPS')
  m.length=num(v.length,0,1000);if(!Number.isInteger(m.length))throw new Error('对话名长度无效')
  if(!['CNY','USD','auto'].includes(String(v.currency)))throw new Error('模块币种无效');m.currency=v.currency as BubbleModule['currency']
  if(!['pet','coins'].includes(String(v.effect)))throw new Error('动效无效');m.effect=v.effect as BubbleModule['effect']
  if(!Array.isArray(v.choices)||v.choices.length>100)throw new Error('随机项无效')
  m.choices=v.choices.map(x=>{const c=record(x);return {value:text(c.value),weight:num(c.weight,1,10000)}})
  const s=record(v.style);m.style={font:text(s.font,100),size:num(s.size,6,48),bold:s.bold===true,italic:s.italic===true,underline:s.underline===true,color:text(s.color,32),background:text(s.background,32),gradient:s.gradient as ModuleStyle['gradient']}
  for(const c of [m.style.color,m.style.background])if(c&&!/^#(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(c))throw new Error('颜色无效')
  if(!['none','rainbow','macaron','bamboo'].includes(m.style.gradient))throw new Error('渐变无效')
  return m
}
export function imageModule(m:BubbleModule):boolean {return ['image','random-image','effect'].includes(m.type)}
export function parseDefinition(value:unknown): BubbleDefinition {
  const v=record(value);if(!Array.isArray(v.rows)||!v.rows.length||v.rows.length>6)throw new Error('气泡须有 1–6 行')
  let images=0;const ids=new Set<string>()
  const rows=v.rows.map(row=>{if(!Array.isArray(row)||!row.length||row.length>6)throw new Error('每行须有 1–6 个模块')
    return row.map(x=>{const m=parseModule(x);if(ids.has(m.id))throw new Error('模块 ID 重复');ids.add(m.id);if(imageModule(m)){images++;if(row.length!==1)throw new Error('图片须独占一行')}return m})})
  if(images>1)throw new Error('一个气泡最多一张图片或动效');return {rows}
}
export function parseBubbles(value:unknown): BubbleConfig {
  const v=record(value);if(!Array.isArray(v.steps)||!v.steps.length||v.steps.length>100)throw new Error('点击队列须有 1–100 项')
  const steps=v.steps.map(x=>{const s=record(x);if(!Array.isArray(s.options)||!s.options.length||s.options.length>20)throw new Error('并列项无效')
    return {id:text(s.id,100),options:s.options.map(x=>{const o=record(x);return {id:text(o.id,100),weight:num(o.weight,1,10000),bubble:parseDefinition(o.bubble)}})}})
  if(!Array.isArray(v.library)||v.library.length>200)throw new Error('模块库无效')
  const library=v.library.map(x=>{const l=record(x);return {id:text(l.id,100),name:text(l.name,80),module:parseModule(l.module)}})
  if(new Set(steps.map(s=>s.id)).size!==steps.length)throw new Error('队列 ID 重复')
  const revision=num(v.revision,0,Number.MAX_SAFE_INTEGER);if(!Number.isSafeInteger(revision))throw new Error('气泡版本无效')
  return {revision,steps,library}
}
export function weightedPick<T>(items:T[],weight:(item:T)=>number,last=-1,random=Math.random):number {
  if(!items.length)return -1
  const candidates=items.map((item,index)=>({item,index})).filter(x=>items.length===1||x.index!==last)
  let n=Math.max(0,Math.min(random(),.999999999))*candidates.reduce((n,x)=>n+weight(x.item),0)
  for(const x of candidates){n-=weight(x.item);if(n<0)return x.index}return candidates.at(-1)!.index
}
export class ClickQueue {
  index=-1
  next(config:BubbleConfig,random=Math.random):BubbleDefinition|null {this.index++;if(this.index>=config.steps.length){this.index=-1;return null}const step=config.steps[this.index];return step.options[weightedPick(step.options,o=>o.weight,-1,random)].bubble}
  start(config:BubbleConfig):BubbleDefinition|null {this.index=-1;return this.next(config)}
}
// A drop either moves a complete row or places one module in a row/new row.
export function moveModule(bubble:BubbleDefinition,fromRow:number,fromCol:number,toRow:number,toCol:number,newRow=false):BubbleDefinition {
  const next=structuredClone(bubble),[m]=next.rows[fromRow]?.splice(fromCol,1)??[];if(!m)throw new Error('找不到模块')
  if(newRow)next.rows.splice(toRow,0,[m]);else {const row=next.rows[toRow];if(!row)throw new Error('找不到目标行');if(fromRow===toRow&&fromCol<toCol)toCol--;row.splice(toCol,0,m)}
  next.rows=next.rows.filter(r=>r.length);return parseDefinition(next)
}
