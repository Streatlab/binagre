# Spec · Panel Global · Tab Resumen v2 · ESPECIFICACIÓN LITERAL

> **Modelo:** Sonnet por defecto. Subagentes Sonnet (pm-spec → architect-review → implementer → qa-reviewer → erp-reviewer). NO Opus.
> **Modo:** Localhost + deploy Vercel al final autorizado.
> **Aislamiento Binagre:** NUNCA tocar erp-david.
> **REGLA #1:** Este spec contiene TODOS los valores literales. NO interpretar, NO buscar mockup externo, NO improvisar. Si un valor no está aquí, preguntar.

---

## ALCANCE

Reescribir el Tab **Resumen** del Panel Global. Sustituye al tab "General" actual. Datos REALES de Supabase, sin mock data salvo flag explícito `datos demo` cuando BD vacía.

---

## TOKENS BASE (TODO el módulo)

### Página

- `body background: #f5f3ef`
- `body font-family: 'Lexend', sans-serif`
- `body color: #111`
- `body padding: 24px 28px`
- Wrap interior: `max-width: 1400px; margin: 0 auto`

### Familias

- `Oswald` para: títulos, labels MAYÚSCULAS, todas las cifras numéricas, badges canal en tablas
- `Lexend` para: texto general, deltas, subtextos, botones
- NUNCA otra familia

### Importar fuentes

```
<link href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500&family=Oswald:wght@400;500;600&display=swap" rel="stylesheet">
```

### Cards reutilizables

- `.card` → `background: #fff; border: 0.5px solid #d0c8bc; border-radius: 14px; padding: 18px`
- `.card-big` → `background: #fff; border: 0.5px solid #d0c8bc; border-radius: 16px; padding: 24px 28px`

### Labels reutilizables

- `.lbl` → `font-family: 'Oswald'; font-size: 12px; letter-spacing: 2px; color: #7a8090; text-transform: uppercase; font-weight: 500`
- `.lbl-sm` → `font-family: 'Oswald'; font-size: 11px; letter-spacing: 1.5px; color: #7a8090; text-transform: uppercase; font-weight: 500`
- `.lbl-xs` → `font-family: 'Oswald'; font-size: 10px; letter-spacing: 1.5px; color: #7a8090; text-transform: uppercase; font-weight: 500`

### Cifras KPI reutilizables

- `.kpi-big` → `font-family: 'Oswald'; font-size: 38px; font-weight: 600; color: #111`
- `.kpi-mid` → `font-family: 'Oswald'; font-size: 24px; font-weight: 600; color: #111`
- `.kpi-sm` → `font-family: 'Oswald'; font-size: 22px; font-weight: 600; color: #111`

### Barras de cumplimiento

- `.bar-track` → `height: 8px; border-radius: 4px; background: #ebe8e2; overflow: hidden; display: flex`
- Multi-segmento: `<div style="height:100%; width:X%; background: COLOR_CUMPLIDO"></div><div style="height:100%; width:(100-X)%; background:#E24B4A"></div>`

### Editable inline

- `.editable` → `border-bottom: 1px dashed #d0c8bc; color: #3a4050; cursor: text; padding: 0 2px`

### Grid 3 columnas

- `.row3` → `display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px`

### Paleta de colores LITERAL (no improvisar)

| Token | Hex | Uso |
|---|---|---|
| Texto principal | `#111` | Cifras kpi-big, kpi-mid, kpi-sm |
| Texto secundario | `#3a4050` | Texto medio, contadores en filas canal |
| Texto muted | `#7a8090` | Sublabels, deltas neutros, fechas, fillers |
| Borde | `#d0c8bc` | Bordes cards y dropdowns |
| Borde claro | `#ebe8e2` | Track barras |
| Fondo página | `#f5f3ef` | Body |
| Card blanco | `#fff` | Fondo cards |
| Verde semáforo | `#1D9E75` | Cumplido ≥80%, deltas positivos, neto, OK |
| Verde oscuro | `#0F6E56` | Texto sobre fondo Uber, punto extremo derecho |
| Ámbar semáforo | `#f5a623` | Cumplido 50-79%, advertencias |
| Rojo semáforo | `#E24B4A` | Faltante en barras, deltas negativos, atrasado |
| Rojo SL título | `#B01D23` | Solo título PANEL GLOBAL |
| Rojo accent UI | `#FF4757` | Botones primarios, tab activa |
| Uber Eats | `#06C167` | Barras y cards Uber |
| Glovo | `#e8f442` | Barras y cards Glovo |
| Glovo texto | `#3a3a00` | Texto sobre amarillo Glovo |
| Glovo dark | `#5a5500` | Sublabels Glovo |
| Just Eat | `#f5a623` | Barras y cards Just Eat |
| Just Eat dark | `#854F0B` | Texto cards Just Eat |
| Web SL | `#B01D23` | Barras y cards Web |
| Web dark | `#791F1F` | Texto cards Web |
| Directa | `#66aaff` | Barras y cards Directa |
| Directa dark | `#185FA5` | Texto cards Directa |
| Lunes | `#1E5BCC` | Barra día semana lunes |
| Martes | `#06C167` | Barra día semana martes |
| Miércoles | `#f5a623` | Barra día semana miércoles |
| Jueves | `#B01D23` | Barra día semana jueves |
| Viernes | `#66aaff` | Barra día semana viernes |
| Sábado | `#F26B1F` | Barra día semana sábado |
| Domingo | `#1D9E75` | Barra día semana domingo |

---

## ESTRUCTURA HTML LITERAL

### 1. HEADER

