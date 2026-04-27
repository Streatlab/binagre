# Casos de prueba OCR - Facturas reales

17 facturas reales de Rubén Rodríguez Vinagre (NIF 21669051S) para validar parser OCR del importador.

## Cobertura

- Proveedores producto (Mercadona, Alcampo, JASA, Amazon, Envapro)
- Plataformas (Uber/Portier, Glovo formato A, Glovo formato B, Rushour)
- Software (Tesys, Sinqro)
- Suministros (Canal Isabel II)
- SS Autónomos (BBVA adeudo)
- Consultoría intracomunitaria (Savour Francia)

---

## RESULTADOS ESPERADOS POR FACTURA

### 1. Tesys Internet (dominio web)
- NIF emisor: B26309096
- Nº factura: 2026B006586 · Fecha: 14/01/2026
- Base 13,45 · IVA 21% 2,82 · **Total 16,27€**
- Categoría: CTR-SW · Forma pago: Tarjeta crédito · Titular: Rubén

### 2. Mercadona (factura mensual con tickets)
- NIF: A46103834 · Nº A-V2026-00000455086 · Fecha 31/01/2026
- IVA 4% (234,48) + 10% (1.075,86) + 21% (42,37) = **Total 1.352,71€**
- Base 1.238,54 · Categoría: PRD-MP · Tarjeta · Titular: Rubén
- **CRÍTICO**: extraer total del DETALLE final (página 8), NO sumar tickets

### 3. Alcampo factura A
- NIF A28581882 · Nº 260100302086 · Fecha 12/01/2026
- Base -0,01 · IVA 0,01 · **Total 0€** (saldo fidelidad)
- Categoría: PRD-MP · Titular: Rubén

### 4. Alcampo factura B
- NIF A28581882 · Nº 260200300434 · Fecha 03/02/2026
- Base 2,15 · IVA 10% 0,21 · **Total 2,36€**
- Categoría: PRD-MP · Titular: Rubén

### 5. Envases Profesionales
- NIF B84856145 · Nº A-26/0000884 · Fecha 16/01/2026
- Base 166,21 · IVA 21% 34,90 · **Total 201,11€**
- Vencimiento 19/01/2026 · Categoría: PRD-PCK · Transferencia · Titular: Rubén

### 6. Amazon (Coca-Cola)
- NIF W0184081H · Nº ES6DN3KAEUS · Fecha 02/01/2026
- Base 15,87 · IVA 21% 3,33 · **Total 19,20€**
- Categoría: PRD-BEB · Titular: Rubén

### 7. Joaquín Ayora (JASA)
- NIF A46308433 · Nº 260117739 · Fecha 31/01/2026
- Base 116,91 (IVA 4% + 10%) · **Total 126,98€**
- Vencimiento 20/02/2026 (Giro 20 días) · Categoría: PRD-MP · Titular: Rubén

### 8. Portier Eats / Uber (comisión)
- NIF B88515200 · Nº B88515200-2026-F1-316810 · Fecha 11/02/2026
- Periodo: 02/02/26 - 08/02/26
- Base 82,86 · IVA 21% 17,39 · **Total 100,25€**
- Categoría: PLT-UE · **Marca: Mister Katsu** · Titular: Rubén
- **CRÍTICO**: detectar marca por nombre comercial en cliente

### 9. BBVA Adeudo SS Autónomos
- **NO ES FACTURA**, es movimiento bancario
- Concepto: TGSS COTIZACION 005 R.E.AUTONOMOS
- Importe -302,60€ · Fecha 27/02/2026
- Categoría: EQP-SS · **CRÍTICO**: enrutar a movimientos, no facturas

### 10. Savour (Francia)
- NIF FR80922273727 · Nº F-260225457 · Fecha 10/02/2026
- Base 250 · IVA 0% (intracomunitario) · **Total 250€**
- Vencimiento 18/02/2026 · Categoría: CTR-MKT · Titular: Rubén

### 11. Canal Isabel II
- NIF A86488087 · Nº 260000885836 · Fecha 03/02/2026
- Base 28,83 · IVA 10% 2,88 · **Total 31,71€**
- Vencimiento 05/03/2026 · Categoría: LOC-SUM · Titular: Rubén

### 12. Glovo formato A (con detalle)
- NIF B67282871 · Nº I26LRCX31X000005 · Fecha 03/03/2026
- Periodo: 16-28/02/2026
- Base 104,51 · IVA 21% 21,95 · **Total 126,46€**
- **Productos vendidos**: 403,77€ · Promoción: -82,07€ · **Ingreso colaborador: 195,24€**
- Categoría: PLT-GL · **Marca: Los Menús de Carmiña** · Titular: Rubén
- **CRÍTICO**: pág 2 trae detalle pedido a pedido por plato → alimenta vista marca×canal

### 13. Glovo formato B (factura 1)
- NIF B67282871 · Nº 200460955815 · Fecha 15/03/2026
- Periodo: 01-15/03/2026 · **Fecha pago: 04/04/2026** (plazo Glovo segunda quincena)
- Base 215,32 · IVA 21% 45,22 · **Total 260,54€**
- Productos: 896,50€ · Promoción: -225,74€ · **Ingreso colaborador: 410,22€**
- Cliente: Rubén (sin marca específica en este formato)
- Categoría: PLT-GL · Titular: Rubén
- IBAN cliente: ES8501820923180201788251

