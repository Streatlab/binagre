/**
 * Conciliación en Ley Visual SL v2 (con acento oliva).
 * Se ve al pulsar SL en el interruptor. Solo lectura: no toca datos.
 */
import { useMemo, useState } from 'react'
import { useConciliacion } from '@/hooks/useConciliacion'
import {
  C, Hero, HeroPill, Card, CardHead, Kpi, KpiGrid, Pill, Atencion, Nota, Vacio, InBar,
  Barras, eur2, eur0, num0, pct1,
} from '@/components/panel/sl/uiSL'
import {
  PageHead, Toolbar, Campo, Tabla, Fila, Celda, Modal, Boton, SkeletonTabla, Estado,
} from '@/components/panel/sl/uiSLTabla'
import {
  OLIVA, KpiFoco, Ranking, Leyenda, BotonFoco, ChipsFoco, AnilloHero,
} from '@/components/panel/sl/uiSLFoco'

type Filtro = 'sin_categoria' | 'sin_factura' | 'con_factura' | 'sin_titular' | 'ingresos' | 'gastos'

interface Mov {
  id: string
  fecha: string
  concepto: string
  importe: number
  categoria: string | null
  proveedor: string | null
  factura_id: string | null
  titular_id: string | null
  doc: string
}

const IVA = 0.21

