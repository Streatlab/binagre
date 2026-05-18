import React, { useState } from 'react';

// ════════════════════════════════════════════════════════════════
// MÓDULO RECLAMACIONES / REEMBOLSOS
// Gestión de reembolsos descontados por plataformas (UE/GL/JE)
// y seguimiento hasta su cobro en facturas posteriores.
// ════════════════════════════════════════════════════════════════

type EstadoReclamacion = 'pendiente' | 'reclamada' | 'cobrada' | 'rechazada';
type Canal = 'ue' | 'gl' | 'je' | 'web';
type TipoIncidencia =
  | 'prod_faltante'
  | 'prod_erroneo'
  | 'mala_calidad'
  | 'ped_cancelado'
  | 'cobro_incorrecto'
  | 'otro';

interface Reclamacion {
  id: string;
  fecha: string;
  canal: Canal;
  numPedido: string;
  tipo: TipoIncidencia;
  marca: string;
  descripcion: string;
  importe: number;
  estado: EstadoReclamacion;
  tieneFoto: boolean;
  cobradoEn?: string;
}

// MOCK DATA — sustituir por fetch a Supabase tabla `reclamaciones`
const MOCK_DATA: Reclamacion[] = [
  { id: '1', fecha: '23 abr', canal: 'ue', numPedido: '#A7F2-994', tipo: 'prod_faltante', marca: 'Binagre', descripcion: 'Croquetas no llegaron en el pedido', importe: 11.35, estado: 'reclamada', tieneFoto: true },
  { id: '2', fecha: '22 abr', canal: 'gl', numPedido: '#GL-8812', tipo: 'mala_calidad', marca: 'Binagre', descripcion: 'Cliente dice que el cocido llegó frío', importe: 26.95, estado: 'pendiente', tieneFoto: true },
  { id: '3', fecha: '20 abr', canal: 'ue', numPedido: '#A7F2-881', tipo: 'ped_cancelado', marca: 'Ninja Ramen', descripcion: 'Cancelación sin motivo tras 40min', importe: 18.50, estado: 'reclamada', tieneFoto: false },
  { id: '4', fecha: '18 abr', canal: 'je', numPedido: '#JE-3301', tipo: 'prod_erroneo', marca: 'Mister Katsu', descripcion: 'Enviaron ramen en lugar de katsu curry', importe: 12.95, estado: 'cobrada', tieneFoto: true, cobradoEn: 'Fact. abr-26' },
  { id: '5', fecha: '15 abr', canal: 'gl', numPedido: '#GL-7744', tipo: 'prod_faltante', marca: 'Binagre', descripcion: 'Faltaba la guarnición de patatas', importe: 3.95, estado: 'rechazada', tieneFoto: true },
  { id: '6', fecha: '12 abr', canal: 'ue', numPedido: '#A7F2-720', tipo: 'mala_calidad', marca: 'Binagre', descripcion: 'Foto del plato muestra presentación correcta', importe: 9.95, estado: 'cobrada', tieneFoto: true, cobradoEn: 'Fact. abr-26' },
  { id: '7', fecha: '10 abr', canal: 'je', numPedido: '#JE-2988', tipo: 'prod_faltante', marca: 'Korean Chicken', descripcion: 'Salsas no incluidas en el pedido', importe: 3.00, estado: 'pendiente', tieneFoto: false },
];

const TIPO_LABEL: Record<TipoIncidencia, string> = {
  prod_faltante: 'Prod. faltante',
  prod_erroneo: 'Prod. erróneo',
  mala_calidad: 'Mala calidad',
  ped_cancelado: 'Ped. cancelado',
  cobro_incorrecto: 'Cobro incorrecto',
  otro: 'Otro',
};

const ESTADO_LABEL: Record<EstadoReclamacion, string> = {
  pendiente: 'Pendiente',
  reclamada: 'Reclamada',
  cobrada: 'Cobrada',
  rechazada: 'Rechazada',
};

