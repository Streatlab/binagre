# PROMPT CLAUDE CODE — 127 FIXES PANEL RESUMEN

> Lee este archivo completo antes de tocar código. Implementa cada bloque en orden. Si un fix ya está implementado correctamente, omítelo y continúa.

---

## CONTEXTO

- Repo: Streatlab/binagre · rama master
- Path local: C:\streatlab-erp
- Stack: React + TypeScript + Supabase + Tailwind v4 + Vite
- Archivos principales: `src/components/panel/resumen/*`, `src/lib/format.ts`, `src/components/Sidebar.tsx`, `src/App.tsx`
- Tokens canónicos: rojo `#B01D23`, negro `#0a0a0a`, sidebar `#1e2233`, panel `#e8f442`, modal `#484f66`
- Aislamiento absoluto Binagre ↔ David: nunca tocar Supabase David (`idclhnxttdbwayxeowrm`)

---

## BLOQUE A — GENERALES (fixes 1-5)

### Fix 1 — Mobile-friendly breakpoints 375/768/1280
En todos los componentes `src/components/panel/resumen/*` y `src/pages/PanelGlobal.tsx`:
- Clases Tailwind responsive: `sm:` (768px), `xs:` (375px via config), `lg:` (1280px)
- En `TabResumen.tsx`: grid de cards superior `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Fila media (ColFacturacionCanal / ColGruposGasto / ColDiasPico): `grid-cols-1 lg:grid-cols-3`
- Fila inferior (CardSaldo / CardRatio / CardTopVentas): `grid-cols-1 sm:grid-cols-3`
- En `tailwind.config.ts` añadir breakpoint xs: `screens: { xs: '375px' }`

### Fix 2 — Helpers fmtEur/fmtPct/fmtNum globales
En `src/lib/format.ts` asegura que existen y exporta:
```typescript
export const fmtNum = (n: number | null | undefined, decimals = 2): string => {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

export const fmtEur = (n: number | null | undefined, decimals = 2): string => {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + ' €';
};

export const fmtPct = (n: number | null | undefined, decimals = 2): string => {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + '%';
};

export const fmtSemana = (fechaInicio: string, fechaFin: string, num: number): string => {
  const pad = (d: string) => d.slice(5).replace('-', '/');
  return `S${num}_${pad(fechaInicio)}_${pad(fechaFin).slice(-5).replace('-','/')}`;
};

export const fmtMes = (fecha: string): string => {
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return meses[new Date(fecha).getMonth()];
};

export const colorSemaforo = (pct: number, objetivo: number): string => {
  if (pct >= objetivo) return '#1D9E75';
  if (pct >= objetivo * 0.5) return '#e8f442';
  return '#B01D23';
};
```
Sustituye en TODOS los archivos de `src/components/panel/resumen/` cualquier uso de `toFixed`, `toLocaleString` directo, o formato manual por estas funciones importadas de `@/lib/format`.

### Fix 3 — BarraCumplimiento componente compartido
Crea `src/components/ui/BarraCumplimiento.tsx`:
```typescript
import React from 'react';
interface Props { pct: number; objetivo: number; height?: number; }
export const BarraCumplimiento: React.FC<Props> = ({ pct, objetivo, height = 6 }) => {
  const color = pct >= objetivo ? '#1D9E75' : pct >= objetivo * 0.5 ? '#e8f442' : '#B01D23';
  const width = Math.min(Math.max(pct, 0), 150);
  return (
    <div style={{ background: '#2a2a2a', borderRadius: 4, height, overflow: 'hidden', width: '100%' }}>
      <div style={{ width: `${Math.min(width, 100)}%`, background: color, height: '100%', borderRadius: 4, transition: 'width 0.3s' }} />
    </div>
  );
};
```

### Fix 4 — colorSemaforo helper
Ya incluido en fix 2 dentro de format.ts.

### Fix 5 — Datos reales o "Datos insuficientes"
En cada card, cuando el valor venga de Supabase y sea `null`/`undefined`/`NaN`, mostrar `<span style={{color:'#888',fontSize:12}}>Datos insuficientes</span>` en lugar de `0`, `—` inventado, o cifra hardcoded.

---

## BLOQUE B — HEADER (fixes 6-9)

### Fix 6 — Banner amarillo
En `src/pages/PanelGlobal.tsx` o donde esté el banner superior:
```typescript
style={{ padding: '6px 14px', fontSize: 12, background: '#e8f442', color: '#0a0a0a' }}
```

### Fix 7 — Marco tabs
En `TabResumen.tsx` o `PanelGlobal.tsx`, el contenedor de tabs:
```typescript
// TABS_PILL.container:
style={{ padding: '4px 6px', borderRadius: 10, gap: 4, display: 'flex', background: '#1a1a1a' }}
// Tab activa: background '#B01D23', color '#fff'
// Tab inactiva: background 'transparent', color '#888'
```

### Fix 8 — ChevronDown uniforme
En TODOS los dropdowns del Panel (marcas, periodo, año):
```typescript
import { ChevronDown } from 'lucide-react';
<ChevronDown size={11} strokeWidth={2.5} />
```

### Fix 9 — Dropdown Marcas items
```typescript
// Cada item del dropdown marcas:
style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}
```

---

## BLOQUE C — CARD FACTURACIÓN (fixes 10-19)

En `CardVentas.tsx`:

### Fix 10 — Renombrar a FACTURACIÓN
```typescript
<span style={{fontSize:10,letterSpacing:2,fontWeight:700}}>FACTURACIÓN</span>
```

### Fix 11-12 — Bruto y Neto mismo tamaño 38px, colores
```typescript
<span style={{fontSize:38,fontWeight:800,color:'#111111',lineHeight:1}}>{fmtNum(bruto)}</span>
<span style={{fontSize:38,fontWeight:800,color:'#1D9E75',lineHeight:1}}>{fmtNum(neto)}</span>
```

### Fix 13 — Sin símbolo €
Las cifras Bruto y Neto NO llevan €. Usar `fmtNum`, no `fmtEur`.

### Fix 14 — Decimales 2
Cubierto por `fmtNum` con decimals=2 por defecto.

### Fix 15 — Etiqueta semanal
```typescript
const etiquetaSemana = fmtSemana(fechaInicio, fechaFin, numSemana);
```

### Fix 16 — Etiqueta mensual capitalizada
```typescript
const etiquetaMes = fmtMes(fechaActual); // "Abril"
```

### Fix 17 — Etiqueta anual solo año
```typescript
const etiquetaAnual = new Date(fechaActual).getFullYear().toString(); // "2026"
```

### Fix 18-19 — Cantidades objetivo editables desde tabla objetivos
```typescript
// Leer de Supabase tabla `objetivos` filtrando por periodo y tipo
// EditableInline con fmtNum, al guardar hacer upsert en `objetivos`
```

---

## BLOQUE D — CARD PEDIDOS·TM (fixes 20-27)

En `CardPedidosTM.tsx`:

### Fix 20 — 3 cifras mismo tamaño 38px
```typescript
// Pedidos, TM Bruto, TM Neto: fontSize 38, fontWeight 800, lineHeight 1
```

### Fix 21-23 — Colores
```typescript
const colorPedidos = '#1E5BCC';
const colorTMBruto = '#F26B1F';
const colorTMNeto  = '#1D9E75';
```

### Fix 24 — TM con € y 2 decimales
```typescript
<span style={{color:colorTMBruto}}>{fmtEur(tmBruto)}</span>
<span style={{color:colorTMNeto}}>{fmtEur(tmNeto)}</span>
```

### Fix 25 — Web/Directa "0" no "—"
```typescript
const val = data?.web ?? 0;
<span>{fmtNum(val)}</span>
```

### Fix 26 — Just Eat barra naranja
```typescript
const colorCanal = (canal: string) => {
  if (/just.?eat/i.test(canal)) return '#f5a623';
  if (/glovo/i.test(canal)) return '#00A082';
  if (/uber/i.test(canal)) return '#06C167';
  return '#888';
};
```

### Fix 27 — Prohibido "Ticket Medio"
Reemplaza cualquier texto "Ticket Medio" por "TM".

---

## BLOQUE E — CARD RESULTADO (fixes 28-37)

En `CardResultadoPeriodo.tsx`:

### Fix 28 — Renombrar a RESULTADO
```typescript
<span style={{fontSize:10,letterSpacing:2,fontWeight:700}}>RESULTADO</span>
```

### Fix 29 — EBITDA con € grande
```typescript
<span style={{fontSize:38,fontWeight:800,color:'#e8f442'}}>
  {ebitda != null ? fmtEur(ebitda) : <span style={{fontSize:13,color:'#888'}}>Datos insuficientes</span>}
