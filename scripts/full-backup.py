"""Local, interactive database backup. Never logs passwords or database contents.
This captures DB + tracked source; provider settings/secrets need separate escrow.
"""
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import threading
import zipfile
from datetime import datetime, timezone

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt

PROJECT = Path(__file__).resolve().parents[1]
WORKSPACE = PROJECT.parent
BIN = WORKSPACE / '.backup-tools/pgsql/bin'
MIRROR = WORKSPACE / 'publicaciones/gns-fitness-github'
MAGIC = b'GNSFULL1\0'
AAD = b'GNS full database archive v1'
STATUS = WORKSPACE / '.backup-tools/backup-status.json'

def seal(payload, phrase):
    if len(phrase) < 20:
        raise ValueError('Usá una frase de respaldo de al menos 20 caracteres.')
    salt, nonce = os.urandom(16), os.urandom(12)
    key = Scrypt(salt=salt, length=32, n=2**17, r=8, p=1).derive(phrase.encode('utf-8'))
    return MAGIC + salt + nonce + AESGCM(key).encrypt(nonce, payload, AAD)

def unseal(blob, phrase):
    if not blob.startswith(MAGIC) or len(blob) < len(MAGIC) + 44:
        raise ValueError('Formato de respaldo inválido')
    offset = len(MAGIC)
    salt, nonce = blob[offset:offset+16], blob[offset+16:offset+28]
    key = Scrypt(salt=salt, length=32, n=2**17, r=8, p=1).derive(phrase.encode('utf-8'))
    return AESGCM(key).decrypt(nonce, blob[offset+28:], AAD)

