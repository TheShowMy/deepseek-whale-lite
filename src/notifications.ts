import type {Notification,NotificationKind,EventSettings} from './shared.ts'
import {DEFAULT_SETTINGS} from './shared.ts'
import {parseDefinition} from './bubbles.ts'
export const EVENT_LABELS:Record<NotificationKind,string>={complete:'每轮完成',low:'低余额提醒',budget:'今日预算',question:'等待提问',approval:'等待授权'}
export function parseEvents(value:unknown):Record<NotificationKind,EventSettings> {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('提醒设置无效')
  const result=structuredClone(DEFAULT_SETTINGS.events)
  for(const kind of Object.keys(EVENT_LABELS) as NotificationKind[]){const v=(value as Record<string,unknown>)[kind] as EventSettings
    if(!v||['enabled','bubble','sound'].some(k=>typeof v[k as keyof EventSettings]!=='boolean')||typeof v.closeSeconds!=='number'||!Number.isInteger(v.closeSeconds)||v.closeSeconds<0||v.closeSeconds>86400||!(v.volume===null||(typeof v.volume==='number'&&v.volume>=0&&v.volume<=1))||typeof v.audio!=='string'||v.audio.length>100)throw new Error('提醒设置无效')
    result[kind]={...v,content:parseDefinition(v.content)}
  }return result
}
const rank=(n:Notification)=>['question','approval'].includes(n.kind)?0:n.kind==='budget'?1:n.kind==='low'?2:3
export class NotificationQueue {
  current:Notification|null=null;items:Notification[]=[];seen=new Set<string>()
  push(n:Notification):boolean {
    if(this.seen.has(n.id))return false;this.seen.add(n.id)
    if(this.seen.size>20000)this.seen.delete(this.seen.values().next().value!)
    if(this.current&&rank(n)===0&&rank(this.current)>0){this.items.push(this.current);this.current=n}
    else this.items.push(n)
    this.items.sort((a,b)=>rank(a)-rank(b)||a.seq-b.seq);if(!this.current)this.current=this.items.shift()??null
    return true
  }
  next():Notification|null {this.current=this.items.shift()??null;return this.current}
  resolved(pending:Set<string>):boolean {
    this.items=this.items.filter(n=>!n.pending||pending.has(n.id))
    if(this.current?.pending&&!pending.has(this.current.id)){this.next();return true}return false
  }
}
