-- 012: Manifiesto de ingesta OCR (cero pérdidas) + contador ignorados + plantilla Lidl
-- Aplicada en Supabase eryauogxcpbgdryeimdq el 09/06/26.

-- 1. Tabla ocr_manifiesto: UNA fila por archivo desde el instante del drop.
--    Es la fuente de verdad de "qué entró" y su estado final. Nada se pierde sin rastro.
create table if not exists public.ocr_manifiesto (
  id uuid primary key default gen_random_uuid(),
  sesion_id text,
  grupo_id text,
  nombre text not null,
  size bigint,
  hash_cliente text,
  storage_path text,
  estado text not null default 'registrado',
  detalle text,
  creado timestamptz not null default now(),
  actualizado timestamptz default now()
);

comment on table public.ocr_manifiesto is 'Manifiesto de ingesta OCR: 1 fila por archivo desde el drop. estados: registrado | en_storage | error_subida | leida | lectura_manual | duplicada | ignorada | error';

create index if not exists idx_ocr_manifiesto_sesion on public.ocr_manifiesto(sesion_id);
create index if not exists idx_ocr_manifiesto_grupo on public.ocr_manifiesto(grupo_id);
create index if not exists idx_ocr_manifiesto_estado on public.ocr_manifiesto(estado);
create unique index if not exists uq_ocr_manifiesto_storage on public.ocr_manifiesto(storage_path) where storage_path is not null;

-- RLS igual al resto de tablas OCR (ocr_sessions / ocr_auditoria): permisiva anon+authenticated.
alter table public.ocr_manifiesto enable row level security;
drop policy if exists p_all_anon on public.ocr_manifiesto;
create policy p_all_anon on public.ocr_manifiesto for all to authenticated, anon using (true) with check (true);

-- 2. Contador de ignorados (archivos que NO son factura: CSV/resúmenes de ingresos).
alter table public.ocr_sessions add column if not exists ignorados integer not null default 0;

-- 3. Plantilla Lidl (NIF A60195278): labels estándar de ticket Lidl España.
--    DEBE validarse con la primera subida real de una factura Lidl.
update public.reglas_conciliacion
   set plantilla_total_label = 'TOTAL',
       plantilla_fecha_formato = 'DD.MM.YY',
       plantilla_num_label = NULL
 where patron_nif = 'A60195278';
