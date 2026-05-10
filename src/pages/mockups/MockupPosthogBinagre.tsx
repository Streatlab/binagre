/**
 * 8 · Posthog + colores Binagre nuevos
 * Neobrutalismo Posthog con paleta vintage tomate/hoja/crema
 */
import PanelGlobal from '../PanelGlobal'

export default function MockupPosthogBinagre() {
  return (
    <>
      <style>{`
        .mk-pb { background: #F5EFE6; }
        .mk-pb::before {
          content: '8 · Posthog + colores Binagre · neobrutal vintage';
          display: block; background: #C8362A; color: #F5EFE6;
          font-family: 'Oswald', sans-serif; font-weight: 700;
          font-size: 11px; letter-spacing: 0.1em; padding: 6px 28px;
          border-bottom: 2px solid #1A1A1A; text-transform: uppercase;
        }
        /* Sombras duras Posthog con colores Binagre */
        .mk-pb [style*="border: 0.5px solid"],
        .mk-pb [style*="border:0.5px solid"] {
          border: 2px solid #1A1A1A !important;
          box-shadow: 3px 3px 0 #1A1A1A !important;
          border-radius: 6px !important;
          background: #FFFEFB !important;
        }
        .mk-pb [style*="border-radius: 16px"] {
          border-radius: 6px !important;
          box-shadow: 4px 4px 0 #C8362A !important;
        }
        .mk-pb [style*="border-radius: 14px"] {
          border-radius: 6px !important;
          box-shadow: 3px 3px 0 #7A8F5C !important;
        }
        /* Botones primarios */
        .mk-pb button[style*="background: rgb(255, 71, 87)"],
        .mk-pb button[style*="background:#FF4757"] {
          background: #C8362A !important;
          border: 2px solid #1A1A1A !important;
          box-shadow: 2px 2px 0 #1A1A1A !important;
          font-weight: 700 !important;
          color: #F5EFE6 !important;
        }
        /* Cambios de color rojo SL → tomate */
        .mk-pb [style*="background: rgb(176, 29, 35)"],
        .mk-pb [style*="background:#B01D23"] {
          background: #C8362A !important;
        }
        .mk-pb [style*="color: rgb(176, 29, 35)"],
        .mk-pb [style*="color:#B01D23"] {
          color: #C8362A !important;
        }
        /* Verde Uber → hoja Binagre */
        .mk-pb [style*="color: rgb(29, 158, 117)"],
        .mk-pb [style*="color:#1D9E75"] {
          color: #7A8F5C !important;
        }
        /* Header tabla oscuro Posthog */
        .mk-pb thead th {
          background: #1A1A1A !important;
          color: #F5EFE6 !important;
          border-bottom: 2px solid #1A1A1A !important;
          font-weight: 700 !important;
        }
        /* Texto principal */
        .mk-pb [style*="color: rgb(17, 17, 17)"],
        .mk-pb [style*="color:#111111"] {
          color: #1A1A1A !important;
        }
      `}</style>
      <div className="mk-pb"><PanelGlobal /></div>
    </>
  )
}
