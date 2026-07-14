# LEY DE CONCILIACIÓN · Binagre ERP
Vigente desde 14-jul-2026. Reglas **bloqueantes**. Espejo en Supabase → tabla `reglas_globales` (módulo `conciliacion`).

---

## LEY-BANCO-01 · Horizonte bancario
El extracto bancario empieza el **3-jul-2023**. Ninguna factura anterior a `2023-07-01` es conciliable: se marca `no_conciliable = true`, motivo *"sin banco (anterior a jul-2023)"*.
Prohibido listarlas como pendientes, rematcharlas o preguntar por ellas.

## LEY-MATCH-01 · Importe exacto (0,00 € de tolerancia)
Factura y movimiento casan **solo si el importe coincide al céntimo**.
Nadie emite una factura de 10,00 € y cobra 9,98 €. Una diferencia, por pequeña que sea, significa que **no es el mismo pago**.
`matching_config.tolerancia_eur = 0.00` en todas las filas. Prohibido reintroducir tolerancia.

> Derogada la antigua regla CONC-002 (±0,05 €): había generado 107 enlaces falsos.

## LEY-MATCH-02 · Razón social ≠ nombre comercial
Toda comparación de proveedor pasa por `fn_prov_canon(texto)`, que normaliza y **resuelve la tabla `proveedor_alias`**.

| Aparece como | Es |
|---|---|
| ENDESA ENERGÍA, S.A. UNIPERSONAL | ENDESA |
| LIDL SUPERMERCADOS S.A.U. | LIDL |
| CC.ALBUFERA PLAZA | MERCADONA |
| ALCAMPO VALLECAS / ALCAMPO CFC | ALCAMPO |
| TESORERÍA GENERAL DE LA SEGURIDAD SOCIAL | TGSS |
| BOLSEMACK | BOLSAS DE VACÍO ONLINE |

Cuando aparezca un nombre nuevo (del banco o del OCR) que sea el mismo proveedor → **se añade a `proveedor_alias`**. Nunca se relaja el matching para compensarlo.
Prohibido comparar con `fn_norm_prov` a pelo.

> Bug histórico corregido: `fn_norm_prov` aplicaba el filtro `[^a-z0-9]` **antes** del `lower()`, así que borraba todas las mayúsculas y devolvía cadena vacía. Resultado: la comparación de proveedor era `'' = ''` → siempre verdadera. El matching llevaba tiempo ignorando el proveedor por completo.

## LEY-MATCH-03 · Ventana de pago por tipo de proveedor
La ventana factura→cargo **no es simétrica ni única** (`matching_config.dias_antes` / `dias_despues`):

| Tipo | Antes | Después | Motivo |
|---|---|---|---|
| Suministros (Endesa, Octopus, Canal Isabel II, Naturgy, Iberdrola) | 0 | 90 | Se facturan a mes vencido, algunas eléctricas a dos meses |
| Alquiler (Timoteo) | 8 | 8 | Se paga del 1 al 8 del mes en curso |
| TGSS | 5 | 35 | Cargo a fin del mes siguiente |
| Plataformas (Uber, Glovo, Just Eat) | 5 | 45 | Liquidación semanal/mensual |
| Resto | 5 | 30 | — |

Ampliar la ventana **nunca** justifica relajar el importe (LEY-MATCH-01).

## LEY-MATCH-04 · Candidato único o nada
Tras aplicar importe exacto + proveedor canónico + ventana:
- **1 candidato** → se enlaza automáticamente.
- **0 o >1 candidatos** → queda pendiente de decisión manual. Prohibido elegir "el más cercano" por iniciativa propia.

`barrido_historico_matching()` (matching laxo por importe+fecha, sin proveedor) queda **desactivada para siempre**: fue la causa de 2.106 enlaces falsos. Lanza excepción si se invoca.

---

## Implementación
- `fn_norm_prov(text)` — normaliza (minúsculas, sin acentos, sin puntuación, sin sufijo societario).
- `fn_prov_canon(text)` — normaliza + resuelve alias. **Es la única función válida para comparar proveedores.**
- `auto_match_factura(uuid)` — motor único de matching. Fila a fila (el nido de triggers impide UPDATE masivo de `factura_id`).
- `matching_config` — ventanas y tolerancia.
- `proveedor_alias` — razón social ↔ nombre comercial.
