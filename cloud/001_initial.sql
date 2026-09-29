-- GNS Training: esquema inicial para un gimnasio en Supabase.
-- Para un proyecto Supabase nuevo; probar antes de usar con datos reales.
-- Los roles se asignan manualmente; no hay acceso por defecto al registrarse.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'trainer', 'student'))
);

create table public.members (
  id uuid primary key,
  user_id uuid unique references auth.users(id) on delete set null,
  trainer_user_id uuid references auth.users(id) on delete set null,
  first_name text not null,
  last_name text not null,
  phone text not null default '',
  email text not null default '',
  birth_date date,
  joined_at date not null,
  status text not null check (status in ('Activo', 'Inactivo', 'Pausado', 'Baja')),
  emergency_contact_name text not null default '',
  emergency_contact_phone text not null default '',
  goal text not null default '',
  limitations text not null default '',
  trainer_name text not null default ''
);

create table public.member_admin_notes (
  member_id uuid primary key references public.members(id) on delete cascade,
  notes text not null default ''
);

create table public.routines (
  id uuid primary key,
  member_id uuid not null references public.members(id) on delete cascade,
  name text not null,
  goal text not null default '',
  level text not null,
  days_per_week smallint not null check (days_per_week between 1 and 7),
  program_rounds smallint not null check (program_rounds between 1 and 104),
  block_rounds smallint not null check (block_rounds between 1 and program_rounds),
  -- Contiene los ejercicios y la planificación por bloque, semana y día.
  plan jsonb not null default '{}'::jsonb check (jsonb_typeof(plan) = 'object'),
  created_at timestamptz not null default now(),
  unique (id, member_id)
);

create table public.memberships (
  id uuid primary key,
  member_id uuid not null references public.members(id) on delete cascade,
  plan_name text not null,
  months smallint not null check (months > 0),
  starts_at date not null,
  ends_at date not null check (ends_at >= starts_at),
  price numeric(12, 2) not null check (price >= 0),
  unique (id, member_id)
);

create table public.payments (
  id uuid primary key,
  member_id uuid not null references public.members(id) on delete cascade,
  membership_id uuid not null,
  paid_at date not null,
  amount numeric(12, 2) not null check (amount > 0),
  method text not null check (method in ('Efectivo', 'Transferencia', 'Tarjeta', 'Otro')),
  foreign key (membership_id, member_id) references public.memberships(id, member_id) on delete cascade
);

create table public.sessions (
  id uuid primary key,
  member_id uuid not null references public.members(id) on delete cascade,
  performed_at date not null,
  routine_id uuid,
  routine_name text not null default '',
  day smallint check (day between 1 and 7),
  block smallint check (block between 1 and 104),
  week smallint check (week between 1 and 104),
  notes text not null default '',
  results jsonb not null default '[]'::jsonb check (jsonb_typeof(results) = 'array'),
  created_at timestamptz not null default now(),
  unique (id, member_id),
  foreign key (routine_id, member_id) references public.routines(id, member_id) on delete set null (routine_id)
);

create table public.session_reviews (
  session_id uuid primary key,
  member_id uuid not null,
  -- Las revisiones históricas del respaldo solo guardan el nombre, no el ID.
  trainer_user_id uuid references auth.users(id) on delete set null,
  trainer_name text not null,
  notes text not null default '',
  reviewed_at date not null,
  foreign key (session_id, member_id) references public.sessions(id, member_id) on delete cascade
);

create index members_trainer_idx on public.members(trainer_user_id);
create index routines_member_idx on public.routines(member_id, created_at desc);
create index memberships_member_idx on public.memberships(member_id, starts_at desc);
create index payments_member_idx on public.payments(member_id, paid_at desc);
create index sessions_member_idx on public.sessions(member_id, performed_at desc, created_at desc);
create index session_reviews_member_idx on public.session_reviews(member_id);

-- Estas funciones leen las tablas de permisos sin entrar en recursión de RLS.
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin');
$$;
create function private.is_assigned_trainer(target_member uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m join public.user_roles r on r.user_id = (select auth.uid())
    where m.id = target_member and m.trainer_user_id = r.user_id and r.role = 'trainer'
  );
$$;
create function private.is_member_self(target_member uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m join public.user_roles r on r.user_id = (select auth.uid())
    where m.id = target_member and m.user_id = r.user_id and r.role = 'student'
  );
