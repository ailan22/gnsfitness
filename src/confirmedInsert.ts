import type { SupabaseClient } from '@supabase/supabase-js'

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`
  return JSON.stringify(value)
}

// Caller retains the same ID until the form closes. Never overwrite a record
// whose response was lost, and never treat a changed draft as already saved.
export async function confirmedInsert(client: SupabaseClient, table: 'memberships' | 'routines' | 'sessions', row: Record<string, unknown> & { id: string; member_id: string }) {
  const columns = Object.keys(row).join(',')
  const lookup = async () => {
    const result = await client.from(table).select(columns).eq('id', row.id).eq('member_id', row.member_id).maybeSingle()
    if (result.error) throw new Error('No se pudo comprobar el guardado. Conservá el formulario y reintentá cuando vuelva la conexión.')
    const stored = result.data as unknown as Record<string, unknown> | null
    if (!stored) return false
    if (Object.keys(row).some(k => canonical(stored[k]) !== canonical(row[k]))) throw new Error('El primer intento quedó guardado con otros datos. Revisá la ficha antes de crear otro registro; conservá los cambios nuevos.')
    return true
  }
  if (await lookup()) return
  try {
    const result = await client.from(table).insert(row).select('id').single()
    if (!result.error && result.data?.id === row.id) return
  } catch { /* Reconcile the same ID after an interrupted response. */ }
  if (await lookup()) return
  throw new Error('No se pudo confirmar el guardado. Los datos siguen en el formulario; podés reintentar sin duplicar el registro.')
}
