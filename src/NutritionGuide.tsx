import guide from './nutritionGuide.json'

export default function NutritionGuide() {
  return <section className="nutrition-guide" aria-label="Guía de alimentación GNS FITNESS">
    <header className="card"><p className="eyebrow">GUÍA GNS FITNESS</p><h2>{guide.title}</h2><p>{guide.intro}</p>
      <img className="nutrition-photo" src="/nutricion/plato-equilibrado.png" alt="Ejemplo ilustrativo: verduras, arroz y pollo en un plato, acompañado de agua y fruta" loading="lazy"/>
      <p className="muted">Imagen ilustrativa creada con IA. Las cantidades no son una prescripción.</p>
      <p><a href="/nutricion/guia-alimentacion-gns.pdf" target="_blank" rel="noopener noreferrer">Guía completa de alimentación · 17 páginas con imágenes</a></p>
      <p>Nutrición, método del plato, desayunos, meriendas, almuerzos, cenas, pre y postentreno, infusiones y aguas naturales.</p>
      <p><a href="/nutricion/postres-y-recetas-dulces-gns.pdf" target="_blank" rel="noopener noreferrer">Postres y recetas dulces · 14 páginas con imágenes</a></p>
      <p>Ocho recetas con ingredientes, pasos, variantes y cuidados de conservación.</p>
      <p className="muted">{guide.scope}</p>
    </header>
    {guide.sections.map(section => <details className="card nutrition-chapter" key={section.id}>
      <summary>{section.title}</summary><p>{section.lead}</p>
      {section.visual === 'plate' && <img className="nutrition-diagram" src="/nutricion/metodo-plato.svg" alt="Plato orientativo: mitad verduras y frutas, un cuarto proteínas y un cuarto cereales u otra fuente de energía" loading="lazy"/>}
      {(section.visual === 'timing' || section.visual === 'recovery') && <><img className="nutrition-photo" src="/nutricion/colaciones.png" alt="Ejemplos ilustrativos: banana con tostada, y yogur con avena y fruta" loading="lazy"/><p className="muted">Ejemplos ilustrativos creados con IA; ajustá cantidades y tolerancia.</p></>}
      <ul>{section.items.map(item => <li key={item}>{item}</li>)}</ul>
      <div className="nutrition-practice"><strong>Para poner en práctica</strong><p>{section.practice}</p></div>
      <p className="muted">Fuentes: {section.sources.map((id, index) => { const source = guide.sources.find(s => s.id === id)!; return <span key={id}>{index > 0 ? ' · ' : ''}<a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a></span> })}</p>
    </details>)}
    <p className="muted">{guide.edition}. Contenido educativo original. Referencias de redes usadas como inspiración temática, sin afiliación ni aval de sus autores.</p>
  </section>
}
