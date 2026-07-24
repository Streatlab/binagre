/* ==============================================================================
 * FICHA EPS / RECETA — HOJA IMPRIMIBLE (pantalla = papel)
 * Traslado LITERAL del paquete de diseño validado por Rubén (24-jul-2026):
 * `ficha-eps.html` + `ficha-eps.css`. Clases con prefijo `eps-`, tokens y
 * medidas en mm exactamente como vienen del paquete.
 *
 * Es el ÚNICO documento de EPs y recetas: cambia el rótulo del tipo, nada más.
 * El PDF se obtiene imprimiendo esta misma hoja, así que papel y pantalla no
 * pueden divergir nunca.
 *
 * Logo: `/data/logo-icon.svg` (vectorial, del propio repo). Se usa el SVG y no
 * el JPG porque el JPG está en CMYK y algunos navegadores lo desvirtúan al
 * imprimir; si el SVG faltara, cae al JPG automáticamente.
 *
 * Fuentes: Oswald (números, eyebrows, etiquetas, KPI) + Lexend (cuerpo y tablas).
 * Reglas irrompibles del paquete: legible en cocina, sin aire de más, paleta
 * apagada con acento de Cocina #a8524e, imprimible en color y en B/N, y con
 * huecos rellenables a mano (Equivalencia, Fecha, casillas, tiempos).
 * PROHIBIDO tocar estructura, medidas o paleta sin orden explícita de Rubén.
 * ============================================================================== */
import React from 'react'
import { ICONOS_ALERGENOS, ICONOS_CONSERVACION, ALERGENOS_14, ALERGENOS_2, CONSERVACION_4 } from '@/lib/iconosFicha'

export interface LineaIng { ingrediente: string; cantidad: string; unidad: string; equivalencia?: string }
export interface LineaConserva { metodo: string; tiempo: string }

export const ALERGENOS_FICHA = ALERGENOS_14.map(a => a.nombre)
export const ALERGENOS_FICHA_PIE = ALERGENOS_2.map(a => a.nombre)

interface Props {
  tipoDoc: string                 // "Elaboración previa" | "Receta"
  nombre: string
  gama?: string | null
  codigo?: string | null
  revision?: number | null
  fecha?: string | null
  tiempoPrep?: string | null
  rendimiento?: string | null
  costeTanda: string
  costeRacion: string
  ingredientes: LineaIng[]
  pasos: string[]
  conservacion: LineaConserva[]
  alergenos: string[]
  bn?: boolean
}

function Icono({ svg, sm }: { svg: string; sm?: boolean }) {
  return (
    <svg className={'eps-icono' + (sm ? ' eps-icono--sm' : '')} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: svg }} />
  )
}

/** Los ingredientes citados dentro de un paso van en negrita, como en el modelo. */
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
    out.push(<b key={k++}>{m[0]}</b>)
    last = m.index + m[0].length
  }
  if (last < texto.length) out.push(texto.slice(last))
  return out.length ? out : [texto]
}

