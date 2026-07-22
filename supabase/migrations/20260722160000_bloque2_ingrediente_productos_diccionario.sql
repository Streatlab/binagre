-- BLOQUE 2: diccionario ingrediente <-> producto real por proveedor.
create table if not exists ingrediente_productos (
  id uuid primary key default gen_random_uuid(),
  ingrediente_id uuid not null references ingredientes(id) on delete cascade,
  proveedor text not null check (proveedor in ('mercadona','alcampo','otros')),
  producto_nombre text not null,
  unidad_minima_txt text,
  unidad_minima_num numeric,
  unidad text,
  precio_robot numeric,
  merma_pct numeric,               -- BLOQUE 3.5 bacalao: campo preparado, a 0/nulo por ahora
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ingrediente_id, proveedor, producto_nombre)
);
create index if not exists idx_ing_prod_ingrediente on ingrediente_productos(ingrediente_id);
create index if not exists idx_ing_prod_proveedor on ingrediente_productos(proveedor);

-- Poblado inicial desde lo que el robot ya casó (estado ok) — ver migracion de datos aplicada en prod.
