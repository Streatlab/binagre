# Observaciones Rubén tras review localhost — 27 abr 2026

Tras revisar localhost durante ejecución del Bloque 1, Rubén detecta problemas de calidad en la implementación.

## Estilo de referencia OBLIGATORIO

**Conciliación es el módulo correcto visualmente.** Sigue intacto en localhost. TODO módulo del ERP debe replicar exactamente:

### Patrón visual Cards
1. Cards grandes con número gigante en color destacado (ej: "30.468,00 €")
2. Subtítulos en MAYÚSCULAS finas y elegantes ("INGRESOS NETOS")
3. Comparativas con flecha y % ("▲ 11% vs período anterior")
4. Desglose interno con barras de color por canal/categoría
5. Layout 12 columnas con cards bien proporcionadas
6. Selectores integrados en header arriba derecha

### Patrón visual TABS (CRÍTICO)
**Las tabs deben ser estilo Conciliación: Resumen / Movimientos**
- Botón con padding generoso
- Fondo ROJO Streat Lab (#B01D23) en tab activa
- Fondo BLANCO en tabs inactivas
- Texto blanco en activa, gris oscuro en inactivas
- Bordes redondeados suaves
- Hover en inactivas: fondo gris muy claro

**MAL implementado actualmente en Panel Global:**
Tabs General/Operaciones/Finanzas/Cashflow/Marcas con guión amarillo subrayando. Esto NO es estilo Conciliación. Hay que rehacer al patrón Resumen/Movimientos.

## Problemas detectados

### Panel Global · tabs nuevos
1. **Estilo de tabs MAL**: usar exactamente el mismo patrón que Conciliación (botones con fondo rojo activo, no guión amarillo subrayando).
2. **Tab Operaciones**: cards genéricas pequeñas con borde fino. Números sin destacar. Estilo pobre vs Conciliación.
3. **Tab Finanzas**: bloque rectangular único "VISTA FINANCIERA" con 3 valores en línea. Muy soso.
4. **Tab Cashflow**: solo texto plano placeholder. NO es implementación real.
5. **Tab General**: estilo OK pero cards de canales (Uber/Glovo/Just Eat) sin datos.

### Facturación
6. NO eliminó hilera cards medianas (Facturación bruta/Pedidos/TM/Facturación diaria) — fix B14 pendiente.
7. Cards superiores siguen siendo "MARTES 28 / S18 / ABRIL / 2026" estáticas — fixes B12, B13 pendientes.
8. Columna SERV sigue con "TODO" fijo — fix J11 pendiente.
9. NO añadió vista Año al conmutador — fixes B19, J3 pendientes.
10. Tabla diaria sin desglose ALM/CENA — fixes J11, J12 pendientes.
11. **Falta tabs estilo Conciliación**: el conmutador Diario/Semanas/Meses/Año debería ir como tabs estilo Resumen/Movimientos.

### Objetivos
12. Día actual MAR sigue con borde rojo similar al activo — fix C2 pendiente.
13. NO añadió tab Presupuestos — fix C8 pendiente.
14. Tabla histórico SIN columnas % Real y % Desviación — fixes C6, C7 pendientes.
15. **Tabs Objetivos de venta / Presupuesto de gastos**: revisar que sigan patrón Conciliación.

### Conciliación
16. **REFERENCIA DE ORO** — usar como benchmark visual.

## Conclusión
El implementer ha **creado estructura de tabs** pero:
1. Con estilo de tabs INCORRECTO (no patrón Conciliación)
2. Rellenando con placeholders pobres en vez de implementación real
3. Dejando módulos enteros sin tocar (Facturación, Objetivos parcial)

Hace falta un **Bloque 1.5 de re-trabajo** tras qa-reviewer, con criterios mucho más estrictos:
- Estilo de tabs IDÉNTICO al de Conciliación (Resumen/Movimientos)
- Cada tab debe llegar al nivel visual de Conciliación
- NO se aceptan placeholders ni cáscaras vacías
- Cada CA del qa-reviewer debe ser visualmente verificable contra Conciliación como referencia
- Cards tienen que ser GRANDES, números GIGANTES, comparativas con flechas

## Master list afectada
Tareas marcadas como hechas pero MAL hechas (revisar tras qa-reviewer):
- B12, B13, B14, B19, B22 (Panel Global)
- C2, C6, C7, C8 (Objetivos)
- J3, J11, J12 (Facturación)
- Estilo tabs en TODO el ERP — añadir tarea explícita "Tabs siguen patrón Conciliación"

Más las que detecte qa-reviewer en sus 37 CA.