const ESTADO_SHORT: Record<EstadoReclamacion, string> = {
  pendiente: 'Pend.',
  reclamada: 'Recl.',
  cobrada: 'Cobr.',
  rechazada: 'Rech.',
};

const CANAL_LABEL: Record<Canal, string> = {
  ue: 'Uber Eats',
  gl: 'Glovo',
  je: 'Just Eat',
  web: 'Web',
};

const fmt = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

export default function ReclamacionReembolsos() {
  const [tab, setTab] = useState<'todas' | EstadoReclamacion>('todas');
  const [modalNueva, setModalNueva] = useState(false);
  const [modalImportar, setModalImportar] = useState(false);

  // KPIs calculados
  const totalAbiertas = MOCK_DATA.filter(r => r.estado === 'pendiente' || r.estado === 'reclamada');
  const importeEnRiesgo = totalAbiertas.reduce((s, r) => s + r.importe, 0);
  const totalCobradas = MOCK_DATA.filter(r => r.estado === 'cobrada');
  const cobrado = totalCobradas.reduce((s, r) => s + r.importe, 0);
  const totalRechazadas = MOCK_DATA.filter(r => r.estado === 'rechazada');
  const perdido = totalRechazadas.reduce((s, r) => s + r.importe, 0);
  const totalResueltas = totalCobradas.length + totalRechazadas.length;
  const tasaResolucion = totalResueltas > 0 ? Math.round((totalCobradas.length / totalResueltas) * 100) : 0;
  const totalReclamado = MOCK_DATA.reduce((s, r) => s + r.importe, 0);

  const pendientes = MOCK_DATA.filter(r => r.estado === 'pendiente');
  const reclamadas = MOCK_DATA.filter(r => r.estado === 'reclamada');

  // Por canal
  const porCanal = (c: Canal) => {
    const items = MOCK_DATA.filter(r => r.canal === c);
    const enRiesgo = items.filter(r => r.estado === 'pendiente' || r.estado === 'reclamada').reduce((s, r) => s + r.importe, 0);
    const cob = items.filter(r => r.estado === 'cobrada').reduce((s, r) => s + r.importe, 0);
    const resueltas = items.filter(r => r.estado === 'cobrada' || r.estado === 'rechazada');
    const tasa = resueltas.length > 0 ? Math.round((items.filter(r => r.estado === 'cobrada').length / resueltas.length) * 100) : 0;
    return { enRiesgo, cob, total: items.length, tasa };
  };

  const ue = porCanal('ue');
  const gl = porCanal('gl');
  const je = porCanal('je');

  // Filtros
  const filtradas = tab === 'todas' ? MOCK_DATA : MOCK_DATA.filter(r => r.estado === tab);

  return (
    <div style={{ background: '#edecea', minHeight: '100vh', padding: 16, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#B01D23', textTransform: 'uppercase', letterSpacing: 0.3 }}>
            Reclamaciones
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setModalImportar(true)} style={btnGhost}>📄 Importar factura</button>
            <button onClick={() => setModalNueva(true)} style={btnRed}>+ Nueva</button>
          </div>
        </div>

        {/* TOP: 2 cards de resumen */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>

          <SummaryCard
            header="SITUACIÓN ACTUAL"
            value={fmt(importeEnRiesgo)}
            valueColor="#B01D23"
            sublabel="en riesgo"
            barPct={Math.min(100, (importeEnRiesgo / totalReclamado) * 100)}
            barColor="#B01D23"
            lines={[
              { label: 'Pendientes de enviar', value: pendientes.length.toString(), valueColor: '#b06000', extra: fmt(pendientes.reduce((s, r) => s + r.importe, 0)) },
              { label: 'Reclamadas a plataforma', value: reclamadas.length.toString(), valueColor: '#2255bb', extra: fmt(reclamadas.reduce((s, r) => s + r.importe, 0)) },
              { label: 'Tiempo medio respuesta', value: '18 días' },
            ]}
          />

          <SummaryCard
            header="RESULTADOS 2026"
            value={fmt(cobrado)}
            valueColor="#1a8a45"
            sublabel={`cobrado · ${tasaResolucion}% tasa`}
            sublabelColor="#1a8a45"
            barPct={tasaResolucion}
            barColor="#1a8a45"
            lines={[
              { label: 'Total reclamado 2026', value: fmt(totalReclamado) },
              { label: 'Rechazado / perdido', value: fmt(perdido), valueColor: '#B01D23', extra: `${totalRechazadas.length} recl.` },
              { label: 'Este mes', value: fmt(cobrado), valueColor: '#1a8a45', extra: `${totalCobradas.length} recl.` },
            ]}
          />

        </div>

        {/* CANAL CARDS */}
        <div style={sectionLabel}>RECLAMACIONES POR CANAL</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
          <CanalCard label="Uber Eats" bg="#dbf0e4" border="#b7ddc5" labelColor="#06873f" valueColor="#06873f" enRiesgo={ue.enRiesgo} cobrado={ue.cob} total={ue.total} tasa={ue.tasa} />
          <CanalCard label="Glovo" bg="#f7f2cc" border="#e5dc8a" labelColor="#8a7000" valueColor="#8a7000" enRiesgo={gl.enRiesgo} cobrado={gl.cob} total={gl.total} tasa={gl.tasa} />
          <CanalCard label="Just Eat" bg="#fce4c8" border="#f0c590" labelColor="#b06000" valueColor="#b06000" enRiesgo={je.enRiesgo} cobrado={je.cob} total={je.total} tasa={je.tasa} />
          <div style={{ ...canalCardBase, background: '#f7d4d4', borderColor: '#e5a8a8' }}>
            <div style={{ ...canalLabel, color: '#900' }}>Web</div>
            <div style={{ color: '#888', fontSize: 11, fontStyle: 'italic', padding: '10px 0' }}>Sin reclamaciones</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: '#999' }}>
              <span>Gestión directa con cliente</span>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 10, overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: 2 }}>
          {([
            { key: 'todas', label: 'Todas', count: MOCK_DATA.length },
            { key: 'pendiente', label: 'Pendientes', count: pendientes.length },
            { key: 'reclamada', label: 'Reclamadas', count: reclamadas.length },
            { key: 'cobrada', label: 'Cobradas', count: totalCobradas.length },
            { key: 'rechazada', label: 'Rechazadas', count: totalRechazadas.length },
          ] as const).map(t => (
            <div
              key={t.key}
              onClick={() => setTab(t.key as any)}
              style={tab === t.key ? tabActive : tabInactive}
            >
              {t.label} <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 3 }}>{t.count}</span>
            </div>
          ))}
        </div>

        {/* CONTROLS */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 11, flexWrap: 'wrap' }}>
          <select style={selectStyle}>
            <option>Abril 2026</option><option>Marzo 2026</option><option>Febrero 2026</option>
          </select>
          <select style={selectStyle}>
            <option>Todas las plataformas</option><option>Uber Eats</option><option>Glovo</option><option>Just Eat</option>
          </select>
          <select style={selectStyle}>
            <option>Todos los tipos</option><option>Prod. faltante</option><option>Mala calidad</option><option>Ped. cancelado</option>
          </select>
        </div>

        {/* TABLA */}
        <div style={{ background: '#fff', border: '1px solid #dedad5', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thBase }} rowSpan={2}>FECHA</th>
                  <th style={{ ...thBase }} rowSpan={2}>PEDIDO</th>
                  <th style={{ ...thBase }} rowSpan={2}>TIPO</th>
                  <th style={{ ...thCanal, background: '#edf8f2', color: '#1a8a45' }} colSpan={2}>UBER EATS</th>
                  <th style={{ ...thCanal, background: '#fdfae8', color: '#8a7000' }} colSpan={2}>GLOVO</th>
                  <th style={{ ...thCanal, background: '#fdf4e7', color: '#b06000' }} colSpan={2}>JUST EAT</th>
                  <th style={{ ...thBase, textAlign: 'center' }} rowSpan={2}>EST.</th>
                  <th style={{ ...thBase, textAlign: 'right' }} rowSpan={2}>COBRO</th>
                  <th style={{ ...thBase, textAlign: 'center' }} rowSpan={2}>📷</th>
                  <th style={{ ...thBase, borderRight: 'none' }} rowSpan={2}></th>
                </tr>
                <tr>
                  <th style={{ ...thSub, background: '#edf8f2' }}>IMP.</th>
                  <th style={{ ...thSub, background: '#edf8f2' }}>EST.</th>
                  <th style={{ ...thSub, background: '#fdfae8' }}>IMP.</th>
                  <th style={{ ...thSub, background: '#fdfae8' }}>EST.</th>
                  <th style={{ ...thSub, background: '#fdf4e7' }}>IMP.</th>
                  <th style={{ ...thSub, background: '#fdf4e7' }}>EST.</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f0eeea' }}>
                    <td style={tdDate}>{r.fecha}</td>
                    <td style={tdRef}>{r.numPedido}</td>
                    <td style={tdTipo}>{TIPO_LABEL[r.tipo]}</td>
                    {/* UE */}
                    {r.canal === 'ue' ? (
                      <>
                        <td style={{ ...tdEur, color: '#1a8a45' }}>{fmt(r.importe)}</td>
                        <td style={tdEst}><EstadoBadge estado={r.estado} short /></td>
                      </>
                    ) : (
                      <><td style={tdDash}>—</td><td style={tdDash}>—</td></>
                    )}
                    {/* GL */}
                    {r.canal === 'gl' ? (
                      <>
                        <td style={{ ...tdEur, color: '#8a7000' }}>{fmt(r.importe)}</td>
                        <td style={tdEst}><EstadoBadge estado={r.estado} short /></td>
                      </>
                    ) : (
                      <><td style={tdDash}>—</td><td style={tdDash}>—</td></>
                    )}
                    {/* JE */}
                    {r.canal === 'je' ? (
                      <>
                        <td style={{ ...tdEur, color: '#b06000' }}>{fmt(r.importe)}</td>
                        <td style={tdEst}><EstadoBadge estado={r.estado} short /></td>
                      </>
                    ) : (
                      <><td style={tdDash}>—</td><td style={tdDash}>—</td></>
                    )}
                    <td style={tdEst}><EstadoBadge estado={r.estado} /></td>
                    <td style={{ ...tdRight, fontSize: 10, fontWeight: 600, color: r.cobradoEn ? '#1a8a45' : '#ddd', whiteSpace: 'nowrap' }}>
                      {r.cobradoEn || '—'}
                    </td>
                    <td style={{ ...tdEst, color: r.tieneFoto ? '#1a8a45' : '#ddd', fontSize: r.tieneFoto ? 13 : 12 }}>
                      {r.tieneFoto ? '📷' : '—'}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <button style={actionBtn}>✏️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={tableFooter}>
            <span>Reclamado: <strong style={{ marginLeft: 4, color: '#B01D23' }}>-{fmt(totalReclamado)}</strong></span>
            <span>Cobrado: <strong style={{ marginLeft: 4, color: '#1a8a45' }}>+{fmt(cobrado)}</strong></span>
            <span>Pendiente: <strong style={{ marginLeft: 4, color: '#B01D23' }}>-{fmt(importeEnRiesgo)}</strong></span>
          </div>
        </div>

      </div>

      {/* MODAL NUEVA */}
      {modalNueva && (
        <ModalOverlay onClose={() => setModalNueva(false)}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #ece9e4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#B01D23', textTransform: 'uppercase' }}>Nueva reclamación</span>
            <button onClick={() => setModalNueva(false)} style={modalCloseBtn}>✕</button>
          </div>
          <div style={{ padding: '15px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div style={sepStyle}>Pedido</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Plataforma"><select style={fieldInput}><option>Seleccionar...</option><option>Uber Eats</option><option>Glovo</option><option>Just Eat</option><option>Web</option></select></Field>
              <Field label="Nº Pedido"><input type="text" style={fieldInput} placeholder="#A7F2-994" /></Field>
              <Field label="Fecha"><input type="date" style={fieldInput} /></Field>
              <Field label="Importe (€)"><input type="text" style={fieldInput} placeholder="0,00" /></Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Tipo"><select style={fieldInput}><option>Producto faltante</option><option>Producto erróneo</option><option>Mala calidad</option><option>Pedido cancelado</option><option>Cobro incorrecto</option><option>Otro</option></select></Field>
              <Field label="Marca"><select style={fieldInput}><option>Binagre</option><option>Ninja Ramen</option><option>Mister Katsu</option><option>Korean Chicken</option><option>Fish & Chips</option><option>French TacOH</option></select></Field>
            </div>
            <Field label="Justificación" full><textarea style={{ ...fieldInput, minHeight: 55, resize: 'vertical' }} placeholder="Describe la incidencia..." /></Field>
            <div style={sepStyle}>Evidencia</div>
            <div style={uploadZone}>
              <div style={{ fontSize: 18 }}>📷</div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>Arrastra la foto o <strong style={{ color: '#B01D23' }}>selecciona archivo</strong> · JPG, PNG · 10MB</div>
            </div>
            <div style={sepStyle}>Estado</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Estado"><select style={fieldInput}><option>Pendiente</option><option>Reclamada</option></select></Field>
              <Field label="Fecha envío"><input type="date" style={fieldInput} /></Field>
            </div>
          </div>
          <div style={{ padding: '10px 16px', borderTop: '1px solid #ece9e4', display: 'flex', justifyContent: 'flex-end', gap: 7 }}>
            <button onClick={() => setModalNueva(false)} style={btnGhost}>Cancelar</button>
            <button style={btnRed}>Guardar</button>
          </div>
        </ModalOverlay>
      )}

      {/* MODAL IMPORTAR */}
      {modalImportar && (
        <ModalOverlay onClose={() => setModalImportar(false)} width={400}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #ece9e4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#B01D23', textTransform: 'uppercase' }}>Importar factura</span>
            <button onClick={() => setModalImportar(false)} style={modalCloseBtn}>✕</button>
          </div>
          <div style={{ padding: '15px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div style={{ fontSize: 11, color: '#2255bb', background: '#eaf0fd', border: '1px solid #b0c8f0', borderRadius: 4, padding: '8px 11px', lineHeight: 1.5 }}>
              Importa la factura CSV o PDF. El sistema cruza importes y marca como <strong>Cobradas</strong> las que aparezcan compensadas.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Plataforma"><select style={fieldInput}><option>Seleccionar...</option><option>Uber Eats</option><option>Glovo</option><option>Just Eat</option></select></Field>
              <Field label="Período"><select style={fieldInput}><option>Abril 2026</option><option>Marzo 2026</option></select></Field>
            </div>
            <div style={uploadZone}>
              <div style={{ fontSize: 18 }}>📄</div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>Arrastra la factura o <strong style={{ color: '#B01D23' }}>selecciona archivo</strong> · CSV, PDF · 20MB</div>
            </div>
          </div>
          <div style={{ padding: '10px 16px', borderTop: '1px solid #ece9e4', display: 'flex', justifyContent: 'flex-end', gap: 7 }}>
            <button onClick={() => setModalImportar(false)} style={btnGhost}>Cancelar</button>
            <button style={btnRed}>Procesar</button>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SUBCOMPONENTES
// ════════════════════════════════════════════════════════════════

function SummaryCard({ header, value, valueColor, sublabel, sublabelColor, barPct, barColor, lines }: {
  header: string;
  value: string;
  valueColor: string;
  sublabel: string;
  sublabelColor?: string;
  barPct: number;
  barColor: string;
  lines: { label: string; value: string; valueColor?: string; extra?: string }[];
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid #dedad5', borderRadius: 6, padding: '13px 16px' }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: '#aaa', marginBottom: 10 }}>{header}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: valueColor }}>{value}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: sublabelColor || '#999' }}>{sublabel}</div>
      </div>
      <div style={{ height: 4, background: '#f0eeea', borderRadius: 2, overflow: 'hidden', margin: '6px 0 10px' }}>
        <div style={{ height: '100%', borderRadius: 2, background: barColor, width: `${barPct}%` }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, padding: '2px 0' }}>
            <span style={{ color: '#777', fontSize: 11 }}>{l.label}</span>
            <span>
              <span style={{ fontWeight: 600, color: l.valueColor || '#1a1a1a', fontSize: 11 }}>{l.value}</span>
              {l.extra && <span style={{ color: '#aaa', fontSize: 10, marginLeft: 6 }}>{l.extra}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CanalCard({ label, bg, border, labelColor, valueColor, enRiesgo, cobrado, total, tasa }: {
  label: string; bg: string; border: string; labelColor: string; valueColor: string;
  enRiesgo: number; cobrado: number; total: number; tasa: number;
}) {
  return (
    <div style={{ ...canalCardBase, background: bg, borderColor: border }}>
      <div style={{ ...canalLabel, color: labelColor }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', lineHeight: 1 }}>{fmt(enRiesgo)}</div>
        <div style={{ fontSize: 10, color: '#888' }}>en riesgo</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1, color: valueColor }}>{fmt(cobrado)}</div>
        <div style={{ fontSize: 10, color: '#888' }}>cobrado</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: '#666', paddingTop: 7, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
        <span>{total} reclamaciones</span>
        <strong>Tasa {tasa}%</strong>
      </div>
    </div>
  );
}

function EstadoBadge({ estado, short }: { estado: EstadoReclamacion; short?: boolean }) {
  const styles: Record<EstadoReclamacion, React.CSSProperties> = {
    pendiente: { background: '#fef3e0', color: '#b06000', border: '1px solid #f0c070' },
    reclamada: { background: '#eaf0fd', color: '#2255bb', border: '1px solid #b0c8f0' },
    cobrada:   { background: '#e8f7ef', color: '#06873f', border: '1px solid #b3dfc4' },
    rechazada: { background: '#fdeaea', color: '#900',    border: '1px solid #f0aaaa' },
  };
  return (
    <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 20, fontSize: 9, fontWeight: 700, letterSpacing: 0.2, textTransform: 'uppercase', whiteSpace: 'nowrap', ...styles[estado] }}>
      {short ? ESTADO_SHORT[estado] : ESTADO_LABEL[estado]}
    </span>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, gridColumn: full ? '1/-1' : undefined }}>
      <label style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#aaa' }}>{label}</label>
      {children}
    </div>
  );
}

function ModalOverlay({ children, onClose, width }: { children: React.ReactNode; onClose: () => void; width?: number }) {
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(2px)' }}>
      <div style={{ background: '#fff', border: '1px solid #dedad5', borderRadius: 8, width: width || 500, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.1)' }}>
        {children}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ESTILOS INLINE
// ════════════════════════════════════════════════════════════════

const btnRed: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600,
  padding: '6px 13px', border: 'none', borderRadius: 4, cursor: 'pointer',
  background: '#B01D23', color: '#fff', whiteSpace: 'nowrap',
};

const btnGhost: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600,
  padding: '6px 13px', borderRadius: 4, cursor: 'pointer',
  background: '#fff', color: '#555', border: '1px solid #d0ccc7', whiteSpace: 'nowrap',
};

const sectionLabel: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase',
  color: '#aaa', marginBottom: 8,
};

const canalCardBase: React.CSSProperties = {
  borderRadius: 6, padding: '12px 14px', position: 'relative', border: '1px solid',
};

const canalLabel: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10,
};

const tabActive: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 4, cursor: 'pointer',
  background: '#B01D23', color: '#fff', border: '1px solid #B01D23', flexShrink: 0, userSelect: 'none',
};

