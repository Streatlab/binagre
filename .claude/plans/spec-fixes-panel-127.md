# SPEC FIXES — Panel Global · Tab Resumen (post-validación localhost)

> Tras review del Bloque mockups en localhost, Rubén detecta 127 fixes a aplicar.
> Cada fix es UNA tarea concreta con instrucciones de carpintero. NO interpretar.
> Si Code no encuentra qué hacer en un punto, PARA y pregunta. NO improvisar.

---

## Modelo
- General: `claude-sonnet-4-7`
- Subagentes: Sonnet
- Tareas triviales (renombrar texto): Haiku permitido
- PROHIBIDO Opus

## Reglas duras
1. Aislamiento absoluto Binagre vs David
2. Modo localhost. NO Vercel.
3. NO ejecutar migración BD destructiva sin backup explícito
4. NO inventar datos. Si fuente real no existe → mostrar texto "Datos insuficientes"
5. NO improvisar valores estilo. Tokens en `/src/styles/tokens.ts` y guía Notion
6. Pipeline obligatorio: pm-spec → architect-review → implementer → qa-reviewer → erp-reviewer
7. Commit intermedio tras cada bloque: `git add . && git commit -m "fix(panel): bloque X" && git push origin master`

---

# BLOQUE A — REGLAS GENERALES TODO EL ERP

## Helpers obligatorios crear ANTES de tocar nada

Crear archivo `/src/lib/format.ts` con funciones:

```ts
export const fmtEur = (n: number, opts?: { showEuro?: boolean; decimals?: number }) => {
  const decimals = opts?.decimals ?? 2;
  const showEuro = opts?.showEuro ?? false;
  if (n === null || n === undefined || isNaN(n)) return '—';
  const formatted = n.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return showEuro ? `${formatted} €` : formatted;
};

export const fmtPct = (n: number, decimals = 2) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return `${n.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
};

export const fmtSemana = (numSemana: number, lunes: Date) => {
  const dd = String(lunes.getDate()).padStart(2, '0');
  const mm = String(lunes.getMonth() + 1).padStart(2, '0');
  const yy = String(lunes.getFullYear()).slice(-2);
  return `S${numSemana}_${dd}_${mm}_${yy}`;
};
```

USAR estas funciones en TODA la aplicación. PROHIBIDO formatear números a mano fuera de estas helpers.

## A.1 Mobile-friendly TODO el ERP
- Aplicar breakpoints Tailwind: sm 640 / md 768 / lg 1024 / xl 1280
- Sidebar colapsable con burger en `< 768px`
- Cards grid: 1 col mobile / 2 col tablet / 3-5 col desktop según contexto
- Tablas con scroll horizontal en mobile
- Touch targets mínimo 44x44px en mobile
- Validar EXPLÍCITAMENTE en viewports 375 / 768 / 1280
- Capturas obligatorias en `.claude/tracking/mobile-validation/{modulo}-{viewport}.png`

## A.2 Formato números global
- USAR `fmtEur` y `fmtPct` de `/src/lib/format.ts` SIEMPRE
- Separador miles: punto "."
- Decimales: 2 con coma ","
- Símbolo €: SOLO donde se especifique en cada bloque

## A.3 Barra cumplimiento estándar (componente compartido)

Crear `/src/components/ui/BarraCumplimiento.tsx`:

```tsx
interface Props {
  pct: number;              // 0-100+
  altura?: number;          // default 8
}

