-- Edge Function's secret API key runs as service_role. Existing custom grants
-- omitted this role from the trainers table, so account creation failed.
grant select, insert, update on table public.trainers to service_role;
grant usage, select on sequence public.trainers_id_seq to service_role;
