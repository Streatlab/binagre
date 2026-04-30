# SPEC FIXES RONDA 4 — Panel Resumen — 12 fixes literales

> Tras Vercel ronda 3, audit visual detecta 12 fallos críticos.
> Causa raíz: el helper `fmtNum`/`fmtEur` está bien pero MUCHOS componentes NO lo usan.
> Lista numerada FIX 1 → FIX 12. Ejecutar uno tras otro SIN PARAR.

## Reglas globales

1. Modelo: `claude-sonnet-4-7` general, Haiku triviales, NO Opus
2. Pipeline: pm-spec → architect-review → implementer → qa-reviewer → erp-reviewer
3. Modo: localhost + Vercel SIEMPRE al cierre con URL
4. Aislamiento absoluto Binagre vs David
5. **Conciliación se está editando en otro chat — NO TOCAR**
6. **Code NO pregunta nada. Decide y avanza.**

---

# FIX 1 · Auditoría exhaustiva separador miles

Causa raíz del fallo "9817,84" sin punto: hay componentes que pintan números sin pasar por `fmtNum`/`fmtEur`. Pueden estar usando:
- `valor.toFixed(2)` directo
- `String(valor)` directo
- `${valor.toFixed(2)}` template literal
- Concatenación manual con coma decimal

Acción literal:
1. Ejecutar grep recursivo:
```bash
grep -rn "toFixed\|toString()\|`\${.*}\.\|String(.*)" src/components/panel/resumen/ | grep -v "fmtNum\|fmtEur\|fmtPct"
```
2. Cada ocurrencia debe sustituirse por la helper correspondiente:
   - Cifra euros con €: `fmtEur(n, { showEuro: true, decimals: 2 })`
   - Cifra euros sin €: `fmtEur(n, { showEuro: false, decimals: 2 })`
   - Cifra puro número: `fmtNum(n, 2)`
   - Porcentaje: `fmtPct(n, 2)`
3. Documentar en informe lista de archivos modificados y líneas cambiadas

ZONAS CONFIRMADAS DONDE FALTA FORMATO (mínimo a corregir):

**Card Facturación (`CardVentas.tsx`)**:
- Cifra grande Bruto "9817,84" → debe ser "9.817,84"
- Cifra grande Neto "6396,64" → debe ser "6.396,64"
- Input editable "5000,00" → debe ser "5.000,00"
- "Faltan 4098,33" → debe ser "Faltan 4.098,33"

**Card PE (`CardPE.tsx`)**:
- "Llevamos 9817,84" → debe ser "Llevamos 9.817,84"

**Card Ratio (`CardRatio.tsx`)**:
- "Gastos fijos 4553,00" → debe ser "Gastos fijos 4.553,00"

**Card Días Pico (`ColDiasPico.tsx`)**:
- TODOS los valores encima barras: "1111,49 / 1317,81 / 1368,44 / 1705,01 / 1327,35 / 2168,41" → con puntos miles
- "Media: 1402,55" → "1.402,55"
- "Domingo · 2168,41" → "2.168,41"
- "Media diaria 1402,55" → "1.402,55"

Verificar en localhost que TODAS las cifras del Panel Resumen tienen punto de miles cuando superan 999.

---

# FIX 2 · EditableInline render con fmtNum

Archivo: `/src/components/ui/EditableInline.tsx`

El componente probablemente renderiza `valor.toLocaleString('es-ES', {...})` directamente. Forzar que use `fmtNum(valor, decimales)` desde `/src/lib/format.ts` para garantizar consistencia:

```tsx
import { fmtNum } from '@/lib/format';

// En el return cuando NO está editing:
return (
  <span onClick={() => setEditing(true)} style={{...}}>
    {valor !== null && valor !== undefined ? fmtNum(valor, decimales) : '—'}{unidad ? ` ${unidad}` : ''}
  </span>
);
```

Verificar que el componente importa correctamente `fmtNum`.

---

# FIX 3 · Card Glovo border literal forzado

Archivo: `/src/components/panel/resumen/ColFacturacionCanal.tsx`

El border `1px solid #5a5500` NO se está aplicando. Buscar el JSX donde se renderiza la card Glovo y forzar:

```tsx
<div
  style={{
    background: '#e8f44230',
    border: canal === 'glovo' ? '1px solid #5a5500' : '0.5px solid #d0c8bc',
    borderRadius: 14,
    padding: '14px 16px',
    // ...resto
  }}
>
```

Si el style ya está pero no se renderiza visible, problema es CSS especificidad. Solución: añadir `boxShadow: canal === 'glovo' ? 'inset 0 0 0 1px #5a5500' : undefined` para garantizar visibilidad doble.

---

# FIX 4 · Just Eat barra naranja

Archivo: `/src/components/panel/resumen/CardPedidosTM.tsx`

La barra mini de Just Eat NO se renderiza en `#f5a623`. Causa probable: el mapeo `COLOR_CANAL` no encuentra match con la clave del canal.

Acción literal:
1. Imprimir en consola del componente: `console.log('canal recibido:', c.canal, 'color esperado:', COLOR_CANAL[c.canal])`
2. Si `c.canal` viene como `"Just Eat"` con espacio o `"justeat"` sin guión bajo, normalizar:
```tsx
const colorCanal = (canal: string): string => {
  const normalizado = canal.toLowerCase().replace(/[\s-]/g, '_');
  return {
    uber_eats: '#06C167',
    uber: '#06C167',
    glovo: '#e8f442',
    just_eat: '#f5a623',
    justeat: '#f5a623',
    web: '#B01D23',
    directa: '#66aaff',
    direct: '#66aaff',
  }[normalizado] ?? '#7a8090';
};
```

