-- 20260712150000 — Prompt 2/3 (fix papeleo). Aplicada en prod vía MCP.
-- Excluir facturas/movimientos no_conciliable de la cobertura y de los contadores
-- de dudas (para que los descartados no cuenten en las métricas).
CREATE OR REPLACE VIEW v_kpi_cobertura_conciliacion AS
SELECT
  (SELECT count(*) FROM conciliacion WHERE COALESCE(no_conciliable, false) = false) AS movimientos_total,
  (SELECT count(*) FROM conciliacion WHERE doc_estado = 'tiene' AND COALESCE(no_conciliable, false) = false) AS movimientos_con_factura,
  round(100.0 * (SELECT count(*) FROM conciliacion WHERE doc_estado = 'tiene' AND COALESCE(no_conciliable, false) = false)::numeric
        / NULLIF((SELECT count(*) FROM conciliacion WHERE COALESCE(no_conciliable, false) = false), 0)::numeric, 1) AS pct_cobertura,
  (SELECT count(*) FROM facturas) AS facturas_total,
  (SELECT count(*) FROM facturas WHERE categoria_factura IS NULL AND COALESCE(no_conciliable, false) = false) AS facturas_sin_categoria,
  (SELECT count(*) FROM facturas WHERE posible_duplicado IS TRUE AND COALESCE(no_conciliable, false) = false) AS facturas_posible_duplicado,
  (SELECT count(*) FROM facturas WHERE aviso_aritmetica IS TRUE AND COALESCE(no_conciliable, false) = false) AS facturas_aviso_aritmetica;
