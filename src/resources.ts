import {readFileSync,writeFileSync,mkdirSync,existsSync,unlinkSync} from 'node:fs'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {CHARACTERS,PREFIX} from './shared.ts'
import {atomicJson} from './persistence.ts'
export type AssetKind='role'|'image'|'audio'
export interface Asset {id:string;kind:AssetKind;name:string;format:string;mime:string;builtin:boolean;pinned:boolean;createdAt:number;url:string}
export interface SoundGroup {id:string;name:string;press:string;release:string;builtin:boolean;pinned:boolean}
export interface Catalog {assets:Asset[];groups:SoundGroup[]}
const MIME:Record<string,string>={png:'image/png',apng:'image/png',gif:'image/gif',jpg:'image/jpeg',webp:'image/webp',wav:'audio/wav',ogg:'audio/ogg'}
export function sniff(bytes:Buffer):string|null {
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){let at=8;while(at+12<=bytes.length){const size=bytes.readUInt32BE(at),type=bytes.toString('ascii',at+4,at+8);if(type==='acTL')return 'apng';if(type==='IDAT')break;if(size>bytes.length-at-12)break;at+=size+12}return 'png'}
  if(['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6)))return 'gif'
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpg'
  if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'webp'
  if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE'&&bytes.length>=44)return 'wav'
  return null
}
export class ResourceStore {
  dir:string;path:string;custom:Catalog
  constructor(home:string){this.dir=join(home,'deepseek-whale-lite','resources');this.path=join(this.dir,'index.json');this.custom=existsSync(this.path)?JSON.parse(readFileSync(this.path,'utf8')) as Catalog:{assets:[],groups:[]};if(!Array.isArray(this.custom.assets)||!Array.isArray(this.custom.groups))throw new Error('资源索引异常')}
  catalog():Catalog {
    const assets:Asset[]=[...CHARACTERS.map(c=>({id:c.id,kind:'role' as const,name:c.name,format:'png',mime:MIME.png,builtin:true,pinned:false,createdAt:0,url:PREFIX+'/characters/'+c.id+'.png'})),...['press','release','complete','alert'].map((id,index)=>({id,kind:'audio' as const,name:['Kenney · 按下','Kenney · 松开','Kenney · 完成','Kenney · 提醒'][index],format:'ogg',mime:MIME.ogg,builtin:true,pinned:false,createdAt:0,url:PREFIX+'/sounds/'+id+'.ogg'})),...this.custom.assets]
    const groups:SoundGroup[]=[{id:'group-default',name:'Kenney · 默认音效组',press:'press',release:'release',builtin:true,pinned:false},...this.custom.groups]
    return {assets:assets.sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.createdAt-a.createdAt),groups:groups.sort((a,b)=>Number(b.pinned)-Number(a.pinned))}
  }
  asset(id:string):Asset|undefined {return this.catalog().assets.find(a=>a.id===id)}
  binary(id:string):{bytes:Buffer;mime:string} {
    const a=this.asset(id);if(!a)throw Object.assign(new Error('找不到素材'),{status:404})
    const path=a.builtin?new URL('../assets/'+(a.kind==='role'?'characters/':'sounds/')+a.id+'.'+a.format,import.meta.url):join(this.dir,a.id+'.'+a.format)
    return {bytes:readFileSync(path),mime:a.mime}
  }
  mutate(input:unknown):Catalog {
    if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('资源参数无效')
    const v=input as Record<string,unknown>,id=String(v.id??'')
    if(v.action==='import') {
      const kind=v.kind as AssetKind;if(!['role','image','audio'].includes(kind))throw new Error('资源类型无效')
      const data=String(v.data??''),m=/^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(data);if(!m)throw new Error('资源编码无效')
      const bytes=Buffer.from(m[2],'base64'),format=sniff(bytes),max=(kind==='role'?20:8)*1024*1024
      if(!format||!bytes.length||bytes.length>max||MIME[format]!==m[1]||(kind==='audio')!==(format==='wav'))throw new Error('资源格式或大小无效；角色最多 20MB，气泡图片／WAV 片段最多 8MB')
      const id='user-'+randomUUID();mkdirSync(this.dir,{recursive:true,mode:0o700});const path=join(this.dir,id+'.'+format)
      writeFileSync(path,bytes,{mode:0o600});const a:Asset={id,kind,name:String(v.name??'未命名素材').slice(0,80)||'未命名素材',format,mime:MIME[format],builtin:false,pinned:false,createdAt:Date.now(),url:PREFIX+'/asset?id='+id}
      this.custom.assets.push(a);try{atomicJson(this.path,this.custom)}catch(error){this.custom.assets.pop();unlinkSync(path);throw error}return this.catalog()
    }
    const before=structuredClone(this.custom),a=this.custom.assets.find(a=>a.id===id),g=this.custom.groups.find(g=>g.id===id)
    if(v.action==='pin'){if(!a&&!g)throw new Error('只能置顶自定义素材');if(typeof v.pinned!=='boolean')throw new Error('置顶参数无效');(a??g)!.pinned=v.pinned}
    else if(v.action==='delete'){
      if(!a&&!g)throw new Error('不能删除内置素材')
      if(a){this.custom.assets=this.custom.assets.filter(x=>x.id!==id);for(const group of this.custom.groups){if(group.press===id)group.press='';if(group.release===id)group.release=''}}
      if(g)this.custom.groups=this.custom.groups.filter(x=>x.id!==id)
    }else if(v.action==='group'){
      const press=String(v.press??''),release=String(v.release??'');for(const ref of [press,release])if(ref&&this.asset(ref)?.kind!=='audio')throw new Error('音效片段不存在')
      const name=String(v.name??'自定义音效组').slice(0,80)||'自定义音效组'
      if(g){g.name=name;g.press=press;g.release=release}else {if(id)throw new Error('音效组不存在');this.custom.groups.push({id:'group-'+randomUUID(),name,press,release,builtin:false,pinned:false})}
    }else throw new Error('未知资源操作')
    try{atomicJson(this.path,this.custom)}catch(error){this.custom=before;throw error}
    if(v.action==='delete'&&a){const path=join(this.dir,a.id+'.'+a.format);if(existsSync(path))unlinkSync(path)}
    return this.catalog()
  }
}