const tabInactive: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 4, cursor: 'pointer',
  background: '#fff', color: '#555', border: '1px solid #d0ccc7', flexShrink: 0, userSelect: 'none',
};

const selectStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid #d0ccc7', color: '#333',
  borderRadius: 4, padding: '5px 10px', fontFamily: 'Inter, sans-serif', fontSize: 11, outline: 'none',
};

const thBase: React.CSSProperties = {
  background: '#f5f3f0', color: '#bbb', fontSize: 9, fontWeight: 700,
  letterSpacing: 0.8, textTransform: 'uppercase', padding: '8px 10px',
  textAlign: 'left', borderBottom: '1px solid #ece9e4', borderRight: '1px solid #ece9e4',
  whiteSpace: 'nowrap', verticalAlign: 'bottom',
};

const thCanal: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
  padding: '7px 10px', textAlign: 'center', borderBottom: '1px solid #ece9e4',
  borderRight: '1px solid #ece9e4', whiteSpace: 'nowrap',
};

const thSub: React.CSSProperties = {
  fontSize: 8, fontWeight: 600, color: '#ccc', padding: '3px 10px', textAlign: 'center',
  borderBottom: '2px solid #dedad5', borderRight: '1px solid #ece9e4',
  textTransform: 'uppercase', letterSpacing: 0.5,
};

