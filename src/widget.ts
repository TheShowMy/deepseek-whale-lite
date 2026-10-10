import {PREFIX, CHARACTERS, SOURCES, DEFAULT_SETTINGS} from './shared.ts'
import type {Settings, Snapshot, BalanceView, Completion, Source, Currency} from './shared.ts'
import {SCALE, dayKey, totals} from './accounting.ts'
type Row = {day: string; source: Source; scope: string; currency: Currency; observed: boolean; firstAt: number; lastAt: number; debit: number; credit: number; estimate: ReturnType<typeof totals>}
declare global {interface Window {dshDesktop?: unknown; __deepseekWhaleLite?: () => void}}
async function mount(): Promise<void> {
  if (!window.dshDesktop || location.protocol !== 'dsh-app:' || location.hostname !== 'app' || window.__deepseekWhaleLite) return
  const lifecycle = new AbortController()
  let stopped = false; let poll: ReturnType<typeof setTimeout>; let cursor = 0
  let settings: Settings = structuredClone(DEFAULT_SETTINGS)
  let snapshot: Snapshot; let rows: Row[] = []; let last: Completion | null = null
  let historyOpen = false; let settingsOpen = false; let initialized = false
  const alerts = new Set<string>(); const audio = new Map<string, HTMLAudioElement>()
  const host = document.createElement('div'); host.id = 'deepseek-whale-lite'; host.style.cssText = 'position:fixed;z-index:2147483000;width:290px;transform-origin:top left;'
  const shadow = host.attachShadow({mode: 'open'})
  const style = document.createElement('style')
  style.textContent = `
    :host{font:12px/1.45 system-ui,sans-serif;color:#18344a;--bg:#f7fbff;--line:#d6e7f2;--muted:#647d90;--accent:#207eb4;--card:#fff}
    *{box-sizing:border-box}button,input,select{font:inherit}button,select,input{border:1px solid var(--line);border-radius:8px;color:inherit;background:var(--card);padding:5px 7px}button{cursor:pointer}button:hover{border-color:var(--accent)}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
    .panel{border:1px solid var(--line);border-radius:16px;padding:11px;background:var(--bg);box-shadow:0 6px 24px #09294125;max-height:var(--panel-height,650px);overflow:auto}.title{display:flex;align-items:center;gap:6px;cursor:grab;user-select:none}.title strong{flex:1;font-size:13px}.title button{padding:2px 6px}.card{border-top:1px solid var(--line);margin-top:8px;padding-top:8px}.label{display:flex;align-items:center;gap:6px}.label strong{flex:1}.label button{font-size:11px}.sub{font-size:11px;color:var(--muted);overflow-wrap:anywhere}.money{font-size:20px;font-weight:750;margin:2px 0}.low{color:#b34421}.failure{color:#9d5a30;margin:7px 0}.toolbar{display:flex;gap:6px;margin-top:8px}.toolbar select{flex:1;min-width:0}.figure{display:block;width:156px;height:156px;margin:0 auto;padding:0;border:0;background:transparent;touch-action:none;cursor:grab}.figure img{width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none}.figure.pressed img{translate:0 3px;scale:.96}.figure.flipped img{transform:scaleX(-1)}
    .bubble{border-radius:12px;padding:8px 10px;margin-bottom:7px;background:var(--card);border:1px solid var(--line);white-space:pre-line;max-height:130px;overflow:auto}.form{margin-top:9px;display:grid;grid-template-columns:1fr 1fr;gap:8px}.form label{display:flex;flex-direction:column;gap:3px}.form input,.form select{width:100%}.form .wide{grid-column:span 2}.history{max-height:230px;overflow:auto;margin-top:8px}.history article{border-top:1px solid var(--line);padding:7px 0}.note{color:var(--muted);margin-top:6px;font-size:10px}[hidden]{display:none!important}
    @media(prefers-color-scheme:dark){:host{color:#d6eaf8;--bg:#182a38;--card:#213746;--line:#3b5465;--muted:#a8becd;--accent:#65bce8}.low{color:#ffc39d}.failure{color:#ffcdab}}
  `
  const panel = document.createElement('section'); panel.className = 'panel'; panel.setAttribute('aria-label', 'DeepSeek 余额挂件')
  const bubble = document.createElement('div'); bubble.className = 'bubble'; bubble.hidden = true; bubble.setAttribute('aria-live', 'polite')
  const title = document.createElement('div'); title.className = 'title'
  const heading = document.createElement('strong'); heading.textContent = 'DeepSeek Whale Lite'
  const historyButton = button('历史', () => {historyOpen = !historyOpen; renderExtras()})
  const settingsButton = button('设置', () => {settingsOpen = !settingsOpen; renderExtras()})
  title.append(heading, historyButton, settingsButton)
  const cards = document.createElement('div')
  const toolbar = document.createElement('div'); toolbar.className = 'toolbar'
  const mode = document.createElement('select'); mode.setAttribute('aria-label', '余额显示模式')
  for (const [value, text] of [['both', '两个余额同时显示'], ['account', '仅账号登录'], ['api-key', '仅 API Key']]) mode.add(new Option(text, value))
  mode.addEventListener('change', () => {void update({displayMode: mode.value as Settings['displayMode']})}, {signal:lifecycle.signal})
  toolbar.append(mode, button('刷新', () => {for (const source of visible()) void refresh(source)}))
  const extras = document.createElement('div')
  panel.append(bubble, title, cards, toolbar, extras)
  const figure = document.createElement('button'); figure.className = 'figure'; figure.setAttribute('aria-label', '拖动角色；点击显示最近一轮消耗')
  const image = document.createElement('img'); image.alt = 'DeepSeek Q 版角色'; image.draggable = false
  figure.append(image); shadow.append(style, panel, figure); document.body.append(host)
  function cleanup() {
    stopped = true; clearTimeout(poll); lifecycle.abort(); host.remove()
    for (const sound of audio.values()) {sound.pause(); sound.src = ''}
    delete window.__deepseekWhaleLite
  }
  window.__deepseekWhaleLite = cleanup
  function button(label: string, fn: () => void): HTMLButtonElement {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label
    b.onclick = fn; return b
  }
  function say(text: string) {bubble.textContent = text; bubble.hidden = false; if (!drag) place()}
  function sound(name: string) {
    if (!settings.sound) return
    let a = audio.get(name); if (!a) {a = new Audio(PREFIX + '/sounds/' + name + '.ogg'); audio.set(name, a)}
    a.volume = settings.volume; a.currentTime = 0; void a.play().catch(() => {})
  }
  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(PREFIX + path, {...init, signal: AbortSignal.any([lifecycle.signal, AbortSignal.timeout(25000)])})
    if (res.status === 404) cleanup()
    if (!res.ok) throw new Error('宿主请求失败')
    return res.json() as Promise<T>
  }
  function visible(): Source[] {return settings.displayMode === 'both' ? SOURCES : [settings.displayMode ?? 'api-key']}
  function money(n: number, currency: Currency, digits = 2): string {
    return (currency === 'CNY' ? '¥' : '$') + (n / SCALE).toFixed(digits)
  }
  function cost(total: ReturnType<typeof totals>, currency: Currency): string {
    return (total.unknown ? '含 ' + total.unknown + ' 次费用未知；已知部分 ' : '') + money(total.low,currency,6) + '–' + money(total.high,currency,6)
  }
  function render(forceExtras = false) {
    if (drag) return
    const lowMessages: string[] = []
    cards.replaceChildren(); mode.value = settings.displayMode ?? 'both'
    image.src = PREFIX + '/characters/' + settings.character + '.png'
    figure.classList.toggle('flipped', settings.flip)
    host.style.transform = 'scale(' + settings.scale + ')'
    for (const source of visible()) {
      const view = snapshot.balances[source]
      const card = document.createElement('article'); card.className = 'card'; card.dataset.source = source
      const label = document.createElement('div'); label.className = 'label'
      const name = document.createElement('strong'); name.textContent = source === 'account' ? '账号登录' : 'API Key'
      label.append(name, button('刷新', () => {void refresh(source)})); card.append(label)
      line(card, view.label, 'sub')
      if (view.status !== 'ready') line(card, view.message, 'failure')
      else for (const wallet of view.wallets) {
        const low = wallet.total < settings.lowBalance[wallet.currency] * SCALE
        line(card, money(wallet.total, wallet.currency) + ' ' + wallet.currency, low ? 'money low' : 'money')
        line(card, '充值 ' + money(wallet.recharge,wallet.currency) + ' · 赠送 ' + money(wallet.bonus,wallet.currency), 'sub')
        const row = rows.find(r => r.day === dayKey() && r.source === source && r.scope === view.scope && r.currency === wallet.currency)
        line(card, row?.observed ? '今日观测下降 ' + money(row.debit,wallet.currency,4) + (row.credit ? ' · 有余额增加，待核对' : '') : '今日尚无余额观测', 'sub')
        if (row) line(card, '本机估算 ' + cost(row.estimate, wallet.currency) + ' · ' + row.estimate.tokens + ' tokens', 'sub')
        const alertId = source + ':' + view.scope + ':' + wallet.currency
        if (low && !alerts.has(alertId)) {alerts.add(alertId); lowMessages.push((source === 'account' ? '账号登录' : 'API Key') + ' 余额偏低：' + money(wallet.total,wallet.currency))}
        if (!low) alerts.delete(alertId)
      }
      if (view.message && view.status === 'ready') line(card,view.message,'sub')
      if (view.updatedAt) line(card,'更新于 ' + new Date(view.updatedAt).toLocaleTimeString(),'sub')
      cards.append(card)
    }
    if (lowMessages.length) {say(lowMessages.join('\n')); sound('alert')}
    renderExtras(forceExtras); place()
  }
  function line(parent: HTMLElement, text: string, className = '') {const d = document.createElement('div'); d.className = className; d.textContent = text; parent.append(d)}
  function renderExtras(force = true) {
    // Polling must not remove a focused input or close an open role picker.
    if (!force && settingsOpen && extras.querySelector('.form')) return
    extras.replaceChildren()
    if (settingsOpen) {
      const form = document.createElement('div'); form.className = 'form'
      function field(label: string, input: HTMLElement) {const l = document.createElement('label'); l.append(document.createTextNode(label),input); form.append(l)}
      const chars = document.createElement('select'); for (const c of CHARACTERS) chars.add(new Option(c.name,c.id)); chars.value = settings.character
      chars.onchange = () => {void update({character: chars.value})}; field('内置角色',chars)
      const flip = document.createElement('input'); flip.type = 'checkbox'; flip.checked = settings.flip; flip.onchange = () => {void update({flip:flip.checked})}; field('镜像角色',flip)
      for (const [key,label,min,max,step] of [['scale','大小',0.6,1.5,0.1], ['volume','音量',0,1,0.1], ['refreshSeconds','刷新间隔（秒）',15,600,15]] as const) {
        const input = document.createElement('input'); input.type = 'number'; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(settings[key])
        input.onchange = () => {void update({[key]: Number(input.value)})}; field(label,input)
      }
      const enabled = document.createElement('input'); enabled.type = 'checkbox'; enabled.checked = settings.sound; enabled.onchange = () => {void update({sound: enabled.checked}).then(() => sound('complete'))}; field('启用音效',enabled)
      for (const currency of ['CNY','USD'] as const) {
        const threshold = document.createElement('input'); threshold.type = 'number'; threshold.min = '0'; threshold.step = '0.1'; threshold.value = String(settings.lowBalance[currency])
        threshold.onchange = () => {void update({lowBalance:{...settings.lowBalance,[currency]:Number(threshold.value)}})}; field(currency + ' 低余额阈值',threshold)
      }
      form.append(button('试听完成音', () => sound('complete')),button('重置位置', () => {void update({x:null,y:null})})); extras.append(form)
    }
    if (historyOpen) {
      const history = document.createElement('div'); history.className = 'history'
      for (const row of rows.slice(0,90)) {
        const item = document.createElement('article')
        line(item,row.day + ' · ' + (row.source === 'account' ? '账号登录' : 'API Key') + ' · ' + row.currency)
        line(item,'账本 ' + row.scope.slice(0,8) + (row.observed ? ' · 观测下降 ' + money(row.debit,row.currency,4) : ' · 无余额观测'),'sub')
        line(item,'本机估算 ' + cost(row.estimate,row.currency),'sub')
        if (row.observed) line(item,'观测从 ' + new Date(row.firstAt).toLocaleTimeString() + ' 开始；余额增加 ' + money(row.credit,row.currency),'sub'); history.append(item)
      }
      if (!rows.length) line(history,'尚无历史记录','sub')
      extras.append(history)
    }
    if (settingsOpen || historyOpen) line(extras,'北京时间日界；观测仅覆盖插件运行期间。费用为峰谷费率区间，并非账单。','note')
    place()
  }
  function place(x = settings.x, y = settings.y) {
    host.style.setProperty('--panel-height', Math.max(80,innerHeight/settings.scale - 172) + 'px')
    const rect = host.getBoundingClientRect()
    const maxX = Math.max(0,innerWidth - rect.width - 8); const maxY = Math.max(0,innerHeight - rect.height - 8)
    host.style.left = Math.max(0,Math.min(x ?? maxX,maxX)) + 'px'; host.style.top = Math.max(0,Math.min(y ?? maxY,maxY)) + 'px'
  }
  async function update(patch: Partial<Settings>): Promise<void> {
    try {settings = await api<Settings>('/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)}); render(true)}
    catch {say('设置保存失败，请检查输入')}
  }
  async function refresh(source: Source): Promise<void> {
    try {snapshot.balances[source] = await api<BalanceView>('/balance?source=' + source); rows = (await api<{rows:Row[]}>('/history')).rows; render()}
    catch {say((source === 'account' ? '账号登录' : 'API Key') + '刷新失败，稍后重试')}
  }
  function completion(item: Completion): string {
    const lines = [item.reason === 'completed' ? '这一轮完成啦！' : '这一轮已结束（中断或失败）']
    for (const source of SOURCES) {
      const calls = item.calls.filter(c => c.source === source); if (!calls.length) continue
      // Display each account scope separately even within a mixed-source turn.
      for (const scope of new Set(calls.map(c => c.scope))) {
        const own = calls.filter(c => c.scope === scope)
        const view = snapshot.balances[source]; const currency = view.scope === scope ? view.wallets[0]?.currency ?? 'CNY' : 'CNY'
        const sum = totals(own,currency)
        lines.push((source === 'account' ? '账号登录' : 'API Key') + ' [' + scope.slice(0,6) + '] ' + sum.tokens + ' tokens\n估算 ' + cost(sum,currency))
      }
    }
    return lines.join('\n')
  }
  let drag: {id:number; startX:number; startY:number; x:number; y:number; moved:boolean} | null = null
  function down(e: PointerEvent) {
    if (e.button !== 0 || (e.target instanceof Element && e.target.closest('button,input,select') && !figure.contains(e.target))) return
    const r = host.getBoundingClientRect(); drag = {id:e.pointerId,startX:e.clientX,startY:e.clientY,x:r.x,y:r.y,moved:false};
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); figure.classList.add('pressed'); sound('press')
  }
  function move(e: PointerEvent) {
    if (!drag || drag.id !== e.pointerId) return
    const dx=e.clientX-drag.startX, dy=e.clientY-drag.startY
    if (Math.abs(dx)+Math.abs(dy)>5) drag.moved=true
    if (drag.moved) place(drag.x+dx,drag.y+dy)
  }
  function up(e: PointerEvent) {
    if (!drag || drag.id!==e.pointerId) return
    const moved=drag.moved; drag=null; figure.classList.remove('pressed'); sound('release')
    if (moved) {
      const r=host.getBoundingClientRect(); let x=r.x,y=r.y
      if(x<35)x=8; if(innerWidth-r.right<35)x=innerWidth-r.width-8
      if(y<35)y=8; if(innerHeight-r.bottom<35)y=innerHeight-r.height-8
      void update({x:Math.max(0,x),y:Math.max(0,y)})
    } else if(figure.contains(e.target as Node)) say(last?completion(last):'你好呀！我会分别看好两个账户的余额。')
  }
  for(const target of [title,figure] as HTMLElement[]) {
    target.addEventListener('pointerdown',down,{signal:lifecycle.signal}); target.addEventListener('pointermove',move,{signal:lifecycle.signal}); target.addEventListener('pointerup',up,{signal:lifecycle.signal})
    target.addEventListener('pointercancel',()=>{drag=null;figure.classList.remove('pressed')},{signal:lifecycle.signal})
  }
  figure.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();say(last?completion(last):'两个来源，分别记账。')}},{signal:lifecycle.signal})
  window.addEventListener('resize',()=>place(),{signal:lifecycle.signal})
  window.addEventListener('pagehide',cleanup,{signal:lifecycle.signal})
  async function tick() {
    try {
      snapshot = await api<Snapshot>('/state'); settings = snapshot.settings
      const history = await api<{rows:Row[]}>('/history'); rows = history.rows
      if (!initialized) {cursor=snapshot.completionSeq; initialized=true}
      const completions = await api<{seq:number;items:Completion[]}>('/completions?after=' + cursor)
      if (completions.items.length) {
        last = completions.items.at(-1) ?? null
        say(completions.items.map(completion).join('\n\n'))
        if (completions.items.some(item => item.reason === 'completed')) sound('complete')
      }
      cursor=completions.seq; render()
    } catch {if (!stopped) say('暂时无法连接 DSH；稍后自动重试')}
    if (!stopped) poll=setTimeout(tick,3000)
  }
  await tick()
}
void mount()
