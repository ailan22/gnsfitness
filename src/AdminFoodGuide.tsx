import { useState } from 'react'
import guide from './admin-alimentacion.json'

function GuideItem({ item }: { item: typeof guide.sections[number]['items'][number] }) {
  const [open, setOpen] = useState(false)
  return <details className="nutrition-recipe" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{item.title}</summary>
    {open && <>
      {item.images.map(image => <img key={image} className="nutrition-photo" src={image} alt={item.title} loading="lazy" style={{height:'auto',maxHeight:'none',objectFit:'contain'}}/>)}
      {item.blocks.map((block,index) => block.heading ? <h4 key={index}>{block.text}</h4> : <p key={index}>{block.text}</p>)}
    </>}
  </details>
}

export default function AdminFoodGuide() {
  const [open, setOpen] = useState(false)
  return <details className="card nutrition-chapter" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>GNS · Alimentación saludable</summary>
    {open && <section className="nutrition-guide" aria-label="Guía GNS de alimentación clasificada">
      {guide.sections.map(section => <details className="nutrition-chapter" key={section.id}>
        <summary>{section.title}</summary>
        <div className="nutrition-recipes">{section.items.map(item => <GuideItem key={item.page} item={item}/>)}</div>
      </details>)}
    </section>}
  </details>
}
