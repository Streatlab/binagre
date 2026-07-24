/* ============================================================================
   FichaEPSPrint.tsx  ·  Streat Lab · ERP Binagre
   ----------------------------------------------------------------------------
   PEGAR ESTE ARCHIVO TAL CUAL EN:  src/components/escandallo/FichaEPSPrint.tsx
   NO REDISEÑAR. NO CAMBIAR ESTILOS. NO PASAR A TAILWIND.
   Los estilos van inline a propósito: es un documento imprimible y el diseño
   está aprobado. Cualquier cambio visual rompe el estándar de documentos.

   USO:
     import FichaEPSPrint from "@/components/escandallo/FichaEPSPrint";
     <FichaEPSPrint ficha={ficha} bn={false} />

   REQUISITO ÚNICO: cargar las fuentes en index.html (si no están ya):
     <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Lexend:wght@300;400;500;600;700&display=swap" rel="stylesheet">
   ========================================================================== */

import * as React from "react";

export type FichaEPSIngrediente = {
  nombre: string;
  cantidad: string;   // "200"
  unidad: string;     // "ml." | "gr." | "lata" | "paquete" | "ud."
};

export type FichaEPSConservacion = {
  taper?: string;         // "2 días" | "" (vacío = se rellena a mano)
  biberon?: string;
  vacio?: string;
  congelacion?: string;
};

export type FichaEPSData = {
  tipo: "EPS" | "REC";
  codigo: string;               // "EPS002"
  nombre: string;               // "Salsa Napolitana"
  categoria: string;            // "Salsas y cremas"
  revision: string;             // "01"
  tiempoPreparacion: string;    // "45 min"
  rendimiento: string;          // "7.170 rac."
  costeTanda: string;           // "14,19 €"
  costeRacion: string;          // "0,00 €"
  ingredientes: FichaEPSIngrediente[];
  /** Los ingredientes citados van entre <b></b>. Se renderiza como HTML. */
  pasos: string[];
  conservacion: FichaEPSConservacion;
  /** Alérgenos presentes (keys). El resto quedan sin marcar. */
  alergenosPresentes?: string[];
};

const OSW = "'Oswald', system-ui, sans-serif";
const LEX = "'Lexend', system-ui, sans-serif";

const T = {
  paper: "#ffffff",
  ink: "#241d15",
  ink2: "#5c554a",
  ink3: "#8a8275",
  rule: "#c3bba8",
  rule2: "#7d7566",
  thead: "#efe9dc",
  zebra: "#f8f4ec",
  fill: "#a49a86",
};

/* Iconos de trazo (estilo NavIcon.tsx: stroke 1.5, round, sin relleno).
   NUNCA sustituir por emoji: no imprimen bien en blanco y negro. */
const Ico = ({ d, size = "4mm" }: { d: string; size?: string }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flex: "none", color: T.ink2 }}
    dangerouslySetInnerHTML={{ __html: d }}
  />
);

