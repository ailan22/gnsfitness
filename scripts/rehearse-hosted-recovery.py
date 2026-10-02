"""Rollback-only recovery rehearsal, fixed empty Supabase target, no plaintext files.

Uses the existing protected Windows backup configuration internally. Never emits
credentials, archive SQL, restored rows or provider error text. This proves only
application/database restoration, not Auth HTTP, MFA portability or an iPhone.
"""
import hashlib
import io
import json
import os
from pathlib import Path
import queue
import re
import subprocess
import tempfile
import threading
import time
import uuid
import zipfile
from datetime import datetime, timezone
import importlib.util

ROOT = Path(__file__).resolve().parents[2]
PRIVATE = ROOT / '.backup-tools'
TARGET = 'faylvxvfctcnwkkcwmlx'
PRODUCTION = 'xwnbeuyywxbqrnlbnskg'
REPORT = PRIVATE / 'hosted-recovery-status.json'
FLAGS = getattr(subprocess, 'CREATE_NO_WINDOW', 0)


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


class DrillError(Exception):
    def __init__(self, code):
        self.code = code
        super().__init__('No se completó el ensayo. Se conserva el respaldo original.')


def select_objects(listing):
    selected = []
    for line in listing.splitlines():
        if line.startswith(';') or ';' not in line:
            continue
        item = ' '.join(line.split(';', 1)[1].split()[2:])
        # Supabase creates this event-trigger function when automatic RLS is on.
        # Keep the destination's provider implementation and its event trigger.
        if re.search(r'\brls_auto_enable\(\)', item):
            continue
        # Preserve application ACLs and policies; managed schemas already exist.
        app = bool(re.match(r'^[A-Z ]+ (public|private) ', item))
        namespace = bool(re.match(r'^(SCHEMA|ACL|COMMENT) - (?:SCHEMA )?(public|private) ', item))
        if item.startswith('SCHEMA - public '):
            continue
        # auth.users supplies application foreign keys, not usable HTTP sessions.
        users = bool(re.match(r'^TABLE DATA auth users ', item))
        if app or namespace or users:
            selected.append(line)
    if not any('TABLE DATA public members ' in line for line in selected):
        raise DrillError('missing_members_archive')
    return '\n'.join(selected) + '\n'


def copy_counts(sql):
    counts = {}
    for match in re.finditer(r'^COPY ((?:public|private|auth)\.[a-z_][a-z_0-9]*) \([^\n]*\) FROM stdin;\r?\n([\s\S]*?)^\\\.\r?\n', sql, re.M):
        if match[1] in counts:
            raise DrillError('duplicate_copy')
        counts[match[1]] = len(match[2].splitlines())
    if 'public.members' not in counts or 'auth.users' not in counts:
        raise DrillError('missing_copy_inventory')
    return counts


def run_pg(args, data, env=None, timeout=240):
    result = subprocess.run(args, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            env=env, timeout=timeout, creationflags=FLAGS)
    if result.returncode:
        # Only PostgreSQL's fixed SQLSTATE is retained, never the message/data.
        found = re.search(rb'ERROR:\s+([0-9A-Z]{5})\b', result.stderr)
        raise DrillError('sqlstate_' + found[1].decode() if found else 'postgres_operation_failed')
    return result.stdout


def write_report(report):
    temporary = REPORT.with_suffix('.' + uuid.uuid4().hex + '.tmp')
    with temporary.open('x', encoding='utf-8') as handle:
        json.dump(report, handle, indent=2)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, REPORT)


