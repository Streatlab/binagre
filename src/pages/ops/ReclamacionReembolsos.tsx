import React, { useState } from "react";

// =======================================================================
// MOCKUP RECLAMACIONES — estilo Dashboard Streat Lab
// Datos mock. Pendiente conectar a Supabase tabla `reclamaciones`.
// =======================================================================

const C = {
  bg: "#edecea",
  surface: "#fff",
  border: "#dedad5",
  border2: "#ece9e4",
  rowBorder: "#f0eeea",
  text: "#1a1a1a",
  muted: "#777",
  faint: "#aaa",
  red: "#B01D23",
  green: "#1a8a45",
  blue: "#2255bb",

  ueBg: "#dbf0e4", ueBd: "#b7ddc5", ueTx: "#06873f", ueTh: "#edf8f2",
  glBg: "#f7f2cc", glBd: "#e5dc8a", glTx: "#8a7000", glTh: "#fdfae8",
  jeBg: "#fce4c8", jeBd: "#f0c590", jeTx: "#b06000", jeTh: "#fdf4e7",
  webBg: "#f7d4d4", webBd: "#e5a8a8", webTx: "#900",

  pendBg: "#fef3e0", pendTx: "#b06000", pendBd: "#f0c070",
  reclBg: "#eaf0fd", reclTx: "#2255bb", reclBd: "#b0c8f0",
  cobrBg: "#e8f7ef", cobrTx: "#06873f", cobrBd: "#b3dfc4",
  rechBg: "#fdeaea", rechTx: "#900",     rechBd: "#f0aaaa",
};

type Tab = "todas" | "pendientes" | "reclamadas" | "cobradas" | "rechazadas";

type Reclamacion = {
  fecha: string;
  pedido: string;
  tipo: string;
  canal: "ue" | "gl" | "je" | "web";
  importe: number;
  estado: "pendiente" | "reclamada" | "cobrada" | "rechazada";
  cobroEn?: string;
  foto: boolean;
};

const MOCK: Reclamacion[] = [
  { fecha: "23 abr", pedido: "#A7F2-994", tipo: "Prod. faltante", canal: "ue", importe: 11.35, estado: "reclamada", foto: true },
  { fecha: "22 abr", pedido: "#GL-8812",  tipo: "Mala calidad",   canal: "gl", importe: 26.95, estado: "pendiente", foto: true },
  { fecha: "20 abr", pedido: "#A7F2-881", tipo: "Ped. cancelado", canal: "ue", importe: 18.50, estado: "reclamada", foto: false },
  { fecha: "18 abr", pedido: "#JE-3301",  tipo: "Prod. erroneo",  canal: "je", importe: 12.95, estado: "cobrada",  cobroEn: "Fact. abr-26", foto: true },
  { fecha: "15 abr", pedido: "#GL-7744",  tipo: "Prod. faltante", canal: "gl", importe:  3.95, estado: "rechazada", foto: true },
  { fecha: "12 abr", pedido: "#A7F2-720", tipo: "Mala calidad",   canal: "ue", importe:  9.95, estado: "cobrada",  cobroEn: "Fact. abr-26", foto: true },
  { fecha: "10 abr", pedido: "#JE-2988",  tipo: "Prod. faltante", canal: "je", importe:  3.00, estado: "pendiente", foto: false },
];

const fmtEur = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

