-- 20260712130000 — Prompt 1 (fix papeleo, 12-jul-2026)
-- Aplicada en producción vía MCP. Se registra aquí para trazabilidad del repo.

-- Task 1c / Task 3 — columnas de candado y plantilla verificada en el diccionario NIF.
ALTER TABLE diccionario_nif_proveedor
  ADD COLUMN IF NOT EXISTS vision_usada boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS vision_fecha timestamptz,
  ADD COLUMN IF NOT EXISTS plantilla_verificada boolean DEFAULT false;

-- Task 4 — saneado del número de factura basura + re-evaluación de duplicados.
-- Backup previo:
--   create table _bk_20260712_facturas_numfact as select id, numero_factura, estado,
--     doc_estado, posible_duplicado, posible_duplicado_de, duplicado_revisado,
--     nif_emisor, total, now() as bk_at from facturas;
-- (numero_factura es NOT NULL: la basura se sustituye por placeholder SN- único, que
--  la regla de duplicado contable ignora por ser autogenerado.)

UPDATE facturas
SET numero_factura = 'SN-' || left(md5(id::text), 10)
WHERE lower(regexp_replace(numero_factura, '[.ºo:#·\- ]+$', '')) IN (
  'courier','hora','total','motivo','fecha','importe','cantidad','unidades','unidad',
  'iva','base','subtotal','cliente','proveedor','factura','invoice','numero','número',
  'num','serie','pagina','página','periodo','período','concepto','descripcion',
  'descripción','referencia','ref','nif','cif','pedido','albaran','albarán','vencimiento')
  OR numero_factura ~ '^\s*\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4}\s*$';

UPDATE facturas f
SET posible_duplicado = false, posible_duplicado_de = null
WHERE posible_duplicado IS true
  AND f.numero_factura NOT LIKE 'SN-%' AND f.numero_factura NOT LIKE 'LM-%'
  AND NOT EXISTS (
    SELECT 1 FROM facturas g
    WHERE g.id <> f.id AND g.nif_emisor IS NOT NULL AND g.nif_emisor = f.nif_emisor
      AND g.total = f.total AND g.numero_factura = f.numero_factura);

UPDATE facturas
SET posible_duplicado = false, posible_duplicado_de = null
WHERE posible_duplicado IS true AND (numero_factura LIKE 'SN-%' OR numero_factura LIKE 'LM-%');

UPDATE facturas f
SET estado = 'pendiente_revision'
WHERE estado = 'duplicada'
  AND NOT EXISTS (
    SELECT 1 FROM facturas g
    WHERE g.id <> f.id AND g.nif_emisor IS NOT NULL AND g.nif_emisor = f.nif_emisor
      AND g.total = f.total AND g.numero_factura = f.numero_factura
      AND f.numero_factura NOT LIKE 'SN-%' AND f.numero_factura NOT LIKE 'LM-%');
