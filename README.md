# GNS Training — etapa 6.1 (detalle de planes y saldos)

Proyecto web de gestión en React, TypeScript y Vite, continuado desde el ZIP original.

## Abrir en Windows con Visual Studio Code

1. Si tenés la etapa anterior abierta, frená su terminal con `Ctrl+C`. Descomprimí este ZIP en una carpeta nueva y abrí su carpeta `gns-training` en Visual Studio Code.
2. Abrí Terminal > Nuevo terminal.
3. Ejecutá `npm.cmd install` y después `npm.cmd run dev` en PowerShell.
4. Abrí en el navegador la dirección local que aparezca en la terminal (normalmente `http://localhost:5173`).

Necesitás Node.js instalado. Para comprobarlo, usá `node -v` en la terminal.

## Portal del alumno conectado

Esta versión abre primero una pantalla de inicio de sesión cuando Supabase está configurado. Una cuenta con rol `student` entra a un portal propio: bienvenida con el próximo día según los entrenamientos registrados, ejercicios y calentamiento, indicaciones y componentes de la rutina, mensajes del entrenador y planificación del bloque actual. El alumno puede registrar sus resultados y observaciones en su ficha. La navegación de administración no se muestra en la cuenta del alumno; las políticas RLS de Supabase restringen las consultas a su propio registro. Una cuenta administradora ve los indicadores y las fichas conectadas; si existen datos de la demostración anterior en ese navegador, puede descargar su respaldo desde el final del panel. La cuenta sin rol no puede acceder a ninguno de ellos.

**Para habilitar el registro del alumno:** el administrador ejecuta una sola vez `cloud/002_student.sql` en el SQL Editor del proyecto Supabase **existente**. No ejecutar de nuevo `001_initial.sql` ni repetir la importación. El procedimiento comprueba del lado del servidor que la cuenta tenga rol alumno, que la ficha sea suya y esté activa, que la rutina sea la más reciente de esa ficha y que el día y la semana correspondan al progreso registrado; bloquea registros simultáneos realizados por alumnos del mismo socio. El registro del administrador mantiene su flujo actual.

**Para activar el saludo personalizado desde la etapa 5.1:** ejecutar una sola vez `cloud/003_welcome.sql` en el mismo proyecto antes de abrir esta versión, si aún no se hizo. Agrega la opción «Saludo para el alumno» en la ficha conectada. Por defecto usa una frase neutral; el administrador puede escoger «Bienvenida» o «Bienvenido» para cada persona. El script configura «Bienvenida» para la ficha ya vinculada a Natalia Leticia Vero Milbeck, comprobando su correo de acceso. La pantalla de entrada, el portal y el encabezado de administración usan el logo correcto proporcionado por el gimnasio. El encabezado del alumno muestra «ENERGÍA · SALUD · BIENESTAR · VITALIDAD» debajo del nombre; ambos portales tienen el mismo destello verde tenue y estático en los costados, sin hojas añadidas. No volver a importar socios ni rutinas.

En la etapa 5.3, el encabezado de administración dice «GNS FITNESS» y el del alumno conserva «GNS TRAINING» con el lema. El verde se distribuye por toda la pantalla como un fondo oscuro uniforme, con un matiz un poco más visible en los bordes. No requiere un nuevo cambio de base de datos respecto de la etapa 5.2.

La etapa 5.4 suaviza el fondo: manchas verdes muy tenues y estáticas sobre gris oscuro, inspiradas en el aspecto acid wash. El portal del alumno vuelve a consultar Supabase al ingresar o recuperar la pestaña; después de registrar un día, solicita de nuevo el historial y muestra el siguiente entrenamiento calculado desde las sesiones guardadas. El progreso depende de los días registrados, no del paso del tiempo. No requiere otro SQL ni volver a importar datos.

