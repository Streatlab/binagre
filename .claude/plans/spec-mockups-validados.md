# SPEC LITERAL — Mockups validados Panel General · Conciliación Movimientos · Importador Subir

> Este spec contiene los 3 módulos validados visualmente por Rubén con mockups HTML.  
> Valores LITERALES en píxeles, hex, paddings, fórmulas. PROHIBIDO interpretar.  
> NO improvisar. NO cambiar tamaños. NO cambiar colores. NO cambiar orden.  
> Si un valor no está aquí, NO se implementa hasta consultar.

---

## Modelos a usar

- General: `claude-sonnet-4-7` (Sonnet)
- Subagentes: Sonnet por defecto
- Tareas triviales (renombrados, mover archivos, ediciones 1-3 líneas): Haiku permitido (`claude-haiku-4-5-20251001`)
- PROHIBIDO Opus

---

## Reglas duras

1. Aislamiento Binagre vs David ERP. NO mezclar.
2. Modo localhost. NO Vercel hasta orden expresa Rubén.
3. Backup BD antes de cualquier migración (snapshot Supabase).
4. NO preguntar lo deducible del repo/BD/contexto.
5. Guía estilo Notion 350c8b1f-6139-8191-952a-f299926ac42f como única fuente de verdad.
6. Decisiones autónomas según RULES.md §5.
7. Commit intermedio tras cada fase: `git add . && git commit -m "feat(mockups): FASE X" && git push origin master`.

---

# TOKENS LITERALES (sustituyen `/src/styles/tokens.ts`)

```ts
// COLORES
export const COLORS = {
  // Backgrounds
  bg: '#f5f3ef',           // Fondo página
  group: '#ebe8e2',        // Fondo grupo / table header
  card: '#ffffff',         // Fondo card
  brd: '#d0c8bc',          // Borde estándar 0.5px
  
  // Texto
  pri: '#111111',          // Texto principal
  sec: '#3a4050',          // Texto secundario
  mut: '#7a8090',          // Texto muted (sublabels, fechas)
  
  // Marca
  redSL: '#B01D23',        // Títulos página
  sidebar: '#1e2233',      // Sidebar
  modal: '#484f66',        // Modal
  glovo: '#e8f442',        // Solo color Glovo, NO acento
  
  // Acción
  accent: '#FF4757',       // Tab activa, énfasis
  
  // Semáforo
  ok: '#1D9E75',           // Verde ≥80%
  warn: '#f5a623',         // Ámbar 50-79%
  err: '#E24B4A',          // Rojo <50%
  
  // Canales
  uber: '#06C167',
  uberDark: '#0F6E56',
  glovo: '#e8f442',
  glovoDark: '#5a5500',
  glovoText: '#3a3a00',
  je: '#f5a623',
  jeDark: '#854F0B',
  web: '#B01D23',
  webDark: '#791F1F',
  directa: '#66aaff',
  directaDark: '#185FA5',
  
  // Días semana (gráfico Días pico)
  lun: '#1E5BCC',
  mar: '#06C167',
  mie: '#f5a623',
  jue: '#B01D23',
  vie: '#66aaff',
  sab: '#F26B1F',
  dom: '#1D9E75',
  
  // Plan contable (badges categoría)
  catPrd: '#7B4F2A',       // Producto · COGS
  catEqp: '#4A5980',       // Equipo · Labor
  catLoc: '#5A8A6F',       // Local · Occupancy
  catCtr: '#A87C3D',       // Controlables · OPEX
  catPlt: '#06C167',       // Plataformas
  catIng: '#1D9E75',       // Ingresos
  catInt: '#7a8090',       // Interno
  
  // Titulares
  ruben: '#F26B1F',
  emilio: '#1E5BCC',
};

// TIPOGRAFÍAS
export const FONT = {
  body: 'Lexend, sans-serif',
  heading: 'Oswald, sans-serif',
};

// TAMAÑOS TIPO
export const SIZES = {
  // Títulos página
  pageTitle: { font: 'Oswald', size: 22, weight: 600, letterSpacing: 3, transform: 'uppercase' },
  pageSubtitle: { font: 'Lexend', size: 13, color: 'mut' },
  
  // Sublabels card
  cardLabel: { font: 'Oswald', size: 12, weight: 500, letterSpacing: 2, transform: 'uppercase', color: 'mut' },
  cardLabelSm: { font: 'Oswald', size: 11, weight: 500, letterSpacing: 1.5, transform: 'uppercase', color: 'mut' },
  cardLabelXs: { font: 'Oswald', size: 10, weight: 500, letterSpacing: 1.5, transform: 'uppercase', color: 'mut' },
  
  // KPI
  kpiBig: { font: 'Oswald', size: 38, weight: 600 },
  kpiMid: { font: 'Oswald', size: 26, weight: 600 },
  kpiSm: { font: 'Oswald', size: 22, weight: 600 },
  kpiXs: { font: 'Oswald', size: 18, weight: 600 },
  
  // Body
  body: { font: 'Lexend', size: 14, weight: 400 },
  bodySm: { font: 'Lexend', size: 13, weight: 400 },
  bodyXs: { font: 'Lexend', size: 12, weight: 400 },
  bodyTiny: { font: 'Lexend', size: 11, weight: 400 },
  
  // Tabla
  tableHeader: { font: 'Oswald', size: 11, weight: 500, letterSpacing: 1.5, transform: 'uppercase', color: 'mut' },
  tableCell: { font: 'Lexend', size: 13, weight: 400 },
  
  // Badges
  badge: { font: 'Oswald', size: 9, weight: 500, letterSpacing: 0.5, padding: '1px 6px', borderRadius: 3 },
  pill: { font: 'Lexend', size: 10, weight: 500, padding: '2px 8px', borderRadius: 9 },
};

// CARDS
export const CARDS = {
  big: {
    background: '#ffffff',
    border: '0.5px solid #d0c8bc',
    borderRadius: 16,
    padding: '24px 28px',
  },
  std: {
    background: '#ffffff',
    border: '0.5px solid #d0c8bc',
    borderRadius: 14,
    padding: 18,
  },
  filter: {
    background: '#ffffff',
    border: '0.5px solid #d0c8bc',
    borderRadius: 12,
    padding: '14px 16px',
    cursor: 'pointer',
    transition: 'all 150ms',
    flex: 1,
  },
  filterActive: {
    border: '1.5px solid #FF4757',
    boxShadow: '0 0 0 3px #FF475715',
  },
};

// TABS PASTILLA (estilo Conciliación oro)
export const TABS_PILL = {
  container: {
    background: '#ffffff',
    border: '0.5px solid #d0c8bc',
    borderRadius: 14,
    padding: '14px 18px',
    marginBottom: 18,
    display: 'inline-flex',
    gap: 8,
  },
  active: {
    padding: '6px 14px',
    borderRadius: 6,
    border: 'none',
    background: '#FF4757',
    color: '#ffffff',
    fontFamily: 'Lexend',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 150ms',
  },
  inactive: {
    padding: '6px 14px',
    borderRadius: 6,
    border: '0.5px solid #d0c8bc',
    background: 'transparent',
    color: '#3a4050',
    fontFamily: 'Lexend',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
};

// SUBTABS (estilo invertido oscuro)
export const SUBTABS = {
  active: {
    padding: '5px 12px',
    borderRadius: 5,
    border: 'none',
    background: '#3a4050',
    color: '#ffffff',
    fontFamily: 'Lexend',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  inactive: {
    padding: '5px 12px',
    borderRadius: 5,
    border: '0.5px solid #d0c8bc',
    background: '#ffffff',
    color: '#7a8090',
    fontFamily: 'Lexend',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
};

// DROPDOWN BOTÓN
export const DROPDOWN_BTN = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '0.5px solid #d0c8bc',
  background: '#ffffff',
  fontSize: 13,
  fontFamily: 'Lexend',
  color: '#111111',
  cursor: 'pointer',
};

// BARRAS CUMPLIMIENTO (estándar todo el ERP)
export const BAR = {
  track: {
    height: 8,
    borderRadius: 4,
    background: '#ebe8e2',
    overflow: 'hidden',
    display: 'flex',
  },
  trackSm: {
    height: 6,
    borderRadius: 3,
    background: '#ebe8e2',
    overflow: 'hidden',
    display: 'flex',
  },
  trackXs: {
    height: 5,
    borderRadius: 3,
    background: '#ebe8e2',
    overflow: 'hidden',
    display: 'flex',
  },
  // Multi-segmento (cumplido + pendiente):
  // <track><fill verde width=pct%><fill rojo width=(100-pct)%>
  // Si pct >= 80 → fill verde #1D9E75
  // Si pct 50-79 → fill ámbar #f5a623
  // Si pct < 50 → fill rojo #E24B4A
};

// LAYOUT
export const LAYOUT = {
  pagePadding: '24px 28px',
  maxWidth: 1400,
  gridGap: 14,
  gridGapSm: 12,
  gridGapXs: 10,
  sectionMargin: 18,
};

// GRADIENTE EDITABLE INLINE
export const EDITABLE = {
  borderBottom: '1px dashed #d0c8bc',
  cursor: 'text',
  color: '#3a4050',
  padding: '0 2px',
};

// TAG FILTRO ACTIVO
export const TAG = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: 10,
  background: '#FF475715',
  color: '#FF4757',
  fontSize: 11,
  fontWeight: 500,
};
```

