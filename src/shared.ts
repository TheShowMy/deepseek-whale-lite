import {defaultBubbles, definition} from './bubbles.ts'
import type {BubbleConfig, BubbleDefinition} from './bubbles.ts'
export type Source = 'account' | 'api-key'
export type Currency = 'CNY' | 'USD'
export type DisplayMode = Source | 'both'
export interface SnapProfile {top:number;right:number;bottom:number;left:number;flip:number|null}
export interface SnapSettings {enabled:boolean;unit:'px'|'percent';px:SnapProfile;percent:SnapProfile}
export interface PositionAnchor {horizontal:'left'|'right';vertical:'top'|'bottom';x:number;y:number}
export const PREFIX = '/deepseek-whale-lite'
export const SOURCES: Source[] = ['account', 'api-key']
export const CHARACTERS = [
  {id: 'deepseek-smile', name: 'DeepSeek · 微笑'}, {id: 'deepseek-focus', name: 'DeepSeek · 专注'},
  {id: 'deepseek-sleepy', name: 'DeepSeek · 困困'}, {id: 'lumine', name: '荧'},
  {id: 'vesna', name: '薇斯纳'}, {id: 'vodyanitsa', name: '沃雅妮莎'}, {id: 'tsaritsa', name: '冰之女皇'},
] as const
export interface Settings {
  displayMode: DisplayMode | null; character: string; scale: number
  x: number | null; y: number | null; flip: boolean; sound: boolean; volume: number
  refreshSeconds: number; lowBalance: Record<Currency, number>
  bubbleOn: boolean; stickyBalance: boolean; tapAdvance: boolean; menuButtonHide: boolean
  autoFlip: boolean; scrollGap: number; peakStyle: 'simple'|'countdown'|'playful'; pressGroup: string
  outlineColor: string; waitCharClose: boolean; pressSound: boolean
  snap: SnapSettings; anchor:PositionAnchor|null
  events: Record<NotificationKind, EventSettings>
}
export type NotificationKind = 'complete'|'low'|'budget'|'question'|'approval'
export interface EventSettings {enabled: boolean; bubble: boolean; sound: boolean; volume: number|null; audio: string; closeSeconds: number; content: BubbleDefinition}
export interface BookPreferences {low: number; budget: number; budgetOn: boolean}
export interface Notification {seq: number; id: string; kind: NotificationKind; at: number; session: string; title: string; source?: Source; scope?: string; currency?: Currency; amount?: number; completion?: Completion; pending: boolean}
function eventDefaults():Record<NotificationKind,EventSettings> {
  const make=(kind:NotificationKind,text:string):EventSettings=>({enabled:!['question','approval','budget'].includes(kind),bubble:true,sound:!['question','approval'].includes(kind),volume:null,audio:kind==='complete'?'complete':'alert',closeSeconds:['question','approval'].includes(kind)?0:5,content:definition(text)})
  return {complete:make('complete','这一轮完成啦！\n{cost}'),low:make('low','{source} 余额偏低\n{amount}'),budget:make('budget','{source} 今日预算已达到\n{amount}'),question:make('question','{session}\n正在等待你的回答'),approval:make('approval','{session}\n正在等待你的授权')}
}
export const DEFAULT_SETTINGS: Settings = {
  displayMode: null, character: 'deepseek-smile', scale: 1, x: null, y: null,
  flip: false, sound: false, volume: 0.4, refreshSeconds: 60, lowBalance: {CNY: 5, USD: 1},
  bubbleOn:true,stickyBalance:true,tapAdvance:false,menuButtonHide:false,autoFlip:true,scrollGap:0,peakStyle:'countdown',pressGroup:'group-default',
  snap:{enabled:true,unit:'px',px:{top:35,right:35,bottom:35,left:35,flip:null},percent:{top:3,right:3,bottom:3,left:3,flip:15}},anchor:null,events:eventDefaults(),
  outlineColor:'#ffffff',waitCharClose:false,pressSound:true,
}
export interface Wallet { currency: Currency; total: number; recharge: number; bonus: number }
export interface BalanceView {
  source: Source; label: string
  status: 'ready' | 'signed-out' | 'missing-key' | 'unavailable' | 'failed'
  message: string; updatedAt: number | null; scope: string | null; wallets: Wallet[]
  stale?: boolean; failure?: 'temporary'|'credentials'|'identity'|'configuration'
}
export interface Usage { inputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; outputTokens: number }
export interface CostRange { low: number; high: number }
export interface CallRecord {
  id: string; session: string; turn: number; at: number; source: Source; scope: string
  model: string; usage: Usage; costs: Record<Currency, CostRange> | null
}
export interface Completion { seq: number; session: string; turn: number; at: number; reason: string; calls: CallRecord[] }
export interface DayRow {
  day: string; firstAt: number; lastAt: number; opening: number; last: number; debit: number; credit: number
  revision?: number; correction?: Correction|null; correctionLog?: {at:number;previous:Correction|null;next:Correction|null}[]
}
export interface Correction {at: number; credits: number; otherDebits: number; amount: number; debit: number; credit: number}
export interface Book { source: Source; scope: string; currency: Currency; days: Record<string, DayRow> }
export interface State {
  version: 3; settings: Settings; books: Record<string, Book>; calls: CallRecord[]
  completions: Completion[]; completionSeq: number; seen: Record<string, number>
  turnScopes: Record<string, Partial<Record<Source, string>>>
  bubbles: BubbleConfig; bookPreferences: Record<string,BookPreferences>
  notifications: Notification[]; notificationSeq: number; alertState: Record<string,boolean>; dismissed: string[]
  soundPlayed: string[]
}
export interface Snapshot { settings: Settings; balances: Record<Source, BalanceView>; completionSeq: number }
export function initialMode(balances: Record<Source, BalanceView>): DisplayMode {
  const account = !['signed-out', 'unavailable'].includes(balances.account.status)
  const key = !['missing-key', 'unavailable'].includes(balances['api-key'].status)
  return account && key ? 'both' : account ? 'account' : 'api-key'
}
export function parseSettings(input: unknown, previous: Settings, characters: readonly string[] = CHARACTERS.map(c=>c.id)): Settings {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('设置格式无效')
  const p = input as Record<string, unknown>; const next = structuredClone(previous)
  if (Object.keys(p).some(key => !(key in DEFAULT_SETTINGS))) throw new Error('未知设置字段')
  if ('displayMode' in p) {
    if (!['account', 'api-key', 'both'].includes(String(p.displayMode))) throw new Error('显示模式无效')
    next.displayMode = p.displayMode as DisplayMode
  }
  if ('character' in p) {
    if (!characters.includes(String(p.character))) throw new Error('角色无效')
    next.character = String(p.character)
  }
  for (const key of ['sound', 'flip','bubbleOn','stickyBalance','tapAdvance','menuButtonHide','autoFlip','waitCharClose','pressSound'] as const) {
    if (!(key in p)) continue
    if (typeof p[key] !== 'boolean') throw new Error('开关无效')
    next[key] = p[key]
  }
  for (const [key, min, max] of [['scale', 0.6, 2.5], ['volume', 0, 1], ['refreshSeconds', 15, 600],['scrollGap',0,100]] as const) {
    if (!(key in p)) continue
    const value = p[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error('设置数值超出范围')
    next[key] = value
  }
  for (const key of ['x', 'y'] as const) {
    if (!(key in p)) continue
    const value = p[key]
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100000)) throw new Error('位置无效')
    next[key] = value
  }
  if ('lowBalance' in p) {
    const value = p.lowBalance as Record<string, unknown> | null
    if (!value || typeof value !== 'object' || Object.keys(value).some(k => k !== 'CNY' && k !== 'USD')) throw new Error('余额阈值无效')
    for (const currency of ['CNY', 'USD'] as const) {
      const threshold = value[currency]
      if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0 || threshold > 1000000) throw new Error('余额阈值无效')
      next.lowBalance[currency] = threshold
    }
  }
  if('peakStyle' in p){if(!['simple','countdown','playful'].includes(String(p.peakStyle)))throw new Error('峰谷样式无效');next.peakStyle=p.peakStyle as Settings['peakStyle']}
  if('outlineColor' in p){if(typeof p.outlineColor!=='string'||!/^#[a-f\d]{6}$/i.test(p.outlineColor))throw new Error('轮廓颜色须为六位十六进制颜色');next.outlineColor=p.outlineColor.toLowerCase()}
  if('pressGroup' in p){if(typeof p.pressGroup!=='string'||p.pressGroup.length>100)throw new Error('按压音效组无效');next.pressGroup=p.pressGroup}
  if('snap' in p)next.snap=parseSnap(p.snap,previous.snap)
  if('anchor' in p){const a=p.anchor as PositionAnchor|null;if(a!==null&&(!a||!['left','right'].includes(a.horizontal)||!['top','bottom'].includes(a.vertical)||[a.x,a.y].some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>100000)))throw new Error('位置锚点无效');next.anchor=a?{horizontal:a.horizontal,vertical:a.vertical,x:a.x,y:a.y}:null}
  return next
}
export function parseSnap(value:unknown,previous=DEFAULT_SETTINGS.snap):SnapSettings {
  const s=value as SnapSettings & SnapProfile;if(!s||typeof s.enabled!=='boolean'||!['px','percent'].includes(s.unit))throw new Error('吸附设置无效')
  const next=structuredClone(previous);next.enabled=s.enabled;next.unit=s.unit
  const legacy='top' in s,profiles=legacy?[s.unit] as const:['px','percent'] as const
  for(const unit of profiles){const profile=legacy?s:s[unit];if(!profile)throw new Error('吸附配置缺失')
    for(const side of ['top','right','bottom','left','flip'] as const){if(legacy&&side==='flip')continue;const n=profile[side];if(side==='flip'&&unit==='px'&&n===null){next[unit].flip=null;continue}if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>(unit==='px'?100000:100))throw new Error('吸附数值无效');next[unit][side]=n}
  }return next
}
export function emptyV2Fields() {return {bubbles:defaultBubbles(),bookPreferences:{},notifications:[],notificationSeq:0,alertState:{},dismissed:[]}}
