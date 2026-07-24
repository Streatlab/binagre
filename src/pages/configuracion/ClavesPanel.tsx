// AJUSTES · CLAVES (bóveda)
// Todas las claves del negocio en un sitio: PINs del fichaje, llaves de servicios
// y accesos. Se guardan cifradas y solo se abren con la clave maestra de Rubén.
// Si se olvida, llega un código de un solo uso al correo de recuperación.
// El PIN de un empleado se puede cambiar desde aquí: se actualiza a la vez en el
// quiosco de fichaje y en la bóveda, así nunca se descuadran.
import { useCallback, useEffect, useState } from 'react'
import { BLANCO, CLARO, GRANATE, GRIS, INK, LIMA, NAR, VERDE } from '@/styles/neobrutal'
import { FONT } from '@/styles/tokens'
import { Papel, SeccionLabel, SHADOW_DURA } from '@/components/kit/cantera'

type Clave = {
  id: string
  categoria: string
  etiqueta: string
  usuario: string | null
  valor: string
  notas: string | null
  empleado_id: string | null
  actualizado: string
}

type Empleado = { id: string; nombre: string; fichaje_activo: boolean | null }

const LLAVE_SESION = 'sl.boveda.maestra'

const CATEGORIAS: Array<{ v: string; t: string }> = [
  { v: 'fichaje', t: 'Fichaje del equipo' },
  { v: 'servicio', t: 'Servicios y llaves' },
  { v: 'plataforma', t: 'Plataformas de reparto' },
  { v: 'banco', t: 'Bancos' },
  { v: 'erp', t: 'ERP' },
  { v: 'otro', t: 'Otras' },
]

const tituloCat = (v: string) => CATEGORIAS.find(c => c.v === v)?.t ?? 'Otras'

const inputStyle = {
  background: BLANCO, border: `2px solid ${INK}`, borderRadius: 0, color: INK,
  fontFamily: FONT.body, fontSize: 13, padding: '6px 10px',
}

const btn = (bg: string, color = BLANCO) => ({
  fontFamily: FONT.heading, fontSize: 12, fontWeight: 700, letterSpacing: '0.5px',
  textTransform: 'uppercase' as const, padding: '7px 16px', border: `3px solid ${INK}`,
  boxShadow: SHADOW_DURA, borderRadius: 0, cursor: 'pointer', background: bg, color,
})

function Etiqueta({ children }: { children: string }) {
  return (
    <div style={{ fontFamily: FONT.heading, fontSize: 11, color: GRIS, letterSpacing: '1px', marginBottom: 4, textTransform: 'uppercase' as const }}>
      {children}
    </div>
  )
}

