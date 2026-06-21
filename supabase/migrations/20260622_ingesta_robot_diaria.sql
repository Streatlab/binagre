-- Tabla de aterrizaje del robot de ingesta diaria (Rushour + Sinqro).
-- NO mezcla con tablas de conciliación. Datos crudos por dia/marca/plataforma.
-- IMPORTANTE: este SQL NO se ha aplicado a producción todavia. Se aplica solo
-- cuando Rubén diga "publica".

create table if not exists public.ingesta_robot_diaria (
  id            uuid primary key default gen_random_uuid(),
  fecha         date not null,
  agregador     text not null,            -- rushour | sinqro
  plataforma    text not null,            -- uber_eats | glovo | just_eat
  marca         text not null,
  pedidos       integer,
  bruto         numeric,
  neto          numeric,
  ticket_medio  numeric,
  creado_en     timestamptz not null default now(),
  unique (fecha, agregador, plataforma, marca)
);

create index if not exists idx_ingesta_robot_fecha on public.ingesta_robot_diaria (fecha);
