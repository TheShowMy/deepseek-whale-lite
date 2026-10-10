import {readFile} from 'node:fs/promises'
import type {IncomingMessage, ServerResponse} from 'node:http'
import type {Context, WebServer, Connection, Route, Session, SessionEvent} from './host.ts'
import {Engine} from './engine.ts'
import {PREFIX, SOURCES, CHARACTERS} from './shared.ts'
export const name = 'deepseek-whale-lite'
const loader = '(function(){try{if(!window.dshDesktop||location.protocol!=="dsh-app:")return;var s=document.createElement("script");s.src="' + PREFIX + '/widget.js";s.onerror=function(){};(document.body||document.head).appendChild(s)}catch(e){}})()'
async function body(req: IncomingMessage): Promise<unknown> {
  let text = ''
  for await (const chunk of req) {text += String(chunk); if (Buffer.byteLength(text) > 8192) throw new Error('请求过大')}
  return JSON.parse(text)
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
        try { await handler(req, res) } catch {json(res, {error: '请求失败，请检查参数或稍后重试'}, 400)}
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
      engine.settings(await body(req)); json(res, engine.state.settings)
    })
    register('/history', (req,res) => {if (get(req,res)) json(res, {rows: engine.rows()})})
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