export default function FichaTecnicaHoja({
  tipoDoc, nombre, gama, codigo, revision, fecha,
  tiempoPrep, rendimiento, costeTanda, costeRacion,
  ingredientes, pasos, conservacion, alergenos, bn,
}: Props) {
  const marcados = new Set((alergenos ?? []).map(a => a.toLowerCase()))
  const tiene = (n: string) => marcados.has(n.toLowerCase()) ||
    (n === 'Lácteos' && marcados.has('lacteos')) || (n === 'Huevos' && marcados.has('huevo'))

  const tiempoDe = (metodo: string) => {
    const raiz: Record<string, string[]> = {
      'Táper': ['tapper', 'taper', 'tupper', 'táper'], 'Biberón': ['biber'],
      'Vacío': ['vacio', 'vacío', 'vac'], 'Congelación': ['congel'],
    }
    const claves = raiz[metodo] ?? [metodo.toLowerCase().slice(0, 4)]
    const hit = (conservacion ?? []).find(c => claves.some(k => (c.metodo ?? '').toLowerCase().includes(k)))
    return hit?.tiempo ?? ''
  }

  const celdaAlerg = (a: { k: string; nombre: string }) => (
    <div className="eps-alerg__celda" key={a.k}>
      <span className={'eps-casilla' + (tiene(a.nombre) ? ' eps-casilla--on' : '')} />
      <span className="eps-alerg__k">{a.nombre}</span>
      <Icono svg={ICONOS_ALERGENOS[a.k]} sm />
    </div>
  )

  return (
    <div className={'eps-hoja' + (bn ? ' eps-hoja--bn' : '')}>
      <style>{CSS}</style>

      <header className="eps-header">
        <img className="eps-logo" src="/data/logo-icon.svg" alt="Streat Lab"
          onError={e => {
            const img = e.currentTarget as HTMLImageElement
            if (!img.dataset.fb) { img.dataset.fb = '1'; img.src = '/data/STREAT LAB LOGO-04.jpg' }
            else img.style.visibility = 'hidden'
          }} />
        <div style={{ flex: 1, minWidth: 0, paddingTop: '.4mm' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2.4mm', marginBottom: '1.2mm' }}>
            <span className="eps-chip">Cocina</span>
            <span className="eps-eyebrow">{tipoDoc}</span>
          </div>
          <h1 className="eps-titulo">{(nombre ?? '').replace(/\.\s*$/, '')}</h1>
          {gama && <div className="eps-categoria">{gama}</div>}
        </div>
        <div className="eps-control">
          <div style={{ padding: '1.2mm 2.4mm', borderBottom: '1px solid var(--rule)' }}>
            <div className="eps-control__k">Código</div>
            <div className="eps-control__v">{codigo || '—'}</div>
          </div>
          <div style={{ display: 'flex' }}>
            <div style={{ flex: 1, padding: '1.2mm 2.4mm', borderRight: '1px solid var(--rule)' }}>
              <div className="eps-control__k">Revisión</div>
              <div className="eps-control__v">{String(revision ?? 1).padStart(2, '0')}</div>
            </div>
            <div style={{ flex: 1, padding: '1.2mm 2.4mm' }}>
              <div className="eps-control__k">Fecha</div>
              <div className={'eps-control__v' + (fecha ? '' : ' eps-control__v--hueco')}>{fecha || '__/__/__'}</div>
            </div>
          </div>
        </div>
      </header>

      <div className="eps-banda">
        <div><div className="eps-banda__k">Tiempo de preparación</div><div className="eps-banda__v">{tiempoPrep || '—'}</div></div>
        <div><div className="eps-banda__k">Rendimiento</div><div className="eps-banda__v">{rendimiento || '—'}</div></div>
        <div><div className="eps-banda__k">Coste tanda</div><div className="eps-banda__v">{costeTanda}</div></div>
        <div><div className="eps-banda__k">€ / Ración</div><div className="eps-banda__v eps-banda__v--acc">{costeRacion}</div></div>
      </div>

      <div className="eps-seccion">Ingredientes</div>
      <table className="eps-tabla">
        <thead>
          <tr>
            <th>Ingrediente</th>
            <th className="num">Cantidad</th>
            <th className="ud">Unidad</th>
            <th className="eq">Equivalencia</th>
          </tr>
        </thead>
        <tbody>
          {ingredientes.length === 0 && (
            <tr><td colSpan={4} style={{ color: 'var(--fill)' }}>Sin ingredientes enlazados.</td></tr>
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

      <div className="eps-seccion">Preparación</div>
      <div className="eps-pasos">
        {pasos.length === 0 && (
          <div className="eps-paso"><span className="eps-paso__n">—</span><span className="eps-paso__t">Sin elaboración escrita.</span></div>
        )}
        {pasos.map((p, k) => (
          <div className="eps-paso" key={k}>
            <span className="eps-paso__n">{k + 1}.</span>
            <span className="eps-paso__t">{resaltar(p, ingredientes)}</span>
          </div>
        ))}
      </div>

      <div className="eps-pie">
        <div className="eps-conserva">
          <div className="eps-seccion">Conservación</div>
          <div className="eps-conserva__caja">
            {CONSERVACION_4.map(c => (
              <div className="eps-conserva__fila" key={c.k}>
                <Icono svg={ICONOS_CONSERVACION[c.k]} />
                <span className="eps-conserva__k">{c.nombre}</span>
                <span className="eps-conserva__t">{tiempoDe(c.nombre)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="eps-alerg">
          <div className="eps-seccion">Alérgenos</div>
          <div className="eps-alerg__grid">{ALERGENOS_14.map(celdaAlerg)}</div>
          <div className="eps-alerg__grid2">{ALERGENOS_2.map(celdaAlerg)}</div>
        </div>
      </div>
    </div>
  )
}

/* CSS LITERAL del paquete `ficha-eps.css` (+ el bloque de impresión que aísla la
   hoja del resto del ERP; el documento en sí no se toca). */
const CSS = `
.eps-hoja{
  --paper:#ffffff;
  --ink:#241d15;
  --ink-2:#5c554a;
  --ink-3:#8a8275;
  --rule:#c3bba8;
  --rule-2:#7d7566;
  --thead:#efe9dc;
  --zebra:#f8f4ec;
  --fill:#a49a86;
  --acc:#a8524e;
  --acc-bn:#565656;
  --osw:'Oswald', system-ui, sans-serif;
  --lex:'Lexend', system-ui, sans-serif;
}
.eps-hoja{
  box-sizing:border-box; width:210mm; min-height:297mm;
  padding:9mm 10mm 8mm; background:var(--paper); color:var(--ink);
  font-family:var(--lex); display:flex; flex-direction:column;
  margin:0 auto;
}
.eps-hoja--bn{ --acc:var(--acc-bn); }
.eps-hoja *{ box-sizing:border-box; }

.eps-header{ display:flex; align-items:flex-start; gap:5mm;
  border-bottom:2px solid var(--acc); padding-bottom:3mm; margin-bottom:2.6mm; }
.eps-logo{ width:19mm; height:19mm; object-fit:contain; flex:none; display:block; }
.eps-chip{ display:inline-flex; align-items:center; gap:1.6mm;
  border:1.4px solid var(--acc); border-radius:2px; padding:.7mm 2.2mm;
  font-family:var(--osw); font-weight:700; font-size:3mm;
  letter-spacing:1.6px; text-transform:uppercase; color:var(--acc); }
.eps-chip::before{ content:""; width:2.6mm; height:2.6mm; border-radius:1px; background:var(--acc); }
.eps-eyebrow{ font-family:var(--osw); font-size:2.7mm; letter-spacing:2.2px;
  font-weight:500; text-transform:uppercase; color:var(--ink-3); }
.eps-titulo{ margin:0; font-family:var(--osw); font-size:8.4mm; font-weight:700;
  line-height:.98; letter-spacing:-.3px; text-transform:uppercase; }
.eps-categoria{ margin-top:1mm; font-family:var(--lex); font-size:2.9mm; color:var(--ink-2); }

.eps-control{ flex:none; width:40mm; border:1px solid var(--rule-2); border-radius:2px; background:var(--paper); }
.eps-control__k{ font-family:var(--osw); font-size:2.3mm; letter-spacing:1.2px;
  text-transform:uppercase; color:var(--ink-3); }
.eps-control__v{ font-family:var(--osw); font-size:3.6mm; font-weight:600; }
.eps-control__v--hueco{ color:var(--fill); }

.eps-banda{ display:grid; grid-template-columns:repeat(4,1fr);
  border:1px solid var(--rule-2); border-radius:2px; margin-bottom:2.6mm; }
.eps-banda > div{ padding:1.5mm 2.4mm; border-right:1px solid var(--rule); }
.eps-banda > div:last-child{ border-right:0; background:var(--zebra); }
.eps-banda__k{ font-family:var(--osw); font-size:2.3mm; letter-spacing:1px;
  text-transform:uppercase; color:var(--ink-3); }
.eps-banda__v{ font-family:var(--osw); font-size:4mm; font-weight:600; color:var(--ink); }
.eps-banda__v--acc{ font-weight:700; color:var(--acc); }

.eps-seccion{ display:flex; align-items:center; gap:2.2mm; margin-bottom:1.4mm;
  font-family:var(--osw); font-size:2.9mm; letter-spacing:1.8px;
  text-transform:uppercase; font-weight:600; color:var(--acc); }
.eps-seccion::before{ content:""; width:3mm; height:3mm; background:var(--acc); flex:none; }

.eps-tabla{ width:100%; border-collapse:collapse; table-layout:fixed;
  font-family:var(--lex); border:1px solid var(--rule-2); margin-bottom:2.6mm; }
.eps-tabla thead tr{ background:var(--thead); font-family:var(--osw); font-size:2.9mm;
  text-transform:uppercase; letter-spacing:.4px; border-bottom:1.6px solid var(--acc); }
.eps-tabla th{ padding:1.3mm 2.4mm; font-weight:600; text-align:left; border-right:1px solid var(--rule); }
.eps-tabla th:last-child{ border-right:0; }
.eps-tabla th.num{ text-align:right; width:20mm; }
.eps-tabla th.ud{ width:22mm; }
.eps-tabla th.eq{ width:52mm; }
.eps-tabla td{ height:7.2mm; border-top:1px solid var(--rule);
  border-right:1px solid var(--rule); padding:0 2.4mm; font-size:3.6mm;
  font-weight:500; color:var(--ink); }
.eps-tabla td:last-child{ border-right:0; }
.eps-tabla td.num{ text-align:right; font-family:var(--osw); font-weight:600; }
.eps-tabla td.ud{ font-family:var(--lex); font-size:3.3mm; color:var(--ink-2); }
.eps-tabla tbody tr:nth-child(even){ background:var(--zebra); }

.eps-pasos{ border:1px solid var(--rule-2); border-radius:2px; margin-bottom:2.6mm; }
.eps-paso{ display:flex; gap:2.6mm; align-items:baseline;
  border-bottom:1px solid var(--rule); padding:1.5mm 3mm; }
.eps-pasos > .eps-paso:last-child{ border-bottom:0; }
.eps-paso__n{ font-family:var(--osw); font-size:3.4mm; font-weight:700;
  color:var(--acc); flex:none; min-width:5mm; }
.eps-paso__t{ font-family:var(--lex); font-size:3.5mm; line-height:1.35; color:var(--ink); }

.eps-pie{ display:flex; gap:4mm; }
.eps-conserva{ width:64mm; flex:none; }
.eps-conserva__caja{ border:1px solid var(--rule-2); border-radius:2px; }
.eps-conserva__fila{ display:flex; align-items:center; gap:2.2mm;
  padding:1.6mm 2.4mm; border-bottom:1px solid var(--rule); }
.eps-conserva__caja > .eps-conserva__fila:last-child{ border-bottom:0; }
.eps-conserva__k{ flex:none; font-family:var(--osw); font-size:3.2mm; font-weight:500;
  text-transform:uppercase; letter-spacing:.4px; color:var(--ink); }
.eps-conserva__t{ margin-left:auto; font-family:var(--osw); font-size:3.2mm;
  font-weight:700; color:var(--ink); }

.eps-alerg{ flex:1; min-width:0; }
.eps-alerg__grid{ border:1px solid var(--rule-2); border-radius:2px;
  display:grid; grid-template-columns:repeat(3,1fr); overflow:hidden; }
.eps-alerg__grid2{ display:grid; grid-template-columns:1fr 1fr;
  border:1px solid var(--rule-2); border-radius:0 0 2px 2px;
  overflow:hidden; width:66.6%; margin:-1px auto 0; }
.eps-alerg__celda{ display:flex; align-items:center; gap:1.4mm; padding:1.3mm 1.6mm;
  border-top:1px solid var(--rule); border-right:1px solid var(--rule); }
.eps-alerg__grid > .eps-alerg__celda:nth-child(-n+3){ border-top:0; }
.eps-alerg__grid > .eps-alerg__celda:nth-child(3n){ border-right:0; }
.eps-alerg__grid2 > .eps-alerg__celda{ border-top:0; }
.eps-alerg__grid2 > .eps-alerg__celda:last-child{ border-right:0; }
.eps-alerg__k{ flex:1; font-family:var(--osw); font-size:2.5mm; font-weight:600;
  text-transform:uppercase; letter-spacing:.2px; color:var(--ink); line-height:1.05; }

.eps-casilla{ flex:none; width:3.4mm; height:3.4mm;
  border:1.2px solid var(--rule-2); border-radius:1px; background:#fff; }
.eps-casilla--on{ background:var(--acc); border-color:var(--acc); }

.eps-icono{ flex:none; width:4mm; height:4mm; color:var(--ink-2); }
.eps-icono--sm{ width:3.4mm; height:3.4mm; }

@media print{
  @page{ size:A4 portrait; margin:0; }
  html, body{ background:#fff !important; }
  body *{ visibility:hidden; }
  .eps-hoja, .eps-hoja *{ visibility:visible; }
  .no-print{ display:none !important; }
  .eps-hoja{
    position:absolute; left:0; top:0;
    width:210mm; min-height:auto; page-break-after:always;
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
  }
  .eps-paso, .eps-conserva__fila, .eps-alerg__celda, .eps-tabla tr{ break-inside:avoid; }
  .eps-pie{ break-inside:avoid; }
}
`