export default function ReclamacionReembolsos() {
  const [tab, setTab] = useState<Tab>("todas");
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // ---- filtro tabs
  const filtered = MOCK.filter(r => tab === "todas" || r.estado === tab.slice(0, -1) + (tab.endsWith("s") ? "" : ""));

  // helpers visuales
  const sectionLabel = (txt: string) => (
    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: C.faint, marginBottom: 8 }}>{txt}</div>
  );

  return (
    <div style={{ background: C.bg, padding: 16, minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif", color: C.text, fontSize: 13 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: 0.3 }}>Reclamaciones</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setShowImport(true)} style={btnGhost}>📄 Importar factura</button>
            <button onClick={() => setShowNew(true)} style={btnRed}>+ Nueva</button>
          </div>
        </div>

        {/* TOP: 2 summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>

          <div style={summaryCard}>
            <div style={cardHeader}>SITUACIÓN ACTUAL</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.red, lineHeight: 1 }}>183,40 €</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.faint }}>en riesgo</div>
            </div>
            <div style={progressBg}><div style={{ ...progressFill, width: "61%", background: C.red }} /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Line label="Pendientes de enviar" valueA={<span style={{ color: C.pendTx, fontWeight: 600 }}>3</span>} valueB="60,90 €" />
              <Line label="Reclamadas a plataforma" valueA={<span style={{ color: C.blue, fontWeight: 600 }}>5</span>} valueB="122,50 €" />
              <Line label="Tiempo medio respuesta" valueA={<span style={{ fontWeight: 600 }}>18 días</span>} />
            </div>
          </div>

          <div style={summaryCard}>
            <div style={cardHeader}>RESULTADOS 2026</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.green, lineHeight: 1 }}>94,20 €</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.green }}>cobrado · 71% tasa</div>
            </div>
            <div style={progressBg}><div style={{ ...progressFill, width: "71%", background: C.green }} /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Line label="Total reclamado 2026" valueA={<span style={{ fontWeight: 600 }}>302,50 €</span>} />
              <Line label="Rechazado / perdido" valueA={<span style={{ color: C.red, fontWeight: 600 }}>24,90 €</span>} valueB="2 recl." />
              <Line label="Este mes" valueA={<span style={{ color: C.green, fontWeight: 600 }}>42,90 €</span>} valueB="3 recl." />
            </div>
          </div>

        </div>

        {/* CANAL CARDS */}
        {sectionLabel("Reclamaciones por canal")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
          <CanalCard bg={C.ueBg}  bd={C.ueBd}  tx={C.ueTx}  label="Uber Eats" riesgo="87,30 €" cobrado="42,90 €" recls={8} tasa="75%" />
          <CanalCard bg={C.glBg}  bd={C.glBd}  tx={C.glTx}  label="Glovo"     riesgo="61,10 €" cobrado="28,40 €" recls={7} tasa="67%" />
          <CanalCard bg={C.jeBg}  bd={C.jeBd}  tx={C.jeTx}  label="Just Eat"  riesgo="35,00 €" cobrado="22,90 €" recls={8} tasa="80%" />
          <CanalCard bg={C.webBg} bd={C.webBd} tx={C.webTx} label="Web"       noData />
        </div>

        {/* TABS */}
        <div style={{ display: "flex", gap: 5, marginBottom: 10, overflowX: "auto", whiteSpace: "nowrap", paddingBottom: 2 }}>
          <TabBtn active={tab === "todas"}      onClick={() => setTab("todas")}     label="Todas"      count={23} />
          <TabBtn active={tab === "pendientes"} onClick={() => setTab("pendientes")} label="Pendientes" count={3} />
          <TabBtn active={tab === "reclamadas"} onClick={() => setTab("reclamadas")} label="Reclamadas" count={5} />
          <TabBtn active={tab === "cobradas"}   onClick={() => setTab("cobradas")}   label="Cobradas"   count={8} />
          <TabBtn active={tab === "rechazadas"} onClick={() => setTab("rechazadas")} label="Rechazadas" count={2} />
        </div>

        {/* CONTROLS */}
        <div style={{ display: "flex", gap: 6, marginBottom: 11, flexWrap: "wrap", alignItems: "center" }}>
          <select style={selectSt}><option>Abril 2026</option><option>Marzo 2026</option><option>Febrero 2026</option></select>
          <select style={selectSt}><option>Todas las plataformas</option><option>Uber Eats</option><option>Glovo</option><option>Just Eat</option></select>
          <select style={selectSt}><option>Todos los tipos</option><option>Prod. faltante</option><option>Mala calidad</option><option>Ped. cancelado</option><option>Prod. erróneo</option></select>
        </div>

        {/* TABLA */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ ...thBase, verticalAlign: "bottom", paddingBottom: 7 }}>FECHA</th>
                  <th rowSpan={2} style={{ ...thBase, verticalAlign: "bottom", paddingBottom: 7 }}>PEDIDO</th>
                  <th rowSpan={2} style={{ ...thBase, verticalAlign: "bottom", paddingBottom: 7 }}>TIPO</th>
                  <th colSpan={2} style={{ ...thCanal, background: C.ueTh, color: C.ueTx }}>UBER EATS</th>
                  <th colSpan={2} style={{ ...thCanal, background: C.glTh, color: C.glTx }}>GLOVO</th>
                  <th colSpan={2} style={{ ...thCanal, background: C.jeTh, color: C.jeTx }}>JUST EAT</th>
                  <th rowSpan={2} style={{ ...thBase, textAlign: "center", verticalAlign: "bottom", paddingBottom: 7 }}>EST.</th>
                  <th rowSpan={2} style={{ ...thBase, textAlign: "right",  verticalAlign: "bottom", paddingBottom: 7 }}>COBRO</th>
                  <th rowSpan={2} style={{ ...thBase, textAlign: "center", verticalAlign: "bottom", paddingBottom: 7 }}>📷</th>
                  <th rowSpan={2} style={{ ...thBase, borderRight: "none", verticalAlign: "bottom" }}></th>
                </tr>
                <tr>
                  <th style={{ ...thSub, background: C.ueTh }}>IMP.</th>
                  <th style={{ ...thSub, background: C.ueTh }}>EST.</th>
                  <th style={{ ...thSub, background: C.glTh }}>IMP.</th>
                  <th style={{ ...thSub, background: C.glTh }}>EST.</th>
                  <th style={{ ...thSub, background: C.jeTh }}>IMP.</th>
                  <th style={{ ...thSub, background: C.jeTh }}>EST.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.rowBorder}` }}>
                    <td style={{ ...tdBase, color: C.muted, fontSize: 11, whiteSpace: "nowrap" }}>{r.fecha}</td>
                    <td style={{ ...tdBase, fontSize: 11, fontWeight: 600, color: C.blue, whiteSpace: "nowrap" }}>{r.pedido}</td>
                    <td style={{ ...tdBase, fontSize: 10, color: C.muted, whiteSpace: "nowrap" }}>{r.tipo}</td>
                    {(["ue", "gl", "je"] as const).map(canal => (
                      <React.Fragment key={canal}>
                        {r.canal === canal ? (
                          <>
                            <td style={{ ...tdBase, textAlign: "right", fontWeight: 600, color: canal === "ue" ? C.ueTx : canal === "gl" ? C.glTx : C.jeTx, whiteSpace: "nowrap" }}>{fmtEur(r.importe)}</td>
                            <td style={{ ...tdBase, textAlign: "center" }}><EstadoBadge estado={r.estado} compact /></td>
                          </>
                        ) : (
                          <>
                            <td style={{ ...tdBase, textAlign: "center", color: "#ddd" }}>—</td>
                            <td style={{ ...tdBase, textAlign: "center", color: "#ddd" }}>—</td>
                          </>
                        )}
                      </React.Fragment>
                    ))}
                    <td style={{ ...tdBase, textAlign: "center" }}><EstadoBadge estado={r.estado} /></td>
                    <td style={{ ...tdBase, textAlign: "right", fontSize: 10, fontWeight: 600, color: r.cobroEn ? C.green : "#ddd", whiteSpace: "nowrap" }}>{r.cobroEn || "—"}</td>
                    <td style={{ ...tdBase, textAlign: "center", color: r.foto ? C.green : "#ddd", fontSize: 13 }}>{r.foto ? "📷" : "—"}</td>
                    <td style={{ ...tdBase, borderRight: "none" }}><button style={actionBtn}>✏️</button></td>
                  </tr>
                ))}
                <tr style={{ background: "#f5f3f0", borderTop: `2px solid ${C.border}`, fontWeight: 700 }}>
                  <td colSpan={3} style={{ ...tdBase, color: "#888", fontSize: 10, letterSpacing: 0.5 }}>TOTAL PERIODO</td>
                  <td style={{ ...tdBase, textAlign: "right", color: C.ueTx, fontWeight: 700 }}>40,45 €</td>
                  <td></td>
                  <td style={{ ...tdBase, textAlign: "right", color: C.glTx, fontWeight: 700 }}>30,90 €</td>
                  <td></td>
                  <td style={{ ...tdBase, textAlign: "right", color: C.jeTx, fontWeight: 700 }}>15,95 €</td>
                  <td></td>
                  <td></td>
                  <td style={{ ...tdBase, textAlign: "right", fontWeight: 700, color: C.text }}>87,30 €</td>
                  <td></td><td style={{ borderRight: "none" }}></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 20, padding: "8px 14px", background: "#f5f3f0", borderTop: `1px solid ${C.border}`, fontSize: 11, color: "#888" }}>
            <span>Reclamado: <strong style={{ marginLeft: 4, color: C.red }}>-183,40 €</strong></span>
            <span>Cobrado: <strong style={{ marginLeft: 4, color: C.green }}>+94,20 €</strong></span>
            <span>Pendiente: <strong style={{ marginLeft: 4, color: C.red }}>-89,20 €</strong></span>
          </div>
        </div>

        {/* AVISO MOCK */}
        <div style={{ marginTop: 14, padding: "8px 12px", background: "#fef3e0", border: `1px solid ${C.pendBd}`, borderRadius: 5, fontSize: 11, color: C.pendTx }}>
          ⚠️ Mockup con datos de ejemplo. Pendiente conectar a Supabase (tabla <code>reclamaciones</code>).
        </div>

      </div>

      {showNew && <ModalNueva onClose={() => setShowNew(false)} />}
      {showImport && <ModalImportar onClose={() => setShowImport(false)} />}
    </div>
  );
}

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

function Line({ label, valueA, valueB }: { label: string; valueA: React.ReactNode; valueB?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, padding: "2px 0" }}>
      <span style={{ color: C.muted, fontSize: 11 }}>{label}</span>
      <span>
        <span style={{ fontSize: 11 }}>{valueA}</span>
        {valueB && <span style={{ color: C.faint, fontSize: 10, marginLeft: 6 }}>{valueB}</span>}
      </span>
    </div>
  );
}

function CanalCard({ bg, bd, tx, label, riesgo, cobrado, recls, tasa, noData }:
  { bg: string; bd: string; tx: string; label: string; riesgo?: string; cobrado?: string; recls?: number; tasa?: string; noData?: boolean }) {
  return (
    <div style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 6, padding: "12px 14px" }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: tx, marginBottom: 10 }}>{label}</div>
      {noData ? (
        <>
          <div style={{ color: "#888", fontSize: 11, fontStyle: "italic", padding: "10px 0" }}>Sin reclamaciones</div>
          <div style={{ fontSize: 10, color: "#999" }}>Gestión directa con cliente</div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, lineHeight: 1 }}>{riesgo}</div>
            <div style={{ fontSize: 10, color: "#888" }}>en riesgo</div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: tx, lineHeight: 1 }}>{cobrado}</div>
            <div style={{ fontSize: 10, color: "#888" }}>cobrado</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "#666", paddingTop: 7, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
            <span>{recls} reclamaciones</span>
            <strong>Tasa {tasa}</strong>
          </div>
        </>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 4, cursor: "pointer",
      border: `1px solid ${active ? C.red : "#d0ccc7"}`,
      background: active ? C.red : "#fff",
      color: active ? "#fff" : "#555",
      flexShrink: 0, fontFamily: "inherit",
    }}>
      {label} <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 3 }}>{count}</span>
    </button>
  );
}

function EstadoBadge({ estado, compact = false }: { estado: Reclamacion["estado"]; compact?: boolean }) {
  const styles: Record<Reclamacion["estado"], { bg: string; tx: string; bd: string; full: string; short: string }> = {
    pendiente: { bg: C.pendBg, tx: C.pendTx, bd: C.pendBd, full: "Pendiente", short: "Pend." },
    reclamada: { bg: C.reclBg, tx: C.reclTx, bd: C.reclBd, full: "Reclamada", short: "Recl." },
    cobrada:   { bg: C.cobrBg, tx: C.cobrTx, bd: C.cobrBd, full: "Cobrada",   short: "Cobr." },
    rechazada: { bg: C.rechBg, tx: C.rechTx, bd: C.rechBd, full: "Rechazada", short: "Rech." },
  };
  const s = styles[estado];
  return (
    <span style={{
      display: "inline-block", padding: "2px 6px", borderRadius: 20,
      fontSize: 9, fontWeight: 700, letterSpacing: 0.2, textTransform: "uppercase", whiteSpace: "nowrap",
      background: s.bg, color: s.tx, border: `1px solid ${s.bd}`,
    }}>{compact ? s.short : s.full}</span>
  );
}

// ============================================================
// MODALES
// ============================================================

function ModalNueva({ onClose }: { onClose: () => void }) {
  return (
    <div style={modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modalBox, width: 500 }}>
        <div style={modalHeader}>
          <span style={modalTitle}>Nueva reclamación</span>
          <button onClick={onClose} style={modalClose}>✕</button>
        </div>
        <div style={{ padding: "15px 16px", display: "flex", flexDirection: "column", gap: 11 }}>
          <div style={sepStyle}>Pedido</div>
          <div style={fg2}>
            <Field label="Plataforma"><select style={inputSt}><option>Seleccionar...</option><option>Uber Eats</option><option>Glovo</option><option>Just Eat</option><option>Web</option></select></Field>
            <Field label="Nº Pedido"><input style={inputSt} placeholder="#A7F2-994" /></Field>
            <Field label="Fecha"><input type="date" style={inputSt} defaultValue="2026-04-23" /></Field>
            <Field label="Importe (€)"><input style={inputSt} placeholder="0,00" /></Field>
          </div>
          <div style={fg2}>
            <Field label="Tipo"><select style={inputSt}><option>Producto faltante</option><option>Producto erróneo</option><option>Mala calidad</option><option>Pedido cancelado</option><option>Cobro incorrecto</option><option>Otro</option></select></Field>
            <Field label="Marca"><select style={inputSt}><option>Binagre</option><option>Ninja Ramen</option><option>Mister Katsu</option><option>Korean Chicken</option><option>Fish & Chips</option><option>French TacOH</option></select></Field>
          </div>
          <Field label="Justificación"><textarea style={{ ...inputSt, resize: "vertical", minHeight: 55 }} placeholder="Describe la incidencia..." /></Field>
          <div style={sepStyle}>Evidencia</div>
          <div style={uploadZone}>
            <div style={{ fontSize: 18 }}>📷</div>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>Arrastra la foto o <strong style={{ color: C.red }}>selecciona archivo</strong> · JPG, PNG · 10MB</div>
          </div>
          <div style={sepStyle}>Estado</div>
          <div style={fg2}>
            <Field label="Estado"><select style={inputSt}><option>Pendiente</option><option>Reclamada</option></select></Field>
            <Field label="Fecha envío"><input type="date" style={inputSt} /></Field>
          </div>
        </div>
        <div style={modalFooter}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button style={btnRed}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

function ModalImportar({ onClose }: { onClose: () => void }) {
  return (
    <div style={modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modalBox, width: 400 }}>
        <div style={modalHeader}>
          <span style={modalTitle}>Importar factura</span>
          <button onClick={onClose} style={modalClose}>✕</button>
        </div>
        <div style={{ padding: "15px 16px", display: "flex", flexDirection: "column", gap: 11 }}>
          <div style={{ fontSize: 11, color: C.blue, background: "#eaf0fd", border: `1px solid ${C.reclBd}`, borderRadius: 4, padding: "8px 11px", lineHeight: 1.5 }}>
            Importa la factura CSV o PDF. El sistema cruza importes y marca como <strong>Cobradas</strong> las que aparezcan compensadas.
          </div>
          <div style={fg2}>
            <Field label="Plataforma"><select style={inputSt}><option>Seleccionar...</option><option>Uber Eats</option><option>Glovo</option><option>Just Eat</option></select></Field>
            <Field label="Período"><select style={inputSt}><option>Abril 2026</option><option>Marzo 2026</option></select></Field>
          </div>
          <div style={uploadZone}>
            <div style={{ fontSize: 18 }}>📄</div>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>Arrastra la factura o <strong style={{ color: C.red }}>selecciona archivo</strong> · CSV, PDF · 20MB</div>
          </div>
        </div>
        <div style={modalFooter}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button style={btnRed}>Procesar</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: C.faint }}>{label}</label>
      {children}
    </div>
  );
}

// ============================================================
// ESTILOS
// ============================================================

const btnRed: React.CSSProperties = { fontSize: 11, fontWeight: 600, padding: "6px 13px", border: "none", borderRadius: 4, cursor: "pointer", background: C.red, color: "#fff", fontFamily: "inherit", whiteSpace: "nowrap" };
const btnGhost: React.CSSProperties = { fontSize: 11, fontWeight: 600, padding: "6px 13px", borderRadius: 4, cursor: "pointer", background: "#fff", color: "#555", border: "1px solid #d0ccc7", fontFamily: "inherit", whiteSpace: "nowrap" };

const summaryCard: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "13px 16px" };
const cardHeader: React.CSSProperties = { fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: C.faint, marginBottom: 10 };
const progressBg: React.CSSProperties = { height: 4, background: "#f0eeea", borderRadius: 2, overflow: "hidden", margin: "6px 0 10px" };
const progressFill: React.CSSProperties = { height: "100%", borderRadius: 2 };

const selectSt: React.CSSProperties = { background: "#fff", border: "1px solid #d0ccc7", color: "#333", borderRadius: 4, padding: "5px 10px", fontFamily: "inherit", fontSize: 11, outline: "none" };

const thBase: React.CSSProperties = { background: "#f5f3f0", color: "#bbb", fontSize: 9, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", padding: "8px 10px", textAlign: "left", borderBottom: `1px solid ${C.border2}`, borderRight: `1px solid ${C.border2}`, whiteSpace: "nowrap" };
const thCanal: React.CSSProperties = { fontSize: 9, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", padding: "7px 10px", textAlign: "center", borderBottom: `1px solid ${C.border2}`, borderRight: `1px solid ${C.border2}`, whiteSpace: "nowrap" };
const thSub: React.CSSProperties = { fontSize: 8, fontWeight: 600, color: "#ccc", padding: "3px 10px", textAlign: "center", borderBottom: `2px solid ${C.border}`, borderRight: `1px solid ${C.border2}`, textTransform: "uppercase", letterSpacing: 0.5 };
const tdBase: React.CSSProperties = { padding: "8px 10px", fontSize: 12, verticalAlign: "middle", borderRight: `1px solid #f5f3f0` };
const actionBtn: React.CSSProperties = { background: "#f5f3f0", border: "1px solid #e0ddd8", color: "#888", borderRadius: 3, padding: "3px 7px", cursor: "pointer", fontSize: 10 };

const modalOverlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.22)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(2px)" };
const modalBox: React.CSSProperties = { background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.1)" };
const modalHeader: React.CSSProperties = { padding: "12px 16px", borderBottom: `1px solid ${C.border2}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 1 };
const modalTitle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: C.red, textTransform: "uppercase" };
const modalClose: React.CSSProperties = { background: "none", border: "none", color: "#bbb", cursor: "pointer", fontSize: 15 };
const modalFooter: React.CSSProperties = { padding: "10px 16px", borderTop: `1px solid ${C.border2}`, display: "flex", justifyContent: "flex-end", gap: 7 };
const fg2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
const inputSt: React.CSSProperties = { background: "#f7f5f2", border: "1px solid #d5d1cc", color: C.text, borderRadius: 4, padding: "6px 9px", fontFamily: "inherit", fontSize: 12, outline: "none", width: "100%" };
const sepStyle: React.CSSProperties = { fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#ccc", borderBottom: `1px solid ${C.border2}`, paddingBottom: 4 };
const uploadZone: React.CSSProperties = { border: "1.5px dashed #d0ccc7", borderRadius: 5, padding: 14, textAlign: "center", cursor: "pointer", background: "#faf9f7" };
