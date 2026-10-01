import { useState } from 'react'
import recipes from './admin-recetas.json'
import desserts from './admin-dulces.json'

type Recipe = typeof recipes.sections[number]['items'][number]

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const [open, setOpen] = useState(false)
  return <details className="nutrition-recipe nutrition-chapter" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{recipe.title}</summary>
    {open && <>
      <p className="muted">{recipe.details}</p>
      <img className="nutrition-photo" src={recipe.image} alt={recipe.title} loading="lazy"/>
      <h4>Ingredientes</h4><p>{recipe.ingredients}</p>
      <h4>Cómo se hace</h4><p>{recipe.method}</p>
      <h4>Por porción · valores estimados</h4>
      {recipe.nutrition.map((line, index) => <p key={index}>{line}</p>)}
    </>}
  </details>
}

export default function RecipeCollection({ kind }: { kind: 'recetas' | 'dulces' }) {
  const data = kind === 'recetas' ? recipes : desserts
  return <>
    <p>{kind === 'recetas' ? '200 recetas organizadas por momento del día.' : '70 postres saludables para disfrutar y compartir.'} Abrí una categoría y elegí una receta.</p>
    <p className="muted">Valores nutricionales aproximados por porción, sin sal extra. Las marcas y la cocción pueden modificarlos. Los micronutrientes indicados son una selección; la vitamina C no contempla pérdidas por cocción. ND significa dato no disponible.</p>
    {data.sections.map(section => <details className="card nutrition-chapter" key={section.id}>
      <summary>{section.title} · {section.items.length} recetas</summary>
      <div className="nutrition-recipes">{section.items.map(recipe => <RecipeCard key={recipe.id} recipe={recipe}/>)}</div>
    </details>)}
  </>
}
