# Revisión de seguridad y continuidad — 01/10/2026

## Alcance y resultado

Revisión de código, migraciones, permisos desplegados, autenticación, integridad de guardado, dependencias y encabezados públicos. No constituye certificación ni prueba de penetración completa. No se consultaron fichas reales para las pruebas y no se descargó la base de producción.

Las capturas de Apple corresponden a **2.1 Information Needed — New App Submission**. Piden video en dispositivo físico, propósito/público, acceso de prueba, servicios externos, alcance regional y documentación aplicable. “Prevent Common Issues” es orientación general; no acredita vulnerabilidades encontradas.

## Correcciones y evidencia

- `confirmedInsert.ts`, CloudMemberHistory y CloudRoutineEditor: altas de planes y rutinas con identificador persistente y reconciliación de respuestas perdidas; se rechaza considerar guardado un reintento con contenido distinto. Bloqueo de operaciones simultáneas y liberación del estado al fallar. No cubre todas las operaciones de edición/copia de la aplicación.
- Migración 012: valida estructura de complementos, precios no negativos, meses coherentes, fechas válidas sin duplicados y dentro del plan. No reescribe históricos. Añade auditoría privada de solicitudes de datos personales.
- Migración 013: exportación de las 12 tablas de aplicación en una consulta coherente, sin el límite de filas REST. Solo administrador con AAL2; acceso anónimo revocado. Límite de 50 MB. No incluye secretos de autenticación.
- BackupPanel/backupCrypto: descarga manual AES-256-GCM, PBKDF2-SHA256 600000 iteraciones, sal e IV aleatorios, frase mínima de 16 caracteres procesada localmente. Se prueban contraseña incorrecta, alteración del archivo, estructura incompleta y cambios del KDF. Verificación del archivo no equivale a restauración.
- Política de privacidad actualizada para reflejar interfaz actual y copias cifradas.

121 pruebas aprobadas, incluidas pruebas PostgreSQL/PGlite de todas las migraciones, aislamiento entre alumnos, rechazo de usuarios sin MFA y consistencia de guardado. Compilación y lint aprobados. Auditoría npm: cero vulnerabilidades conocidas en 275 dependencias; no descarta fallos propios ni futuros.

Producción: consulta de catálogo confirma 14 tablas public/private con RLS, sin SELECT de anon ni TRUNCATE de authenticated. Respuesta pública HTTP 200 con CSP restringida, HSTS, no-store, nosniff y DENY. Migraciones 012 y 013 ejecutadas con resultado “Success. No rows returned”. Comprobación posterior: exportación anónima false, entrada authenticated true con comprobación privada de administrador MFA, tres triggers esperados en memberships/privacy_requests.

Interfaz nueva comprobada en vista aislada con datos ficticios: formulario desplegable y bloqueo sin frase. No se generó una copia de producción. La publicación web del formulario queda pendiente del despliegue del paquete; las validaciones SQL ya están activas.

## Continuidad: pendiente, no asumir resuelta

La exportación manual es un complemento de recuperación de registros. Excluye auth.users completo, archivos de Storage, historial privado, roles/configuración del servidor y secretos. No es un respaldo integral de Supabase y no se realizó una restauración completa en otro proyecto. No hay copia automática del proveedor verificada en el plan Free actual.

Queda pendiente elegir copias programadas del proveedor (sin contratar hasta confirmar costo), definir frecuencia/retención y probar recuperación en proyecto aislado. Para copias manuales: el dueño descarga y verifica el archivo, conserva una segunda copia fuera de la PC y guarda la frase por separado. Nunca subir respaldos a GitHub, Cloudflare, Apple ni al chat. Ante pérdida: preservar evidencia, evitar escrituras, restaurar primero en entorno aislado, comprobar cantidades/relaciones/permisos y probar accesos antes de cambiar producción. Una restauración no debe reactivar cuentas o datos cuya eliminación ya se haya tramitado.

Otros pendientes: revisar recuperación por correo y MFA de cuentas de infraestructura; verificar cuenta de demostración aislada y eliminación de cuenta en la compilación enviada a Apple; pruebas en iPhone físico. El usuario confirmó que tiene iPhone/TestFlight y previamente confirmó que Face ID y doble factor funcionan. Esto no sustituye validar la compilación que revisará Apple.

Guía nutricional de reemplazo: aún no adjuntada. Material existente conservado.
