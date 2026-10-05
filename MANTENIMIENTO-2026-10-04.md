# Mantenimiento y capacidad — 4 de octubre de 2026

## Cambios

- Atenuación mínima del dorado en bordes y opciones del inicio del alumno; un poco mayor en GYM NATURE SOUL. Logo original conservado, incluido el verde.
- El resumen administrativo consulta indicadores agregados en PostgreSQL. Ya no descarga todos los pagos y entrenamientos históricos. Los pendientes se entregan de a 25.
- Cuatro índices para pagos, fechas de entrenamientos y último plan. Migración aditiva `cloud/020_dashboard_scale.sql`.
- La función de indicadores exige administrador con doble factor, usa SECURITY INVOKER y conserva las políticas RLS. No permite ejecución anónima.
- Actualización automática del resumen sin peticiones superpuestas; descarta respuestas posteriores al desmontaje. Si falla la consulta, no muestra cifras como si estuvieran actualizadas.
- Aplicado `FINALIZAR_REGISTRO_SEGURO.sql`: revocada la inserción directa de entrenamientos. Las versiones actuales usan la función validada, con comprobación de identidad, estado, secuencia e idempotencia.

## Evidencia

- 165 pruebas automáticas aprobadas; TypeScript, compilación y lint aprobados.
- Auditoría npm: cero vulnerabilidades conocidas en las dependencias examinadas. No equivale a ausencia de vulnerabilidades desconocidas.
- Base aislada PGlite: 2.000 socios, 2.000 rutinas y 120.000 entrenamientos. Totales, paginación, denegación anónima, MFA y aislamiento del alumno verificados. Respuesta inicial de 3.628 bytes. Detalle en `output/dashboard-scale-result.json`.
- PostgreSQL local real: escrituras simultáneas de personal/alumno, pagos y reservas. 40 intentos de pago con 8 conexiones; exactamente 10 aceptados hasta cubrir el saldo, sin sobrecobro. Reserva de sala sin solapamientos.
- Copia y restauración de los datos ficticios en otra base: conteos, aislamiento, MFA y persistencia después de reiniciar aprobados. Detalle en `output/concurrency-report.json`. El primer arranque quedó impedido en el entorno restringido; la repetición autorizada fuera de él pasó.
- Producción, comprobación de metadatos: cero tablas de public/private sin RLS, cero permisos de tablas para anon y cero buckets públicos. Después del cambio: INSERT directo de sessions=false, función de indicadores SECURITY INVOKER=true, ejecución anon=false, cuatro índices presentes.
- Sitio público: HTTPS, CSP restrictiva, HSTS, no-store, nosniff y no-referrer comprobados.
- Respaldo cifrado del 4/10: tamaño y SHA-256 local coinciden con el informe. Hay recibo de segunda copia; esta revisión no volvió a verificar bytes ni permisos remotos en Drive. Esa copia es anterior a este mantenimiento.
- Vista móvil aislada de 390 × 844 revisada con datos ficticios, junto con el resumen administrativo. No sustituye la comprobación del iPhone físico.

## Límites y pendientes reales

Esta prueba demuestra manejo de más de 1.000 personas registradas con rutinas e historial en el escenario examinado. No demuestra 1.000 conexiones simultáneas ni ofrece una garantía de disponibilidad.

La lista administrativa de socios todavía obtiene datos completos para algunos filtros. Para crecimientos mucho mayores debe pasar también a consultas paginadas en servidor. La base sigue en el plan gratuito; deben vigilarse almacenamiento, transferencia, conexiones y latencias reales antes de ampliar uso.

El ensayo de recuperación de aplicación y el ensayo PostgreSQL son satisfactorios, pero **no se ha demostrado la recuperación completa de Supabase Auth, MFA, correo, funciones y archivos del proveedor como servicio operativo**. Sigue pendiente un ensayo integral y un procedimiento de recuperación de esas dependencias. No marcar `fullProviderRestoreTested` como verdadero.

El respaldo diario depende de esta PC, Internet y la sesión de Windows. Una copia diaria no protege cambios posteriores hasta la próxima ejecución. No hay SLA ni auditoría independiente de penetración. No se afirma equivalencia con un banco ni seguridad absoluta.

## Referencias técnicas

- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Supabase: RLS performance and best practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv).
- [OWASP ASVS](https://github.com/owasp/asvs): marco de verificación; esta revisión no constituye certificación ASVS.
