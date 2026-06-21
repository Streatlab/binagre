import { useState } from 'react'
import { COLORS, FONT, CARDS, lbl, TABS_PILL } from '@/components/panel/resumen/tokens'

/* ═════════════ PLAYBOOK THINK PALADAR ═════════════
   Conocimiento extraído de la consultoría con ThinkPaladar (Inés Gallarde / Eduard Baviera).
   Objetivo: replicar internamente su metodología de gestión de delivery cuando acabe el contrato.
   Documento de solo lectura, organizado por bloques navegables.
   Estilo canónico Binagre: cards blancas, tabs pill, tokens SL.
*/

const ACCENT = COLORS.redSL

type Bloque = { id: string; label: string }
const BLOQUES: Bloque[] = [
  { id: 'metodo', label: 'Metodología' },
  { id: 'reglas', label: 'Reglas clave' },
  { id: 'promos', label: 'Plan de Promos' },
  { id: 'plataformas', label: 'Plataformas' },
  { id: 'cronologia', label: 'Cronología' },
  { id: 'solos', label: 'Hacerlo solos' },
]

/* ── helpers de presentación ── */
function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ ...CARDS.std, marginBottom: 14 }}>
      <div style={{ fontFamily: FONT.heading, fontSize: 15, fontWeight: 600, color: ACCENT, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>{titulo}</div>
      {children}
    </div>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 7, fontFamily: FONT.body, fontSize: 13.5, color: COLORS.sec, lineHeight: 1.5 }}>
      <span style={{ color: ACCENT, flexShrink: 0, fontWeight: 700 }}>·</span>
      <span>{children}</span>
    </div>
  )
}

function Dato({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: COLORS.pri, fontWeight: 600 }}>{children}</strong>
}

const th: React.CSSProperties = { fontFamily: FONT.heading, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: COLORS.mut, fontWeight: 500, padding: '8px 10px', textAlign: 'left', borderBottom: `1px solid ${COLORS.brd}` }
const td: React.CSSProperties = { fontFamily: FONT.body, fontSize: 13, color: COLORS.sec, padding: '8px 10px', borderBottom: `1px solid ${COLORS.group}`, verticalAlign: 'top' }

export default function PlaybookThinkPaladar() {
  const [bloque, setBloque] = useState<string>('metodo')

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', padding: '24px 28px', fontFamily: FONT.body, color: COLORS.pri }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: ACCENT, letterSpacing: 3, textTransform: 'uppercase' }}>PLAYBOOK THINK PALADAR</div>
        <div style={{ fontFamily: FONT.body, fontSize: 13, color: COLORS.mut, marginTop: 2 }}>Metodología de la consultoría capturada para operar el delivery por nuestra cuenta · v1 · doc vivo</div>
      </div>

      <div style={TABS_PILL.container}>
        {BLOQUES.map(b => (
          <button key={b.id} onClick={() => setBloque(b.id)} style={bloque === b.id ? TABS_PILL.active : TABS_PILL.inactive}>{b.label}</button>
        ))}
      </div>

      <div style={{ marginTop: 16, maxWidth: 920 }}>
        {bloque === 'metodo' && <BloqueMetodo />}
        {bloque === 'reglas' && <BloqueReglas />}
        {bloque === 'promos' && <BloquePromos />}
        {bloque === 'plataformas' && <BloquePlataformas />}
        {bloque === 'cronologia' && <BloqueCronologia />}
        {bloque === 'solos' && <BloqueSolos />}
      </div>
    </div>
  )
}

