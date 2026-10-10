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

async function cropImage(root:ShadowRoot,file:File,save:(blob:Blob)=>Promise<void>):Promise<void>{
  const url=URL.createObjectURL(file),image=new Image();image.src=url
  try{await image.decode()}catch{URL.revokeObjectURL(url);throw new Error('图片无法解码')}
  if(!root.host.isConnected){URL.revokeObjectURL(url);return}
  let zoom=1,x=0,y=0,flip=false,drag:{x:number;y:number;fromX:number;fromY:number}|null=null
  const d=dialog(root,'静态图片裁剪',()=>URL.revokeObjectURL(url)),canvas=el('canvas','','crop');canvas.width=canvas.height=520;const context=canvas.getContext('2d')!
  const range=input('1','range');range.min='.2';range.max='4';range.step='.01';range.oninput=()=>{zoom=Number(range.value);draw()}
  function draw(){context.clearRect(0,0,520,520);const size=520/Math.max(image.width,image.height)*zoom;context.save();context.translate(260+x,260+y);context.scale(flip?-1:1,1);context.drawImage(image,-image.width*size/2,-image.height*size/2,image.width*size,image.height*size);context.restore()}
  canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,fromX:x,fromY:y};canvas.setPointerCapture(e.pointerId)};canvas.onpointermove=e=>{if(drag){const scale=520/canvas.getBoundingClientRect().width;x=drag.fromX+(e.clientX-drag.x)*scale;y=drag.fromY+(e.clientY-drag.y)*scale;draw()}};canvas.onpointerup=canvas.onpointercancel=()=>drag=null
  d.body.append(canvas,field('缩放；拖动图片定位',range),check('水平镜像',flip,v=>{flip=v;draw()}),el('p','透明区域会保留；输出为 PNG。','muted'))
  d.footer.append(button('取消',d.close),button('保存裁剪',()=>{void report(d,async()=>{const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('裁剪失败')),'image/png'));await save(blob);d.close()})}));draw()
}

async function cropAudio(root:ShadowRoot,file:File,save:(blob:Blob)=>Promise<void>):Promise<void>{
  if(file.size>50*1024*1024)throw new Error('原音频最多 50MB')
  const context=new AudioContext();let buffer:AudioBuffer
  try{buffer=await context.decodeAudioData(await file.arrayBuffer())}catch{await context.close();throw new Error('当前宿主无法解码此音频')}
  if(!root.host.isConnected){await context.close();return}
  let start=0,end=Math.min(buffer.duration,5),source:AudioBufferSourceNode|null=null,dragging=false
  const stop=()=>{source?.stop();source=null},d=dialog(root,'波形与音效片段',()=>{stop();void context.close()}),canvas=el('canvas','','wave');canvas.width=700;canvas.height=110;const paint=canvas.getContext('2d')!
  const a=input('0','number'),b=input(end.toFixed(3),'number');for(const n of [a,b]){n.min='0';n.max=String(buffer.duration);n.step='.01'}
  function draw(){a.value=start.toFixed(3);b.value=end.toFixed(3);paint.clearRect(0,0,700,110);paint.fillStyle='#9bb7ec55';paint.fillRect(start/buffer.duration*700,0,(end-start)/buffer.duration*700,110);paint.strokeStyle='#536ba9';paint.beginPath();const samples=buffer.getChannelData(0),stride=Math.max(1,Math.floor(samples.length/700));for(let x=0;x<700;x++){let min=0,max=0;for(let i=x*stride;i<Math.min(samples.length,(x+1)*stride);i++){min=Math.min(min,samples[i]);max=Math.max(max,samples[i])}paint.moveTo(x,55+min*48);paint.lineTo(x,55+max*48)}paint.stroke()}
  a.onchange=()=>{start=Math.max(0,Math.min(Number(a.value),end-.001));draw()};b.onchange=()=>{end=Math.min(buffer.duration,Math.max(Number(b.value),start+.001));draw()}
  canvas.onpointerdown=e=>{const r=canvas.getBoundingClientRect();start=Math.max(0,Math.min(buffer.duration-.001,(e.clientX-r.left)/r.width*buffer.duration));end=Math.min(buffer.duration,start+.001);dragging=true;canvas.setPointerCapture(e.pointerId);draw()};canvas.onpointermove=e=>{if(dragging){const r=canvas.getBoundingClientRect();end=Math.min(buffer.duration,Math.max(start+.001,(e.clientX-r.left)/r.width*buffer.duration));draw()}};canvas.onpointerup=canvas.onpointercancel=()=>dragging=false
  d.body.append(canvas,field('开始（秒）',a),field('结束（秒）',b),el('p','拖选波形或填写区间；片段保存为 WAV，最多 8MB。','muted'),button('试听片段',()=>{void report(d,async()=>{stop();await context.resume();source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);source.start(0,start,end-start)})}),button('停止',stop))
  d.footer.append(button('取消',d.close),button('保存音效片段',()=>{void report(d,async()=>{await save(waveBlob(buffer,start,end));d.close()})}));draw()
}

