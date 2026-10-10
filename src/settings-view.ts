import {el,button,input,select,field,check,dialog,report} from './ui.ts'
import type {Client} from './ui.ts'
import {DEFAULT_SETTINGS} from './shared.ts'
import type {Settings,NotificationKind} from './shared.ts'
import {EVENT_LABELS} from './notifications.ts'
import {editDefinition} from './bubble-editor.ts'

export function openSettings(root:ShadowRoot,client:Client):void {
  let draft=structuredClone(client.context().snapshot.settings)
  const d=dialog(root,'外观、气泡与提醒设置')
  function draw(){
    d.body.replaceChildren()
    const mode=select([['account','仅登录账号'],['api-key','仅 API Key'],['both','两者同时']],draft.displayMode??'api-key'),role=select(client.context().catalog.assets.filter(a=>a.kind==='role').map(a=>[a.id,a.name] as const),draft.character)
    mode.onchange=()=>draft.displayMode=mode.value as Settings['displayMode'];role.onchange=()=>draft.character=role.value;d.body.append(field('余额显示模式',mode),field('角色',role))
    for(const [key,label,min,max,step]of [['scale','缩放',.6,1.5,.05],['refreshSeconds','自动刷新间隔（秒）',15,600,1],['volume','全局音量',0,1,.05],['scrollGap','右侧滚动条避让（像素）',0,100,1]] as const){const value=input(String(draft[key]),'number');value.min=String(min);value.max=String(max);value.step=String(step);value.onchange=()=>draft[key]=Number(value.value);d.body.append(field(label,value))}
    for(const [key,label]of [['bubbleOn','启用气泡'],['stickyBalance','常驻余额（队列与提示结束后恢复）'],['tapAdvance','点击角色推进气泡队列'],['menuButtonHide','隐藏悬停菜单按钮（右键仍可打开）'],['autoFlip','贴左边自动镜像'],['flip','手动镜像'],['sound','启用音效']] as const)d.body.append(check(label,draft[key],v=>draft[key]=v))
    const peak=select([['simple','简洁峰谷'],['countdown','峰谷倒计时'],['playful','上游趣味样式']],draft.peakStyle);peak.onchange=()=>draft.peakStyle=peak.value as Settings['peakStyle'];d.body.append(field('峰谷显示样式',peak))
    const group=select(client.context().catalog.groups.map(g=>[g.id,g.name] as const),draft.pressGroup);group.onchange=()=>draft.pressGroup=group.value;d.body.append(field('角色按压音效组',group),button('试听音效组',()=>client.previewAudio(group.value,draft.volume)))
    const snap=el('details','','section');snap.open=true;snap.append(el('summary','四边吸附'),check('启用吸附',draft.snap.enabled,v=>draft.snap.enabled=v));const unit=select([['px','像素'],['percent','窗口百分比']],draft.snap.unit);unit.onchange=()=>{draft.snap.unit=unit.value as Settings['snap']['unit'];for(const side of ['top','right','bottom','left'] as const)draft.snap[side]=Math.min(draft.snap[side],draft.snap.unit==='px'?500:50);draw()};snap.append(field('吸附距离单位',unit))
    for(const [side,label]of [['top','上'],['right','右'],['bottom','下'],['left','左']] as const){const value=input(String(draft.snap[side]),'number');value.min='0';value.max=draft.snap.unit==='px'?'500':'50';value.onchange=()=>draft.snap[side]=Number(value.value);snap.append(field(label,value))}d.body.append(snap)
    const events=el('details','','section');events.open=true;events.append(el('summary','提醒与音效'))
    for(const [kind,label]of Object.entries(EVENT_LABELS) as [NotificationKind,string][]){
      const cfg=draft.events[kind],section=el('details','','section');section.append(el('summary',label),check('启用此提醒',cfg.enabled,v=>cfg.enabled=v),check('显示在气泡中（关闭时使用通知卡片）',cfg.bubble,v=>cfg.bubble=v),check('播放提醒声音',cfg.sound,v=>cfg.sound=v))
      const audio=select([['','无音效'],...client.context().catalog.assets.filter(a=>a.kind==='audio').map(a=>[a.id,a.name] as const),...client.context().catalog.groups.map(g=>[g.id,g.name] as const)],cfg.audio);audio.onchange=()=>cfg.audio=audio.value;const volume=input(cfg.volume===null?'':String(cfg.volume),'number');volume.min='0';volume.max='1';volume.step='.05';volume.placeholder='跟随全局';volume.onchange=()=>cfg.volume=volume.value===''?null:Number(volume.value)
      const ttl=input(String(cfg.closeSeconds),'number');ttl.min='0';ttl.max='86400';ttl.onchange=()=>cfg.closeSeconds=Number(ttl.value)
      section.append(field('音效／音效组',audio),field('音量（留空跟随全局）',volume),field('关闭时间（秒；0 为手动）',ttl),button('试听提醒声音',()=>client.previewAudio(audio.value,cfg.volume??draft.volume)),button('编辑提醒内容',()=>editDefinition(root,client,cfg.content,next=>cfg.content=next)));events.append(section)
    }d.body.append(events,el('p','等待提问和授权优先；其他提醒排队。新预算、提问、授权提示默认关闭。来源与币种的阈值在账本里分别设置。','muted'))
  }
  d.footer.append(button('重置位置草稿',()=>{draft.x=draft.y=null;d.note.textContent='保存后重置位置'}),button('恢复默认草稿',()=>{draft={...structuredClone(DEFAULT_SETTINGS),displayMode:draft.displayMode};draw()}),button('取消',d.close),button('保存设置',()=>{void report(d,async()=>{await client.api('/settings',draft,'PUT');await client.reload();d.close()})}));draw()
}
