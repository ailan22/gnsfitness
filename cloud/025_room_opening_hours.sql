begin;
-- Retain existing appointments. Validate new bookings, rescheduling and reactivation.
create or replace function private.enforce_room_opening_hours() returns trigger
language plpgsql set search_path='' as $$
declare local_start time; local_end time;
begin
 if new.cancelled then return new; end if;
 if tg_op='UPDATE' then
  if not old.cancelled and new.starts_at=old.starts_at and new.ends_at=old.ends_at then return new; end if;
 end if;
 local_start := (new.starts_at at time zone 'America/Montevideo')::time;
 local_end := (new.ends_at at time zone 'America/Montevideo')::time;
 if not ((local_start >= time '08:00' and local_end <= time '12:00')
      or (local_start >= time '16:00' and local_end <= time '20:00')) then
  raise exception 'La sesión completa debe estar entre 08:00–12:00 o 16:00–20:00' using errcode='23514';
 end if;
 return new;
end; $$;
revoke all on function private.enforce_room_opening_hours() from public,anon,authenticated;
drop trigger if exists room_opening_hours on public.room_appointments;
create trigger room_opening_hours after insert or update on public.room_appointments
for each row execute function private.enforce_room_opening_hours();
commit;
