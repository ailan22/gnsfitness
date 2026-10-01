import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { securityHeaders } from './scripts/security-headers.mjs'

// Run after npm run build. Never copy project files or database exports.
const project = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(project, 'dist')
const out = path.join(project, '..', 'publicaciones', `gns-fitness-${Date.now()}`)
const files = ['index.html', 'favicon.png', 'gns-logo-transparent.png', 'icons.svg', 'manifest.webmanifest', 'app-icon-transparent-192.png', 'app-icon-transparent-512.png', 'privacidad.html', 'soporte.html', 'legal.css']
for (const name of fs.readdirSync(path.join(dist, 'assets'))) {
  if (!/\.(js|css|svg|png|woff2?)$/.test(name)) throw Error('Unexpected build asset')
  files.push(`assets/${name}`)
}
for (const name of fs.readdirSync(path.join(dist, 'nutricion'))) {
  if (!/^(alimentacion|postres)-[0-9]{2}-[0-9]+\.webp$/.test(name)) throw Error('Unexpected nutrition asset')
  files.push(`nutricion/${name}`)
}
let allCode = ''
for (const name of files) {
  if (/\.(html|js|css|svg)$/.test(name)) allCode += fs.readFileSync(path.join(dist, name), 'utf8')
}
if (!allCode.includes('sb_publishable_')) throw Error('Missing browser publishable key')
if (/sb_secret_[A-Za-z0-9_-]{20,}|-----BEGIN .*PRIVATE KEY-----/.test(allCode)) throw Error('Private credential detected; publication stopped')
for (const match of allCode.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
  try {
    const payload = JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url').toString())
    if (payload.role === 'service_role') throw Error('Privileged credential detected')
  } catch (error) { if (error.message === 'Privileged credential detected') throw error }
}
fs.mkdirSync(out, { recursive: true })
for (const name of files) {
  fs.mkdirSync(path.dirname(path.join(out, name)), { recursive: true })
  fs.copyFileSync(path.join(dist, name), path.join(out, name))
}
// Workers serves reset-password.html at /reset-password without rewriting to /.
fs.copyFileSync(path.join(dist, 'index.html'), path.join(out, 'reset-password.html'))
fs.writeFileSync(path.join(out, '_headers'), securityHeaders(process.env.VITE_SUPABASE_URL ?? loadEnv('production', project, 'VITE_').VITE_SUPABASE_URL))
const manifest = files.map(name => ({ name, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(out, name))).digest('hex') }))
fs.writeFileSync(`${out}.manifest.json`, JSON.stringify(manifest, null, 2))
console.log(JSON.stringify({ directory: out, files: files.length + 2 }))
