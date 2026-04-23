export function Avatar({
  letter,
  color,
}: {
  letter: string
  color?: string | null
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        width: 32,
        height: 32,
        borderRadius: '50%',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontWeight: 700,
        fontSize: 12,
        marginRight: 10,
        verticalAlign: 'middle',
        background: color ?? '#B01D23',
        fontFamily: 'Lexend, sans-serif',
      }}
    >
      {letter}
    </span>
  )
}
