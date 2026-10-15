// Build a temporary desktop acceptance package; never use this package for npm.
// The final `npm run build && npm pack` uses the ordinary production entry.
import {readFileSync,writeFileSync,mkdirSync,cpSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {build} from 'esbuild'
import {BUBBLE_SVG} from '../src/bubble-view.ts'
const upstream=execFileSync('git',['show','fce34e3:assets/whale-widget.js'],{encoding:'utf8'})
const parts=['<path class="dshwv-bshape"','<ellipse class="dshwv-b1"','<ellipse class="dshwv-b2"'].map(start=>{const at=upstream.indexOf(start);if(at<0)throw new Error('Missing upstream SVG');return upstream.slice(at,upstream.indexOf('/>',at)+2)})
const svg='<svg viewBox="0 0 1026 700" xmlns="http://www.w3.org/2000/svg">'+parts.join('')+'</svg>'
const attrs=text=>[...text.matchAll(/\b(d|cx|cy|rx|ry|stroke-width|stroke|fill)="([^"]+)"/g)].map(m=>[m[1],m[2].toLowerCase().replace('#ffffff','#fff')])
if(JSON.stringify(attrs(svg))!==JSON.stringify(attrs(BUBBLE_SVG)))throw new Error('SVG differs from upstream')
const dir='.evidence/native-visual';mkdirSync(dir,{recursive:true})
for(const path of ['assets','docs','LICENSE','PROVENANCE.md','README.md','cordis.patch.yml','lib'])cpSync(path,dir+'/'+path,{recursive:true})
const manifest=JSON.parse(readFileSync('package.json'));manifest.version='0.2.0-visual-check';delete manifest.scripts;writeFileSync(dir+'/package.json',JSON.stringify(manifest,null,2))
const entry=`import './src/widget.ts';import {BUBBLE_SVG} from './src/bubble-view.ts';
const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;z-index:2147483100;background:#eaf0fa;color:#203170;font:16px system-ui;padding:60px;overflow:auto';
const title=document.createElement('h1');title.textContent='实际 DSH 桌面端 · 上游 SVG 轮廓对照';host.append(title);
const note=document.createElement('p');note.textContent='左：从上游 main / fce34e3 提取的原 SVG。右：Lite 0.2.0 的 SVG。角色共用现有半身图；下方金额仅为视觉测试示例。';host.append(note);
const grid=document.createElement('div');grid.style.cssText='display:flex;gap:100px;margin:40px 0';
for(const [label,svg]of [['上游 fce34e3',${JSON.stringify(svg)}],['Whale Lite 0.2.0',BUBBLE_SVG]]){const col=document.createElement('section'),heading=document.createElement('h2');heading.textContent=label;col.append(heading);const stage=document.createElement('div');stage.style.cssText='position:relative;width:300px;height:300px';const shape=document.createElement('div');shape.style.cssText='position:absolute;left:0;top:0;width:300px;height:205px';shape.innerHTML=svg;shape.querySelector('svg').style.cssText='width:100%;height:100%;display:block';const text=document.createElement('div');text.style.cssText='position:absolute;left:34px;top:51px;width:198px;text-align:center;line-height:1.4;font-weight:bold';text.textContent='账号 ¥12.34 / Key $56.78（模拟）';const image=document.createElement('img');image.src='/deepseek-whale-lite/characters/deepseek-smile.png';image.style.cssText='position:absolute;right:0;bottom:0;width:59.45%;height:59.45%;object-fit:contain';stage.append(shape,text,image);col.append(stage);grid.append(col)}host.append(grid);
const close=document.createElement('button');close.textContent='关闭视觉对照';close.style.cssText='padding:12px 18px';close.onclick=()=>host.remove();host.append(close);document.body.append(host);`
await build({stdin:{contents:entry,sourcefile:'visual-check.ts',resolveDir:process.cwd()},bundle:true,format:'iife',platform:'browser',target:'es2022',outfile:dir+'/lib/widget.js'})
console.log('SVG attributes match upstream. Temporary package: '+dir)
