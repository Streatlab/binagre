/**
 * ModalRevisionEquipo — cola de revisión de documentos de personal que el buzón
 * único EQUIPO (Papeleo) no pudo encaminar solo con seguridad. Rubén reasigna el
 * tipo correcto (y el empleado si aplica) y el backend lo reprocesa contra la
 * copia de respaldo en Storage. Si esa copia no existe (documentos anteriores al
 * arreglo), se avisa de que hay que volver a subirlo por Papeleo → EQUIPO en vez
 * de fallar sin explicación.
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { OSW, LEX, INK, CREMA, CLARO, SHADOW, BORDER, BORDER_CARD, GRANATE, AMA, VERDE, ROJO, AZUL, GRIS } from '@/styles/neobrutal'

interface FilaRevision {
  id: string
  nombre_archivo: string
  tipo_detectado: string
  confianza: number | null
  motivo: string | null
  mes: number | null
  anio: number | null
  empleado_nombre: string | null
  drive_url: string | null
  storage_path: string | null
  created_at: string
}

interface Empleado { id: string; nombre: string }

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const LABEL_TIPO: Record<string, string> = {
  nomina: 'Nómina',
  resumen_nominas: 'Resumen de nóminas',
  rlc: 'RLC (Seguridad Social)',
  rnt: 'RNT (Seguridad Social)',
  desconocido: 'Desconocido',
}

export default function ModalRevisionEquipo({ onClose, onResuelto }: { onClose: () => void; onResuelto?: () => void }) {
  const [filas, setFilas] = useState<FilaRevision[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [form, setForm] = useState<Record<string, { tipo: string; empleadoId: string; mes: number | ''; anio: number | '' }>>({})

  async function cargar() {
    setLoading(true)
    const [r, e] = await Promise.all([
      supabase.from('equipo_docs_revision').select('*').eq('estado', 'pendiente').order('created_at', { ascending: false }),
      supabase.from('empleados').select('id, nombre').order('nombre'),
    ])
    const data = (r.data ?? []) as FilaRevision[]
    setFilas(data)
    setEmpleados((e.data ?? []) as Empleado[])
    setForm(prev => {
      const next = { ...prev }
      for (const f of data) {
        if (!next[f.id]) {
          next[f.id] = {
            tipo: f.tipo_detectado === 'desconocido' ? 'nomina' : f.tipo_detectado,
            empleadoId: '',
            mes: f.mes ?? '',
            anio: f.anio ?? '',
          }
        }
      }
      return next
    })
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  function setCampo(id: string, campo: keyof typeof form[string], valor: string | number) {
    setForm(prev => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }))
  }

  async function reprocesar(id: string) {
    const f = form[id]
    if (!f) return
    setProcesando(id)
    setErrores(prev => { const n = { ...prev }; delete n[id]; return n })
    try {
      const body: Record<string, unknown> = { tipo_correcto: f.tipo }
      if (f.tipo === 'nomina') {
        if (!f.empleadoId) { setErrores(prev => ({ ...prev, [id]: 'Elige el empleado.' })); setProcesando(null); return }
        body.empleado_id = f.empleadoId
      }
      if (f.mes !== '') body.mes = Number(f.mes)
      if (f.anio !== '') body.anio = Number(f.anio)

      const res = await fetch(`/api/equipo/revision/${id}/resolver`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      // La función puede cortarse (timeout) y devolver cuerpo vacío: leemos texto
      // y parseamos a mano para dar un aviso entendible en vez de reventar con
      // "Unexpected end of JSON input".
      const crudo = await res.text()
      let j: Record<string, unknown>
      try {
        j = JSON.parse(crudo) as Record<string, unknown>
      } catch {
        const pista = crudo.trim() === '' || res.status === 504
          ? 'El documento tardó demasiado en procesarse. Vuelve a intentarlo.'
          : `Respuesta inesperada del servidor (${res.status}).`
        setErrores(prev => ({ ...prev, [id]: pista }))
        return
      }
      if (!j.ok) {
        setErrores(prev => ({ ...prev, [id]: String(j.error || j.motivo_extraccion || 'No se pudo reprocesar') }))
        return
      }
      setFilas(prev => prev.filter(x => x.id !== id))
      onResuelto?.()
    } catch (e) {
      setErrores(prev => ({ ...prev, [id]: e instanceof Error ? e.message : String(e) }))
    } finally {
      setProcesando(null)
    }
  }

  async function descartar(id: string) {
    setProcesando(id)
    try {
      await fetch(`/api/equipo/revision/${id}/resolver`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo_correcto: 'descartar' }),
      })
      setFilas(prev => prev.filter(x => x.id !== id))
    } finally {
      setProcesando(null)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 130, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: CREMA, border: BORDER, boxShadow: '8px 8px 0 rgba(0,0,0,0.25)', padding: 24, width: '100%', maxWidth: 720, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontFamily: OSW, fontSize: 15, letterSpacing: '2px', textTransform: 'uppercase', color: GRANATE }}>Documentos por revisar</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: GRIS, fontFamily: LEX, fontSize: 13, cursor: 'pointer' }}>Cerrar</button>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: GRIS, fontFamily: LEX }}>Cargando…</div>
        ) : filas.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: GRIS, fontFamily: LEX }}>Nada pendiente de revisar.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filas.map(f => {
              const fm = form[f.id] || { tipo: 'nomina', empleadoId: '', mes: '' as const, anio: '' as const }
              const sinArchivo = !f.storage_path
              return (
                <div key={f.id} style={{ background: '#fff', border: BORDER_CARD, boxShadow: SHADOW, padding: 14 }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 13, color: INK, flex: 1, minWidth: 160, wordBreak: 'break-all' }}>{f.nombre_archivo}</span>
                    <span style={{ fontFamily: OSW, fontSize: 9, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', border: `2px solid ${INK}`, padding: '2px 7px', background: AMA, color: INK }}>
                      {LABEL_TIPO[f.tipo_detectado] || f.tipo_detectado}
                    </span>
                    {f.drive_url && (
                      <a href={f.drive_url} target="_blank" rel="noreferrer" style={{ color: AZUL, fontFamily: LEX, fontSize: 11 }}>Ver documento</a>
                    )}
                  </div>
                  {f.motivo && <div style={{ fontFamily: LEX, fontSize: 11.5, color: GRIS, marginBottom: 10 }}>{f.motivo}</div>}

                  {sinArchivo ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ fontFamily: LEX, fontSize: 11.5, color: ROJO, flex: 1, minWidth: 200 }}>
                        El archivo original ya no está guardado. Vuelve a subirlo por Papeleo → EQUIPO.
                      </div>
                      <button
                        disabled={procesando === f.id}
                        onClick={() => descartar(f.id)}
                        style={{ ...btnMini, background: '#fff', color: ROJO, borderColor: ROJO }}
                      >
                        Descartar
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <select value={fm.tipo} onChange={e => setCampo(f.id, 'tipo', e.target.value)} style={selectMini}>
                        <option value="nomina">Nómina individual</option>
                        <option value="resumen_nominas">Resumen de nóminas</option>
                        <option value="rlc">RLC Seguridad Social</option>
                        <option value="rnt">RNT Seguridad Social</option>
                      </select>

                      {fm.tipo === 'nomina' && (
                        <select value={fm.empleadoId} onChange={e => setCampo(f.id, 'empleadoId', e.target.value)} style={selectMini}>
                          <option value="">{f.empleado_nombre ? `Detectado: ${f.empleado_nombre}` : 'Elige empleado…'}</option>
                          {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                        </select>
                      )}

                      <select value={fm.mes} onChange={e => setCampo(f.id, 'mes', e.target.value ? Number(e.target.value) : '')} style={selectMini}>
                        <option value="">Mes…</option>
                        {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                      </select>
                      <input
                        type="number" placeholder="Año" value={fm.anio}
                        onChange={e => setCampo(f.id, 'anio', e.target.value ? Number(e.target.value) : '')}
                        style={{ ...selectMini, width: 78 }}
                      />

                      <button
                        disabled={procesando === f.id}
                        onClick={() => reprocesar(f.id)}
                        style={{ ...btnMini, background: VERDE, color: '#fff', cursor: procesando === f.id ? 'wait' : 'pointer' }}
                      >
                        {procesando === f.id ? 'Procesando…' : 'Reprocesar'}
                      </button>
                      <button
                        disabled={procesando === f.id}
                        onClick={() => descartar(f.id)}
                        style={{ ...btnMini, background: '#fff', color: ROJO, borderColor: ROJO }}
                      >
                        Descartar
                      </button>
                    </div>
                  )}
                  {errores[f.id] && <div style={{ color: ROJO, fontFamily: LEX, fontSize: 11.5, marginTop: 6 }}>{errores[f.id]}</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const selectMini: React.CSSProperties = { background: CLARO, border: `2px solid ${INK}`, color: INK, padding: '6px 9px', fontFamily: LEX, fontSize: 12, outline: 'none' }
const btnMini: React.CSSProperties = { fontFamily: OSW, fontWeight: 600, fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', border: `2px solid ${INK}`, padding: '7px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }
