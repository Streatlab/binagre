export function AbvBadge({
  abv,
  bg = '#1A1A1A',
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
        color: '#ffffff',
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