La etapa 5.5 pone los indicadores de Supabase en la portada del administrador. Socios, altas del mes, bajas registradas, planes vencidos y próximos a vencer, ingresos del mes y acumulados, saldo pendiente del plan actual, rutinas y entrenamientos del mes se calculan desde la misma base que usan las fichas conectadas. La lista de socios y el historial aparecen debajo del panel. Los datos antiguos del navegador no se mezclan con esos indicadores; el administrador puede descargar una copia desde «Respaldo de la demostración anterior». El panel evita mostrar cifras incompletas si falla una consulta o alguna tabla alcanza el límite de 1000 registros. No requiere un nuevo SQL ni vuelve a importar datos.

La etapa 5.6 abre el panel sin esperar una consulta adicional de cantidad de socios y evita volver a descargar los indicadores cuando termina la primera carga de la lista. También se corrigió un mensaje desactualizado en la lista de socios.

La etapa 5.7 recupera la forma de copiar rutinas de la primera plataforma. En la ficha conectada aparece una barra visible «Copiar rutina a otro socio»: se elige la rutina de origen y el socio de destino por nombre, y se pulsa «Copiar rutina». El sistema consulta la última versión de la rutina, crea una planificación independiente y conserva la original y los entrenamientos anteriores. El socio de destino pasa a tener esa copia como rutina nueva. No requiere ejecutar SQL ni importar los datos nuevamente.

La etapa 5.8 agrega «Revisar entrenamiento» y «Editar revisión» junto a cada sesión de la ficha conectada. El administrador registra el nombre del entrenador y, si lo desea, un comentario para el alumno. La revisión queda guardada en `session_reviews` y el comentario aparece en «Mensajes de tu entrenador» del portal del alumno al recargarlo. Las sesiones y sus resultados no se modifican al revisar. No requiere ejecutar SQL ni importar los datos nuevamente.

La etapa 5.9 agrega «Eliminar entrenamiento» a la ficha conectada. Pide confirmación con la fecha y el socio antes de eliminar una sesión en Supabase; también se elimina su revisión asociada. La ficha recalcula el próximo día con las sesiones restantes y actualiza los indicadores. El alumno verá el cambio al volver a abrir su portal. Usar primero con un entrenamiento de prueba; la eliminación no se puede deshacer desde la aplicación. No requiere ejecutar SQL ni importar los datos nuevamente.

La etapa 6.0 agrega «Eliminar rutina» a cada rutina de la ficha conectada. Solo se puede borrar una rutina sin entrenamientos asociados; la aplicación comprueba de nuevo ese vínculo antes de eliminarla y pide confirmación. Esto permite retirar una planificación creada por error sin dejar ambiguo el cálculo del próximo día ni borrar resultados históricos. Si se borra la rutina más reciente, la anterior pasa a ser la actual; si no queda ninguna, se mostrará que falta una rutina. Probá primero con una rutina nueva en la ficha de prueba. No requiere SQL ni volver a importar datos.

La etapa 6.1 completa el desglose visible del panel de administración: debajo de los indicadores aparece cuántos socios corresponden a cada plan y cuántos están sin plan; «Pagos pendientes» identifica por nombre a los socios con saldo en su plan más reciente, con el importe individual. Se calculan a partir de las mismas consultas a Supabase que los indicadores, sin solicitudes adicionales ni una nueva migración. El saldo de planes anteriores no se suma a esta lista, tal como ocurre con el indicador de saldo pendiente.

**Para probar con otra cuenta de prueba en el futuro:** crear una cuenta adicional en Supabase > Authentication > Users, confirmar su correo, copiar su identificador UUID y el UUID de una ficha de prueba sin vincular. En SQL Editor, reemplazar los dos identificadores en estas instrucciones y ejecutarlas juntas. No usar la cuenta administradora como alumno. La cuenta de Natalia ya está vinculada: no repetir esta operación para ella.

```sql
begin;
do $$
declare student_user uuid := 'UUID-DE-LA-CUENTA-ALUMNO';
        test_member uuid := 'UUID-DE-LA-FICHA-ANA-PRUEBA';
begin
  if exists (select 1 from public.user_roles where user_id = student_user) then
    raise exception 'Esta cuenta ya tiene un rol; usá una cuenta nueva';
  end if;
  update public.members set user_id = student_user
    where id = test_member and user_id is null;
  if not found then raise exception 'No se encontró la ficha o ya tiene una cuenta vinculada'; end if;
  insert into public.user_roles (user_id, role) values (student_user, 'student');
end $$;
commit;
```

