// CI uses explicitly configured public frontend values, never service-role keys.
const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) throw new Error('Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in gns_public_backend.')
if (new URL(url).protocol !== 'https:') throw new Error('Supabase URL must use HTTPS.')
if (key.startsWith('sb_secret_')) throw new Error('A secret key must never be bundled into the app.')
if (!key.startsWith('sb_publishable_')) {
  let role
  try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role } catch { /* reject below */ }
  if (role !== 'anon') throw new Error('Use a publishable key or legacy anon key, not a privileged credential.')
}
console.log('Public backend configuration validated; values not printed.')