const ICONOS: Record<string, string> = {
  gluten:
    '<path d="M12 21V8"/><path d="M12 8c0-2.5 2-4.5 4.5-4.5C16.5 6 14.5 8 12 8Z"/><path d="M12 8C12 5.5 10 3.5 7.5 3.5 7.5 6 9.5 8 12 8Z"/><path d="M12 13c0-2.2 1.8-4 4-4 0 2.2-1.8 4-4 4Z"/><path d="M12 13c0-2.2-1.8-4-4-4 0 2.2 1.8 4 4 4Z"/><path d="M12 18c0-2.2 1.8-4 4-4 0 2.2-1.8 4-4 4Z"/><path d="M12 18c0-2.2-1.8-4-4-4 0 2.2 1.8 4 4 4Z"/>',
  lacteos:
    '<path d="M9 3h6l-.5 3.2 2.2 3.4c.2.3.3.7.3 1V20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-9.4c0-.3.1-.7.3-1l2.2-3.4Z"/><path d="M7.2 13h9.6"/>',
  huevos: '<ellipse cx="12" cy="14" rx="6" ry="8"/>',
  soja:
    '<path d="M6 18c-2-4 1-9 5-11 3-1.5 6-1 7 1 1 2-1 4-3 5"/><circle cx="9.5" cy="13" r="1.6"/><circle cx="13" cy="9.5" r="1.6"/><path d="M6 18c1.5 1.5 4 2 6 1"/>',
  frutos_secos:
    '<path d="M12 3c3.5 2 5.5 5.5 5.5 9 0 4.5-2.5 8-5.5 9-3-1-5.5-4.5-5.5-9C6.5 8.5 8.5 5 12 3Z"/><path d="M12 4v17"/>',
  crustaceos:
    '<circle cx="12" cy="13" r="4"/><path d="M8 9 4 5"/><path d="M16 9l4-4"/><path d="M4 5l.5 3"/><path d="M20 5l-.5 3"/><path d="M9 17l-3 3"/><path d="M15 17l3 3"/><path d="M12 17v4"/>',
  pescado:
    '<path d="M3 12c3-4 7-6 11-6 3 0 5 1.5 7 6-2 4.5-4 6-7 6-4 0-8-2-11-6Z"/><circle cx="16.5" cy="11" r="0.8" fill="currentColor" stroke="none"/><path d="M3 12l3-3v6l-3-3Z"/>',
  moluscos:
    '<path d="M12 20C7 20 3 16 3 11c0-1 .5-2 1.5-2S6 10 6 11c0-1.5 1-3 2.5-3S11 9.5 11 11c0-1.5 1-3 2.5-3S16 9.5 16 11c0-1 .5-2 1.5-2S21 10 21 11c0 5-4 9-9 9Z"/>',
  cacahuetes:
    '<path d="M12 3c2.2 0 4 1.8 4 4 0 1.2-.5 2.2-1.2 3 .7.8 1.2 1.8 1.2 3v1c0 3.9-1.8 7-4 7s-4-3.1-4-7v-1c0-1.2.5-2.2 1.2-3C8.5 9.2 8 8.2 8 7c0-2.2 1.8-4 4-4Z"/><path d="M8.8 10h6.4"/>',
  apio:
    '<path d="M9 21c-1-4-1-9 0-14"/><path d="M12 21c0-5 0-10 1-15"/><path d="M15 21c1-4 1.5-8 1-12"/><path d="M6 7c2-1 4-1 6 0"/><path d="M12 6c2-1.5 4-1.5 6 0"/>',
  mostaza:
    '<path d="M10 21V9a2 2 0 0 1 4 0v12"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/><path d="M11 3h2"/>',
  sesamo:
    '<ellipse cx="9" cy="9" rx="2" ry="3" transform="rotate(-20 9 9)"/><ellipse cx="15" cy="12" rx="2" ry="3" transform="rotate(15 15 12)"/><ellipse cx="10" cy="16" rx="2" ry="3" transform="rotate(-10 10 16)"/>',
  sulfitos:
    '<path d="M9 3h6v5a3 3 0 0 1-3 3 3 3 0 0 1-3-3V3Z"/><path d="M12 11v7"/><path d="M9 21h6"/>',
  altramuces:
    '<path d="M12 21V10"/><path d="M12 10c-2 0-3.5-1.5-3.5-3.5S10 3 12 3s3.5 1.5 3.5 3.5S14 10 12 10Z"/><path d="M12 14c-2.5 0-4-1-4-1"/><path d="M12 17c2.5 0 4-1 4-1"/>',
  taper:
    '<path d="M5 8h14l-1 11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 8Z"/><path d="M3.5 5.5h17V8h-17Z"/>',
  biberon:
    '<path d="M10 3h4v2.5l1.5 2c.3.4.5.9.5 1.4V20a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8.9c0-.5.2-1 .5-1.4L10 5.5V3Z"/><path d="M8.2 12h7.6"/>',
  vacio:
    '<rect x="4" y="6" width="16" height="12" rx="1.5"/><path d="M8 6v12"/><path d="M16 6v12"/><path d="M4 12h16"/>',
  congelacion:
    '<path d="M12 3v18"/><path d="M3.6 7.5l16.8 9"/><path d="M20.4 7.5l-16.8 9"/><path d="M12 7l-2.5-2M12 7l2.5-2"/><path d="M12 17l-2.5 2M12 17l2.5 2"/>',
};

