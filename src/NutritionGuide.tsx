import { useState } from 'react'
import guide from './nutritionGuide.json'

function Chapter({ section }: { section: typeof guide.sections[number] }) {
  const [open, setOpen] = useState(false)
  return <details className="card nutrition-chapter" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{section.title}</summary>
    {open && <>
      {section.intro && <p className="muted">{section.intro}</p>}
      <div className="nutrition-recipes">{section.items.map(item => <article className="nutrition-recipe" key={item.title}>
        <h3>{item.title}</h3>
        {item.images.map((image, index) => <img className="nutrition-photo" key={image} src={image} alt={`${item.title}${item.images.length > 1 ? ` · imagen ${index + 1}` : ''}`} loading="lazy"/>)}
        {item.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </article>)}</div>
    </>}
  </details>
}

export default function NutritionGuide() {
  return <section className="nutrition-guide" aria-label="Guías de alimentación GNS FITNESS">
    <header className="card"><p className="eyebrow">BIBLIOTECA GNS FITNESS</p><h2>Comer rico y sentirte bien</h2>
      <p>Abrí una sección para consultar las ideas, ingredientes y preparación de tus comidas.</p>
    </header>
    {guide.sections.map(section => <Chapter key={section.id} section={section}/>)}
  </section>
}
