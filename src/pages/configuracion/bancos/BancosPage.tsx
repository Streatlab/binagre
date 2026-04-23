import { useState } from 'react'
import { ModTitle } from '@/components/configuracion/ModTitle'
import { ConfigShell } from '@/components/configuracion/ConfigShell'
import CategoriasPanel from './CategoriasPanel'
import ReglasPanel from './ReglasPanel'
import CuentasPanel from './CuentasPanel'

type Sub = 'categorias' | 'reglas' | 'cuentas'

const PILLS: { id: Sub; label: string }[] = [
  { id: 'categorias', label: 'Categorías de conciliación' },
  { id: 'reglas',     label: 'Reglas automáticas' },
  { id: 'cuentas',    label: 'Cuentas bancarias' },
]

export default function BancosPage() {
  const [sub, setSub] = useState<Sub>('categorias')
  return (
    <ConfigShell>
      <ModTitle>Bancos y cuentas</ModTitle>
      <div className="flex gap-1.5 flex-wrap mb-[18px]">
        {PILLS.map(p => (
          <button
            key={p.id}
            onClick={() => setSub(p.id)}
            className={sub === p.id
              ? 'px-3.5 py-[7px] rounded-md text-xs font-medium bg-[#FFF3B8] border border-[#E8D066] text-[#5a4d0a]'
              : 'px-3.5 py-[7px] rounded-md text-xs font-medium bg-white border border-[#E9E1D0] text-[#555] hover:bg-[#FAF4E4]'}
          >{p.label}</button>
        ))}
      </div>
      {sub === 'categorias' && <CategoriasPanel />}
      {sub === 'reglas' && <ReglasPanel />}
      {sub === 'cuentas' && <CuentasPanel />}
    </ConfigShell>
  )
}