/* Orden aprobado: los 5 más frecuentes primero. Sin "Ninguno". */
const ALERGENOS_12: Array<[string, string]> = [
  ["Gluten", "gluten"],
  ["Lácteos", "lacteos"],
  ["Huevos", "huevos"],
  ["Soja", "soja"],
  ["Frutos secos", "frutos_secos"],
  ["Crustáceos", "crustaceos"],
  ["Pescado", "pescado"],
  ["Moluscos", "moluscos"],
  ["Cacahuetes", "cacahuetes"],
  ["Apio", "apio"],
  ["Mostaza", "mostaza"],
  ["Sésamo", "sesamo"],
];
const ALERGENOS_2: Array<[string, string]> = [
  ["Sulfitos", "sulfitos"],
  ["Altramuces", "altramuces"],
];

const Casilla = () => (
  <span
    style={{
      flex: "none",
      width: "3.4mm",
      height: "3.4mm",
      border: `1.2px solid ${T.rule2}`,
      borderRadius: 1,
      background: "#fff",
    }}
  />
);

const Seccion = ({ acc, children }: { acc: string; children: React.ReactNode }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "2.2mm", marginBottom: "1.4mm" }}>
    <span style={{ width: "3mm", height: "3mm", background: acc, flex: "none" }} />
    <span
      style={{
        fontFamily: OSW,
        fontSize: "2.9mm",
        letterSpacing: "1.8px",
        textTransform: "uppercase",
        fontWeight: 600,
        color: acc,
      }}
    >
      {children}
    </span>
  </div>
);

