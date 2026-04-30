# Spec · Bancos y Cuentas + Conciliación + Modal · ESPECIFICACIÓN LITERAL

> **Modelo:** Sonnet por defecto. Subagentes Sonnet (pm-spec → architect-review → implementer → qa-reviewer → erp-reviewer). NO Opus.
> **Modo:** Localhost + deploy Vercel al final autorizado.
> **Aislamiento Binagre:** NUNCA tocar erp-david.
> **REGLA #1:** Spec literal. NO interpretar, NO improvisar. Si un valor no está aquí, preguntar.
> **Fuente única estilo:** Notion guía maestra `350c8b1f-6139-8191-952a-f299926ac42f`.
> **REGLA #2:** Tab "Resumen" de Conciliación NO se toca, queda intacto. Solo se trabaja Movimientos + Configuración + Modal.

---

## ENTREGABLES (3)

### A. Renombrar módulo Configuración → reorganizar tabs
### B. Implementar Configuración / Bancos y Cuentas / Categorías (tabla 3 niveles)
### C. Reescribir Tab Movimientos de Conciliación (4 cards + filtros + tabla 8 cols + modal)

Todos los entregables van en un único push final con build limpio + deploy Vercel.

---

## TOKENS BASE (TODO el módulo)

### Familias y reglas

- `Oswald` para: títulos, labels MAYÚSCULAS, todas las cifras numéricas, IDs de categoría
- `Lexend` para: texto general, deltas, placeholders, botones
- NUNCA otra familia
- Importar fuentes: `<link href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500&family=Oswald:wght@400;500;600&display=swap" rel="stylesheet">`

### Paleta literal

| Token | Hex | Uso |
|---|---|---|
| Texto principal | `#111` | Cifras, valores, nombres editables |
| Texto secundario | `#3a4050` | Texto medio, opciones inactivas |
| Texto muted | `#7a8090` | Sublabels, fechas, placeholders |
| Borde | `#d0c8bc` | Bordes cards, dropdowns, tabla |
| Borde claro | `#ebe8e2` | Separador filas tabla |
| Fondo página | `#f5f3ef` | Body |
| Card blanco | `#fff` | Fondo cards, modal claro |
| Verde semáforo | `#1D9E75` | Conciliado, ingresos, deltas + |
| Verde oscuro | `#0F6E56` | Texto sobre fondo verde claro |
| Ámbar | `#f5a623` | Variables, advertencias |
| Rojo semáforo | `#E24B4A` | Pendiente, gastos, deltas - |
| Rojo SL | `#B01D23` | Solo título página + ID nivel 1 categorías |
| Rojo accent UI | `#FF4757` | Tab activa, botón primario, card seleccionada |
| Naranja Rubén | `#F26B1F` | Card Pendientes (cifra), titular Rubén |
| Azul Emilio | `#1E5BCC` | Titular Emilio |

### Espaciado

- Border-radius card grande: 16px
- Border-radius card mediano: 14px
- Border-radius botón pequeño: 6px
- Border-radius dropdown / input: 8px / 10px
- Padding card grande: 24px 28px
- Padding card mediano: 18px 20px
- Border width estándar: 0.5px
- Gap grid: 12-14px

### Helpers comunes

- `formatearEuros(n)` formato `1.234,56 €` (helper ya existe en `src/lib/format.ts`)
- `formatearFechaCorta(date)` formato `dd/mm/yy` (idem)
- Todos los importes y fechas en este módulo usan estos helpers

---

# A · CONFIGURACIÓN — REORGANIZACIÓN

## A.1 Sidebar

Renombrar (en sidebar) item:

- ❌ Antes: `Configuración → Categorías financieras`
- ✅ Ahora: `Configuración → Bancos y Cuentas`

Ruta:

- ❌ Antes: `/configuracion/categorias-financieras`
- ✅ Ahora: `/configuracion/bancos-y-cuentas`

Mantener el resto del sidebar como está.

## A.2 Tabs principales del módulo Configuración

Orden literal de tabs (el resto se mantiene):

1. Marcas
2. **Bancos y Cuentas** (sustituye a "Categorías financieras")
3. Plataformas
4. Usuarios
5. Calendario operativo

Estilo tabs según Notion (ya implementado, no tocar): tab activa fondo `#FF4757` color blanco · inactiva borde `0.5px solid #d0c8bc` color `#3a4050`.

## A.3 Sub-tabs DENTRO de Bancos y Cuentas

```
<div style="display:inline-flex; gap:6px; margin-bottom:16px">
  <button SUBTAB_A>Cuentas bancarias</button>
  <button SUBTAB_A_ACTIVA>Categorías</button>
  <button SUBTAB_A>Reglas</button>
</div>
```

- Sub-tab activa: `padding:5px 12px; border-radius:6px; border:none; background:#FF4757; color:#fff; font-family:'Lexend'; font-size:12px; font-weight:500`
- Sub-tab inactiva: `padding:5px 12px; border-radius:6px; border:0.5px solid #d0c8bc; background:#fff; color:#3a4050; font-family:'Lexend'; font-size:12px; font-weight:500`
- Sub-tab activa por defecto al abrir el módulo: **Categorías**
- Las 3 sub-tabs deben existir como rutas:
  - `/configuracion/bancos-y-cuentas/cuentas`
  - `/configuracion/bancos-y-cuentas/categorias` (default)
  - `/configuracion/bancos-y-cuentas/reglas`
- Si falta lógica para "Cuentas bancarias" o "Reglas", dejar el sub-tab visible con un placeholder "Próximamente · módulo aún no implementado". El sub-tab Categorías SÍ se implementa completo en este spec.

---

# B · BANCOS Y CUENTAS / CATEGORÍAS

## B.1 Layout general

```
<div class="page" style="background:#f5f3ef; padding:24px 28px">

  <!-- Breadcrumb -->
  <div class="crumb">Configuración</div>

  <!-- Título -->
  <h1>Bancos y Cuentas</h1>

  <!-- Tabs principales Configuración (Marcas, Bancos y Cuentas activa, Plataformas, Usuarios, Calendario operativo) -->

  <!-- Sub-tabs (Cuentas, Categorías activa, Reglas) -->

  <!-- Tabla de categorías (sección B.2) -->

</div>
```

