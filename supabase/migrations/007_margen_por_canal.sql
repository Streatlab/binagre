-- Margen deseado por canal + marca asociada a proveedor

-- config_canales: añadir margen_deseado_pct (por canal, no global)
ALTER TABLE config_canales
  ADD COLUMN IF NOT EXISTS margen_deseado_pct numeric DEFAULT 15;

-- Valor por defecto en filas existentes
UPDATE config_canales
  SET margen_deseado_pct = 15
  WHERE margen_deseado_pct IS NULL;

-- config_proveedores: añadir marca_asociada
ALTER TABLE config_proveedores
  ADD COLUMN IF NOT EXISTS marca_asociada text;

-- Tabla mermas: renombrar neto_kg → neto_ud si existe
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mermas' AND column_name='neto_kg')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mermas' AND column_name='neto_ud') THEN
    ALTER TABLE mermas RENAME COLUMN neto_kg TO neto_ud;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

-- Asegurar neto_ud existe
ALTER TABLE mermas
  ADD COLUMN IF NOT EXISTS neto_ud numeric;
