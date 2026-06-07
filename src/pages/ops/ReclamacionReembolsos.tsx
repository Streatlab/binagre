import React, { useMemo, useState } from "react";
import {
  useReclamaciones, computeMetricas, computeMetricasPorCanal,
  CANAL_LABELS, TIPO_LABELS, ESTADO_LABELS,
} from "../../lib/reclamaciones/useReclamaciones";
import type {
  Reclamacion, Canal, EstadoReclamacion, TipoReclamacion,
} from "../../lib/reclamaciones/useReclamaciones";

// =======================================================================
// MODULO RECLAMACIONES - Conectado a Supabase
// =======================================================================

const C = {
  bg: "#edecea", surface: "#fff", border: "#dedad5", border2: "#ece9e4",
  rowBorder: "#f0eeea", text: "#1a1a1a", muted: "#777", faint: "#aaa",
  red: "#B01D23", green: "#1a8a45", blue: "#2255bb",
  ueBg: "#dbf0e4", ueBd: "#b7ddc5", ueTx: "#06873f", ueTh: "#edf8f2",
  glBg: "#f7f2cc", glBd: "#e5dc8a", glTx: "#8a7000", glTh: "#fdfae8",
  jeBg: "#fce4c8", jeBd: "#f0c590", jeTx: "#b06000", jeTh: "#fdf4e7",
  webBg: "#f7d4d4", webBd: "#e5a8a8", webTx: "#900",
  pendBg: "#fef3e0", pendTx: "#b06000", pendBd: "#f0c070",
  reclBg: "#eaf0fd", reclTx: "#2255bb", reclBd: "#b0c8f0",
  cobrBg: "#e8f7ef", cobrTx: "#06873f", cobrBd: "#b3dfc4",
  rechBg: "#fdeaea", rechTx: "#900",     rechBd: "#f0aaaa",
};

type TabKey = "todas" | "pendiente" | "reclamada" | "cobrada" | "rechazada";

const fmtEur = (n: number) =>
  Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