### B.1.1 Breadcrumb

`<div style="font-family:'Oswald'; font-size:10px; letter-spacing:2px; color:#7a8090; text-transform:uppercase; margin-bottom:4px">Configuración</div>`

### B.1.2 Título página

`<h1 style="font-family:'Oswald'; font-size:22px; font-weight:600; letter-spacing:3px; color:#B01D23; margin:0 0 18px; text-transform:uppercase">Bancos y Cuentas</h1>`

## B.2 Tabla de categorías

### B.2.1 Wrapper

```
<div style="background:#fff; border:0.5px solid #d0c8bc; border-radius:14px; padding:24px 28px">
  <table class="cat">...</table>
</div>
```

### B.2.2 Estructura de la tabla

Tabla con 3 columnas:

| Header | Ancho | Alineación |
|---|---|---|
| ID | 90px | left |
| Nombre | flex | left |
| (Acciones) | 80px | right |

### B.2.3 Estilo cabecera tabla

```
<thead>
  <tr>
    <th>ID</th>
    <th>Nombre</th>
    <th></th>
  </tr>
</thead>
```

CSS cabecera:
```
table.cat thead th {
  font-family: 'Oswald';
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 2px;
  color: #7a8090;
  text-transform: uppercase;
  text-align: left;
  padding: 12px 0;
  border-bottom: 0.5px solid #d0c8bc;
}
```

### B.2.4 Tipos de fila

#### TIPO 1 · Cabecera bloque (Nivel 1 — `1`, `2.1`, `3`, etc.)

NO editable. Sirve de cabecera visual.

```
<tr class="lvl1">
  <td class="id1">2.1</td>
  <td class="name">Producto · banda 25-30 %</td>
  <td></td>
</tr>
```

CSS:
```
tr.lvl1 td { padding: 18px 0 10px; border-bottom: 0.5px solid #ebe8e2; }
tr.lvl1 .id1 {
  font-family: 'Oswald';
  font-size: 14px;
  font-weight: 600;
  color: #B01D23;
  letter-spacing: 2px;
}
tr.lvl1 .name {
  font-family: 'Oswald';
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 2.5px;
  color: #111;
  text-transform: uppercase;
}
```

#### TIPO 2 · Cabecera subgrupo (Nivel 2 — `2.11`, `2.21`, etc.)

NO editable. Solo en bloques que tienen subgrupos (Producto, Equipo, Controlables).

```
<tr class="lvl2">
  <td class="id2">2.11</td>
  <td class="name">Alimentos y bebidas</td>
  <td></td>
</tr>
```

CSS:
```
tr.lvl2 td { padding: 14px 0 8px; border-bottom: 0.5px solid #ebe8e2; }
tr.lvl2 .id2 {
  font-family: 'Oswald';
  font-size: 11px;
  font-weight: 600;
  color: #3a4050;
  letter-spacing: 1.5px;
}
tr.lvl2 .name {
  font-family: 'Oswald';
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 2px;
  color: #3a4050;
  text-transform: uppercase;
}
```

#### TIPO 3 · Detalle editable (Nivel 3 — `2.11.1 Mercadona`)

Único editable. Input transparente inline.

```
<tr class="lvl3">
  <td class="id">2.11.1</td>
  <td class="name"><input value="Mercadona" /></td>
  <td class="actions"><span class="ico iD">🗑</span></td>
</tr>
```

CSS:
```
tr.lvl3 td { padding: 12px 0; border-bottom: 0.5px solid #ebe8e2; }
tr.lvl3 .id {
  font-family: 'Oswald';
  font-size: 12px;
  font-weight: 500;
  color: #7a8090;
  letter-spacing: 1px;
  white-space: nowrap;
}
tr.lvl3 .name input {
  font-family: 'Lexend';
  font-size: 13px;
  color: #111;
  border: none;
  background: transparent;
  width: 100%;
  padding: 0;
}
tr.lvl3 .name input:focus {
  outline: none;
  border-bottom: 1px dashed #FF4757;
  background: #FF475708;
}
tr.lvl3 .name input:hover { cursor: text; }
.actions { text-align: right; width: 80px; }
.ico {
  font-size: 13px;
  color: #7a8090;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  display: inline-block;
}
.ico:hover { background: #ebe8e2; color: #3a4050; }
.iD:hover { color: #E24B4A; background: #E24B4A15; }
```

### B.2.5 Estructura COMPLETA de filas a renderizar (orden literal)

Ver árbol completo en sección **B.3 ÁRBOL CATEGORÍAS**. Renderizar en este orden exacto, sin saltos.

## B.3 ÁRBOL CATEGORÍAS COMPLETO (datos a renderizar y a sembrar en BD)

### Bloque 1 · INGRESOS

**1 · Ingresos por operación** (cabecera bloque, no editable)

**1.1 · Ingresos netos por ventas** (cabecera, no editable)
- 1.1.1 Venta Uber Eats
- 1.1.2 Venta Glovo
- 1.1.3 Venta Just Eat
- 1.1.4 Venta Tienda online
- 1.1.5 Venta directa caja

**1.2 · Facturación bruta por ventas** (cabecera, no editable, `computa_pyg=false`)
- 1.2.1 Bruto Uber Eats
- 1.2.2 Bruto Glovo
- 1.2.3 Bruto Just Eat
- 1.2.4 Bruto Tienda online
- 1.2.5 Bruto caja directa

### Bloque 2.1 · PRODUCTO (banda 25-30 %)

**2.1 · Producto · banda 25-30 %** (cabecera bloque)

