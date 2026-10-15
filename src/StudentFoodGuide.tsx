import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import guide from './admin-alimentacion.json'

const guideGroups = [
 { title:'Bases de alimentación', links:[['plato','Cómo armar el plato'],['nutrientes','Nutrientes'],['combinaciones','Cómo combinar alimentos']] },
 { title:'Comidas del día', links:[['cinco-dias','Menú de ejemplo'],['desayunos','Desayunos'],['almuerzos','Almuerzos'],['meriendas','Meriendas'],['cenas','Cenas']] },
 { title:'Alimentación y entrenamiento', links:[['before','Antes de entrenar'],['after','Después de entrenar']] },
 { title:'Infusiones y bebidas', links:[['infusiones','Infusiones y tés'],['aguas','Aguas naturales']] },
 { title:'Más sobre alimentación', links:[['salud-hormonal','Alimentación y salud hormonal']] },
]
const timings = [
  { title:'3 horas antes', intro:'Una comida con carbohidratos y una fuente de proteína, sin exceso de grasa. Ajustá la cantidad a tu hambre, al entrenamiento y a tu digestión.', meals:[['Arroz con pollo','Cociná arroz y acompañalo con pollo a la plancha y verduras cocidas. Podés cambiar el pollo por pescado, carne magra o tofu.'],['Pasta con atún','Combiná pasta con atún al natural y una salsa suave de tomate. Evitá una porción muy grande o salsas pesadas.'],['Papa con huevo','Papa cocida con huevo y una porción de verduras que toleres bien.']], drink:'Agua durante las horas previas. Tomala de a poco, sin forzarte a beber mucho justo antes.' },
  { title:'1 hora y media antes', intro:'Elegí una colación más pequeña y conocida. Incluí una porción moderada de proteína si te resulta cómoda.', meals:[['Yogur con banana','Yogur natural, bajo en grasa si lo preferís, con banana madura. Usá yogur sin lactosa si lo necesitás.'],['Tostada con ricota','Una tostada con ricota magra o queso fresco y fruta. Ajustá la cantidad a tu tolerancia.'],['Licuado sencillo','Leche o bebida de soja con proteína y banana. Una porción pequeña, sin sumar muchas semillas ni mantecas de frutos secos.']], drink:'Agua. El licuado también aporta líquido; no hace falta agregar una bebida deportiva para una sesión habitual.' },
  { title:'30–45 minutos antes', intro:'Si necesitás comer, priorizá algo pequeño, fácil de digerir y con carbohidratos. No hace falta una comida proteica abundante tan cerca del ejercicio.', meals:[['Banana madura','Una porción que te resulte cómoda, sin acompañamientos pesados.'],['Tostada sencilla','Pan con una capa fina de mermelada o miel.'],['Yogur pequeño, si lo tolerás','Puede ser una alternativa con proteína, pero no es obligatorio: evitá lácteos si te generan molestias al entrenar.']], drink:'Agua en pequeños sorbos. Evitá tomar grandes volúmenes de golpe.' },
]
const after = [
 ['Plato completo','Arroz, papa o pasta con pollo, pescado, carne magra o tofu y verduras. Aporta carbohidratos y proteína para reponer energía y acompañar la recuperación.'],
 ['Yogur con avena y fruta','Yogur natural con proteína, avena y fruta. Una opción práctica si tu próxima comida queda lejos.'],
 ['Sándwich con huevo o pollo','Pan con huevo cocido o pollo y verduras. Podés acompañarlo con fruta.'],
 ['Opción vegetal','Lentejas con arroz y verduras, o tofu con papa. Alterná las fuentes de proteína durante el día.'],
]

