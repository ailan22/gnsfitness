// Export the existing transparent brand asset for Windows/Edge, preserving alpha.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const sharp = createRequire(import.meta.url)(process.argv[2] || 'sharp')
const publicDir = fileURLToPath(new URL('../public/', import.meta.url))
for (const size of [64, 192, 512]) {
  const file = size === 64 ? 'favicon.png' : `app-icon-transparent-${size}.png`
  await sharp(`${publicDir}/gns-logo-transparent.png`)
    .resize(size, size, { fit: 'contain', background: '#00000000' })
    .png().toFile(`${publicDir}/${file}`)
  const { data, info } = await sharp(`${publicDir}/${file}`).raw().toBuffer({ resolveWithObject: true })
  if (info.channels !== 4 || data[3] !== 0) throw new Error('Icon must retain transparent corners')
}
console.log('Windows icons exported with transparency.')
