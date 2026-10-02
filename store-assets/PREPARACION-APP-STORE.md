# GNS FITNESS · envío a App Store

Estado de preparación al 02/10/2026: **versión 1.0 (13) disponible en TestFlight interno; no reenviada a revisión pública**. Apple pidió información adicional bajo 2.1, incluida una grabación en un iPhone físico. Las menciones a otros apartados en «Prevent Common Issues» no acreditan por sí solas que haya detectado cada uno de esos fallos.

Antes del reenvío: cerrar el ensayo de recuperación, confirmar la prueba física de la compilación 13, disponer del video y probar las credenciales de demostración. La sesión de App Store Connect volvió a pedir acceso durante la revisión de la ficha; no se modificó todavía la versión seleccionada para distribución.

Preparación local: `GUIA-VIDEO-REVISION.txt` y `BORRADOR-RESPUESTA-APPLE.txt`. El borrador identifica datos que faltan y no debe enviarse con campos pendientes. WhatsApp automático sigue pendiente de conexión y no debe anunciarse como operativo.

## Antecedente del primer envío

El 30/09/2026 a las 14:32 se confirmó el primer envío. Los detalles siguientes documentan ese envío histórico y no prueban que la versión actual esté aprobada o publicada.

## Versión enviada

- App: GNS FITNESS, identificador 6817642980, bundle uy.gnsfitness.app.
- Versión 1.0 (10), exclusivamente iPhone. iPad queda para otra versión por indicación del titular.
- Commit 3c9e89f: TARGETED_DEVICE_FAMILY = 1 en Debug y Release. Incluye corrección de márgenes seguros del commit fa677fd.
- Codemagic: 6abd4598083ff0a9a53ac9c7. Firma App Store; carga finalizada sin errores.
- Entrega Apple: b894f496-d46c-4934-9259-faee14915c24.
- Envío a revisión: edc35da9-ef88-4f87-8bde-6abdf13f324a.
- Confirmación visible: «1 artículo enviado» y «Pendiente de revisión».
- Publicación automática tras aprobación seleccionada. Apple indica que enviará un correo al completar la revisión; la aprobación no está garantizada.

[Consultar revisión](https://appstoreconnect.apple.com/apps/6817642980/distribution/reviewsubmissions/details/edc35da9-ef88-4f87-8bde-6abdf13f324a)

## Ficha y comprobaciones completadas

- Descarga gratuita, únicamente Uruguay, Argentina, Brasil y México; sin incorporación automática de otros territorios.
- Responsable y copyright: Geronimo Vicciconde. Contacto: gndevicciconde@gmail.com. Teléfono privado de revisión: +59897961526.
- Descripción, texto promocional, palabras clave, subtítulo y categoría Salud y forma física guardados.
- Clasificación calculada por Apple: 16+. No sustituye las condiciones de atención del gimnasio.
- Titular confirmó ser creador de logo, imágenes y rutinas y autorizó publicación. Declaración de contenido propio registrada.
- Declaración de no dispositivo médico guardada para esta app de gestión sin diagnóstico automático.
- Privacidad publicada: diez tipos de datos, funcionalidad, vinculados a identidad, sin seguimiento. Incluye método de pago administrativo, sin tarjetas ni credenciales bancarias.
- Soporte y privacidad públicos verificados, con responsable y correo correctos, desplegados en Cloudflare versión 4191dc0e.
- Soporte: https://still-disk-e7b3.gndevicciconde.workers.dev/soporte.html
- Privacidad: https://still-disk-e7b3.gndevicciconde.workers.dev/privacidad.html
- Dos capturas nativas limpias de iPhone (progreso y nutrición), datos ficticios, 1320 × 2868; cargadas en 6,9 pulgadas y heredadas por 6,5. Se descartó captura de entrenamiento con notificación del sistema superpuesta.
- Capturas generadas en 6abd3d89083ff0a9a53ac765. Selección local: publicaciones/capturas-listas/iPhone.
- Cuenta aislada de revisión app-review@gnsfitness.invalid, rol alumno, con datos ficticios; credenciales entregadas a Apple. Clave fuera del repositorio en .private-ios/app-review.json. No compartir cuenta administrativa ni MFA.
- Face ID confirmado por el titular. Pruebas previas de build, lint, biometría y aislamiento aprobadas; validación y compilación firmada de iPhone completadas en CI.
- Migración 010 aplicada en producción: RLS activo, acceso anónimo denegado. No se eliminaron cuentas ni registros reales.

## Próximo paso

Responder a la solicitud de información con evidencia de la versión actual. Revisar la modalidad de publicación antes del reenvío; no afirmar que está publicada hasta comprobar su estado en Apple.

## Atención de solicitudes de privacidad

La solicitud queda en el panel, pero **marcar como atendida no elimina la cuenta ni sus datos**. Revisar el panel regularmente y responder en hasta cinco días hábiles. Identificar al titular a partir de su cuenta; no entregar datos a otra dirección sin verificación.

Para una eliminación, revisar los registros relacionados y cualquier conservación legal necesaria. Eliminar o anonimizar efectivamente los datos que corresponda, revocar/eliminar la cuenta de autenticación y comunicar la conclusión al titular. No limitarse a dar de baja el socio ni a desvincular `members.user_id`. No borrar registros clínicos o financieros sin comprobar su obligación de conservación. Documentar cualquier excepción con motivo y plazo concretos.

Registrar la respuesta enviada y actuaciones en la solicitud, sin copiar datos clínicos. En una restauración de respaldo, volver a aplicar las eliminaciones para no reactivar datos suprimidos. Esta operación requiere acceso administrativo al proveedor; no hay un borrado masivo automático en la app.

Fuentes: [Revisión de Apple](https://developer.apple.com/app-store/review/), [eliminación de cuentas](https://developer.apple.com/support/offering-account-deletion-in-your-app/), [derechos en Uruguay](https://www.gub.uy/unidad-reguladora-control-datos-personales/tramites-y-servicios/formularios/formulario-para-ejercer-derechos-rectificacion-actualizacion).


