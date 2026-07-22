/**
 * FichaEmpleadoAcumulados — 6 mini-cards con los acumulados anuales reales de
 * un empleado (bruto, neto pagado real, IRPF, SS empresa, coste real,
 * diferencias). Fuente: useFichaEmpleado. Compartido entre TabNominas y la
 * ficha financiera del empleado (ModalEmpleado).
 */
import { useFichaEmpleado } from '@/lib/equipo/useFichaEmpleado'
import { fmtEur } from '@/lib/format'
import { OSW, LEX, INK, SHADOW, BORDER_CARD, GRANATE, AMA, VERDE, ROJO, NAR, AZUL, GRIS, eyebrow, BLANCO } from '@/styles/neobrutal'

const card: React.CSSProperties = { background: BLANCO, border: BORDER_CARD, boxShadow: SHADOW }

export default function FichaEmpleadoAcumulados({ empleadoId, anio }: { empleadoId: string; anio: number }) {
  const { loading, error, ficha } = useFichaEmpleado(empleadoId, anio)
  if (loading) return <div style={{ padding: '10px 0', color: GRIS, fontFamily: LEX, fontSize: 12 }}>Cargando ficha…</div>
  if (error || !ficha) return null
  const items: [string, number, string][] = [
    ['Bruto acumulado', ficha.brutoAcumulado, INK],
    ['Neto pagado real', ficha.netoPagadoReal, VERDE],
    ['IRPF acumulado (Hacienda)', ficha.irpfAcumulado, NAR],
    ['SS empresa acumulada', ficha.ssEmpresaAcumulada, AZUL],
    ['Coste real total', ficha.costeRealTotal, GRANATE],
    ['Diferencias acumuladas', ficha.diferenciasAcumuladas, ficha.diferenciasAcumuladas < 0 ? ROJO : ficha.diferenciasAcumuladas > 0 ? AZUL : GRIS],
  ]
  return (
    <div style={{ marginBottom: 18 }}>
      <span style={eyebrow(AMA, INK)}>FICHA DEL EMPLEADO · {anio}</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 10 }}>
        {items.map(([label, val, color]) => (
          <div key={label} style={{ ...card, padding: '10px 12px' }}>
            <div style={{ fontFamily: OSW, fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', color: GRIS, marginBottom: 4 }}>{label}</div>
            <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 17, color }}>{fmtEur(val, { decimals: 2, signed: label === 'Diferencias acumuladas' })}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
