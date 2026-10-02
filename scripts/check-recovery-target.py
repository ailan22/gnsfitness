"""Interactive, read-only preflight for the fixed isolated recovery project.

No backup is decrypted or restored. Password exists only in process memory.
"""
import json
import os
from pathlib import Path
import queue
import subprocess
import threading
import time
import ssl
import tempfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]
TARGET = 'faylvxvfctcnwkkcwmlx'
PRODUCTION = 'xwnbeuyywxbqrnlbnskg'
STATUS = ROOT / '.backup-tools/recovery-target-status.json'


def connection_environment(password):
    # Session pooler endpoint shown by this target's Connect dialog. IPv4 avoids
    # the interrupted direct IPv6 route without relaxing TLS or target checks.
    env = {k: v for k, v in os.environ.items() if not k.upper().startswith('PG')}
    context = ssl.create_default_context()
    context.load_verify_locations(cafile=str(ROOT / '.backup-tools/supabase-ca.crt'))
    with tempfile.NamedTemporaryFile(mode='w', suffix='.crt', prefix='gns-public-ca-',
                                     delete=False, encoding='ascii') as certificate:
        for der in context.get_ca_certs(binary_form=True):
            certificate.write(ssl.DER_cert_to_PEM_cert(der))
    env.update(PGHOST='aws-0-us-west-2.pooler.supabase.com', PGPORT='5432',
               PGUSER='postgres.' + TARGET, PGDATABASE='postgres', PGPASSWORD=password,
               PGSSLMODE='verify-full', PGSSLROOTCERT=certificate.name,
               PGCONNECT_TIMEOUT='20', PGKEEPALIVES='1', PGKEEPALIVESIDLE='20',
               PGKEEPALIVESINTERVAL='10', PGKEEPALIVESCOUNT='3')
    return env


class ProbeError(RuntimeError):
    def __init__(self, code, message):
        self.code = code
        super().__init__(message)
SQL = """
BEGIN READ ONLY;
SELECT json_build_object(
 'database',current_database(),
 'serverVersion',current_setting('server_version_num'),
 'tls',(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),
 'applicationTables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p')),
 'authUsers',(SELECT count(*) FROM auth.users),
 'storageObjects',(SELECT count(*) FROM storage.objects));
ROLLBACK;
"""


def probe(password):
    if TARGET == PRODUCTION:
        raise RuntimeError('Destino de producción bloqueado.')
    env = connection_environment(password)
    env.update(PGAPPNAME='GNS isolated recovery preflight',
               PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=15000')
    try:
        for attempt in range(3):
            result = subprocess.run([str(ROOT / '.backup-tools/pgsql/bin/psql.exe'),
                                 '-X', '-q', '-A', '-t', '-w', '-v', 'ON_ERROR_STOP=1'],
                                input=SQL.encode(), stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                env=env, timeout=50,
                                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            transient = any(phrase in result.stderr.lower() for phrase in (
                b'could not translate host name', b'connection timed out',
                b'network is unreachable', b'could not receive data'))
            if result.returncode and transient and attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            break
        if result.returncode:
            error = result.stderr.decode(errors='replace').lower()
            if 'password authentication failed' in error:
                raise ProbeError('authentication_failed', 'Contraseña rechazada. Usá la del proyecto GNS recuperacion aislada.')
            if 'certificate' in error or 'ssl' in error:
                raise ProbeError('tls_verification_failed', 'No se pudo verificar TLS. Hay que revisar el certificado antes de continuar.')
            raise ProbeError('network_error' if transient else 'connection_error', 'No se pudo comprobar la conexión. Revisaremos red y configuración; no se modificó nada.')
        data = json.loads(result.stdout.decode().strip())
        if data.get('tls') is not True or data.get('database') != 'postgres':
            raise RuntimeError('No se cumplen las condiciones de conexión segura.')
        empty = all(data.get(key) == 0 for key in ('applicationTables', 'authUsers', 'storageObjects'))
        return {'status': 'ready_empty' if empty else 'target_not_empty',
                'targetProject': TARGET, 'checkedAt': datetime.now(timezone.utc).isoformat(),
                'readOnly': True, 'tlsVerifyFull': True, 'inventory': data,
                'fullProviderRestoreTested': False}
    finally:
        env.pop('PGPASSWORD', None)
        Path(env['PGSSLROOTCERT']).unlink(missing_ok=True)


def main():
    import tkinter as tk
    root = tk.Tk()
    root.title('GNS · Comprobar recuperación aislada')
    root.geometry('590x340')
    root.attributes('-topmost', True)
    tk.Label(root, text='Contraseña del proyecto de recuperación', font=('Segoe UI', 14, 'bold')).pack(pady=18)
    tk.Label(root, text='GNS recuperacion aislada\nIngresá la contraseña que acabás de guardar en el gestor.\nEsta comprobación solo lee el destino: no restaura ni borra datos.',
             font=('Segoe UI', 10), wraplength=540).pack(pady=8)
    entry = tk.Entry(root, show='•', width=48, font=('Segoe UI', 12))
    entry.pack(pady=12)
    label = tk.Label(root, text='La contraseña no se guarda ni se envía al chat.', wraplength=540)
    label.pack(pady=8)
    mailbox = queue.Queue()

    def work(secret):
        try:
            report = probe(secret)
            temporary = STATUS.with_suffix('.tmp')
            temporary.write_text(json.dumps(report, indent=2), encoding='utf-8')
            temporary.replace(STATUS)
            mailbox.put('Conexión verificada. Destino vacío y listo para preparar el ensayo.'
                        if report['status'] == 'ready_empty' else 'Conexión verificada, pero el destino contiene datos. Revisaremos antes de continuar.')
        except Exception as exc:
            message = str(exc) if isinstance(exc, RuntimeError) else 'La comprobación no terminó. No se modificó la base.'
            mailbox.put(message)
        finally:
            secret = None

    def submit():
        secret = entry.get()
        if not secret:
            label.config(text='Ingresá la contraseña del proyecto de recuperación.')
            return
        entry.delete(0, tk.END)
        button.config(state='disabled')
        label.config(text='Comprobando conexión segura…')
        threading.Thread(target=work, args=(secret,), daemon=True).start()

    def poll():
        try:
            label.config(text=mailbox.get_nowait())
            button.config(state='normal')
        except queue.Empty:
            pass
        root.after(200, poll)

    button = tk.Button(root, text='Comprobar conexión', command=submit, font=('Segoe UI', 11))
    button.pack(pady=8)
    entry.focus_set()
    root.after(200, poll)
    root.mainloop()


if __name__ == '__main__':
    main()
