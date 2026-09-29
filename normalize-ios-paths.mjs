import { readFile, writeFile } from 'node:fs/promises'

// Capacitor on Windows generates backslashes in local Swift package paths.
// Swift string literals and the Mac checkout require forward slashes.
const file = new URL('./ios/App/CapApp-SPM/Package.swift', import.meta.url)
const source = await readFile(file, 'utf8')
const fixed = source.replace(/(path:\s*")([^"]+)(")/g,
  (_match, start, path, end) => start + path.replaceAll('\\', '/') + end)
if (fixed !== source) await writeFile(file, fixed)