const tdBase: React.CSSProperties = {
  padding: '8px 10px', fontSize: 12, verticalAlign: 'middle', borderRight: '1px solid #f5f3f0',
};

const tdDate: React.CSSProperties = { ...tdBase, color: '#888', fontSize: 11, whiteSpace: 'nowrap' };
const tdRef: React.CSSProperties = { ...tdBase, fontSize: 11, fontWeight: 600, color: '#2255bb', whiteSpace: 'nowrap' };
const tdTipo: React.CSSProperties = { ...tdBase, fontSize: 10, color: '#777', whiteSpace: 'nowrap' };
const tdEur: React.CSSProperties = { ...tdBase, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' };
const tdEst: React.CSSProperties = { ...tdBase, textAlign: 'center' };
const tdDash: React.CSSProperties = { ...tdBase, textAlign: 'center', color: '#ddd' };
const tdRight: React.CSSProperties = { ...tdBase, textAlign: 'right' };

const actionBtn: React.CSSProperties = {
  background: '#f5f3f0', border: '1px solid #e0ddd8', color: '#888',
  borderRadius: 3, padding: '3px 7px', cursor: 'pointer', fontSize: 10,
};

const tableFooter: React.CSSProperties = {
  display: 'flex', justifyContent: 'flex-end', gap: 20, padding: '8px 14px',
  background: '#f5f3f0', borderTop: '1px solid #dedad5', fontSize: 11, color: '#888',
};

const modalCloseBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 15,
};

const sepStyle: React.CSSProperties = {
  fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
  color: '#ccc', borderBottom: '1px solid #ece9e4', paddingBottom: 4,
};

const fieldInput: React.CSSProperties = {
  background: '#f7f5f2', border: '1px solid #d5d1cc', color: '#1a1a1a',
  borderRadius: 4, padding: '6px 9px', fontFamily: 'Inter, sans-serif',
  fontSize: 12, outline: 'none', width: '100%',
};

const uploadZone: React.CSSProperties = {
  border: '1.5px dashed #d0ccc7', borderRadius: 5, padding: 14,
  textAlign: 'center', cursor: 'pointer', background: '#faf9f7',
};