</span>
```

### Fix 30 — Resto cascada sin €
Las 8 líneas restantes de la cascada PyG usan `fmtNum`, no `fmtEur`.

### Fix 31 — Texto puntos porcentuales
```typescript
`${fmtNum(Math.abs(delta), 1)} puntos porcentuales vs anterior`
```

### Fix 32 — Cascada PyG 9 líneas
```typescript
const cascada = [
  { label: 'Ventas brutas',        valor: bruto },
  { label: 'Comisiones + IVA',     valor: -comisiones },
  { label: 'Ventas netas',         valor: neto },
  { label: 'Coste producto',       valor: -costeProducto },
  { label: 'Margen bruto',         valor: margenBruto },
  { label: 'Personal',             valor: -personal },
  { label: 'Local + Controlables', valor: -localControlables },
  { label: 'Provisiones',          valor: -provisiones },
  { label: 'Resultado limpio',     valor: resultado },
];
```

### Fix 33-34 — Tooltips + Prime Cost
Añadir `title="..."` en cada fila. Prime Cost: `title="Coste producto + Personal sobre ventas netas"`.

### Fix 35 — Eliminar "Banda sector 55-65%"
Borrar cualquier texto con "Banda" y rango porcentual hardcoded.

### Fix 36 — "Objetivo X%" editable verde
```typescript
<EditableInline
  value={objetivoPrimeCost}
  onSave={(v) => guardarObjetivo('prime_cost', v)}
  style={{color:'#1D9E75', fontWeight:600}}
  suffix="%"
