/**
 * Mockup — Panel Global IDÉNTICO en datos y estructura
 * Identidad Streat Lab conservada (rojo + amarillo + sidebar oscuro)
 * Mejora densidad, spacing, jerarquía, escaneabilidad, legibilidad.
 *
 * Estrategia: envolver <PanelGlobal /> con CSS overrides quirúrgicos.
 * Mismo contenido, capa visual mejorada — NO SaaS genérico azul/blanco.
 */

import PanelGlobal from './PanelGlobal'

export default function Mockup() {
  return (
    <>
      <style>{`
        /* ═══════════════════════════════════════════════════════════
           MOCKUP — Identidad Streat Lab + densidad/jerarquía mejoradas
           ═══════════════════════════════════════════════════════════ */

        .mockup-wrapper {
          background: #f5f3ef;
        }

        /* Banner identificador discreto */
        .mockup-wrapper::before {
          content: '🎨 Mockup · vista experimental';
          display: block;
          background: #e8f442;
          color: #0a0a0a;
          font-family: 'Oswald', sans-serif;
          font-weight: 600;
          font-size: 11px;
          letter-spacing: 0.08em;
          padding: 6px 28px;
          border-bottom: 1px solid #d0c8bc;
          text-transform: uppercase;
        }

        /* ─── 1. Reducir bordes visibles en ~40% ───────────────── */
        /* Bordes finos casi invisibles, solo el card principal mantiene marco */
        .mockup-wrapper [style*="border: 0.5px solid"],
        .mockup-wrapper [style*="border:0.5px solid"] {
          border: 1px solid transparent !important;
          background: #ffffff !important;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04) !important;
        }

        /* ─── 2. Padding interno de cards: 20px ────────────────── */
        .mockup-wrapper [style*="padding: 18px"]:not(button),
        .mockup-wrapper [style*="padding:18px"]:not(button) {
          padding: 20px !important;
        }
        .mockup-wrapper [style*="padding: 24px 28px"]:not(button) {
          padding: 20px !important;
        }
        .mockup-wrapper [style*="padding: 14px 16px"]:not(button) {
          padding: 16px 20px !important;
        }

        /* ─── 3. Separación vertical entre bloques: 24px ──────── */
        .mockup-wrapper section,
        .mockup-wrapper [style*="margin-bottom: 18"],
        .mockup-wrapper [style*="marginBottom: 18"] {
          margin-bottom: 24px !important;
        }
        .mockup-wrapper [style*="gap: 14"],
        .mockup-wrapper [style*="gap:14"] {
          gap: 16px !important;
        }

        /* ─── 4. Menos mayúsculas en títulos secundarios ──────── */
        /* Mantener uppercase solo en labels grandes (kpiBig label, tabs).
           Quitar uppercase en labels pequeños y subtítulos. */
        .mockup-wrapper [style*="font-size: 10px"][style*="text-transform: uppercase"],
        .mockup-wrapper [style*="fontSize: 10"][style*="textTransform"],
        .mockup-wrapper [style*="font-size: 11px"][style*="text-transform: uppercase"],
        .mockup-wrapper [style*="fontSize: 11"][style*="textTransform"] {
          text-transform: none !important;
          letter-spacing: 0 !important;
          font-family: 'Lexend', sans-serif !important;
          font-weight: 500 !important;
          color: #7a8090 !important;
        }
        /* Mantener uppercase en label de 12px (kpiBig label) */

        /* ─── 7. KPI cards: jerarquía dominante ────────────────── */
        /* Valor principal más grande y peso visual */
        .mockup-wrapper [style*="font-size: 38px"],
        .mockup-wrapper [style*="fontSize: 38"] {
          font-size: 42px !important;
          letter-spacing: -0.02em !important;
          color: #0a0a0a !important;
          font-weight: 700 !important;
          line-height: 1 !important;
        }

        /* Valores medios */
        .mockup-wrapper [style*="font-size: 26px"],
        .mockup-wrapper [style*="fontSize: 26"] {
          font-size: 28px !important;
          letter-spacing: -0.01em !important;
          font-weight: 600 !important;
        }

        /* Valores pequeños */
        .mockup-wrapper [style*="font-size: 22px"],
        .mockup-wrapper [style*="fontSize: 22"] {
          font-size: 22px !important;
          font-weight: 600 !important;
        }

        /* Métricas secundarias más suaves */
        .mockup-wrapper [style*="font-size: 13px"][style*="color: rgb(122, 128, 144)"],
        .mockup-wrapper [style*="font-size: 13px"][style*="color:#7a8090"],
        .mockup-wrapper [style*="font-size: 12px"][style*="color: rgb(122, 128, 144)"],
        .mockup-wrapper [style*="font-size: 12px"][style*="color:#7a8090"] {
          color: #9aa0b0 !important;
          font-weight: 400 !important;
        }

        /* ─── Badges de variación más pequeños y sutiles ───── */
        .mockup-wrapper [style*="border-radius: 3"][style*="padding: 1px 6px"],
        .mockup-wrapper [style*="borderRadius: 3"][style*="padding"] {
          font-size: 10px !important;
          padding: 1px 5px !important;
          font-weight: 600 !important;
          letter-spacing: 0 !important;
        }

        /* ─── 8. Tablas: filas aireadas, menos líneas, hover sutil ── */
        .mockup-wrapper table {
          border-collapse: separate !important;
          border-spacing: 0 !important;
        }
        .mockup-wrapper thead th {
          background: transparent !important;
          color: #7a8090 !important;
          border-bottom: 1px solid #d0c8bc !important;
          padding: 10px 14px !important;
          font-size: 11px !important;
          font-weight: 500 !important;
          letter-spacing: 0.05em !important;
        }
        .mockup-wrapper tbody td {
          padding: 14px 14px !important;
          border-bottom: 1px solid #f0ede5 !important;
          font-size: 13px !important;
          color: #3a4050 !important;
        }
        .mockup-wrapper tbody tr {
          transition: background 0.1s !important;
        }
        .mockup-wrapper tbody tr:hover {
          background: #faf8f4 !important;
        }
        /* Quitar última línea */
        .mockup-wrapper tbody tr:last-child td {
          border-bottom: none !important;
        }

        /* ─── 9. Reducir ruido de color ────────────────────────── */
        /* Rojo y verde solo en métricas (deltas, semáforos).
           No en bordes, no en decoración. */

        /* Ocultar bordes rojos decorativos */
        .mockup-wrapper [style*="border: 1.5px solid #FF4757"] {
          border: 1px solid #d0c8bc !important;
          box-shadow: none !important;
        }

        /* Tabs activos: rojo Binagre limpio sin sombra */
        .mockup-wrapper button[style*="background: rgb(255, 71, 87)"],
        .mockup-wrapper button[style*="background:#FF4757"],
        .mockup-wrapper button[style*="background: #FF4757"] {
          background: #B01D23 !important;
          color: #ffffff !important;
          font-weight: 600 !important;
        }

        /* ─── 10. Lectura rápida: reforzar jerarquía números ──── */
        /* Tabular numbers para alinear cifras */
        .mockup-wrapper [style*="font-family: 'Oswald'"],
        .mockup-wrapper [style*="fontFamily: 'Oswald"] {
          font-variant-numeric: tabular-nums !important;
        }

        /* ═══════════════════════════════════════════════════════════
           SIDEBAR (ajustes 5 + 6)
           ═══════════════════════════════════════════════════════════ */

        /* 5. Sidebar oscuro actual: NO TOCAR fondo (ya es #1e2233) */

        /* 6. Iconos más pequeños */
        aside[class*="bg-"] svg {
          width: 16px !important;
          height: 16px !important;
        }

        /* 6. Items menos altos */
        aside[class*="bg-"] a[style*="padding: 9px 10px"],
        aside[class*="bg-"] a[style*="padding: 10px 14px"] {
          padding: 7px 12px !important;
          font-size: 13px !important;
        }
        aside[class*="bg-"] button[style*="padding: 10px 14px"] {
          padding: 7px 12px !important;
          font-size: 12px !important;
        }

        /* 6. Submenús compactos */
        aside[class*="bg-"] a[style*="padding: 9px 10px 9px 16px"] {
          padding: 6px 10px 6px 36px !important;
          font-size: 13px !important;
          margin: 0 !important;
        }

        /* Logo más pequeño */
        aside[class*="bg-"] img[style*="height: 32px"] {
          height: 26px !important;
        }
      `}</style>
      <div className="mockup-wrapper">
        <PanelGlobal />
      </div>
    </>
  )
}