**2.11 Alimentos y bebidas**
- 2.11.1 Mercadona
- 2.11.2 Alcampo
- 2.11.3 Carrefour
- 2.11.4 Día
- 2.11.5 Lidl
- 2.11.6 Coca Cola
- 2.11.7 Pascual
- 2.11.8 Lactalis
- 2.11.9 Embajadores
- 2.11.10 Jasa
- 2.11.11 Fritravich
- 2.11.12 Prodesco
- 2.11.13 TGT
- 2.11.14 China Cayente
- 2.11.15 China Gruñona
- 2.11.16 Amazon Bebidas

**2.12 Packaging**
- 2.12.1 Envapro
- 2.12.2 PuntoQpack
- 2.12.3 Pampols
- 2.12.4 Bolsemack

**2.13 Entregas y repartos**
- 2.13.1 Reparto Uber Direct
- 2.13.2 Repartos propios

### Bloque 2.2 · EQUIPO (banda 30-35 %)

**2.2 · Equipo · banda 30-35 %**

**2.21 Fijos Equipo**
- 2.21.1 Cuotas autónomos
- 2.21.2 Sueldo Rubén
- 2.21.3 Sueldo Emilio
- 2.21.4 Sueldo jefe cocina
- 2.21.5 Sueldo Andrés
- 2.21.6 Sueldo cocinero 2
- 2.21.7 Sueldo cocinero 3
- 2.21.8 Sueldo cocinero 4
- 2.21.9 Sueldo AVs
- 2.21.10 IRPF empleados
- 2.21.11 Seguridad Social empleados
- 2.21.12 Gestoría laboral
- 2.21.13 Selección personal

**2.22 Variables Equipo**
- 2.22.1 Incentivos
- 2.22.2 Uniformes
- 2.22.3 Formación
- 2.22.4 Comida personal

**2.23 Freelances**
- 2.23.1 Workana

### Bloque 2.3 · ALQUILER (banda 5-8 %)

**2.3 · Alquiler · banda 5-8 %**

**2.31 Alquiler e inmueble**
- 2.31.1 Alquiler local
- 2.31.2 IRPF retención alquiler
- 2.31.3 Seguro local
- 2.31.4 Residuos sólidos urbanos
- 2.31.5 Reparaciones y mantenimiento

### Bloque 2.4 · CONTROLABLES (banda 15-18 %)

**2.4 · Controlables · banda 15-18 %**

**2.41 Marketing**
- 2.41.1 Publi Instagram y Facebook
- 2.41.2 Publi Google Ads
- 2.41.3 Publicidad impresa
- 2.41.4 Diseño gráfico
- 2.41.5 Publi plataformas extra

**2.42 Internet y ventas**
- 2.42.1 Dominios
- 2.42.2 Hosting
- 2.42.3 Tienda online
- 2.42.4 Diseño web

**2.43 Administración y generales**
- 2.43.1 Gestoría fiscal
- 2.43.2 Integración Rushour
- 2.43.3 Integración Sinqro
- 2.43.4 Think Paladar
- 2.43.5 Flynt
- 2.43.6 IA
- 2.43.7 Control de plagas
- 2.43.8 Material oficina
- 2.43.9 Comisiones banco
- 2.43.10 Savour

**2.44 Suministros**
- 2.44.1 Teléfono e internet
- 2.44.2 Electricidad
- 2.44.3 Gas
- 2.44.4 Agua

### Bloque 3 · MOVIMIENTOS INTERNOS (no PyG)

**3 · Movimientos internos** (`computa_pyg=false`)
- 3.1 Traspaso entre cuentas
- 3.2 Devolución IVA
- 3.3 Préstamo socio
- 3.4 Aportación socios
- 3.5 Ajuste contable
- 3.6 Cuotas préstamos Ben Menjat

## B.4 Comportamiento

1. Editar nombre detalle: pulsar input, escribir, blur o Enter guarda en BD `categorias_pyg`
2. Toast feedback: "Detalle actualizado"
3. Si dejo el input vacío y blur → restaurar nombre anterior + toast "Restaurado"
4. Click en papelera nivel 3:
   - Si tiene 0 movs asociados → confirmar y eliminar
   - Si tiene N movs asociados → modal "Tienes N movimientos categorizados como X. Asígnalos a otro detalle antes de eliminar"
5. NO se puede eliminar nivel 1 ni nivel 2 desde la tabla
6. NO botones "Añadir" en este spec (se gestionan en próxima iteración)
7. Tabla scrolleable vertical si la página la limita

## B.5 BD · estructura nueva

Crear tabla `categorias_pyg` con columnas:

```sql
CREATE TABLE categorias_pyg (
  id text PRIMARY KEY,            -- '2.11.1', '1.1.1', etc.
  nivel integer NOT NULL,         -- 1, 2 o 3
  parent_id text REFERENCES categorias_pyg(id),
  nombre text NOT NULL,
  bloque text NOT NULL,           -- INGRESOS, PRODUCTO, EQUIPO, ALQUILER, CONTROLABLES, INTERNO
  computa_pyg boolean DEFAULT true,
  banda_min_pct numeric,
  banda_max_pct numeric,
  comportamiento text,            -- 'fijo', 'variable', 'puntual'
  activa boolean DEFAULT true,
  orden integer NOT NULL,         -- para ordenar dentro del padre
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

Migración:
1. Crear tabla nueva
2. Sembrar el árbol completo de B.3 con los IDs jerárquicos exactos
3. **NO eliminar** la tabla vieja `categorias_maestras` ni `categorias_contables` por ahora (se hace en otro chat)
4. **NO migrar** los 5.709 movs existentes a la nueva tabla (otro chat). En esta iteración, el campo `categoria` de `conciliacion` sigue apuntando a códigos antiguos
5. **MAPPING temporal de visualización**: en la tabla Movimientos (sección C), traducir códigos antiguos a IDs nuevos vía función helper:

```ts
// src/lib/categoryMapping.ts
const OLD_TO_NEW: Record<string, string> = {
  'ING-UE': '1.1.1',
  'ING-GL': '1.1.2',
  'ING-JE': '1.1.3',
  'ING-WEB': '1.1.4',
  'ING-DIR': '1.1.5',
  'PRD-MP': '2.11.1',  // Por defecto Mercadona si no hay regla concreta. La auto-asignación de proveedor se hace en otro chat
  'PRD-PCK': '2.12.1',
  'EQP-NOM': '2.21.1',
  'EQP-RUB': '2.21.2',
  'EQP-EMI': '2.21.3',
  'EQP-SS': '2.21.11',
  'EQP-FOR': '2.22.3',
  'LOC-ALQ': '2.31.1',
  'LOC-IRP': '2.31.2',
  'LOC-SUM': '2.44.2',
  'LOC-NET': '2.44.1',
  'LOC-MTO': '2.31.5',
  'CTR-MKT': '2.41.1',
  'CTR-SW': '2.43.2',
  'CTR-SEG': '2.43.10',
  'CTR-OTR': '2.43.10',
  'INT-TRF': '3.1',
  'INT-PRS': '3.3',
  'INT-IVA': '3.2',
};

