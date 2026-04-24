import { useState } from 'react'
import { useTheme, FONT } from '@/styles/tokens'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { ConfigShell } from '@/components/configuracion/ConfigShell'
import CategoriasPanel from './CategoriasPanel'
import ReglasPanel from './ReglasPanel'
import CuentasPanel from './CuentasPanel'
import PresupuestosPanel from './PresupuestosPanel'
import ProvisionesPanel from './ProvisionesPanel'
import DrivePanel from './DrivePanel'

type Sub = 'categorias' | 'reglas' | 'cuentas' | 'presupuestos' | 'provisiones' | 'drive'

const PILLS: { id: Sub; label: string }[] = [
  { id: 'categorias',   label: 'Categorías de conciliación' },
  { id: 'reglas',       label: 'Reglas automáticas' },
  { id: 'cuentas',      label: 'Cuentas bancarias' },
  { id: 'presupuestos', label: 'Presupuestos mensuales' },
  { id: 'provisiones',  label: 'Provisiones IVA/IRPF' },
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
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        {PILLS.map(p => {
          const isActive = sub === p.id
          return (
            <button
              key={p.id}
              onClick={() => setSub(p.id)}
              style={{
                padding: '7px 14px',
                borderRadius: 6,
                fontFamily: FONT.heading,
                fontSize: 11,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                fontWeight: isActive ? 600 : 500,
                background: isActive ? '#B01D23' : T.card,
                color: isActive ? '#ffffff' : T.sec,
                border: `0.5px solid ${isActive ? '#B01D23' : T.brd}`,
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
      {sub === 'presupuestos' && <PresupuestosPanel />}
      {sub === 'provisiones' && <ProvisionesPanel />}
      {sub === 'drive' && <DrivePanel />}
    </ConfigShell>
  )
}
