/**
 * 1 · Binagre + Posthog (estilo neobrutalista actual)
 * Sombras duras offset, bordes 2px, identidad Streat Lab original
 */
import PanelGlobal from '../PanelGlobal'

export default function MockupBinagrePosthog() {
  return (
    <>
      <style>{`
        .mk-bp { background: #f5f3ef; }
        .mk-bp::before {
          content: '1 · Binagre + Posthog · neobrutalista';
          display: block; background: #e8f442; color: #0a0a0a;
          font-family: 'Oswald', sans-serif; font-weight: 700;
          font-size: 11px; letter-spacing: 0.1em; padding: 6px 28px;
          border-bottom: 2px solid #0a0a0a; text-transform: uppercase;
        }
        .mk-bp [style*="border: 0.5px solid"],
        .mk-bp [style*="border:0.5px solid"] {
          border: 2px solid #0a0a0a !important;
          box-shadow: 3px 3px 0 #0a0a0a !important;
          border-radius: 8px !important;
        }
        .mk-bp [style*="border-radius: 16px"] {
          border-radius: 8px !important;
          box-shadow: 4px 4px 0 #B01D23 !important;
        }
        .mk-bp button[style*="background: rgb(255, 71, 87)"],
        .mk-bp button[style*="background:#FF4757"] {
          background: #B01D23 !important;
          border: 1.5px solid #0a0a0a !important;
          font-weight: 700 !important;
        }
        .mk-bp thead th {
          background: #1e2233 !important;
          color: #e8f442 !important;
          border-bottom: 2px solid #0a0a0a !important;
        }
      `}</style>
      <div className="mk-bp"><PanelGlobal /></div>
    </>
  )
}
