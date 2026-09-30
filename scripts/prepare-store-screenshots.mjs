// Dedicated simulator-only build. Never used by mobile:prepare or signed workflows.
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
const entry = new URL('../store-screenshot.html', import.meta.url)
const bootstrap = new URL('../tests/preview/store-bootstrap.js', import.meta.url)
try {
 await fs.writeFile(entry, '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>GNS FITNESS</title></head><body><div id="root"></div><script type="module" src="/tests/preview/store-bootstrap.js"></script></body></html>')
 await fs.writeFile(bootstrap, "const config=await (await fetch('/screenshot-config.json')).json();history.replaceState(null,'','/?student=1&store='+encodeURIComponent(config.screen));await import('./workspace.jsx');")
 await build({ configFile:false, plugins:[react()], build:{outDir:'dist-mobile',emptyOutDir:true,target:'esnext',rollupOptions:{input:'store-screenshot.html'}} })
 await fs.rename('dist-mobile/store-screenshot.html','dist-mobile/index.html')
 await fs.writeFile('dist-mobile/screenshot-config.json',JSON.stringify({screen:'training'}))
} finally { await fs.rm(entry,{force:true}); await fs.rm(bootstrap,{force:true}) }
