import {readFile} from 'node:fs/promises'
import type {IncomingMessage, ServerResponse} from 'node:http'
import type {Context, WebServer, Connection, Route, Session, SessionEvent} from './host.ts'
import {Engine} from './engine.ts'
import {PREFIX, SOURCES, CHARACTERS} from './shared.ts'
import {dayKey,history} from './accounting.ts'
import {archivedState} from './persistence.ts'
import {modelMatches,modelStats} from './ledger-stats.ts'
import type {Currency} from './shared.ts'
export const name = 'deepseek-whale-lite'
const loader = '(function(){try{if(!window.dshDesktop||location.protocol!=="dsh-app:")return;var s=document.createElement("script");s.src="' + PREFIX + '/widget.js";s.onerror=function(){};(document.body||document.head).appendChild(s)}catch(e){}})()'
async function body(req: IncomingMessage, max=8192): Promise<unknown> {
  const chunks:Buffer[]=[];let size=0
  for await (const chunk of req) {const b=Buffer.from(chunk);size+=b.length;if(size>max)throw new Error('请求过大');chunks.push(b)}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(data))
}
export function apply(root: Context): void {
  // Desktop snapshots injections once at boot: subscribe before waiting for services.
  root.on('webserver/index-inject', raw => {
    const rows = raw as {kind: string; placement: string; text?: string}[]
    if (!rows.some(row => row.text?.includes(PREFIX + '/widget.js'))) rows.push({kind: 'script', placement: 'body', text: loader})
  })
  root.inject(['webServer', 'credentials', 'connection', 'llm', 'settings', 'profileContext'], ctx => {
    const profile = ctx.get('profileContext') as {name: string; home: string}
    if (profile.name !== 'desktop') return
    const engine = new Engine(ctx, profile.home)
    const web = ctx.get('webServer') as WebServer; const connection = ctx.get('connection') as Connection
    function register(path: string, handler: Route['handler']): void {
      const dispose = web.register({kind: 'exact', path: PREFIX + path, handler: async (req, res) => {
        let rejection: number | undefined
        try { rejection = connection.requestRejection(req) } catch { rejection = 403 }
        if (rejection !== undefined) {json(res, {error: '请求未通过宿主身份校验'}, rejection); return}
        try { await handler(req, res) } catch(error) {const e=error as {status?:number;message?:string;code?:string};json(res, {error:e.code?'本地读写失败，请检查数据目录权限':e.message?.slice(0,160)||'请求失败，请稍后重试'},e.status??400)}
      }})
      ctx.effect(() => dispose)
    }
    function get(req: IncomingMessage, res: ServerResponse): boolean {
      if (req.method === 'GET') return true
      json(res, {error: '不支持该请求方法'}, 405); return false
    }
    register('/state', (req, res) => {if (get(req,res)) json(res, engine.snapshot())})
    register('/balance', async (req, res) => {
      if (!get(req,res)) return
      const source = new URL(req.url || '/', 'http://localhost').searchParams.get('source')
      if (source !== 'account' && source !== 'api-key') throw new Error('source')
      json(res, await engine.refresh(source))
    })
    register('/settings', async (req,res) => {
      if (req.method !== 'PUT') {json(res, {error:'不支持该请求方法'}, 405); return}
      engine.settings(await body(req,512*1024)); json(res, engine.state.settings)
    })
    register('/history', (req,res) => {
      if(!get(req,res))return
      const q=new URL(req.url||'/','http://localhost').searchParams,range=q.get('range')??'today',source=q.get('source'),currency=q.get('currency'),scope=q.get('scope'),model=q.get('model')??'',day=q.get('day')
      if(!['today','week','month','all'].includes(range)||(source&&!SOURCES.includes(source as typeof SOURCES[number]))||(currency&&!['CNY','USD'].includes(currency)))throw new Error('记录筛选无效')
      const offset=Number(q.get('offset')??0);if(!Number.isSafeInteger(offset)||offset<0)throw new Error('分页参数无效')
      const cut=dayKey(Date.now()-(range==='week'?6:range==='month'?29:0)*86400000),s=archivedState(engine.path,engine.state,range==='all'?undefined:cut)
      const matches=(r:{source:string;scope:string;day:string;currency?:string})=>(!source||r.source===source)&&(!scope||r.scope===scope)&&(!currency||!r.currency||r.currency===currency)&&(!day||r.day===day)&&(range==='all'||r.day>=cut)
      const rows=history(s).filter(matches)
      const records=s.calls.filter(c=>matches({...c,day:dayKey(c.at)})&&modelMatches(c.model,model)).sort((a,b)=>b.at-a.at)
      json(res,{rows,records:records.slice(offset,offset+50),models:modelStats(records,currency as Currency|null??undefined),total:records.length,more:offset+50<records.length})
    })
    register('/bubbles',async(req,res)=>{if(req.method==='PUT'){engine.bubbles(await body(req,512*1024));json(res,engine.state.bubbles)}else if(get(req,res))json(res,engine.state.bubbles)})
    register('/resources',async(req,res)=>{
      if(req.method==='POST'){
        const input=await body(req,30*1024*1024),before=new Set(engine.resources.catalog().assets.map(a=>a.id)),catalog=engine.resources.mutate(input)
        const imported=catalog.assets.find(a=>!before.has(a.id)&&a.kind==='role');if(imported)engine.state.settings.character=imported.id
        if(!catalog.assets.some(a=>a.id===engine.state.settings.character))engine.state.settings.character='deepseek-smile'
        if(!catalog.groups.some(g=>g.id===engine.state.settings.pressGroup))engine.state.settings.pressGroup='group-default'
        for(const [kind,e] of Object.entries(engine.state.settings.events))if(e.audio&&!catalog.assets.some(a=>a.id===e.audio)&&!catalog.groups.some(g=>g.id===e.audio))e.audio=kind==='complete'?'complete':'alert'
        engine.save();json(res,catalog)
      }else if(get(req,res))json(res,engine.resources.catalog())
    })
    register('/asset',(req,res)=>{if(!get(req,res))return;const id=new URL(req.url||'/','http://localhost').searchParams.get('id')??'';const asset=engine.resources.binary(id);res.writeHead(200,{'Content-Type':asset.mime,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(asset.bytes)})
    register('/notifications',async(req,res)=>{if(req.method==='PUT'){const v=await body(req) as {id:string;action?:string};if(typeof v.id!=='string')throw new Error('通知 ID 无效');if(v.action==='claim-sound'){json(res,{play:engine.claimSound(v.id)});return}if(v.action&&v.action!=='dismiss')throw new Error('通知操作无效');engine.dismiss(v.id);json(res,{ok:true})}else if(get(req,res)){const after=Number(new URL(req.url||'/','http://localhost').searchParams.get('after')??0);if(!Number.isSafeInteger(after)||after<0)throw new Error('通知游标无效');json(res,engine.notifications(after))}})
    register('/book-preferences',async(req,res)=>{if(req.method==='PUT'){engine.setPreferences(await body(req));json(res,engine.state.bookPreferences)}else if(get(req,res))json(res,engine.state.bookPreferences)})
    register('/adjustments',async(req,res)=>{
      if(req.method==='PUT'){json(res,await engine.adjust(await body(req)));return}
      if(!get(req,res))return
      const q=new URL(req.url||'/','http://localhost').searchParams,source=q.get('source'),scope=q.get('scope'),currency=q.get('currency')
      if(!SOURCES.includes(source as typeof SOURCES[number])||!scope||!['CNY','USD'].includes(currency??''))throw new Error('校正来源无效')
      await engine.refresh(source as typeof SOURCES[number]);json(res,{rows:engine.rows(true).filter(r=>r.source===source&&r.scope===scope&&r.currency===currency&&r.observed)})
    })
    register('/completions', (req,res) => {
      if (!get(req,res)) return
      const after = Number(new URL(req.url || '/', 'http://localhost').searchParams.get('after') || 0)
      json(res, {seq: engine.state.completionSeq, items: engine.state.completions.filter(c => c.seq > after)})
    })
    const files = new Map<string, {url: URL; type: string}>([
      ['/widget.js', {url: new URL('./widget.js', import.meta.url), type: 'text/javascript; charset=utf-8'}],
      ...CHARACTERS.map(c => ['/characters/' + c.id + '.png', {url: new URL('../assets/characters/' + c.id + '.png', import.meta.url), type:'image/png'}] as const),
      ...['press', 'release', 'complete', 'alert'].map(s => ['/sounds/' + s + '.ogg', {url: new URL('../assets/sounds/' + s + '.ogg', import.meta.url), type:'audio/ogg'}] as const),
    ])
    for (const [path, asset] of files) register(path, async (req,res) => {
      if (!get(req,res)) return
      const bytes = await readFile(asset.url); res.writeHead(200, {'Content-Type': asset.type, 'Cache-Control':'no-cache'}); res.end(bytes)
    })
    ctx.on('session/event', (session, event) => {void engine.event(session as Session, event as SessionEvent)})
    ctx.on('session/disposed',session=>engine.disposeSession((session as Session).id))
    void engine.initialize().catch(() => {console.warn('[deepseek-whale-lite] 初始化失败')})
    let refreshedAt = Date.now()
    const timer = setInterval(() => {
      if (Date.now() - refreshedAt < engine.state.settings.refreshSeconds * 1000) return
      refreshedAt = Date.now()
      for (const source of SOURCES) void engine.refresh(source)
    }, 1000)
    ctx.effect(() => () => {clearInterval(timer); engine.save(); engine.closed = true})
  })
}
export default {name, apply}
