# SPEC FIXES RONDA 5 — Panel Resumen — 12 fixes literales

> Tras Vercel ronda 4, 12 fallos siguen vivos.
> Code ejecuta uno tras otro SIN PARAR ni preguntar.
> Si falla, marca ❌ con motivo y CONTINÚA.

## Reglas

1. Modelo: `claude-sonnet-4-7` general
2. Pipeline: pm-spec → architect-review → implementer → qa-reviewer → erp-reviewer
3. Modo: localhost + Vercel SIEMPRE al cierre con URL
4. Aislamiento absoluto Binagre vs David
5. **Conciliación NO se toca bajo ninguna circunstancia**
6. **Code NO pregunta nada. Decide y avanza.**

## Helpers verificados OK
- `/src/lib/format.ts` está correctamente implementado con `toLocaleString('es-ES')`
- `/src/components/ui/BarraCumplimiento.tsx` OK
- `/src/components/ui/EditableInline.tsx` OK

**Causa raíz fallos:** componentes NO están usando los helpers en muchos sitios. Renderizan números con concat manual o `.toFixed(2)`.

---

# FIX 1 · Auditoría exhaustiva separador miles

Ejecutar grep recursivo en `/src/components/panel/resumen/`:

```bash
grep -rn "toFixed\|\.toString()\|\${.*\\.[a-zA-Z]" src/components/panel/resumen/ | grep -v "fmtNum\|fmtEur\|fmtPct"
```

Cada ocurrencia que renderice un número debe sustituirse por:
- `fmtNum(n, 2)` para números puros
- `fmtEur(n, { showEuro: true/false, decimals: 2 })` para euros
- `fmtPct(n, 2)` para porcentajes

ZONAS CONFIRMADAS DONDE FALTA SEPARADOR DE MILES:
- `CardVentas.tsx`: cifra Bruto "9817,84" debe ser "9.817,84"
- `CardVentas.tsx`: cifra Neto "6396,64" debe ser "6.396,64"
- `CardVentas.tsx`: input editable "5000,00" debe ser "5.000,00"
- `CardVentas.tsx`: "Faltan 4098,33" debe ser "Faltan 4.098,33"
- `CardPE.tsx`: "Llevamos 9817,84" debe ser "Llevamos 9.817,84"
- `CardRatio.tsx`: "Gastos fijos 4553,00" debe ser "Gastos fijos 4.553,00"
- `ColDiasPico.tsx`: valores barras "1111,49 / 1317,81 / 1368,44 / 1705,01 / 1327,35 / 2168,41" → con puntos miles
- `ColDiasPico.tsx`: "Media: 1402,55" → "1.402,55"
- `ColDiasPico.tsx`: "Domingo · 2168,41" → "2.168,41"
- `ColDiasPico.tsx`: "Media diaria 1402,55" → "1.402,55"

Verificar tras cambio: NINGÚN número del Panel sin separador de miles cuando supera 999.

---

# FIX 2 · EditableInline render con fmtNum

Archivo: `/src/components/ui/EditableInline.tsx`

Verificar que el render del valor cuando NO está editing usa `fmtNum(valor, decimales)` desde `/src/lib/format.ts`:

```tsx
import { fmtNum } from '@/lib/format';

return (
  <span onClick={() => setEditing(true)} style={{...}}>
    {valor !== null && valor !== undefined ? fmtNum(valor, decimales) : '—'}{unidad ? ` ${unidad}` : ''}
  </span>
);
```

Si actualmente usa `valor.toLocaleString` directo, sustituir por `fmtNum`.

---

# FIX 3 · Card Glovo border 1px solid #5a5500 visible

Archivo: `/src/components/panel/resumen/ColFacturacionCanal.tsx`

El border NO se renderiza visible. Aplicar inline + boxShadow para garantizar:

```tsx
<div
  style={{
    background: '#e8f44230',
    border: canal === 'glovo' ? '1px solid #5a5500' : '0.5px solid #d0c8bc',
    boxShadow: canal === 'glovo' ? 'inset 0 0 0 1px #5a5500' : undefined,
    borderRadius: 14,
    padding: '14px 16px',
    // ...resto
  }}
>
```

