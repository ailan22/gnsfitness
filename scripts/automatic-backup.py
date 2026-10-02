"""Private Windows backup runner. No credentials in arguments, logs or source.

Configure interactively once. A scheduler calls --run; each run skips a verified
copy from today and never overwrites previous archives. Off-site upload is separate.
"""
import ctypes
from ctypes import wintypes
from datetime import datetime
import importlib.util
import json
import hashlib
import os
from pathlib import Path
import sys
import threading
import uuid


def load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


backup = load_module('gns_auto_capture', 'full-backup.py')
verifier = load_module('gns_auto_verify', 'verify-full-backup.py')
PRIVATE = backup.WORKSPACE / '.backup-tools'
CONFIG = PRIVATE / 'automatic-backup.dpapi'
REPORT = PRIVATE / 'automatic-backup-status.json'
ARCHIVES = PRIVATE / 'automatic-archives'


class Blob(ctypes.Structure):
    _fields_ = [('size', wintypes.DWORD), ('data', ctypes.POINTER(ctypes.c_ubyte))]


def protect(data, decrypt=False):
    if os.name != 'nt':
        raise RuntimeError('Esta herramienta requiere Windows.')
    crypt = ctypes.WinDLL('crypt32', use_last_error=True)
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.LocalFree.restype = ctypes.c_void_p
    buffer = ctypes.create_string_buffer(data)
    source = Blob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)))
    result = Blob()
    fn = crypt.CryptUnprotectData if decrypt else crypt.CryptProtectData
    fn.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.c_void_p,
                   ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
    fn.restype = wintypes.BOOL
    # CRYPTPROTECT_UI_FORBIDDEN; no LOCAL_MACHINE flag: bound to current user.
    if not fn(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(result)):
        raise RuntimeError('Windows no pudo proteger o abrir la configuración local.')
    try:
        return ctypes.string_at(result.data, result.size)
    finally:
        kernel.LocalFree(ctypes.cast(result.data, ctypes.c_void_p))


def save_credentials(password, phrase):
    if not password or len(phrase) < 20:
        raise ValueError('Ingresá la contraseña y una frase de al menos 20 caracteres.')
    data = json.dumps({'password': password, 'phrase': phrase}).encode('utf-8')
    sealed = protect(data)
    if protect(sealed, decrypt=True) != data:
        raise RuntimeError('No se pudo verificar la protección de Windows.')
    PRIVATE.mkdir(exist_ok=True)
    temp = CONFIG.with_suffix('.' + uuid.uuid4().hex + '.tmp')
    try:
        temp.write_bytes(sealed)
        os.replace(temp, CONFIG)
    finally:
        if temp.exists():
            temp.unlink()


def write_status(data):
    temp = REPORT.with_suffix('.' + uuid.uuid4().hex + '.tmp')
    try:
        with temp.open('x', encoding='utf-8') as output:
            json.dump(data, output, indent=2)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temp, REPORT)
    finally:
        if temp.exists():
            temp.unlink()


def read_status():
    try:
        value = json.loads(REPORT.read_text(encoding='utf-8-sig'))
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}


def intact_archive(report):
    """Inspect ciphertext only. A stale status file is not integrity evidence."""
    try:
        path = Path(report.get('path', ''))
        if not path.is_file() or path.stat().st_size != report.get('bytes'):
            return False
        with path.open('rb') as source:
            return hashlib.file_digest(source, 'sha256').hexdigest() == report.get('sha256')
    except (OSError, TypeError):
        return False


