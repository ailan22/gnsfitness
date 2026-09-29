export const publicAppOrigin = 'https://still-disk-e7b3.gndevicciconde.workers.dev'

// Native WebViews have local origins that cannot be used in emails.
export function recoveryUrl(native: boolean, browserOrigin: string): string {
  return new URL('/reset-password', native ? publicAppOrigin : browserOrigin).href
}
