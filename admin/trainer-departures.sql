alter table public.trainers add column if not exists hire_date date;
alter table public.trainers add column if not exists departed_at date;
alter table public.trainers alter column hire_date set default (timezone('Asia/Seoul', now())::date);

-- Existing trainers have no recorded start date. An administrator enters it
-- rather than inferring employment from a member's registration date.
