import {createHash} from 'node:crypto'
import type {Context, Account, Client, Credentials, Llm, SettingsService} from './host.ts'
import {object} from './host.ts'
import type {BalanceView, Currency, Source, Wallet} from './shared.ts'
import {units} from './accounting.ts'
export function fingerprint(value: string): string { return createHash('sha256').update(value).digest('hex').slice(0, 32) }
export function officialEndpoint(value: string): boolean {
  try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'api.deepseek.com' && !u.port && !u.username && !u.password && !u.search && !u.hash }
  catch { return false }
}
export function providerConfig(ctx: Context, source: Source): {ref: string; official: boolean} {
  const provider = source === 'account' ? 'deepseek-account' : 'deepseek-official'
  const llm = ctx.get('llm') as Llm; const settings = ctx.get('settings') as SettingsService
  const entry = llm.listConfigurableProviders().find(p => p.provider === provider)
  if (!entry) return {ref: 'DEEPSEEK_API_KEY', official: false}
  const descriptor = settings.describe({redactSecrets: true}).find(d => d.ns === entry.settingsNs)
  if (!descriptor) return {ref: 'DEEPSEEK_API_KEY', official: false}
  let raw: unknown = descriptor.value
  for (const key of entry.settingsPath) raw = object(raw)[key]
  const config = object(raw)
  return {ref: String(config.apiKeyEnv ?? 'DEEPSEEK_API_KEY'), official: officialEndpoint(String(config.baseURL ?? process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/anthropic'))}
}
export class Sources {
  ctx: Context
  client: Client
  constructor(ctx: Context) {
    this.ctx = ctx
    this.client = {version: process.env.DSH_CLIENT_VERSION || process.env.DSH_VERSION || '0.2.0-rc.2', locale: 'zh-CN', timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60}
  }
  async identity(source: Source): Promise<string | null> {
    if (!providerConfig(this.ctx, source).official) return null
    if (source === 'api-key') {
      const hit = await (this.ctx.get('credentials') as Credentials).resolve(providerConfig(this.ctx, source).ref)
      return hit?.value ? fingerprint('key:' + hit.value) : null
    }
    const account = this.ctx.get('deepseekAccount') as Account | undefined
    const session = await account?.getPlatformSession()
    return session ? fingerprint('account:' + session.origin + ':' + (session.userId ?? session.token)) : null
  }
  async fetch(source: Source): Promise<BalanceView> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([this.fetchSource(source), new Promise<BalanceView>(resolve => {
        timer = setTimeout(() => resolve({source,label:source === 'account' ? 'DeepSeek 账号' : 'API Key',status:'failed',message:'余额查询超时，请稍后刷新',wallets:[],scope:null,updatedAt:null}),20000)
      })])
    } catch {
      return {source,label:source === 'account' ? 'DeepSeek 账号' : 'API Key',status:'failed',message:'来源配置或余额查询失败',wallets:[],scope:null,updatedAt:null}
    } finally {if (timer) clearTimeout(timer)}
  }
  private async fetchSource(source: Source): Promise<BalanceView> {
    const config = providerConfig(this.ctx, source)
    const view: BalanceView = {source, label: source === 'account' ? 'DeepSeek 账号' : config.ref, status: 'unavailable', message: '官方模型来源未启用或使用了代理', updatedAt: null, scope: null, wallets: []}
    if (!config.official) return view
    try {
      if (source === 'api-key') {
        const credentials = this.ctx.get('credentials') as Credentials
        const hit = await credentials.resolve(config.ref)
        if (!hit?.value) return {...view, status: 'missing-key', message: '尚未配置 API Key'}
        if (!/^\S+$/.test(hit.value)) return {...view, status: 'failed', message: 'API Key 格式无效，请在 DSH 模型设置中更新'}
        const scope = fingerprint('key:' + hit.value)
        const res = await fetch('https://api.deepseek.com/user/balance', {headers: {Authorization: 'Bearer ' + hit.value}, signal: AbortSignal.timeout(15000), redirect: 'error'})
        if (!res.ok) return {...view, status: 'failed', message: res.status === 401 || res.status === 403 ? 'API Key 无效或已过期' : '余额接口请求失败（HTTP ' + res.status + '）'}
        const data = object(await res.json())
        const infos = data.balance_infos
        if (typeof data.is_available !== 'boolean' || !Array.isArray(infos) || !infos.length) throw new Error('invalid')
        const wallets = infos.map(raw => {
          const w = object(raw); const currency = String(w.currency)
          if (currency !== 'CNY' && currency !== 'USD') throw new Error('invalid')
          return {currency, total: units(String(w.total_balance)), recharge: units(String(w.topped_up_balance)), bonus: units(String(w.granted_balance))} as Wallet
        })
        if (await this.identity(source) !== scope) return {...view, status: 'failed', message: '凭据已变更，请刷新'}
        return {...view, status: 'ready', message: data.is_available ? '' : '账户当前不可调用模型', scope, wallets, updatedAt: Date.now()}
      }
      const account = this.ctx.get('deepseekAccount') as Account | undefined
      if (!account) return {...view, message: '当前 DSH 没有账号服务'}
      if ((await account.getState()).status === 'signed-out') return {...view, status: 'signed-out', message: '尚未登录 DeepSeek 账号'}
      const profile = await account.getProfile(this.client).catch(() => null)
      const scope = await this.identity(source)
      if (!scope) return {...view, status: 'signed-out', message: '账号登录已失效'}
      const result = await account.getBalance(this.client)
      if (!result) return {...view, status: 'signed-out', message: '账号登录已失效'}
      if (result.status !== 'ready') return {...view, status: 'failed', message: '账号余额查询失败'}
      if (await this.identity(source) !== scope) return {...view, status: 'failed', message: '登录账号已变更，请刷新'}
      const grouped = new Map<Currency, Wallet>()
      for (const [rows, field] of [[result.value, 'recharge'], [result.bonusWallets, 'bonus']] as const) {
        for (const raw of rows) {
          if (raw.currency !== 'CNY' && raw.currency !== 'USD') throw new Error('invalid')
          const wallet = grouped.get(raw.currency) ?? {currency: raw.currency, total: 0, recharge: 0, bonus: 0}
          wallet[field] += units(raw.balance); wallet.total = wallet.recharge + wallet.bonus
          if (!Number.isSafeInteger(wallet.total)) throw new Error('invalid')
          grouped.set(raw.currency, wallet)
        }
      }
      if (!grouped.size) return {...view, status: 'failed', message: '账号尚无余额钱包'}
      return {...view, label: profile?.status === 'ready' && profile.value.name ? profile.value.name : 'DeepSeek 账号', status: 'ready', message: '', scope, wallets: [...grouped.values()], updatedAt: Date.now()}
    } catch {
      // Never serialize service exceptions: providers may include request headers.
      return {...view, status: 'failed', message: '余额查询失败或超时，请稍后刷新'}
    }
  }
}