const fmtFechaCorta = (iso: string) => {
  const d = new Date(iso);
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${d.getDate()} ${meses[d.getMonth()]}`;
};

const canalColor = (c: Canal) =>
  c === "uber_eats" ? C.ueTx : c === "glovo" ? C.glTx : c === "just_eat" ? C.jeTx : C.webTx;

export default function ReclamacionReembolsos() {
  const { data, loading, error, insert, update, remove, uploadFoto } = useReclamaciones();
  const [tab, setTab] = useState<TabKey>("todas");
  const [filterCanal, setFilterCanal] = useState<Canal | "all">("all");
  const [filterTipo, setFilterTipo] = useState<TipoReclamacion | "all">("all");
  const [filterMes, setFilterMes] = useState<string>("all");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Reclamacion | null>(null);

  // Lista de meses disponibles
  const meses = useMemo(() => {
    const set = new Set<string>();
    data.forEach(r => set.add(r.fecha.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [data]);

  // Filtrado
  const filtered = useMemo(() => {
    return data.filter(r => {
      if (tab !== "todas" && r.estado !== tab) return false;
      if (filterCanal !== "all" && r.canal !== filterCanal) return false;
      if (filterTipo !== "all" && r.tipo !== filterTipo) return false;
      if (filterMes !== "all" && !r.fecha.startsWith(filterMes)) return false;
      return true;
    });
  }, [data, tab, filterCanal, filterTipo, filterMes]);

  const m = useMemo(() => computeMetricas(data), [data]);
  const mUE  = useMemo(() => computeMetricasPorCanal(data, "uber_eats"), [data]);
  const mGL  = useMemo(() => computeMetricasPorCanal(data, "glovo"), [data]);
  const mJE  = useMemo(() => computeMetricasPorCanal(data, "just_eat"), [data]);
  const mWEB = useMemo(() => computeMetricasPorCanal(data, "web"), [data]);

  // Totales periodo (para la fila TOTAL de la tabla)
  const tot = useMemo(() => {
    const get = (c: Canal) => filtered
      .filter(r => r.canal === c)
      .reduce((s, r) => s + Number(r.importe_reclamado), 0);
    return { ue: get("uber_eats"), gl: get("glovo"), je: get("just_eat"), total: filtered.reduce((s, r) => s + Number(r.importe_reclamado), 0) };
  }, [filtered]);

  if (loading) return <div style={{ padding: 40, color: C.muted, fontFamily: "Inter,sans-serif" }}>Cargando reclamaciones…</div>;
  if (error)   return <div style={{ padding: 40, color: C.red,   fontFamily: "Inter,sans-serif" }}>Error: {error}</div>;

  return (
    <div style={{ background: C.bg, padding: 16, minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif", color: C.text, fontSize: 13 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: 0.3 }}>Reclamaciones</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setShowNew(true)} style={btnRed}>+ Nueva reclamación</button>
          </div>
        </div>

        {/* TOP: 2 summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div style={summaryCard}>
            <div style={cardHeader}>SITUACIÓN ACTUAL</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.red, lineHeight: 1 }}>{fmtEur(m.enRiesgo)}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.faint }}>en riesgo · {m.abiertas} abiertas</div>
            </div>
            <div style={progressBg}><div style={{ ...progressFill, width: `${Math.min(100, (m.enRiesgo / Math.max(1, m.totalReclamado)) * 100)}%`, background: C.red }} /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Line label="Pendientes de enviar" valueA={<span style={{ color: C.pendTx, fontWeight: 600 }}>{m.pendientes}</span>} />
              <Line label="Reclamadas a plataforma" valueA={<span style={{ color: C.blue, fontWeight: 600 }}>{m.reclamadas}</span>} />
              <Line label="Total reclamado 2026" valueA={<span style={{ fontWeight: 600 }}>{fmtEur(m.totalReclamado)}</span>} />
            </div>
          </div>

          <div style={summaryCard}>
            <div style={cardHeader}>RESULTADOS 2026</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.green, lineHeight: 1 }}>{fmtEur(m.cobrado)}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.green }}>cobrado · {m.tasaResolucion}% tasa</div>
            </div>
            <div style={progressBg}><div style={{ ...progressFill, width: `${m.tasaResolucion}%`, background: C.green }} /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Line label="Cobradas" valueA={<span style={{ color: C.green, fontWeight: 600 }}>{m.cobradas}</span>} valueB={fmtEur(m.cobrado)} />
              <Line label="Rechazadas / perdido" valueA={<span style={{ color: C.red, fontWeight: 600 }}>{m.rechazadas}</span>} valueB={fmtEur(m.perdido)} />
              <Line label="Neto recuperado" valueA={<span style={{ fontWeight: 600 }}>{fmtEur(m.cobrado - m.perdido)}</span>} />
            </div>
          </div>
        </div>

        {/* CANAL CARDS */}
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: C.faint, marginBottom: 8 }}>Reclamaciones por canal</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
          <CanalCard bg={C.ueBg}  bd={C.ueBd}  tx={C.ueTx}  label="Uber Eats" data={mUE} />
          <CanalCard bg={C.glBg}  bd={C.glBd}  tx={C.glTx}  label="Glovo"     data={mGL} />
          <CanalCard bg={C.jeBg}  bd={C.jeBd}  tx={C.jeTx}  label="Just Eat"  data={mJE} />
          <CanalCard bg={C.webBg} bd={C.webBd} tx={C.webTx} label="Web"       data={mWEB} fallback="Gestión directa con cliente" />
        </div>

        {/* TABS */}
        <div style={{ display: "flex", gap: 5, marginBottom: 10, overflowX: "auto", whiteSpace: "nowrap", paddingBottom: 2 }}>
          <TabBtn active={tab === "todas"}      onClick={() => setTab("todas")}      label="Todas"      count={m.abiertas + m.cobradas + m.rechazadas} />
          <TabBtn active={tab === "pendiente"}  onClick={() => setTab("pendiente")}  label="Pendientes" count={m.pendientes} />
          <TabBtn active={tab === "reclamada"}  onClick={() => setTab("reclamada")}  label="Reclamadas" count={m.reclamadas} />
          <TabBtn active={tab === "cobrada"}    onClick={() => setTab("cobrada")}    label="Cobradas"   count={m.cobradas} />
          <TabBtn active={tab === "rechazada"}  onClick={() => setTab("rechazada")}  label="Rechazadas" count={m.rechazadas} />
        </div>

        {/* CONTROLS */}
        <div style={{ display: "flex", gap: 6, marginBottom: 11, flexWrap: "wrap", alignItems: "center" }}>
          <select style={selectSt} value={filterMes} onChange={e => setFilterMes(e.target.value)}>
            <option value="all">Todos los meses</option>
            {meses.map(mes => (
              <option key={mes} value={mes}>{new Date(mes + "-01").toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</option>
            ))}
          </select>
          <select style={selectSt} value={filterCanal} onChange={e => setFilterCanal(e.target.value as Canal | "all")}>
            <option value="all">Todas las plataformas</option>
            <option value="uber_eats">Uber Eats</option>
            <option value="glovo">Glovo</option>
            <option value="just_eat">Just Eat</option>
            <option value="web">Web</option>
          </select>
          <select style={selectSt} value={filterTipo} onChange={e => setFilterTipo(e.target.value as TipoReclamacion | "all")}>
            <option value="all">Todos los tipos</option>
            {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
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
                  <th rowSpan={2} style={{ ...thBase, textAlign: "center", verticalAlign: "bottom", paddingBottom: 7 }}>ESTADO</th>
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
                {filtered.length === 0 && (
                  <tr><td colSpan={13} style={{ ...tdBase, textAlign: "center", padding: 30, color: C.muted, fontStyle: "italic" }}>
                    No hay reclamaciones con estos filtros.
                  </td></tr>
                )}
                {filtered.map(r => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${C.rowBorder}` }}>
                    <td style={{ ...tdBase, color: C.muted, fontSize: 11, whiteSpace: "nowrap" }}>{fmtFechaCorta(r.fecha)}</td>
                    <td style={{ ...tdBase, fontSize: 11, fontWeight: 600, color: C.blue, whiteSpace: "nowrap" }}>{r.pedido_ref}</td>
                    <td style={{ ...tdBase, fontSize: 10, color: C.muted, whiteSpace: "nowrap" }} title={r.descripcion || ""}>{TIPO_LABELS[r.tipo]}</td>
                    {(["uber_eats", "glovo", "just_eat"] as const).map(canal => (
                      <React.Fragment key={canal}>
                        {r.canal === canal ? (
                          <>
                            <td style={{ ...tdBase, textAlign: "right", fontWeight: 600, color: canalColor(canal), whiteSpace: "nowrap" }}>{fmtEur(Number(r.importe_reclamado))}</td>
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
                    <td style={{ ...tdBase, textAlign: "right", fontSize: 10, fontWeight: 600, color: r.factura_cobro_periodo ? C.green : "#ddd", whiteSpace: "nowrap" }}>
                      {r.factura_cobro_periodo || "—"}
                    </td>
                    <td style={{ ...tdBase, textAlign: "center", fontSize: 13 }}>
                      {r.foto_url
                        ? <a href={r.foto_url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: C.green }}>📷</a>
                        : <span style={{ color: "#ddd" }}>—</span>}
                    </td>
                    <td style={{ ...tdBase, borderRight: "none" }}>
                      <button onClick={() => setEditing(r)} style={actionBtn}>✏️</button>
                    </td>
                  </tr>
                ))}
                {filtered.length > 0 && (
                  <tr style={{ background: "#f5f3f0", borderTop: `2px solid ${C.border}`, fontWeight: 700 }}>
                    <td colSpan={3} style={{ ...tdBase, color: "#888", fontSize: 10, letterSpacing: 0.5 }}>TOTAL FILTRADO</td>
                    <td style={{ ...tdBase, textAlign: "right", color: C.ueTx, fontWeight: 700 }}>{fmtEur(tot.ue)}</td><td></td>
                    <td style={{ ...tdBase, textAlign: "right", color: C.glTx, fontWeight: 700 }}>{fmtEur(tot.gl)}</td><td></td>
                    <td style={{ ...tdBase, textAlign: "right", color: C.jeTx, fontWeight: 700 }}>{fmtEur(tot.je)}</td><td></td>
                    <td></td>
                    <td style={{ ...tdBase, textAlign: "right", fontWeight: 700, color: C.text }}>{fmtEur(tot.total)}</td>
                    <td></td><td style={{ borderRight: "none" }}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 20, padding: "8px 14px", background: "#f5f3f0", borderTop: `1px solid ${C.border}`, fontSize: 11, color: "#888" }}>
            <span>Reclamado: <strong style={{ marginLeft: 4, color: C.red }}>-{fmtEur(m.totalReclamado)}</strong></span>
            <span>Cobrado: <strong style={{ marginLeft: 4, color: C.green }}>+{fmtEur(m.cobrado)}</strong></span>
            <span>Pendiente: <strong style={{ marginLeft: 4, color: C.red }}>-{fmtEur(m.enRiesgo)}</strong></span>
          </div>
        </div>

      </div>

      {showNew && <ModalReclamacion onClose={() => setShowNew(false)} onSave={async (payload, file) => {
        let foto_url: string | null = null;
        if (file) foto_url = await uploadFoto(file);
        await insert({ ...payload, foto_url } as Partial<Reclamacion>);
        setShowNew(false);
      }} />}

      {editing && <ModalReclamacion existing={editing} onClose={() => setEditing(null)}
        onSave={async (payload, file) => {
          const patch: Partial<Reclamacion> = { ...payload };
          if (file) patch.foto_url = await uploadFoto(file);
          await update(editing.id, patch);
          setEditing(null);
        }}
        onDelete={async () => { if (confirm("¿Eliminar esta reclamación?")) { await remove(editing.id); setEditing(null); } }}
      />}
    </div>
  );
}

