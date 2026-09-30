# Revisión de seguridad de GNS FITNESS — 30/09/2026

Estado: correcciones implementadas, probadas y publicadas en la web, Supabase y la función de invitaciones. El dueño todavía debe configurar su segundo factor. No considerar esta revisión una certificación ni una prueba de penetración de toda la infraestructura. Permanecen pendientes los respaldos y las comprobaciones con cuentas reales.

## Cambios

- Migración `cloud/007_security.sql`: revoca privilegios predeterminados sobre
  las ocho tablas de la aplicación y concede únicamente operaciones sujetas a
  RLS. Evita conservar TRUNCATE/TRIGGER y escritura sobre roles. RLS no protege
  TRUNCATE; no se ha demostrado una ruta remota explotable de ese privilegio.
- Administradores y entrenadores deben tener un JWT verificado por Supabase con
  AAL2. El rol se consulta en la tabla protegida, nunca en metadata editable por
  el usuario. Los permisos por alumno y entrenador asignado se conservan.
- Pantalla administrativa con configuración TOTP y verificación del código. La
  migración 007 ya está aplicada: la comprobación también ocurre en el servidor.
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

## Activación realizada y comprobación en línea

- Web publicada en Cloudflare: versión 395a1580, archivo principal index-B3WZXl5L.js. Inicio de sesión visible y sin errores JavaScript. Las cabeceras están incluidas en la publicación; no se verificó por separado cada cabecera HTTP recibida por el cliente.
- Inspección de permisos, políticas y funciones de Supabase antes y después de aplicar 007_security.sql. Resultado: ocho tablas con RLS, sin SELECT anónimo ni TRUNCATE/TRIGGER para authenticated; ambas funciones de autorización exigen AAL2. Historial privado existente y ocho triggers activos. Evidencias locales: security-live-before.txt y security-live-after.txt.
- invite-student desplegada: el panel mostró actualización reciente y el código nuevo. Se conserva la validación de sesión propia (legacy JWT OFF). La sesión del panel expiró al concluir; no se enviaron invitaciones reales.
- Contraseña mínima de 12 caracteres y cambio seguro de contraseña guardados. Confirmación de correo y cambio seguro de correo ya estaban activos. Registro público deshabilitado; inicio anónimo y vinculación manual apagados. TOTP habilitado. Se mantienen las sesiones persistentes y límites existentes.
- Site URL de la app comprobada. Recuperación restringida a la URL exacta de la app y http://localhost:5173/reset-password de desarrollo, sin comodines.
- 97 pruebas distintas aprobadas: suite previa de 91 y seis pruebas nuevas de MFA/cabeceras. El subconjunto de 13 pruebas de MFA/invitaciones/cabeceras pasó. Compilación, lint y revisión de espacios de Git aprobados.

## Pendientes que requieren seguimiento

1. El dueño debe instalar un autenticador y completar personalmente el QR/código en GNS FITNESS. No compartir QR, clave ni códigos por chat. Probar después ingreso de administrador y alumno real, cierre de sesión y recuperación. No se ha confirmado todavía ese recorrido con cuentas reales.
2. **Respaldos:** Database Backups confirma que el plan Free no incluye copias de proyecto. No hay respaldo recuperable verificado. Elegir un plan con copias programadas o un proceso de exportación cifrada independiente; probar restauración en un entorno separado antes de considerar resuelta la continuidad. No se contrató ningún plan ni se modificaron datos de alumnos.
3. Revisar SMTP propio y entrega/recuperación de correos. No se realizó envío a terceros durante esta revisión. El bloqueo de contraseñas filtradas requiere un plan compatible y permanece desactivado.
4. Configurar/verificar MFA en Supabase, GitHub, Cloudflare y Apple; revisar colaboradores e integraciones. Estas cuentas tienen acceso privilegiado independiente del segundo factor de GNS FITNESS.
5. Definir retención de datos e historial, responsables y acceso a respaldos. Los UUID del historial también son datos a proteger. Revisar exportaciones locales, cifrado y bloqueo de la PC; no se eliminaron archivos del usuario.
6. Recompilar y probar versiones Android/iOS con la pantalla MFA actual. La app instalada en Windows usa la publicación web. Face ID en un iPhone real sigue pendiente de validación; no equivale al segundo factor del administrador.

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
