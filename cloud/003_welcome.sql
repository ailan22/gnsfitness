-- Aplicar una vez en el SQL Editor del proyecto existente, después de 002_student.sql.
-- El saludo se configura por ficha; no se deduce a partir del nombre.
alter table public.members
  add column if not exists welcome_form text not null
  default 'Te damos la bienvenida'
  check (welcome_form in ('Bienvenida', 'Bienvenido', 'Te damos la bienvenida'));

-- Natalia ya está vinculada a su cuenta de alumna en este proyecto.
update public.members m
set welcome_form = 'Bienvenida'
where trim(m.first_name || ' ' || m.last_name) = 'Natalia Leticia Vero Milbeck'
  and exists (
    select 1 from auth.users u
    where u.id = m.user_id
      and lower(u.email) = 'nataliaveromilbeck@gmail.com'
  );