Después, cerrar la sesión de administración en la app e ingresar con la cuenta de alumno; es preferible usar otro perfil del navegador para mantener ambas sesiones separadas. Si aún no existe una cuenta de alumno, la pantalla de acceso funciona pero no permite probar la vista personalizada. El botón «Registrar Día» requiere `002_student.sql`; la vista de lectura funciona antes de instalarlo. «Próximo día» significa el siguiente entrenamiento pendiente al abrir la app: todavía no hay calendario de lunes a domingo que permita decir que ese día vence en una fecha concreta. No usar la URL `localhost` del equipo del administrador desde otro celular: para acceder desde otros dispositivos hará falta publicar la aplicación en un dominio o configurar un servidor accesible en la red.

## Datos existentes

La primera vez que se abre en el mismo navegador y dirección que la versión anterior, intenta importar los socios guardados bajo `alumnos` y sus rutinas. Conserva las claves antiguas. Las rutinas anteriores asociadas a nombres y apellidos duplicados no se asignan automáticamente, porque no se puede identificar su propietario con seguridad. Si cambiás la dirección, el puerto, el navegador o la computadora, el almacenamiento local será diferente: exportá un respaldo desde la versión anterior y no borres la carpeta original. El mismo puerto local conserva los datos del navegador aunque abras una carpeta de código nueva.

La ficha incluye ID estable, fecha de alta editable, edad calculada desde la fecha de nacimiento, contacto de emergencia, objetivo, limitaciones, entrenador y observaciones. Incluye planes, vencimientos, pagos, búsqueda y filtros de socios, saldo pendiente, historial y edición de rutinas. Podés copiar o eliminar rutinas. En la ficha de cada socio se pueden registrar entrenamientos con fecha, rutina, día y observaciones, además de series, repeticiones, carga y RIR realizados para cada ejercicio. Se muestra el resultado anterior del mismo ejercicio cuando existe. «Próximo entrenamiento» para la rutina actual se calcula desde el último día registrado, y hay un botón para abrir el registro del día sugerido. Si no hay días registrados, sugiere el Día 1; al registrar el último día, vuelve al Día 1. Una sesión sin día seleccionado no avanza la secuencia. No cambia de día solo porque pase el tiempo. Esta etapa agrega una vista de demostración para el alumno desde su ficha: muestra el próximo día y sus ejercicios primero, y debajo el programa completo. La vista es de solo lectura y está en el mismo navegador del administrador; todavía no hay cuentas ni acceso desde el celular. Las casillas vacías no se toman como resultados realizados. El historial conserva el nombre de los ejercicios y la rutina aunque se editen o eliminen. Los entrenamientos se pueden eliminar con confirmación. El respaldo JSON incluye esos registros y admite respaldos anteriores sin resultados. Los datos solo se guardan en este navegador; todavía no hay sincronización entre dispositivos. Antes de eliminar datos o restaurar un respaldo, descargá una copia de los datos actuales.

## Planificación por bloque y semana

El programa tiene 24 semanas de entrenamiento por defecto, divididas en bloques de 4 semanas. Cada semana contiene todos los días configurados: si la rutina es de 3 días, las semanas 1, 2, 3 y 4 del primer bloque muestran los días 1, 2 y 3 por separado. En «Crear rutina» y «Editar rutina» aparecen todos los bloques del programa. Abrí un bloque para ver juntas sus semanas y todos los días de cada una. Podés elegir entre 1 y 7 días por semana; cada día tiene sus ejercicios y parámetros propios. Si todavía no personalizaste una semana, hereda la última planificación disponible, incluso al cambiar de bloque. Editar un día de una semana no modifica los demás días ni las semanas anteriores. Las rutinas anteriores mantienen sus ejercicios y bloques existentes.

