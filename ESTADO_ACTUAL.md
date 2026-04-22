# Streat Lab ERP — Estado actual

**Última actualización:** 2026-04-16
**Repo:** https://github.com/Streatlab/streatlab-erp
**Deploy:** https://binagre.vercel.app
**Supabase:** https://eryauogxcpbgdryeimdq.supabase.co

## Para continuar en casa

```bash
git pull origin master
npm install
npm run dev
```

Si hay migraciones SQL nuevas pendientes, ejecutarlas en Supabase SQL Editor:
- `supabase/migrations/007_margen_por_canal.sql`

## Módulos

| Módulo | Estado |
|--------|--------|
| Login | ✅ Funcionando (PIN + nombre, roles admin/cocina) |
| Dashboard | ✅ Funcionando (KPIs, canales, top días) |
| Facturación | ✅ Funcionando (diario/semanas/meses + modal) |
| **Escandallo** | ✅ 5 pestañas — ver detalle abajo |
| Configuración | ✅ 5 secciones editables |
| POS | ⬜ Placeholder |
| Marcas | ⬜ Placeholder |
| Running | ⬜ Placeholder |

## Escandallo — estado por pestaña

### Índice (TabIndice)
✅ Lista combinada EPS + Recetas
✅ EPS azul itálico `#4a9eff`, pricing celdas vacías
✅ Recetas: pricing Uber Eats calculado (Real + Cash), semáforo
✅ Click fila completa abre modal
✅ Formato ES en todos los números (`1.234,56 €`)
✅ Fecha `dd/mm/yyyy`, vacío si null
✅ Contadores TOTAL / EPS / RECETAS arriba

### Ingredientes (TabIngredientes + ModalIngrediente)
✅ Tabla 29 columnas con sticky
✅ Contadores TOTAL / EN USO / SIN USO
✅ Click fila abre modal edición completa
✅ ABV autocompleta proveedor desde `config_proveedores`
✅ Tipo Merma Técnica → crea entrada en `mermas`

### Mermas (TabMermas + ModalMerma)
✅ Tabla 29 columnas con sticky
✅ Click fila abre modal
✅ Botón + Nueva Merma
✅ Al guardar crea ingredientes derivados (SP1, Limpio, Porción)

### EPS (TabEPS + ModalEPS)
✅ Tabla clickable (código, nombre, raciones, tamaño, unidad, costes, fecha, usos)
✅ Modal con cabecera completa + líneas
✅ Query correcto `eps_lineas.eps_id = id`
✅ Cálculo en tiempo real de coste tanda y coste/ración
✅ Sin pricing por canal (es correcto — EPS no se vende)

### Recetas (TabRecetas + ModalReceta)
✅ Tabla con margen% Uber + semáforo
✅ Modal con PVPs editables por canal
✅ Waterfall completo 5 canales × Real/Cash:
  - Coste MP, estructura, plataforma, coste total
  - Margen deseado **por canal** (no global)
  - PVP recomendado Real y Cash diferenciados
  - K multiplicador, margen €, % margen con semáforo
  - IVA neto, provisión IVA/pedido
✅ Usa `useConfig` como fuente de verdad
✅ Fallback a defaults si tablas vacías

## useConfig — fuente de verdad

Hook en `src/hooks/useConfig.ts` centraliza:
- `canales[]` — incluye `margen_deseado_pct` por canal (nuevo)
- `proveedores[]` — ABV + nombre + marca asociada (nuevo en el hook)
- `estructura_pct` global
- `margen_deseado_pct` global (fallback si canal no tiene)
- `categorias[]` y `unidades[]` desde tabla configuracion
- `loading`, `refresh()`

## Configuración — 5 secciones

| Sección | Estado |
|---------|--------|
| Plataformas | ✅ Editable: comisión%, coste fijo, **margen deseado %** (nuevo), activa |
| Costes | ✅ estructura_pct, margen_deseado_pct global |
| Proveedores | ✅ CRUD ABV → nombre → marca → categoría |
| Categorías | ✅ JSON array editable |
| Unidades | ✅ JSON array editable |