export const BarraCumplimiento = ({ pct, altura = 8 }: Props) => {
  const colorFill =
    pct >= 50 ? '#1D9E75' :   // verde
    pct >= 1 ? '#f5a623' :    // amarillo
    '#ebe8e2';                // sin progreso

  const colorRest = '#E24B4A'; // rojo el resto incompleto

  return (
    <div style={{
      height: altura,
      borderRadius: altura / 2,
      background: '#ebe8e2',
      overflow: 'hidden',
      display: 'flex',
    }}>
      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: colorFill }} />
      <div style={{ height: '100%', width: `${100 - Math.min(pct, 100)}%`, background: colorRest }} />
    </div>
  );
};
```

USAR este componente en TODAS las barras de progreso del ERP. PROHIBIDO crear barras nuevas con otros estilos.

## A.4 Color semáforo % cumplimiento (helper)

Crear en `/src/lib/format.ts`:

```ts
export const colorSemaforo = (pct: number): string => {
  if (pct >= 50) return '#1D9E75'; // verde
  if (pct >= 1) return '#f5a623';  // amarillo
  return '#E24B4A';                // rojo
};
```

USAR este helper para colorear cualquier % en el ERP.

## A.5 Datos reales obligatorio
- TODOS los componentes deben leer de Supabase real
- Si una tabla está vacía → mostrar texto "Datos insuficientes" en lugar del valor
- PROHIBIDO valores hardcoded para "rellenar visual"

---

# BLOQUE B — HEADER Y NAVEGACIÓN

## B.1 Banner amarillo "Tienes pendiente subir"

Archivo: `/src/components/layout/BannerPendientes.tsx`

Ajustes literales:
- Altura: pasar de actual a `padding: '8px 16px'` (más estrecho verticalmente)
- Font-size mensaje: bajar de 14px a 13px
- Icono ⚠️: tamaño 14px (de 18px actual)
- Botón "IR AL IMPORTADOR": `padding: '6px 12px'` y `fontSize: 12`
- Botón cierre ×: tamaño 16px con `cursor: pointer`
- `marginBottom: 12` (de 16 actual)

## B.2 Marco contenedor tabs

Archivo: `/src/components/ui/TabsPastilla.tsx`

Ajustes literales:
```ts
container: {
  background: '#fff',
  border: '0.5px solid #d0c8bc',
  borderRadius: 12,        // antes 14
  padding: '6px 8px',       // antes '14px 18px'
  marginBottom: 14,         // antes 18
  display: 'inline-flex',
  gap: 6,                   // antes 8
}
```

## B.3 Dropdowns con flecha pequeña ▾

Buscar en TODO el código `▾` por símbolo más fino.

Archivo `/src/components/ui/DropdownButton.tsx`:

Reemplazar texto del botón:
- ANTES: `{label} ▾`
- DESPUÉS: `<span>{label}</span><ChevronDown size={11} strokeWidth={2.5} style={{ marginLeft: 4 }} />`

Importar `ChevronDown` de `lucide-react`. Aplicar en TODOS los dropdowns del ERP (Mes en curso, Marcas, Canales, Categoría, Cuentas, Exportar, Histórico filtros, etc.).

## B.4 Dropdown Marcas más compacto

Archivo del dropdown marcas (probablemente `/src/components/dropdowns/DropdownMarcas.tsx` o equivalente).

Ajustes literales:
- Cada item del listado: `padding: '4px 10px'` (de '8px 12px' actual)
- `fontSize: 12` (de 13)
- `lineHeight: 1.3`
- Container: `maxHeight: 320; overflowY: auto`
- Eliminar separadores verticales entre items si los hay

---

# BLOQUE C — CARD FACTURACIÓN

Archivo: `/src/components/panel/CardFacturacion.tsx`

## C.1 Renombrar
- ANTES: sublabel "VENTAS"
- DESPUÉS: sublabel "FACTURACIÓN"

## C.2 Estructura layout valores
Bruto y Neto Estimado mismo tamaño:
```tsx
<div style={{ display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap' }}>
  <div>
    <div style={{ fontFamily: 'Oswald', fontSize: 38, fontWeight: 600, color: '#111' }}>
      {fmtEur(bruto, { showEuro: false })}
    </div>
    <div style={{ fontFamily: 'Oswald', fontSize: 10, letterSpacing: 1.5, color: '#7a8090', textTransform: 'uppercase', fontWeight: 500 }}>
      BRUTO
    </div>
  </div>
  <div>
    <div style={{ fontFamily: 'Oswald', fontSize: 38, fontWeight: 600, color: '#1D9E75' }}>
      {fmtEur(netoEstimado, { showEuro: false })}
    </div>
    <div style={{ fontFamily: 'Oswald', fontSize: 10, letterSpacing: 1.5, color: '#1D9E75', textTransform: 'uppercase', fontWeight: 500 }}>
      NETO ESTIMADO · {fmtPct(margenPct, 0)}
    </div>
  </div>
</div>
```

PROHIBIDO símbolo € en TODA esta card.

## C.3 Cálculo Neto Estimado

```ts
// Margen ponderado por PMP (Peso Medio Ponderado)
const calcularNetoEstimado = (brutoPorCanal: Record<string, number>) => {
  const totalBruto = Object.values(brutoPorCanal).reduce((a, b) => a + b, 0);
  if (totalBruto === 0) return 0;
  
  const margenPorCanal = {
    uber: 0.59,      // sustituir por valor real desde tabla canales
    glovo: 0.66,
    just_eat: 0.73,
    web: 0.93,
    directa: 1.00,
  };
  
  let netoTotal = 0;
  for (const [canal, bruto] of Object.entries(brutoPorCanal)) {
    netoTotal += bruto * (margenPorCanal[canal] ?? 0);
  }
  return netoTotal;
};
```

NOTA: `margenPorCanal` debe leerse de tabla `canales` columna `margen_actual`. Si la tabla no existe o no tiene esa columna, parar y avisar.

## C.4 Lectura objetivos desde módulo Objetivos

```ts
// Lee tabla objetivos con prioridad: override usuario > valor desde Objetivos
const objetivoSemanal = await supabase
  .from('objetivos')
  .select('valor, override_usuario')
  .eq('tipo', 'semanal')
  .eq('año', añoActual)
  .eq('semana', semanaActual)
  .single();

// Mostrar override_usuario si existe, sino valor base
const valorMostrado = objetivoSemanal.override_usuario ?? objetivoSemanal.valor;
```

Comportamiento editable inline:
- Hover sobre cifra: cambiar color a `#FF4757`, cursor pointer, border-bottom dashed
- Click: convertir a `<input type="number">`
- Enter o blur: `UPDATE objetivos SET override_usuario = nuevoValor WHERE ...` + toast verde "Objetivo actualizado"
- Input vacío + Enter: `UPDATE objetivos SET override_usuario = NULL` + toast amarillo "Objetivo restaurado"
- ESC: cancela edición sin guardar

## C.5 Etiquetas de las 3 líneas

Línea 1 (semanal):
- ANTES: "SEMANAL — S18"
- DESPUÉS: usar `fmtSemana(numSemana, lunesSemana)` → "S18_27_04_26"

Línea 2 (mensual):
- ANTES: "MENSUAL — ABRIL"
- DESPUÉS: solo el nombre del mes capitalizado: "Abril"

Línea 3 (anual):
- ANTES: "ANUAL — 2026"
- DESPUÉS: solo el año: "2026"

## C.6 Barras y % cumplimiento

Sustituir cualquier `<div>` con barra ad-hoc por `<BarraCumplimiento pct={pct} />` (FASE A.3).

% cumplimiento al lado de la etiqueta usar `colorSemaforo(pct)` (FASE A.4).

## C.7 Faltantes con € NO

ANTES: "Faltan 5.000 €"
DESPUÉS: usar `fmtEur(falta, { showEuro: false })` → "Faltan 5.000,00"

PROHIBIDO símbolo € en TODA la card C.

---

# BLOQUE D — CARD PEDIDOS · TM

Archivo: `/src/components/panel/CardPedidosTM.tsx`

## D.1 Mismo tamaño los 3 valores

```tsx
<div style={{ display: 'flex', alignItems: 'baseline', gap: 24, flexWrap: 'wrap' }}>
  <div>
    <div style={{ fontFamily: 'Oswald', fontSize: 38, fontWeight: 600, color: '#1E5BCC' /* azul lunes */ }}>
      {pedidos.toLocaleString('es-ES')}
    </div>
    <div style={{ fontFamily: 'Oswald', fontSize: 10, letterSpacing: 1.5, color: '#1E5BCC', textTransform: 'uppercase', fontWeight: 500 }}>
      PEDIDOS
    </div>
  </div>
  <div>
    <div style={{ fontFamily: 'Oswald', fontSize: 38, fontWeight: 600, color: '#F26B1F' /* naranja */ }}>
      {fmtEur(tmBruto)}
    </div>
    <div style={{ fontFamily: 'Oswald', fontSize: 10, letterSpacing: 1.5, color: '#F26B1F', textTransform: 'uppercase', fontWeight: 500 }}>
      TM BRUTO
    </div>
  </div>
  <div>
    <div style={{ fontFamily: 'Oswald', fontSize: 38, fontWeight: 600, color: '#1D9E75' /* verde */ }}>
      {fmtEur(tmNeto)}
    </div>
    <div style={{ fontFamily: 'Oswald', fontSize: 10, letterSpacing: 1.5, color: '#1D9E75', textTransform: 'uppercase', fontWeight: 500 }}>
      TM NETO
    </div>
  </div>
</div>
```

PROHIBIDO escribir "Ticket Medio" en ningún sitio. Solo "TM".

## D.2 Desglose por canal

5 filas (Uber/Glovo/JustEat/Web/Directa). Estructura cada fila:

```tsx
<div>
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
    <span>● {nombreCanal}</span>
    <span style={{ color: '#3a4050' }}>
      <b style={{ color: '#1E5BCC', fontWeight: 500 }}>{pedidosCanal.toLocaleString('es-ES')}</b>
      {' · '}
      <span style={{ color: '#F26B1F' }}>{fmtEur(tmBrutoCanal)}</span>
      {' / '}
      <span style={{ color: '#1D9E75' }}>{fmtEur(tmNetoCanal)}</span>
    </span>
  </div>
  <div style={{ height: 5, borderRadius: 3, background: '#ebe8e2', overflow: 'hidden' }}>
    <div style={{ height: '100%', width: `${pesoPedidos}%`, background: colorCanal }} />
  </div>
</div>
```

`colorCanal`:
- Uber: `#06C167`
- Glovo: `#e8f442`
- Just Eat: `#f5a623`
- Web: `#B01D23`
- Directa: `#66aaff`

## D.3 Datos vacíos

Si `pedidosCanal === 0`:
- Mostrar "0" (no "—")
- TM: mostrar "0,00" en su color (no "—")
- Barra width 0%
- Color texto del nombre canal: `#7a8090` (muted) en lugar de color del canal

---

# BLOQUE E — CARD RESULTADO

Archivo: `/src/components/panel/CardResultado.tsx`

## E.1 Renombrar
- ANTES: sublabel "RESULTADO PERIODO"
- DESPUÉS: sublabel "RESULTADO"

## E.2 EBITDA con € (resto sin €)

```tsx
<div>
  <div style={{ fontFamily: 'Oswald', fontSize: 38, fontWeight: 600, color: ebitda >= 0 ? '#1D9E75' : '#E24B4A' }}>
    {fmtEur(ebitda, { showEuro: true })}
  </div>
  <div style={{ fontFamily: 'Oswald', fontSize: 10, letterSpacing: 1.5, color: ebitda >= 0 ? '#1D9E75' : '#E24B4A', textTransform: 'uppercase', fontWeight: 500 }}>
    EBITDA
  </div>
</div>
```

## E.3 Comparativa "pp"

ANTES: "▼ 1.0 pp vs anterior"
DESPUÉS: "▼ 1,0 puntos porcentuales vs anterior"

## E.4 Cascada PyG con datos reales

Estructura de la card (bloque inferior):

```
Borde superior 0.5px solid #d0c8bc
Padding-top 12px

Línea 1: "Ingresos brutos"      [valor sin €]   con tooltip "Facturación plataforma + venta directa"
Línea 2: "Comisiones + IVA"     [valor sin €]   con tooltip "Comisiones plataformas + 21% IVA sobre comisiones"
Línea 3: "Ingresos netos"       [valor sin €] strong   con tooltip "Lo que de verdad entra a Streat Lab"
Línea 4: "Producto (COGS)"      [valor sin €]   con tooltip "Food cost + bebida + packaging + mermas"
Línea 5: "Margen bruto"         [valor sin €] strong
Línea 6: "Personal"             [valor sin €]   con tooltip "Sueldos + SS + sueldos socios"
Línea 7: "Local + Controlables" [valor sin €]   con tooltip "Alquiler+IRPF+suministros + marketing+software+gestoría+bancos+transporte+seguros"
Línea 8: "EBITDA"               [valor con €] verde/rojo strong   con tooltip "Beneficio antes de impuestos"
Línea 9: "Provisiones"          [valor sin €]   con tooltip "Provisión IVA + IRPF"
Línea 10: "Resultado limpio"    [valor sin €] strong   con tooltip "Lo que queda tras provisiones"
```

Todas las cifras desde Supabase tabla `running` o equivalente. Si tabla no tiene datos del periodo: mostrar "Datos insuficientes" en cada línea.

## E.5 Prime Cost al final

```
Borde superior 0.5px solid #d0c8bc
Padding-top 12 margin-top 12

Línea cabecera:
  Izq: "PRIME COST" con tooltip "COGS + Personal sobre netos. KPI hostelería."
  Der: {fmtPct(primeCostPct)} en color colorSemaforo(primeCostPct)

Barra: <BarraCumplimiento pct={primeCostPct} />

Línea inferior:
  Izq: "Objetivo" muted + valor editable inline (default 60%) en color #1D9E75
  Der: estado ("OK"/"Alto"/"Crítico") según objetivo
```

Editable inline objetivo: igual que C.4. Lee tabla `kpi_objetivos` columna `prime_cost_target`.

---

# BLOQUE F — CARDS PLATAFORMAS

Archivo: `/src/components/panel/CardCanal.tsx`

## F.1 Aumentar tamaño tipografías

```ts
const textos = {
  bruto: { fontSize: 24 },        // antes 22
  neto: { fontSize: 20 },         // antes 18
  margen: { fontSize: 14 },       // antes 12
  sublabel: { fontSize: 11 },     // antes 10
};
```

## F.2 Card Glovo borde visible

Si `canal === 'glovo'`:
- `border: '1px solid #5a5500'` (antes 0.5px)
- `boxShadow: '0 0 0 1px #5a5500 inset'`

## F.3 Formato margen

ANTES: `"3.488,37 € neto · 59% margen"` 
DESPUÉS:
```tsx
<div>
  <div>{fmtEur(neto, { showEuro: true })}</div>
  <div>Margen {fmtPct(margenPct)}</div>
</div>
```

## F.4 Cálculo margen real

```ts
const calcularMargenReal = (canal: 'uber'|'glovo'|'just_eat'|'web'|'directa', mes: number, año: number) => {
  // Lee desde tabla resumenes_plataforma_marca_mensual
  const datos = supabase
    .from('resumenes_plataforma_marca_mensual')
    .select('bruto, comisiones, fees, cargos_promocion')
    .eq('plataforma', canal)
    .eq('mes', mes)
    .eq('año', año);
  
  if (!datos || datos.length === 0) return null; // mostrar "Datos insuficientes"
  
  const bruto = sum(datos.map(d => d.bruto));
  const comisiones = sum(datos.map(d => d.comisiones));
  const fees = sum(datos.map(d => d.fees));
  const cargos = sum(datos.map(d => d.cargos_promocion ?? 0));
  
  const ivaComisiones = (comisiones + fees + cargos) * 0.21;
  const neto = bruto - comisiones - fees - cargos - ivaComisiones;
  
  return {
    bruto,
    neto,
    margenPct: (neto / bruto) * 100,
  };
};
```

NOTA: si `resumenes_plataforma_marca_mensual` está vacío para ese mes/canal: mostrar "Datos insuficientes" en las cifras de esa card.

## F.5 Decimales y miles

USAR `fmtEur` de A.0 en TODAS las cifras.

---

# BLOQUE G — GRUPOS DE GASTO

Archivo: `/src/components/panel/CardGrupoGasto.tsx`

## G.1 4 cards (orden):
1. PRODUCTO · COGS
2. EQUIPO · LABOR (renombrar de "Personal" si está como tal)
3. LOCAL · OCCUPANCY
4. CONTROLABLES · OPEX

## G.2 KPI cabecera derecha

Solo en card PRODUCTO mostrar:
```tsx
<span>Food Cost <span style={{ color: '#1D9E75', fontWeight: 500 }}>{fmtPct(foodCostPct, 0)}</span></span>
```

En las otras 3 NO mostrar nada en cabecera derecha. Eliminar el "% s/netos" actual.

## G.3 Línea valor

```tsx
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
  <div>
    <span style={{ fontFamily: 'Oswald', fontSize: 18, fontWeight: 600 }}>
      {fmtEur(consumido, { showEuro: false })}
    </span>
    <span style={{ fontSize: 12, color: '#7a8090' }}>
      {' / '}
      <span style={{ borderBottom: '1px dashed #d0c8bc', cursor: 'text', color: '#3a4050', padding: '0 2px' }}>
        {fmtEur(presupuesto, { showEuro: false })}
      </span>
    </span>
  </div>
  <div style={{ fontSize: 12, color: colorSemaforo(consumoPct), fontWeight: 500 }}>
    {fmtPct(consumoPct, 0)}
  </div>
</div>
```

## G.4 Cálculo presupuesto auto

```ts
const presupuestoAuto = (grupo: 'producto'|'equipo'|'local'|'controlables', netos: number) => {
  const pcts = { producto: 0.30, equipo: 0.40, local: 0.15, controlables: 0.15 };
  return netos * pcts[grupo];
};
```

NOTA: `netos` es ingresos NETOS sin IVA del periodo seleccionado. Lee tabla `running` columna `ingresos_netos_periodo`.

## G.5 Editable inline presupuesto

Misma mecánica C.4 pero sobre tabla `kpi_objetivos.presupuesto_{grupo}`. Si NULL: usa cálculo auto.

## G.6 Barra

`<BarraCumplimiento pct={consumoPct} />`. Lógica: si consumido <= presupuesto → barra avanza con verde. Si supera → 100% rojo.

## G.7 Línea inferior

ANTES: `"Banda 25-30%   -233 € desv"`
DESPUÉS:
```tsx
<div style={{ fontSize: 10, color: '#7a8090', display: 'flex', justifyContent: 'space-between' }}>
  <span></span>  {/* Quitar "Banda XX-XX%" */}
  <span style={{ color: desviacion < 0 ? '#1D9E75' : '#E24B4A' }}>
    {desviacion < 0 ? '' : '+'}{fmtEur(desviacion, { showEuro: false })} desv
  </span>
</div>
```

Signo: si consumido < presupuesto → desviación negativa (color verde, ahorro). Si consumido > presupuesto → desviación positiva con "+" (rojo, sobrecoste).

---

# BLOQUE H — DÍAS PICO

Archivo: `/src/components/panel/CardDiasPico.tsx`

## H.1 Título dinámico

ANTES: "DÍAS PICO — MES ACTUAL"
DESPUÉS:
```tsx
<div className="lbl">DÍAS PICO — {nombreMes} - Facturación Bruta</div>
```

`nombreMes` capitalizado en español: "Enero", "Febrero", ..., "Diciembre". Si periodo seleccionado != mes: mostrar nombre del rango ("Semana 18", "Últimos 60 días", etc.).

## H.2 Eje doble (barras + línea media)

Modificar SVG para añadir línea horizontal de la media semanal:

```tsx
const mediaSemanal = facturacionPorDia.reduce((a, b) => a + b, 0) / 7;
const yMedia = 190 - (mediaSemanal / maxValor) * 125;

<line
  x1="15" y1={yMedia}
  x2="445" y2={yMedia}
  stroke="#7a8090"
  strokeDasharray="4 4"
  strokeWidth="1"
/>
<text x="445" y={yMedia - 4} fontSize="10" fill="#7a8090" textAnchor="end">
  Media: {fmtEur(mediaSemanal, { showEuro: false })}
</text>
```

## H.3 Valores encima de barras

Cada `<text>` con valor: usar `fmtEur(valor, { showEuro: false })` (no €, sí decimales y miles).

## H.4 Bloque inferior

ANTES:
```
RESUMEN
Día más fuerte    Domingo · 2.168 €
Día más débil     Miércoles · 819 €
Media diaria      1.331 €
```

DESPUÉS (eliminar "RESUMEN" y palabra "débil"):
```tsx
<div style={{ borderTop: '0.5px solid #d0c8bc', marginTop: 14, paddingTop: 12 }}>
  <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
    <span style={{ color: '#7a8090' }}>Día más fuerte</span>
    <span style={{ color: '#3a4050', fontWeight: 500 }}>
      {nombreDiaFuerte} · {fmtEur(valorDiaFuerte, { showEuro: false })}
    </span>
  </div>
  <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
    <span style={{ color: '#7a8090' }}>Día más flojo</span>
    <span style={{ color: '#3a4050' }}>
      {nombreDiaFlojo} · {fmtEur(valorDiaFlojo, { showEuro: false })}
    </span>
  </div>
  <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
    <span style={{ color: '#7a8090' }}>Media diaria</span>
    <span style={{ color: '#3a4050' }}>{fmtEur(mediaDiaria, { showEuro: false })}</span>
  </div>
</div>
```

## H.5 Datos reales

Lee desde Supabase tabla `facturacion_diaria` agrupada por DOW del periodo seleccionado. Si vacío: SVG con barras de altura 0 + texto inferior "Datos insuficientes".

---

# BLOQUE I — SALDO + PROYECCIÓN

Archivo: `/src/components/panel/CardSaldoProyeccion.tsx`

## I.1 Sublabel y aclaración

Mantener `cardLabelSm` "SALDO + PROYECCIÓN" arriba.

Bajo el valor grande, cambiar:
- ANTES: "caja líquida hoy"
- DESPUÉS: "Saldo cuentas Streat Lab"

Tooltip al hover sobre "Saldo cuentas Streat Lab": "Suma del saldo actual de las cuentas bancarias de SL. Se actualiza al subir el extracto bancario al Importador."

## I.2 Lectura datos reales

```ts
const saldoActual = await supabase
  .from('cuentas_bancarias')
  .select('saldo_actual')
  .eq('titular', 'streat_lab')
  .eq('activa', true);

const total = sum(saldoActual.map(c => c.saldo_actual));
```

Si tabla vacía o sin movimientos recientes (más de 7 días): mostrar "Datos insuficientes".

## I.3 Cálculo cobros 7d/30d

```ts
const cobrosEstimados = (dias: number) => {
  const hoy = new Date();
  const limite = new Date(hoy.getTime() + dias * 86400000);
  
  // Cobros plataforma según ciclos de pago
  const cobros = [];
  
  // Uber: paga lunes lo de lunes-domingo anterior
  // Glovo: 1-15 paga 5 mes siguiente, 16-fin paga 20 mes siguiente
  // Just Eat: 1-15 paga 20 mismo mes, 16-fin paga 5 mes siguiente
  
  // ... (calcular todas las facturas plataforma con fecha_cobro_estimada <= limite)
  
  // Si hay factura real subida (ventas_plataforma_marca_mensual con neto_real_cobrado): usa real
  // Si no hay factura: estima según margen ponderado
  
  return sum(cobros);
};
```

## I.4 Cálculo pagos 7d/30d

```ts
const pagosFijos = (dias: number) => {
  // Lee gastos_fijos con proxima_fecha_pago entre hoy y hoy+dias
  return supabase
    .from('gastos_fijos')
    .select('importe')
    .gte('proxima_fecha_pago', hoy)
    .lte('proxima_fecha_pago', hoy + dias);
};

const pagosVariables = (dias: number) => {
  // Lee facturas con vencimiento entre hoy y hoy+dias
  return supabase
    .from('facturas')
    .select('importe')
    .eq('pagada', false)
    .gte('fecha_vencimiento', hoy)
    .lte('fecha_vencimiento', hoy + dias);
};

const totalPagos = (dias: number) => pagosFijos(dias) + pagosVariables(dias);
```

## I.5 ELIMINAR barra "Hoy → 30d"

Borrar el bloque:
```tsx
<div style={{ marginTop: 12, height: 6, borderRadius: 3, background: '#1D9E75', position: 'relative' }}>
  ...
</div>
<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#7a8090', marginTop: 4 }}>
  <span>Hoy</span><span>30d</span>
</div>
```

NO sustituir por nada.

## I.6 Formato cifras

USAR `fmtEur` con `showEuro: false` (sin €) en TODAS las líneas. Mantener signo + para cobros, - para pagos.

---

# BLOQUE J — RATIO INGRESOS / GASTOS

Archivo: `/src/components/panel/CardRatio.tsx`

## J.1 Cabecera

ANTES: "obj 2,5"
DESPUÉS:
```tsx
<div style={{ fontSize: 11, color: '#7a8090', display: 'flex', alignItems: 'center', gap: 4 }}>
  <span style={{ color: '#1D9E75' }}>Objetivo</span>
  <span style={{ borderBottom: '1px dashed #d0c8bc', cursor: 'text', color: '#3a4050', padding: '0 2px' }}>
    {fmtEur(objetivo, { showEuro: false, decimals: 2 })}
  </span>
</div>
```

Editable inline misma mecánica C.4 sobre `kpi_objetivos.ratio_target` (default 2.5).

## J.2 Coeficiente grande

```tsx
<div style={{ fontFamily: 'Oswald', fontSize: 38, fontWeight: 600, color: colorSemaforo(ratio / objetivo * 100), marginTop: 6 }}>
  {fmtEur(ratio, { showEuro: false, decimals: 2 })}
</div>
```

## J.3 Desviación bajo coeficiente (NUEVO)

INMEDIATAMENTE bajo el coeficiente grande:
```tsx
<div style={{ marginTop: 4, marginBottom: 10 }}>
  <BarraCumplimiento pct={(ratio / objetivo) * 100} altura={6} />
  <div style={{ fontSize: 11, color: colorSemaforo((ratio/objetivo)*100), marginTop: 4 }}>
    {ratio < objetivo ? '▼' : '▲'} {fmtPct(Math.abs((ratio/objetivo - 1) * 100))} {ratio < objetivo ? 'bajo' : 'sobre'} objetivo
  </div>
</div>
```

ELIMINAR la sección actual de "Distancia al objetivo" abajo, ya está movida arriba.

## J.4 Líneas detalle

```tsx
<div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
  <span style={{ color: '#7a8090' }}>Ingresos netos</span>
  <span>{fmtEur(ingresosNetos, { showEuro: false })}</span>
</div>
<div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
  <span style={{ color: '#7a8090' }}>Gastos fijos</span>
  <span>{fmtEur(gastosFijos, { showEuro: false })}</span>
</div>
<div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
  <span style={{ color: '#7a8090' }}>Gastos variables</span>
  <span>{fmtEur(gastosVariables, { showEuro: false })}</span>
</div>
```

ELIMINAR las líneas "Netos estimados" y "Netos reales factura" actuales.

## J.5 Cálculo

```ts
const ratio = (ingresosNetos) / (gastosFijos + gastosVariables);
```

`ingresosNetos`: lee `running.ingresos_netos_periodo`
`gastosFijos`: lee `running.gastos_fijos_periodo`
`gastosVariables`: lee `running.gastos_variables_periodo`

## J.6 Tooltip

Sobre la palabra "Ratio Ingresos / Gastos" en la cabecera:
"Euros que entran por cada euro de gasto. Mayor es mejor."

---

# BLOQUE K — PUNTO DE EQUILIBRIO

Archivo: `/src/components/panel/CardPuntoEquilibrio.tsx`

## K.1 Cabecera

```tsx
<div className="lbl-sm">PUNTO DE EQUILIBRIO</div>
```

Tooltip al hover: "Momento del periodo en que la facturación real cubre la suma de gastos fijos + variables + provisiones de impuestos."

## K.2 Bloque valor principal

ANTES: "15.500 € bruto necesario · 9.610 € netos"

DESPUÉS:
```tsx
<div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
  <div>
    <div style={{ fontFamily: 'Oswald', fontSize: 22, fontWeight: 600 }}>
      {fmtEur(brutoNecesario, { showEuro: false })}
    </div>
    <div style={{ fontSize: 11, color: '#7a8090' }}>Bruto necesario</div>
  </div>
  <div style={{ fontFamily: 'Oswald', fontSize: 18, fontWeight: 600, color: colorSemaforo(pct) }}>
    {fmtPct(pct, 2)}
  </div>
</div>
```

ELIMINAR "9.610 € netos" del subtítulo.

## K.3 Cálculo

```ts
// PE = momento en que cubrimos gastos+impuestos
const brutoNecesario = (gastosFijos + gastosVariablesEstimados + provisionesImpuestos) / margenNetoMedio;
const pct = (facturadoActual / brutoNecesario) * 100;
```

Datos reales:
- `gastosFijos`: lee `running.gastos_fijos_periodo`
- `gastosVariablesEstimados`: lee `running.gastos_variables_estimado_periodo`
- `provisionesImpuestos`: lee `provisiones.iva + provisiones.irpf` del periodo
- `margenNetoMedio`: calculado igual que C.3
- `facturadoActual`: lee `facturacion.bruto_acumulado_periodo`

## K.4 Bloque inferior

```tsx
<div style={{ marginTop: 14, paddingTop: 10, borderTop: '0.5px solid #d0c8bc' }}>
  <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
    <span style={{ color: '#7a8090' }}>Día verde estimado</span>
    <span style={{ color: '#1D9E75', fontWeight: 500 }}>
      {pct >= 100 ? `Alcanzado ✓ (${fmtFecha(diaAlcanzado)})` : fmtFecha(diaVerdeEstimado)}
    </span>
  </div>
  <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
    <span style={{ color: '#7a8090' }}>Facturación día</span>
    <span style={{ color: '#3a4050', fontWeight: 500 }}>
      {fmtEur(facturacionDia, { showEuro: false })}
    </span>
  </div>
  <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
    <span style={{ color: '#7a8090' }}>Pedidos día</span>
    <span style={{ color: '#3a4050', fontWeight: 500 }}>
      <span style={{ color: '#1E5BCC' }}>{pedidosNecesarios}</span>
      {' a '}
      <span style={{ color: '#F26B1F' }}>{fmtEur(tmActual, { decimals: 2 })}</span>
    </span>
  </div>
  <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginTop: 6, color: '#7a8090' }}>
    <span>Real actual</span>
    <span>
      {fmtEur(facturacionDiaActual)} · {pedidosDiaActual} ped/día
    </span>
  </div>
</div>
```

ELIMINAR símbolo € de "Facturación día". ELIMINAR palabra "bruto" del lado de Facturación.

Aplicar 2 decimales al TM ("23,84").

Tooltip "Real actual": "Lo que estamos facturando de media diaria en el periodo seleccionado."

## K.5 Renombrar

ANTES: `"Facturación / día"` 
DESPUÉS: `"Facturación día"` (sin barra)

ANTES: `"Pedidos / día"`
DESPUÉS: `"Pedidos día"` (sin barra)

---

# BLOQUE L — PROVISIONES Y PRÓXIMOS PAGOS

Archivo: `/src/components/panel/CardProvisiones.tsx`

## L.1 Cabecera

```tsx
<div className="lbl-sm">PROVISIONES Y PRÓXIMOS PAGOS</div>
```

## L.2 Bloque superior

```tsx
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
  <div>
    <div style={{ fontFamily: 'Oswald', fontSize: 24, fontWeight: 600 }}>
      {fmtEur(totalGuardar, { showEuro: false })}
    </div>
    <div style={{ fontSize: 11, color: '#7a8090' }}>Total</div>
  </div>
</div>
```

ELIMINAR el badge "187 € + 178 €" actual de la derecha.

ANTES: "a guardar este mes"
DESPUÉS: "Total"

## L.3 Lista pagos próximos (datos reales)

```tsx
<div style={{ marginTop: 14, fontSize: 12, color: '#3a4050', display: 'flex', flexDirection: 'column', gap: 6 }}>
  {pagosProximos.length === 0 ? (
    <div style={{ color: '#7a8090', fontStyle: 'italic' }}>Datos insuficientes</div>
  ) : pagosProximos.map(p => (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: '#7a8090' }}>{p.concepto} ({fmtFecha(p.fecha)})</span>
      <span>{fmtEur(p.importe, { showEuro: false })}</span>
    </div>
  ))}
</div>
```

Lee `pagosProximos` desde:
```ts
const pagosProximos = await supabase
  .from('gastos_fijos')
  .select('concepto, proxima_fecha_pago as fecha, importe')
  .gte('proxima_fecha_pago', hoy)
  .lte('proxima_fecha_pago', hoy + 30)
  .order('proxima_fecha_pago', { ascending: true })
  .limit(6);
```

Categorías reales:
- IRPF alquiler
- IRPF empleado
- Cuota Régimen General SS
- Resto gastos fijos del mes

Si tabla `gastos_fijos` vacía: mostrar "Datos insuficientes".

PROHIBIDO inventar las categorías "IVA 1T (20 abr)", "Nóminas (30 abr)" etc. si no están en BD.

## L.4 Sin €

USAR `fmtEur` con `showEuro: false` en todas las cifras de la card.

---

# BLOQUE M — ELIMINACIÓN

## M.1 Card "PENDIENTES DE SUBIR"

Borrar archivo `/src/components/panel/CardPendientesSubir.tsx` (si existe como archivo).

En `/src/pages/Panel.tsx` o donde se renderice el tab Resumen:
- ELIMINAR completamente el bloque que renderiza `<CardPendientesSubir />` 
- Ajustar el grid de la fila 4 que tenía 3 cols (Provisiones / Pendientes / Top Ventas) a 2 cols (Provisiones / Top Ventas)

```tsx
// ANTES:
<div className="row3">
  <CardProvisiones />
  <CardPendientesSubir />   // ELIMINAR
  <CardTopVentas />
</div>

// DESPUÉS:
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
  <CardProvisiones />
  <CardTopVentas />
</div>
```

---

# BLOQUE N — MÓDULO PAGOS Y COBROS (PLACEHOLDER)

## N.1 Crear archivo

`/src/pages/PagosCobros.tsx`:

```tsx
export default function PagosCobros() {
  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ fontFamily: 'Oswald', fontSize: 22, fontWeight: 600, color: '#B01D23', letterSpacing: 3, textTransform: 'uppercase' }}>
        Pagos y Cobros
      </div>
      <div style={{ fontSize: 13, color: '#7a8090', marginTop: 2 }}>
        Gestión detallada de cobros pendientes plataformas y pagos a proveedores
      </div>
      
      <div style={{ marginTop: 40, padding: 40, background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, textAlign: 'center', color: '#7a8090' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🚧</div>
        <div style={{ fontFamily: 'Lexend', fontSize: 14, fontWeight: 500, color: '#3a4050' }}>
          Módulo en construcción
        </div>
        <div style={{ fontSize: 12, marginTop: 6 }}>
          Próximamente: cobros pendientes detallados, pagos variables y proyecciones reales
        </div>
      </div>
    </div>
  );
}
```

## N.2 Añadir al sidebar

En `/src/components/layout/Sidebar.tsx`, dentro de la sección Finanzas, añadir item ANTES de "Importador":

```tsx
{
  ruta: '/finanzas/pagos-cobros',
  icono: <BanknoteArrowDown size={16} />,  // o icono apropiado de Lucide
  label: 'Pagos y Cobros',
}
```

## N.3 Añadir ruta

En `/src/App.tsx` o router:

```tsx
<Route path="/finanzas/pagos-cobros" element={<PagosCobros />} />
```

---

# BLOQUE O — VALIDACIÓN PE EXISTENTE

## O.1 NO tocar tab PE

El tab Punto de Equilibrio en el módulo PE ya existe. NO tocar nada de ese módulo en este spec.

Si Code detecta inconsistencia entre la card PE del Panel (Bloque K) y el módulo PE: usar la fórmula del Bloque K como autoridad. La card del Panel es resumen.

---

# CRITERIOS DE ACEPTACIÓN

1. Build OK
2. TODAS las cifras del ERP usan `fmtEur` o `fmtPct`
3. NO hay valores hardcoded en componentes (todo viene de Supabase)
4. Si una tabla está vacía: muestra "Datos insuficientes"
5. Mobile validado en 375 / 768 / 1280 con capturas
6. Banner amarillo más estrecho (8px padding vertical)
7. Marco tabs casi sin marco (6px 8px padding)
8. Dropdowns con ChevronDown 11px en lugar de ▾
9. Card Facturación renombrada (de Ventas)
10. Card Resultado renombrada (de Resultado periodo)
11. Card Pendientes ELIMINADA del Panel
12. Card Glovo con borde 1px visible
13. Card Días Pico con línea media
14. Card Saldo SIN barra Hoy→30d
15. Card Ratio con desviación bajo coeficiente, no en bloque inferior
16. Card PE sin "9.610 € netos", sin "bruto", sin "/" en "Facturación día"
17. Módulo PagosCobros creado y accesible desde sidebar
18. NO hay errores TypeScript
19. NO hay errores en consola navegador
20. NO Vercel hasta orden Rubén

---

# DECISIONES AUTÓNOMAS PERMITIDAS

Code puede decidir AUTÓNOMAMENTE:
1. Nombres de archivos/componentes nuevos
2. Estructura interna de archivos (orden funciones, imports)
3. Iconos Lucide React equivalentes si el especificado no existe
4. Resolución conflictos imports (alias vs paths relativos)

Code DEBE preguntar SI:
1. Una tabla Supabase referenciada en el spec NO existe → para y avisa
2. Encuentra ambigüedad entre dos rutas de archivo posibles → para y avisa
3. Un valor literal del spec parece incorrecto (ej. typo en hex) → para y avisa
4. Hay conflicto entre dos bloques del spec → para y avisa

PROHIBIDO improvisar:
1. Tamaños/colores/paddings fuera del spec
2. Renombrar más allá de lo especificado
3. Eliminar elementos no marcados como ELIMINAR
4. Inventar fórmulas de cálculo si no están en el spec

---

# ORDEN DE EJECUCIÓN

EN ORDEN, SIN PARAR:

1. BLOQUE A (helpers + reglas globales) → commit
2. BLOQUE B (header + nav) → commit
3. BLOQUE C (Card Facturación) → commit
4. BLOQUE D (Card Pedidos·TM) → commit
5. BLOQUE E (Card Resultado) → commit
6. BLOQUE F (Cards Plataformas) → commit
7. BLOQUE G (Grupos de gasto) → commit
8. BLOQUE H (Días Pico) → commit
9. BLOQUE I (Saldo+Proyección) → commit
10. BLOQUE J (Ratio I/G) → commit
11. BLOQUE K (Punto Equilibrio) → commit
12. BLOQUE L (Provisiones) → commit
13. BLOQUE M (Eliminación Pendientes) → commit
14. BLOQUE N (Módulo Pagos y Cobros) → commit
15. BLOQUE O (validación PE) → no acción
16. Mobile validation completa → capturas en `.claude/tracking/mobile-validation/`
17. Cierre final commit + push master sin Vercel + informe `.claude/tracking/informe-fixes-panel.md`

NO PARAR ENTRE BLOQUES. NO PREGUNTAR. AVANZAR.

Si una tabla Supabase falta: documentar en `summary.md` y continuar con "Datos insuficientes" como fallback.