export default function LabConciliacion() {
  const { movimientos: raw, categorias } = useConciliacion()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro | null>(null)
  const [detalle, setDetalle] = useState<Mov | null>(null)

  const cargando = raw.length === 0

  const movs: Mov[] = useMemo(() => raw.map(m => ({
    id: m.id,
    fecha: m.fecha,
    concepto: m.concepto,
    importe: Number(m.importe),
    categoria: m.categoria ?? null,
    proveedor: m.proveedor ?? null,
    factura_id: m.factura_id ?? null,
    titular_id: m.titular_id ?? null,
    doc: m.doc_estado_real ?? 'falta',
  })), [raw])

  const nombreCat = useMemo(() => {
    const m: Record<string, string> = {}
    categorias.forEach((c: any) => { m[c.codigo] = `${c.codigo} · ${c.nombre ?? ''}`.trim() })
    return m
  }, [categorias])

  const d = useMemo(() => {
    const gastos = movs.filter(m => m.importe < 0)
    const ingresos = movs.filter(m => m.importe > 0)
    const sinFactura = gastos.filter(m => !m.factura_id)
    const sinCat = movs.filter(m => !m.categoria)
    const conFactura = movs.filter(m => !!m.factura_id)
    const sinTitular = movs.filter(m => !m.titular_id)

    const importeSinFactura = sinFactura.reduce((s, m) => s + Math.abs(m.importe), 0)
    const totalGasto = gastos.reduce((s, m) => s + Math.abs(m.importe), 0)
    const totalIngreso = ingresos.reduce((s, m) => s + m.importe, 0)
    const cobertura = gastos.length > 0 ? ((gastos.length - sinFactura.length) / gastos.length) * 100 : 100

    const porProveedor: Record<string, number> = {}
    sinFactura.forEach(m => {
      const p = m.proveedor || 'Sin proveedor'
      porProveedor[p] = (porProveedor[p] ?? 0) + Math.abs(m.importe)
    })
    const ranking = Object.entries(porProveedor)
      .map(([label, valor]) => ({ label, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5)

    // Gasto por día: en rojo los días con algún gasto sin factura
    const porDia: Record<string, { total: number; roto: boolean }> = {}
    gastos.forEach(m => {
      const k = m.fecha
      if (!porDia[k]) porDia[k] = { total: 0, roto: false }
      porDia[k].total += Math.abs(m.importe)
      if (!m.factura_id) porDia[k].roto = true
    })
    const dias = Object.entries(porDia)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-16)
      .map(([fecha, v]) => ({
        label: fecha.slice(8, 10),
        valor: Math.round(v.total),
        color: v.roto ? C.rojoSem : C.naranja,
      }))

    return {
      sinFactura, sinCat, conFactura, sinTitular, importeSinFactura,
      totalGasto, totalIngreso, cobertura, ranking, dias,
      nGastos: gastos.length,
    }
  }, [movs])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return movs
      .filter(m => {
        if (!filtro) return true
        if (filtro === 'sin_categoria') return !m.categoria
        if (filtro === 'sin_factura') return m.importe < 0 && !m.factura_id
        if (filtro === 'con_factura') return !!m.factura_id
        if (filtro === 'sin_titular') return !m.titular_id
        if (filtro === 'ingresos') return m.importe > 0
        if (filtro === 'gastos') return m.importe < 0
        return true
      })
      .filter(m => !q || m.concepto.toLowerCase().includes(q) || (m.proveedor ?? '').toLowerCase().includes(q))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 150)
  }, [movs, filtro, busca])

  const maxImporte = Math.max(...filtrados.map(m => Math.abs(m.importe)), 1)

  const tonoFila = (m: Mov) => {
    if (!m.categoria) return 'ambar' as const
    if (m.importe < 0 && !m.factura_id) return 'rojo' as const
    if (m.importe > 0) return 'verde' as const
    return 'verde' as const
  }
  const textoEstado = (m: Mov) => {
    if (!m.categoria) return 'Sin categoría'
    if (m.importe < 0 && !m.factura_id) return 'Falta factura'
    if (m.importe > 0) return 'Ingreso'
    return 'Cuadrado'
  }

  const top = d.ranking[0]

  return (
    <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}>
      <PageHead
        titulo="Conciliación"
        sub="Vista SL · solo lectura, no toca datos"
        right={<Pill tone="neutro">{num0(movs.length)} movimientos</Pill>}
      />

      <Hero
        eyebrow="GASTO SIN FACTURA"
        titular={`${num0(d.sinFactura.length)} movimientos pagados que no puedes deducir`}
        valor={eur0(d.importeSinFactura)}
        sub={`Cobertura documental ${pct1(d.cobertura)} · ${num0(d.nGastos - d.sinFactura.length)} de ${num0(d.nGastos)} gastos con factura`}
        right={
          <>
            <HeroPill solid>IVA en riesgo {eur0(d.importeSinFactura * IVA)}</HeroPill>
            <AnilloHero pct={d.cobertura} label="CUADRADO" />
          </>
        }
      />

      {d.sinFactura.length > 0 && (
        <Atencion
          tono="rojo"
          cifra={num0(d.sinFactura.length)}
          accion="Ver los que faltan"
          onAccion={() => setFiltro('sin_factura')}
        >
          Cada gasto sin factura es IVA que no te devuelven. Empieza por el proveedor que más te debe.
        </Atencion>
      )}

      <KpiGrid cols={4}>
        <Kpi
          icono="✓" tono="verde" label="Cuadrados" valor={num0(d.conFactura.length)}
          pie={<div style={{ fontSize: 11.5, color: C.grisCl, fontWeight: 800 }}>Con factura asociada</div>}
        />
        <Kpi
          icono="!" tono="rojo" label="Falta factura" valor={num0(d.sinFactura.length)}
          delta={<Pill tone="rojo">{eur0(d.importeSinFactura)}</Pill>}
          pie={<div style={{ fontSize: 11.5, color: C.grisCl, fontWeight: 800 }}>Gastos pagados sin justificar</div>}
        />
        <Kpi
          icono="?" tono={d.sinCat.length > 0 ? 'ambar' : 'verde'} label="Sin categoría" valor={num0(d.sinCat.length)}
          pie={<div style={{ fontSize: 11.5, color: C.grisCl, fontWeight: 800 }}>No entran en el P&amp;L</div>}
        />
        <KpiFoco
          label="Foco de la semana"
          valor={top ? eur0(top.valor) : eur0(0)}
          accion={top ? `Reclamar a ${top.label}` : 'Nada que reclamar'}
          onAccion={() => setFiltro('sin_factura')}
        />
      </KpiGrid>

      {cargando ? (
        <SkeletonTabla filas={8} />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 12 }}>
            <Card>
              <CardHead title="Cómo va el mes" sub="Gasto por día" />
              <Leyenda items={[
                { label: 'Gasto cuadrado', color: C.naranja },
                { label: 'Día con gasto sin factura', color: C.rojoSem },
              ]} />
              {d.dias.length === 0
                ? <Vacio>Sin gasto registrado todavía.</Vacio>
                : <Barras datos={d.dias} fmt={eur0} />}
            </Card>

            <Card>
              <CardHead title="Quién te falta por justificar" sub="Proveedores sin factura" />
              {d.ranking.length === 0 ? (
                <Vacio>Todo justificado. Nada que reclamar.</Vacio>
              ) : (
                <Ranking
                  filas={d.ranking.map((r, i) => ({ ...r, color: i === 0 ? C.rojoSem : C.naranja }))}
                  fmt={eur0}
                  pie={
                    <>
                      <span style={{ fontSize: 11, fontWeight: 800, color: C.grisCl }}>Reclamables ya</span>
                      <BotonFoco onClick={() => setFiltro('sin_factura')}>
                        Pedir {num0(d.ranking.length)} facturas
                      </BotonFoco>
                    </>
                  }
                />
              )}
            </Card>
          </div>

          <Toolbar right={<Campo valor={busca} onChange={setBusca} placeholder="Buscar concepto o proveedor…" ancho={240} />}>
            <ChipsFoco
              activo={filtro}
              onChange={setFiltro}
              opciones={[
                { id: 'sin_factura', label: 'Falta factura', count: d.sinFactura.length },
                { id: 'sin_categoria', label: 'Sin categoría', count: d.sinCat.length },
                { id: 'con_factura', label: 'Cuadrados', count: d.conFactura.length },
                { id: 'sin_titular', label: 'Sin titular', count: d.sinTitular.length },
                { id: 'ingresos', label: 'Ingresos' },
                { id: 'gastos', label: 'Gastos' },
              ]}
            />
          </Toolbar>

          {filtrados.length === 0 ? (
            <Card><Vacio>Ningún movimiento con esos filtros.</Vacio></Card>
          ) : (
            <Tabla
              cabeceras={[
                { label: 'Fecha', ancho: 92 },
                { label: 'Concepto' },
                { label: 'Importe', alinea: 'der', ancho: 160 },
                { label: 'Estado', alinea: 'der', ancho: 140 },
              ]}
            >
              {filtrados.map(m => {
                const entra = m.importe > 0
                return (
                  <Fila key={m.id} tono={tonoFila(m)} onClick={() => setDetalle(m)}>
                    <Celda mono>{m.fecha.slice(8, 10)}/{m.fecha.slice(5, 7)}</Celda>
                    <Celda fuerte style={{ maxWidth: 360 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.concepto}</div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.grisCl }}>
                        {(m.proveedor || 'sin proveedor')} · {m.categoria ? (nombreCat[m.categoria] ?? m.categoria) : 'sin clasificar'}
                      </div>
                    </Celda>
                    <Celda der>
                      <span className="slnum" style={{ fontWeight: 900, color: entra ? OLIVA.hondo : C.ink }}>
                        {eur2(m.importe)}
                      </span>
                      <InBar
                        pct={(Math.abs(m.importe) / maxImporte) * 100}
                        color={entra ? OLIVA.medio : C.rojo}
                      />
                    </Celda>
                    <Celda der>
                      {entra
                        ? <span style={{
                            background: OLIVA.soft, color: OLIVA.hondo, borderRadius: 999,
                            padding: '3px 10px', fontSize: 11, fontWeight: 900,
                          }}>Ingreso</span>
                        : <Estado tono={tonoFila(m)}>{textoEstado(m)}</Estado>}
                    </Celda>
                  </Fila>
                )
              })}
            </Tabla>
          )}

          <Nota tono="blu">
            La banda de color de cada fila es el estado: rojo falta factura, ámbar sin categoría, verde cuadrado.
            El oliva marca lo que entra.
          </Nota>
        </>
      )}

      {detalle && (
        <Modal
          titulo={detalle.concepto}
          sub={`${detalle.fecha} · ${detalle.proveedor || 'sin proveedor'}`}
          onClose={() => setDetalle(null)}
          pie={<Boton variante="primario" onClick={() => setDetalle(null)}>Cerrar</Boton>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <Card style={{ marginBottom: 0 }}>
              <CardHead title="Importe" />
              <div className="slnum" style={{
                fontSize: 26, fontWeight: 800, letterSpacing: '-1px',
                color: detalle.importe >= 0 ? OLIVA.hondo : C.ink,
              }}>
                {eur2(detalle.importe)}
              </div>
            </Card>
            <Card style={{ marginBottom: 0 }}>
              <CardHead title="Estado" />
              <Estado tono={tonoFila(detalle)}>{textoEstado(detalle)}</Estado>
              <div style={{ marginTop: 10, fontSize: 12, color: C.grisCl, fontWeight: 800 }}>
                Documento: {detalle.doc}
              </div>
            </Card>
          </div>

          <Card style={{ marginTop: 12, marginBottom: 0 }}>
            <CardHead title="Categoría" sub="Del plan de gastos" />
            <div style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>
              {detalle.categoria ? (nombreCat[detalle.categoria] ?? detalle.categoria) : 'Sin categorizar'}
            </div>
          </Card>

          {!detalle.factura_id && detalle.importe < 0 && (
            <Nota tono="rojo">
              Sin factura no puedes deducir el IVA de este gasto: {eur2(Math.abs(detalle.importe) * IVA)}.
            </Nota>
          )}
        </Modal>
      )}
    </div>
  )
}
