import {spawnSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
const result=spawnSync('npm',['pack','--dry-run','--json'],{encoding:'utf8'})
assert.equal(result.status,0,result.stderr)
const pack=JSON.parse(result.stdout)[0], files=pack.files.map(f=>f.path)
for(const file of ['lib/index.js','lib/widget.js','cordis.patch.yml','README.md','PROVENANCE.md','LICENSE','docs/QA.md','docs/QA-0.3.0.md','docs/QA-0.3.1.md','docs/UPSTREAM-PARITY.md','docs/CHARACTERS.md','docs/image-prompts.json','docs/asset-manifest.json','assets/sounds/LICENSE-Kenney.txt'])assert.ok(files.includes(file),file)
const roles=['deepseek-smile','deepseek-focus','deepseek-sleepy','lumine','vesna','vodyanitsa','tsaritsa']
for(const role of roles)assert.ok(files.includes('assets/characters/'+role+'.png'),role)
for(const sound of ['press','release','complete','alert'])assert.ok(files.includes('assets/sounds/'+sound+'.ogg'),sound)
for(const file of files){
  assert.ok(!/DSniang|DSH2|rua\.gif|bubble-.*\.gif|minecraft|task-end|Ya[12]|D[12]\.mp3|state\.json|\.env|node_modules|tests\//.test(file),file)
  if(/\.(js|json|md|yml)$/.test(file))assert.ok(!/\/Users\/|\/Volumes\/|dsh-whale-widget|\/dsh-whale\//.test(readFileSync(file,'utf8'))||file==='README.md'||file==='PROVENANCE.md',file)
}
const manifest=JSON.parse(readFileSync('package.json','utf8'))
assert.equal(manifest.name,'dsh-deepseek-whale-lite');assert.equal(manifest.version,'0.3.1')
assert.ok(!manifest.scripts.postinstall);assert.ok(!manifest.scripts.prepare)
const assets=JSON.parse(readFileSync('docs/asset-manifest.json','utf8'))
for(const asset of assets.assets){
  assert.ok(files.includes(asset.path),asset.path)
  const bytes=readFileSync(asset.path)
  assert.equal(bytes.length,asset.bytes,asset.path)
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,asset.path)
}
console.log('npm 内容检查通过：'+files.length+' 文件，'+pack.unpackedSize+' bytes')
