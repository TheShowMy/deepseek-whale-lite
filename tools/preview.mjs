// Isolated UI acceptance harness. Uses the production host routes and events.
// Credentials/balances are fixtures; no external HTTP or model calls are made.
import {createServer} from 'node:http'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {build} from 'esbuild'
import {apply} from '../src/index.ts'
const home=mkdtempSync(join(tmpdir(),'whale-ui-')),routes=new Map(),listeners=new Map(),effects=[]
let seq=0,turn=1,signedIn=true,base='https://api.deepseek.com/anthropic'
const account={getState:async()=>({status:signedIn?'credential-stored':'signed-out'}),getPlatformSession:async()=>signedIn?{origin:'https://platform.deepseek.com',token:'fixture',userId:'fixture-account'}:null,getProfile:async()=>({status:'ready',value:{id:'fixture-account',name:'模拟账户'}}),getBalance:async()=>({status:'ready',value:[{currency:'CNY',balance:'12.34'}],bonusWallets:[]})}
const services={profileContext:{name:'desktop',home},credentials:{resolve:async()=>({value:'fixture-key'})},deepseekAccount:account,llm:{listConfigurableProviders:()=>[{provider:'deepseek-account',settingsNs:'account',settingsPath:[]},{provider:'deepseek-official',settingsNs:'key',settingsPath:[]}]},settings:{describe:()=>[{ns:'account',value:{baseURL:base}},{ns:'key',value:{baseURL:base,apiKeyEnv:'FIXTURE_KEY'}}]},connection:{requestRejection:()=>undefined},webServer:{register:route=>{routes.set(route.path,route);return()=>routes.delete(route.path)}}}
const ctx={get:n=>services[n],on:(n,fn)=>{listeners.set(n,[...(listeners.get(n)??[]),fn]);return()=>{}},inject:(_n,fn)=>fn(ctx),effect:fn=>effects.push(fn())}
const realFetch=globalThis.fetch;globalThis.fetch=async(url,init)=>{if(String(url).startsWith('https://api.deepseek.com/'))return new Response(JSON.stringify({is_available:true,balance_infos:[{currency:'USD',total_balance:'56.78',topped_up_balance:'50',granted_balance:'6.78'}]}));throw new Error('Fixture blocks external HTTP')}
apply(ctx)
const output=await build({stdin:{contents:"import {mount} from './src/widget.ts'; void mount(false)",resolveDir:process.cwd(),sourcefile:'preview.ts'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2022'})
const bundle=output.outputFiles[0].contents
const html=`<!doctype html><html lang="zh" data-platform="darwin"><meta charset="utf-8"><title>DeepSeek Whale Lite — 隔离验收</title><style>html[data-platform=darwin] [data-window-drag]{-webkit-app-region:drag}html[data-platform=darwin] body>:not(#root){-webkit-app-region:no-drag}#titlebar{position:fixed;top:0;left:0;right:0;height:44px;background:#dbe4f5;user-select:none}body{font:14px system-ui;background:#eaf0fa;margin:40px;color:#203170;min-height:1800px}button{padding:10px;margin:5px}h1{font-size:22px}</style><div id="root"><header id="titlebar" data-window-drag>模拟宿主标题栏</header><h1>DeepSeek Whale Lite 0.3.1 · 隔离验收</h1><p>模拟账号 CNY 12.34 / Key USD 56.78；全部使用本机测试事件，无真实凭据、无付费调用。</p><div id="events"></div></div><script>for(const [id,label]of [['complete','回放完成'],['question','回放提问'],['approval','回放授权'],['resolve','解决等待'],['sign-out','切换账号登录状态'],['disable','禁用插件']]){const button=document.createElement('button');button.textContent=label;button.onclick=()=>fetch('/fixture/'+id,{method:'POST'});document.querySelector('#events').append(button)}</script><script src="/preview.js"></script></html>`
const session={id:'fixture-session'},emit=async(type,data)=>{for(const fn of listeners.get('session/event')??[])await fn(session,{type,seq:++seq,time:Date.now(),data:{turn,step:0,...data}})}
const server=createServer(async(req,res)=>{const path=new URL(req.url,'http://127.0.0.1').pathname
  if(path==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);return}
  if(path==='/preview.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle);return}
  // Production static routes locate assets relative to the built host bundle.
  if(path.endsWith('/widget.js')){res.setHeader('Content-Type','text/javascript');res.end(bundle);return}
  const staticPath=/^\/deepseek-whale-lite\/(characters|sounds)\/([\w-]+\.(png|ogg))$/.exec(path)
  if(staticPath){res.setHeader('Content-Type',staticPath[3]==='png'?'image/png':'audio/ogg');res.end(readFileSync(join('assets',staticPath[1],staticPath[2])));return}
  if(path.startsWith('/fixture/')&&req.method==='POST'){
    const kind=path.split('/').at(-1)
    if(kind==='disable')for(const dispose of effects.splice(0).reverse())dispose()
    else if(kind==='sign-out')signedIn=!signedIn
    else if(kind==='resolve'){await emit('tool/result',{message:{callId:'q'+turn}});await emit('approval/decided',{id:'a'+turn})}
    else {await emit('assistant/message',{message:{source:{provider:'deepseek-official',model:'deepseek-flash'}},usage:{inputTokens:100,outputTokens:20}});if(kind==='complete'){await emit('turn/end',{reason:{kind:'completed'}});turn++}else if(kind==='question')await emit('tool/call',{name:'ask_user_question',message:{callId:'q'+turn}});else if(kind==='approval')await emit('approval/asked',{id:'a'+turn})}res.end('ok');return
  }
  const route=routes.get(path);if(route)await route.handler(req,res);else{res.statusCode=404;res.end()}
})
server.listen(47831,'127.0.0.1',()=>console.log('UI fixture: http://127.0.0.1:47831'))
const stop=()=>{for(const dispose of effects.splice(0).reverse())dispose();server.close();globalThis.fetch=realFetch;rmSync(home,{recursive:true,force:true})};process.on('SIGINT',()=>{stop();process.exit()});process.on('SIGTERM',()=>{stop();process.exit()})
