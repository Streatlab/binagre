# TASKS — Implementación mockups validados (3 módulos)

> Spec fuente: `.claude/plans/spec-mockups-validados.md`
> ADR: `.claude/plans/adr.md`
> Ejecutar en orden estricto. NO saltarse tareas. NO parar entre fases salvo fallo irrecuperable.

---

## FASE A — Componentes compartidos + Panel Global tab Resumen

### A0 — Pre-flight
1. **Supabase schema check** — Ejecutar via MCP `SELECT table_name FROM information_schema.tables WHERE table_schema='public'` y verificar qué tablas del spec existen (`tareas_pendientes`, `imports_log`, `reglas_auto_categoria`, `objetivos`, `marcas`). Documentar resultado en `summary.md` sección "Tablas encontradas / no encontradas". Output esperado: lista confirmada de tablas existentes vs faltantes.

2. **Migraciones BD faltantes** — Para cada tabla que NO exista, crear SQL migration mínima con los campos necesarios para que las queries del spec funcionen sin errores en runtime. Ejecutar en Supabase MCP. Tablas candidatas:
   - `tareas_pendientes (id, nombre, estado, urgencia, fecha_limite)`
   - `imports_log (id, archivo, tipo_detectado, contraparte_nombre, contraparte_nif, importe, categoria_codigo, estado, created_at)`
   - `reglas_auto_categoria (id, patron_nif, patron_concepto, categoria_codigo, prioridad)`
   - `objetivos (id, tipo, periodo_label, valor, created_at)` — si no hay tabla similar
   - `marcas (id, nombre, estado)` — si no existe
   Output esperado: migraciones aplicadas sin error, tablas visibles en Supabase.

### A1 — Tokens canónicos
3. **`src/components/panel/resumen/tokens.ts`** — Sustituir contenido completo con los tokens del spec (COLORS, FONT, SIZES, CARDS, TABS_PILL, SUBTABS, DROPDOWN_BTN, BAR, LAYOUT, EDITABLE, TAG). Resolver conflicto de doble definición `COLORS.glovo`: mantener `glovo: '#e8f442'` en posición final, añadir `glovoAccent: '#e8f442'` como alias. Output esperado: archivo compilable con todas las constantes exportadas, `npx tsc --no-emit` sin errores en este archivo.

### A2 — Componentes UI compartidos
4. **`src/components/ui/TabsPastilla.tsx`** — CREAR. Props: `{ tabs: Array<{ id: string; label: string; badge?: number }>; activeId: string; onChange: (id: string) => void }`. Estilos exactos `TABS_PILL` del spec. Badge: número rojo `#E24B4A` si `badge > 0`, oculto si 0. Output esperado: componente exportable sin errores TS.

5. **`src/components/ui/SubTabsInverso.tsx`** — CREAR. Props: `{ tabs: Array<{ id: string; label: string }>; activeId: string; onChange: (id: string) => void; prefijoLbl?: string }`. Estilos exactos `SUBTABS` del spec. Label prefijo en Oswald 10px uppercase muted a la izquierda si `prefijoLbl` presente. Output esperado: componente exportable sin errores TS.

6. **Verificar `src/components/ui/BarraCumplimiento.tsx`** — Leer archivo, confirmar que soporta props `{ pct: number; altura?: 8 | 6 | 5; multiSeg?: boolean }` y lógica semáforo del spec (verde >=80, ámbar 50-79, rojo <50). Si no, actualizar para hacerlo compatible. Output esperado: interfaz confirmada o actualizada.

7. **Verificar `src/components/ui/SelectorFechaUniversal.tsx`** — Leer archivo, confirmar que soporta las 7 opciones exactas del spec y persistencia `sessionStorage` key `selector_fecha_${nombreModulo}`. Si faltan opciones, añadirlas. Output esperado: interfaz confirmada o actualizada.

