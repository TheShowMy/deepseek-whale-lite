import type {Catalog} from './resources.ts'

export interface Playback {stop():void}
export class AudioPlayer {
  private playing=new Set<Playback>();private preview:Playback|null=null
  private silence=new Set<()=>void>()
  private catalog:()=>Catalog;private create:(url:string)=>HTMLAudioElement
  constructor(catalog:()=>Catalog,create=(url:string)=>new Audio(url)){this.catalog=catalog;this.create=create}
  onSilence(callback:()=>void):()=>void{this.silence.add(callback);return()=>{this.silence.delete(callback)}}
  play(id:string,volume:number,phase?:'press'|'release'):Playback {
    const catalog=this.catalog(),group=catalog.groups.find(g=>g.id===id),ids=group?(phase?[group[phase]]:[group.press,group.release]):[id]
    let stopped=false,current:HTMLAudioElement|null=null,finish:(()=>void)|null=null
    const playback:Playback={stop:()=>{if(stopped)return;stopped=true;if(current){current.onended=current.onerror=null;current.pause();current.removeAttribute('src');current.load()}finish?.();this.playing.delete(playback)}}
    this.playing.add(playback)
    void (async()=>{for(const clip of ids){if(stopped)break;const asset=catalog.assets.find(a=>a.id===clip&&a.kind==='audio');if(!asset)continue
      await new Promise<void>(resolve=>{const audio=this.create(asset.url);current=audio;audio.volume=Math.max(0,Math.min(1,volume));const done=()=>{audio.onended=audio.onerror=null;if(current===audio){current=null;finish=null}resolve()};finish=done;audio.onended=audio.onerror=done;void audio.play().catch(done)})
    }this.playing.delete(playback)})()
    return playback
  }
  previewAudio(id:string,volume:number,phase?:'press'|'release'):Playback{this.stopPreview();return this.preview=this.play(id,volume,phase)}
  stopPreview():void{this.preview?.stop();this.preview=null}
  stopAll():void{for(const p of [...this.playing])p.stop();this.preview=null;for(const callback of this.silence)callback()}
}
