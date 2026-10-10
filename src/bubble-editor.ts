import {el,button,input,select,field,check,dialog,report} from './ui.ts'
import type {Client} from './ui.ts'
import {MODULE_LABELS,moduleOf,definition,defaultBubbles,parseDefinition,parseModule,parseBubbles,moveModule} from './bubbles.ts'
import type {BubbleConfig,BubbleDefinition,BubbleModule,ModuleType} from './bubbles.ts'
import {BubbleRenderer} from './bubble-view.ts'

// All editor mutations stay in this draft. The preview uses the production renderer.
export function editDefinition(root:ShadowRoot,client:Client,original:BubbleDefinition,save:(draft:BubbleDefinition)=>void,library:BubbleConfig['library']=[]):void {
  let draft=structuredClone(original),drag:{row:number;col:number}|null=null
  const draftLibrary=structuredClone(library)
  const renderer=new BubbleRenderer(),d=dialog(root,'编辑气泡排版',()=>renderer.close()),preview=el('div','','preview'),rows=el('div'),tools=el('div','','tools')
  preview.append(renderer.element);d.body.append(preview,el('p','拖动模块到另一行可合并；拖到“分行”区域可拆开。最多六行，每行六个模块，一张图片独占一行。','muted'),rows,tools)
  const fail=(error:unknown)=>{d.note.textContent=error instanceof Error?error.message:'排版无效';d.note.classList.add('error')}
  const update=(next:BubbleDefinition)=>{try{draft=parseDefinition(next);d.note.textContent='';render()}catch(error){fail(error)}}
  const add=(m:BubbleModule)=>{const next=structuredClone(draft);next.rows.push([m]);update(next)}
  const type=select(Object.entries(MODULE_LABELS), 'text');tools.append(type,button('添加模块',()=>editModule(root,client,moduleOf(type.value as ModuleType),m=>add(m))))
  const lib=select([['','选择模块库'],...draftLibrary.map(l=>[l.id,l.name] as const)],'');tools.append(lib,button('从库添加',()=>{const m=draftLibrary.find(l=>l.id===lib.value)?.module;if(m)add({...structuredClone(m),id:crypto.randomUUID()})}))
  function render(){
    renderer.render(draft,client.context(),'editor');rows.replaceChildren()
    draft.rows.forEach((row,ri)=>{
      const split=el('div','↓ 拖到这里分行','editor-row muted');split.ondragover=e=>e.preventDefault();split.ondrop=e=>{e.preventDefault();if(drag)try{update(moveModule(draft,drag.row,drag.col,ri,0,true))}catch(error){fail(error)}};rows.append(split)
      const line=el('div','','editor-row');line.append(el('span','第 '+(ri+1)+' 行'))
      line.ondragover=e=>e.preventDefault();line.ondrop=e=>{e.preventDefault();if(drag)try{update(moveModule(draft,drag.row,drag.col,ri,row.length))}catch(error){fail(error)}}
      row.forEach((m,ci)=>{
        const chip=button(MODULE_LABELS[m.type]+' · '+(m.text||m.assetId),()=>editModule(root,client,m,next=>{const copy=structuredClone(draft);copy.rows[ri][ci]=next;update(copy)},saved=>{draftLibrary.push({id:crypto.randomUUID(),name:MODULE_LABELS[saved.type]+' · '+(saved.text||saved.assetId).slice(0,25),module:structuredClone(saved)});lib.add(new Option(draftLibrary.at(-1)!.name,draftLibrary.at(-1)!.id));d.note.textContent='已加入当前排版草稿的模块库'}))
        chip.className='chip';chip.draggable=true;chip.ondragstart=()=>{drag={row:ri,col:ci}};chip.ondragend=()=>{drag=null};chip.ondrop=e=>{e.stopPropagation();e.preventDefault();if(drag)try{update(moveModule(draft,drag.row,drag.col,ri,ci))}catch(error){fail(error)}}
        line.append(chip,button('×',()=>{const copy=structuredClone(draft);copy.rows[ri].splice(ci,1);copy.rows=copy.rows.filter(r=>r.length);update(copy)}))
      })
      line.append(button('↑',()=>{if(ri){const copy=structuredClone(draft);[copy.rows[ri-1],copy.rows[ri]]=[copy.rows[ri],copy.rows[ri-1]];update(copy)}}),button('↓',()=>{if(ri<draft.rows.length-1){const copy=structuredClone(draft);[copy.rows[ri+1],copy.rows[ri]]=[copy.rows[ri],copy.rows[ri+1]];update(copy)}}));rows.append(line)
    })
    const end=el('div','↓ 新的一行','editor-row muted');end.ondragover=e=>e.preventDefault();end.ondrop=e=>{e.preventDefault();if(drag)try{update(moveModule(draft,drag.row,drag.col,draft.rows.length,0,true))}catch(error){fail(error)}};rows.append(end)
  }
  d.footer.append(button('取消',d.close),button('保存排版',()=>{try{const parsed=parseDefinition(draft);library.splice(0,library.length,...draftLibrary);save(parsed);d.close()}catch(error){fail(error)}}));render()
}

