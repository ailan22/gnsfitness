/** Phone login requires an explicit country prefix; never guess a member's country. */
export function loginIdentifier(value: string): { email: string } | { phone: string } | null {
  const trimmed = value.trim()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { email: trimmed }
  if (!/^\+[\d ()-]+$/.test(trimmed)) return null
  const phone = trimmed.replace(/[ ()-]/g, '')
  return /^\+[1-9]\d{7,14}$/.test(phone) ? { phone } : null
}