export function mapCategoria(old: string | null): { id: string; nombre: string } | null {
  if (!old) return null;
  const newId = OLD_TO_NEW[old];
  if (!newId) return null;
  // buscar nombre en categorias_pyg por id
  return { id: newId, nombre: lookupNombre(newId) };
}
```

Si llega un código antiguo no mapeado → mostrar en tabla como `sin categoría` (badge punteado rojo).

## B.6 Criterios de aceptación · A + B

1. Sidebar muestra "Bancos y Cuentas" en lugar de "Categorías financieras"
2. Ruta `/configuracion/bancos-y-cuentas/categorias` accesible y default
3. Sub-tabs Cuentas / Categorías / Reglas visibles, Categorías activa
4. Tabla con header "ID · Nombre" estilo Oswald 10px letter-spacing 2px gris
5. Filas nivel 1 con ID rojo SL `#B01D23` Oswald 14px 600 letter-spacing 2px
6. Filas nivel 2 con ID gris `#3a4050` Oswald 11px 600 letter-spacing 1.5px
7. Filas nivel 3 con ID muted `#7a8090` Oswald 12px 500 letter-spacing 1px
8. Solo nivel 3 editable. Niveles 1 y 2 NO tienen input
9. Input nivel 3 transparente, focus border-bottom dashed `#FF4757`
10. Vacío + blur restaura nombre anterior con toast "Restaurado"
11. Edición exitosa toast "Detalle actualizado"
12. Papelera con 0 movs → elimina. Con N movs → modal bloqueante
13. BD nueva tabla `categorias_pyg` con árbol completo sembrado (sección B.3)
14. Mapping helper `mapCategoria(old)` funcional para Movimientos
15. Tablas viejas `categorias_maestras` y `categorias_contables` NO se borran ni se modifican

---

# C · CONCILIACIÓN — TAB MOVIMIENTOS

> El Tab "Resumen" de Conciliación NO se toca. SOLO se trabaja Movimientos.

## C.1 Layout general del Tab Movimientos

Orden vertical:

1. Header (título + filtros derecha)
2. Tabs (Resumen · **Movimientos** activa)
3. Fila 4 cards (Ingresos · Gastos · Pendientes · Titular)
4. Barra filtros (Buscador + Categoría + Exportar)
5. Tabla movimientos (8 columnas)
6. Modal click sobre movimiento (sección C.6)

## C.2 Header

```
<div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px; margin-bottom:18px">

  <div>
    <h1 style="font-family:'Oswald'; font-size:22px; font-weight:600; letter-spacing:3px; color:#B01D23; margin:0; text-transform:uppercase">Conciliación</h1>
    <div style="font-family:'Lexend'; font-size:13px; color:#7a8090; margin-top:4px">{fecha_inicio} — {fecha_fin}</div>
  </div>

  <div style="display:flex; gap:8px; flex-wrap:wrap">

    <!-- SelectorFechaUniversal idéntico al Panel Global -->
    <button class="dropdown">📅 {periodo} ▾</button>

    <!-- Cuenta -->
    <button class="dropdown">Cuenta · Todas ▾</button>

  </div>
</div>
```

Reglas:
- Subtítulo dinámico formato `dd/mm/yy — dd/mm/yy` con helper `formatearFechaCorta()`
- Default selector fecha: **Mes en curso**
- Dropdown botón: `padding:6px 10px; border-radius:8px; border:0.5px solid #d0c8bc; background:#fff; font-family:'Lexend'; font-size:13px; color:#111`
- Chevron literal: `▾` (NO `▼`, NO punto, NO icono)
- SelectorFechaUniversal: USAR el mismo componente compartido del Panel Global, las 7 opciones literales, persistencia sessionStorage activa
- Eliminar botón "+ Añadir gasto" (los movimientos entran por /importador)
- Eliminar dropdown "Todas las marcas" (no aplica a Conciliación)

## C.3 Tabs

```
<div style="display:inline-flex; gap:6px; background:#fff; border:0.5px solid #d0c8bc; border-radius:14px; padding:14px 18px; margin-bottom:14px">
  <button TAB_INACTIVA>Resumen</button>
  <button TAB_ACTIVA>Movimientos</button>
</div>
```

- TAB_ACTIVA: `padding:6px 14px; border-radius:6px; border:none; background:#FF4757; color:#fff; font-family:'Lexend'; font-size:13px; font-weight:500`
- TAB_INACTIVA: `padding:6px 14px; border-radius:6px; border:0.5px solid #d0c8bc; background:transparent; color:#3a4050; font-family:'Lexend'; font-size:13px; font-weight:500`

## C.4 Fila 4 cards

```
<div style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:14px">
  CARD_INGRESOS
  CARD_GASTOS
  CARD_PENDIENTES
  CARD_TITULAR
</div>
```

CSS común de los 4 cards:
```
.card {
  background: #fff;
  border: 0.5px solid #d0c8bc;
  border-radius: 14px;
  padding: 18px 20px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.card:hover { border-color: #FF475750 }
.cardSeleccionada {
  border: 1px solid #FF4757;
  box-shadow: 0 0 0 3px #FF475715;
}
```

### C.4.1 Card INGRESOS

