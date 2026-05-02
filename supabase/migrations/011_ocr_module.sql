-- Migración 011: Módulo OCR
-- Tabla reglas_ocr + columna file_hash en facturas + tabla conciliacion_facturas

-- 1. Tabla reglas_ocr para auto-asignación de facturas
create table if not exists public.reglas_ocr (
  id uuid primary key default gen_random_uuid(),
  patron_nif text,
  patron_nombre text,
  categoria_id text,
  titular_id uuid,
  activa boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.reglas_ocr is 'Reglas de auto-asignación OCR para facturas';

-- 2. Añadir columna file_hash a tabla facturas (si no existe)
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'facturas' 
    and column_name = 'file_hash'
  ) then
    alter table public.facturas add column file_hash text;
    create index if not exists idx_facturas_file_hash on public.facturas(file_hash);
  end if;
end $$;

-- 3. Tabla relacional N:M entre conciliacion y facturas
create table if not exists public.conciliacion_facturas (
  id uuid primary key default gen_random_uuid(),
  movimiento_id uuid not null,
  factura_id uuid not null,
  created_at timestamptz default now(),
  unique(movimiento_id, factura_id)
);

comment on table public.conciliacion_facturas is 'Relación N:M entre movimientos conciliacion y facturas';

-- Indices
create index if not exists idx_conciliacion_facturas_mov on public.conciliacion_facturas(movimiento_id);
create index if not exists idx_conciliacion_facturas_fact on public.conciliacion_facturas(factura_id);
