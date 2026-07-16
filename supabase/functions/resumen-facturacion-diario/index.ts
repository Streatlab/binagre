import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  let fechaOverride: string | null = null;
  try { const b = await req.json(); if (b?.fecha) fechaOverride = b.fecha; } catch (_) { /**/ }

  // plan-v2/T4: doble cron UTC (verano/invierno) dispara esta función dos
  // veces al día; solo se manda el correo cuando en Madrid son de verdad las
  // 08:00 (o si viene forzada con fecha, para pruebas manuales).
  const horaAhoraMadrid = Number(new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }));
  if (!fechaOverride && horaAhoraMadrid !== 8) {
    return new Response(JSON.stringify({ skip: true, motivo: `en Madrid son las ${horaAhoraMadrid}h, no las 8h` }), { headers: { "Content-Type": "application/json" } });
  }

  const ahoraMadrid = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
  ahoraMadrid.setDate(ahoraMadrid.getDate() - 1);
  const fecha = fechaOverride ?? ahoraMadrid.toISOString().slice(0, 10);
  const fechaObj = new Date(fecha + "T12:00:00");
  const fechaBonita = fechaObj.toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long" });

  const fechaSemPasada = new Date(fechaObj); fechaSemPasada.setDate(fechaSemPasada.getDate() - 7);
  const fechaSemPasadaStr = fechaSemPasada.toISOString().slice(0, 10);
  const isoDow = fechaObj.getDay() === 0 ? 7 : fechaObj.getDay();
  const monday = new Date(fechaObj); monday.setDate(monday.getDate() - (isoDow - 1));
  const mondayStr = monday.toISOString().slice(0, 10);

  const fmt = (n: number) => {
    const [ent, dec] = Math.abs(Number(n || 0)).toFixed(2).split(".");
    return `${Number(n) < 0 ? "-" : ""}${ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
  };
  const fmt0 = (n: number) => Math.round(Number(n || 0)).toLocaleString("es-ES").replace(/,/g, ".");

  const [{ data: filasDia }, { data: filasSemana }, { data: diaSemPasada }, { data: objDia }, { data: ratiosNeto }, { data: snapRows }, { data: robotsRojos }, { data: divergencias }] =
    await Promise.all([
      sb.from("v_facturacion_diario_unificada").select("*").eq("fecha", fecha),
      sb.from("v_facturacion_diario_unificada").select("total_bruto").gte("fecha", mondayStr).lte("fecha", fecha),
      sb.from("v_facturacion_diario_unificada").select("total_bruto").eq("fecha", fechaSemPasadaStr),
      sb.from("objetivos_dia_semana").select("*"),
      sb.from("v_ratio_neto_canal").select("*"),
      sb.rpc("fn_snapshot_marcas_platos", { p_fecha: fecha }),
      sb.from("v_robot_salud").select("fuente, semaforo, ultima_ejecucion").neq("semaforo", "verde"),
      sb.from("robot_log").select("fuente, detalle, ts").eq("estado", "divergencia").gte("ts", `${fecha}T00:00:00Z`).order("ts", { ascending: false }).limit(5),
    ]);

  const sum = (c: string) => (filasDia ?? []).reduce((a, r: Record<string, number>) => a + (Number(r[c]) || 0), 0);
  const totalBruto = sum("total_bruto");
  const totalPedidos = sum("total_pedidos");
  const tm = totalPedidos > 0 ? totalBruto / totalPedidos : 0;

  const ratioMap: Record<string, number> = { web: 1 };
  for (const r of ratiosNeto ?? []) ratioMap[r.canal as string] = Number(r.ratio);

  const COL = { uber: "#06C167", glovo: "#FFC244", je: "#FF8000", web: "#1e2233" };
  const canales = [
    { key: "uber", nombre: "Uber Eats", color: COL.uber, bruto: sum("uber_bruto"), pedidos: sum("uber_pedidos") },
    { key: "glovo", nombre: "Glovo", color: COL.glovo, bruto: sum("glovo_bruto"), pedidos: sum("glovo_pedidos") },
    { key: "je", nombre: "Just Eat", color: COL.je, bruto: sum("je_bruto"), pedidos: sum("je_pedidos") },
    { key: "web", nombre: "Tienda online", color: COL.web, bruto: sum("web_bruto"), pedidos: sum("web_pedidos") },
  ].filter((c) => c.bruto > 0).sort((a, b) => b.bruto - a.bruto);

  const totalSemPasada = (diaSemPasada ?? []).reduce((a, r: Record<string, number>) => a + Number(r.total_bruto || 0), 0);
  const vsSemPasada = totalSemPasada > 0 ? Math.round(((totalBruto - totalSemPasada) / totalSemPasada) * 100) : null;

  const totalSemana = (filasSemana ?? []).reduce((a, r: Record<string, number>) => a + Number(r.total_bruto || 0), 0);
  const objSemanal = (objDia ?? []).reduce((a: number, o: Record<string, number>) => a + Number(o.importe || 0), 0);
  const objHoy = Number((objDia ?? []).find((o: Record<string, number>) => o.dia === isoDow)?.importe || 0);
  const pctSemana = objSemanal > 0 ? Math.min(Math.round((totalSemana / objSemanal) * 100), 100) : 0;
  const faltaSemana = Math.max(objSemanal - totalSemana, 0);

  const marcas = ((snapRows as Record<string, unknown>[]) ?? []).filter((r) => r.tipo === "marca").slice(0, 5);
  const platos = ((snapRows as Record<string, unknown>[]) ?? []).filter((r) => r.tipo === "plato").slice(0, 5);
  const totalMarcasEuros = ((snapRows as Record<string, unknown>[]) ?? [])
    .filter((r) => r.tipo === "marca").reduce((a, r) => a + Number(r.euros || 0), 0);

  const INK = "#1e2233", TX = "#2C2C2A", TX2 = "#5f5e5a";

  const barra = (pct: number, color: string) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#e9e7df;border-radius:6px;">
      <tr><td style="background:${color};height:10px;line-height:10px;font-size:0;border-radius:6px;width:${pct}%;">&nbsp;</td><td style="height:10px;line-height:10px;font-size:0;">&nbsp;</td></tr>
    </table>`;

  const bloqueCanal = (c: typeof canales[0], i: number) => {
    const pct = totalBruto > 0 ? (c.bruto / totalBruto) * 100 : 0;
    const tmC = c.pedidos > 0 ? c.bruto / c.pedidos : 0;
    const neto = c.bruto * (ratioMap[c.key] ?? 0.43);
    const estrella = i === 0 ? ' <span style="color:#f0c808;font-size:15px;">★</span>' : "";
    return `
      <tr><td style="padding:0 0 18px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="top" style="width:58%;padding-right:14px;">
            <div style="font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:${TX};padding-bottom:8px;">${c.nombre}${estrella} <span style="font-weight:normal;font-size:12px;color:${TX2};">· ${c.pedidos} ped</span></div>
            ${barra(Math.max(pct, 2), c.color)}
          </td>
          <td valign="top" align="right" style="width:42%;">
            <div style="font-family:Arial,sans-serif;font-size:19px;font-weight:bold;color:${INK};line-height:1.2;padding-bottom:4px;">${fmt(c.bruto)} €</div>
            <div style="font-family:Arial,sans-serif;line-height:1.65;">
              <span style="font-size:13px;font-weight:bold;color:${INK};">${Math.round(pct)}%</span> <span style="font-size:11px;color:#7a7970;">del total</span><br>
              <span style="font-size:13px;font-weight:bold;color:#157a40;">${fmt(neto)} €</span> <span style="font-size:11px;color:#7a7970;">neto</span><br>
              <span style="font-size:13px;font-weight:bold;color:#B01D23;">${fmt(tmC)} €</span> <span style="font-size:11px;color:#7a7970;">TM</span>
            </div>
          </td>
        </tr></table>
      </td></tr>`;
  };

  const iconoCanal = (canal: string) => {
    if (canal === "uber") return `<span style="background:${COL.uber};color:#fff;font-family:Arial,sans-serif;font-size:10px;font-weight:bold;padding:2px 7px;border-radius:4px;">Uber</span>`;
    if (canal === "glovo") return `<span style="background:${COL.glovo};color:#5a4400;font-family:Arial,sans-serif;font-size:10px;font-weight:bold;padding:2px 7px;border-radius:4px;">Glovo</span>`;
    if (canal === "je") return `<span style="background:${COL.je};color:#fff;font-family:Arial,sans-serif;font-size:10px;font-weight:bold;padding:2px 7px;border-radius:4px;">Just Eat</span>`;
    if (canal === "web") return `<span style="background:${COL.web};color:#fff;font-family:Arial,sans-serif;font-size:10px;font-weight:bold;padding:2px 7px;border-radius:4px;">Online</span>`;
    return "";
  };

  const medalColor = ["#B01D23", "#c8323a", "#d96b71", "#e0989c", "#ecc0c3"];
  const filaMarca = (m: Record<string, unknown>, i: number, last: boolean) => {
    const euros = Number(m.euros || 0);
    const peds = Number(m.unidades || 0);
    const tmM = peds > 0 ? euros / peds : 0;
    const pctM = totalMarcasEuros > 0 ? (euros / totalMarcasEuros) * 100 : 0;
    const badge = m.canal !== "multi" ? iconoCanal(m.canal as string) : "";
    return `
    <tr>
      <td width="26" valign="middle" style="padding:8px 0;border-bottom:${last ? "none" : "1px solid #ececec"};"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="20" height="20" align="center" valign="middle" style="background:${medalColor[i]};border-radius:10px;font-family:Arial,sans-serif;font-size:11px;color:#fff;">${i + 1}</td></tr></table></td>
      <td valign="middle" style="padding:8px 8px;border-bottom:${last ? "none" : "1px solid #ececec"};">
        <div style="font-family:Arial,sans-serif;font-size:14px;color:${TX};">${m.nombre} ${badge}</div>
        <div style="font-family:Arial,sans-serif;font-size:11px;color:${TX2};">${Math.round(pctM)}% del total · TM ${fmt(tmM)} €</div>
      </td>
      <td align="right" valign="middle" style="padding:8px 0;border-bottom:${last ? "none" : "1px solid #ececec"};font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:${INK};">${fmt(euros)} €</td>
    </tr>`;
  };

  const filaPlato = (p: Record<string, unknown>, i: number, last: boolean) => `
    <tr>
      <td width="26" valign="middle" style="padding:8px 0;border-bottom:${last ? "none" : "1px solid #ececec"};"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="20" height="20" align="center" valign="middle" style="background:${medalColor[i]};border-radius:10px;font-family:Arial,sans-serif;font-size:11px;color:#fff;">${i + 1}</td></tr></table></td>
      <td valign="middle" style="padding:8px 8px;border-bottom:${last ? "none" : "1px solid #ececec"};font-family:Arial,sans-serif;font-size:14px;color:${TX};">${p.nombre}</td>
      <td align="right" valign="middle" width="52" style="padding:8px 8px;border-bottom:${last ? "none" : "1px solid #ececec"};font-family:Arial,sans-serif;font-size:12px;color:${TX2};">${p.unidades} u</td>
      <td align="right" valign="middle" width="74" style="padding:8px 0;border-bottom:${last ? "none" : "1px solid #ececec"};font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:${INK};">${fmt(p.euros as number)} €</td>
    </tr>`;

  const objSuperado = totalBruto >= objHoy && objHoy > 0;
  const bloqueObjetivo = objHoy > 0 ? `
    <tr><td style="padding:16px 26px 0 26px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${objSuperado ? "#e3f5e9" : "#fde3e3"};border-radius:12px;">
        <tr>
          <td width="52" style="padding:14px 0 14px 16px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="36" height="36" align="center" valign="middle" style="background:${objSuperado ? "#1a8f4c" : "#B01D23"};border-radius:18px;font-family:Arial,sans-serif;font-size:18px;color:#fff;">${objSuperado ? "✓" : "!"}</td></tr></table></td>
          <td style="padding:14px 16px;">
            <div style="font-family:Arial,sans-serif;font-size:14px;font-weight:bold;color:${objSuperado ? "#0c5e31" : "#8a1015"};">${objSuperado ? "Objetivo del día superado" : "Objetivo del día no alcanzado"}</div>
            <div style="font-family:Arial,sans-serif;font-size:12px;color:${objSuperado ? "#157a40" : "#b0242a"};">${fmt0(objHoy)} € objetivo · ${objSuperado ? "+" + fmt(totalBruto - objHoy) + " € por encima" : "faltaron " + fmt(objHoy - totalBruto) + " €"}</div>
          </td>
        </tr>
      </table>
    </td></tr>` : "";

  // plan-v2/T4: incidencias — robots en rojo/amarillo (v_robot_salud) y
  // divergencias formula-vs-robot logueadas en la consolidación nocturna.
  const incidencias: string[] = [];
  for (const r of robotsRojos ?? []) {
    incidencias.push(`${r.semaforo === "rojo" ? "🔴" : "🟡"} ${r.fuente}: sin latido reciente (${new Date(r.ultima_ejecucion).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })})`);
  }
  for (const d of divergencias ?? []) {
    incidencias.push(`⚠️ ${d.fuente}: ${d.detalle}`);
  }
  const bloqueIncidencias = incidencias.length > 0 ? `
    <tr><td style="padding:16px 26px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e6;border:1px solid #f0dca0;border-radius:12px;">
        <tr><td style="padding:14px 16px;">
          <div style="font-family:Arial,sans-serif;font-size:13px;font-weight:bold;color:#8a6d1a;padding-bottom:8px;">Incidencias (${incidencias.length})</div>
          ${incidencias.map((i) => `<div style="font-family:Arial,sans-serif;font-size:12px;color:#6b5a1e;padding:2px 0;">${i}</div>`).join("")}
        </td></tr>
      </table>
    </td></tr>` : "";

  const html = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3ef;padding:20px 0;">
  <tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fbfbf9;border-radius:16px;overflow:hidden;max-width:600px;">

    <tr><td style="background:#B01D23;padding:22px 26px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-family:Arial,sans-serif;color:#ffffff;font-weight:bold;font-size:16px;letter-spacing:2px;">STREAT LAB</td>
        <td align="right" style="font-family:Arial,sans-serif;color:#f7cdd0;font-size:12px;">${fechaBonita}</td>
      </tr></table>
      <div style="font-family:Arial,sans-serif;color:#f7cdd0;font-size:13px;margin-top:3px;">Resumen de facturación</div>
    </td></tr>

    <tr><td align="center" style="padding:24px 26px 6px;">
      <div style="font-family:Arial,sans-serif;font-size:11px;color:#7a7970;letter-spacing:1px;text-transform:uppercase;">Facturación del día</div>
      <div style="font-family:Arial,sans-serif;font-size:46px;font-weight:bold;color:${INK};line-height:1.1;padding:4px 0 8px;">${fmt(totalBruto)} €</div>
      ${vsSemPasada !== null ? `<span style="font-family:Arial,sans-serif;background:${vsSemPasada >= 0 ? "#e3f5e9" : "#fde3e3"};color:${vsSemPasada >= 0 ? "#157a40" : "#b0242a"};font-size:13px;font-weight:bold;padding:6px 14px;border-radius:20px;">${vsSemPasada >= 0 ? "▲ +" : "▼ "}${vsSemPasada}% vs semana pasada</span>` : ""}
    </td></tr>

    <tr><td style="padding:22px 26px 6px;">
      <div style="font-family:Arial,sans-serif;font-size:13px;font-weight:bold;color:${INK};padding-bottom:16px;">Por plataforma</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${canales.map(bloqueCanal).join("")}</table>
    </td></tr>

    <tr><td style="padding:6px 26px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="49%" style="background:#ffffff;border:1px solid #e5e4de;border-radius:12px;padding:14px;text-align:center;">
          <div style="font-family:Arial,sans-serif;font-size:26px;font-weight:bold;color:${INK};">${totalPedidos}</div>
          <div style="font-family:Arial,sans-serif;font-size:12px;color:${TX2};">pedidos</div>
        </td>
        <td width="2%">&nbsp;</td>
        <td width="49%" style="background:#ffffff;border:1px solid #e5e4de;border-radius:12px;padding:14px;text-align:center;">
          <div style="font-family:Arial,sans-serif;font-size:26px;font-weight:bold;color:${INK};">${fmt(tm)} €</div>
          <div style="font-family:Arial,sans-serif;font-size:12px;color:${TX2};">TM</div>
        </td>
      </tr></table>
    </td></tr>

    ${bloqueObjetivo}
    ${bloqueIncidencias}

    <tr><td style="padding:16px 26px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${INK};border-radius:12px;">
        <tr><td style="padding:18px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-family:Arial,sans-serif;font-size:14px;color:#ffffff;font-weight:bold;">Semana en curso</td>
            <td align="right" style="font-family:Arial,sans-serif;font-size:14px;color:#e8f442;font-weight:bold;">${pctSemana}%</td>
          </tr></table>
          <div style="font-family:Arial,sans-serif;font-size:30px;font-weight:bold;color:#ffffff;padding:6px 0 10px;">${fmt(totalSemana)} €</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#454b63;border-radius:6px;">
            <tr><td style="background:#e8f442;height:10px;line-height:10px;font-size:0;border-radius:6px;width:${pctSemana}%;">&nbsp;</td><td style="height:10px;line-height:10px;font-size:0;">&nbsp;</td></tr>
          </table>
          <div style="font-family:Arial,sans-serif;font-size:13px;color:#d6d8e2;padding-top:8px;">Objetivo semanal ${fmt0(objSemanal)} € · faltan ${fmt(faltaSemana)} €</div>
        </td></tr>
      </table>
    </td></tr>

    ${marcas.length > 0 ? `<tr><td style="padding:22px 26px 0;">
      <div style="font-family:Arial,sans-serif;font-size:13px;font-weight:bold;color:${INK};padding-bottom:4px;">🏆 Top marcas del día</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${marcas.map((m, i) => filaMarca(m, i, i === marcas.length - 1)).join("")}</table>
    </td></tr>` : ""}

    ${platos.length > 0 ? `<tr><td style="padding:22px 26px 22px;">
      <div style="font-family:Arial,sans-serif;font-size:13px;font-weight:bold;color:${INK};padding-bottom:4px;">🍽️ Top productos del día</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${platos.map((p, i) => filaPlato(p, i, i === platos.length - 1)).join("")}</table>
    </td></tr>` : ""}

  </table>
  </td></tr>
  </table>`;

  const { data: resendKey } = await sb.rpc("fn_get_secret", { secret_name: "resend_api_key" });
  const { data: destinos } = await sb.from("config_notificaciones_diarias").select("destino").eq("tipo", "email").eq("activo", true);

  const resultados = [];
  if (resendKey) {
    for (const d of destinos ?? []) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Streat Lab ERP <onboarding@resend.dev>",
          to: [d.destino],
          subject: `📊 Facturación Streat Lab · ${fechaObj.toLocaleDateString("es-ES", { day: "2-digit", month: "long" })} — ${fmt(totalBruto)} €`,
          html,
        }),
      });
      resultados.push({ destinatario: d.destino, status: res.status, body: await res.text() });
    }
  }

  return new Response(JSON.stringify({ fecha, totalBruto, incidencias: incidencias.length, resultados }), { headers: { "Content-Type": "application/json" } });
});
