/**
 * TabEquipoSubir — punto de entrada único de documentos del equipo (nóminas,
 * resúmenes de gestoría, RLC/RNT de Seguridad Social). Sube el archivo tal cual
 * a /api/equipo/subir, que ya clasifica por marcadores deterministas y encamina
 * cada tipo con cero pérdida (si no puede clasificar con seguridad, el documento
 * queda en la cola "Documentos por revisar" de Equipo). Este componente no
 * duplica esa lógica: solo entrega el archivo.
 */
import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { OSW, LEX, INK, CLARO, SHADOW, BORDER_CARD, GRANATE, VERDE, ROJO, NAR, GRIS, BLANCO, eyebrow } from '@/styles/neobrutal'

interface ResultadoSubida {
  ok: boolean
  destino?: string
  multi?: boolean
  nominas_ok?: number
  total_partes?: number
  motivo?: string
  error?: string
}

const LABEL_DESTINO: Record<string, string> = {
  nominas: 'nómina',
  resumen_nominas: 'resumen de nóminas',
  seguridad_social: 'RLC de Seguridad Social',
  seguridad_social_rnt: 'RNT de Seguridad Social',
  autonomos_cuotas: 'cuota de autónomos',
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const idx = result.indexOf(',')
      resolve(idx >= 0 ? result.slice(idx + 1) : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function TabEquipoSubir() {
  const [subiendo, setSubiendo] = useState(false)
  const [resultados, setResultados] = useState<{ nombre: string; data: ResultadoSubida | null; error?: string }[]>([])
  const [arrastrando, setArrastrando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function subirArchivo(file: File) {
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/equipo/subir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, nombre_archivo: file.name }),
      })
      const data = await res.json() as ResultadoSubida
      setResultados(prev => [{ nombre: file.name, data }, ...prev])
    } catch (e) {
      setResultados(prev => [{ nombre: file.name, data: null, error: e instanceof Error ? e.message : String(e) }, ...prev])
    }
  }

  async function subirVarios(files: FileList | File[]) {
    setSubiendo(true)
    try {
      for (const f of Array.from(files)) {
        await subirArchivo(f)
      }
    } finally {
      setSubiendo(false)
    }
  }

  function mensajeResultado(r: { nombre: string; data: ResultadoSubida | null; error?: string }): { texto: string; color: string } {
    if (r.error || !r.data) return { texto: `Error al subir: ${r.error || 'motivo desconocido'}`, color: ROJO }
    const d = r.data
    if (!d.ok) return { texto: `No se pudo procesar: ${d.motivo || d.error || 'motivo desconocido'}`, color: ROJO }
    if (d.destino === 'revision') return { texto: `Enviado a revisión: ${d.motivo || 'no se pudo clasificar con seguridad'}`, color: NAR }
    if (d.multi) return { texto: `Guardadas ${d.nominas_ok ?? 0} de ${d.total_partes ?? 0} nóminas del PDF`, color: VERDE }
    const label = d.destino ? (LABEL_DESTINO[d.destino] || d.destino) : 'documento'
    return { texto: `Guardado correctamente (${label})`, color: VERDE }
  }

  return (
    <div style={{ fontFamily: LEX, color: INK }}>
      <span style={eyebrow(CLARO)}>Equipo · entrada única de documentos</span>
      <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, margin: '10px 0 16px', maxWidth: 640 }}>
        Nóminas, resúmenes de gestoría, RLC y RNT de Seguridad Social. Se clasifican solas; si no se
        puede con seguridad, quedan en "Documentos por revisar" dentro de Equipo.
      </div>

      <input
        ref={inputRef} type="file" accept="application/pdf" multiple style={{ display: 'none' }}
        onChange={e => { const fs = e.target.files; if (fs && fs.length > 0) subirVarios(fs); e.target.value = '' }}
      />
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setArrastrando(true) }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={e => {
          e.preventDefault()
          setArrastrando(false)
          if (e.dataTransfer.files.length > 0) subirVarios(e.dataTransfer.files)
        }}
        style={{
          background: arrastrando ? CLARO : BLANCO, border: `3px dashed ${INK}`, boxShadow: SHADOW,
          padding: '32px 20px', textAlign: 'center', cursor: subiendo ? 'wait' : 'pointer',
        }}
      >
        <Upload size={22} color={GRANATE} />
        <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 13, textTransform: 'uppercase', marginTop: 8 }}>
          {subiendo ? 'Procesando…' : 'Suelta o elige los PDF'}
        </div>
        <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS, marginTop: 4 }}>Admite varios archivos a la vez</div>
      </div>

      {resultados.length > 0 && (
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {resultados.map((r, i) => {
            const { texto, color } = mensajeResultado(r)
            return (
              <div key={i} style={{ background: BLANCO, border: BORDER_CARD, boxShadow: SHADOW, padding: '10px 14px' }}>
                <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 12, marginBottom: 2, wordBreak: 'break-all' }}>{r.nombre}</div>
                <div style={{ fontFamily: LEX, fontSize: 12, color }}>{texto}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
