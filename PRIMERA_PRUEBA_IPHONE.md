# Primera prueba de GNS FITNESS en iPhone

## Estado
El proyecto contiene Face ID opcional, logo y ajustes de interfaz. No se ha compilado con Xcode ni probado Face ID en un iPhone. La compra de Apple Developer está confirmada; la inscripción sigue pendiente según la última pantalla de la titular.

## Preparación en la nube
1. Crear/conectar una cuenta GitHub y un repositorio privado. La raíz del repositorio debe ser el contenido de gns-recovery. Preparar una exportación revisada: no subir toda la carpeta de trabajo, respaldos, exportaciones de bases de datos, .env.local, node_modules o claves de firma.
2. Conectar ese repositorio en Codemagic y usar codemagic.yaml. No hay disparadores automáticos; revisar disponibilidad y costo del servicio antes de iniciar una compilación.
3. En Codemagic crear el grupo gns_public_backend con VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY correspondientes al mismo backend actual. Son configuración pública de cliente. Nunca usar service_role ni sb_secret_.
4. Ejecutar manualmente ios-check: instala dependencias, valida configuración, verifica lint, compila recursos web, sincroniza únicamente iOS y ejecuta Xcode sin firma. No genera una app instalable. Resolver allí cualquier error nativo antes de continuar.
5. Una vez activada Apple Developer, registrar uy.gnsfitness.app y crear la app GNS FITNESS en App Store Connect bajo la cuenta personal. Confirmar disponibilidad del identificador. Configurar certificado Apple Distribution y perfil App Store para ese identificador en Codemagic con credenciales gestionadas por la titular.
6. Ejecutar ios-signed para generar el IPA. Usa BUILD_NUMBER + 1; si se migra de servicio o se reinicia el contador, garantizar que el nuevo número supere los ya subidos a Apple.
7. Subir el IPA firmado mediante la integración de App Store Connect de Codemagic después de configurarla. El YAML actual NO sube ni publica nada. Completar declaraciones que Apple solicite, información de prueba y acceso de TestFlight; instalar TestFlight en el iPhone y aceptar la invitación de prueba.

El ZIP GNS-iPhone-FaceID-20260929-172338.zip es una copia anterior del proyecto con recursos precompilados. No contiene esta configuración CI ni sustituye el repositorio de fuentes para futuras actualizaciones.

## Pruebas de aceptación pendientes
- Entrada con contraseña como administrador y alumno; separación correcta de permisos.
- Activar Face ID tras entrar; cerrar completamente y reabrir; entrar por Face ID.
- Cancelar/no reconocer Face ID: conservar alternativa de contraseña.
- Bloquear pantalla diez minutos y volver. Si el proceso sigue vivo, conservar sesión; si iOS lo termina, pedir desbloqueo o contraseña.
- Cerrar sesión y cambiar de cuenta: impedir recuperar la cuenta cerrada mediante biometría.
- Ver rutinas e historial; comprobar navegación y diseño en el iPhone real.
- Recuperar contraseña desde el correo y completar el cambio.
- Crear acceso de alumno: primero desplegar CORS de invite-student y verificar SMTP externo. Pendiente del servidor.

## Antes de publicar al público
Completar política de privacidad, contacto de soporte, eliminación de cuenta/datos y declaraciones de la tienda con información real. Recoger capturas reales y confirmar resultados anteriores. No confundir prueba TestFlight con publicación en App Store.

## Próximas versiones
Mantener uy.gnsfitness.app y el backend; aumentar el número de compilación en cada entrega. Las modificaciones de base de datos deben conservar compatibilidad con versiones ya instaladas. Probar cada actualización en TestFlight antes de enviarla a la tienda.

Referencias de configuración:
https://docs.codemagic.io/yaml-quick-start/building-an-ionic-app/
https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/