async function api<T>(accion: string, cuerpo: Record<string, unknown>): Promise<T> {
  const r = await fetch(`/api/operaciones/boveda/${accion}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((j as { error?: string })?.error || 'Algo ha fallado')
  return j as T
}

export default function ClavesPanel() {
  const [maestra, setMaestra] = useState('')
  const [entrada, setEntrada] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const [claves, setClaves] = useState<Clave[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [visibles, setVisibles] = useState<Set<string>>(new Set())
  const [cargando, setCargando] = useState(false)

  // Alta / edición
  const [editando, setEditando] = useState<Partial<Clave> | null>(null)
  // Cambio de clave maestra
  const [nuevaMaestra, setNuevaMaestra] = useState('')
  const [panel, setPanel] = useState<'lista' | 'maestra'>('lista')
  // Recuperación
  const [recupPaso, setRecupPaso] = useState<0 | 1>(0)
  const [recupCodigo, setRecupCodigo] = useState('')
  const [recupNueva, setRecupNueva] = useState('')

  useEffect(() => {
    const g = sessionStorage.getItem(LLAVE_SESION)
    if (g) setMaestra(g)
  }, [])

  const cargar = useCallback(async () => {
    if (!maestra) return
    setCargando(true); setError('')
    try {
      const a = await api<{ claves: Clave[] }>('abrir', { clave_maestra: maestra })
      setClaves(a.claves || [])
      const e = await api<{ empleados: Empleado[] }>('empleados', { clave_maestra: maestra })
      setEmpleados(e.empleados || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
      if ((err as Error).message?.includes('incorrecta')) {
        sessionStorage.removeItem(LLAVE_SESION); setMaestra('')
      }
    } finally {
      setCargando(false)
    }
  }, [maestra])

  useEffect(() => { if (maestra) cargar() }, [maestra, cargar])

  async function entrar() {
    setError('')
    try {
      await api('abrir', { clave_maestra: entrada })
      sessionStorage.setItem(LLAVE_SESION, entrada)
      setMaestra(entrada); setEntrada('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  function bloquear() {
    sessionStorage.removeItem(LLAVE_SESION)
    setMaestra(''); setClaves([]); setEmpleados([]); setVisibles(new Set())
  }

  function alternar(id: string) {
    setVisibles(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }

  async function copiar(valor: string) {
    try { await navigator.clipboard.writeText(valor); setAviso('Copiado al portapapeles.') } catch { setAviso('') }
    setTimeout(() => setAviso(''), 2000)
  }

  async function guardar() {
    if (!editando) return
    setError('')
    try {
      // Si la clave es el PIN de un empleado, se cambia también en el fichaje
      if (editando.categoria === 'fichaje' && editando.empleado_id) {
        await api('set-pin', { clave_maestra: maestra, empleado_id: editando.empleado_id, pin: editando.valor || '' })
      } else {
        await api('guardar', {
          clave_maestra: maestra,
          id: editando.id ?? null,
          categoria: editando.categoria || 'otro',
          etiqueta: editando.etiqueta || '',
          usuario: editando.usuario || null,
          valor: editando.valor || '',
          notas: editando.notas || null,
          empleado_id: editando.empleado_id || null,
        })
      }
      setEditando(null); setAviso('Guardado.'); cargar()
      setTimeout(() => setAviso(''), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  async function borrar(id: string, etiqueta: string) {
    if (!window.confirm(`¿Borrar "${etiqueta}" de la bóveda?`)) return
    try { await api('borrar', { clave_maestra: maestra, id }); cargar() } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  async function cambiarMaestra() {
    setError('')
    try {
      await api('cambiar-clave', { clave_maestra: maestra, nueva: nuevaMaestra })
      sessionStorage.setItem(LLAVE_SESION, nuevaMaestra)
      setMaestra(nuevaMaestra); setNuevaMaestra(''); setPanel('lista')
      setAviso('Clave maestra cambiada.')
      setTimeout(() => setAviso(''), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  async function pedirCodigo() {
    setError('')
    try {
      const r = await api<{ email: string }>('recup-iniciar', {})
      setRecupPaso(1); setAviso(`Código enviado a ${r.email}. Caduca en 30 minutos.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  async function confirmarCodigo() {
    setError('')
    try {
      await api('recup-confirmar', { codigo: recupCodigo, nueva: recupNueva })
      sessionStorage.setItem(LLAVE_SESION, recupNueva)
      setMaestra(recupNueva); setRecupPaso(0); setRecupCodigo(''); setRecupNueva('')
      setAviso('Clave maestra nueva guardada.')
      setTimeout(() => setAviso(''), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  // ── Candado ───────────────────────────────────────────────────────────────
  if (!maestra) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Papel ceja={GRANATE}>
          <div style={{ fontFamily: FONT.heading, fontSize: 18, color: INK, fontWeight: 700, marginBottom: 4 }}>
            Claves del negocio
          </div>
          <p style={{ color: GRIS, fontSize: 13, margin: '0 0 16px' }}>
            Aquí están guardados los PIN del equipo y las llaves de los servicios. Hace falta tu clave maestra.
          </p>
          <Etiqueta>Clave maestra</Etiqueta>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="password" inputMode="numeric" value={entrada}
              onChange={e => setEntrada(e.target.value.replace(/\D/g, '').slice(0, 10))}
              onKeyDown={e => { if (e.key === 'Enter') entrar() }}
              placeholder="••••"
              style={{ ...inputStyle, fontSize: 20, letterSpacing: '8px', width: 180 }}
            />
            <button onClick={entrar} style={btn(VERDE)}>Abrir</button>
            {recupPaso === 0 && (
              <button onClick={pedirCodigo} style={{ ...btn(BLANCO, GRIS), boxShadow: 'none' }}>No la recuerdo</button>
            )}
          </div>

          {recupPaso === 1 && (
            <div style={{ marginTop: 16, borderTop: `2px solid ${INK}`, paddingTop: 14, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <Etiqueta>Código del correo</Etiqueta>
                <input value={recupCodigo} onChange={e => setRecupCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} style={{ ...inputStyle, width: 120, letterSpacing: '4px' }} />
              </div>
              <div>
                <Etiqueta>Clave maestra nueva</Etiqueta>
                <input type="password" inputMode="numeric" value={recupNueva} onChange={e => setRecupNueva(e.target.value.replace(/\D/g, '').slice(0, 10))} style={{ ...inputStyle, width: 160 }} />
              </div>
              <button onClick={confirmarCodigo} style={btn(VERDE)}>Guardar clave nueva</button>
            </div>
          )}

          {error && <p style={{ color: GRANATE, fontSize: 13, marginTop: 12 }}>{error}</p>}
          {aviso && <p style={{ color: VERDE, fontSize: 13, marginTop: 12 }}>{aviso}</p>}
        </Papel>
      </div>
    )
  }

  const porCategoria = CATEGORIAS
    .map(c => ({ ...c, items: claves.filter(k => k.categoria === c.v) }))
    .filter(c => c.items.length > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => setEditando({ categoria: 'otro' })} style={btn(LIMA, INK)}>Añadir clave</button>
        <button onClick={() => setPanel(panel === 'maestra' ? 'lista' : 'maestra')} style={{ ...btn(BLANCO, GRIS), boxShadow: 'none' }}>
          Cambiar clave maestra
        </button>
        <button onClick={bloquear} style={{ ...btn(INK), marginLeft: 'auto' }}>Bloquear</button>
      </div>

      {error && <div style={{ border: `3px solid ${INK}`, background: BLANCO, padding: '10px 14px', color: GRANATE, fontSize: 13 }}>{error}</div>}
      {aviso && <div style={{ border: `3px solid ${INK}`, background: BLANCO, padding: '10px 14px', color: VERDE, fontSize: 13 }}>{aviso}</div>}

      {panel === 'maestra' && (
        <Papel ceja={GRANATE}>
          <Etiqueta>Clave maestra nueva (de 4 a 10 cifras)</Etiqueta>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="password" inputMode="numeric" value={nuevaMaestra}
              onChange={e => setNuevaMaestra(e.target.value.replace(/\D/g, '').slice(0, 10))}
              style={{ ...inputStyle, width: 180, letterSpacing: '6px', fontSize: 18 }} />
            <button onClick={cambiarMaestra} style={btn(VERDE)}>Guardar</button>
          </div>
          <p style={{ color: GRIS, fontSize: 12, marginTop: 10, marginBottom: 0 }}>
            Cuantas más cifras, más difícil de adivinar. Con 6 vas sobrado.
          </p>
        </Papel>
      )}

      {editando && (
        <Papel ceja={LIMA}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <Etiqueta>Tipo</Etiqueta>
              <select
                value={editando.categoria || 'otro'}
                onChange={e => setEditando({ ...editando, categoria: e.target.value, empleado_id: e.target.value === 'fichaje' ? editando.empleado_id : null })}
                style={inputStyle}
              >
                {CATEGORIAS.map(c => <option key={c.v} value={c.v}>{c.t}</option>)}
              </select>
            </div>

            {editando.categoria === 'fichaje' ? (
              <div>
                <Etiqueta>Empleado</Etiqueta>
                <select
                  value={editando.empleado_id || ''}
                  onChange={e => {
                    const emp = empleados.find(x => x.id === e.target.value)
                    setEditando({ ...editando, empleado_id: e.target.value, etiqueta: emp?.nombre || '' })
                  }}
                  style={{ ...inputStyle, minWidth: 200 }}
                >
                  <option value="">— elige —</option>
                  {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
            ) : (
              <div style={{ flex: 1, minWidth: 200 }}>
                <Etiqueta>Nombre</Etiqueta>
                <input value={editando.etiqueta || ''} onChange={e => setEditando({ ...editando, etiqueta: e.target.value })}
                  placeholder="Ej.: Uber Eats · panel de gestión" style={{ ...inputStyle, width: '100%' }} />
              </div>
            )}

            {editando.categoria !== 'fichaje' && (
              <div>
                <Etiqueta>Usuario</Etiqueta>
                <input value={editando.usuario || ''} onChange={e => setEditando({ ...editando, usuario: e.target.value })}
                  placeholder="opcional" style={inputStyle} />
              </div>
            )}

            <div>
              <Etiqueta>{editando.categoria === 'fichaje' ? 'PIN (6 cifras)' : 'Clave'}</Etiqueta>
              <input value={editando.valor || ''} onChange={e => setEditando({ ...editando, valor: e.target.value })}
                style={{ ...inputStyle, minWidth: 160 }} />
            </div>

            <div style={{ flex: 1, minWidth: 180 }}>
              <Etiqueta>Nota</Etiqueta>
              <input value={editando.notas || ''} onChange={e => setEditando({ ...editando, notas: e.target.value })}
                placeholder="opcional" style={{ ...inputStyle, width: '100%' }} />
            </div>

            <button onClick={guardar} style={btn(VERDE)}>Guardar</button>
            <button onClick={() => setEditando(null)} style={{ ...btn(BLANCO, GRIS), boxShadow: 'none' }}>Cancelar</button>
          </div>
          {editando.categoria === 'fichaje' && (
            <p style={{ color: NAR, fontSize: 12, marginTop: 10, marginBottom: 0 }}>
              Al guardar, ese PIN pasa a ser el que usa esa persona en la tablet.
            </p>
          )}
        </Papel>
      )}

      {cargando && <p style={{ color: GRIS, fontSize: 14 }}>Abriendo la bóveda…</p>}

      {porCategoria.map(cat => (
        <div key={cat.v} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SeccionLabel bg={GRANATE}>{cat.t}</SeccionLabel>
          <Papel ceja={GRANATE} pad="0" style={{ overflow: 'hidden' }}>
            {cat.items.map((k, i) => (
              <div key={k.id} style={{
                display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap',
                padding: '12px 16px', background: i % 2 === 0 ? BLANCO : CLARO,
                borderTop: i === 0 ? 'none' : `1px solid ${INK}`,
              }}>
                <div style={{ minWidth: 220, flex: 1 }}>
                  <div style={{ fontFamily: FONT.heading, fontSize: 14, color: INK, fontWeight: 700 }}>{k.etiqueta}</div>
                  {(k.usuario || k.notas) && (
                    <div style={{ fontSize: 12, color: GRIS, marginTop: 2 }}>
                      {k.usuario ? `${k.usuario} · ` : ''}{k.notas ?? ''}
                    </div>
                  )}
                </div>
                <div style={{
                  fontFamily: FONT.heading, fontSize: 17, letterSpacing: '2px', color: INK,
                  background: BLANCO, border: `2px solid ${INK}`, padding: '5px 12px', minWidth: 150, textAlign: 'center',
                }}>
                  {visibles.has(k.id) ? k.valor : '•'.repeat(Math.min(k.valor.length || 6, 12))}
                </div>
                <button onClick={() => alternar(k.id)} style={{ ...btn(BLANCO, GRIS), boxShadow: 'none' }}>
                  {visibles.has(k.id) ? 'Ocultar' : 'Ver'}
                </button>
                <button onClick={() => copiar(k.valor)} style={{ ...btn(BLANCO, GRIS), boxShadow: 'none' }}>Copiar</button>
                <button onClick={() => { setEditando(k); setPanel('lista') }} style={btn(LIMA, INK)}>Editar</button>
                <button onClick={() => borrar(k.id, k.etiqueta)} style={{ background: 'none', border: 'none', color: GRANATE, fontSize: 11, cursor: 'pointer', fontFamily: FONT.heading, letterSpacing: '0.5px' }}>
                  BORRAR
                </button>
              </div>
            ))}
          </Papel>
        </div>
      ))}

      {!cargando && claves.length === 0 && (
        <p style={{ color: GRIS, fontSize: 14 }}>La bóveda está vacía. Pulsa «Añadir clave».</p>
      )}
    </div>
  )
}
