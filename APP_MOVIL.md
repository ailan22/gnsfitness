# GNS FITNESS: preparación para Google Play y App Store

Estado 29/09/2026: APK de depuración ejecutado en el emulador Android; la propietaria confirmó que el acceso y las funciones probadas funcionan. Actualización posterior con biometría, logo y ajustes compilada en APK y AAB Release SIN firma; aún no instalada ni publicada. Ver `PUBLICACION_PENDIENTES.md` para el estado actualizado.
La propietaria eligió publicación personal. Dispone de Windows e iPhone, no de Android ni Mac.

## Preparado

- Capacitor core/cli/android/ios 8.4.3, fijados en package-lock. Auditoría npm al instalar: 0 vulnerabilidades reportadas. Se evitó CLI 8.5 por su dependencia xcode/uuid con aviso moderado.
- Proyectos android y ios generados por la herramienta oficial.
- Nombre visible GNS FITNESS; identificador técnico provisional uy.gnsfitness.app. Confirmar disponibilidad antes de registrar en las tiendas.
- Assets web empaquetados localmente en dist-mobile. No usa server.url ni carga todo el sitio remoto como interfaz.
- Recuperación desde WebView usa la URL pública HTTPS; el alumno cambia su contraseña en el navegador y vuelve a ingresar en la app. No se implementaron enlaces universales ni transferencia de sesión del navegador a la app.
- Dos pruebas cubren recuperación Android/iOS y conservación del origen web. Build web y lint comprobados.

Los cambios están en gns-recovery. No se actualizaron el sitio Cloudflare ni la copia de Downloads. El ZIP v3 publicado sigue siendo la versión anterior funcional.

## Comandos

`npm run mobile:prepare`: build y copia controlada de archivos públicos.
`npm run mobile:sync`: preparación y sincronización Capacitor.
`npm run mobile:android`: abrir proyecto Android Studio instalado.
`npm run mobile:ios`: abrir proyecto Xcode en Mac.

## Pendientes antes de distribuir

1. Android Studio, SDK y JDK 21 instalados; proyecto sincronizado y APK probado en emulador. Falta validación en Android físico. Evitar Studio y emulador simultáneos por los 8 GB de RAM disponibles.
2. Mac con Xcode compatible (propio, prestado o entorno remoto), firma y pruebas iOS. No se contrató servicio Mac ni cuenta de tienda.
3. Íconos y splash reemplazados por recursos del logo aprobado. Falta comprobar áreas seguras/teclado/botón atrás y pantalla pequeña en equipos reales.
4. Probar acceso, cierre de sesión, recuperación pública, persistencia, sesiones vencidas, pérdida de conexión y completar día sin duplicados desde binarios reales.
5. El código de invite-student ya admite los orígenes nativos exactos conservando validación JWT y rol admin; falta desplegar esta actualización en Supabase. SMTP externo sigue pendiente.
6. Información de privacidad y soporte con datos reales de la titular, revisión de eliminación de cuenta/datos y declaraciones de privacidad de ambas tiendas según funciones efectivas. No inventar datos de la titular ni una política definitiva.
7. Cuenta personal de Google Play, verificación y prueba cerrada aplicable; Apple Developer personal y revisión. La aprobación no está garantizada. Firmas/keystore/certificados deben quedar bajo control de la titular, fuera del código y con respaldo.
8. Preparar ficha de tienda y capturas de la versión real probada. Ningún paquete actual está listo para enviar a revisión.

Fuentes:
- https://capacitorjs.com/docs/getting-started
- https://capacitorjs.com/docs/getting-started/environment-setup
- https://support.google.com/googleplay/android-developer/answer/6112435
- https://support.google.com/googleplay/android-developer/answer/14151465
- https://developer.apple.com/programs/enroll/

## Acceso biométrico opcional (29/09/2026)

- Complemento fijado `@capgo/capacitor-native-biometric@8.7.0`, sincronizado para Android y Swift Package Manager en iOS. `NSFaceIDUsageDescription` en español. Copias de seguridad Android deshabilitadas para evitar restaurar material de acceso entre dispositivos.
- Solo aparece en la app nativa. La web mantiene su acceso actual. Después de ingresar con contraseña, la persona activa Face ID, Touch ID o biometría fuerte compatible. Un dispositivo sin biometría configurada conserva el ingreso por contraseña.
- La contraseña no se guarda. La sesión de Supabase permanece en memoria y, si se activa biometría, se persiste cifrada con AES-256-GCM e IV nuevo por escritura. La clave aleatoria se protege en Keychain/Keystore con `BIOMETRY_CURRENT_SET` y se obtiene exclusivamente mediante `getSecureData`; no se usa un simple resultado booleano de autenticación para leer tokens en texto plano.
- La activación comprueba la lectura protegida con un diálogo del sistema. El desbloqueo exige esa lectura, descifrado autenticado y renovación de sesión en Supabase; `observeAccount` valida después el usuario y rol actuales. La renovación de tokens actualiza el cifrado sin nuevas solicitudes biométricas.
- Al actualizar desde la versión anterior se elimina la antigua sesión nativa de localStorage: habrá que ingresar con contraseña una vez. Sin activar biometría, cada arranque nuevo del proceso requiere contraseña. Cancelar la biometría permite reintentar o usar contraseña. Ingresar con contraseña inicia un contexto nuevo y elimina la activación anterior; cerrar sesión también la elimina. Desactivar biometría conserva la sesión abierta, pero elimina su persistencia.
- Este acceso se solicita al iniciar una sesión nueva tras cerrar el proceso. No es un bloqueo automático por cada cambio de aplicación: mientras el proceso permanece abierto, su sesión sigue activa. Usar Cerrar sesión en un celular compartido.
- No hay captura ni almacenamiento de caras o huellas. La compatibilidad e invalidación por cambios de biometría dependen del sistema y del complemento y se deben comprobar en equipos reales.

Pruebas automatizadas: almacenamiento sin texto plano, arranque bloqueado, renovación de tokens, cancelación, cifrado adulterado, cierre durante activación e integración con el SDK real de Supabase usando red simulada. Pruebas de acceso/roles y recuperación incluidas. No se enviaron correos ni se usaron cuentas reales en estas pruebas.

Antes de distribuir esta función, comprobar en Android físico e iPhone: activar/cancelar, cerrar por completo y abrir, desbloquear con biometría correcta e incorrecta, contraseña alternativa, modo sin conexión, sesión revocada, cambio de cuenta, desactivar, cerrar sesión, cambiar huellas/Face ID y reinstalar. Face ID y la compilación iOS requieren Mac/Xcode y siguen pendientes. El emulador necesita una huella configurada por la persona para probar el diálogo biométrico.

Referencia del complemento: https://github.com/Cap-go/capacitor-native-biometric

Validación de esta entrega: 33 pruebas de acceso/sesión/recuperación aprobadas, build web y lint sin errores; `:app:assembleDebug` exitoso con Java 21, un worker y heap de 1 GB. APK de prueba en `android/app/build/outputs/apk/debug/app-debug.apk`. No se instaló esta actualización automáticamente en el emulador. La compilación global de todos los módulos falló por DNS al descargar herramientas auxiliares de Maven; la compilación específica y completa de la aplicación finalizó correctamente. Swift Package Manager se normaliza a rutas con `/` mediante `normalize-ios-paths.mjs` después de cada `mobile:sync` en Windows.
