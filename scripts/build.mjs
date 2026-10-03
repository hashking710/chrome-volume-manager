import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import * as sass from 'sass'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, 'dist')

rmSync(output, { recursive: true, force: true })
mkdirSync(output, { recursive: true })

cpSync(resolve(root, 'static', 'manifest.json'), resolve(output, 'manifest.json'))
cpSync(resolve(root, 'static', 'icon.png'), resolve(output, 'icon.png'))
cpSync(resolve(root, 'src', 'popup.html'), resolve(output, 'popup.html'))
cpSync(resolve(root, 'src', 'offscreen.html'), resolve(output, 'offscreen.html'))

await build({
  entryPoints: [
    resolve(root, 'src', 'background.ts'),
    resolve(root, 'src', 'offscreen.ts'),
    resolve(root, 'src', 'popup.ts')
  ],
  bundle: true,
  format: 'iife',
  outdir: output,
  platform: 'browser',
  target: 'chrome116'
})

const stylesheet = sass.compile(resolve(root, 'src', 'popup.scss'), {
  style: 'compressed'
})
writeFileSync(resolve(output, 'popup.css'), stylesheet.css)
