import type {Snapshot,Notification,Source,Currency,CallRecord} from './shared.ts'
import {SOURCES} from './shared.ts'
import type {BubbleDefinition,BubbleModule} from './bubbles.ts'
import {weightedPick} from './bubbles.ts'
import type {Catalog} from './resources.ts'
import {SCALE,dayKey,totals} from './accounting.ts'
import type {history} from './accounting.ts'
import type {PricingSnapshot} from './pricing.ts'
import {el} from './ui.ts'
export type HistoryRow=ReturnType<typeof history>[number]
export type UiSnapshot=Snapshot & {pricing:PricingSnapshot;title:string}
export interface RenderContext {snapshot:UiSnapshot;rows:HistoryRow[];catalog:Catalog;notification?:Notification}
export function money(value:number,currency:Currency,digits=2):string{return (currency==='CNY'?'¥':'$')+(value/SCALE).toFixed(digits)}
export function sourceName(source:Source):string{return source==='account'?'账号':'Key'}
export function costText(calls:CallRecord[],currency:Currency):string {const sum=totals(calls,currency);return (sum.unknown?'含 '+sum.unknown+' 次费用未知；已知 ':'')+money(sum.low,currency,6)+'–'+money(sum.high,currency,6)}
export function completionText(n:Notification,ctx:RenderContext):string {
  if(!n.completion)return ''
  const lines:string[]=[]
  for(const source of SOURCES)for(const scope of new Set(n.completion.calls.filter(c=>c.source===source).map(c=>c.scope))){const calls=n.completion.calls.filter(c=>c.source===source&&c.scope===scope),view=ctx.snapshot.balances[source],currencies=view.scope===scope&&view.wallets.length?view.wallets.map(w=>w.currency):['CNY' as const]
    for(const currency of currencies)lines.push(sourceName(source)+' ['+scope.slice(0,6)+'] '+costText(calls,currency)+' · '+totals(calls,currency).tokens+' tok')}
  return lines.join('\n')
}
export function peakText(snapshot:UiSnapshot):string {
  const p=snapshot.pricing,style=snapshot.settings.peakStyle
  const label=p.status==='unknown'?'时段未知（日历待更新）':p.status==='peak'?(style==='playful'?'!?强强?!':'高峰时段'):(style==='playful'?'梁文峰谷':'谷价时段')
  if(style!=='countdown'||!p.nextAt)return label
  const seconds=Math.max(0,Math.ceil((p.nextAt-Date.now())/1000)),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60)
  return label+' · '+hours+'时'+minutes+'分'+(seconds%60)+'秒后切换'
}
// SVG geometry and staggered animation adapted from MeteorNOX/main fce34e3 (MIT).
export const BUBBLE_SVG = `<svg viewBox="0 0 1026 700" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path class="shape" fill="#fff" stroke="#203170" stroke-width="18" stroke-linejoin="round" stroke-linecap="round" d="M 827 248 A 373 232 0 1 0 81 246 A 373 232 0 0 0 301 465 A 57 32 10 0 0 413 484 A 373 232 0 0 0 827 248 Z"/>
<ellipse class="dot1" cx="352" cy="561" rx="37.5" ry="26" fill="#fff" stroke="#203170" stroke-width="18"/>
<ellipse class="dot2" cx="442" cy="646" rx="24.5" ry="18" fill="#fff" stroke="#203170" stroke-width="18"/></svg>`
export const BUBBLE_CSS = `
.speech{position:absolute;inset:0 auto auto 0;width:100%;aspect-ratio:1026/700;pointer-events:none;z-index:2;background:transparent}
.speech svg{display:block;width:100%;height:100%;overflow:visible;pointer-events:none}
.speech .shape,.speech .dot1,.speech .dot2{opacity:0;transform:scale(.7);transform-box:fill-box;transform-origin:50% 50%;transition:opacity .2s,transform .2s}
.speech.open .shape,.speech.open .dot1,.speech.open .dot2{opacity:1;transform:none}
.speech.open .dot1{transition-delay:.13s}.speech.open .shape{transition-delay:.26s}
.speech:not(.open) .shape{transition-delay:.1s}.speech:not(.open) .dot1{transition-delay:.2s}.speech:not(.open) .dot2{transition-delay:.3s}
.speech.open .shape{pointer-events:visiblePainted;cursor:pointer}
.speech-content{position:absolute;left:44.25%;top:36%;width:66%;height:64%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#536ba9;line-height:1.2;opacity:0;overflow:hidden;pointer-events:none;padding:8px}
.speech.open .speech-content{opacity:1;transition:opacity .16s .36s;pointer-events:auto}
.speech-title{font-size:15px;font-weight:700;margin-bottom:7px}.speech-balance{font-size:17px;font-weight:800;margin:3px 0;overflow-wrap:anywhere}.speech-small{font-size:11px;color:#7a8bb5;margin-top:5px}
.left .speech,:host(.left) .speech{transform:scaleX(-1)}.left .speech-content,:host(.left) .speech-content{transform:translate(-50%,-50%) scaleX(-1)}
.speech-lines{max-width:100%;max-height:100%;overflow:auto;scrollbar-width:thin}.bubble-row{display:flex;justify-content:center;align-items:center;gap:4px;flex-shrink:0;margin:2px 0}.module{max-width:100%;white-space:pre-line;overflow-wrap:anywhere}.module img{max-width:170px;max-height:95px;object-fit:contain}.gradient{background-image:linear-gradient(90deg,#e665b5,#77a2ed,#71b6a1,#e665b5);background-size:250% 100%;background-clip:text;-webkit-background-clip:text;color:transparent!important;animation:gradient 5s linear infinite}.gradient.bamboo{background-image:linear-gradient(90deg,#57a165,#a6d09a,#57a165)}.gradient.macaron{background-image:linear-gradient(90deg,#e69aae,#9fafe7,#8ec6c3,#e69aae)}@keyframes gradient{to{background-position:250% 0}}
.pet-effect{position:relative;height:95px;width:110px}.pet-effect img{height:86px;animation:pet 1s ease-in-out infinite;transform-origin:bottom center}.pet-effect span{position:absolute;top:0;right:12px;font-size:30px;animation:hand 1s ease-in-out infinite}@keyframes pet{50%{transform:scale(1.08,.9)}}@keyframes hand{50%{translate:0 6px;rotate:-10deg}}.coin-effect{height:80px;display:flex;gap:6px;align-items:center}.coin-effect span{display:inline-grid;place-items:center;width:28px;height:28px;background:#f6c944;color:#967119;border:3px solid #dba230;border-radius:50%;animation:coin 1.2s ease-in-out infinite}.coin-effect span:nth-child(2){animation-delay:.2s}.coin-effect span:nth-child(3){animation-delay:.4s}@keyframes coin{50%{transform:translateY(-12px) rotateY(180deg)}}
@media(prefers-reduced-motion:reduce){.speech *{transition:none!important;animation:none!important}}
`
export function speech(): {element: HTMLDivElement; content: HTMLDivElement} {
  const element = document.createElement('div'); element.className = 'speech open'
  element.innerHTML = BUBBLE_SVG
  const content = document.createElement('div'); content.className = 'speech-content'; element.append(content)
  return {element, content}
}
export class BubbleRenderer {
  element:HTMLDivElement;content:HTMLDivElement;scene='';private picked=new Map<string,string>();private last=new Map<string,string>();private values=new Map<string,number>();private frames=new Set<number>()
  constructor(initiallyOpen=true){const view=speech();this.element=view.element;this.content=view.content;this.element.classList.toggle('open',initiallyOpen)}
  render(def:BubbleDefinition,ctx:RenderContext,scene:string):void {
    if(scene!==this.scene){this.picked.clear();this.scene=scene}
    for(const frame of this.frames)cancelAnimationFrame(frame);this.frames.clear()
    const lines=el('div','','speech-lines')
    for(const row of def.rows){const r=el('div','','bubble-row');for(const m of row)r.append(this.module(m,ctx));lines.append(r)}
    this.content.replaceChildren(lines)
  }
  module(m:BubbleModule,ctx:RenderContext):HTMLElement {
    const node=el(m.type==='link'?'a':'div','','module'),s=m.style
    node.style.fontFamily=s.font;node.style.fontSize=s.size+'px';node.style.fontWeight=s.bold?'700':'400';node.style.fontStyle=s.italic?'italic':'normal';node.style.textDecoration=s.underline?'underline':'none';node.style.color=s.color;node.style.backgroundColor=s.background
    if(s.gradient!=='none')node.classList.add('gradient',s.gradient)
    const n=ctx.notification,source=n?.source?sourceName(n.source):'',session=n?.title||ctx.snapshot.title
    const replace=(text:string,value='')=>text.replace(/\{(value|cost|source|amount|session)\}/g,(_,key:string)=>({value,cost:n?completionText(n,ctx):'暂无本轮记录',source,amount:n?.amount!==undefined?money(n.amount,n.currency??'CNY'):'—',session}[key]??''))
    if(m.type==='image'||m.type==='random-image'){
      const id=m.type==='image'?m.assetId:this.random(m),asset=ctx.catalog.assets.find(a=>a.id===id&&a.kind!=='audio')
      if(asset){const image=el('img');image.src=asset.url;image.alt=asset.name;image.onerror=()=>{node.textContent='素材加载失败'};node.append(image)}else node.textContent='素材已移除';return node
    }
    if(m.type==='effect'){
      node.classList.add(m.effect==='pet'?'pet-effect':'coin-effect')
      if(m.effect==='pet'){const image=el('img');image.src=ctx.catalog.assets.find(a=>a.id===ctx.snapshot.settings.character)?.url??'';image.alt='拍头动效';node.append(image,el('span','✋'))}else for(let i=0;i<3;i++)node.append(el('span','◆'))
      return node
    }
    if(['balance','recharge','bonus','today'].includes(m.type)){
      const sources=m.source==='visible'?(ctx.snapshot.settings.displayMode==='both'?SOURCES:[ctx.snapshot.settings.displayMode??'api-key']):[m.source]
      for(const source of sources){const view=ctx.snapshot.balances[source],line=el('div')
        const wallets=view.wallets.filter(w=>m.currency==='auto'||w.currency===m.currency)
        if(view.status!=='ready'||!wallets.length)line.textContent=sourceName(source)+' '+(view.status==='ready'?'—':view.message)
        else for(const [i,w] of wallets.entries()){
          if(i)line.append(document.createTextNode(' / '))
          const day=ctx.rows.find(r=>r.day===dayKey()&&r.source===source&&r.scope===view.scope&&r.currency===w.currency&&r.observed)
          const amount=m.type==='today'?day?.amount:m.type==='recharge'?w.recharge:m.type==='bonus'?w.bonus:w.total
          const text=m.text.replaceAll('{source}',sourceName(source)),parts=text.split('{value}')
          for(const [partIndex,part]of parts.entries()){line.append(document.createTextNode(replace(part)));if(partIndex<parts.length-1){const span=el('span');line.append(span);if(amount===undefined)span.textContent='—';else this.number(span,amount,w.currency,m.id+':'+source+':'+view.scope+':'+w.currency)}}
          if(m.currency!=='auto'||wallets.length>1)line.append(document.createTextNode(' '+w.currency))
        }
        node.append(line)
      }return node
    }
    if(m.type==='peak')node.textContent=peakText(ctx.snapshot)
    else if(m.type==='session')node.textContent=m.length>0&&session.length>m.length?session.slice(0,m.length)+'…':session
    else if(m.type==='cost')node.textContent=n?completionText(n,ctx):'暂无本轮记录'
    else node.textContent=replace(m.type==='random-text'?this.random(m):m.text)
    if(m.type==='link'){const link=node as HTMLAnchorElement;link.href=m.url;link.target='_blank';link.rel='noopener noreferrer';link.onclick=e=>e.stopPropagation()}
    return node
  }
  private random(m:BubbleModule):string {
    if(!this.picked.has(m.id)){const unique=new Map<string,number>();for(const c of m.choices)unique.set(c.value,(unique.get(c.value)??0)+c.weight);const choices=[...unique].map(([value,weight])=>({value,weight})),index=weightedPick(choices,c=>c.weight,choices.findIndex(c=>c.value===this.last.get(m.id))),value=choices[index]?.value??'尚未设置随机内容';this.picked.set(m.id,value);this.last.set(m.id,value)}
    return this.picked.get(m.id)!
  }
  private number(span:HTMLElement,target:number,currency:Currency,key:string):void {
    const previous=this.values.get(key)??target;this.values.set(key,target)
    if(previous===target||matchMedia('(prefers-reduced-motion:reduce)').matches){span.textContent=money(target,currency);return}
    const start=performance.now();let frame=0
    const tick=(now:number)=>{this.frames.delete(frame);const progress=Math.min(1,(now-start)/350);span.textContent=money(Math.round(previous+(target-previous)*(1-(1-progress)**3)),currency);if(progress<1){frame=requestAnimationFrame(tick);this.frames.add(frame)}}
    frame=requestAnimationFrame(tick);this.frames.add(frame)
  }
  close():void{for(const frame of this.frames)cancelAnimationFrame(frame);this.frames.clear()}
}
