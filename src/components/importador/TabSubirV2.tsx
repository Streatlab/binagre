/**
 * TabSubirV2 — FASE C
 * Dropzone multi-archivo con subtabs Facturas / Extractos bancarios,
 * barra de progreso en tiempo real y tabla de proceso.
 */

import { useRef, useState, useCallback } from 'react'
import SubTabsInverso from '@/components/ui/SubTabsInverso'
import { CARDS } from '@/components/panel/resumen/tokens'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toastStore'

/* ─── tipos ─────────────────────────────────────────────────────────────────── */

type SubTab = 'facturas' | 'extractos'

type EstadoFila =
  | { tag: 'procesando'; pct: number }
  | { tag: 'asociada' }
  | { tag: 'revision' }
  | { tag: 'duplicada' }

interface FilaProceso {
  id: string
  nombre: string
  tipoDetectado: string
  contraparte: string
  importe: string
  categoria: string
  estado: EstadoFila
}

const EXTENSIONES_OK = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.csv', '.xlsx', '.xls', '.doc', '.docx'])

function extOk(nombre: string): boolean {
  const idx = nombre.lastIndexOf('.')
  if (idx === -1) return false
  return EXTENSIONES_OK.has(nombre.slice(idx).toLowerCase())
}

/* ─── helpers UI ─────────────────────────────────────────────────────────────── */

function PillTag({ ok, total }: { ok: number; total: number }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: '#ffffff',
      border: '0.5px solid #d0c8bc',
      borderRadius: 99,
      padding: '3px 10px',
      fontFamily: 'Lexend',
      fontSize: 12,
      fontWeight: 500,
      color: '#3a4050',
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: '#FF4757',
        display: 'inline-block',
        animation: 'pulse-dot 1.2s ease-in-out infinite',
      }} />
      {ok}/{total} archivos
    </span>
  )
}

function BarraProgreso({ ok, err, total }: { ok: number; err: number; total: number }) {
  const pctOk = total > 0 ? (ok / total) * 100 : 0
  const pctErr = total > 0 ? (err / total) * 100 : 0
  return (
    <div style={{
      display: 'flex',
      width: 120,
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
      background: '#ebe8e2',
    }}>
      <div style={{ width: `${pctOk}%`, background: '#1D9E75', transition: 'width 300ms' }} />
      <div style={{ width: `${pctErr}%`, background: '#E24B4A', transition: 'width 300ms' }} />
    </div>
  )
}

function BadgeEstado({ estado }: { estado: EstadoFila }) {
  if (estado.tag === 'procesando') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 60,
          height: 5,
          borderRadius: 3,
          background: '#ebe8e2',
          overflow: 'hidden',
        }}>
          <div style={{ width: `${estado.pct}%`, height: '100%', background: '#3a4050', transition: 'width 300ms' }} />
        </div>
        <span style={{ fontFamily: 'Oswald', fontSize: 11, fontWeight: 500, color: '#3a4050' }}>
          {estado.pct}%
        </span>
      </div>
    )
  }
  if (estado.tag === 'asociada') {
    return (
      <span style={{
        background: '#1D9E7515',
        color: '#1D9E75',
        fontFamily: 'Lexend',
        fontSize: 10,
        fontWeight: 500,
        padding: '2px 8px',
        borderRadius: 9,
      }}>
        ASOCIADA · DRIVE
      </span>
    )
  }
  if (estado.tag === 'revision') {
    return (
      <span style={{
        background: '#E24B4A',
        color: '#ffffff',
        fontFamily: 'Lexend',
        fontSize: 10,
        fontWeight: 500,
        padding: '2px 8px',
        borderRadius: 9,
      }}>
        ! REVISIÓN MANUAL
      </span>
    )
  }
  // duplicada
  return (
    <span style={{
      background: '#f5a623',
      color: '#ffffff',
      fontFamily: 'Lexend',
      fontSize: 10,
      fontWeight: 500,
      padding: '2px 8px',
      borderRadius: 9,
    }}>
      DUPLICADA
    </span>
  )
}

/* ─── componente principal ──────────────────────────────────────────────────── */

const SUBTAB_ITEMS = [
  { id: 'facturas', label: 'Facturas' },
  { id: 'extractos', label: 'Extractos bancarios' },
]

const NIF_REGEX = /[A-Z]?\d{8}[A-Z]?/

