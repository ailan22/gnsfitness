export type RehabEntry = {
  id: string; member_id: string; kind: string; occurred_on: string; created_at: string;
  episode_id: string | null; correction_of: string | null; payload: Record<string, string>
}

// A discharge closes its episode, not other treatments for the same person.
export function activeRehabByMember(entries: RehabEntry[]) {
  const byId = new Map(entries.map(entry => [entry.id, entry]))
  const superseded = new Set(entries.flatMap(entry => entry.correction_of ? [entry.correction_of] : []))
  function originalId(id: string) {
    const visited = new Set<string>()
    while (byId.get(id)?.correction_of && !visited.has(id)) {
      visited.add(id); id = byId.get(id)!.correction_of!
    }
    return id
  }
  const sorted = entries.filter(entry => !superseded.has(entry.id)).sort((a, b) =>
    b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
  const episodes = new Map<string, RehabEntry>()
  for (const entry of sorted) {
    if (entry.kind !== 'physio_followup' || !entry.episode_id) continue
    const key = `${entry.member_id}:${originalId(entry.episode_id)}`
    if (!episodes.has(key)) episodes.set(key, entry)
  }
  const active = new Map<string, RehabEntry>()
  for (const entry of episodes.values()) {
    if (['En tratamiento', 'Reevaluación'].includes(entry.payload.status) && !active.has(entry.member_id)) active.set(entry.member_id, entry)
  }
  return active
}
