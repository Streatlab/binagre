/**
 * Reembolsos — reclamaciones de reembolso a plataformas.
 * Estética Neobrutal Food-Pop (@/styles/neobrutal).
 * Conectado en real: al meter un reembolso verifica el pedido en pedidos_plataforma.
 */
import React, { useMemo, useState } from "react";
import { useReclamaciones, computeMetricas, computeMetricasPorCanal, verificarPedido, CANAL_LABELS, TIPO_LABELS, ESTADO_LABELS, } from "../../lib/reclamaciones/useReclamaciones";
import type {
  Reclamacion, Canal, EstadoReclamacion, TipoReclamacion, PedidoVerificado, } from "../../lib/reclamaciones/useReclamaciones";
import {
  OSW, LEX, INK, CREMA, CLARO, SHADOW, BORDER_CARD, GRANATE, AMA, VERDE, ROJO, NAR, AZUL, GRIS, eyebrow, BLANCO } from '@/styles/neobrutal';

type TabKey = "todas" | "pendiente" | "reclamada" | "cobrada" | "cobrada_doble" | "rechazada" | "incobrable";

const fmtEur = (n: number) =>
  Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

const fmtFechaCorta = (iso: string) => {
  const d = new Date(iso);
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${d.getDate()} ${meses[d.getMonth()]}`;
};

const canalColor = (c: Canal) =>
  c === "uber_eats" ? VERDE : c === "glovo" ? AMA : c === "just_eat" ? NAR : GRANATE;

const estadoColor = (e: EstadoReclamacion): { bg: string; fg: string } => {
  switch (e) {
    case "pendiente":     return { bg: AMA,   fg: INK };
    case "reclamada":     return { bg: AZUL,  fg: BLANCO };
    case "cobrada":       return { bg: VERDE, fg: BLANCO };
    case "cobrada_doble": return { bg: NAR,   fg: BLANCO };
    case "rechazada":     return { bg: ROJO,  fg: BLANCO };
    case "incobrable":    return { bg: GRIS,  fg: BLANCO };
  }
};

export default function ReclamacionReembolsos() {
  const { data, loading, error, insert, update, remove, uploadFoto } = useReclamaciones();
  const [tab, setTab] = useState<TabKey>("todas");
  const [filterCanal, setFilterCanal] = useState<Canal | "all">("all");
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
      if (filterMes !== "all" && !r.fecha.startsWith(filterMes)) return false;
      return true;
    });
  }, [data, tab, filterCanal, filterMes]);

  const m = useMemo(() => computeMetricas(data), [data]);
  const mUE  = useMemo(() => computeMetricasPorCanal(data, "uber_eats"), [data]);
  const mGL  = useMemo(() => computeMetricasPorCanal(data, "glovo"), [data]);
  const mJE  = useMemo(() => computeMetricasPorCanal(data, "just_eat"), [data]);

  const card: React.CSSProperties = { background: BLANCO, border: BORDER_CARD, boxShadow: SHADOW };
  const btnPrim: React.CSSProperties = {
    fontFamily: OSW, fontWeight: 600, fontSize: 13, letterSpacing: "1px", textTransform: "uppercase",
    border: `3px solid ${INK}`, boxShadow: SHADOW, padding: "9px 16px", cursor: "pointer",
    background: GRANATE, color: BLANCO,
  };

  if (loading) return <div style={{ padding: 40, color: GRIS, fontFamily: OSW, textTransform: "uppercase", letterSpacing: "1px" }}>Cargando reembolsos…</div>;
  if (error)   return <div style={{ padding: 40, color: ROJO, fontFamily: LEX }}>Error: {error}</div>;

  return (
    <div style={{ fontFamily: LEX, padding: 28, background: CREMA, minHeight: "100vh", color: INK }}>

      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <span style={eyebrow(NAR, BLANCO)}>OPERACIONES</span>
          <h1 style={{ fontFamily: OSW, fontWeight: 700, fontSize: 34, lineHeight: 0.95, letterSpacing: "-0.5px", textTransform: "uppercase", color: GRANATE, margin: "10px 0 6px" }}>
            REEMBOLSOS
          </h1>
          <span style={{ fontFamily: LEX, fontSize: 13, color: GRIS }}>Reclamaciones a plataformas · seguimiento hasta el cobro</span>
        </div>
        <button onClick={() => setShowNew(true)} style={btnPrim}>+ Nuevo reembolso</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 18 }}>
        <div style={{ ...card, padding: "16px 20px", background: AMA }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: "2px", textTransform: "uppercase", color: INK, marginBottom: 6 }}>Pendiente de cobrar</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 34, lineHeight: 1, color: INK }}>{fmtEur(m.enRiesgo)}</div>
          <div style={{ fontFamily: LEX, fontSize: 12, color: INK, marginTop: 6 }}>
            {m.pendientes} sin reclamar · {m.reclamadas} reclamadas a plataforma
          </div>
        </div>
        <div style={{ ...card, padding: "16px 20px", background: VERDE }}>
          <div style={{ fontFamily: OSW, fontSize: 11, letterSpacing: "2px", textTransform: "uppercase", color: BLANCO, marginBottom: 6 }}>Recuperado 2026</div>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 34, lineHeight: 1, color: BLANCO }}>{fmtEur(m.cobrado)}</div>
          <div style={{ fontFamily: LEX, fontSize: 12, color: BLANCO, marginTop: 6 }}>
            {m.cobradas} cobradas · {m.tasaResolucion}% de éxito · perdido {fmtEur(m.perdido)}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        <CanalCard label="Uber Eats" color={VERDE} data={mUE} card={card} />
        <CanalCard label="Glovo"     color={AMA}   data={mGL} card={card} />
        <CanalCard label="Just Eat"  color={NAR}   data={mJE} card={card} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {([
          ["todas", "Todas", data.length],
          ["pendiente", "Pendientes", m.pendientes],
          ["reclamada", "Reclamadas", m.reclamadas],
          ["cobrada", "Cobradas", m.cobradas - m.dobles],
          ["cobrada_doble", "Dobles", m.dobles],
          ["rechazada", "Rechazadas", m.rechazadas],
          ["incobrable", "Incobrables", m.incobrables],
        ] as [TabKey, string, number][]).map(([k, label, count]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: "8px 16px", border: `3px solid ${INK}`,
            background: tab === k ? GRANATE : BLANCO, color: tab === k ? BLANCO : INK,
            boxShadow: tab === k ? SHADOW : "none",
            fontFamily: OSW, fontSize: 13, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", cursor: "pointer",
          }}>
            {label} <span style={{ opacity: 0.7, marginLeft: 3 }}>{count}</span>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
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
      </div>

      <div style={{ ...card, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: LEX }}>
          <thead>
            <tr style={{ background: INK }}>
              {["Fecha", "Pedido", "Plataforma", "Marca", "Tipo", "Importe", "Estado", "Cobrado en", "Foto", ""].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontFamily: OSW, fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: CREMA, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 30, textAlign: "center", color: GRIS, fontFamily: LEX }}>No hay reembolsos con estos filtros.</td></tr>
            )}
            {filtered.map(r => {
              const ec = estadoColor(r.estado);
              return (
                <tr key={r.id} style={{ borderBottom: `2px solid ${INK}` }}>
                  <td style={{ padding: "10px 12px", color: GRIS, whiteSpace: "nowrap" }}>{fmtFechaCorta(r.fecha)}</td>
                  <td style={{ padding: "10px 12px", fontFamily: OSW, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {r.pedido_ref}
                    {r.pedido_verificado
                      ? <span title="Pedido verificado en plataforma" style={{ marginLeft: 6, color: VERDE }}>✓</span>
                      : <span title="Pedido no encontrado en plataforma" style={{ marginLeft: 6, color: GRIS }}>?</span>}
                  </td>
                  <td style={{ padding: "10px 12px", fontFamily: OSW, fontSize: 12, textTransform: "uppercase", color: canalColor(r.canal) }}>{CANAL_LABELS[r.canal]}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12 }}>{r.marca || "—"}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: GRIS }} title={r.descripcion || ""}>{TIPO_LABELS[r.tipo]}</td>
                  <td style={{ padding: "10px 12px", fontFamily: OSW, fontWeight: 700, textAlign: "right", whiteSpace: "nowrap" }}>{fmtEur(Number(r.importe_reclamado))}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ background: ec.bg, color: ec.fg, border: `2px solid ${INK}`, padding: "3px 9px", fontSize: 11, fontFamily: OSW, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                      {ESTADO_LABELS[r.estado].full}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 11, color: r.factura_cobro_periodo ? VERDE : GRIS, whiteSpace: "nowrap" }}>{r.factura_cobro_periodo || "—"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {r.foto_url
                      ? <a href={r.foto_url} target="_blank" rel="noreferrer" style={{ color: GRANATE, fontFamily: OSW, fontWeight: 600, fontSize: 12 }}>Ver</a>
                      : <span style={{ color: GRIS }}>—</span>}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <button onClick={() => setEditing(r)} style={{ padding: "4px 10px", background: BLANCO, border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 600, fontSize: 11, textTransform: "uppercase", cursor: "pointer" }}>Editar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showNew && <ModalReembolso onClose={() => setShowNew(false)} onSave={async (payload, file) => {
        let foto_url: string | null = null;
        if (file) foto_url = await uploadFoto(file);
        await insert({ ...payload, foto_url } as Partial<Reclamacion>);
        setShowNew(false);
      }} />}

      {editing && <ModalReembolso existing={editing} onClose={() => setEditing(null)}
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

function CanalCard({ label, color, data, card }: {
  label: string; color: string;
  data: { count: number; enRiesgo: number; cobrado: number; tasa: number | null };
  card: React.CSSProperties;
}) {
  return (
    <div style={{ ...card, padding: "12px 16px" }}>
      <div style={{ display: "inline-block", background: color, color: BLANCO, border: `2px solid ${INK}`, fontFamily: OSW, fontWeight: 600, fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", padding: "2px 8px", marginBottom: 10 }}>{label}</div>
      {data.count === 0 ? (
        <div style={{ color: GRIS, fontSize: 12, fontFamily: LEX, padding: "6px 0" }}>Sin reembolsos</div>
      ) : (
        <>
          <div style={{ fontFamily: OSW, fontWeight: 700, fontSize: 22, lineHeight: 1, color: INK }}>{fmtEur(data.enRiesgo)}</div>
          <div style={{ fontFamily: LEX, fontSize: 11, color: GRIS, marginBottom: 6 }}>pendiente</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: GRIS, borderTop: `2px solid ${INK}`, paddingTop: 6, fontFamily: OSW, textTransform: "uppercase" }}>
            <span>{data.count} reemb.</span>
            <span>{data.tasa !== null ? `${data.tasa}% éxito` : "—"}</span>
          </div>
        </>
      )}
    </div>
  );
}

function ModalReembolso({ existing, onClose, onSave, onDelete }: {
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
  const [marca, setMarca] = useState(existing?.marca ?? "");
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

  const [verif, setVerif] = useState<PedidoVerificado | null>(
    existing?.pedido_verificado
      ? { encontrado: true, plataforma: null, marca: existing.marca, fecha: existing.fecha, factura_origen: existing.factura_origen_ref, importe_pedido: null }
      : null
  );
  const [verificando, setVerificando] = useState(false);

  const esCobro = estado === "cobrada" || estado === "cobrada_doble";

  const onVerificar = async () => {
    if (!pedidoRef.trim()) return;
    setVerificando(true);
    setVerif(null);
    try {
      const res = await verificarPedido(pedidoRef);
      setVerif(res);
      if (res.encontrado) {
        if (res.marca && !marca) setMarca(res.marca);
        if (res.fecha) setFecha(res.fecha);
      }
    } finally {
      setVerificando(false);
    }
  };

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
        pedido_verificado: verif?.encontrado ?? false,
        factura_origen_ref: verif?.factura_origen ?? existing?.factura_origen_ref ?? null,
        pedido_plataforma_id: verif?.encontrado ? pedidoRef.trim().replace(/^#/, "") : (existing?.pedido_plataforma_id ?? null),
      }, file);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modalBox, width: 560 }}>
        <div style={modalHeader}>
          <span style={{ fontFamily: OSW, fontWeight: 700, fontSize: 15, textTransform: "uppercase", color: GRANATE }}>{existing ? "Editar reembolso" : "Nuevo reembolso"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: INK }}>✕</button>
        </div>
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>

          <span style={eyebrow(NAR, BLANCO)}>PEDIDO</span>
          <div style={grid2}>
            <Field label="Plataforma">
              <select style={inputNeo} value={canal} onChange={e => setCanal(e.target.value as Canal)}>
                {Object.entries(CANAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Nº Pedido">
              <div style={{ display: "flex", gap: 6 }}>
                <input style={{ ...inputNeo, flex: 1 }} value={pedidoRef} onChange={e => { setPedidoRef(e.target.value); setVerif(null); }} placeholder="Código del pedido" />
                <button type="button" onClick={onVerificar} disabled={verificando || !pedidoRef.trim()}
                  style={{ ...btnMini, background: AMA }}>{verificando ? "…" : "Buscar"}</button>
              </div>
            </Field>
          </div>

          {verif && (
            <div style={{ border: `3px solid ${INK}`, boxShadow: SHADOW, padding: "10px 14px", background: verif.encontrado ? VERDE : ROJO, color: BLANCO, fontFamily: LEX, fontSize: 13 }}>
              {verif.encontrado ? (
                <span><strong>Pedido encontrado</strong>{verif.marca ? ` · ${verif.marca}` : ""}{verif.fecha ? ` · ${fmtFechaCorta(verif.fecha)}` : ""}{verif.importe_pedido != null ? ` · pedido de ${fmtEur(verif.importe_pedido)}` : ""}. Vino en la factura de origen.</span>
              ) : (
                <span><strong>No encontrado.</strong> Ese pedido no aparece en las plataformas cargadas. Revisa el código o guárdalo igual como no verificado.</span>
              )}
            </div>
          )}

          <div style={grid2}>
            <Field label="Fecha">
              <input type="date" style={inputNeo} value={fecha} onChange={e => setFecha(e.target.value)} />
            </Field>
            <Field label="Importe reclamado (€)">
              <input style={inputNeo} value={importe} onChange={e => setImporte(e.target.value)} placeholder="0,00" />
            </Field>
          </div>
          <div style={grid2}>
            <Field label="Tipo">
              <select style={inputNeo} value={tipo} onChange={e => setTipo(e.target.value as TipoReclamacion)}>
                {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Marca">
              <input style={inputNeo} value={marca || ""} onChange={e => setMarca(e.target.value)} placeholder="Marca del pedido" />
            </Field>
          </div>
          <Field label="Qué reclama el cliente / justificación">
            <textarea style={{ ...inputNeo, resize: "vertical", minHeight: 55 }} value={descripcion || ""} onChange={e => setDescripcion(e.target.value)} placeholder="Producto que falta, mal estado, etc." />
          </Field>

          <span style={eyebrow(NAR, BLANCO)}>EVIDENCIA</span>
          {existing?.foto_url && !file && (
            <div style={{ fontSize: 12, color: GRIS, fontFamily: LEX }}>Foto actual: <a href={existing.foto_url} target="_blank" rel="noreferrer" style={{ color: GRANATE }}>ver</a></div>
          )}
          <div style={{ border: `3px dashed ${INK}`, padding: 14, textAlign: "center", background: CLARO }}>
            <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ fontFamily: LEX, fontSize: 12 }} />
            {file && <div style={{ fontSize: 11, color: VERDE, marginTop: 4, fontFamily: LEX }}>Seleccionado: {file.name}</div>}
          </div>

          <span style={eyebrow(NAR, BLANCO)}>ESTADO</span>
          <div style={grid2}>
            <Field label="Estado">
              <select style={inputNeo} value={estado} onChange={e => setEstado(e.target.value as EstadoReclamacion)}>
                {Object.entries(ESTADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v.full}</option>)}
              </select>
            </Field>
            <Field label="Fecha en que reclamé">
              <input type="date" style={inputNeo} value={fechaEnvio || ""} onChange={e => setFechaEnvio(e.target.value)} />
            </Field>
          </div>

          {esCobro && (
            <>
              <div style={grid2}>
                <Field label={estado === "cobrada_doble" ? "Importe total recibido (€)" : "Importe cobrado (€)"}>
                  <input style={inputNeo} value={importeCompensado} onChange={e => setImporteCompensado(e.target.value)} placeholder="0,00" />
                </Field>
                <Field label="Cobrado en factura">
                  <input style={inputNeo} value={facturaCobroPeriodo} onChange={e => setFacturaCobroPeriodo(e.target.value)} placeholder="Ej: factura abril" />
                </Field>
              </div>
              <Field label="Fecha del cobro">
                <input type="date" style={inputNeo} value={fechaResolucion || ""} onChange={e => setFechaResolucion(e.target.value)} />
              </Field>
              {estado === "cobrada_doble" && (
                <div style={{ fontSize: 12, color: NAR, fontFamily: LEX }}>La plataforma lo abonó dos veces: el extra cuenta como ingreso en el Running.</div>
              )}
            </>
          )}

          {estado === "incobrable" && (
            <>
              <Field label="Fecha en que se da por perdido">
                <input type="date" style={inputNeo} value={fechaIncobrable || ""} onChange={e => setFechaIncobrable(e.target.value)} />
              </Field>
              <div style={{ fontSize: 12, color: ROJO, fontFamily: LEX }}>Cuenta como pérdida del mes en el Running.</div>
            </>
          )}

          {err && <div style={{ background: ROJO, color: BLANCO, padding: 10, fontFamily: LEX, fontSize: 13, border: `3px solid ${INK}` }}>{err}</div>}
        </div>
        <div style={modalFooter}>
          {existing && onDelete && (
            <button onClick={onDelete} disabled={saving} style={{ ...btnMini, background: BLANCO, color: ROJO, border: `3px solid ${ROJO}`, marginRight: "auto" }}>Eliminar</button>
          )}
          <button onClick={onClose} disabled={saving} style={{ ...btnMini, background: BLANCO }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ ...btnMini, background: GRANATE, color: BLANCO }}>{saving ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontFamily: OSW, fontSize: 10, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", color: GRIS }}>{label}</label>
      {children}
    </div>
  );
}

const selectNeo: React.CSSProperties = { background: BLANCO, border: `3px solid ${INK}`, color: INK, padding: "7px 12px", fontFamily: OSW, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", cursor: "pointer", outline: "none" };
const inputNeo: React.CSSProperties = { padding: "8px 11px", background: BLANCO, border: `3px solid ${INK}`, color: INK, fontFamily: LEX, fontSize: 14, outline: "none", width: "100%" };
const btnMini: React.CSSProperties = { fontFamily: OSW, fontWeight: 600, fontSize: 12, letterSpacing: "0.5px", textTransform: "uppercase", border: `3px solid ${INK}`, padding: "8px 14px", cursor: "pointer", color: INK, whiteSpace: "nowrap" };
const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 };
const modalBox: React.CSSProperties = { background: CREMA, border: `4px solid ${INK}`, boxShadow: "8px 8px 0 rgba(0,0,0,0.25)", maxWidth: "96vw", maxHeight: "92vh", overflowY: "auto" };
const modalHeader: React.CSSProperties = { padding: "14px 18px", borderBottom: `3px solid ${INK}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: CREMA, zIndex: 1 };
const modalFooter: React.CSSProperties = { padding: "12px 18px", borderTop: `3px solid ${INK}`, display: "flex", justifyContent: "flex-end", gap: 8 };
