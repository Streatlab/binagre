import { BLANCO, BORDE_SUAVE, GRANATE, GRIS } from '@/styles/neobrutal'
import { PANEL_SIDEBAR_BG, OCR_BEIGE } from '@/styles/palettes'
// VentasPlatosFranjas — módulo de aprendizaje de ventas: qué platos se venden y
// en qué franjas horarias, por marca y plataforma. Lee las vistas de agregación
// v_ventas_plato y v_ventas_franja (que resumen pedidos_plataforma).
// Se alimenta de los documentos de plataforma que entran por Bandeja de entrada.
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmtEur } from '@/utils/format'
import { fechaLocalStr } from '@/utils/fechaLocal'

interface Props {
  fechaDesde: Date
  fechaHasta: Date
}

interface FilaPlato { plataforma: string; marca: string; plato: string; lineas: number; importe_bruto: number }
interface FilaFranja { plataforma: string; marca: string; hora: number; pedidos: number; importe_bruto: number }

const PLATAFORMAS: { id: string; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'glovo', label: 'Glovo' },
  { id: 'uber', label: 'Uber Eats' },
  { id: 'just_eat', label: 'Just Eat' },
]

const ROJO = GRANATE
const NAVY = PANEL_SIDEBAR_BG
const BEIGE = OCR_BEIGE