export default function FichaEPSPrint({
  ficha,
  bn = false,
  logoSrc = "/logo-streatlab.png",
}: {
  ficha: FichaEPSData;
  bn?: boolean;
  logoSrc?: string;
}) {
  const acc = bn ? "#565656" : "#a8524e"; // acento ÁREA COCINA
  const presentes = ficha.alergenosPresentes ?? [];
  const cons: Array<[string, string, string]> = [
    ["Táper", "taper", ficha.conservacion.taper ?? ""],
    ["Biberón", "biberon", ficha.conservacion.biberon ?? ""],
    ["Vacío", "vacio", ficha.conservacion.vacio ?? ""],
    ["Congelación", "congelacion", ficha.conservacion.congelacion ?? ""],
  ];
  const eyebrow = ficha.tipo === "EPS" ? "Elaboración previa" : "Receta";

  const celdaAlergeno = (k: string, ic: string, i: number, ultimaFila: boolean) => (
    <div
      key={k}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1.4mm",
        padding: "1.3mm 1.6mm",
        borderTop: ultimaFila ? "0" : i < 3 ? "0" : `1px solid ${T.rule}`,
        borderRight:
          ultimaFila ? (i === 0 ? `1px solid ${T.rule}` : "0") : i % 3 === 2 ? "0" : `1px solid ${T.rule}`,
      }}
    >
      <Casilla />
      <span
        style={{
          flex: 1,
          fontFamily: OSW,
          fontSize: "2.5mm",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.2px",
          color: T.ink,
          lineHeight: 1.05,
          textDecoration: presentes.indexOf(k) !== -1 ? "none" : "none",
        }}
      >
        {k}
      </span>
      <Ico d={ICONOS[ic]} size="3.4mm" />
    </div>
  );

  return (
    <div
      style={{
        boxSizing: "border-box",
        width: "210mm",
        minHeight: "297mm",
        padding: "9mm 10mm 8mm",
        background: T.paper,
        color: T.ink,
        fontFamily: LEX,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ---------- CABECERA ---------- */}
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "5mm",
          borderBottom: `2px solid ${acc}`,
          paddingBottom: "3mm",
          marginBottom: "2.6mm",
        }}
      >
        <img
          src={logoSrc}
          alt="Streat Lab"
          style={{ width: "19mm", height: "19mm", objectFit: "contain", flex: "none", display: "block" }}
        />
        <div style={{ flex: 1, minWidth: 0, paddingTop: "0.4mm" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "2.4mm", marginBottom: "1.2mm" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "1.6mm",
                border: `1.4px solid ${acc}`,
                borderRadius: 2,
                padding: "0.7mm 2.2mm",
              }}
            >
              <span style={{ width: "2.6mm", height: "2.6mm", borderRadius: 1, background: acc, flex: "none" }} />
              <span
                style={{
                  fontFamily: OSW,
                  fontWeight: 700,
                  fontSize: "3mm",
                  letterSpacing: "1.6px",
                  textTransform: "uppercase",
                  color: acc,
                }}
              >
                Cocina
              </span>
            </span>
            <span
              style={{
                fontFamily: OSW,
                fontSize: "2.7mm",
                letterSpacing: "2.2px",
                fontWeight: 500,
                textTransform: "uppercase",
                color: T.ink3,
              }}
            >
              {eyebrow}
            </span>
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: OSW,
              fontSize: "8.4mm",
              fontWeight: 700,
              lineHeight: 0.98,
              letterSpacing: "-0.3px",
              textTransform: "uppercase",
            }}
          >
            {ficha.nombre}
          </h1>
          <div style={{ marginTop: "1mm", fontFamily: LEX, fontSize: "2.9mm", color: T.ink2 }}>
            {ficha.categoria}
          </div>
        </div>

        {/* cuadro de control */}
        <div
          style={{
            flex: "none",
            width: "40mm",
            border: `1px solid ${T.rule2}`,
            borderRadius: 2,
            background: T.paper,
          }}
        >
          <div style={{ padding: "1.2mm 2.4mm", borderBottom: `1px solid ${T.rule}` }}>
            <div style={{ fontFamily: OSW, fontSize: "2.3mm", letterSpacing: "1.2px", textTransform: "uppercase", color: T.ink3 }}>
              Código
            </div>
            <div style={{ fontFamily: OSW, fontSize: "3.6mm", fontWeight: 600 }}>{ficha.codigo}</div>
          </div>
          <div style={{ display: "flex" }}>
            <div style={{ flex: 1, padding: "1.2mm 2.4mm", borderRight: `1px solid ${T.rule}` }}>
              <div style={{ fontFamily: OSW, fontSize: "2.3mm", letterSpacing: "1.2px", textTransform: "uppercase", color: T.ink3 }}>
                Revisión
              </div>
              <div style={{ fontFamily: OSW, fontSize: "3.6mm", fontWeight: 600 }}>{ficha.revision}</div>
            </div>
            <div style={{ flex: 1, padding: "1.2mm 2.4mm" }}>
              <div style={{ fontFamily: OSW, fontSize: "2.3mm", letterSpacing: "1.2px", textTransform: "uppercase", color: T.ink3 }}>
                Fecha
              </div>
              <div style={{ fontFamily: OSW, fontSize: "3.6mm", fontWeight: 600, color: T.fill }}>__/__/__</div>
            </div>
          </div>
        </div>
      </header>

      {/* ---------- BANDA DE DATOS ---------- */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          border: `1px solid ${T.rule2}`,
          borderRadius: 2,
          marginBottom: "2.6mm",
        }}
      >
        {[
          ["Tiempo de preparación", ficha.tiempoPreparacion, false],
          ["Rendimiento", ficha.rendimiento, false],
          ["Coste tanda", ficha.costeTanda, false],
          ["€ / Ración", ficha.costeRacion, true],
        ].map(([k, v, last], i) => (
          <div
            key={i}
            style={{
              padding: "1.5mm 2.4mm",
              borderRight: i < 3 ? `1px solid ${T.rule}` : "0",
              background: last ? T.zebra : "transparent",
            }}
          >
            <div style={{ fontFamily: OSW, fontSize: "2.3mm", letterSpacing: "1px", textTransform: "uppercase", color: T.ink3 }}>
              {k as string}
            </div>
            <div
              style={{
                fontFamily: OSW,
                fontSize: "4mm",
                fontWeight: last ? 700 : 600,
                color: last ? acc : T.ink,
              }}
            >
              {v as string}
            </div>
          </div>
        ))}
      </div>

      {/* ---------- INGREDIENTES ---------- */}
      <Seccion acc={acc}>Ingredientes</Seccion>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
          fontFamily: LEX,
          border: `1px solid ${T.rule2}`,
          marginBottom: "2.6mm",
        }}
      >
        <thead>
          <tr
            style={{
              background: T.thead,
              fontFamily: OSW,
              fontSize: "2.9mm",
              textTransform: "uppercase",
              letterSpacing: "0.4px",
              borderBottom: `1.6px solid ${acc}`,
            }}
          >
            <th style={{ borderRight: `1px solid ${T.rule}`, padding: "1.3mm 2.4mm", fontWeight: 600, textAlign: "left" }}>
              Ingrediente
            </th>
            <th style={{ width: "20mm", borderRight: `1px solid ${T.rule}`, padding: "1.3mm 2mm", fontWeight: 600, textAlign: "right" }}>
              Cantidad
            </th>
            <th style={{ width: "22mm", borderRight: `1px solid ${T.rule}`, padding: "1.3mm 2mm", fontWeight: 600, textAlign: "left" }}>
              Unidad
            </th>
            <th style={{ width: "52mm", padding: "1.3mm 2.4mm", fontWeight: 600, textAlign: "left" }}>Equivalencia</th>
          </tr>
        </thead>
        <tbody>
          {ficha.ingredientes.map((ing, j) => (
            <tr key={j} style={{ background: j % 2 === 1 ? T.zebra : T.paper }}>
              <td
                style={{
                  height: "7.2mm",
                  borderTop: `1px solid ${T.rule}`,
                  borderRight: `1px solid ${T.rule}`,
                  padding: "0 2.4mm",
                  fontSize: "3.6mm",
                  fontWeight: 500,
                  color: T.ink,
                }}
              >
                {ing.nombre}
              </td>
              <td
                style={{
                  borderTop: `1px solid ${T.rule}`,
                  borderRight: `1px solid ${T.rule}`,
                  padding: "0 2mm",
                  textAlign: "right",
                  fontFamily: OSW,
                  fontSize: "3.6mm",
                  fontWeight: 600,
                  color: T.ink,
                }}
              >
                {ing.cantidad}
              </td>
              <td
                style={{
                  borderTop: `1px solid ${T.rule}`,
                  borderRight: `1px solid ${T.rule}`,
                  padding: "0 2mm",
                  fontFamily: LEX,
                  fontSize: "3.3mm",
                  color: T.ink2,
                }}
              >
                {ing.unidad}
              </td>
              {/* Equivalencia: SIEMPRE vacía — se rellena a mano */}
              <td style={{ borderTop: `1px solid ${T.rule}`, padding: "0 2.4mm" }} />
            </tr>
          ))}
        </tbody>
      </table>

      {/* ---------- PREPARACIÓN ---------- */}
      <Seccion acc={acc}>Preparación</Seccion>
      <div style={{ border: `1px solid ${T.rule2}`, borderRadius: 2, marginBottom: "2.6mm" }}>
        {ficha.pasos.map((t, j) => (
          <div
            key={j}
            style={{
              display: "flex",
              gap: "2.6mm",
              alignItems: "baseline",
              borderBottom: j === ficha.pasos.length - 1 ? "0" : `1px solid ${T.rule}`,
              padding: "1.5mm 3mm",
            }}
          >
            <span style={{ fontFamily: OSW, fontSize: "3.4mm", fontWeight: 700, color: acc, flex: "none", minWidth: "5mm" }}>
              {j + 1}.
            </span>
            <span
              style={{ fontFamily: LEX, fontSize: "3.5mm", lineHeight: 1.35, color: T.ink }}
              dangerouslySetInnerHTML={{ __html: t }}
            />
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* ---------- CONSERVACIÓN + ALÉRGENOS ---------- */}
      <div style={{ display: "flex", gap: "4mm" }}>
        <div style={{ width: "64mm", flex: "none" }}>
          <Seccion acc={acc}>Conservación</Seccion>
          <div style={{ border: `1px solid ${T.rule2}`, borderRadius: 2 }}>
            {cons.map(([k, ic, t], j) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "2.2mm",
                  padding: "1.6mm 2.4mm",
                  borderBottom: j === cons.length - 1 ? "0" : `1px solid ${T.rule}`,
                }}
              >
                <Ico d={ICONOS[ic]} />
                <span
                  style={{
                    flex: "none",
                    fontFamily: OSW,
                    fontSize: "3.2mm",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.4px",
                    color: T.ink,
                  }}
                >
                  {k}
                </span>
                <span style={{ flex: 1 }} />
                <span style={{ fontFamily: OSW, fontSize: "3.2mm", fontWeight: 700, color: T.ink }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <Seccion acc={acc}>Alérgenos</Seccion>
          <div
            style={{
              border: `1px solid ${T.rule2}`,
              borderRadius: 2,
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              overflow: "hidden",
            }}
          >
            {ALERGENOS_12.map(([k, ic], i) => celdaAlergeno(k, ic, i, false))}
          </div>
          {/* los 2 últimos: tabla propia centrada, comparte borde con la de arriba */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: "-1px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                border: `1px solid ${T.rule2}`,
                borderRadius: "0 0 2px 2px",
                overflow: "hidden",
                width: "66.6%",
              }}
            >
              {ALERGENOS_2.map(([k, ic], i) => celdaAlergeno(k, ic, i, true))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