```
<div class="card" onClick="filtrarPor('ingresos')">

  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px">
    <span style="font-family:'Oswald'; font-size:11px; font-weight:500; letter-spacing:2px; color:#7a8090; text-transform:uppercase">Ingresos</span>
    <span style="font-family:'Lexend'; font-size:11px; color:#7a8090">{n_movs} movs</span>
  </div>

  <div style="font-family:'Oswald'; font-size:30px; font-weight:600; line-height:1; letter-spacing:0.5px; margin:6px 0 4px; color:#1D9E75">
    +{importe} €
  </div>

  <div style="font-family:'Lexend'; font-size:11px; color:#7a8090; margin-top:10px">
    Bruto del periodo · click para filtrar
  </div>

</div>
```

Datos:
- `n_movs` = `COUNT(*) FROM conciliacion WHERE importe > 0 AND fecha BETWEEN periodo`
- `importe` = `SUM(importe) FROM conciliacion WHERE importe > 0 AND fecha BETWEEN periodo`
- Color cifra: `#1D9E75` siempre

### C.4.2 Card GASTOS

Idéntico al de Ingresos pero:
- Label: `Gastos`
- Cifra: `-{importe} €` color `#E24B4A`
- Footer: `Total gasto · click para filtrar`
- Filtra `importe < 0`

### C.4.3 Card PENDIENTES

```
<div class="card" onClick="filtrarPor('pendientes')">

  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px">
    <span class="cLbl">Pendientes</span>
    <span style="background:#F26B1F; color:#fff; padding:1px 8px; border-radius:9px; font-size:10px; font-weight:500; font-family:'Lexend'">{n_pendientes}</span>
  </div>

  <div style="font-family:'Oswald'; font-size:30px; font-weight:600; line-height:1; letter-spacing:0.5px; margin:6px 0 4px; color:#F26B1F">
    {importe_pendientes} €
  </div>

  <div style="font-family:'Lexend'; font-size:11px; color:#7a8090; margin-top:10px">
    Sin asociar · click para filtrar
  </div>

</div>
```

Datos:
- `n_pendientes` = `COUNT(*) FROM conciliacion WHERE estado = 'pendiente' AND fecha BETWEEN periodo`
- `importe_pendientes` = `SUM(importe) FROM conciliacion WHERE estado = 'pendiente' AND fecha BETWEEN periodo`
- Cifra y badge color: `#F26B1F` (naranja Rubén, mismo que TM Bruto Panel)

### C.4.4 Card TITULAR (toggle)

```
<div class="card">

  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px">
    <span class="cLbl">Titular</span>
    <span style="font-family:'Lexend'; font-size:11px; color:#7a8090">filtro activo</span>
  </div>

  <div style="font-family:'Oswald'; font-size:18px; font-weight:600; color:#111; margin:6px 0 8px">{titular_activo}</div>

  <div style="display:flex; gap:5px; margin-top:8px">
    <button class="tBtn" data-titular="todos">Todos</button>
    <button class="tBtn tBtnR" data-titular="ruben">Rubén</button>
    <button class="tBtn tBtnE" data-titular="emilio">Emilio</button>
  </div>

</div>
```

Estilos toggle:
```
.tBtn {
  flex: 1;
  padding: 5px 8px;
  border-radius: 6px;
  border: 0.5px solid #d0c8bc;
  background: #fff;
  font-family: 'Lexend';
  font-size: 12px;
  color: #3a4050;
  cursor: pointer;
  text-align: center;
  font-weight: 500;
}
.tBtn.activo[data-titular="todos"] {
  background: #3a4050;
  color: #fff;
  border-color: #3a4050;
}
.tBtn.activo[data-titular="ruben"] {
  background: #F26B1F;
  color: #fff;
  border-color: #F26B1F;
}
.tBtn.activo[data-titular="emilio"] {
  background: #1E5BCC;
  color: #fff;
  border-color: #1E5BCC;
}
```

Reglas:
- Default activo: **Todos**
- Click en Rubén filtra `WHERE titular_id = (SELECT id FROM titulares WHERE nombre='Rubén')`
- Click en Emilio idem para Emilio
- Solo un botón activo a la vez. Si pulso Todos, se quita filtro
- `titular_activo` muestra el label visible: "Todos" / "Rubén" / "Emilio"

### C.4.5 Selección visual del card filtro

Solo Ingresos / Gastos / Pendientes son cards-filtro mutuamente excluyentes. Card Titular es toggle independiente.

- Click sobre card Ingresos → marca como `cardSeleccionada` (borde y sombra accent), tabla filtra `importe > 0`
- Click sobre card Gastos → idem, tabla filtra `importe < 0`
- Click sobre card Pendientes → idem, tabla filtra `estado='pendiente'`
- Click sobre el card ya seleccionado → quita filtro, vuelve a estado default (sin filtro de signo/estado)
- Solo uno seleccionado a la vez de los 3

## C.5 Barra de filtros

```
<div style="display:flex; gap:10px; align-items:center; margin-bottom:14px; flex-wrap:wrap">

  <input
    type="text"
    placeholder="🔍 Buscar proveedor / nº factura / importe / concepto"
    style="flex:1; min-width:240px; padding:10px 14px; border-radius:10px; border:0.5px solid #d0c8bc; background:#fff; font-family:'Lexend'; font-size:13px; color:#111"
  />

  <button style="padding:10px 14px; border-radius:10px; border:0.5px solid #d0c8bc; background:#fff; font-family:'Lexend'; font-size:13px; color:#111; min-width:280px; cursor:pointer; display:inline-flex; align-items:center; gap:8px; justify-content:space-between">
    <span><span style="color:#7a8090">Categoría · </span>Todas las categorías</span>
    <span style="color:#7a8090">▾</span>
  </button>

  <button style="padding:10px 18px; border-radius:10px; border:0.5px solid #d0c8bc; background:#fff; font-family:'Lexend'; font-size:13px; color:#3a4050; cursor:pointer; font-weight:500">⤓ Exportar</button>

</div>
```

