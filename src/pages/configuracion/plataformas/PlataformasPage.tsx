import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ConfigShell } from '@/components/configuracion/ConfigShell'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { useTheme, FONT } from '@/styles/tokens'

interface Canal {
  id: string
  nombre: string
  comision_pct: number | null
  comision_fija: number | null
  activo: boolean
}

const CICLOS_PAGO: Record<string, string> = {
  'Uber Eats': 'Lunes semanal (lunes a domingo anterior)',
  'uber eats': 'Lunes semanal (lunes a domingo anterior)',
  'Glovo':     '1-15 paga día 5 mes siguiente · 16-fin paga día 20 mes siguiente',
  'Just Eat':  '1-15 paga día 20 mismo mes · 16-fin paga día 5 mes siguiente',
  'Web':       'Pendiente definir',
  'Directa':   'Al día',
}

function getCiclo(nombre: string): string {
  const n = nombre.toLowerCase()
  if (n.includes('uber')) return CICLOS_PAGO['Uber Eats']
  if (n.includes('glovo')) return CICLOS_PAGO['Glovo']
  if (n.includes('just') || n.includes('eat')) return CICLOS_PAGO['Just Eat']
  if (n.includes('web')) return CICLOS_PAGO['Web']
  if (n.includes('direct')) return CICLOS_PAGO['Directa']
  return '—'
}

export default function PlataformasPage() {
  const { T } = useTheme()
  const [canales, setCanales] = useState<Canal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('config_canales').select('*').order('nombre').then(({ data }) => {
      setCanales(data ?? [])
      setLoading(false)
    })
  }, [])

  return (
    <ConfigShell>
      <ModTitle>Plataformas y canales</ModTitle>
      <div style={{ fontFamily: FONT.body, fontSize: 13, color: T.sec, marginBottom: 20 }}>
        Ciclos de pago y comisiones por plataforma. Las comisiones se usan para calcular ingresos netos.
      </div>

      {loading ? (
        <div style={{ color: T.mut, fontFamily: FONT.body }}>Cargando...</div>
      ) : (
        <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0a0a0a' }}>
                <th style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '10px 14px', textAlign: 'left' }}>Canal</th>
                <th style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '10px 14px', textAlign: 'right' }}>Comisión %</th>
                <th style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '10px 14px', textAlign: 'right' }}>Fija/pedido</th>
                <th style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '10px 14px', textAlign: 'left' }}>Ciclo de pago</th>
                <th style={{ fontFamily: FONT.heading, fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T.mut, padding: '10px 14px', textAlign: 'center' }}>Activo</th>
              </tr>
            </thead>
            <tbody>
              {canales.map(c => (
                <tr key={c.id} style={{ borderTop: `1px solid ${T.brd}` }}>
                  <td style={{ fontFamily: FONT.body, fontSize: 13, color: T.pri, padding: '12px 14px', fontWeight: 500 }}>{c.nombre}</td>
                  <td style={{ fontFamily: FONT.heading, fontSize: 13, color: '#e8f442', padding: '12px 14px', textAlign: 'right' }}>
                    {c.comision_pct != null ? `${c.comision_pct}%` : '—'}
                  </td>
                  <td style={{ fontFamily: FONT.heading, fontSize: 13, color: T.sec, padding: '12px 14px', textAlign: 'right' }}>
                    {c.comision_fija != null ? `${c.comision_fija}€` : '—'}
                  </td>
                  <td style={{ fontFamily: FONT.body, fontSize: 12, color: T.sec, padding: '12px 14px' }}>{getCiclo(c.nombre)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: c.activo ? '#06C167' : '#555' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ConfigShell>
  )
}
