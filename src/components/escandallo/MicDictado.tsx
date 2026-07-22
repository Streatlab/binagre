// MicDictado — B1: captura de voz por Web Speech API. Transcribe al vuelo y va
// añadiendo el texto reconocido. Si el navegador NO soporta Web Speech, el botón
// NO se renderiza (nada de botón muerto) — el textarea de al lado sigue sirviendo.
import { useRef, useState } from 'react'
import { INK, ROJO, OSW } from '@/styles/neobrutal'

// SpeechRecognition puede venir con prefijo webkit.
const SR: any = typeof window !== 'undefined'
  ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  : null

export const dictadoVozSoportado = !!SR

export default function MicDictado({ onTexto }: { onTexto: (t: string) => void }) {
  const [escuchando, setEscuchando] = useState(false)
  const recRef = useRef<any>(null)
  if (!SR) return null

  const toggle = () => {
    if (escuchando) { recRef.current?.stop(); return }
    const rec = new SR()
    rec.lang = 'es-ES'
    rec.interimResults = false
    rec.continuous = true
    rec.onresult = (e: any) => {
      let txt = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) txt += e.results[i][0].transcript + ' '
      }
      if (txt.trim()) onTexto(txt.trim())
    }
    rec.onend = () => setEscuchando(false)
    rec.onerror = () => setEscuchando(false)
    recRef.current = rec
    rec.start()
    setEscuchando(true)
  }

  return (
    <button type="button" onClick={toggle} title={escuchando ? 'Parar dictado' : 'Dictar por voz'}
      style={{ background: escuchando ? ROJO : '#ffffff', color: escuchando ? '#fff' : INK, border: `2px solid ${INK}`, borderRadius: 0, padding: '7px 12px', fontFamily: OSW, fontWeight: 700, fontSize: 10, letterSpacing: '1px', cursor: 'pointer' }}>
      {escuchando ? '● GRABANDO' : '🎤 VOZ'}
    </button>
  )
}