/* ═════════════ METODOLOGÍA ═════════════ */
function BloqueMetodo() {
  return (
    <>
      <Seccion titulo="Quién es Think Paladar">
        <Bullet>Agencia especializada en food delivery, sede en Barcelona.</Bullet>
        <Bullet>Consultora asignada: <Dato>Inés Gallarde</Dato> (Sr. Revenue Manager). Co-Founder: <Dato>Eduard Baviera</Dato>.</Bullet>
        <Bullet>Contrato: <Dato>450€/mes × 4 meses</Dato> (abr–jul 2026), pago por SEPA. Producto: "Delivery+".</Bullet>
        <Bullet>Servicio extra <Dato>TP Claims</Dato>: bot que reclama incidencias a plataformas, recupera ~70% del dinero perdido (comisión por éxito).</Bullet>
        <Bullet>KPI del contrato: <Dato>15.000€</Dato> de facturación Binagre para el mes 2.</Bullet>
      </Seccion>

      <Seccion titulo="Fase 0 — Auditoría (pre-contrato)">
        <Bullet>Reunión inicial para entender el negocio: marcas, facturación, portfolio, operativa.</Bullet>
        <Bullet>Piden histórico de ventas en Excel/CSV.</Bullet>
        <Bullet>Análisis interno: peso por marca, peso por plataforma, ticket medio, tendencia mensual.</Bullet>
        <Bullet>Identifican la marca con mayor potencial de crecimiento.</Bullet>
        <Bullet>Propuesta comercial con fee + extras (fotos ~500€, packaging ~1.000€, ads agresivos 3 meses).</Bullet>
      </Seccion>

      <Seccion titulo="Fase 1 — Kick-off (Mes 1)">
        <Bullet>Presentación con análisis de zona, competencia y oportunidad.</Bullet>
        <Bullet>Decisión de <Dato>1 sola marca</Dato> a priorizar (no varias).</Bullet>
        <Bullet>Estudio de tendencias en delivery + estudio de competidores de la zona.</Bullet>
        <Bullet>Primera propuesta de menú → iteración con el cliente → cerrar menú definitivo.</Bullet>
        <Bullet>Sesión de fotos profesional. Sub-objetivos de negocio. Plan de marketing inicial. Objetivos financieros a 4 meses.</Bullet>
      </Seccion>

      <Seccion titulo="Fase 2 a 4 — Lanzamiento, Optimización y Escala">
        <Bullet><Dato>Mes 2 (Lanzamiento):</Dato> plan de marketing activo, stickers/flyers/bolsas, activación canal propio (recomiendan Cheerfy), repaso de 2 marcas más.</Bullet>
        <Bullet><Dato>Mes 3 (Optimización):</Dato> ingeniería de menú con software propio sobre ventas reales, foco en operaciones, plan iterado.</Bullet>
        <Bullet><Dato>Mes 4 (Escala):</Dato> balance vs KPIs, nuevos objetivos, decisión de continuidad.</Bullet>
      </Seccion>
    </>
  )
}

