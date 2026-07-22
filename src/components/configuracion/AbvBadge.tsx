import { BLANCO, INK } from '@/styles/neobrutal'
export function AbvBadge({
  abv,
  bg = INK,
}: {
  abv: string
  bg?: string
}) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 8px',
        background: bg,
        color: BLANCO,
        borderRadius: 4,
        fontSize: 10,
        letterSpacing: '0.04em',
        fontWeight: 700,
        fontFamily: 'Oswald, sans-serif',
        textTransform: 'uppercase',
      }}
    >
      {abv}
    </span>
  )
}