```
<div style="display:flex; align-items:baseline; justify-content:space-between; margin-bottom:18px; flex-wrap:wrap; gap:12px">

  <!-- IZQUIERDA: título -->
  <div>
    <div style="font-family:'Oswald'; font-size:22px; font-weight:600; color:#B01D23; letter-spacing:3px; text-transform:uppercase">Panel Global</div>
    <div style="font-size:13px; color:#7a8090; margin-top:2px">{periodo} · {fecha_inicio} — {fecha_fin}</div>
  </div>

  <!-- DERECHA: filtros gap 8px -->
  <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center">

    <!-- Selector fecha (componente compartido SelectorFechaUniversal) -->
    <div style="position:relative">
      <button style="padding:6px 10px; border-radius:8px; border:0.5px solid #d0c8bc; background:#fff; font-size:13px; font-family:'Lexend'; color:#111">{periodo} ▾</button>
      <!-- dropdown 200px ancho, items padding:8px 12px font-size:13px, item activo background:#FF475715 color:#FF4757 weight:500 -->
    </div>

    <button style="padding:6px 10px; border-radius:8px; border:0.5px solid #d0c8bc; background:#fff; font-size:13px; font-family:'Lexend'; color:#111">Todas las marcas ▾</button>
    <button style="padding:6px 10px; border-radius:8px; border:0.5px solid #d0c8bc; background:#fff; font-size:13px; font-family:'Lexend'; color:#111">Canales ▾</button>

  </div>
</div>
```

Dropdown selector fecha · 7 ítems literales:
1. Semana actual
2. Últimos 7 días
3. Mes en curso (DEFAULT)
4. Un mes hasta ahora
5. Últimos 60 días
6. Personalizado
7. Semanas X (chevron derecho ▸ abre submenú con semanas pasadas)

### 2. BLOQUE TABS

```
<div style="background:#fff; border:0.5px solid #d0c8bc; border-radius:14px; padding:14px 18px; margin-bottom:18px; display:inline-flex; gap:8px">

  <button TAB_ACTIVA>Resumen</button>
  <button TAB_INACTIVA>Operaciones</button>
  <button TAB_INACTIVA>Finanzas</button>
  <button TAB_INACTIVA>Cashflow</button>
  <button TAB_INACTIVA>Marcas</button>

</div>
```

- TAB_ACTIVA: `padding:6px 14px; border-radius:6px; border:none; background:#FF4757; color:#fff; font-size:13px; font-family:'Lexend'; font-weight:500`
- TAB_INACTIVA: `padding:6px 14px; border-radius:6px; border:0.5px solid #d0c8bc; background:transparent; color:#3a4050; font-size:13px; font-family:'Lexend'; font-weight:500`
- Tab activa por defecto: **Resumen**

### 3. FILA 1 · 3 CARDS GRANDES (`.row3 margin-bottom:14px`)

#### 3.1 Card VENTAS (`.card-big`)

```
<div class="card-big">
  <div class="lbl">VENTAS</div>

  <!-- Bloque cifras horizontal -->
  <div style="display:flex; align-items:baseline; gap:18px; margin-top:8px; flex-wrap:wrap">
    <div>
      <div class="kpi-big">{bruto} €</div>
      <div class="lbl-xs">BRUTO</div>
    </div>
    <div>
      <div style="font-family:'Oswald'; font-size:24px; font-weight:600; color:#1D9E75">{neto_estimado} €</div>
      <div style="font-family:'Oswald'; font-size:10px; letter-spacing:1.5px; color:#1D9E75; text-transform:uppercase">NETO ESTIMADO · {pct_neto}%</div>
    </div>
  </div>

  <!-- Delta -->
  <div style="font-size:12px; color:{verde_si_positivo|rojo_si_negativo}; margin:10px 0 16px">{flecha} {pct}% vs anterior</div>

  <!-- Barra SEMANAL -->
  <div class="lbl-sm" style="display:flex; justify-content:space-between; margin-bottom:4px">
    <span>SEMANAL — S{nº_semana}</span>
    <span style="color:{semaforo}">{pct}%</span>
  </div>
  <div style="display:flex; align-items:center; gap:8px; font-size:12px; color:#7a8090; margin-bottom:6px">
    <span>Faltan</span><span style="color:{semaforo}">{faltan} €</span><span>de</span><span class="editable">{objetivo} €</span>
  </div>
  <div class="bar-track" style="margin-bottom:14px">
    <div style="height:100%; width:{pct}%; background:#1D9E75"></div>
    <div style="height:100%; width:{100-pct}%; background:#E24B4A"></div>
  </div>

  <!-- Barra MENSUAL — Abril (idem estructura) -->
  <!-- Barra ANUAL — 2026 (idem estructura) -->

</div>
```

Reglas:
- Color flecha delta: verde `#1D9E75` si ≥0, rojo `#E24B4A` si <0
- Color % en lbl-sm derecha y "Faltan" según semáforo: ≥80% verde `#1D9E75`, 50-79% ámbar `#f5a623`, <50% rojo `#E24B4A`
- Editable inline: pulsar el `<span class="editable">` lo convierte en input. Enter guarda en BD `objetivos`. Borrar y enter restaura el valor original. Toast feedback "Objetivo actualizado" o "Restaurado".
- Barra semanal: gap 14px hasta la siguiente
- Barra mensual: gap 14px
- Barra anual: sin margin-bottom

#### 3.2 Card PEDIDOS · TM (`.card-big`)

