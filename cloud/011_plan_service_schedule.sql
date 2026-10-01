begin;
-- Additive metadata for new plans. Existing prices and payments remain intact.
alter table public.memberships add column if not exists service_config jsonb;
alter table public.memberships drop constraint if exists memberships_service_config_check;
alter table public.memberships add constraint memberships_service_config_check check (
  service_config is null or (
    coalesce(jsonb_typeof(service_config) = 'object'
    and service_config->>'version' = '1'
    and jsonb_typeof(service_config->'physioDates') = 'array'
    and jsonb_typeof(service_config->'nutritionMonthly') = 'number'
    and jsonb_typeof(service_config->'nutritionMonths') = 'number'
    and jsonb_typeof(service_config->'physioSessionPrice') = 'number'
    and length(service_config::text) <= 15000, false)
  )
);
-- Existing memberships row-level policies continue to apply.
notify pgrst, 'reload schema';

commit;
