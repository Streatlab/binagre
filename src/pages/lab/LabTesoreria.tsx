/**
 * Tesorería 13 semanas en Ley Visual SL v2 (con acento oliva).
 * Se ve al pulsar SL en el interruptor. El oliva marca lo que entra.
 * Responsive según la receta de uiSLMovil.
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
import { OLIVA, KpiFoco, Leyenda, AnilloHero } from '@/components/panel/sl/uiSLFoco'
import { useMovil } from '@/components/panel/sl/uiSLMovil'

const TONO: Record<EstadoTes, 'verde' | 'ambar' | 'rojo'> = {
  verde: 'verde', ambar: 'ambar', rojo: 'rojo',
}
const TEXTO: Record<EstadoTes, string> = {
  verde: 'Holgado', ambar: 'Ajustado', rojo: 'En rojo',
}

export default function LabTesoreria() {
  const movil = useMovil()
  const {
    loading, error, saldoInicial, saldoInicialFuente,
    semanas, semanaCritica, saldoMinimo,
    gastosFijosCount, gastoOperativoSemanal,
    nominaSemanal, segSocialSemanal,
  } = useTesoreria13Semanas()

  const pad = movil ? '14px 12px' : '24px 28px'

  if (loading) {
    return (
      <div className="sl-skin" style={{ minHeight: '100vh', padding: pad }}>
        <PageHead titulo="Tesorería 13 semanas" sub="Vista SL" />
        <SkeletonTabla filas={8} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="sl-skin" style={{ minHeight: '100vh', padding: pad }}>
        <PageHead titulo="Tesorería 13 semanas" sub="Vista SL" />
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
  const colchon = UMBRAL_VERDE > 0 ? Math.min(100, (saldoMinimo / UMBRAL_VERDE) * 100) : 0
  const fuente = saldoInicialFuente === 'extracto' ? 'Extracto bancario real'
    : saldoInicialFuente === 'manual' ? 'Saldo introducido a mano'
    : 'Sin saldo disponible · se asume 0 €'

  return (
    <div className="sl-skin" style={{ minHeight: '100vh', padding: pad }}>
      <PageHead
        titulo="Tesorería 13 semanas"
        sub="Vista SL · previsión de caja desde el próximo lunes"
        right={<Pill tone="neutro">{fuente}</Pill>}
      />

      <Hero
        eyebrow="SALDO PREVISTO MÁS BAJO"
        titular={semanaCritica ? `La semana peor es ${semanaCritica.semana}` : 'Ninguna semana en apuros'}
        valor={eur0(saldoMinimo)}
        sub={`Hoy tienes ${eur2(saldoInicial)} · colchón de seguridad ${eur0(UMBRAL_VERDE)}`}
        spark={semanas.map((s: SemanaTesoreria) => Math.max(0, s.saldoAcumulado))}
        right={
          <>
            <HeroPill solid>{TEXTO[estadoMin]}</HeroPill>
            <AnilloHero pct={Math.max(0, colchon)} label="COLCHÓN" />
          </>
        }
      />

      {estadoMin !== 'verde' && (
        <Atencion tono={TONO[estadoMin]} cifra={eur0(saldoMinimo)} accion="Ver la semana">
          {estadoMin === 'rojo'
            ? 'La caja se va a números rojos si no adelantas cobros o retrasas pagos.'
            : 'La caja aguanta pero sin colchón. Un imprevisto te deja en rojo.'}
        </Atencion>
      )}

      {gastosFijosCount === 0 && (
        <Atencion tono="ambar" accion="Cargar gastos fijos">
          No hay gastos fijos cargados (alquiler, nóminas, suscripciones). La previsión solo cuenta el gasto operativo
          estimado del banco: {eur2(gastoOperativoSemanal)} por semana. Los números salen mejor de lo real.
        </Atencion>
      )}

      <KpiGrid cols={movil ? 2 : 4}>
        <Kpi
          icono="€" tono="blu" label="Saldo hoy" valor={eur0(saldoInicial)}
          pie={<div style={{ fontSize: 11.5, color: C.grisCl, fontWeight: 800 }}>{fuente}</div>}
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
        <KpiFoco
          label="Lo que entra en 13 semanas"
          valor={eur0(entradas)}
          pie={`${eur0(entradas / Math.max(1, semanas.length))} por semana de media`}
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

      <Leyenda items={[
        { label: 'Entra', color: OLIVA.medio },
        { label: 'Sale', color: C.naranja },
        { label: 'Semana en rojo', color: C.rojoSem },
      ]} />

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
            <Celda fuerte style={{ whiteSpace: 'nowrap' }}>{s.semana}</Celda>
            <Celda der style={{ minWidth: movil ? 100 : 120 }}>
              <span className="slnum" style={{ color: OLIVA.hondo, fontWeight: 900 }}>{eur0(s.entradas)}</span>
              <InBar pct={(s.entradas / maxFlujo) * 100} color={OLIVA.medio} />
            </Celda>
            <Celda der style={{ minWidth: movil ? 100 : 120 }}>
              <span className="slnum" style={{ color: C.naranja, fontWeight: 900 }}>{eur0(s.salidas)}</span>
              <InBar pct={(s.salidas / maxFlujo) * 100} color={C.naranja} />
            </Celda>
            <Celda der mono style={{ color: s.saldoSemana >= 0 ? OLIVA.hondo : C.rojoSem }}>
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
        Verde: saldo por encima de {eur0(UMBRAL_VERDE)}. Ámbar: entre 0 € y ese colchón. Rojo: caja negativa.
        En pantalla pequeña la tabla se desliza de lado.
      </Nota>
    </div>
  )
}