```
<div class="card-big">
  <div class="lbl">PEDIDOS · TM</div>

  <!-- Bloque cifras horizontal gap 24px -->
  <div style="display:flex; align-items:baseline; gap:24px; margin-top:8px; flex-wrap:wrap">
    <div>
      <div class="kpi-big">{pedidos}</div>
      <div class="lbl-xs">PEDIDOS</div>
    </div>
    <div>
      <div style="font-family:'Oswald'; font-size:26px; font-weight:600">{tm_bruto} €</div>
      <div class="lbl-xs">TM BRUTO</div>
    </div>
    <div>
      <div style="font-family:'Oswald'; font-size:26px; font-weight:600; color:#1D9E75">{tm_neto} €</div>
      <div style="font-family:'Oswald'; font-size:10px; letter-spacing:1.5px; color:#1D9E75; text-transform:uppercase">TM NETO</div>
    </div>
  </div>

  <!-- Delta combinado -->
  <div style="font-size:12px; color:{rojo_o_verde}; margin:8px 0 16px">{flecha} {pct}% pedidos · {flecha} {pct}% TM vs anterior</div>

  <!-- Lista 5 canales -->
  <div style="display:flex; flex-direction:column; gap:8px">

    <!-- Item canal Uber -->
    <div>
      <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:3px">
        <span>● Uber Eats</span>
        <span style="color:#3a4050"><b style="font-weight:500">{pedidos_canal}</b> · {tm_bruto_canal} / <span style="color:#1D9E75">{tm_neto_canal}</span> €</span>
      </div>
      <div style="height:5px; border-radius:3px; background:#ebe8e2; overflow:hidden">
        <div style="height:100%; width:{pct}%; background:#06C167"></div>
      </div>
    </div>

    <!-- Glovo: idem, color #e8f442 -->
    <!-- Just Eat: idem, color #f5a623 -->
    <!-- Web: idem, color #B01D23 -->
    <!-- Directa: idem, color #66aaff -->

  </div>
</div>
```

Reglas:
- Si canal con 0 pedidos: span exterior con `color:#7a8090`, valores `0`, `—`, `—`. Barra width 0%.
- pct barra = pedidos_canal / pedidos_total * 100
- Cifra pedidos del canal en `<b weight:500>`
- TM neto en color `#1D9E75`

#### 3.3 Card RESULTADO PERIODO (`.card-big`)

```
<div class="card-big">
  <div class="lbl">RESULTADO PERIODO</div>

  <!-- Bloque cifras horizontal gap 18px -->
  <div style="display:flex; align-items:baseline; gap:18px; margin-top:8px; flex-wrap:wrap">
    <div>
      <div style="font-family:'Oswald'; font-size:38px; font-weight:600; color:{verde_si_positivo|rojo_si_negativo}">{ebitda} €</div>
      <div class="lbl-xs">EBITDA</div>
    </div>
    <div>
      <div style="font-family:'Oswald'; font-size:24px; font-weight:600; color:{mismo}">{ebitda_pct}%</div>
      <div style="font-family:'Oswald'; font-size:10px; letter-spacing:1.5px; color:{mismo}; text-transform:uppercase">% S/NETOS · BANDA 10-13%</div>
    </div>
  </div>

  <!-- Delta pp -->
  <div style="font-size:12px; color:{verde_o_rojo}; margin:10px 0 16px">{flecha} {pp} pp vs anterior</div>

  <!-- Bloque desglose con border-top -->
  <div style="border-top:0.5px solid #d0c8bc; padding-top:12px">
    <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px">
      <span style="color:#7a8090">Netos estimados</span><span>{val} €</span>
    </div>
    <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px">
      <span style="color:#7a8090">Netos reales factura</span><span>{val} €</span>
    </div>
    <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px">
      <span style="color:#7a8090">Total gastos periodo</span><span>{val} €</span>
    </div>
    <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px">
      <span style="color:#7a8090">Resultado limpio</span><span style="color:#1D9E75; font-weight:500">{val} €</span>
    </div>
  </div>

  <!-- Bloque PRIME COST con border-top -->
  <div style="border-top:0.5px solid #d0c8bc; padding-top:12px; margin-top:12px">
    <div class="lbl-sm" style="display:flex; justify-content:space-between; margin-bottom:6px">
      <span>PRIME COST</span><span style="color:{semaforo_pc}">{pct}%</span>
    </div>
    <div class="bar-track" style="margin-bottom:4px">
      <div style="height:100%; width:{pct}%; background:{color_pc}"></div>
      <div style="height:100%; width:{100-pct}%; background:#ebe8e2"></div>
    </div>
    <div style="font-size:11px; color:#7a8090; display:flex; justify-content:space-between">
      <span>Banda sector 55-65%</span><span style="color:{verde_si_dentro}">OK / Alto / Bajo</span>
    </div>
  </div>
</div>
```

Reglas:
- EBITDA verde si >0, rojo `#E24B4A` si <0
- delta pp: ▲ verde si subió, ▼ rojo si bajó
- Resultado limpio = `netos_reales − total_gastos`
- Prime Cost = `(COGS + Labor) / Netos * 100`
- Color PC: `#1D9E75` si dentro 55-65%, `#f5a623` si entre 50-55 o 65-70, `#E24B4A` fuera. Estado: OK / Bajo / Alto

### 4. FILA 2 · 3 COLUMNAS (`.row3 margin-bottom:14px`)

Cada columna es un `<div>` que contiene:
1. Header label `.lbl` con `margin-bottom:10px`
2. Contenido específico

#### 4.1 Col 1 · FACTURACIÓN POR CANAL

