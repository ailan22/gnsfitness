// Platform exports of the existing approved logo; no redrawing or recoloring.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const sharp = createRequire(import.meta.url)(process.argv[2] || 'sharp')
const root = path.dirname(fileURLToPath(import.meta.url))
const logo = path.join(root, 'public/gns-logo-transparent.png')
const background = '#111510'
async function exportLogo(file, width, height, size, transparent = false) {
  const resized = await sharp(logo).resize(size, size, { fit: 'inside' }).png().toBuffer()
  const output = sharp({ create: { width, height, channels: 4, background: transparent ? '#00000000' : background } })
    .composite([{ input: resized, gravity: 'centre' }])
  await fs.mkdir(path.dirname(file), { recursive: true })
  await (transparent ? output : output.flatten({ background }).removeAlpha()).png().toFile(file)
}
const res = path.join(root, 'android/app/src/main/res')
for (const [density, size] of Object.entries({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 })) {
  for (const name of ['ic_launcher', 'ic_launcher_round']) {
    await exportLogo(path.join(res, `mipmap-${density}/${name}.png`), size, size, Math.round(size * .76))
  }
  const adaptive = Math.round(size * 108 / 48)
  await exportLogo(path.join(res, `mipmap-${density}/ic_launcher_foreground.png`), adaptive, adaptive, Math.round(adaptive * .58), true)
}
for (const directory of await fs.readdir(res)) {
  if (!directory.startsWith('drawable')) continue
  const file = path.join(res, directory, 'splash.png')
  try {
    const { width, height } = await sharp(file).metadata()
    await exportLogo(file, width, height, Math.round(Math.min(width, height) * .3))
  } catch (error) { if (!String(error.message).includes('Input file is missing')) throw error }
}
const assets = path.join(root, 'ios/App/App/Assets.xcassets')
await exportLogo(path.join(assets, 'AppIcon.appiconset/AppIcon-512@2x.png'), 1024, 1024, 780)
for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  await exportLogo(path.join(assets, 'Splash.imageset', name), 2732, 2732, 600)
}
await exportLogo(path.join(root, 'public/favicon.png'), 64, 64, 64, true)
await exportLogo(path.join(root, 'store-assets/icon-1024.png'), 1024, 1024, 780)
await exportLogo(path.join(root, 'store-assets/icon-512.png'), 512, 512, 390)
console.log('Approved GNS logo exported for Android, iOS and store icons.')
