import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync,copyFileSync,constants,readdirSync} from 'node:fs'
import {dirname,join} from 'node:path'
import type {State,Book,CallRecord} from './shared.ts'
import {DEFAULT_SETTINGS,CHARACTERS,emptyV2Fields,parseSettings,parseSnap} from './shared.ts'
import {emptyState,prune} from './accounting.ts'
import {parseBubbles,parseDefinition} from './bubbles.ts'
export function atomicJson(path:string,value:unknown):void {mkdirSync(dirname(path),{recursive:true,mode:0o700});writeFileSync(path+'.tmp',JSON.stringify(value),{mode:0o600});renameSync(path+'.tmp',path)}
export function loadState(path:string):State {
  if(!existsSync(path))return emptyState()
  const p=JSON.parse(readFileSync(path,'utf8')) as Omit<State,'version'> & {version:number}
  if(!p||![1,2,3].includes(p.version)||!p.books||!Array.isArray(p.calls)||!p.settings||!p.seen)throw new Error('账本结构异常，已停止写入以保护原记录')
  if(p.version<3){
    const backup=path+'.v'+p.version+'.bak';if(!existsSync(backup))copyFileSync(path,backup,constants.COPYFILE_EXCL)
    const old=p.settings;p.settings={...structuredClone(DEFAULT_SETTINGS),...old,snap:parseSnap(old.snap??DEFAULT_SETTINGS.snap)}
    if(p.version===1)Object.assign(p,emptyV2Fields())
    const patch:Partial<typeof old>={...old,events:undefined};if(patch.displayMode===null)delete patch.displayMode
    const characters:string[]=CHARACTERS.map(c=>c.id);if(/^user-[a-f\d-]{36}$/.test(old.character))characters.push(old.character)
    p.settings=parseSettings(patch,p.settings,characters)
    if(!p.bubbles||!p.bookPreferences||!Array.isArray(p.notifications))throw new Error('账本 v2 结构异常，已停止迁移')
    p.bubbles=parseBubbles(p.bubbles);for(const e of Object.values(p.settings.events))e.content=parseDefinition(e.content)
    p.soundPlayed=[];p.version=3
    atomicJson(path,p)
  }
  if(!p.bubbles||!p.bookPreferences||!Array.isArray(p.notifications))throw new Error('账本 v2 结构异常，已停止写入')
  if(!Array.isArray(p.soundPlayed))throw new Error('通知去重记录异常，已停止写入')
  p.settings={...structuredClone(DEFAULT_SETTINGS),...p.settings,snap:parseSnap(p.settings.snap)}
  p.bubbles=parseBubbles(p.bubbles);for(const e of Object.values(p.settings.events))e.content=parseDefinition(e.content)
  return p as State
}
interface Archive {version:1;calls:CallRecord[];books:Record<string,Book>}
function archive(path:string):Archive {if(!existsSync(path))return {version:1,calls:[],books:{}};const a=JSON.parse(readFileSync(path,'utf8')) as Archive;if(a.version!==1||!Array.isArray(a.calls)||!a.books)throw new Error('归档格式异常');return a}
export function saveState(path:string,state:State,now=Date.now()):void {
  const cut=now-90*86400000,kept=state.calls.filter(c=>c.at>=cut).slice(-20000),ids=new Set(kept.map(c=>c.id)),groups=new Map<string,Archive>()
  const group=(month:string)=>{let a=groups.get(month);if(!a){a=archive(join(dirname(path),'archive',month+'.json'));groups.set(month,a)}return a}
  for(const c of state.calls)if(!ids.has(c.id))group(new Date(c.at+8*3600000).toISOString().slice(0,7)).calls.push(c)
  const oldDays:{key:string;day:string}[]=[]
  for(const [key,book] of Object.entries(state.books))for(const [day,row] of Object.entries(book.days))if(row.lastAt<now-365*86400000){const a=group(day.slice(0,7));const target=a.books[key]??={...book,days:{}};target.days[day]=row;oldDays.push({key,day})}
  // Commit every archive before removing anything from the active ledger.
  for(const [month,a] of groups){a.calls=[...new Map(a.calls.map(c=>[c.id,c])).values()];atomicJson(join(dirname(path),'archive',month+'.json'),a)}
  state.calls=kept;for(const {key,day} of oldDays)delete state.books[key].days[day]
  prune(state,now);atomicJson(path,state)
}
export function archivedState(path:string,active:State,minDay?:string):State {
  const dir=join(dirname(path),'archive');if(!existsSync(dir))return active
  const result=structuredClone(active)
  for(const file of readdirSync(dir).filter(f=>/^\d{4}-\d{2}\.json$/.test(f)&&(!minDay||f.slice(0,7)>=minDay.slice(0,7)))){const a=archive(join(dir,file));result.calls.push(...a.calls);for(const [key,b] of Object.entries(a.books)){const book=result.books[key]??={...b,days:{}};book.days={...b.days,...book.days}}}
  result.calls=[...new Map(result.calls.map(c=>[c.id,c])).values()];return result
}