def rehearse(password):
    phase = 'preflight'
    started = time.monotonic()
    report = {'status': 'running', 'targetProject': TARGET, 'productionProject': PRODUCTION,
              'startedAt': datetime.now(timezone.utc).isoformat(), 'fullProviderRestoreTested': False,
              'rollbackOnly': True}
    write_report(report)
    env = None
    try:
        if TARGET == PRODUCTION or TARGET != 'faylvxvfctcnwkkcwmlx':
            raise DrillError('invalid_target')
        checker = module('gns_target', 'check-recovery-target.py')
        if checker.probe(password)['status'] != 'ready_empty':
            raise DrillError('target_not_empty')
        phase = 'archive_integrity'
        auto = module('gns_auto_drill', 'automatic-backup.py')
        status = auto.read_status()
        if status.get('status') != 'verified' or not auto.intact_archive(status):
            raise DrillError('archive_not_verified')
        path = Path(status['path'])
        if path.stat().st_size > 512 * 1024 * 1024:
            raise DrillError('archive_too_large')
        # Configuration is opened internally only. Neither passwords nor keys are
        # returned to tools, reports, command arguments or the user interface.
        secrets = json.loads(auto.protect(auto.CONFIG.read_bytes(), decrypt=True))
        try:
            plain = auto.backup.unseal(path.read_bytes(), secrets['phrase'])
        finally:
            secrets.clear()
        with zipfile.ZipFile(io.BytesIO(plain)) as bundle:
            if sum(item.file_size for item in bundle.infolist()) > 512 * 1024 * 1024:
                raise DrillError('archive_too_large')
            manifest = json.loads(bundle.read('manifest.json'))
            archive = bundle.read('database.dump')
        plain = None
        if manifest.get('project') != PRODUCTION or hashlib.sha256(archive).hexdigest() != manifest['sha256']['database.dump']:
            raise DrillError('archive_integrity')
        report.update(archiveSha256=status['sha256'], sourceCommit=manifest.get('sourceCommit'),
                      snapshotCreatedAt=manifest.get('createdAt'))
        phase = 'prepare_restore'
        pg_restore = str(PRIVATE / 'pgsql/bin/pg_restore.exe')
        listing = run_pg([pg_restore, '--list'], archive).decode()
        with tempfile.TemporaryDirectory(prefix='gns-hosted-index-') as directory:
            index = Path(directory) / 'selection.list'
            index.write_text(select_objects(listing), encoding='utf-8')
            # Only object names go on disk. Actual SQL and data stay in memory.
            sql = run_pg([pg_restore, '--no-owner', '--use-list='+str(index), '--file=-'], archive).decode()
        counts = copy_counts(sql)
        env = {k: v for k, v in os.environ.items() if not k.upper().startswith('PG')}
        env.update(PGHOST=f'db.{TARGET}.supabase.co', PGPORT='5432', PGUSER='postgres', PGDATABASE='postgres',
                   PGPASSWORD=password, PGSSLMODE='verify-full', PGSSLROOTCERT=str(PRIVATE/'supabase-ca.crt'),
                   PGCONNECT_TIMEOUT='20', PGAPPNAME='GNS rollback-only recovery rehearsal',
                   PGOPTIONS='-c statement_timeout=120000 -c lock_timeout=10000 -c idle_in_transaction_session_timeout=120000')
        guard = """
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p'))
 OR EXISTS(SELECT 1 FROM auth.users) OR EXISTS(SELECT 1 FROM storage.objects)
 THEN RAISE EXCEPTION USING ERRCODE='ZX001', MESSAGE='target_not_empty'; END IF;
END $$;
SET LOCAL session_replication_role = replica;
"""
        checks = '\nSET LOCAL session_replication_role = origin;\nSET LOCAL row_security = on;\n'
        for table, expected in counts.items():
            checks += f"DO $$ BEGIN IF (SELECT count(*) FROM {table}) <> {expected} THEN RAISE EXCEPTION USING ERRCODE='ZX002', MESSAGE='count_mismatch'; END IF; END $$;\n"
        checks += """
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','private') AND c.relkind='r' AND
  (NOT c.relrowsecurity OR has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')))
 THEN RAISE EXCEPTION USING ERRCODE='ZX003', MESSAGE='unsafe_permissions'; END IF;
END $$;
"""
        fake = str(uuid.uuid4())
        checks += f"SET LOCAL request.jwt.claim.sub = '{fake}';\nSET LOCAL request.jwt.claims = '{{\"sub\":\"{fake}\",\"role\":\"authenticated\",\"aal\":\"aal1\"}}';\nSET LOCAL ROLE authenticated;\n"
        checks += """
DO $$ DECLARE denied boolean := false; BEGIN
 IF EXISTS(SELECT 1 FROM public.members) THEN RAISE EXCEPTION USING ERRCODE='ZX004', MESSAGE='cross_account_access'; END IF;
 BEGIN PERFORM public.export_application_backup(); EXCEPTION WHEN OTHERS THEN denied := true; END;
 IF NOT denied THEN RAISE EXCEPTION USING ERRCODE='ZX005', MESSAGE='export_not_denied'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
"""
        phase = 'transaction_restore_and_checks'
        run_pg([str(PRIVATE/'pgsql/bin/psql.exe'), '-X', '-q', '-A', '-t', '-w',
                '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate'], (guard+sql+checks).encode(), env, 420)
        phase = 'verify_rollback'
        if checker.probe(password)['status'] != 'ready_empty':
            raise DrillError('rollback_not_confirmed')
        report.update(status='hosted_application_rollback_test_passed', rollbackConfirmed=True,
                      tableCount=len(counts), checks=['restored_copy_counts', 'constraints_and_policies',
                      'rls_enabled', 'anonymous_table_access_denied', 'unlinked_student_isolated',
                      'unauthorized_export_denied', 'target_empty_after_rollback'],
                      excluded=['Auth HTTP/login and MFA portability', 'Edge Functions and email',
                                'Storage bytes', 'Physical iPhone on recovery environment', 'Permanent failover'])
    except Exception as exc:
        report.update(status='failed', phase=phase, code=exc.code if isinstance(exc, DrillError) else 'local_or_connection_error')
        # Any error aborts psql and its uncommitted transaction. Check emptiness
        # independently; do not claim rollback verified without this result.
        try:
            checker = module('gns_target_after_failure', 'check-recovery-target.py')
            report['rollbackConfirmed'] = checker.probe(password)['status'] == 'ready_empty'
        except Exception:
            report['rollbackConfirmed'] = False
    finally:
        if env is not None:
            env.pop('PGPASSWORD', None)
        report.update(completedAt=datetime.now(timezone.utc).isoformat(), seconds=round(time.monotonic()-started, 2))
        write_report(report)
    return report


