import { BLANCO, GRANATE, INK, GRIS, SHADOW_MINI } from '@/styles/neobrutal'
import { useCallback, useEffect, useState } from 'react'
import { Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/styles/tokens'
import { useTitular, type Titular } from '@/contexts/TitularContext'
import RutaPantalla from '@/components/ui/RutaPantalla'
import { PantallaCantera, Papel } from '@/components/kit/cantera'

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

export default function CuentasBancarias() {
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
    <PantallaCantera>
      <RutaPantalla niveles={['Ajustes', 'Cuentas bancarias']} />
      {/* Config pura sin métrica propia (nº de titulares no es un KPI de negocio): se omite el héroe. */}

      {titulares.map((t) => {
        const ed = editando[t.id]
        if (!ed) return null
        const msg = mensaje[t.id]
        const isSubiendo = subiendo[t.id]
        const soloEmilio = t.carpeta_drive === 'EMILIO'
        return (
          <Papel key={t.id} ceja={t.color || GRANATE}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 0,
                  background: t.color || GRANATE,
                }}
              />
              <div
                style={{
                  fontFamily: FONT.heading,
                  fontSize: 16,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  color: INK,
                  fontWeight: 600,
                }}
              >
                {t.nombre}
              </div>
              <div style={{ color: GRIS, fontSize: 12 }}>{t.nif}</div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 12,
                marginBottom: 14,
              }}
            >
              <Campo
                label="Nombre"
                value={ed.nombre}
                onChange={(v) =>
                  setEditando((s) => ({ ...s, [t.id]: { ...ed, nombre: v } }))
                }
              />
              <Campo
                label="NIF / CIF"
                value={ed.nif}
                onChange={(v) =>
                  setEditando((s) => ({ ...s, [t.id]: { ...ed, nif: v } }))
                }
              />
              <Campo
                label="IBAN"
                value={ed.cuenta_iban}
                onChange={(v) =>
                  setEditando((s) => ({ ...s, [t.id]: { ...ed, cuenta_iban: v } }))
                }
              />
              <Campo
                label="Banco"
                value={ed.cuenta_banco_nombre}
                onChange={(v) =>
                  setEditando((s) => ({
                    ...s,
                    [t.id]: { ...ed, cuenta_banco_nombre: v },
                  }))
                }
              />
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                onClick={() => guardar(ed)}
                style={{
                  padding: '8px 18px',
                  background: GRANATE,
                  color: BLANCO,
                  border: `2px solid ${INK}`,
                  boxShadow: SHADOW_MINI,
                  borderRadius: 0,
                  fontFamily: FONT.heading,
                  fontSize: 12,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Guardar
              </button>
              {msg && (
                <span style={{ color: GRIS, fontSize: 12 }}>{msg}</span>
              )}
            </div>

            {soloEmilio && (
              <div style={{ marginTop: 20 }}>
                <div
                  style={{
                    fontFamily: FONT.heading,
                    fontSize: 11,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    color: GRIS,
                    marginBottom: 8,
                    fontWeight: 600,
                  }}
                >
                  IMPORTAR EXTRACTO BBVA (.xlsx / .xls)
                </div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '14px 18px',
                    background: BLANCO,
                    border: `2px dashed ${INK}`,
                    borderRadius: 0,
                    cursor: isSubiendo ? 'wait' : 'pointer',
                    opacity: isSubiendo ? 0.6 : 1,
                  }}
                >
                  <Upload size={18} color={GRANATE} />
                  <span style={{ color: INK, fontSize: 13 }}>
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
          </Papel>
        )
      })}

      {titulares.length === 0 && (
        <Papel ceja={GRIS} style={{ textAlign: 'center', color: GRIS }}>
          No hay titulares configurados.
        </Papel>
      )}
    </PantallaCantera>
  )
}

function Campo({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontFamily: FONT.heading,
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: GRIS,
          marginBottom: 4,
          fontWeight: 600,
        }}
      >
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: BLANCO,
          color: INK,
          border: `2px solid ${INK}`,
          borderRadius: 0,
          fontFamily: FONT.body,
          fontSize: 13,
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}
