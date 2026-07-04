import React, { useMemo, useState } from "react";
import {
  useReclamaciones, computeMetricas, computeMetricasPorCanal,
  CANAL_LABELS, TIPO_LABELS, ESTADO_LABELS,
} from "../../lib/reclamaciones/useReclamaciones";
import type {
  Reclamacion, Canal, EstadoReclamacion, TipoReclamacion,
} from "../../lib/reclamaciones/useReclamaciones";
import {
  OSW, LEX, INK, CREMA, CLARO, VERDE, NAR, ROJO, AMA, AZUL, GRANATE, GRIS,
  SHADOW, BORDER, BORDER_CARD, CORP, d, eyebrow,
} from "@/styles/neobrutal";

// =======================================================================
// MODULO REEMBOLSOS - Neobrutal Food-Pop - Conectado a Supabase
// =======================================================================

type TabKey = "todas" | "pendiente" | "reclamada" | "cobrada" | "cobrada_doble" | "rechazada" | "incobrable";

const fmtEur = (n: number) =>
  Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

const fmtFechaCorta = (iso: string) => {
  const dt = new Date(iso);
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${dt.getDate()} ${meses[dt.getMonth()]}`;
};

const CANAL_KEY: Record<string, string> = { uber_eats: "uber", glovo: "glovo", just_eat: "je", web: "web", directo: "dir" };
const canalColor = (c: Canal) => CORP[CANAL_KEY[c]] || GRANATE;

const ESTADO_COLOR: Record<EstadoReclamacion, string> = {
  pendiente: NAR, reclamada: AZUL, cobrada: VERDE, cobrada_doble: AZUL, rechazada: ROJO, incobrable: GRIS,
};

export default function ReclamacionReembolsos() {
  const { data, loading, error, insert, update, remove, uploadFoto } = useReclamaciones();
  const [tab, setTab] = useState<TabKey>("todas");
  const [filterCanal, setFilterCanal] = useState<Canal | "all">("all");
  const [filterTipo, setFilterTipo] = useState<TipoReclamacion | "all">("all");
  const [filterMes, setFilterMes] = useState<string>("all");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Reclamacion | null>(null);

  const meses = useMemo(() => {
    const set = new Set<string>();
    data.forEach(r => set.add(r.fecha.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [data]);

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

  const tot = useMemo(() => {
    const get = (c: Canal) => filtered
      .filter(r => r.canal === c)
      .reduce((s, r) => s + Number(r.importe_reclamado), 0);
    return { ue: get("uber_eats"), gl: get("glovo"), je: get("just_eat"), total: filtered.reduce((s, r) => s + Number(r.importe_reclamado), 0) };
  }, [filtered]);

  if (loading) return <div style={{ padding: 40, color: GRIS, fontFamily: LEX }}>Cargando reembolsos…</div>;
  if (error)   return <div style={{ padding: 40, color: ROJO, fontFamily: LEX }}>Error: {error}</div>;

  // Frase-semáforo del hero
  const frase = m.abiertas === 0
    ? "Nada en el aire: todo reclamado está resuelto."
    : m.enRiesgo > 100
      ? "Hay dinero serio en el aire, dale caña a reclamar."
      : "Poca cosa pendiente, pero que no se quede sin reclamar.";
  const fraseColor = m.abiertas === 0 ? VERDE : m.enRiesgo > 100 ? ROJO : NAR;

  return (
    <div style={{ background: CREMA, padding: "24px 28px", minHeight: "100%" }}>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <span style={eyebrow(CLARO)}>Operaciones · Plataformas</span>
          <h2 style={{ ...d("clamp(26px,3.4vw,36px)", GRANATE), margin: "8px 0 0 0" }}>REEMBOLSOS</h2>
        </div>
        <button onClick={() => setShowNew(true)} style={btnNeo(GRANATE, "#fff")}>+ Nuevo reembolso</button>
      </div>

      {/* HERO */}
      <div style={{ background: AMA, border: BORDER, boxShadow: SHADOW, padding: "20px 24px", marginBottom: 16 }}>
        <div style={d("clamp(30px,4.4vw,46px)")}>
          EN RIESGO <span style={{ color: m.enRiesgo > 0 ? ROJO : VERDE }}>{fmtEur(m.enRiesgo)}</span>
          <span style={{ color: INK, fontSize: "0.4em", marginLeft: 12, letterSpacing: "0.5px" }}>· {m.abiertas} abiertas · recuperado {fmtEur(m.cobrado)}</span>
        </div>
        <div style={{ marginTop: 10, fontFamily: OSW, fontSize: "clamp(15px,2vw,19px)", fontWeight: 700, color: fraseColor, letterSpacing: "0.3px", textTransform: "uppercase" }}>
          {frase}
        </div>
      </div>

      {/* CARDS RESUMEN */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 16 }}>
        <CardKpi label="Reclamado 2026" value={fmtEur(m.totalReclamado)} sub={`${data.length} reembolsos`} color={INK} />
        <CardKpi label="Cobrado" value={fmtEur(m.cobrado)} sub={`${m.cobradas} resueltos · tasa ${m.tasaResolucion}%`} color={VERDE} />
        <CardKpi label="Cobrado doble" value={m.extraDoble > 0 ? "+" + fmtEur(m.extraDoble) : "0,00 €"} sub={`${m.dobles} pagados 2 veces`} color={AZUL} />
        <CardKpi label="Perdido" value={fmtEur(m.perdido)} sub={`${m.rechazadas} rechazados · ${m.incobrables} incobrables`} color={m.perdido > 0 ? ROJO : VERDE} />
      </div>

      {/* CARDS POR CANAL */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 16 }}>
        <CanalCard canal="uber_eats" label="Uber Eats" data={mUE} />
        <CanalCard canal="glovo"     label="Glovo"     data={mGL} />
        <CanalCard canal="just_eat"  label="Just Eat"  data={mJE} />
        <CanalCard canal="web"       label="Web"       data={mWEB} fallback="Gestión directa con cliente" />
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <TabNeo active={tab === "todas"}         onClick={() => setTab("todas")}         label="Todas"       count={data.length} />
        <TabNeo active={tab === "pendiente"}     onClick={() => setTab("pendiente")}     label="Pendientes"  count={m.pendientes} />
        <TabNeo active={tab === "reclamada"}     onClick={() => setTab("reclamada")}     label="Reclamadas"  count={m.reclamadas} />
        <TabNeo active={tab === "cobrada"}       onClick={() => setTab("cobrada")}       label="Cobradas"    count={m.cobradas - m.dobles} />
        <TabNeo active={tab === "cobrada_doble"} onClick={() => setTab("cobrada_doble")} label="Dobles"      count={m.dobles} />
        <TabNeo active={tab === "rechazada"}     onClick={() => setTab("rechazada")}     label="Rechazadas"  count={m.rechazadas} />
        <TabNeo active={tab === "incobrable"}    onClick={() => setTab("incobrable")}    label="Incobrables" count={m.incobrables} />
      </div>

      {/* FILTROS */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <select style={selectNeo} value={filterMes} onChange={e => setFilterMes(e.target.value)}>
          <option value="all">Todos los meses</option>
          {meses.map(mes => (
            <option key={mes} value={mes}>{new Date(mes + "-01").toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</option>
          ))}
        </select>
        <select style={selectNeo} value={filterCanal} onChange={e => setFilterCanal(e.target.value as Canal | "all")}>
          <option value="all">Todas las plataformas</option>
          <option value="uber_eats">Uber Eats</option>
          <option value="glovo">Glovo</option>
          <option value="just_eat">Just Eat</option>
          <option value="web">Web</option>
        </select>
        <select style={selectNeo} value={filterTipo} onChange={e => setFilterTipo(e.target.value as TipoReclamacion | "all")}>
          <option value="all">Todos los tipos</option>
          {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* TABLA */}
      <div style={{ background: "#fff", border: BORDER, boxShadow: SHADOW, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thNeo}>Fecha</th>
                <th style={thNeo}>Pedido</th>
                <th style={thNeo}>Plataforma</th>
                <th style={thNeo}>Tipo</th>
                <th style={{ ...thNeo, textAlign: "right" }}>Importe</th>
                <th style={{ ...thNeo, textAlign: "center" }}>Estado</th>
                <th style={{ ...thNeo, textAlign: "right" }}>Cobro</th>
                <th style={{ ...thNeo, textAlign: "center" }}>📷</th>
                <th style={{ ...thNeo, borderRight: "none" }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ ...tdNeo, textAlign: "center", padding: 30, color: GRIS, fontStyle: "italic" }}>
                  No hay reembolsos con estos filtros.
                </td></tr>
              )}
              {filtered.map(r => (
                <tr key={r.id} style={{ borderBottom: `2px solid ${CREMA}` }}>
                  <td style={{ ...tdNeo, color: GRIS, whiteSpace: "nowrap" }}>{fmtFechaCorta(r.fecha)}</td>
                  <td style={{ ...tdNeo, fontFamily: OSW, fontWeight: 700, whiteSpace: "nowrap" }}>{r.pedido_ref}</td>
                  <td style={{ ...tdNeo, whiteSpace: "nowrap" }}>
                    <span style={{
                      display: "inline-block", padding: "2px 10px", border: `2px solid ${INK}`,
                      background: canalColor(r.canal), color: r.canal === "uber_eats" || r.canal === "glovo" ? INK : "#fff",
                      fontFamily: OSW, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px",
                    }}>{CANAL_LABELS[r.canal]}</span>
                  </td>
                  <td style={{ ...tdNeo, color: GRIS, whiteSpace: "nowrap", fontSize: 12 }} title={r.descripcion || ""}>{TIPO_LABELS[r.tipo]}</td>
                  <td style={{ ...tdNeo, textAlign: "right", fontFamily: OSW, fontWeight: 700, fontSize: 15, whiteSpace: "nowrap" }}>{fmtEur(Number(r.importe_reclamado))}</td>
                  <td style={{ ...tdNeo, textAlign: "center" }}><EstadoBadge estado={r.estado} /></td>
                  <td style={{ ...tdNeo, textAlign: "right", fontSize: 12, fontFamily: OSW, fontWeight: 600, color: r.factura_cobro_periodo ? VERDE : GRIS, whiteSpace: "nowrap" }}>
                    {r.factura_cobro_periodo || "—"}
                  </td>
                  <td style={{ ...tdNeo, textAlign: "center", fontSize: 14 }}>
                    {r.foto_url
                      ? <a href={r.foto_url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>📷</a>
                      : <span style={{ color: GRIS }}>—</span>}
                  </td>
                  <td style={{ ...tdNeo, borderRight: "none", textAlign: "center" }}>
                    <button onClick={() => setEditing(r)} style={btnMini}>✏️</button>
                  </td>
                </tr>
              ))}
              {filtered.length > 0 && (
                <tr style={{ background: CLARO, borderTop: BORDER_CARD }}>
                  <td colSpan={4} style={{ ...tdNeo, fontFamily: OSW, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", fontSize: 11 }}>Total filtrado</td>
                  <td style={{ ...tdNeo, textAlign: "right", fontFamily: OSW, fontWeight: 700, fontSize: 16 }}>{fmtEur(tot.total)}</td>
                  <td colSpan={4}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 22, padding: "10px 16px", background: CLARO, borderTop: BORDER_CARD, fontFamily: OSW, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          <span style={{ color: INK }}>Reclamado <strong style={{ color: ROJO }}>-{fmtEur(m.totalReclamado)}</strong></span>
          <span style={{ color: INK }}>Cobrado <strong style={{ color: VERDE }}>+{fmtEur(m.cobrado)}</strong></span>
          <span style={{ color: INK }}>Perdido <strong style={{ color: ROJO }}>-{fmtEur(m.perdido)}</strong></span>
          <span style={{ color: INK }}>Pendiente <strong style={{ color: NAR }}>{fmtEur(m.enRiesgo)}</strong></span>
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
        onDelete={async () => { if (confirm("¿Eliminar este reembolso?")) { await remove(editing.id); setEditing(null); } }}
      />}
    </div>
  );
}

// =========================================================
// COMPONENTES
// =========================================================

function CardKpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ background: "#fff", border: BORDER_CARD, boxShadow: SHADOW, padding: "14px 16px" }}>
      <div style={{ fontFamily: OSW, fontSize: 11, fontWeight: 600, letterSpacing: "2px", color: INK, textTransform: "uppercase" }}>{label}</div>
      <div style={{ ...d("30px", color), marginTop: 8 }}>{value}</div>
      {sub && <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function CanalCard({ canal, label, data, fallback }: {
  canal: Canal; label: string;
  data: { count: number; enRiesgo: number; cobrado: number; tasa: number | null };
  fallback?: string;
}) {
  const cc = canalColor(canal);
  const hayDatos = data.count > 0;
  return (
    <div style={{ background: "#fff", border: BORDER_CARD, boxShadow: SHADOW }}>
      <div style={{ background: cc, borderBottom: BORDER_CARD, padding: "6px 14px", fontFamily: OSW, fontWeight: 700, fontSize: 12, letterSpacing: "1.5px", textTransform: "uppercase", color: canal === "uber_eats" || canal === "glovo" ? INK : "#fff" }}>
        {label}
      </div>
      <div style={{ padding: "12px 14px" }}>
        {!hayDatos ? (
          <div style={{ color: GRIS, fontFamily: LEX, fontSize: 12, fontStyle: "italic" }}>{fallback || "Sin reembolsos"}</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <div style={d("22px", data.enRiesgo > 0 ? ROJO : VERDE)}>{fmtEur(data.enRiesgo)}</div>
              <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS }}>en riesgo</div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
              <div style={d("16px", VERDE)}>{fmtEur(data.cobrado)}</div>
              <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS }}>cobrado</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTop: `2px solid ${CREMA}`, fontFamily: OSW, fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: INK }}>
              <span>{data.count} {data.count === 1 ? "reembolso" : "reembolsos"}</span>
              <span>{data.tasa !== null ? `Tasa ${data.tasa}%` : "—"}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TabNeo({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button onClick={onClick} style={{
      background: active ? GRANATE : "#fff",
      color: active ? "#fff" : INK,
      border: BORDER_CARD,
      boxShadow: active ? `2px 2px 0 ${INK}` : SHADOW,
      transform: active ? "translate(2px, 2px)" : "none",
      padding: "8px 16px",
      fontFamily: OSW, fontWeight: 700, fontSize: 12, letterSpacing: "1.5px",
      textTransform: "uppercase", cursor: "pointer", transition: "transform 0.08s, box-shadow 0.08s",
    }}>
      {label} <span style={{ opacity: 0.7, marginLeft: 4 }}>{count}</span>
    </button>
  );
}

function EstadoBadge({ estado }: { estado: EstadoReclamacion }) {
  const cc = ESTADO_COLOR[estado];
  const claro = estado === "pendiente" || estado === "incobrable";
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", border: `2px solid ${INK}`,
      fontFamily: OSW, fontSize: 10, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", whiteSpace: "nowrap",
      background: cc, color: claro ? INK : "#fff",
    }}>{ESTADO_LABELS[estado].full}</span>
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
  const [fechaResolucion, setFechaResolucion] = useState(existing?.fecha_resolucion ?? "");
  const [fechaIncobrable, setFechaIncobrable] = useState(existing?.fecha_incobrable ?? "");
  const [importeCompensado, setImporteCompensado] = useState(existing?.importe_compensado?.toString() ?? "");
  const [facturaCobroPeriodo, setFacturaCobroPeriodo] = useState(existing?.factura_cobro_periodo ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const esCobro = estado === "cobrada" || estado === "cobrada_doble";

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
        fecha_resolucion: esCobro ? (fechaResolucion || new Date().toISOString().slice(0, 10)) : (fechaResolucion || null),
        fecha_incobrable: estado === "incobrable" ? (fechaIncobrable || new Date().toISOString().slice(0, 10)) : null,
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
      <div style={{ background: "#fff", border: BORDER, boxShadow: SHADOW, width: 560, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ padding: "12px 18px", borderBottom: BORDER_CARD, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: AMA, zIndex: 1 }}>
          <span style={d("18px")}>{existing ? "Editar reembolso" : "Nuevo reembolso"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, fontWeight: 700, color: INK }}>✕</button>
        </div>
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={sepNeo}>Pedido</div>
          <div style={fg2}>
            <Field label="Plataforma">
              <select style={inputNeo} value={canal} onChange={e => setCanal(e.target.value as Canal)}>
                {Object.entries(CANAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Nº Pedido">
              <input style={inputNeo} value={pedidoRef} onChange={e => setPedidoRef(e.target.value)} placeholder="#A7F2-994" />
            </Field>
            <Field label="Fecha">
              <input type="date" style={inputNeo} value={fecha} onChange={e => setFecha(e.target.value)} />
            </Field>
            <Field label="Importe reclamado (€)">
              <input style={inputNeo} value={importe} onChange={e => setImporte(e.target.value)} placeholder="0,00" />
            </Field>
          </div>
          <div style={fg2}>
            <Field label="Tipo">
              <select style={inputNeo} value={tipo} onChange={e => setTipo(e.target.value as TipoReclamacion)}>
                {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Marca">
              <input style={inputNeo} value={marca || ""} onChange={e => setMarca(e.target.value)} placeholder="Binagre" />
            </Field>
          </div>
          <Field label="Justificación">
            <textarea style={{ ...inputNeo, resize: "vertical", minHeight: 55 }}
              value={descripcion || ""} onChange={e => setDescripcion(e.target.value)}
              placeholder="Describe la incidencia..." />
          </Field>

          <div style={sepNeo}>Evidencia</div>
          {existing?.foto_url && !file && (
            <div style={{ fontFamily: LEX, fontSize: 12, color: GRIS }}>
              Foto actual: <a href={existing.foto_url} target="_blank" rel="noreferrer" style={{ color: VERDE, fontWeight: 700 }}>ver</a>
            </div>
          )}
          <div style={{ border: `3px dashed ${INK}`, padding: 14, textAlign: "center", background: CLARO }}>
            <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ display: "block", margin: "0 auto", fontSize: 12, fontFamily: LEX }} />
            {file && <div style={{ fontFamily: LEX, fontSize: 11, color: VERDE, marginTop: 4, fontWeight: 700 }}>Seleccionado: {file.name}</div>}
          </div>

          <div style={sepNeo}>Estado</div>
          <div style={fg2}>
            <Field label="Estado">
              <select style={inputNeo} value={estado} onChange={e => setEstado(e.target.value as EstadoReclamacion)}>
                {Object.entries(ESTADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v.full}</option>)}
              </select>
            </Field>
            <Field label="Fecha envío reclamación">
              <input type="date" style={inputNeo} value={fechaEnvio || ""} onChange={e => setFechaEnvio(e.target.value)} />
            </Field>
          </div>

          {esCobro && (
            <>
              <div style={fg2}>
                <Field label={estado === "cobrada_doble" ? "Importe total recibido (€)" : "Importe compensado (€)"}>
                  <input style={inputNeo} value={importeCompensado} onChange={e => setImporteCompensado(e.target.value)} placeholder="0,00" />
                </Field>
                <Field label="Cobrado en factura">
                  <input style={inputNeo} value={facturaCobroPeriodo} onChange={e => setFacturaCobroPeriodo(e.target.value)} placeholder="Fact. abr-2026" />
                </Field>
              </div>
              <div style={fg2}>
                <Field label="Fecha cobro">
                  <input type="date" style={inputNeo} value={fechaResolucion || ""} onChange={e => setFechaResolucion(e.target.value)} />
                </Field>
                {estado === "cobrada_doble" && (
                  <div style={{ fontFamily: LEX, fontSize: 11, color: AZUL, alignSelf: "end", paddingBottom: 6, fontWeight: 600 }}>
                    Lo han abonado dos veces: el extra computa como ingreso.
                  </div>
                )}
              </div>
            </>
          )}

          {estado === "incobrable" && (
            <div style={fg2}>
              <Field label="Fecha en que se da por perdido">
                <input type="date" style={inputNeo} value={fechaIncobrable || ""} onChange={e => setFechaIncobrable(e.target.value)} />
              </Field>
              <div style={{ fontFamily: LEX, fontSize: 11, color: ROJO, alignSelf: "end", paddingBottom: 6, fontWeight: 600 }}>
                Este importe computa como pérdida del mes.
              </div>
            </div>
          )}

          {err && <div style={{ background: ROJO, color: "#fff", border: `2px solid ${INK}`, padding: 10, fontFamily: OSW, fontWeight: 700, fontSize: 12, textTransform: "uppercase" }}>{err}</div>}
        </div>
        <div style={{ padding: "12px 18px", borderTop: BORDER_CARD, display: "flex", justifyContent: "flex-end", gap: 10, background: CLARO }}>
          {existing && onDelete && (
            <button onClick={onDelete} disabled={saving} style={{ ...btnNeo("#fff", ROJO), marginRight: "auto" }}>Eliminar</button>
          )}
          <button onClick={onClose} disabled={saving} style={btnNeo("#fff", INK)}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={btnNeo(GRANATE, "#fff")}>{saving ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontFamily: OSW, fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: INK }}>{label}</label>
      {children}
    </div>
  );
}

// =========================================================
// ESTILOS NEOBRUTAL
// =========================================================
const btnNeo = (bg: string, color: string): React.CSSProperties => ({
  background: bg, color, border: BORDER_CARD, boxShadow: SHADOW,
  padding: "9px 18px", fontFamily: OSW, fontWeight: 700, fontSize: 13,
  letterSpacing: "1.5px", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap",
});
const btnMini: React.CSSProperties = { background: "#fff", border: `2px solid ${INK}`, boxShadow: `2px 2px 0 var(--neo-shadow-color)`, padding: "3px 8px", cursor: "pointer", fontSize: 11 };
const selectNeo: React.CSSProperties = { background: "#fff", border: `2px solid ${INK}`, color: INK, padding: "7px 12px", fontFamily: LEX, fontSize: 12, outline: "none", cursor: "pointer" };
const thNeo: React.CSSProperties = { background: "var(--neo-osc)", color: "var(--neo-on-dark)", fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", padding: "10px 12px", textAlign: "left", borderRight: `1px solid rgba(255,255,255,0.15)`, whiteSpace: "nowrap" };
const tdNeo: React.CSSProperties = { padding: "9px 12px", fontFamily: LEX, fontSize: 13, verticalAlign: "middle", color: INK };
const modalOverlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 };
const fg2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const inputNeo: React.CSSProperties = { background: "#fff", border: `2px solid ${INK}`, color: INK, padding: "8px 10px", fontFamily: LEX, fontSize: 13, outline: "none", width: "100%" };
const sepNeo: React.CSSProperties = { fontFamily: OSW, fontSize: 11, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: GRANATE, borderBottom: `2px solid ${INK}`, paddingBottom: 4 };
