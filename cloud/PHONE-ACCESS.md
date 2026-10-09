# Acceso por celular

Implementación preparada, desactivada por defecto. No habilitar `VITE_PHONE_ACCESS_ENABLED=true` sin completar la configuración y las pruebas siguientes.

1. Contratar/configurar un proveedor SMS en Supabase Auth con aprobación del responsable de los costos. Mantener confirmación de teléfono obligatoria y límites de envío/abuso. No activar confirmación automática.
2. Probar con una cuenta ficticia ya invitada por correo: vincular su celular desde «Ingresar también con celular», recibir el SMS y confirmar el código. No crear otra cuenta ni copiar automáticamente teléfonos de las fichas a Auth.
3. Verificar que un código incorrecto o vencido no vincula el número; que no puede vincularse el de otra cuenta; comprobar rate limits y reenvío.
4. Comprobar ingreso con correo y con celular + contraseña, recuperación por correo, cierre de sesión y permisos de la misma cuenta. Repetir en iPhone físico.
5. Habilitar la variable en las compilaciones web/iOS solamente tras comprobar los puntos anteriores. Construir y publicar ambas versiones.

Los números deben incluir prefijo internacional. El número de contacto de la ficha y el número de acceso verificado son distintos: cambiar el contacto no cambia la identidad de acceso.

Documentación: https://supabase.com/docs/guides/auth/phone-login y https://supabase.com/docs/reference/javascript/auth-updateuser