Aplicar `background: colorCanal(c.canal)` en la barra mini.

---

# FIX 5 · Web/Directa color cuando 0

Archivo: `/src/components/panel/resumen/CardPedidosTM.tsx`

Cuando Web o Directa tienen 0 pedidos, las cifras del desglose deben mantener el color del canal. Buscar lógica que las muta a gris cuando son 0 y eliminarla.

Render literal forzado (NO condicional por valor 0):
```tsx
<span>
  <b style={{ color: '#1E5BCC' }}>{fmtNum(c.pedidos, 0)}</b>
  {' · '}
  <span style={{ color: '#F26B1F' }}>{fmtEur(c.tmBruto, { showEuro: true, decimals: 2 })}</span>
  {' / '}
  <span style={{ color: '#1D9E75' }}>{fmtEur(c.tmNeto, { showEuro: true, decimals: 2 })}</span>
</span>
```

NO aplicar opacity, NO mutar color a `#7a8090` ni a `gray`.

---

# FIX 6 · Card Ratio palabra "Objetivo" verde

Archivo: `/src/components/panel/resumen/CardRatio.tsx`

La palabra "Objetivo" arriba de la card sigue en gris. Forzar verde literal en el `<span>` que envuelve el texto:

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

Verificar que el `<span>` con "Objetivo" tiene literal `color: '#1D9E75'`.

---

# FIX 7 · Card Resultado palabra "Objetivo" verde Prime Cost

Archivo: `/src/components/panel/resumen/CardResultadoPeriodo.tsx`

En el bloque Prime Cost, la palabra "Objetivo" debe ir en color `#1D9E75` (verde). Buscar JSX donde aparece "Objetivo {pct}%" y forzar:

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

# FIX 8 · Layout fila inferior Top Ventas centro

Archivo: `/src/components/panel/resumen/TabResumen.tsx`

Buscar el `<div>` con `gridTemplateColumns: '1fr 2fr'` en la fila 4 (Provisiones + Top Ventas). Sustituir por:

```tsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
  <CardProvisiones />
  <CardTopVentas />
  <div /> {/* tercio derecho vacío */}
</div>
```

Top Ventas ocupa SOLO el tercio central. Tercio izquierdo Provisiones. Tercio derecho vacío.

---

# FIX 9 · Eliminar bloque PROYECCIÓN NETA

Archivo: `/src/components/panel/resumen/CardSaldo.tsx`

El bloque "PROYECCIÓN NETA · Proyección 7d / Proyección 30d Datos insuficientes" sigue apareciendo (visible en captura 3). Localizar el JSX que lo renderiza y ELIMINAR completamente.

Estructura final esperada de la card:
1. Título "PROYECCIONES"
2. Saldo grande (cifra)
3. "Saldo cuentas Streat Lab"
4. Línea separadora
5. Cobros 7d / Cobros 30d
6. Pagos 7d / Pagos 30d
7. (FIN — sin más bloques)

ELIMINAR completamente todo lo que sea "PROYECCIÓN NETA" / "Proyección 7d" / "Proyección 30d".

---

# FIX 10 · EBITDA grande "Datos insuficientes"

Archivo: `/src/components/panel/resumen/CardResultadoPeriodo.tsx`

Cuando `running` es null o vacío, la cifra grande EBITDA aparece vacía (sin texto). Cambiar a mostrar "Datos insuficientes" explícito:

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

Lo mismo para la línea "% s/netos · Banda 10-13%" → si ebitda null, ocultar o mostrar "—".

---

# FIX 11 · Validación visual final

Tras aplicar FIX 1-10:
1. Capturar localhost en desktop 1280px
2. Verificar 12 puntos críticos uno a uno:
   - "9.817,84" Bruto Card Facturación CON punto miles
   - "6.396,64" Neto Card Facturación
   - "5.000,00" input editable semanal
   - "4.098,33" Faltan semanal
   - "1.111,49" / "1.317,81" / etc Días Pico CON puntos miles
   - "1.402,55" Media Días Pico
   - "9.817,84" Llevamos PE
   - "4.553,00" Gastos fijos Ratio
   - Glovo border visible
   - Just Eat barra naranja
   - Web/Directa cifras color
   - Layout 1fr 1fr 1fr fila inferior
3. Si CUALQUIERA sigue mal, no hacer commit hasta corregirlo

---

# FIX 12 · Deploy Vercel + Informe

Tras FIX 11 OK:
1. Build local sin errores
2. Commit final + push master
3. Deploy Vercel automático
4. URL del deploy en `.claude/tracking/informe-fixes-panel-ronda4.md` con checklist 12/12

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

PROHIBIDO marcar ✅ sin verificación visual.

---

# RESTRICCIONES

1. NO TOCAR Conciliación
2. NO modificar tablas Supabase populadas por otros chats
3. NO crear archivos nuevos salvo si fix lo requiere
4. NO preguntar a Rubén — decidir autónomamente

---

# ORDEN

FIX 1 → 2 → ... → 12. Tras FIX 12: deploy Vercel + URL final.
NO PARAR. NO PREGUNTAR.
