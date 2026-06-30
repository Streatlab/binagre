# REPORTE §3.4 · Verificación bloque económico
## Puente Económico Plataformas → Módulos ERP
**Fecha:** 25-jun-2026 · **Rama:** `trabajo`

---

## Resumen ejecutivo

Todos los módulos del bloque económico están **correctamente conectados** a `ventas_plataforma`.
El mecanismo es la función central `calcNetoPorCanal` (REAL MANDA) + la función
`getNetoRealOCR` de `ColFacturacionCanal`. Cuando una liquidación real entra por
Documentación y aterriza en `ventas_plataforma`, **todos los módulos la reflejan automáticamente**
sin ningún ajuste adicional de código.

---

## Módulo a módulo

### ✅ Dashboard (ResumenLanding / TabResumen)
- **`canalStats`** → `calcNetoPorCanal({ modo:'agregado_canal', fechaDesde, fechaHasta })` → REAL MANDA aplica.
  Si hay fila en `ventas_plataforma` para ese canal/periodo, el neto real pisa al estimado.
- **`netoEstimado`** → suma de `canalStats[n].neto` → ya es real cuando hay datos.
- **`porCobrar`** → `calcPorCobrar` → `calcNetoPorCanal` → REAL MANDA. ✅
- **`ventasMarca`** → lee `ventas_plataforma` directamente (`marca, neto, bruto, pedidos`). ✅
- **`marcasReales`** → derivado de `ventasMarca` (90 días). ✅
- **`costePorPedido`** → usa `netoEstimado` (ya real). ✅
- **`gruposData / food cost`** → `pctSobreNetos = gasto/netoEstimado` → mejora solo cuando `netoEstimado` es real. ✅
- **Margen por canal** → `canalStats[n].margen = margenPct` de `calcNetoPorCanal`. ✅

### ✅ ColFacturacionCanal
- Función `getNetoRealOCR` lee `ventas_plataforma` directamente para el mes/año.
- Fuente mostrada: `ocr_real` (dato real) o `calculado` (estimado si no hay dato real).
- Cuando hay liquidación Uber/Glovo/JE en `ventas_plataforma`, la card muestra bruto y neto **reales**. ✅

### ✅ Evolución (TabEvolucion)
- `canalPeriodo` → `calcNetoPorCanal` → REAL MANDA.
- Cards por canal muestran TM bruto y TM neto. El TM neto mejora solo al entrar datos reales. ✅

### ✅ Running anual (useRunningAnual)
- `brutos` → `facturacion_diario` (brutos diarios, fuente correcta para el acumulado).
- Neto calculado vía `calcNetoPorCanal` en los componentes que consumen el hook. ✅
- Realtime: el canal `ventas_plataforma_neto_changes` invalida la caché y dispara `config_canales:changed`. ✅

### ✅ Cashflow "por cobrar"
- `calcPorCobrar` → agrupa `facturacion_diario` por liquidación (semana Uber, quincena Glovo/JE).
- Cada liquidación pasa por `calcNetoPorCanal` → REAL MANDA aplica. ✅
- La frontera de cobro del banco (`v_frontera_cobro_banco`) y el cierre histórico (2026-06-19)
  excluyen lo ya cobrado. ✅

### ✅ Margen por canal
- Viene de `canalStats[n].margen` (margenPct de `calcNetoPorCanal`). ✅

### ✅ Food cost por canal
- `gruposData.producto.pctSobreNetos` = gasto producto / `netoEstimado`.
- Cuando `netoEstimado` es real (hay liquidación), el % de food cost es real. ✅

---

## Flujo técnico completo

```
ventas_plataforma (INSERT/UPDATE)
      │
      ├─ Realtime trigger en calcNetoPlataforma.ts
      │    → invalida cacheLiqReal + cacheRatiosReales
      │    → dispara 'config_canales:changed'
      │    → todos los componentes que escuchan ese evento se recargan
      │
      ├─ calcNetoPorCanal() · REAL MANDA
      │    1) Busca realesContenidas(canal, desde, hasta)
      │    2) Si brutoReal > 0 → neto = netoReal + estimado_residual
      │    3) Si no → estimado calibrado con ratio empírico (fiable ≥3 periodos/120 ped)
      │
      └─ ColFacturacionCanal · getNetoRealOCR()
           Lee ventas_plataforma directamente por (mes, año, canal)
           Fuente 'ocr_real' manda sobre 'calculado'
```

---

## Estado por plataforma (con parsers Chat A)

| Plataforma | Fuente | Neto real | Ads/Promo | Prime/Promo |
|---|---|---|---|---|
| **Uber Eats** | PDF U1 (parserUberResumenMensual) | ✅ | ✅ | ⚠️ pendiente U3/U5 |
| **Uber Eats** | CSV emea U2 (fallback) | ✅ | ✅ | ⚠️ pendiente |
| **Glovo** | ZIP liquidación (parserGlovoLiquidacion) | ✅ | ⚠️ pendiente mapeo | ✅ |
| **Just Eat** | .doc HTML (parserJustEatFactura) | ✅ | ⚠️ pendiente mapeo | N/A |

---

## Pendientes tras este reporte

1. **Prime/Promo Uber** → parsers U3 (detalle pedido) / U5 (historial).
   Campo `pedidos_prime`/`pedidos_promo` queda `undefined` en U1 → `estadisticas_prime_promo` no se actualiza para Uber.
2. **Glovo ads/promo** → `parserGlovoLiquidacion` no rellena `ads_eur`/`promo_eur`. Añadir en segunda pasada.
3. **JE ads** → `parserJustEatFactura` no rellena `ads_eur`. Añadir en segunda pasada.
4. **Test real con PDF Uber U1** → ⚠️ PENDIENTE VERIFICAR (sin documento de prueba en este chat).
   Criterio: fila en `ventas_plataforma` con neto/bruto/pedidos correctos + columnas desglose rellenas.

---

## Conclusión

**El bloque económico refleja el dato real automáticamente cuando entra una liquidación.**
No se necesita ningún ajuste de código adicional en los módulos de lectura.
Los pendientes son de enriquecimiento (Prime/Promo, desglose ads) no de conexión básica.