---

# COMPONENTES COMPARTIDOS OBLIGATORIOS

Crear en `/src/components/ui/`:

## 1. SelectorFechaUniversal

Opciones EXACTAS en orden:
1. "Semana actual"
2. "Últimos 7 días"
3. "Mes en curso"
4. "Un mes hasta ahora"
5. "Últimos 60 días"
6. "Personalizado"
7. "Semanas X" (despliega 2º dropdown a la DERECHA con Semana N..1)

Estilo botón = `DROPDOWN_BTN`.

Persistencia: `sessionStorage` key `selector_fecha_${nombreModulo}`. Persiste entre tabs del mismo módulo.

Dropdown menu styles:
```ts
{
  position: 'absolute',
  top: 38,
  right: 0,
  background: '#ffffff',
  border: '0.5px solid #d0c8bc',
  borderRadius: 8,
  width: 200,
  fontSize: 13,
  color: '#3a4050',
  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
  zIndex: 10,
  overflow: 'hidden',
}
```

Item dropdown:
- Padding: `8px 12px`
- Color default: `#7a8090`
- Activo: `background: '#FF475715'; color: '#FF4757'; fontWeight: 500`

## 2. BarraCumplimiento

```tsx
interface Props {
  pct: number;              // 0-100+
  altura?: 8 | 6 | 5;       // default 8
  multiSeg?: boolean;       // si true, divide cumplido + pendiente
}
```

Lógica:
- Si `multiSeg`: 2 sub-barras = verde `pct%` + rojo `(100-pct)%`
- Si simple: 1 fill con color semáforo según pct
- pct ≥ 80: verde `#1D9E75`
- pct 50-79: ámbar `#f5a623`
- pct < 50: rojo `#E24B4A`

## 3. TabsPastilla (estilo Conciliación)

```tsx
interface Props {
  tabs: Array<{ id: string; label: string; badge?: number }>;
  activeId: string;
  onChange: (id: string) => void;
}
```

Container = `TABS_PILL.container`. Active = `TABS_PILL.active`. Inactive = `TABS_PILL.inactive`.

PROHIBIDO usar otros estilos para tabs. PROHIBIDO guión amarillo subrayando.

## 4. SubTabsInverso

```tsx
interface Props {
  tabs: Array<{ id: string; label: string }>;
  activeId: string;
  onChange: (id: string) => void;
  prefijoLbl?: string;     // ej. "TIPO"
}
```

Container: `display:flex; gap:6px; align-items:center` con label opcional `lblXs` izquierda.

Active = `SUBTABS.active`. Inactive = `SUBTABS.inactive`.

## 5. SidebarBadge

```tsx
interface Props { count: number; }
```

```ts
{
  display: count > 0 ? 'inline-flex' : 'none',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 18,
  height: 18,
  padding: '0 6px',
  borderRadius: 9,
  background: '#E24B4A',
  color: '#ffffff',
  fontSize: 11,
  fontWeight: 600,
  fontFamily: 'Lexend',
  marginLeft: 8,
}
```

---

# FASE A · PANEL GLOBAL · TAB RESUMEN (validado por Rubén)

## A.1 Header

Layout: flex justify-content space-between, align-items baseline, margin-bottom 18px, flex-wrap wrap, gap 12px.

**Izquierda:**
1. Título "PANEL GLOBAL" — Oswald 22px / 600 / #B01D23 / letter-spacing 3px / uppercase
2. Subtítulo dinámico — Lexend 13px #7a8090, margin-top 2px
   - Texto formato: "Mes en curso · 1 abr — 28 abr 2026"

**Derecha (3 dropdowns):**
1. SelectorFechaUniversal (componente)
2. Dropdown "Todas las marcas ▾" — `DROPDOWN_BTN`
3. Dropdown "Canales ▾" — `DROPDOWN_BTN`

Dropdown marcas:
- Lee tabla `marcas WHERE estado='activa'`
- Default "Todas las marcas"
- Multi-select (checkboxes)
- Si elige marca X y X no está en canal Y, ese canal no se muestra en cards plataforma del periodo

Dropdown canales:
- Default "Canales" (todos)
- Multi-select

## A.2 Tabs pastilla

