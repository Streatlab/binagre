-- Seed parcial de eps_lineas con los datos disponibles en el prompt
-- NOTA: este seed solo cubre EPS001-EPS003 (con líneas detalladas en el prompt).
-- El resto de EPS y todas las recetas necesitan el Excel original que no está accesible
-- desde el entorno actual. Extraer manualmente de /01_ESCANDALLO.xlsx cuando esté disponible.

-- Función helper: insertar líneas solo si la EPS existe
DO $$
DECLARE
  eps_id_var uuid;
BEGIN

  -- ═══ EPS001 Tortitas v. 1.0 ═══
  SELECT id INTO eps_id_var FROM eps WHERE codigo = 'EPS001' LIMIT 1;
  IF eps_id_var IS NOT NULL THEN
    DELETE FROM eps_lineas WHERE eps_id = eps_id_var;
    INSERT INTO eps_lineas (eps_id, linea, ingrediente_nombre, cantidad, unidad, eur_ud_neta, eur_total, pct_total) VALUES
      (eps_id_var, 1,  'Huevos',                 4,    'ud.', 0.2333,   0.9333, 0.2586),
      (eps_id_var, 2,  'Leche entera_ALC',       1,    'L.',  0.97,     0.97,   0.2688),
      (eps_id_var, 3,  'Vinagre de vino_MER',    50,   'ml.', 0.00065,  0.0325, 0.009),
      (eps_id_var, 4,  'Aceite girasol_ALC',     90,   'ml.', 0.00163,  0.1467, 0.0407),
      (eps_id_var, 5,  'Aroma de vainilla_MER',  10,   'ml.', 0.01333,  0.1333, 0.0369),
      (eps_id_var, 6,  'Harina_MER',             700,  'gr.', 0.00059,  0.413,  0.1145),
      (eps_id_var, 7,  'Sal marina yodada_ALC',  5,    'gr.', 0.00038,  0.0019, 0.0005),
      (eps_id_var, 8,  'Azúcar_MER',             100,  'gr.', 0.001,    0.1,    0.0277),
      (eps_id_var, 9,  'Impulsor_MER',           4,    'ud.', 0.11667,  0.4667, 0.1293),
      (eps_id_var, 10, 'Levadura de pan_MER',    2,    'ud.', 0.16,     0.32,   0.0887),
      (eps_id_var, 11, 'Canela molida_MER',      0.5,  'gr.', 0.01923,  0.00962, 0.00266),
      (eps_id_var, 12, 'Aceite girasol_ALC',     50,   'ml.', 0.00163,  0.0815, 0.0226);
    UPDATE eps SET coste_tanda = 3.6079, coste_rac = 3.6079/40 WHERE id = eps_id_var;
  END IF;

  -- ═══ EPS002 Miso Butter ═══
  SELECT id INTO eps_id_var FROM eps WHERE codigo = 'EPS002' LIMIT 1;
  IF eps_id_var IS NOT NULL THEN
    DELETE FROM eps_lineas WHERE eps_id = eps_id_var;
    INSERT INTO eps_lineas (eps_id, linea, ingrediente_nombre, cantidad, unidad, eur_ud_neta, eur_total, pct_total) VALUES
      (eps_id_var, 1, 'Aceite girasol_ALC',    200, 'ml.', 0.00163, 0.326,  0.0497),
      (eps_id_var, 2, 'Ajo picado_MER',        10,  'gr.', 0.05317, 0.5317, 0.081),
      (eps_id_var, 3, 'Margarina_ALC',         100, 'gr.', 0.00298, 0.298,  0.0454),
      (eps_id_var, 4, 'Miso blanco_CHI',       300, 'gr.', 0.008,   2.4,    0.366),
      (eps_id_var, 5, 'Tahini_MER',            200, 'gr.', 0.01475, 2.95,   0.4499),
      (eps_id_var, 6, 'Azúcar_MER',            50,  'gr.', 0.001,   0.05,   0.00762),
      (eps_id_var, 7, 'Sal marina yodada_ALC', 5,   'gr.', 0.00038, 0.0019, 0.00029),
      (eps_id_var, 8, 'Agua del grifo_MER',    350, 'ml.', 0.0,     0.0,    0.0);
    UPDATE eps SET coste_tanda = 6.5576, coste_rac = 6.5576/1215 WHERE id = eps_id_var;
  END IF;

  -- ═══ EPS003 Tortitas V. 2.1 ═══
  SELECT id INTO eps_id_var FROM eps WHERE codigo = 'EPS003' LIMIT 1;
  IF eps_id_var IS NOT NULL THEN
    DELETE FROM eps_lineas WHERE eps_id = eps_id_var;
    INSERT INTO eps_lineas (eps_id, linea, ingrediente_nombre, cantidad, unidad, eur_ud_neta, eur_total, pct_total) VALUES
      (eps_id_var, 1, 'Leche entera_ALC',      700, 'ml.', 0.00097, 0.679,   0.2978),
      (eps_id_var, 2, 'Huevos',                2,   'ud.', 0.23333, 0.46667, 0.2047),
      (eps_id_var, 3, 'Aceite girasol_ALC',    80,  'ml.', 0.00163, 0.1304,  0.0572),
      (eps_id_var, 4, 'Vinagre de vino_MER',   25,  'ml.', 0.00065, 0.01625, 0.00713),
      (eps_id_var, 5, 'Azúcar_MER',            200, 'gr.', 0.001,   0.2,     0.0877),
      (eps_id_var, 6, 'Harina_MER',            600, 'gr.', 0.00059, 0.354,   0.1553),
      (eps_id_var, 7, 'Impulsor_MER',          3,   'ud.', 0.11667, 0.35,    0.1535),
      (eps_id_var, 8, 'Sal marina yodada_ALC', 5,   'gr.', 0.00038, 0.0019,  0.00083),
      (eps_id_var, 9, 'Aceite girasol_ALC',    50,  'ml.', 0.00163, 0.0815,  0.03575);
    UPDATE eps SET coste_tanda = 2.2797, coste_rac = 2.2797/44 WHERE id = eps_id_var;
  END IF;

END $$;
