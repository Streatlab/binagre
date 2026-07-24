/**
 * ModalImprimir — modal único de impresión del ERP (handoff §3.4).
 * Dos salidas desde el mismo sitio:
 *  · "Imprimir aquí": genera el PDF en el navegador y abre el diálogo de impresión.
 *  · "Enviar al local": manda el mismo PDF a la Epson de la cocina (vía impresionEnvio).
 * Muestra las preferencias del documento (tinta/orientación/copias) y permite
 * cambiarlas SOLO para esta impresión. Resultado siempre visible, nunca silencioso.
 * Usable en PWA: pantalla completa en móvil, botones grandes, sin hover.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { jsPDF } from 'jspdf'
import { X, Printer, Send, Check, AlertTriangle } from 'lucide-react'
import { INK, CREMA, BLANCO, VERDE, GRANATE, NAR, OSW, LEX, GRIS } from '@/styles/neobrutal'
import { SHADOW_DURA } from '@/components/kit/cantera'
import { abrirImprimir, nombreArchivo } from '@/lib/marcoDoc'
import { cargarPreferencias, enviarAlLocal, preferenciasPorDefecto, type PreferenciasDoc } from '@/lib/impresionEnvio'
import { useAuth } from '@/context/AuthContext'
import { useEsMovil } from '@/hooks/useEsMovil'

export interface GenerarPdfOpts {
  bn: boolean
  orientacion: 'vertical' | 'apaisado'
}

interface Props {
  abierto: boolean
  onCerrar: () => void
  documentoId: string
  titulo: string
  generarPdf: (opts: GenerarPdfOpts) => Promise<jsPDF | null> | jsPDF | null
}

type Estado =
  | { fase: 'listo' }
  | { fase: 'trabajando'; que: 'aqui' | 'local' }
  | { fase: 'ok'; que: 'aqui' | 'local'; detalle: string }
  | { fase: 'error'; detalle: string }

const lbl = { fontFamily: OSW, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: GRIS, fontWeight: 600 }

function Opcion({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: OSW, fontWeight: 600, fontSize: 13, textTransform: 'uppercase', letterSpacing: '1px',
        padding: '8px 14px', cursor: 'pointer', borderRadius: 0,
        background: activo ? INK : BLANCO, color: activo ? CREMA : INK,
        border: `2px solid ${INK}`, boxShadow: activo ? 'none' : SHADOW_DURA,
      }}
    >{children}</button>
  )
}

export default function ModalImprimir({ abierto, onCerrar, documentoId, titulo, generarPdf }: Props) {
  const { usuario } = useAuth()
  const esMovil = useEsMovil()
  const [prefs, setPrefs] = useState<PreferenciasDoc | null>(null)
  const [tinta, setTinta] = useState<'bn' | 'color'>('bn')
  const [orientacion, setOrientacion] = useState<'vertical' | 'apaisado'>('vertical')
  const [copias, setCopias] = useState(1)
  const [estado, setEstado] = useState<Estado>({ fase: 'listo' })

  useEffect(() => {
    if (!abierto) return
    setEstado({ fase: 'listo' })
    setPrefs(null)
    cargarPreferencias(documentoId, titulo)
      .then(p => { setPrefs(p); setTinta(p.tinta); setOrientacion(p.orientacion); setCopias(p.copias) })
      .catch(() => {
        const p = preferenciasPorDefecto(documentoId, titulo)
        setPrefs(p); setTinta(p.tinta); setOrientacion(p.orientacion); setCopias(p.copias)
      })
  }, [abierto, documentoId, titulo])

  if (!abierto) return null

  const generar = async (): Promise<jsPDF | null> => {
    const doc = await generarPdf({ bn: tinta === 'bn', orientacion })
    if (!doc) setEstado({ fase: 'error', detalle: 'No se pudo generar el PDF (¿documento vacío?)' })
    return doc
  }

  const imprimirAqui = async () => {
    setEstado({ fase: 'trabajando', que: 'aqui' })
    try {
      const doc = await generar()
      if (!doc) return
      abrirImprimir(doc)
      setEstado({ fase: 'ok', que: 'aqui', detalle: 'PDF abierto: usa el diálogo de impresión del navegador' })
    } catch (err) {
      setEstado({ fase: 'error', detalle: (err as Error).message })
    }
  }

  const enviarLocal = async () => {
    setEstado({ fase: 'trabajando', que: 'local' })
    try {
      const doc = await generar()
      if (!doc) return
      const r = await enviarAlLocal({
        doc,
        documentoId,
        nombre: titulo,
        nombreArchivo: nombreArchivo(`${titulo}-${new Date().toISOString().slice(0, 10)}`),
        copias,
        usuario: usuario?.nombre || null,
      })
      if (r.ok) setEstado({ fase: 'ok', que: 'local', detalle: `Enviado a la impresora del local (${copias} ${copias === 1 ? 'copia' : 'copias'})` })
      else setEstado({ fase: 'error', detalle: r.error || 'Error desconocido al enviar' })
    } catch (err) {
      setEstado({ fase: 'error', detalle: (err as Error).message })
    }
  }

  const trabajando = estado.fase === 'trabajando'

  const btnSalida = (bg: string, color: string): React.CSSProperties => ({
    flex: 1, minWidth: esMovil ? '100%' : 220, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    fontFamily: OSW, fontWeight: 700, fontSize: 17, textTransform: 'uppercase', letterSpacing: '1px',
    background: bg, color, border: `3px solid ${INK}`, boxShadow: SHADOW_DURA, borderRadius: 0,
    padding: '16px 18px', cursor: trabajando ? 'wait' : 'pointer', opacity: trabajando ? 0.6 : 1,
  })

  const modal = (
    <div
      onClick={onCerrar}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, background: '#241D12cc',
        display: 'flex', alignItems: esMovil ? 'stretch' : 'center', justifyContent: 'center',
        padding: esMovil ? 0 : 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          fontFamily: LEX, background: CREMA, color: INK, border: `3px solid ${INK}`,
          boxShadow: esMovil ? 'none' : SHADOW_DURA, borderRadius: 0,
          width: esMovil ? '100%' : 'min(560px, 96vw)', height: esMovil ? '100%' : 'auto',
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
        }}
      >
        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: `3px solid ${INK}`, background: BLANCO, padding: '14px 18px' }}>
          <Printer size={22} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 18, textTransform: 'uppercase', lineHeight: 1.1 }}>Imprimir</div>
            <div style={{ fontSize: 12.5, color: GRIS, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titulo}</div>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" style={{ background: BLANCO, border: `2px solid ${INK}`, boxShadow: SHADOW_DURA, borderRadius: 0, padding: 8, cursor: 'pointer', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Preferencias de ESTA impresión */}
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14, flex: esMovil ? 1 : 'initial' }}>
          {!prefs && <div style={{ fontSize: 13, color: GRIS }}>Cargando preferencias…</div>}
          {prefs && (
            <>
              <div>
                <div style={lbl}>Tinta</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <Opcion activo={tinta === 'bn'} onClick={() => setTinta('bn')}>B/N</Opcion>
                  <Opcion activo={tinta === 'color'} onClick={() => setTinta('color')}>Color</Opcion>
                </div>
              </div>
              <div>
                <div style={lbl}>Orientación</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <Opcion activo={orientacion === 'vertical'} onClick={() => setOrientacion('vertical')}>Vertical</Opcion>
                  <Opcion activo={orientacion === 'apaisado'} onClick={() => setOrientacion('apaisado')}>Apaisado</Opcion>
                </div>
              </div>
              <div>
                <div style={lbl}>Copias (solo "Enviar al local")</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                  <Opcion activo={false} onClick={() => setCopias(c => Math.max(1, c - 1))}>−</Opcion>
                  <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 22, minWidth: 34, textAlign: 'center' }}>{copias}</span>
                  <Opcion activo={false} onClick={() => setCopias(c => Math.min(10, c + 1))}>+</Opcion>
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: GRIS }}>
                Los cambios valen solo para esta impresión. Los valores por defecto se ajustan en Ajustes → Impresión.
              </div>
            </>
          )}

          {/* Resultado visible (nunca envío silencioso) */}
          {estado.fase === 'trabajando' && (
            <div style={{ border: `2px solid ${INK}`, background: BLANCO, padding: '10px 12px', fontFamily: OSW, textTransform: 'uppercase', fontSize: 13 }}>
              {estado.que === 'local' ? 'Enviando a la impresora del local…' : 'Generando PDF…'}
            </div>
          )}
          {estado.fase === 'ok' && (
            <div style={{ border: `2px solid ${INK}`, borderLeft: `10px solid ${VERDE}`, background: BLANCO, padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}>
              <Check size={18} color={VERDE} /> {estado.detalle}
            </div>
          )}
          {estado.fase === 'error' && (
            <div style={{ border: `2px solid ${INK}`, borderLeft: `10px solid ${GRANATE}`, background: BLANCO, padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}>
              <AlertTriangle size={18} color={GRANATE} /> {estado.detalle}
            </div>
          )}
        </div>

        {/* Las dos salidas */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '0 18px 18px' }}>
          <button onClick={imprimirAqui} disabled={trabajando} style={btnSalida(BLANCO, INK)}>
            <Printer size={20} /> Imprimir aquí
          </button>
          <button onClick={enviarLocal} disabled={trabajando} style={btnSalida(NAR, BLANCO)}>
            <Send size={20} /> Enviar al local
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
