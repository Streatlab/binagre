/* ==============================================================================
 * FICHA TÉCNICA — HOJA (pantalla = papel)
 * Modelo VALIDADO por Rubén (24-jul-2026): el documento imprimible de EPs y
 * recetas. Lo que se ve en el ERP es EXACTAMENTE lo que sale por impresora.
 *
 * Anatomía (no se cambia sin orden explícita de Rubén):
 *   Cabecera  → logo · pastilla de área + tipo de documento · nombre grande ·
 *               gama debajo · caja derecha con Código / Revisión / Fecha.
 *   Meta      → 4 celdas: tiempo de preparación, rendimiento, coste tanda,
 *               € / ración (esta última destacada en el acento del área).
 *   Cuerpo    → Ingredientes (tabla con cabecera y filas alternas),
 *               Preparación (pasos enmarcados y numerados en acento).
 *   Pie       → Conservación (4 métodos) y Alérgenos (14 casillas).
 *
 * Radio único 6px · Oswald (títulos/etiquetas) + Barlow Semi Condensed (datos).
 * ============================================================================== */
import React from 'react'

export type AreaFicha = 'cocina' | 'finanzas' | 'equipo'

const ACENTO: Record<AreaFicha, string> = { cocina: '#A8524E', finanzas: '#4B5A72', equipo: '#5C8A6E' }
const AREA_LABEL: Record<AreaFicha, string> = { cocina: 'Cocina', finanzas: 'Finanzas', equipo: 'Equipo' }

export interface LineaIng { ingrediente: string; cantidad: string; unidad: string; equivalencia?: string }
export interface LineaConserva { metodo: string; tiempo: string }

export const ALERGENOS_FICHA = [
  'Gluten', 'Lácteos', 'Huevos',
  'Soja', 'Frutos secos', 'Crustáceos',
  'Pescado', 'Moluscos', 'Cacahuetes',
  'Apio', 'Mostaza', 'Sésamo',
]
export const ALERGENOS_FICHA_PIE = ['Sulfitos', 'Altramuces']

interface Props {
  area?: AreaFicha
  tipoDoc: string            // "Elaboración previa" | "Receta"
  nombre: string
  gama?: string | null
  codigo?: string | null
  revision?: number | null
  fecha?: string             // vacío → __/__/__ para rellenar a mano
  tiempoPrep?: string | null
  rendimiento?: string | null
  costeTanda: string
  costeRacion: string
  ingredientes: LineaIng[]
  pasos: string[]
  conservacion: LineaConserva[]
  alergenos: string[]        // los marcados
  extra?: React.ReactNode    // controles de pantalla (no imprimen)
}

