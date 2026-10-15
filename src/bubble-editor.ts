import {el,button,input,select,field,check,dialog,report} from './ui.ts'
import type {Client,Dialog} from './ui.ts'
import {MODULE_LABELS,PEAK_OPTIONS,moduleOf,definition,defaultBubbles,parseDefinition,parseModule,parseBubbles,moveModule,moveRow,insertModule} from './bubbles.ts'
import type {BubbleConfig,BubbleDefinition,BubbleModule,ModuleType,ModuleStyle,ModulePaint} from './bubbles.ts'
import {GRADIENT_OPTIONS} from './palettes.ts'
import {BubbleRenderer} from './bubble-view.ts'

// All editor mutations stay in this draft. The preview uses the production renderer.
export function editDefinition(root:ShadowRoot,client:Client,original:BubbleDefinition,save:(draft:BubbleDefinition)=>void,library:BubbleConfig['library']=[],libraryWritable=true):void {
  let draft=structuredClone(original),drag:{kind:'module';row:number;col:number}|{kind:'row';row:number}|{kind:'library';module:BubbleModule}|null=null
  const draftLibrary=structuredClone(library)
  const renderer=new BubbleRenderer(),d=dialog(root,'编辑气泡排版',()=>renderer.close()),preview=el('div','','preview'),rows=el('div'),tools=el('div','','tools')
  preview.append(renderer.element);d.body.append(preview,el('p','拖动模块到另一行可合并；拖到“分行”区域可拆开。最多六行，每行六个模块，一张图片独占一行。','muted'),rows,tools)
  const fail=(error:unknown)=>{d.note.textContent=error instanceof Error?error.message:'排版无效';d.note.classList.add('error')}
  const update=(next:BubbleDefinition)=>{try{draft=parseDefinition(next);d.note.textContent='';render()}catch(error){fail(error)}}
  const add=(m:BubbleModule)=>{const next=structuredClone(draft);next.rows.push([m]);update(next)}
  const drop=(row:number,col:number,newRow=false)=>{if(!drag)return;try{update(drag.kind==='library'?insertModule(draft,drag.module,row,col,newRow):drag.kind==='row'?moveRow(draft,drag.row,row):moveModule(draft,drag.row,drag.col,row,col,newRow));drag=null}catch(error){fail(error)}}
  const type=select(Object.entries(MODULE_LABELS), 'text');tools.append(type,button('添加模块',()=>editModule(root,client,moduleOf(type.value as ModuleType),m=>add(m))))
  const lib=select([['','选择模块库'],...draftLibrary.map(l=>[l.id,l.name] as const)],'');tools.append(lib,button('从库添加',()=>{const m=draftLibrary.find(l=>l.id===lib.value)?.module;if(m)add({...structuredClone(m),id:crypto.randomUUID()})}))
  const palette=el('details','','section');palette.append(el('summary','拖动模块库到气泡排版'));tools.append(palette)
  function drawLibrary(){while(palette.children.length>1)palette.lastElementChild!.remove();for(const l of draftLibrary){const chip=button(l.name,()=>add({...structuredClone(l.module),id:crypto.randomUUID()}));chip.draggable=true;chip.className='chip';chip.ondragstart=e=>{e.stopPropagation();drag={kind:'library',module:l.module};e.dataTransfer?.setData('text/plain',l.name)};chip.ondragend=()=>drag=null;palette.append(chip)}}
  function render(){
    renderer.render(draft,client.context(),'editor');rows.replaceChildren();drawLibrary()
    draft.rows.forEach((row,ri)=>{
      const split=el('div','↓ 拖到这里分行','editor-row muted');split.ondragover=e=>e.preventDefault();split.ondrop=e=>{e.preventDefault();drop(ri,0,true)};rows.append(split)
      const line=el('div','','editor-row'),handle=button('⠿ 第 '+(ri+1)+' 行',()=>{});handle.draggable=true;handle.setAttribute('aria-label','拖动第 '+(ri+1)+' 行');handle.ondragstart=e=>{e.stopPropagation();drag={kind:'row',row:ri};e.dataTransfer?.setData('text/plain','row')};handle.ondragend=()=>drag=null;line.append(handle)
      line.ondragover=e=>e.preventDefault();line.ondrop=e=>{e.preventDefault();drop(ri,row.length)}
      row.forEach((m,ci)=>{
        const saved=(next:BubbleModule)=>{const copy=structuredClone(draft);copy.rows[ri][ci]=next;update(copy)},toLibrary=libraryWritable?(saved:BubbleModule)=>{draftLibrary.push({id:crypto.randomUUID(),name:MODULE_LABELS[saved.type]+' · '+(saved.text||saved.assetId).slice(0,25),module:structuredClone(saved)});lib.add(new Option(draftLibrary.at(-1)!.name,draftLibrary.at(-1)!.id));drawLibrary();d.note.textContent='已加入当前排版草稿的模块库'}:undefined
        const chip=button(MODULE_LABELS[m.type]+' · '+(m.text||m.assetId),()=>editModule(root,client,m,saved,toLibrary,m.type==='text'))
        chip.className='chip';chip.draggable=true;chip.ondragstart=e=>{e.stopPropagation();drag={kind:'module',row:ri,col:ci};e.dataTransfer?.setData('text/plain',m.id)};chip.ondragend=()=>{drag=null};chip.ondrop=e=>{e.stopPropagation();e.preventDefault();drop(ri,ci)}
        line.append(chip,button('×',()=>{const copy=structuredClone(draft);copy.rows[ri].splice(ci,1);copy.rows=copy.rows.filter(r=>r.length);update(copy)}))
      })
      line.append(button('↑',()=>{if(ri){const copy=structuredClone(draft);[copy.rows[ri-1],copy.rows[ri]]=[copy.rows[ri],copy.rows[ri-1]];update(copy)}}),button('↓',()=>{if(ri<draft.rows.length-1){const copy=structuredClone(draft);[copy.rows[ri+1],copy.rows[ri]]=[copy.rows[ri],copy.rows[ri+1]];update(copy)}}));rows.append(line)
    })
    const end=el('div','↓ 新的一行','editor-row muted');end.ondragover=e=>e.preventDefault();end.ondrop=e=>{e.preventDefault();drop(draft.rows.length,0,true)};rows.append(end)
  }
  d.footer.append(button('取消',d.close),button('保存排版',()=>{try{const parsed=parseDefinition(draft);if(libraryWritable)library.splice(0,library.length,...draftLibrary);save(parsed);d.close()}catch(error){fail(error)}}));render()
}

