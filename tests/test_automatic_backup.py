import importlib.util
import json
import hashlib
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('automatic', Path(__file__).parents[1] / 'scripts/automatic-backup.py')
automatic = importlib.util.module_from_spec(spec)
spec.loader.exec_module(automatic)


class AutomaticBackupTests(unittest.TestCase):
    def test_windows_protection_roundtrip_and_tamper(self):
        plain = b'Fictitious test values, never real credentials'
        sealed = automatic.protect(plain)
        self.assertNotIn(plain, sealed)
        self.assertEqual(automatic.protect(sealed, decrypt=True), plain)
        with self.assertRaises(RuntimeError):
            automatic.protect(b'invalid', decrypt=True)

    def test_verified_run_skips_duplicate_and_never_overwrites(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            with patch.multiple(automatic, PRIVATE=root, CONFIG=root/'config', REPORT=root/'status.json', ARCHIVES=root/'archives'):
                automatic.save_credentials('fictitious-db-password', 'fictitious backup phrase 123456789')
                def capture(password, phrase, target):
                    Path(target).write_bytes(b'test encrypted archive')
                integrity = root/'integrity.json'
                integrity.write_text(json.dumps({'encryptedSha256':hashlib.sha256(b'test encrypted archive').hexdigest(),'sourceCommit':'test-commit'}))
                with patch.object(automatic.backup, 'capture', side_effect=capture) as captured, patch.object(automatic.verifier, 'restore_check', return_value={'tables':[{}]}), patch.object(automatic.verifier, 'REPORT', integrity):
                    first = automatic.run()
                    second = automatic.run()
                    self.assertEqual(first['status'], 'verified')
                    self.assertTrue(second['skipped'])
                    self.assertEqual(captured.call_count, 1)
                    self.assertFalse(first['offsiteUploaded'])
                    third = automatic.run(force=True)
                    self.assertEqual(third['status'], 'verified')
                    self.assertNotEqual(first['path'], third['path'])
                    self.assertTrue(Path(first['path']).exists())
                    self.assertEqual(captured.call_count, 2)
                    # Existing filename and length alone cannot pass integrity checks.
                    Path(third['path']).write_bytes(b'X'*third['bytes'])
                    self.assertFalse(automatic.intact_archive(third))
                    fourth = automatic.run()
                    self.assertNotIn('skipped', fourth)
                    self.assertEqual(captured.call_count, 3)
                with patch.object(automatic.backup, 'capture', side_effect=RuntimeError('Do not leak sensitive provider details')):
                    failure = automatic.run(force=True)
                    self.assertEqual(failure['status'], 'failed')
                    self.assertEqual(failure['lastVerified']['path'], fourth['path'])
                    self.assertTrue(automatic.intact_archive(failure['lastVerified']))
                automatic.REPORT.unlink()
                with patch.object(automatic.backup, 'capture', side_effect=RuntimeError('Do not leak sensitive provider details')):
                    self.assertEqual(automatic.run()['status'], 'failed')
                self.assertNotIn('provider details', automatic.REPORT.read_text())
                self.assertTrue(Path(first['path']).exists())

    def test_atomic_report_replacement_preserves_previous_on_failure(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder)/'status.json'
            with patch.object(automatic, 'REPORT', target):
                automatic.write_status({'status':'verified'})
                with patch.object(automatic.os, 'replace', side_effect=OSError('disk error')):
                    with self.assertRaises(OSError):
                        automatic.write_status({'status':'running'})
                self.assertEqual(automatic.read_status()['status'], 'verified')
                target.write_text('{broken')
                self.assertEqual(automatic.read_status(), {})


if __name__ == '__main__':
    unittest.main()
