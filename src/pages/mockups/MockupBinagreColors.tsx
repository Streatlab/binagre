/**
 * 7 · Panel actual + colores Binagre nuevos
 * Mantiene 100% la estructura del Panel Global actual.
 * Solo cambia: rojo SL #B01D23 → rojo tomate #C8362A
 *              fondo crema, acentos verde hoja
 */
import PanelGlobal from '../PanelGlobal'

export default function MockupBinagreColors() {
  return (
    <>
      <style>{`
        .mk-bc { background: #F5EFE6; }
        .mk-bc::before {
          content: '7 · Panel actual · colores Binagre nuevos';
          display: block; background: #C8362A; color: #F5EFE6;
          font-family: 'Oswald', sans-serif; font-weight: 700;
          font-size: 11px; letter-spacing: 0.1em; padding: 6px 28px;
          text-transform: uppercase;
        }
        /* Cambio rojo SL → rojo tomate Binagre */
        .mk-bc [style*="background: rgb(176, 29, 35)"],
        .mk-bc [style*="background:#B01D23"],
        .mk-bc [style*="color: rgb(176, 29, 35)"],
        .mk-bc [style*="color:#B01D23"] {
          background-color: #C8362A !important;
        }
        /* Acento principal accent rojo coral → tomate */
        .mk-bc [style*="background: rgb(255, 71, 87)"],
        .mk-bc [style*="background:#FF4757"] {
          background: #C8362A !important;
          border-color: #C8362A !important;
        }
        .mk-bc [style*="border: 1.5px solid #FF4757"] {
          border-color: #C8362A !important;
        }
        .mk-bc [style*="color: rgb(255, 71, 87)"],
        .mk-bc [style*="color:#FF4757"] {
          color: #C8362A !important;
        }
        /* Verde Uber dark → verde hoja Binagre */
        .mk-bc [style*="color: rgb(29, 158, 117)"],
        .mk-bc [style*="color:#1D9E75"] {
          color: #7A8F5C !important;
        }
        /* Bordes con tono cálido */
        .mk-bc [style*="border: 0.5px solid"],
        .mk-bc [style*="border:0.5px solid"] {
          border-color: #DDD4C2 !important;
          background: #FFFEFB !important;
        }
        /* Texto principal más cálido */
        .mk-bc [style*="color: rgb(17, 17, 17)"],
        .mk-bc [style*="color:#111111"] {
          color: #1A1A1A !important;
        }
      `}</style>
      <div className="mk-bc"><PanelGlobal /></div>
    </>
  )
}
