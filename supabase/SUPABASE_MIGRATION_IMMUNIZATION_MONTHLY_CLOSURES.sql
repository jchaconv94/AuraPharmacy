-- Fase 16: Precierre IPRESS y cierre mensual definitivo UNGET
-- Ejecutar en Supabase después de las migraciones de inmunizaciones previas.

create table if not exists public.immunization_monthly_closures (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('IPRESS', 'UNGET')),
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  unget_id text,
  facility_code text,
  status text not null check (status in ('PRE_CLOSED', 'FINAL_CLOSED', 'REOPENED')),
  observation text,
  preclosed_by text,
  preclosed_at timestamptz,
  closed_by text,
  closed_at timestamptz,
  reopened_by text,
  reopened_at timestamptz,
  reopen_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint immunization_monthly_closures_ipress_scope_chk
    check (
      (owner_type = 'IPRESS' and facility_code is not null and unget_id is not null)
      or
      (owner_type = 'UNGET' and facility_code is null and unget_id is not null)
    )
);

create unique index if not exists immunization_monthly_closures_ipress_unique
  on public.immunization_monthly_closures(period, facility_code)
  where owner_type = 'IPRESS';

create unique index if not exists immunization_monthly_closures_unget_unique
  on public.immunization_monthly_closures(period, unget_id)
  where owner_type = 'UNGET';

create index if not exists immunization_monthly_closures_period_idx
  on public.immunization_monthly_closures(period);

create index if not exists immunization_monthly_closures_unget_idx
  on public.immunization_monthly_closures(unget_id);

create index if not exists immunization_monthly_closures_facility_idx
  on public.immunization_monthly_closures(facility_code);

alter table public.immunization_monthly_closures enable row level security;

drop policy if exists "immunization_monthly_closures_select_all" on public.immunization_monthly_closures;
drop policy if exists "immunization_monthly_closures_insert_all" on public.immunization_monthly_closures;
drop policy if exists "immunization_monthly_closures_update_all" on public.immunization_monthly_closures;

-- Política temporal consistente con las migraciones actuales del módulo.
-- El control fino por rol se aplica desde la aplicación y puede endurecerse luego
-- con JWT claims de nivel DIRESA/UNGET/IPRESS.
create policy "immunization_monthly_closures_select_all"
  on public.immunization_monthly_closures for select
  using (true);

create policy "immunization_monthly_closures_insert_all"
  on public.immunization_monthly_closures for insert
  with check (true);

create policy "immunization_monthly_closures_update_all"
  on public.immunization_monthly_closures for update
  using (true)
  with check (true);

update public.roles_config
set allowed_modules =
  case
    when coalesce(allowed_modules, '[]'::jsonb) ? 'IMMUNIZATION_CLOSURES' then coalesce(allowed_modules, '[]'::jsonb)
    else coalesce(allowed_modules, '[]'::jsonb) || '["IMMUNIZATION_CLOSURES"]'::jsonb
  end
where role in ('ADMIN', 'INMU_DIRESA', 'INMU_UNGET', 'INMU_IPRESS')
  and not (coalesce(allowed_modules, '[]'::jsonb) ? 'IMMUNIZATION_CLOSURES');

comment on table public.immunization_monthly_closures is
  'Cierres mensuales de inmunizaciones: IPRESS realiza precierre y UNGET realiza cierre final.';
