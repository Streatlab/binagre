-- Lineas de ingredientes dentro de cada EPS
CREATE TABLE IF NOT EXISTS eps_lineas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eps_id uuid NOT NULL REFERENCES eps(id) ON DELETE CASCADE,
  ingrediente_id uuid REFERENCES ingredientes(id) ON DELETE SET NULL,
  nombre_override text,
  cantidad numeric DEFAULT 0,
  ud text,
  eur_std numeric DEFAULT 0,
  merma_pct numeric DEFAULT 0,
  coste_unitario numeric DEFAULT 0,
  coste_total numeric DEFAULT 0,
  orden int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE eps_lineas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON eps_lineas FOR ALL USING (true) WITH CHECK (true);

-- Lineas de ingredientes/EPS dentro de cada Receta
CREATE TABLE IF NOT EXISTS recetas_lineas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receta_id uuid NOT NULL REFERENCES recetas(id) ON DELETE CASCADE,
  ingrediente_id uuid REFERENCES ingredientes(id) ON DELETE SET NULL,
  eps_id uuid REFERENCES eps(id) ON DELETE SET NULL,
  nombre_override text,
  cantidad numeric DEFAULT 0,
  ud text,
  eur_std numeric DEFAULT 0,
  merma_pct numeric DEFAULT 0,
  coste_unitario numeric DEFAULT 0,
  coste_total numeric DEFAULT 0,
  orden int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE recetas_lineas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON recetas_lineas FOR ALL USING (true) WITH CHECK (true);

-- Añadir campo pvp por canal a recetas (si no existen)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recetas' AND column_name='pvp_glovo') THEN
    ALTER TABLE recetas ADD COLUMN pvp_glovo numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recetas' AND column_name='pvp_je') THEN
    ALTER TABLE recetas ADD COLUMN pvp_je numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recetas' AND column_name='pvp_web') THEN
    ALTER TABLE recetas ADD COLUMN pvp_web numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recetas' AND column_name='pvp_directo') THEN
    ALTER TABLE recetas ADD COLUMN pvp_directo numeric;
  END IF;
END $$;
