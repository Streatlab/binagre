/**
 * 2 · Holded — SaaS español limpio, morado #635BFF
 */
import PanelGlobal from '../PanelGlobal'

export default function MockupHolded() {
  return (
    <>
      <style>{`
        .mk-hd { background: #F4F6F8; }
        .mk-hd::before {
          content: '2 · Holded · SaaS español limpio';
          display: block; background: #EFEDFD; color: #635BFF;
          font-family: 'Inter', sans-serif; font-weight: 700;
          font-size: 11px; letter-spacing: 0.06em; padding: 6px 28px;
          border-bottom: 1px solid #E5E7EB; text-transform: uppercase;
        }
        .mk-hd [style*="border: 0.5px solid"],
        .mk-hd [style*="border:0.5px solid"] {
          border: 1px solid #E5E7EB !important;
          border-radius: 12px !important;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03) !important;
        }
        .mk-hd [style*="border-radius: 16px"],
        .mk-hd [style*="border-radius: 14px"] {
          border-radius: 12px !important;
        }
        .mk-hd button[style*="background: rgb(255, 71, 87)"],
        .mk-hd button[style*="background:#FF4757"] {
          background: #635BFF !important;
          border-color: #635BFF !important;
        }
        .mk-hd thead th {
          background: #FAFBFC !important;
          color: #6B7280 !important;
          border-bottom: 1px solid #E5E7EB !important;
        }
        .mk-hd [style*="font-family: 'Oswald'"],
        .mk-hd [style*="fontFamily: 'Oswald"] {
          font-family: 'Inter', sans-serif !important;
          letter-spacing: -0.01em !important;
        }
      `}</style>
      <div className="mk-hd"><PanelGlobal /></div>
    </>
  )
}
