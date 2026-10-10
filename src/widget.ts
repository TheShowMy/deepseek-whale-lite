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
declare global {interface Window {dshDesktop?:unknown;__deepseekWhaleLite?:()=>void}}

export async function mount(desktopOnly=true):Promise<void>{
  if((desktopOnly&&(!window.dshDesktop||location.protocol!=='dsh-app:'||location.hostname!=='app'))||window.__deepseekWhaleLite)return
  const lifecycle=new AbortController(),host=el('div'),portal=el('div'),shadow=host.attachShadow({mode:'open'}),panels=portal.attachShadow({mode:'open'})
  host.id='deepseek-whale-lite';host.style.cssText='position:fixed;z-index:2147483000;width:300px;height:300px;transform-origin:top left;pointer-events:none;background:transparent'
  portal.id='deepseek-whale-lite-panels';portal.style.cssText='position:fixed;inset:0;z-index:2147483001;pointer-events:none'
  const style=el('style');style.textContent=UI_CSS+BUBBLE_CSS+`
  .figure{position:absolute;right:0;bottom:0;width:59.45%;height:59.45%;padding:0;border:0;background:transparent;pointer-events:auto;touch-action:none;cursor:grab;transform-origin:center bottom}.figure img{display:block;width:100%;height:100%;pointer-events:none;user-select:none;transform-origin:bottom center;transition:transform .35s cubic-bezier(.3,1.8,.6,1)}.figure.pressed img{transform:scale(1.08,.86)}:host(.left) .figure{right:auto;left:0;scale:-1 1}.menu-toggle{position:absolute;right:3px;bottom:125px;z-index:3;pointer-events:auto;opacity:0;transition:opacity .2s}.menu-toggle:focus-visible,:host(:hover) .menu-toggle{opacity:1}:host(.left) .menu-toggle{right:auto;left:3px}.speech-content{cursor:pointer}
  `
  const panelStyle=el('style');panelStyle.textContent=UI_CSS+BUBBLE_CSS+`
  .toast{position:fixed;left:18px;bottom:18px;width:min(380px,90vw);pointer-events:auto;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;box-shadow:0 8px 25px #07133744}.toast button{float:right}`
  shadow.append(style);panels.append(panelStyle);const renderer=new BubbleRenderer(false),figure=button('',()=>{}),image=el('img'),menuButton=button('☰',showMenu)
  figure.className='figure';figure.setAttribute('aria-label','DeepSeek 角色：按压、拖动；右键打开菜单');image.alt='DeepSeek Whale Lite 角色';image.draggable=false;figure.append(image);menuButton.className='menu-toggle';menuButton.setAttribute('aria-label','DeepSeek 挂件菜单');renderer.element.setAttribute('aria-live','polite');shadow.append(renderer.element,figure,menuButton)
  document.body.append(host,portal)
  let stopped=false,settings:Settings=structuredClone(DEFAULT_SETTINGS),snapshot:UiSnapshot,rows:HistoryRow[]=[],catalog:Catalog={assets:[],groups:[]},bubbles:BubbleConfig,cursor=0,initialized=false,poll:ReturnType<typeof setTimeout>|undefined,ttl:ReturnType<typeof setTimeout>|undefined,menu:HTMLElement|null=null,toast:HTMLElement|null=null,toastRenderer:BubbleRenderer|null=null
  let manual:BubbleDefinition|null=null,manualScene=0,lastNotice='',drag:{id:number;x:number;y:number;startX:number;startY:number;moved:boolean}|null=null,viewport={width:innerWidth,height:innerHeight}
  const queue=new ClickQueue(),notifications=new NotificationQueue(),audio=new Set<HTMLAudioElement>(),played=new Set<string>()
  const context=():RenderContext=>({snapshot,rows,catalog,notification:notifications.current??undefined})
  async function api<T>(path:string,body?:unknown,method=body===undefined?'GET':'PUT'):Promise<T>{const response=await fetch(PREFIX+path,{method,signal:lifecycle.signal,headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(response.status===404&&path==='/state'){cleanup();throw new Error('插件已禁用')}const data=await response.json() as T&{error?:string};if(!response.ok)throw new Error(data.error??'请求失败');return data}
  const client:Client={api,context,reload,previewAudio:(id,volume)=>play(id,volume??settings.volume)}
  function cleanup(){if(stopped)return;stopped=true;lifecycle.abort();if(poll)clearTimeout(poll);if(ttl)clearTimeout(ttl);renderer.close();toastRenderer?.close();for(const a of audio){a.pause();a.removeAttribute('src');a.load()}audio.clear();for(const close of panels.querySelectorAll<HTMLButtonElement>('.dialog-heading button'))close.click();host.remove();portal.remove();delete window.__deepseekWhaleLite}
  window.__deepseekWhaleLite=cleanup
  function play(id:string,volume:number,release=false){const group=catalog.groups.find(g=>g.id===id);if(group)id=release?group.release:group.press;const asset=catalog.assets.find(a=>a.id===id&&a.kind==='audio');if(!asset)return;const a=new Audio(asset.url);a.volume=Math.max(0,Math.min(1,volume));audio.add(a);const done=()=>audio.delete(a);a.onended=a.onerror=done;void a.play().catch(done)}
  function position(x=settings.x,y=settings.y){const size=300*settings.scale,top=44,maxX=Math.max(0,innerWidth-size-settings.scrollGap-8),maxY=Math.max(top,innerHeight-size-8);host.style.transform='scale('+settings.scale+')';host.style.left=Math.max(0,Math.min(x??maxX,maxX))+'px';host.style.top=Math.max(top,Math.min(y??maxY,maxY))+'px';host.classList.toggle('left',settings.flip||(settings.autoFlip&&Number.parseFloat(host.style.left)<Math.max(20,innerWidth*.15)));menuButton.hidden=settings.menuButtonHide}
  function draw(){if(!snapshot||!bubbles)return;if(!drag)position();const asset=catalog.assets.find(a=>a.id===settings.character&&a.kind==='role');if(asset&&image.getAttribute('src')!==asset.url){figure.style.clipPath='';image.hidden=false;image.src=asset.url}const n=notifications.current,cfg=n?settings.events[n.kind]:null
    if(lastNotice&&!n){manual=null;queue.index=-1}
    const def=n&&cfg?.enabled?cfg.content:manual??(settings.stickyBalance?bubbles.steps[0].options[0].bubble:null),visible=settings.bubbleOn&&!!def&&(!n||!!cfg?.bubble)
    renderer.element.classList.toggle('open',visible)
    if(def)renderer.render(def,context(),n?.id??(manual?'manual:'+manualScene:'balance'))
    const notice=n?.id??''
    if(lastNotice!==notice){lastNotice=notice;if(ttl)clearTimeout(ttl);toast?.remove();toast=null;toastRenderer?.close();toastRenderer=null
      if(n&&cfg?.enabled){if(!played.has(n.id)){played.add(n.id);if(played.size>20000)played.delete(played.values().next().value!);if(settings.sound&&cfg.sound)play(cfg.audio,cfg.volume??settings.volume)}if(cfg.closeSeconds>0)ttl=setTimeout(advance,cfg.closeSeconds*1000)}
    }
    if(n&&cfg?.enabled&&!visible&&!toast){toast=el('div','','toast');toast.setAttribute('role','status');toast.append(button('关闭',advance),el('strong',EVENT_LABELS[n.kind]));const preview=el('div','','preview');toastRenderer=new BubbleRenderer();preview.append(toastRenderer.element);toast.append(preview);panels.append(toast)}
    if(toastRenderer&&n&&cfg)toastRenderer.render(cfg.content,context(),n.id)
    if((!n||visible)&&toast){toast.remove();toast=null;toastRenderer?.close();toastRenderer=null}
  }
  function advance(){const current=notifications.current;if(current){void api('/notifications',{id:current.id}).catch(()=>{});notifications.next()}else{manual=queue.next(bubbles);manualScene++}draw()}
  renderer.element.onclick=e=>{if(!(e.target instanceof HTMLAnchorElement))advance()}
  renderer.element.oncontextmenu=e=>{e.preventDefault();showMenu()}
  async function reload(){const [state,history,resources,config]=await Promise.all([api<UiSnapshot>('/state'),api<{rows:HistoryRow[]}>('/history'),api<Catalog>('/resources'),api<BubbleConfig>('/bubbles')]);if(stopped)return;snapshot=state;settings=state.settings;rows=history.rows;catalog=resources;bubbles=config;draw()}
  function action(work:()=>Promise<unknown>){void work().catch(error=>{if(stopped)return;const d=dialog(panels,'操作未完成');d.body.append(el('p',error instanceof Error?error.message:'请稍后重试'))})}
  function showMenu(){if(!snapshot)return;menu?.remove();menu=el('div','','menu');menu.setAttribute('aria-label','DeepSeek 挂件菜单');const choices=select([['account','仅登录账号'],['api-key','仅 API Key'],['both','两者同时']],settings.displayMode??'api-key');choices.onchange=()=>action(async()=>{await api('/settings',{displayMode:choices.value});await reload()});menu.append(field('余额显示',choices))
    const close=()=>{menu?.remove();menu=null},run=(work:()=>void)=>()=>{close();work()}
    menu.append(button('余额与来源详情',run(details)),button('分别刷新两个来源',run(()=>action(async()=>{await Promise.all(SOURCES.map(s=>api('/balance?source='+s)));await reload()}))),button('气泡与模块编辑',run(()=>action(()=>openBubbleEditor(panels,client)))),button('余额账本与校正',run(()=>action(()=>openLedger(panels,client)))),button('角色、图片与音效素材',run(()=>action(()=>openAssets(panels,client)))),button('外观、气泡与提醒设置',run(()=>openSettings(panels,client))),button('关闭菜单',close));panels.append(menu);const r=figure.getBoundingClientRect(),width=235,height=menu.getBoundingClientRect().height;menu.style.left=Math.max(8,Math.min(r.left-width-5,innerWidth-width-8))+'px';menu.style.top=Math.max(44,Math.min(r.top,innerHeight-height-8))+'px';menu.querySelector('button')?.focus()}
  function details(){const d=dialog(panels,'两种官方来源 · 分别记账');for(const source of SOURCES){const card=el('div','','section'),v=snapshot.balances[source];card.append(el('strong',sourceName(source)),el('p',v.label),el('p',v.message||'余额可用'),el('p',v.updatedAt?'更新于 '+new Date(v.updatedAt).toLocaleString():'尚未成功刷新','muted'),button('刷新此来源',()=>{void report(d,async()=>{await api<BalanceView>('/balance?source='+source);await reload();d.close();details()})}));for(const w of v.wallets){card.append(el('p',money(w.total,w.currency,4)+' '+w.currency+' · 充值 '+money(w.recharge,w.currency,4)+' · 赠金 '+money(w.bonus,w.currency,4)));const row=rows.find(r=>r.source===source&&r.scope===v.scope&&r.currency===w.currency&&r.observed);if(row)card.append(button(w.currency+' 账本提醒',()=>bookPreferences(panels,client,row)))}d.body.append(card)}d.footer.append(button('关闭',d.close))}
  figure.oncontextmenu=e=>{e.preventDefault();showMenu()}
  figure.onpointerdown=e=>{if(e.button!==0)return;const r=host.getBoundingClientRect();drag={id:e.pointerId,x:r.left,y:r.top,startX:e.clientX,startY:e.clientY,moved:false};figure.setPointerCapture(e.pointerId);figure.classList.add('pressed');if(settings.sound)play(settings.pressGroup,settings.volume)}
  figure.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;if(Math.abs(dx)+Math.abs(dy)>5)drag.moved=true;if(drag.moved)position(drag.x+dx,drag.y+dy)}
  function finishDrag(cancelled=false){if(!drag)return;const moved=drag.moved;drag=null;figure.classList.remove('pressed');if(!cancelled&&settings.sound)play(settings.pressGroup,settings.volume,true)
    if(moved){const r=host.getBoundingClientRect(),snap=settings.snap,px=(side:'top'|'right'|'bottom'|'left')=>snap[side]*(snap.unit==='px'?1:(side==='top'||side==='bottom'?innerHeight:innerWidth)/100);let x=r.x,y=r.y;if(snap.enabled){if(x<px('left'))x=0;else if(innerWidth-settings.scrollGap-r.right<px('right'))x=innerWidth-settings.scrollGap-r.width-8;if(y-44<px('top'))y=44;else if(innerHeight-r.bottom<px('bottom'))y=innerHeight-r.height-8}position(x,y);action(async()=>{await api('/settings',{x:Number.parseFloat(host.style.left),y:Number.parseFloat(host.style.top)});await reload()})}
    else if(!cancelled){if(settings.tapAdvance)advance();else{manual=queue.start(bubbles);manualScene++;draw()}}
  }
  figure.onpointerup=e=>{if(drag?.id===e.pointerId)finishDrag()}
  figure.onpointercancel=figure.onlostpointercapture=()=>finishDrag(true)
  window.addEventListener('pointerup',e=>{if(drag?.id===e.pointerId)finishDrag()},{signal:lifecycle.signal})
  window.addEventListener('blur',()=>finishDrag(true),{signal:lifecycle.signal})
  figure.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(settings.tapAdvance)advance();else{manual=queue.start(bubbles);manualScene++;draw()}}}
  // The alpha outline keeps the large transparent PNG margins click-through.
  image.onload=()=>{try{const c=el('canvas');c.width=c.height=64;const ctx=c.getContext('2d')!;ctx.drawImage(image,0,0,64,64);const data=ctx.getImageData(0,0,64,64).data,points:[number,number][]=[];for(let y=0;y<64;y++){let min=64,max=-1;for(let x=0;x<64;x++)if(data[(y*64+x)*4+3]>32){min=Math.min(min,x);max=x}if(max>=0){points.push([min,y],[max+1,y+1])}}points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cross=(a:number[],b:number[],p:number[])=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]),half=(ps:[number,number][])=>{const h:[number,number][]=[];for(const p of ps){while(h.length>1&&cross(h.at(-2)!,h.at(-1)!,p)<=0)h.pop();h.push(p)}return h.slice(0,-1)},hull=[...half(points),...half([...points].reverse())];if(hull.length>2)figure.style.clipPath='polygon('+hull.map(([x,y])=>x/64*100+'% '+y/64*100+'%').join(',')+')'}catch{/* Asset failure must not block the host. */}}
  image.onerror=()=>{figure.style.clipPath='';image.hidden=true;figure.setAttribute('aria-label','角色素材暂不可用；右键打开菜单')}
  window.addEventListener('resize',()=>{if(!initialized||drag){viewport={width:innerWidth,height:innerHeight};return}const r=host.getBoundingClientRect(),right=viewport.width-r.right,bottom=viewport.height-r.bottom,x=r.x<right?r.x:innerWidth-r.width-right,y=r.y<bottom?r.y:innerHeight-r.height-bottom;viewport={width:innerWidth,height:innerHeight};settings.x=Math.max(0,x);settings.y=Math.max(44,y);position();action(async()=>{await api('/settings',{x:Number.parseFloat(host.style.left),y:Number.parseFloat(host.style.top)})})},{signal:lifecycle.signal})
  window.addEventListener('pagehide',cleanup,{signal:lifecycle.signal});document.addEventListener('pointerdown',e=>{if(menu&&e.composedPath().every(n=>n!==portal&&n!==host)){menu.remove();menu=null}},{signal:lifecycle.signal})
  async function tick(){try{if(!initialized){await reload();const initial=await api<{seq:number;pending:Notification[]}>('/notifications');cursor=initial.seq;for(const n of initial.pending)if(settings.events[n.kind].enabled)notifications.push(n);initialized=true}else{const [state,h,n,cfg]=await Promise.all([api<UiSnapshot>('/state'),api<{rows:HistoryRow[]}>('/history'),api<{seq:number;items:Notification[];pending:Notification[]}>('/notifications?after='+cursor),api<BubbleConfig>('/bubbles')]);snapshot=state;settings=state.settings;rows=h.rows;if(cfg.revision!==bubbles.revision){bubbles=cfg;manual=null;queue.index=-1}notifications.resolved(new Set(n.pending.map(p=>p.id)));for(const item of n.items)if(settings.events[item.kind].enabled&&(!['question','approval'].includes(item.kind)||item.pending))notifications.push(item);cursor=n.seq;while(notifications.current&&!settings.events[notifications.current.kind].enabled)notifications.next()}draw()}catch{if(!stopped&&!initialized){renderer.render(definition('暂时无法连接 DSH\n稍后自动重试'),{snapshot:{settings,balances:{account:{} as BalanceView,'api-key':{} as BalanceView},completionSeq:0,title:'',pricing:{status:'unknown',nextAt:null,calendarYear:2026,holidays:[]}},rows:[],catalog},'error')}}if(!stopped)poll=setTimeout(()=>void tick(),2000)}
  await tick()
}
void mount()