function editModule(root:ShadowRoot,client:Client,original:BubbleModule,save:(module:BubbleModule)=>void,toLibrary?:(module:BubbleModule)=>void):void {
  const m=structuredClone(original),d=dialog(root,'编辑模块 · '+MODULE_LABELS[m.type]),body=d.body
  const text=el('textarea');text.value=m.text;text.oninput=()=>m.text=text.value
  if(['text','link','random-text','balance','recharge','bonus','today'].includes(m.type)){body.append(field('文字（可用 {value} / {source} / {session} / {amount} / {cost}）',text))}
  if(m.type==='link'){const url=input(m.url);url.oninput=()=>m.url=url.value;body.append(field('链接',url))}
  if(['balance','recharge','bonus','today'].includes(m.type)){
    const source=select([['visible','当前显示来源'],['account','登录账号'],['api-key','API Key']],m.source),currency=select([['auto','各自币种'],['CNY','CNY'],['USD','USD']],m.currency)
    source.onchange=()=>m.source=source.value as BubbleModule['source'];currency.onchange=()=>m.currency=currency.value as BubbleModule['currency'];body.append(field('余额来源',source),field('币种',currency))
  }
  const pictures=client.context().catalog.assets.filter(a=>a.kind!=='audio')
  if(m.type==='image'){const image=select([['','选择图片'],...pictures.map(a=>[a.id,a.name] as const)],m.assetId);image.onchange=()=>m.assetId=image.value;body.append(field('图片／动图',image))}
  if(m.type==='random-text'||m.type==='random-image'){
    const list=el('div');body.append(el('p','权重越大越常出现；同一随机模块连续两次不重复。','muted'),list,button('添加随机项',()=>{m.choices.push({value:m.type==='random-image'?pictures[0]?.id??'':'新语句',weight:1});drawChoices()}))
    function drawChoices(){list.replaceChildren();m.choices.forEach((c,i)=>{const row=el('div','','row'),value=m.type==='random-image'?select(pictures.map(a=>[a.id,a.name] as const),c.value):input(c.value),weight=input(String(c.weight),'number');weight.min='1';weight.max='10000';value.onchange=()=>c.value=value.value;weight.onchange=()=>c.weight=Number(weight.value);row.append(value,field('权重',weight),button('删除',()=>{m.choices.splice(i,1);drawChoices()}));list.append(row)})}drawChoices()
  }
  if(m.type==='session'){const length=input(String(m.length),'number');length.onchange=()=>m.length=Number(length.value);body.append(field('对话名最长字数（0 不截断）',length))}
  if(m.type==='effect'){const effect=select([['pet','拍头（代码动画）'],['coins','金币（代码动画）']],m.effect);effect.onchange=()=>m.effect=effect.value as BubbleModule['effect'];body.append(field('动画',effect))}
  const font=input(m.style.font),size=input(String(m.style.size),'number');font.oninput=()=>m.style.font=font.value;size.min='6';size.max='48';size.onchange=()=>m.style.size=Number(size.value)
  body.append(field('字体',font),field('字号',size))
  const fontList=el('datalist');fontList.id='fonts-'+m.id;for(const name of ['system-ui','sans-serif','serif','monospace','PingFang SC','Microsoft YaHei','Arial']){const option=el('option');option.value=name;fontList.append(option)}font.setAttribute('list',fontList.id);body.append(fontList)
  body.append(button('读取系统字体',()=>{void report(d,async()=>{const win=window as Window&{queryLocalFonts?:()=>Promise<{family:string}[]>};if(!win.queryLocalFonts)throw new Error('当前宿主不支持字体列表，可直接填写系统字体名');for(const family of new Set((await win.queryLocalFonts()).map(f=>f.family))){const option=el('option');option.value=family;fontList.append(option)}d.note.textContent='系统字体已加载'})}))
  for(const [key,label]of [['bold','粗体'],['italic','斜体'],['underline','下划线']] as const)body.append(check(label,m.style[key],v=>m.style[key]=v))
  for(const [key,label]of [['color','文字颜色'],['background','底色（留空为透明）']] as const){const color=input(m.style[key]);color.placeholder='#536ba9';color.oninput=()=>m.style[key]=color.value;body.append(field(label,color))}
  const gradient=select([['none','无'],['rainbow','彩虹'],['macaron','马卡龙'],['bamboo','竹绿']],m.style.gradient);gradient.onchange=()=>m.style.gradient=gradient.value as BubbleModule['style']['gradient'];body.append(field('渐变',gradient))
  if(toLibrary)d.footer.append(button('加入模块库',()=>{try{toLibrary(parseModule(m));d.close()}catch(error){d.note.textContent=(error as Error).message}}));d.footer.append(button('取消',d.close),button('应用到草稿',()=>{try{save(parseModule(m));d.close()}catch(error){d.note.textContent=(error as Error).message}}))
}

