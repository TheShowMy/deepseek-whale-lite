import {el,button,input,select,field,check,dialog,report} from './ui.ts'
import type {Client,Dialog} from './ui.ts'
import type {Asset,Catalog,SoundGroup,AssetKind} from './resources.ts'

function dataURL(blob:Blob):Promise<string>{return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('读取素材失败'));r.readAsDataURL(blob)})}
export function animatedImage(bytes:Uint8Array):boolean {
  if(new TextDecoder().decode(bytes.subarray(0,6)).startsWith('GIF8'))return true
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let at=8
  if(bytes[0]===137)while(at+12<=bytes.length){const type=new TextDecoder().decode(bytes.subarray(at+4,at+8));if(type==='acTL')return true;if(type==='IDAT')break;const size=view.getUint32(at);if(size>bytes.length-at-12)break;at+=size+12}return false
}
export function waveBlob(buffer:AudioBuffer,start:number,end:number):Blob {
  const channels=Math.min(2,buffer.numberOfChannels),from=Math.floor(start*buffer.sampleRate),length=Math.max(0,Math.min(buffer.length,Math.floor(end*buffer.sampleRate))-from)
  if(!length||from<0)throw new Error('音频片段区间无效')
  if(length*channels*2+44>8*1024*1024)throw new Error('片段超过 8MB，请缩短区间')
  const bytes=new ArrayBuffer(44+length*channels*2),view=new DataView(bytes),str=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i))}
  str(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,length*channels*2,true)
  const data=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));let at=44
  for(let i=from;i<from+length;i++)for(const channel of data){const value=Math.max(-1,Math.min(1,channel[i]));view.setInt16(at,Math.round(value*(value<0?32768:32767)),true);at+=2}return new Blob([bytes],{type:'audio/wav'})
}

async function cropImage(root:ShadowRoot,file:File,save:(blob:Blob,name:string)=>Promise<void>,initialName=file.name):Promise<void>{
  const url=URL.createObjectURL(file),image=new Image();image.src=url
  try{await image.decode()}catch{URL.revokeObjectURL(url);throw new Error('图片无法解码')}
  if(!root.host.isConnected){URL.revokeObjectURL(url);return}
  let zoom=1,x=0,y=0,flipH=false,flipV=false,rotation=0,drag:{x:number;y:number;fromX:number;fromY:number}|null=null
  const d=dialog(root,'静态图片裁剪',()=>URL.revokeObjectURL(url)),canvas=el('canvas','','crop');canvas.width=canvas.height=520;const context=canvas.getContext('2d')!
  const range=input('1','range'),percent=input('100','number'),angle=input('0','number'),name=input(initialName);range.min='.2';range.max='4';range.step='.01';percent.min='20';percent.max='400';percent.step='1';angle.min='-360';angle.max='360';angle.step='1'
  function draw(){range.value=String(zoom);percent.value=String(Math.round(zoom*100));angle.value=String(rotation);context.clearRect(0,0,520,520);const size=520/Math.max(image.width,image.height)*zoom;context.save();context.translate(260+x,260+y);context.rotate(rotation*Math.PI/180);context.scale(flipH?-1:1,flipV?-1:1);context.drawImage(image,-image.width*size/2,-image.height*size/2,image.width*size,image.height*size);context.restore()}
  const setZoom=(value:number)=>{if(Number.isFinite(value))zoom=Math.max(.2,Math.min(4,value));draw()};range.oninput=()=>setZoom(Number(range.value));percent.onchange=()=>setZoom(Number(percent.value)/100);angle.onchange=()=>{rotation=Math.max(-360,Math.min(360,Number(angle.value)||0));draw()}
  canvas.onwheel=e=>{e.preventDefault();const r=canvas.getBoundingClientRect(),px=(e.clientX-r.left)/r.width*520-260,py=(e.clientY-r.top)/r.height*520-260,next=Math.max(.2,Math.min(4,zoom*(e.deltaY<0?1.05:1/1.05))),factor=next/zoom;x=px+(x-px)*factor;y=py+(y-py)*factor;setZoom(next)}
  canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,fromX:x,fromY:y};canvas.setPointerCapture(e.pointerId)};canvas.onpointermove=e=>{if(drag){const scale=520/canvas.getBoundingClientRect().width;x=drag.fromX+(e.clientX-drag.x)*scale;y=drag.fromY+(e.clientY-drag.y)*scale;draw()}};canvas.onpointerup=canvas.onpointercancel=()=>drag=null
  const horizontal=check('水平翻转',false,v=>{flipH=v;draw()}),vertical=check('垂直翻转',false,v=>{flipV=v;draw()})
  d.body.append(canvas,field('缩放；拖动图片定位',range),field('缩放百分比',percent),field('旋转角度',angle),horizontal,vertical,field('素材名称',name),button('向左旋转 90°',()=>{rotation=(rotation-90)%360;draw()}),button('向右旋转 90°',()=>{rotation=(rotation+90)%360;draw()}),button('重置变换',()=>{zoom=1;x=y=rotation=0;flipH=flipV=false;horizontal.querySelector('input')!.checked=vertical.querySelector('input')!.checked=false;draw()}),el('p','滚轮缩放；透明区域会保留，输出为 PNG。','muted'))
  d.footer.append(button('取消',d.close),button('保存裁剪',()=>{void report(d,async()=>{const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('裁剪失败')),'image/png'));await save(blob,name.value);d.close()})}));draw()
}

