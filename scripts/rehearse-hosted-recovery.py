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
import ctypes

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
    def __init__(self, code, diagnostic=None):
        self.code = code
        self.diagnostic = diagnostic
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
        # Managed-role default privileges belong to the destination provider.
        # postgres cannot ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin.
        # Application object ACLs and postgres defaults remain in the rehearsal.
        if item.startswith('DEFAULT ACL ') and item.endswith(' supabase_admin'):
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
        diagnostic = None
        # Classify only known permission descriptions. Never store full stderr,
        # SQL context, COPY rows, email addresses, JWTs or passwords.
        for phrase, label in [
            (b'could not translate host name', 'dns_resolution'),
            (b'ssl connection has been closed unexpectedly', 'connection_interrupted'),
            (b'server closed the connection unexpectedly', 'connection_interrupted'),
            (b'connection timed out', 'connection_timeout'),
            (b'network is unreachable', 'network_unreachable'),
            (b'could not receive data', 'connection_interrupted'),
            (b'could not send data', 'connection_interrupted'),
            (b'permission denied to change default privileges', 'default_privileges'),
            (b'permission denied to set parameter', 'parameter_permission'),
            (b'permission denied for schema private', 'private_schema_permission'),
            (b'permission denied for schema auth', 'auth_schema_permission'),
            (b'permission denied for table users', 'auth_users_permission'),
            (b'must be owner of', 'object_ownership'),
            (b'permission denied to grant', 'role_grant_permission'),
        ]:
            if phrase in result.stderr.lower():
                diagnostic = label
                break
        raise DrillError('sqlstate_' + found[1].decode() if found else 'postgres_operation_failed', diagnostic)
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
              'rollbackOnly': True, 'connectionMethod': 'session_pooler', 'tlsMode': 'verify-full'}
    write_report(report)
    env = None
    awake = False
    try:
        if os.name == 'nt':
            # A thread-scoped request; released below and by Windows on exit.
            # It does not change power settings or prevent a manual suspension.
            awake = bool(ctypes.windll.kernel32.SetThreadExecutionState(0x80000001))
            report['automaticSleepPreventedDuringTrial'] = awake
        if TARGET == PRODUCTION or TARGET != 'faylvxvfctcnwkkcwmlx':
            raise DrillError('invalid_target')
        checker = module('gns_target', 'check-recovery-target.py')
        if checker.probe(password)['status'] != 'ready_empty':
            raise DrillError('target_not_empty')
        phase = 'archive_integrity'
        report['phase'] = phase
        write_report(report)
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
        report['phase'] = phase
        write_report(report)
        pg_restore = str(PRIVATE / 'pgsql/bin/pg_restore.exe')
        listing = run_pg([pg_restore, '--list'], archive).decode()
        with tempfile.TemporaryDirectory(prefix='gns-hosted-index-') as directory:
            index = Path(directory) / 'selection.list'
            index.write_text(select_objects(listing), encoding='utf-8')
            # Only object names go on disk. Actual SQL and data stay in memory.
            sql = run_pg([pg_restore, '--no-owner', '--use-list='+str(index), '--file=-'], archive).decode()
        counts = copy_counts(sql)
        env = checker.connection_environment(password)
        env.update(PGAPPNAME='GNS rollback-only recovery rehearsal',
                   PGOPTIONS='-c statement_timeout=120000 -c lock_timeout=10000 -c idle_in_transaction_session_timeout=120000')
        guard = """
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p'))
 OR EXISTS(SELECT 1 FROM auth.users) OR EXISTS(SELECT 1 FROM storage.objects)
 THEN RAISE EXCEPTION USING ERRCODE='ZX001', MESSAGE='target_not_empty'; END IF;
END $$;
-- Supabase's empty target grants API roles default access to newly created
-- public tables. pg_dump ACLs describe source grants, not arbitrary extra
-- grants inherited from a different destination. Start app objects with no
-- API defaults, then let archived per-object ACLs and defaults restore them.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
SET LOCAL session_replication_role = replica;
"""
        checks = '\nSET LOCAL session_replication_role = origin;\nSET LOCAL row_security = on;\n'
        for table, expected in counts.items():
            checks += f"DO $$ BEGIN IF (SELECT count(*) FROM {table}) <> {expected} THEN RAISE EXCEPTION USING ERRCODE='ZX002', MESSAGE='count_mismatch'; END IF; END $$;\n"
        checks += """
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','private') AND c.relkind='r' AND
  NOT c.relrowsecurity)
 THEN RAISE EXCEPTION USING ERRCODE='ZX003', MESSAGE='rls_missing'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','private') AND c.relkind='r' AND
  has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'))
 THEN RAISE EXCEPTION USING ERRCODE='ZX006', MESSAGE='anonymous_grants_present'; END IF;
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
        report['phase'] = phase
        write_report(report)
        run_pg([str(PRIVATE/'pgsql/bin/psql.exe'), '-X', '-q', '-A', '-t', '-w',
                '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'], (guard+sql+checks).encode(), env, 420)
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
        safe_code = getattr(exc, 'code', None)
        allowed_probe_codes = {'authentication_failed', 'tls_verification_failed', 'network_error', 'connection_error'}
        report.update(status='failed', phase=phase, code=exc.code if isinstance(exc, DrillError)
                      else safe_code if safe_code in allowed_probe_codes else 'local_or_connection_error')
        # Exception class only: never expose exception text, SQL or credentials.
        report['exceptionType'] = type(exc).__name__ if type(exc).__name__ in {
            'DrillError', 'ProbeError', 'TimeoutExpired', 'JSONDecodeError',
            'SSLError', 'OSError', 'PermissionError', 'FileNotFoundError',
            'UnicodeDecodeError', 'ValueError', 'RuntimeError'} else 'other'
        if isinstance(exc, DrillError) and exc.diagnostic:
            report['diagnostic'] = exc.diagnostic
        # Any error aborts psql and its uncommitted transaction. Check emptiness
        # independently; do not claim rollback verified without this result.
        try:
            checker = module('gns_target_after_failure', 'check-recovery-target.py')
            report['rollbackConfirmed'] = checker.probe(password)['status'] == 'ready_empty'
        except Exception:
            report['rollbackConfirmed'] = False
    finally:
        if awake:
            ctypes.windll.kernel32.SetThreadExecutionState(0x80000000)
        if env is not None:
            env.pop('PGPASSWORD', None)
            Path(env['PGSSLROOTCERT']).unlink(missing_ok=True)
        report.update(completedAt=datetime.now(timezone.utc).isoformat(), seconds=round(time.monotonic()-started, 2))
        write_report(report)
    return report


def main():
    import tkinter as tk
    root = tk.Tk()
    root.title('GNS · Recuperación corregida · Versión 3')
    root.geometry('680x430')
    root.attributes('-topmost', True)
    tk.Label(root, text='Probar el respaldo en recuperación aislada', font=('Segoe UI', 15, 'bold')).pack(pady=18)
    tk.Label(root, text='Se cargarán temporalmente los datos del respaldo verificado,\nse comprobarán conteos y permisos y se deshará toda la carga.\nLa app principal y el archivo original no se modifican.\n\nIngresá la contraseña de GNS recuperacion aislada.', wraplength=610).pack(pady=8)
    entry = tk.Entry(root, show='•', width=52, font=('Segoe UI', 12))
    entry.pack(pady=12)
    status = tk.Label(root, text='La contraseña queda solo en memoria mientras esta ventana esté abierta.\nPermite hasta 3 reintentos al corregir el auxiliar, siempre con rollback.', wraplength=630)
    status.pack(pady=10)
    mailbox = queue.Queue()
    state = {'secret': None, 'busy': False, 'failed': False, 'retries': 0,
             'revision': Path(__file__).stat().st_mtime_ns}

    def worker(password):
        try:
            # Reload reviewed code at each retry without persisting the password.
            current = module('gns_current_drill_' + uuid.uuid4().hex, 'rehearse-hosted-recovery.py')
            result = current.rehearse(password)
            mailbox.put(result['status'] == 'hosted_application_rollback_test_passed')
        except Exception:
            mailbox.put(False)

    def launch():
        state['busy'] = True
        state['failed'] = False
        state['revision'] = Path(__file__).stat().st_mtime_ns
        button.config(state='disabled')
        status.config(text='Comprobando el ensayo corregido… Dejá esta ventana abierta.')
        threading.Thread(target=worker, args=(state['secret'],), daemon=True).start()

    def submit():
        secret = entry.get()
        if not secret:
            status.config(text='Ingresá la contraseña del proyecto de recuperación.')
            return
        entry.delete(0, tk.END)
        state['secret'] = secret
        state['retries'] = 0
        launch()

    def poll():
        try:
            passed = mailbox.get_nowait()
            state['busy'] = False
            state['failed'] = not passed
            if passed:
                state['secret'] = None
            status.config(text='Ensayo completado. Conteos y permisos verificados; carga deshecha.' if passed
                          else 'Punto pendiente de revisión. Dejá abierta esta ventana: puedo reintentar al corregir el auxiliar. El original se conserva.')
            button.config(state='normal')
        except queue.Empty:
            pass
        if state['failed'] and not state['busy'] and state['secret'] and state['retries'] < 3:
            if Path(__file__).stat().st_mtime_ns != state['revision']:
                state['retries'] += 1
                launch()
        root.after(300, poll)

    button = tk.Button(root, text='Iniciar ensayo y deshacer la carga', command=submit)
    button.pack(pady=8)
    entry.focus_set()
    root.after(300, poll)
    root.mainloop()


if __name__ == '__main__':
    main()
