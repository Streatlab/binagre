import { GRIS, INK, CREMA, GRANATE, VERDE, VERDE_S, ROSA_S, AZUL, OSW, LEX, pill } from '@/styles/neobrutal'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ConfigShell } from '@/components/configuracion/ConfigShell'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { PantallaCantera, HeroCantera, Papel } from '@/components/kit/cantera'
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

  const activas = cuentas.filter(c => c.activa).length

  return (
    <ConfigShell>
      <ModTitle>Cuentas y conexiones</ModTitle>

      <PantallaCantera embedded>
        <HeroCantera
          area="equipo"
          titular="Así tienes conectadas tus cuentas y accesos"
          etiquetaDato="Cuentas bancarias activas"
          cifra={loading ? undefined : activas}
          resumen={<>{loading ? 'Cargando…' : `${cuentas.length} cuentas dadas de alta`} · Google Drive {driveConectado ? 'conectado' : 'desconectado'}</>}
        />

        {/* Cuentas bancarias */}
        <Papel ceja={VERDE} pad="0" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 700, fontSize: 13, letterSpacing: '1.5px', textTransform: 'uppercase', color: INK }}>
            Cuentas bancarias
          </div>
          {loading ? (
            <div style={{ padding: 20, fontFamily: LEX, fontSize: 13, color: GRIS }}>Cargando…</div>
          ) : cuentas.length === 0 ? (
            <div style={{ padding: 20, fontFamily: LEX, fontSize: 13, color: GRIS, fontWeight: 600 }}>No hay cuentas bancarias configuradas.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: INK }}>
                    <th style={{ fontFamily: OSW, fontWeight: 600, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, padding: '9px 14px', textAlign: 'left' }}>Cuenta</th>
                    <th style={{ fontFamily: OSW, fontWeight: 600, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, padding: '9px 14px', textAlign: 'left' }}>Titular</th>
                    <th style={{ fontFamily: OSW, fontWeight: 600, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, padding: '9px 14px', textAlign: 'right' }}>Saldo</th>
                    <th style={{ fontFamily: OSW, fontWeight: 600, fontSize: 10.5, letterSpacing: '1.2px', textTransform: 'uppercase', color: CREMA, padding: '9px 14px', textAlign: 'center' }}>Activa</th>
                  </tr>
                </thead>
                <tbody>
                  {cuentas.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: LEX, fontSize: 13, padding: '10px 14px', borderBottom: `2px solid ${INK}` }}>{c.nombre}</td>
                      <td style={{ fontFamily: LEX, fontSize: 13, padding: '10px 14px', borderBottom: `2px solid ${INK}` }}>{c.titular ?? '—'}</td>
                      <td style={{ fontFamily: OSW, fontWeight: 700, fontSize: 13, color: VERDE, padding: '10px 14px', borderBottom: `2px solid ${INK}`, textAlign: 'right' }}>
                        {c.saldo_actual != null ? fmtEur(c.saldo_actual) : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', borderBottom: `2px solid ${INK}`, textAlign: 'center' }}>
                        <span style={pill(c.activa ? VERDE_S : ROSA_S, c.activa ? VERDE : GRANATE)}>{c.activa ? 'Activa' : 'Inactiva'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Papel>

        {/* Google Drive */}
        <Papel ceja={AZUL} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 24 }}>📁</span>
          <div>
            <div style={{ fontFamily: LEX, fontSize: 14, color: INK, marginBottom: 4, fontWeight: 600 }}>
              Drive Operaciones · <span style={pill(driveConectado ? VERDE_S : ROSA_S, driveConectado ? VERDE : GRANATE)}>{driveConectado ? 'Conectado' : 'Desconectado'}</span>
            </div>
            <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>
              rubenrodriguezvinagre@gmail.com · Carpeta ID: {DRIVE_FOLDER_ID}
            </div>
            <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS, marginTop: 4 }}>
              Usado para almacenar facturas PDF y documentos de conciliación.
            </div>
          </div>
          <a
            href={`https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}`}
            target="_blank"
            rel="noreferrer"
            style={{ marginLeft: 'auto', background: 'transparent', color: INK, border: `2px solid ${INK}`, borderRadius: 0, padding: '8px 14px', fontFamily: OSW, fontWeight: 700, fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', textDecoration: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Abrir Drive
          </a>
        </Papel>
      </PantallaCantera>
    </ConfigShell>
  )
}
