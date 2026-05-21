// OcrConToast — wrapper que renderiza Ocr + OcrUploadToast (solo visible aquí)
import Ocr from '@/pages/Ocr'
import OcrUploadToast from '@/components/ocr/OcrUploadToast'

export default function OcrConToast() {
  return (
    <>
      <Ocr />
      <OcrUploadToast />
    </>
  )
}