export default function StudentFoodGuide() {
 const [screen,setScreen]=useState<string|null>(null)
 const [itemIndex,setItemIndex]=useState<number|null>(null)
 const top=useRef<HTMLDivElement>(null)
 const [navigationHost,setNavigationHost]=useState<HTMLElement|null>(null)
 const attachGuide=useCallback((element:HTMLDivElement|null)=>{top.current=element;setNavigationHost(element?.closest('.cloud-student')?.querySelector<HTMLElement>('.student-cards-brand')??null)},[])
 const go=(next:string|null,index:number|null=null)=>{setScreen(next);setItemIndex(index);requestAnimationFrame(()=>top.current?.scrollIntoView({block:'start',behavior:'instant'}))}
 const section=guide.sections.find(s=>s.id===screen)
 const item=itemIndex===null?null:section?.items[itemIndex]
 const timing=screen?.startsWith('pre-')?timings[Number(screen.slice(4))]:null
 const title=item?.title??section?.title??timing?.title??(screen==='before'?'Antes de entrenar':screen==='after'?'Después de entrenar':'Alimentación saludable')
 return <div className="student-guide-browser" ref={attachGuide}>
  {screen&&navigationHost&&createPortal(<button type="button" className="guide-back" onClick={()=>go(item?screen:timing?'before':null)} aria-label="Volver al apartado anterior de alimentación"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12"/></svg></button>,navigationHost)}
  {!screen?<>
   <img className="student-editorial-photo" src="/student-food-hero.png" alt="Plato con pollo, cereales y vegetales variados"/>
   <nav className="student-guide-sections" aria-label="Secciones de la guía">{guideGroups.map(group=><section key={group.title}><h2>{group.title}</h2><div className="student-guide-grid">{group.links.map(([id,label])=><button type="button" key={id} onClick={()=>go(id)}>{label}<span aria-hidden="true">›</span></button>)}</div></section>)}</nav>
  </>:<><h2>{title}</h2>
   {section&&!item&&<div className="student-guide-grid">{section.items.map((entry,i)=><button type="button" key={entry.page} onClick={()=>go(section.id,i)}>{entry.title}<span>›</span></button>)}</div>}
   {item&&<article className="student-guide-reading">{item.images.map(src=><img key={src} src={src} alt={item.title} loading="lazy"/>)}{item.blocks.map((b,i)=>b.heading?<h3 key={i}>{b.text}</h3>:<p key={i}>{b.text}</p>)}</article>}
   {screen==='before'&&<><p>Elegí la opción según cuánto falta para entrenar. Son alternativas, no tres comidas que debas sumar. Los horarios son orientativos: probá qué tolerás y adaptalo con tu profesional.</p><div className="student-food-training-links">{timings.map((t,i)=><button type="button" key={t.title} onClick={()=>go(`pre-${i}`)}>{t.title}<span>›</span></button>)}</div></>}
   {timing&&<><p>{timing.intro}</p><img className="student-editorial-photo" src={screen==='pre-0'?'/student-food-hero.png':screen==='pre-1'?'/student-food-yogurt.png':'/student-food-banana.png'} alt={`Ideas de alimentos para ${timing.title.toLowerCase()}`}/>{timing.meals.map(([name,body])=><article className="card" key={name}><h3>{name}</h3><p>{body}</p></article>)}<article className="card"><h3>Qué beber</h3><p>{timing.drink}</p></article></>}
   {screen==='after'&&<><img className="student-editorial-photo" src="/student-food-yogurt.png" alt="Yogur con fruta, avena y agua para acompañar una comida de recuperación"/><p>Combiná carbohidratos, proteína y líquido. Si vas a comer pronto, tu comida habitual puede cumplir esta función; no necesitás un batido ni comer contra reloj. Si volvés a entrenar en pocas horas, coordiná la recuperación con tu profesional.</p>{after.map(([name,body])=><article className="card" key={name}><h3>{name}</h3><p>{body}</p></article>)}<article className="card"><h3>Bebidas que acompañan</h3><p>Agua para reponer líquido. Leche o bebida de soja con proteína pueden sumar proteína y energía, solas o con fruta. Las bebidas de almendra o arroz suelen aportar menos proteína: revisá la etiqueta. Las bebidas deportivas pueden ser útiles en ejercicio prolongado, intenso o con mucha sudoración; no son necesarias en todas las sesiones.</p></article></>}
   {(timing||screen==='before'||screen==='after')&&<p className="nutrition-guidance-note">Orientación general, no una dieta individual. Adaptá ingredientes a tus alergias y tolerancia; si tenés una condición de salud, acordalo con tu profesional.</p>}
  </>}
 </div>
}