### A3 — Panel Global: página wrapper
8. **`src/pages/PanelGlobal.tsx`** — CREAR. Estructura:
   - Fondo página: `#f5f3ef`, padding `24px 28px`.
   - Header (A.1 spec): flex space-between, título "PANEL GLOBAL" Oswald 22/600/`#B01D23`/ls3/uppercase, subtítulo dinámico Lexend 13 `#7a8090`, 3 dropdowns derecha (SelectorFechaUniversal + "Todas las marcas" multiselect + "Canales" multiselect).
   - Dropdown marcas: lee `supabase.from('marcas').select('id,nombre').eq('estado','activa')`. Default "Todas las marcas". Multi-select con checkboxes.
   - TabsPastilla con 5 tabs: Resumen / Operaciones / Finanzas / Cashflow / Marcas.
   - Tab Resumen: renderiza `<TabResumen rowsPeriodo={...} />` con los datos del periodo seleccionado.
   - Tabs Operaciones/Finanzas/Cashflow/Marcas: placeholder `<div style={{padding:40,textAlign:'center',color:'#7a8090',fontFamily:'Lexend'}}>Próximamente</div>`.
   - Estado: `periodoKey`, `marcasFiltro: string[]`, `canalesFiltro: string[]`, `activeTab`.
   Output esperado: página compilable que carga en `/panel`.

9. **`src/App.tsx`** — Añadir import de `PanelGlobal` y ruta `<Route path="panel" element={<ProtectedRoute><PanelGlobal /></ProtectedRoute>} />` dentro del Layout existente. Output esperado: ruta navegable sin 404.

10. **`src/components/Layout.tsx`** — Leer archivo. Si no existe enlace "Panel" en sidebar, añadirlo con el mismo patrón de los demás enlaces (icono, label, path `/panel`). Usar ícono Lucide `LayoutDashboard` o similar. Output esperado: sidebar muestra enlace Panel.

### A4 — Panel Global: tab Resumen — revisión de cards existentes
11. **`src/components/panel/resumen/CardVentas.tsx`** — Leer + verificar contra spec A Card 1.1. Verificar: sublabel "VENTAS" cardLabel, kpiBig para bruto, 3 barras objetivos con editable inline, cálculo neto estimado, comparativa ▼ rojo. Corregir si hay divergencias. Output esperado: card fiel al spec.

12. **`src/components/panel/resumen/CardPedidosTM.tsx`** — Verificar contra spec A Card 1.2. Layout 3 valores, 5 filas canal con BAR.trackXs y colores de canal. Corregir si hay divergencias. Output esperado: card fiel al spec.

13. **`src/components/panel/resumen/CardResultadoPeriodo.tsx`** — Verificar contra spec A Card 1.3. EBITDA color dinámico, bloque Detalle + Prime Cost con barra semáforo. Corregir si hay divergencias. Output esperado: card fiel al spec.

14. **`src/components/panel/resumen/ColFacturacionCanal.tsx`** — Verificar contra spec A Tercio 2.1. 5 cards canal en orden (Uber/Glovo/JE/Web+Directa grid), fórmulas neto por canal. Corregir si hay divergencias. Output esperado: columna fiel al spec.

15. **`src/components/panel/resumen/ColGruposGasto.tsx`** — Verificar contra spec A Tercio 2.2. 4 cards (PRODUCTO/EQUIPO/LOCAL/CONTROLABLES), editable inline presupuesto, barra semáforo. Corregir si hay divergencias. Output esperado: columna fiel al spec.

16. **`src/components/panel/resumen/ColDiasPico.tsx`** — Verificar contra spec A Tercio 2.3. SVG bar chart 7 barras, viewBox 480x230, posiciones X exactas, 3 líneas resumen. Corregir si hay divergencias. Output esperado: columna fiel al spec.

17. **`src/components/panel/resumen/CardSaldo.tsx`** — Verificar contra spec A Tercio 3.1. kpiMid, 6 líneas cobros/pagos/proyección 7d+30d, barra horizontal con 2 puntos. Corregir. Output esperado: card fiel.

18. **`src/components/panel/resumen/CardRatio.tsx`** — Verificar contra spec A Tercio 3.2. Oswald 38px color semáforo, objetivo editable inline (default 1.80), 4 líneas detalle, barra multi-segmento. Corregir. Output esperado: card fiel.

19. **`src/components/panel/resumen/CardPE.tsx`** — Verificar contra spec A Tercio 3.3. kpiSm + % semáforo, barra multi-segmento, 4 líneas (día verde, facturación/día, pedidos/día, real). Corregir. Output esperado: card fiel.

