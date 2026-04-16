-- PASO 7: Limpiar lineas corruptas de REC028 y recalcular coste
DELETE FROM recetas_lineas
WHERE receta_id = (SELECT id FROM recetas WHERE codigo = 'REC028');

-- Resetear coste tanda/rac de REC028
UPDATE recetas
SET coste_tanda = 0, coste_rac = 0
WHERE codigo = 'REC028';
