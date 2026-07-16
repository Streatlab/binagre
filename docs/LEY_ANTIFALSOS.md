# LEY ANTIFALSOS (LEY-ANTIFALSOS-01 · bloqueante)

Robot de precios de súper (Mercadona/Alcampo).

**Regla:** nunca cargar un precio si el producto no casa con certeza. Un hueco siempre es mejor que un precio equivocado en el Escandallo.

**Se carga solo si:**
- (a) el nombre del producto contiene el nombre base del ingrediente, o
- (b) es "Hacendado" cuyo nombre empieza por el término buscado.

**No se carga (se deja hueco → dudoso/sin_match, para mapeo manual):**
- El mejor candidato NO contiene el nombre base. Ej: "Cebolla blanca" → "Alubia blanca", "Ajo picado" → "Sal de ajo". Prohibido cargarlos.

**Prohibido:** inventar precios, forzar el que quede, o bajar el criterio para "rellenar". El hueco es el comportamiento correcto.

Registrada también en `reglas_globales` (código LEY-ANTIFALSOS-01, bloqueante).
