# SPEC LITERAL — Bloque MAESTRO consolidado

> Este spec consolida TODO lo pedido por Rubén en sesión 27-28 abril 2026.
> Los valores son LITERALES. NO interpretar. NO improvisar. NO inventar.
> Si un valor no está aquí o en `/src/styles/tokens.ts` o en la guía Notion, ACTUALIZAR antes de implementar.

## Modelos a usar

- **General**: `claude-sonnet-4-7` (Sonnet)
- **Subagentes**: todos en Sonnet
- **Tareas triviales** (renombrados, mover archivos, ediciones de 1-3 líneas): permitido `claude-haiku-4-5-20251001` (Haiku)
- **PROHIBIDO**: cualquier modelo Opus salvo orden expresa de Rubén

---

## Constantes literales (NO preguntar, copiar del repo)

```ts
const SUPABASE_PROJECT_ID = 'eryauogxcpbgdryeimdq'
const RUBEN_ID = '6ce69d55-60d0-423c-b68b-eb795a0f32fe'
const EMILIO_ID = 'c5358d43-a9cc-4f4c-b0b3-99895bdf4354'
const NIF_RUBEN = '21669051S'
const NIF_EMILIO = '53484832B'
const DRIVE_OPERACIONES_ID = '1dB6REknvNl8JxGGuv8MXloUCJ3_evd7H'
const NOTION_DS_BINAGRE_ERP = 'e78ac78f-77b6-485b-a0f0-0bb18be01efa'
const NOTION_GUIA_ESTILO = '350c8b1f-6139-8191-952a-f299926ac42f'

const COLOR_RUBEN = '#F26B1F'
const COLOR_EMILIO = '#1E5BCC'
const RED_SL = '#B01D23'
const SIDEBAR_BG = '#1e2233'
const ACCENT_PANEL = '#e8f442'
const MODAL_BG = '#484f66'
const TAB_ACTIVO_BG = '#FF4757'

// Ciclos pago plataformas
const CICLOS_PAGO = {
  uber: { tipo: 'semanal_lunes', desfase_dias: 0 },
  glovo_q1: { tipo: 'mensual_dia_5_mes_siguiente', dia: 5 },
  glovo_q2: { tipo: 'mensual_dia_20_mes_siguiente', dia: 20 },
  just_eat_q1: { tipo: 'mensual_dia_20_mismo_mes', dia: 20 },
  just_eat_q2: { tipo: 'mensual_dia_5_mes_siguiente', dia: 5 },
  directa: { tipo: 'al_dia' },
  web: { tipo: 'pendiente_definir' }
}

// Bandas de salud sector hostelería
const BANDA_COGS_PCT = [0.25, 0.30]      // Producto
const BANDA_LABOR_PCT = [0.30, 0.35]     // Equipo
const BANDA_PRIME_PCT = [0.55, 0.65]     // Prime cost = COGS + Labor
const BANDA_OCCUPANCY_PCT = [0.05, 0.10] // Local
const BANDA_OPEX_PCT = [0.13, 0.18]      // Controlables
const BANDA_EBITDA_PCT = [0.10, 0.13]    // EBITDA
```

---

## Reglas duras (cumplimiento obligatorio)

1. Aislamiento absoluto Binagre ↔ David ERP. Si el agente accede a Supabase David (`mcp__claude_ai_Supabase_David__*`), STOP y avisar.
2. Modo localhost. Prohibido `npx vercel --prod`. Solo cuando Rubén diga literalmente "deploy Vercel".
3. Backup BD (snapshot Supabase) ANTES de cualquier migración. Si no hay backup, STOP.
4. Decisiones autónomas según RULES.md §5 + sección "DECISIONES AUTÓNOMAS" al final del spec.
5. NO preguntar lo que se puede deducir del contexto/BD/repo.
6. Si una tarea sale mal, NO continuar siguiente. Documentar bloqueo en `summary.md`.
7. Aplicar guía estilo Notion 350c8b1f-6139-8191-952a-f299926ac42f COMO ÚNICA FUENTE DE VERDAD para tokens visuales.
8. Cada commit intermedio: `git add . && git commit -m "feat(maestro): FASE X" && git push origin master`.

---

# FASE 1 · MOBILE-FRIENDLY GLOBAL

## 1.1 Setup Tailwind responsive

Breakpoints obligatorios (estándar Tailwind):
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

## 1.2 Sidebar responsive

1. En `< 768px`: sidebar oculto por defecto, botón burger arriba izquierda fixed (44x44px).
2. Click burger → sidebar entra con `transform: translateX(0)` desde -100%, transición 250ms ease.
3. Overlay oscuro `rgba(0,0,0,0.5)` detrás del sidebar móvil.
4. Click overlay o item del sidebar → cierra sidebar.
5. En `>= 768px`: sidebar visible siempre, sin burger.

## 1.3 Cards grid responsive

1. `< 640px`: 1 columna, gap 12px, full width.
2. `640-1023px`: 2 columnas, gap 14px.
3. `>= 1024px`: 3-5 columnas según contexto del módulo (definido por módulo).

## 1.4 Tablas responsive

1. `< 768px`: scroll horizontal con `overflow-x-auto`. Primera columna `position: sticky; left: 0; background: white; z-index: 5`.
2. `>= 768px`: tabla normal sin scroll.

## 1.5 Tipografía responsive

| Elemento | Mobile (<640) | Tablet (640-1023) | Desktop (>=1024) |
|---|---|---|---|
| Valor KPI grande | 1.5rem | 1.8rem | 2.4rem |
| Título página | 18px | 20px | 22px |
| Sublabel card | 11px | 12px | 12px |
| Body | 14px | 14px | 14px |

## 1.6 Touch targets

1. Mínimo 44x44px en mobile para todo botón, link, dropdown.
2. Padding interno mínimo 12px en mobile.

## 1.7 Validación obligatoria

Probar EXPLÍCITAMENTE cada módulo en estos viewports y guardar capturas en `.claude/tracking/mobile-validation/{modulo}-{viewport}.png`:
- 375px (iPhone SE)
- 768px (tablet)
- 1280px (desktop)

Módulos prioritarios:
1. Panel Global (5 tabs)
2. Conciliación
3. Facturación
4. Objetivos
5. Punto de Equilibrio
6. Running
7. Importador (nuevo, FASE 9)
8. Tareas (nuevo, FASE 10)
9. Configuración (5 tabs)
10. Equipo (FASE 11)

---

# FASE 2 · TOKENS CANÓNICOS Y GUÍA DE ESTILO

## 2.1 Sincronización tokens.ts ↔ Notion

Validar y actualizar `/src/styles/tokens.ts` para que CADA token coincida exactamente con la guía Notion 350c8b1f-6139-8191-952a-f299926ac42f. Si hay discrepancia, prevalece la guía Notion.

## 2.2 Tipografías literales (Oswald + Lexend)

```ts
export const FONT = {
  body: 'Lexend, sans-serif',
  heading: 'Oswald, sans-serif',
  title: 'Oswald, sans-serif',
}
```

| Uso | Familia | Tamaño | Peso | Letter spacing | Transform |
|---|---|---|---|---|---|
| Título página | Oswald | 22px | 600 | 3px | uppercase |
| Sublabel card (INGRESOS NETOS, VENTAS) | Oswald | 12px | 500 | 2px | uppercase |
| Valor KPI grande | Oswald | 2.4rem | 600 | 0 | none |
| Valor KPI mediano | Oswald | 1.6rem | 600 | 0 | none |
| Body | Lexend | 14px | 400 | 0 | none |
| Texto comparativa (▲ 11%) | Lexend | 12px | 400 | 0 | none |
| Texto badge canal | Oswald | 10px | 500 | 0.5px | uppercase |

## 2.3 Colores literales

Light mode (default):
```ts
const lightT = {
  bg: '#f5f3ef',       // Fondo página
  group: '#ebe8e2',    // Fondo grupo cards
  card: '#ffffff',     // Fondo card
  brd: '#d0c8bc',      // Borde
  pri: '#111111',      // Texto principal
  sec: '#3a4050',      // Texto secundario
  mut: '#7a8090',      // Texto muted (labels, fechas)
  inp: '#ffffff',      // Fondo inputs
  emphasis: '#FF4757', // Tab activo, énfasis
  accent: '#FF4757',
}
```

Dark mode:
```ts
const darkT = {
  bg: '#0d1120',
  group: '#131928',
  card: '#1a1f32',
  brd: '#2a3050',
  pri: '#f0f0ff',
  sec: '#9ba8c0',
  mut: '#5a6880',
  inp: '#1a1f32',
  emphasis: '#FF4757',
  accent: '#FF4757',
}
```

Marca:
- Rojo Streat Lab `#B01D23` → solo títulos página, logos
- Sidebar `#1e2233`
- Modal `#484f66`
- Amarillo Glovo `#e8f442` → solo color canal Glovo en gráficos. PROHIBIDO como acento UI.

Semáforo cumplimiento:
- Verde `#1D9E75` → ≥ 80%
- Ámbar `#f5a623` → 50-79%
- Rojo `#E24B4A` → < 50%

Canales:
- Uber Eats `#06C167`
- Glovo `#e8f442`
- Just Eat `#f5a623`
- Web `#B01D23`
- Directa `#66aaff`

