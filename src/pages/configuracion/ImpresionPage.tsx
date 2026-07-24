/**
 * Ajustes → Impresión — tabla editable de impresion_preferencias (handoff §3.4).
 * Cambia tinta / orientación / copias / activo de cada documento de un clic.
 * Debajo, los últimos envíos a la impresora (impresion_envios) para trazabilidad.
 */
import { useEffect, useState } from 'react'
import RutaPantalla from '@/components/ui/RutaPantalla'
import { PantallaCantera, Papel, SeccionLabel, SHADOW_DURA } from '@/components/kit/cantera'
import { INK, BLANCO, CREMA, VERDE, GRANATE, NAR, AZUL, GRIS, OSW, LEX } from '@/styles/neobrutal'
import { supabase } from '@/lib/supabase'
import type { PreferenciasDoc } from '@/lib/impresionEnvio'

interface FilaPref extends PreferenciasDoc { id: string }
interface FilaEnvio {
  id: string
  documento_id: string
  destino: string
  estado: string
  message_id: string | null
  error: string | null
  usuario: string | null
  creado_en: string
}

const AREAS: Array<{ key: PreferenciasDoc['area']; label: string; color: string }> = [
  { key: 'cocina', label: 'Cocina', color: NAR },
  { key: 'equipo', label: 'Equipo', color: INK },
  { key: 'operaciones', label: 'Operaciones / APPCC', color: AZUL },
  { key: 'finanzas', label: 'Finanzas e informes', color: VERDE },
]

const th: React.CSSProperties = { fontFamily: OSW, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: GRIS, textAlign: 'left', padding: '6px 10px', borderBottom: `2px solid ${INK}` }
const td: React.CSSProperties = { fontFamily: LEX, fontSize: 13, padding: '7px 10px', borderBottom: `1px solid #d0c8bc`, verticalAlign: 'middle' }

function BotonCiclo({ valor, opciones, onCambiar }: { valor: string; opciones: string[]; onCambiar: (v: string) => void }) {
  const sig = opciones[(opciones.indexOf(valor) + 1) % opciones.length]
  return (
    <button
      onClick={() => onCambiar(sig)}
      title="Clic para cambiar"
      style={{
        fontFamily: OSW, fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px',
        background: BLANCO, color: INK, border: `2px solid ${INK}`, boxShadow: SHADOW_DURA, borderRadius: 0,
        padding: '4px 10px', cursor: 'pointer', minWidth: 78,
      }}
    >{valor === 'bn' ? 'B/N' : valor}</button>
  )
}

export default function ImpresionPage() {
  const [filas, setFilas] = useState<FilaPref[]>([])
  const [envios, setEnvios] = useState<FilaEnvio[]>([])
  const [cargando, setCargando] = useState(true)
  const [aviso, setAviso] = useState<string | null>(null)

  const cargar = async () => {
    setCargando(true)
    const [p, e] = await Promise.all([
      supabase.from('impresion_preferencias').select('*').order('area').order('nombre'),
      supabase.from('impresion_envios').select('*').order('creado_en', { ascending: false }).limit(20),
    ])
    setFilas((p.data as FilaPref[]) || [])
    setEnvios((e.data as FilaEnvio[]) || [])
    setCargando(false)
  }
  useEffect(() => { void cargar() }, [])

  const actualizar = async (id: string, cambio: Partial<FilaPref>) => {
    setFilas(fs => fs.map(f => (f.id === id ? { ...f, ...cambio } : f)))
    const { error } = await supabase.from('impresion_preferencias').update({ ...cambio, actualizado_en: new Date().toISOString() }).eq('id', id)
    if (error) { setAviso('No se pudo guardar: ' + error.message); void cargar() }
    else setAviso(null)
  }

  return (
    <PantallaCantera embedded>
      <RutaPantalla niveles={['Configuración', 'Impresión']} />
      {aviso && (
        <Papel ceja={GRANATE}><div style={{ fontFamily: LEX, fontSize: 13, color: GRANATE }}>{aviso}</div></Papel>
      )}
      {cargando && <div style={{ fontFamily: LEX, fontSize: 13, color: GRIS }}>Cargando…</div>}

      {!cargando && AREAS.map(a => {
        const del = filas.filter(f => f.area === a.key)
        if (del.length === 0) return null
        return (
          <div key={a.key}>
            <SeccionLabel bg={a.color} color={a.color === INK ? CREMA : undefined}>{a.label}</SeccionLabel>
            <Papel ceja={a.color} pad="0">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Documento</th>
                      <th style={th}>Tinta</th>
                      <th style={th}>Orientación</th>
                      <th style={th}>Copias</th>
                      <th style={th}>Activo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {del.map(f => (
                      <tr key={f.id} style={{ opacity: f.activo ? 1 : 0.45 }}>
                        <td style={td}>
                          <div style={{ fontWeight: 600 }}>{f.nombre}</div>
                          <div style={{ fontSize: 11, color: GRIS }}>{f.documento_id}</div>
                        </td>
                        <td style={td}><BotonCiclo valor={f.tinta} opciones={['bn', 'color']} onCambiar={v => actualizar(f.id, { tinta: v as FilaPref['tinta'] })} /></td>
                        <td style={td}><BotonCiclo valor={f.orientacion} opciones={['vertical', 'apaisado']} onCambiar={v => actualizar(f.id, { orientacion: v as FilaPref['orientacion'] })} /></td>
                        <td style={td}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <BotonCiclo valor={String(f.copias)} opciones={['1', '2', '3', '4', '5']} onCambiar={v => actualizar(f.id, { copias: Number(v) })} />
                          </div>
                        </td>
                        <td style={td}><BotonCiclo valor={f.activo ? 'sí' : 'no'} opciones={['sí', 'no']} onCambiar={v => actualizar(f.id, { activo: v === 'sí' })} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Papel>
          </div>
        )
      })}

      {!cargando && (
        <div>
          <SeccionLabel bg={GRANATE}>Últimos envíos a la impresora</SeccionLabel>
          <Papel ceja={GRANATE} pad="0">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Fecha</th>
                    <th style={th}>Documento</th>
                    <th style={th}>Estado</th>
                    <th style={th}>Detalle</th>
                    <th style={th}>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {envios.length === 0 && (
                    <tr><td style={{ ...td, color: GRIS }} colSpan={5}>Sin envíos todavía</td></tr>
                  )}
                  {envios.map(e => (
                    <tr key={e.id}>
                      <td style={td}>{new Date(e.creado_en).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={td}>{e.documento_id}</td>
                      <td style={td}>
                        <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 12, textTransform: 'uppercase', padding: '2px 8px', border: `2px solid ${INK}`, background: e.estado === 'enviado' ? VERDE : GRANATE, color: BLANCO }}>
                          {e.estado}
                        </span>
                      </td>
                      <td style={{ ...td, fontSize: 11.5, color: GRIS, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.error || e.message_id || '—'}</td>
                      <td style={td}>{e.usuario || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Papel>
        </div>
      )}
    </PantallaCantera>
  )
}