export default function VentasPlatosFranjas({ fechaDesde, fechaHasta }: Props) {
  const [sub, setSub] = useState<'platos' | 'franjas'>('platos')
  const [plataforma, setPlataforma] = useState('todas')
  const [marca, setMarca] = useState('todas')
  const [platos, setPlatos] = useState<FilaPlato[]>([])
  const [franjas, setFranjas] = useState<FilaFranja[]>([])
  const [cargando, setCargando] = useState(true)

  const desde = fechaLocalStr(fechaDesde)
  const hasta = fechaLocalStr(fechaHasta)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [p, f] = await Promise.all([
        supabase.from('v_ventas_plato').select('plataforma, marca, plato, lineas, importe_bruto').gte('fecha', desde).lte('fecha', hasta),
        supabase.from('v_ventas_franja').select('plataforma, marca, hora, pedidos, importe_bruto').gte('fecha', desde).lte('fecha', hasta),
      ])
      setPlatos((p.data ?? []) as FilaPlato[])
      setFranjas((f.data ?? []) as FilaFranja[])
    } catch {
      setPlatos([]); setFranjas([])
    } finally {
      setCargando(false)
    }
  }, [desde, hasta])

  useEffect(() => { cargar() }, [cargar])

  // Marcas disponibles en el periodo (para el filtro)
  const marcas = useMemo(() => {
    const s = new Set<string>()
    platos.forEach(r => r.marca && s.add(r.marca))
    franjas.forEach(r => r.marca && s.add(r.marca))
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'es'))
  }, [platos, franjas])

  const pasaFiltro = (r: { plataforma: string; marca: string }) =>
    (plataforma === 'todas' || r.plataforma === plataforma) && (marca === 'todas' || r.marca === marca)

  // Top platos: agregados por nombre de plato, ordenados por unidades
  const topPlatos = useMemo(() => {
    const m = new Map<string, { plato: string; unidades: number; importe: number }>()
    platos.filter(pasaFiltro).forEach(r => {
      const k = r.plato
      const prev = m.get(k) ?? { plato: r.plato, unidades: 0, importe: 0 }
      prev.unidades += r.lineas
      prev.importe += Number(r.importe_bruto) || 0
      m.set(k, prev)
    })
    return Array.from(m.values()).sort((a, b) => b.unidades - a.unidades).slice(0, 25)
  }, [platos, plataforma, marca])

  // Franjas: 24 horas agregadas
  const porHora = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, h) => ({ hora: h, pedidos: 0, importe: 0 }))
    franjas.filter(pasaFiltro).forEach(r => {
      const h = Number(r.hora)
      if (h >= 0 && h < 24) { arr[h].pedidos += r.pedidos; arr[h].importe += Number(r.importe_bruto) || 0 }
    })
    return arr
  }, [franjas, plataforma, marca])

  const totalPedidos = porHora.reduce((s, x) => s + x.pedidos, 0)
  const maxUnidades = topPlatos[0]?.unidades || 1
  const maxPedidos = Math.max(1, ...porHora.map(x => x.pedidos))
  const hayDatos = platos.length > 0 || franjas.length > 0

  const selStyle: React.CSSProperties = { padding: '8px 12px', borderRadius: 10, border: `0.5px solid ${BORDE_SUAVE}`, background: BLANCO, fontFamily: 'Lexend, sans-serif', fontSize: 13, color: NAVY, cursor: 'pointer' }
  const tabStyle = (active: boolean): React.CSSProperties => ({ padding: '8px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'Oswald, sans-serif', fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600, background: active ? ROJO : BEIGE, color: active ? BLANCO : NAVY })

  return (
    <div style={{ marginTop: 16, background: BLANCO, border: `0.5px solid ${BORDE_SUAVE}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', color: ROJO, marginRight: 'auto' }}>Qué se vende y cuándo</div>
        <button onClick={() => setSub('platos')} style={tabStyle(sub === 'platos')}>Platos</button>
        <button onClick={() => setSub('franjas')} style={tabStyle(sub === 'franjas')}>Franjas horarias</button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <select value={plataforma} onChange={e => setPlataforma(e.target.value)} style={selStyle}>
          {PLATAFORMAS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <select value={marca} onChange={e => setMarca(e.target.value)} style={selStyle}>
          <option value="todas">Todas las marcas</option>
          {marcas.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {cargando ? (
        <div style={{ padding: '28px 0', textAlign: 'center', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: GRIS }}>Cargando…</div>
      ) : !hayDatos ? (
        <div style={{ padding: '28px 16px', textAlign: 'center', fontFamily: 'Lexend, sans-serif', fontSize: 13, color: GRIS, background: BEIGE, borderRadius: 10 }}>
          Aún no hay datos de platos. En cuanto entren documentos de plataforma por Bandeja de entrada, este módulo aprenderá qué se vende y en qué franjas.
        </div>
      ) : sub === 'platos' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {topPlatos.map((p, i) => (
            <div key={p.plato} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 22, textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontSize: 12, color: GRIS }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontFamily: 'Lexend, sans-serif', fontSize: 13, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.plato}</span>
                  <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 13, color: NAVY, fontWeight: 600, whiteSpace: 'nowrap' }}>{p.unidades} <span style={{ color: GRIS, fontWeight: 400, fontSize: 11 }}>· {fmtEur(p.importe)}</span></span>
                </div>
                <div style={{ height: 7, background: BEIGE, borderRadius: 99 }}>
                  <div style={{ height: 7, width: `${Math.max(3, (p.unidades / maxUnidades) * 100)}%`, background: ROJO, borderRadius: 99 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 160, marginBottom: 6 }}>
            {porHora.map(h => (
              <div key={h.hora} title={`${h.hora}:00 · ${h.pedidos} pedidos · ${fmtEur(h.importe)}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', height: '100%' }}>
                <div style={{ width: '100%', height: `${(h.pedidos / maxPedidos) * 100}%`, minHeight: h.pedidos > 0 ? 2 : 0, background: h.pedidos > 0 ? ROJO : 'transparent', borderRadius: '3px 3px 0 0' }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {porHora.map(h => (
              <div key={h.hora} style={{ flex: 1, textAlign: 'center', fontFamily: 'Lexend, sans-serif', fontSize: 9, color: GRIS }}>{h.hora % 2 === 0 ? h.hora : ''}</div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontFamily: 'Lexend, sans-serif', fontSize: 12, color: GRIS }}>{totalPedidos} pedidos en el periodo · hora del día (0–23)</div>
        </div>
      )}
    </div>
  )
}