Cada bloque admite un nombre, un calentamiento específico y un texto sobre sus objetivos y capacidades. El calentamiento aparece antes de las semanas y el objetivo aparece después de la última semana; la vista del alumno también muestra el calentamiento junto a su próximo entrenamiento. La ficha de la rutina y la vista de demostración del alumno muestran todas las semanas y todos los días del bloque elegido o actual. La ficha del socio y el registro de entrenamiento usan la semana activa para presentar el ejercicio planificado. Una semana de entrenamiento se completa registrando en orden todos los días de la rutina; no se adelanta por el simple paso de siete días. Por eso, cuatro semanas del bloque equivalen aproximadamente a un mes cuando se entrena al ritmo previsto. El historial conserva lo realizado y muestra la semana asignada a los entrenamientos nuevos. Las sesiones anteriores permanecen intactas.

## Revisión de entrenamientos

En la ficha del socio, cada entrenamiento del historial indica si está pendiente de revisión. «Revisar» permite registrar el nombre del entrenador y un comentario opcional, y «Editar revisión» permite corregirlos. La revisión se guarda con su fecha dentro del respaldo JSON y los respaldos anteriores se abren con las sesiones pendientes. Esta marca es informativa; no restringe el registro de entrenamientos ni crea cuentas de entrenador.

La vista de demostración del alumno ahora muestra los comentarios escritos por el entrenador, con el nombre del entrenador y el entrenamiento al que corresponde cada mensaje, antes del programa completo. Si se corrige o elimina el registro desde la ficha, esta vista refleja el cambio. Sigue siendo una demostración local en el mismo navegador; el alumno todavía no puede iniciar sesión desde otro dispositivo.

## Indicaciones opcionales por día

En «Crear rutina» y «Editar rutina», cada día de cada semana puede incluir indicaciones adicionales de texto libre, por ejemplo para activación, trabajo complementario o vuelta a la calma. Son opcionales y aparecen en la rutina, en el registro del entrenamiento y en la vista del alumno. Las semanas sin indicaciones propias heredan las de la semana anterior, incluso al cambiar de bloque; se pueden ajustar en cualquier semana sin modificar las anteriores. Si querés quitar una indicación heredada solo para una semana, dejá vacío ese campo y guardá la rutina. Los respaldos anteriores siguen siendo compatibles.

## Componentes opcionales por día

Cada día planificado admite componentes adicionales con título y contenido propios, como «Activación», «Circuito» o «Vuelta a la calma». Usá «+ Componente» debajo de las indicaciones de ese día y completá el título y el contenido. Se muestran en la ficha de la rutina, el registro y la vista del alumno. Una semana sin cambios usa los componentes de la anterior; al editar o eliminar un componente heredado, el cambio solo afecta a esa semana y las siguientes que la hereden. Los respaldos incluyen estos componentes y admiten versiones anteriores sin ellos.

## Consulta de datos importados en Supabase

Después de importar el respaldo con el SQL generado en la etapa 4.3, iniciá sesión con la cuenta administradora en «Conexión de prueba». La lista conectada usa el mismo estilo de filas que el panel original; buscá o filtrá socios y pulsá una fila para abrir la ficha. La ficha presenta datos personales, estado, perfil, planes, pagos, rutinas y entrenamientos en el orden del panel original. El botón «Editar datos» modifica la ficha en Supabase. El estado también se cambia directamente desde la ficha. «Asignar plan» calcula la fecha de vencimiento según el plan elegido; crear un plan no registra automáticamente un pago. En el plan actual, «Registrar pago» muestra el saldo pendiente, admite pagos parciales y no deja ingresar desde esta interfaz un importe mayor al saldo que acaba de consultar. En la planificación, «Editar series y repeticiones» permite corregir esos dos campos de un ejercicio directamente en Supabase. Verificá los valores en el respaldo original antes de guardar: una cifra como «54» no se puede separar automáticamente con seguridad. Si otra sesión modificó la planificación mientras editabas, se cancela el guardado para evitar sobreescribirla. Los permisos de la base de datos siguen siendo necesarios para acceder y modificar las rutinas.

