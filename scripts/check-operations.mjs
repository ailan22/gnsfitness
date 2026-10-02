// Read-only public health and ciphertext verification. Never reads credentials.
import {readFile,open,mkdir,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
const root=fileURLToPath(new URL('../',import.meta.url))
const report={checkedAt:new Date().toISOString(),checks:[],scope:'Public website and local encrypted backup; does not prove authenticated flows or remote Drive integrity'}
function check(name,passed,detail){report.checks.push({name,passed,detail})}
try{
 const response=await fetch('https://still-disk-e7b3.gndevicciconde.workers.dev/',{redirect:'error',signal:AbortSignal.timeout(15000)})
 check('public_https',response.status===200,`HTTP ${response.status}`)
 const csp=response.headers.get('content-security-policy')??''
 check('content_security_policy',csp.includes("script-src 'self'")&&csp.includes("frame-ancestors 'none'")&&!/unsafe-eval/.test(csp),'Restricts executable scripts and framing')
 check('transport_security',/max-age=\d{6,}/.test(response.headers.get('strict-transport-security')??''),'HSTS present')
 check('no_sensitive_browser_cache',/no-store/.test(response.headers.get('cache-control')??''),'HTML no-store')
 check('no_sniff',response.headers.get('x-content-type-options')==='nosniff','MIME sniffing disabled')
 check('no_referrer',response.headers.get('referrer-policy')==='no-referrer','Referrer suppressed')
 await response.body?.cancel()
}catch{check('public_https',false,'Connection, timeout or redirect; inspect before declaring outage')}
try{
 const status=JSON.parse((await readFile(path.resolve(root,'../.backup-tools/automatic-backup-status.json'),'utf8')).replace(/^\uFEFF/,''))
 check('latest_backup_verified',status.status==='verified',status.status)
 const copy=status.status==='verified'?status:status.lastVerified
 const archive=path.resolve(copy?.path??'')
 const allowed=path.resolve(root,'../.backup-tools/automatic-archives')
 if(path.dirname(archive)!==allowed||path.extname(archive)!=='.gnsfull')throw Error('Unexpected archive')
 const handle=await open(archive,'r')
 let hash,size
 try{
  size=(await handle.stat()).size
  const digest=createHash('sha256')
  for await(const chunk of handle.createReadStream({autoClose:false}))digest.update(chunk)
  hash=digest.digest('hex')
 }finally{await handle.close()}
 check('encrypted_archive_intact',size===copy.bytes&&hash===copy.sha256,'Ciphertext size and SHA-256 match recorded verification')
 const age=Date.now()-Date.parse(copy.completedAt)
 check('backup_fresh',Number.isFinite(age)&&age>=0&&age<=30*60*60*1000,'Target: last verified copy within 30 hours; daily cadence is not zero data loss')
 check('offsite_receipt_recorded',copy.offsiteUploaded===true,'Recorded status only; remote file and permissions need a separate Drive check')
 check('full_service_restore',copy.fullProviderRestoreTested===true,'Separate Supabase Auth, email, functions and mobile recovery drill required')
}catch{check('backup_inspection',false,'Could not verify the recorded encrypted archive')}
report.status=report.checks.every(item=>item.passed)?'passed':'attention_required'
await mkdir(path.join(root,'output'),{recursive:true})
await writeFile(path.join(root,'output/operations-report.json'),JSON.stringify(report,null,2))
console.log(JSON.stringify(report,null,2))
process.exitCode=report.status==='passed'?0:2
