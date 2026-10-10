import {PREFIX,DEFAULT_SETTINGS,SOURCES} from './shared.ts'
import type {Settings,Notification,BalanceView} from './shared.ts'
import type {BubbleConfig,BubbleDefinition} from './bubbles.ts'
import {ClickQueue,definition} from './bubbles.ts'
import {NotificationQueue,EVENT_LABELS} from './notifications.ts'
import type {Catalog} from './resources.ts'
import {BubbleRenderer,BUBBLE_CSS,money,sourceName} from './bubble-view.ts'
import type {RenderContext,UiSnapshot,HistoryRow} from './bubble-view.ts'
import {el,button,select,field,dialog,report,UI_CSS} from './ui.ts'
import type {Client} from './ui.ts'
import {openBubbleEditor} from './bubble-editor.ts'
import {openAssets} from './asset-manager.ts'
import {openLedger,bookPreferences} from './ledger-view.ts'
import {openSettings} from './settings-view.ts'
import {roleFigure,ROLE_CSS} from './role-figure.ts'
import {AudioPlayer} from './audio.ts'
import {placed,anchorFor,snapPoint,flipBoundary} from './position.ts'
declare global {interface Window {dshDesktop?:unknown;__deepseekWhaleLite?:()=>void}}

export async function mount(desktopOnly=true):Promise<void>{
  if((desktopOnly&&(!window.dshDesktop||location.protocol!=='dsh-app:'||location.hostname!=='app'))||window.__deepseekWhaleLite)return
  const lifecycle=new AbortController(),host=el('div'),portal=el('div'),shadow=host.attachShadow({mode:'open'}),panels=portal.attachShadow({mode:'open'})
  host.id='deepseek-whale-lite';host.style.cssText='position:fixed;z-index:2147483000;width:300px;height:300px;transform-origin:top left;pointer-events:none;background:transparent'
  portal.id='deepseek-whale-lite-panels';portal.style.cssText='position:fixed;inset:0;z-index:2147483001;pointer-events:none'
  const style=el('style');style.textContent=UI_CSS+BUBBLE_CSS+ROLE_CSS+`
  .menu-toggle{position:absolute;right:3px;bottom:125px;z-index:3;pointer-events:auto;opacity:0;transition:opacity .2s}.menu-toggle:focus-visible,:host(:hover) .menu-toggle{opacity:1}:host(.left) .menu-toggle{right:auto;left:3px}.speech-content{cursor:pointer}
  `
  const panelStyle=el('style');panelStyle.textContent=UI_CSS+BUBBLE_CSS+`
  .toast{position:fixed;left:18px;bottom:18px;width:min(380px,90vw);pointer-events:auto;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;box-shadow:0 8px 25px #07133744}.toast button{float:right}`
  shadow.append(style);panels.append(panelStyle);const renderer=new BubbleRenderer(false),role=roleFigure(),figure=role.element,hit=role.hit,menuButton=button('☰',showMenu)
  menuButton.className='menu-toggle';menuButton.setAttribute('aria-label','DeepSeek 挂件菜单');renderer.element.setAttribute('aria-live','polite');shadow.append(renderer.element,figure,menuButton)
  document.body.append(host,portal)
  let stopped=false,settings:Settings=structuredClone(DEFAULT_SETTINGS),snapshot:UiSnapshot,rows:HistoryRow[]=[],catalog:Catalog={assets:[],groups:[]},bubbles:BubbleConfig,cursor=0,initialized=false,poll:ReturnType<typeof setTimeout>|undefined,ttl:ReturnType<typeof setTimeout>|undefined,menu:HTMLElement|null=null,toast:HTMLElement|null=null,toastRenderer:BubbleRenderer|null=null
  let manual:BubbleDefinition|null=null,manualScene=0,lastNotice='',drag:{id:number;x:number;y:number;startX:number;startY:number;moved:boolean}|null=null
  const queue=new ClickQueue(),notifications=new NotificationQueue(),audio=new AudioPlayer(()=>catalog),played=new Set<string>()
  const context=():RenderContext=>({snapshot,rows,catalog,notification:notifications.current??undefined})
  async function api<T>(path:string,body?:unknown,method=body===undefined?'GET':'PUT'):Promise<T>{const response=await fetch(PREFIX+path,{method,signal:lifecycle.signal,headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(response.status===404&&path==='/state'){cleanup();throw new Error('插件已禁用')}const data=await response.json() as T&{error?:string};if(!response.ok)throw new Error(data.error??'请求失败');return data}
  const client:Client={api,context,reload,previewAudio:(id,volume,phase)=>audio.previewAudio(id,volume??settings.volume,phase),stopPreviewAudio:()=>audio.stopPreview(),stopAllAudio:()=>audio.stopAll(),onSilence:cb=>audio.onSilence(cb)}
  function cleanup(){if(stopped)return;stopped=true;lifecycle.abort();if(poll)clearTimeout(poll);if(ttl)clearTimeout(ttl);role.close();renderer.close();toastRenderer?.close();audio.stopAll();for(const close of panels.querySelectorAll<HTMLButtonElement>('.dialog-heading button'))close.click();host.remove();portal.remove();delete window.__deepseekWhaleLite}
  window.__deepseekWhaleLite=cleanup
  function play(id:string,volume:number,release=false){audio.play(id,volume,release?'release':'press')}
  const viewport=()=>({width:innerWidth,height:innerHeight})
  function position(x?:number,y?:number){const p=placed(settings,viewport(),x!==undefined&&y!==undefined?{x,y}:undefined);host.style.transform='scale('+settings.scale+')';host.style.left=p.x+'px';host.style.top=p.y+'px';host.classList.toggle('left',settings.flip||(settings.autoFlip&&p.x<flipBoundary(settings,viewport())));menuButton.hidden=settings.menuButtonHide}
  function draw(){if(!snapshot||!bubbles)return;if(!drag)position();const asset=catalog.assets.find(a=>a.id===settings.character&&a.kind==='role');if(asset)role.set(asset.url,settings.outlineColor,asset.format);const n=notifications.current,cfg=n?settings.events[n.kind]:null
    if(lastNotice&&!n){manual=null;queue.index=-1}
    const def=n&&cfg?.enabled?cfg.content:manual??(settings.stickyBalance?bubbles.steps[0].options[0].bubble:null),visible=settings.bubbleOn&&!!def&&(!n||!!cfg?.bubble)
    renderer.element.classList.toggle('open',visible)
    if(def)renderer.render(def,context(),n?.id??(manual?'manual:'+manualScene:'balance'))
    const notice=n?.id??''
    if(lastNotice!==notice){lastNotice=notice;if(ttl)clearTimeout(ttl);toast?.remove();toast=null;toastRenderer?.close();toastRenderer=null
      if(n&&cfg?.enabled){if(!played.has(n.id)){played.add(n.id);if(played.size>20000)played.delete(played.values().next().value!);void api<{play:boolean}>('/notifications',{id:n.id,action:'claim-sound'}).then(result=>{if(result.play&&!stopped&&notifications.current?.id===n.id&&settings.sound)audio.play(cfg.audio,cfg.volume??settings.volume)}).catch(()=>{played.delete(n.id)})}if(cfg.closeSeconds>0)ttl=setTimeout(advance,cfg.closeSeconds*1000)}
    }
    if(n&&cfg?.enabled&&!visible&&!toast){toast=el('div','','toast');toast.setAttribute('role','status');toast.append(button('关闭',advance),el('strong',EVENT_LABELS[n.kind]));const preview=el('div','','preview');toastRenderer=new BubbleRenderer();preview.append(toastRenderer.element);toast.append(preview);panels.append(toast)}
    if(toastRenderer&&n&&cfg)toastRenderer.render(cfg.content,context(),n.id)
    if((!n||visible)&&toast){toast.remove();toast=null;toastRenderer?.close();toastRenderer=null}
  }
  function advance(){const current=notifications.current;if(current){void api('/notifications',{id:current.id}).catch(()=>{});notifications.next()}else{manual=queue.next(bubbles);manualScene++}draw()}
  renderer.element.onclick=e=>{if(!(e.target instanceof HTMLAnchorElement))advance()}
  renderer.element.oncontextmenu=e=>{e.preventDefault();showMenu()}
  function applySnapshot(state:UiSnapshot){if(settings.sound&&!state.settings.sound)audio.stopAll();snapshot=state;settings=state.settings}
  async function reload(){const [state,history,resources,config]=await Promise.all([api<UiSnapshot>('/state'),api<{rows:HistoryRow[]}>('/history'),api<Catalog>('/resources'),api<BubbleConfig>('/bubbles')]);if(stopped)return;applySnapshot(state);rows=history.rows;catalog=resources;if(bubbles&&config.revision!==bubbles.revision){manual=null;queue.index=-1}bubbles=config;draw()}
  function action(work:()=>Promise<unknown>){void work().catch(error=>{if(stopped)return;const d=dialog(panels,'操作未完成');d.body.append(el('p',error instanceof Error?error.message:'请稍后重试'))})}
  function showMenu(){if(!snapshot)return;menu?.remove();menu=el('div','','menu');menu.setAttribute('aria-label','DeepSeek 挂件菜单');const choices=select([['account','仅登录账号'],['api-key','仅 API Key'],['both','两者同时']],settings.displayMode??'api-key');choices.onchange=()=>action(async()=>{await api('/settings',{displayMode:choices.value});await reload()});menu.append(field('余额显示',choices))
    const close=()=>{menu?.remove();menu=null},run=(work:()=>void)=>()=>{close();work()}
    menu.append(button('余额与来源详情',run(details)),button('分别刷新两个来源',run(()=>action(async()=>{await Promise.all(SOURCES.map(s=>api('/balance?source='+s)));await reload()}))),button('气泡与模块编辑',run(()=>action(()=>openBubbleEditor(panels,client)))),button('余额账本与校正',run(()=>action(()=>openLedger(panels,client)))),button('角色、图片与音效素材',run(()=>action(()=>openAssets(panels,client)))),button('外观、气泡与提醒设置',run(()=>openSettings(panels,client))),el('p','DeepSeek Whale Lite 0.3.0','muted'),button('关闭菜单',close));panels.append(menu);const r=figure.getBoundingClientRect(),width=235,height=menu.getBoundingClientRect().height;menu.style.left=Math.max(8,Math.min(r.left-width-5,innerWidth-width-8))+'px';menu.style.top=Math.max(44,Math.min(r.top,innerHeight-height-8))+'px';menu.querySelector('button')?.focus()}
  function details(){const d=dialog(panels,'两种官方来源 · 分别记账');for(const source of SOURCES){const card=el('div','','section'),v=snapshot.balances[source];card.append(el('strong',sourceName(source)),el('p',v.label),el('p',v.message||'余额可用'),el('p',v.updatedAt?'更新于 '+new Date(v.updatedAt).toLocaleString():'尚未成功刷新','muted'),button('刷新此来源',()=>{void report(d,async()=>{await api<BalanceView>('/balance?source='+source);await reload();d.close();details()})}));for(const w of v.wallets){card.append(el('p',money(w.total,w.currency,4)+' '+w.currency+' · 充值 '+money(w.recharge,w.currency,4)+' · 赠金 '+money(w.bonus,w.currency,4)));const row=rows.find(r=>r.source===source&&r.scope===v.scope&&r.currency===w.currency&&r.observed);if(row)card.append(button(w.currency+' 账本提醒',()=>bookPreferences(panels,client,row)))}d.body.append(card)}d.footer.append(button('关闭',d.close))}
  hit.oncontextmenu=e=>{e.preventDefault();if(!role.isVisible()||role.opaque(e))showMenu()}
  hit.onpointerdown=e=>{if(e.button!==0||!role.opaque(e))return;const r=host.getBoundingClientRect();drag={id:e.pointerId,x:r.left,y:r.top,startX:e.clientX,startY:e.clientY,moved:false};hit.setPointerCapture(e.pointerId);figure.classList.add('pressed');if(settings.sound&&settings.pressSound)play(settings.pressGroup,settings.volume)}
  hit.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;if(Math.abs(dx)+Math.abs(dy)>5)drag.moved=true;if(drag.moved)position(drag.x+dx,drag.y+dy)}
  function finishDrag(cancelled=false){if(!drag)return;const moved=drag.moved;drag=null;figure.classList.remove('pressed');if(!cancelled&&settings.sound&&settings.pressSound)play(settings.pressGroup,settings.volume,true)
    if(moved){const r=host.getBoundingClientRect(),p=snapPoint({x:r.x,y:r.y},settings,viewport());position(p.x,p.y);const anchor=anchorFor(p,settings,viewport());action(async()=>{await api('/settings',{x:p.x,y:p.y,anchor});await reload()})}
    else if(!cancelled)tapRole()
  }
  function tapRole(){if(notifications.current?.pending){if(settings.waitCharClose)advance();return}if(settings.tapAdvance)advance();else{manual=queue.start(bubbles);manualScene++;draw()}}
  hit.onpointerup=e=>{if(drag?.id===e.pointerId)finishDrag()}
  hit.onpointercancel=hit.onlostpointercapture=()=>finishDrag(true)
  window.addEventListener('pointerup',e=>{if(drag?.id===e.pointerId)finishDrag()},{signal:lifecycle.signal})
  window.addEventListener('blur',()=>finishDrag(true),{signal:lifecycle.signal})
  hit.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(e.repeat)return;figure.classList.add('pressed');if(settings.sound&&settings.pressSound)play(settings.pressGroup,settings.volume)}}
  hit.onkeyup=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();figure.classList.remove('pressed');if(settings.sound&&settings.pressSound)play(settings.pressGroup,settings.volume,true);tapRole()}}
  hit.onblur=()=>figure.classList.remove('pressed')
  figure.addEventListener('wheel',e=>{host.hidden=true;let target=document.elementFromPoint(e.clientX,e.clientY);host.hidden=false;while(target?.shadowRoot){const child=target.shadowRoot.elementFromPoint(e.clientX,e.clientY);if(!child||child===target)break;target=child}const amount=e.deltaMode===1?16:e.deltaMode===2?innerHeight:1;while(target instanceof HTMLElement){const css=getComputedStyle(target);if((/(auto|scroll)/.test(css.overflowY)&&target.scrollHeight>target.clientHeight)||target===document.scrollingElement){const before=target.scrollTop;target.scrollTop+=e.deltaY*amount;target.scrollLeft+=e.deltaX*amount;if(target.scrollTop!==before||e.deltaX){e.preventDefault();break}}target=target.parentElement??(target.getRootNode() instanceof ShadowRoot?(target.getRootNode() as ShadowRoot).host:null)}},{passive:false,signal:lifecycle.signal})
  window.addEventListener('resize',()=>{if(initialized&&!drag)position()},{signal:lifecycle.signal})
  window.addEventListener('pagehide',cleanup,{signal:lifecycle.signal});document.addEventListener('pointerdown',e=>{if(menu&&e.composedPath().every(n=>n!==portal&&n!==host)){menu.remove();menu=null}},{signal:lifecycle.signal})
  async function tick(){try{if(!initialized){await reload();const initial=await api<{seq:number;pending:Notification[]}>('/notifications');cursor=initial.seq;for(const n of initial.pending)if(settings.events[n.kind].enabled)notifications.push(n)
      const patch:Partial<Settings>={};if(settings.snap.px.flip===null){settings.snap.px.flip=Math.round(innerWidth*.15);patch.snap=settings.snap}if(settings.anchor===null&&(settings.x!==null||settings.y!==null)){settings.anchor=anchorFor(placed(settings,viewport()),settings,viewport());patch.anchor=settings.anchor}if(Object.keys(patch).length)await api('/settings',patch);initialized=true
    }else{const [state,h,n,cfg]=await Promise.all([api<UiSnapshot>('/state'),api<{rows:HistoryRow[]}>('/history'),api<{seq:number;items:Notification[];pending:Notification[]}>('/notifications?after='+cursor),api<BubbleConfig>('/bubbles')]);applySnapshot(state);rows=h.rows;if(cfg.revision!==bubbles.revision){bubbles=cfg;manual=null;queue.index=-1}notifications.resolved(new Set(n.pending.map(p=>p.id)));for(const item of n.items)if(settings.events[item.kind].enabled&&(!['question','approval'].includes(item.kind)||item.pending))notifications.push(item);cursor=n.seq;while(notifications.current&&!settings.events[notifications.current.kind].enabled)notifications.next()}draw()}catch{if(!stopped&&!initialized){renderer.render(definition('暂时无法连接 DSH\n稍后自动重试'),{snapshot:{settings,balances:{account:{} as BalanceView,'api-key':{} as BalanceView},completionSeq:0,title:'',pricing:{status:'unknown',nextAt:null,calendarYear:2026,holidays:[]}},rows:[],catalog},'error')}}if(!stopped)poll=setTimeout(()=>void tick(),2000)}
  await tick()
}
void mount()