```
<div>
  <div class="lbl" style="margin-bottom:10px">FACTURACIÓN POR CANAL</div>
  <div style="display:flex; flex-direction:column; gap:10px">

    <!-- Card Uber -->
    <div style="background:#06C16720; border:0.5px solid #06C167; border-radius:14px; padding:12px 14px; display:flex; align-items:center; justify-content:space-between; gap:12px">
      <div>
        <div class="lbl-xs" style="color:#0F6E56">UBER EATS</div>
        <div style="font-family:'Oswald'; font-size:18px; font-weight:600; color:#0F6E56; margin-top:2px">{bruto} €</div>
        <div style="font-size:10px; color:#0F6E56">bruto</div>
      </div>
      <div style="text-align:right">
        <div style="font-family:'Oswald'; font-size:15px; font-weight:600; color:#1D9E75">{neto} €</div>
        <div style="font-size:10px; color:#1D9E75">neto · {margen}% margen</div>
      </div>
    </div>

    <!-- Card Glovo -->
    <div style="background:#e8f44230; border:0.5px solid #e8f442; border-radius:14px; padding:12px 14px; display:flex; align-items:center; justify-content:space-between; gap:12px">
      <div>
        <div class="lbl-xs" style="color:#5a5500">GLOVO</div>
        <div style="font-family:'Oswald'; font-size:18px; font-weight:600; color:#3a3a00; margin-top:2px">{bruto} €</div>
        <div style="font-size:10px; color:#5a5500">bruto</div>
      </div>
      <div style="text-align:right">
        <div style="font-family:'Oswald'; font-size:15px; font-weight:600; color:#1D9E75">{neto} €</div>
        <div style="font-size:10px; color:#1D9E75">neto · {margen}% margen</div>
      </div>
    </div>

    <!-- Card Just Eat -->
    <div style="background:#f5a62320; border:0.5px solid #f5a623; border-radius:14px; padding:12px 14px; display:flex; align-items:center; justify-content:space-between; gap:12px">
      <div>
        <div class="lbl-xs" style="color:#854F0B">JUST EAT</div>
        <div style="font-family:'Oswald'; font-size:18px; font-weight:600; color:#854F0B; margin-top:2px">{bruto} €</div>
        <div style="font-size:10px; color:#854F0B">bruto</div>
      </div>
      <div style="text-align:right">
        <div style="font-family:'Oswald'; font-size:15px; font-weight:600; color:#1D9E75">{neto} €</div>
        <div style="font-size:10px; color:#1D9E75">neto · {margen}% margen</div>
      </div>
    </div>

    <!-- Web + Directa grid 2 cols gap 8px -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px">
      <div style="background:#B01D2310; border:0.5px solid #B01D2350; border-radius:14px; padding:10px 12px">
        <div class="lbl-xs" style="color:#791F1F">WEB</div>
        <div style="font-family:'Oswald'; font-size:15px; font-weight:600; color:#791F1F; margin-top:2px">{bruto_o_dash} €</div>
        <div style="font-size:10px; color:#7a8090">{neto_inline_o_sin_datos}</div>
      </div>
      <div style="background:#66aaff20; border:0.5px solid #66aaff; border-radius:14px; padding:10px 12px">
        <div class="lbl-xs" style="color:#185FA5">DIRECTA</div>
        <div style="font-family:'Oswald'; font-size:15px; font-weight:600; color:#185FA5; margin-top:2px">{bruto_o_dash} €</div>
        <div style="font-size:10px; color:#7a8090">{neto_inline_o_sin_datos}</div>
      </div>
    </div>

  </div>
</div>
```

Reglas Web/Directa: si 0 datos → cifra `— €`, texto "sin datos" gris. Si hay datos → cifra normal, texto "{neto} € neto · {margen}%"

Cálculo neto canal:
```
neto = bruto − (bruto × comision_pct) − comision_fija − IVA(21%) × (bruto × comision_pct + comision_fija)
```
ADS NO entra en este cálculo. Tablas: `canales` (campos `comision_pct`, `comision_fija`).

Cálculo margen canal: `neto / bruto * 100` redondeado a entero.

#### 4.2 Col 2 · GRUPOS DE GASTO · CONSUMO vs PRESUPUESTO

```
<div>
  <div class="lbl" style="margin-bottom:10px">GRUPOS DE GASTO · CONSUMO vs PRESUPUESTO</div>
  <div style="display:flex; flex-direction:column; gap:10px">

    <!-- Producto / COGS -->
    <div class="card" style="padding:12px 14px">
      <div style="display:flex; justify-content:space-between; align-items:baseline">
        <div class="lbl-sm">PRODUCTO · COGS</div>
        <div style="font-size:11px; color:#7a8090">food cost <span style="color:{semaforo}; font-weight:500">{food_cost_pct}%</span></div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:4px">
        <div>
          <span style="font-family:'Oswald'; font-size:18px; font-weight:600">{gasto} €</span>
          <span style="font-size:12px; color:#7a8090"> / <span class="editable">{presupuesto} €</span></span>
        </div>
        <div style="font-size:12px; color:{semaforo_cumpl}; font-weight:500">{pct_cumpl}%</div>
      </div>
      <div class="bar-track" style="margin:6px 0 4px; height:6px">
        <div style="height:100%; width:{min(pct_cumpl,100)}%; background:{color_cumpl}"></div>
        <div style="height:100%; width:{max(0,100-pct_cumpl)}%; background:#E24B4A"></div>
      </div>
      <div style="font-size:10px; color:#7a8090; display:flex; justify-content:space-between">
        <span>Banda 25-30%</span><span style="color:{semaforo_desv}">{signo}{desv} € desv</span>
      </div>
    </div>

    <!-- Equipo / Labor (idem, banda 30-35%) -->
    <!-- Local / Occupancy (idem, banda 5-10%) -->
    <!-- Controlables / OPEX (idem, banda 13-18%) -->

  </div>
</div>
```

