type Page<T> = { data: T[] | null; error: unknown; count: number | null }

// Callers must create a fresh, uniquely ordered query with count: 'exact'.
// No partial result escapes if a later page fails or the row count changes.
export async function readAllPages<T>(fetchPage: (from: number, to: number) => PromiseLike<Page<T>>): Promise<{ data: T[] | null; error: unknown }> {
  const rows: T[] = []
  let total: number | undefined
  try {
    while (true) {
      const page = await fetchPage(rows.length, rows.length + 499)
      if (page.error) return { data: null, error: page.error }
      if (!page.data || page.count === null || !Number.isSafeInteger(page.count) || page.count < 0 || page.count > 100_000) {
        throw new Error('No se pudo verificar el tamaño completo de la consulta.')
      }
      if (total !== undefined && total !== page.count) throw new Error('Los registros cambiaron durante la consulta. Actualizá nuevamente.')
      total = page.count
      if (page.data.length > 500 || rows.length + page.data.length > total) throw new Error('Respuesta de paginación inválida.')
      rows.push(...page.data)
      if (rows.length === total) return { data: rows, error: null }
      if (page.data.length === 0) throw new Error('La consulta devolvió datos incompletos.')
    }
  } catch (error) {
    return { data: null, error }
  }
}
