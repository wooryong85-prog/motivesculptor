-- Link trainer rows to real Auth users and require a changed password for data access.
begin;
alter table public.trainers add column if not exists auth_user_id uuid;
alter table public.trainers add column if not exists password_change_required boolean not null default false;
create unique index if not exists trainers_auth_user_id_unique on public.trainers(auth_user_id)
  where auth_user_id is not null;

update public.trainers t set auth_user_id=u.id
from auth.users u
where t.auth_user_id is null and t.login_id is not null
  and lower(u.email)=t.login_id || '@staff.motivegym.co.kr';

create or replace function public.staff_password_ready() returns boolean
language sql stable security definer set search_path='' as $$
  select public.is_center_admin() or exists (
    select 1 from public.trainers t
    where t.auth_user_id=(select auth.uid())
      and t.active and not t.password_change_required
  )
$$;
revoke all on function public.staff_password_ready() from public;
grant execute on function public.staff_password_ready() to authenticated;

do $$ declare target text; begin
  foreach target in array array['trainers','member_enrollments','completed_sessions',
    'daily_confirmations','trainer_monthly_archives'] loop
    if not exists(select 1 from pg_policies where schemaname='public'
      and tablename=target and policyname='staff_password_ready') then
      execute format('create policy staff_password_ready on public.%I as restrictive for all to authenticated using (public.staff_password_ready()) with check (public.staff_password_ready())',target);
    end if;
  end loop;
end $$;
select pg_notify('pgrst','reload schema');
commit;

