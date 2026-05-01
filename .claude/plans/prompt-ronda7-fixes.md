# PROMPT CLAUDE CODE — RONDA 7 · FIXES VISUALES PANEL

Lee este archivo completo. Implementa cada fix en orden. NO preguntes, decide y avanza.
NO tocar Conciliación. Aislamiento absoluto Binagre (nunca tocar idclhnxttdbwayxeowrm ni tokens David).

---

## FIX R7-01 · Dropdown Marcas — más ancho, items más juntos

En `src/pages/PanelGlobal.tsx` o donde esté el dropdown "Todas las marcas":
- Contenedor dropdown: `minWidth: 220px` (actualmente demasiado estrecho)
- Cada item de la lista: `padding: '2px 10px'`, `fontSize: 12`, `lineHeight: 1.4`
- Sin gap extra entre items — `gap: 0`
- Que los nombres largos (ej "Burritos & Chilaquiles el Titán") no se corten

---

## FIX R7-02 · Tabs (Resumen / Operaciones / Finanzas...) — margen mínimo con zona blanca

En `TabResumen.tsx` o `PanelGlobal.tsx`, el contenedor de tabs:
- Margen superior respecto al borde de la zona de contenido: máximo `4px`
- `marginTop: 4` en el wrapper de tabs
- `padding: '4px 6px'` dentro del pill container
- `borderRadius: 10`
- `gap: 4`

---

## FIX R7-03 · Card Facturación — objetivos desde módulo real, editable con fallback

En `CardVentas.tsx`:

1. Leer objetivos desde tabla `objetivos` de Supabase:
```typescript
// Query: SELECT valor FROM objetivos WHERE tipo = 'facturacion_semana' AND periodo = etiquetaSemana LIMIT 1
// Query: SELECT valor FROM objetivos WHERE tipo = 'facturacion_mes' AND periodo = 'YYYY-MM' LIMIT 1
// Query: SELECT valor FROM objetivos WHERE tipo = 'facturacion_anio' AND periodo = 'YYYY' LIMIT 1
```

2. EditableInline con fallback — si el usuario borra el valor, restaurar el anterior:
```typescript
const [objetivo, setObjetivo] = useState<number>(objetivoDeSupabase ?? 0);
const [prevObjetivo, setPrevObjetivo] = useState<number>(objetivoDeSupabase ?? 0);

const handleSave = async (v: number) => {
  if (!v || isNaN(v) || v === 0) {
    setObjetivo(prevObjetivo); // restaurar anterior
    return;
  }
  setPrevObjetivo(v);
  setObjetivo(v);
  await supabase.from('objetivos').upsert({ tipo: 'facturacion_mes', periodo: periodoKey, valor: v });
};
```

3. Mostrar con `fmtNum(objetivo)` dentro del EditableInline.

---

## FIX R7-04 · Card Pedidos·TM — formato plataformas "1097 / 26,76 / 17,05"

En `CardPedidosTM.tsx`, la lista de plataformas (Uber Eats, Glovo, Just Eat, Web, Directa):

Formato actual: `1097 · 26,76 € / 17,05 €`
Formato objetivo: `1097 / 26,76 / 17,05`

```typescript
// Para cada plataforma:
<span style={{fontSize:11, color:'#aaa'}}>
  {fmtNum(canal.pedidos, 0)} / {fmtNum(canal.tmBruto)} / {fmtNum(canal.tmNeto)}
</span>
```
- Sin símbolo €
- Separador `/` con espacio a cada lado
- Sin punto medio `·`

Además — colores en barras Web y Directa:
- Web: barra color `#8B5CF6` (violeta) o el color ya definido para Web en tokens
- Directa: barra color `#06B6D4` (cyan) o el definido para Directa
- Si pedidos === 0, mostrar `0 / 0,00 / 0,00` — NO `— € / — €`

---

## FIX R7-05 · Card Resultado — lógica de cascada con datos reales disponibles

En `CardResultadoPeriodo.tsx`, rediseñar la cascada PyG con esta lógica:

### Línea 1: FACTURACIÓN (renombrar "Ingresos brutos" → "Facturación")
```typescript
// Valor: leer de tabla ventas/facturacion del periodo (misma fuente que CardVentas)
// Es el bruto que Rubén mete a mano — SIEMPRE disponible
const facturacion = ventasBrutas; // viene por props desde TabResumen
```

### Línea 2: COMISIONES + IVA — ELIMINAR esta línea de la cascada
Borrar completamente la fila "Comisiones + IVA".

