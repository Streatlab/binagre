-- Vista única de estado de documento por movimiento de conciliación
-- estado_doc:
--   'tiene'       → factura_id no null Y existe en tabla facturas
--   'no_requiere' → categoría de ingreso (código PGC grupo 7) o traspaso (3.1)
--   'falta'       → el resto (gasto sin factura)

CREATE OR REPLACE VIEW v_estado_documento AS
SELECT
  c.id            AS conciliacion_id,
  c.factura_id,
  c.gasto_id,
  c.importe,
  c.fecha,
  c.titular_id,
  CASE
    WHEN c.factura_id IS NOT NULL AND f.id IS NOT NULL
      THEN 'tiene'
    WHEN cp.codigo IS NOT NULL AND (
         LEFT(cp.codigo::text, 1) = '7'
      OR cp.codigo::text = '3.1'
    )
      THEN 'no_requiere'
    ELSE 'falta'
  END::text        AS estado_doc
FROM conciliacion c
LEFT JOIN facturas          f  ON c.factura_id = f.id
LEFT JOIN categorias_pyg    cp ON c.categoria  = cp.codigo;
