# ESCANDALLO · Radar de ahorro (mismo producto, súper más barato)

Aprovecha el histórico normalizado por unidad estándar (`eur_std`) y el hecho de que
muchos productos se compran a varios proveedores (Mercadona `_MER`, Alcampo `_ALC`,
Pascual `_PAS`…). Para cada producto que existe en 2+ proveedores, dice **cuál sale
más barato por unidad estándar y cuánto se ahorra** cambiando.

## Cómo agrupa (sin fuzzy — LEY-ANTIFALSOS)

Vista `v_escandallo_radar_ahorro`: agrupa ingredientes activos (no borrador) por su
**nombre base** quitando el sufijo literal de proveedor (`_[A-Z]{2,5}$`), dentro de la
**misma unidad estándar**. Nada de similitud de nombres: solo el sufijo determinista.
Compara `eur_std` (precio por unidad estándar, bruto sin merma) entre el más barato y
el más caro del grupo, y expone `ahorro_eur_ud_std` y `ahorro_pct`. Solo muestra grupos
con ahorro ≥ 5 %.

## Dónde se ve

- Acción `GET /api/papeleo/escandallo-auto?action=radar-ahorro` → top 40 por % de ahorro.
- Card "Radar de ahorro" en la pestaña Auto del Escandallo: producto · compra en (súper
  barato, verde) · precio/ud · en vez de (súper caro) · precio/ud · ahorro %.

## Ejemplos reales (datos de producción al crear la feature)

- Cebolla blanca: Alcampo 1,05 €/kg vs Mercadona 1,95 €/kg → −46 %.
- Cacahuete crudo: 5,00 vs 10,00 €/kg → −50 %.
- Ajo picado: Mercadona 6,33 vs Alcampo 10,20 €/kg → −38 %.
- Sal marina yodada: Alcampo 0,33 vs Mercadona 0,45 €/kg → −26 %.

## Notas

- Compara precio **bruto** por unidad estándar (sin merma): es lo correcto para decidir
  a qué súper comprar, la merma es del ingrediente, no del proveedor.
- Se alimenta solo del robot de precios y de las facturas: cuantos más precios frescos,
  más fino el radar. Complementa la fusión de alias (cuando dos gemelos se fusionan en un
  ingrediente, sus precios conviven como alias y el mismo criterio sigue valiendo).
- Vista de solo lectura con `grant select` a `anon`/`authenticated`; el endpoint la lee
  con service role.
