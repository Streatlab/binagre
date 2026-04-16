-- Config proveedores
CREATE TABLE IF NOT EXISTS config_proveedores (
  id uuid primary key default gen_random_uuid(),
  abv text not null unique,
  nombre_completo text not null,
  categoria text,
  activo boolean default true,
  created_at timestamptz default now()
);

ALTER TABLE config_proveedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON config_proveedores FOR ALL USING (true) WITH CHECK (true);

INSERT INTO config_proveedores (abv, nombre_completo, categoria) VALUES
  ('MER', 'Mercadona', 'Supermercado'),
  ('ALC', 'Auchan/Alcampo', 'Supermercado'),
  ('MRM', 'Cocina Interna', 'Interno'),
  ('CHI', 'Gruñona', 'Mayorista'),
  ('JAS', 'Jaserco', 'Mayorista'),
  ('PAM', 'Pamplonica', 'Cárnico'),
  ('ENV', 'Envases García', 'Packaging'),
  ('EMB', 'Embutidos', 'Cárnico'),
  ('TGT', 'Transgourmet', 'Mayorista'),
  ('PAS', 'Pastas Frescas', 'Especialista'),
  ('LID', 'Lidl', 'Supermercado'),
  ('EPS', 'Cocina Interna', 'Interno')
ON CONFLICT (abv) DO NOTHING;
