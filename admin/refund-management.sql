-- Refunds and archived member files. Existing enrollments and lessons are preserved.
begin;

alter table public.member_enrollments
  add column if not exists status text not null default 'active',
  add column if not exists refunded_at date,
  add column if not exists refund_amount numeric(12,0),
  add column if not exists refund_used_sessions integer,
  add column if not exists removed_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='member_enrollments_status_check' and conrelid='public.member_enrollments'::regclass) then
    alter table public.member_enrollments add constraint member_enrollments_status_check
      check (status in ('active','refunded'));
  end if;
  if not exists (select 1 from pg_constraint where conname='member_enrollments_refund_check' and conrelid='public.member_enrollments'::regclass) then
    alter table public.member_enrollments add constraint member_enrollments_refund_check
      check ((status='active' and refunded_at is null and refund_amount is null and refund_used_sessions is null)
        or (status='refunded' and refunded_at is not null and refund_amount between 0 and price
          and refund_used_sessions between 0 and session_count));
  end if;
end $$;

create or replace function public.guard_member_enrollment_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_center_admin() then raise exception '관리자만 회원 등록을 변경할 수 있습니다'; end if;
  if old.status='refunded' and (to_jsonb(new)-'removed_at') is distinct from (to_jsonb(old)-'removed_at') then
    raise exception '완료된 환불은 변경할 수 없습니다';
  end if;
  if old.removed_at is not null then raise exception '삭제된 회원 파일은 변경할 수 없습니다'; end if;
  if exists (select 1 from public.completed_sessions s where s.enrollment_id=old.id)
    and (new.trainer_id,new.session_count,new.contract_duration_minutes,new.price,new.payment_method,new.registered_at)
      is distinct from (old.trainer_id,old.session_count,old.contract_duration_minutes,old.price,old.payment_method,old.registered_at) then
    raise exception '수업 기록이 있는 등록의 트레이너·회차·시간·금액·결제방식·등록일은 변경할 수 없습니다';
  end if;
  if exists (select 1 from public.monthly_settlements m where m.month=date_trunc('month',old.registered_at)::date)
    and (new.trainer_id,new.session_count,new.contract_duration_minutes,new.price,new.payment_method,new.registered_at,new.is_renewal)
      is distinct from (old.trainer_id,old.session_count,old.contract_duration_minutes,old.price,old.payment_method,old.registered_at,old.is_renewal) then
    raise exception '정산된 등록의 금액 및 계약 조건은 변경할 수 없습니다';
  end if;
  return new;
end $$;
drop trigger if exists guard_member_enrollment_change on public.member_enrollments;
create trigger guard_member_enrollment_change before update on public.member_enrollments
  for each row execute function public.guard_member_enrollment_change();

create or replace function public.refund_member_enrollment(p_enrollment_id bigint,p_amount numeric)
returns void language plpgsql security definer set search_path='' as $$
declare e public.member_enrollments%rowtype; used_count integer; refund_day date;
begin
  if not public.is_center_admin() then raise exception '관리자만 환불할 수 있습니다'; end if;
  refund_day:=(now() at time zone 'Asia/Seoul')::date;
  select * into e from public.member_enrollments where id=p_enrollment_id for update;
  if not found or e.status<>'active' or e.removed_at is not null then raise exception '환불 가능한 등록이 아닙니다'; end if;
  if p_amount is null or p_amount<>trunc(p_amount) or p_amount<0 or p_amount>e.price then
    raise exception '환불액은 결제금액 이내의 원 단위 금액이어야 합니다';
  end if;
  select coalesce(sum(s.quantity),0) into used_count from public.completed_sessions s where s.enrollment_id=e.id;
  update public.member_enrollments set status='refunded',refunded_at=refund_day,
    refund_amount=p_amount,refund_used_sessions=used_count where id=e.id;
end $$;
revoke all on function public.refund_member_enrollment(bigint,numeric) from public;
grant execute on function public.refund_member_enrollment(bigint,numeric) to authenticated;

create or replace function public.hide_member_enrollment(p_enrollment_id bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_center_admin() then raise exception '관리자만 회원 파일을 삭제할 수 있습니다'; end if;
  update public.member_enrollments set removed_at=now() where id=p_enrollment_id and removed_at is null;
  if not found then raise exception '삭제할 등록을 찾지 못했습니다'; end if;
end $$;
revoke all on function public.hide_member_enrollment(bigint) from public;
grant execute on function public.hide_member_enrollment(bigint) to authenticated;

create or replace function public.guard_inactive_enrollment_lesson() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.member_enrollments e where e.id=new.enrollment_id
    and e.status='active' and e.removed_at is null) then
    raise exception '환불되거나 삭제된 회원의 수업은 추가·변경할 수 없습니다';
  end if;
  return new;
end $$;
drop trigger if exists guard_inactive_enrollment_lesson on public.completed_sessions;
create trigger guard_inactive_enrollment_lesson before insert or update on public.completed_sessions
  for each row execute function public.guard_inactive_enrollment_lesson();

select pg_notify('pgrst','reload schema');
commit;