def command(args, env=None, timeout=300):
    result = subprocess.run(args, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            timeout=timeout, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    if result.returncode:
        error = result.stderr.decode('utf-8', errors='replace').lower()
        if 'password authentication failed' in error:
            raise RuntimeError('La base rechazó la contraseña. Volvé a ingresarla sin compartirla.')
        if 'could not translate host name' in error or 'name or service not known' in error:
            raise RuntimeError('No se pudo localizar el servidor. Revisá la conexión a Internet antes de reintentar.')
        if 'permission denied' in error:
            raise RuntimeError('El servidor rechazó permisos de exportación. No se guardó una copia parcial.')
        if 'server version' in error and 'mismatch' in error:
            raise RuntimeError('La versión de PostgreSQL requiere actualizar la herramienta de respaldo.')
        if 'certificate' in error or 'ssl' in error:
            raise RuntimeError('No se pudo verificar la conexión TLS; no se continuará sin validación.')
        raise RuntimeError('La herramienta de respaldo no completó la operación. No se guardó una copia parcial.')
    return result.stdout

def capture(password, phrase, target):
    env = os.environ.copy()
    env.update(PGHOST='db.xwnbeuyywxbqrnlbnskg.supabase.co', PGPORT='5432',
               PGUSER='postgres', PGDATABASE='postgres',
               PGPASSWORD=password, PGSSLMODE='verify-full', PGSSLROOTCERT=str(WORKSPACE / '.backup-tools/supabase-ca.crt'),
               PGCONNECT_TIMEOUT='20', PGAPPNAME='GNS encrypted backup')
    try:
        version = command([str(BIN/'psql.exe'), '-X', '-A', '-t', '-c', 'show server_version_num'], env).strip()
        if int(version) >= 180000:
            raise RuntimeError('Actualizar herramientas al nivel del servidor antes de copiar.')
        archive = command([str(BIN/'pg_dump.exe'), '--format=custom', '--compress=6', '--no-password'], env)
        if not archive.startswith(b'PGDMP'):
            raise RuntimeError('La base no produjo un archivo PostgreSQL válido.')
        # Role passwords are not portable or needed for hosted platform roles.
        roles = command([str(BIN/'pg_dumpall.exe'), '--roles-only', '--no-role-passwords', '--no-password'], env)
        source = command(['git', '-c', 'safe.directory='+str(MIRROR).replace('\\','/'), '-C', str(MIRROR),
                          'archive', '--format=zip', 'HEAD'])
        revision = command(['git', '-c', 'safe.directory='+str(MIRROR).replace('\\','/'), '-C', str(MIRROR),
                            'rev-parse', 'HEAD']).decode().strip()
        entries = {'database.dump': archive, 'roles-without-passwords.sql': roles, 'source.zip': source}
        metadata = {'createdAt': datetime.now(timezone.utc).isoformat(), 'project':'xwnbeuyywxbqrnlbnskg',
                    'serverVersion':version.decode(), 'sourceCommit':revision,
                    'sha256':{name:hashlib.sha256(data).hexdigest() for name,data in entries.items()},
                    'coverage':['PostgreSQL logical database including accessible auth, public, private, storage metadata',
                                'role definitions without role passwords','Git-tracked source at recorded commit'],
                    'notIncluded':['Storage file contents','provider dashboard settings and secret values',
                                   'Apple signing certificates and service credentials','uncommitted source'],
                    'restoreTested':False}
        memory = io.BytesIO()
        with zipfile.ZipFile(memory, 'w', zipfile.ZIP_DEFLATED) as bundle:
            for name,data in entries.items(): bundle.writestr(name,data)
            bundle.writestr('manifest.json', json.dumps(metadata, ensure_ascii=False, indent=2))
        payload = memory.getvalue()
        encrypted = seal(payload,phrase)
        if unseal(encrypted,phrase) != payload: raise RuntimeError('Falló la verificación cifrada.')
        destination = Path(target)
        # Exclusive creation: never overwrite an existing backup.
        with destination.open('xb') as output:
            output.write(encrypted); output.flush(); os.fsync(output.fileno())
        if hashlib.sha256(destination.read_bytes()).digest() != hashlib.sha256(encrypted).digest():
            raise RuntimeError('La copia en disco no coincide. No la consideres válida.')
        STATUS.write_text(json.dumps({'status':'encrypted_database_saved','path':str(destination),
                                     'bytes':len(encrypted),'createdAt':metadata['createdAt'],
                                     'restoreTested':False,'providerConfigurationBackedUp':False}), encoding='utf-8')
    finally:
        env.pop('PGPASSWORD', None)

def main():
    import tkinter as tk
    from tkinter import filedialog, messagebox
    root = tk.Tk(); root.title('GNS FITNESS · Respaldo privado · Conexión corregida'); root.geometry('610x430')
    root.attributes('-topmost', True)
    tk.Label(root, text='Respaldo cifrado de la base de datos', font=('Segoe UI',16,'bold')).pack(pady=12)
    tk.Label(root,text='Ingresá las claves solo aquí. No se envían al chat ni se guardan en archivos.\nLa contraseña de base se usa para conectar con tu Supabase por TLS.', wraplength=570).pack()
    fields=[]
    for label in ['Contraseña de base de datos recién restablecida',
                  'Nueva frase para proteger el respaldo (mínimo 20 caracteres)', 'Repetir la frase del respaldo']:
        tk.Label(root,text=label).pack(anchor='w',padx=22,pady=(10,0))
        entry=tk.Entry(root,show='●',width=75); entry.pack(padx=22); fields.append(entry)
    state=tk.StringVar(value='Guardá la frase del respaldo en tu gestor de contraseñas. Sin ella no se puede recuperar.')
    tk.Label(root,textvariable=state,wraplength=565).pack(pady=14)
    def start():
        password,phrase,repeat=[field.get() for field in fields]
        if not password or len(phrase)<20 or phrase!=repeat:
            messagebox.showerror('Revisá los campos','Ingresá la contraseña y dos frases iguales de al menos 20 caracteres.'); return
        target=filedialog.asksaveasfilename(title='Guardar respaldo cifrado — preferí una unidad externa',
                    defaultextension='.gnsfull',initialfile='GNS-'+datetime.now().strftime('%Y%m%d-%H%M%S')+'.gnsfull',
                    filetypes=[('Respaldo cifrado GNS','*.gnsfull')])
        if not target: return
        for field in fields: field.delete(0,'end');field.config(state='disabled')
        button.config(state='disabled'); state.set('Copiando y cifrando. Esperá sin cerrar esta ventana…')
        def work():
            try:
                capture(password,phrase,target)
                message='Copia cifrada guardada y verificada. Falta probar restauración y completar configuración externa. Avisá «respaldo guardado» en el chat.'
            except Exception as error:
                message=str(error) if isinstance(error,(RuntimeError,ValueError)) else 'No se completó el respaldo; no lo consideres válido. Avisá en el chat.'
                STATUS.write_text(json.dumps({'status':'failed','message':message}),encoding='utf-8')
            def done():
                state.set(message)
                for field in fields: field.config(state='normal')
                button.config(state='normal')
            root.after(0,done)
        threading.Thread(target=work,daemon=True).start()
    button=tk.Button(root,text='Crear copia cifrada',command=start);button.pack(pady=4)
    root.mainloop()

if __name__ == '__main__': main()