20. **`src/components/panel/resumen/CardProvisiones.tsx`** — Verificar contra spec A Tercio 4.1. kpiMid + 6 líneas pagos próximos. Corregir. Output esperado: card fiel.

21. **`src/components/panel/resumen/CardPendientesSubir.tsx`** — Verificar contra spec A Tercio 4.2. border-left rojo, badge count, lista 6 items con colores urgencia, botón CTA "Ir al Importador →" navega `/importador`. Corregir. Output esperado: card fiel.

22. **`src/components/panel/resumen/CardTopVentas.tsx`** — Verificar contra spec A Tercio 4.3. Toggle Productos/Modif., tabla 5 cols con badges canal coloreados. Corregir. Output esperado: card fiel.

23. **`src/components/panel/resumen/TabResumen.tsx`** — Verificar layout 4 filas: `grid-template-columns: repeat(3,1fr); gap:14px` en filas 1/2/3/4, margin-bottom 14px entre filas. Asegurarse de que renderiza las 12 cards/columnas en orden correcto. Output esperado: layout fiel al spec.

### A5 — Build check FASE A
24. **Build check** — `npx tsc --no-emit`. Si hay errores, corregirlos. Output esperado: 0 errores TypeScript.

25. **Commit FASE A** — `git add . && git commit -m "feat(mockups): FASE A - Panel Global tab Resumen + componentes compartidos" && git push origin master`. Output esperado: commit pushed sin errores.

---

## FASE B — Conciliación · Tab Movimientos

### B1 — Componente TabMovimientos
26. **`src/components/conciliacion/CardFiltro.tsx`** — CREAR. Props: `{ tipo: 'ingresos'|'gastos'|'pendientes'; count: number; importe: number; active: boolean; onClick: ()=>void }`. Estilos exactos del spec B.4: container `CARDS.filter`, active state con border+shadow específico por tipo, contenido con cardLabelSm color tipo, Oswald 26 importe, Lexend 11 descripción. Output esperado: 3 instancias del componente cubren Ingresos/Gastos/Pendientes.

27. **`src/components/conciliacion/TagFiltroActivo.tsx`** — CREAR. Props: `{ label: string; count: number; onRemove: ()=>void }`. Estilos exactos spec B.3: flex, "Filtro activo:" muted, tag pill `TAG` con texto + " x", "· N movimientos". Si ningún filtro activo, no renderizar (return null). Output esperado: componente compilable.

28. **`src/components/conciliacion/ModalDetalleMovimiento.tsx`** — CREAR. Modal con datos completos del movimiento (spec B.8): datos crudos, PDF embebido si Drive URL, botones Reasignar/Recategorizar/Marcar no requiere doc. Fondo modal `#484f66` (spec COLORS.modal). Output esperado: modal abre al click de fila.

29. **`src/components/conciliacion/TabMovimientos.tsx`** — CREAR. Recibe `{ movimientos: Movimiento[]; periodoLabel: string }`. Estructura interna:
   - Tag filtro activo (B.3)
   - 3 cards filtro (B.4): lógica radio (solo 1 activa), default Pendientes si count>0
   - Buscador (B.5): input fulltext + dropdown Categoría + dropdown Exportar
   - Tabla movimientos (B.6): 7 cols, header bg `#ebe8e2`, body rows con border-bottom, badges categoría coloreados por código, col Doc con iconos, col Estado pill rojo/verde, footer paginación
   - Click fila: abre `ModalDetalleMovimiento`
   Output esperado: componente completo compilable.

### B2 — Integración en página Conciliacion
30. **`src/pages/Conciliacion.tsx`** — Modificar:
   - Cambiar fondo exterior a `#f5f3ef`, padding `24px 28px`.
   - Header spec B.1: título "CONCILIACIÓN" + subtítulo + SelectorFechaUniversal + dropdown marcas (sin dropdown cuenta, sin dropdown titular).
   - Reemplazar sistema de tabs actual por `TabsPastilla` con tabs: Resumen / Movimientos.
   - Tab "Movimientos": renderizar `<TabMovimientos movimientos={...} />` con datos del hook `useConciliacion` o query directa.
   - Tab "Resumen": mantener `ResumenDashboard` existente si sigue siendo útil, o placeholder si no aplica al nuevo estilo.
   Output esperado: `/conciliacion` tab Movimientos funcional con spec.

