import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void }

export async function handleInvite(req: Request): Promise<Response> {
  const appUrl = Deno.env.get('APP_URL')
  let origin: string
  try {
    const url = new URL(appUrl ?? '')
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) throw Error('url')
    origin = url.origin
  } catch { return Response.json({ error: 'Falta configurar la dirección de la aplicación.' }, { status: 503 }) }
  const requestOrigin = req.headers.get('origin')
  // Exact native WebView origins; email callbacks still use public APP_URL.
  const allowed = new Set([origin, 'https://localhost', 'capacitor://localhost'])
  const headers = { 'Access-Control-Allow-Origin': requestOrigin && allowed.has(requestOrigin) ? requestOrigin : origin, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' }
  const reply = (status: number, body: object) => Response.json(body, { status, headers })
  if (requestOrigin && !allowed.has(requestOrigin)) return reply(403, { error: 'Origen no permitido.' })
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return reply(405, { error: 'Método no permitido.' })
  const authorization = req.headers.get('authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) return reply(401, { error: 'Iniciá sesión nuevamente.' })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!url || !anon || !service) return reply(503, { error: 'Servicio sin configurar.' })
    const client = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } })
    const { data: identity, error: authError } = await client.auth.getUser(authorization.slice(7))
    if (authError || !identity.user) return reply(401, { error: 'Sesión vencida.' })
    const { data: role, error: roleError } = await client.from('user_roles').select('role').eq('user_id', identity.user.id).maybeSingle()
    if (roleError || role?.role !== 'admin') return reply(403, { error: 'Solo el administrador puede habilitar accesos.' })
    // Bound bytes while streaming, including requests without Content-Length.
    const reader = req.body?.getReader()
    if (!reader) return reply(400, { error: 'Solicitud inválida.' })
    const buffer = new Uint8Array(1024)
    let bytes = 0
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        bytes += value.byteLength
        if (bytes > 1024) { await reader.cancel(); return reply(413, { error: 'Solicitud demasiado grande.' }) }
        buffer.set(value, bytes - value.byteLength)
      }
    } finally { reader.releaseLock() }
    let body
    try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, bytes))) }
    catch { return reply(400, { error: 'Solicitud inválida.' }) }
    if (!body || typeof body !== 'object' || typeof body.member_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.member_id)) return reply(400, { error: 'Socio inválido.' })
    const { data: target, error: prepareError } = await client.rpc('prepare_student_access', { p_member_id: body.member_id })
    if (prepareError || !target) return reply(409, { error: prepareError?.code === 'P0001' ? prepareError.message : 'No se pudo verificar el socio. Revisá su correo y estado.' })
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
    let userId = target.user_id
    const redirectTo = new URL('/reset-password', origin).href
    if (!userId) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(target.email, { redirectTo })
      if (error || !data.user) return reply(502, { error: 'No se pudo confirmar la invitación. Revisá el servicio de correo y reintentá en un minuto.' })
      userId = data.user.id
    }
    const { error: linkError } = await client.rpc('finish_student_access', { p_member_id: body.member_id, p_user_id: userId, p_expected_email: target.email })
    if (linkError) return reply(409, { error: 'No se pudo vincular la cuenta. El correo puede haberse enviado; actualizá la ficha y reintentá en un minuto.' })
    if (target.user_id) {
      const { error } = await admin.auth.resetPasswordForEmail(target.email, { redirectTo })
      if (error) return reply(502, { error: 'La cuenta quedó vinculada, pero no se confirmó el envío del correo. Reintentá en un minuto.' })
    }
    return reply(200, { ok: true, message: 'Cuenta vinculada. El servicio aceptó el envío del correo para establecer la contraseña. Revisá también spam.' })
  } catch { return reply(500, { error: 'No se pudo confirmar la operación. Actualizá la ficha antes de reintentar.' }) }
}
Deno.serve(handleInvite)
