/**
 * Mockup — Panel Global IDÉNTICO en datos y estructura
 * Solo cambia el ESTILO: aplicado tema Binagre+Posthog encima del Panel real.
 *
 * Estrategia: envolver <PanelGlobal /> en un div con estilos CSS que
 * sobreescriben sombras/bordes/cards. Mismo contenido, otra capa visual.
 */

import PanelGlobal from './PanelGlobal'

export default function Mockup() {
  return (
    <>
      <style>{`
        /* === TEMA BINAGRE + POSTHOG (sobreescribe Panel Global) === */
        .mockup-wrapper {
          /* Repintar fondo más arena cálida */
          background: #f5f3ef;
        }

        /* Cards con borde negro grueso + sombra dura offset */
        .mockup-wrapper [style*="border: 0.5px solid"],
        .mockup-wrapper [style*="border:0.5px solid"] {
          border: 2px solid #0a0a0a !important;
          box-shadow: 3px 3px 0 #0a0a0a !important;
          border-radius: 8px !important;
        }

        /* Cards principales: sombra de color según categoría */
        .mockup-wrapper [style*="border-radius: 16px"] {
          border-radius: 8px !important;
          box-shadow: 4px 4px 0 #B01D23 !important;
        }
        .mockup-wrapper [style*="border-radius: 14px"] {
          border-radius: 8px !important;
          box-shadow: 3px 3px 0 #1e2233 !important;
        }
        .mockup-wrapper [style*="border-radius: 12px"] {
          border-radius: 6px !important;
          box-shadow: 2px 2px 0 #0a0a0a !important;
        }

        /* Tabs pastilla: borde negro, sombra dura */
        .mockup-wrapper [style*="border-radius: 10px"][style*="padding: 4px 6px"] {
          border: 2px solid #0a0a0a !important;
          box-shadow: 2px 2px 0 #e8f442 !important;
          border-radius: 6px !important;
        }

        /* Tab activo: rojo Binagre con borde negro */
        .mockup-wrapper button[style*="background: rgb(255, 71, 87)"],
        .mockup-wrapper button[style*="background:#FF4757"],
        .mockup-wrapper button[style*="background: #FF4757"] {
          background: #B01D23 !important;
          border: 1.5px solid #0a0a0a !important;
          font-weight: 700 !important;
        }

        /* Botones dropdown: estilo Posthog */
        .mockup-wrapper [style*="border-radius: 8px"][style*="cursor: pointer"] {
          border: 2px solid #0a0a0a !important;
          box-shadow: 2px 2px 0 #0a0a0a !important;
          border-radius: 6px !important;
          font-weight: 600 !important;
        }

        /* Headers de sección con borde inferior marcado */
        .mockup-wrapper h1,
        .mockup-wrapper h2,
        .mockup-wrapper h3 {
          letter-spacing: 0.02em !important;
        }

        /* Tablas: header con fondo oscuro y texto amarillo */
        .mockup-wrapper thead th {
          background: #1e2233 !important;
          color: #e8f442 !important;
          border-bottom: 2px solid #0a0a0a !important;
          letter-spacing: 0.08em !important;
        }

        /* Filas con borde sutil */
        .mockup-wrapper tbody tr {
          border-bottom: 1px solid #e8e4dc !important;
        }
        .mockup-wrapper tbody tr:hover {
          background: #faf8f4 !important;
        }

        /* Badges/pills: borde negro */
        .mockup-wrapper [style*="border-radius: 9px"],
        .mockup-wrapper [style*="border-radius:9px"] {
          border: 1.5px solid #0a0a0a !important;
          font-weight: 700 !important;
        }

        /* Badges de canal: sombra mini */
        .mockup-wrapper [style*="borderRadius: 3"] {
          border: 1px solid #0a0a0a !important;
        }

        /* Inputs editables: borde dashed más marcado */
        .mockup-wrapper [style*="border-bottom: 1px dashed"] {
          border-bottom: 2px dashed #0a0a0a !important;
        }

        /* Tracks de barras: borde negro fino */
        .mockup-wrapper [style*="background: #ebe8e2"][style*="border-radius"] {
          border: 1px solid #0a0a0a !important;
        }

        /* TÍTULO PANEL GLOBAL → renombrar visualmente a MOCKUP via badge */
        .mockup-wrapper::before {
          content: '🎨 MOCKUP — VISTA EXPERIMENTAL · estilo Binagre + Posthog';
          display: block;
          background: #e8f442;
          color: #0a0a0a;
          font-family: 'Oswald', sans-serif;
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 0.1em;
          padding: 8px 28px;
          border-bottom: 2px solid #0a0a0a;
          text-transform: uppercase;
        }

        /* Inputs y selects: estilo Posthog */
        .mockup-wrapper input,
        .mockup-wrapper select {
          border: 2px solid #0a0a0a !important;
          border-radius: 4px !important;
          font-family: 'Lexend', sans-serif !important;
        }
        .mockup-wrapper input:focus,
        .mockup-wrapper select:focus {
          outline: none !important;
          box-shadow: 2px 2px 0 #B01D23 !important;
        }

        /* Reducir radio general */
        .mockup-wrapper * {
          transition: box-shadow 0.15s, transform 0.1s !important;
        }
      `}</style>
      <div className="mockup-wrapper">
        <PanelGlobal />
      </div>
    </>
  )
}
