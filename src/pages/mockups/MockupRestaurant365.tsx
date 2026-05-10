/**
 * 4 · Restaurant365 — enterprise verde corporativo
 */
import PanelGlobal from '../PanelGlobal'

export default function MockupRestaurant365() {
  return (
    <>
      <style>{`
        .mk-r365 { background: #F0F2F5; }
        .mk-r365::before {
          content: '4 · Restaurant365 · enterprise verde';
          display: block;
          background: linear-gradient(135deg, #2C3E50 0%, #34495E 100%);
          color: #2ECC71;
          font-family: 'Inter', sans-serif; font-weight: 700;
          font-size: 11px; letter-spacing: 0.1em; padding: 8px 28px;
          text-transform: uppercase;
        }
        .mk-r365 [style*="border: 0.5px solid"],
        .mk-r365 [style*="border:0.5px solid"] {
          border: 1px solid #DCE2E8 !important;
          border-radius: 8px !important;
          box-shadow: 0 1px 3px rgba(0,0,0,0.03) !important;
        }
        .mk-r365 [style*="border-radius: 16px"],
        .mk-r365 [style*="border-radius: 14px"],
        .mk-r365 [style*="border-radius: 12px"] {
          border-radius: 8px !important;
        }
        .mk-r365 button[style*="background: rgb(255, 71, 87)"],
        .mk-r365 button[style*="background:#FF4757"] {
          background: linear-gradient(135deg, #2ECC71 0%, #27AE60 100%) !important;
          border: none !important;
          box-shadow: 0 2px 4px rgba(46,204,113,0.25) !important;
        }
        .mk-r365 thead th {
          background: #FAFBFC !important;
          color: #7F8C9C !important;
          border-bottom: 1px solid #ECEFF1 !important;
        }
        .mk-r365 [style*="font-family: 'Oswald'"],
        .mk-r365 [style*="fontFamily: 'Oswald"] {
          font-family: 'Inter', sans-serif !important;
          letter-spacing: -0.02em !important;
        }
      `}</style>
      <div className="mk-r365"><PanelGlobal /></div>
    </>
  )
}
