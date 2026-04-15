-- StreatLab ERP - Schema completo
-- Ejecutar en Supabase SQL Editor

-- 0. Usuarios (login por nombre + PIN)
create table usuarios (
  id uuid primary key default gen_random_uuid(),
  nombre text unique not null,
  pin text not null,
  perfil text not null check (perfil in ('admin', 'cocina')),
  activo boolean default true,
  created_at timestamptz default now()
);

-- Seed usuarios iniciales
insert into usuarios (nombre, pin, perfil) values
  ('Rubén', '0000', 'admin'),
  ('Emilio', '0000', 'cocina');

alter table usuarios enable row level security;
create policy "allow all" on usuarios for all using (true) with check (true);

-- 1. Marcas
create table marcas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activa boolean default true,
  color text,
  tipo_cocina text,
  created_at timestamptz default now()
);

-- 2. Ingredientes
create table ingredientes (
  id uuid primary key default gen_random_uuid(),
  iding text,
  categoria text,
  nombre_base text,
  abv text,
  nombre text not null,
  marca_compra text,
  formato text,
  uds numeric,
  ud_std text,
  ud_min numeric,
  precio_total numeric,
  precio_neto numeric,
  created_at timestamptz default now()
);

-- 3. EPS (Elaboraciones previas / subrecetas)
create table eps (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  nombre text not null,
  raciones numeric,
  tamano_rac numeric,
  created_at timestamptz default now()
);

-- 4. EPS ingredientes
create table eps_ingredientes (
  id uuid primary key default gen_random_uuid(),
  eps_id uuid not null references eps(id) on delete cascade,
  ingrediente_id uuid not null references ingredientes(id) on delete restrict,
  cantidad numeric,
  ud text,
  coste_total numeric,
  created_at timestamptz default now()
);

-- 5. Recetas
create table recetas (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  nombre text not null,
  raciones numeric,
  tamano_rac numeric,
  marca_id uuid references marcas(id) on delete set null,
  categoria text,
  created_at timestamptz default now()
);

-- 6. Recetas ingredientes
create table recetas_ingredientes (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references recetas(id) on delete cascade,
  ingrediente_id uuid references ingredientes(id) on delete restrict,
  eps_id uuid references eps(id) on delete restrict,
  cantidad numeric,
  ud text,
  coste_total numeric,
  created_at timestamptz default now()
);

-- 7. Pricing
create table pricing (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references recetas(id) on delete cascade,
  canal text not null,
  pvp numeric,
  coste numeric,
  margen_pct numeric,
  created_at timestamptz default now()
);

-- 8. Facturación diario
create table facturacion_diario (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  servicio text,
  canal text,
  pedidos integer,
  bruto numeric,
  created_at timestamptz default now()
);

-- 9. Facturación semanas
create table facturacion_semanas (
  id uuid primary key default gen_random_uuid(),
  semana integer,
  periodo text,
  pedidos integer,
  bruto numeric,
  objetivo numeric,
  canal text,
  created_at timestamptz default now()
);

-- 10. Facturación meses
create table facturacion_meses (
  id uuid primary key default gen_random_uuid(),
  mes integer,
  anio integer,
  pedidos integer,
  bruto numeric,
  objetivo numeric,
  canal text,
  created_at timestamptz default now()
);

-- 11. POS ventas
create table pos_ventas (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  marca_id uuid references marcas(id) on delete set null,
  canal text,
  plato text,
  uds integer,
  bruto numeric,
  hora time,
  created_at timestamptz default now()
);

-- 12. Proveedores
create table proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text,
  contacto text,
  condiciones text,
  activo boolean default true,
  created_at timestamptz default now()
);

-- 13. Compras
create table compras (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid references proveedores(id) on delete set null,
  concepto text,
  importe numeric,
  fecha_factura date,
  fecha_vencimiento date,
  estado text default 'pendiente',
  fecha_pago date,
  mes text,
  link_factura text,
  notas text,
  created_at timestamptz default now()
);

-- 14. Conciliación
create table conciliacion (
  id uuid primary key default gen_random_uuid(),
  fecha date,
  concepto text,
  importe numeric,
  tipo text,
  categoria text,
  proveedor text,
  factura text,
  mes text,
  link_factura text,
  notas text,
  created_at timestamptz default now()
);

-- 15. Config canales
create table config_canales (
  id uuid primary key default gen_random_uuid(),
  canal text unique not null,
  comision_pct numeric,
  fijo_eur numeric,
  margen_obj_pct numeric,
  created_at timestamptz default now()
);

-- 16. Empleados
create table empleados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cargo text,
  telefono text,
  email text,
  fecha_ingreso date,
  activo boolean default true,
  created_at timestamptz default now()
);

-- Índices
create index idx_eps_ingredientes_eps on eps_ingredientes(eps_id);
create index idx_eps_ingredientes_ing on eps_ingredientes(ingrediente_id);
create index idx_recetas_ingredientes_rec on recetas_ingredientes(receta_id);
create index idx_recetas_ingredientes_ing on recetas_ingredientes(ingrediente_id);
create index idx_recetas_ingredientes_eps on recetas_ingredientes(eps_id);
create index idx_recetas_marca on recetas(marca_id);
create index idx_pricing_receta on pricing(receta_id);
create index idx_facturacion_diario_fecha on facturacion_diario(fecha);
create index idx_facturacion_semanas_semana on facturacion_semanas(semana);
create index idx_facturacion_meses_anio_mes on facturacion_meses(anio, mes);
create index idx_pos_ventas_fecha on pos_ventas(fecha);
create index idx_pos_ventas_marca on pos_ventas(marca_id);
create index idx_compras_proveedor on compras(proveedor_id);
create index idx_compras_estado on compras(estado);
create index idx_conciliacion_fecha on conciliacion(fecha);

-- RLS (habilitar en todas las tablas)
alter table marcas enable row level security;
alter table ingredientes enable row level security;
alter table eps enable row level security;
alter table eps_ingredientes enable row level security;
alter table recetas enable row level security;
alter table recetas_ingredientes enable row level security;
alter table pricing enable row level security;
alter table facturacion_diario enable row level security;
alter table facturacion_semanas enable row level security;
alter table facturacion_meses enable row level security;
alter table pos_ventas enable row level security;
alter table proveedores enable row level security;
alter table compras enable row level security;
alter table conciliacion enable row level security;
alter table config_canales enable row level security;
alter table empleados enable row level security;

-- Políticas RLS permisivas (ajustar según auth)
create policy "allow all" on marcas for all using (true) with check (true);
create policy "allow all" on ingredientes for all using (true) with check (true);
create policy "allow all" on eps for all using (true) with check (true);
create policy "allow all" on eps_ingredientes for all using (true) with check (true);
create policy "allow all" on recetas for all using (true) with check (true);
create policy "allow all" on recetas_ingredientes for all using (true) with check (true);
create policy "allow all" on pricing for all using (true) with check (true);
create policy "allow all" on facturacion_diario for all using (true) with check (true);
create policy "allow all" on facturacion_semanas for all using (true) with check (true);
create policy "allow all" on facturacion_meses for all using (true) with check (true);
create policy "allow all" on pos_ventas for all using (true) with check (true);
create policy "allow all" on proveedores for all using (true) with check (true);
create policy "allow all" on compras for all using (true) with check (true);
create policy "allow all" on conciliacion for all using (true) with check (true);
create policy "allow all" on config_canales for all using (true) with check (true);
create policy "allow all" on empleados for all using (true) with check (true);