Componente `TabsPastilla` con:
1. "Resumen" (default activo)
2. "Operaciones"
3. "Finanzas"
4. "Cashflow"
5. "Marcas"

Margin-bottom 18px.

## A.3 ESTRUCTURA DEL TAB RESUMEN (4 filas)

### FILA 1 — 3 cards grandes (`grid-template-columns: repeat(3, 1fr); gap: 14px`)

#### Card 1.1 — VENTAS

Container: `CARDS.big`.

Contenido:
1. Sublabel "VENTAS" — `cardLabel`
2. Layout horizontal de 2 valores con `gap: 18; align-items: baseline; flex-wrap: wrap`:
   - Bruto:
     - Valor: `kpiBig` "8.916,17 €"
     - Sublabel: `cardLabelXs` "BRUTO"
   - Neto estimado:
     - Valor: Oswald 24px / 600 / `#1D9E75` "5.549,31 €"
     - Sublabel: Oswald 10px / 500 / `#1D9E75` / letter-spacing 1.5 / uppercase "NETO ESTIMADO · 62%"
3. Comparativa: Lexend 12px `#E24B4A` "▼ 13.5% vs anterior" (margin: 10px 0 16px)
4. **3 barras de objetivos** (estilo idéntico):
   - Header línea: Oswald 11px / 500 / `mut` / uppercase / display flex justify-between margin-bottom 4
     - Izquierda: "SEMANAL — S18"
     - Derecha: % cumplimiento color semáforo
   - Línea descripción: Lexend 12px `mut` display flex gap 8 margin-bottom 6
     - "Faltan" + valor color semáforo + "de" + valor objetivo (clase `editable`)
   - Barra: `BAR.track` con multi-segmento (verde % cumplido + rojo % faltante)
   - Margin-bottom entre barras: 14px

   Datos:
   - SEMANAL: lee `objetivos.semanal` para semana actual. Editable inline.
   - MENSUAL: lee `objetivos.mensual` mes actual. Editable inline.
   - ANUAL: lee `objetivos.anual` año actual. Editable inline.

   Comportamiento editable:
   - Hover sobre cifra objetivo → cambia color a `#FF4757` + cursor pointer
   - Click → `<input type="number">` con valor actual
   - Enter o blur → guarda BD + toast verde "Objetivo actualizado"
   - Input vacío + Enter → restaura original BD + toast ámbar "Objetivo restaurado"
   - ESC → cancela edición

   Cálculo neto estimado periodo:
   ```
   neto_estimado = bruto * margen_ponderado_canales
   margen_ponderado = Σ(margen_canal_i * peso_canal_i) donde peso = bruto_canal / bruto_total
   ```

#### Card 1.2 — PEDIDOS · TM

Container: `CARDS.big`.

Contenido:
1. Sublabel "PEDIDOS · TM" — `cardLabel`
2. Layout horizontal 3 valores con `gap: 24; align-items: baseline; flex-wrap: wrap`:
   - Pedidos:
     - Valor: `kpiBig` "374"
     - Sublabel: `cardLabelXs` "PEDIDOS"
   - TM Bruto:
     - Valor: Oswald 26px / 600 "23,84 €"
     - Sublabel: `cardLabelXs` "TM BRUTO"
   - TM Neto:
     - Valor: Oswald 26px / 600 / `#1D9E75` "14,84 €"
     - Sublabel: Oswald 10px / 500 / `#1D9E75` "TM NETO"
3. Comparativa: Lexend 12px `#E24B4A` "▼ 5.8% pedidos · ▼ 8.2% TM vs anterior" (margin: 8px 0 16px)
4. **5 filas desglose canal** (`flex-direction: column; gap: 8px`):
   - Cada fila:
     - Línea cabecera: display flex justify-between Lexend 12px margin-bottom 3
       - Izq: "● {Canal}"
       - Der: `{pedidos}` (peso 500) · TM bruto / TM neto verde €
     - Mini-barra: `BAR.trackXs` con fill color del canal width = `(pedidos_canal / total_pedidos) * 100`%

   Canales fijos en orden: Uber Eats / Glovo / Just Eat / Web / Directa.
   Si canal sin datos: pedidos = 0, TM = "—", barra width 0, color text `#7a8090`.

   Cálculo TM bruto canal = `bruto_canal / pedidos_canal`
   Cálculo TM neto canal = `neto_canal / pedidos_canal`

#### Card 1.3 — RESULTADO PERIODO

Container: `CARDS.big`.

Contenido:
1. Sublabel "RESULTADO PERIODO" — `cardLabel`
2. Layout horizontal 2 valores con `gap: 18; align-items: baseline; flex-wrap: wrap`:
   - EBITDA €:
     - Valor: Oswald 38px / 600 / color verde si >0 (`#1D9E75`) o rojo si <0 (`#E24B4A`) "582 €" o "-223 €"
     - Sublabel: `cardLabelXs` "EBITDA"
   - EBITDA %:
     - Valor: Oswald 24px / 600 / mismo color "10,5%"
     - Sublabel: Oswald 10px / 500 / mismo color "% S/NETOS · BANDA 10-13%"
3. Comparativa: Lexend 12px color signo "▲ 1,2 pp vs anterior" (margin: 10px 0 16px)

4. **Bloque inferior 1 — Detalle resultado** (border-top 0.5px solid `#d0c8bc` padding-top 12px):
   - 4 líneas display flex justify-between, font-size 12px, margin-bottom 4:
     - "Netos estimados" muted | valor
     - "Netos reales factura" muted | valor
     - "Total gastos periodo" muted | valor
     - "Resultado limpio" muted | valor verde si >0

5. **Bloque inferior 2 — Prime Cost** (border-top 0.5px solid `#d0c8bc` padding-top 12px margin-top 12):
   - Línea cabecera: `cardLabelSm` flex justify-between margin-bottom 6
     - Izq: "PRIME COST"
     - Der: % color semáforo banda 55-65%
   - Barra: `BAR.track` simple con fill color semáforo
   - Línea inferior: Lexend 11px display flex justify-between
     - Izq: "Banda sector 55-65%" muted
     - Der: "OK" / "Alto" / "Crítico" según banda

   Cálculo Prime Cost = `(producto + equipo) / netos`. Banda OK 55-65%. Por encima de 65% = "Alto" rojo.

### FILA 2 — 3 tercios (`grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 14px`)

#### Tercio 2.1 — FACTURACIÓN POR CANAL

Estructura:
- Sublabel arriba `cardLabel` "FACTURACIÓN POR CANAL" margin-bottom 10
- Container: `display: flex; flex-direction: column; gap: 10px`

5 cards canal en este orden:
1. **UBER EATS** (card pill)
2. **GLOVO** (card pill)
3. **JUST EAT** (card pill)
4. **WEB + DIRECTA** (grid 1fr 1fr): card WEB | card DIRECTA

