# Recuperación de GNS FITNESS

## Estado al 1 de octubre de 2026

Se creó un archivo `.gnsfull` cifrado de 21.437.445 bytes. La verificación local pudo descifrarlo con la frase del propietario, comparar los hashes de todos sus componentes y leer los 759 objetos del archivo PostgreSQL. Incluye 295 archivos del código en el commit `5555e3b`. No contiene todavía las últimas guías incorporadas en `14cd05e`.

La integridad del archivo y la restauración local en memoria están comprobadas. El 1 de octubre a las 14:16 (Uruguay) se restauraron 41 tablas: coincidieron las cantidades de registros y pasaron las verificaciones de RLS, acceso anónimo, aislamiento de cuenta sin socio y denegación de exportación no autorizada. Se corrigió el ajuste de sesión row_security que pg_dump deja desactivado durante la carga; las políticas no se modificaron. Los informes locales `.backup-tools/verification-status.json` y `.backup-tools/restore-status.json` distinguen ambos resultados. No deben interpretarse como una certificación de seguridad ni como una recuperación completa de todos los servicios externos.

La publicación web sirve la calculadora y nutrición personalizada (`index-CM5ltwdh.js`, código `feb2206`), comprobado por HTTP 200 y coincidencia con el paquete preparado. No se reenvió una compilación nueva a Apple.

## Qué contiene el archivo cifrado

- `database.dump`: exportación lógica PostgreSQL de los esquemas accesibles, incluidas cuentas de autenticación, datos de aplicación y metadatos de Storage.
- `roles-without-passwords.sql`: definiciones de roles sin contraseñas.
- `source.zip`: código versionado en el commit indicado en el manifiesto.
- `manifest.json`: fecha, versión del servidor, alcance, exclusiones y hashes SHA-256.

La frase cifra el archivo con AES-256-GCM y una clave derivada con scrypt. Se ingresa únicamente en la ventana local. Guardarla separada del archivo, preferentemente en un gestor de contraseñas. Perderla impide recuperar esta copia.

## Pruebas sin tocar producción

1. Ejecutar `scripts/verify-full-backup.py` e ingresar la frase localmente. Verifica cifrado, hashes, ZIP del código e índice/lectura completa del archivo PostgreSQL. No restaura una base.
2. Ejecutar el mismo script con `--restore`. Decodifica en memoria los esquemas `auth`, `public` y `private`, y los restaura en PostgreSQL/PGlite en memoria. Comprueba cantidades por tabla, creación de restricciones y permisos, RLS, denegación de acceso anónimo y aislamiento de una cuenta sin socio vinculado. Descarta esa instancia al terminar.
3. Un resultado `application_restore_tested` cubre esa prueba local. No confirma inicio de sesión en un Supabase nuevo, envío de correo, ejecución de servicios gestionados, extensiones Vault, archivos de Storage ni una compilación iPhone.
4. Antes de recuperación real, probar además en un proyecto Supabase aislado y verificar los servicios externos. No ejecutar una restauración sobre producción para hacer una prueba.

## Configuración externa que hay que conservar y verificar

- Supabase: identificador de proyecto `xwnbeuyywxbqrnlbnskg`, región, versión PostgreSQL, extensiones, Site URL, redirecciones permitidas, proveedores de acceso, políticas de contraseñas/MFA, SMTP, funciones Edge, secretos y tareas programadas. La lista de nombres no reemplaza una copia comprobada de sus valores/configuración.
- Storage: inventario de buckets y archivos; el archivo lógico solo guarda metadatos. El inventario anterior mostraba cero buckets y archivos, pero debe repetirse al crear cada respaldo completo.
- Cloudflare: Worker `still-disk-e7b3`, cuenta del propietario, dominio `still-disk-e7b3.gndevicciconde.workers.dev`, rutas y configuración de despliegue. El paquete estático se reconstruye con `npm ci`, `npm run build` y `node prepare-publication.mjs` usando solo las variables públicas indicadas en `.env.example`.
- iPhone/Codemagic: aplicación `uy.gnsfitness.app`, App Store Connect `6817642980`, integración de Apple, grupo `gns_public_backend`, certificados y perfiles de firma. La configuración de compilación está en `codemagic.yaml`; los secretos externos no están en Git y algunos deben regenerarse si se pierden.
- Acceso a las cuentas de infraestructura: métodos de recuperación y códigos de recuperación MFA, conservados por el propietario fuera del repositorio.

No copiar contraseñas, claves privadas, certificados, tokens ni archivos `.gnsfull` a GitHub, Cloudflare, App Store Connect o al chat. Nunca incorporar credenciales del servidor a las variables `VITE_` de la aplicación.

## Pendientes para continuidad completa

- Prueba local de la copia original confirmada; repetirla sobre cada nueva copia.
- Conservar la configuración externa real y verificar la recuperación de acceso a los proveedores.
- Crear una copia actualizada después de las reformas, sin sobrescribir la anterior.
- La copia original está también en Google Drive con acceso exclusivo del propietario y tamaño verificado; falta cotejo del hash remoto. Subir y verificar cada nueva copia.
- Definir y comprobar frecuencia y retención. Todavía no hay respaldo automático configurado ni probado.
- Realizar una restauración integral en un entorno Supabase separado y las pruebas en iPhone antes de reenviar a Apple.

Ante un incidente, preservar el original, detener cambios que puedan agravar la pérdida, recuperar primero en un entorno separado y comprobar relaciones, permisos, cuentas y eliminaciones posteriores a la fecha de copia. No reactivar datos que hayan sido eliminados por una solicitud de privacidad.

