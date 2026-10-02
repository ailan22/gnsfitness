# Revisión de seguridad y confiabilidad — 2 de octubre de 2026

## Alcance y conclusión

Revisión del desarrollador sobre GNS FITNESS: código disponible, dependencias, permisos de producción mediante catálogos, avisos de Supabase, cabeceras HTTPS, respaldo cifrado y pruebas con datos ficticios. No es una auditoría independiente ni una certificación bancaria. No se afirma cumplimiento completo de OWASP ASVS ni equivalencia con BROU/PedidosYa. No se ejecutaron pruebas destructivas o de carga contra producción.

Referencia de exigencia: [OWASP ASVS 5.0](https://github.com/OWASP/ASVS/tree/v5.0.0/5.0). Usar L2 como matriz mínima de evaluación y seleccionar requisitos L3 por el tratamiento de salud; esto es un objetivo de verificación, no un nivel ya alcanzado. El propio estándar considera L3 relevante para aplicaciones bancarias; no conocemos los controles internos de BROU.

## Evidencia de esta revisión

- 157 pruebas Node aprobadas, cero fallos. Incluyen aislamiento entre alumnos, MFA, privacidad, nutrición, biometría, recuperación de contraseña, pagos y reintentos. Registro local: `output/security-tests-20261002.txt`.
- Tres pruebas Python aprobadas con datos ficticios: protección Windows, copia/reintento y reemplazo atómico de informe. La ejecución restringida no permite DPAPI; la ejecución autorizada de Windows sí pasó.
- Pruebas con dos conexiones reales a PostgreSQL 17 local: un único entrenamiento aceptado entre administrador/alumno concurrentes; dos cobros de 60 sobre un saldo de 100 dejan solo uno; dos reservas de sala superpuestas dejan solo una. Totales persistidos: una sesión, importe 60, un turno. Servidor limitado a 127.0.0.1, datos ficticios y detenido al finalizar. Esto NO es una prueba de capacidad ni demuestra un número de usuarios concurrentes.
- `npm audit`: cero vulnerabilidades conocidas, 275 dependencias consultadas. Sin acceso al registro el control falla; no interpreta un error de red como cero vulnerabilidades.
- Lint, TypeScript, build y preparación de recursos móviles aprobados. Preparar recursos no genera una nueva compilación TestFlight.
- Producción: cero tablas public/private sin RLS, cero privilegios anónimos SELECT/INSERT/UPDATE/DELETE/TRUNCATE en esas tablas, cero TRUNCATE de authenticated, cero RPC SECURITY DEFINER ordinarios ejecutables por anon. No se consultaron fichas de socios para este control.
- Storage: cero objetos y cero buckets públicos en esta consulta. Las imágenes/guías actuales forman parte de los recursos del proyecto. Si se empieza a utilizar Storage, habrá que respaldar sus bytes por separado: [documentación de Supabase](https://supabase.com/docs/guides/platform/backups).
- Web pública: HTTP 200, CSP restrictiva para scripts y marcos, HSTS, no-store, nosniff y no-referrer comprobados. Esto no valida por sí solo los flujos autenticados ni la API.
- Archivo cifrado anterior: tamaño y SHA-256 local coinciden. No se obtuvo hash remoto de Drive.

## Correcciones entregadas

1. `017_staff_training.sql`: operación administrativa con MFA/alcance del entrenador en servidor, validación de rutina y resultados, bloqueo transaccional compartido con el alumno, comparación del último registro/día/semana y reintento idempotente. La interfaz usa esa operación en lugar de calcular la validez únicamente antes de insertar. Los registros históricos manuales siguen siendo una función explícita del personal autorizado.
2. Publicación gradual: la función es aditiva. `FINALIZAR_REGISTRO_SEGURO.sql` retira la inserción directa antigua **solo después de actualizar también iPhone**. No ejecutarla antes: rompería el registro administrativo de clientes anteriores. Mientras no se retire, esos clientes conservan la limitación de concurrencia anterior; RLS y MFA siguen vigentes.
3. Respaldo diario: comprueba tamaño y SHA-256 del archivo antes de omitir una copia del mismo día. Conserva la referencia `lastVerified` ante fallos; escribe el informe mediante reemplazo atómico y sincronización a disco. La instantánea del código se obtiene del commit exacto anotado, aunque HEAD cambie durante la captura.
4. Herramientas repetibles: `npm test`, `npm run security:check` y `npm run operations:check`. El control operativo informa fallos de red, ausencia/corrupción/antigüedad de la copia y restauración completa pendiente; no envía datos personales ni lee claves. No constituye un monitor 24/7 ni una nueva automatización programada.

## Advertencias reales y trabajo pendiente

| Prioridad | Hallazgo | Acción y evidencia necesaria |
|---|---|---|
| Alta | No hay restauración integral del servicio acreditada | Crear entorno Supabase separado; restaurar allí, verificar inicio de sesión, MFA, correo, permisos, funciones, archivos y cliente móvil. Medir tiempo real y pérdidas máximas. Nunca restaurar encima de producción para probar. |
| Alta | Respaldo/segunda copia dependen de PC, sesión y conectividad | Trasladar ejecución y supervisión a infraestructura independiente con almacenamiento cifrado y credenciales mínimas; revisar presupuesto y custodia antes de contratar. La copia diaria permite pérdida de cambios posteriores; no es recuperación continua. |
| Alta | No hay vigilancia con respuesta operativa contratada | Definir responsable, alertas fuera de esta PC, tiempos de respuesta y acceso de emergencia. El chat no es un equipo de guardia. |
| Media | Protección de contraseñas filtradas desactivada en Supabase | La [opción del proveedor exige Pro o superior](https://supabase.com/docs/guides/auth/password-security). No se activó una suscripción sin autorización. Revisar además reglas de contraseña, rate limits, CAPTCHA y sesiones en configuración real. |
| Media | Ruta administrativa antigua aún disponible | Actualizar y probar iPhone; después ejecutar FINALIZAR_REGISTRO_SEGURO.sql y verificar rechazo de INSERT directo. |
| Media | Auditor automático muestra funciones SECURITY DEFINER para usuarios autenticados | Son puntos privilegiados intencionales, con controles internos; no quitar permisos indiscriminadamente. Revisar cada función y sus pruebas de denegación al añadir cambios. La función event_trigger rls_auto_enable del proveedor no se trató como un RPC ordinario ni se modificó. |
| Media | Ausencia de pruebas de capacidad/end-to-end completas | Probar volumen representativo y fallos de red en entorno aislado; medir latencia, límites, memoria y consultas. Los listados aún descargan páginas para filtrar/agregar localmente. |
| Alta para acreditar el nivel pedido | Falta auditoría independiente y pruebas de penetración | Entregar alcance, arquitectura, matriz ASVS, informes y entorno ficticio a un especialista externo; corregir y volver a verificar hallazgos. |

Los dos avisos de RLS sin políticas en tablas privadas de auditoría/intentos son denegación por defecto deliberada, no motivo para abrir acceso a alumnos.

## Recuperación e incidentes

1. Ante sospecha de fuga, registrar hora, alcance y acciones; conservar evidencia con acceso restringido, sin copiar fichas o tokens al chat.
2. Contener la cuenta o credencial afectada, revocar sesiones/rotar el secreto en el proveedor cuando corresponda. No borrar la base ni las copias para “limpiar”. Involucrar al responsable del sistema y al proveedor.
3. Localizar la última copia verificada y su recibo remoto. Obtener la frase por el canal protegido del propietario; la configuración DPAPI de esta PC no sustituye custodiar esa frase separadamente.
4. Restaurar primero en un entorno separado. Comparar esquema, conteos, relaciones, permisos y flujos de acceso. Aplicar los cambios posteriores solo si se pueden reconciliar de manera verificable.
5. Cambiar producción únicamente con comprobaciones y un plan de regreso; registrar el tiempo de recuperación y el intervalo de datos no recuperados. Evaluar las obligaciones de comunicación con asesoramiento competente según el incidente.

No se enviaron mensajes a terceros, no se contrató una plataforma y no se remitió la app a revisión de Apple en esta etapa.
