"""Verify an encrypted backup locally, without displaying data or saving plaintext.
Archive verification is NOT a database restoration test.
"""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import re
import threading
import zipfile
from datetime import datetime, timezone

spec = importlib.util.spec_from_file_location('gns_backup', Path(__file__).with_name('full-backup.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)
REPORT = backup.WORKSPACE / '.backup-tools/verification-status.json'
RESTORE_REPORT = backup.WORKSPACE / '.backup-tools/restore-status.json'

def restore_check(path, phrase):
    verify(path, phrase)
    with zipfile.ZipFile(io.BytesIO(backup.unseal(Path(path).read_bytes(), phrase))) as bundle:
        archive = bundle.read('database.dump')
        roles = bundle.read('roles-without-passwords.sql').decode('utf-8')
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    index = subprocess.run([str(backup.BIN/'pg_restore.exe'), '--list'], input=archive,
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120, creationflags=flags)
    if index.returncode: raise ValueError('No se pudo leer el índice de recuperación.')
    selected = []
    for line in index.stdout.decode('utf-8').splitlines():
        if line.startswith(';') or ';' not in line: continue
        item = ' '.join(line.split(';', 1)[1].split()[2:])
        # Include namespace ACLs explicitly: --schema alone omits these entries.
        if re.match(r'^[A-Z ]+ (auth|public|private) ', item) or re.match(r'^(SCHEMA|ACL|COMMENT) - (?:SCHEMA )?(auth|public|private) ', item):
            selected.append(line)
    # Only the object index goes on disk; no rows, SQL or passwords are written.
    with tempfile.TemporaryDirectory(prefix='gns-restore-index-') as directory:
        selection = Path(directory) / 'objects.list'
        selection.write_text('\n'.join(selected) + '\n', encoding='utf-8')
        sql = subprocess.run([str(backup.BIN/'pg_restore.exe'), '--use-list='+str(selection),
                              '--no-owner', '--file=-'], input=archive,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=240, creationflags=flags)
    if sql.returncode:
        raise ValueError('No se pudo preparar la prueba de recuperación.')
    result = subprocess.run(['node', str(backup.PROJECT/'scripts/restore-memory-check.mjs')],
                 input=json.dumps({'sql': sql.stdout.decode('utf-8'), 'roles': roles}).encode('utf-8'),
                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=300,
                 cwd=str(backup.PROJECT), creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    if result.returncode:
        raise ValueError('No se pudo completar la prueba aislada. La copia original está intacta.')
    report = json.loads(result.stdout)
    report.update(path=str(path), testedAt=datetime.now(timezone.utc).isoformat())
    RESTORE_REPORT.write_text(json.dumps(report, indent=2), encoding='utf-8')
    if report['status'] != 'application_restore_tested':
        raise ValueError('La prueba detectó un punto a corregir. Avisá en el chat; el respaldo original sigue intacto.')
    return report

def verify(path, phrase):
    path = Path(path)
    if path.stat().st_size > 512 * 1024 * 1024:
        raise ValueError('El archivo supera el tamaño permitido para esta verificación.')
    blob = path.read_bytes()
    try:
        plain = backup.unseal(blob, phrase)
    except Exception:
        raise ValueError('No se pudo abrir: revisá la frase. Un archivo alterado también produce este error.') from None
    with zipfile.ZipFile(io.BytesIO(plain)) as bundle:
        expected = {'manifest.json', 'database.dump', 'roles-without-passwords.sql', 'source.zip'}
        if set(bundle.namelist()) != expected or len(bundle.infolist()) != 4:
            raise ValueError('El respaldo no contiene los cuatro componentes esperados.')
        if sum(item.file_size for item in bundle.infolist()) > 512 * 1024 * 1024:
            raise ValueError('Contenido demasiado grande para verificar en memoria.')
        manifest = json.loads(bundle.read('manifest.json'))
        entries = {name: bundle.read(name) for name in expected if name != 'manifest.json'}
    for name, data in entries.items():
        if hashlib.sha256(data).hexdigest() != manifest['sha256'].get(name):
            raise ValueError('La integridad de un componente no coincide; conservá el original para revisar.')
    if not entries['database.dump'].startswith(b'PGDMP'):
        raise ValueError('El componente de base de datos tiene un formato inesperado.')
    with zipfile.ZipFile(io.BytesIO(entries['source.zip'])) as source:
        if source.testzip() is not None:
            raise ValueError('No se pudo verificar el código guardado.')
        source_files = len(source.infolist())
    common = dict(input=entries['database.dump'], stderr=subprocess.PIPE, timeout=240,
                  creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    listing = subprocess.run([str(backup.BIN/'pg_restore.exe'), '--list'], stdout=subprocess.PIPE, **common)
    if listing.returncode:
        raise ValueError('PostgreSQL no pudo leer el índice del respaldo.')
    # Decode every archive object, discard SQL directly. No database is contacted.
    decoded = subprocess.run([str(backup.BIN/'pg_restore.exe'), '--file=-'], stdout=subprocess.DEVNULL, **common)
    if decoded.returncode:
        raise ValueError('PostgreSQL no pudo leer todo el contenido del respaldo.')
    inventory = []
    for line in listing.stdout.decode('utf-8', errors='replace').splitlines():
        if ';' in line and not line.startswith(';'):
            rest = line.split(';', 1)[1].strip().split()
            if len(rest) >= 4:
                inventory.append(' '.join(rest[2:]))
    report = {'status': 'archive_integrity_verified', 'path': str(path),
              'verifiedAt': datetime.now(timezone.utc).isoformat(),
              'encryptedSha256': hashlib.sha256(blob).hexdigest(),
              'sourceCommit': manifest.get('sourceCommit'), 'sourceFileCount': source_files,
              'databaseObjectCount': len(inventory), 'restoreTested': False,
              'databaseObjects': inventory,
              'notIncluded': manifest.get('notIncluded', [])}
    REPORT.write_text(json.dumps(report, indent=2), encoding='utf-8')
    return report

def main():
    import tkinter as tk
    from tkinter import filedialog
    root = tk.Tk()
    restore = '--restore' in sys.argv
    root.title('GNS FITNESS · Diagnóstico de recuperación' if restore else 'GNS FITNESS · Verificar respaldo guardado')
    root.geometry('630x370')
    root.attributes('-topmost', True)
    status = json.loads(backup.STATUS.read_text(encoding='utf-8'))
    selected = tk.StringVar(value=status.get('path', ''))
    tk.Label(root, text='Prueba de recuperación en memoria' if restore else 'Verificación privada del respaldo', font=('Segoe UI', 16, 'bold')).pack(pady=14)
    tk.Label(root, text='No modifica la base de datos ni el archivo original.\nIngresá la frase que elegiste al guardar el respaldo, no la contraseña de Supabase.', wraplength=590).pack()
    tk.Label(root, textvariable=selected, wraplength=590).pack(pady=12)
    def choose():
        value = filedialog.askopenfilename(filetypes=[('Respaldo cifrado GNS', '*.gnsfull')])
        if value: selected.set(value)
    tk.Button(root, text='Elegir otro respaldo', command=choose).pack()
    tk.Label(root, text='Frase del respaldo (solo en esta ventana)').pack(pady=(12, 0))
    phrase = tk.Entry(root, show='●', width=65)
    phrase.pack()
    message = tk.StringVar(value='La frase no se guarda ni se envía al chat.')
    tk.Label(root, textvariable=message, wraplength=585).pack(pady=12)
    def start():
        secret, target = phrase.get(), selected.get()
        if not secret or not target:
            message.set('Ingresá la frase y seleccioná el respaldo.'); return
        phrase.delete(0, 'end'); phrase.config(state='disabled'); button.config(state='disabled')
        message.set('Verificando el cifrado, los componentes y la lectura completa…')
        def work():
            try:
                if restore:
                    restore_check(target, secret)
                    text = 'Prueba local de recuperación completada. El original sigue intacto. Avisá «prueba lista». La recuperación de los servicios externos se verifica por separado.'
                else:
                    verify(target, secret)
                    text = 'Archivo íntegro y legible. Avisá «verificación lista» en el chat. La prueba de restauración es el siguiente paso.'
            except Exception as error:
                text = str(error) if isinstance(error, ValueError) else 'No se completó la verificación. Conservá el archivo original y avisá en el chat.'
                if not restore:
                    REPORT.write_text(json.dumps({'status': 'verification_failed', 'message': text}), encoding='utf-8')
            def done():
                message.set(text); phrase.config(state='normal'); button.config(state='normal')
            root.after(0, done)
        threading.Thread(target=work, daemon=True).start()
    button = tk.Button(root, text='Probar recuperación' if restore else 'Verificar mi respaldo', command=start)
    button.pack()
    root.mainloop()

if __name__ == '__main__': main()
