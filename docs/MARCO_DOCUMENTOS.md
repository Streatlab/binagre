# MARCO DOCUMENTOS ERP — Streat Lab

> Marco único de presentación para **todos los documentos imprimibles** del ERP.
> Módulo canónico y **BLINDADO**: `src/lib/marcoDoc.ts`.
> Fuente de verdad también en **Notion CEREBRO-SL › 📄 MARCO DOCUMENTOS ERP** y en la memoria del asistente.

El marco es la fuente de verdad del *look*. Cada documento solo aporta su **contenido**
(columnas, filas, textos); la espina, cabecera, logo, paginado, paleta, radio y fuentes
las pone `marcoDoc.ts`.

---

## Paleta por área

| Área | Acento | Soft | Soft2 |
|------|--------|------|-------|
| Cocina | `#A8524E` | `#ecdad9` | `#f7efee` |
| Finanzas | `#4B5A72` | `#dadfe8` | `#eef1f5` |
| Equipo | `#5C8A6E` | `#d9e8df` | `#eef5f1` |
| **B/N** (flag) | `#565656` | `#e7e7e7` | `#f3f3f3` |

Neutros comunes: tinta `#232323` · gris `#6c6c6c` · líneas `#cfcfcf`.
**Espina** = acento mezclado **86% acento + 14% blanco** (un punto más suave que el acento).

El modo **B/N** se activa con el parámetro `bn` al construir el PDF (por defecto color).
Todos los botones de imprimir/PDF llevan un toggle **Color / B/N**.

## Radio único

`R = 1.6 mm` (≈6px) para **TODA** esquina redondeada: tablas, tarjetas, pills, badges de
paso. Exportado como `R` desde `marcoDoc.ts`. No usar otros radios.

## Fuentes

Embebidas y centralizadas en `marcoDoc.ts` (mismo patrón carga + cache + base64 que
`Esquemas.tsx › cargarFuentesEsquemas`):

- **Oswald** → títulos, etiquetas, cabeceras (`fTitulo`).
- **Barlow Semi Condensed** → datos / contenido (`fDato`).

Si la descarga falla, *fallback* a Helvetica.

## Logo

Se localiza el asset real de la app (`public/data/STREAT LAB LOGO-04.jpg`), se reduce a un
JPEG pequeño (canvas, base64) para no inflar el PDF y se embebe con `doc.addImage`.
Se coloca **arriba a la derecha** de la cabecera. Si no se encuentra, *fallback* al texto
"STREAT LAB".

## API principal (`src/lib/marcoDoc.ts`)

- `cargarRecursos()` → carga (y cachea) fuentes + logo.
- `nuevaHoja({ orientation })` → `jsPDF` A4 con márgenes estándar.
- `preparar(doc, rec)` → registra fuentes en el doc y devuelve el contexto `Ctx`.
- `pintarEspina(doc, area, ctx, bn?)` → barra lateral izquierda con el área en vertical.
- `pintarCabecera(doc, ctx, { docNombre, meta?, tituloCentrado?, area, bn? })` → nombre doc +
  meta a la izq, título grande centrado (opcional), logo a la dcha, regla de acento debajo.
  Devuelve la **Y de continuación**.
- `pintarPaginado(doc, actual, total, ctx)` → "actual / total" abajo centrado.
- `tarjeta(...)`, `tablaWrap(...)`, `pill(...)` → helpers con el radio único y la paleta.
- `fTitulo` / `fDato` → seleccionan la fuente correcta (embebida o fallback).
- `descargar(doc, tipo)` / `abrirImprimir(doc)` → salida.

**No hay** helper de observaciones/firma: ese bloque se elimina de los documentos del marco.

## Márgenes / medidas

- Margen exterior `MARGEN = 10 mm`.
- Espina `ESPINA_W = 7 mm` + `ESPINA_GAP = 3 mm`.
- La caja de contenido útil se obtiene con `contentBox(doc)` (a la derecha de la espina).

---

## Documentos migrados al marco

| Documento | Archivo | Orientación | Área |
|-----------|---------|-------------|------|
| Lista de Producción | `src/pages/cocina/Produccion.tsx` (tab lista) | Apaisado | Cocina |
| Ordenación de Cámara | `src/pages/cocina/Produccion.tsx` (tab cámara) | Apaisado | Cocina |
| Inventario Permanente | `src/pages/cocina/Produccion.tsx` (tab inventario) | Apaisado | Cocina |
| Esquemas | `src/pages/cocina/Esquemas.tsx` | Vertical | Cocina |
| Ficha técnica Receta / EP | `src/components/escandallo/TabFichas.tsx` | Vertical | Cocina |
| Lista de Compra | `src/pages/cocina/ListaCompra.tsx` | Vertical | Cocina |

Notas por documento:

- **Lista de Producción**: cabecera con "Semana N + fechas". Cada día enmarcado (HOY+SSP
  juntos) y separado del siguiente por borde de acento; separador fino entre HOY y SSP.
- **Ordenación de Cámara**: mantiene productos en grande; cabecera/espina/paginado del marco.
- **Inventario Permanente**: 2 columnas; nombre de ubicación centrado grande en la cabecera.
- **Esquemas**: nombre de la gama grande y centrado en la cabecera; tarjetas con radio único,
  cabecera soft + nombre Oswald, ingredientes Barlow centrados, "nubes" delimitadas por línea
  de acento.
- **Ficha técnica Receta / EP**: nombre de documento = código `REC-xxx` / `EP-xxx` a la izq;
  nombre de la receta centrado grande. Bloques: Ingredientes (tabla), Elaboración (pasos
  numerados con badge de acento), Alérgenos (pills). Generador nuevo creado con el marco.
- **Lista de Compra**: conserva columnas (proveedor, producto, formato, ud, cantidad, precio,
  total).

## Áreas futuras

El marco soporta **Finanzas** y **Equipo** por el parámetro `area`, listo para documentos
futuros de esos departamentos sin tocar el módulo.

## Decisiones autónomas

- `src/lib/impresion.ts` (la antigua "LEY DE IMPRESIÓN", con observaciones/firma) se conserva
  **intacta** porque la usa `ChecklistsAperturaCierre.tsx` (documento de ops que **no** está en
  la lista de migración y depende de su API propia). No se re-exporta desde `marcoDoc.ts` para
  no romper esos imports. Los 6 documentos del marco no usan `impresion.ts`.