Variantes:
- **Producto · COGS** banda 25-30% (food cost = COGS/Netos)
- **Equipo · Labor** banda 30-35% s/netos. Header derecho: "% s/netos {pct}%"
- **Local · Occupancy** banda 5-10% s/netos
- **Controlables · OPEX** banda 13-18% s/netos

Reglas:
- Barra altura **6px** (NO 8px como las grandes)
- Si `pct_cumpl ≤ 100`: cumplido en color cumpl + resto rojo
- Si `pct_cumpl > 100`: barra completa rojo `#E24B4A` (caso 106%)
- Color cumpl/semáforo: ≤100% verde `#1D9E75`, 100-105% ámbar `#f5a623`, >105% rojo `#E24B4A`
- Desviación = `gasto − presupuesto`. Signo `+` si supera (color rojo), `-` si bajo (color verde `#1D9E75`)
- Presupuesto editable inline guarda en `presupuestos_grupos_gasto`
- Plataformas NO va aquí. Solo 4 grupos.

#### 4.3 Col 3 · DÍAS PICO — MES ACTUAL

```
<div>
  <div class="lbl" style="margin-bottom:10px">DÍAS PICO — MES ACTUAL</div>
  <div class="card-big" style="padding:18px">

    <svg viewBox="0 0 480 230" style="width:100%; height:auto" xmlns="http://www.w3.org/2000/svg" font-family="Lexend, sans-serif">

      <!-- Valores arriba (Y=20), text-anchor middle -->
      <text x="35" y="20" font-size="11" fill="#7a8090" text-anchor="middle">{val_lun}</text>
      <text x="100" y="20" font-size="11" fill="#7a8090" text-anchor="middle">{val_mar}</text>
      <text x="165" y="20" font-size="11" fill="#7a8090" text-anchor="middle">{val_mie}</text>
      <text x="230" y="20" font-size="11" fill="#7a8090" text-anchor="middle">{val_jue}</text>
      <text x="295" y="20" font-size="11" fill="#7a8090" text-anchor="middle">{val_vie}</text>
      <text x="360" y="20" font-size="11" fill="#7a8090" text-anchor="middle">{val_sab}</text>
      <text x="425" y="20" font-size="11" fill="#3a4050" text-anchor="middle" font-weight="500">{val_dom}</text>

      <!-- Barras: width 40, x=15/80/145/210/275/340/405. Altura proporcional al máximo, base Y=190. rx=2 -->
      <rect x="15"  y="{190-h_lun}" width="40" height="{h_lun}" fill="#1E5BCC" rx="2"/>
      <rect x="80"  y="{190-h_mar}" width="40" height="{h_mar}" fill="#06C167" rx="2"/>
      <rect x="145" y="{190-h_mie}" width="40" height="{h_mie}" fill="#f5a623" rx="2"/>
      <rect x="210" y="{190-h_jue}" width="40" height="{h_jue}" fill="#B01D23" rx="2"/>
      <rect x="275" y="{190-h_vie}" width="40" height="{h_vie}" fill="#66aaff" rx="2"/>
      <rect x="340" y="{190-h_sab}" width="40" height="{h_sab}" fill="#F26B1F" rx="2"/>
      <rect x="405" y="{190-h_dom}" width="40" height="{h_dom}" fill="#1D9E75" rx="2"/>

      <!-- Etiquetas días Y=210 -->
      <text x="35"  y="210" font-size="12" fill="#7a8090" text-anchor="middle">Lun</text>
      <text x="100" y="210" font-size="12" fill="#7a8090" text-anchor="middle">Mar</text>
      <text x="165" y="210" font-size="12" fill="#7a8090" text-anchor="middle">Mié</text>
      <text x="230" y="210" font-size="12" fill="#7a8090" text-anchor="middle">Jue</text>
      <text x="295" y="210" font-size="12" fill="#7a8090" text-anchor="middle">Vie</text>
      <text x="360" y="210" font-size="12" fill="#7a8090" text-anchor="middle">Sáb</text>
      <text x="425" y="210" font-size="12" fill="#7a8090" text-anchor="middle">Dom</text>

    </svg>

    <!-- Resumen abajo -->
    <div style="border-top:0.5px solid #d0c8bc; margin-top:14px; padding-top:12px">
      <div class="lbl-sm" style="margin-bottom:8px">RESUMEN</div>
      <div style="font-size:12px; display:flex; justify-content:space-between; margin-bottom:3px">
        <span style="color:#7a8090">Día más fuerte</span>
        <span style="color:#3a4050; font-weight:500">{nombre_max} · {val_max} €</span>
      </div>
      <div style="font-size:12px; display:flex; justify-content:space-between; margin-bottom:3px">
        <span style="color:#7a8090">Día más débil</span>
        <span style="color:#3a4050">{nombre_min} · {val_min} €</span>
      </div>
      <div style="font-size:12px; display:flex; justify-content:space-between">
        <span style="color:#7a8090">Media diaria</span>
        <span style="color:#3a4050">{media} €</span>
      </div>
    </div>

  </div>
</div>
```

Reglas:
- Altura barras: `h = (val_dia / max_val) × 125`. Máximo absoluto height 125 (barra que toca arriba). Mínimo 30 si val>0.
- Texto valor del día con max: `fill="#3a4050" font-weight="500"`. Resto: `fill="#7a8090"` weight normal.
- Click en barra → filtra Panel a ese día semana (handler React)
- Datos: tabla `facturacion_diaria`, agregada por `EXTRACT(DOW FROM fecha)` dentro del periodo seleccionado

