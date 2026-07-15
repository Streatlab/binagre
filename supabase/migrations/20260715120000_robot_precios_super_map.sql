-- Mapeo producto↔ingrediente para el robot de precios Mercadona+Alcampo (BLOQUE 6).
-- Semana 1: se rellena buscando por nombre. Semanas siguientes: se entra directo
-- por url_producto/ean y solo se re-busca lo marcado sin_match/dudoso.
create table if not exists robot_precios_map (
  id bigint generated always as identity primary key,
  iding text not null unique,
  proveedor text not null check (proveedor in ('Mercadona', 'Alcampo')),
  url_producto text,
  ean text,
  nombre_web text,
  estado_match text not null default 'sin_match' check (estado_match in ('ok', 'dudoso', 'sin_match')),
  revisado_por_humano boolean not null default false,
  actualizado_en timestamptz not null default now()
);

create index if not exists idx_robot_precios_map_estado on robot_precios_map(estado_match);
