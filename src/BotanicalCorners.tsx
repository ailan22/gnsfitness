import branch from './assets/gns-botanical-branch.png'
export default function BotanicalCorners(){
 return <div className="botanical-corners" aria-hidden="true">{['left','right'].map(side=><img key={side} className={`botanical-branch botanical-${side}`} src={branch} alt=""/> )}</div>
}
