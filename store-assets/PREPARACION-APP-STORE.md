# GNS FITNESS · preparación para App Store

Estado al 30/09/2026. **No enviada a revisión ni publicada en App Store.**

Compilación 1.0 (6) cargada correctamente a App Store Connect, build Codemagic `6abd21c1083ff0a9a53abf1c`, entrega `0743920d-44d1-439a-8e86-037b264ef43c`. Esta carga precede a la corrección del correo público; generar otro binario cuando las páginas legales estén definitivas. El intento anterior repitió el número 2: corregido con `PROJECT_BUILD_NUMBER` para ambos flujos firmados.

Capturas generadas en build `6abd190f083ff0a9a53abc45` (iPhone y iPad con datos ficticios). Pendientes de descargar, revisar visualmente y adjuntar. La sesión web de App Store Connect expiró: volver a ingresar para completar la ficha.

## Preparado

- Face ID confirmado en el iPhone por el titular.
- Versión instalada anteriormente: 1.0 (2), TestFlight interno. No se puede presentar esa compilación para distribución pública.
- Nuevo flujo manual `ios-app-store` con firma App Store y sin `testFlightInternalTestingOnly`. Sube el archivo a Apple pero no solicita revisión ni publica automáticamente.
- Descripción, texto promocional y palabras clave redactados en `app-store-es.json`; guardados como borrador en App Store Connect. Publicación manual seleccionada y verificada.
- Contacto público confirmado: gndevicciconde@gmail.com.
- Páginas locales `public/privacidad.html` y `public/soporte.html`, accesibles también dentro del binario nativo. Responsable incorporado: Geronimo Vicciconde. Pendientes de desplegar en el sitio público.
- Solicitudes privadas de acceso, rectificación y eliminación desde la cuenta del alumno. Gestión manual de solicitudes en el resumen del administrador, protegida por MFA.
- Migración 010 aplicada en producción. Verificado: RLS activado, lectura y ejecución anónimas denegadas. No se eliminaron cuentas ni registros reales.
- Cuenta aislada de revisión `app-review@gnsfitness.invalid`, rol alumno, con socio y rutina ficticios. Inicio de sesión probado en el cliente local contra el servidor real. No accede a otros socios. Clave guardada fuera del repositorio, en `.private-ios/app-review.json` del espacio de trabajo.
- Flujo `ios-store-screenshots`: ejecuta los componentes reales con datos ficticios en simuladores nativos de iPhone y iPad. No incluye una publicación ni credenciales de producción. Revisar imágenes antes de adjuntarlas a Apple.
- Pruebas locales: build, lint, 7 pruebas biométricas y prueba integral de aislamiento de solicitudes aprobadas.

## Datos del titular pendientes

- Países confirmados: Uruguay, Argentina, Brasil y México; sin incorporación automática de otros territorios.
- Precio confirmado: descarga gratuita.
- Responsable y copyright confirmados: Geronimo Vicciconde.
- Contacto de revisión confirmado: Geronimo Vicciconde, gndevicciconde@gmail.com, +598 97 961 526 (teléfono privado para Apple).
- La distribución solicitada no incluye la UE.
- Verificar cómo se atiende a menores y las autorizaciones necesarias; la clasificación por edad de Apple no sustituye el consentimiento ni las condiciones de los servicios.

## Antes de enviar

1. Completar y revisar política con identidad del responsable, prácticas y retenciones reales. No afirmar que la app no recopila datos. Inventario en `PRIVACIDAD-APP-STORE.md`.
2. Desplegar páginas y versión web actualizada; verificar URL pública de soporte y privacidad sin inicio de sesión.
3. Generar y verificar nuevo binario de App Store con las páginas definitivas; seleccionar ese binario en la versión 1.0.
4. Descargar y revisar capturas; adjuntar iPhone e iPad en tamaños aceptados. No usar fotografías de alumnos ni información clínica real.
5. Completar categoría, clasificación por edad, disponibilidad, precio, privacidad y contacto de revisión; entregar únicamente las credenciales de la cuenta ficticia.
6. Guardar notas de revisión adaptadas al estado final. La app tiene funciones de administración privadas con MFA; no compartir la cuenta administrativa real ni desactivar su seguridad.
7. Revisar resumen con el titular antes del envío definitivo. La aprobación corresponde a Apple; no está garantizada.

## Atención de solicitudes de privacidad

La solicitud queda en el panel, pero **marcar como atendida no elimina la cuenta ni sus datos**. Revisar el panel regularmente y responder en hasta cinco días hábiles. Identificar al titular a partir de su cuenta; no entregar datos a otra dirección sin verificación.

Para una eliminación, revisar los registros relacionados y cualquier conservación legal necesaria. Eliminar o anonimizar efectivamente los datos que corresponda, revocar/eliminar la cuenta de autenticación y comunicar la conclusión al titular. No limitarse a dar de baja el socio ni a desvincular `members.user_id`. No borrar registros clínicos o financieros sin comprobar su obligación de conservación. Documentar cualquier excepción con motivo y plazo concretos.

Registrar la respuesta enviada y actuaciones en la solicitud, sin copiar datos clínicos. En una restauración de respaldo, volver a aplicar las eliminaciones para no reactivar datos suprimidos. Esta operación requiere acceso administrativo al proveedor; no hay un borrado masivo automático en la app.

Fuentes: [Revisión de Apple](https://developer.apple.com/app-store/review/), [eliminación de cuentas](https://developer.apple.com/support/offering-account-deletion-in-your-app/), [derechos en Uruguay](https://www.gub.uy/unidad-reguladora-control-datos-personales/tramites-y-servicios/formularios/formulario-para-ejercer-derechos-rectificacion-actualizacion).
