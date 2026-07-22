/* ==============================================================================
 * MODULO BLINDADO - HOJA DOC EN PANTALLA (ERP Streat Lab)
 * Componente React que pinta la "hoja/papel" en pantalla con el mismo marco
 * que el PDF: espina lateral de area, cabecera (docNombre + meta + tituloCentrado
 * + logo Streat Lab), regla de acento y cuerpo del documento.
 * Fuente de verdad: src/lib/marcoDoc.ts (tokens) y docs/MARCO_DOCUMENTOS.md.
 * PROHIBIDO cambiar estructura, medidas o paleta sin que Ruben lo pida EXPLICITAMENTE.
 * ============================================================================== */
import React from 'react'
import * as M from '@/lib/marcoDoc'

interface HojaDocProps {
  area: M.Area
  docNombre: string
  meta?: string
  tituloCentrado?: string
  children: React.ReactNode
}

const AREA_LABEL: Record<M.Area, string> = { cocina: 'COCINA', finanzas: 'FINANZAS', equipo: 'EQUIPO' }

const CSS = `
.hoja-doc { display: flex; flex-direction: row; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--m-radio, 10px); color: var(--text-primary); overflow: hidden; }
.hoja-doc-espina { width: 28px; flex: 0 0 28px; background: var(--m-espina); display: flex; align-items: center; justify-content: center; }
.hoja-doc-espina-txt { writing-mode: vertical-rl; text-orientation: mixed; transform: rotate(180deg); font-family: 'Oswald', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #fff; white-space: nowrap; }
.hoja-doc-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.hoja-doc-cab { display: flex; align-items: center; gap: 10px; padding: 13px 18px 10px; }
.hoja-doc-cab-left { display: flex; flex-direction: column; gap: 2px; flex-shrink: 0; }
.hoja-doc-cab-nombre { font-family: 'Oswald', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--m-acento); }
.hoja-doc-cab-meta { font-family: 'Barlow Semi Condensed', 'Oswald', sans-serif; font-size: 10px; color: #6c6c6c; text-transform: uppercase; letter-spacing: 0.03em; }
.hoja-doc-cab-titulo { flex: 1; font-family: 'Oswald', sans-serif; font-size: 19px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--m-tinta, #232323); text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.hoja-doc-logo { height: 32px; width: auto; max-width: 100px; object-fit: contain; margin-left: auto; flex-shrink: 0; display: block; }
.hoja-doc-rule { height: 2px; background: var(--m-acento); margin: 0 18px; flex-shrink: 0; }
.hoja-doc-body { flex: 1; min-width: 0; }
`

export default function HojaDoc({ area, docNombre, meta, tituloCentrado, children }: HojaDocProps) {
  return (
    <div className="hoja-doc" style={M.marcoCSSVars(area) as React.CSSProperties}>
      <style>{CSS}</style>
      <div className="hoja-doc-espina">
        <span className="hoja-doc-espina-txt">{AREA_LABEL[area]}</span>
      </div>
      <div className="hoja-doc-main">
        <div className="hoja-doc-cab">
          <div className="hoja-doc-cab-left">
            <div className="hoja-doc-cab-nombre">{docNombre}</div>
            {meta && <div className="hoja-doc-cab-meta">{meta}</div>}
          </div>
          {tituloCentrado && (
            <div className="hoja-doc-cab-titulo">{tituloCentrado.toUpperCase()}</div>
          )}
          <img
            className="hoja-doc-logo"
            src="/data/STREAT LAB LOGO-04.jpg"
            alt="Streat Lab"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        </div>
        <div className="hoja-doc-rule" />
        <div className="hoja-doc-body">{children}</div>
      </div>
    </div>
  )
}
