import { fmtEur } from '@/lib/format'
import { CANALCARD } from '@/styles/palettes'

type CanalColor = 'ue' | 'gl' | 'je'

const COLORS: Record<CanalColor, { bg: string; border: string; text: string; val: string }> = CANALCARD

export function CanalCard({
  color, label, bruto, pedidos,
}: {
  color: CanalColor
  label: string
  bruto: number
  pedidos: number
}) {
  const c = COLORS[color]
  return (
    <div className="rounded-xl p-5 border-2" style={{ backgroundColor: c.bg, borderColor: c.border }}>
      <div className="text-[11px] tracking-[0.14em] font-bold uppercase mb-3" style={{ color: c.text }}>{label}</div>
      <div className="text-[28px] font-extrabold leading-none" style={{ color: c.val }}>{fmtEur(bruto)}</div>
      <div className="text-[11px] mt-2 opacity-70" style={{ color: c.text }}>{pedidos} pedidos</div>
    </div>
  )
}