function editModule(root:ShadowRoot,client:Client,original:BubbleModule,save:(module:BubbleModule)=>void,toLibrary?:(module:BubbleModule)=>void,quick=false):void {
  const m=structuredClone(original),renderer=new BubbleRenderer(),d=dialog(root,(quick?'快捷编辑 · ':'编辑模块 · ')+MODULE_LABELS[m.type],()=>renderer.close()),body=d.body,preview=el('div','','preview')
  preview.append(renderer.element);body.append(preview);if(quick)d.card.style.width='min(460px,94vw)'
  const renderPreview=()=>renderer.render({rows:[[m]]},client.context(),'module-preview');body.addEventListener('input',renderPreview);body.addEventListener('change',renderPreview)
  const text=el('textarea');text.value=m.text;text.oninput=()=>m.text=text.value
  if(['text','link','balance','recharge','bonus','today','peak','session','cost'].includes(m.type)){body.append(field('文字模板（{value} / {source} / {session} / {amount} / {cost}；留空自动）',text))}
  if(m.type==='link'){const url=input(m.url);url.oninput=()=>m.url=url.value;body.append(field('链接',url))}
  if(['balance','recharge','bonus','today'].includes(m.type)){
    const source=select([['visible','当前显示来源'],['account','登录账号'],['api-key','API Key']],m.source),currency=select([['auto','各自币种'],['CNY','CNY'],['USD','USD']],m.currency)
    source.onchange=()=>m.source=source.value as BubbleModule['source'];currency.onchange=()=>m.currency=currency.value as BubbleModule['currency'];body.append(field('余额来源',source),field('币种',currency))
  }
  const pictures=client.context().catalog.assets.filter(a=>a.kind!=='audio')
  if(m.type==='image'){const image=select([['','选择图片'],...pictures.map(a=>[a.id,a.name] as const)],m.assetId);image.onchange=()=>m.assetId=image.value;body.append(field('图片／动图',image))}
  if(m.type==='image'||m.type==='random-image'){const scale=input(String(m.imageScale*100),'range');scale.min='10';scale.max='100';const value=el('span',scale.value+'%');scale.oninput=()=>{m.imageScale=Number(scale.value)/100;value.textContent=scale.value+'%'};const row=el('div','','row');row.append(scale,value);body.append(field('图片显示大小',row))}
  if(m.type==='random-text'||m.type==='random-image'){
    const list=el('div');body.append(el('p','权重越大越常出现；同一随机模块连续两次不重复。','muted'),list,button('添加随机项',()=>{m.choices.push({value:m.type==='random-image'?pictures[0]?.id??'':'新语句',weight:1});drawChoices()}))
    let dragged:number|null=null
    function drawChoices(){list.replaceChildren();m.choices.forEach((c,i)=>{const row=el('div','','row'),handle=button('⠿',()=>{}),value=m.type==='random-image'?select(pictures.map(a=>[a.id,a.name] as const),c.value):input(c.value),weight=input(String(c.weight),'number');handle.draggable=true;handle.setAttribute('aria-label','拖动随机项 '+(i+1));handle.ondragstart=e=>{dragged=i;e.dataTransfer?.setData('text/plain',String(i))};handle.ondragend=()=>dragged=null;row.ondragover=e=>e.preventDefault();row.ondrop=e=>{e.preventDefault();if(dragged!==null){const [choice]=m.choices.splice(dragged,1);m.choices.splice(i,0,choice);dragged=null;drawChoices();renderPreview()}};weight.min='1';weight.max='10000';value.onchange=()=>c.value=value.value;weight.onchange=()=>c.weight=Number(weight.value);row.append(handle,value,field('权重',weight),button('复制',()=>{m.choices.splice(i+1,0,structuredClone(c));drawChoices()}),button('↑',()=>{if(i){[m.choices[i-1],m.choices[i]]=[c,m.choices[i-1]];drawChoices()}}),button('↓',()=>{if(i<m.choices.length-1){[m.choices[i+1],m.choices[i]]=[c,m.choices[i+1]];drawChoices()}}),button('删除',()=>{m.choices.splice(i,1);drawChoices();renderPreview()}));if(m.type==='random-text')row.append(button('单句内容与样式',()=>{const sample=moduleOf('text');sample.text=c.value;sample.style=structuredClone(c.style??m.style);editModule(root,client,sample,next=>{c.value=next.text;c.style=next.style;drawChoices();renderPreview()},undefined,true)}));list.append(row)})}drawChoices()
  }
  if(m.type==='session'){const length=input(String(m.length),'number');length.onchange=()=>m.length=Number(length.value);body.append(field('对话名最长字数（0 不截断）',length))}
  if(m.type==='effect'){const effect=select([['pet','拍头（代码动画）'],['coins','金币（代码动画）']],m.effect);effect.onchange=()=>m.effect=effect.value as BubbleModule['effect'];body.append(field('动画',effect))}
  if(m.type==='peak'){const mode=select(PEAK_OPTIONS,m.peakStyle);mode.onchange=()=>m.peakStyle=mode.value as BubbleModule['peakStyle'];body.append(field('本模块峰谷样式',mode));for(const [paint,label]of [[m.peakPaint,'高峰'],[m.offPaint,'空闲']] as const){const group=el('details','','section');group.append(el('summary',label+'配色'));paintFields(group,paint,label);body.append(group)}}
  styleFields(d,m.style)
  if(toLibrary)d.footer.append(button('加入模块库',()=>{try{toLibrary(parseModule(m));d.close()}catch(error){d.note.textContent=(error as Error).message}}));d.footer.append(button('取消',d.close),button('应用到草稿',()=>{try{save(parseModule(m));d.close()}catch(error){d.note.textContent=(error as Error).message}}));renderPreview()
}

