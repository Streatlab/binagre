# Spec · FIX EXACTO · 4 fixes con código literal

> Sonnet · NO Opus · Aislamiento Binagre absoluto
> Código LITERAL listo para copiar y pegar. NO improvises NADA.

## FIX 1 · Conciliacion.tsx · cap 1000 query directa

ARCHIVO: `src/pages/Conciliacion.tsx`

LOCALIZAR (alrededor línea 149):
```tsx
    supabase
      .from('conciliacion')
      .select('*, factura_data:facturas(pdf_drive_url, pdf_filename)')
      .gte('fecha', desdeStr)
      .lte('fecha', hastaStr)
      .order('fecha', { ascending: false })
      .then(({ data }) => {
```

REEMPLAZAR por (añadir `.range(0, 999999)` antes de `.then`):
```tsx
    supabase
      .from('conciliacion')
      .select('*, factura_data:facturas(pdf_drive_url, pdf_filename)')
      .gte('fecha', desdeStr)
      .lte('fecha', hastaStr)
      .order('fecha', { ascending: false })
      .range(0, 999999)
      .then(({ data }) => {
```

ÚNICA diferencia: añadir `.range(0, 999999)` justo después de `.order(...)`.

## FIX 2 · useConciliacion.ts · cap 1000 query global

ARCHIVO: `src/hooks/useConciliacion.ts`

LOCALIZAR (alrededor línea 60, dentro del `Promise.all`):
```tsx
          supabase.from('conciliacion').select('*, factura_data:facturas(pdf_drive_url, pdf_filename)').order('fecha', { ascending: false }),
```

REEMPLAZAR por:
```tsx
          supabase.from('conciliacion').select('*, factura_data:facturas(pdf_drive_url, pdf_filename)').order('fecha', { ascending: false }).range(0, 999999),
```

ÚNICA diferencia: añadir `.range(0, 999999)` al final, antes de la coma.

## FIX 3 · SelectorFechaUniversal.tsx · formato fecha personalizado

ARCHIVO: `src/components/ui/SelectorFechaUniversal.tsx`

PROBLEMA: el label del personalizado usa formato ISO `2020-01-01 → 2026-12-31` en lugar de formato español corto `01/01/20 → 31/12/26`. Hay que usar la función `fmtFechaCorta()` que YA está importada en línea 3.

LOCALIZAR la función `applyPersonalizado()` (alrededor línea 224):
```tsx
  function applyPersonalizado() {
    if (!desdeStr || !hastaStr) return
    const d = new Date(desdeStr + 'T00:00:00')
    const h = new Date(hastaStr + 'T23:59:59')
    const label = `${desdeStr} → ${hastaStr}`
    setSelectedLabel(label)
    persist({ opcion: 'personalizado', desde: desdeStr, hasta: hastaStr })
    onChange(d, h, label)
  }
```

REEMPLAZAR por:
```tsx
  function applyPersonalizado() {
    if (!desdeStr || !hastaStr) return
    const d = new Date(desdeStr + 'T00:00:00')
    const h = new Date(hastaStr + 'T23:59:59')
    const label = `${fmtFechaCorta(desdeStr)} → ${fmtFechaCorta(hastaStr)}`
    setSelectedLabel(label)
    persist({ opcion: 'personalizado', desde: desdeStr, hasta: hastaStr })
    onChange(d, h, label)
  }
```

ÚNICA diferencia: cambiar `${desdeStr} → ${hastaStr}` por `${fmtFechaCorta(desdeStr)} → ${fmtFechaCorta(hastaStr)}`.

LOCALIZAR también el bloque de restauración de sessionStorage (alrededor línea 178-186):
```tsx
        if (op === 'personalizado' && saved.desde && saved.hasta) {
          const d = new Date(saved.desde)
          const h = new Date(saved.hasta)
          setOpcion(op)
          setDesdeStr(saved.desde)
          setHastaStr(saved.hasta)
          setSelectedLabel(`${saved.desde} → ${saved.hasta}`)
          onChange(d, h, `${saved.desde} → ${saved.hasta}`)
          return
        }
```

REEMPLAZAR por:
```tsx
        if (op === 'personalizado' && saved.desde && saved.hasta) {
          const d = new Date(saved.desde)
          const h = new Date(saved.hasta)
          const labelPers = `${fmtFechaCorta(saved.desde)} → ${fmtFechaCorta(saved.hasta)}`
          setOpcion(op)
          setDesdeStr(saved.desde)
          setHastaStr(saved.hasta)
          setSelectedLabel(labelPers)
          onChange(d, h, labelPers)
          return
        }
```

## FIX 4 · Conciliacion.tsx · subtítulo header

ARCHIVO: `src/pages/Conciliacion.tsx`

LOCALIZAR (alrededor línea 388):
```tsx
          <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: '#7a8090', display: 'block', marginTop: 4 }}>
            {fmtDate(periodoDesde)} — {fmtDate(periodoHasta)}
          </span>
```

VERIFICAR: que `fmtDate` ya devuelva formato `dd/mm/yy`. Si devuelve formato ISO o largo, cambiar import:

LOCALIZAR import en línea 3:
```tsx
import { fmtEur, fmtDate } from '@/utils/format'
```

VERIFICAR que `fmtDate` está implementado correctamente. Si no, usar la misma función `fmtFechaCorta` del archivo SelectorFechaUniversal:

```tsx
import { fmtEur } from '@/utils/format'
import { fmtFechaCorta } from '@/styles/tokens'
```

Y reemplazar el `fmtDate(periodoDesde)` por:
```tsx
{fmtFechaCorta(periodoDesde.toISOString().slice(0, 10))} — {fmtFechaCorta(periodoHasta.toISOString().slice(0, 10))}
```

NOTA: Si `fmtDate` ya usa formato dd/mm/yy correctamente, no hay que tocar este bloque (verificar antes en `src/utils/format.ts`).

## VALIDACIÓN OBLIGATORIA POSTDEPLOY

binagre.vercel.app/conciliacion en INCÓGNITO, Tab Movimientos.

### Test A · Custom range 01/01/2020 → 31/12/2026
- Selector muestra: **"01/01/20 → 31/12/26"** (NO "2020-01-01 → 2026-12-31")
- Card Ingresos: **+283.354,59 €**
- Card Gastos: **-234.415,64 €**
- Tabla footer: "Mostrando 25 de 5203 movimientos" (NO 1000)

### Test B · Mes en curso (default abril 2026)
- Card Ingresos: **+5.060,15 €**
- Card Gastos: **-5.811,77 €**
- Tabla: 83 movimientos

Si CUALQUIER test falla, NO commitear. Debug y retest.

## ENTREGABLES

1. 4 fixes aplicados literalmente
2. Build limpio (`npm run build`)
3. Validación visual antes de commitear
4. git add . && git commit -m "fix(conci): cap 1000 + formato fechas español"
5. git push origin master
6. npx vercel --prod
7. Informe con URL deploy + datos test A y test B