### 5. FILA 3 · 3 CARDS MEDIANAS (`.row3 margin-bottom:14px`)

#### 5.1 Card SALDO + PROYECCIÓN (`.card`)

```
<div class="card">
  <div class="lbl-sm">SALDO + PROYECCIÓN</div>
  <div class="kpi-mid" style="margin-top:6px">{saldo_hoy} €</div>
  <div style="font-size:11px; color:#7a8090">caja líquida hoy</div>

  <div style="display:flex; justify-content:space-between; font-size:12px; margin-top:14px; padding-top:10px; border-top:0.5px solid #d0c8bc">
    <span style="color:#7a8090">Cobros 7d</span><span style="color:#1D9E75">+{cobros_7d} €</span>
  </div>
  <div style="display:flex; justify-content:space-between; font-size:12px">
    <span style="color:#7a8090">Pagos 7d</span><span style="color:#E24B4A">-{pagos_7d} €</span>
  </div>
  <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:500; margin-top:6px">
    <span>Proyección 7d</span><span>{proy_7d} €</span>
  </div>

  <div style="display:flex; justify-content:space-between; font-size:12px; margin-top:8px">
    <span style="color:#7a8090">Cobros 30d</span><span style="color:#1D9E75">+{cobros_30d} €</span>
  </div>
  <div style="display:flex; justify-content:space-between; font-size:12px">
    <span style="color:#7a8090">Pagos 30d</span><span style="color:#E24B4A">-{pagos_30d} €</span>
  </div>
  <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:500; margin-top:6px">
    <span>Proyección 30d</span><span>{proy_30d} €</span>
  </div>

  <!-- Barra visual con 2 puntos -->
  <div style="margin-top:12px; height:6px; border-radius:3px; background:#1D9E75; position:relative">
    <div style="position:absolute; left:0; top:-2px; width:10px; height:10px; border-radius:50%; background:#1D9E75; border:2px solid #fff"></div>
    <div style="position:absolute; right:0; top:-2px; width:10px; height:10px; border-radius:50%; background:#0F6E56; border:2px solid #fff"></div>
  </div>
  <div style="display:flex; justify-content:space-between; font-size:10px; color:#7a8090; margin-top:4px">
    <span>Hoy</span><span>30d</span>
  </div>
</div>
```

Datos: `movimientos_bancarios` (saldo hoy), `cobros_pendientes`, `pagos_pendientes`. Proyecciones = saldo + cobros − pagos.

#### 5.2 Card RATIO INGRESOS / GASTOS (`.card`)

```
<div class="card">
  <div style="display:flex; justify-content:space-between; align-items:baseline">
    <div class="lbl-sm">RATIO INGRESOS / GASTOS</div>
    <div style="font-size:11px; color:#7a8090; display:flex; align-items:center; gap:4px">obj <span class="editable">{obj}</span></div>
  </div>

  <div style="font-family:'Oswald'; font-size:38px; font-weight:600; color:{semaforo}; margin-top:6px">{ratio}</div>
  <div style="font-size:12px; color:{semaforo}; margin-bottom:10px">{flecha} {pct_dist}% del objetivo</div>

  <div style="font-size:12px; display:flex; justify-content:space-between; margin-top:10px">
    <span style="color:#7a8090">Netos estimados</span><span>{val} €</span>
  </div>
  <div style="font-size:12px; display:flex; justify-content:space-between">
    <span style="color:#7a8090">Netos reales (factura)</span><span>{val} €</span>
  </div>
  <div style="font-size:12px; display:flex; justify-content:space-between; margin-top:6px">
    <span style="color:#7a8090">Gastos fijos</span><span>{val} €</span>
  </div>
  <div style="font-size:12px; display:flex; justify-content:space-between">
    <span style="color:#7a8090">Gastos reales</span><span>{val} €</span>
  </div>

  <div style="margin-top:14px; padding-top:10px; border-top:0.5px solid #d0c8bc">
    <div style="font-size:11px; color:#7a8090; margin-bottom:6px">Distancia al objetivo</div>
    <div class="bar-track">
      <div style="height:100%; width:{pct}%; background:{color}"></div>
      <div style="height:100%; width:{100-pct}%; background:#E24B4A"></div>
    </div>
    <div style="font-size:11px; color:#7a8090; text-align:right; margin-top:4px">{pct}% del {obj} obj</div>
  </div>
</div>
```

Reglas:
- Ratio = `netos_reales / gastos_reales` redondeado a 2 decimales
- pct_dist = `ratio / obj * 100` redondeado a entero
- Color cifra ratio y delta: ≥obj verde `#1D9E75`, 80-99% obj ámbar `#f5a623`, <80% rojo `#E24B4A`
- Flecha: ▲ si ≥obj, ▼ si <obj
- Color barra cumplido: mismo semáforo
- Objetivo editable guarda en `objetivos.ratio_ingresos_gastos`

#### 5.3 Card PUNTO DE EQUILIBRIO (`.card`)

