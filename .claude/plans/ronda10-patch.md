# RONDA 10 — Card Resultado lee del periodo elegido + fallback gastos

CardResultadoPeriodo.tsx ya está reescrita en este commit.

## PATCH NECESARIO en TabResumen.tsx

Localiza el bloque `<CardResultadoPeriodo` (línea ~669 aprox) y AÑADE 3 props:

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
          gastosPorGrupo={{
            producto: gruposData.producto.gasto,
            equipo: gruposData.equipo.gasto,
            local: gruposData.local.gasto,
            controlables: gruposData.controlables.gasto,
          }}
          fechaDesde={fechaDesde}
          fechaHasta={fechaHasta}
        />
```

(Las 3 props nuevas: `gastosPorGrupo`, `fechaDesde`, `fechaHasta`. Las otras dos `facturacionBruta` y `margenNetoEstimadoPct` ya estaban del patch anterior.)

## Lógica resultante

1. Si periodo elegido = mes completo y existe row en `running` → usa running
2. Si no → calcula desde `gastos` filtrado por `fechaDesde/fechaHasta` (que es lo que ya hace `gruposData` en TabResumen)
3. Facturación viene de `ventasPeriodo` (módulo Facturación, siempre fiable)
4. Ingresos netos = real si hay running, si no estimado vía margen neto

## Deploy

```
git pull origin master && npx tsc --noEmit && git add . && git commit -m "fix(panel): ronda 10 - card resultado del periodo" && git push origin master && npx vercel --prod && git pull origin master
```
