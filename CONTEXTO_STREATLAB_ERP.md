# Streat Lab ERP — Estado del proyecto

**Fecha:** 2026-04-16
**Repo:** https://github.com/Streatlab/streatlab-erp (privado)
**Deploy:** https://streatlab-erp.vercel.app
**Supabase:** https://eryauogxcpbgdryeimdq.supabase.co
**Stack:** React 19 + TypeScript + Vite 8 + Tailwind 4 + Supabase

## Estructura del proyecto

```
src/
  pages/
    Login.tsx          ✅ Funcionando
    Dashboard.tsx      ✅ Funcionando
    Escandallo.tsx     ✅ Construido (4 pestañas)
    Facturacion.tsx    ✅ Funcionando
    POS.tsx            ⬜ Placeholder
    Marcas.tsx         ⬜ Placeholder
    Proveedores.tsx    ⬜ Placeholder
    Running.tsx        ⬜ Placeholder
  components/
    Layout.tsx         ✅ Sidebar + responsive
    Sidebar.tsx        ✅ Nav con roles
    escandallo/
      types.ts         ✅ Interfaces + constantes
      TabIngredientes  ✅ 19 columnas
      TabMermas        ✅ 26 columnas
      TabEPS           ✅ Tabla + click → modal
      TabRecetas       ✅ Tabla + margen + semáforo
      ModalEPS         ✅ Líneas + cálculos + guardar
      ModalReceta      ✅ Líneas + waterfall Real/Cash
  context/AuthContext  ✅ Login Supabase
  lib/supabase.ts      ✅ Cliente
```

## Módulos funcionando

### Login
PIN + nombre, roles admin/cocina, localStorage

### Dashboard
KPIs (ventas, pedidos, ticket medio), desglose canales, top 5 días, gráfico 4 semanas

### Facturación
Tabs diario/semanas/meses, modal CRUD, export CSV

### Escandallo — 4 pestañas

**Ingredientes** — Solo lectura, 19 columnas:
IDING, Nombre, Categoría, ABV, Marca, Formato, UDS, UD STD/MIN, Usos, Precio1/2/3, Activo, EUR/STD, EUR/MIN, Merma%, C.Neto/STD, C.Neto/MIN

**Mermas** — Solo lectura, 26 columnas:
IDING, Nombre, UDS, UD STD, Precio Total, SP1/SP2 completo, %SP1/%SP2/%Descarte/%Merma/%Limpio, Eur Pieza Limpia, Eur/Kg Neto, Neto(Kg), Nº Porciones, Peso Porción, Eur/Porción

**EPS** — Tabla + modal:
Código, Nombre, Raciones, Tamaño Rac, Unidad, Coste Tanda, Coste/Rac, Fecha
Modal: edición campos + líneas ingredientes + cálculos automáticos + guardar eps + eps_lineas

**Recetas** — Tabla + modal con waterfall:
Código, Nombre, Raciones, Coste/Rac, PVP Uber, Margen%, Semáforo
Modal: PVPs 5 canales, líneas ING/EPS, waterfall Real/Cash:
- Comisiones: Uber/Glovo 30%, JE 20%, Web 7%, Directa 0%
- Coste MP, estructura 36%, plataforma (Real vs Cash×1.21), coste total
- PVP recomendado = (CosteMP×1.1)/(1-0.36-com%-0.15)
- K, Margen€, %Margen con semáforo
- IVA neto = (PVP−PVP×com%×1.21)/1.1×0.1−PVP×com%×0.21
- Provisión IVA = PVP×com%×0.21
- Solo canales con PVP > 0

## Tablas Supabase

| Tabla | Estado |
|-------|--------|
| usuarios | ✅ Datos |
| facturacion_diario | ✅ Datos |
| ingredientes | ✅ ~250 registros |
| mermas | ✅ Datos |
| eps | ✅ ~50 registros |
| eps_lineas | ✅ Estructura |
| recetas | ✅ ~30 registros |
| recetas_lineas | ✅ Estructura |

## ACCIÓN REQUERIDA: SQL pendiente

Ejecutar `supabase-migration.sql` en Supabase SQL Editor:
- ingredientes: nombre_base, abv, formato, uds, precios, ud_std/min, merma_ef, costes netos
- eps: fecha
- recetas_lineas: ingrediente_id, eps_id, cantidad, unidad, eur_ud_neta, eur_total, pct_total

## ACCIÓN REQUERIDA: Vercel deploy

El deploy en Vercel NO se actualiza automáticamente. Diagnóstico:
- El build local funciona (`vite build` OK, 498KB JS)
- Los commits llegan a GitHub correctamente
- **Causa probable: Vercel busca rama `main` pero el repo usa `master`**

**Solución — en https://vercel.com/dashboard:**
1. Proyecto → Settings → Git → Production Branch → cambiar `main` a `master`
2. O bien: Deployments → Redeploy manualmente
3. Alternativa: `npm i -g vercel && vercel --prod`

## Errores conocidos

1. Tablas Ingredientes/Mermas muy anchas en móvil (scroll horizontal funciona pero UX mejorable)
2. eps_lineas/recetas_lineas pueden estar vacíos si datos importados sin líneas detalle
3. Verificar fórmula IVA neto del waterfall contra Excel real
4. Deploy Vercel no auto-deploya (ver sección anterior)

## Pendiente por construir

- **POS** — Punto de venta / caja
- **Marcas** — Gestión de marcas virtuales
- **Proveedores** — Gestión de proveedores y pedidos
- **Running** — Operativa diaria / running costs

## Diseño

Fondo #0a0a0a | Cards #141414 | Bordes #1f1f1f | Acento #e8f442 | Inter
Semáforo: verde >15% | amarillo 10-15% | rojo <10%