Días semana (para gráfico Días pico):
- Lunes `#1E5BCC`
- Martes `#06C167`
- Miércoles `#f5a623`
- Jueves `#B01D23`
- Viernes `#66aaff`
- Sábado `#F26B1F`
- Domingo `#1D9E75`

## 2.4 Eliminar amarillo acento v1

Buscar en TODO el código uso de amarillo acento del v1 antiguo (excepto `#e8f442` que es token canónico Glovo). Sustituir por:
- Si era acento UI → `#FF4757`
- Si era separador → `#d0c8bc`
- Si era highlight → eliminar

Comando obligatorio para detectar:
```bash
grep -r "background:\s*['\"]#FFD" src/
grep -r "background:\s*['\"]#FFE" src/
grep -r "borderBottom:.*yellow" src/
```

Cualquier match hay que revisar y sustituir.

---

# FASE 3 · COMPONENTES COMPARTIDOS LITERALES

## 3.1 SelectorFechaUniversal

Crear `/src/components/ui/SelectorFechaUniversal.tsx`:

Opciones EXACTAS (en este orden):
1. "Semana actual"
2. "Últimos 7 días"
3. "Mes en curso"
4. "Un mes hasta ahora" (= últimos 30 días)
5. "Últimos 60 días"
6. "Personalizado"
7. "Semanas X" (al pulsar despliega selector secundario)

Comportamiento "Semanas X":
- Al pulsar, despliega segundo dropdown a la DERECHA del primero (no debajo).
- El segundo dropdown lista: `Semana ${semanaISO}, ${fmtFechaCorta(lunesSemana)}` desde semana actual hasta semana 1 del año en curso.
- Si la semana actual es ≤ semana 4, añadir las semanas del año anterior necesarias hasta tener 12 semanas mínimo en el listado.
- Cada semana cubre lunes a domingo (ISO 8601).

Comportamiento "Personalizado":
- Abre date range picker con dos inputs: fecha desde / fecha hasta.
- Aplicar al confirmar.

Persistencia:
- Guardar selección en `sessionStorage` con key `selector_fecha_${nombreModulo}`.
- Al cargar el módulo, leer key y restaurar selección.
- Persiste mientras la pestaña del navegador esté abierta. Se pierde al cerrar pestaña (sessionStorage, no localStorage).

Cualquier gráfico/card/tabla del módulo:
- Recibe `periodoDesde` y `periodoHasta` por props.
- Refetch datos cuando cambia.
- Comparativa "vs anterior" usa periodo equivalente anterior:
  - Día → día anterior
  - Semana → semana anterior
  - Mes → mes anterior
  - Año → año anterior

Estilo del selector:
- Mismo dropdown estándar tokens (`dropdownBtnStyle`, `dropdownMenuStyle`).
- Padding 6px 10px.
- Border 0.5px solid #d0c8bc.
- Background #ffffff.

## 3.2 BarraCumplimiento

Crear `/src/components/ui/BarraCumplimiento.tsx`:

Props:
```ts
interface BarraCumplimientoProps {
  porcentaje: number          // 0-100+
  multiSegmento?: boolean      // si true, divide en cumplido + pendiente
  altura?: number              // default 8
  mostrarEtiqueta?: boolean    // muestra % al lado
}
```

Estilo LITERAL:
```ts
const barra = {
  height: 8,
  borderRadius: 4,
  background: '#ebe8e2',
  position: 'relative',
  overflow: 'hidden',
  transition: 'width 0.5s ease',
}

const fillEstilo = (pct: number) => ({
  height: '100%',
  width: `${Math.min(pct, 100)}%`,
  background: pct >= 80 ? '#1D9E75' : pct >= 50 ? '#f5a623' : '#E24B4A',
  borderRadius: 4,
  transition: 'width 0.5s ease',
})
```

Multi-segmento (cumplido + pendiente):
- Sub-barra verde `#1D9E75` ancho `pct%`
- Sub-barra roja `#E24B4A` ancho `(100-pct)%`
- División clara entre ambas sin gap

## 3.3 TabConciliacion (componente compartido)

Crear `/src/components/ui/TabConciliacion.tsx`:

Props:
```ts
interface TabsProps {
  tabs: Array<{ id: string; label: string }>
  activeId: string
  onChange: (id: string) => void
}
```

Estilos LITERALES (NO interpretar):

Tab activa:
```ts
{
  padding: '6px 14px',
  borderRadius: 6,
  border: 'none',
  background: '#FF4757',
  color: '#ffffff',
  fontFamily: 'Lexend, sans-serif',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background 150ms',
}
```

Tab inactiva:
```ts
{
  padding: '6px 14px',
  borderRadius: 6,
  border: '0.5px solid #d0c8bc',
  background: 'transparent',
  color: '#3a4050',
  fontFamily: 'Lexend, sans-serif',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background 150ms',
}
```

Container:
```ts
{
  display: 'flex',
  gap: 8,
  marginBottom: 16,
  flexWrap: 'wrap',  // mobile-friendly
}
```

PROHIBIDO:
- Guión amarillo subrayando.
- Rojo `#B01D23` en tabs (es para títulos).
- Cualquier otra variación. Si el módulo necesita tabs, USA ESTE COMPONENTE. No crear variantes.

## 3.4 SidebarBadge

Crear `/src/components/ui/SidebarBadge.tsx`:

Props:
```ts
interface SidebarBadgeProps {
  count: number
}
```

Estilo LITERAL:
```ts
{
  display: count > 0 ? 'inline-flex' : 'none',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 18,
  height: 18,
  padding: '0 6px',
  borderRadius: 9,
  background: '#E24B4A',
  color: '#ffffff',
  fontSize: 11,
  fontWeight: 600,
  fontFamily: 'Lexend, sans-serif',
  marginLeft: 8,
}
```

---

# FASE 4 · PLAN CONTABLE Y MIGRACIÓN BD

## 4.1 Esquema 5 categorías

