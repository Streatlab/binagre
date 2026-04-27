# Casos de prueba OCR - Facturas reales

12 facturas reales de Rubén Rodríguez Vinagre (NIF 21669051S) para validar parser OCR del importador.

## Resultado esperado por factura

### 1. Tesys Internet (dominio web)
- **NIF emisor**: B-26309096 (debe normalizar a B26309096)
- **Nº factura**: 2026B006586
- **Fecha**: 14/01/2026
- **Base**: 13,45€ · IVA 21%: 2,82€ · **Total**: 16,27€
- **Categoría**: CTR-SW (Controlables · Software)
- **Forma pago**: Tarjeta crédito
- **Titular**: Rubén

### 2. Mercadona (compra mensual con tickets)
- **NIF emisor**: A-46103834
- **Nº factura**: A-V2026-00000455086
- **Fecha**: 31/01/2026 (NO confundir con fechas de tickets simplificados internos)
- **CRÍTICO**: extraer total del DETALLE final (página 8), NO sumar tickets
- **IVA múltiple**: 4% (234,48€) + 10% (1.075,86€) + 21% (42,37€) = **Total 1.352,71€**
- **Base imponible total**: 1.238,54€
- **Categoría**: PRD-MP (Producto · Materia prima)
- **Forma pago**: Tarjeta bancaria
- **Titular**: Rubén

### 3. Alcampo factura A (saldos fidelidad)
- **NIF emisor**: A-28581882
- **Nº factura**: 260100302086
- **Fecha**: 12/01/2026
- **Base**: -0,01€ · IVA: 0,01€ · **Total: 0€**
- **Categoría**: PRD-MP (croquetas + ensalada)
- **Caso límite**: total puede ser 0€ por descuento fidelidad. Aceptar y guardar.
- **Titular**: Rubén

### 4. Alcampo factura B
- **NIF emisor**: A-28581882
- **Nº factura**: 260200300434
- **Fecha**: 03/02/2026
- **Base**: 2,15€ · IVA 10%: 0,21€ · **Total: 2,36€**
- **Categoría**: PRD-MP (lentejas)
- **Titular**: Rubén

### 5. Envases Profesionales (Envapro)
- **NIF emisor**: B84856145
- **Nº factura**: A-26/0000884
- **Fecha**: 16/01/2026
- **Base**: 166,21€ · IVA 21%: 34,90€ · **Total**: 201,11€
- **Categoría**: PRD-PCK (Producto · Packaging)
- **Forma pago**: Transferencia bancaria
- **Vencimiento**: 19/01/2026
- **Titular**: Rubén

### 6. Amazon (Coca-Cola)
- **NIF emisor**: W0184081H (peculiar: empieza con letra W)
- **Nº pedido**: 406-3728733-0845164
- **Nº documento**: ES6DN3KAEUS
- **Fecha**: 02/01/2026
- **Base**: 15,87€ · IVA 21%: 3,33€ · **Total**: 19,20€
- **Categoría**: PRD-BEB (Producto · Bebidas)
- **Titular**: Rubén

### 7. JOAQUÍN AYORA (JASA, congelados)
- **NIF emisor**: A-46308433
- **Nº factura**: 260117739
- **Fecha**: 31/01/2026 (NO 13/01 que es fecha servicio)
- **Base**: 116,91€
  - IVA 10%: 89,85€ → cuota 8,99€
  - IVA 4%: 27,06€ → cuota 1,08€
- **Total**: 126,98€
- **Categoría**: PRD-MP
- **Forma pago**: Giro 20 días (vencimiento 20/02/2026)
- **Titular**: Rubén

### 8. Portier Eats / Uber Eats (comisión semanal)
- **NIF emisor**: B88515200
- **Nº factura**: B88515200-2026-F1-316810
- **Fecha**: 11/02/2026
- **Periodo**: 02/02/26 - 08/02/26
- **Base**: 82,86€ · IVA 21%: 17,39€ · **Total**: 100,25€
- **Conceptos**: Tasa servicio (59,43€) + Comisión canje ofertas (4,92€) + Tarifa publicitaria (18,51€)
- **Categoría**: PLT-UE (Plataformas · Uber Eats)
- **Marca asociada**: Mister Katsu (cliente factura "Rubén Rodríguez Vinagre / Mister Katsu")
- **CRÍTICO**: el parser debe detectar marca por nombre comercial en cliente
- **Titular**: Rubén

### 9. BBVA - Adeudo SS Autónomos
- **NO es factura**, es movimiento bancario
- **Concepto**: TGSS COTIZACION 005 R.E.AUTONOMOS
- **Importe**: -302,60€
- **Fecha**: 27/02/2026
- **Categoría**: EQP-SS (Equipo · Seguridad Social)
- **CRÍTICO**: detectar que es extracto bancario, NO factura. Crear como movimiento.

### 10. Savour (consultoría delivery, Francia)
- **NIF emisor**: FR80922273727 (intracomunitario)
- **Nº factura**: F-260225457
- **Fecha**: 10/02/2026
- **Base**: 250€ · IVA 0% · **Total**: 250€
- **Régimen**: Intracomunitario (sin IVA)
- **Categoría**: CTR-MKT (Controlables · Marketing/Consultoría delivery)
- **Forma pago**: Transferencia (vencimiento 18/02/2026)
- **CRÍTICO**: parser NO debe asumir error porque falta IVA. Detectar régimen intracomunitario.
- **Titular**: Rubén (factura nominal "Rodriguez Vinagre Ruben Alberto")

### 11. Canal Isabel II (agua)
- **NIF emisor**: A86488087
- **Nº factura**: 260000885836
- **Fecha**: 03/02/2026
- **Periodo facturado**: 24/11/2025 - 29/01/2026
- **Base**: 28,83€ · IVA 10%: 2,88€ · **Total**: 31,71€
- **Vencimiento**: 05/03/2026
- **Categoría**: LOC-SUM (Local · Suministros)
- **Titular**: Rubén

## Reglas extraídas

1. **NIF emisor**: normalizar quitando guiones (B-26309096 → B26309096)
2. **NIF intracomunitario**: aceptar formato XXNNNNNNNNN (ej: FR80922273727)
3. **Fecha factura**: usar la fecha de emisión, NO fecha servicio/entrega
4. **Total con IVA múltiple**: sumar bases × tipos
5. **Saldos negativos / total 0€**: aceptar y guardar
6. **Régimen intracomunitario**: IVA 0% válido, no marcar error
7. **Adeudos bancarios SEPA**: detectar como movimiento, no factura
8. **Marca comercial en cliente**: extraer si aparece (ej: "Mister Katsu")
9. **Forma pago**: extraer cuando aparezca (Tarjeta / Transferencia / Giro / Otro)
10. **Vencimiento**: extraer si aparece (importante para Cobros/Pagos pendientes)

## Mapping plataformas de pago

| Forma pago detectada | Tipo | Comportamiento |
|---|---|---|
| Tarjeta bancaria/crédito | Pagado | Conciliar contra movimiento BBVA fecha factura |
| Transferencia bancaria | Pendiente hasta vencimiento | Cobros/Pagos pendientes |
| Giro (20/30/60 días) | Pendiente vencimiento | Cobros/Pagos pendientes |
| Domiciliación SEPA | Auto-conciliar contra movimiento BBVA |
| Otro / desconocido | Pendiente revisión manual |
