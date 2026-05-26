// OcrConToast v2 — wrapper: Ocr + OcrUploadToast + errorVisible banner
import { useEffect } from 'react'
import Ocr from '@/pages/Ocr'
import OcrUploadToast from '@/components/ocr/OcrUploadToast'
import { useOcrUpload } from '@/lib/ocrUploadStore'
import { toast } from '@/lib/toastStore'

export default function OcrConToast() {
  const { errorVisible } = useOcrUpload()
  useEffect(() => { if (errorVisible) toast.error(errorVisible) }, [errorVisible])
  return (
    <>
      <Ocr />
      <OcrUploadToast />
    </>
  )
}