Reglas:
- Buscador: filtra en tiempo real `concepto`, `contraparte`, `importe` (texto), `nro_factura` si existe
- Dropdown Categoría: ancho **mínimo 280px** para que se lean los nombres completos. Lista las categorías nivel 3 + opción "Todas las categorías" (default)
- Botón Exportar: SOLO botón, NO dropdown. Click → genera CSV/Excel con los movimientos filtrados actuales

## C.6 Tabla movimientos

```
<table class="movs">
  <thead>
    <tr>
      <th>Fecha</th>
      <th>Concepto</th>
      <th>Contraparte</th>
      <th class="right">Importe</th>
      <th>Categoría</th>
      <th class="center">Doc</th>
      <th>Estado</th>
      <th>Titular</th>
    </tr>
  </thead>
  <tbody>{filas}</tbody>
</table>
```

CSS:
```
table.movs {
  width: 100%;
  background: #fff;
  border: 0.5px solid #d0c8bc;
  border-radius: 14px;
  border-collapse: separate;
  border-spacing: 0;
  overflow: hidden;
  font-family: 'Lexend';
  font-size: 13px;
}
table.movs thead th {
  font-family: 'Oswald';
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 2px;
  color: #7a8090;
  text-transform: uppercase;
  text-align: left;
  padding: 14px 16px;
  background: #f5f3ef;
  border-bottom: 0.5px solid #d0c8bc;
  white-space: nowrap;
}
table.movs thead th.right { text-align: right }
table.movs thead th.center { text-align: center }
table.movs tbody td {
  padding: 14px 16px;
  border-bottom: 0.5px solid #ebe8e2;
  color: #111;
  vertical-align: middle;
}
table.movs tbody tr:last-child td { border-bottom: none }
table.movs tbody tr { cursor: pointer }
table.movs tbody tr:hover { background: #f5f3ef60 }
```

### C.6.1 Render por columna

| Columna | Contenido |
|---|---|
| **Fecha** | `{dd/mm/yy}` Lexend 12px color `#7a8090` whitespace nowrap |
| **Concepto** | Texto crudo banco. Lexend 13px color `#111`. Truncar a 40 chars con `…` si excede |
| **Contraparte** | Nombre proveedor identificado o "Sin identificar" gris si null |
| **Importe** | `+1.234,56 €` o `-1.234,56 €` Oswald 14px 500 align right. Verde `#1D9E75` si positivo, rojo `#E24B4A` si negativo |
| **Categoría** | Badge categoría (sección C.6.2) |
| **Doc** | Icono según estado (sección C.6.3) |
| **Estado** | Badge estado (sección C.6.4) |
| **Titular** | Badge titular (sección C.6.5) |

### C.6.2 Badge Categoría

Si tiene categoría asignada (mapeada de `categoria` antiguo o nueva):
```
<span style="display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:6px; background:#f5f3ef; border:0.5px solid #d0c8bc; font-family:'Lexend'; font-size:12px; color:#3a4050; white-space:nowrap">
  <span style="font-family:'Oswald'; font-size:10px; letter-spacing:1px; color:#7a8090; font-weight:500">2.11.1</span>
  Mercadona
</span>
```

Si NO tiene categoría (campo null o código antiguo no mapeado):
```
<span style="display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:6px; background:#E24B4A10; border:0.5px dashed #E24B4A50; font-family:'Lexend'; font-size:12px; color:#E24B4A; font-style:italic">
  sin categoría
</span>
```

### C.6.3 Columna Doc

Tres estados:

| Caso | Render |
|---|---|
| Tiene factura asociada en Drive | `<span style="color:#7a8090; font-size:14px">📎</span>` |
| Falta factura | `<span style="color:#E24B4A; font-size:14px">✕</span>` |
| Marcado "no requiere documento" | `<span style="color:#1D9E75; font-size:11px; font-family:'Lexend'">no requiere</span>` |

Datos: campo `doc_estado` en `conciliacion` con valores `'tiene' | 'falta' | 'no_requiere'`. Default `'falta'` para movs nuevos sin factura asociada.

### C.6.4 Badge Estado

Solo 2 estados posibles:

```
<!-- CONCILIADO -->
<span style="display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:6px; font-family:'Oswald'; font-size:10px; letter-spacing:1.5px; font-weight:500; text-transform:uppercase; background:#1D9E7515; color:#0F6E56">
  ● Conciliado
</span>

<!-- PENDIENTE -->
<span style="display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:6px; font-family:'Oswald'; font-size:10px; letter-spacing:1.5px; font-weight:500; text-transform:uppercase; background:#E24B4A15; color:#E24B4A">
  ● Pendiente
</span>
```

**REGLA DE ESTADO (única):**

```
estado = 'conciliado' SI Y SOLO SI:
  - tiene categoría asignada (categoria != null)
  Y
  - doc_estado IN ('tiene', 'no_requiere')

en cualquier otro caso → estado = 'pendiente'
```

Esta regla se calcula automáticamente en BD via trigger o en cada lectura. NO es un campo editable manualmente.

### C.6.5 Badge Titular

```
<!-- RUBÉN -->
<span style="display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:6px; font-family:'Lexend'; font-size:12px; font-weight:500; background:#F26B1F15; color:#F26B1F; white-space:nowrap">
  <span style="width:6px; height:6px; border-radius:50%; background:#F26B1F"></span>
  Rubén
</span>

<!-- EMILIO -->
<span style="display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:6px; font-family:'Lexend'; font-size:12px; font-weight:500; background:#1E5BCC15; color:#1E5BCC; white-space:nowrap">
  <span style="width:6px; height:6px; border-radius:50%; background:#1E5BCC"></span>
  Emilio
</span>
```

Datos: campo `titular_id` ya existe en `conciliacion`. Resolver join con tabla `titulares` para obtener nombre. Detección automática por NIF (Rubén `21669051S`, Emilio `53484832B`) ya implementada, no tocar.

Si `titular_id` es null → mostrar texto gris "—" (no debería pasar tras auto-detección).

## C.7 Modal click sobre movimiento

