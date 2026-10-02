// Safe for a remote runner: public GETs only, no accounts or credentials.
import {pathToFileURL} from 'node:url'
export const PUBLIC_ORIGIN = 'https://still-disk-e7b3.gndevicciconde.workers.dev'
export async function inspectPublicSite(fetcher=fetch, origin=PUBLIC_ORIGIN) {
 const checks=[]
 const record=(name,passed)=>checks.push({name,passed:Boolean(passed)})
 try {
  const response=await fetcher(origin+'/',{redirect:'error',signal:AbortSignal.timeout(15000)})
  record('homepage_200',response.status===200)
  record('html_content_type',/^text\/html\b/i.test(response.headers.get('content-type')??''))
  const html=await response.text()
  record('application_mount',/id=["']root["']/.test(html))
  const directives=new Map((response.headers.get('content-security-policy')??'').split(';').map(d=>{const [name,...values]=d.trim().split(/\s+/);return [name,values]}))
  const scripts=directives.get('script-src')??[]
  record('restricted_scripts',scripts.length===1&&scripts[0]==="'self'")
  record('no_framing',directives.get('frame-ancestors')?.join(' ')==="'none'")
  record('hsts',Number(/max-age=(\d+)/i.exec(response.headers.get('strict-transport-security')??'')?.[1])>=31536000)
  record('no_cache',/\bno-store\b/i.test(response.headers.get('cache-control')??''))
  record('nosniff',response.headers.get('x-content-type-options')==='nosniff')
  record('no_referrer',response.headers.get('referrer-policy')==='no-referrer')
  const asset=/\bsrc=["'](\/assets\/index-[a-zA-Z0-9_-]+\.js)["']/.exec(html)?.[1]
  record('versioned_bundle',asset)
  if(asset){
   const bundle=await fetcher(origin+asset,{redirect:'error',signal:AbortSignal.timeout(15000)})
   record('bundle_available',bundle.status===200&&/(?:javascript|ecmascript)/i.test(bundle.headers.get('content-type')??''))
   await bundle.body?.cancel()
  }
 }catch{record('network_or_response',false)}
 return {checkedAt:new Date().toISOString(),status:checks.every(c=>c.passed)?'passed':'failed',checks,
  scope:'Public HTML, security headers and current JS bundle only; excludes authenticated API, backups and service SLA'}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let report
 for(let attempt=1;attempt<=3;attempt++){
  report={...await inspectPublicSite(),attempts:attempt}
  if(report.status==='passed')break
  if(attempt<3)await new Promise(resolve=>setTimeout(resolve,2000))
 }
 console.log(JSON.stringify(report,null,2))
 process.exitCode=report.status==='passed'?0:1
}
