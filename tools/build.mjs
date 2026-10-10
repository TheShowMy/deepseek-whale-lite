import { build } from 'esbuild'
await build({entryPoints: ['src/index.ts'], outfile: 'lib/index.js', bundle: true, platform: 'node', format: 'esm', target: 'node22'})
await build({entryPoints: ['src/widget.ts'], outfile: 'lib/widget.js', bundle: true, platform: 'browser', format: 'iife', target: 'chrome130'})
