# RONDA 7 — PATCHES PUNTUALES POST-RECONSTRUCCIÓN

> 3 archivos completos ya están reescritos en este commit. Esta spec son los **5 patches restantes** sobre archivos donde solo cambia 1 zona.

---

## ARCHIVOS YA REESCRITOS (no tocar):
- `src/components/panel/resumen/CardResultadoPeriodo.tsx`  (R7-05)
- `src/components/panel/resumen/CardPedidosTM.tsx`  (R7-04)
- `src/components/panel/resumen/ColDiasPico.tsx`  (R7-07)

---

## PATCH 1 · TabResumen.tsx — pasar nuevas props (R7-05 + R7-07)

**Archivo:** `src/components/panel/resumen/TabResumen.tsx`

**Localiza el bloque del CardResultadoPeriodo (sobre línea 669-678) y AÑADE 2 props:**

```typescript
        <CardResultadoPeriodo
          ebitda={ebitda}
          ebitdaPct={ebitdaPct}
          deltaPp={ebitdaDeltaPp}
          netosEstimados={netoEstimado}
          netosReales={netosReales}
          totalGastos={totalGastosPeriodo}
          resultadoLimpio={resultadoLimpio}
          primeCostPct={primeCostPct}
          facturacionBruta={ventasPeriodo}
          margenNetoEstimadoPct={ventasPeriodo > 0 ? (netoEstimado / ventasPeriodo) * 100 : 0}
        />
```

**Localiza el bloque ColDiasPico (sobre línea 693-698) y AÑADE 2 props:**

```typescript
        <ColDiasPico
          dias={diasPico}
          media={mediaDiariaPico}
          nombreMes={nombreMes}
          fechaDesde={fechaDesde}
          fechaHasta={fechaHasta}
          onClickDia={onFiltrarDiaSemana}
        />
```

---

## PATCH 2 · tokens.ts — TABS_PILL margen mínimo (R7-02)

**Archivo:** `src/components/panel/resumen/tokens.ts`

**Localiza `TABS_PILL.container` (línea ~125-134) y reduce el `marginBottom`:**

```typescript
export const TABS_PILL = {
  container: {
    background: '#ffffff',
    border: '0.5px solid #d0c8bc',
    borderRadius: 10,
    padding: '4px 6px',
    marginBottom: 4,                  // ← antes 12, ahora 4 (1mm aprox.)
    marginTop: 4,                     // ← AÑADIR esta línea
    display: 'inline-flex',
    gap: 4,
  } as CSSProperties,
  // ... active e inactive sin cambios
} as const
```

---

## PATCH 3 · ColFacturacionCanal.tsx — Glovo border discreto (R7-06)

**Archivo:** `src/components/panel/resumen/ColFacturacionCanal.tsx`

**Localiza el `<CardCanal label="GLOVO"` (línea ~128-137) y reemplaza:**

```typescript
        {/* R7-06: Glovo border más sutil */}
        <CardCanal
          label="GLOVO"
          bg={`${COLOR.glovo}30`}
          border="rgba(200,180,0,0.30)"
          borderWidth="1px"
          colorLabel={COLOR.glovoDark}
          colorBruto={COLOR.glovoTexto}
          datos={glovo}
        />
```

(Eliminar el prop `boxShadow="inset 0 0 0 1px #5a5500"` — sobra)

---

## PATCH 4 · PanelGlobal.tsx — dropdown Marcas más ancho y compacto (R7-01)

**Archivo:** `src/pages/PanelGlobal.tsx`

**Localiza `menuStyle` (línea ~55-69) y reemplaza:**

```typescript
const menuStyle: React.CSSProperties = {
  position: 'absolute',
  top: 38,
  right: 0,
  background: '#ffffff',
  border: '0.5px solid #d0c8bc',
  borderRadius: 8,
  width: 280,                       // ← antes 220, ahora 280 (más ancho para nombres largos)
  fontSize: 12,
  color: '#3a4050',
  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
  zIndex: 100,
  maxHeight: 360,
  overflowY: 'auto',
  paddingTop: 2,                    // ← AÑADIR
  paddingBottom: 2,                 // ← AÑADIR
}
```

**Localiza el `<label` del item de marca dentro de `MultiSelect` (línea ~127-146) y reemplaza el `style` del label:**

```typescript
            <label
              key={o.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '2px 10px',                      // ← antes 3px 8px, ahora 2px 10px (menos vertical, más lateral)
                cursor: 'pointer',
                lineHeight: 1.3,                          // ← antes 1.2, ahora 1.3 (más legible)
                background: selected.includes(o.id) ? '#FF475715' : 'transparent',
                color: selected.includes(o.id) ? '#FF4757' : '#7a8090',
                fontFamily: 'Lexend, sans-serif', fontSize: 12,
                whiteSpace: 'nowrap',                     // ← AÑADIR — evita corte de nombres largos
              }}
            >
```

---

## PATCH 5 · CardSaldo — eliminar bloque PROYECCIÓN NETA (si existe)

**Archivo:** `src/components/panel/resumen/CardSaldo.tsx`

Si hay un bloque que muestra "PROYECCIÓN NETA" → eliminar.
Si solo muestra "Saldo cuentas Streat Lab" + Cobros + Pagos → ya está OK, omitir.

---

## VERIFICACIÓN

```bash
npx tsc --noEmit
```

Si hay errores TS por las nuevas props opcionales (`facturacionBruta?`, `margenNetoEstimadoPct?`, `fechaDesde?`, `fechaHasta?`) → todas son OPTIONAL, no debería romper nada.

---

## DEPLOY

```
git add . && git commit -m "fix(panel): ronda 7 - patches TabResumen, tokens, Glovo, dropdown" && git push origin master && npx vercel --prod && git pull origin master
```

## INFORME FINAL
- URL Vercel
- Patches aplicados / omitidos / bloqueados
- Errores TS resueltos