/** Pone en negrita los ingredientes que aparecen citados dentro de un paso. */
function resaltar(texto: string, ingredientes: LineaIng[]): React.ReactNode[] {
  const terminos = new Set<string>()
  ingredientes.forEach(i => {
    const n = (i.ingrediente || '').trim().toLowerCase()
    if (!n) return
    terminos.add(n)
    const prim = n.split(/\s+/)[0]
    if (prim.length >= 4) terminos.add(prim)
  })
  if (!terminos.size) return [texto]
  const lista = [...terminos].sort((a, b) => b.length - a.length)
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\b(${lista.map(esc).join('|')})\\b`, 'gi')
  const out: React.ReactNode[] = []
  let last = 0, m: RegExpExecArray | null, k = 0
  while ((m = re.exec(texto)) !== null) {
    if (m.index > last) out.push(texto.slice(last, m.index))
    out.push(<strong key={k++}>{m[0]}</strong>)
    last = m.index + m[0].length
  }
  if (last < texto.length) out.push(texto.slice(last))
  return out.length ? out : [texto]
}

function SecLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="fdoc-sec">
      <span className="fdoc-sec-cuadro" />
      <span className="fdoc-sec-txt">{children}</span>
    </div>
  )
}

export default function FichaTecnicaHoja({
  area = 'cocina', tipoDoc, nombre, gama, codigo, revision, fecha,
  tiempoPrep, rendimiento, costeTanda, costeRacion,
  ingredientes, pasos, conservacion, alergenos, extra,
}: Props) {
  const marcados = new Set(alergenos.map(a => a.toLowerCase()))
  const tieneAlerg = (a: string) => marcados.has(a.toLowerCase()) ||
    (a === 'Lácteos' && marcados.has('lacteos')) || (a === 'Huevos' && marcados.has('huevo'))

  const conserva = (metodo: string) => {
    const raiz: Record<string, string[]> = {
      'Táper': ['tapper', 'taper', 'tupper', 'táper'], 'Biberón': ['biber'],
      'Vacío': ['vacio', 'vacío', 'vac'], 'Congelación': ['congel'],
    }
    const claves = raiz[metodo] ?? [metodo.toLowerCase().slice(0, 4)]
    const hit = (conservacion ?? []).find(c => claves.some(k => (c.metodo ?? '').toLowerCase().includes(k)))
    return hit?.tiempo ?? 'NO'
  }

  const casilla = (a: string) => (
    <div key={a} className="fdoc-alerg-item">
      <span className={'fdoc-check' + (tieneAlerg(a) ? ' on' : '')} />
      <span className="fdoc-alerg-txt">{a}</span>
    </div>
  )

  return (
    <div className="fdoc-wrap" style={{ ['--fdoc-acento' as any]: ACENTO[area] }}>
      <style>{CSS}</style>

      {/* ── CABECERA ── */}
      <div className="fdoc-cab">
        <img className="fdoc-logo" src="/data/STREAT LAB LOGO-04.jpg" alt="Streat Lab"
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
        <div className="fdoc-cab-centro">
          <div className="fdoc-cab-tira">
            <span className="fdoc-pill-area">{AREA_LABEL[area]}</span>
            <span className="fdoc-tipodoc">{tipoDoc}</span>
          </div>
          <div className="fdoc-nombre">{(nombre ?? '').replace(/\.\s*$/, '')}</div>
          {gama && <div className="fdoc-gama">{gama}</div>}
        </div>
        <div className="fdoc-caja-id">
          <div className="fdoc-caja-fila">
            <div className="fdoc-caja-lbl">Código</div>
            <div className="fdoc-caja-val">{codigo || '—'}</div>
          </div>
          <div className="fdoc-caja-fila fdoc-caja-doble">
            <div>
              <div className="fdoc-caja-lbl">Revisión</div>
              <div className="fdoc-caja-val">{String(revision ?? 1).padStart(2, '0')}</div>
            </div>
            <div>
              <div className="fdoc-caja-lbl">Fecha</div>
              <div className="fdoc-caja-val">{fecha || '__/__/__'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="fdoc-regla" />

      {/* ── META ── */}
      <div className="fdoc-meta">
        <div className="fdoc-meta-cel">
          <div className="fdoc-meta-lbl">Tiempo de preparación</div>
          <div className="fdoc-meta-val">{tiempoPrep || '—'}</div>
        </div>
        <div className="fdoc-meta-cel">
          <div className="fdoc-meta-lbl">Rendimiento</div>
          <div className="fdoc-meta-val">{rendimiento || '—'}</div>
        </div>
        <div className="fdoc-meta-cel">
          <div className="fdoc-meta-lbl">Coste tanda</div>
          <div className="fdoc-meta-val">{costeTanda}</div>
        </div>
        <div className="fdoc-meta-cel fdoc-meta-destacada">
          <div className="fdoc-meta-lbl">€ / Ración</div>
          <div className="fdoc-meta-val">{costeRacion}</div>
        </div>
      </div>

      {/* ── INGREDIENTES ── */}
      <SecLabel>Ingredientes</SecLabel>
      <table className="fdoc-tabla">
        <thead>
          <tr>
            <th>Ingrediente</th>
            <th className="num">Cantidad</th>
            <th className="ud">Unidad</th>
            <th>Equivalencia</th>
          </tr>
        </thead>
        <tbody>
          {ingredientes.length === 0 && (
            <tr><td colSpan={4} className="fdoc-vacio">Sin ingredientes enlazados.</td></tr>
          )}
          {ingredientes.map((i, k) => (
            <tr key={k}>
              <td>{i.ingrediente}</td>
              <td className="num">{i.cantidad}</td>
              <td className="ud">{i.unidad}</td>
              <td>{i.equivalencia || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── PREPARACIÓN ── */}
      <SecLabel>Preparación</SecLabel>
      <div className="fdoc-pasos">
        {pasos.length === 0 && <div className="fdoc-paso"><span className="fdoc-paso-n">—</span><span className="fdoc-paso-txt">Sin elaboración escrita.</span></div>}
        {pasos.map((p, k) => (
          <div className="fdoc-paso" key={k}>
            <span className="fdoc-paso-n">{k + 1}.</span>
            <span className="fdoc-paso-txt">{resaltar(p, ingredientes)}</span>
          </div>
        ))}
      </div>

      {/* ── PIE: CONSERVACIÓN + ALÉRGENOS ── */}
      <div className="fdoc-pie">
        <div className="fdoc-pie-col fdoc-pie-conserva">
          <SecLabel>Conservación</SecLabel>
          <table className="fdoc-tabla fdoc-tabla-conserva">
            <tbody>
              {['Táper', 'Biberón', 'Vacío', 'Congelación'].map(m => (
                <tr key={m}>
                  <td>{m}</td>
                  <td className="num">{conserva(m)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="fdoc-pie-col fdoc-pie-alerg">
          <SecLabel>Alérgenos</SecLabel>
          <div className="fdoc-alerg-grid">{ALERGENOS_FICHA.map(casilla)}</div>
          <div className="fdoc-alerg-grid fdoc-alerg-pie">{ALERGENOS_FICHA_PIE.map(casilla)}</div>
        </div>
      </div>

      {extra && <div className="no-print fdoc-extra">{extra}</div>}
    </div>
  )
}

const CSS = `
.fdoc-wrap {
  background: #fff; color: #232323;
  border: 1px solid #ded7d0; border-radius: 6px;
  padding: 20px 24px 24px;
  font-family: 'Barlow Semi Condensed', 'Oswald', sans-serif;
}

/* ── Cabecera ── */
.fdoc-cab { display: flex; align-items: flex-start; gap: 16px; }
.fdoc-logo { height: 46px; width: auto; object-fit: contain; flex-shrink: 0; margin-top: 2px; }
.fdoc-cab-centro { flex: 1; min-width: 0; }
.fdoc-cab-tira { display: flex; align-items: center; gap: 12px; }
.fdoc-pill-area {
  font-family: 'Oswald', sans-serif; font-size: 10px; font-weight: 700;
  letter-spacing: 0.18em; text-transform: uppercase; color: var(--fdoc-acento);
  border: 1px solid var(--fdoc-acento); border-radius: 6px; padding: 2px 9px 2px 7px;
  display: inline-flex; align-items: center; gap: 6px;
}
.fdoc-pill-area::before { content: ''; width: 7px; height: 7px; background: var(--fdoc-acento); display: inline-block; }
.fdoc-tipodoc { font-family: 'Oswald', sans-serif; font-size: 10px; font-weight: 500; letter-spacing: 0.28em; text-transform: uppercase; color: #6c6c6c; }
.fdoc-nombre { font-family: 'Oswald', sans-serif; font-size: 34px; font-weight: 700; line-height: 1.05; letter-spacing: 0.01em; text-transform: uppercase; color: #232323; margin-top: 4px; }
.fdoc-gama { font-size: 15px; color: #7a7269; margin-top: 1px; }

.fdoc-caja-id { width: 210px; flex-shrink: 0; border: 1px solid #ded7d0; border-radius: 6px; overflow: hidden; }
.fdoc-caja-fila { padding: 5px 10px 6px; border-bottom: 1px solid #ded7d0; }
.fdoc-caja-fila:last-child { border-bottom: none; }
.fdoc-caja-doble { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.fdoc-caja-lbl { font-family: 'Oswald', sans-serif; font-size: 8px; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; color: #8b8279; }
.fdoc-caja-val { font-family: 'Oswald', sans-serif; font-size: 17px; font-weight: 700; color: #232323; line-height: 1.15; }

.fdoc-regla { height: 1px; background: #ded7d0; margin: 14px 0 12px; }

/* ── Meta ── */
.fdoc-meta { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #ded7d0; border-radius: 6px; overflow: hidden; }
.fdoc-meta-cel { padding: 8px 12px 9px; border-right: 1px solid #ded7d0; }
.fdoc-meta-cel:last-child { border-right: none; }
.fdoc-meta-lbl { font-family: 'Oswald', sans-serif; font-size: 8px; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; color: #8b8279; }
.fdoc-meta-val { font-family: 'Oswald', sans-serif; font-size: 18px; font-weight: 700; color: #232323; line-height: 1.2; }
.fdoc-meta-destacada { background: color-mix(in srgb, var(--fdoc-acento) 8%, #fff); }
.fdoc-meta-destacada .fdoc-meta-val { color: var(--fdoc-acento); }

/* ── Etiqueta de sección ── */
.fdoc-sec { display: flex; align-items: center; gap: 8px; margin: 16px 0 7px; }
.fdoc-sec-cuadro { width: 9px; height: 9px; background: var(--fdoc-acento); flex-shrink: 0; }
.fdoc-sec-txt { font-family: 'Oswald', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.26em; text-transform: uppercase; color: var(--fdoc-acento); }

/* ── Tablas ── */
.fdoc-tabla { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #ded7d0; border-radius: 6px; overflow: hidden; font-size: 15px; }
.fdoc-tabla th {
  background: #f2eeea; text-align: left; padding: 6px 12px;
  font-family: 'Oswald', sans-serif; font-size: 10px; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase; color: #4a443e;
  border-bottom: 1px solid #ded7d0;
}
.fdoc-tabla td { padding: 5px 12px; border-bottom: 1px solid #ece7e2; color: #232323; line-height: 1.15; }
.fdoc-tabla tbody tr:last-child td { border-bottom: none; }
.fdoc-tabla tbody tr:nth-child(even) td { background: #faf7f5; }
.fdoc-tabla th.num, .fdoc-tabla td.num { text-align: right; font-family: 'Oswald', sans-serif; font-weight: 700; white-space: nowrap; width: 90px; }
.fdoc-tabla th.num { font-weight: 700; }
.fdoc-tabla th.ud, .fdoc-tabla td.ud { width: 110px; color: #7a7269; }
.fdoc-vacio { color: #8b8279; font-style: italic; }
.fdoc-tabla-conserva { font-size: 15px; }
.fdoc-tabla-conserva td:first-child { font-family: 'Oswald', sans-serif; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; font-size: 13px; }

/* ── Pasos ── */
.fdoc-pasos { border: 1px solid #ded7d0; border-radius: 6px; overflow: hidden; }
.fdoc-paso { display: flex; gap: 10px; padding: 7px 12px; border-bottom: 1px solid #ece7e2; font-size: 15px; line-height: 1.3; }
.fdoc-paso:last-child { border-bottom: none; }
.fdoc-paso-n { font-family: 'Oswald', sans-serif; font-weight: 700; color: var(--fdoc-acento); flex-shrink: 0; min-width: 16px; }
.fdoc-paso-txt { flex: 1; min-width: 0; }

/* ── Pie ── */
.fdoc-pie { display: flex; gap: 26px; align-items: flex-start; margin-top: 4px; }
.fdoc-pie-conserva { width: 300px; flex-shrink: 0; }
.fdoc-pie-alerg { flex: 1; min-width: 0; }
.fdoc-alerg-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.fdoc-alerg-pie { grid-template-columns: repeat(3, 1fr); margin-top: 6px; }
.fdoc-alerg-item { display: flex; align-items: center; gap: 8px; border: 1px solid #ded7d0; border-radius: 6px; padding: 5px 9px; }
.fdoc-check { width: 11px; height: 11px; border: 1px solid #b3aaa1; border-radius: 2px; flex-shrink: 0; display: inline-block; }
.fdoc-check.on { background: var(--fdoc-acento); border-color: var(--fdoc-acento); }
.fdoc-alerg-txt { font-family: 'Oswald', sans-serif; font-size: 10.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #4a443e; }
.fdoc-extra { margin-top: 14px; }

/* ── IMPRESIÓN: la hoja de pantalla ES el papel ── */
@media print {
  @page { size: A4 portrait; margin: 12mm; }
  html, body { background: #fff !important; }
  body * { visibility: hidden; }
  .fdoc-wrap, .fdoc-wrap * { visibility: visible; }
  .no-print { display: none !important; }
  .fdoc-wrap {
    position: absolute; left: 0; top: 0; width: 100%;
    border: none !important; padding: 0 !important;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .fdoc-paso, .fdoc-alerg-item, .fdoc-tabla tr { break-inside: avoid; }
  .fdoc-pie { break-inside: avoid; }
}
`