Card pill grande (Uber/Glovo/JE):
```ts
{
  background: `${colorCanal}20`,        // 20 = 12% opacidad
  border: `0.5px solid ${colorCanal}`,
  borderRadius: 14,
  padding: '12px 14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
}
```

Contenido pill grande:
- Izq:
  - `cardLabelXs` con `color: ${colorCanalDark}` "UBER EATS"
  - Valor: Oswald 18px / 600 / `${colorCanalDark}` margin-top 2 "5.892,13 €"
  - Lexend 10px `${colorCanalDark}` "bruto"
- Der (text-align: right):
  - Valor: Oswald 15px / 600 / `#1D9E75` "3.488,37 €"
  - Lexend 10px `#1D9E75` "neto · 59% margen"

Card pill pequeña (Web/Directa):
```ts
{
  background: `${colorCanal}10`,        // 10 = 6% opacidad
  border: `0.5px solid ${colorCanal}50`, // 50 = 31% opacidad
  borderRadius: 14,
  padding: '10px 12px',
}
```

Contenido pill pequeña:
- `cardLabelXs` con `color: ${colorCanalDark}` "WEB"
- Valor: Oswald 15px / 600 / `${colorCanalDark}` margin-top 2 "— €" o valor
- Lexend 10px `#7a8090` "sin datos" o "bruto"

Cálculo neto canal:
```
Uber:    neto = bruto - comision_pct*bruto - fees - cargos_promo - 0.21*(comision+fees+cargos)
Glovo:   neto = bruto - 0.25*bruto - 0.75*pedidos - 0.21*(0.25*bruto + 0.75*pedidos)
JustEat: neto = bruto - 0.20*bruto - 0.75*pedidos - 0.21*(0.20*bruto + 0.75*pedidos)
Web:     neto = bruto - 0.07*bruto - 0.50*pedidos - 0.21*(0.07*bruto + 0.50*pedidos)
Directa: neto = bruto
```

ADS NO se restan al neto. ADS van solo a Running informativo.

% margen = `(neto / bruto) * 100`

#### Tercio 2.2 — GRUPOS DE GASTO · CONSUMO vs PRESUPUESTO

Estructura:
- Sublabel arriba `cardLabel` "GRUPOS DE GASTO · CONSUMO vs PRESUPUESTO" margin-bottom 10
- Container: `display: flex; flex-direction: column; gap: 10px`

4 cards en orden:
1. PRODUCTO · COGS — banda 25-30%
2. EQUIPO · LABOR — banda 30-35%
3. LOCAL · OCCUPANCY — banda 5-10%
4. CONTROLABLES · OPEX — banda 13-18%

Cada card:
```ts
{
  background: '#ffffff',
  border: '0.5px solid #d0c8bc',
  borderRadius: 14,
  padding: '12px 14px',
}
```

Contenido card:
1. Línea cabecera: display flex justify-between align-items baseline
   - Izq: `cardLabelSm` "PRODUCTO · COGS"
   - Der: Lexend 11px muted
     - Si PRODUCTO: "food cost {pct}%" — color semáforo banda
     - Resto: "% s/netos {pct}%" — color semáforo banda
2. Línea valor: display flex justify-between align-items baseline margin-top 4
   - Izq: Oswald 18px / 600 "2.467 €" + Lexend 12px muted " / " + valor presupuesto editable inline
   - Der: Lexend 12px / 500 color semáforo "{pct}%" (consumo / presupuesto)
3. Barra: `BAR.trackSm` (height 6px) con multi-segmento margin 6 0 4
4. Línea inferior: Lexend 10px display flex justify-between
   - Izq: muted "Banda 25-30%"
   - Der: color signo "{signo}{importe} desv"

Cálculo presupuesto auto:
- PRODUCTO target = `netos * 0.275` (mid banda 25-30%)
- EQUIPO target = `netos * 0.325` (mid banda 30-35%)
- LOCAL target = `netos * 0.075` (mid banda 5-10%)
- CONTROLABLES target = `netos * 0.155` (mid banda 13-18%)

Editable inline igual que objetivos card Ventas.

Food cost = `producto / netos * 100`. Banda OK 25-30%.

#### Tercio 2.3 — DÍAS PICO

Estructura:
- Sublabel arriba `cardLabel` "DÍAS PICO — {periodo_label}" margin-bottom 10
- Card: `CARDS.big` padding 18

Contenido:
1. SVG bar chart 7 barras (Lun-Dom), viewBox 480x230:
   - Cada barra: width 40, color del día (`COLORS.lun`...`COLORS.dom`)
   - Posiciones X: 15, 80, 145, 210, 275, 340, 405
   - Altura calculada: `(valor / max_valor) * 125`
   - Y inicial: `190 - altura`
   - Texto valor encima: text Lexend 11 fill `#7a8090` text-anchor middle, Y=20. El día más alto en `#3a4050` weight 500.
   - Etiqueta día abajo: text Lexend 12 fill `#7a8090` text-anchor middle, Y=210
2. Border-top 0.5px solid #d0c8bc margin-top 14 padding-top 12:
   - `cardLabelSm` "RESUMEN" margin-bottom 8
   - 3 líneas display flex justify-between Lexend 12 margin-bottom 3:
     - "Día más fuerte" muted | día + valor (weight 500)
     - "Día más débil" muted | día + valor
     - "Media diaria" muted | valor

Datos: lee `facturacion_diaria` agrupada por DOW del periodo seleccionado. EXCLUIR días `calendario_operativo.tipo='cerrado'`.

### FILA 3 — 3 tercios (`grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 14px`)

#### Tercio 3.1 — SALDO + PROYECCIÓN

Card: `CARDS.std` padding 18.

Contenido:
1. `cardLabelSm` "SALDO + PROYECCIÓN"
2. Valor: `kpiMid` "12.450 €" margin-top 6
3. Lexend 11px muted "caja líquida hoy"
4. Border-top 0.5px solid #d0c8bc margin-top 14 padding-top 10:
   - 6 líneas Lexend 12 display flex justify-between:
     - "Cobros 7d" muted | "+1.665 €" verde
     - "Pagos 7d" muted | "-446 €" rojo
     - "Proyección 7d" weight 500 | valor weight 500 (margin-top 6)
     - "Cobros 30d" muted | valor verde (margin-top 8)
     - "Pagos 30d" muted | valor rojo
     - "Proyección 30d" weight 500 | valor weight 500 (margin-top 6)
5. Barra horizontal proyección: margin-top 12, height 6, border-radius 3, background `#1D9E75`, position relative
   - Punto inicial: position absolute left 0 top -2, 10x10 round, bg `#1D9E75` border 2px solid #fff
   - Punto final: position absolute right 0 top -2, 10x10 round, bg `#0F6E56` border 2px solid #fff
