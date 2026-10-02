import importlib.util
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('drill', Path(__file__).resolve().parents[1]/'scripts/rehearse-hosted-recovery.py')
drill = importlib.util.module_from_spec(spec)
spec.loader.exec_module(drill)


class HostedRecoveryTests(unittest.TestCase):
    def test_selection_preserves_app_acl_but_not_provider_objects(self):
        listing = '''1; 1 1 SCHEMA - public postgres
2; 1 1 SCHEMA - private postgres
3; 1 1 ACL - SCHEMA public postgres
4; 1 1 TABLE DATA public members postgres
5; 1 1 TABLE DATA auth users supabase_auth_admin
6; 1 1 TABLE auth users supabase_auth_admin
7; 1 1 TABLE DATA auth sessions supabase_auth_admin
8; 1 1 TABLE DATA vault secrets supabase_admin
9; 1 1 FUNCTION public example() postgres
10; 1 1 POLICY public members own_member postgres
11; 1 1 TABLE DATA storage objects supabase_storage_admin
12; 1 1 DEFAULT ACL public DEFAULT PRIVILEGES FOR TABLES postgres
13; 1 1 FUNCTION public rls_auto_enable() postgres
'''
        selected = drill.select_objects(listing)
        self.assertEqual([line.split(';')[0] for line in selected.splitlines()], ['2','3','4','5','9','10','12'])

    def test_reject_unrelated_archive(self):
        with self.assertRaises(drill.DrillError):
            drill.select_objects('1; 1 1 TABLE DATA auth users supabase_auth_admin')

    def test_copy_counts_handle_escaped_newlines_and_empty_tables(self):
        sql = 'COPY auth.users (id) FROM stdin;\na\n\\.\nCOPY public.members (id, notes) FROM stdin;\na\tline1\\nline2\n\\.\nCOPY private.audit (id) FROM stdin;\n\\.\n'
        self.assertEqual(drill.copy_counts(sql), {'auth.users':1,'public.members':1,'private.audit':0})

    def test_reject_duplicate_copy(self):
        sql = 'COPY public.members (id) FROM stdin;\n\\.\n' * 2
        with self.assertRaises(drill.DrillError):
            drill.copy_counts(sql)

    def test_provider_failure_does_not_expose_rows_or_passwords(self):
        fake = subprocess.CompletedProcess([], 1, b'', b'ERROR:  42501: private patient text and password should never be returned')
        with patch.object(drill.subprocess, 'run', return_value=fake):
            with self.assertRaises(drill.DrillError) as error:
                drill.run_pg(['psql'], b'')
        self.assertEqual(error.exception.code, 'sqlstate_42501')
        self.assertNotIn('patient', str(error.exception))


if __name__ == '__main__':
    unittest.main()