Tabla `categorias_maestras`:
```sql
CREATE TABLE categorias_maestras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(20) NOT NULL UNIQUE,
  grupo VARCHAR(20) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  banda_min DECIMAL(5,4),
  banda_max DECIMAL(5,4),
  orden INTEGER NOT NULL,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

Datos iniciales (inserción literal):
```sql
INSERT INTO categorias_maestras (codigo, grupo, nombre, banda_min, banda_max, orden) VALUES
-- INGRESOS
('ING-UE', 'ingresos', 'Uber Eats', NULL, NULL, 1),
('ING-GL', 'ingresos', 'Glovo', NULL, NULL, 2),
('ING-JE', 'ingresos', 'Just Eat', NULL, NULL, 3),
('ING-WEB', 'ingresos', 'Web', NULL, NULL, 4),
('ING-DIR', 'ingresos', 'Directa', NULL, NULL, 5),
('ING-OTRO', 'ingresos', 'Otros', NULL, NULL, 6),
-- PRODUCTO (COGS 25-30%)
('PRD-MP', 'producto', 'Materia prima', 0.25, 0.30, 10),
('PRD-BEB', 'producto', 'Bebidas', NULL, NULL, 11),
('PRD-PCK', 'producto', 'Packaging', NULL, NULL, 12),
('PRD-MER', 'producto', 'Mermas', NULL, NULL, 13),
-- EQUIPO (Labor 30-35%)
('EQP-NOM', 'equipo', 'Nóminas', 0.30, 0.35, 20),
('EQP-RUB', 'equipo', 'Rubén', NULL, NULL, 21),
('EQP-EMI', 'equipo', 'Emilio', NULL, NULL, 22),
('EQP-SS', 'equipo', 'Seguridad Social', NULL, NULL, 23),
('EQP-GES', 'equipo', 'Gestoría laboral', NULL, NULL, 24),
('EQP-FOR', 'equipo', 'Formación', NULL, NULL, 25),
-- LOCAL (Occupancy 5-10%)
('LOC-ALQ', 'local', 'Alquiler', 0.05, 0.10, 30),
('LOC-IRP', 'local', 'IRPF retención alquiler', NULL, NULL, 31),
('LOC-SUM', 'local', 'Suministros (luz/gas/agua)', NULL, NULL, 32),
('LOC-NET', 'local', 'Internet', NULL, NULL, 33),
('LOC-MTO', 'local', 'Mantenimiento', NULL, NULL, 34),
('LOC-LIM', 'local', 'Limpieza', NULL, NULL, 35),
('LOC-COM', 'local', 'Comunidad', NULL, NULL, 36),
-- CONTROLABLES (OPEX 13-18%)
('CTR-MKT', 'controlables', 'Marketing', 0.13, 0.18, 40),
('CTR-SW', 'controlables', 'Software', NULL, NULL, 41),
('CTR-GEF', 'controlables', 'Gestoría fiscal', NULL, NULL, 42),
('CTR-BNK', 'controlables', 'Banco', NULL, NULL, 43),
('CTR-SEG', 'controlables', 'Seguros', NULL, NULL, 44),
('CTR-LIC', 'controlables', 'Licencias', NULL, NULL, 45),
('CTR-TRP', 'controlables', 'Transporte', NULL, NULL, 46),
('CTR-OTR', 'controlables', 'Otros', NULL, NULL, 47),
-- PLATAFORMAS (descuento ingreso, NO gasto)
('PLT-UE', 'plataformas', 'Comisiones Uber', NULL, NULL, 50),
('PLT-GL', 'plataformas', 'Comisiones Glovo', NULL, NULL, 51),
('PLT-JE', 'plataformas', 'Comisiones Just Eat', NULL, NULL, 52),
('PLT-RUS', 'plataformas', 'Comisiones Rushour', NULL, NULL, 53),
('PLT-WEB', 'plataformas', 'Comisiones pasarela web', NULL, NULL, 54),
('PLT-IVA', 'plataformas', 'IVA 21% sobre comisiones', NULL, NULL, 55),
-- INTERNO (NO computa)
('INT-TRF', 'interno', 'Traspaso entre cuentas', NULL, NULL, 90),
('INT-IVA', 'interno', 'Devolución IVA', NULL, NULL, 91),
('INT-PRS', 'interno', 'Préstamo socio', NULL, NULL, 92),
('INT-AJU', 'interno', 'Ajuste contable', NULL, NULL, 93);
```

## 4.2 Mapping table 53 antiguas → nuevas

Crear archivo `migrations/categoria-mapping.sql` con UPDATE statements para cada categoría antigua. El implementer debe leer las 53 actuales con:

```sql
SELECT DISTINCT categoria FROM conciliacion ORDER BY categoria;
```

Y generar el mapping siguiendo estas reglas:
1. Cualquier categoría con palabra "RRHH", "Personal", "Salario", "Nomina" → `EQP-NOM`
2. Cualquier categoría con "Mercadona", "Carrefour", "Compra ingredient" → `PRD-MP`
3. Cualquier categoría con "Alquiler", "Arrendamiento" → `LOC-ALQ`
4. Cualquier categoría con "Luz", "Gas", "Agua" → `LOC-SUM`
5. Cualquier categoría con "Internet", "Fibra", "Telecomunic" → `LOC-NET`
6. Cualquier categoría con "Limpieza" → `LOC-LIM`
7. Cualquier categoría con "Marketing", "Publicidad", "Ads" → `CTR-MKT` (ojo: ADS de plataformas NO van aquí, ver FASE 7)
8. Cualquier categoría con "Software", "SaaS" → `CTR-SW`
9. Cualquier categoría con "Gestoría", "Asesoría", "Contable" → `CTR-GEF`
10. Cualquier categoría con "Banco", "Comisiones banc" → `CTR-BNK`
11. Cualquier categoría con "Seguro" → `CTR-SEG`
12. Cualquier categoría con "Uber", "Portier" → `PLT-UE`
13. Cualquier categoría con "Glovo" → `PLT-GL`
14. Cualquier categoría con "Just Eat", "Takeaway" → `PLT-JE`
15. Cualquier categoría con "Rushour" → `CTR-SW` (es agregador-software, no plataforma de venta directa)
16. Si una categoría es ambigua → preguntar a Rubén con lista exacta de candidatos.

## 4.3 Migración

Pasos en orden:
1. `pg_dump` snapshot completo (Supabase auto-snapshot disponible). Verificar antes de continuar.
2. Crear tabla `categorias_maestras`.
3. Insertar 38 categorías iniciales (script 4.1).
4. Crear tabla `categoria_mapping_log` para auditoría:
   ```sql
   CREATE TABLE categoria_mapping_log (
     movimiento_id UUID,
     categoria_antigua VARCHAR(100),
     categoria_nueva_codigo VARCHAR(20),
     timestamp TIMESTAMP DEFAULT NOW()
   );
   ```
5. Recategorizar `conciliacion` (5.716 movs):
   - UPDATE en lote con mapping de 4.2.
   - Loggear cada cambio.
6. Recategorizar `gastos` Running.
7. Validar: `SELECT categoria_nueva_codigo, COUNT(*) FROM categoria_mapping_log GROUP BY categoria_nueva_codigo ORDER BY 2 DESC`. Debe sumar 5.716+ movs.
8. NO eliminar campo `categoria` antiguo todavía (deprecar primero, eliminar en fase posterior una vez validado).

---

# FASE 5 · PANEL GLOBAL · FIXES PROFUNDOS

## 5.1 Header del módulo

Estructura del header (de izquierda a derecha):
1. Título "PANEL GLOBAL" (Oswald 22px 600 #B01D23 letter-spacing 3px uppercase)
2. Subtítulo dinámico según selector (ej. "27 abr - 3 may 2026") (Lexend 13px #7a8090)
3. Espacio flexible (justify-content: space-between)
4. SelectorFechaUniversal (componente de FASE 3.1)
5. Dropdown "Todas las marcas" (default)
6. Dropdown "Canales" (NO "Todos los canales") con multi-select de canales

Cuando se elige "Personalizado" en SelectorFechaUniversal:
- Los inputs de rango se muestran a la DERECHA de "Canales", NO arriba.
- En mobile (<768px) se muestran debajo.

## 5.2 Tabs del módulo

Usar `<TabConciliacion>` (FASE 3.3). Tabs en este orden:
1. "General" (default activo)
2. "Operaciones"
3. "Finanzas"
4. "Cashflow"
5. "Marcas"

PROHIBIDO guión amarillo subrayando. Solo el componente compartido.

## 5.3 Inventario obligatorio previo

ANTES de redistribuir cards entre tabs, generar entregable:
`.claude/tracking/inventario-elementos-modulos-viejos.md`

Contenido obligatorio del entregable:
```md
# Inventario elementos módulos viejos

## Panel Global (versión anterior)
| Elemento | Tipo (card/grafico/tabla) | Dato que muestra | Fuente | Valor único / duplicado / obsoleto / placeholder |
| ... | ... | ... | ... | ... |

## Running (versión anterior)
| ... |

## PE (versión anterior)
| ... |

## Conciliación (referencia oro intacta, NO tocar)
| ... |

## Análisis (eliminado, qué tenía dentro)
| ... |

## Facturación (versión anterior)
| ... |

## Objetivos (versión anterior)
| ... |

## DECISIÓN DE REDISTRIBUCIÓN

### Tab General (Panel)
- Card X (motivo)
- Card Y (motivo)

### Tab Operaciones
- ...

### Tab Finanzas
- ...

### Tab Cashflow
- ...

### Tab Marcas
- ...

### Eliminados
- Lista de elementos descartados (motivo: duplicado/obsoleto/placeholder)
```

PROHIBIDO empezar a tocar tabs antes de completar este entregable. Si el implementer empieza sin el inventario, qa-reviewer rechaza.

## 5.4 Tab General

Cards (en este orden):

### Card 1: VENTAS (grande)
Sublabel: "VENTAS"
Estructura interna:
1. Valor grande del periodo seleccionado: ingresos brutos del periodo. (Oswald 2.4rem)
2. Comparativa: "▼ X% vs anterior" o "▲ X%" (verde/rojo según signo)
3. Línea SEMANAL — barra cumplimiento + texto "Faltan X€ de Y€"
4. Línea MENSUAL — barra cumplimiento + texto "Faltan X€ de Y€"
5. Línea ANUAL — barra cumplimiento + texto "Faltan X€ de Y€"

Lectura de objetivos:
- SEMANAL: `SELECT objetivo_semanal FROM objetivos WHERE año = YEAR(NOW()) AND semana = WEEK(NOW())`
- MENSUAL: `SELECT objetivo_mensual FROM objetivos WHERE año = YEAR(NOW()) AND mes = MONTH(NOW())`
- ANUAL: `SELECT objetivo_anual FROM objetivos WHERE año = YEAR(NOW())`

Editable inline:
1. Hover sobre la cifra del objetivo (Y€) → cambia color a #FF4757 + cursor pointer.
2. Click → la cifra se convierte en `<input type="number">` con valor actual.
3. Enter o blur → guarda en BD tabla `objetivos`. Toast verde "Objetivo actualizado".
4. Si el input queda vacío (string "") y se hace Enter → restaura el original consultando la fila en BD. Toast amarillo "Objetivo restaurado".
5. ESC → cancela edición.

Refresh propagación:
- Tras guardar, propagar a módulo Objetivos (mismo origen de datos, lectura directa BD).
- Tras restaurar, idem.

Implementación nota: usar React Query con `invalidateQueries` clave `['objetivos']`.

### Card 2: PEDIDOS (grande)
Sublabel: "PEDIDOS"
Estructura:
1. Valor grande: total pedidos del periodo. (Oswald 2.4rem)
2. Comparativa vs anterior.
3. Desglose por canal con barras horizontales:
   - Uber Eats `#06C167` con valor + %
   - Glovo `#e8f442` con valor + %
   - Just Eat `#f5a623` con valor + %
   - Web `#B01D23` con valor + %
   - Directa `#66aaff` con valor + %

