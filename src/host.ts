import type {IncomingMessage, ServerResponse} from 'node:http'
export interface Route {kind: 'exact'; path: string; handler(req: IncomingMessage, res: ServerResponse): void | Promise<void>}
export interface Context {
  get(name: string): unknown
  on(name: string, listener: (...args: unknown[]) => void): () => void
  inject(names: string[], callback: (ctx: Context) => void): unknown
  effect(callback: () => (() => void)): unknown
}
export interface Credentials {resolve(ref: string): Promise<{value: string} | undefined>}
export interface Account {
  getState(): Promise<{status: 'signed-out' | 'credential-stored'}>
  getProfile(client: Client): Promise<{status: 'ready'; value: {id: string | null; name: string | null}} | {status: 'failed'} | null>
  getBalance(client: Client): Promise<{status: 'ready'; value: {currency: string; balance: string}[]; bonusWallets: {currency: string; balance: string}[]} | {status: 'failed'} | null>
  getPlatformSession(): Promise<{origin: string; token: string; userId: string | null} | null>
}
export interface Client {version: string; locale: string; timezoneOffsetSeconds: number}
export interface Llm {listConfigurableProviders(): {provider: string; settingsNs: string; settingsPath: string[]}[]}
export interface SettingsService {describe(options: {redactSecrets: boolean}): {ns: string; value: unknown}[]}
export interface WebServer {register(route: Route): () => void}
export interface Connection {requestRejection(req: IncomingMessage): number | undefined}
export interface Session {id: string; isOwnSeq?(seq: number): boolean}
export interface SessionEvent {type: string; seq: number; time: number; data: Record<string, unknown>}
export function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
