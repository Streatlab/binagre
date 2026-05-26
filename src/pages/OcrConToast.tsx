// OcrConToast v3 — toast único + refresh instantáneo cards
import { useEffect, useState } from 'react'
import Ocr from '@/pages/Ocr'
import OcrUploadToast from '@/components/ocr/OcrUploadToast'
import { useOcrUpload } from '@/lib/ocrUploadStore'
import { toast } from '@/lib/toastStore'
import { supabase } from '@/lib/supabase'

export default function OcrConToast() {
  const { errorVisible } = useOcrUpload()
  const [refreshNonce, setRefreshNonce] = useState(0)

  useEffect(() => { if (errorVisible) toast.error(errorVisible) }, [errorVisible])

  // Realtime sobre facturas → refresca cards y tabla al instante
  useEffect(() => {
    const ch = supabase
      .channel('facturas_live_ocr')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facturas' }, () => {
        setRefreshNonce(n => n + 1)
      })
      .subscribe()
    return () => { try { supabase.removeChannel(ch) } catch {} }
  }, [])

  return (
    <>
      <Ocr key={refreshNonce === 0 ? 'base' : `r${refreshNonce}`} />
      <OcrUploadToast />
    </>
  )
}
