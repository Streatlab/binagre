-- BLOQUE 1: categoria de ingrediente, fuente unica (categorias_ingredientes es el FK canonico).
alter table categorias_ingredientes add column if not exists activa boolean not null default true;

insert into categorias_ingredientes (nombre, orden, activa)
values
  ('Aceites/Grasas',1,true),('Aves/Carnes',2,true),('Bebidas',3,true),
  ('Cereales/Legumbres',4,true),('Condimentos/Salsas',5,true),('Congelados',6,true),
  ('Conservas/Quinta',7,true),('EPS',8,true),('Frutas/Verduras',9,true),
  ('Lácteos y Huevos',10,true),('Packaging',11,true),('Pescado/Marisco',12,true),
  ('SIN CLASIFICAR',99,true)
on conflict (nombre) do nothing;

update ingredientes set categoria='Pescado/Marisco' where categoria in ('Pescados/Mariscos');
update ingredientes set categoria='Frutas/Verduras'   where categoria in ('Frutas y Verduras');
update ingredientes set categoria='Bebidas'            where categoria in ('Bebidas/Licores');

update ingredientes i set categoria_id = c.id
from categorias_ingredientes c
where c.nombre = i.categoria and i.categoria_id is null;

update ingredientes i set categoria_id = (select id from categorias_ingredientes where nombre='SIN CLASIFICAR')
where i.categoria_id is null;

create or replace function fn_ingrediente_categoria_default() returns trigger
language plpgsql as $$
begin
  if new.categoria_id is null then
    select id into new.categoria_id from categorias_ingredientes where nombre='SIN CLASIFICAR' limit 1;
  end if;
  return new;
end $$;

drop trigger if exists trg_ingrediente_categoria_default on ingredientes;
create trigger trg_ingrediente_categoria_default
  before insert or update of categoria_id on ingredientes
  for each row execute function fn_ingrediente_categoria_default();