/>
```

### Fix 37 — Barra Prime Cost
```typescript
<BarraCumplimiento pct={primeCostReal} objetivo={objetivoPrimeCost} />
```

---

## BLOQUE F — CARDS PLATAFORMAS (fixes 38-42)

En `ColFacturacionCanal.tsx`:

### Fix 38 — Bruto y Neto 24px
```typescript
style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}
```

### Fix 39 — Glovo border
```typescript
style={{ border: '1px solid #5a5500', boxShadow: '0 0 0 1px #5a5500' }}
```

### Fix 40 — Margen con 2 decimales
```typescript
`Margen ${fmtNum(margen)}%`
```

### Fix 41 — "Bruto" con B mayúscula
```typescript
<span>Bruto</span>
```

### Fix 42 — Cálculo neto canal real
```typescript
// Leer tabla `resumenes_plataforma_marca_mensual` filtrando por plataforma, mes, año
// neto = bruto - comisiones
```

---

## BLOQUE G — GRUPOS DE GASTO (fixes 43-55)

En `ColGruposGasto.tsx`:

### Fix 43
```typescript
const GRUPOS = ['Producto', 'Equipo', 'Local', 'Controlables'];
```

### Fix 44
```typescript
{grupo === 'Producto' && <span style={{fontSize:11,color:'#1D9E75'}}>Food Cost {fmtPct(pct)}</span>}
```

### Fix 45
Eliminar "% s/netos" para grupos distintos de Producto.

### Fix 46-48
```typescript
// Consumido y presupuesto: fmtEur(valor)
// Desviación: fmtNum(desv) — sin €
```

### Fix 49
Borrar texto "Banda XX-XX%".

### Fix 50
```typescript
<EditableInline value={objetivo} onSave={v => guardarObjetivoGrupo(grupo, v)} suffix="%" style={{color:'#1D9E75'}} />
```

### Fix 51
```typescript
<BarraCumplimiento pct={pctReal} objetivo={pctObjetivo} />
```

### Fix 52
```typescript
style={{ color: colorSemaforo(pctReal, pctObjetivo) }}
```

### Fix 53
```typescript
const pct = presupuesto > 0 ? (consumido / presupuesto) * 100 : 0;
```

### Fix 54
```typescript
const presupuesto = netosDelPeriodo * (pctObjetivo / 100);
```

### Fix 55
```typescript
// Leer tabla `running` para consumido real por grupo y periodo
```

---

## BLOQUE H — DÍAS PICO (fixes 56-61)

En `ColDiasPico.tsx`:

### Fix 56
```typescript
`DÍAS PICO — ${fmtMes(fechaActual).toUpperCase()} — Facturación Bruta`
```

### Fix 57
```typescript
<ReferenceLine y={media} stroke="#888" strokeDasharray="4 2" />
```

### Fix 58
```typescript
const CustomLabel = ({ x, y, width, value }: any) => (
  <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={11} fill="#ccc">
    {fmtNum(value)}
  </text>
);
```

### Fix 59
Usar `fmtNum(valor)` en todos los valores del gráfico.

### Fix 60
Borrar cualquier texto "RESUMEN".

### Fix 61
```typescript
// "Día más débil" → "Día más flojo"
```

---

## BLOQUE I — PROYECCIONES (fixes 62-67)

En `CardSaldo.tsx`:

### Fix 62
```typescript
<span style={{fontSize:10,letterSpacing:2,fontWeight:700}}>PROYECCIONES</span>
```

### Fix 63
```typescript
// Leer tabla `cuentas_bancarias` sumando saldos
```

### Fix 64
Borrar bloque visual de barra Hoy→30d.

### Fix 65
```typescript
// Cobros próximos 7d/30d desde `resumenes_plataforma_marca_mensual` según ciclos plataforma
```

### Fix 66
```typescript
// Pagos 7d/30d desde `gastos_fijos` filtrando fecha_vencimiento
```

### Fix 67
Usar `fmtNum` en cobros y pagos proyectados.

---

## BLOQUE J — RATIO (fixes 68-75)

En `CardRatio.tsx`:

### Fix 68
```typescript
title="Euros que entran por cada euro de gasto"
```

### Fix 69
```typescript
<span style={{color:'#1D9E75',fontWeight:600}}>Objetivo</span>
```

### Fix 70
```typescript
<span style={{fontSize:38,fontWeight:800,color:colorSemaforo(ratio*100, objetivoRatio*100)}}>
  {fmtNum(ratio)}
