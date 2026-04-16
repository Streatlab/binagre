-- Rediseño global: columnas extra en ingredientes, eps, recetas + tabla configuracion + seed marcaMap

-- ═══ INGREDIENTES: ultimo_precio, selector, activo, tipo_merma ═══
ALTER TABLE ingredientes
  ADD COLUMN IF NOT EXISTS ultimo_precio numeric,
  ADD COLUMN IF NOT EXISTS selector_precio text DEFAULT 'ultimo' CHECK (selector_precio IN ('ultimo', 'media')),
  ADD COLUMN IF NOT EXISTS activo boolean DEFAULT true;

-- tipo_merma ya existia en migracion 004; aseguramos constraint
DO $$ BEGIN
  ALTER TABLE ingredientes DROP CONSTRAINT IF EXISTS ingredientes_tipo_merma_check;
  ALTER TABLE ingredientes ADD CONSTRAINT ingredientes_tipo_merma_check CHECK (tipo_merma IS NULL OR tipo_merma IN ('Tecnica', 'Manual'));
EXCEPTION WHEN others THEN NULL; END $$;

-- ═══ EPS: categoria, usos ═══
ALTER TABLE eps
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS usos integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fecha date;

-- ═══ RECETAS: categoria, tamano_rac, unidad, fecha ═══
ALTER TABLE recetas
  ADD COLUMN IF NOT EXISTS tamano_rac numeric,
  ADD COLUMN IF NOT EXISTS unidad text,
  ADD COLUMN IF NOT EXISTS fecha date;

-- ═══ CONFIG_CANALES: activo ═══
ALTER TABLE config_canales
  ADD COLUMN IF NOT EXISTS activo boolean DEFAULT true;

-- Seed/update canales con comisiones correctas
INSERT INTO config_canales (canal, comision_pct, coste_fijo, activo) VALUES
  ('Uber Eats', 30, 0.82, true),
  ('Glovo', 30, 0, true),
  ('Just Eat', 30, 0, true),
  ('Web Propia', 7, 0, true),
  ('Venta Directa', 0, 0, true)
ON CONFLICT DO NOTHING;

-- ═══ CONFIG_PROVEEDORES: seed completo marcaMap ═══
INSERT INTO config_proveedores (abv, nombre_completo, categoria, activo) VALUES
  ('MER', 'Hacendado', 'Supermercado', true),
  ('ALC', 'Auchan', 'Supermercado', true),
  ('MRM', 'Cocina Interna', 'Interno', true),
  ('EPS', 'Cocina Interna', 'Interno', true),
  ('CHI', 'Gruñona', 'Mayorista', true),
  ('JAS', 'Jaserba', 'Mayorista', true),
  ('PAM', 'Pamesa', 'Cárnico', true),
  ('ENV', 'Envases Garcia', 'Packaging', true),
  ('EMB', 'Embutidos', 'Cárnico', true),
  ('TGT', 'Target', 'Mayorista', true),
  ('PAS', 'Pastas', 'Especialista', true),
  ('LID', 'Lidl', 'Supermercado', true)
ON CONFLICT (abv) DO UPDATE SET
  nombre_completo = EXCLUDED.nombre_completo,
  categoria = EXCLUDED.categoria;

-- ═══ TABLA CONFIGURACION (clave-valor) ═══
CREATE TABLE IF NOT EXISTS configuracion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave text UNIQUE NOT NULL,
  valor text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "allow all" ON configuracion FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Valores por defecto
INSERT INTO configuracion (clave, valor) VALUES
  ('estructura_pct', '30'),
  ('margen_deseado_pct', '15'),
  ('categorias', '["Verduras","Frutas","Carnes","Pescados","Lácteos","Cereales","Legumbres","Especias","Aceites","Bebidas","Congelados","Conservas","Panadería","Repostería","Limpieza","Packaging"]'),
  ('unidades', '["gr.","Kg.","ml.","L.","ud.","Ud.","Ración","Docena","Paquete","Botella","Caja","Saco"]')
ON CONFLICT (clave) DO NOTHING;