En esta etapa, la lista conectada muestra, junto a Estado, los mismos filtros Plan (Al día, Por vencer, Vencidos, Sin plan) y Pago (Con saldo pendiente, Sin saldo pendiente) del panel original. Los filtros se calculan desde los planes y pagos de Supabase; la fila muestra el vencimiento y el saldo pendiente del plan vigente. El filtro de saldo considera a un socio sin plan como sin saldo pendiente. Pulsá «Actualizar lista» después de modificar los planes o pagos si seguís dentro de la lista.

La etapa 4.9 incorpora «Crear rutina» y «Editar rutina» en la ficha conectada: nombre, objetivo, nivel, días, semanas, bloques, calentamiento, objetivo del bloque, ejercicios y componentes por día, con herencia de la planificación anterior. Los cambios se guardan en la tabla `routines` de Supabase. «Registrar Día» propone el siguiente día de la rutina más reciente y la semana activa; avanzar depende de registrar los días en orden. «Registrar entrenamiento» permite elegir fecha, rutina y día, o dejar la sesión sin rutina; los resultados por ejercicio pueden quedar vacíos. Los registros se guardan en la tabla `sessions` y se consultan al abrir la ficha otra vez. Las sesiones importadas se conservan. El formulario del próximo día vuelve a consultar Supabase antes de guardar, aunque todavía se necesita una operación atómica del servidor para bloquear dos registros simultáneos del mismo día. Para validar sin alterar el historial de socios reales, probá primero con «Ana Prueba».

La importación ya realizada no debe ejecutarse nuevamente: el script de importación rechaza los identificadores existentes. El panel de administración conectado ya muestra sus indicadores y fichas en una sola pantalla; la eliminación de rutinas conectadas exige que no tengan entrenamientos asociados. El portal del alumno funciona con una cuenta vinculada. El control de saldo de pagos se hace actualmente en el navegador y se vuelve a consultar antes de registrar; todavía falta una validación transaccional en el servidor para evitar dos pagos simultáneos sobre el mismo saldo. La copia antigua del navegador y Supabase son independientes y no se sincronizan. Conservá el respaldo JSON original y el proyecto anterior. Si instalás esta versión en otra carpeta, copiá tu propio archivo `.env.local` a la nueva carpeta sin enviarlo a terceros.

## Próximas etapas

La estructura de la base de datos, los permisos, el comprobador local del respaldo y la configuración de la cuenta de prueba están en [`cloud/README.md`](cloud/README.md). Esta entrega permite al administrador iniciar sesión y consultar los datos importados desde una única portada conectada. Si Supabase no está configurado, sigue disponible el panel de demostración local.

### Funciones de la primera plataforma que deben conservarse

| Función | Estado de la versión conectada |
| --- | --- |
| Lista de socios, búsqueda, filtro de estado, ficha y edición | Disponibles en el panel de administración conectado. |
| Filtros por vencimiento y saldo; indicadores del panel | Filtros, indicadores, desglose por plan y saldos pendientes por socio disponibles con datos de Supabase. |
| Asignar plan, calcular vencimiento y registrar pagos parciales | Disponibles en la ficha conectada; falta validar pagos simultáneos en el servidor. |
| Crear, editar, copiar y eliminar rutinas; planificación por bloque, semana y día | Crear, editar, copiar a otro socio y eliminar rutinas sin sesiones asociadas; ejercicios y componentes por bloque, semana y día. |
| Registrar el próximo día, registrar entrenamiento y resultados, revisar y eliminar sesiones | Disponibles en la ficha conectada; eliminar exige confirmación. |
| Vista del alumno: próximo entrenamiento, programa y mensajes | Portal conectado disponible con cuenta de alumno vinculada; el registro requiere la migración 002. |
| Respaldo y restauración de datos locales | Disponibles en el panel local; la base conectada requiere su propio procedimiento seguro. |

1. Comprobar el desglose con fichas y cuentas de prueba; seguir afinando el progreso del alumno tras editar la planificación.
2. Validar los pagos simultáneos en el servidor y preparar un procedimiento seguro de respaldo de Supabase.
3. Seguir afinando la experiencia del alumno con las pruebas de uso reales.
