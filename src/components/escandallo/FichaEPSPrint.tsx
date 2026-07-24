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

/* Iconos del documento: emoji en escala de grises, tal cual la hoja de Design. */
const Ico = ({ d, size = "4mm" }: { d: string; size?: string }) => (
  <span style={{ flex: "none", fontSize: size, lineHeight: 1, filter: "grayscale(1)" }}>{d}</span>
);

const ICONOS: Record<string, string> = {
  gluten: "\u{1F33E}",
  lacteos: "\u{1F95B}",
  huevos: "\u{1F95A}",
  soja: "\u{1FAD8}",
  frutos_secos: "\u{1F330}",
  crustaceos: "\u{1F990}",
  pescado: "\u{1F41F}",
  moluscos: "\u{1F41A}",
  cacahuetes: "\u{1F95C}",
  apio: "\u{1F96C}",
  mostaza: "\u{1F32D}",
  sesamo: "\u{26AA}",
  sulfitos: "\u{1F377}",
  altramuces: "\u{1F33C}",
  taper: "\u{1F961}",
  biberon: "\u{1F9F4}",
  vacio: "\u{1F4E6}",
  congelacion: "\u{2744}\u{FE0F}",
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
      <Ico d={ICONOS[ic]} size="3.2mm" />
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
