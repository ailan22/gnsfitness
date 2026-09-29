# GNS FITNESS — preparación de publicación, 29/09/2026

## Archivos preparados

- `android/app/build/outputs/apk/debug/app-debug.apk`: versión de prueba Android con logo, biometría y ajustes visuales. No es una versión de tienda.
- `android/app/build/outputs/bundle/release/app-release.aab`: bundle Release compilado y comprobado SIN firma. No subirlo aún: necesita la clave de carga de la titular. No se creó ninguna clave ni se inventó una contraseña.
- `store-assets/icon-512.png`: logo exportado para ficha de Google Play.
- `store-assets/icon-1024.png`: logo exportado para App Store; también integrado en el proyecto iOS.
- Proyecto iOS sincronizado; no compilado ni probado en Mac/iPhone.

Nombre visible: **GNS FITNESS**. Identificador actual: `uy.gnsfitness.app`. Versión inicial Android: 1.0, código 1.

## Cambios comprobados

- Recuperación y regreso al inicio con enlaces blancos, incluso visitados. Blanco verificado en navegador local (`rgb(255, 255, 255)`), navegación a recuperación correcta, sin enviar correos.
- Lema ENERGÍA · SALUD · BIENESTAR · VITALIDAD para alumnos y administrador. Datos de cuenta/rol al final del panel.
- Logo aprobado exportado sin redibujarlo para íconos Android/iOS, pantallas de inicio y favicon. Exportación reproducible con `generate-native-branding.mjs`, usando Sharp como argumento o instalado localmente.
- No se agregó temporizador de cierre por inactividad. Pantalla apagada o cambio de aplicación conserva la sesión en memoria mientras viva el proceso. Si el sistema lo termina, el siguiente arranque requiere biometría activada o contraseña. Cerrar sesión elimina el acceso biométrico guardado.
- 27 pruebas de sesión, autorización, entrenamiento, recuperación móvil e invitaciones aprobadas; lint, build web, APK Debug, bundle Release y lint vital de Android aprobados.

## Antes de enviar a las tiendas

1. Probar esta actualización en dispositivos reales, incluida biometría, bloqueo de pantalla 10 minutos, renovación de sesión, recuperación, cierre, cambio de cuenta y áreas seguras. No se verificó Face ID en un iPhone.
2. Actualizar en Supabase la función `supabase/functions/invite-student/index.ts`. El código permite exactamente el origen web configurado, `https://localhost` (Android) y `capacitor://localhost` (iOS); conserva validación de JWT y rol administrador y siempre envía enlaces hacia APP_URL pública. **Este cambio todavía no está desplegado.** Verificar SMTP para correos de alumnos externos; no se enviaron invitaciones de prueba.
3. Completar privacidad, soporte y eliminación de cuenta/datos con información real de la titular, y declaraciones de datos para cada tienda. No inventar contactos ni afirmar funciones no implementadas.
4. Cuenta personal de cada tienda, verificación aplicable, pruebas exigidas y firma bajo control de la titular. Guardar respaldo seguro de la clave de carga Android. Apple Developer: la titular confirmó compra anual y mostró inscripción pendiente el 29/09/2026; falta confirmar activación. No hay publicación realizada.
5. Mac/Xcode, local o en la nube, para compilar y firmar iOS. Se preparó codemagic.yaml y un esquema App compartido; todavía no se ejecutaron en macOS ni se conectaron cuentas/certificados. Ver PRIMERA_PRUEBA_IPHONE.md. Preparar capturas reales de ambas versiones y ficha de tienda.

La compilación técnica está preparada; no se afirma que la app esté lista para revisión o publicada. El sitio web público y el APK anteriormente instalado no se actualizaron automáticamente.