function styleFields(d:Dialog,style:ModuleStyle):void {
  const body=d.body,font=input(style.font),size=input(String(style.size),'number');font.oninput=()=>style.font=font.value;size.min='6';size.max='48';size.onchange=()=>style.size=Number(size.value)
  body.append(field('字体',font),field('字号',size))
  const fontList=el('datalist');fontList.id='fonts-'+crypto.randomUUID();for(const name of ['system-ui','sans-serif','serif','monospace','PingFang SC','Microsoft YaHei','Arial']){const option=el('option');option.value=name;fontList.append(option)}font.setAttribute('list',fontList.id);body.append(fontList)
  body.append(button('读取系统字体',()=>{void report(d,async()=>{const win=window as Window&{queryLocalFonts?:()=>Promise<{family:string}[]>};if(!win.queryLocalFonts)throw new Error('当前宿主不支持字体列表，可直接填写系统字体名');for(const family of new Set((await win.queryLocalFonts()).map(f=>f.family))){const option=el('option');option.value=family;fontList.append(option)}d.note.textContent='系统字体已加载'})}))
  for(const [key,label]of [['bold','粗体'],['italic','斜体'],['underline','下划线']] as const)body.append(check(label,style[key],v=>style[key]=v))
  paintFields(body,style)
}
function paintFields(body:HTMLElement,paint:ModulePaint,prefix=''):void {
  for(const [key,label]of [['color','文字颜色'],['background','底色（留空为透明）']] as const){const color=input(paint[key]);color.placeholder='#536ba9';color.oninput=()=>paint[key]=color.value;body.append(field(prefix+label,color))}
  for(const [key,label]of [['gradient','文字渐变'],['backgroundGradient','底色渐变']] as const){const gradient=select(GRADIENT_OPTIONS,paint[key]);gradient.onchange=()=>paint[key]=gradient.value as ModulePaint[typeof key];body.append(field(prefix+label,gradient))}
}