/* ═════════════ REGLAS CLAVE ═════════════ */
function BloqueReglas() {
  return (
    <>
      <Seccion titulo="Marca y posicionamiento">
        <Bullet><Dato>1 marca fuerte &gt; muchas débiles.</Dato> El cliente de delivery asocia marca = producto concreto. Si no sabe qué esperar, no repite.</Bullet>
        <Bullet>Referencia: <Dato>Honest Greens</Dato>. Oferta consistente: sabes qué comerás, cuánto pagarás y cuánto tardará.</Bullet>
        <Bullet>"No gana quien tiene más platos, sino quien es <Dato>top of mind</Dato> en un producto concreto."</Bullet>
        <Bullet>Frase brújula: "Hacemos los platos que llevan horas, para la gente que no tiene horas."</Bullet>
      </Seccion>

      <Seccion titulo="Carta y menú">
        <Bullet><Dato>Carta corta, ejecución excelente.</Dato> 6 entrantes + 6 principales infalibles &gt; 15 + 15 mediocres.</Bullet>
        <Bullet>Estructura <Dato>70/30</Dato>: 70% carta fija (platos estrella) + 30% rotación estacional.</Bullet>
        <Bullet>Combos primero en la app. Menú MVP de <Dato>12 referencias</Dato> para lanzar; ampliar solo por demanda validada.</Bullet>
        <Bullet><Dato>Platos ancla</Dato> = contrato con el cliente. Si fallan, el daño en ratings es inmediato.</Bullet>
        <Bullet>Nombre del plato = lo atractivo (corto). Descripción = lo más completa posible. Inés prefiere <Dato>no usar IA</Dato> para las descripciones.</Bullet>
      </Seccion>

      <Seccion titulo="Pricing">
        <Bullet>Zona óptima: entre el kebab (1–8€) y el gourmet (20–30€). Binagre = <Dato>9–14€ plato / 12–22€ combo</Dato>.</Bullet>
        <Bullet><Dato>NO hinchar precios</Dato> para luego descontar. Precio base real desde el inicio, contando con que habrá promos.</Bullet>
        <Bullet><Dato>NO precios dinámicos</Dato> por fin de semana (TP no lo recomienda).</Bullet>
        <Bullet>Método Zara: definir PVP objetivo → adaptar ingredientes y procesos al escandallo.</Bullet>
      </Seccion>

      <Seccion titulo="Ratings y reseñas">
        <Bullet><Dato>Mejorar base orgánica ANTES de invertir en ads.</Dato> Con rating bajo, cada euro convierte menos.</Bullet>
        <Bullet>El problema suele ser <Dato>falta de reseñas</Dato>, no exceso de negativas. Pocas reseñas = alto impacto de cada negativa.</Bullet>
        <Bullet>Flyers en pedidos + packaging personalizado para incentivar reseñas positivas.</Bullet>
        <Bullet>Responder reseñas en <Dato>&lt;2 horas</Dato>. Mapa de calor de incidencias por cliente nuevo/recurrente, producto y franja.</Bullet>
      </Seccion>

      <Seccion titulo="Packaging">
        <Bullet>Packaging = <Dato>diferenciación física</Dato>. Pasar de kraft neutro a packaging con marca.</Bullet>
        <Bullet>Específico por producto estrella (ej. cocido en 3 envases + instrucciones de calentado).</Bullet>
        <Bullet>Croquetas: recipiente ventilado, nunca hermético. Postres: tarros individuales herméticos.</Bullet>
        <Bullet>Contactos: PuntoQpack y Envapro.</Bullet>
      </Seccion>
    </>
  )
}

/* ═════════════ PLAN DE PROMOS ═════════════ */
function BloquePromos() {
  return (
    <>
      <Seccion titulo="Lógica general del plan (mayo–julio 2026)">
        <Bullet>Alternar productos promocionados cada pocos días (no siempre los mismos) para no quemar ningún plato.</Bullet>
        <Bullet>Alternar agresividad: 20% → 2x1 → 30% → Flash Deals.</Bullet>
        <Bullet>La inversión publicitaria está siempre activa, no solo en semanas de promo fuerte. Ads + Promo se combinan.</Bullet>
        <Bullet>Diferenciar target por semana: nuevos primero (captar), luego Prime (ticket alto), luego todos (volumen).</Bullet>
      </Seccion>

      <Seccion titulo="Glovo">
        <Bullet>Publicidad: <Dato>200€/mes</Dato>, horario completo, todos los usuarios.</Bullet>
        <Bullet>Promo general: 20% (sem 1–3) → 2x1 (sem 4) → 30% (sem 5+).</Bullet>
        <Bullet><Dato>Flash Deals (clave):</Dato> dirigido solo a nuevos usuarios. El cliente percibe 30% pero el coste real es ~50% (Glovo añade 20% de comisión). Se limita el nº diario de nuevos. Buena recurrencia futura.</Bullet>
        <Bullet>Limitación Glovo: el descuento normal va a todos por defecto (menos control que Uber).</Bullet>
      </Seccion>

      <Seccion titulo="Uber Eats">
        <Bullet>Publicidad: se reduce de 9€/día a <Dato>5€/día</Dato>.</Bullet>
        <Bullet>Promo secuencial: 2x1 nuevos → 2x1 Prime (Uber One) → 30% nuevos → vuelve a 2x1.</Bullet>
        <Bullet>Ventaja: se puede <Dato>segmentar por tipo de usuario</Dato> independientemente de la promo activa.</Bullet>
      </Seccion>

      <Seccion titulo="Just Eat">
        <Bullet>Asset con <Dato>25% sobre ticket final</Dato>, todos los usuarios, horario completo.</Bullet>
        <Bullet>Más simple, sin segmentación avanzada por ahora.</Bullet>
      </Seccion>

      <Seccion titulo="Segmentos de público (definición TP)">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Segmento</th><th style={th}>Definición</th></tr></thead>
          <tbody>
            <tr><td style={td}><Dato>Nuevos</Dato></td><td style={td}>Nunca ha pedido en tu negocio</td></tr>
            <tr><td style={td}><Dato>Recurrentes</Dato></td><td style={td}>Ha pedido en los últimos 6 meses</td></tr>
            <tr><td style={td}><Dato>Inactivos</Dato></td><td style={td}>No pide desde hace más de 45 días</td></tr>
            <tr><td style={td}><Dato>Prime</Dato></td><td style={td}>Suscrito a envíos premium del agregador (Uber One)</td></tr>
          </tbody>
        </table>
      </Seccion>
    </>
  )
}

