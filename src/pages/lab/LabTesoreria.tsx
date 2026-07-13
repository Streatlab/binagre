/**
 * LAB · Tesorería 13 semanas — pantalla espejo en Ley Visual SL v2.
 * Copia intocable: la Tesorería real sigue en neobrutal, sin tocar.
 * Elementos que aporta: serie temporal, tabla con semáforo y proyección.
 */
import {
  useTesoreria13Semanas, UMBRAL_VERDE,
  type SemanaTesoreria, type Estado as EstadoTes,
} from '@/lib/finanzas/useTesoreria13Semanas'
import {
  C, Hero, HeroPill, Kpi, KpiGrid, Card, CardHead, Pill, Atencion, Nota,
  LineaArea, InBar, Vacio, eur0, eur2,
} from '@/components/panel/sl/uiSL'
import { PageHead, Tabla, Fila, Celda, SkeletonTabla, Estado } from '@/components/panel/sl/uiSLTabla'

const TONO: Record<EstadoTes, 'verde' | 'ambar' | 'rojo'> = {
  verde: 'verde', ambar: 'ambar', rojo: 'rojo',
}
const TEXTO: Record<EstadoTes, string> = {
  verde: 'Holgado', ambar: 'Ajustado', rojo: 'En rojo',
}

export default function LabTesoreria() {
  const {
    loading, error, saldoInicial, saldoInicialFuente,
    semanas, semanaCritica, saldoMinimo,
    gastosFijosCount, gastoOperativoSemanal,
    nominaSemanal, segSocialSemanal,
  } = useTesoreria13Semanas()

  if (loading) {
    return (
      <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}>
        <PageHead titulo="Tesorería 13 semanas" sub="Pantalla espejo" />
        <SkeletonTabla filas={8} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}>
        <PageHead titulo="Tesorería 13 semanas" sub="Pantalla espejo" />
        <Atencion tono="rojo">No se ha podido calcular la previsión: {error}</Atencion>
      </div>
    )
  }

  const estadoMin: EstadoTes = semanaCritica?.estado ?? 'verde'
  const serie = semanas.map((s: SemanaTesoreria) => s.saldoAcumulado)
  const etiquetas = semanas.filter((_, i) => i % 3 === 0).map((s: SemanaTesoreria) => s.semana.slice(0, 6))
  const entradas = semanas.reduce((s: number, x: SemanaTesoreria) => s + x.entradas, 0)
  const salidas = semanas.reduce((s: number, x: SemanaTesoreria) => s + x.salidas, 0)
  const maxFlujo = Math.max(...semanas.map((s: SemanaTesoreria) => Math.max(s.entradas, s.salidas)), 1)
  const fuente = saldoInicialFuente === 'extracto' ? 'Extracto bancario real'
    : saldoInicialFuente === 'manual' ? 'Saldo introducido a mano'
    : 'Sin saldo disponible · se asume 0 €'

  return (
    <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}>
      <PageHead
        titulo="Tesorería 13 semanas"
        sub="Pantalla espejo · previsión de caja desde el próximo lunes"
        right={<Pill tone="neutro">{fuente}</Pill>}
      />

      <Hero
        eyebrow="SALDO PREVISTO MÁS BAJO"
        titular={semanaCritica ? `La semana peor es ${semanaCritica.semana}` : 'Sin semanas críticas'}
        valor={eur0(saldoMinimo)}
        sub={`Hoy tienes ${eur2(saldoInicial)} · umbral de seguridad ${eur0(UMBRAL_VERDE)}`}
        spark={semanas.map((s: SemanaTesoreria) => Math.max(0, s.saldoAcumulado))}
        right={
          <>
            <HeroPill solid>{TEXTO[estadoMin]}</HeroPill>
            <HeroPill>13 semanas vista</HeroPill>
          </>
        }
      />

      {estadoMin !== 'verde' && (
        <Atencion
          tono={TONO[estadoMin]}
          cifra={eur0(saldoMinimo)}
          accion="Ver la semana"
        >
          {estadoMin === 'rojo'
            ? 'La caja se te va a números rojos si no adelantas cobros o retrasas pagos.'
            : 'La caja aguanta pero sin colchón. Un imprevisto te deja en rojo.'}
        </Atencion>
      )}

      {gastosFijosCount === 0 && (
        <Atencion tono="ambar" accion="Cargar gastos fijos">
          No hay gastos fijos cargados (alquiler, nóminas, suscripciones). La previsión solo cuenta el gasto operativo
          estimado desde el banco: {eur2(gastoOperativoSemanal)} por semana. Los números van a salir mejor de lo real.
        </Atencion>
      )}

      <KpiGrid cols={4}>
        <Kpi
          icono="€" tono="blu" label="Saldo hoy" valor={eur0(saldoInicial)}
          pie={<div style={{ fontSize: 11.5, color: C.grisCl, fontWeight: 800 }}>{fuente}</div>}
        />
        <Kpi
          icono="↑" tono="verde" label="Entradas previstas" valor={eur0(entradas)}
          spark={semanas.map((s: SemanaTesoreria) => s.entradas)}
          pie={<div style={{ fontSize: 11.5, color: C.grisCl, fontWeight: 800 }}>Suma de las 13 semanas</div>}
        />
        <Kpi
          icono="↓" tono="rojo" label="Salidas previstas" valor={eur0(salidas)}
          spark={semanas.map((s: SemanaTesoreria) => s.salidas)}
          pie={<div style={{ fontSize: 11.5, color: C.grisCl, fontWeight: 800 }}>Nóminas {eur0(nominaSemanal)}/sem · SS {eur0(segSocialSemanal)}/sem</div>}
        />
        <Kpi
          icono="!" tono={TONO[estadoMin]} label="Saldo mínimo" valor={eur0(saldoMinimo)}
          pie={<div style={{ fontSize: 11.5, color: C.grisCl, fontWeight: 800 }}>{semanaCritica ? semanaCritica.semana : '—'}</div>}
        />
      </KpiGrid>

      <Card>
        <CardHead
          title="Cómo evoluciona la caja"
          sub="Saldo acumulado semana a semana"
          right={<Pill tone={TONO[estadoMin]} dot>{TEXTO[estadoMin]}</Pill>}
        />
        {semanas.length === 0 ? (
          <Vacio>Sin semanas que proyectar.</Vacio>
        ) : (
          <LineaArea puntos={serie} etiquetas={etiquetas} fmt={eur0} color={estadoMin === 'rojo' ? C.rojoSem : C.rojo} />
        )}
      </Card>

      <Tabla
        cabeceras={[
          { label: 'Semana' },
          { label: 'Entradas', alinea: 'der' },
          { label: 'Salidas', alinea: 'der' },
          { label: 'Saldo semana', alinea: 'der' },
          { label: 'Saldo acumulado', alinea: 'der' },
          { label: 'Estado', alinea: 'der', ancho: 130 },
        ]}
      >
        {semanas.map((s: SemanaTesoreria) => (
          <Fila key={s.index} tono={TONO[s.estado]}>
            <Celda fuerte>{s.semana}</Celda>
            <Celda der style={{ minWidth: 120 }}>
              <span className="slnum" style={{ color: C.verde, fontWeight: 900 }}>{eur0(s.entradas)}</span>
              <InBar pct={(s.entradas / maxFlujo) * 100} color={C.verde} />
            </Celda>
            <Celda der style={{ minWidth: 120 }}>
              <span className="slnum" style={{ color: C.naranja, fontWeight: 900 }}>{eur0(s.salidas)}</span>
              <InBar pct={(s.salidas / maxFlujo) * 100} color={C.naranja} />
            </Celda>
            <Celda der mono style={{ color: s.saldoSemana >= 0 ? C.verde : C.rojoSem }}>
              {eur0(s.saldoSemana)}
            </Celda>
            <Celda der mono fuerte style={{ color: s.saldoAcumulado >= 0 ? C.ink : C.rojoSem }}>
              {eur0(s.saldoAcumulado)}
            </Celda>
            <Celda der><Estado tono={TONO[s.estado]}>{TEXTO[s.estado]}</Estado></Celda>
          </Fila>
        ))}
      </Tabla>

      <Nota tono="blu">
        Verde: saldo por encima de {eur0(UMBRAL_VERDE)}. Ámbar: entre 0 € y el umbral. Rojo: caja negativa.
      </Nota>
    </div>
  )
}
