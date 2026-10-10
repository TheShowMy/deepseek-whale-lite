import {mkdirSync, readFileSync, writeFileSync, renameSync, existsSync} from 'node:fs'
import {join} from 'node:path'
import type {Context, Session, SessionEvent} from './host.ts'
import {object} from './host.ts'
import type {BalanceView, Source, State, Snapshot} from './shared.ts'
import {SOURCES, initialMode, parseSettings} from './shared.ts'
import {emptyState, observe, prune, validUsage, estimate, history} from './accounting.ts'
import {Sources, providerConfig} from './sources.ts'
export class Engine {
  state: State
  sources: Sources
  path: string
  closed = false
  balances: Record<Source, BalanceView>
  flights: Partial<Record<Source, Promise<BalanceView>>> = {}
  queue: Promise<void> = Promise.resolve()
  constructor(ctx: Context, home: string) {
    this.sources = new Sources(ctx); this.path = join(home, 'deepseek-whale-lite', 'state.json')
    this.state = existsSync(this.path) ? JSON.parse(readFileSync(this.path, 'utf8')) as State : emptyState()
    if (this.state.version !== 1 || !this.state.books || !Array.isArray(this.state.calls)) throw new Error('Whale Lite 数据格式无效，请保留 state.json 后排查')
    const pending = (source: Source): BalanceView => ({source, label: source === 'account' ? 'DeepSeek 账号' : 'API Key', status: 'failed', message: '等待刷新', wallets: [], updatedAt: null, scope: null})
    this.balances = {account: pending('account'), 'api-key': pending('api-key')}
  }
  save(): void {
    if (this.closed) return
    prune(this.state)
    mkdirSync(join(this.path, '..'), {recursive: true, mode: 0o700})
    writeFileSync(this.path + '.tmp', JSON.stringify(this.state), {mode: 0o600})
    renameSync(this.path + '.tmp', this.path)
  }
  refresh(source: Source): Promise<BalanceView> {
    const running = this.flights[source]; if (running) return running
    const promise = this.sources.fetch(source).then(view => {
      if (this.closed) return view
      this.balances[source] = view
      if (view.status === 'ready' && view.scope && view.updatedAt) {
        for (const w of view.wallets) observe(this.state, source, view.scope, w.currency, w.total, view.updatedAt)
      }
      this.save(); return view
    }).catch(() => {
      const view: BalanceView = {source,label:source === 'account' ? 'DeepSeek 账号' : 'API Key',status:'failed',message:'余额或账本更新失败，请稍后重试',scope:null,updatedAt:null,wallets:[]}
      if (!this.closed) this.balances[source] = view
      return view
    }).finally(() => { delete this.flights[source] })
    this.flights[source] = promise; return promise
  }
  async initialize(): Promise<void> {
    await Promise.all(SOURCES.map(s => this.refresh(s)))
    if (this.state.settings.displayMode === null) {this.state.settings.displayMode = initialMode(this.balances); this.save()}
  }
  snapshot(): Snapshot { return {settings: this.state.settings, balances: this.balances, completionSeq: this.state.completionSeq} }
  settings(input: unknown): void { this.state.settings = parseSettings(input, this.state.settings); this.save() }
  rows() { return history(this.state) }
  event(session: Session, event: SessionEvent): Promise<void> {
    this.queue = this.queue.then(() => this.handle(session, event)).catch(() => {console.warn('[deepseek-whale-lite] 会话统计失败，请检查本地数据目录')})
    return this.queue
  }
  async handle(session: Session, event: SessionEvent): Promise<void> {
    if (this.closed || !Number.isSafeInteger(event.seq) || event.seq < 0 || (session.isOwnSeq && !session.isOwnSeq(event.seq))) return
    const data = object(event.data); const turn = data.turn; const step = data.step
    if (!Number.isSafeInteger(turn)) return
    const key = session.id + ':' + String(turn)
    if (event.type === 'step/start') {
      const scopes: Partial<Record<Source, string>> = {}
      await Promise.all(SOURCES.map(async s => {try {const id = await this.sources.identity(s); if (id) scopes[s] = id} catch { /* unavailable source */ }}))
      this.state.turnScopes[key + ':' + String(step)] = scopes
      return
    }
    if (event.type === 'assistant/message') {
      const id = session.id + ':' + event.seq
      if ((this.state.seen[session.id] ?? -1) >= event.seq) return
      if (this.state.calls.some(c => c.id === id)) return
      const src = object(object(data.message).source)
      const source = src.provider === 'deepseek-account' ? 'account' : src.provider === 'deepseek-official' ? 'api-key' : null
      const usage = validUsage(data.usage)
      if (!source || !usage || typeof src.model !== 'string' || !providerConfig(this.sources.ctx, source).official) return
      const scope = this.state.turnScopes[key + ':' + String(step)]?.[source] ?? await this.sources.identity(source)
      if (!scope) return
      this.state.calls.push({id, session: session.id, turn: turn as number, at: event.time, source, scope, model: src.model, usage, costs: estimate(src.model, usage)})
      this.save()
    }
    if (event.type === 'turn/end') {
      if ((this.state.seen[session.id] ?? -1) >= event.seq) return
      const calls = this.state.calls.filter(c => c.session === session.id && c.turn === turn)
      if (calls.length) this.state.completions.push({seq: ++this.state.completionSeq, session: session.id, turn: turn as number, at: event.time, reason: String(object(data.reason).kind ?? 'completed'), calls})
      this.state.seen[session.id] = event.seq
      for (const k of Object.keys(this.state.turnScopes)) if (k.startsWith(key + ':')) delete this.state.turnScopes[k]
      this.save()
      for (const source of new Set(calls.map(c => c.source))) void this.refresh(source)
    }
  }
}
