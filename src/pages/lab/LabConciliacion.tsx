/**
 * LAB · Conciliación — pantalla espejo en Ley Visual SL v2.
 * Copia intocable: la Conciliación real sigue intacta.
 * Aquí viven los elementos densos: tabla, filtros, buscador, semáforo y ficha.
 * Solo lectura: desde el laboratorio no se modifica ningún dato.
 */
import { useMemo, useState } from 'react'
import { useConciliacion } from '@/hooks/useConciliacion'
import {
  C, Card, CardHead, Kpi, KpiGrid, Pill, Atencion, Nota, Vacio, InBar,
  eur2, eur0, num0, pct1,
} from '@/components/panel/sl/uiSL'
import {
  PageHead, Toolbar, Campo, Chips, Tabla, Fila, Celda, Modal, Boton,
  SkeletonTabla, Estado,
} from '@/components/panel/sl/uiSLTabla'

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

  const cuentas = useMemo(() => {
    const sinCat = movs.filter(m => !m.categoria).length
    const gastos = movs.filter(m => m.importe < 0)
    const sinFactura = gastos.filter(m => !m.factura_id).length
    const conFactura = movs.filter(m => !!m.factura_id).length
    const sinTitular = movs.filter(m => !m.titular_id).length
    const totalGasto = gastos.reduce((s, m) => s + Math.abs(m.importe), 0)
    const totalIngreso = movs.filter(m => m.importe > 0).reduce((s, m) => s + m.importe, 0)
    const cobertura = gastos.length > 0 ? ((gastos.length - sinFactura) / gastos.length) * 100 : 100
    return { sinCat, sinFactura, conFactura, sinTitular, totalGasto, totalIngreso, cobertura, nGastos: gastos.length }
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
    if (m.factura_id) return 'verde' as const
    return 'blu' as const
  }
  const textoEstado = (m: Mov) => {
    if (!m.categoria) return 'Sin categoría'
    if (m.importe < 0 && !m.factura_id) return 'Falta factura'
    if (m.factura_id) return 'Cuadrado'
    return 'Ingreso'
  }

  return (
    <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}>
      <PageHead
        titulo="Conciliación"
        sub="Pantalla espejo · solo lectura, no toca datos"
        right={<Pill tone="neutro">{num0(movs.length)} movimientos</Pill>}
      />

      {cuentas.sinFactura > 0 && (
        <Atencion
          tono="rojo"
          cifra={num0(cuentas.sinFactura)}
          accion="Ver los que faltan"
          onAccion={() => setFiltro('sin_factura')}
        >
          Gastos pagados sin factura asociada. Cada uno es IVA que no te devuelven.
        </Atencion>
      )}

      <KpiGrid cols={4}>
        <Kpi
          icono="✓" tono={cuentas.cobertura >= 90 ? 'verde' : 'ambar'}
          label="Cobertura documental" valor={pct1(cuentas.cobertura)}
          pie={<div style={{ fontSize: 11.5, color: C.grisCl, fontWeight: 800 }}>{num0(cuentas.nGastos - cuentas.sinFactura)} de {num0(cuentas.nGastos)} gastos con factura</div>}
        />
        <Kpi
          icono="?" tono={cuentas.sinCat > 0 ? 'ambar' : 'verde'}
          label="Sin categorizar" valor={num0(cuentas.sinCat)}
          pie={<div style={{ fontSize: 11.5, color: C.grisCl, fontWeight: 800 }}>No entran en el P&amp;L hasta clasificarlos</div>}
        />
        <Kpi
          icono="↑" tono="verde" label="Ingresos" valor={eur0(cuentas.totalIngreso)}
          pie={<div style={{ fontSize: 11.5, color: C.grisCl, fontWeight: 800 }}>Todo lo que ha entrado en banco</div>}
        />
        <Kpi
          icono="↓" tono="rojo" label="Gastos" valor={eur0(cuentas.totalGasto)}
          pie={<div style={{ fontSize: 11.5, color: C.grisCl, fontWeight: 800 }}>Todo lo que ha salido</div>}
        />
      </KpiGrid>

      <Toolbar
        right={<Campo valor={busca} onChange={setBusca} placeholder="Buscar concepto o proveedor…" ancho={240} />}
      >
        <Chips
          activo={filtro}
          onChange={setFiltro}
          opciones={[
            { id: 'sin_categoria', label: 'Sin categoría', count: cuentas.sinCat },
            { id: 'sin_factura', label: 'Falta factura', count: cuentas.sinFactura },
            { id: 'con_factura', label: 'Cuadrados', count: cuentas.conFactura },
            { id: 'sin_titular', label: 'Sin titular', count: cuentas.sinTitular },
            { id: 'ingresos', label: 'Ingresos' },
            { id: 'gastos', label: 'Gastos' },
          ]}
        />
      </Toolbar>

      {cargando ? (
        <SkeletonTabla filas={8} />
      ) : filtrados.length === 0 ? (
        <Card><Vacio>Ningún movimiento con esos filtros.</Vacio></Card>
      ) : (
        <>
          <Tabla
            cabeceras={[
              { label: 'Fecha', ancho: 96 },
              { label: 'Concepto' },
              { label: 'Proveedor', ancho: 170 },
              { label: 'Categoría', ancho: 180 },
              { label: 'Importe', alinea: 'der', ancho: 150 },
              { label: 'Estado', alinea: 'der', ancho: 140 },
            ]}
          >
            {filtrados.map(m => (
              <Fila key={m.id} tono={tonoFila(m)} onClick={() => setDetalle(m)}>
                <Celda mono>{m.fecha.slice(8, 10)}/{m.fecha.slice(5, 7)}</Celda>
                <Celda fuerte style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.concepto}
                </Celda>
                <Celda style={{ color: C.grisCl }}>{m.proveedor || '—'}</Celda>
                <Celda style={{ color: C.grisCl, fontSize: 11.5 }}>
                  {m.categoria ? (nombreCat[m.categoria] ?? m.categoria) : <Pill tone="ambar">Pendiente</Pill>}
                </Celda>
                <Celda der>
                  <span className="slnum" style={{ fontWeight: 900, color: m.importe >= 0 ? C.verde : C.ink }}>
                    {eur2(m.importe)}
                  </span>
                  <InBar pct={(Math.abs(m.importe) / maxImporte) * 100} color={m.importe >= 0 ? C.verde : C.rojo} />
                </Celda>
                <Celda der><Estado tono={tonoFila(m)}>{textoEstado(m)}</Estado></Celda>
              </Fila>
            ))}
          </Tabla>

          <Nota tono="blu">
            La banda de color de cada fila es el estado: verde cuadrado, rojo falta factura, ámbar sin categoría.
            Se lee sin necesidad de mirar la última columna.
          </Nota>
        </>
      )}

      {detalle && (
        <Modal
          titulo={detalle.concepto}
          sub={`${detalle.fecha} · ${detalle.proveedor || 'sin proveedor'}`}
          onClose={() => setDetalle(null)}
          pie={
            <>
              <Boton onClick={() => setDetalle(null)}>Cerrar</Boton>
              <Boton variante="primario" onClick={() => setDetalle(null)}>Abrir en Conciliación real</Boton>
            </>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <Card style={{ marginBottom: 0 }}>
              <CardHead title="Importe" />
              <div className="slnum" style={{ fontSize: 26, fontWeight: 800, color: detalle.importe >= 0 ? C.verde : C.ink, letterSpacing: '-1px' }}>
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
            <Nota tono="rojo" accion="Buscar la factura">
              Este gasto no tiene factura asociada. Sin ella no puedes deducir el IVA.
            </Nota>
          )}
        </Modal>
      )}
    </div>
  )
}