export default function TabSubirV2() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [subTab, setSubTab] = useState<SubTab>('facturas')
  const [dragOver, setDragOver] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [filas, setFilas] = useState<FilaProceso[]>([])
  const [stats, setStats] = useState({ ok: 0, err: 0, dup: 0, total: 0 })
  const canceladoRef = useRef(false)

  /* ── actualizar fila ─────────────────────────────────────────────────────── */
  const updateFila = useCallback((id: string, patch: Partial<FilaProceso>) => {
    setFilas(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f))
  }, [])

  /* ── procesar un archivo ─────────────────────────────────────────────────── */
  async function procesarArchivo(file: File, id: string) {
    // Animación procesando 0→80%
    for (let pct = 0; pct <= 80; pct += 20) {
      if (canceladoRef.current) return
      updateFila(id, { estado: { tag: 'procesando', pct } })
      await new Promise(r => setTimeout(r, 200))
    }

    let estadoFinal: EstadoFila
    let tipoDetectado = 'Desconocido'
    let contraparte = '—'
    let importe = '—'
    let categoria = '—'
    let estadoLog: string

    if (subTab === 'facturas') {
      // Detección NIF en nombre de archivo
      const matchNIF = NIF_REGEX.exec(file.name.toUpperCase())
      if (matchNIF) {
        tipoDetectado = 'Factura proveedor'
        contraparte = matchNIF[0]
        estadoFinal = { tag: 'asociada' }
        estadoLog = 'procesado'
      } else {
        tipoDetectado = 'Factura (sin NIF)'
        estadoFinal = { tag: 'revision' }
        estadoLog = 'revision_manual'
      }
    } else {
      // Extracto bancario — simular parseo
      tipoDetectado = 'Extracto bancario'
      estadoFinal = { tag: 'asociada' }
      estadoLog = 'procesado'
    }

    // Completar a 100%
    updateFila(id, { estado: { tag: 'procesando', pct: 100 } })
    await new Promise(r => setTimeout(r, 150))

    // Registrar en imports_log
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await supabase.from('imports_log').insert({
        archivo_nombre: file.name,
        archivo_url: null,
        tipo_detectado: tipoDetectado,
        estado: estadoLog,
        destino_modulo: subTab === 'facturas' ? 'facturas' : 'movimientos_bancarios',
        destino_id: null,
        user_id: session?.user?.id ?? null,
        detalle: { contraparte, importe, categoria },
      })
    } catch {
      // silent — no bloquear UI
    }

    updateFila(id, {
      tipoDetectado,
      contraparte,
      importe,
      categoria,
      estado: estadoFinal,
    })

    return estadoFinal.tag
  }

  /* ── manejar archivos soltados ───────────────────────────────────────────── */
  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const validos = Array.from(fileList).filter(f => extOk(f.name))
    if (validos.length === 0) return

    canceladoRef.current = false

    // Crear filas iniciales
    const nuevasFilas: FilaProceso[] = validos.map(f => ({
      id: crypto.randomUUID(),
      nombre: f.name,
      tipoDetectado: '—',
      contraparte: '—',
      importe: '—',
      categoria: '—',
      estado: { tag: 'procesando', pct: 0 },
    }))
    setFilas(nuevasFilas)
    setStats({ ok: 0, err: 0, dup: 0, total: validos.length })
    setProcesando(true)

    // Procesar en paralelo max 3
    let okCount = 0
    let errCount = 0
    const BATCH = 3
    for (let i = 0; i < validos.length; i += BATCH) {
      if (canceladoRef.current) break
      const batch = validos.slice(i, i + BATCH)
      const resultados = await Promise.all(
        batch.map((f, j) => procesarArchivo(f, nuevasFilas[i + j].id))
      )
      for (const r of resultados) {
        if (r === 'asociada') okCount++
        else errCount++
      }
      setStats(s => ({ ...s, ok: okCount, err: errCount }))
    }

    setProcesando(false)

    toast.success(`${okCount}/${validos.length} archivos procesados. ${errCount} en revisión.`)

    // Limpiar tabla tras 5s
    setTimeout(() => {
      setFilas([])
      setStats({ ok: 0, err: 0, dup: 0, total: 0 })
    }, 5000)

    if (inputRef.current) inputRef.current.value = ''
  }

  const pct = stats.total > 0 ? Math.round(((stats.ok + stats.err) / stats.total) * 100) : 0

  return (
    <div>
      {/* C.3 Subtabs */}
      <div style={{ marginBottom: 14 }}>
        <SubTabsInverso
          tabs={SUBTAB_ITEMS}
          activeId={subTab}
          onChange={(id) => setSubTab(id as SubTab)}
          prefijoLbl="TIPO"
        />
      </div>

      {/* C.4 Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => !procesando && inputRef.current?.click()}
        style={{
          border: '2px dashed',
          borderColor: dragOver ? '#FF4757' : '#d0c8bc',
          borderRadius: 14,
          padding: '28px 20px',
          textAlign: 'center',
          background: dragOver ? '#ffffff' : '#fafaf7',
          transition: 'all 200ms',
          cursor: 'pointer',
          marginBottom: 14,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls,.doc,.docx"
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div style={{
          fontFamily: 'Oswald',
          fontSize: 32,
          lineHeight: 1,
          color: '#d0c8bc',
        }}>
          ⬆
        </div>
        <div style={{
          fontFamily: 'Lexend',
          fontSize: 14,
          fontWeight: 500,
          color: '#3a4050',
          marginTop: 8,
        }}>
          Arrastra archivos o pulsa para seleccionar
        </div>
      </div>

      {/* C.5 Bloque progreso */}
      {procesando && stats.total > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 14,
        }}>
          <span style={{ fontFamily: 'Lexend', fontSize: 13, color: '#7a8090' }}>
            Procesando:
          </span>
          <PillTag ok={stats.ok + stats.err} total={stats.total} />
          <BarraProgreso ok={stats.ok} err={stats.err} total={stats.total} />
          <span style={{ fontFamily: 'Oswald', fontSize: 13, fontWeight: 600, color: '#3a4050' }}>
            {pct}%
          </span>
          <span style={{ fontFamily: 'Lexend', fontSize: 12, fontWeight: 500, color: '#1D9E75' }}>
            {stats.ok} OK
          </span>
          <span style={{ fontFamily: 'Lexend', fontSize: 12, color: '#E24B4A' }}>
            {stats.err} sin NIF
          </span>
          <span style={{ fontFamily: 'Lexend', fontSize: 12, color: '#7a8090' }}>
            {stats.dup} duplicadas
          </span>
        </div>
      )}

      {/* C.6 Tabla proceso */}
      {filas.length > 0 && (
        <div style={{ ...CARDS.big, padding: 0, overflow: 'hidden', marginBottom: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#ebe8e2' }}>
                {['Archivo', 'Tipo detectado', 'Contraparte', 'Importe', 'Categoría', 'Estado'].map(col => (
                  <th key={col} style={{
                    fontFamily: 'Oswald',
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: '0.5px',
                    color: '#7a8090',
                    textTransform: 'uppercase',
                    padding: '10px 14px',
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.id} style={{ borderBottom: '0.5px solid #ebe8e2' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'Lexend', fontSize: 12, color: '#3a4050', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {fila.nombre}
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'Lexend', fontSize: 12, color: '#3a4050' }}>
                    {fila.tipoDetectado}
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'Lexend', fontSize: 12, color: '#3a4050' }}>
                    {fila.contraparte}
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'Lexend', fontSize: 12, color: '#3a4050' }}>
                    {fila.importe}
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'Lexend', fontSize: 12, color: '#3a4050' }}>
                    {fila.categoria}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <BadgeEstado estado={fila.estado} />
                  </td>
                </tr>
              ))}
              {/* Fila cola */}
              {procesando && (
                <tr>
                  <td colSpan={6} style={{
                    padding: '8px 14px',
                    background: '#fafaf7',
                    fontFamily: 'Lexend',
                    fontSize: 12,
                    color: '#7a8090',
                    fontStyle: 'italic',
                  }}>
                    + {Math.max(0, stats.total - filas.length)} archivos en cola
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {/* Footer tabla */}
          <div style={{
            padding: '14px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '0.5px solid #d0c8bc',
            background: '#fafaf7',
          }}>
            <span style={{ fontFamily: 'Lexend', fontSize: 12, color: '#7a8090' }}>
              Última tanda · resumen disponible 5s
            </span>
            <button
              onClick={() => { canceladoRef.current = true; setProcesando(false) }}
              style={{
                padding: '5px 12px',
                border: '0.5px solid #d0c8bc',
                background: '#ffffff',
                borderRadius: 6,
                fontFamily: 'Lexend',
                fontSize: 12,
                color: '#3a4050',
                cursor: 'pointer',
              }}
            >
              Cancelar proceso
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
