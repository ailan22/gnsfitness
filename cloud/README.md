# Etapa 4.3: preparar importación transaccional

La etapa 4.2 creó y probó la ficha de socio en Supabase. `prepare-import.mjs` permite **generar en tu computadora** un archivo SQL a partir del respaldo actualizado. Generarlo no importa nada. El SQL inserta socios, observaciones, rutinas completas, planes, pagos, entrenamientos y revisiones con los mismos identificadores que el respaldo. Conserva los valores predeterminados de 24 semanas y bloques de 4 cuando la rutina no los especifica. Un entrenamiento cuya rutina ya no exista conserva su nombre histórico sin crear un vínculo incorrecto.

En la terminal de VS Code, dentro de `gns-training`, prepará el archivo usando la ruta de tu respaldo más reciente:

```powershell
node .\cloud\prepare-import.mjs "C:\Users\natis\Desktop\gns-respaldo-2026-09-27-con-revision.json"
```

La terminal muestra las cantidades y la ruta del archivo `-import.sql` creado junto al respaldo. El archivo contiene datos personales: mantenelo en tu equipo, **no lo pegues en conversaciones**. Si ya existe el archivo de salida, el programa se detiene y no lo reemplaza. Nunca modifica ni borra el JSON original.

**Antes de ejecutar el SQL**, comprobá en el encabezado de Supabase que sea el proyecto de pruebas correcto y conservá ambos respaldos JSON. Desde SQL Editor podés abrir el archivo generado y ejecutar su contenido. Usa una transacción: si un ID ya existe o falla cualquier inserción, se cancela toda la importación sin modificar los registros anteriores. La ficha ficticia creada directamente en Supabase conserva su propio ID y permanece intacta. Tras ejecutar, verificá en Table Editor los recuentos de `members`, `routines`, `sessions` y `session_reviews`. No ejecutes el mismo SQL dos veces: la segunda vez detectará IDs repetidos y cancelará toda la operación.

**Alcance actual:** importar registros a Supabase todavía no convierte la vista local del panel en una vista sincronizada. Esa integración requiere una etapa posterior. No elimines datos del navegador ni los respaldos tras importar.

## Etapa 4.2: ficha de socio en Supabase

El panel anterior continúa guardando sus datos en el navegador. `001_initial.sql` creó el modelo en el proyecto de prueba. En «Conexión de prueba», la cuenta con rol administrador puede crear y editar una ficha de socio directamente en Supabase, incluidas las observaciones administrativas de su tabla separada. Esta lista es independiente del panel local: no traslada sus socios, rutinas, comentarios, planes ni entrenamientos. No pegues datos de socios ni claves privadas en conversaciones.

## Antes de migrar

1. Desde la aplicación actual, descargá «Respaldo». Guardalo fuera de la carpeta del proyecto y conservá también una copia de la versión anterior.
2. En la terminal, dentro de `gns-training`, ejecutá `node cloud/check-backup.mjs "RUTA_COMPLETA_AL_RESPALDO.json"`. El comando lee el respaldo en tu equipo, muestra cantidades y posibles problemas; no altera el archivo ni se conecta a internet.
3. Si el informe dice «corregir antes de migrar», conservá el respaldo y no importes todavía. Las sesiones de rutinas borradas y las revisiones antiguas con solo nombre del entrenador figuran como avisos para resolverlas durante la migración.

## Estructura prevista

| Cuenta | Acceso previsto |
| --- | --- |
| Administrador | Socios, cobros, notas administrativas, rutinas y entrenamientos. |
| Entrenador asignado | Ficha del socio asignado, rutina y entrenamientos; puede revisar entrenamientos. |
| Alumno vinculado | Su ficha, sus pagos, su rutina, sus entrenamientos y mensajes del entrenador. |

Las notas administrativas están en una tabla separada. Una cuenta recién creada no recibe permisos por defecto; el rol se configura desde el editor SQL durante la puesta en marcha. El esquema usa políticas de seguridad por fila. Todavía faltan el asistente de importación, la integración del panel y la validación de los registros enviados por alumnos.

## Configurar la conexión de prueba

1. En el proyecto **GNS Training pruebas** de Supabase, buscá **Project URL** y la **publishable key** (clave publicable) en Connect o Project Settings > API Keys. Copiá solo esos valores públicos. Nunca copies `service_role` o una `secret key` al código ni a una conversación.
2. Dentro de la carpeta `gns-training`, copiá `.env.example` como `.env.local` y reemplazá los dos valores de ejemplo. No pongas contraseñas en ese archivo. Reiniciá `npm.cmd run dev` después del cambio. `.env.local` no se incluye en el ZIP.
3. Creá una cuenta **de prueba** desde Authentication > Users en Supabase (o por invitación). Usá una contraseña propia y no la compartas. Una cuenta nueva no tiene rol ni acceso a socios.
4. Cuando la cuenta exista, asigná su rol con su **ID de usuario**, comprobando primero que sea el usuario correcto. Para una cuenta de administrador en este proyecto de prueba: `insert into public.user_roles (user_id, role) values ('ID_DE_USUARIO', 'admin');`. Ejecutá esto solo una vez y solo con el ID correcto. No asigna roles automáticamente a nuevas cuentas.
5. Iniciá sesión en «Conexión de prueba». Deberías ver tu correo, el rol y el número de socios visibles en Supabase (al principio 0). Ese número es independiente de los socios del panel local.

Para probar esta etapa, iniciá sesión con el administrador ya creado, cargá un socio ficticio en «Nuevo socio en Supabase», verificá su ficha en Table Editor > members y su nota en member_admin_notes; actualizá la página y comprobá que la ficha persista. Solo se han implementado fichas de socios para este módulo. No importes todavía el respaldo a Supabase: primero hay que desarrollar una migración que conserve los vínculos y el historial.
