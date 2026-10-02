begin;
alter table public.members add column if not exists health_provider text not null default '' check (char_length(health_provider)<=160);
notify pgrst,'reload schema';
commit;
