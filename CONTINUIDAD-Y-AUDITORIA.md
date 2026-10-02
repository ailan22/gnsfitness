# Continuidad y verificación independiente de GNS FITNESS

## Estado del 2 de octubre de 2026

La revisión del desarrollador no sustituye una auditoría independiente. La meta es verificar controles concretos de OWASP ASVS 5, con L2 como matriz base y requisitos L3 seleccionados para información de salud. No se declara cumplimiento completo ni equivalencia con un banco.

### Comprobaciones ejecutadas

- 161 pruebas Node aprobadas en esta ampliación. Registro: `output/security-tests-followup-20261002.txt`.
- PostgreSQL 17 real, aislado y con datos ficticios: 40 solicitudes de pago en ocho conexiones; solo diez pagos de 10 aceptados contra un saldo de 100. Los restantes fueron rechazados. Duración observada: 4,204 segundos. No equivale a una prueba de capacidad de producción.
- Copia lógica de esa base ficticia restaurada en otra base; importes y conteos conservados, exportación denegada al alumno y al administrador sin MFA; datos conservados tras reiniciar el servidor. Copia/restauración/comprobaciones: 5,359 segundos. No es el tiempo de recuperación del servicio real.
- La restauración completa debe conservar permisos de los esquemas. El ensayo detectó que filtrar esquemas al crear un dump puede omitir ACL de namespace; la prueba ahora captura la base aislada completa. El respaldo real ya utilizaba un dump completo.
- Producción Supabase: registro público y acceso anónimo desactivados; confirmación de correo, cambio seguro de correo/contraseña y detección de reutilización de refresh tokens activados. Contraseña mínima configurada en 12 caracteres; enlaces/OTP de correo reducidos a 900 segundos y persistencia comprobada.
- Límites observados: 30 accesos/5 minutos/IP, 30 verificaciones OTP/5 minutos/IP y 150 renovaciones/5 minutos/IP. No se redujeron indiscriminadamente: varios alumnos pueden compartir una conexión.

### Controles remotos

En `.github/workflows/public-health.yml`: control horario de HTML, cabeceras y archivo JavaScript principal, con hasta tres intentos ante fallos. En `.github/workflows/security.yml`: pruebas, lint, auditoría de dependencias y compilación al cambiar main, en solicitudes de cambios y diariamente. Dependabot propone revisiones semanalmente; no las aplica automáticamente.

GitHub Actions tenía un presupuesto de gasto adicional de US$0 con detención de uso activada. Se conservó ese límite. Las notificaciones de Actions ya estaban configuradas para fallos por GitHub y correo a la cuenta propietaria. No se probó la entrega del correo mediante un fallo artificial.

Estos controles no consultan fichas, usan permisos de repositorio de solo lectura y no reciben credenciales de producción. GitHub puede demorar ejecuciones o detenerlas al agotarse el cupo. El monitor de disponibilidad no prueba el login, las consultas autenticadas ni el respaldo en Drive. No es un SLA ni una guardia humana.

## Restauración integral pendiente

Creado el proyecto gratuito **GNS recuperacion aislada**, referencia `faylvxvfctcnwkkcwmlx`, separado de producción `xwnbeuyywxbqrnlbnskg`. El panel muestra Healthy, nano, región us-west-2. Data API desactivada, sin exposición automática de tablas y con RLS automático al crearlo. Se desactivaron el registro público y el proveedor de correo; acceso anónimo y demás proveedores están desactivados. No se transfirieron respaldos reales. El propietario confirmó que guardó la contraseña en su gestor, fuera del chat.

El auxiliar `scripts/check-recovery-target.py` solicita la contraseña en una ventana local y solo consulta inventario agregado con TLS verify-full y transacción de solo lectura. Conexión verificada: PostgreSQL 17.11, cero tablas de aplicación, cero usuarios y cero objetos Storage. Informe `.backup-tools/recovery-target-status.json`. Esto todavía no demuestra recuperación integral.

El ensayo `scripts/rehearse-hosted-recovery.py` restaura temporalmente public/private y filas de auth.users para validar referencias, conteos, RLS y denegación de acceso/exportación. Siempre termina en ROLLBACK y comprueba que el destino vuelva a estar vacío; no pretende reconstruir Auth HTTP ni MFA. Primera ejecución: conflicto 42723 por la función automática RLS ya existente; rollback verificado. Se corrigió la selección para conservar `rls_auto_enable()` del proveedor. Cinco pruebas unitarias aprobadas. Repetición del ensayo pendiente.

