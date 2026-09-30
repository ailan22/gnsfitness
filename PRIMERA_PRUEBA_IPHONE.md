# Primera prueba de GNS FITNESS en iPhone

## Estado
Actualizado el 30/09/2026. Apple Developer activo. Identificador uy.gnsfitness.app registrado bajo el equipo Q99LHQ6N4W. App Store Connect: GNS FITNESS, ID 6817642980, versión 1.0. Codemagic conectado con la integración GNS Codemagic (rol Gestor de apps). Compilación anterior sin firma pasó en macOS. Face ID sigue pendiente de prueba en iPhone real.

Incluye progreso del alumno y solicitudes de Nutrición con aprobación administrativa, además de planes con Kinesiología/Nutrición. Migración 009 aplicada y permisos comprobados. Web publicada: versión c20d31b8.

Certificado Apple Distribution y perfil App Store activos, cargados en Codemagic con referencias gns_ios_distribution y gns_ios_testflight. Primera compilación firmada exitosa el 30/09/2026: 6abcb0fb083ff0a9a53a9db1, commit c975226. IPA 1.0 (2) exportado y subido sin errores a Apple, entrega a7286cd1-a034-4a2f-897f-eeadb8a54af7. Apple terminó el procesamiento: estado **En pruebas** confirmado. Grupo interno **GNS · Prueba personal**, con una compilación y únicamente el titular como tester. La distribución automática del grupo está desactivada.

Para instalar: abrir en el iPhone la invitación enviada a la cuenta del titular, aceptar en TestFlight e instalar GNS FITNESS. Entrar con la cuenta habitual; verificar Face ID y las pruebas siguientes en el dispositivo. El alta en TestFlight no demuestra todavía que esos recorridos funcionen en el iPhone real.

El cifrado del cliente iOS usa Web Crypto del WebView, HTTPS y el Keychain de Apple, sin implementación propia de algoritmos. Info.plist declara ITSAppUsesNonExemptEncryption=false conforme a la exención de documentación para cifrado del sistema. Reevaluar si se incorporan bibliotecas criptográficas nuevas. Referencia: https://developer.apple.com/documentation/Security/complying-with-encryption-export-regulations

## Preparación en la nube
1. Crear/conectar una cuenta GitHub y un repositorio privado. La raíz del repositorio debe ser el contenido de gns-recovery. Preparar una exportación revisada: no subir toda la carpeta de trabajo, respaldos, exportaciones de bases de datos, .env.local, node_modules o claves de firma.
2. Conectar ese repositorio en Codemagic y usar codemagic.yaml. No hay disparadores automáticos; revisar disponibilidad y costo del servicio antes de iniciar una compilación.
3. En Codemagic crear el grupo gns_public_backend con VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY correspondientes al mismo backend actual. Son configuración pública de cliente. Nunca usar service_role ni sb_secret_.
4. Ejecutar manualmente ios-check: instala dependencias, valida configuración, verifica lint, compila recursos web, sincroniza únicamente iOS y ejecuta Xcode sin firma. No genera una app instalable. Resolver allí cualquier error nativo antes de continuar.
5. Una vez activada Apple Developer, registrar uy.gnsfitness.app y crear la app GNS FITNESS en App Store Connect bajo la cuenta personal. Confirmar disponibilidad del identificador. Configurar certificado Apple Distribution y perfil App Store para ese identificador en Codemagic con credenciales gestionadas por la titular.
6. Ejecutar ios-signed para generar el IPA. Usa BUILD_NUMBER + 1; si se migra de servicio o se reinicia el contador, garantizar que el nuevo número supere los ya subidos a Apple.
7. Subir el IPA firmado mediante la integración de App Store Connect de Codemagic después de configurarla. El flujo ios-signed sube la compilación a App Store Connect para TestFlight interno; no envía a revisión pública ni a revisión beta externa. Completar declaraciones que Apple solicite, información de prueba y acceso de TestFlight; instalar TestFlight en el iPhone y aceptar la invitación de prueba.

El ZIP GNS-iPhone-FaceID-20260929-172338.zip es una copia anterior del proyecto con recursos precompilados. No contiene esta configuración CI ni sustituye el repositorio de fuentes para futuras actualizaciones.

## Pruebas de aceptación pendientes
- Entrada con contraseña como administrador y alumno; separación correcta de permisos.
- Activar Face ID tras entrar; cerrar completamente y reabrir; entrar por Face ID.
- Cancelar/no reconocer Face ID: conservar alternativa de contraseña.
- Bloquear pantalla diez minutos y volver. Si el proceso sigue vivo, conservar sesión; si iOS lo termina, pedir desbloqueo o contraseña.
- Cerrar sesión y cambiar de cuenta: impedir recuperar la cuenta cerrada mediante biometría.
- Ver rutinas e historial; comprobar navegación y diseño en el iPhone real.
- Recuperar contraseña desde el correo y completar el cambio.
- Crear acceso de alumno y comprobar entrega de correo externo. CORS de invite-student ya está desplegado: el 30/09/2026 respondió OPTIONS 204 con Access-Control-Allow-Origin: capacitor://localhost. Esa consulta no envió correos ni verificó SMTP.

## Antes de publicar al público
Completar política de privacidad, contacto de soporte, eliminación de cuenta/datos y declaraciones de la tienda con información real. Recoger capturas reales y confirmar resultados anteriores. No confundir prueba TestFlight con publicación en App Store.

## Próximas versiones
Mantener uy.gnsfitness.app y el backend; aumentar el número de compilación en cada entrega. Las modificaciones de base de datos deben conservar compatibilidad con versiones ya instaladas. Probar cada actualización en TestFlight antes de enviarla a la tienda.

Referencias de configuración:
https://docs.codemagic.io/yaml-quick-start/building-an-ionic-app/
https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/
