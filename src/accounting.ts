import type {CallRecord, Currency, Source, State, Usage, CostRange} from './shared.ts'
import {DEFAULT_SETTINGS, emptyV2Fields} from './shared.ts'
export const SCALE = 100000000
export const PRICE_DATE = '2026-10-10'
export const PRICE_URL = 'https://api-docs.deepseek.com/quick_start/pricing/'
export function units(value: string | number): number {
  const match = /^(-?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(String(value))
  if (!match || !(match[2] || match[3])) throw new Error('金额格式无效')
  const exponent = Number(match[4] ?? 0)
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1000) throw new Error('金额超出范围')
  const fraction = match[3] ?? ''
  const digits = BigInt((match[2] || '0') + fraction)
  const shift = 8 + exponent - fraction.length
  // Platform wallets permit scientific notation and precision beyond 8 decimals.
  const divisor = shift < 0 ? 10n ** BigInt(-shift) : 1n
  const n = shift < 0 ? (digits + divisor / 2n) / divisor : digits * 10n ** BigInt(shift)
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('金额超出范围')
  return Number(match[1] ? -n : n)
}
export function dayKey(at = Date.now()): string { return new Date(at + 8 * 3600000).toISOString().slice(0, 10) }
export function emptyState(): State {
  return {version: 3, settings: structuredClone(DEFAULT_SETTINGS), books: {}, calls: [], completions: [], completionSeq: 0, seen: {}, turnScopes: {}, ...emptyV2Fields(),soundPlayed:[]}
}
export function bookKey(source: Source, scope: string, currency: Currency): string { return [source, scope, currency].join(':') }
export function observe(state: State, source: Source, scope: string, currency: Currency, total: number, at: number): void {
  const book = state.books[bookKey(source, scope, currency)] ??= {source, scope, currency, days: {}}
  const day = dayKey(at)
  if (at <= Math.max(0, ...Object.values(book.days).map(r => r.lastAt))) return
  const row = book.days[day]
  if (!row) book.days[day] = {day, firstAt: at, lastAt: at, opening: total, last: total, debit: 0, credit: 0}
  else {
    const delta = row.last - total
    row.debit += Math.max(delta, 0); row.credit += Math.max(-delta, 0)
    row.last = total; row.lastAt = at
  }
}
// Verified off-peak/peak interval; do not guess Chinese holidays or billing time.
export function estimate(model: string, usage: Usage): Record<Currency, CostRange> | null {
  const flash = ['deepseek-flash', 'deepseek-v4-flash', 'deepseek-v4-flash-vision-exp'].includes(model)
  if (!flash && model !== 'deepseek-v4-pro') return null
  const rates = flash ? {CNY: ['0.02', '1', '4'], USD: ['0.003', '0.15', '0.6']} : {CNY: ['0.15', '4.5', '13.5'], USD: ['0.022', '0.66', '1.98']}
  const result = {} as Record<Currency, CostRange>
  for (const currency of ['CNY', 'USD'] as const) {
    const [hit, miss, output] = rates[currency].map(units)
    const numerator = BigInt(usage.cacheReadTokens) * BigInt(hit) + BigInt(usage.inputTokens + usage.cacheWriteTokens) * BigInt(miss) + BigInt(usage.outputTokens) * BigInt(output)
    const low = Number((numerator + 500000n) / 1000000n); const high = Number((numerator * 2n + 500000n) / 1000000n)
    if (!Number.isSafeInteger(high)) return null
    result[currency] = {low, high}
  }
  return result
}
export function validUsage(value: unknown): Usage | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>; const usage = {} as Usage
  for (const key of ['inputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'outputTokens'] as const) {
    const n = raw[key] ?? 0
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) return null
    usage[key] = n
  }
  return usage
}
export function totals(calls: CallRecord[], currency: Currency) {
  return calls.reduce((r, c) => ({
    tokens: r.tokens + Object.values(c.usage).reduce((a,b) => a+b, 0),
    low: r.low + (c.costs?.[currency].low ?? 0), high: r.high + (c.costs?.[currency].high ?? 0),
    unknown: r.unknown + Number(c.costs === null),
  }), {tokens: 0, low: 0, high: 0, unknown: 0})
}
export function history(state: State, source?: Source, scope?: string) {
  const records = Object.values(state.books).filter(b => (!source || b.source === source) && (!scope || b.scope === scope)).flatMap(b =>
    Object.values(b.days).map(row => ({...row, source: b.source, scope: b.scope, currency: b.currency, observed: true,
      amount: correctedAmount(row), needsReview:row.credit>(row.correction?.credit??0), revision:revision(b.source,b.scope,b.currency,row),estimate: totals([], b.currency),
    })))
  const key = (s: Source, id: string, c: Currency, day: string) => bookKey(s,id,c) + ':' + day
  const index = new Map(records.map(r => [key(r.source,r.scope,r.currency,r.day),r]))
  for (const call of state.calls) {
    if ((source && call.source !== source) || (scope && call.scope !== scope)) continue
    for (const currency of ['CNY','USD'] as const) {
      const day = dayKey(call.at); const id = key(call.source,call.scope,currency,day)
      let row = index.get(id)
      if (!row) {
        row = {day, source:call.source, scope:call.scope, currency, observed:false, firstAt:call.at, lastAt:call.at, opening:0, last:0, debit:0, credit:0, amount:0,needsReview:false,revision:'',estimate:totals([],currency)}
        index.set(id,row); records.push(row)
      }
      const sum = totals([call],currency)
      row.estimate.tokens += sum.tokens; row.estimate.low += sum.low; row.estimate.high += sum.high; row.estimate.unknown += sum.unknown
    }
  }
  return records.sort((a,b) => b.day.localeCompare(a.day) || b.lastAt - a.lastAt)
}
export function prune(state: State, now = Date.now()): void {
  const cut = now - 90 * 86400000
  state.completions = state.completions.filter(c => c.at >= cut).slice(-200)
  state.seen = Object.fromEntries(Object.entries(state.seen).slice(-20000))
  state.turnScopes = Object.fromEntries(Object.entries(state.turnScopes).slice(-1000))
  state.notifications=state.notifications.filter(n=>n.pending||n.at>=now-7*86400000).slice(-1000)
  state.dismissed=state.dismissed.slice(-20000)
  state.soundPlayed=state.soundPlayed.slice(-20000)
}
export function correctedAmount(row:import('./shared.ts').DayRow):number {return row.correction?row.correction.amount+row.debit-row.correction.debit:row.debit}
export function revision(source:Source,scope:string,currency:Currency,row:import('./shared.ts').DayRow):string {return [source,scope,currency,row.day,row.firstAt,row.last,row.debit,row.credit,row.revision??0].join(':')}
export function reconcile(state:State,input:{source:Source;scope:string;currency:Currency;day:string;revision:string;credits:string;otherDebits:string;confirmed:boolean;reset?:boolean},now=Date.now()) {
  const row=state.books[bookKey(input.source,input.scope,input.currency)]?.days[input.day]
  if(!row)throw new Error('这一天没有余额观测记录')
  if(input.revision!==revision(input.source,input.scope,input.currency,row))throw Object.assign(new Error('余额已更新，请重新核对'),{status:409})
  const amount=(v:string)=>{if(!/^(0|[1-9]\d*)(\.\d{1,8})?$/.test(v))throw new Error('金额须为非负数，最多 8 位小数');return units(v)}
  if(!input.reset&&!input.confirmed)throw new Error('请确认已核对全部余额调整')
  const credits=input.reset?0:amount(input.credits),otherDebits=input.reset?0:amount(input.otherDebits)
  const corrected=row.opening+credits-otherDebits-row.last
  if(!input.reset&&(!Number.isSafeInteger(corrected)||corrected<0))throw new Error('校正消费为负或超出范围')
  const previous=row.correction??null,next=input.reset?null:{at:now,credits,otherDebits,amount:corrected,debit:row.debit,credit:row.credit}
  row.correctionLog=[...(row.correctionLog??[]),{at:now,previous,next}].slice(-50);row.correction=next;row.revision=(row.revision??0)+1
  return history(state,input.source,input.scope).find(r=>r.currency===input.currency&&r.day===input.day)
}
