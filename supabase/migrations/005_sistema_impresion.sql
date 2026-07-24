-- Sistema de impresión ERP (aplicada en remoto el 24-jul-2026 como "sistema_impresion_tablas")
-- Preferencias por documento + trazabilidad de envíos + secreto Brevo desde Vault.
create table if not exists public.impresion_preferencias (
  id uuid primary key default gen_random_uuid(),
  documento_id text not null unique,
  nombre text not null,
  area text not null check (area in ('cocina','finanzas','equipo','operaciones')),
  tinta text not null default 'bn' check (tinta in ('bn','color')),
  orientacion text not null default 'vertical' check (orientacion in ('vertical','apaisado')),
  copias int not null default 1 check (copias between 1 and 10),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.impresion_envios (
  id uuid primary key default gen_random_uuid(),
  documento_id text not null,
  destino text not null check (destino in ('local','aqui')),
  estado text not null check (estado in ('enviado','error')),
  message_id text,
  error text,
  usuario text,
  creado_en timestamptz not null default now()
);

alter table public.impresion_preferencias enable row level security;
alter table public.impresion_envios enable row level security;
create policy "impresion_preferencias_all" on public.impresion_preferencias for all using (true) with check (true);
create policy "impresion_envios_all" on public.impresion_envios for all using (true) with check (true);

create or replace function public.fn_secreto_brevo()
 returns text
 language sql
 security definer
 set search_path to ''
as $function$
  select decrypted_secret from vault.decrypted_secrets where name = 'brevo_api_key' limit 1;
$function$;
-- La semilla de los 35 documentos vive en la migración remota (inventario del handoff).