6. Etiquetas: display flex justify-between font-size 10 muted margin-top 4
   - "Hoy" | "30d"

Cálculos:
- Cobros 7d = Σ(cobros_pendientes_plataforma con fecha_pago ≤ hoy+7d)
- Pagos 7d = Σ(facturas pendientes con vencimiento ≤ hoy+7d) + gastos fijos prorrateados 7d
- Cálculos cobros plataforma según `CICLOS_PAGO`:
  - Uber: paga lunes próximo lo de lunes-domingo anterior
  - Glovo 1-15: paga 5 mes siguiente
  - Glovo 16-fin: paga 20 mes siguiente
  - JustEat 1-15: paga 20 mismo mes
  - JustEat 16-fin: paga 5 mes siguiente
  - Directa: al día
  - Web: TBD

#### Tercio 3.2 — RATIO INGRESOS / GASTOS

Card: `CARDS.std` padding 18.

Contenido:
1. Línea cabecera: display flex justify-between align-items baseline
   - Izq: `cardLabelSm` "RATIO INGRESOS / GASTOS"
   - Der: Lexend 11 muted display flex align-items center gap 4 "obj " + valor editable inline "1,80"
2. Valor grande: Oswald 38px / 600 / color semáforo "1,68" margin-top 6
3. Comparativa: Lexend 12 color signo "▼ 7% del objetivo" margin-bottom 10
4. 4 líneas Lexend 12 display flex justify-between:
   - "Netos estimados" muted | "5.549 €" (margin-top 10)
   - "Netos reales (factura)" muted | "3.488 €"
   - "Gastos fijos" muted | "3.700 €" (margin-top 6)
   - "Gastos reales" muted | "2.080 €"
5. Border-top 0.5px solid #d0c8bc margin-top 14 padding-top 10:
   - Lexend 11 muted margin-bottom 6 "Distancia al objetivo"
   - Barra: `BAR.track` multi-segmento (color según ratio)
   - Lexend 11 muted text-align right margin-top 4 "{pct}% del 1,80 obj"

Cálculos:
- Ratio = `(netos_estimados + netos_reales) / (gastos_fijos + gastos_reales)`
- Realmente: si tienes factura usa real, si no estimado. Mostrar ambos para transparencia.
- Objetivo default 1,80 (configurable, editable inline).
- Color semáforo:
  - ≥ obj: verde
  - obj-0.2 a obj: ámbar
  - < obj-0.2: rojo

#### Tercio 3.3 — PUNTO DE EQUILIBRIO

Card: `CARDS.std` padding 18.

Contenido:
1. `cardLabelSm` "PUNTO DE EQUILIBRIO"
2. Layout: display flex align-items baseline justify-between margin-top 6
   - Izq:
     - Valor: `kpiSm` "15.500 €"
     - Lexend 11 muted "bruto necesario · 9.610 € netos"
   - Der: Oswald 18 / 600 / color semáforo "58%"
3. Barra: `BAR.track` multi-segmento margin 10 0 4 (color según pct)
4. Línea: Lexend 11 muted display flex justify-between
   - Izq: "Llevamos 8.916 €"
   - Der: "Faltan 6.583 €"
5. Border-top 0.5px solid #d0c8bc margin-top 14 padding-top 10:
   - 4 líneas Lexend 12 display flex justify-between:
     - "Día verde estimado" muted | día (weight 500) (margin-bottom 4)
     - "Facturación / día" muted | "{€} bruto" (weight 500)
     - "Pedidos / día" muted | "{N} a {tm} €" (weight 500)
     - "Real actual" muted | "{€}/día · {ped}/día" muted (margin-top 6)

Cálculos PE:
- Bruto necesario = `gastos_fijos_periodo / margen_neto_promedio`
- Pct = `(facturado_actual / bruto_necesario) * 100`
- Día verde estimado:
  ```
  faltante = bruto_necesario - facturado_actual
  velocidad_diaria = facturado_actual / dias_transcurridos
  dias_para_verde = ceil(faltante / velocidad_diaria)
  dia_verde = hoy + dias_para_verde
  ```
- Facturación/día necesaria = `faltante / dias_operativos_restantes`
- Pedidos/día = `facturacion_dia_necesaria / TM_actual`

### FILA 4 — 3 tercios (`grid-template-columns: repeat(3, 1fr); gap: 14px`)

#### Tercio 4.1 — PROVISIONES Y PRÓXIMOS PAGOS

Card: `CARDS.std` padding 18.

Contenido:
1. `cardLabelSm` "PROVISIONES Y PRÓXIMOS PAGOS"
2. Layout: display flex justify-between align-items baseline margin-top 8
   - Izq:
     - Valor: `kpiMid` "365 €"
     - Lexend 11 muted "a guardar este mes"
   - Der: Lexend 11 / 500 / `#1D9E75` "187 € + 178 €" (provisión IVA + IRPF)
3. Lista pagos: margin-top 14, Lexend 12 `#3a4050`, display flex flex-direction column gap 6:
   - 6 líneas display flex justify-between:
     - "IVA 1T (20 abr)" muted | "1.420 €"
     - "IRPF alquiler" muted | "178 €"
     - "SS autónomos (30 abr)" muted | "660 €"
     - "Nóminas (30 abr)" muted | "2.870 €"
     - "Alquiler (1 may)" muted | "900 €"
     - "Suministros (5 may)" muted | "340 €"

Datos:
- Lee `provisiones` (IVA, IRPF) calculados auto
- Lee `gastos_fijos` con `proxima_fecha_pago BETWEEN hoy AND hoy+30d`

#### Tercio 4.2 — PENDIENTES DE SUBIR

Card: `CARDS.std` padding 18 + `border-left: 3px solid #E24B4A`.

Contenido:
1. Línea cabecera: display flex justify-between align-items baseline
   - Izq: `cardLabelSm` "PENDIENTES DE SUBIR"
   - Der: badge rojo `pill style` count
2. Lista tareas: margin-top 14 display flex flex-direction column gap 8 font-size 13:
   - Cada línea: display flex justify-between align-items center
     - Izq: "● {nombre}" — color punto según urgencia:
       - Atrasada > 0d: `#E24B4A`
       - Pendiente hoy: `#f5a623`
       - Pendiente futura: `#7a8090`
     - Der: Lexend 11 muted "{relativo}"
       - "atrasado 3d" / "hoy" / "en 2d"
3. Botón CTA: margin-top 14 width 100% padding 8 background `#FF4757` color white border none border-radius 6 Lexend 12 / 500 cursor pointer
   - Texto "Ir al Importador →"
   - On click: navega a `/importador`

Datos: lee `tareas_pendientes WHERE estado IN ('pendiente','atrasada')` ORDER BY urgencia DESC LIMIT 6.

#### Tercio 4.3 — TOP VENTAS

Card: `CARDS.std` padding 18.

