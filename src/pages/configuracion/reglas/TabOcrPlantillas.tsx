import { BLANCO, GRANATE, GRIS, VERDE } from '@/styles/neobrutal'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { Plus, Trash2, Check, X, Pencil } from 'lucide-react'

// Pestaña OCR / Plantillas: define cómo el lector OCR extrae datos de las facturas
// de cada proveedor a partir de su NIF. Estas plantillas viven en la tabla
// reglas_conciliacion (campos patron_nif + plantilla_*) y son la ÚNICA fuente de
// verdad: el procesador OCR lee de aquí. Editables 100% desde esta pantalla.

interface Plantilla {
  id: string
  patron_nif: string | null
  razon_social: string | null
  set_proveedor: string | null
  plantilla_total_label: string | null
  plantilla_num_label: string | null
  plantilla_fecha_formato: string | null
  activa: boolean
}

const FORMATOS_FECHA = [
  { v: 'dmy', l: 'Día/Mes/Año (31/12/2025)' },
  { v: 'mdy', l: 'Mes/Día/Año (12/31/2025)' },
  { v: 'ymd', l: 'Año-Mes-Día (2025-12-31)' },
]

// Tras crear/editar una plantilla, dispara el barrido de re-conciliación para que
// las facturas pendientes de este NIF se reprocesen/concilien (autopropaga).
// Best-effort: no bloquea la UI si falla.
function reconciliarPendientes() {
  fetch('/api/facturas?action=reconciliar-pendientes').catch(() => {})
}

