import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BigCard } from '@/components/configuracion/BigCard'
import type { MarcaPlataformaAcceso } from '@/types/configuracion'

interface MarcaUE {
  id: string
  nombre: string
  acceso?: MarcaPlataformaAcceso
}

export default function TabUsuariosMarcas() {
  const [marcas, setMarcas] = useState<MarcaUE[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    const { data, error } = await supabase
      .from('marcas')
      .select('id, nombre, accesos:marca_plataforma_acceso(id, plataforma, email_acceso, activo)')
      .order('nombre')
    if (error) throw error
    const ueMarcas: MarcaUE[] = (data ?? []).map((m: any) => ({
      id: m.id,
      nombre: m.nombre,
      acceso: m.accesos?.find((a: any) => a.plataforma === 'UE'),
    })).filter((m: MarcaUE) => m.acceso)
    setMarcas(ueMarcas)
  }

  useEffect(() => {
    (async () => {
      try { await refetch() }
      catch (e: any) { setError(e?.message ?? 'Error') }
      finally { setLoading(false) }
    })()
  }, [])

  async function updateEmail(accesoId: string, email: string) {
    const { error } = await supabase.from('marca_plataforma_acceso').update({ email_acceso: email || null }).eq('id', accesoId)
    if (error) { setError(error.message); return }
    await refetch()
  }

  async function toggleActivo(accesoId: string, actual: boolean) {
    const { error } = await supabase.from('marca_plataforma_acceso').update({ activo: !actual }).eq('id', accesoId)
    if (error) { setError(error.message); return }
    await refetch()
  }

  if (loading) return <div className="p-6 text-[#9E9588]">Cargando...</div>
  if (error) return <div className="p-6 bg-[#FCE0E2] text-[#D63A49] rounded-xl">{error}</div>

  return (
    <BigCard title="Accesos Uber Eats" count={`${marcas.length} marcas`}>
      <table className="w-full text-[13.5px] border-collapse">
        <thead>
          <tr>
            <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Marca</th>
            <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-left">Usuario</th>
            <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] text-center">Activo</th>
          </tr>
        </thead>
        <tbody>
          {marcas.map(m => (
            <tr key={m.id} className="border-b border-[#F0E8D5]">
              <td className="py-3.5 px-3.5"><strong>{m.nombre}</strong></td>
              <td className="py-3.5 px-3.5">
                <input
                  defaultValue={m.acceso?.email_acceso ?? ''}
                  onBlur={(e) => updateEmail(m.acceso!.id, e.target.value.trim())}
                  placeholder="email@ubereats.com"
                  className="w-full px-2 py-1 rounded-md border border-transparent hover:border-[#E9E1D0] focus:border-[#B01D23] focus:bg-white text-[12.5px] font-mono bg-transparent focus:outline-none"
                />
              </td>
              <td className="py-3.5 px-3.5 text-center">
                <Toggle checked={m.acceso?.activo ?? false} onChange={() => toggleActivo(m.acceso!.id, m.acceso!.activo)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </BigCard>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <label className="inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span className={`relative inline-block w-10 h-5 rounded-full transition-colors ${checked ? 'bg-[#22B573]' : 'bg-[#DDD4BF]'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </span>
    </label>
  )
}