Verificar visualmente en localhost que Glovo tiene border oscuro visible.

---

# FIX 4 · Just Eat barra naranja

Archivo: `/src/components/panel/resumen/CardPedidosTM.tsx`

La barra mini de Just Eat sale amarillo claro, debería ser naranja `#f5a623`.

Normalizar la clave del canal antes de buscar color:

```tsx
const colorCanal = (canal: string): string => {
  const norm = canal.toLowerCase().replace(/[\s-]/g, '_');
  return ({
    uber_eats: '#06C167',
    uber: '#06C167',
    glovo: '#e8f442',
    just_eat: '#f5a623',
    justeat: '#f5a623',
    web: '#B01D23',
    directa: '#66aaff',
    direct: '#66aaff',
  } as Record<string, string>)[norm] ?? '#7a8090';
};
```

Aplicar `background: colorCanal(c.canal)` en la barra mini.

---

# FIX 5 · Web/Directa color cuando 0 pedidos

Archivo: `/src/components/panel/resumen/CardPedidosTM.tsx`

Cuando Web o Directa tienen 0 pedidos, las cifras deben mantener su color de canal:
- Pedidos en `#1E5BCC` (azul)
- TM Bruto en `#F26B1F` (naranja)
- TM Neto en `#1D9E75` (verde)

Render literal forzado SIN condicional por valor 0:

```tsx
<span>
  <b style={{ color: '#1E5BCC' }}>{fmtNum(c.pedidos, 0)}</b>
  {' · '}
  <span style={{ color: '#F26B1F' }}>{fmtEur(c.tmBruto, { showEuro: true, decimals: 2 })}</span>
  {' / '}
  <span style={{ color: '#1D9E75' }}>{fmtEur(c.tmNeto, { showEuro: true, decimals: 2 })}</span>
</span>
```

NO mutar opacity, NO mutar color a gris cuando valores son 0.

---

# FIX 6 · Card Ratio palabra "Objetivo" en verde

Archivo: `/src/components/panel/resumen/CardRatio.tsx`

La palabra "Objetivo" arriba derecha sigue en gris. Forzar verde:

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
  <span style={{ color: '#1D9E75', fontSize: 11 }}>Objetivo</span>
  <EditableInline
    valor={ratioTarget}
    tabla="kpi_objetivos"
    campo="ratio_target"
    decimales={2}
    color="#1D9E75"
  />
</div>
```

---

# FIX 7 · Card Resultado palabra "Objetivo" Prime Cost en verde

Archivo: `/src/components/panel/resumen/CardResultadoPeriodo.tsx`

En bloque Prime Cost, la palabra "Objetivo" debe ir verde `#1D9E75`:

```tsx
<span style={{ color: '#1D9E75' }}>Objetivo</span>
{' '}
<EditableInline
  valor={primeCostTarget}
  tabla="kpi_objetivos"
  campo="prime_cost_target"
  decimales={0}
  unidad="%"
  color="#1D9E75"
/>
```

---

# FIX 8 · Layout fila inferior — Top Ventas centro

Archivo: `/src/components/panel/resumen/TabResumen.tsx`

Buscar el `<div>` con `gridTemplateColumns: '1fr 2fr'` (Provisiones + Top Ventas).
Sustituir por 3 columnas iguales:

```tsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
  <CardProvisiones />
  <CardTopVentas />
  <div /> {/* tercio derecho vacío */}
</div>
```

Top Ventas en tercio CENTRAL. Provisiones tercio izquierdo. Tercio derecho vacío.

---

# FIX 9 · Eliminar bloque "PROYECCIÓN NETA" Card Saldo

Archivo: `/src/components/panel/resumen/CardSaldo.tsx`

El bloque "PROYECCIÓN NETA · Proyección 7d / Proyección 30d Datos insuficientes" sigue apareciendo. ELIMINAR completamente.

Estructura final esperada:
1. Título "PROYECCIONES"
2. Saldo grande (cifra)
3. "Saldo cuentas Streat Lab"
4. Línea separadora
5. Cobros 7d / Cobros 30d
6. Pagos 7d / Pagos 30d
7. (FIN)

