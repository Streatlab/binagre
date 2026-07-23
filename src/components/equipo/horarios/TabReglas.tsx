import { GRANATE } from '@/styles/neobrutal'
import { useTheme, FONT } from '@/styles/tokens'

const SECCIONES = [
  { num: '1', titulo: 'Equipo', items: [
    '4 personas: Ray (cocinero), Andrés (cocinero), Rubén (cocinero/responsable), Emilio (apoyo). No hay un quinto.',
  ]},
  { num: '2', titulo: 'Apertura y cobertura', items: [
    'Cocina al cliente: 12:00–23:00 todos los días, sin parón.',
    'Personal hasta 23:15 (15 min limpieza).',
    'Cobertura continua sin huecos.',
    'Alguien debe abrir a las 12:00 cada día.',
  ]},
  { num: '3', titulo: 'Emilio', items: [
    'Nunca solo, nunca abre.',
    'Máx 30h/sem (objetivo 20–25h).',
    'Sin descuento de descanso.',
  ]},
  { num: '4', titulo: 'Cocineros · horas', items: [
    'Ray y Andrés: tope estricto 42,5h/sem (40h + 2,5h recuperación). Nunca superar.',
    'Rubén: objetivo 42,5h, flexible.',
    'Ray y Andrés: máx 9h reales/día (excepción puntual ~10–11h 1 día/sem).',
    'Descanso 30 min/día Ray y Andrés, ya descontado en horas reales.',
  ]},
  { num: '5', titulo: 'Rubén', items: [
    'L–J no entra antes de las 16:00 (excepción puntual: abrir 12:00 algún L o M).',
    'Cierra lo mínimo posible (ideal 1 día/sem).',
    'Prefiere jornada partida.',
  ]},
  { num: '6', titulo: 'Cierres', items: [
    'Ray y Andrés nunca cierran solos.',
    'Ray + Andrés pueden cerrar juntos.',
    'Rubén y Emilio pueden cerrar juntos.',
  ]},
  { num: '7', titulo: 'Descansos jornada partida', items: [
    'Mínimo 3h entre tramos.',
    'Ray mínimo 3,5h (vive lejos).',
    'Mínimo 12h entre jornadas.',
  ]},
  { num: '8', titulo: 'Patrones de libranza', items: [
    'Solo 4 patrones, 2 días seguidos cada uno:',
    '1. L+M',
    '2. X+J',
    '3. V+S = "finde medio"',
    '4. S+D = arranque finde largo',
    'Finde largo (4 días) = patrón S+D una semana + patrón L+M la siguiente, misma persona. Cruza dos semanas. NO es un patrón nuevo.',
  ]},
  { num: '9', titulo: 'Reparto de libranzas', items: [
    'Ray y Andrés NO libran el mismo día (excepción: Semana 3, ambos L+M juntos).',
    'Rubén y Emilio libran juntos siempre.',
    'Finde largo rota Ray → Rubén+Emilio → Andrés.',
    'Mínimo 6 semanas entre findes largos por persona.',
    'Findes largos nunca se solapan.',
    'Nadie libra más de 1 finde al mes.',
    'Quien tiene finde largo NO libra V+S ni en la semana anterior ni posterior.',
    'Nadie repite finde (largo o medio) en semanas consecutivas.',
    'En la semana que arranca el finde largo (S+D) no hay V+S adicional.',
    'Esperas iniciales (desde S22): Andrés viene de S21 → próximo largo ≥S29. Ray ≥S25. Rubén+Emilio ≥S27.',
  ]},
  { num: '10', titulo: 'Intercambio de nombres', items: [
    'Ray ↔ Andrés intercambiables en sus horarios para encajar el puzzle (mismos turnos, distinto nombre).',
    'Rubén y Emilio intocables, no se intercambian.',
  ]},
  { num: '11', titulo: 'Horarios base', items: [
    'Los 5 horarios base (S1 a S5) son sagrados y bloqueados. No se modifican, solo se colocan como piezas del puzzle según el patrón de libranza que toca.',
  ]},
  { num: '12', titulo: 'Demanda (pedidos/hora L–J)', items: [
    '12h=1, 13h=3, 14h=4, 15h=2, 16h=1, 17h=1, 18h=2, 19h=2, 20h=3, 21h=3, 22h=1.',
    'Viernes = L–J +1. Sábado = +2. Domingo = +3.',
    'Pico comida 13–15h, pico cena 20–21:30h. Valle 16–20h baja demanda.',
  ]},
  { num: '13', titulo: 'Excepciones aceptadas', items: [
    'Valle 16:00–20:00 con 1 persona en V y S: aceptado, no es bloqueo.',
    'Semana 3: Ray + Andrés libran L+M juntos (única excepción a la regla de no coincidir).',
  ]},
  { num: '14', titulo: 'Formato cuadrante', items: [
    'Filas: Ray, Andrés, Emilio, Rubén.',
    'Columnas: LUN–DOM + TOTAL.',
    'Cada celda: franja(s) en negrita + horas reales debajo.',
    'Fila final "Cierra".',
  ]},
]

export default function TabReglas() {
  const { T } = useTheme()
  return (
    <div>
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 18, fontWeight: 600, color: GRANATE, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 4 }}>
        Reglas · Cuadrante cocina Streat Lab
      </div>
      <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, marginBottom: 20 }}>
        Bebidas del generador. Las reglas se cargan en código (REGLAS.md). Cambios pídelos en chat.
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        {SECCIONES.map(s => (
          <div key={s.num} style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 0, padding: '14px 18px' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 600, color: GRANATE, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>
              {s.num}. {s.titulo}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {s.items.map((it, i) => (
                <li key={i} style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, lineHeight: 1.55, marginBottom: 3 }}>
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