Contenido:
1. Línea cabecera: display flex justify-between align-items baseline margin-bottom 14
   - Izq: `cardLabelSm` "TOP VENTAS"
   - Der: 2 botones gap 6
     - Activo "Productos": padding 4px 10px, border-radius 5, background `#FF4757`, color white, Lexend 11 / 500
     - Inactivo "Modif.": mismo padding, border 0.5px solid #d0c8bc, background transparent, color #3a4050
2. Tabla width 100% font-size 13 border-collapse collapse:
   - 5 filas (top 5 productos del periodo)
   - Columnas:
     - # (color #7a8090, width 18, padding 6 0)
     - Nombre producto (padding 6 0)
     - Badge canal: text-align right, padding 6 0
     - Cantidad (color #3a4050, text-align right, padding 6 0)
     - Importe Oswald weight 500 text-align right padding 6 0

Badges canal:
- UE: bg `#06C167` color white, font Oswald 9, letter-spacing 0.5, padding 1 5, border-radius 3, weight 500
- GL: bg `#e8f442` color `#3a3a00` (texto oscuro)
- JE: bg `#f5a623` color white
- WEB: bg `#B01D23` color white
- DIR: bg `#66aaff` color white

Datos: lee `ventas_plataforma_marca_mensual` o `ventas_plataforma` agrupado por producto del periodo. ORDER BY importe DESC LIMIT 5.

---

# FASE B · CONCILIACIÓN · TAB MOVIMIENTOS (validado por Rubén)

## B.1 Header

Igual estructura que Panel A.1 pero con:
1. Título "CONCILIACIÓN"
2. Subtítulo dinámico
3. Derecha: SelectorFechaUniversal + Dropdown "Todas las marcas"

NO dropdown cuenta. NO dropdown titular bancario (auto-NIF).

## B.2 Tabs pastilla

Componente `TabsPastilla`:
1. "Resumen"
2. "Movimientos" (default activo)

## B.3 Tag filtro activo

Layout: display flex align-items center gap 10 flex-wrap wrap margin-bottom 14.

Contenido:
1. Lexend 13 muted "Filtro activo:"
2. Tag pill: estilo `TAG` con texto "Pendientes" + " ×" (cursor pointer, font-weight 600, margin-left 2)
3. Lexend 13 muted "· {N} movimientos"

Comportamiento:
- Si ningún filtro activo, NO mostrar bloque
- Click en × del tag: desactiva filtro
- Si default = "Pendientes" pero no hay pendientes, el tag default es "Todos" sin tag visible

## B.4 3 cards filtro

Layout: display flex gap 14 margin-bottom 14 flex-wrap wrap.

Cada card:
- Container `CARDS.filter`
- Si activa: aplicar `CARDS.filterActive` (border y box-shadow)

**Card 1 — INGRESOS** (`green`):
- Active state: border 1.5px solid `#1D9E75` + box-shadow 0 0 0 3px `#1D9E7515`
- Contenido:
  - Línea cabecera: flex justify-between align-items baseline
    - `cardLabelSm` color `#1D9E75` "INGRESOS"
    - Lexend 11 muted "{N} movs"
  - Valor: Oswald 26 / 600 / `#1D9E75` margin-top 4 "+8.916,17 €"
  - Lexend 11 muted margin-top 2 "Bruto del periodo · click para filtrar"

**Card 2 — GASTOS** (`red`):
- Active state: border 1.5px solid `#E24B4A` + box-shadow 0 0 0 3px `#E24B4A15`
- Contenido:
  - Línea cabecera: flex justify-between
    - `cardLabelSm` color `#E24B4A` "GASTOS"
    - muted "{N} movs"
  - Valor: Oswald 26 / 600 / `#E24B4A` "-3.297,42 €"
  - Lexend 11 muted "Total gasto · click para filtrar"

**Card 3 — PENDIENTES** (default activa, color `accent` `#FF4757`):
- Active state: border 1.5px solid `#FF4757` + box-shadow 0 0 0 3px `#FF475715`
- Contenido:
  - Línea cabecera: flex justify-between align-items baseline
    - `cardLabelSm` color `#FF4757` "PENDIENTES"
    - Lexend 11 muted display flex align-items center gap 6 + badge rojo `pill` con count + " revisar"
  - Valor: Oswald 26 / 600 / `#FF4757` "1.247,30 €"
  - Lexend 11 muted "Sin asociar / sin categoría · activo"

Comportamiento toggle:
- Default carga "Pendientes" activa si N>0
- Si N=0 pendientes, default activa "Ninguna" → muestra todo
- Click en card: toggle (activa/desactiva)
- Solo UNA card activa a la vez (radio behaviour)
- Si todas desactivadas → muestra todo sin filtro

## B.5 Buscador

Layout: display flex gap 10 margin-bottom 12 align-items center.

Componentes:
1. Input search box: flex 1, padding 8 12, border 0.5px solid #d0c8bc, border-radius 8, Lexend 13, bg white, color #3a4050
   - Placeholder "Buscar proveedor / nº factura / importe / concepto"
   - Búsqueda fulltext en columnas: proveedor, numero_factura, concepto, importe (string match)
2. Dropdown "Categoría ▾" — `DROPDOWN_BTN`
   - Lista categorías plan contable filtrables
3. Dropdown "Exportar ▾" — `DROPDOWN_BTN`
   - Opciones: CSV / Excel / PDF

## B.6 Tabla movimientos

Container: `CARDS.big` padding 0 overflow hidden.

Tabla: width 100% font-size 13 border-collapse collapse.

Header `<thead>`:
- bg `#ebe8e2`
- 7 columnas con `tableHeader`:
  1. "Fecha" (text-align left, padding 12 16)
  2. "Concepto" (left)
  3. "Contraparte" (left)
  4. "Importe" (right)
  5. "Categoría" (left)
  6. "Doc" (center)
  7. "Estado" (center)

Body `<tbody>`:
- Cada fila: border-bottom 0.5px solid #ebe8e2 (excepto última)
- Última fila SIN border-bottom

Columnas por fila:
1. Fecha: padding 12 16, color `#3a4050`, formato "26 abr"
2. Concepto: padding 12 16, color `#111` default
3. Contraparte: padding 12 16, color muted, formato "{nombre} · {NIF}" o "Sin identificar"
4. Importe: padding 12 16 text-align right
   - Verde `#1D9E75` weight 500 si ingreso
   - Rojo `#E24B4A` weight 500 si gasto
5. Categoría: padding 12 16
   - Si categorizado: badge según grupo (ver mapeo abajo)
   - Si sugerencia auto-aprendizaje: Lexend 11 italic muted "Sugerencia: {codigo}"
   - Si no: Lexend 11 italic muted "Sin categoría"
6. Doc: padding 12 16 text-align center
   - Asociada a Drive: 📄 verde `#1D9E75` cursor pointer (click → abre Drive URL en nueva pestaña)
   - Falta documento: 📎❌ rojo `#E24B4A`
   - No aplica (comisión banca, traspaso): — gris `#cfcfcf`
7. Estado: padding 12 16 text-align center
   - PENDIENTE: bg `#FF4757` color white, font Lexend 10, padding 2 8, border-radius 9, weight 500
   - CUADRADO: bg `#1D9E7515` color `#1D9E75`, font Lexend 10, padding 2 8, border-radius 9, weight 500

Mapeo badges categoría (`badge` style + colores `catXxx`):
- PRD-*: bg `#7B4F2A` color white
- EQP-*: bg `#4A5980` color white
- LOC-*: bg `#5A8A6F` color white
- CTR-*: bg `#A87C3D` color white
- PLT-*: bg `#06C167` color white
- ING-*: bg `#1D9E75` color white
- INT-*: bg `#7a8090` color white

Footer tabla:
- Padding 14 16 display flex justify-between align-items center
- Border-top 0.5px solid #d0c8bc
- Bg `#fafaf7`
- Izq: Lexend 12 muted "Mostrando {N} de {total} movimientos"
- Der: paginación display flex gap 6
  - Botón "‹ Anterior" `DROPDOWN_BTN`
  - Botón página activa `tab-on` (rojo)
  - Botones páginas inactivas `DROPDOWN_BTN`
  - Botón "Siguiente ›" `DROPDOWN_BTN`

## B.7 Auto-NIF, auto-categorización, auto-asociación

Al insertar/actualizar movimiento bancario:

1. **Auto-NIF**: regex `[A-Z]?\d{8}[A-Z]?` en concepto + ordenante:
   - Match `21669051S` → titular = Rubén
   - Match `53484832B` → titular = Emilio
   - No match → titular = NULL, marca para revisión

2. **Auto-categorización**: por reglas guardadas en `reglas_auto_categoria`:
   - Match NIF emisor → asigna categoría de la regla
   - Match palabra clave concepto → asigna categoría
   - Si match único → estado = "categorizada"
   - Si múltiples matches → estado = "pendiente revisión", muestra "Sugerencia: {top_match}"
   - Si sin match → "Sin categoría", estado pendiente

3. **Auto-asociación factura ↔ movimiento**:
   - Match exacto: importe == importe_factura AND fecha BETWEEN factura_fecha-5d AND factura_fecha+5d AND NIF_emisor == NIF_factura
   - Match único → estado = CUADRADO, asocia
   - Match dudoso (varios candidatos) → estado = "pendiente revisión"
   - Sin match → si requiere doc según reglas → "PENDIENTE", si no aplica → CUADRADO

4. **Reglas movs sin doc** (de momento aprendizaje, futuro tabla `reglas_sin_doc`):
   - Concepto contiene "COMISION" / "INTERES" / "TRASPASO" / IBAN propio → no requiere
   - Resto requiere

## B.8 Click sobre fila

Modal detalle con:
1. Datos completos del movimiento
2. Si hay factura asociada: PDF embebido + botón "Abrir en Drive"
3. Botón "Reasignar factura" → buscador facturas
4. Botón "Recategorizar" → dropdown categorías
5. Botón "Marcar como no requiere doc"

---

# FASE C · IMPORTADOR · TAB SUBIR (validado por Rubén)

## C.1 Header

Igual estructura que A.1/B.1:
1. Título "IMPORTADOR"
2. Subtítulo "Punto único de entrada de documentación al ERP"
3. Derecha: NADA (sin dropdowns)

## C.2 Tabs pastilla

Componente `TabsPastilla`:
1. "Subir" (default activo)
2. "Histórico"
3. "Pendientes sistema" — con badge `#E24B4A` count

## C.3 Subtabs Tipo

Componente `SubTabsInverso` con prefijoLbl "TIPO":
1. "Facturas" (default activo)
2. "Extractos bancarios"

NO meter más subtabs (resúmenes plataforma, etc.) hasta orden expresa.

Margin-bottom 14 después de subtabs.

## C.4 Dropzone

Estilo:
```ts
{
  border: '2px dashed #d0c8bc',
  borderRadius: 14,
  padding: '28px 20px',
  textAlign: 'center',
  background: '#fafaf7',
  transition: 'all 200ms',
  cursor: 'pointer',
  marginBottom: 14,
}
```

Hover: `borderColor: '#FF4757', background: '#ffffff'`.

Contenido:
1. Icono "⬆" Oswald 32 line-height 1 color `#d0c8bc`
2. Lexend 14 / 500 `#3a4050` margin-top 8 "Arrastra archivos o pulsa para seleccionar"

NO añadir línea de formatos. NO añadir botón "Seleccionar archivos" extra.

Acepta EXTENSIONES (validación silenciosa):
- `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.csv`, `.xlsx`, `.xls`, `.doc`, `.docx`

Si subtab "Facturas" activo: detección facturas.
Si subtab "Extractos bancarios" activo: detección extractos.

## C.5 Bloque progreso (visible cuando hay procesado en curso)

Layout: display flex align-items center gap 12 flex-wrap wrap margin-bottom 14.

Contenido (orden):
1. Lexend 13 muted "Procesando:"
2. Pill estilo `TAG` con punto pulsante `#FF4757`:
   - Span 6x6 round bg `#FF4757`
   - Texto Lexend 11 / 500 "{N} / {total} archivos"
3. Bloque barra: flex 1 min-width 240 max-width 480 display flex align-items center gap 10
   - Barra: `BAR.track` con 3 segmentos:
     - Verde width = `(ok / total) * 100%`
     - Rojo width = `(err / total) * 100%`
     - Ámbar/gris width = `((total - ok - err) / total) * 100%`
   - Contador: Oswald 13 / 600 `#3a4050` min-width 38 text-align right "{pct}%"
4. Lexend 12 / 500 `#1D9E75` "{ok} OK"
5. Lexend 12 `#E24B4A` "{err_count} sin NIF"
6. Lexend 12 muted "{dup} duplicadas"

## C.6 Tabla proceso

Container: `CARDS.big` padding 0 overflow hidden.

Tabla: width 100% font-size 13 border-collapse collapse.

Header (mismo estilo que B.6):
- bg `#ebe8e2`
- 6 columnas:
  1. "Archivo" (left)
  2. "Tipo detectado" (left)
  3. "Contraparte" (left)
  4. "Importe" (right)
  5. "Categoría" (left)
  6. "Estado" (center)

Body:
- Cada fila: border-bottom 0.5px solid #ebe8e2

Columnas por fila:
1. Archivo: padding 12 16 color `#3a4050` (nombre archivo)
2. Tipo detectado: padding 12 16 color muted ("Factura proveedor", "Extracto bancario", "Imagen", etc.)
3. Contraparte: padding 12 16 color muted ("Procar S.L. · B89234567" o "NIF no detectado" en `#E24B4A`)
4. Importe: padding 12 16 text-align right color `#3a4050` ("186,42 €" sin símbolo +/-)
5. Categoría: padding 12 16 (badge igual que B.6, o "Sin categoría" italic muted)
6. Estado: padding 12 16 text-align center

Estados procesando (col 6):
- **En proceso OCR**: bloque flex align-items center justify-content center gap 8
  - Barra mini width 60: `BAR.track` height 5 con multi-segmento (verde % completado + rojo restante)
  - Texto Oswald 11 / 500 `#3a4050` "{pct}%"
- **Asociada con Drive**: bg `#1D9E7515` color `#1D9E75` Lexend 10 padding 2 8 border-radius 9 weight 500 "✓ ASOCIADA · DRIVE"
- **Revisión manual**: bg `#E24B4A` color white Lexend 10 padding 2 8 border-radius 9 weight 500 "! REVISIÓN MANUAL"
- **Duplicada**: bg `#f5a623` color white Lexend 10 padding 2 8 border-radius 9 weight 500 "DUPLICADA"

Última fila resumen cola:
- bg `#fafaf7`
- color `#7a8090` font-style italic
- "+ {N} archivos en cola" (colspan o solo primera col, resto vacío)

Footer tabla:
- Padding 14 16 display flex justify-between align-items center
- Border-top 0.5px solid #d0c8bc
- Bg `#fafaf7`
- Izq: Lexend 12 muted "Última tanda · resumen disponible 5s"
- Der: botón "Cancelar proceso" — padding 5 12, border 0.5px solid #d0c8bc, bg white, border-radius 6, Lexend 12, color `#3a4050`, cursor pointer

## C.7 Flujo procesamiento

Al soltar archivos en dropzone:

1. Validar extensiones aceptadas. Rechazar resto silenciosamente.
2. Crear registros `imports_log` estado='procesando' por archivo.
3. Mostrar bloque progreso C.5 + tabla C.6 con todos los archivos en estado inicial.
4. Por cada archivo (paralelo, max 3 a la vez):
   - Subtab Facturas:
     - Si PDF/imagen → OCR
     - Detectar NIF emisor (regex `[A-Z]?\d{8}[A-Z]?`)
     - Si match → tipo "Factura proveedor"
     - Auto-categorización por reglas
     - Buscar movimiento candidato en `conciliacion` (importe + fecha ±5d + NIF)
     - Si match único → asociar + renombrar + subir a Drive ruta correcta + estado "ASOCIADA · DRIVE"
     - Si sin NIF → estado "REVISIÓN MANUAL"
   - Subtab Extractos:
     - Si CSV/XLSX → parser BBVA
     - Por cada fila → INSERT en `movimientos_bancarios`
     - Auto-NIF + auto-categorización
     - Auto-asociación con facturas existentes
     - Estado "ASOCIADA · DRIVE" (no aplica para extractos en sí)
5. Actualizar barra global progreso en tiempo real.
6. Al terminar todos:
   - Toast 5s: "✅ {ok}/{total} archivos procesados. {err} en revisión. {dup} duplicadas."
   - Refrescar tabla con estados finales.
   - Tabla queda visible 5s, luego se vacía.

## C.8 Renombrado y guardado en Drive

Estructura ruta:
```
00 SISTEMA STREAT LAB
└── 05 OPERACIONES
    └── EMILIO/RUBÉN (según titular detectado por NIF)
        └── 05 FACTURAS RECIBIDAS
            └── {año}
                └── Q{trimestre}
                    └── {mes_num}-{mes_nombre}
                        └── PLATAFORMAS o PROVEEDORES
                            └── {archivo_renombrado}
```

Renombrado archivo:
- Formato: `{fecha_factura_YYYYMMDD}-{proveedor_slug}-{importe}.pdf`
- Ejemplo: `20260422-mercadona-1352.71.pdf`

Carpeta destino:
- Si NIF emisor en lista plataformas (Uber/Glovo/JE/Rushour/Stripe/Redsys) → PLATAFORMAS
- Resto → PROVEEDORES

Detección titular (Emilio/Rubén):
- Por NIF receptor en factura
- Si Rubén `21669051S` → carpeta RUBEN
- Si Emilio `53484832B` → carpeta EMILIO
- Si no claro → titular default Rubén (configurable)

---

# FASE D · CIERRE

## D.1 Pipeline obligatorio por fase

1. pm-spec valida spec sin huecos
2. architect-review aprueba arquitectura
3. implementer ejecuta autónomo (Sonnet)
4. qa-reviewer valida CA
5. erp-reviewer valida aislamiento Binagre vs David

Si qa-reviewer detecta fallos: implementer-fix antes de avanzar.

## D.2 Commits

Tras cada fase:
```
git add . && git commit -m "feat(mockup): FASE X completada"
git push origin master
```

Cierre final:
```
git add . && git commit -m "feat(mockup): completo - 3 mockups implementados"
git push origin master
```

NO Vercel.

## D.3 Informe final obligatorio

`.claude/tracking/informe-mockups.md`:
1. Build OK/KO con detalles
2. Por cada FASE: validaciones pasadas, falladas, archivos creados/modificados
3. Capturas localhost de cada módulo en viewport 1280px
4. Capturas mobile 375px y 768px
5. Decisiones autónomas tomadas (deben estar en lista permitida)

## D.4 DECISIONES AUTÓNOMAS PERMITIDAS

El implementer puede tomar autónomamente:
1. Estructura interna de componentes respetando los estilos literales del spec
2. Iconos Lucide React siguiendo convención existente
3. Schema BD para tablas nuevas (`tareas_pendientes`, `imports_log`, `reglas_auto_categoria`, `validaciones_plataforma_banca`, `categorias_maestras`, `categoria_mapping_log`)
4. Queries Supabase que no impacten datos producción
5. Defaults sensatos para campos sin valor en mocks

PROHIBIDO autónomamente:
1. Cambiar tamaños/colores/paddings del spec
2. Añadir cards/elementos no listados
3. Cambiar orden de elementos
4. Eliminar elementos del spec
5. Improvisar comportamiento si no está descrito

Si encuentra ambigüedad: parar y documentar en `summary.md` para Rubén.

## D.5 ORDEN DE EJECUCIÓN

EN ORDEN, SIN PARAR:

1. FASE A · Panel Global tab Resumen completo
2. FASE B · Conciliación tab Movimientos completo
3. FASE C · Importador tab Subir completo
4. FASE D · Cierre con commits + informe

NO PARAR ENTRE FASES. NO PREGUNTAR. AVANZAR.

Si una fase falla irrecuperablemente: documentar bloqueo, hacer commit con lo conseguido, terminar y avisar.
