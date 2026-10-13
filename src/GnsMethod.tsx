const services = [
 ['Entrenamiento','M3 7v10M7 4v16M17 4v16M21 7v10M3 9h4m0 3h10m0-3h4M3 15h4m10 0h4'],
 ['Nutrición','M12 8c-8-6-13 3-7 11 2 3 4 2 7 1 3 1 5 2 7-1 6-8 1-17-7-11Zm0 0c0-5 2-7 5-6 0 3-2 5-5 6Z'],
 ['Kinesiología','M12 2v20M8 5h8M7 9h10M8 13h8M9 17h6'],
 ['Psicología deportiva','M12 4C5 0 1 7 4 11c-4 5 1 11 8 8m0-15c7-4 11 3 8 7 4 5-1 11-8 8V4M7 8l3 2m7 3-3 2'],
 ['Café','M4 9h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5ZM17 10h2a3 3 0 0 1 0 6h-2M7 2v4m4-4v4m4-4v4'],
 ['Terapias holísticas','M4 20C1 7 10 2 21 3c1 11-6 19-17 17Zm0 0L17 7'],
]
export default function GnsMethod() {
 return <section className="student-content student-method-editorial" aria-label="Método GNS">
  <img className="student-editorial-photo" src="/student-method-window.png" alt="Gimnasio con piso negro, equipos y plantas junto a una ventana"/>
  <div className="gns-method-copy"><p>GNS FITNESS ofrece un cuidado integral a través del entrenamiento especializado, la nutrición aplicada a la salud y el acompañamiento de la persona.</p><p>Trabajamos las capacidades motoras, la postura y los desequilibrios. Contamos con kinesiología, psicología deportiva y terapias holísticas, además de un espacio de café para compartir un ambiente cálido.</p><p>Buscamos acompañar el bienestar físico, mental y emocional, con programas pensados en la salud y la calidad de vida.</p></div>
  <section className="card method-services" aria-label="Servicios GNS"><h2>LO QUE OFRECEMOS</h2><div>{services.map(([label,path])=><div key={label}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d={path}/></svg><span>{label}</span></div>)}</div></section>
  <p className="gns-signature">GYM NATURE SOUL</p>
 </section>
}
