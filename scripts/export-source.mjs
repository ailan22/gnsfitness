import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const destination = path.resolve(root, '..', 'publicaciones', 'gns-fitness-github')
if (fs.existsSync(destination)) throw new Error('Export already exists; review it before updating.')
const folders = ['src', 'tests', 'cloud', 'supabase', 'ios', 'android', 'scripts', 'store-assets']
const files = ['package.json', 'package-lock.json', 'index.html', 'vite.config.ts', 'eslint.config.js', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', '.env.example', '.gitignore', 'capacitor.config.json', 'codemagic.yaml', 'prepare-mobile.mjs', 'normalize-ios-paths.mjs', 'generate-native-branding.mjs', 'README.md', 'APP_MOVIL.md', 'PRIMERA_PRUEBA_IPHONE.md', 'PUBLICACION_PENDIENTES.md']
const excluded = /(^|\/)(node_modules|build|output|Pods|DerivedData|xcuserdata|\.git|\.gradle|\.idea|\.temp|capacitor-cordova-android-plugins|capacitor-cordova-ios-plugins)(\/|$)|(^|\/)(local\.properties|\.env\.local|capacitor\.config\.json|capacitor\.plugins\.json|config\.xml)$|\.(p12|p8|pem|key|jks|keystore|mobileprovision|apk|aab|log|hprof)$/i
const generatedWeb = /^(ios\/App\/App\/public|android\/app\/src\/main\/assets\/public)(\/|$)/
const entries = []
function collect(relative) {
  const absolute = path.join(root, relative)
  const stat = fs.lstatSync(absolute)
  if (stat.isSymbolicLink()) throw new Error(`Symlink requires review: ${relative}`)
  if (stat.isDirectory()) {
    for (const item of fs.readdirSync(absolute)) {
      const child = `${relative}/${item}`
      if (!excluded.test(child) && !generatedWeb.test(child)) collect(child)
    }
  } else entries.push(relative)
}
for (const folder of folders) collect(folder)
entries.push(...files, ...['favicon.png', 'gns-logo-transparent.png', 'icons.svg'].map(f => `public/${f}`))
// Fail without printing matched values. Keys are supplied separately in CI.
for (const file of entries) {
  if (!/\.(png|jpg|jpeg|jar)$/i.test(file)) {
    const content = fs.readFileSync(path.join(root, file), 'utf8')
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{40,}|\bsb_secret_[A-Za-z0-9_-]{20,}/.test(content)) throw new Error(`Potential credential; review ${file}`)
  }
}
for (const file of entries) {
  const target = path.join(destination, file)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(path.join(root, file), target)
}
fs.appendFileSync(path.join(destination, '.gitignore'), '\n# Local credentials and signing material\n.env\n.env.*\n!.env.example\n*.p12\n*.p8\n*.pem\n*.key\n*.jks\n*.keystore\n*.mobileprovision\n')
console.log(JSON.stringify({ destination, files: entries.length }))
