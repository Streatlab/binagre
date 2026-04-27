import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ConfigShell } from '@/components/configuracion/ConfigShell'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { useTheme, FONT } from '@/styles/tokens'
import { fmtEur } from '@/utils/format'

interface Cuenta {
  id: string
  nombre: string
  titular: string | null
  tipo: string | null
  saldo_actual: number | null
  activa: boolean
}

const DRIVE_FOLDER_ID = '1dB6REknvNl8JxGGuv8MXloUCJ3_evd7H'

export default function CuentasPage() {
  const { T } = useTheme()
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [loading, setLoading] = useState(true)
  const [driveConectado, setDriveConectado] = useState(false)

  useEffect(() => {
    supabase.from('cuentas_bancarias').select('*').order('nombre').then(({ data }) => {
      setCuentas(data ?? [])
      setLoading(false)
    })
    // Check if Drive OAuth token exists
    supabase.from('google_oauth_tokens').select('id', { count: 'exact', head: true }).then(({ count }) => {
      setDriveConectado((count ?? 0) > 0)
    })
  }, [])

  return (
    <ConfigShell>
      <ModTitle>Cuentas y conexiones</ModTitle>

      {/* Cuentas bancarias */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 12, color: '#e8f442', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12 }}>
          Cuentas bancarias
        </div>
        {loading ? (
          <div style={{ color: T.mut, fontFamily: FONT.body }}>Cargando...</div>
        ) : cuentas.length === 0 ? (
          <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.mut }}>No hay cuentas bancarias configuradas.</div>
        ) : (
          <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0a0a0a' }}>
                  <th style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '8px 14px', textAlign: 'left' }}>Cuenta</th>
                  <th style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '8px 14px', textAlign: 'left' }}>Titular</th>
                  <th style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '8px 14px', textAlign: 'right' }}>Saldo</th>
                  <th style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '8px 14px', textAlign: 'center' }}>Activa</th>
                </tr>
              </thead>
              <tbody>
                {cuentas.map(c => (
                  <tr key={c.id} style={{ borderTop: `1px solid ${T.brd}` }}>
                    <td style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri, padding: '10px 14px' }}>{c.nombre}</td>
                    <td style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, padding: '10px 14px' }}>{c.titular ?? '—'}</td>
                    <td style={{ fontFamily: FONT.heading, fontSize: 13, color: '#06C167', padding: '10px 14px', textAlign: 'right' }}>
                      {c.saldo_actual != null ? fmtEur(c.saldo_actual) : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: c.activa ? '#06C167' : '#555' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Google Drive */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 12, color: '#e8f442', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12 }}>
          Google Drive
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 10, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 24 }}>📁</span>
          <div>
            <div style={{ fontFamily: FONT.body, fontSize: 14, color: T.pri, marginBottom: 4 }}>
              Drive Operaciones · {driveConectado ? (
                <span style={{ color: '#06C167', fontWeight: 600 }}>Conectado</span>
              ) : (
                <span style={{ color: '#B01D23', fontWeight: 600 }}>Desconectado</span>
              )}
            </div>
            <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut }}>
              rubenrodriguezvinagre@gmail.com · Carpeta ID: {DRIVE_FOLDER_ID}
            </div>
            <div style={{ fontFamily: FONT.body, fontSize: 12, color: T.mut, marginTop: 4 }}>
              Usado para almacenar facturas PDF y documentos de conciliación.
            </div>
          </div>
          <a
            href={`https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}`}
            target="_blank"
            rel="noreferrer"
            style={{ marginLeft: 'auto', background: '#222', color: T.sec, border: `1px solid #383838`, borderRadius: 6, padding: '6px 14px', fontFamily: FONT.heading, fontSize: 11, textDecoration: 'none', cursor: 'pointer' }}
          >
            Abrir Drive
          </a>
        </div>
      </div>
    </ConfigShell>
  )
}
