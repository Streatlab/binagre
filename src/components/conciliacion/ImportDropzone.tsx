import { useRef, useState } from 'react'
import { Upload, FileCheck2 } from 'lucide-react'
import { useTheme, FONT } from '@/styles/tokens'
import * as XLSX from 'xlsx'

export interface ParsedRow {
  fecha: string
  concepto: string
  importe: number
  contraparte?: string
}

interface Props {
  onFileLoaded: (rows: ParsedRow[]) => void
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const header = lines[0].split(/[;,\t]/).map(h => h.trim().toLowerCase())
  const idxFecha = header.findIndex(h => h.includes('fecha'))
  const idxConcepto = header.findIndex(h => h.includes('concepto') || h.includes('descrip'))
  const idxImporte = header.findIndex(h => h.includes('importe') || h.includes('amount'))
  const idxContra = header.findIndex(h => h.includes('contraparte') || h.includes('benefic') || h.includes('origen'))
  return lines.slice(1).map(line => {
    const cells = line.split(/[;,\t]/)
    return {
      fecha: cells[idxFecha]?.trim() ?? '',
      concepto: cells[idxConcepto]?.trim() ?? '',
      importe: parseFloat((cells[idxImporte] ?? '0').replace(',', '.').replace('€', '').trim()) || 0,
      contraparte: idxContra >= 0 ? cells[idxContra]?.trim() : undefined,
    }
  }).filter(r => r.fecha && r.concepto)
}

export default function ImportDropzone({ onFileLoaded }: Props) {
  const { T } = useTheme()
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    setFileName(file.name)
    const reader = new FileReader()
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json: any[] = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' })
        const rows: ParsedRow[] = json.map(r => {
          const fecha = String(r['fecha'] ?? r['Fecha'] ?? r['FECHA'] ?? r['date'] ?? '').trim()
          const concepto = String(r['concepto'] ?? r['Concepto'] ?? r['CONCEPTO'] ?? r['descripcion'] ?? r['Descripción'] ?? '').trim()
          const importeRaw = String(r['importe'] ?? r['Importe'] ?? r['IMPORTE'] ?? r['amount'] ?? '0').replace(/\./g, '').replace(',', '.').replace('€', '').trim()
          const contraparte = String(r['contraparte'] ?? r['Contraparte'] ?? r['beneficiario'] ?? '').trim()
          return {
            fecha: fecha.length >= 10 ? fecha.slice(0, 10) : fecha,
            concepto,
            importe: parseFloat(importeRaw) || 0,
            contraparte: contraparte || undefined,
          }
        }).filter(r => r.fecha && r.concepto)
        onFileLoaded(rows)
      }
      reader.readAsArrayBuffer(file)
    } else {
      reader.onload = (e) => {
        const text = String(e.target?.result ?? '')
        const rows = parseCSV(text)
        onFileLoaded(rows)
      }
      reader.readAsText(file, 'UTF-8')
    }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const f = e.dataTransfer.files[0]
        if (f) handleFile(f)
      }}
      onClick={() => inputRef.current?.click()}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 18px',
        borderRadius: 10,
        border: `2px dashed ${dragging ? '#B01D23' : T.brd}`,
        backgroundColor: dragging ? T.card : 'transparent',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        minWidth: 280,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.tsv"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
      />
      {fileName ? (
        <>
          <FileCheck2 size={20} color={T.accent} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontFamily: FONT.heading, fontSize: 11, color: T.mut, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Archivo cargado
            </span>
            <span style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri }}>{fileName}</span>
          </div>
        </>
      ) : (
        <>
          <Upload size={20} color="#B01D23" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontFamily: FONT.heading, fontSize: 12, color: '#B01D23', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>
              Importar extracto
            </span>
            <span style={{ fontFamily: FONT.body, fontSize: 11, color: T.mut }}>
              Arrastra un CSV o haz click
            </span>
          </div>
        </>
      )}
    </div>
  )
}