```
<div class="card">
  <div class="lbl-sm">PUNTO DE EQUILIBRIO</div>

  <div style="display:flex; align-items:baseline; justify-content:space-between; margin-top:6px">
    <div>
      <div class="kpi-sm">{pe_bruto} €</div>
      <div style="font-size:11px; color:#7a8090">bruto necesario · {pe_neto} € netos</div>
    </div>
    <div style="font-family:'Oswald'; font-size:18px; font-weight:600; color:{semaforo}">{pct_progreso}%</div>
  </div>

  <div class="bar-track" style="margin:10px 0 4px">
    <div style="height:100%; width:{pct}%; background:{semaforo}"></div>
    <div style="height:100%; width:{100-pct}%; background:#E24B4A"></div>
  </div>
  <div style="font-size:11px; color:#7a8090; display:flex; justify-content:space-between">
    <span>Llevamos {acumulado} €</span><span>Faltan {falta} €</span>
  </div>

  <div style="margin-top:14px; padding-top:10px; border-top:0.5px solid #d0c8bc">
    <div style="font-size:12px; display:flex; justify-content:space-between; margin-bottom:4px">
      <span style="color:#7a8090">Día verde estimado</span>
      <span style="color:#3a4050; font-weight:500">{fecha} · {dia_semana}</span>
    </div>
    <div style="font-size:12px; display:flex; justify-content:space-between">
      <span style="color:#7a8090">Facturación / día</span>
      <span style="color:#3a4050; font-weight:500">{val} € bruto</span>
    </div>
    <div style="font-size:12px; display:flex; justify-content:space-between">
      <span style="color:#7a8090">Pedidos / día</span>
      <span style="color:#3a4050; font-weight:500">{n_pedidos} a {tm_actual} €</span>
    </div>
    <div style="font-size:12px; display:flex; justify-content:space-between; margin-top:6px; color:#7a8090">
      <span>Real actual</span><span>{val} €/día · {n} ped/día</span>
    </div>
  </div>
</div>
```

Lógica PE: reutilizar utilidades del módulo PE existente (`gastos_fijos_mes / margen_promedio_pedido`). Día verde estimado = primer día del mes que se prevé alcance pe_bruto manteniendo ritmo actual.

### 6. FILA 4 · 3 CARDS MEDIANAS (`.row3`, sin margin-bottom)

#### 6.1 Card PROVISIONES Y PRÓXIMOS PAGOS (`.card`)

```
<div class="card">
  <div class="lbl-sm">PROVISIONES Y PRÓXIMOS PAGOS</div>

  <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:8px">
    <div>
      <div class="kpi-mid">{total_a_guardar} €</div>
      <div style="font-size:11px; color:#7a8090">a guardar este mes</div>
    </div>
    <div style="font-size:11px; color:#1D9E75; font-weight:500">{prov_iva} € + {prov_irpf} €</div>
  </div>

  <div style="margin-top:14px; font-size:12px; color:#3a4050; display:flex; flex-direction:column; gap:6px">
    <!-- 6 líneas pagos próximos 30d ordenados por fecha asc -->
    <div style="display:flex; justify-content:space-between">
      <span style="color:#7a8090">{concepto} ({fecha})</span><span>{importe} €</span>
    </div>
    <!-- ... -->
  </div>
</div>
```

Datos: `pagos_pendientes` próximos 30d + provisiones IVA/IRPF (módulo PE existente).

#### 6.2 Card PENDIENTES DE SUBIR (`.card` con border-left)

```
<div class="card" style="border-left:3px solid #E24B4A">
  <div style="display:flex; justify-content:space-between; align-items:baseline">
    <div class="lbl-sm">PENDIENTES DE SUBIR</div>
    <span style="background:#E24B4A; color:#fff; font-size:11px; padding:1px 7px; border-radius:9px; font-weight:500">{contador}</span>
  </div>

  <div style="margin-top:14px; display:flex; flex-direction:column; gap:8px; font-size:13px">
    <!-- Items: punto color + concepto / status derecha -->
    <div style="display:flex; justify-content:space-between; align-items:center">
      <span><span style="color:{color_punto}">●</span> {concepto}</span>
      <span style="font-size:11px; color:#7a8090">{status}</span>
    </div>
    <!-- ... -->
  </div>

  <button style="margin-top:14px; width:100%; padding:8px; background:#FF4757; color:#fff; border:none; border-radius:6px; font-family:'Lexend'; font-size:12px; font-weight:500; cursor:pointer">Ir al Importador →</button>
</div>
```

Reglas:
- Color punto: rojo `#E24B4A` si atrasado, ámbar `#f5a623` si hoy, gris `#7a8090` si futuro
- Status: "atrasado Xd" / "hoy" / "en Xd"
- Botón → ruta `/importador`
- Datos: tabla `tareas_pendientes` (módulo Tareas)

#### 6.3 Card TOP VENTAS (`.card`)

```
<div class="card">
  <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:14px">
    <div class="lbl-sm">TOP VENTAS</div>
    <div style="display:flex; gap:6px">
      <button MINI_TAB_ACTIVA>Productos</button>
      <button MINI_TAB_INACTIVA>Modif.</button>
    </div>
  </div>

  <table style="width:100%; font-size:13px; border-collapse:collapse">
    <tr>
      <td style="color:#7a8090; width:18px; padding:6px 0">{ranking}</td>
      <td style="padding:6px 0">{producto}</td>
      <td style="text-align:right; padding:6px 0">
        <span style="background:{color_canal}; color:{texto_canal}; font-family:'Oswald'; font-size:9px; letter-spacing:0.5px; padding:1px 5px; border-radius:3px">{canal_abrev}</span>
      </td>
      <td style="text-align:right; padding:6px 0; color:#3a4050">{pedidos}</td>
      <td style="text-align:right; padding:6px 0; font-family:'Oswald'; font-weight:500">{importe} €</td>
    </tr>
    <!-- 5 filas máximo -->
  </table>
</div>
```