iPhone 1.0 (13) cargado y asignado al grupo interno GNS · Prueba personal, un tester. [Compilación](https://appstoreconnect.apple.com/teams/65f0861e-3f22-4ef2-ad42-7a185a7a5603/apps/6817642980/testflight/ios/b5a334d2-6676-4a35-b1ee-8e13e97823c3). Aún se necesita confirmación explícita de instalación y prueba física antes de retirar la ruta administrativa antigua. No se envió a revisión pública.

Controles remotos iniciales aprobados: [seguridad](https://github.com/gndevicciconde-a11y/gns-fitness/actions/runs/36965230816) y [disponibilidad pública](https://github.com/gndevicciconde-a11y/gns-fitness/actions/runs/36965465451). Los cambios posteriores aún deben incorporarse al próximo respaldo del código.

Antes de transferir un respaldo real:

1. Confirmar el identificador exacto del destino y rechazar explícitamente el identificador de producción en el auxiliar. Confirmar que está vacío y que no tiene integraciones de correo, pagos ni WhatsApp activas.
2. Confirmar acceso privado y guardar una instantánea de la configuración de ambos entornos sin claves. La copia actual no incluye secretos de proveedor ni certificados de Apple.
3. Utilizar el auxiliar protegido para descifrar y transferir por TLS, sin archivos SQL ni filas en logs. Nunca copiar credenciales al chat ni ponerlas en argumentos de procesos.
4. Restaurar en transacción cuando los objetos lo permitan; comparar conteos, relaciones, funciones, permisos y políticas. Los roles gestionados de Supabase se reconcilian con los del destino; no se sobrescriben contraseñas del proveedor.
5. Verificar Auth, sesiones, MFA, correo, funciones y archivos con identidades ficticias dedicadas. Restaurar tablas de Auth por sí solo no acredita el funcionamiento de sus servicios ni la portabilidad de secretos de MFA entre proyectos.
6. Habilitar API únicamente después de verificar RLS y permisos. Probar aislamiento entre dos alumnos, administrador con/sin MFA y entrenador asignado/no asignado. Probar el cliente web y un iPhone físico.
7. Registrar tiempo real de recuperación y antigüedad de los datos, identificar las partes que requieren reconfiguración o nueva inscripción MFA. Solo entonces actualizar `fullProviderRestoreTested`.

El entorno separado aún no acredita recuperación completa por existir. Conservar el respaldo original y no sustituir producción durante el ensayo.

## Servicio que no dependa de esta PC

La copia cifrada a Drive sigue dependiendo del auxiliar de Windows y del flujo de subida. Para incorporar copia gestionada fuera de la PC, Supabase Pro publica una base desde US$25/mes, con siete días de copias diarias; un proyecto adicional puede sumar desde US$10/mes, más uso/impuestos. También habilita protección de contraseñas filtradas y controles de duración/inactividad de sesión. No se contrató.

Antes de comprar: comprobar el total real de la organización y sus proyectos, límite de gasto, impuestos y política de retención. Mantener la copia externa cifrada como segunda vía. Las copias del proveedor no incluyen los bytes de Storage; hoy el inventario de Storage está vacío. Pro no implica recuperación continua ni soporte bancario 24/7.

Fuentes: [precios oficiales](https://supabase.com/pricing), [copias](https://supabase.com/docs/guides/platform/backups), [seguridad de contraseña](https://supabase.com/docs/guides/auth/password-security), [avisos GitHub](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs).

## Alcance listo para solicitar una auditoría independiente

Objeto: web instalada en Windows, aplicación iPhone, API/funciones Supabase, RLS, datos de salud, copias y despliegues. Entregar acceso a un entorno con datos ficticios y dos alumnos, un entrenador y un administrador; nunca entregar datos reales o claves de producción para una evaluación inicial.

Pruebas requeridas: autorización por objeto y función; elevación de privilegios; MFA y recuperación de cuenta; caducidad y revocación; inyección/XSS; configuración de cabeceras; secretos y dependencias; abusos y límites; reintentos y escrituras concurrentes; restauración, custodia y retención; almacenamiento seguro y biometría en iOS. Incluir prueba de carga con un volumen acordado previamente.

Entregables: matriz ASVS con evidencia por requisito, hallazgos reproducibles y severidad, plan de corrección, repetición de pruebas después de corregir, informe ejecutivo y técnico. Solicitar presupuesto fijo por alcance, plazo y confidencialidad. Excluir destrucción de datos, pruebas de denegación de servicio en producción y comunicación con alumnos. Contratar al evaluador requiere decisión del propietario; una revisión adicional del mismo desarrollador no puede llamarse independiente.

## Pendientes de cierre

- Ensayo integral de Supabase e iPhone con evidencia.
- Copia gestionada fuera de esta PC y decisión sobre costo recurrente.
- Auditoría externa contratada y hallazgos resueltos.
- Nueva versión de iPhone probada; luego retirar la inserción administrativa antigua usando `cloud/FINALIZAR_REGISTRO_SEGURO.sql`.
- Responsable humano y procedimiento de respuesta a avisos; objetivo de recuperación acordado y medido.

No se envió una versión a revisión de Apple en esta ampliación.
