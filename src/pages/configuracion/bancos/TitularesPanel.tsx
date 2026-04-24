import { useCallback, useEffect, useState } from 'react'
import { Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, FONT } from '@/styles/tokens'
import { useTitular, type Titular } from '@/contexts/TitularContext'
import ConfigGroupCard from '@/components/configuracion/ConfigGroupCard'

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(sub))
  }
  return btoa(binary)
}

interface EditableTitular {
  id: string
  nombre: string
  nif: string
  cuenta_iban: string
  cuenta_banco_nombre: string
}

export default function TitularesPanel() {
  const { T, isDark } = useTheme()
  const { titulares, recargar } = useTitular()
  const [editando, setEditando] = useState<Record<string, EditableTitular>>({})
  const [mensaje, setMensaje] = useState<Record<string, string>>({})
  const [subiendo, setSubiendo] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const ed: Record<string, EditableTitular> = {}
    for (const t of titulares) {
      ed[t.id] = {
        id: t.id,
        nombre: t.nombre,
        nif: t.nif,
        cuenta_iban: t.cuenta_iban || '',
        cuenta_banco_nombre: t.cuenta_banco_nombre || '',
      }
    }
    setEditando(ed)
  }, [titulares])

  const guardar = async (t: EditableTitular) => {
    try {
      await fetch('/api/titulares', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(t),
      })
    } catch {
      await supabase
        .from('titulares')
        .update({
          nombre: t.nombre,
          nif: t.nif,
          cuenta_iban: t.cuenta_iban || null,
          cuenta_banco_nombre: t.cuenta_banco_nombre || null,
        })
        .eq('id', t.id)
    }
    setMensaje((m) => ({ ...m, [t.id]: 'Guardado' }))
    recargar()
    setTimeout(() => setMensaje((m) => ({ ...m, [t.id]: '' })), 2000)
  }

  const subirBBVA = useCallback(async (titular: Titular, file: File) => {
    setSubiendo((s) => ({ ...s, [titular.id]: true }))
    setMensaje((m) => ({ ...m, [titular.id]: `Subiendo ${file.name}...` }))
    try {
      const base64 = await fileToBase64(file)
      const r = await fetch('/api/conciliacion/importar-emilio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, nombre: file.name }),
      })
      const data = await r.json()
      if (data.error) {
        setMensaje((m) => ({ ...m, [titular.id]: `Error: ${data.error}` }))
      } else {
        setMensaje((m) => ({
          ...m,
          [titular.id]: `${data.insertados}/${data.total} movimientos importados`,
        }))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error'
      setMensaje((m) => ({ ...m, [titular.id]: `Error: ${msg}` }))
    } finally {
      setSubiendo((s) => ({ ...s, [titular.id]: false }))
    }
  }, [])

  return (
    <ConfigGroupCard title="Titulares" subtitle={`${titulares.length}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 18 }}>
        {titulares.map((t) => {
          const ed = editando[t.id]
          if (!ed) return null
          const msg = mensaje[t.id]
          const isSubiendo = subiendo[t.id]
          const soloEmilio = t.carpeta_drive === 'EMILIO'
          return (
            <div
              key={t.id}
              style={{
                background: T.card,
                border: `0.5px solid ${T.brd}`,
                borderLeft: `4px solid ${t.color || '#B01D23'}`,
                borderRadius: 10,
                padding: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: t.color || '#B01D23' }} />
                <div style={{
                  fontFamily: FONT.heading, fontSize: 14, letterSpacing: '1.8px',
                  textTransform: 'uppercase', color: T.pri, fontWeight: 600,
                }}>
                  {t.nombre}
                </div>
                <div style={{ color: T.mut, fontSize: 12, fontFamily: FONT.body }}>{t.nif}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 12 }}>
                <Campo
                  T={T}
                  label="Nombre"
                  value={ed.nombre}
                  onChange={(v) => setEditando((s) => ({ ...s, [t.id]: { ...ed, nombre: v } }))}
                />
                <Campo
                  T={T}
                  label="NIF / CIF"
                  value={ed.nif}
                  onChange={(v) => setEditando((s) => ({ ...s, [t.id]: { ...ed, nif: v } }))}
                />
                <Campo
                  T={T}
                  label="IBAN"
                  value={ed.cuenta_iban}
                  onChange={(v) => setEditando((s) => ({ ...s, [t.id]: { ...ed, cuenta_iban: v } }))}
                  mono
                />
                <Campo
                  T={T}
                  label="Banco"
                  value={ed.cuenta_banco_nombre}
                  onChange={(v) => setEditando((s) => ({ ...s, [t.id]: { ...ed, cuenta_banco_nombre: v } }))}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => guardar(ed)}
                  style={{
                    padding: '7px 14px',
                    background: '#B01D23',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontFamily: FONT.heading,
                    fontSize: 11,
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Guardar
                </button>
                {msg && <span style={{ color: T.sec, fontSize: 12, fontFamily: FONT.body }}>{msg}</span>}
              </div>

              {soloEmilio && (
                <div style={{ marginTop: 18 }}>
                  <div style={{
                    fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px',
                    textTransform: 'uppercase', color: T.mut, marginBottom: 6, fontWeight: 500,
                  }}>
                    Importar extracto BBVA (.xlsx / .xls)
                  </div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '12px 16px',
                      background: isDark ? '#141414' : '#fafafa',
                      border: `1.5px dashed ${T.brd}`,
                      borderRadius: 8,
                      cursor: isSubiendo ? 'wait' : 'pointer',
                      opacity: isSubiendo ? 0.6 : 1,
                    }}
                  >
                    <Upload size={16} color="#B01D23" />
                    <span style={{ color: T.pri, fontSize: 12, fontFamily: FONT.body }}>
                      {isSubiendo ? 'Procesando...' : 'Arrastra o haz clic para subir'}
                    </span>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      disabled={isSubiendo}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) subirBBVA(t, f)
                        e.target.value = ''
                      }}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              )}
            </div>
          )
        })}

        {titulares.length === 0 && (
          <div style={{ color: T.mut, fontFamily: FONT.body, fontSize: 13, padding: 20 }}>
            No hay titulares configurados.
          </div>
        )}
      </div>
    </ConfigGroupCard>
  )
}

function Campo({
  T,
  label,
  value,
  onChange,
  mono,
}: {
  T: ReturnType<typeof useTheme>['T']
  label: string
  value: string
  onChange: (v: string) => void
  mono?: boolean
}) {
  return (
    <div>
      <label style={{
        display: 'block',
        fontFamily: FONT.heading,
        fontSize: 10,
        letterSpacing: '1.3px',
        textTransform: 'uppercase',
        color: T.mut,
        marginBottom: 4,
        fontWeight: 500,
      }}>
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: T.inp,
          color: T.pri,
          border: `0.5px solid ${T.brd}`,
          borderRadius: 6,
          fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : FONT.body,
          fontSize: 13,
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />
    </div>
  )
}