Mini-tabs:
- MINI_TAB_ACTIVA: `padding:4px 10px; border-radius:5px; border:none; background:#FF4757; color:#fff; font-size:11px; font-family:'Lexend'; font-weight:500`
- MINI_TAB_INACTIVA: `padding:4px 10px; border-radius:5px; border:0.5px solid #d0c8bc; background:transparent; color:#3a4050; font-size:11px; font-family:'Lexend'; font-weight:500`

Badges canal en tabla:
- UE (Uber): `background:#06C167; color:#fff`
- GL (Glovo): `background:#e8f442; color:#3a3a00`
- JE (Just Eat): `background:#f5a623; color:#fff`
- WEB: `background:#B01D23; color:#fff`
- DIR (Directa): `background:#66aaff; color:#fff`

Datos: agregación de pedidos por producto (tab Productos) o por modificador (tab Modif.). Top 5 por importe.

---

## REGLAS DE FORMATO NÚMEROS

- Moneda: `formatearEuros(n)` → "12.345,67 €" (separador miles `.`, decimales `,`, símbolo al final con espacio)
- Cifras grandes sin decimales si entero: "8.916 €"
- Porcentajes: entero "45%" salvo Prime Cost que va sin decimales
- Pp: 1 decimal "1,2 pp"

---

## RESPONSIVE

- ≥1024px: grid 3 cols
- 640-1023px: grid 2 cols (cards de fila 2 columnas siguen siendo 1 col cada una verticales dentro)
- <640px: grid 1 col, cards apiladas full-width
- Touch targets ≥44px en mobile (botones header, tabs)

---

## CRITERIOS DE ACEPTACIÓN (validar uno por uno)

1. Todas las medidas literales del spec implementadas. NO interpretar.
2. Tokens canónicos usados. NO hex hardcoded fuera de los listados.
3. Familia Oswald solo en cifras y labels MAYÚSCULAS. Lexend en el resto.
4. Header con título PANEL GLOBAL Oswald 22px 600 letter-spacing 3px color `#B01D23`.
5. Subtítulo dinámico Lexend 13px color `#7a8090` formato "{periodo} · {fecha_ini} — {fecha_fin}".
6. SelectorFechaUniversal con 7 opciones literales. Default "Mes en curso".
7. Tab activa fondo `#FF4757`. Resto borde `0.5px solid #d0c8bc`. NO amarillo. NO `#B01D23`.
8. Card Ventas: 3 barras (semanal/mensual/anual) multi-segmento verde+rojo (no gris).
9. Editable inline en barras Ventas + presupuestos 4 grupos + objetivo Ratio. Borrar+enter restaura.
10. Toast "Objetivo actualizado" / "Restaurado" tras edit.
11. Card Pedidos·TM: 3 cifras horizontales (Pedidos / TM Bruto / TM Neto verde) + 5 canales con barras color canal 5px altura.
12. Card Resultado: EBITDA verde si >0 / rojo si <0. Delta pp. Desglose 4 líneas. Prime Cost banda 55-65%.
13. Cálculo neto canal: bruto − comisión% − comisión fija − IVA(21%)*(comisión% + comisión fija). ADS NO resta.
14. Col Facturación canal: 3 cards principales gap 10px + 2 cards Web/Directa grid 2 cols gap 8px.
15. Col Grupos gasto: 4 cards con barras 6px (NO 8px). Bandas literales (Producto 25-30%, Equipo 30-35%, Local 5-10%, Controlables 13-18%).
16. Col Días pico: SVG 480x230 viewBox, 7 barras color día semana literal, click filtra Panel.
17. Card Saldo: 7d y 30d con cobros/pagos/proyección. Barra 6px verde con 2 puntos extremo.
18. Card Ratio: cifra Oswald 38px color semáforo. Distancia objetivo en barra 8px.
19. Card PE: reutiliza utilidades módulo PE. Día verde estimado calculado proyección lineal.
20. Card Provisiones: total a guardar grande + 6 líneas pagos próximos 30d.
21. Card Pendientes Subir: border-left 3px rojo. Badge contador. Botón → /importador.
22. Card Top Ventas: mini-tabs Productos/Modif. Tabla 5 filas con badge canal Oswald 9px.
23. Persistencia sessionStorage del SelectorFechaUniversal en TODAS las tabs del módulo.
24. Click día en chart Días Pico filtra Panel a ese día semana.
25. Datos REALES de Supabase. Si BD vacía → flag visible "datos demo".
26. Mobile: 3 cols → 2 → 1 col según breakpoint.
27. Build 0 errores tsc + vite.
28. Aislamiento Binagre absoluto. NO tocar erp-david.
29. Deploy Vercel autorizado por defecto al final.

---

## ENTREGABLES

1. Tab Resumen del Panel Global completo según spec literal
2. Componentes extraídos limpios (CardVentas, CardPedidosTM, CardResultadoPeriodo, ColFacturacionCanal, ColGruposGasto, ColDiasPico, CardSaldo, CardRatio, CardPE, CardProvisiones, CardPendientesSubir, CardTopVentas)
3. Build limpio
4. Commit + push master
5. Deploy Vercel `npx vercel --prod`
6. Informe final: URL deploy + 29 criterios pasados/fallados + decisiones tomadas + archivos modificados

---

## DECISIONES AUTÓNOMAS PERMITIDAS

- Estructura de archivos/componentes
- Refactor utilidades cálculo (neto canal, PE, prime cost)
- Skeleton loaders durante fetch
- Animación width 0.5s ease en barras
- Mock data fallback con flag `datos demo` visible si BD vacía

NO autónomo:
- Cambios de tokens (van a guía Notion antes)
- Cambios estructura BD (preguntar)
- Modificar TabConciliacion existente
- Modificar SelectorFechaUniversal (intacto)
- Saltar criterios de aceptación