/* ═════════════ PLATAFORMAS ═════════════ */
function BloquePlataformas() {
  return (
    <>
      <Seccion titulo="Categorías y filtros de búsqueda">
        <Bullet>Glovo: se solicitan a Glovo directamente (mediterránea, española, comida local).</Bullet>
        <Bullet>Uber y Just Eat: se piden por correo a la plataforma.</Bullet>
        <Bullet>El integrador <Dato>NO</Dato> gestiona categorías (confirmado con Sinqro y Rushour).</Bullet>
        <Bullet>Menos filtros = mejores ratings (dato UE).</Bullet>
      </Seccion>

      <Seccion titulo="Estructura de carta dentro de la app">
        <Bullet>1 · Lo más vendido (top 3 por <Dato>MARGEN</Dato>, foto excelente, actualizar cada 15 días).</Bullet>
        <Bullet>2 · Combos (precio cerrado, "bebida GRATIS" visible).</Bullet>
        <Bullet>3 · Entrantes.</Bullet>
        <Bullet>4 · Platos principales.</Bullet>
        <Bullet>5 · Para terminar (postres).</Bullet>
      </Seccion>

      <Seccion titulo="Portadas y logos">
        <Bullet>Inés solicita los cambios a cada plataforma directamente cuando tiene los archivos.</Bullet>
        <Bullet>Portada ideal: <Dato>fondo claro</Dato>, logo en el centro, platos grandes arriba y abajo. Evitar fondo rojo (distrae).</Bullet>
      </Seccion>

      <Seccion titulo="Ley Ómnibus">
        <Bullet>En Glovo hay que esperar <Dato>30 días</Dato> para repetir descuento en el mismo producto.</Bullet>
        <Bullet>En Uber y Just Eat hay más libertad.</Bullet>
        <Bullet>El <Dato>2x1</Dato> no cuenta como descuento de % → evita las restricciones de Ómnibus.</Bullet>
      </Seccion>

      <Seccion titulo="Contactos account managers">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Plataforma</th><th style={th}>Contacto</th></tr></thead>
          <tbody>
            <tr><td style={td}>Glovo</td><td style={td}>pilar.gonzalez@glovoapp.com</td></tr>
            <tr><td style={td}>Just Eat</td><td style={td}>claudia.abad@justeattakeaway.com · Tamara (config)</td></tr>
            <tr><td style={td}>Uber Eats</td><td style={td}>alvar.noguera@uber.com</td></tr>
          </tbody>
        </table>
      </Seccion>
    </>
  )
}