export default function TabOcrPlantillas() {
  const { T } = useTheme()
  const [filas, setFilas] = useState<Plantilla[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  // alta
  const [nNif, setNNif] = useState('')
  const [nRazon, setNRazon] = useState('')
  const [nTotal, setNTotal] = useState('')
  const [nNum, setNNum] = useState('')
  const [nFecha, setNFecha] = useState('dmy')

  // edición
  const [editId, setEditId] = useState<string | null>(null)
  const [eNif, setENif] = useState('')
  const [eRazon, setERazon] = useState('')
  const [eTotal, setETotal] = useState('')
  const [eNum, setENum] = useState('')
  const [eFecha, setEFecha] = useState('dmy')

  useEffect(() => { cargar() }, [])
  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('reglas_conciliacion')
      .select('id,patron_nif,razon_social,set_proveedor,plantilla_total_label,plantilla_num_label,plantilla_fecha_formato,activa')
      .not('patron_nif', 'is', null)
      .order('razon_social')
    setFilas((data as Plantilla[]) ?? [])
    setLoading(false)
  }

  async function crear() {
    if (!nNif.trim() || !nRazon.trim()) return
    await supabase.from('reglas_conciliacion').insert({
      patron_nif: nNif.trim().toUpperCase(),
      razon_social: nRazon.trim(),
      plantilla_total_label: nTotal.trim() || null,
      plantilla_num_label: nNum.trim() || null,
      plantilla_fecha_formato: nFecha,
      activa: true,
      creada_por_usuario: true,
    })
    setNNif(''); setNRazon(''); setNTotal(''); setNNum(''); setNFecha('dmy'); cargar()
    reconciliarPendientes()
  }
  async function guardarEdit(id: string) {
    await supabase.from('reglas_conciliacion').update({
      patron_nif: eNif.trim().toUpperCase() || null,
      razon_social: eRazon.trim() || null,
      plantilla_total_label: eTotal.trim() || null,
      plantilla_num_label: eNum.trim() || null,
      plantilla_fecha_formato: eFecha,
    }).eq('id', id)
    setEditId(null); cargar()
    reconciliarPendientes()
  }
  async function toggleActiva(id: string, activa: boolean) {
    await supabase.from('reglas_conciliacion').update({ activa: !activa }).eq('id', id)
    cargar()
    reconciliarPendientes()
  }
  async function borrar(id: string) {
    if (!confirm('¿Eliminar esta plantilla? El OCR dejará de leer automáticamente las facturas de este proveedor.')) return
    await supabase.from('reglas_conciliacion').delete().eq('id', id)
    cargar()
  }

  const visibles = filas.filter(r => !busca ||
    (r.razon_social ?? '').toLowerCase().includes(busca.toLowerCase()) ||
    (r.patron_nif ?? '').toLowerCase().includes(busca.toLowerCase()) ||
    (r.set_proveedor ?? '').toLowerCase().includes(busca.toLowerCase()))

  const fechaLabel = (v: string | null) => FORMATOS_FECHA.find(f => f.v === v)?.l.split(' ')[0] ?? '—'

  const inp: React.CSSProperties = { background: T.inp, border: `1px solid ${T.brd}`, borderRadius: 8, color: T.pri, fontFamily: FONT.body, fontSize: 13, padding: '8px 12px', outline: 'none' }
  const sel: React.CSSProperties = { ...inp, cursor: 'pointer' }
  const btnP: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: GRANATE, color: BLANCO, border: 'none', borderRadius: 8, padding: '8px 14px', fontFamily: FONT.body, fontSize: 13, cursor: 'pointer' }
  const ico: React.CSSProperties = { background: 'transparent', border: `0.5px solid ${T.brd}`, borderRadius: 6, color: T.sec, cursor: 'pointer', padding: 5, display: 'flex' }
  const th: React.CSSProperties = { textAlign: 'left', padding: '10px 14px', fontSize: 11, letterSpacing: 1, color: T.mut, textTransform: 'uppercase' }

  if (loading) return <div style={{ padding: 24, color: T.mut, fontFamily: FONT.body }}>Cargando plantillas…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>
        Cada plantilla le dice al lector OCR cómo extraer el total, el número y la fecha de las facturas de un proveedor, identificándolo por su NIF. El procesamiento de facturas lee de aquí: si un proveedor no tiene plantilla, sus facturas quedan «pendientes de plantilla». Al guardar una plantilla, las facturas pendientes de ese NIF se reconcilian solas. {filas.length} plantillas activas.
      </div>

      <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontFamily: FONT.body, fontSize: 12, fontWeight: 600, color: T.sec }}>Nueva plantilla</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={nNif} onChange={e => setNNif(e.target.value)} placeholder="NIF (ej: B12345678)" style={{ ...inp, flex: 1, minWidth: 130 }} />
          <input value={nRazon} onChange={e => setNRazon(e.target.value)} placeholder="Nombre del proveedor" style={{ ...inp, flex: 1.4, minWidth: 160 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={nTotal} onChange={e => setNTotal(e.target.value)} placeholder="Etiqueta del total (ej: Total)" style={{ ...inp, flex: 1, minWidth: 130 }} />
          <input value={nNum} onChange={e => setNNum(e.target.value)} placeholder="Etiqueta del nº factura (ej: Factura)" style={{ ...inp, flex: 1, minWidth: 130 }} />
          <select value={nFecha} onChange={e => setNFecha(e.target.value)} style={{ ...sel, flex: 1, minWidth: 150 }}>
            {FORMATOS_FECHA.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
          </select>
          <button onClick={crear} style={btnP}><Plus size={16} /> Añadir</button>
        </div>
      </div>

      <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nombre o NIF…" style={{ ...inp, maxWidth: 300 }} />

      <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 12, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT.body, fontSize: 14 }}>
          <thead>
            <tr style={{ background: T.group }}>
              <th style={th}>Proveedor</th>
              <th style={th}>NIF</th>
              <th style={th}>Etiqueta total</th>
              <th style={th}>Etiqueta nº</th>
              <th style={th}>Fecha</th>
              <th style={{ width: 70, textAlign: 'center', padding: '10px 8px', fontSize: 11, color: T.mut, textTransform: 'uppercase' }}>Activa</th>
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(r => (
              <tr key={r.id} style={{ borderTop: `0.5px solid ${T.brd}`, opacity: r.activa ? 1 : 0.5 }}>
                {editId === r.id ? (
                  <>
                    <td style={{ padding: '8px 14px' }}><input value={eRazon} onChange={e => setERazon(e.target.value)} style={{ ...inp, width: '100%' }} /></td>
                    <td style={{ padding: '8px 14px' }}><input value={eNif} onChange={e => setENif(e.target.value)} style={{ ...inp, width: '100%' }} /></td>
                    <td style={{ padding: '8px 14px' }}><input value={eTotal} onChange={e => setETotal(e.target.value)} style={{ ...inp, width: '100%' }} /></td>
                    <td style={{ padding: '8px 14px' }}><input value={eNum} onChange={e => setENum(e.target.value)} style={{ ...inp, width: '100%' }} /></td>
                    <td style={{ padding: '8px 14px' }}><select value={eFecha} onChange={e => setEFecha(e.target.value)} style={{ ...sel, width: '100%' }}>{FORMATOS_FECHA.map(f => <option key={f.v} value={f.v}>{f.l.split(' ')[0]}</option>)}</select></td>
                    <td></td>
                    <td style={{ padding: '8px 14px' }}><div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => guardarEdit(r.id)} style={ico}><Check size={14} /></button>
                      <button onClick={() => setEditId(null)} style={ico}><X size={14} /></button>
                    </div></td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: '10px 14px', color: T.pri, fontWeight: 500 }}>{r.razon_social ?? '—'}{r.set_proveedor ? <span style={{ color: T.mut, fontWeight: 400 }}> · {r.set_proveedor}</span> : null}</td>
                    <td style={{ padding: '10px 14px', color: T.sec, fontFamily: 'monospace', fontSize: 12 }}>{r.patron_nif ?? '—'}</td>
                    <td style={{ padding: '10px 14px', color: T.sec }}>{r.plantilla_total_label ?? '—'}</td>
                    <td style={{ padding: '10px 14px', color: T.sec }}>{r.plantilla_num_label ?? '—'}</td>
                    <td style={{ padding: '10px 14px', color: T.sec }}>{fechaLabel(r.plantilla_fecha_formato)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => toggleActiva(r.id, r.activa)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                        <span style={{ display: 'inline-block', width: 11, height: 11, borderRadius: '50%', background: r.activa ? VERDE : GRIS }} />
                      </button>
                    </td>
                    <td style={{ padding: '10px 14px' }}><div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => { setEditId(r.id); setENif(r.patron_nif ?? ''); setERazon(r.razon_social ?? ''); setETotal(r.plantilla_total_label ?? ''); setENum(r.plantilla_num_label ?? ''); setEFecha(r.plantilla_fecha_formato ?? 'dmy') }} style={ico}><Pencil size={13} /></button>
                      <button onClick={() => borrar(r.id)} style={{ ...ico, color: GRANATE }}><Trash2 size={13} /></button>
                    </div></td>
                  </>
                )}
              </tr>
            ))}
            {visibles.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: T.mut }}>Sin plantillas.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