async function cropAudio(root:ShadowRoot,client:Client,file:File,save:(blob:Blob,name:string)=>Promise<void>,initialName=file.name):Promise<void>{
  if(file.size>50*1024*1024)throw new Error('原音频最多 50MB')
  const context=new AudioContext();let buffer:AudioBuffer
  try{buffer=await context.decodeAudioData(await file.arrayBuffer())}catch{await context.close();throw new Error('当前宿主无法解码此音频')}
  if(!root.host.isConnected){await context.close();return}
  let playbackGeneration=0,start=0,end=Math.min(buffer.duration,5),source:AudioBufferSourceNode|null=null,zoom=1,viewStart=0,drag:{mode:'start'|'end'|'range'|'pan'|'select';x:number;start:number;end:number;view:number;anchor:number}|null=null
  const stop=()=>{playbackGeneration++;if(source){source.onended=null;source.stop();source=null}if(context.state==='running')void context.suspend()},unsubscribe=client.onSilence(stop),d=dialog(root,'波形与音效片段',()=>{stop();unsubscribe();void context.close()}),canvas=el('canvas','','wave');canvas.width=700;canvas.height=110;const paint=canvas.getContext('2d')!,name=input(initialName)
  const a=input('0','number'),b=input(end.toFixed(3),'number');for(const n of [a,b]){n.min='0';n.max=String(buffer.duration);n.step='.01'}
  const magnify=input('1','number'),pan=input('0','range');magnify.min='1';magnify.max='256';magnify.step='.5';pan.min='0';pan.step='.001'
  const samples=buffer.getChannelData(0),block=64,mins=new Float32Array(Math.ceil(samples.length/block)),maxs=new Float32Array(mins.length)
  for(let i=0;i<samples.length;i++){const bucket=Math.floor(i/block);mins[bucket]=Math.min(mins[bucket],samples[i]);maxs[bucket]=Math.max(maxs[bucket],samples[i])}
  function draw(){const span=buffer.duration/zoom;viewStart=Math.max(0,Math.min(viewStart,buffer.duration-span));a.value=start.toFixed(3);b.value=end.toFixed(3);magnify.value=String(zoom);pan.max=String(buffer.duration-span);pan.value=String(viewStart);paint.clearRect(0,0,700,110);paint.fillStyle='#9bb7ec55';paint.fillRect((start-viewStart)/span*700,0,(end-start)/span*700,110);paint.strokeStyle='#536ba9';paint.beginPath()
    for(let x=0;x<700;x++){const from=Math.floor((viewStart+x/700*span)*buffer.sampleRate),to=Math.min(samples.length,Math.max(from+1,Math.floor((viewStart+(x+1)/700*span)*buffer.sampleRate)));let min=0,max=0,i=from;while(i<to){if(i%block===0&&i+block<=to){min=Math.min(min,mins[i/block]);max=Math.max(max,maxs[i/block]);i+=block}else{min=Math.min(min,samples[i]);max=Math.max(max,samples[i]);i++}}paint.moveTo(x,55+min*48);paint.lineTo(x,55+max*48)}paint.stroke();paint.strokeStyle='#d75a67';paint.lineWidth=3
    for(const value of [start,end]){const x=(value-viewStart)/span*700;if(x<0||x>700)continue;paint.beginPath();paint.moveTo(x,0);paint.lineTo(x,110);paint.stroke();paint.fillStyle='#d75a67';paint.fillRect(x-5,0,10,14)}paint.lineWidth=1
  }
  function setZoom(value:number,focus=.5){if(!Number.isFinite(value))return;const anchor=viewStart+buffer.duration/zoom*focus;zoom=Math.max(1,Math.min(256,value));viewStart=anchor-buffer.duration/zoom*focus;draw()}
  magnify.onchange=()=>setZoom(Number(magnify.value));pan.oninput=()=>{viewStart=Number(pan.value);draw()}
  a.onchange=()=>{stop();start=Math.max(0,Math.min(Number(a.value)||0,end-.001));draw()};b.onchange=()=>{stop();end=Math.min(buffer.duration,Math.max(Number(b.value)||0,start+.001));draw()}
  canvas.onwheel=e=>{e.preventDefault();const r=canvas.getBoundingClientRect(),focus=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));if(e.shiftKey){viewStart+=e.deltaY/700*buffer.duration/zoom;draw()}else setZoom(zoom*(e.deltaY<0?1.25:.8),focus)}
  canvas.onpointerdown=e=>{if(e.button!==0&&e.button!==1)return;e.preventDefault();stop();const r=canvas.getBoundingClientRect(),span=buffer.duration/zoom,px=e.clientX-r.left,time=Math.max(0,Math.min(buffer.duration-.001,viewStart+px/r.width*span)),left=(start-viewStart)/span*r.width,right=(end-viewStart)/span*r.width,dl=Math.abs(px-left),dr=Math.abs(px-right),mode=e.shiftKey||e.button===1?'pan':Math.min(dl,dr)<=10?(dl<=dr?'start':'end'):px>left&&px<right?'range':'select';drag={mode,x:e.clientX,start,end,view:viewStart,anchor:time};if(mode==='select'){start=time;end=Math.min(buffer.duration,time+.001)}canvas.setPointerCapture(e.pointerId);draw()}
  canvas.onpointermove=e=>{if(!drag)return;const r=canvas.getBoundingClientRect(),delta=(e.clientX-drag.x)/r.width*buffer.duration/zoom,time=Math.max(0,Math.min(buffer.duration,drag.anchor+delta));if(drag.mode==='pan')viewStart=drag.view-delta;else if(drag.mode==='start')start=Math.max(0,Math.min(drag.start+delta,end-.001));else if(drag.mode==='end')end=Math.min(buffer.duration,Math.max(start+.001,drag.end+delta));else if(drag.mode==='range'){const length=drag.end-drag.start;start=Math.max(0,Math.min(buffer.duration-length,drag.start+delta));end=start+length}else {start=Math.min(drag.anchor,time);end=Math.min(buffer.duration,Math.max(drag.anchor,time,start+.001))}draw()};canvas.onpointerup=canvas.onpointercancel=()=>drag=null
  d.body.append(canvas,field('波形缩放倍数',magnify),field('波形平移',pan),field('开始（秒）',a),field('结束（秒）',b),field('片段名称',name),el('p','拖动红色两端调整区间，拖动区间整体移动；滚轮缩放，Shift 拖动或滚动平移。片段为 WAV，最多 8MB。','muted'),button('显示完整波形',()=>{zoom=1;viewStart=0;draw()}),button('放大所选片段',()=>{zoom=Math.max(1,Math.min(256,buffer.duration/(end-start)*.8));viewStart=(start+end)/2-buffer.duration/zoom/2;draw()}),button('试听片段',()=>{void report(d,async()=>{stop();const own=playbackGeneration;await context.resume();if(own!==playbackGeneration||!d.mask.isConnected)return;const playing=context.createBufferSource();source=playing;playing.buffer=buffer;playing.connect(context.destination);playing.onended=()=>{if(source===playing)source=null};playing.start(0,start,end-start)})}),button('停止',stop))
  d.footer.append(button('取消',d.close),button('保存音效片段',()=>{void report(d,async()=>{await save(waveBlob(buffer,start,end),name.value);d.close()})}));draw()
}

