import {el,button} from './ui.ts'
interface AnimatedDecoder {
  completed:Promise<void>;tracks:{ready:Promise<void>;selectedTrack:{frameCount:number;repetitionCount:number}|null}
  decode(options:{frameIndex:number}):Promise<{image:VideoFrame}>;close():void
}

export const ROLE_CSS=`
.figure{position:absolute;right:0;bottom:0;width:59.45%;height:59.45%;pointer-events:none;transform-origin:center bottom}
.role-art{position:absolute;inset:0;pointer-events:none;transform-origin:bottom center;transition:transform .35s cubic-bezier(.3,1.8,.6,1)}
.figure.pressed .role-art{transform:scale(1.08,.86)}
.role-art img{position:relative;z-index:1;display:block;width:100%;height:100%;object-fit:contain;user-select:none;pointer-events:none}
.role-outline{position:absolute;inset:0;transform:scale(1.04);background:var(--role-outline,#fff);mask:var(--role-mask) center/contain no-repeat;mask-mode:alpha;pointer-events:none;opacity:0}
.figure.hovered .role-outline,.figure.pressed .role-outline,.figure:focus-within .role-outline{opacity:1}
.figure .role-hit,.figure .role-hit:hover,.figure .role-hit:focus-visible{position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;border-radius:0;background:transparent;outline:none;pointer-events:auto;touch-action:none;cursor:grab}
:host(.left) .figure{right:auto;left:0;scale:-1 1}
@media(prefers-reduced-motion:reduce){.role-art{transition:none}}
`

export function roleFigure(){
  const element=el('div','','figure'),art=el('div','','role-art'),outline=el('div','','role-outline'),image=el('img'),hit=button('',()=>{})
  art.hidden=true
  hit.className='role-hit';hit.setAttribute('aria-label','DeepSeek 角色：按压、拖动；右键打开菜单');image.alt='DeepSeek Whale Lite 角色';image.draggable=false
  outline.setAttribute('aria-hidden','true');art.append(outline,image);element.append(art,hit)
  const canvas=el('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d',{willReadFrequently:true})
  let pixels:Uint8ClampedArray|null=null,url='',decoder:AnimatedDecoder|null=null,timer:ReturnType<typeof setTimeout>|undefined,generation=0,controller:AbortController|null=null
  const mask=(url:string)=>element.style.setProperty('--role-mask','url('+JSON.stringify(url)+')')
  function measure(source:CanvasImageSource,width:number,height:number){try{
    if(!ctx)return
    const ratio=Math.min(256/width,256/height),w=width*ratio,h=height*ratio
    ctx.clearRect(0,0,256,256);ctx.drawImage(source,(256-w)/2,(256-h)/2,w,h);pixels=ctx.getImageData(0,0,256,256).data
    const points:[number,number][]=[]
    for(let y=0;y<256;y+=2){let min=256,max=-1;for(let x=0;x<256;x++)if(pixels[(y*256+x)*4+3]>10){min=Math.min(min,x);max=x}if(max>=0)points.push([min,y],[max+1,y+2])}
    points.sort((a,b)=>a[0]-b[0]||a[1]-b[1])
    const cross=(a:number[],b:number[],p:number[])=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])
    const half=(ps:[number,number][])=>{const hull:[number,number][]=[];for(const p of ps){while(hull.length>1&&cross(hull.at(-2)!,hull.at(-1)!,p)<=0)hull.pop();hull.push(p)}return hull.slice(0,-1)}
    const hull=[...half(points),...half([...points].reverse())]
    hit.style.clipPath=hull.length>2?'polygon('+hull.map(([x,y])=>x/256*100+'% '+y/256*100+'%').join(',')+')':''
    art.hidden=false
  }catch{pixels=null;hit.style.clipPath='';art.hidden=false}}
  image.onload=()=>{if(!decoder)measure(image,image.naturalWidth,image.naturalHeight)}
  image.onerror=()=>{pixels=null;hit.style.clipPath='';art.hidden=true;element.classList.remove('hovered');hit.setAttribute('aria-label','角色素材暂不可用；右键打开菜单')}
  function stop(){generation++;controller?.abort();controller=null;clearTimeout(timer);timer=undefined;decoder?.close();decoder=null}
  async function animate(source:string,format:string){
    const Decoder=(globalThis as unknown as {ImageDecoder?:new(options:{data:ArrayBuffer;type:string;preferAnimation:boolean})=>AnimatedDecoder}).ImageDecoder
    if(!Decoder)return
    const own=generation;controller=new AbortController()
    try{const response=await fetch(source,{signal:controller.signal});if(!response.ok)throw new Error('image');const bytes=await response.arrayBuffer();if(own!==generation)return
      const d=new Decoder({data:bytes,type:format==='gif'?'image/gif':'image/png',preferAnimation:true});decoder=d;await d.tracks.ready;await d.completed
      const track=d.tracks.selectedTrack;if(!track||own!==generation)return
      const frameCanvas=el('canvas'),paint=frameCanvas.getContext('2d')!;let frame=0,loops=0
      const advance=async()=>{if(own!==generation)return
        const started=performance.now(),{image:decoded}=await d.decode({frameIndex:frame})
        try{if(own!==generation)return;frameCanvas.width=decoded.displayWidth;frameCanvas.height=decoded.displayHeight;paint.drawImage(decoded,0,0);measure(decoded,decoded.displayWidth,decoded.displayHeight);const data=frameCanvas.toDataURL('image/png');mask(data);image.src=data;art.hidden=false
          const duration=Math.max(20,(decoded.duration??100000)/1000);frame++;if(frame>=track.frameCount){frame=0;loops++;if(track.repetitionCount!==Infinity&&loops>track.repetitionCount)return}
          timer=setTimeout(()=>{void advance().catch(()=>{if(own===generation)image.onerror?.(new Event('error'))})},Math.max(0,duration-(performance.now()-started)))
        }finally{decoded.close()}
      };await advance()
    }catch{if(own===generation){decoder?.close();decoder=null;image.onerror?.(new Event('error'))}}
  }
  function opaque(e:{clientX:number;clientY:number}):boolean{
    if(!pixels)return !art.hidden
    const r=hit.getBoundingClientRect(),mirrored=getComputedStyle(element).scale.startsWith('-1'),x=Math.floor((mirrored?(r.right-e.clientX):(e.clientX-r.left))/r.width*256),y=Math.floor((e.clientY-r.top)/r.height*256)
    return x>=0&&x<256&&y>=0&&y<256&&pixels[(y*256+x)*4+3]>10
  }
  const hover=(e:PointerEvent)=>element.classList.toggle('hovered',opaque(e))
  hit.addEventListener('pointerenter',hover);hit.addEventListener('pointermove',hover);hit.addEventListener('pointerleave',()=>element.classList.remove('hovered'))
  return {element,hit,image,opaque,isVisible:()=>!art.hidden,close:stop,set(source:string,color:string,format='png'){element.style.setProperty('--role-outline',color);if(url!==source){stop();url=source;pixels=null;hit.style.clipPath='';art.hidden=true;mask(source);image.src=source;if(['gif','apng'].includes(format))void animate(source,format)}}}
}
