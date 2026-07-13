// OcrConToast v7 — toast único: OcrUploadToast vive UNA sola vez, montado
// globalmente en Layout. Antes se montaba también aquí y se duplicaba la
// tarjeta de progreso/resumen del lote mientras se estaba en esta pestaña.
import { useEffect, useState } from 'react'
import Ocr from '@/pages/Ocr'
import { useOcrUpload } from '@/lib/ocrUploadStore'
import { toast } from '@/lib/toastStore'
import { supabase } from '@/lib/supabase'

export default function OcrConToast({ periodoExterno }: { periodoExterno?: { desde: Date; hasta: Date } }) {
  const { errorVisible } = useOcrUpload()
  const [, setRefreshNonce] = useState(0)

  useEffect(() => { if (errorVisible) toast.error(errorVisible) }, [errorVisible])

  useEffect(() => {
    const onFacturasChange = () => setRefreshNonce(n => n + 1)
    ;(window as any).__ocrRefresh = onFacturasChange
    const ch = supabase
      .channel('facturas_live_ocr')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facturas' }, () => {
        window.dispatchEvent(new CustomEvent('facturas:changed'))
      })
      .subscribe()
    return () => { try { supabase.removeChannel(ch) } catch {} ; delete (window as any).__ocrRefresh }
  }, [])

  return <Ocr periodoExterno={periodoExterno} />
}