export async function openBubbleEditor(root:ShadowRoot,client:Client):Promise<void>{
  let draft=await client.api<BubbleConfig>('/bubbles'),selected=0
  const d=dialog(root,'点击气泡与模块库'),list=el('div'),detail=el('div'),library=el('details','','section');library.append(el('summary','模块库'));d.body.append(el('p','第一项为首次点击与常驻余额；之后按队列播放。并列 A/B 按权重选择；模块中的随机语句和随机图片连续两次不重复。','muted'),list,detail,library)
  function draw(){
    list.replaceChildren();let dragged:number|null=null;draft.steps.forEach((step,i)=>{const row=el('div','','row'),handle=button('⠿',()=>{}),choose=button((i===0?'首次点击':'队列 '+i)+' · '+step.options.length+' 个选项',()=>{selected=i;draw()});handle.draggable=true;handle.setAttribute('aria-label','拖动队列 '+(i+1));handle.ondragstart=e=>{dragged=i;e.dataTransfer?.setData('text/plain',step.id)};handle.ondragend=()=>dragged=null;row.ondragover=e=>e.preventDefault();row.ondrop=e=>{e.preventDefault();if(dragged!==null){const selectedId=draft.steps[selected].id,[moving]=draft.steps.splice(dragged,1);draft.steps.splice(i,0,moving);selected=draft.steps.findIndex(s=>s.id===selectedId);draw()}};choose.classList.toggle('selected',selected===i);row.append(handle,choose,button('↑',()=>{if(i){[draft.steps[i-1],draft.steps[i]]=[draft.steps[i],draft.steps[i-1]];selected=i-1;draw()}}),button('↓',()=>{if(i<draft.steps.length-1){[draft.steps[i+1],draft.steps[i]]=[draft.steps[i],draft.steps[i+1]];selected=i+1;draw()}}),button('删除',()=>{if(draft.steps.length>1){draft.steps.splice(i,1);selected=Math.min(selected,draft.steps.length-1);draw()}}));list.append(row)})
    list.append(button('添加队列项',()=>{const id=crypto.randomUUID();draft.steps.push({id,options:[{id:crypto.randomUUID(),weight:1,bubble:definition('新气泡')}]});selected=draft.steps.length-1;draw()}));detail.replaceChildren()
    const step=draft.steps[selected];step.options.forEach((o,i)=>{const row=el('div','','section'),weight=input(String(o.weight),'number');weight.onchange=()=>o.weight=Number(weight.value);row.append(el('strong','选项 '+String.fromCharCode(65+i)),field('权重',weight),button('编辑排版与样式',()=>editDefinition(root,client,o.bubble,next=>{o.bubble=next;draw()},draft.library)),button('删除选项',()=>{if(step.options.length>1){step.options.splice(i,1);draw()}}));detail.append(row)});detail.append(button('添加并列选项',()=>{step.options.push({id:crypto.randomUUID(),weight:1,bubble:definition('新选项')});draw()}))
    while(library.children.length>1)library.lastElementChild!.remove();for(const [i,l]of draft.library.entries()){const row=el('div','','row'),name=input(l.name);name.onchange=()=>l.name=name.value;row.append(name,button('编辑',()=>editModule(root,client,l.module,m=>{l.module=m;draw()})),button('删除',()=>{draft.library.splice(i,1);draw()}));library.append(row)}
  }
  d.footer.append(button('恢复默认草稿',()=>{draft={...defaultBubbles(),revision:draft.revision};selected=0;draw()}),button('取消',d.close),button('保存气泡设置',()=>{void report(d,async()=>{await client.api('/bubbles',parseBubbles(draft),'PUT');await client.reload();d.close()})}));draw()
}
