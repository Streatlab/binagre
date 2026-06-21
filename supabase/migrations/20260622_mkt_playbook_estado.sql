-- Estado del panel Playbook Agencia Delivery (módulo MKT)
-- Persiste el estado de cada paso del plan de 6 fases.
create table if not exists public.mkt_playbook_estado (
  id text primary key,
  estado text not null default 'ACTIVO' check (estado in ('ACTIVO','EN_CURSO','HECHO')),
  nota text,
  updated_at timestamptz not null default now()
);

alter table public.mkt_playbook_estado enable row level security;

-- Acceso para usuarios autenticados (ajustar a la política del proyecto si difiere)
drop policy if exists "mkt_playbook_rw" on public.mkt_playbook_estado;
create policy "mkt_playbook_rw" on public.mkt_playbook_estado
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
