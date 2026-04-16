# Streat Lab ERP — Estado del proyecto

**Fecha:** 2026-04-16
**Repo:** https://github.com/Streatlab/streatlab-erp
**Deploy:** https://streatlab-erp.vercel.app
**Supabase:** https://eryauogxcpbgdryeimdq.supabase.co
**Stack:** React 19 + TypeScript + Vite 8 + Tailwind 4 + Supabase

## Estructura del proyecto

```
src/
  pages/
    Login.tsx          ✅ Funcionando (PIN + nombre)
    Dashboard.tsx      ✅ Funcionando (KPIs, ventas, canales)
    Escandallo.tsx     ✅ Recién construido (4 pestañas)
    Facturacion.tsx    ✅ Funcionando (diario/semanas/meses + modal)
    POS.tsx            ⬜ Placeholder "En construcción"
    Marcas.tsx         ⬜ Placeholder
    Proveedores.tsx    ⬜ Placeholder
    Running.tsx        ⬜ Placeholder
  components/
    Layout.tsx         ✅ Sidebar + responsive mobile
    Sidebar.tsx        ✅ Navegación con roles (admin/cocina)
    escandallo/
      types.ts         ✅ Interfaces + constantes + helpers
      TabIngredientes  ✅ 19 columnas, solo lectura
      TabMermas        ✅ 26 columnas, solo lectura
      TabEPS           ✅ Tabla clickable con fecha
      TabRecetas       ✅ Tabla con margen% Uber + semáforo
      ModalEPS         ✅ Edición + líneas + cálculo costes
      ModalReceta      ✅ PVPs + líneas + waterfall Real/Cash
  context/
    AuthContext.tsx     ✅ Login con Supabase (tabla usuarios)
  lib/
    supabase.ts        ✅ Cliente Supabase
```

## Módulos construidos y funcionando

### 1. Login
- Autenticación por nombre + PIN (4 dígitos)
- Roles: admin, cocina
- Persistencia en localStorage

### 2. Dashboard
- KPIs: ventas hoy, pedidos hoy, ticket medio, ventas semana
- Desglose por canal: Uber Eats, Glovo, Just Eat, Web
- Top 5 días con más ventas
- Gráfico bruto últimas 4 semanas

### 3. Facturación
- Tabs: diario / semanas / meses
- Modal para añadir/editar registros
- Export CSV
- Tabla completa con totales y desviaciones

### 4. Escandallo (recién construido)
4 pestañas completas:

**Ingredientes** — Solo lectura, 19 columnas:
IDING, Nombre, Categoría, ABV, Marca, Formato, UDS, UD STD, UD MIN, Usos, Precio1/2/3, Activo, EUR/STD, EUR/MIN, Merma%, C.Neto/STD, C.Neto/MIN

**Mermas** — Solo lectura, 26 columnas:
IDING, Nombre, UDS, UD STD, Precio Total, SP1/SP2 (nombre, peso, %, euros, valorable), %SP1, %SP2, %Descarte, %Merma, %Limpio, Eur Pieza Limpia, Eur/Kg Neto, Neto(Kg), Nº Porciones, Peso Porción, Eur/Porción

**EPS** — Tabla + modal edición:
- Tabla: Código, Nombre, Raciones, Tamaño Rac, Unidad, Coste Tanda, Coste/Rac, Fecha
- Modal: campos editables + tabla líneas con selector de ingredientes
- Cálculos automáticos: €total, %total, coste tanda, coste ración
- Guardado en eps + eps_lineas

**Recetas** — Tabla + modal con waterfall:
- Tabla: Código, Nombre, Raciones, Coste/Rac, PVP Uber, Margen%, Semáforo
- Margen% = (PVP/1.1 - coste_rac - PVP×0.30) / (PVP/1.1)
- Modal: nombre, raciones, tamaño ración, PVPs por 5 canales
- Líneas: tipo ING/EPS, selector, cantidad, unidad, €/ud, €total, %
- Waterfall por canal (solo canales con PVP > 0):
  - Comisiones: Uber/Glovo 30%, JE 20%, Web 7%, Directa 0%
  - Columnas Real y Cash
  - Coste MP, estructura 36%, plataforma, coste total
  - PVP recomendado = (CosteMP×1.1)/(1-0.36-com%-0.15)
  - K multiplicador, Margen€, %Margen con semáforo
  - IVA neto, Provisión IVA/ped
  - Guardado en recetas + recetas_lineas

## Tablas Supabase

| Tabla | Estado |
|-------|--------|
| usuarios | ✅ Datos cargados |
| facturacion_diario | ✅ Datos cargados |
| ingredientes | ✅ ~250 registros |
| mermas | ✅ Datos cargados |
| eps | ✅ ~50 registros |
| eps_lineas | ✅ Estructura lista |
| recetas | ✅ ~30 registros |
| recetas_lineas | ✅ Estructura lista |

## SQL pendiente de ejecutar

El archivo `supabase-migration.sql` en la raíz del proyecto contiene ALTERs necesarios para:
- ingredientes: columnas nombre_base, abv, formato, uds, precios, ud_std/min, merma_ef, costes netos
- eps: columna fecha
- recetas_lineas: columnas ingrediente_id, eps_id, cantidad, unidad, eur_ud_neta, eur_total, pct_total

**EJECUTAR EN SUPABASE SQL EDITOR si no se ha hecho ya.**

## Pendiente por construir

- **POS** — Punto de venta / caja
- **Marcas** — Gestión de marcas virtuales
- **Proveedores** — Gestión de proveedores y pedidos
- **Running** — Operativa diaria / running costs

## Errores conocidos / mejoras pendientes

1. Las tablas de Ingredientes y Mermas son muy anchas (19 y 26 columnas) — funcionan con scroll horizontal pero en móvil son difíciles de leer. Considerar vista colapsable o detalle al click.
2. El waterfall de Recetas solo se muestra para canales con PVP > 0. Si todos los PVPs están a 0, no aparece waterfall (comportamiento correcto).
3. Los datos de eps_lineas y recetas_lineas pueden estar vacíos si las recetas se importaron sin líneas de detalle. El modal muestra "Sin líneas" correctamente.
4. La fórmula de IVA neto del waterfall sigue la del Excel: `(PVP−PVP×com%×1.21)/1.1×0.1−PVP×com%×0.21`. Verificar que cuadra con los resultados esperados.

## Diseño

- Fondo: #0a0a0a (bg-base)
- Cards: #141414 (bg-card)
- Bordes: #1f1f1f (border-border)
- Acento: #e8f442 (text-accent)
- Fuente: Inter
- Semáforo: verde >15%, amarillo 10-15%, rojo <10%
