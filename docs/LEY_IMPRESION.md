# LEY DE IMPRESIÓN · ERP Streat Lab (Binagre)

**Norma obligatoria.** Todo documento imprimible del ERP (checklists, listas, inventarios, carteles, informes de papel) se construye con `src/lib/impresion.ts`. Nada de estilos de impresión improvisados.

## Las 8 reglas

1. **PDF real siempre** (jsPDF). Nunca `window.print()` sobre el DOM. Imprimir = `abrirImprimir(doc)`, descargar = `descargar(doc, tipo)`.
2. **Marco exterior rojo** #B01D23 (0,8 mm) en todas las páginas → `pintarMarco(doc)`.
3. **Cabecera estándar**: banda rosa suave (#F0D8DA) de 15 mm, título bold uppercase granate (#8A1A22) a la izquierda, "STREAT LAB · [contexto]" a la derecha, paginación "Página X de Y" si hay varias → `pintarCabecera(...)`.
4. **Línea de identificación** bajo la cabecera con los campos que apliquen (FECHA / RESPONSABLE / HORA / SEMANA), etiqueta gris pequeña + raya para escribir → `pintarCamposId(...)`.
5. **Cuerpo**: filas separadas por línea gris fina (#C9C9C9). Texto en tinta #111. Datos críticos (mínimos, temperaturas, umbrales) en rojo #B01D23 bold. Casillas de check de 7 mm con borde tinta.
6. **Escritura a mano**: siempre línea continua gris azulada (#C9C9D2), sin puntos ni recuadros.
7. **Pie estándar**: bloque OBSERVACIONES / INCIDENCIAS (2 líneas) + FIRMA RESPONSABLE + micro-instrucción gris a la derecha (p. ej. "Al terminar: foto de la hoja → ERP") → `pintarPie(...)`.
8. **Nombre de archivo**: `tipo-documento-AAAA-MM-DD.pdf`, minúsculas, sin acentos → `nombreArchivo(tipo)`.

## Paleta cerrada (prohibido inventar)

| Uso | Color |
|---|---|
| Marco / acentos / datos críticos | #B01D23 |
| Títulos | #8A1A22 |
| Banda cabecera | #F0D8DA |
| Subcabeceras | #F5E2E3 |
| Texto | #111111 |
| Texto secundario | #5A5A5A |
| Separadores | #C9C9C9 |
| Líneas de escritura | #C9C9D2 |

## Aplicación

- **Ya aplica**: Checklists operativos.
- **Pendiente de migrar** (cuando se toquen): Lista de Producción, Ordenación de Cámara, Inventario Permanente (ya siguen el espíritu de la ley; migrar a los helpers cuando se editen).
- **Nuevos documentos**: nacen ya bajo esta ley, sin excepción.