### Card 3: TM BRUTO · NETO (grande)
Sublabel: "TM BRUTO · NETO"
Estructura:
1. Lado izquierdo: TM bruto = ingresos_brutos / pedidos. (Oswald 2.4rem 600 color #111111)
2. Lado derecho: TM neto = ingresos_netos / pedidos. (Oswald 1.4rem 600 color #1D9E75 verde)
3. Layout: flex row con gap 16px en desktop, columna en mobile.

### Cards 4-8: Plataformas (Uber/Glovo/Just Eat/Web/Directa)

Una card por canal. Cada card:
1. Sublabel: nombre canal (ej. "UBER EATS")
2. Bruto facturado (Oswald 1.6rem)
3. Neto cobrado (Oswald 1.4rem color verde #1D9E75)
4. % Margen (real, ver fórmula 5.4.1)
5. Si hay datos de ADS de la marca/canal: pequeño badge informativo "ADS: X€"

Background card: color suave del canal (10% opacidad).

#### 5.4.1 Cálculo neto cobrado por canal

Uber/Portier (con resumen mensual cargado, ver FASE 7):
```
neto_cobrado_uber = bruto - comision_pct * bruto - fees_total - cargos_promocion - 0.21 * (comision_pct * bruto + fees_total + cargos_promocion)
% margen = (neto_cobrado_uber / bruto) * 100
```

NOTA: ADS NO se restan al neto. ADS son gasto separado informativo.

Glovo:
```
neto_cobrado_glovo = bruto - comision_pct_glovo * bruto - comision_fija_glovo * pedidos - 0.21 * (comision_pct_glovo * bruto + comision_fija_glovo * pedidos)
```
Comisiones se leen de tabla `canales`:
- `comision_pct_glovo` = 0.25 default (configurable)
- `comision_fija_glovo` = 0.75 default

Just Eat:
```
neto_cobrado_je = bruto - 0.20 * bruto - 0.75 * pedidos - 0.21 * (0.20 * bruto + 0.75 * pedidos)
```

Web (pasarela Stripe/Redsys):
```
neto_cobrado_web = bruto - 0.07 * bruto - 0.50 * pedidos - 0.21 * (0.07 * bruto + 0.50 * pedidos)
```

Directa (al día, sin comisión):
```
neto_cobrado_directa = bruto
```

#### 5.4.2 Validación contra conciliación bancaria

Cron diario a las 03:00 ejecuta procedimiento `validar_neto_vs_banca()`:

```sql
CREATE TABLE validaciones_plataforma_banca (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes INTEGER,
  año INTEGER,
  plataforma VARCHAR(20),
  neto_calculado DECIMAL(10,2),
  neto_bancario DECIMAL(10,2),
  diferencia_pct DECIMAL(5,2),
  estado VARCHAR(10),  -- 'OK' | 'ALERTA' | 'ERROR'
  fecha_validacion TIMESTAMP DEFAULT NOW(),
  detalle JSONB  -- guarda movimientos bancarios identificados
);
```

Identificación movimientos bancarios como ingreso plataforma:
1. Concepto contiene "UBER" o "PORTIER" → plataforma = 'uber'
2. Concepto contiene "GLOVO" o "GLOVOAPP" → 'glovo'
3. Concepto contiene "JUST EAT" o "TAKEAWAY" → 'just_eat'
4. Concepto contiene "STRIPE" o "REDSYS" o "ADYEN" → 'web'
5. Suma TODOS los movimientos del mes con esa plataforma.

Reglas estado:
- `OK`: |diferencia_pct| ≤ 1%
- `ALERTA`: 1% < |diferencia_pct| ≤ 5%
- `ERROR`: |diferencia_pct| > 5%

Ejecución:
- Cron mensual día 5 (cuando ya hay todos los pagos del mes anterior).
- También al subir un resumen mensual nuevo en Importador (re-valida ese mes).

Visualización:
- En card plataforma del Panel: tooltip al hover sobre % margen muestra estado + diferencia.
- Icono ámbar/rojo según estado.
- En módulo Tareas: si ALERTA o ERROR, crea tarea pendiente automática.

### Card 9: DÍAS PICO (full-width abajo)

Sublabel: "DÍAS PICO — {periodo_seleccionado}"
- Gráfico barras 7 columnas (Lun-Dom).
- Datos REALES desde `facturacion_diaria` agrupados por `EXTRACT(DOW FROM fecha)`.
- Cada barra color del día (FASE 2.3 → Días semana).
- Valor encima de cada barra (Oswald 12px).
- Click sobre barra: filtra Panel al día específico de la semana.

EXCLUIR días marcados como CERRADO en `calendario_operativo` (FASE 6).

### Card 10: TOP VENTAS (full-width abajo)

Lista numerada 1-5 productos más vendidos del periodo.
- Nombre producto.
- Badge canal (con color del canal donde más se vendió).
- Cantidad vendida.
- Importe total.

Botón "Productos" / "Modif." en la cabecera para alternar vista.

## 5.5 Tab Operaciones

Cards (sin duplicar con General):

### Pedidos por hora del día (heatmap)
Heatmap simplificado 4 franjas:
- Mañana (8-12h)
- Mediodía (12-16h)
- Tarde (16-19h)
- Noche (19-23:59h)

Color intensidad según volumen pedidos.

### Ratio ALM vs CENA
Donut chart % almuerzos vs cenas del periodo.

### Mix canales (% pedidos por canal)
Barras horizontales con % por canal del periodo.

### Evolución pedidos vs anterior
Línea temporal: pedidos del periodo vs periodo anterior comparable.

### KPI repetición clientes
Si la fuente de datos POS (Sinqro) está conectada y hay dato de cliente_id repetido: % clientes repetidores.
Si NO hay dato: card con texto "Pendiente integración POS para datos repetición".

## 5.6 Tab Finanzas

Cards:

### Ingresos brutos del periodo
Sublabel "INGRESOS BRUTOS"
Valor grande + comparativa vs anterior.

### Comisiones plataformas
Desglose por plataforma con valor cada una. Total comisiones.

### Ingresos netos
Sublabel "INGRESOS NETOS"
Valor grande + desglose por plataforma con barras (estilo Conciliación referencia).

### Ratio gastos / netos
Valor + semáforo con bandas:
- ≤ 65% = OK (verde)
- 65-75% = Atención (ámbar)
- > 75% = Crítico (rojo)

### Margen real validado
Valor del margen real del periodo + estado validación banca (icono OK/ALERTA/ERROR).

### Comparativa vs presupuesto Objetivos
Barras comparando real del periodo vs presupuesto del módulo Objetivos.

### ADS por marca/canal (informativo, NO resta)

Tabla:
| Marca | Canal | ADS mes | ADS últ 3 meses |
|---|---|---|---|

Tooltip al hover en ADS: "Gasto en publicidad pagada (Uber Ads, Glovo Promo, etc.). Informativo. NO afecta margen real."

## 5.7 Tab Cashflow

Cards:

### Cobros pendientes
Tabla detallada:
| Plataforma | Marca | Periodo facturado | Bruto | Neto estimado | Fecha pago estimada |

Cálculo fecha pago según `CICLOS_PAGO`.

### Pagos pendientes
Tabla detallada:
| Proveedor | Concepto | Importe | Vencimiento | Tipo (fijo/variable) |

Fijos: leer tabla `gastos_fijos` (alquiler, sueldos, SS, etc.).
Variables: leer facturas `pagada=false` con `fecha_vencimiento` asignada.

### Provisiones IVA / IRPF
Card con dos sub-secciones:
- Provisión IVA = 21% × ventas netas del trimestre actual
- Provisión IRPF = 19% × retención alquiler del año

### Gráfico saldo proyectado
Línea temporal en horizontal con 5 puntos: Hoy, +7d, +30d, +3m, +6m, +1a.
Background barra verde tipo "Hoy → 30d" (estilo del actual).

Cálculo en cada punto:
```
saldo_punto = saldo_actual + Σ(cobros_pendientes_hasta_punto) - Σ(pagos_pendientes_hasta_punto)
```

### Calendario pagos críticos próximos 90 días
Lista cronológica de pagos > 500€ próximos 90 días. Marcar en rojo si > 1000€ y en los próximos 7 días.

## 5.8 Tab Marcas

ESTA TAB DEPENDE DE FASE 7 (importador funcional). Hasta entonces, mostrar placeholder informativo: "Pendiente subir resúmenes Uber/Glovo/Just Eat por marca. Ir al Importador →"

Cuando hay datos:

### Matriz cruzada Plataforma × Marca (heatmap)
Tabla pivote:
- Filas: marcas (de tabla `marcas`)
- Columnas: plataformas (Uber/Glovo/Just Eat/Web/Directa)
- Celdas: bruto facturado del periodo
- Color intensidad según valor (heatmap)

### Top 5 marcas del periodo
Lista ordenada por bruto. Cada marca: bruto, pedidos, TM, % sobre total.

### Margen real por combo marca×canal
Tabla:
| Marca | Canal | Bruto | Neto | % Margen |

### Evolución mensual por marca
Gráfico líneas (recharts), una por marca, eje X últimos 12 meses.

### Acciones recomendadas
Sección con motor de decisiones (mismo que PE FASE 8):
- "Pausa marca X en plataforma Y" si margen < 5% durante 4 semanas
- "Sube precios marca X en plataforma Y" si demanda alta y margen < 15%
- "Refuerza marketing combo marca+canal ganador" si margen > 25%

---

# FASE 6 · CALENDARIO OPERATIVO

## 6.1 Tabla BD

```sql
CREATE TABLE calendario_operativo (
  fecha DATE PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('operativo','solo_comida','solo_cena','cerrado','festivo','vacaciones')),
  nota VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);
```

Seed inicial: insertar todos los días del año actual + año siguiente como `tipo='operativo'`.

## 6.2 UI Calendario operativo

Crear tab "Calendario operativo" en Configuración (5ª tab tras Marcas/Categorías/Plataformas/Cuentas/Usuarios → 6ª tab).

UI:
1. Vista calendario mensual (componente date-fns + custom rendering).
2. Navegación: ← mes anterior · mes actual · → mes siguiente.
3. Click en día: abre modal con dropdown de tipos.
4. Bulk select: shift+click para seleccionar rango.
5. Modal de tipo guarda en BD.
6. Color por tipo:
   - Operativo: blanco
   - Solo comida: amarillo claro `#fff3a0`
   - Solo cena: azul claro `#a0c4ff`
   - Cerrado: gris `#cccccc`
   - Festivo: rojo claro `#ffadad`
   - Vacaciones: morado claro `#caa0ff`

## 6.3 Función `dias_operativos_periodo`

Función SQL:
```sql
CREATE OR REPLACE FUNCTION dias_operativos_periodo(desde DATE, hasta DATE)
RETURNS INTEGER AS $$
  SELECT COUNT(*) FROM calendario_operativo
  WHERE fecha BETWEEN desde AND hasta
  AND tipo IN ('operativo', 'solo_comida', 'solo_cena')
$$ LANGUAGE SQL;
```

## 6.4 Aplicación en módulos

Sustituir TODA referencia hardcoded a "22 días/mes" o "5 días/semana" por llamada a `dias_operativos_periodo()`.

Lugares afectados:
1. PE: cálculo "días para cubrir fijos"
2. PE: pedidos/día necesarios
3. Facturación: objetivo semanal/diario
4. Running: media diaria
5. Panel: "Faltan X€ de Y€" considera operativos restantes
6. Objetivos: % real / objetivo ajustado

## 6.5 Visualización en módulos

### Facturación
- Día CERRADO en tabla diaria: fondo gris claro + texto "CERRADO" en lugar de €.
- Excluir del cálculo media.

### Objetivos
- Día CERRADO en card "Objetivo por día": ocultar / grisar.
- Banner aviso: "Esta semana hay X días cerrados, objetivo ajustado a Y€" si días cerrados > 0.

### Panel
- Card Días pico: excluir días CERRADO.

---

# FASE 7 · IMPORTADOR UNIFICADO (NUEVO MÓDULO)

## 7.1 Estructura

1. Eliminar módulo "Importar Plataformas" actual del sidebar.
2. Crear módulo "Importador":
   - Ruta: `/importador`
   - Icono: `ArrowDownTray` (Lucide React)
   - Posición sidebar: bajo Conciliación, antes de Equipo (cuando exista en FASE 11)
3. Tabs (componente FASE 3.3):
   1. "Subir"
   2. "Histórico"
   3. "Pendientes"
   4. "Resúmenes plataforma"

## 7.2 Tab Subir

Dropzone único multi-formato:
- Acepta: `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.csv`, `.xlsx`, `.xls`, `.doc`, `.docx`
- Drag & drop + click para seleccionar (botón "Seleccionar archivo").
- Preview del archivo subido (icono según tipo, nombre, peso).

### 7.2.1 Detección automática del tipo (en orden de evaluación)

Reglas LITERALES (NO interpretar):

1. PDF/imagen + OCR detecta NIF emisor `B88515200` → tipo: `factura_uber_portier`
2. PDF/imagen + OCR detecta NIF emisor `B67282871` → tipo: `factura_glovo`
3. PDF/imagen + OCR detecta cabecera "RusHour" o "Just Eat" o "Takeaway" → tipo: `factura_jeat_rushour`
4. PDF/imagen + OCR detecta NIF emisor distinto a los anteriores → tipo: `factura_proveedor`
5. CSV con cabecera que contiene "FECHA;CONCEPTO;BENEFICIARIO;IMPORTE" o variantes con palabra "BBVA" → tipo: `extracto_bancario`
6. XLSX con cabecera "Mes" + "Plataforma" + "Marca" → tipo: `resumen_plataforma_marca`
7. PDF/imagen + texto contiene "NÓMINA" o "Salario neto" + IBAN empleado → tipo: `nomina`
8. CSV diario con cabecera "fecha;canal;pedidos;bruto" → tipo: `ventas_plataforma_csv`
9. Si NO matchea ninguna regla → tipo: `desconocido`, pedir confirmación al usuario con dropdown.

### 7.2.2 Routing tras detección

Tabla `imports_log`:
```sql
CREATE TABLE imports_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archivo_nombre VARCHAR(255),
  archivo_url TEXT,  -- URL en Drive
  tipo_detectado VARCHAR(50),
  estado VARCHAR(20),  -- 'procesado' | 'pendiente_revision' | 'error'
  destino_modulo VARCHAR(50),
  destino_id UUID,  -- ID del registro creado en módulo destino
  fecha_subida TIMESTAMP DEFAULT NOW(),
  user_id UUID,
  detalle JSONB
);
```

Routing por tipo:
- `factura_uber_portier`, `factura_glovo`, `factura_jeat_rushour`, `factura_proveedor` → tabla `facturas` (módulo Conciliación)
- `extracto_bancario` → tabla `movimientos_bancarios` (módulo Conciliación) tras parseo
- `resumen_plataforma_marca` → tabla `ventas_plataforma_marca_mensual` (Panel tab Marcas, FASE 5.8)
- `nomina` → tabla `nominas` (módulo Equipo, FASE 11)
- `ventas_plataforma_csv` → tabla `ventas_plataforma`
- `desconocido` → estado `pendiente_revision`, queda en tab Pendientes para reasignación manual.

### 7.2.3 Toast confirmación

Al detectar y procesar correctamente:
```
Toast verde 4 segundos:
"✅ Subido: {tipo_legible} — {detalle_clave} ({importe}€)"
Ejemplo: "✅ Subido: Factura Mercadona 31/01/26 — 1.352,71€"
```

Al fallar:
```
Toast rojo 6 segundos:
"❌ No se pudo procesar: {motivo}. Revisar en tab Pendientes."
```

## 7.3 Tab Histórico

Tabla de imports:
| Fecha | Tipo | Archivo | Importe | Estado | Acción |
|---|---|---|---|---|---|

Filtros:
- Por tipo (dropdown con todos los tipos)
- Por fecha (SelectorFechaUniversal)
- Por estado (procesado / pendiente / error)

Click sobre fila: abre detalle modal o navega al módulo destino.

## 7.4 Tab Pendientes

Lista de imports `pendiente_revision` o `error`:
| Fecha | Tipo detectado | Motivo | Acción |
|---|---|---|---|

Acciones por fila:
- Reasignar tipo (dropdown)
- Editar datos (modal)
- Eliminar
- Reintentar parser

## 7.5 Tab Resúmenes plataforma

Solo accesible si hay registros en `ventas_plataforma_marca_mensual`.

Tabla:
| Mes | Año | Plataforma | Marca | Bruto | Neto | ADS | Acciones |
|---|---|---|---|---|---|---|---|

Filtros:
- Por plataforma
- Por marca
- Por mes/año

Click sobre fila → modal detalle:
- Detalle del resumen completo
- Link a PDF original (Drive)
- Botón "Ir a Running" con filtros aplicados
- Botón "Ver en Panel · Marcas" con filtros aplicados

## 7.6 Parsers específicos

### Parser Uber resumen mensual
Archivo PDF con NIF B88515200 + cabecera "Resumen mensual" + tabla por marca.

Extraer por cada fila marca:
- `marca` (nombre cabecera fila)
- `bruto` (columna "Ingresos brutos")
- `pedidos` (columna "Total pedidos")
- `comisiones` (columna "Tasa servicio")
- `fees` (columna "Comisión por canje")
- `cargos_promocion` (columna "Tarifa publicitaria")
- `ads` (columna "Uber Ads gastado")
- `neto_cobrado` (columna "Total a abonar")

Insert en `ventas_plataforma_marca_mensual`:
```sql
(mes, año, plataforma='uber', marca, bruto, pedidos, comisiones, fees, cargos_promocion, ads, neto_cobrado, archivo_origen, fecha_subida)
```

### Parser Glovo resumen mensual
Archivo PDF con NIF B67282871. Parsear formato A (con detalle) y B (resumen).

Stub: si formato no reconocido, dejar en pendientes con mensaje "Sube archivo ejemplo a Tareas para activar parser".

### Parser Just Eat
Pendiente recibir archivo ejemplo de Rubén. Stub que avisa: "Parser Just Eat pendiente. Subir archivo ejemplo a Tareas para activarlo."

### Parser Rushour
Empresa francesa, formato inglés. NIF no español.
Concepto: "PLATINIUM" o similar plan mensual.
Mapping: categoría `CTR-SW`.

---

# FASE 8 · MÓDULO TAREAS PENDIENTES (NUEVO)

## 8.1 Estructura

1. Crear módulo "Tareas":
   - Ruta `/tareas`
   - Icono: `BellRing` (Lucide React)
   - Posición sidebar: TOP, primer item (visibilidad máxima).
2. SidebarBadge (FASE 3.4) con número de pendientes/atrasadas.
3. Tabs (componente FASE 3.3):
   1. "Calendario"
   2. "Lista pendientes"
   3. "Configuración tareas"

## 8.2 Tablas BD

```sql
CREATE TABLE tareas_periodicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  frecuencia VARCHAR(20) CHECK (frecuencia IN ('diaria','semanal','quincenal','mensual','trimestral')),
  dia_esperado INTEGER,  -- 1-7 (lunes-domingo) o 1-31 (mensual)
  modulo_destino VARCHAR(50),  -- 'importador', 'conciliacion', etc.
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tareas_pendientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_periodica_id UUID REFERENCES tareas_periodicas(id),
  fecha_esperada DATE NOT NULL,
  estado VARCHAR(20) CHECK (estado IN ('pendiente','cumplida','atrasada')) DEFAULT 'pendiente',
  fecha_cumplida TIMESTAMP,
  archivo_id_relacionado UUID REFERENCES imports_log(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

Seed inicial:
```sql
INSERT INTO tareas_periodicas (nombre, descripcion, frecuencia, dia_esperado, modulo_destino) VALUES
('Resumen mensual Uber', 'Subir resumen Uber del mes anterior por marca', 'mensual', 5, 'importador'),
('Resumen mensual Glovo', 'Subir resumen Glovo del mes anterior por marca', 'mensual', 5, 'importador'),
('Resumen mensual Just Eat', 'Subir resumen Just Eat del mes anterior por marca', 'mensual', 5, 'importador'),
('Facturas semanales', 'Revisar inbox y subir facturas proveedores', 'semanal', 1, 'importador'),
('Movimientos bancarios', 'Descargar extracto BBVA y subir', 'semanal', 1, 'importador'),
('Nóminas', 'Subir nóminas del mes', 'mensual', 28, 'importador'),
('Cierre fiscal trimestral', 'Recopilar datos para cierre trimestre', 'trimestral', 1, 'general');
```

## 8.3 Generación tareas pendientes (cron)

Cron diario 00:01:
1. Para cada `tareas_periodicas` activa:
   - Calcular próxima fecha esperada según frecuencia + día.
   - Si no existe en `tareas_pendientes` con esa fecha → INSERT estado='pendiente'.
2. Para cada tarea pendiente con `fecha_esperada < hoy`:
   - Si estado = 'pendiente' → cambiar a 'atrasada'.

## 8.4 Tab Calendario

Vista calendario mensual con tareas marcadas en su día esperado:
- Cumplida → punto verde con check
- Pendiente hoy → punto ámbar
- Atrasada → punto rojo con !

Click en día con tareas: modal con lista del día.

## 8.5 Tab Lista pendientes

Lista ordenada por urgencia (atrasadas primero, luego pendientes hoy, luego pendientes futuras):
| Tarea | Fecha esperada | Estado | Días retraso | Acción |
|---|---|---|---|---|

Acciones:
- "Marcar como subida" → redirige a Importador con tarea ID en query param.
- "Posponer" → cambiar fecha_esperada +1 día.
- "Eliminar" (solo admin).

## 8.6 Tab Configuración tareas

CRUD sobre `tareas_periodicas`:
- Crear nueva tarea periódica (nombre, descripción, frecuencia, día, módulo destino).
- Editar existente.
- Activar/desactivar.

## 8.7 Indicador sidebar

`<SidebarBadge count={N} />` donde N = `SELECT COUNT(*) FROM tareas_pendientes WHERE estado IN ('pendiente','atrasada')`.

Refresh en tiempo real al subir archivo (decrementa si la tarea relacionada se marca cumplida).

## 8.8 Alerta visual al entrar al ERP

Al cargar Panel Global (página principal), si hay tareas atrasadas:
1. Banner top con estilo:
   ```css
   {
     background: '#fff3cd',
     border: '1px solid #ffc107',
     borderRadius: 8,
     padding: '12px 16px',
     marginBottom: 16,
     display: 'flex',
     alignItems: 'center',
     gap: 12,
   }
   ```
2. Texto: "⚠️ Tienes pendiente subir: {lista_tareas_atrasadas_separadas_por_coma}. [Botón rojo: Ir al Importador]"
3. Botón "X" arriba derecha del banner para cerrar.
4. Al cerrar: guardar en `localStorage` key `banner_tareas_dismissed_${YYYY-MM-DD}`.
5. Re-mostrar al día siguiente o si llega tarea atrasada nueva.

---

# FASE 9 · CONCILIACIÓN · COMPLETAR

> Conciliación es REFERENCIA DE ORO visual. NO romper su estilo. Solo añadir lo pendiente.

## 9.1 Header

1. Título solo "CONCILIACIÓN" (sin "Resumen ·"). Oswald 22px 600 #B01D23.
2. Subtítulo dinámico según selector: "1 abr — 27 abr 2026" o equivalente.
3. SelectorFechaUniversal a la derecha (FASE 3.1).
4. NO selector titular bancario (auto-detección NIF). Eliminar dropdown actual.

## 9.2 Auto-detección NIF en movimientos

Al insertar/actualizar movimiento bancario:
- Buscar en concepto y ordenante: regex `[A-Z]?\d{8}[A-Z]?` (NIF español)
- Si match con `21669051S` → `titular_id = RUBEN_ID`
- Si match con `53484832B` → `titular_id = EMILIO_ID`
- Si no match → `titular_id = NULL`, marca como pendiente revisión manual.

## 9.3 Categorías unificadas

Reemplazar dropdown de categorías por las 38 del plan contable (FASE 4).

NO usar "Ingresos plataformas" / "Ingresos venta directa" como categorías separadas. Solo "Ingresos" si es ingreso, y subcategoría según canal (ING-UE, ING-GL, etc).

## 9.4 Tabs

Usar TabConciliacion (FASE 3.3):
1. "Resumen" (default)
2. "Movimientos"

## 9.5 Tab Resumen

Cards superiores (3 grandes):
1. **INGRESOS NETOS** — Oswald 2.4rem + comparativa + desglose por canal con barras de color
2. **GASTOS** — Oswald 2.4rem + comparativa + desglose por categoría con barras de color
3. **TESORERÍA HOY** — Oswald 2.4rem + comparativa vs hace 30d + desglose:
   - "CAJA LÍQUIDA" valor
   - "Cobros pendientes" + valor verde
   - "Pagos pendientes" + valor rojo
   - "Proyección 7d" valor
   - "Proyección 30d" valor
   - Barra "Hoy → 30d" verde con valores en extremos

ELIMINAR la card actual "Tesorería vs Caja líquida" (es duplicada). Solo dejar "TESORERÍA HOY" con la info correcta.

Cards inferiores: 5 cards Producto/Equipo/Local/Controlables/Plataformas con presupuesto:
- Sublabel: nombre categoría
- Valor: gasto del periodo
- "/ X€" (presupuesto del periodo)
- Barra cumplimiento (FASE 3.2) con semáforo
- % consumido

ELIMINAR de Conciliación:
- Card "Categorías de gastos" (top + total)
- Columna gris de gastos
- Card "Ratio Ingresos/Gastos" (mover a Running, ya estará allí)
- Card "Balance Neto" duplicado (ya está en Panel)
- Gráficos "Ingresos vs Gastos semanal" e "Ingresos/Gastos/Saldo" (mover a Panel · Cashflow)

## 9.6 Tab Movimientos

### Dropzone único arriba de la tabla

```jsx
<Dropzone
  accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls"
  texto="Arrastra documento (CSV, XLSX, PDF, imagen) o haz click"
/>
```

Detección automática igual que FASE 7 (extracto bancario o factura).

### Filtros rápidos arriba de la tabla

Botones (estilo TabConciliacion compactos):
1. "Pendientes" (ámbar)
2. "Asociadas" (verde)
3. "Faltantes" (rojo)
4. "Duplicadas" (rojo)
5. "Sin titular" (ámbar)

Click toggle filtro.

### Buscador unificado

Input arriba con placeholder "Buscar proveedor / nº factura / importe / concepto"
Búsqueda fulltext en columnas: `proveedor`, `numero_factura`, `concepto`, `importe`.

### Tabla movimientos

Columnas:
1. Fecha
2. Concepto
3. Contraparte (mostrar nombre proveedor si hay factura asociada, si no nombre raw)
4. Importe (color verde si ingreso, rojo si gasto)
5. Categoría (badge con color del grupo)
6. Doc (icono PDF clickeable si hay factura asociada) — RENOMBRAR de "PDF" a "Doc"
7. Acciones

### Botón "+ Añadir gasto"

Botón fixed bottom-right (color #FF4757). Abre modal nuevo gasto.

ESTE BOTÓN AHORA VIVE EN CONCILIACIÓN, no en Running.

---

# FASE 10 · OTROS MÓDULOS (re-trabajo)

## 10.1 Facturación

### Header
- Título "FACTURACIÓN"
- SelectorFechaUniversal a la derecha
- Dropdown derecho "Canales" (no "Todos")
- Dropdown izquierdo "Servicio" (Todos / ALM / CENAS) — mantiene como está

### Cards superiores 4 grandes (eliminar hilera medianas)
Contenido dinámico según vista (Diario/Semanas/Meses/Año):

| Vista | Card 1 | Card 2 | Card 3 | Card 4 |
|---|---|---|---|---|
| Diario | Día (hoy/seleccionado) | Semana | Mes | Año |
| Semanas | Semana (actual/sel) | Mes | 3 meses | Año |
| Meses | Mes (actual/sel) | 3 meses | 6 meses | Año |
| Año | Mes en curso | Trimestre | Semestre | Año |

Conmutador 4 botones: "Diario / Semanas / Meses / Año" estilo TabConciliacion.

Cada card grande:
- Sublabel: período
- Valor grande: facturación del período
- N pedidos del período
- TM del período
- Comparativa vs período equivalente anterior

### Formato fechas
- Día: "Lunes, 4 abril 2026"
- Semana: "Semana 17 — 4 abril"
- Mes: "Abril 2026"
- Año: "2026"

### Tabla diaria

Columnas:
1. Fecha
2. Servicio (ALM / CENA / AMBOS según día)
3. Por cada canal: PED y €
4. Total

Si día tiene AMBOS servicios:
- Dos filas dentro del día
- Primera fila: ALM con datos de almuerzos
- Segunda fila: CENA con datos de cenas

Si solo ALM: una fila ALM, NO mostrar fila CENA vacía.
Si solo CENA: una fila CENA, NO mostrar fila ALM vacía.

### Importar histórico Excel ALM/CENA

Script Node automático (no UI manual):
1. Lee archivo `data/historico-almuerzos-cenas.xlsx` que Rubén dejará en raíz repo.
2. Procesa filas y popula tabla `facturacion_diaria`.
3. Ejecutar UNA vez al inicio de FASE 10.

## 10.2 Objetivos

### Header
- Título "OBJETIVOS"
- A la derecha: chevron izquierdo + "S18 — 27/04/26" como selector + chevron derecho
- Selector despliega calendario semanas pasadas y futuras hasta fin del año actual + año siguiente

### Tabs (TabConciliacion)
1. "Objetivos de venta" (default)
2. "Presupuesto de gastos" (NUEVO)

### Tab Objetivos de venta

Card izquierda: "Objetivo de venta del periodo"
- Día actual: borde 2px solid #1E5BCC (azul Emilio), fondo #ffffff (NO rojo)
- Quitar S18 del subtítulo de la card (redundante con header)

Card derecha: "Objetivo por día" lista 7 días con barras cumplimiento

Tabla histórico cumplimiento:
| Período | Cumplido · Pendiente | % Real | Real | Objetivo | Desviación | % Desviación |

NUEVAS columnas obligatorias:
- `% Real`: real / objetivo × 100
- `% Desviación`: (real - objetivo) / objetivo × 100

### Tab Presupuesto de gastos (NUEVO)

Tabla 12 meses × 5 categorías editable inline:

| Categoría | Ene | Feb | Mar | Abr | May | Jun | Jul | Ago | Sep | Oct | Nov | Dic | Total |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Producto | input | input | input | ... | total auto |
| Equipo | input | ... |
| Local | ... |
| Controlables | ... |
| Plataformas | ... |
| **Total mes** | suma | suma | ... | total año |

Cada celda input:
- Click → input numérico
- Enter o blur → guarda en `presupuestos`
- ESC → cancela

Botón "Copiar año anterior" arriba derecha:
- Click → modal confirmación → copia presupuestos del año anterior al año actual.

## 10.3 Running

### Header
- Título "RUNNING FINANCIERO"
- SelectorFechaUniversal a la derecha
- ELIMINAR toggle "Sin IVA / Con IVA" (siempre sin IVA, así viene de facturas)
- ELIMINAR selector "Todos los socios"
- ELIMINAR botón "+ Añadir gasto" (movido a Conciliación, FASE 9.6)

### Tabs (TabConciliacion)
1. "Resumen" (default)
2. "PyG detallado"
3. "Comparativas"

### Tab Resumen

Cards (en este orden):
1. CASHFLOW REAL IZQUIERDA — mantener intacta
2. CASHFLOW REAL DERECHA — mantener intacta
3. FACTURACIÓN BRUTA + sparkline 12m
4. INGRESOS NETOS + sparkline 12m
5. TOTAL GASTOS + sparkline 12m
6. RESULTADO + sparkline 12m
7. PRIME COST (subtítulo: "COGS + Labor · sector hostelería 55-65%") + sparkline + semáforo banda
8. EBITDA (subtítulo: "Beneficio operativo · sector 10-13%") + sparkline + semáforo banda

Sparklines: rehacer con colores corporativos, mostrar tendencia útil. Altura 30px, sin ejes, solo línea.

Bajo cards: desglose 5 categorías con barras horizontales:
- Producto (COGS): valor + % sobre netos + banda objetivo (verde/ámbar/rojo)
- Equipo (Labor): idem
- Local (Occupancy): idem
- Controlables (OPEX): idem
- Plataformas (Comisiones, descuento): idem

ELIMINAR:
- Bloque "Ingresos por marca" (vacío)
- Bloque "Sueldos del periodo" (duplicado con cashflow)

### Tab PyG detallado

Tabla anual completa:
| Concepto | Ene | Feb | ... | Dic | Total año |

Filas en este orden EXACTO:
1. INGRESOS BRUTOS
2. (-) Comisiones plataformas
3. (-) IVA 21% comisiones
4. = INGRESOS NETOS
5. (-) PRODUCTO (COGS) (subtítulo "Producto · COGS")
6. = MARGEN BRUTO
7. (-) EQUIPO (Labor) (subtítulo "Equipo · Labor")
8. = PRIME COST
9. (-) LOCAL (Occupancy) (subtítulo "Local · Occupancy")
10. (-) CONTROLABLES (OPEX) (subtítulo "Controlables · OPEX")
11. = EBITDA (subtítulo "EBITDA · Beneficio operativo")
12. (-) Provisiones (IVA + IRPF)
13. = RESULTADO LIMPIO

Columna "Total año" al final con suma.

ARREGLAR corte derecho de la tabla actual.

### Tab Comparativas

3 vistas (sub-tabs o dropdown):
1. **vs Presupuesto Objetivos**: barras real vs presupuesto por mes y categoría
2. **vs Mismo mes año anterior**: tabla y gráfico
3. **vs Media últimos 3-6-12 meses**: card por horizonte

## 10.4 Punto Equilibrio (PE)

### Header
- Título "PUNTO DE EQUILIBRIO"
- SelectorFechaUniversal a la derecha
- ELIMINAR toggle "Sin IVA / Con IVA" (cálculo interno)

### Cards grandes superiores (estilo Panel General)

Card 1: ¿CUBRIMOS FIJOS HOY?
- Sí / No grande
- Margen actual
- Comparativa vs ayer

Card 2: ¿QUÉ DÍA CUBRIMOS?
- Texto: "El día X cubriremos los fijos del periodo"
- Si ya cubierto: "Cubierto el día X"
- Pedidos extra necesarios

Card 3: PEDIDOS / DÍA NECESARIOS
- Pedidos necesarios al TM real para cubrir
- Comparativa vs media actual

Card 4: TM REAL
- Valor
- Comparativa vs período anterior

### Tabs (TabConciliacion)
1. "Resumen" (default) — cards arriba + acciones recomendadas
2. "Día semana"
3. "Simulador" (sliders inline integrados)
4. "Escenarios" (ex-Análisis: subir precio 5%, bajar food cost 2%, recuperar directa, añadir marca)
5. "Tesorería futura" (provisiones IVA/IRPF + calendario pagos críticos 90d)

### Acciones recomendadas

Motor decisiones automático según umbrales:
- Si margen actual < 5% durante 4 semanas en plataforma X marca Y → "Pausa marca Y en X"
- Si demanda alta (>20% pedidos) y margen < 15% → "Sube precios marca Y"
- Si margen > 25% en combo → "Refuerza marketing combo Y+X"

Mostrar en Resumen como cards de acción con CTA.

## 10.5 Configuración

### Tabs (TabConciliacion)
1. "Marcas" (default)
2. "Categorías"
3. "Plataformas"
4. "Cuentas"
5. "Usuarios"
6. "Calendario operativo" (FASE 6)

ELIMINAR tabs antiguas:
- "Accesos Uber" (su contenido va a tab Plataformas)
- "Tipos de cocina" (va como propiedad de Marca)
- "Presupuestos mensuales" (va a Objetivos · Presupuesto de gastos, FASE 10.2)
- "Provisiones IVA/IRPF" (va a PE · Tesorería futura, FASE 10.4)

### Tab Marcas

Tabla:
| Marca | Canales activos | Margen objetivo | Estado | Tipo cocina | Acciones |
|---|---|---|---|---|---|

CRUD completo. Multi-select canales. Editable inline.

### Tab Categorías

Vista 5 columnas (una por grupo):
| Producto | Equipo | Local | Controlables | Plataformas |
| ... | ... | ... | ... | ... |

Cada celda: subcategoría con código + nombre.

Botón "+" añadir subcategoría por columna.
Click sobre subcategoría: editar/eliminar.

### Tab Plataformas

Tabla:
| Canal | % Comisión | € Fijo/pedido | Ciclo pago | Reglas auto-cat | Acciones |
|---|---|---|---|---|---|

Editable inline.

Sección "Reglas auto-categorización":
- NIF emisor → categoría automática

### Tab Cuentas

Cards:
- Cuentas bancarias (con saldo actual sincronizado)
- Drive Google (estado: conectado/desconectado, OAuth)
- Espacio para futuras integraciones POS (Sinqro, etc.)

ELIMINAR campos vacíos sin uso.

### Tab Usuarios

Tabla usuarios:
| Email | Nombre | Rol | Permisos custom | Activo | Acciones |
|---|---|---|---|---|---|

Roles predefinidos (radio):
- Admin (acceso total)
- Socio (acceso total excepto datos personales otros empleados)
- Cocina (sus horarios + del equipo, solicita permisos)
- Repartidor (sus horarios, solicita permisos)
- Solo lectura

Permisos custom por usuario por módulo (matrix lectura/edición/sin acceso).

### Reglas oro (validar en QA)

1. Una variable definida UNA vez en Configuración, lectura en todos módulos.
2. Pausar marca en Configuración → desaparece automáticamente de Panel/Facturación/etc.
3. Añadir categoría en Configuración → aparece automáticamente en Conciliación/Running/etc.

Implementación: usar React Query con `invalidateQueries` global tras cualquier cambio en Configuración.

## 10.6 Eliminaciones definitivas

1. Eliminar página `/finanzas/socios` y entrada sidebar.
2. Eliminar página `/analisis` (su contenido vive en PE · tab Escenarios, FASE 10.4).
3. Eliminar página `/finanzas/facturas` (Importar Facturas) y entrada sidebar.
4. Eliminar página `/finanzas/gestoria` y entrada sidebar.
5. Rutas devuelven 404.

---

# FASE 11 · MÓDULO EQUIPO (NUEVO)

## 11.1 Estructura

1. Crear módulo "Equipo":
   - Ruta `/equipo`
   - Icono `Users` (Lucide React)
   - Posición sidebar: bajo Conciliación (sustituye hueco de Socios eliminado).

2. Tabs (TabConciliacion):
   1. "Empleados" (default)
   2. "Nóminas"
   3. "Calendario laboral"
   4. "Horarios"
   5. "Permisos"
   6. "Portal empleado"

## 11.2 Tablas BD

```sql
CREATE TABLE empleados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL,
  apellidos VARCHAR(100) NOT NULL,
  nif VARCHAR(20) UNIQUE,
  email VARCHAR(100) UNIQUE,
  iban VARCHAR(34),
  fecha_nacimiento DATE,
  direccion TEXT,
  telefono VARCHAR(20),
  fecha_alta DATE,
  fecha_baja DATE,
  estado VARCHAR(20) CHECK (estado IN ('activo','baja','vacaciones','despedido')) DEFAULT 'activo',
  contrato_tipo VARCHAR(50),
  salario_bruto_mensual DECIMAL(10,2),
  rol VARCHAR(50),  -- admin, socio, cocina, repartidor
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE nominas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id UUID REFERENCES empleados(id),
  mes INTEGER NOT NULL,
  año INTEGER NOT NULL,
  importe_bruto DECIMAL(10,2),
  importe_neto DECIMAL(10,2),
  pdf_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(empleado_id, mes, año)
);

CREATE TABLE eventos_laborales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id UUID REFERENCES empleados(id),
  fecha DATE NOT NULL,
  tipo VARCHAR(20) CHECK (tipo IN ('vacaciones','baja_medica','asuntos_propios','festivo','otro')),
  nota TEXT,
  aprobado_por UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE horarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id UUID REFERENCES empleados(id),
  fecha DATE NOT NULL,
  hora_inicio TIME,
  hora_fin TIME,
  turno_tipo VARCHAR(20) CHECK (turno_tipo IN ('comida','cena','completo')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE solicitudes_permisos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id UUID REFERENCES empleados(id),
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  tipo VARCHAR(20),
  estado VARCHAR(20) CHECK (estado IN ('pendiente','aprobado','rechazado')) DEFAULT 'pendiente',
  motivo TEXT,
  nota_admin TEXT,
  resuelto_por UUID,
  fecha_resolucion TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 11.3 Tab Empleados

Lista cards con avatar, nombre, rol, estado.
Click → modal ficha completa con todos los campos de tabla `empleados` + documentos vinculados Drive.

## 11.4 Tab Nóminas

Lista por empleado. Click → ver histórico nóminas.
Botón "Subir nómina" abre Importador con tipo pre-seleccionado.

## 11.5 Tab Calendario laboral

Vista calendario mensual con eventos colorados por empleado.
Marcar festivos nacionales/locales (auto-cargar Madrid).

## 11.6 Tab Horarios

Planificador semanal drag&drop.
Validaciones automáticas:
- Si día en `calendario_operativo` = 'cerrado' → bloquear creación turnos
- Si 'solo_comida' → solo turno 'comida' permitido
- Si 'solo_cena' → solo turno 'cena' permitido
- Máx 40h/semana por empleado (configurable)
- Mínimo 12h descanso entre turnos

Si todos los empleados de cocina están de vacaciones día X → cron auto crea entrada `calendario_operativo` con tipo 'cerrado'.

## 11.7 Tab Permisos

Lista solicitudes:
- Pendientes (admin/socio aprueba/rechaza)
- Aprobadas
- Rechazadas

Empleado solicita: form con fecha_inicio, fecha_fin, tipo, motivo.
Si aprobado → INSERT auto en `eventos_laborales`.

## 11.8 Tab Portal empleado

Login propio empleado (vinculado a Configuración Usuarios FASE 10.5).
Vista limitada por permisos:
- Su contrato
- Sus nóminas (descarga)
- Su horario semana actual
- Sus permisos
- Botón "Solicitar permiso"

NO ve datos de otros empleados ni datos financieros del negocio.

---

# FASE 12 · ESCANDALLO V2 PARALELO

## 12.1 Estructura

1. Crear ruta `/escandallo-v2` paralela a `/escandallo` (NO sustituir).
2. v1 sigue intacto, funcional.
3. v2 usa la misma BD pero UI mejorada:
   - Búsqueda más rápida
   - Vista grid + lista alternable
   - Drag & drop ingredientes en recetas
   - Formularios simplificados
   - Validaciones en tiempo real

## 12.2 Cuando v2 validado por Rubén

Cambiar ruta de `/escandallo` a `/escandallo-v2-promoted` y `/escandallo-v2` pasa a `/escandallo`.

PROMOTION SOLO TRAS APROBACIÓN EXPLÍCITA RUBÉN. NO automático.

---

# FASE 13 · CIERRE

## 13.1 Pipeline obligatorio por fase

1. pm-spec valida spec sin huecos
2. architect-review aprueba arquitectura
3. implementer ejecuta autónomo (Sonnet)
4. qa-reviewer valida CA específicos de la fase
5. erp-reviewer valida aislamiento Binagre vs David

Si qa-reviewer detecta fallos: implementer-fix antes de avanzar.

## 13.2 Commits

Cada fase: `git add . && git commit -m "feat(maestro): FASE X completada" && git push origin master`

Cierre final:
```
git add . && git commit -m "feat(maestro): completo - 13 fases - 100% spec literal" && git push origin master
```

NO Vercel.

## 13.3 Informe final obligatorio

`.claude/tracking/informe-final-maestro.md`:
1. Build OK/KO con detalles
2. Por cada FASE: validaciones pasadas, falladas, archivos creados/modificados/eliminados
3. Decisiones autónomas tomadas en cada fase
4. Mobile validation: capturas y resultados por módulo
5. Migraciones BD ejecutadas con timestamp
6. Tareas marca×canal procesadas con resultado

## 13.4 Validación final por Rubén

Antes de cerrar la sesión Claude Code:
1. Lanzar `npm run dev` y dejar localhost arriba.
2. Avisar a Rubén "Sesión completa. Localhost listo para validación. NO Vercel."
3. Esperar feedback.
4. Si Rubén OK → cerrar sesión.
5. Si Rubén marca fix → entrar en ciclo de fixes hasta su OK.

---

# DECISIONES AUTÓNOMAS PERMITIDAS

El implementer puede tomar autónomamente:
1. Mapping exacto categorías antiguas → nuevas siguiendo reglas FASE 4.2 (excepto ambigüedades, ahí pregunta)
2. Estilos de componentes nuevos siguiendo guía Notion + tokens.ts
3. Estructura interna de tabs respetando TabConciliacion compartido
4. Iconos Lucide React siguiendo convención existente
5. Schema BD nuevo (empleados, nóminas, conteos, ventas_plataforma_marca_mensual, tareas_periodicas, etc.)
6. Queries Supabase para tablas existentes
7. Defaults sensatos para campos sin valor
8. Componentes compartidos en `/src/components/ui/`

El implementer DEBE preguntar SOLO si:
1. Va a borrar datos producción sin backup
2. Detecta dependencia con módulo David
3. Encuentra ambigüedad mapping con riesgo financiero alto (categoría a categoría con 2 destinos plausibles equivalentes)
4. Una migración va a fallar y no hay rollback claro

**Para todo lo demás: decide autónomamente, documenta en `summary.md`, sigue.**

---

# ORDEN DE EJECUCIÓN

EJECUTAR EN ORDEN, SIN PARAR ENTRE FASES:

1. FASE 1 (mobile-friendly setup) → continuar
2. FASE 2 (tokens y estilo) → continuar
3. FASE 3 (componentes compartidos) → continuar
4. FASE 4 (plan contable + migración BD) → backup obligatorio antes → continuar
5. FASE 5 (Panel Global con inventario obligatorio previo) → continuar
6. FASE 6 (Calendario operativo) → continuar
7. FASE 7 (Importador unificado) → continuar
8. FASE 8 (Tareas pendientes) → continuar
9. FASE 9 (Conciliación completar) → continuar
10. FASE 10 (Facturación, Objetivos, Running, PE, Configuración) → continuar
11. FASE 11 (Equipo) → continuar
12. FASE 12 (Escandallo v2 paralelo) → continuar
13. FASE 13 (Cierre)

NO PARAR ENTRE FASES. NO PREGUNTAR. AVANZAR.

Si una fase falla irrecuperablemente: documentar bloqueo, hacer commit con lo conseguido, terminar y avisar.
