type Page<T> = { data: T[] | null; error: unknown; count: number | null }

// Callers must create a fresh, uniquely ordered query with count: 'exact'.
// No partial result escapes if a later page fails or the row count changes.
export async function readAllPages<T>(fetchPage: (from: number, to: number) => PromiseLike<Page<T>>): Promise<{ data: T[] | null; error: unknown }> {
  const rows: T[] = []
  const seenIds = new Set<string | number>()
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
      // Offset pagination can repeat records after a concurrent insertion even
      // when the total count stays unchanged. Never use such a list for totals.
      for (const row of page.data) {
        const id = row && typeof row === 'object' && 'id' in row ? row.id : undefined
        if (typeof id !== 'string' && typeof id !== 'number') continue
        if (seenIds.has(id)) throw new Error('Los registros cambiaron durante la consulta. Actualizá nuevamente.')
        seenIds.add(id)
      }
      rows.push(...page.data)
      if (rows.length === total) return { data: rows, error: null }
      if (page.data.length === 0) throw new Error('La consulta devolvió datos incompletos.')
    }
  } catch (error) {
    return { data: null, error }
  }
}
