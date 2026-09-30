# Gestión y fichas de salud — 30/09/2026

Publicado en la web y aplicación instalada de Windows. Cloudflare: versión 9a991c31, paquete gns-fitness-1790743452811. Las aplicaciones nativas requieren una compilación nueva.

## Uso

- Navegación del administrador: Resumen, Personas, Anamnesis y Kinesiología.
- Personas → Nuevo socio: sección plegada «Anamnesis inicial de salud y entrenamiento». Se puede completar ahora o después; no impide registrar los datos básicos.
- La anamnesis registra objetivos, actividad, antecedentes relevantes, medicación, lesiones, síntomas durante el esfuerzo, indicaciones profesionales, consentimiento y plan inicial.
- Kinesiología vincula evaluación inicial y sesiones a la ficha existente. Incluye motivo, evolución, dolor opcional, función, antecedentes, examen, valoración profesional, objetivos, consentimiento, intervención y seguimiento.
- Las rectificaciones conservan el original y exigen motivo. No se generan diagnósticos ni aptitudes automáticas.
- No es necesario repetir el alta del doble factor. Puede solicitarse un código nuevo en otro inicio de sesión.

## Protección y verificación

Migración 008 aplicada. Acceso a health_records exclusivamente mediante administrador con segundo factor (AAL2), validado en la base además de la interfaz. Alumnos y entrenadores no tienen acceso. Sin permisos de actualización, borrado ni truncado para las cuentas de la aplicación. Autor y fecha de creación se fijan en servidor; auditoría sin copiar el contenido clínico.

Verificación del catálogo en producción: RLS activado, lectura anónima denegada, UPDATE/DELETE/TRUNCATE denegados, dos políticas y dos triggers. Se validan campos, longitudes, fechas, escalas, vínculos entre persona y evaluación y motivos de rectificación. Los reintentos usan identificadores estables y comparan contenido para no perder cambios tras una respuesta de red perdida.

Pruebas: suite general de 104 casos aprobada; posteriormente 8 casos clínicos aprobados, incluido un caso adicional de reconciliación de contenido (105 casos distintos). Compilación y lint finales aprobados. Prueba visual de escritorio y móvil, alta con anamnesis y evaluación con seguimiento usando únicamente personas ficticias en un cliente local en memoria. No se insertaron fichas clínicas de prueba en producción.

workspace-preview.html y tests/preview/workspace.jsx son herramientas locales con datos ficticios; no forman parte del paquete publicado. No se guardan borradores clínicos en el almacenamiento del navegador. La comprobación visual local no sustituye una prueba autenticada del administrador en producción.

## Referencias y pendientes

La estructura documental se orientó por la [política de documentación de World Physiotherapy](https://world.physio/sites/default/files/2024-01/PS-2023-Documentation.pdf): valoración, plan, intervención, respuesta, autoría y consentimiento. Es un formulario propio, no un cuestionario clínico validado. El profesional responsable debe revisar su adecuación a su práctica.

Continúa pendiente la solución de copias de seguridad de la base de datos del plan gratuito, ya identificada en la revisión de seguridad. El repositorio conserva código y migraciones, no constituye un respaldo de los datos de socios ni de salud. Definir retención y procedimientos de rectificación/expurgo según las obligaciones aplicables antes de ampliar el uso clínico.
