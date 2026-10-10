import {el,input,select,field,check} from './ui.ts'
import type {Settings,SnapProfile} from './shared.ts'

export function snapEditor(draft:Settings):HTMLDetailsElement {
  const section=el('details','','section'),preview=el('div','','snap-preview'),fields=el('div'),unit=select([['px','像素'],['percent','窗口百分比']],draft.snap.unit)
  section.open=true;section.append(el('summary','四边吸附与镜像分界线'),check('启用吸附',draft.snap.enabled,v=>{draft.snap.enabled=v}),field('配置单位（两套分别保存）',unit),preview,fields)
  preview.style.aspectRatio=String(innerWidth/innerHeight);preview.style.width='min(320px,100%)'
  const keys:[keyof SnapProfile,string][]=[['left','左'],['right','右'],['top','上'],['bottom','下'],['flip','镜像分界线']]
  let lines=new Map<keyof SnapProfile,HTMLButtonElement>(),numbers=new Map<keyof SnapProfile,HTMLInputElement>()
  const axis=(key:keyof SnapProfile)=>key==='top'||key==='bottom'?innerHeight:innerWidth
  function value(key:keyof SnapProfile){return draft.snap[draft.snap.unit][key]??Math.round(innerWidth*.15)}
  function reflect(){for(const [key,line] of lines){const val=value(key),percent=draft.snap.unit==='percent'?val:val/axis(key)*100,reverse=key==='right'||key==='bottom',pos=(reverse?100-percent:percent)+'%';line.style[key==='top'||key==='bottom'?'top':'left']=pos;numbers.get(key)!.value=String(Math.round(val*100)/100)}}
  function set(key:keyof SnapProfile,n:number){if(!Number.isFinite(n))return;draft.snap[draft.snap.unit][key]=Math.max(0,Math.min(n,draft.snap.unit==='percent'?100:axis(key)));reflect()}
  function draw(){preview.replaceChildren();fields.replaceChildren();lines=new Map();numbers=new Map()
    for(const [key,label] of keys){const horizontal=key==='top'||key==='bottom',line=el('button','','snap-line '+(horizontal?'horizontal':'vertical')+(key==='flip'?' flip':''));line.type='button';line.setAttribute('aria-label','拖动'+label+(key==='flip'?'':'线'));line.title=label
      let moving=false;line.onpointerdown=e=>{e.preventDefault();moving=true;line.setPointerCapture(e.pointerId)};line.onpointermove=e=>{if(!moving)return;const r=preview.getBoundingClientRect(),fraction=horizontal?(e.clientY-r.top)/r.height:(e.clientX-r.left)/r.width;set(key,(key==='right'||key==='bottom'?1-fraction:fraction)*(draft.snap.unit==='percent'?100:axis(key)))};line.onpointerup=line.onpointercancel=()=>moving=false
      line.onkeydown=e=>{if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(e.key)){e.preventDefault();set(key,value(key)+(['ArrowRight','ArrowDown'].includes(e.key)?1:-1))}}
      const number=input(String(value(key)),'number');number.min='0';number.max=String(draft.snap.unit==='percent'?100:axis(key));number.onchange=()=>set(key,Number(number.value));fields.append(field(label+'（'+(draft.snap.unit==='px'?'px':'%')+'）',number));lines.set(key,line);numbers.set(key,number);preview.append(line)
    }reflect()
  }
  unit.onchange=()=>{draft.snap.unit=unit.value as Settings['snap']['unit'];draw()};draw();return section
}