</span>
```

### Fix 71
```typescript
<span style={{fontSize:11,color:'#888'}}>{fmtNum(desviacion, 2)} vs objetivo</span>
<BarraCumplimiento pct={ratio * 100} objetivo={objetivoRatio * 100} />
```

### Fix 72
Borrar bloque "Distancia al objetivo".

### Fix 73
```typescript
const lineas = [
  { label: 'Ingresos netos', valor: ingresosNetos },
  { label: 'Gastos fijos',   valor: gastosFijos },
  { label: 'Gastos reales',  valor: gastosReales },
];
```

### Fix 74
```typescript
const ratio = (gastosFijos + gastosVariables) > 0
  ? ingresosNetos / (gastosFijos + gastosVariables)
  : null;
```

### Fix 75
```typescript
// Leer `running` para gastosVariables del periodo
```

---

## BLOQUE K — PUNTO EQUILIBRIO (fixes 76-85)

En `CardPE.tsx`:

### Fix 76
```typescript
title="Ventas brutas mínimas para cubrir todos los costes fijos del mes"
```

### Fix 77
```typescript
<span>Bruto necesario</span>
```

### Fix 78
Borrar texto "9.610 € netos".

### Fix 79
```typescript
{fmtPct(pctAlcanzado)}
```

### Fix 80
```typescript
// PE = gastos_fijos_mes / margen_contribucion_pct
```

### Fix 81
```typescript
const hoy = new Date().getDate();
const diasMes = new Date(anio, mes, 0).getDate();
const ritmo = ventasBrutas / hoy;
const diasFaltantes = Math.ceil((peObjetivo - ventasBrutas) / ritmo);
const diaVerde = hoy + diasFaltantes;
const texto = diaVerde <= hoy
  ? `Día ${hoy} · ✓ alcanzado`
  : diaVerde <= diasMes
    ? `Día ${diaVerde}`
    : `+${diaVerde - diasMes}d sobre mes`;
