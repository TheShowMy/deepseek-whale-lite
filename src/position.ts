import type {Settings,PositionAnchor} from './shared.ts'
export interface Viewport {width:number;height:number}
export interface Point {x:number;y:number}
export function bounds(settings:Settings,v:Viewport){const size=300*settings.scale;return {left:0,top:44,right:Math.max(0,v.width-size-settings.scrollGap-8),bottom:Math.max(44,v.height-size-8)}}
export function placed(settings:Settings,v:Viewport,point?:Point):Point {
  const b=bounds(settings,v),a=settings.anchor
  const p=point??(a?{x:a.horizontal==='left'?a.x:b.right-a.x,y:a.vertical==='top'?b.top+a.y:b.bottom-a.y}:{x:settings.x??b.right,y:settings.y??b.bottom})
  return {x:Math.max(b.left,Math.min(p.x,b.right)),y:Math.max(b.top,Math.min(p.y,b.bottom))}
}
export function anchorFor(point:Point,settings:Settings,v:Viewport):PositionAnchor {
  const b=bounds(settings,v),left=point.x<=b.right-point.x,top=point.y-b.top<=b.bottom-point.y
  return {horizontal:left?'left':'right',vertical:top?'top':'bottom',x:Math.max(0,left?point.x:b.right-point.x),y:Math.max(0,top?point.y-b.top:b.bottom-point.y)}
}
export function snapPoint(point:Point,settings:Settings,v:Viewport):Point {
  const b=bounds(settings,v),p=placed(settings,v,point),s=settings.snap
  if(!s.enabled)return p
  const px=(side:'top'|'right'|'bottom'|'left')=>s[s.unit][side]*(s.unit==='px'?1:(side==='top'||side==='bottom'?v.height:v.width)/100)
  return {x:p.x<px('left')?0:b.right-p.x<px('right')?b.right:p.x,y:p.y-b.top<px('top')?b.top:b.bottom-p.y<px('bottom')?b.bottom:p.y}
}
export function flipBoundary(settings:Settings,v:Viewport):number{return settings.snap.unit==='percent'?(settings.snap.percent.flip??15)/100*v.width:settings.snap.px.flip??v.width*.15}