### B3 — Build check FASE B
31. **Build check** — `npx tsc --no-emit`. Corregir errores. Output esperado: 0 errores TS.

32. **Commit FASE B** — `git add . && git commit -m "feat(mockups): FASE B - Conciliacion tab Movimientos" && git push origin master`. Output esperado: commit pushed.

---

## FASE C — Importador · Tab Subir

### C1 — Componente TabSubirV2
33. **`src/components/importador/TabSubirV2.tsx`** — CREAR (no eliminar TabSubir.tsx aún). Estructura completa spec C.3-C.7:
   - SubTabsInverso `prefijoLbl="TIPO"` con "Facturas" / "Extractos bancarios". Margin-bottom 14.
   - Dropzone C.4: border `2px dashed #d0c8bc`, bg `#fafaf7`, hover border `#FF4757` bg `#ffffff`, transición 200ms, icono "⬆" Oswald 32 `#d0c8bc`, texto Lexend 14/500 `#3a4050`. SIN línea formatos, SIN botón extra. Extensiones aceptadas silenciosamente.
   - Bloque progreso C.5: visible solo cuando `procesando=true`. Layout flex, pill pulsante rojo, barra 3 segmentos (verde/rojo/gris), contadores OK/sin NIF/duplicadas.
   - Tabla proceso C.6: `CARDS.big` padding 0 overflow hidden, 6 cols, estados por fila (En proceso OCR con barra mini / Asociada Drive verde / Revisión manual rojo / Duplicada ámbar). Última fila resumen cola bg `#fafaf7`. Footer con "Última tanda" + botón Cancelar.
   - Flujo C.7: al soltar archivos → validar extensiones → INSERT `imports_log` estado=procesando → mostrar bloque progreso → procesar paralelo max 3 → actualizar barra en tiempo real → toast 5s al terminar → vaciar tabla 5s.
   - Si subtab "Extractos bancarios": parser CSV/XLSX BBVA → INSERT en `movimientos_bancarios` → auto-NIF + auto-categorización + auto-asociación.
   Output esperado: componente completo compilable.

### C2 — Integración en página Importador
34. **`src/pages/Importador.tsx`** — Modificar:
   - Cambiar fondo exterior a `#f5f3ef`, padding `24px 28px`.
   - Header C.1: título "IMPORTADOR", subtítulo "Punto único de entrada de documentación al ERP", SIN dropdowns a la derecha.
   - Reemplazar sistema de tabs actual por `TabsPastilla` con 3 tabs: "Subir" / "Histórico" / "Pendientes sistema" (badge count de imports_log pendientes).
   - Eliminar tab "Resúmenes plataforma" del menú (no borrar archivo TabResumenes.tsx).
   - Tab "Subir": renderizar `<TabSubirV2 />`.
   - Tabs Histórico y Pendientes: mantener componentes existentes `TabHistorico` y `TabPendientes` pero envueltos en el nuevo layout light.
   Output esperado: `/importador` con nuevo estilo fiel al spec.

### C3 — Build check FASE C
35. **Build check** — `npx tsc --no-emit`. Corregir errores. Output esperado: 0 errores TS.

36. **Commit FASE C** — `git add . && git commit -m "feat(mockups): FASE C - Importador tab Subir" && git push origin master`. Output esperado: commit pushed.

---

## FASE D — Cierre

37. **`npm run build`** — Build de producción completo. Si hay errores de build distintos a TS (Vite/CSS/imports), corregirlos. Output esperado: build OK sin warnings críticos.

38. **`.claude/tracking/informe-mockups.md`** — CREAR. Registrar:
   - Build OK/KO con detalles.
   - Por cada FASE: archivos creados/modificados, validaciones pasadas, fallidas.
   - Decisiones autónomas tomadas (DECISION AUTONOMA: ....).
   - Tablas BD creadas (lista).
   Output esperado: archivo creado con informe completo.