// =========================================================
// COMPONENTES
// =========================================================

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

function CanalCard({ bg, bd, tx, label, data, fallback }: {
  bg: string; bd: string; tx: string; label: string;
  data: { count: number; enRiesgo: number; cobrado: number; tasa: number | null };
  fallback?: string;
}) {
  const hayDatos = data.count > 0;
  return (
    <div style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 6, padding: "12px 14px" }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: tx, marginBottom: 10 }}>{label}</div>
      {!hayDatos ? (
        <>
          <div style={{ color: "#888", fontSize: 11, fontStyle: "italic", padding: "10px 0" }}>Sin reclamaciones</div>
          {fallback && <div style={{ fontSize: 10, color: "#999" }}>{fallback}</div>}
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, lineHeight: 1 }}>{fmtEur(data.enRiesgo)}</div>
            <div style={{ fontSize: 10, color: "#888" }}>en riesgo</div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: tx, lineHeight: 1 }}>{fmtEur(data.cobrado)}</div>
            <div style={{ fontSize: 10, color: "#888" }}>cobrado</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "#666", paddingTop: 7, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
            <span>{data.count} {data.count === 1 ? "reclamación" : "reclamaciones"}</span>
            <strong>{data.tasa !== null ? `Tasa ${data.tasa}%` : "—"}</strong>
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
      border: `1px solid ${active ? C.red : "#d0ccc7"}`, background: active ? C.red : "#fff",
      color: active ? "#fff" : "#555", flexShrink: 0, fontFamily: "inherit",
    }}>
      {label} <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 3 }}>{count}</span>
    </button>
  );
}