$$;
revoke all on function private.is_admin() from public;
revoke all on function private.is_assigned_trainer(uuid) from public;
revoke all on function private.is_member_self(uuid) from public;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_assigned_trainer(uuid) to authenticated;
grant execute on function private.is_member_self(uuid) to authenticated;

alter table public.user_roles enable row level security;
alter table public.members enable row level security;
alter table public.member_admin_notes enable row level security;
alter table public.routines enable row level security;
alter table public.memberships enable row level security;
alter table public.payments enable row level security;
alter table public.sessions enable row level security;
alter table public.session_reviews enable row level security;

-- Los usuarios solo leen su propio rol. Solo el editor SQL asigna o cambia roles.
create policy roles_read_self on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()));

create policy members_read on public.members for select to authenticated
  using ((select private.is_admin()) or private.is_assigned_trainer(id) or private.is_member_self(id));
create policy members_admin_insert on public.members for insert to authenticated
  with check ((select private.is_admin()));
create policy members_admin_update on public.members for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy members_admin_delete on public.members for delete to authenticated
  using ((select private.is_admin()));

create policy private_notes_admin on public.member_admin_notes for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy routines_read on public.routines for select to authenticated
  using ((select private.is_admin()) or private.is_assigned_trainer(member_id) or private.is_member_self(member_id));
create policy routines_staff_insert on public.routines for insert to authenticated
  with check ((select private.is_admin()) or private.is_assigned_trainer(member_id));
create policy routines_staff_update on public.routines for update to authenticated
  using ((select private.is_admin()) or private.is_assigned_trainer(member_id))
  with check ((select private.is_admin()) or private.is_assigned_trainer(member_id));
create policy routines_admin_delete on public.routines for delete to authenticated
  using ((select private.is_admin()));

create policy memberships_read on public.memberships for select to authenticated
  using ((select private.is_admin()) or private.is_member_self(member_id));
create policy memberships_admin_insert on public.memberships for insert to authenticated
  with check ((select private.is_admin()));
create policy memberships_admin_update on public.memberships for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy memberships_admin_delete on public.memberships for delete to authenticated
  using ((select private.is_admin()));

create policy payments_read on public.payments for select to authenticated
  using ((select private.is_admin()) or private.is_member_self(member_id));
create policy payments_admin_insert on public.payments for insert to authenticated
  with check ((select private.is_admin()));
create policy payments_admin_update on public.payments for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy payments_admin_delete on public.payments for delete to authenticated
  using ((select private.is_admin()));

-- El alumno consulta sus sesiones; el registro desde su cuenta se habilitará con validación del servidor.
create policy sessions_read on public.sessions for select to authenticated
  using ((select private.is_admin()) or private.is_assigned_trainer(member_id) or private.is_member_self(member_id));
create policy sessions_staff_insert on public.sessions for insert to authenticated
  with check ((select private.is_admin()) or private.is_assigned_trainer(member_id));
create policy sessions_staff_update on public.sessions for update to authenticated
  using ((select private.is_admin()) or private.is_assigned_trainer(member_id))
  with check ((select private.is_admin()) or private.is_assigned_trainer(member_id));
create policy sessions_admin_delete on public.sessions for delete to authenticated
  using ((select private.is_admin()));

create policy reviews_read on public.session_reviews for select to authenticated
  using ((select private.is_admin()) or private.is_assigned_trainer(member_id) or private.is_member_self(member_id));
create policy reviews_staff_insert on public.session_reviews for insert to authenticated
  with check ((select private.is_admin()) or (private.is_assigned_trainer(member_id) and trainer_user_id = (select auth.uid())));
create policy reviews_staff_update on public.session_reviews for update to authenticated
  using ((select private.is_admin()) or private.is_assigned_trainer(member_id))
  with check ((select private.is_admin()) or (private.is_assigned_trainer(member_id) and trainer_user_id = (select auth.uid())));
create policy reviews_admin_delete on public.session_reviews for delete to authenticated
  using ((select private.is_admin()));

revoke all on public.user_roles, public.members, public.member_admin_notes,
  public.routines, public.memberships, public.payments, public.sessions, public.session_reviews from anon;
grant select on public.user_roles, public.members, public.member_admin_notes,
  public.routines, public.memberships, public.payments, public.sessions, public.session_reviews to authenticated;
grant insert, update, delete on public.members, public.member_admin_notes,
  public.routines, public.memberships, public.payments, public.sessions, public.session_reviews to authenticated;