### Línea 3: INGRESOS NETOS
```typescript
// Si hay dato real de Supabase: usar ese
// Si no: estimar = facturacion * (margenNetoEstimadoPct / 100)
// margenNetoEstimadoPct viene de CardVentas (el % que aparece junto a NETO ESTIMADO)
const ingresosNetos = netoReal ?? (facturacion * margenNetoEstimadoPct / 100);
const esEstimado = netoReal == null;
// Mostrar con asterisco si es estimado: "30.643 *"
```

### Línea 4: PRODUCTO
```typescript
// Desde tabla `running` grupo='Producto' del periodo
// Si no hay dato: "Datos insuficientes"
```

### Línea 5: MARGEN BRUTO
```typescript
// Calculado: ingresosNetos - producto
// Solo mostrar si ingresosNetos está disponible Y producto está disponible
const margenBruto = (ingresosNetos != null && producto != null) ? ingresosNetos - producto : null;
```

### Línea 6: PERSONAL
```typescript
// Desde tabla `running` grupo='Personal' del periodo
```

### Línea 7: LOCAL + CONTROLABLES
```typescript
// Desde tabla `running` grupo='Local' + grupo='Controlables' del periodo
```

### Línea 8: PROVISIONES — ELIMINAR de la cascada
Borrar la fila "Provisiones" de la cascada PyG de esta card.

### Línea 9: RESULTADO LIMPIO
```typescript
// Si tenemos margenBruto + personal + localControlables:
const resultadoLimpio = margenBruto != null && personal != null && localControlables != null
  ? margenBruto - personal - localControlables
  : null;
// Si null → "Datos insuficientes"
```

### % s/netos (esquina superior derecha)
Color actual: amarillo — NO se ve. Aplicar misma lógica que barra de progreso:
```typescript
// Si la barra de Prime Cost está en verde (pct >= objetivo): color '#1D9E75'
// Si la barra está en rojo (pct < objetivo * 0.5): color '#B01D23'
// Si amarillo (objetivo*0.5 <= pct < objetivo): color '#B01D23' también (rojo, para que se vea)
// Nunca '#e8f442' — no se ve sobre fondo claro
const colorPct = primeCostPct <= objetivoPrimeCost ? '#1D9E75' : '#B01D23';
```

---

## FIX R7-06 · Glovo border — más discreto

En `ColFacturacionCanal.tsx`, card Glovo:
```typescript
// Actual: border '1px solid #5a5500' — demasiado oscuro
// Nuevo: border '1px solid rgba(200,180,0,0.25)' — sutil, casi invisible
style={{ border: '1px solid rgba(200,180,0,0.25)' }}
// Sin boxShadow extra
```

---

## FIX R7-07 · Días Pico — usar datos de facturación del periodo seleccionado

En `ColDiasPico.tsx`:

El gráfico debe mostrar facturación bruta diaria del periodo seleccionado.
Los datos de facturación SÍ existen (Rubén los mete a mano en el módulo de Facturación).

```typescript
// Query Supabase: SELECT fecha, SUM(bruto) as total
// FROM ventas (o la tabla donde se guarda facturación diaria)
// WHERE fecha BETWEEN fechaInicio AND fechaFin
// AND (marca = marcaFiltro OR marcaFiltro = 'todas')
// GROUP BY fecha ORDER BY fecha ASC

// La tabla correcta es la misma que usa el módulo Facturación
// Buscar en src/pages/Facturacion.tsx qué tabla usa para leer ventas diarias
// y replicar esa misma query aquí
```

Si el periodo es mensual → mostrar días del mes.
Si es semanal → mostrar días de esa semana.
Si es anual → mostrar meses (agrupar por mes).

Línea media = media aritmética de los valores mostrados.
Si no hay datos en el rango → `<div style={{textAlign:'center',color:'#888',fontSize:12}}>Sin datos en este periodo</div>`

---

## VERIFICACIÓN FINAL

Antes del deploy:
```bash
npx tsc --noEmit
# Corregir todos los errores TypeScript
```

## DEPLOY
```bash
git add . && git commit -m "fix(panel): ronda 7 - dropdown marcas, tabs margen, objetivos editables, pedidos formato, cascada resultado, glovo border, dias pico datos reales" && git push origin master && npx vercel --prod && git pull origin master
```

Informe final:
- URL Vercel
- Fix por fix: aplicado / omitido (ya estaba) / bloqueado (motivo)
- Tabla que usa Facturación para ventas diarias (para confirmar query Días Pico)
