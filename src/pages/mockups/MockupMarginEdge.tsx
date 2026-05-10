/**
 * 3 · MarginEdge — data-dense, azul oscuro, denso
 */
import PanelGlobal from '../PanelGlobal'

export default function MockupMarginEdge() {
  return (
    <>
      <style>{`
        .mk-me { background: #F5F7FA; font-size: 13px; }
        .mk-me::before {
          content: '3 · MarginEdge · data-dense';
          display: block; background: #1B2A41; color: #4ECDC4;
          font-family: 'Inter', sans-serif; font-weight: 700;
          font-size: 11px; letter-spacing: 0.08em; padding: 6px 28px;
          border-bottom: 1px solid #1B2A41; text-transform: uppercase;
        }
        .mk-me [style*="border: 0.5px solid"],
        .mk-me [style*="border:0.5px solid"] {
          border: 1px solid #E1E7EE !important;
          border-radius: 6px !important;
          box-shadow: none !important;
        }
        .mk-me [style*="border-radius: 16px"],
        .mk-me [style*="border-radius: 14px"],
        .mk-me [style*="border-radius: 12px"] {
          border-radius: 6px !important;
        }
        .mk-me button[style*="background: rgb(255, 71, 87)"],
        .mk-me button[style*="background:#FF4757"] {
          background: #2E86DE !important;
          border-color: #2E86DE !important;
          font-weight: 600 !important;
        }
        .mk-me [style*="padding: 18px"]:not(button),
        .mk-me [style*="padding:18px"]:not(button) {
          padding: 12px 14px !important;
        }
        .mk-me [style*="padding: 24px 28px"]:not(button) {
          padding: 14px 18px !important;
        }
        .mk-me [style*="font-family: 'Oswald'"],
        .mk-me [style*="fontFamily: 'Oswald"] {
          font-family: 'Inter', sans-serif !important;
          letter-spacing: -0.02em !important;
        }
        .mk-me [style*="font-size: 38px"],
        .mk-me [style*="fontSize: 38"] {
          font-size: 24px !important;
        }
        .mk-me thead th {
          background: #FAFBFC !important;
          color: #6B7C93 !important;
          font-size: 10px !important;
          padding: 8px 14px !important;
        }
      `}</style>
      <div className="mk-me"><PanelGlobal /></div>
    </>
  )
}
