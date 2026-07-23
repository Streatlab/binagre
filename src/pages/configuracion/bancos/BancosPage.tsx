import { BLANCO, GRANATE, INK, OSW, SHADOW_MINI } from '@/styles/neobrutal'
import { useState } from 'react'
import { useTheme } from '@/styles/tokens'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { ConfigShell } from '@/components/configuracion/ConfigShell'
import CategoriasPanel from './CategoriasPanel'
import ReglasPanel from './ReglasPanel'
import CuentasPanel from './CuentasPanel'
import DrivePanel from './DrivePanel'
// Presupuestos mensuales → movido a Objetivos · Presupuesto de gastos (FASE 10.2)
// Provisiones IVA/IRPF → movido a PE · Tesorería futura (FASE 10.4)

type Sub = 'categorias' | 'reglas' | 'cuentas' | 'drive'

const PILLS: { id: Sub; label: string }[] = [
  { id: 'categorias',   label: 'Categorías de conciliación' },
  { id: 'reglas',       label: 'Reglas automáticas' },
  { id: 'cuentas',      label: 'Cuentas bancarias' },
  { id: 'drive',        label: 'Drive' },
]

export default function BancosPage() {
  const { T } = useTheme()
  const inicioDrive = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).toString().includes('drive_')
  const [sub, setSub] = useState<Sub>(inicioDrive ? 'drive' : 'categorias')

  return (
    <ConfigShell>
      <ModTitle>Bancos y cuentas</ModTitle>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {PILLS.map(p => {
          const isActive = sub === p.id
          return (
            <button
              key={p.id}
              onClick={() => setSub(p.id)}
              style={{
                padding: '7px 14px',
                borderRadius: 0,
                fontFamily: OSW,
                fontSize: 11,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                fontWeight: isActive ? 700 : 500,
                background: isActive ? GRANATE : T.card,
                color: isActive ? BLANCO : T.sec,
                border: `2px solid ${isActive ? INK : T.brd}`,
                boxShadow: isActive ? SHADOW_MINI : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >{p.label}</button>
          )
        })}
      </div>
      {sub === 'categorias' && <CategoriasPanel />}
      {sub === 'reglas' && <ReglasPanel />}
      {sub === 'cuentas' && <CuentasPanel />}
      {sub === 'drive' && <DrivePanel />}
    </ConfigShell>
  )
}
