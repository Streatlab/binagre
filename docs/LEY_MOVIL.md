# LEY DEL MÓVIL · estilo SL v2

Norma obligatoria para toda pantalla nueva del ERP. Si una pantalla no cumple
esto, no está terminada.

---

## 1. Regla de oro

**El móvil no es una versión reducida: es la primera pantalla.**
Rubén revisa el ERP desde el móvil en cocina. Si en móvil no se entiende, da igual
lo bien que se vea en el ordenador.

---

## 2. Los tres cortes

| Ancho | Qué es | Qué pasa |
|---|---|---|
| hasta 768 px | Móvil | Todo a una sola columna |
| 769 – 1024 px | Tablet | Dos columnas como máximo |
| más de 1024 px | Ordenador | Diseño completo (hasta 4 columnas) |

La adaptación vive en un solo sitio: `src/styles/sl-movil.css`.
**No se escriben media queries dentro de las pantallas.**

---

## 3. Cómo se detecta el móvil

Dos formas, y las dos hacen falta:

1. **CSS** (`sl-movil.css`) → cambia la maquetación sola, sin que la pantalla
   se entere. Es lo que hace que las rejillas de 4 columnas pasen a 1.
2. **JavaScript** (`useEsMovil()` en `src/context/skin.tsx`) → cuando hay que
   cambiar *contenido*, no solo la forma: esconder una columna de la tabla,
   agrandar un botón, enseñar menos filas.

```tsx
import { useEsMovil } from '@/context/skin'

const esMovil = useEsMovil()          // corte por defecto: 768 px
const esMovil = useEsMovil(560)       // corte a medida
```

Se detecta **por ancho de pantalla**, no por tipo de navegador. Por eso también
funciona al estrechar la ventana del ordenador o al usar el modo móvil de las
herramientas del navegador.

---

## 4. Lo que hay que cumplir

1. **Una columna en móvil.** Nada de dos KPIs uno al lado del otro: no se leen.
2. **El hero se apila**: primero el número, debajo las pastillas y el anillo.
3. **Las tablas no se aplastan.** Se deslizan con el dedo (ancho mínimo 560 px)
   y siempre dentro de su tarjeta. Nunca se recorta una columna sin avisar.
4. **Nada de pasar el ratón por encima.** En móvil no existe. Todo lo importante
   se ve o se toca.
5. **Botones grandes**: mínimo 40 px de alto. Si no lo puedes tocar con el pulgar,
   está mal.
6. **Un número nunca desborda.** Si la cifra es larga, se abrevia (38,9k), no se
   parte en dos líneas.
7. **El botón NEO/SL** va arriba a la derecha en ordenador y **abajo a la derecha
   en móvil**, para no tapar la cabecera.

---

## 5. Cómo se comprueba

Antes de dar una pantalla por buena:

1. Abrir en el móvil de verdad (no solo en el ordenador).
2. En el ordenador: F12 → icono de móvil → probar en 390 px de ancho.
3. Girar el móvil: en horizontal tiene que seguir bien.
4. Revisar que ninguna cifra se sale y que la tabla se desliza sin romper la tarjeta.

---

## 6. Qué NO se hace

- No se escriben media queries sueltas dentro de las pantallas.
- No se duplica una pantalla "versión móvil". Es la misma, adaptada.
- No se esconde información importante en móvil: se reordena.
- No se usa el tamaño de fuente por debajo de 11 px.

---

*Vive junto a `docs/LEY_IMPRESION.md`. Ambas son de obligado cumplimiento.*
