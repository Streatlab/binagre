/**
 * BotonImprimir — botón ÚNICO de impresión del ERP (handoff §3.4).
 * Un solo botón por documento imprimible; abre ModalImprimir con las dos salidas
 * ("Imprimir aquí" / "Enviar al local"). Estilo Cantera: sombra dura de lo pulsable.
 */
import { useState } from 'react'
import type { jsPDF } from 'jspdf'
import { Printer } from 'lucide-react'
import { INK, BLANCO, OSW } from '@/styles/neobrutal'
import { SHADOW_DURA } from '@/components/kit/cantera'
import ModalImprimir, { type GenerarPdfOpts } from '@/components/ModalImprimir'

interface Props {
  documentoId: string
  titulo: string
  generarPdf: (opts: GenerarPdfOpts) => Promise<jsPDF | null> | jsPDF | null
  /** Variante pequeña para barras de herramientas densas. */
  compacto?: boolean
  /** Texto del botón (por defecto "Imprimir"). */
  etiqueta?: string
}

export default function BotonImprimir({ documentoId, titulo, generarPdf, compacto, etiqueta = 'Imprimir' }: Props) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        title={`Imprimir · ${titulo}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontFamily: OSW, fontWeight: 600, fontSize: compacto ? 12.5 : 14,
          textTransform: 'uppercase', letterSpacing: '1px',
          background: BLANCO, color: INK, border: `${compacto ? 2 : 3}px solid ${INK}`,
          boxShadow: SHADOW_DURA, borderRadius: 0,
          padding: compacto ? '6px 10px' : '9px 14px', cursor: 'pointer',
        }}
      >
        <Printer size={compacto ? 14 : 17} /> {etiqueta}
      </button>
      <ModalImprimir
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        documentoId={documentoId}
        titulo={titulo}
        generarPdf={generarPdf}
      />
    </>
  )
}
