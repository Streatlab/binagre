import { BLANCO, GRANATE } from '@/styles/neobrutal'
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
        color: BLANCO,
        fontWeight: 700,
        fontSize: 12,
        marginRight: 10,
        verticalAlign: 'middle',
        background: color ?? GRANATE,
        fontFamily: 'Lexend, sans-serif',
      }}
    >
      {letter}
    </span>
  )
}