export async function openAssets(root:ShadowRoot,client:Client):Promise<void>{
  let catalog=await client.api<Catalog>('/resources'),kind:AssetKind='role'
  const d=dialog(root,'本机素材与音效组'),tabs=select([['role','角色'],['image','气泡图片／动图'],['audio','音效片段']],kind),list=el('div'),groups=el('div'),file=input('','file'),crop=input('','checkbox'),name=input('')
  file.accept='image/png,image/gif,image/jpeg,image/webp';file.setAttribute('aria-label','导入素材');name.placeholder='素材名称（可选）';crop.checked=true;tabs.onchange=()=>{kind=tabs.value as AssetKind;file.accept=kind==='audio'?'audio/*':'image/png,image/gif,image/jpeg,image/webp';draw()}
  async function mutate(body:unknown){catalog=await client.api<Catalog>('/resources',body,'POST');await client.reload();draw()}
  file.onchange=()=>{const selected=file.files?.[0],importKind=kind;if(!selected)return;file.value='';void report(d,async()=>{
    const max=importKind==='role'?20:8;if(importKind!=='audio'&&selected.size>max*1024*1024)throw new Error('图片超过 '+max+'MB')
    const importFile=async(blob:Blob)=>{await mutate({action:'import',kind:importKind,name:name.value||selected.name,data:await dataURL(blob)})}
    if(importKind==='audio'){await cropAudio(root,selected,importFile);return}
    const animated=animatedImage(new Uint8Array(await selected.arrayBuffer()))
    if(crop.checked&&!animated)await cropImage(root,selected,importFile)
    else {if(animated)d.note.textContent='动图将原样保留动画';await importFile(selected)}
  })}
  const cropLabel=field('静态图片导入时裁剪',crop);d.body.append(field('资源分类',tabs),field('名称',name),cropLabel,file,el('p','导入只保存在本机插件数据目录。请确认你有使用许可；GIF／APNG 保留原动画。删除只针对自定义素材。','muted'),list,groups)
  function editGroup(g?:SoundGroup){const modal=dialog(root,g?'编辑音效组':'新建音效组'),title=input(g?.name??'我的音效组'),options=[['','无声音'],...catalog.assets.filter(a=>a.kind==='audio').map(a=>[a.id,a.name] as const)] as const,press=select(options,g?.press??'press'),release=select(options,g?.release??'release');modal.body.append(field('组名',title),field('按下',press),button('试听按下',()=>client.previewAudio(press.value)),field('释放',release),button('试听释放',()=>client.previewAudio(release.value)));modal.footer.append(button('取消',modal.close),button('保存音效组',()=>{void report(modal,async()=>{await mutate({action:'group',id:g?.id,name:title.value,press:press.value,release:release.value});modal.close()})}))}
  function draw(){
    cropLabel.hidden=kind==='audio';list.replaceChildren();groups.replaceChildren()
    for(const asset of catalog.assets.filter(a=>a.kind===kind)){
      const row=el('div','','asset'),tools=el('div','','tools');if(kind!=='audio'){const picture=el('img');picture.src=asset.url;picture.alt=asset.name;row.append(picture)}row.append(el('strong',(asset.pinned?'★ ':'')+asset.name),el('span',asset.format.toUpperCase(),'muted'))
      const recrop=()=>{void report(d,async()=>{const response=await fetch(asset.url);if(!response.ok)throw new Error('素材读取失败');const file=new File([await response.blob()],asset.name,{type:asset.mime}),save=async(blob:Blob)=>{await mutate({action:'import',kind:asset.kind,name:asset.name+' · 裁剪',data:await dataURL(blob)})};if(asset.kind==='audio')await cropAudio(root,file,save);else await cropImage(root,file,save)})}
      if(kind==='audio')tools.append(button('试听',()=>client.previewAudio(asset.id)),button('裁剪为新片段',recrop))
      else tools.append(button('预览',()=>{const modal=dialog(root,asset.name),image=el('img');image.src=asset.url;image.alt=asset.name;image.style.maxHeight='55vh';modal.body.append(image)}))
      if(kind!=='audio'&&!['gif','apng'].includes(asset.format))tools.append(button('裁剪为新素材',recrop))
      if(kind==='role')tools.append(button('使用',()=>{void report(d,async()=>{await client.api('/settings',{character:asset.id},'PUT');await client.reload()})}))
      if(!asset.builtin){tools.append(button(asset.pinned?'取消置顶':'置顶',()=>{void report(d,()=>mutate({action:'pin',id:asset.id,pinned:!asset.pinned}))}),button('删除',()=>confirmDelete(d,asset.name,()=>mutate({action:'delete',id:asset.id}))))}
      row.append(tools);list.append(row)
    }
    if(kind==='audio'){groups.append(el('h3','按压音效组'),button('新建音效组',()=>editGroup()));for(const g of catalog.groups){const row=el('div','','asset');row.append(el('strong',(g.pinned?'★ ':'')+g.name),button('试听',()=>client.previewAudio(g.id)));if(!g.builtin)row.append(button('编辑',()=>editGroup(g)),button(g.pinned?'取消置顶':'置顶',()=>{void report(d,()=>mutate({action:'pin',id:g.id,pinned:!g.pinned}))}),button('删除',()=>confirmDelete(d,g.name,()=>mutate({action:'delete',id:g.id}))));groups.append(row)}}
  }
  d.footer.append(button('关闭',d.close));draw()
}
function confirmDelete(d:Dialog,name:string,remove:()=>Promise<void>):void {d.note.textContent='删除“'+name+'”？';d.footer.replaceChildren(button('取消删除',()=>{d.note.textContent='';d.footer.replaceChildren(button('关闭',d.close))}),button('确认删除',()=>{void report(d,async()=>{await remove();d.note.textContent='';d.footer.replaceChildren(button('关闭',d.close))})}))}
