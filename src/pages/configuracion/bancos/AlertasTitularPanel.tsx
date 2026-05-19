import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toastStore'

interface Alerta {
  id: string
  fuente: string
  registro_id: string | null
  motivo: string
  datos_originales: any
  resuelto: boolean
  titular_asignado: string | null
  created_at: string
  resuelto_at: string | null
}

interface Titular {
  id: string
  nombre: string
}

export default function AlertasTitularPanel() {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [titulares, setTitulares] = useState<Titular[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'pendientes' | 'todas'>('pendientes')

  useEffect(() => { cargar() }, [filtro])

  async function cargar() {
    setLoading(true)
    const [a, t] = await Promise.all([
      supabase.from('alertas_titular_dudoso')
        .select('*')
        .eq(filtro === 'pendientes' ? 'resuelto' : 'id', filtro === 'pendientes' ? false : 'id')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('titulares').select('id, nombre').eq('activo', true),
    ])
    if (a.data) setAlertas(a.data as Alerta[])
    if (t.data) setTitulares(t.data as Titular[])
    setLoading(false)
  }

  async function asignarTitular(alerta: Alerta, titularId: string) {
    const tabla = alerta.fuente === 'facturas' ? 'facturas' : 'conciliacion'
    const { error: e1 } = await supabase.from(tabla).update({ titular_id: titularId }).eq('id', alerta.registro_id)
    if (e1) { toast.error('Error al asignar: ' + e1.message); return }
    const { error: e2 } = await supabase.from('alertas_titular_dudoso')
      .update({ resuelto: true, titular_asignado: titularId, resuelto_at: new Date().toISOString() })
      .eq('id', alerta.id)
    if (e2) { toast.error('Error al resolver: ' + e2.message); return }
    toast.success('Titular asignado')
    cargar()
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#7a8090', fontFamily: 'Lexend, sans-serif' }}>
      Cargando alertas…
    </div>
  )

  return (
    <div style={{ background: '#fff', border: '0.5px solid #d0c8bc', borderRadius: 14, padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { id: 'pendientes', label: 'Pendientes' },
            { id: 'todas', label: 'Todas' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id as any)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: filtro === f.id ? 'none' : '0.5px solid #d0c8bc',
                background: filtro === f.id ? '#FF4757' : '#fff',
                color: filtro === f.id ? '#fff' : '#3a4050',
                fontFamily: 'Lexend, sans-serif',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 11, color: '#7a8090', letterSpacing: '2px', textTransform: 'uppercase' }}>
          {alertas.length} registros
        </div>
      </div>

      {alertas.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#7a8090', fontFamily: 'Lexend, sans-serif', fontSize: 13 }}>
          {filtro === 'pendientes' ? 'No hay alertas pendientes. Todo conciliado a titular.' : 'No hay alertas registradas.'}
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Fecha</th>
              <th style={th}>Fuente</th>
              <th style={th}>Motivo</th>
              <th style={th}>Concepto/Proveedor</th>
              <th style={th}>Importe</th>
              <th style={th}>Asignar</th>
            </tr>
          </thead>
          <tbody>
            {alertas.map(a => {
              const d = a.datos_originales || {}
              const concepto = d.proveedor_nombre || d.concepto || d.proveedor || '—'
              const importe = d.total || d.importe || 0
              return (
                <tr key={a.id} style={{ borderBottom: '0.5px solid #ebe8e2' }}>
                  <td style={td}>{new Date(a.created_at).toLocaleDateString('es-ES')}</td>
                  <td style={td}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: a.fuente === 'facturas' ? '#FF475715' : '#1e223315',
                      color: a.fuente === 'facturas' ? '#FF4757' : '#1e2233',
                      fontFamily: 'Oswald, sans-serif',
                      fontSize: 10,
                      letterSpacing: '1.5px',
                      textTransform: 'uppercase',
                    }}>
                      {a.fuente === 'facturas' ? 'Factura' : 'Conciliación'}
                    </span>
                  </td>
                  <td style={td}>{a.motivo}</td>
                  <td style={{ ...td, fontWeight: 500 }}>{concepto}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'Oswald, sans-serif', fontWeight: 500 }}>
                    {typeof importe === 'number' ? importe.toFixed(2) + ' €' : importe}
                  </td>
                  <td style={td}>
                    {a.resuelto ? (
                      <span style={{ color: '#7a8090', fontSize: 11, fontFamily: 'Lexend, sans-serif' }}>
                        ✓ {titulares.find(t => t.id === a.titular_asignado)?.nombre || 'Resuelto'}
                      </span>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        {titulares.map(t => (
                          <button
                            key={t.id}
                            onClick={() => asignarTitular(a, t.id)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 4,
                              border: '0.5px solid #d0c8bc',
                              background: '#fff',
                              color: '#3a4050',
                              fontFamily: 'Lexend, sans-serif',
                              fontSize: 11,
                              fontWeight: 500,
                              cursor: 'pointer',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FF4757'; (e.currentTarget as HTMLElement).style.color = '#fff'; (e.currentTarget as HTMLElement).style.border = '0.5px solid #FF4757' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.color = '#3a4050'; (e.currentTarget as HTMLElement).style.border = '0.5px solid #d0c8bc' }}
                          >
                            {t.nombre}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

const th: React.CSSProperties = {
  fontFamily: 'Oswald, sans-serif',
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: '2px',
  color: '#7a8090',
  textTransform: 'uppercase',
  textAlign: 'left',
  padding: '12px 8px',
  borderBottom: '0.5px solid #d0c8bc',
}

const td: React.CSSProperties = {
  fontFamily: 'Lexend, sans-serif',
  fontSize: 12,
  color: '#3a4050',
  padding: '12px 8px',
}