def main():
    import tkinter as tk
    root = tk.Tk()
    root.title('GNS · Ensayo de recuperación en Supabase')
    root.geometry('660x390')
    root.attributes('-topmost', True)
    tk.Label(root, text='Probar el respaldo en recuperación aislada', font=('Segoe UI', 15, 'bold')).pack(pady=18)
    tk.Label(root, text='Se cargarán temporalmente los datos del respaldo verificado,\nse comprobarán conteos y permisos y se deshará toda la carga.\nLa app principal y el archivo original no se modifican.\n\nIngresá la contraseña de GNS recuperacion aislada.', wraplength=610).pack(pady=8)
    entry = tk.Entry(root, show='•', width=52, font=('Segoe UI', 12))
    entry.pack(pady=12)
    status = tk.Label(root, text='La contraseña no se guarda. La clave del respaldo se usa internamente.', wraplength=610)
    status.pack(pady=10)
    mailbox = queue.Queue()

    def worker(password):
        result = rehearse(password)
        mailbox.put('Ensayo completado. Conteos y permisos verificados; carga deshecha.'
                    if result['status'] == 'hosted_application_rollback_test_passed'
                    else 'El ensayo detectó un punto a revisar. Avisá en el chat; el respaldo original se conserva.')

    def submit():
        secret = entry.get()
        if not secret:
            status.config(text='Ingresá la contraseña del proyecto de recuperación.')
            return
        entry.delete(0, tk.END)
        button.config(state='disabled')
        status.config(text='Comprobando y restaurando temporalmente… Dejá esta ventana abierta.')
        threading.Thread(target=worker, args=(secret,), daemon=True).start()

    def poll():
        try:
            status.config(text=mailbox.get_nowait())
            button.config(state='normal')
        except queue.Empty:
            pass
        root.after(300, poll)

    button = tk.Button(root, text='Iniciar ensayo y deshacer la carga', command=submit)
    button.pack(pady=8)
    entry.focus_set()
    root.after(300, poll)
    root.mainloop()


if __name__ == '__main__':
    main()
