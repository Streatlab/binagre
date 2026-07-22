/**
 * VisorPdf — sirve el PDF desde nuestro Supabase Storage propio (bucket
 * 'facturas') vía signed URL, nunca un iframe de Google Drive (pedía "necesitas
 * acceso" y no había forma de verlo). Si el documento no tiene pdf_storage_path
 * todavía (subido antes de este fix, o Drive-only), cae a un botón "Abrir en
 * Drive" en pestaña nueva — eso sí funciona porque no se embebe.
 */
import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { INK, GRIS, AZUL } from '@/styles/neobrutal'

export default function VisorPdf({ storagePath, driveUrl }: { storagePath: string | null; driveUrl: string | null }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(storagePath))
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    if (!storagePath) { setLoading(false); setSignedUrl(null); return }
    let cancelado = false
    setLoading(true)
    setFallo(false)
    fetch(`/api/equipo/pdf-firmado?path=${encodeURIComponent(storagePath)}`)
      .then(r => r.json())
      .then(data => {
        if (cancelado) return
        if (data?.url) setSignedUrl(data.url)
        else setFallo(true)
      })
      .catch(() => { if (!cancelado) setFallo(true) })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [storagePath])

  if (storagePath && loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: GRIS, fontSize: 12 }}>Cargando PDF…</div>
  }
  if (storagePath && signedUrl && !fallo) {
    return <iframe src={signedUrl} title="Documento PDF" style={{ width: '100%', height: 380, border: `2px solid ${INK}` }} />
  }
  if (driveUrl) {
    return (
      <a href={driveUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: AZUL, fontSize: 12, textDecoration: 'none' }}>
        <Download size={12} /> Abrir en Drive
      </a>
    )
  }
  return <div style={{ color: GRIS, fontSize: 12 }}>Sin PDF asociado.</div>
}
