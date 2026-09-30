// Run only in the unsigned screenshot workflow on a macOS build machine.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
const run=(args)=>execFileSync('xcrun',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']})
const app=path.resolve('build/store-screenshots/Build/Products/Debug-iphonesimulator/App.app')
if(!fs.existsSync(app)) throw Error('Simulator build missing')
const devices=Object.values(JSON.parse(run(['simctl','list','devices','available','--json'])).devices).flat()
const phone=devices.find(d=>d.name.includes('iPhone')&&d.name.includes('Pro Max'))
const pad=devices.find(d=>d.name.includes('iPad Pro')&&d.name.includes('13-inch'))
if(!phone||!pad) throw Error('Required iPhone and iPad simulators unavailable')
fs.mkdirSync('store-screenshots',{recursive:true})
execFileSync('swiftc',['scripts/check-store-screenshot.swift','-o','build/check-store-screenshot'])
for(const [kind,device] of [['iphone',phone],['ipad',pad]]) {
 console.log('Capture device:',device.name)
 if(device.state!=='Booted')run(['simctl','boot',device.udid])
 run(['simctl','bootstatus',device.udid,'-b'])
 run(['simctl','status_bar',device.udid,'override','--time','9:41','--dataNetwork','wifi','--wifiMode','active','--wifiBars','3','--batteryState','charged','--batteryLevel','100'])
 for(const screen of ['training','progress','nutrition']) {
  fs.writeFileSync(path.join(app,'public','screenshot-config.json'),JSON.stringify({screen}))
  run(['simctl','install',device.udid,app])
  run(['simctl','launch',device.udid,'uy.gnsfitness.app'])
  const output = `store-screenshots/${kind}-${screen}.png`
  let visible = false
  for (let attempt = 0; attempt < 3; attempt++) {
   // Cold simulator WebViews can take longer than eight seconds to paint.
   await new Promise(resolve=>setTimeout(resolve,45000))
   run(['simctl','io',device.udid,'screenshot',output])
   try { execFileSync('build/check-store-screenshot',[output]); visible = true; break }
   catch { console.log('Waiting for visible content:',kind,screen) }
  }
  if (!visible) { fs.unlinkSync(output); throw Error(`Blank screenshot: ${kind}-${screen}`) }
  run(['simctl','terminate',device.udid,'uy.gnsfitness.app'])
 }
 run(['simctl','shutdown',device.udid])
}
console.log('Screenshots use real UI components with fictional data; visually verify before upload.')