Al click sobre cualquier fila de la tabla, abrir modal modal claro centrado con overlay oscuro.

### C.7.1 Overlay

```
<div style="position:fixed; inset:0; background:rgba(17,17,17,0.5); display:flex; align-items:center; justify-content:center; z-index:50">
  {modal}
</div>
```

### C.7.2 Modal estructura literal

```
<div style="background:#fff; border:0.5px solid #d0c8bc; border-radius:14px; padding:28px 32px; max-width:560px; width:90%; box-shadow:0 8px 30px rgba(0,0,0,0.06)">

  <!-- TOP -->
  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px">
    <div>
      <div style="font-family:'Oswald'; font-size:10px; letter-spacing:2px; color:#7a8090; text-transform:uppercase; margin-bottom:4px">Detalle movimiento · {dd/mm/yy}</div>
      <div style="font-family:'Oswald'; font-size:18px; font-weight:600; color:#111; letter-spacing:0.5px">{concepto}</div>
    </div>
    <button style="font-size:18px; color:#7a8090; cursor:pointer; background:transparent; border:none; padding:0">✕</button>
  </div>

  <!-- DATOS -->
  <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px 16px; margin-bottom:22px; font-size:13px; padding:14px 0; border-top:0.5px solid #ebe8e2; border-bottom:0.5px solid #ebe8e2">
    <div style="color:#7a8090; font-family:'Lexend'">Importe</div>
    <div style="font-family:'Oswald'; font-weight:500; letter-spacing:0.5px; color:{verde_o_rojo}; text-align:right">{importe} €</div>
    <div style="color:#7a8090; font-family:'Lexend'">Contraparte</div>
    <div style="font-family:'Oswald'; font-weight:500; letter-spacing:0.5px; color:#111; text-align:right">{contraparte}</div>
  </div>

  <!-- CATEGORÍA · 3 selects encadenados -->
  <div style="margin-bottom:18px">
    <label style="display:block; font-family:'Oswald'; font-size:10px; letter-spacing:2px; color:#7a8090; text-transform:uppercase; margin-bottom:8px">Categoría</label>
    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px">
      <select id="bloque">{opciones bloques}</select>
      <select id="subgrupo">{opciones subgrupos del bloque}</select>
      <select id="detalle">{opciones detalles del subgrupo}</select>
    </div>
  </div>

  <!-- TITULAR -->
  <div style="margin-bottom:18px">
    <label style="display:block; font-family:'Oswald'; font-size:10px; letter-spacing:2px; color:#7a8090; text-transform:uppercase; margin-bottom:8px">Titular</label>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px">
      <button data-tit="ruben" class="titBtn">Rubén</button>
      <button data-tit="emilio" class="titBtn">Emilio</button>
    </div>
  </div>

  <!-- CHECKBOX -->
  <label style="display:flex; align-items:center; gap:10px; font-family:'Lexend'; font-size:13px; color:#3a4050; cursor:pointer; margin-bottom:22px; padding:10px 12px; background:#f5f3ef; border-radius:8px">
    <input type="checkbox" id="noRequiere" style="width:16px; height:16px; accent-color:#FF4757; margin:0">
    <span>No requiere documento</span>
  </label>

  <!-- FOOTER -->
  <div style="display:flex; justify-content:flex-end; gap:8px">
    <button class="btnSecundario">Cancelar</button>
    <button class="btnPrimario">Guardar</button>
  </div>

</div>
```

### C.7.3 Estilos componentes modal

**Selects encadenados:**
```
.modalSel {
  padding: 9px 12px;
  border-radius: 8px;
  border: 0.5px solid #d0c8bc;
  background: #fff;
  color: #111;
  font-family: 'Lexend';
  font-size: 13px;
  cursor: pointer;
  width: 100%;
  box-sizing: border-box;
  min-height: 38px;
}
.modalSel.activo {
  background: #FF475710;
  border-color: #FF4757;
  color: #FF4757;
  font-weight: 500;
}
```

**Toggle titular modal:**
```
.titBtn {
  padding: 10px;
  border-radius: 8px;
  border: 0.5px solid #d0c8bc;
  background: #fff;
  color: #3a4050;
  font-family: 'Lexend';
  font-size: 13px;
  cursor: pointer;
  text-align: center;
  font-weight: 500;
}
.titBtn[data-tit="ruben"].activo {
  background: #F26B1F;
  border-color: #F26B1F;
  color: #fff;
}
.titBtn[data-tit="emilio"].activo {
  background: #1E5BCC;
  border-color: #1E5BCC;
  color: #fff;
}
```

**Botones footer:**
```
.btnPrimario {
  padding: 8px 18px;
  border-radius: 8px;
  border: none;
  background: #FF4757;
  color: #fff;
  font-family: 'Lexend';
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.btnSecundario {
  padding: 8px 18px;
  border-radius: 8px;
  border: 0.5px solid #d0c8bc;
  background: transparent;
  color: #3a4050;
  font-family: 'Lexend';
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
```

### C.7.4 Lógica del modal

1. Al abrir, precargar valores actuales del movimiento:
   - 3 selects categoría: navegar el árbol según `categoria_id` actual (si está mapeado)
   - Toggle titular: el titular actual marcado
   - Checkbox `noRequiere`: marcado si `doc_estado === 'no_requiere'`

2. Selects encadenados:
   - Cambiar bloque → reset subgrupo y detalle, reload subgrupos del bloque
   - Cambiar subgrupo → reset detalle, reload detalles del subgrupo
   - Cambiar detalle → setea `categoria_id` final

3. Toggle titular: solo uno activo. Click cambia activo

4. Checkbox: toggle `noRequiere` (booleano)

5. Click Guardar:
   - Update fila `conciliacion`: set `categoria` (con código viejo correspondiente al nuevo ID via mapping inverso por compatibilidad), `titular_id`, `doc_estado` ('no_requiere' si checkbox marcado, sino mantener valor anterior 'tiene'/'falta')
   - Recalcular `estado` con la regla única de C.6.4
   - Cerrar modal
   - Toast "Movimiento actualizado"
   - Refrescar fila en tabla sin recargar página completa