39. **Commit y push final** — `git add . && git commit -m "feat(mockups): completo - Panel Global · Conciliacion Movimientos · Importador Subir" && git push origin master`. Output esperado: rama actualizada en remote.

---

## Notas para el implementer

- Leer siempre el archivo antes de tocarlo (regla absoluta CLAUDE.md).
- `fmtNum` acepta solo 1 argumento.
- `fmtEur(n)` para euros, `fmtPct(n)` para porcentajes.
- Campos calculados: NUNCA `<input disabled>` — siempre `<div style editable>`.
- NO cambiar tamaños/colores/paddings del spec. PROHIBIDO improvisar elementos no listados.
- Si encuentras ambigüedad no resoluble: documentar en `informe-mockups.md` sección "Ambigüedades encontradas" y continuar con decisión autónoma sensata.
- Stack: React + TypeScript + Vite (NO Next.js). Imports con alias `@/`.

## T1 · src/lib/normalizar.ts (NUEVO)
```ts
export function normalizarConcepto(c: string): string {
  return (c ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
}

export async function calcularDedupKey(
  titularId: string,
  fecha: string,
  importe: number,
  concepto: string
): Promise<string> {
  const data = new TextEncoder().encode(
    `${titularId}${fecha}${Math.round(importe * 100)}${normalizarConcepto(concepto)}`
  )
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
```

## T2 · src/lib/aplicarReglas.ts (NUEVO)
Motor de reglas multi-dimensión. Carga reglas activas, aplica la primera que matchea TODAS las condiciones no-NULL.

```ts
import { supabase } from '@/lib/supabase'

export interface ReglaConciliacion {
  id: string
  patron: string | null
  match_ordenante: string | null
  match_beneficiario: string | null
  match_titular_id: string | null
  match_importe_min: number | null
  match_importe_max: number | null
  set_proveedor: string | null
  categoria_codigo: string | null
  borrar: boolean
  prioridad: number
  activa: boolean
}

export interface MovParaRegla {
  titular_id: string | null
  concepto: string | null
  ordenante: string | null
  beneficiario: string | null
  importe: number
  proveedor?: string | null
  categoria?: string | null
}

let cacheReglas: ReglaConciliacion[] | null = null

export async function cargarReglas(): Promise<ReglaConciliacion[]> {
  if (cacheReglas) return cacheReglas
  const { data, error } = await supabase
    .from('reglas_conciliacion')
    .select('*')
    .eq('activa', true)
    .order('prioridad', { ascending: true })
  if (error) throw error
  cacheReglas = data ?? []
  return cacheReglas
}

export function invalidarCacheReglas() { cacheReglas = null }

function matcheaTexto(valor: string | null, patron: string | null): boolean {
  if (!patron) return true // condición no-evaluada = pasa
  if (!valor) return false
  return valor.toLowerCase().includes(patron.toLowerCase())
}

export function aplicarReglas(
  mov: MovParaRegla, 
  reglas: ReglaConciliacion[]
): { mov: MovParaRegla; borrar: boolean; reglaAplicada: string | null } {
  for (const r of reglas) {
    const ok = (
      matcheaTexto(mov.concepto, r.patron) &&
      matcheaTexto(mov.ordenante, r.match_ordenante) &&
      matcheaTexto(mov.beneficiario, r.match_beneficiario) &&
      (r.match_titular_id === null || mov.titular_id === r.match_titular_id) &&
      (r.match_importe_min === null || mov.importe >= r.match_importe_min) &&
      (r.match_importe_max === null || mov.importe <= r.match_importe_max)
    )
    if (!ok) continue
    
    if (r.borrar) {
      return { mov, borrar: true, reglaAplicada: r.patron ?? r.id }
    }
    
    return {
      mov: {
        ...mov,
        proveedor: r.set_proveedor ?? mov.proveedor,
        categoria: r.categoria_codigo ?? mov.categoria,
      },
      borrar: false,
      reglaAplicada: r.patron ?? r.id,
    }
  }
  return { mov, borrar: false, reglaAplicada: null }
}
```

