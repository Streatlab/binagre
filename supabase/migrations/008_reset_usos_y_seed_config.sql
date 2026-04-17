-- Reset usos a 0 (se recalculará cuando el escandallo esté completo)
UPDATE ingredientes SET usos = 0;
UPDATE eps SET usos = 0;

-- Categorías completas del GAS
UPDATE configuracion
  SET valor = '["Aves/Carnes","Lácteos y Huevos","Cereales/Legumbres","Frutas/Verduras","Conservas/Quinta","Aceites/Grasas","Condimentos/Salsas","Packaging","Bebidas","Vacío","Mermas","Pescado/Marisco","Congelados","EPS","MRM"]'
  WHERE clave = 'categorias';

INSERT INTO configuracion (clave, valor)
  VALUES ('categorias', '["Aves/Carnes","Lácteos y Huevos","Cereales/Legumbres","Frutas/Verduras","Conservas/Quinta","Aceites/Grasas","Condimentos/Salsas","Packaging","Bebidas","Vacío","Mermas","Pescado/Marisco","Congelados","EPS","MRM"]')
  ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor;

-- Unidades STD/MIN del GAS
UPDATE configuracion
  SET valor = '["Kg.","gr.","L.","ml.","Ud.","ud.","Docena","Caja","Sobre","Bote","Ración","Rc."]'
  WHERE clave = 'unidades';

INSERT INTO configuracion (clave, valor)
  VALUES ('unidades', '["Kg.","gr.","L.","ml.","Ud.","ud.","Docena","Caja","Sobre","Bote","Ración","Rc."]')
  ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor;

-- Formatos de compra (nueva clave)
INSERT INTO configuracion (clave, valor)
  VALUES ('formatos', '["Garrafa","Caja","Bandeja","Bolsa/Malla","Bote","EP/Receta","Unidad","Lata","Litro","Paquete","Botella","Kg.","Ración"]')
  ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor;

-- Parámetros globales
INSERT INTO configuracion (clave, valor) VALUES
  ('estructura_pct', '30'),
  ('margen_minimo', '15'),
  ('margen_deseado_pct', '15')
  ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor;

-- Plataformas completas con coste fijo correcto por canal
INSERT INTO config_canales (canal, comision_pct, coste_fijo, margen_deseado_pct, activo) VALUES
  ('Venta Directa', 0,  0,    15, true),
  ('Glovo',         30, 0.75, 15, true),
  ('Just Eat',      30, 0.75, 15, true),
  ('Uber Eats',     30, 0.82, 15, true),
  ('Web Propia',    7,  0.50, 15, true)
ON CONFLICT (canal) DO UPDATE SET
  comision_pct = EXCLUDED.comision_pct,
  coste_fijo = EXCLUDED.coste_fijo,
  margen_deseado_pct = EXCLUDED.margen_deseado_pct;

-- Proveedores completos del GAS
INSERT INTO config_proveedores (abv, nombre_completo, categoria, activo) VALUES
  ('MER', 'Mercadona',      'Supermercado', true),
  ('ALC', 'Alcampo',        'Supermercado', true),
  ('MRM', 'Merma',          'Interno',      true),
  ('CHI', 'China veldula',  'Mayorista',    true),
  ('JAS', 'Jasa',           'Mayorista',    true),
  ('PAM', 'Pampols',        'Cárnico',      true),
  ('ENV', 'Envapro',        'Packaging',    true),
  ('EMB', 'Embajadores',    'Cárnico',      true),
  ('TGT', 'Tgt',            'Mayorista',    true),
  ('PAS', 'Pascual',        'Especialista', true),
  ('EPS', 'Cocina Interna', 'Interno',      true),
  ('LID', 'Lidl',           'Supermercado', true)
ON CONFLICT (abv) DO UPDATE SET
  nombre_completo = EXCLUDED.nombre_completo,
  categoria = EXCLUDED.categoria;

-- Asegurar constraint UNIQUE en config_canales.canal para upserts futuros
DO $$ BEGIN
  ALTER TABLE config_canales ADD CONSTRAINT config_canales_canal_key UNIQUE (canal);
EXCEPTION WHEN others THEN NULL; END $$;
