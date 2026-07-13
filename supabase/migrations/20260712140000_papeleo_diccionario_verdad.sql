-- 20260712140000 — Prompt 2 (fix papeleo, 12-jul-2026). Aplicada en prod vía MCP.

-- Task 1 — consolidar en el diccionario NIF los datos que solo vivían en
-- reglas_conciliacion (plantillas, categoría). Backup: _bk_20260712_reglas_conciliacion.
UPDATE diccionario_nif_proveedor d
SET plantilla_total_label = coalesce(d.plantilla_total_label, r.plantilla_total_label),
    plantilla_fecha_formato = coalesce(d.plantilla_fecha_formato, r.plantilla_fecha_formato),
    plantilla_num_label = coalesce(d.plantilla_num_label, r.plantilla_num_label),
    actualizado_en = now()
FROM reglas_conciliacion r
WHERE r.patron_nif = d.nif AND r.plantilla_total_label IS NOT NULL AND d.plantilla_total_label IS NULL;

UPDATE diccionario_nif_proveedor d
SET categoria_codigo = r.categoria_codigo, actualizado_en = now()
FROM reglas_conciliacion r
WHERE r.patron_nif = d.nif AND r.categoria_codigo IS NOT NULL AND d.categoria_codigo IS NULL;

-- Task 2 — eliminar tablas muertas (backups _bk_20260712_*).
-- create table _bk_20260712_ocr_ia_proveedores as select * from ocr_ia_proveedores;
-- create table _bk_20260712_config_matching as select * from config_matching;
DROP TABLE IF EXISTS ocr_ia_proveedores;
DROP TABLE IF EXISTS config_matching;
