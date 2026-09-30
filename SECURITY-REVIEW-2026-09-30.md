# Revisión de seguridad de GNS FITNESS — 30/09/2026

Estado: correcciones implementadas y probadas localmente. La activación en la
base de datos y el despliegue de la función de invitaciones requieren una sesión
en el panel de Supabase. No considerar esta revisión una certificación ni una
prueba de penetración de toda la infraestructura.

## Cambios

- Migración `cloud/007_security.sql`: revoca privilegios predeterminados sobre
  las ocho tablas de la aplicación y concede únicamente operaciones sujetas a
  RLS. Evita conservar TRUNCATE/TRIGGER y escritura sobre roles. RLS no protege
  TRUNCATE; no se ha demostrado una ruta remota explotable de ese privilegio.
- Administradores y entrenadores deben tener un JWT verificado por Supabase con
  AAL2. El rol se consulta en la tabla protegida, nunca en metadata editable por
  el usuario. Los permisos por alumno y entrenador asignado se conservan.
- Pantalla administrativa con configuración TOTP y verificación del código. El
  servidor debe aplicar 007: ocultar pantallas por sí solo no protege los datos.
  El QR y la clave de configuración solo se mantienen en memoria; no se registran.
- Historial privado de altas, cambios y bajas: actor, entidad, identificador,
  operación y fecha. No contiene copias de nombres, notas de salud ni credenciales.
  Los usuarios de la app no pueden leerlo, alterarlo ni vaciarlo; un propietario
  de la base de datos conserva privilegios de administración.
- Invitaciones: límite de 1024 bytes durante lectura, JSON inválido rechazado,
  validación de sesión/rol, identidad y correo determinados por el servidor,
  destinos de recuperación fijados y orígenes CORS exactos.
- Publicación web: CSP restringida al sitio y su Supabase, bloqueo de marcos,
  no-sniff, sin referentes, HSTS, restricciones de sensores y `no-store`.
- Se preserva la sesión al bloquear el teléfono. No se agrega cierre por diez
  minutos de inactividad. En equipos compartidos debe usarse Cerrar sesión.

## Validación realizada

`npm audit --json`: 0 vulnerabilidades conocidas en 275 dependencias el 30/09/2026.
Esto no descarta vulnerabilidades nuevas o errores propios de la aplicación.

Pruebas con PostgreSQL/PGlite ejecutando las migraciones: separación entre
alumnos, prohibición de editar roles, restricciones de entrenadores, rechazo de
administradores sin MFA, operaciones legítimas con MFA, prohibición de TRUNCATE,
historial no manipulable y repetición segura de la migración. También se prueban
solicitudes de invitación malformadas y control de la pantalla MFA ante errores.

## Activación pendiente en Supabase

1. Revisar `cloud/VERIFICAR_SEGURIDAD.sql` en el proyecto correcto. Confirmar que
   no existen otras políticas permisivas o RPC con privilegios que el código
   local no incluya. Guardar esquema/configuración y contar con un respaldo
   recuperable antes de cambios en producción.
2. Publicar la aplicación compatible con MFA y comprobar el acceso del dueño.
   El dueño configura su autenticador personalmente: no compartir QR ni clave.
3. Aplicar 007 después de 001–006 y volver a ejecutar la inspección. Probar una
   cuenta de alumno y una de administrador, con y sin segundo factor. No
   desactivar RLS ni reducir permisos para resolver un problema de ingreso.
4. Desplegar `supabase/functions/invite-student/index.ts` con su configuración
   actual de validación de sesión propia. Nunca incluir la clave de servicio en
   Vite, GitHub, capturas o registros.
5. Comprobar política de contraseña mínima de 12 caracteres EN EL SERVIDOR,
   confirmación de correo, cambios de correo seguros, límites de solicitudes y
   bloqueo de contraseñas filtradas si el plan lo permite. El mínimo del formulario
   no basta. Revisar si deben deshabilitarse registros públicos; las cuentas sin
   rol no deben poder leer datos aunque el registro siga habilitado.
6. Revisar Site URL y lista de redirects exactos de recuperación, SMTP propio,
   MFA para las cuentas de Supabase/GitHub/Cloudflare/Apple y accesos de terceros.
   No se verificaron estas configuraciones por falta de sesión en Supabase.
7. Confirmar copias de seguridad, retención y restauración de prueba en un
   entorno separado. Los UUID del historial también requieren retención definida.
   Revisar copias locales/exportaciones en la PC: no se eliminaron archivos del
   usuario. Usar cifrado y bloqueo del equipo; acceso mínimo a los respaldos.

Los alumnos pausados o de baja conservan el comportamiento anterior de consulta
de su propia ficha; el registro de entrenamiento exige estado Activo. Si dar de
baja debe revocar todo acceso, se requiere definir ese comportamiento y aplicarlo
tanto a las políticas como a las sesiones. No equivale a acceso a fichas ajenas.

La aplicación web persiste la sesión en el navegador. La biometría nativa guarda
credenciales cifradas y necesita validación online. Un dispositivo desbloqueado o
comprometido requiere medidas propias; Face ID no sustituye la autorización del
servidor. Las versiones Android/iOS ya instaladas deberán recompilarse para
incorporar esta pantalla MFA; la web instalada en Windows usa la publicación web.

Referencias técnicas: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[MFA](https://supabase.com/docs/guides/auth/auth-mfa),
[contraseñas](https://supabase.com/docs/guides/auth/password-security),
[producción](https://supabase.com/docs/guides/deployment/going-into-prod).
