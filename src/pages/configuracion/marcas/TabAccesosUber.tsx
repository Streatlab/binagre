import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BigCard } from '@/components/configuracion/BigCard'

interface MarcaAccesoUE {
  id: string
  nombre: string
  acceso_id: string
  email_acceso: string | null
}

export default function TabAccesosUber() {
  const [marcas, setMarcas] = useState<MarcaAccesoUE[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    const { data, error } = await supabase
      .from('marcas')
      .select('id, nombre, accesos:marca_plataforma_acceso(id, plataforma, email_acceso, activo)')
      .order('nombre')
    if (error) throw error
    const resultado: MarcaAccesoUE[] = []
    for (const m of (data ?? [])) {
      const ue = (m as any).accesos?.find((a: any) => a.plataforma === 'UE' && a.activo)
      if (ue) resultado.push({ id: m.id, nombre: (m as any).nombre, acceso_id: ue.id, email_acceso: ue.email_acceso })
    }
    setMarcas(resultado)
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

  if (loading) return <div className="p-6 text-[#9E9588]">Cargando...</div>
  if (error) return <div className="p-6 bg-[#FCE0E2] text-[#D63A49] rounded-xl">{error}</div>

  return (
    <BigCard title="Accesos Uber" count={`${marcas.length} marcas`}>
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr>
            <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] font-medium text-left">Marca</th>
            <th className="py-3.5 px-3.5 border-b border-[#DDD4BF] text-[11px] tracking-[0.14em] uppercase text-[#9E9588] font-medium text-left">Usuario</th>
          </tr>
        </thead>
        <tbody>
          {marcas.map(m => (
            <tr key={m.id} className="border-b border-[#F0E8D5]">
              <td className="py-3.5 px-3.5"><strong>{m.nombre}</strong></td>
              <td className="py-3.5 px-3.5">
                <input
                  defaultValue={m.email_acceso ?? ''}
                  onBlur={(e) => updateEmail(m.acceso_id, e.target.value.trim())}
                  placeholder="email@ubereats.com"
                  className="w-full px-2 py-1 rounded-md border border-transparent hover:border-[#E9E1D0] focus:border-[#B01D23] focus:bg-white text-[12.5px] font-mono bg-transparent focus:outline-none"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </BigCard>
  )
}