/* ═════════════ CRONOLOGÍA ═════════════ */
function BloqueCronologia() {
  const filas: [string, string][] = [
    ['4 mar', 'Primera reunión. Rubén envía facturación y portfolio'],
    ['12–17 mar', 'Presupuesto 600€/mes. Negociación: es para 1 marca'],
    ['23–24 mar', 'Cierre 450€/mes × 4 meses. Datos para contrato + SEPA'],
    ['1 abr', 'KICK-OFF. Decisión: arrancar con marca española. Grupo WhatsApp'],
    ['6 abr', 'Manifiesto Binagre. Feedback: foco guisos, carta 70/30, max 6+6'],
    ['8–10 abr', 'Marcas españolas actuales + contactos plataformas + PuntoQpack'],
    ['14–17 abr', 'Iteración de menú entre SL e Inés'],
    ['21–22 abr', 'Pricing: NO precios dinámicos, NO hinchar precios'],
    ['28 abr', 'Aplazado lanzamiento del 4 al 11 mayo (cocinero nuevo)'],
    ['29 abr–7 may', 'Portadas/logos de Marcos validados y enviados a plataformas'],
    ['12 may', 'Arranque fijado 16 may. Promos arrancan con 2x1'],
    ['13 may', 'Retraso: fotógrafa lesionada + cocinero deja el puesto'],
    ['21 may', 'Inés envía Plan de Marketing completo (promos may–jul)'],
    ['22 may', 'Ajuste de portada: fondo claro en vez de rojo'],
  ]
  return (
    <Seccion titulo="Línea temporal de la colaboración">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={{ ...th, width: 120 }}>Fecha</th><th style={th}>Hito</th></tr></thead>
        <tbody>
          {filas.map(([f, h], i) => (
            <tr key={i}>
              <td style={{ ...td, fontFamily: FONT.heading, color: ACCENT, fontWeight: 600, whiteSpace: 'nowrap' }}>{f}</td>
              <td style={td}>{h}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Seccion>
  )
}

/* ═════════════ HACERLO SOLOS ═════════════ */
function BloqueSolos() {
  return (
    <>
      <Seccion titulo="Lo que TP no hace (y necesitamos cubrir)">
        <Bullet>Diseño de marca / imagen (lo hace Marcos por nuestra cuenta).</Bullet>
        <Bullet>Precios dinámicos finde · gestión de integradores · community manager.</Bullet>
        <Bullet>Escandallo y pricing desde el coste (ellos trabajan con gamas y márgenes estimados).</Bullet>
      </Seccion>

      <Seccion titulo="Las 12 claves para operar solos">
        <Bullet><Dato>1.</Dato> Auditoría propia cada trimestre: ventas por marca, peso, ticket medio, tendencia.</Bullet>
        <Bullet><Dato>2.</Dato> Estudio de competencia en apps: ratings, nº reseñas, fotos, estructura de carta del top 10 de la zona.</Bullet>
        <Bullet><Dato>3.</Dato> Carta MVP → validar → ampliar. Nunca lanzar con carta completa.</Bullet>
        <Bullet><Dato>4.</Dato> Plan de promos semanal alternando 2x1, %, combo. Respetar Ómnibus en Glovo.</Bullet>
        <Bullet><Dato>5.</Dato> Fotos profesionales innegociables.</Bullet>
        <Bullet><Dato>6.</Dato> Packaging diferenciado por producto estrella.</Bullet>
        <Bullet><Dato>7.</Dato> Responder reseñas en &lt;2h.</Bullet>
        <Bullet><Dato>8.</Dato> En la app: combos primero, luego top por margen, luego categorías.</Bullet>
        <Bullet><Dato>9.</Dato> Actualizar "Lo más vendido" cada 15 días con el top 3 por margen.</Bullet>
        <Bullet><Dato>10.</Dato> Reclamaciones a plataformas (estilo TP Claims): recuperar ~70% de incidencias.</Bullet>
        <Bullet><Dato>11.</Dato> Cheerfy o similar para canal propio cuando haya tracción.</Bullet>
        <Bullet><Dato>12.</Dato> Ingeniería de menú con datos reales cada 2 semanas (estrella/caballo/puzzle/perro).</Bullet>
      </Seccion>

      <Seccion titulo="Lo más valioso a capturar de estos 4 meses">
        <Bullet>Qué promo funcionó en qué plataforma y con qué segmento — con números reales.</Bullet>
        <Bullet>Qué platos en promo generaron recurrencia (el Flash Deal de Glovo es el experimento clave).</Bullet>
        <Bullet>Cómo hablan con los account managers: qué piden, cómo, qué consiguen.</Bullet>
        <Bullet>Su cadencia de decisiones: cuándo cambian promos y con qué criterio rotan platos.</Bullet>
      </Seccion>
    </>
  )
}
