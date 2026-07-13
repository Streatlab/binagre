/**
 * LAB · Muestrario — todos los elementos de la Ley Visual SL v2 en una pantalla.
 * Sirve para afinar el estilo de una vez y no ir pantalla por pantalla.
 * Datos de ejemplo: aquí no se consulta nada real.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  C, Hero, HeroPill, Kpi, KpiGrid, Card, CardHead, Pill, Atencion, Nota, Euro,
  LineaArea, Barras, Bar, InBar, Vacio, eur0, pct1, delta,
} from '@/components/panel/sl/uiSL'
import {
  PageHead, Tabs, Toolbar, Boton, Campo, Selector, Chips, Tabla, Fila, Celda,
  Modal, Skeleton, SkeletonTabla, Dropzone, Estado,
} from '@/components/panel/sl/uiSLTabla'

const PANTALLAS = [
  { to: '/lab/panel', titulo: 'Panel global', que: 'Hero, KPIs con tendencia, gráficos, tabla de canales' },
  { to: '/lab/conciliacion', titulo: 'Conciliación', que: 'Tabla densa, filtros, buscador, semáforo, ficha en modal' },
  { to: '/lab/tesoreria', titulo: 'Tesorería 13 semanas', que: 'Serie temporal, proyección, tabla con bandas' },
  { to: '/lab/escandallo', titulo: 'Escandallo', que: 'Pestañas con contador, fichas, listas, modal' },
]

const serie = [420, 510, 480, 640, 590, 720, 810, 690, 750, 880, 830, 910]
const etiquetas = ['1', '3', '5', '7', '9', '11']

export default function LabKit() {
  const [tab, setTab] = useState<'todo' | 'tablas' | 'formularios'>('todo')
  const [texto, setTexto] = useState('')
  const [sel, setSel] = useState<'a' | 'b'>('a')
  const [chip, setChip] = useState<'x' | 'y' | null>('x')
  const [modal, setModal] = useState(false)

  return (
    <div className="sl-skin" style={{ minHeight: '100vh', padding: '24px 28px' }}>
      <PageHead titulo="Laboratorio visual" sub="Ley Visual SL v2 · aquí se afina, no se rompe nada" />

      {/* Índice de pantallas espejo */}
      <Card>
        <CardHead title="Pantallas espejo" sub="Copias del ERP real. Los originales siguen intactos." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
          {PANTALLAS.map(p => (
            <Link key={p.to} to={p.to} style={{ textDecoration: 'none' }}>
              <div style={{
                border: `1px solid ${C.line}`, borderRadius: 14, padding: 14, background: C.track,
                height: '100%',
              }}>
                <div style={{ fontSize: 13.5, fontWeight: 900, color: C.ink, marginBottom: 4 }}>{p.titulo}</div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: C.grisCl, lineHeight: 1.45 }}>{p.que}</div>
                <div style={{ marginTop: 9, fontSize: 11.5, fontWeight: 900, color: C.rojo }}>Abrir →</div>
              </div>
            </Link>
          ))}
        </div>
      </Card>

      <Tabs
        activeId={tab}
        onChange={setTab}
        tabs={[
          { id: 'todo', label: 'Todo el kit' },
          { id: 'tablas', label: 'Tablas' },
          { id: 'formularios', label: 'Formularios' },
        ]}
      />

      {tab === 'todo' && (
        <>
          <Hero
            eyebrow="ESTO ES EL HERO"
            titular="El dato que manda va aquí, y solo uno"
            valor={eur0(28450)}
            sub="Con su comparación y su micrográfico. Un número nunca va solo."
            spark={serie}
            right={<><HeroPill solid>{delta(12.4)}</HeroPill><HeroPill>Objetivo 32.000 €</HeroPill></>}
            objetivo={{ pct: 89, label: 'OBJETIVO' }}
          />

          <Atencion tono="rojo" cifra="14" accion="Arreglarlo">
            Lo que está roto va arriba, con un botón que lleva a la solución. Nunca en una nota al pie.
          </Atencion>
          <Atencion tono="ambar" cifra="3" accion="Revisar">
            Ámbar: vigila esto, todavía no sangra.
          </Atencion>

          <KpiGrid cols={4}>
            <Kpi icono="€" tono="verde" label="Con tendencia" valor={eur0(12800)} spark={serie} delta={<Pill tone="verde">{delta(8.2)}</Pill>} pie={<div style={{ fontSize: 11.5, color: C.grisCl, fontWeight: 800 }}>Con pie explicativo</div>} />
            <Kpi icono="#" tono="blu" label="Informativo" valor="1.284" spark={serie} delta={<Pill tone="blu">Estable</Pill>} />
            <Kpi icono="!" tono="ambar" label="Vigilar" valor={pct1(62.5)} delta={<Pill tone="ambar">{delta(-2.1)}</Pill>} />
            <Kpi icono="↓" tono="rojo" label="Sangrando" valor={eur0(-1240)} delta={<Pill tone="rojo">{delta(-18.9)}</Pill>} />
          </KpiGrid>

          <Euro
            base={28450}
            tramos={[
              { label: 'Comisión plataformas', importe: 8250, color: C.rojoSem },
              { label: 'Materia prima', importe: 7900, color: C.naranja },
              { label: 'Personal', importe: 6100, color: C.amarillo, textoOscuro: true },
              { label: 'Te queda', importe: 6200, color: C.verde },
            ]}
            frase="Si falta el coste de un plato, este reparto miente. Mejor no pintarlo que pintarlo mal."
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12 }}>
            <Card>
              <CardHead title="Gráfico de línea con área" sub="Serie temporal" right={<Pill tone="neutro">12 puntos</Pill>} />
              <LineaArea puntos={serie} etiquetas={etiquetas} fmt={eur0} />
            </Card>
            <Card>
              <CardHead title="Barras y pesos" sub="Comparación directa" />
              <Barras datos={[
                { label: 'Uber', valor: 9800, color: '#06C167' },
                { label: 'Glovo', valor: 7400, color: C.amarillo },
                { label: 'JE', valor: 5200, color: C.naranja },
                { label: 'Web', valor: 3100, color: C.rojo },
              ]} fmt={eur0} />
              <div style={{ marginTop: 14 }}>
                <Bar label="Cobertura documental" valor="92%" pct={92} color={C.verde} />
                <Bar label="Ingredientes con precio" valor="61%" pct={61} color={C.ambar} />
              </div>
            </Card>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <Estado tono="verde">Te lo quedas</Estado>
            <Estado tono="rojo">Te lo quitan</Estado>
            <Estado tono="ambar">Vigila</Estado>
            <Estado tono="blu">Informativo</Estado>
            <Pill tone="neutro">Neutro</Pill>
          </div>

          <Nota tono="verde" accion="Ir a la acción">Toda observación acaba en un botón. Si no, sobra.</Nota>
          <Nota tono="rojo">Rojo: te está costando dinero ahora mismo.</Nota>

          <Card style={{ marginTop: 12 }}>
            <CardHead title="Estado vacío" />
            <Vacio>Aquí no hay nada todavía. Y se dice claro, sin adornos.</Vacio>
          </Card>

          <Card>
            <CardHead title="Carga" sub="Esqueleto mientras llegan los datos" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <Skeleton ancho="60%" />
              <Skeleton ancho="85%" />
              <Skeleton ancho="40%" />
            </div>
          </Card>
        </>
      )}

      {tab === 'tablas' && (
        <>
          <Toolbar right={<Campo valor={texto} onChange={setTexto} placeholder="Buscar…" />}>
            <Chips
              activo={chip}
              onChange={setChip}
              opciones={[{ id: 'x', label: 'Pendientes', count: 14 }, { id: 'y', label: 'Cuadrados', count: 128 }]}
            />
          </Toolbar>

          <Tabla cabeceras={[
            { label: 'Concepto' },
            { label: 'Proveedor', ancho: 160 },
            { label: 'Importe', alinea: 'der', ancho: 160 },
            { label: 'Estado', alinea: 'der', ancho: 140 },
          ]}>
            {[
              { c: 'Compra semanal', p: 'Alcampo', i: -412.55, t: 'verde' as const, e: 'Cuadrado' },
              { c: 'Comisión Glovo', p: 'Glovo', i: -1280.4, t: 'rojo' as const, e: 'Falta factura' },
              { c: 'Liquidación Uber', p: 'Uber Eats', i: 3410.2, t: 'blu' as const, e: 'Ingreso' },
              { c: 'Suministro luz', p: 'Iberdrola', i: -298.1, t: 'ambar' as const, e: 'Sin categoría' },
            ].map((r, i) => (
              <Fila key={i} tono={r.t} onClick={() => setModal(true)}>
                <Celda fuerte>{r.c}</Celda>
                <Celda style={{ color: C.grisCl }}>{r.p}</Celda>
                <Celda der>
                  <span className="slnum" style={{ fontWeight: 900, color: r.i >= 0 ? C.verde : C.ink }}>{eur0(r.i)}</span>
                  <InBar pct={(Math.abs(r.i) / 3410) * 100} color={r.i >= 0 ? C.verde : C.rojo} />
                </Celda>
                <Celda der><Estado tono={r.t}>{r.e}</Estado></Celda>
              </Fila>
            ))}
          </Tabla>

          <Nota tono="blu">La barra dentro de la celda deja comparar sin leer los números. La banda lateral es el estado.</Nota>

          <div style={{ marginTop: 14 }}>
            <SkeletonTabla filas={4} />
          </div>
        </>
      )}

      {tab === 'formularios' && (
        <>
          <Card>
            <CardHead title="Campos y botones" sub="Todo redondo, nada de bordes duros" />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
              <Campo valor={texto} onChange={setTexto} placeholder="Texto libre…" />
              <Selector valor={sel} onChange={setSel} opciones={[{ id: 'a', label: 'Opción A' }, { id: 'b', label: 'Opción B' }]} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Boton variante="primario" onClick={() => setModal(true)}>Acción principal</Boton>
              <Boton>Acción secundaria</Boton>
              <Boton variante="fantasma">Terciaria</Boton>
              <Boton variante="peligro">Borrar</Boton>
              <Boton disabled>Deshabilitada</Boton>
            </div>
          </Card>

          <Card>
            <CardHead title="Subida de documentos" sub="La bandeja de facturas empieza aquí" />
            <Dropzone />
            <Nota tono="ambar">Los documentos que no se leen bien se avisan aquí arriba, no en una lista escondida.</Nota>
          </Card>
        </>
      )}

      {modal && (
        <Modal
          titulo="Ventana modal"
          sub="Cabecera, cuerpo con scroll y pie con acciones"
          onClose={() => setModal(false)}
          pie={<><Boton onClick={() => setModal(false)}>Cancelar</Boton><Boton variante="primario" onClick={() => setModal(false)}>Guardar</Boton></>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Card style={{ marginBottom: 0 }}>
              <CardHead title="Importe" />
              <div className="slnum" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-1px' }}>{eur0(1280)}</div>
            </Card>
            <Card style={{ marginBottom: 0 }}>
              <CardHead title="Estado" />
              <Estado tono="rojo">Falta factura</Estado>
            </Card>
          </div>
          <Nota tono="rojo" accion="Buscar la factura">Sin factura no deduces el IVA.</Nota>
        </Modal>
      )}
    </div>
  )
}
