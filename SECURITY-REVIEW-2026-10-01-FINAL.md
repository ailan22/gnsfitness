# Revisión adicional de seguridad y fiabilidad — 1 de octubre de 2026

## Resultado y alcance

Revisión del código de autenticación, biometría, MFA, invitaciones, guardado de entrenamientos, políticas SQL y respaldos; consulta de catálogos de producción sin acceder a fichas personales. Es una revisión del desarrollador, no una auditoría independiente, certificación bancaria ni garantía de ausencia de vulnerabilidades.

## Correcciones

- Cierre de sesión: oculta y desmonta inmediatamente el panel. Intenta revocar la sesión y borrar el acceso biométrico de forma independiente; un fallo del llavero ya no impide contactar al servidor. El tiempo de espera se limita a ocho segundos. Se eliminan las claves locales de esta aplicación y se recarga para descartar memoria. Si no se confirma la revocación remota, se informa al volver al ingreso. Si falla el almacenamiento local, el panel permanece bloqueado y se indica cerrar la app. Los tokens ya emitidos no se vuelven mágicamente inválidos por borrar la copia local.
- Registro administrativo de entrenamientos: compara el contenido completo al reconciliar un reintento. Una respuesta perdida ya no permite presentar cambios posteriores como guardados. Identificador estable y bloqueo inmediato de envíos simultáneos desde el formulario; no sobrescribe el primer registro.

## Evidencia

- 132 pruebas Node aprobadas, incluidas aislamiento entre alumnos, MFA, pagos, privacidad, salud, nutrición, cifrado, restauración local, fallos de sesión y reintentos. Lint y preparación móvil aprobados.
- npm audit: cero vulnerabilidades conocidas entre 275 dependencias en esta consulta. No equivale a descartar defectos propios o vulnerabilidades no publicadas.
- Producción: 16 tablas en public/private, todas con RLS; cero permisos anónimos de SELECT/INSERT/UPDATE/DELETE/TRUNCATE y cero permisos TRUNCATE de authenticated.
- Funciones SECURITY DEFINER propias: sin ejecución anónima y con search_path vacío. Excepción identificada: rls_auto_enable del proveedor retorna event_trigger y usa search_path=pg_catalog; no es un RPC ordinario. No se alteró.
- Primera copia automática previa: cifrada, restauración local de 43 tablas superada, segunda copia en Drive con tamaño y permisos del propietario verificados. La huella remota no se obtuvo. Estas pruebas no equivalen a reconstruir los servicios del proveedor.

## Condiciones pendientes antes de declarar preparación completa

1. Instalar la compilación posterior a 1.0 (11) y verificar cierre normal, cierre sin red, reapertura sin acceso y nuevo ingreso con MFA/Face ID; probar reintento de entrenamiento con cuenta ficticia.
2. Restauración en un proyecto Supabase aislado: inicio de sesión, MFA, correo, funciones y archivos. PGlite solo acredita la prueba local documentada.
3. Custodia separada de configuración y secretos de infraestructura y firma Apple. El respaldo lógico no incluye esos secretos ni objetos binarios de Storage.
4. Automatización diaria dependiente de PC, Codex, red, autorizaciones y sesión de Drive; vigilancia de fallos y espacio disponible. No hay garantía de alta disponibilidad ni de ejecución con PC apagada.
5. Auditoría externa de seguridad, pruebas de penetración con alcance acordado y procedimiento operativo de incidentes. No afirmar equivalencia a BROU u otra entidad financiera.
6. Video actualizado de iPhone, acceso de revisión y respuesta completa a Apple. No reenviar a revisión pública hasta completar las comprobaciones correspondientes.

La precondición transaccional del próximo entrenamiento administrativo sigue pendiente; la lectura previa y el bloqueo de historial no eliminan por sí solos carreras entre dos dispositivos. La ruta del alumno sí incluye la comprobación transaccional existente. No se modificaron políticas SQL ni datos de producción en esta revisión.