Eliminar TODO lo que sea "PROYECCIÓN NETA" / "Proyección 7d" / "Proyección 30d" / variantes.

---

# FIX 10 · EBITDA grande "Datos insuficientes" cuando vacío

Archivo: `/src/components/panel/resumen/CardResultadoPeriodo.tsx`

Cuando `running` es null o `running.ebitda` es null, la cifra grande EBITDA aparece vacía. Sustituir por texto explícito "Datos insuficientes":

```tsx
{ebitda === null || ebitda === undefined ? (
  <div style={{ fontFamily: 'Oswald', fontSize: 38, fontWeight: 600, color: '#7a8090' }}>
    Datos insuficientes
  </div>
) : (
  <div style={{ fontFamily: 'Oswald', fontSize: 38, fontWeight: 600, color: ebitda >= 0 ? '#1D9E75' : '#E24B4A' }}>
    {fmtEur(ebitda, { showEuro: true, decimals: 2 })}
  </div>
)}
```

Lo mismo para línea "% s/netos · Banda 10-13%" → si ebitda null, ocultar o mostrar "—".

---

# FIX 11 · Marco tabs Panel padding mínimo

Archivo: `/src/components/panel/resumen/tokens.ts`

El token `TABS_PILL.container` actualmente tiene `padding: '14px 18px'` y `borderRadius: 14`. Demasiado grande. Sustituir por:

```ts
container: {
  background: '#ffffff',
  border: '0.5px solid #d0c8bc',
  borderRadius: 10,
  padding: '4px 6px',
  marginBottom: 12,
  display: 'inline-flex',
  gap: 4,
} as CSSProperties,
```

Y los botones interior `active` e `inactive` mantenerlos pero verificar que el `padding` interno no es excesivo:

```ts
active: {
  padding: '5px 12px',
  borderRadius: 5,
  ...
},
inactive: {
  padding: '5px 12px',
  borderRadius: 5,
  ...
}
```

ATENCIÓN: si Conciliación usa el mismo token y se rompe visualmente, NO revertir. Conciliación se está rediseñando en otro chat con su propio criterio. Solo Panel debe verse con marco mínimo.

Si rompe Conciliación visualmente: documentar el efecto en el informe pero NO revertir el cambio.

---

# FIX 12 · Deploy Vercel + Informe

1. Build local OK
2. Commit final + push master
3. Deploy Vercel automático
4. URL del deploy en `.claude/tracking/informe-fixes-panel-ronda5.md` con checklist 12/12

---

# CHECKLIST FINAL

```
FIX 1  · ✅/❌ · {motivo si ❌}
FIX 2  · ✅/❌ · {motivo si ❌}
FIX 3  · ✅/❌ · {motivo si ❌}
FIX 4  · ✅/❌ · {motivo si ❌}
FIX 5  · ✅/❌ · {motivo si ❌}
FIX 6  · ✅/❌ · {motivo si ❌}
FIX 7  · ✅/❌ · {motivo si ❌}
FIX 8  · ✅/❌ · {motivo si ❌}
FIX 9  · ✅/❌ · {motivo si ❌}
FIX 10 · ✅/❌ · {motivo si ❌}
FIX 11 · ✅/❌ · {motivo si ❌}
FIX 12 · ✅/❌ · {motivo si ❌}

TOTAL: X/12 ✅
URL Vercel: https://...
```

PROHIBIDO marcar ✅ sin verificación visual en localhost o Vercel.

---

# RESTRICCIONES

1. NO TOCAR Conciliación
2. NO TOCAR tablas Supabase populadas por otros chats (Conciliación las llenará)
3. NO crear archivos nuevos salvo si el fix lo requiere literalmente
4. NO preguntar a Rubén — decidir autónomamente y avanzar
5. NO truncar números a fixed decimals — usar siempre toLocaleString('es-ES')

---

# ORDEN

FIX 1 → 2 → ... → 12. Tras FIX 12: deploy Vercel + URL final.
NO PARAR. NO PREGUNTAR. Si un fix falla: marcar ❌ con motivo y SEGUIR.
