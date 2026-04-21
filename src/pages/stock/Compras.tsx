import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useConfig } from '@/hooks/useConfig'
import { fmtEur, fmtDate } from '@/utils/format'

interface Ingrediente { id: string; nombre_base: string; abv: string | null; nombre: string; ud_std: string | null; ud_min: string | null; eur_std: number | null; precio_activo: number | null; usos: number | null }
interface PedidoLinea { ingrediente_id: string | null; nombre: string; abv: string; cantidad: number; unidad: string; precio_unit_est: number; total_est: number }
interface Pedido { id: string; fecha: string; proveedor_abv: string; proveedor_nombre: string | null; estado: string; notas: string | null; total_estimado: number; created_at: string }

const ESTADOS: Record<string, { label: string; color: string }> = {
  borrador:  { label: 'Borrador',  color: '#777777' },
  enviado:   { label: 'Enviado',   color: '#f5a623' },
  recibido:  { label: 'Recibido',  color: '#06C167' },
  cancelado: { label: 'Cancelado', color: '#B01D23' },
}

const labelStyle = { fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '2px', color: 'var(--sl-text-muted)', marginBottom: 4 }
const inputSt = { width: '100%', padding: '7px 10px', backgroundColor: 'var(--sl-input-edit)', border: '1px solid var(--sl-border)', borderRadius: 4, fontFamily: 'Lexend, sans-serif', fontSize: 13, color: 'var(--sl-text-primary)', outline: 'none' }

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => { const s = String(v); return s.includes(';') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s }
  const lines = [headers.map(esc).join(';'), ...rows.map(r => r.map(esc).join(';'))]
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function Compras() {
  const cfg = useConfig()
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [tab, setTab] = useState<'nuevo' | 'historial'>('nuevo')
  const [proveedorSelec, setProveedorSelec] = useState('')
  const [lineas, setLineas] = useState<PedidoLinea[]>([])
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [filtroIng, setFiltroIng] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('ingredientes').select('id,nombre_base,abv,nombre,ud_std,ud_min,eur_std,precio_activo,usos').order('nombre_base'),
      supabase.from('pedidos_proveedor').select('*').order('created_at', { ascending: false }),
    ]).then(([ingRes, pedRes]) => {
      setIngredientes((ingRes.data as Ingrediente[]) ?? [])
      setPedidos((pedRes.data as Pedido[]) ?? [])
      setLoading(false)
    })
  }, [saving])

  const proveedores = useMemo(() => cfg.proveedores.filter(p => p.activo && p.abv !== 'MRM' && p.abv !== 'EPS'), [cfg.proveedores])

  const ingsFiltrados = useMemo(() => {
    const abv = proveedorSelec.toUpperCase()
    return ingredientes.filter(i => {
      const matchProv = !proveedorSelec || (i.abv ?? '').toUpperCase() === abv
      const matchFiltro = !filtroIng || i.nombre_base.toLowerCase().includes(filtroIng.toLowerCase())
      return matchProv && matchFiltro
    })
  }, [ingredientes, proveedorSelec, filtroIng])

  const addLinea = (ing: Ingrediente) => {
    if (lineas.find(l => l.ingrediente_id === ing.id)) return
    setLineas(prev => [...prev, {
      ingrediente_id: ing.id,
      nombre: ing.nombre_base,
      abv: ing.abv ?? '',
      cantidad: 1,
      unidad: ing.ud_std ?? 'Ud.',
      precio_unit_est: ing.precio_activo ?? ing.eur_std ?? 0,
      total_est: ing.precio_activo ?? ing.eur_std ?? 0,
    }])
  }

  const updateLinea = (idx: number, patch: Partial<PedidoLinea>) => {
    setLineas(prev => prev.map((l, i) => {
      if (i !== idx) return l
      const updated = { ...l, ...patch }
      updated.total_est = updated.cantidad * updated.precio_unit_est
      return updated
    }))
  }

  const removeLinea = (idx: number) => setLineas(prev => prev.filter((_, i) => i !== idx))
  const totalPedido = lineas.reduce((s, l) => s + l.total_est, 0)

  const handleGuardar = async (estado: 'borrador' | 'enviado') => {
    setErr(null)
    if (!proveedorSelec) { setErr('Selecciona un proveedor'); return }
    if (lineas.length === 0) { setErr('Añade al menos un artículo'); return }
    setSaving(true)
    try {
      const prov = proveedores.find(p => p.abv === proveedorSelec)
      const { data: pedido, error: e1 } = await supabase.from('pedidos_proveedor').insert({
        proveedor_abv: proveedorSelec,
        proveedor_nombre: prov?.nombre_completo ?? null,
        estado,
        notas: notas || null,
        total_estimado: totalPedido,
      }).select('id').single()
      if (e1) throw e1
      const rows = lineas.map(l => ({ ...l, pedido_id: pedido.id }))
      const { error: e2 } = await supabase.from('pedidos_proveedor_lineas').insert(rows)
      if (e2) throw e2
      setLineas([]); setNotas(''); setProveedorSelec(''); setTab('historial')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleEstado = async (id: string, estado: string) => {
    await supabase.from('pedidos_proveedor').update({ estado }).eq('id', id)
    setPedidos(prev => prev.map(p => p.id === id ? { ...p, estado } : p))
  }

  const exportarPedido = async (pedido: Pedido) => {
    const { data: lineasPed } = await supabase.from('pedidos_proveedor_lineas').select('*').eq('pedido_id', pedido.id)
    const rows = (lineasPed ?? []).map((l: Record<string, unknown>) => [l.nombre as string, l.cantidad as number, l.unidad as string, l.precio_unit_est as number, l.total_est as number])
    downloadCSV(`pedido_${pedido.proveedor_abv}_${pedido.fecha}.csv`, ['Artículo', 'Cantidad', 'Unidad', 'Precio Unit. Est.', 'Total Est.'], rows)
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--sl-text-muted)', fontFamily: 'Lexend, sans-serif' }}>Cargando…</div>

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 24, color: 'var(--sl-text-primary)', letterSpacing: '0.04em', marginBottom: 24 }}>COMPRAS / PEDIDOS A PROVEEDOR</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--sl-border)' }}>
        {(['nuevo', 'historial'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 20px', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', border: 'none', borderBottom: tab === t ? '2px solid #e8f442' : '2px solid transparent', backgroundColor: 'transparent', color: tab === t ? '#e8f442' : 'var(--sl-text-muted)', transition: 'color 150ms' }}>
            {t === 'nuevo' ? 'Nuevo Pedido' : `Historial (${pedidos.length})`}
          </button>
        ))}
      </div>

      {tab === 'nuevo' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
          {/* Panel izquierdo: selector proveedor + lista ingredientes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Proveedor</label>
              <select value={proveedorSelec} onChange={e => setProveedorSelec(e.target.value)} style={inputSt}>
                <option value="">— Seleccionar —</option>
                {proveedores.map(p => <option key={p.abv} value={p.abv}>{p.abv} · {p.nombre_completo}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Buscar artículo</label>
              <input value={filtroIng} onChange={e => setFiltroIng(e.target.value)} placeholder="Filtrar ingredientes…" style={inputSt} />
            </div>
            <div style={{ backgroundColor: 'var(--sl-card)', border: '1px solid var(--sl-border)', borderRadius: 8, overflow: 'hidden', maxHeight: 420, overflowY: 'auto' }}>
              {ingsFiltrados.length === 0 && <div style={{ padding: '16px', textAlign: 'center', color: 'var(--sl-text-muted)', fontFamily: 'Lexend, sans-serif', fontSize: 12 }}>Sin ingredientes{proveedorSelec ? ' para este proveedor' : ''}</div>}
              {ingsFiltrados.map(ing => {
                const yaAñadido = lineas.some(l => l.ingrediente_id === ing.id)
                return (
                  <div key={ing.id} onClick={() => !yaAñadido && addLinea(ing)} style={{ padding: '8px 12px', borderBottom: '1px solid var(--sl-border)', cursor: yaAñadido ? 'default' : 'pointer', opacity: yaAñadido ? 0.4 : 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 150ms' }}
                    onMouseEnter={e => { if (!yaAñadido) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--sl-card-alt)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = '' }}>
                    <div>
                      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, color: 'var(--sl-text-primary)' }}>{ing.nombre_base}</div>
                      <div style={{ fontFamily: 'Lexend, sans-serif', fontSize: 10, color: 'var(--sl-text-muted)' }}>{ing.abv ?? ''} · {ing.ud_std ?? ''}</div>
                    </div>
                    <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, color: '#e8f442' }}>{fmtEur(ing.precio_activo ?? ing.eur_std ?? 0)}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Panel derecho: líneas del pedido */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ backgroundColor: 'var(--sl-card)', border: '1px solid var(--sl-border)', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--sl-thead)' }}>
                    {['Artículo', 'ABV', 'Cantidad', 'Unidad', '€/ud est.', 'Total', ''].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Total' || h === '€/ud est.' || h === 'Cantidad' ? 'right' : 'left', fontFamily: 'Oswald, sans-serif', fontSize: 10, color: 'var(--sl-text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lineas.length === 0 && <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--sl-text-muted)', fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>Haz clic en un ingrediente para añadirlo</td></tr>}
                  {lineas.map((l, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid var(--sl-border)' }}>
                      <td style={{ padding: '7px 10px', fontFamily: 'Lexend, sans-serif', fontSize: 12, color: 'var(--sl-text-primary)' }}>{l.nombre}</td>
                      <td style={{ padding: '7px 10px', fontFamily: 'Oswald, sans-serif', fontSize: 11, color: 'var(--sl-text-muted)' }}>{l.abv}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                        <input type="number" min={0} step="any" value={l.cantidad || ''} onChange={e => updateLinea(idx, { cantidad: parseFloat(e.target.value) || 0 })} style={{ width: 70, padding: '3px 6px', backgroundColor: 'var(--sl-input-edit)', border: '1px solid var(--sl-border)', borderRadius: 4, fontFamily: 'Lexend, sans-serif', fontSize: 12, color: 'var(--sl-text-primary)', textAlign: 'right', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '7px 10px', fontFamily: 'Lexend, sans-serif', fontSize: 12, color: 'var(--sl-text-muted)' }}>{l.unidad}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                        <input type="number" min={0} step="0.0001" value={l.precio_unit_est || ''} onChange={e => updateLinea(idx, { precio_unit_est: parseFloat(e.target.value) || 0 })} style={{ width: 80, padding: '3px 6px', backgroundColor: 'var(--sl-input-edit)', border: '1px solid var(--sl-border)', borderRadius: 4, fontFamily: 'Lexend, sans-serif', fontSize: 12, color: 'var(--sl-text-primary)', textAlign: 'right', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--sl-text-primary)' }}>{fmtEur(l.total_est)}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                        <button onClick={() => removeLinea(idx)} style={{ background: 'none', border: 'none', color: 'var(--sl-text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lineas.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 14px', borderTop: '2px solid var(--sl-border-strong)', backgroundColor: 'var(--sl-card-alt)' }}>
                  <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, fontWeight: 700, color: '#e8f442' }}>Total estimado: {fmtEur(totalPedido)}</div>
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>Notas</label>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} placeholder="Instrucciones, observaciones…" style={{ ...inputSt, resize: 'vertical' as const }} />
            </div>

            {err && <p style={{ color: '#dc2626', fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>{err}</p>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => handleGuardar('borrador')} disabled={saving} style={{ padding: '9px 20px', backgroundColor: 'var(--sl-btn-cancel-bg)', color: 'var(--sl-btn-cancel-text)', border: '1px solid var(--sl-btn-cancel-border)', borderRadius: 5, fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '1px', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>GUARDAR BORRADOR</button>
              <button onClick={() => handleGuardar('enviado')} disabled={saving} style={{ padding: '9px 20px', backgroundColor: '#B01D23', color: '#fff', border: 'none', borderRadius: 5, fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '1px', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>ENVIAR PEDIDO</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'historial' && (
        <div style={{ backgroundColor: 'var(--sl-card)', border: '1px solid var(--sl-border)', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--sl-thead)' }}>
                {['Fecha', 'Proveedor', 'Estado', 'Total Est.', 'Notas', 'Acciones'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Total Est.' ? 'right' : 'left', fontFamily: 'Oswald, sans-serif', fontSize: 10, color: 'var(--sl-text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pedidos.length === 0 && <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--sl-text-muted)', fontFamily: 'Lexend, sans-serif' }}>Sin pedidos registrados</td></tr>}
              {pedidos.map((p, i) => {
                const est = ESTADOS[p.estado] ?? ESTADOS.borrador
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--sl-border)', backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--sl-card-alt)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'Lexend, sans-serif', fontSize: 12, color: 'var(--sl-text-muted)' }}>{fmtDate(p.fecha)}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'Oswald, sans-serif', fontSize: 13, color: 'var(--sl-text-primary)', fontWeight: 600 }}>{p.proveedor_abv} {p.proveedor_nombre ? `· ${p.proveedor_nombre}` : ''}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <select value={p.estado} onChange={e => handleEstado(p.id, e.target.value)} style={{ padding: '3px 8px', backgroundColor: 'transparent', border: `1px solid ${est.color}`, borderRadius: 4, color: est.color, fontFamily: 'Oswald, sans-serif', fontSize: 11, cursor: 'pointer', outline: 'none' }}>
                        {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: 13, fontWeight: 700, color: '#e8f442' }}>{fmtEur(p.total_estimado)}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'Lexend, sans-serif', fontSize: 11, color: 'var(--sl-text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.notas ?? '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <button onClick={() => exportarPedido(p)} style={{ padding: '4px 10px', backgroundColor: 'transparent', border: '1px solid var(--sl-border)', borderRadius: 4, color: 'var(--sl-text-muted)', fontFamily: 'Oswald, sans-serif', fontSize: 10, cursor: 'pointer', letterSpacing: '0.5px' }}>CSV</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
