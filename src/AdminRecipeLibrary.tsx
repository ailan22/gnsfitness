import { lazy, Suspense, useState } from 'react'

const RecipeCollection = lazy(() => import('./RecipeCollection'))

function Library({ kind, title }: { kind: 'recetas' | 'dulces'; title: string }) {
  const [open, setOpen] = useState(false)
  return <details className="card nutrition-chapter" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{title}</summary>
    {open && <Suspense fallback={<p role="status">Cargando recetas…</p>}><RecipeCollection kind={kind}/></Suspense>}
  </details>
}

export default function AdminRecipeLibrary() {
  return <section className="nutrition-guide" aria-label="Recetarios del administrador">
    <Library kind="recetas" title="GNS El Lado Saludable del placer"/>
    <Library kind="dulces" title="Postres"/>
  </section>
}