## T3 · Parser BBVA en `src/components/conciliacion/ImportDropzone.tsx`
1. Detectar columnas adicionales (case-insensitive): "Ordenante", "Beneficiario".
2. Mapear a row: `{ ...existente, ordenante, beneficiario }`.

## T4 · `src/hooks/useConciliacion.ts` — `insertMovimientos`
**Refactor del flujo (orden):**

```ts
import { calcularDedupKey } from '@/lib/normalizar'
import { cargarReglas, aplicarReglas } from '@/lib/aplicarReglas'
import { loadAliases, matchProveedor } from '@/lib/matchProveedor'

async function insertMovimientos(rows, onProgress) {
  // 0. Cargar reglas y alias en paralelo
  const [reglas, aliases] = await Promise.all([cargarReglas(), loadAliases()])
  
  // 1. Aplicar matching de proveedor (alias) para los que vengan sin
  rows = rows.map(r => ({
    ...r,
    proveedor: r.proveedor && r.proveedor.trim() !== ''
      ? r.proveedor
      : matchProveedor(r.concepto ?? '', aliases),
  }))
  
  // 2. Aplicar motor de reglas multi-dimensión
  let omitidos = 0
  rows = rows
    .map(r => {
      const { mov, borrar } = aplicarReglas(r, reglas)
      if (borrar) { omitidos++; return null }
      return mov
    })
    .filter(Boolean)
  
  // 3. Calcular dedup_key para cada row
  rows = await Promise.all(rows.map(async r => ({
    ...r,
    dedup_key: await calcularDedupKey(r.titular_id, r.fecha, r.importe, r.concepto ?? ''),
  })))
  
  // 4. INSERT con upsert (ignore duplicates)
  const { data, error } = await supabase
    .from('conciliacion')
    .upsert(rows, { ignoreDuplicates: true, onConflict: 'titular_id,dedup_key' })
    .select()
  
  if (error) throw error
  
  return {
    insertados: data?.length ?? 0,
    duplicados: rows.length - (data?.length ?? 0),
    omitidos,
  }
}
```

## T5 · UI Feedback Import
En ImportDropzone, mostrar al terminar:
"✅ X importados, Y duplicados (ya existían), Z omitidos por reglas"

## T6 · Hook Running `src/hooks/useRunningSueldos.ts` (NUEVO)
```ts
export function useRunningSueldos(mes: string) {
  // mes formato 'YYYY-MM'
  // Devuelve: { ruben, emilio, desgloseEmilio: { plataformas, complementoSL } }
  
  const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'
  const RUBEN_ID = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'
  
  // Ingresos plataforma Emilio:
  // SUM(importe) WHERE titular_id = EMILIO AND importe > 0 AND fecha BETWEEN inicio_mes AND fin_mes
  
  // Complemento SL:
  // SUM(ABS(importe)) WHERE titular_id = RUBEN AND categoria = 'RRH-NOM-EMI' AND fecha BETWEEN inicio_mes AND fin_mes
  
  // Sueldo total Emilio = plataformas + complementoSL
}
```

## T7 · Integrar en `src/pages/finanzas/Running.tsx`
Mostrar tabla de sueldos con:
- Fila Emilio: "Plataformas: X€ + Complemento SL: Y€ = Total Z€"
- Fila Rubén: pendiente lógica (autosueldos por definir)

## T8 · QA Validations
1. `npm run build` 0 errores.
2. Re-importar el Excel Emilio actual: "0 importados, 61 duplicados, 0 omitidos".
3. Crear Excel sintético con: 1 traspaso Emilio + 1 transferencia Rubén beneficiario "Timoteo Hnz" 867€ + 1 transferencia Rubén beneficiario "Emilio Dorca" 500€.
   - Resultado esperado: "2 importados, 0 duplicados, 1 omitido".
   - El de Timoteo aparece con ALQ-LOC.
   - El de Emilio aparece con RRH-NOM-EMI.
4. Running > Emilio abr 2026: plataformas ~1.710€ + complemento SL 500€ = ~2.210€.

## T9 · Cierre
git add . && git commit -m "feat(conciliacion): bloque B - reglas multi-dim + dedup robusto + sueldos Running" && git push origin master && git pull origin master
NO Vercel (regla 3).
