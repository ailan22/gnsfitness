export function securityHeaders(supabaseUrl) {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(supabaseUrl ?? '')) throw Error('Invalid backend origin')
  const origin = new URL(supabaseUrl).origin
  const policy = ["default-src 'none'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:", "font-src 'self'", `connect-src 'self' ${origin} ${origin.replace('https:', 'wss:')}`,
    "manifest-src 'self'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'",
    "form-action 'self'", 'upgrade-insecure-requests'].join('; ')
  return `/*\n  Content-Security-Policy: ${policy}\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Frame-Options: DENY\n  X-Robots-Tag: noindex, nofollow\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()\n  Strict-Transport-Security: max-age=31536000\n  Cache-Control: no-store\n`
}
