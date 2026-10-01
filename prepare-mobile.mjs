import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const source = path.join(root, 'dist')
const target = path.join(root, 'dist-mobile')
// A dedicated output excludes old logos, exports, environment files and backups.
if (path.dirname(target) !== root || path.basename(target) !== 'dist-mobile') throw Error('Invalid output directory')
if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw Error('Output must not be a link')
fs.rmSync(target, { recursive: true, force: true })
fs.mkdirSync(path.join(target, 'assets'), { recursive: true })
for (const file of ['index.html', 'favicon.png', 'gns-logo-transparent.png', 'icons.svg', 'privacidad.html', 'soporte.html', 'legal.css']) {
  fs.copyFileSync(path.join(source, file), path.join(target, file))
}
// The install manifest belongs to the hosted Windows/web app, not Capacitor.
const nativeHtml = path.join(target, 'index.html')
fs.writeFileSync(nativeHtml, fs.readFileSync(nativeHtml, 'utf8').replace(/\s*<link rel="manifest"[^>]*>/, ''))
for (const file of fs.readdirSync(path.join(source, 'assets'))) {
  if (!/\.(js|css|svg|png|woff2?)$/.test(file)) throw Error('Unexpected mobile asset')
  fs.copyFileSync(path.join(source, 'assets', file), path.join(target, 'assets', file))
}
fs.cpSync(path.join(source, 'nutricion'), path.join(target, 'nutricion'), { recursive: true })
console.log('Mobile web assets prepared; native binaries still require platform SDKs.')
