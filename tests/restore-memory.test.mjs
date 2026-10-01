import test from 'node:test'
import assert from 'node:assert/strict'
import {restoreMemory} from '../scripts/restore-memory-check.mjs'

const roles='CREATE ROLE anon;\nCREATE ROLE authenticated;'
const sql=`SET row_security = off;
CREATE TABLE public.members(id integer);
INSERT INTO public.members VALUES (1);
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.members TO authenticated;
CREATE FUNCTION public.export_application_backup() RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Denied' USING ERRCODE='42501'; END; $$;
`

test('restoration resets pg_dump session mode before applying student RLS',async()=>{
 const report=await restoreMemory({roles,sql})
 assert.equal(report.status,'application_restore_tested')
 assert.equal(report.fullProviderRestoreTested,false)
})

test('restoration still detects an RLS policy that exposes another member',async()=>{
 const report=await restoreMemory({roles,sql:sql+'CREATE POLICY unsafe_read ON public.members FOR SELECT TO authenticated USING (true);'})
 assert.equal(report.status,'restore_test_failed')
 assert.equal(report.code,'CROSS_ACCOUNT_ACCESS')
})

test('restoration identifies a missing schema permission without exposing records',async()=>{
 const report=await restoreMemory({roles,sql:sql+'REVOKE ALL ON SCHEMA public FROM PUBLIC, authenticated;'})
 assert.equal(report.status,'restore_test_failed')
 assert.equal(report.code,'42501')
 assert.equal(report.deniedObject,'public')
 assert.ok(report.permissionDiagnostics)
})
