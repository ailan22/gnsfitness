# Avisos por WhatsApp: base preparada, envío no activado

El usuario eligió WhatsApp. Actualmente usa la aplicación común.
Pendiente decidir si conservará ese número o utilizará otro para los avisos.
No se ha modificado, migrado ni desconectado su cuenta de WhatsApp.

`select-reminders.mjs` contiene la selección pura de destinatarios y se ejecuta en el
servidor. Sus pruebas cubren planes de 1, 3, 6 y 12 meses, renovación anticipada,
vencimientos superpuestos, fecha de Uruguay y exclusión de avisos ya reclamados.
Usa la fecha `ends_at`, no la duración ni el saldo. No enviar mensualmente a un plan anual.

## Faltantes antes de activar

1. Conectar número y cuenta a WhatsApp Business Platform con el flujo aplicable al número.
   La aplicación WhatsApp Business, por sí sola, no conecta esta app con la API.
2. Aprobar la plantilla de utilidad y revisar coste de proveedor/Meta con el titular.
   Borrador: «Hola, {{1}}. Tu plan de GNS Fitness vence el {{2}}.
   Te avisamos con cinco días de anticipación para que puedas coordinar la renovación».
3. Crear almacenamiento protegido para contactos normalizados, consentimiento por número,
   bajas y registro de envíos. No inferir consentimiento de la existencia de la ficha.
4. Implementar trabajador y programación diaria en Supabase, con secretos solo del servidor.
   Comprobar destinatario/renovación/baja inmediatamente antes de enviar.
5. Reclamar cada clave en una transacción con restricción UNIQUE; una selección en memoria
   sola no evita que dos trabajadores envíen simultáneamente. No reintentar automáticamente
   una entrega ambigua tras un timeout: conciliar primero con el proveedor.
6. Validar una entrega con un número de prueba indicado por el usuario y los estados
   aceptado/entregado/fallido mediante webhooks autenticados, sin registrar cuerpos sensibles.

No existe todavía cron, Edge Function, proveedor ni tabla de contactos/envíos para esta función.
No se han leído listas reales para enviar ni enviado mensajes. Este módulo no se importa en
el navegador, no usa claves y no tiene efectos externos.