export async function openBubbleEditor(root:ShadowRoot,client:Client):Promise<void>{
  let draft=await client.api<BubbleConfig>('/bubbles'),selected=0
  const d=dialog(root,'点击气泡与模块库'),list=el('div'),detail=el('div'),library=el('details','','section');library.append(el('summary','模块库'));d.body.append(el('p','第一项为首次点击与常驻余额；之后按队列播放。并列 A/B 按权重选择；模块中的随机语句和随机图片连续两次不重复。','muted'),list,detail,library)
  function draw(){
    list.replaceChildren();draft.steps.forEach((step,i)=>{const row=el('div','','row'),choose=button((i===0?'首次点击':'队列 '+i)+' · '+step.options.length+' 个选项',()=>{selected=i;draw()});choose.classList.toggle('selected',selected===i);row.append(choose,button('↑',()=>{if(i){[draft.steps[i-1],draft.steps[i]]=[draft.steps[i],draft.steps[i-1]];selected=i-1;draw()}}),button('↓',()=>{if(i<draft.steps.length-1){[draft.steps[i+1],draft.steps[i]]=[draft.steps[i],draft.steps[i+1]];selected=i+1;draw()}}),button('删除',()=>{if(draft.steps.length>1){draft.steps.splice(i,1);selected=Math.min(selected,draft.steps.length-1);draw()}}));list.append(row)})
    list.append(button('添加队列项',()=>{const id=crypto.randomUUID();draft.steps.push({id,options:[{id:crypto.randomUUID(),weight:1,bubble:definition('新气泡')}]});selected=draft.steps.length-1;draw()}));detail.replaceChildren()
    const step=draft.steps[selected];step.options.forEach((o,i)=>{const row=el('div','','section'),weight=input(String(o.weight),'number');weight.onchange=()=>o.weight=Number(weight.value);row.append(el('strong','选项 '+String.fromCharCode(65+i)),field('权重',weight),button('编辑排版与样式',()=>editDefinition(root,client,o.bubble,next=>{o.bubble=next;draw()},draft.library)),button('删除选项',()=>{if(step.options.length>1){step.options.splice(i,1);draw()}}));detail.append(row)});detail.append(button('添加并列选项',()=>{step.options.push({id:crypto.randomUUID(),weight:1,bubble:definition('新选项')});draw()}))
    while(library.children.length>1)library.lastElementChild!.remove();for(const [i,l]of draft.library.entries()){const row=el('div','','row'),name=input(l.name);name.onchange=()=>l.name=name.value;row.append(name,button('编辑',()=>editModule(root,client,l.module,m=>{l.module=m;draw()})),button('删除',()=>{draft.library.splice(i,1);draw()}));library.append(row)}
  }
  d.footer.append(button('恢复默认草稿',()=>{draft={...defaultBubbles(),revision:draft.revision};selected=0;draw()}),button('取消',d.close),button('保存气泡设置',()=>{void report(d,async()=>{await client.api('/bubbles',parseBubbles(draft),'PUT');await client.reload();d.close()})}));draw()
}