```

### Fix 82
```typescript
<span style={{color:'#1E5BCC'}}>{fmtNum(pedidosDia, 0)} ped/día</span>
{' · '}
<span style={{color:'#F26B1F'}}>{fmtEur(tmDia)}</span>
```

### Fix 83-85
```typescript
<span style={{fontSize:10,letterSpacing:1}}>REALIDAD HOY</span>
// TM: fmtEur(tm) siempre 2 decimales
// Tooltip: title="Ventas y pedidos acumulados hasta hoy"
```

---

## BLOQUE L — PROVISIONES (fixes 86-94)

En `CardProvisiones.tsx`:

### Fix 86
```typescript
<span>PROVISIONES Y PRÓXIMOS PAGOS</span>
```

### Fix 87
```typescript
<span>Total</span>
```

### Fix 88
Borrar badge con importes hardcoded.

### Fix 89
```typescript
// Leer `gastos_fijos` WHERE fecha_vencimiento BETWEEN now() AND now() + interval '30 days'
```

### Fix 90
```typescript
const CATEGORIAS = ['IRPF alquiler', 'IRPF empleado', 'Cuota SS'];
```

### Fix 91-92
```typescript
// Importes con fmtNum — sin €
```

### Fix 93
En `TabResumen.tsx` fila inferior: `gridTemplateColumns: '1fr 1fr 1fr'`.

### Fix 94
```typescript
{!datos?.length && <span style={{color:'#888',fontSize:11}}>Sin provisiones registradas</span>}
```

---

## BLOQUE M — ELIMINACIÓN (fix 95)

### Fix 95
En `TabResumen.tsx`: eliminar `<CardPendientesSubir />` y su import. NO borrar el archivo.

---

## BLOQUE N — PAGOS Y COBROS (fixes 96-98)

### Fix 96-97 — Sidebar
En `src/components/Sidebar.tsx`, grupo Finanzas, antes del Importador:
```typescript
{ label: 'Pagos y Cobros', path: '/finanzas/pagos-cobros', icon: ArrowLeftRight }
```

### Fix 98 — App.tsx
```typescript
import PagosCobros from './pages/PagosCobros';
// router:
{ path: '/finanzas/pagos-cobros', element: <PagosCobros /> }
```

---

## BLOQUE O (fix 99)

### Fix 99
Tab PE del módulo `/finanzas/pe` NO tocar. Solo modificar `CardPE.tsx` del Panel Resumen.

---

## BLOQUE P — COMPONENTES COMPARTIDOS (fixes 100-103)

### Fix 100-101
Verificar `format.ts` y `BarraCumplimiento.tsx` según fixes 2 y 3.

### Fix 102 — EditableInline
Verificar/crear `src/components/ui/EditableInline.tsx`:
```typescript
import React, { useState } from 'react';
import { fmtNum } from '@/lib/format';
interface Props { value: number; onSave: (v: number) => void; suffix?: string; style?: React.CSSProperties; }
export const EditableInline: React.FC<Props> = ({ value, onSave, suffix = '', style }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value.toString());
  if (editing) return (
    <input autoFocus value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { onSave(parseFloat(draft.replace(',', '.')) || 0); setEditing(false); }}
      onKeyDown={e => { if (e.key === 'Enter') { onSave(parseFloat(draft.replace(',', '.')) || 0); setEditing(false); } }}
      style={{ width: 60, fontSize: 'inherit', background: 'transparent', border: 'none', borderBottom: '1px solid #e8f442', color: 'inherit', textAlign: 'right', ...style }}
    />
  );
  return (
    <span onClick={() => { setDraft(String(value)); setEditing(true); }} style={{ cursor: 'pointer', ...style }}>
      {fmtNum(value)}{suffix}
    </span>
  );
};
```

### Fix 103 — Toast sonner
Verificar que `sonner` está instalado y `<Toaster />` presente en `src/App.tsx`.

---

## BLOQUE Q — TABLAS SUPABASE (fixes 104-110)

Ejecutar en Supabase SQL Editor con `CREATE TABLE IF NOT EXISTS`:

```sql
-- Fix 105
CREATE TABLE IF NOT EXISTS objetivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL, periodo text NOT NULL, valor numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Fix 106
CREATE TABLE IF NOT EXISTS kpi_objetivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi text NOT NULL, mes int NOT NULL, anio int NOT NULL, valor numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Fix 107
CREATE TABLE IF NOT EXISTS running (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL, grupo text NOT NULL, concepto text, importe numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Fix 108
CREATE TABLE IF NOT EXISTS gastos_fijos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concepto text NOT NULL, importe numeric NOT NULL,
  fecha_vencimiento date, categoria text, activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Fix 109
CREATE TABLE IF NOT EXISTS cuentas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titular text NOT NULL, entidad text, saldo numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Fix 110
CREATE TABLE IF NOT EXISTS resumenes_plataforma_marca_mensual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma text NOT NULL, marca text, mes int NOT NULL, anio int NOT NULL,
  bruto numeric DEFAULT 0, neto numeric DEFAULT 0,
  comisiones numeric DEFAULT 0, pedidos int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

---

## BLOQUE R — VISUALES Y CIERRE (fixes 111-127)

### Fix 112
En `CardTopVentas.tsx`: eliminar badge "datos demo".

### Fix 113
En `TabResumen.tsx` fila inferior:
```typescript
style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}
```

### Fix 114-116
Verificar con DevTools en 375px, 768px, 1280px sin overflow.

### Fix 117
```bash
npx tsc --noEmit
# Corregir TODOS los errores antes de deploy
```

### Fix 118
Revisar consola en producción y eliminar warnings/errors.

### Fix 122
```bash
grep -r "idclhnxttdbwayxeowrm\|16355C\|F26B1F" src/
# No debe aparecer ningún resultado
```

### Fix 123-124
```typescript
const [periodo, setPeriodo] = useState<'semana'|'mes'|'anio'>('mes');
const [mes, setMes] = useState(4);
const [anio, setAnio] = useState(2026);
```

### Fix 125
```typescript
{ebitda != null
  ? <span style={{fontSize:38,fontWeight:800}}>{fmtEur(ebitda)}</span>
  : <span style={{fontSize:13,color:'#888'}}>Datos insuficientes</span>}
```

### Fix 126
```bash
grep -r "9610\|9\.610\|8916\|22026\|16535\|5491" src/components/panel/resumen/
# Sustituir cada hit por lectura real de Supabase
```

### Fix 127 — Deploy final
```bash
git add . && git commit -m "feat(panel): 127 fixes panel resumen completo" && git push origin master && npx vercel --prod && git pull origin master
```

Entregar informe final:
- URL deploy Vercel
- Fixes implementados vs omitidos (ya estaban)
- Errores TS resueltos
- Archivos modificados