export async function openAssets(root:ShadowRoot,client:Client):Promise<void>{
  let catalog=await client.api<Catalog>('/resources'),kind:AssetKind='role'
  const d=dialog(root,'本机素材与音效组',()=>client.stopPreviewAudio()),tabs=select([['role','角色'],['image','气泡图片／动图'],['audio','音效片段']],kind),list=el('div'),groups=el('div'),file=input('','file'),crop=input('','checkbox'),name=input('')
  const imageTypes='image/png,image/apng,.apng,image/gif,image/jpeg,image/webp'
  file.accept=imageTypes;file.setAttribute('aria-label','导入素材');name.placeholder='素材名称（可选）';crop.checked=true;tabs.onchange=()=>{client.stopPreviewAudio();kind=tabs.value as AssetKind;file.accept=kind==='audio'?'audio/*':imageTypes;draw()}
  async function mutate(body:unknown){catalog=await client.api<Catalog>('/resources',body,'POST');await client.reload();draw()}
  file.onchange=()=>{const selected=file.files?.[0],importKind=kind;if(!selected)return;file.value='';void report(d,async()=>{
    const max=importKind==='role'?20:8;if(importKind!=='audio'&&selected.size>max*1024*1024)throw new Error('图片超过 '+max+'MB')
    const importFile=async(blob:Blob,editedName=name.value||selected.name)=>{await mutate({action:'import',kind:importKind,name:editedName,data:await dataURL(blob)})}
    if(importKind==='audio'){await cropAudio(root,client,selected,importFile,name.value||selected.name);return}
    const bytes=new Uint8Array(await selected.arrayBuffer()),animated=animatedImage(bytes)
    if(crop.checked&&!animated)await cropImage(root,selected,importFile,name.value||selected.name)
    else {if(animated)d.note.textContent='动图将原样保留动画';await importFile(animated&&bytes[0]===137?new Blob([bytes],{type:'image/png'}):selected)}
  })}
  const cropLabel=field('静态图片导入时裁剪',crop);d.body.append(field('资源分类',tabs),field('名称',name),cropLabel,file,el('p','导入只保存在本机插件数据目录。请确认你有使用许可；GIF／APNG 保留原动画。删除只针对自定义素材。','muted'),list,groups)
  function heldPreview(press:()=>string,release:()=>string){const preview=button('按住试听',()=>{});preview.className='sound-preview';preview.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();preview.setPointerCapture(e.pointerId);client.previewAudio(press())};preview.onpointerup=()=>client.previewAudio(release());preview.onpointercancel=preview.onblur=()=>client.stopPreviewAudio();preview.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();if(!e.repeat)client.previewAudio(press())}};preview.onkeyup=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();client.previewAudio(release())}};return preview}
  function editGroup(g?:SoundGroup){const modal=dialog(root,g?'编辑音效组':'新建音效组',()=>client.stopPreviewAudio()),title=input(g?.name??'我的音效组'),options=[['','无声音'],...catalog.assets.filter(a=>a.kind==='audio').map(a=>[a.id,a.name] as const)] as const,press=select(options,g?.press??'press'),release=select(options,g?.release??'release');press.onchange=release.onchange=()=>client.stopPreviewAudio();modal.body.append(field('组名',title),field('按下',press),button('试听按下',()=>client.previewAudio(press.value)),field('释放',release),button('试听释放',()=>client.previewAudio(release.value)),heldPreview(()=>press.value,()=>release.value));modal.footer.append(button('取消',modal.close),button('保存音效组',()=>{void report(modal,async()=>{await mutate({action:'group',id:g?.id,name:title.value,press:press.value,release:release.value});modal.close()})}))}
  function draw(){
    cropLabel.hidden=kind==='audio';list.replaceChildren();groups.replaceChildren()
    for(const asset of catalog.assets.filter(a=>a.kind===kind)){
      const row=el('div','','asset'),tools=el('div','','tools');if(kind!=='audio'){const picture=el('img');picture.src=asset.url;picture.alt=asset.name;row.append(picture)}row.append(el('strong',(asset.pinned?'★ ':'')+asset.name),el('span',asset.format.toUpperCase(),'muted'))
      const recrop=()=>{void report(d,async()=>{const response=await fetch(asset.url);if(!response.ok)throw new Error('素材读取失败');const file=new File([await response.blob()],asset.name,{type:asset.mime}),save=async(blob:Blob,name:string)=>{await mutate({action:'import',kind:asset.kind,name,data:await dataURL(blob)})};if(asset.kind==='audio')await cropAudio(root,client,file,save,asset.name+' · 裁剪');else await cropImage(root,file,save,asset.name+' · 裁剪')})}
      if(kind==='audio')tools.append(button('试听',()=>client.previewAudio(asset.id)),button('裁剪为新片段',recrop))
      else tools.append(button('预览',()=>{const modal=dialog(root,asset.name),image=el('img');image.src=asset.url;image.alt=asset.name;image.style.maxHeight='55vh';modal.body.append(image)}))
      if(kind!=='audio'&&!['gif','apng'].includes(asset.format))tools.append(button('裁剪为新素材',recrop))
      if(kind==='role')tools.append(button('使用',()=>{void report(d,async()=>{await client.api('/settings',{character:asset.id},'PUT');await client.reload()})}))
      if(!asset.builtin){tools.append(button(asset.pinned?'取消置顶':'置顶',()=>{void report(d,()=>mutate({action:'pin',id:asset.id,pinned:!asset.pinned}))}),button('删除',()=>confirmDelete(d,asset.name,()=>mutate({action:'delete',id:asset.id}))))}
      row.append(tools);list.append(row)
    }
    if(kind==='audio'){groups.append(el('h3','按压音效组'),button('新建音效组',()=>editGroup()));for(const g of catalog.groups){const row=el('div','','asset');row.append(el('strong',(g.pinned?'★ ':'')+g.name),button('试听完整组',()=>client.previewAudio(g.id)),heldPreview(()=>g.press,()=>g.release));if(!g.builtin)row.append(button('编辑',()=>editGroup(g)),button(g.pinned?'取消置顶':'置顶',()=>{void report(d,()=>mutate({action:'pin',id:g.id,pinned:!g.pinned}))}),button('删除',()=>confirmDelete(d,g.name,()=>mutate({action:'delete',id:g.id}))));groups.append(row)}}
  }
  d.footer.append(button('关闭',d.close));draw()
}
function confirmDelete(d:Dialog,name:string,remove:()=>Promise<void>):void {d.note.textContent='删除“'+name+'”？';d.footer.replaceChildren(button('取消删除',()=>{d.note.textContent='';d.footer.replaceChildren(button('关闭',d.close))}),button('确认删除',()=>{void report(d,async()=>{await remove();d.note.textContent='';d.footer.replaceChildren(button('关闭',d.close))})}))}