6. Click Cancelar o ✕: cerrar sin guardar

7. Click overlay (fuera del modal): cerrar sin guardar

### C.7.5 NO incluir en el modal

- ❌ NO mostrar número de cuenta
- ❌ NO mostrar concepto bancario debajo de la cabecera (ya está en la cabecera)
- ❌ NO tooltip "ej. comisiones banco" debajo del checkbox
- ❌ NO botones "Reasignar factura" / "Recategorizar" / "No requiere doc" del modal viejo
- ❌ NO subir documentos desde aquí (eso va en /importador)

## C.8 Flujo completo (para validar)

1. Usuario sube extracto a `/importador` → toast progreso → datos cargados a `conciliacion`
2. Auto-categorización aplica reglas existentes en BD (no tocar lógica, ya funciona)
3. Auto-detección titular por NIF aplica (no tocar)
4. Usuario va a `/conciliacion/movimientos` y ve la tabla con todo categorizado
5. Por defecto `doc_estado='falta'` → estado se calcula como `pendiente` (a menos que sea categoría interna sin doc requerido — eso lo gestiona el usuario marcando checkbox)
6. Usuario click en una fila → modal abre → ajusta categoría / titular / no requiere doc → guarda
7. Si Drive tiene factura coincidente: cron o trigger marca `doc_estado='tiene'` y asocia ruta → estado pasa a conciliado automáticamente
8. Si subes factura nueva por /importador → ERP busca match → si encuentra, actualiza `doc_estado='tiene'`

## C.9 Criterios de aceptación · C

1. Tab "Resumen" intacto, NO modificado
2. Header con título PANEL `#B01D23` Oswald 22px 600, subtítulo `dd/mm/yy — dd/mm/yy`
3. SelectorFechaUniversal del Panel REUTILIZADO con sus 7 opciones literales
4. NO botón "+ Añadir gasto", NO dropdown "Todas las marcas"
5. 4 cards arriba: Ingresos verde · Gastos rojo · Pendientes naranja `#F26B1F` · Titular toggle
6. Card seleccionada (Ingresos/Gastos/Pendientes) marcada con borde `1px solid #FF4757` + sombra `0 0 0 3px #FF475715`
7. Solo una de las 3 cards filtro activa a la vez
8. Card Titular toggle independiente, default Todos
9. Click en Rubén cambia toggle naranja `#F26B1F`, en Emilio azul `#1E5BCC`
10. Buscador full-flex, dropdown Categoría min-width 280px, botón Exportar simple
11. Tabla con 8 columnas literales en orden: Fecha · Concepto · Contraparte · Importe · Categoría · Doc · Estado · Titular
12. Columna Categoría con badge `2.11.1 Mercadona` (ID Oswald 10px + nombre Lexend 12px)
13. Sin categoría → badge dashed rojo "sin categoría"
14. Doc 📎 (gris si tiene) / ✕ (rojo si falta) / "no requiere" (verde si checkbox marcado)
15. Estado "Conciliado" verde / "Pendiente" rojo según regla única de C.6.4
16. Titular badge color titular Rubén `#F26B1F` / Emilio `#1E5BCC`
17. Modal modo claro al click sobre fila
18. Modal con: Importe, Contraparte, 3 selects categoría encadenados, Toggle titular, Checkbox no requiere, Cancelar/Guardar
19. Modal NO muestra cuenta, NO concepto repetido, NO ejemplo en checkbox
20. Click overlay o ✕ cierra sin guardar
21. Guardar update BD + toast + refresca fila sin reload
22. Estado se recalcula automáticamente tras guardar
23. Build limpio 0 errores
24. Aislamiento Binagre absoluto
25. Deploy Vercel autorizado al final

---

# CRITERIOS DE ACEPTACIÓN GLOBALES (todos los entregables)

1. Sidebar item renombrado "Categorías financieras" → "Bancos y Cuentas"
2. Ruta `/configuracion/bancos-y-cuentas/categorias` accesible
3. 3 sub-tabs (Cuentas / Categorías / Reglas), Categorías default
4. Tabla categorías 3 niveles con árbol completo de B.3 sembrado
5. Solo nivel 3 editable inline
6. BD `categorias_pyg` creada y sembrada
7. Helper `mapCategoria()` operativo
8. Tab Resumen Conciliación intacto
9. Tab Movimientos reescrito completo
10. 4 cards arriba con cifras reales BD del periodo seleccionado
11. Card seleccionada filtra tabla
12. Toggle titular funcional
13. Tabla 8 columnas con render literal
14. Modal modo claro funcional con guardado real BD
15. Estado calculado automáticamente con regla única
16. Helpers `formatearEuros` y `formatearFechaCorta` aplicados consistentemente
17. Tokens canónicos guía Notion · NO hex hardcoded fuera lista
18. Build 0 errores tsc + vite
19. Aislamiento Binagre absoluto
20. Deploy Vercel `npx vercel --prod`

---

# ENTREGABLES FINALES

1. Implementación A + B + C completas
2. BD migración `categorias_pyg` aplicada
3. Helper `mapCategoria` y mapping antiguo → nuevo
4. Componentes React extraídos limpios
5. Build limpio
6. Commit + push master
7. Deploy Vercel
8. Informe final: URL deploy + 20 criterios pasados/fallados + decisiones tomadas + archivos modificados

---

# DECISIONES AUTÓNOMAS PERMITIDAS

- Estructura de archivos / componentes
- Refactor cálculos
- Skeleton loaders durante fetch
- Animación 0.15s ease en transiciones cards
- Mock data fallback con flag `datos demo` si BD vacía

NO autónomo:
- Cambios tokens (van a guía Notion antes)
- Cambios estructura BD existente (preguntar)
- Modificar SelectorFechaUniversal (reutilizar como está)
- Modificar Tab Resumen Conciliación
- Borrar tablas viejas `categorias_maestras` o `categorias_contables`
- Migrar movimientos viejos a tabla nueva (otro chat)
- Saltar criterios de aceptación