function EstadoBadge({ estado, compact = false }: { estado: EstadoReclamacion; compact?: boolean }) {
  const styles: Record<EstadoReclamacion, { bg: string; tx: string; bd: string }> = {
    pendiente: { bg: C.pendBg, tx: C.pendTx, bd: C.pendBd },
    reclamada: { bg: C.reclBg, tx: C.reclTx, bd: C.reclBd },
    cobrada:   { bg: C.cobrBg, tx: C.cobrTx, bd: C.cobrBd },
    rechazada: { bg: C.rechBg, tx: C.rechTx, bd: C.rechBd },
  };
  const s = styles[estado];
  const label = compact ? ESTADO_LABELS[estado].short : ESTADO_LABELS[estado].full;
  return (
    <span style={{
      display: "inline-block", padding: "2px 6px", borderRadius: 20,
      fontSize: 9, fontWeight: 700, letterSpacing: 0.2, textTransform: "uppercase", whiteSpace: "nowrap",
      background: s.bg, color: s.tx, border: `1px solid ${s.bd}`,
    }}>{label}</span>
  );
}

// =========================================================
// MODAL CRUD
// =========================================================

function ModalReclamacion({ existing, onClose, onSave, onDelete }: {
  existing?: Reclamacion;
  onClose: () => void;
  onSave: (payload: Partial<Reclamacion>, file: File | null) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [canal, setCanal] = useState<Canal>(existing?.canal ?? "uber_eats");
  const [pedidoRef, setPedidoRef] = useState(existing?.pedido_ref ?? "");
  const [fecha, setFecha] = useState(existing?.fecha ?? new Date().toISOString().slice(0, 10));
  const [importe, setImporte] = useState(existing?.importe_reclamado?.toString() ?? "");
  const [tipo, setTipo] = useState<TipoReclamacion>(existing?.tipo ?? "producto_faltante");
  const [marca, setMarca] = useState(existing?.marca ?? "Binagre");
  const [descripcion, setDescripcion] = useState(existing?.descripcion ?? "");
  const [estado, setEstado] = useState<EstadoReclamacion>(existing?.estado ?? "pendiente");
  const [fechaEnvio, setFechaEnvio] = useState(existing?.fecha_envio ?? "");
  const [importeCompensado, setImporteCompensado] = useState(existing?.importe_compensado?.toString() ?? "");
  const [facturaCobroPeriodo, setFacturaCobroPeriodo] = useState(existing?.factura_cobro_periodo ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleSave = async () => {
    setErr("");
    if (!pedidoRef.trim() || !importe.trim()) { setErr("Pedido e importe son obligatorios"); return; }
    setSaving(true);
    try {
      await onSave({
        canal, pedido_ref: pedidoRef, fecha, tipo, marca: marca || null,
        descripcion: descripcion || null,
        importe_reclamado: parseFloat(importe.replace(",", ".")) || 0,
        importe_compensado: importeCompensado ? parseFloat(importeCompensado.replace(",", ".")) : 0,
        estado, fecha_envio: fechaEnvio || null,
        factura_cobro_periodo: facturaCobroPeriodo || null,
      }, file);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modalBox, width: 540 }}>
        <div style={modalHeader}>
          <span style={modalTitle}>{existing ? "Editar reclamación" : "Nueva reclamación"}</span>
          <button onClick={onClose} style={modalClose}>✕</button>
        </div>
        <div style={{ padding: "15px 16px", display: "flex", flexDirection: "column", gap: 11 }}>
          <div style={sepStyle}>Pedido</div>
          <div style={fg2}>
            <Field label="Plataforma">
              <select style={inputSt} value={canal} onChange={e => setCanal(e.target.value as Canal)}>
                {Object.entries(CANAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Nº Pedido">
              <input style={inputSt} value={pedidoRef} onChange={e => setPedidoRef(e.target.value)} placeholder="#A7F2-994" />
            </Field>
            <Field label="Fecha">
              <input type="date" style={inputSt} value={fecha} onChange={e => setFecha(e.target.value)} />
            </Field>
            <Field label="Importe reclamado (€)">
              <input style={inputSt} value={importe} onChange={e => setImporte(e.target.value)} placeholder="0,00" />
            </Field>
          </div>
          <div style={fg2}>
            <Field label="Tipo">
              <select style={inputSt} value={tipo} onChange={e => setTipo(e.target.value as TipoReclamacion)}>
                {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Marca">
              <input style={inputSt} value={marca || ""} onChange={e => setMarca(e.target.value)} placeholder="Binagre" />
            </Field>
          </div>
          <Field label="Justificación">
            <textarea style={{ ...inputSt, resize: "vertical", minHeight: 55 }}
              value={descripcion || ""} onChange={e => setDescripcion(e.target.value)}
              placeholder="Describe la incidencia..." />
          </Field>

          <div style={sepStyle}>Evidencia</div>
          {existing?.foto_url && !file && (
            <div style={{ fontSize: 11, color: C.muted }}>
              Foto actual: <a href={existing.foto_url} target="_blank" rel="noreferrer" style={{ color: C.green }}>ver</a>
            </div>
          )}
          <div style={uploadZone}>
            <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ display: "block", margin: "0 auto", fontSize: 11 }} />
            {file && <div style={{ fontSize: 10, color: C.green, marginTop: 4 }}>Seleccionado: {file.name}</div>}
          </div>

          <div style={sepStyle}>Estado</div>
          <div style={fg2}>
            <Field label="Estado">
              <select style={inputSt} value={estado} onChange={e => setEstado(e.target.value as EstadoReclamacion)}>
                {Object.entries(ESTADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v.full}</option>)}
              </select>
            </Field>
            <Field label="Fecha envío reclamación">
              <input type="date" style={inputSt} value={fechaEnvio || ""} onChange={e => setFechaEnvio(e.target.value)} />
            </Field>
          </div>

          {estado === "cobrada" && (
            <div style={fg2}>
              <Field label="Importe compensado (€)">
                <input style={inputSt} value={importeCompensado} onChange={e => setImporteCompensado(e.target.value)} placeholder="0,00" />
              </Field>
              <Field label="Cobrado en factura">
                <input style={inputSt} value={facturaCobroPeriodo} onChange={e => setFacturaCobroPeriodo(e.target.value)} placeholder="Fact. abr-2026" />
              </Field>
            </div>
          )}

          {err && <div style={{ background: "#fdeaea", color: "#900", padding: 8, borderRadius: 4, fontSize: 11 }}>{err}</div>}
        </div>
        <div style={modalFooter}>
          {existing && onDelete && (
            <button onClick={onDelete} disabled={saving} style={{ ...btnGhost, color: C.red, marginRight: "auto" }}>Eliminar</button>
          )}
          <button onClick={onClose} disabled={saving} style={btnGhost}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={btnRed}>{saving ? "Guardando…" : "Guardar"}</button>
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

// =========================================================
// ESTILOS
// =========================================================
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
