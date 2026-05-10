/**
 * 5 · Fusión Holded + MarginEdge + Rest365
 * Lo mejor de cada uno sin colores Binagre
 */
import PanelGlobal from '../PanelGlobal'

export default function MockupFusion3() {
  return (
    <>
      <style>{`
        .mk-f3 { background: #F4F6F9; }
        .mk-f3::before {
          content: '5 · Fusión · Holded + MarginEdge + Rest365';
          display: block;
          background: linear-gradient(90deg, #635BFF 0%, #2E86DE 50%, #2ECC71 100%);
          color: #fff;
          font-family: 'Inter', sans-serif; font-weight: 700;
          font-size: 11px; letter-spacing: 0.08em; padding: 8px 28px;
          text-transform: uppercase;
        }
        /* Cards Holded-style con sombra suave */
        .mk-f3 [style*="border: 0.5px solid"],
        .mk-f3 [style*="border:0.5px solid"] {
          border: 1px solid #E1E7EE !important;
          border-radius: 10px !important;
          box-shadow: 0 2px 4px rgba(28,42,65,0.04) !important;
        }
        .mk-f3 [style*="border-radius: 16px"],
        .mk-f3 [style*="border-radius: 14px"],
        .mk-f3 [style*="border-radius: 12px"] {
          border-radius: 10px !important;
        }
        /* Densidad MarginEdge */
        .mk-f3 [style*="padding: 18px"]:not(button) {
          padding: 14px 16px !important;
        }
        /* Botón primario gradiente Rest365 */
        .mk-f3 button[style*="background: rgb(255, 71, 87)"],
        .mk-f3 button[style*="background:#FF4757"] {
          background: linear-gradient(135deg, #635BFF 0%, #5247E0 100%) !important;
          border: none !important;
          box-shadow: 0 2px 4px rgba(99,91,255,0.25) !important;
          font-weight: 600 !important;
        }
        /* Header tabla MarginEdge denso + Holded limpio */
        .mk-f3 thead th {
          background: #FAFBFD !important;
          color: #6B7C93 !important;
          font-size: 10px !important;
          letter-spacing: 0.06em !important;
          padding: 9px 16px !important;
          border-bottom: 1px solid #E1E7EE !important;
        }
        /* Tipografía Holded/Rest365 */
        .mk-f3 [style*="font-family: 'Oswald'"],
        .mk-f3 [style*="fontFamily: 'Oswald"] {
          font-family: 'Inter', sans-serif !important;
          letter-spacing: -0.02em !important;
          font-weight: 700 !important;
        }
        /* KPI value Rest365 */
        .mk-f3 [style*="font-size: 38px"],
        .mk-f3 [style*="fontSize: 38"] {
          font-size: 30px !important;
          color: #1A2433 !important;
        }
      `}</style>
      <div className="mk-f3"><PanelGlobal /></div>
    </>
  )
}
