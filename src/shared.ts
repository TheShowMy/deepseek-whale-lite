export type Source = 'account' | 'api-key'
export type Currency = 'CNY' | 'USD'
export type DisplayMode = Source | 'both'
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
}
export const DEFAULT_SETTINGS: Settings = {
  displayMode: null, character: 'deepseek-smile', scale: 1, x: null, y: null,
  flip: false, sound: false, volume: 0.4, refreshSeconds: 60, lowBalance: {CNY: 5, USD: 1},
}
export interface Wallet { currency: Currency; total: number; recharge: number; bonus: number }
export interface BalanceView {
  source: Source; label: string
  status: 'ready' | 'signed-out' | 'missing-key' | 'unavailable' | 'failed'
  message: string; updatedAt: number | null; scope: string | null; wallets: Wallet[]
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
}
export interface Book { source: Source; scope: string; currency: Currency; days: Record<string, DayRow> }
export interface State {
  version: 1; settings: Settings; books: Record<string, Book>; calls: CallRecord[]
  completions: Completion[]; completionSeq: number; seen: Record<string, number>
  turnScopes: Record<string, Partial<Record<Source, string>>>
}
export interface Snapshot { settings: Settings; balances: Record<Source, BalanceView>; completionSeq: number }
export function initialMode(balances: Record<Source, BalanceView>): DisplayMode {
  const account = !['signed-out', 'unavailable'].includes(balances.account.status)
  const key = !['missing-key', 'unavailable'].includes(balances['api-key'].status)
  return account && key ? 'both' : account ? 'account' : 'api-key'
}
export function parseSettings(input: unknown, previous: Settings): Settings {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('设置格式无效')
  const p = input as Record<string, unknown>; const next = structuredClone(previous)
  if (Object.keys(p).some(key => !(key in DEFAULT_SETTINGS))) throw new Error('未知设置字段')
  if ('displayMode' in p) {
    if (!['account', 'api-key', 'both'].includes(String(p.displayMode))) throw new Error('显示模式无效')
    next.displayMode = p.displayMode as DisplayMode
  }
  if ('character' in p) {
    if (!CHARACTERS.some(c => c.id === p.character)) throw new Error('角色无效')
    next.character = String(p.character)
  }
  for (const key of ['sound', 'flip'] as const) {
    if (!(key in p)) continue
    if (typeof p[key] !== 'boolean') throw new Error('开关无效')
    next[key] = p[key]
  }
  for (const [key, min, max] of [['scale', 0.6, 1.5], ['volume', 0, 1], ['refreshSeconds', 15, 600]] as const) {
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
  return next
}
