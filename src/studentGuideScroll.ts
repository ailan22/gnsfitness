/** Scroll only the reading panel; scrollIntoView also moves the page under the fixed brand. */
export function showGuideStart(target: HTMLElement | null) {
  const panel = target?.closest<HTMLElement>('.cloud-student')
  if (!target || !panel) return
  for (let parent = panel.parentElement; parent; parent = parent.parentElement) {
    parent.scrollTop = 0
  }
  const offset = target.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop
  panel.scrollTo({ top: Math.max(0, offset - 16), behavior: 'instant' })
}
