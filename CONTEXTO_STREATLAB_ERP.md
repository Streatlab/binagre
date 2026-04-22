# PROTOCOLO DE INICIO — LEE ESTO PRIMERO

## Si Rubén cambia de ordenador o abre un chat nuevo:
1. Ejecutar en CMD:
   ```
   cd C:\streatlab-erp && git pull origin master
   ```
   (En el bar: `cd C:\Users\ruben\streatlab-erp && git pull origin master`)

2. Primera línea de cualquier prompt nuevo en Claude Code:
   ```
   cat CONTEXTO_STREATLAB_ERP.md
   ```

3. URL del contexto completo (para chats web sin acceso al filesystem):
   https://binagre.vercel.app/CONTEXTO_STREATLAB_ERP.md

## Reglas de trabajo
- Respuestas: listas numeradas, sin párrafos, directas
- Prompts para Claude Code → siempre como archivo descargable
- Scripts GAS: siempre completos
- NUNCA usar @/integrations/supabase/client → siempre @/lib/supabase
- Siempre terminar con: git add . && git commit -m "..." && git push origin master

## Cuando Rubén diga "estoy en casa" o "estoy en el bar":

**EN CASA:**
```
cd C:\streatlab-erp && git pull origin master && claude --dangerously-skip-permissions
```

**EN EL BAR:**
```
cd C:\Users\ruben\streatlab-erp && git pull origin master && claude --dangerously-skip-permissions
```

Después de arrancar Claude Code, dile:
```
cat CONTEXTO_STREATLAB_ERP.md
```

Para el siguiente chat web, dile a Rubén que pegue esto al inicio:
```
Lee el contexto antes de empezar: https://binagre.vercel.app/CONTEXTO_STREATLAB_ERP.md
```
O si no funciona Vercel:
```
https://gist.githubusercontent.com/Streatlab/5c4164392ba1dc220c897fda6a3adf96/raw/CONTEXTO_STREATLAB_ERP.md
```

---

# CONTEXTO STREAT LAB ERP — Actualizado 2026-04-21

## STACK
React 19 + TypeScript + Vite + Tailwind + Supabase + Vercel
- Repo: github.com/Streatlab/streatlab-erp
- Deploy: binagre.vercel.app
- Supabase: eryauogxcpbgdryeimdq.supabase.co
- Rama: master (Production Branch en Vercel)
- Rutas: Casa C:\streatlab-erp | Bar C:\Users\ruben\streatlab-erp

## REGLA CRÍTICA DE IMPORTS
SIEMPRE usar `@/lib/supabase` — NUNCA `@/integrations/supabase/client`
SIEMPRE terminar con git add . && git commit -m "..." && git push origin master

---

## DESIGN SYSTEM — src/styles/tokens.ts

### Importar siempre así:
```tsx
import { useTheme, groupStyle, cardStyle, sectionLabelStyle, FONT, semaforoColor, CANALES } from '@/styles/tokens'
const { T, isDark } = useTheme()
```

### Colores modo oscuro:
- bg: #0d1120 | group: #131928 | card: #1a1f32 | brd: #2a3050
- pri: #f0f0ff | sec: #9ba8c0 | mut: #5a6880 | emphasis: #e8f442

### Colores modo claro:
- bg: #f5f3ef | group: #ebe8e2 | card: #ffffff | brd: #d0c8bc
- pri: #111111 | sec: #3a4050 | mut: #7a8090 | emphasis: #B01D23

### Semáforos:
- Verde: #1D9E75 (≥80%) | Naranja: #f5a623 (50-79%) | Rojo: #E24B4A (<50%)
- Usar: `semaforoColor(pct)` — devuelve el color correcto

### Fuentes:
- FONT.heading = 'Oswald, sans-serif' (headers, labels, uppercase)
- FONT.body = 'Lexend, sans-serif' (texto, datos, inputs)

### Canales:
- Uber Eats: #06C167 | Glovo: #e8f442/#8a7800 | Just Eat: #f5a623
- Web: #B01D23 | Directa: #66aaff

---

## PATRONES DE CÓDIGO OBLIGATORIOS

### Wrapper exterior de cualquier módulo/sección:
```tsx
<div style={{
  background: T.group,
  border: `0.5px solid ${T.brd}`,
  borderRadius: 16,
  padding: '24px 28px',
}}>
```

### Header de tabla:
```tsx
const thStyle: React.CSSProperties = {
  fontFamily: FONT.heading,
  fontSize: 10,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  color: T.mut,
  padding: '8px 10px',
  background: T.group,
  borderBottom: `0.5px solid ${T.brd}`,
  fontWeight: 400,
  textAlign: 'left',
  whiteSpace: 'nowrap',
}
```

### Celda de tabla:
```tsx
const tdStyle: React.CSSProperties = {
  fontFamily: FONT.body,
  fontSize: 13,
  color: T.pri,
  padding: '8px 10px',
  borderBottom: `0.5px solid ${T.brd}`,
  whiteSpace: 'nowrap',
}
```