def run(force=False):
    import msvcrt
    PRIVATE.mkdir(exist_ok=True)
    with (PRIVATE / 'automatic-backup.lock').open('a+b') as lock:
        if lock.tell() == 0:
            lock.write(b'0')
            lock.flush()
        lock.seek(0)
        try:
            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError:
            return {'status': 'already_running'}
        previous = read_status()
        last_verified = previous if previous.get('status') == 'verified' else previous.get('lastVerified')
        try:
            today = datetime.now().astimezone().date().isoformat()
            if previous and not force:
                if previous.get('status') == 'verified' and previous.get('localDate') == today and intact_archive(previous):
                    return {**previous, 'skipped': True}
            secret = json.loads(protect(CONFIG.read_bytes(), decrypt=True))
            ARCHIVES.mkdir(exist_ok=True)
            target = ARCHIVES / ('GNS-auto-' + datetime.now().strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:6] + '.gnsfull')
            write_status({'status': 'running', 'startedAt': datetime.now().astimezone().isoformat(), 'lastVerified': last_verified})
            try:
                backup.capture(secret['password'], secret['phrase'], str(target))
                restored = verifier.restore_check(target, secret['phrase'])
            finally:
                secret.clear()
            integrity = json.loads(verifier.REPORT.read_text(encoding='utf-8'))
            report = {'status': 'verified', 'localDate': today, 'path': str(target),
                      'completedAt': datetime.now().astimezone().isoformat(),
                      'bytes': target.stat().st_size, 'sha256': integrity['encryptedSha256'],
                      'sourceCommit': integrity['sourceCommit'], 'tableCount': len(restored['tables']),
                      'offsiteUploaded': False, 'fullProviderRestoreTested': False}
            write_status(report)
            return report
        except Exception as failure:
            # Do not copy exceptions from providers or subprocesses into logs.
            known = {
                'Windows no pudo proteger o abrir la configuración local.': 'windows_protection',
                'La base rechazó la contraseña. Volvé a ingresarla sin compartirla.': 'database_authentication',
                'No se pudo localizar el servidor. Revisá la conexión a Internet antes de reintentar.': 'database_dns',
                'El servidor rechazó permisos de exportación. No se guardó una copia parcial.': 'database_permissions',
                'La versión de PostgreSQL requiere actualizar la herramienta de respaldo.': 'database_version',
                'No se pudo verificar la conexión TLS; no se continuará sin validación.': 'database_tls',
                'La herramienta de respaldo no completó la operación. No se guardó una copia parcial.': 'database_tool',
            }
            report = {'status': 'failed', 'checkedAt': datetime.now().astimezone().isoformat(), 'lastVerified': last_verified,
                      'reason': known.get(str(failure), 'verification_or_local_error'),
                      'message': 'No se completó el respaldo automático. Revisar conexión, claves y prueba de recuperación. Las copias anteriores se conservan.'}
            write_status(report)
            return report
        finally:
            lock.seek(0)
            msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)


def configure():
    import tkinter as tk
    root = tk.Tk()
    root.title('GNS FITNESS · Preparar respaldo automático')
    root.geometry('680x440')
    root.attributes('-topmost', True)
    tk.Label(root, text='Claves protegidas por Windows', font=('Segoe UI', 16, 'bold')).pack(pady=12)
    tk.Label(root, text='Se guardan cifradas para tu usuario de Windows en esta PC.\nEl proceso podrá usarlas para hacer copias sin pedirlas cada día.\nConservá la frase por separado para recuperar archivos en otra computadora.', wraplength=635).pack()
    fields = []
    for label in ['Contraseña de la base de datos Supabase', 'Frase de cifrado (mínimo 20 caracteres)', 'Repetir la frase']:
        tk.Label(root, text=label).pack(pady=(10, 0))
        field = tk.Entry(root, show='●', width=75)
        field.pack()
        fields.append(field)
    status = tk.StringVar(value='Al guardar, se hará una primera copia y se probará su recuperación. No cambia la app ni borra copias anteriores.')
    tk.Label(root, textvariable=status, wraplength=635).pack(pady=12)
    def submit():
        password, phrase, repeat = [field.get() for field in fields]
        if not password or len(phrase) < 20 or phrase != repeat:
            status.set('Completá la contraseña y dos frases iguales de al menos 20 caracteres.')
            return
        try:
            save_credentials(password, phrase)
        except Exception:
            status.set('No se pudieron guardar las claves protegidas. No se activó el respaldo automático.')
            return
        for field in fields:
            field.delete(0, 'end')
            field.config(state='disabled')
        button.config(state='disabled')
        status.set('Claves protegidas. Creando y comprobando la primera copia…')
        def work():
            report = run()
            text = 'Primera copia automática creada y recuperada en la prueba. Avisá «configuración lista» para programar y comprobar el envío a Drive.' if report['status'] == 'verified' else report.get('message', 'Hay otra copia en ejecución. Esperá a que termine.')
            def done():
                status.set(text)
                for field in fields:
                    field.config(state='normal')
                button.config(state='normal')
            root.after(0, done)
        threading.Thread(target=work, daemon=True).start()
    button = tk.Button(root, text='Guardar claves protegidas y probar', command=submit)
    button.pack()
    root.mainloop()


if __name__ == '__main__':
    if '--run' in sys.argv:
        result = run(force='--force' in sys.argv)
        print(json.dumps(result))
        sys.exit(0 if result['status'] in ('verified', 'already_running') else 1)
    else:
        configure()