Proveedores NO está en el sidebar — solo dentro de Configuración.

## Estilo visual

**Tema unificado (commit ff1bcdd):**
- Fondo: `#1a1a1a`
- Cards/modales: `#242424`
- Bordes: `#2a2a2a`
- Texto: `#f0f0f0` / secundario `#888`
- Acento: `#e8f442` amarillo
- Logo SL: círculo rojo `#B01D23` (único elemento corporativo)

**Aplicado en todas las pestañas:**
- Tab activo: `bg-accent text-[#111]`
- Botón Guardar: `bg-accent text-[#111]`
- Cabecera tabla: borde inferior accent
- Item activo sidebar: `border-left: 3px solid #e8f442`
- Hover filas: `#262626`

## Formato ES

Helpers centralizados en `src/components/escandallo/types.ts`:
- `fmtES(v, d)` → `1.234,56` o `''` si null
- `fmtEurES(v, d)` → `1.234,56 €` o `''`
- `fmtPctES(v, d)` → `12,34%` o `''`
- `fmtDateES(v)` → `16/04/2026` o `''`

**Null → string vacío**, nunca mostrar `—` en celdas vacías.

## Schema Supabase

### Tablas principales
- `usuarios` — login
- `facturacion_diario` — registros diarios
- `ingredientes` — 27+ columnas (precio1/2/3, eur_std, eur_min, merma...)
- `mermas` — 29 columnas (SP1/SP2, % limpio, €/kg neto, porciones...)
- `eps` — id, codigo, nombre, raciones, tamaño, costes, usos, fecha
- `eps_lineas` — FK `eps_id`
- `recetas` — + 5 canales PVP
- `recetas_lineas` — FK `receta_id`

### Tablas config
- `config_canales` — comision_pct, coste_fijo, **margen_deseado_pct**, activo
- `config_proveedores` — abv, nombre_completo, **marca_asociada**, categoria
- `configuracion` — clave/valor (estructura_pct, categorias, unidades, etc.)

## Migraciones SQL

Aplicar en orden en Supabase SQL Editor:

1. `002_config_proveedores.sql`
2. `003_eps_recetas_lineas.sql`
3. `004_ingredientes_columns.sql`
4. `005_rec028_cleanup.sql`
5. `006_redesign.sql`
6. **`007_margen_por_canal.sql`** ← nuevo, aplicar si no está

## Últimos commits

```
e050725 feat: margen deseado por canal + proveedores en useConfig + pvpRec Real vs Cash
ff1bcdd fix: estilo original limpio + helpers fmtEurES/fmtPctES nulos vacios
3d75648 fix: indice completo - logo, colores uniformes, EPS sin pricing, formato ES
20b9c35 fix: indice calca escandallo GAS + logo SL + acento rojo B01D23
4bf5efd fix: ERP completo - config fuente verdad, waterfall useConfig, mermas, lineas EPS/REC, sidebar colapsable
```

## Pendiente / siguientes pasos

### Validación manual en navegador
- [ ] Verificar que las líneas de EPS cargan al abrir modal (query `eps_lineas.eps_id = id`)
- [ ] Verificar que las líneas de Recetas cargan (query `recetas_lineas.receta_id = id`)
- [ ] Probar guardar nueva EPS y ver que se inserta en `eps_lineas`
- [ ] Probar guardar receta con waterfall
- [ ] Probar ABV autocomplete en ModalIngrediente
- [ ] Probar merma técnica → crea ingredientes derivados

### Mejoras
- [ ] Primera línea de Receta debería ser envase (tipo=ENV) por defecto
- [ ] Validación: EPS sin pricing (correcto), solo Recetas tienen PVP
- [ ] Contador de usos automático cuando se referencia una EPS/ingrediente
- [ ] Módulo POS
- [ ] Módulo Marcas
- [ ] Módulo Running

### Vercel
Vercel debería desplegar automáticamente desde `master`. Si no:
- Dashboard → Settings → Git → verificar Production Branch = `master`
- O hacer Redeploy manual
