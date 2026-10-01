import { lazy, Suspense, useState } from 'react'

const RecipeCollection = lazy(() => import('./RecipeCollection'))

export default function RecipeLibrary() {
  const [open, setOpen] = useState(false)
  return <section className="nutrition-guide" aria-label="Recetario GNS">
    <details className="card nutrition-chapter" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>Recetario GNS</summary>
      {open && <Suspense fallback={<p role="status">Cargando recetas…</p>}><RecipeCollection/></Suspense>}
    </details>
  </section>
}
