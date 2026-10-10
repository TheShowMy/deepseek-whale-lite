import {el,button} from './ui.ts'
import {bookKey} from './accounting.ts'
import {recentDays,modelLabel,modelShare} from './ledger-stats.ts'
import type {ModelStat} from './ledger-stats.ts'
import type {HistoryRow} from './bubble-view.ts'
import {money,sourceName} from './bubble-view.ts'

export function ledgerCharts(root:HTMLElement,rows:HistoryRow[],measure:'observed'|'estimate',pick:(row:HistoryRow)=>void):void {
  root.replaceChildren();const books=new Map<string,HistoryRow[]>()
  for(const row of rows){const key=bookKey(row.source,row.scope,row.currency);books.set(key,[...(books.get(key)??[]),row])}
  for(const book of books.values()){
    const first=book[0],card=el('details','','section'),overview=el('div'),tip=el('p','悬停查看数值；点击柱子展开当日记录。','chart-tip muted'),chart=el('div','','ledger-chart')
    card.open=true;card.append(el('summary',sourceName(first.source)+' ['+first.scope.slice(0,8)+'] · '+first.currency),overview,tip,chart)
    const total=book.reduce((r,d)=>({observed:r.observed+(d.observed?d.amount:0),low:r.low+d.estimate.low,high:r.high+d.estimate.high,unknown:r.unknown+d.estimate.unknown}),{observed:0,low:0,high:0,unknown:0}),peak=book.filter(d=>d.observed).sort((a,b)=>b.amount-a.amount)[0]
    overview.append(el('p','累计余额下降／校正消费 '+money(total.observed,first.currency,4)+(peak?' · 峰值 '+peak.day+' '+money(peak.amount,first.currency,4):'')),el('p','累计本机估算 '+money(total.low,first.currency,6)+'–'+money(total.high,first.currency,6)+(total.unknown?' · '+total.unknown+' 次费用未知':''),'muted'))
    const days=recentDays(),values=days.map(day=>{const row=book.find(d=>d.day===day);return {day,row,low:measure==='observed'?row?.amount??0:row?.estimate.low??0,high:measure==='observed'?row?.amount??0:row?.estimate.high??0}}),max=Math.max(1,...values.map(v=>v.high))
    values.forEach((v,i)=>{const available=!!v.row&&(measure!=='observed'||v.row.observed),text=v.day+' · '+(available?(measure==='observed'?money(v.high,first.currency,4):money(v.low,first.currency,6)+'–'+money(v.high,first.currency,6)):'暂无数据')+(v.row?.estimate.unknown?' · '+v.row.estimate.unknown+' 次费用未知':''),bar=button('',()=>{if(v.row)pick(v.row)}),track=el('div','','chart-track'),fill=el('div','','chart-fill'),solid=el('div','','chart-solid'),label=el('span',i%5===0||i===29?v.day.slice(5):'','chart-label');bar.className='chart-day';bar.setAttribute('aria-label','查看 '+text);bar.title=text;bar.disabled=!available;fill.style.height=Math.max(1,v.high/max*100)+'%';solid.style.height=(v.high?v.low/v.high*100:0)+'%';fill.append(solid);track.append(fill);bar.append(track,label);bar.onmouseenter=bar.onfocus=()=>tip.textContent=text;bar.onmouseleave=bar.onblur=()=>tip.textContent='悬停查看数值；点击柱子展开当日记录。';chart.append(bar)})
    root.append(card)
  }
  if(!books.size)root.append(el('p','此来源和币种暂无图表数据。','muted'))
}
export function modelCharts(root:HTMLElement,models:ModelStat[],metric:'cost'|'tokens'):void {
  root.replaceChildren();const groups=new Map<string,ModelStat[]>()
  for(const model of models){const key=bookKey(model.source,model.scope,model.currency);groups.set(key,[...(groups.get(key)??[]),model])}
  for(const group of groups.values()){
    const first=group[0],card=el('div','','section'),unknown=group.reduce((n,m)=>n+m.unknown,0);card.append(el('strong',sourceName(first.source)+' ['+first.scope.slice(0,8)+'] · '+first.currency),el('p',metric==='cost'?'已知费用估算占比；区间保留历史计价的不确定性。':'此账本调用的 token 占比。','muted'));if(unknown)card.append(el('p',unknown+' 次费用未知，未计入费用占比。','muted'))
    for(const model of [...group].sort((a,b)=>metric==='cost'?b.high-a.high:b.tokens-a.tokens)){const share=modelShare(model,group,metric),percent=share?(Math.abs(share.high-share.low)<.05?share.low.toFixed(1):share.low.toFixed(1)+'–'+share.high.toFixed(1))+'%':'—',bar=el('div','','model-bar'),solid=el('div','','chart-solid');bar.style.width=(share?.high??0)+'%';solid.style.width=(share?.high?share.low/share.high*100:0)+'%';solid.style.height='100%';bar.append(solid);card.append(el('div',modelLabel(model.model)+' · '+percent+' · '+(metric==='cost'?(model.unknown===model.count?'费用未知':money(model.low,model.currency,6)+'–'+money(model.high,model.currency,6)):model.tokens+' tok')+(model.unknown?' · '+model.unknown+' 次费用未知':'')),bar)}root.append(card)
  }
  if(!models.length)root.append(el('p','没有匹配的模型明细。','muted'))
}