### Tabla con scroll horizontal (obligatorio para tablas anchas):
```tsx
<div style={{ overflowX: 'auto', borderRadius: 8, border: `0.5px solid ${T.brd}` }}>
  <table style={{ borderCollapse: 'collapse', tableLayout: 'auto', minWidth: 'max-content' }}>
```

### Input / Select:
```tsx
const inputStyle: React.CSSProperties = {
  background: isDark ? '#3a4058' : '#ffffff',
  border: `1px solid ${isDark ? '#4a5270' : '#d0c8bc'}`,
  color: T.pri,
  fontFamily: FONT.body,
  fontSize: 13,
  borderRadius: 8,
  padding: '7px 10px',
}
```

### Botón tab activo / inactivo:
```tsx
// Activo:
{ background: T.emphasis, color: isDark ? '#1a1a00' : '#ffffff', border: 'none', borderRadius: 8, padding: '6px 14px', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', cursor: 'pointer' }
// Inactivo:
{ background: 'none', color: T.sec, border: `0.5px solid ${T.brd}`, borderRadius: 8, padding: '6px 14px', fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1.5px', cursor: 'pointer' }
```

### Semáforo en badge:
```tsx
const pct = 32.5 // porcentaje
const col = semaforoColor(pct)
<span style={{ background: col + '22', color: col, padding: '2px 8px', borderRadius: 99, fontFamily: FONT.heading, fontSize: 11 }}>
  {pct.toFixed(2)}%
</span>
```

---

## MÓDULOS CONSTRUIDOS

### Dashboard (/)
KPIs semana actual, pedidos y TM por canal, días pico, top ventas, objetivos.
Canales: Uber Eats, Glovo, Just Eat, Web, Directa.

### Facturación (/facturacion)
3 tabs: Diario / Semanas / Meses.
Filtro servicios: 3 botones Todos / ALM / CENAS.
Filtro canales: dropdown multi-selección con checkboxes.
Modal añadir día: grid 2 columnas, visible sin scroll.
KPI HOY: formato "Martes, 21" sin mes.

### Objetivos (/finanzas/objetivos)
4 cards generales: HOY / SEMANA / MES / AÑO con botón Editar.
7 cards días semana Lun-Dom con fechas reales. Finde en verde, festivos en naranja.
Festivos Madrid 2026 hardcodeados (15 fechas).
Cumplimiento actual S17/Mes/Año con semáforo.
Histórico 6 semanas con selector año.

### Escandallo (/cocina/escandallo)
5 tabs internos: Índice / Ingredientes / Mermas / EPS / Recetas
Buscador global cross-module (nombre + ingredientes contenidos).
Índice: botones TOTAL/EPS/RECETAS filtran tabla. USOS calculado desde recetas_lineas.
Recetas: waterfall pricing por canal (5 canales).
% margen con semaforoColor de tokens.

### Cocina/Recetas (/cocina/recetas)
Módulo independiente del Escandallo.
Lista izquierda + ficha derecha.
Campos editables: elaboración, alérgenos, categoría.
Punto verde = tiene elaboración, rojo = sin elaboración.
Guarda en Supabase tabla recetas (columnas: elaboracion, alergenos, foto_url).

---

## SIDEBAR — ESTRUCTURA ACTUAL

PANEL GLOBAL
FINANZAS → Facturación, Objetivos, Análisis, Revenue & Ticket, COGS/Coste MP, Margen por Canal, Ventas por Marca, Ranking Productos, Predicción Demanda, Tesorería, Cobros, Pagos, Presupuestos, Remesas
COCINA → Escandallo, Menú Engineering, Inventario, Recetas
OPERACIONES
STOCK & COMPRAS
POS & PEDIDOS
MARCAS
MARKETING → Embudo
EQUIPO
CLIENTES & CRM
INFORMES & ESTADÍSTICAS
CONFIGURACIÓN

---

## TABLAS SUPABASE PRINCIPALES

```
facturacion_diario: fecha, servicio, canal, pedidos, bruto
recetas: id, codigo, nombre, raciones, categoria, coste_rac, pvp_uber/glovo/je/web/directa, elaboracion, alergenos, foto_url
recetas_lineas: receta_id, linea, tipo, ingrediente_nombre, ingrediente_id, eps_id, cantidad, unidad, eur_total
eps: id, codigo, nombre, coste_tanda, coste_rac, raciones, fecha
eps_lineas: eps_id, ingrediente_id, ingrediente_nombre, cantidad, unidad, eur_total
ingredientes: id, codigo, nombre, categoria, proveedor, precio, unidad
mermas: id, codigo, nombre, subproductos
objetivos: tipo (diario/semanal/mensual/anual), importe
objetivos_dia_semana: dia (1-7), importe
```

---

## PROVEEDORES ACTIVOS
ALC=Alcampo, MER=Mercadona, CHI=China veldula, JAS=Jasa, PAM=Pampols, ENV=Envapro, EMB=Embajadores, TGT=Tgt, PAS=Pascual, LID=Lidl

## USUARIOS
Ruben (admin, todos los módulos) / Emilio (cocina — Dashboard + Escandallo)
REPO GITHUB: https://github.com/Streatlab/binagre.git
Remote correcto: git remote set-url origin https://github.com/Streatlab/binagre.git
