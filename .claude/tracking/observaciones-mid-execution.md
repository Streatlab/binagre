# Observaciones Rubén tras review localhost — 27 abr 2026

Tras revisar localhost durante ejecución del Bloque 1, Rubén detecta problemas de calidad en la implementación.

## Estilo de referencia
**Conciliación es el módulo correcto visualmente.** Características que TODO módulo del ERP debe replicar:

1. Cards grandes con número gigante en color destacado (ej: "30.468,00 €")
2. Subtítulos en MAYÚSCULAS finas y elegantes
3. Comparativas con flecha y % ("▲ 11% vs período anterior")
4. Desglose interno con barras de color por canal/categoría
5. Layout 12 columnas con cards bien proporcionadas
6. Selectores integrados en header arriba derecha
7. Pestañas con fondo rojo Streat Lab en activa

## Problemas detectados

### Panel Global · tabs nuevos
1. **Tab Operaciones**: cards genéricas pequeñas con borde fino. Números sin destacar. Estilo pobre vs Conciliación.
2. **Tab Finanzas**: bloque rectangular único "VISTA FINANCIERA" con 3 valores en línea. Muy soso, no es estilo Streat Lab.
3. **Tab Cashflow**: solo texto plano "Proyección disponible en PE → Tesorería futura". Es placeholder, no implementación real.
4. **Tab General**: estilo OK pero cards de canales (Uber/Glovo/Just Eat) sin datos.

### Facturación
5. NO eliminó hilera cards medianas (Facturación bruta/Pedidos/TM/Facturación diaria) — fix B14 pendiente.
6. Cards superiores siguen siendo "MARTES 28 / S18 / ABRIL / 2026" estáticas — fixes B12, B13 pendientes.
7. Columna SERV sigue con "TODO" fijo — fix J11 pendiente.
8. NO añadió vista Año al conmutador — fixes B19, J3 pendientes.
9. Tabla diaria sin desglose ALM/CENA — fixes J11, J12 pendientes.

### Objetivos
10. Día actual MAR sigue con borde rojo similar al activo — fix C2 pendiente.
11. NO añadió tab Presupuestos — fix C8 pendiente.
12. Tabla histórico SIN columnas % Real y % Desviación — fixes C6, C7 pendientes.

### Conciliación
13. **Bien implementado** — usar como referencia para resto.

## Conclusión
El implementer ha **creado estructura de tabs** pero ha rellenado con **placeholders pobres** en vez de implementación real con el nivel visual de Conciliación.

Hace falta un **Bloque 1.5 de re-trabajo** tras qa-reviewer, con criterios mucho más estrictos:
- Cada tab debe llegar al nivel visual de Conciliación
- NO se aceptan placeholders ni cáscaras vacías
- Cada CA del qa-reviewer debe ser visualmente verificable contra Conciliación como referencia
- Cards tienen que ser GRANDES, números GIGANTES, comparativas con flechas

## Master list afectada
Tareas marcadas como hechas pero MAL hechas (revisar tras qa-reviewer):
- B12, B13, B14, B19 (Panel Global)
- C2, C6, C7, C8 (Objetivos)
- J3, J11, J12 (Facturación)

Más las que detecte qa-reviewer en sus 37 CA.
