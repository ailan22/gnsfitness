// Isolated, in-memory PostgreSQL recovery drill. Never prints SQL, rows or errors.
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'
import { randomUUID } from 'node:crypto'

export async function restoreMemory({ sql, roles }) {
  const db = new PGlite({ extensions: { pgcrypto, uuid_ossp } })
  let phase = 'initialize'
  let permissionDiagnostics = null
  try {
    await db.waitReady
    for (const match of roles.matchAll(/^CREATE ROLE (.+);$/gm)) {
      if (match[1] !== 'postgres' && match[1] !== '"postgres"') await db.exec(`CREATE ROLE ${match[1]};`)
    }
    await db.exec('CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions; CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;')
    // pg_restore --schema selects objects, not every namespace bootstrap entry.
    await db.exec('CREATE SCHEMA IF NOT EXISTS auth; CREATE SCHEMA IF NOT EXISTS private;')
    sql = sql.replace(/^\\(?:un)?restrict[^\n]*\n/gm, '')
      .replace(/^CREATE SCHEMA (auth|private|public);$/gm, 'CREATE SCHEMA IF NOT EXISTS $1;')
    let position = 0
    const tables = []
    const copies = /^COPY ([^\n]+) FROM stdin;\r?\n([\s\S]*?)^\\\.\r?\n/gm
    for (const match of sql.matchAll(copies)) {
      phase = 'schema'
      await db.exec(sql.slice(position, match.index))
      phase = 'data'
      await db.exec(`COPY ${match[1]} FROM '/dev/blob';`, { blob: new Blob([match[2]]) })
      const table = match[1].split(' (')[0]
      const expected = match[2] ? match[2].trimEnd().split('\n').length : 0
      const actual = (await db.query(`SELECT count(*)::integer AS n FROM ${table}`)).rows[0].n
      if (actual !== expected) throw Object.assign(new Error(), { code: 'ROW_COUNT_MISMATCH' })
      tables.push({ table, rows: actual })
      position = match.index + match[0].length
    }
    phase = 'constraints_and_permissions'
    await db.exec(sql.slice(position))
    const rls = (await db.query("SELECT count(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private') AND c.relkind='r' AND NOT c.relrowsecurity")).rows[0].n
    if (rls !== 0) throw Object.assign(new Error(), { code: 'MISSING_RLS' })
    phase = 'anonymous_access'
    const exposed = (await db.query("SELECT count(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private') AND c.relkind='r' AND has_table_privilege('anon',c.oid,'SELECT')")).rows[0].n
    if (exposed !== 0) throw Object.assign(new Error(), { code: 'ANONYMOUS_ACCESS' })
    phase = 'student_isolation'
    // pg_dump sets row_security=off for archive loading. Under a student role
    // that setting raises 42501 instead of applying RLS. Restore normal query
    // semantics for the drill; this does not alter policies or grant access.
    await db.exec('SET row_security = on;')
    // Catalog metadata only: never emit restored rows, SQL, tokens or identities.
    permissionDiagnostics = {
      schemas: (await db.query("SELECT nspname AS name, has_schema_privilege('authenticated',oid,'USAGE') AS usage FROM pg_namespace WHERE nspname IN ('auth','public','private') ORDER BY nspname")).rows,
      membersSelect: (await db.query("SELECT has_table_privilege('authenticated','public.members','SELECT') AS allowed, has_any_column_privilege('authenticated','public.members','SELECT') AS any_column")).rows[0],
      functions: (await db.query("SELECT n.nspname AS schema,p.proname AS name,p.prosecdef AS definer,has_function_privilege('authenticated',p.oid,'EXECUTE') AS execute FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='auth' AND p.proname IN ('uid','jwt')) OR (n.nspname='private' AND p.proname IN ('is_admin','is_member_self','is_assigned_trainer')) ORDER BY 1,2")).rows
    }
    const uid = randomUUID()
    phase = 'student_claims'
    await db.query("SELECT set_config('request.jwt.claims',$1,false), set_config('request.jwt.claim.sub',$2,false)", [JSON.stringify({ sub: uid, role: 'authenticated', aal: 'aal1' }), uid])
    phase = 'student_role'
    await db.exec('SET ROLE authenticated;')
    phase = 'student_isolation'
    if ((await db.query('SELECT count(*)::int n FROM public.members')).rows[0].n !== 0) throw Object.assign(new Error(), { code: 'CROSS_ACCOUNT_ACCESS' })
    let rejected = false
    try { await db.query('SELECT public.export_application_backup()') } catch { rejected = true }
    if (!rejected) throw Object.assign(new Error(), { code: 'UNAUTHORIZED_EXPORT' })
    return { status: 'application_restore_tested', schemas: ['auth', 'public', 'private'], tables,
      checks: ['All COPY row counts match', 'Constraints and permissions restored', 'RLS enabled', 'Anonymous SELECT denied', 'Unlinked account sees no members', 'Unauthorized backup export denied'],
      fullProviderRestoreTested: false,
      excluded: ['Supabase service processes and dashboard configuration', 'Storage files and managed schemas', 'Vault secrets and managed extensions', 'External sign-in, email delivery and physical iPhone'] }
  } catch (error) {
    const missingSchema = /^schema "([a-z_]+)" does not exist$/.exec(error.message ?? '')?.[1]
    const denied = /^permission denied for (schema|table|function) ([a-z_]+)$/.exec(error.message ?? '')
    return { status: 'restore_test_failed', phase, code: /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code : 'RESTORE_ERROR', ...(missingSchema ? { missingSchema } : {}), ...(denied ? {deniedObjectType:denied[1],deniedObject:denied[2]} : {}), ...(permissionDiagnostics ? {permissionDiagnostics} : {}) }
  } finally { await db.close() }
}

if (process.argv[1]?.endsWith('restore-memory-check.mjs')) {
  try {
    const buffers = []
    for await (const chunk of process.stdin) buffers.push(chunk)
    const result = await restoreMemory(JSON.parse(Buffer.concat(buffers).toString('utf8')))
    process.stdout.write(JSON.stringify(result))
  } catch { process.stdout.write(JSON.stringify({ status: 'restore_test_failed', phase: 'input', code: 'INPUT_ERROR' })) }
}
