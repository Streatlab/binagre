/**
 * 6 · Fusión 3 estilos SaaS + colores Binagre nuevos
 * Estructura Holded/MarginEdge/Rest365 + paleta vintage Binagre:
 * Rojo tomate #C8362A · Verde hoja #7A8F5C · Crema #F5EFE6 · Negro #1A1A1A
 */
import PanelGlobal from '../PanelGlobal'

export default function MockupFusion3Binagre() {
  return (
    <>
      <style>{`
        .mk-f3b { background: #F5EFE6; }
        .mk-f3b::before {
          content: '6 · Fusión + colores Binagre · vintage saas';
          display: block;
          background: linear-gradient(90deg, #C8362A 0%, #7A8F5C 100%);
          color: #F5EFE6;
          font-family: 'Inter', sans-serif; font-weight: 700;
          font-size: 11px; letter-spacing: 0.08em; padding: 8px 28px;
          text-transform: uppercase;
        }
        /* Cards limpias con borde verde hoja muy sutil */
        .mk-f3b [style*="border: 0.5px solid"],
        .mk-f3b [style*="border:0.5px solid"] {
          border: 1px solid #DDD4C2 !important;
          border-radius: 10px !important;
          box-shadow: 0 2px 4px rgba(26,26,26,0.05) !important;
          background: #FFFEFB !important;
        }
        .mk-f3b [style*="border-radius: 16px"],
        .mk-f3b [style*="border-radius: 14px"],
        .mk-f3b [style*="border-radius: 12px"] {
          border-radius: 10px !important;
        }
        /* Densidad MarginEdge */
        .mk-f3b [style*="padding: 18px"]:not(button) {
          padding: 14px 16px !important;
        }
        /* Botón primario rojo tomate Binagre */
        .mk-f3b button[style*="background: rgb(255, 71, 87)"],
        .mk-f3b button[style*="background:#FF4757"] {
          background: linear-gradient(135deg, #C8362A 0%, #A82A20 100%) !important;
          border: none !important;
          box-shadow: 0 2px 4px rgba(200,54,42,0.3) !important;
          font-weight: 600 !important;
          color: #F5EFE6 !important;
        }
        /* Header tabla con verde hoja */
        .mk-f3b thead th {
          background: #F5EFE6 !important;
          color: #5A6B41 !important;
          font-size: 10px !important;
          letter-spacing: 0.08em !important;
          padding: 9px 16px !important;
          border-bottom: 1px solid #DDD4C2 !important;
          font-weight: 700 !important;
        }
        /* Tipografía limpia con peso */
        .mk-f3b [style*="font-family: 'Oswald'"],
        .mk-f3b [style*="fontFamily: 'Oswald"] {
          font-family: 'Inter', sans-serif !important;
          letter-spacing: -0.02em !important;
          font-weight: 700 !important;
          color: #1A1A1A !important;
        }
        /* KPI grande oscuro */
        .mk-f3b [style*="font-size: 38px"],
        .mk-f3b [style*="fontSize: 38"] {
          font-size: 30px !important;
          color: #1A1A1A !important;
        }
        /* Acento verde para deltas positivas */
        .mk-f3b [style*="color: rgb(29, 158, 117)"],
        .mk-f3b [style*="color:#1D9E75"] {
          color: #7A8F5C !important;
        }
      `}</style>
      <div className="mk-f3b"><PanelGlobal /></div>
    </>
  )
}
