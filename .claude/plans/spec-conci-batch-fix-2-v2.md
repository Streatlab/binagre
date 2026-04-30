# Spec Batch Fix 2 v2 (15 fixes)

REEMPLAZA spec-conci-batch-fix-2.md
Sonnet, NO Opus
Aislamiento Binagre absoluto
BD conciliacion ya wipeada (0 movs)

## 15 FIXES

FIX 1 Sidebar: eliminar item duplicado "Cuentas y conexiones" del sidebar bajo Configuracion. Eliminar tambien ruta /configuracion/cuentas-y-conexiones.

FIX 2 Tabla categorias: eliminar texto "banda X-Y %" en nombres de bloques. "Producto banda 25-30" a "Producto", igual con Equipo, Alquiler, Controlables. Bandas siguen en BD pero NO se muestran en UI.

FIX 3 Header Conciliacion: eliminar dropdown "Cuenta - Todas". Solo queda "Mes en curso".

FIX 4 Subtitulo periodo formato dd/mm/yy. Ej: 01/04/26 a 30/04/26.

FIX 5 Card INGRESOS: eliminar X movs y "Bruto del periodo click para filtrar". Quedan solo Label + Cifra verde.

FIX 6 Card GASTOS: eliminar X movs y "Total gasto click para filtrar". Quedan solo Label + Cifra roja.

FIX 7 Card PENDIENTES: eliminar "Sin asociar click para filtrar". Mantener Label + Badge naranja con numero + Cifra naranja.

FIX 8 Card TITULAR: eliminar "filtro activo". Mantener Label + Texto filtro activo + Toggle 3 botones.

FIX 9 Dropdown Categoria debe filtrar tabla en tiempo real. Lista todas las categorias default + todos los detalles nivel 3 ordenados por ID. Ancho min 280px.

FIX 10 Layout fijo tabla con table-layout fixed. Anchos: Fecha 90px, Concepto flex, Contraparte 16%, Importe 110px, Categoria 200px, Doc 80px, Estado 110px, Titular 100px. Al cambiar card seleccionada NO reflow.

FIX 11 Filas tabla mas bajas. padding 8px 16px. thead 10px 16px. line-height 1.4.

FIX 12 Auto-categorizacion por concepto al importar:
MERCADONA a 2.11.1
ALCAMPO a 2.11.2
CARREFOUR a 2.11.3
DIA a 2.11.4
LIDL a 2.11.5
COCA a 2.11.6
PASCUAL a 2.11.7
LACTALIS a 2.11.8
EMBAJADORES a 2.11.9
JASA a 2.11.10
FRITRAVICH a 2.11.11
PRODESCO a 2.11.12
TGT a 2.11.13
CHINA CAYENTE a 2.11.14
CHINA GRUNONA a 2.11.15
AMAZON bebidas a 2.11.16
HUIJIA a SIN CATEGORIA
ENVAPRO a 2.12.1
PUNTOQPACK a 2.12.2
PAMPOLS a 2.12.3
BOLSEMACK a 2.12.4
WORKANA a 2.23.1
ALQUILER MALICIOSA a 2.31.1
IBERDROLA ENDESA a 2.44.2
REAL GAS NATURGY a 2.44.3
CANAL ISABEL AGUA a 2.44.4
MOVISTAR VODAFONE ORANGE a 2.44.1
RUSHOUR a 2.43.2
SINQRO a 2.43.3
FLYNT a 2.43.5
ANTHROPIC OPENAI CLAUDE a 2.43.6
CONTROL DE PLAGAS a 2.43.7
AEAT IVA a 3.2 o 3.5
TRASPASO a 3.1
BEN MENJAT FRACCIONAMIENTO a 3.6
Uber Glovo Just Eat a 1.1.1 1.1.2 1.1.3
Sin match a SIN CATEGORIA

Al asignar categoria manualmente desde modal a mov sin categoria, crear regla en reglas_conciliacion con match_pattern keyword, categoria_id detalle elegido, creada_por_usuario true. Proximas importaciones aplican.

FIX 13 Wrapper tabs Resumen Movimientos consistente. background fff, border 0.5px solid d0c8bc, border-radius 14px, padding 14px 18px, display inline-flex, gap 6px, margin-bottom 14px. Componente unico.

FIX 14 Estado vacio. Tabla conciliacion 0 registros. App funciona con BD vacia. Cards 0,00 EUR. Tabla mensaje "No hay movimientos en este periodo. Importa un extracto desde el Importador". Boton "Ir al Importador" navega a /importador.

FIX 15 Eliminar fila superior de tabs en Configuracion. Hoy hay 2 filas:
1. Fila superior ELIMINAR: Marcas, Bancos y Cuentas, Plataformas, Usuarios, Calendario operativo
2. Fila inferior MANTENER: sub-tabs especificos del modulo

Eliminar fila superior en TODOS los modulos de Configuracion. Solo quedan sub-tabs como tabs principales. Navegacion entre los 5 modulos solo desde sidebar.

## CRITERIOS

1 Sin "Cuentas y conexiones" duplicado
2 Tabla categorias sin banda
3 Header sin dropdown Cuenta
4 Subtitulo dd/mm/yy
5 Card Ingresos limpia
6 Card Gastos limpia
7 Card Pendientes limpia
8 Card Titular limpia
9 Dropdown categoria filtra
10 Tabla layout fijo
11 Filas mas bajas
12 Auto-cat funcional
13 Wrapper tabs consistente
14 Estado vacio + boton Importador
15 Configuracion sin fila tabs superior
16 Sidebar 5 items Configuracion
17 Build limpio
18 Aislamiento Binagre
19 Deploy Vercel
20 Informe final