### 14. Glovo formato B (factura 2 mismo periodo)
- NIF B67282871 · Nº 200530936327 · Fecha 15/03/2026
- Periodo: 01-15/03/2026 · Fecha pago: 04/04/2026
- Base 58,25 · IVA 21% 12,24 · **Total 70,49€**
- Productos: 237,45€ · Promoción: -53,30€ · Ingreso colaborador: 113,66€
- **CRÍTICO**: 2 facturas Glovo distintas mismo periodo (1 por marca/cuenta). Parser debe acumular, no sobreescribir.

### 15. Rushour (agregador francés)
- NIF: 26 rue de l'Étoile Paris (sin NIF español, parser debe aceptar emisor extranjero)
- Nº B4101477-0035 · Fecha 01/03/2026
- Plan PLATINIUM mensual · IVA 20% francés
- **Total 99€** (Balance Due €0, ya pagado)
- Categoría: CTR-SW (mover a CTR-PLT si decidimos categoría plataformas-software) · Titular: Streat Lab

### 16. Sinqro Technologies (POS/integrador)
- NIF B66598764 · Nº SNQ-26-4-118411 · Fecha 29/03/2026
- Base 75 · IVA 21% 15,75 · **Total 90,75€**
- Concepto: 7500 créditos Order Hub Plan R1 cuenta STREAT LAB - MALICIOSA
- Categoría: CTR-SW · Titular: Rubén
- **Cuenta vinculada**: Streat Lab Maliciosa (local físico)

---

## Reglas extraídas para parser

### NIF emisor
1. Normalizar quitando guiones (B-26309096 → B26309096)
2. Aceptar formato intracomunitario (FR80..., LU20..., etc)
3. Aceptar emisor sin NIF español si es extranjero (caso Rushour)
4. NIF empezando por W = sucursal extranjera en España (Amazon)

### Fecha
1. Usar fecha emisión, NO fecha servicio/entrega
2. Fechas formato variable: dd/mm/yyyy, yyyy-mm-dd, "10 de enero de 2026"

### Total
1. Total con IVA múltiple: sumar bases × tipos
2. Saldos negativos / total 0€: aceptar y guardar
3. Régimen intracomunitario: IVA 0% válido, no error
4. Total = "Balance Due" si está pagado (Rushour)

### Detección de tipo
1. Adeudos bancarios SEPA → movimiento, no factura
2. Plataformas (Glovo/Uber/Just Eat/Rushour) → categoría PLT-* automática

### Marca comercial
Detectar marca por estos campos en orden de prioridad:
1. Cliente con marca incluida (ej: "Rubén Rodríguez Vinagre / Mister Katsu")
2. Cliente con nombre local comercial (ej: "Los Menús de Carmiña (Pico de la Maliciosa)")
3. Concepto factura (ej: "cuenta STREAT LAB - MALICIOSA")
4. Cruce con maestro Marcas en Configuración

### Plataformas - parser específico Glovo
1. Detectar formato A (con detalle pedidos pág 2) vs formato B (resumen simple)
2. Extraer "Ingreso a cuenta colaborador" → lo que efectivamente cobras
3. Extraer "Fecha de Pago" cuando aparezca → cobros pendientes reales
4. Múltiples facturas mismo periodo: acumular por marca, no sobreescribir
5. Si formato A: parsear pág 2 productos → alimentar marca×plato×fecha BD

### Plataformas - parser específico Uber/Portier
1. Detectar B88515200 = Portier Eats Spain SL (entidad facturadora Uber España)
2. Conceptos típicos: Tasa servicio + Comisión canje ofertas + Tarifa publicitaria
3. Periodo semanal lun-dom

### Plataformas - parser específico Rushour
1. Empresa francesa, formato inglés
2. Plan fijo mensual ("PLATINIUM at €99/month")
3. IVA 20% francés (no español)
4. Categoría CTR-SW (es agregador-software, no plataforma de venta directa)

### Forma de pago detectada
| Texto en factura | Tipo | Comportamiento |
|---|---|---|
| Tarjeta bancaria/crédito | Pagado | Auto-conciliar contra movimiento BBVA fecha factura |
| Transferencia / Proforma | Pendiente vencimiento | Cobros/Pagos pendientes |
| Giro N días | Pendiente vencimiento | Cobros/Pagos pendientes |
| Domiciliación SEPA | Pagado domiciliado | Auto-conciliar |
| "Balance Due €0" | Pagado | Auto-conciliar |
| Otro / vacío | Pendiente revisión manual |

### Ciclos pago plataformas (cobros)
- Uber/Portier: lunes semanal (lun-dom anterior)
- Glovo 1-15: paga 5 mes siguiente
- Glovo 16-fin: paga 20 mes siguiente
- Just Eat 1-15: paga 20 mismo mes
- Just Eat 16-fin: paga 5 mes siguiente
- Directa: al día
- Web: pendiente definir
