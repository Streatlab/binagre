import { useRef, useState } from 'react'
import { Upload, FileCheck2 } from 'lucide-react'
import { useTheme, FONT } from '@/styles/tokens'
import * as XLSX from 'xlsx'

export interface ParsedRow {
  fecha: string
  concepto: string
  importe: number
  contraparte?: string
  notas?: string
}

interface Props {
  onFileLoaded: (rows: ParsedRow[]) => void
}

/* ─────────────────────────  HELPERS  ───────────────────────── */

function parseFechaISO(raw: unknown): string {
  if (raw == null) return ''
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    const y = raw.getFullYear()
    const m = String(raw.getMonth() + 1).padStart(2, '0')
    const d = String(raw.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(raw).trim()
  if (!s) return ''
  // DD/MM/YYYY o DD-MM-YYYY
  let m = /^(\d{2})[\/-](\d{2})[\/-](\d{4})$/.exec(s)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  // DD/MM/YY
  m = /^(\d{2})[\/-](\d{2})[\/-](\d{2})$/.exec(s)
  if (m) return `20${m[3]}-${m[2]}-${m[1]}`
  // YYYY-MM-DD (ISO)
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return ''
}

function parseImporte(raw: unknown): number {
  if (typeof raw === 'number') return raw
  if (raw == null) return NaN
  let s = String(raw).trim().replace(/€/g, '').replace(/EUR/gi, '').trim()
  if (!s) return NaN
  // Paréntesis = negativo (formato contable)
  if (/^\(.*\)$/.test(s)) s = '-' + s.slice(1, -1).trim()
  // Formato ES: "1.234,56" o "-1.234,56" o "12,34"
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s) || /^-?\d+,\d+$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const n = parseFloat(s)
  return isNaN(n) ? NaN : n
}

/* ─────────────────────────  XLSX PARSER  ───────────────────────── */

function parseXLSX(wb: XLSX.WorkBook): ParsedRow[] {
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false })

  // Localizar fila de cabecera (escanear hasta fila 20). En BBVA está en fila 5 (idx 4).
  let headerIdx = -1
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const cells = (rows[i] || []).map(c => String(c ?? '').trim().toLowerCase())
    const tieneFecha    = cells.some(c => c === 'fecha' || c === 'f.valor' || c === 'f. valor')
    const tieneConcepto = cells.some(c => c === 'concepto' || c.includes('concepto') || c.includes('descrip'))
    const tieneImporte  = cells.some(c => c === 'importe' || c.includes('importe') || c.includes('amount'))
    if (tieneFecha && tieneConcepto && tieneImporte) { headerIdx = i; break }
  }
  if (headerIdx === -1) return []

  const headers = (rows[headerIdx] || []).map(c => String(c ?? '').trim().toLowerCase())
  const find = (...names: string[]) => headers.findIndex(h => names.some(n => h === n || h.includes(n)))

  const idxFecha        = find('fecha')
  const idxFvalor       = find('f.valor', 'f. valor')
  const idxConcepto     = find('concepto', 'descripcion', 'descripción')
  const idxMovimiento   = find('movimiento')
  const idxImporte      = find('importe', 'amount')
  const idxObserv       = find('observaciones', 'observ')
  const idxBenef        = find('beneficiario', 'contraparte', 'origen')

  const out: ParsedRow[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || []
    const fechaRaw =
      idxFecha   >= 0 && row[idxFecha]   != null && row[idxFecha]   !== '' ? row[idxFecha]   :
      idxFvalor  >= 0 && row[idxFvalor]  != null && row[idxFvalor]  !== '' ? row[idxFvalor]  :
      null
    const importeRaw = idxImporte >= 0 ? row[idxImporte] : null
    if (fechaRaw == null || fechaRaw === '' || importeRaw == null || importeRaw === '') continue

    const fechaISO = parseFechaISO(fechaRaw)
    if (!fechaISO) continue
    const importe = parseImporte(importeRaw)
    if (isNaN(importe)) continue

    const concepto    = String(idxConcepto   >= 0 ? row[idxConcepto]   ?? '' : '').trim()
    const movimiento  = String(idxMovimiento >= 0 ? row[idxMovimiento] ?? '' : '').trim()
    const observ      = String(idxObserv     >= 0 ? row[idxObserv]     ?? '' : '').trim()
    const benef       = String(idxBenef      >= 0 ? row[idxBenef]      ?? '' : '').trim()

    out.push({
      fecha: fechaISO,
      concepto: concepto || movimiento || '(sin concepto)',
      importe,
      contraparte: benef || undefined,
      notas: observ || undefined,
    })
  }
  return out
}

/* ─────────────────────────  CSV PARSER  ───────────────────────── */

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
      fecha: parseFechaISO(cells[idxFecha]?.trim() ?? ''),
      concepto: cells[idxConcepto]?.trim() ?? '',
      importe: parseImporte(cells[idxImporte] ?? '0'),
      contraparte: idxContra >= 0 ? cells[idxContra]?.trim() : undefined,
    }
  }).filter(r => r.fecha && r.concepto && !isNaN(r.importe))
}

/* ─────────────────────────  COMPONENT  ───────────────────────── */

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
        const rows = parseXLSX(wb)
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
              Arrastra CSV / XLSX (BBVA, genérico) o haz click
            </span>
          </div>
        </>
      )}
    </div>
  )
}
