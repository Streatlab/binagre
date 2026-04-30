export const KEYWORD_RULES: Array<{ keywords: string[]; categoriaId: string }> = [
  { keywords: ['MERCADONA'], categoriaId: '2.11.1' },
  { keywords: ['ALCAMPO'], categoriaId: '2.11.2' },
  { keywords: ['CARREFOUR'], categoriaId: '2.11.3' },
  { keywords: ['DIA', 'DÍA'], categoriaId: '2.11.4' },
  { keywords: ['LIDL'], categoriaId: '2.11.5' },
  { keywords: ['COCA-COLA', 'COCA COLA', 'COCACOLA', 'COCA'], categoriaId: '2.11.6' },
  { keywords: ['PASCUAL'], categoriaId: '2.11.7' },
  { keywords: ['LACTALIS'], categoriaId: '2.11.8' },
  { keywords: ['EMBAJADORES'], categoriaId: '2.11.9' },
  { keywords: ['JASA'], categoriaId: '2.11.10' },
  { keywords: ['FRITRAVICH'], categoriaId: '2.11.11' },
  { keywords: ['PRODESCO'], categoriaId: '2.11.12' },
  { keywords: ['TGT'], categoriaId: '2.11.13' },
  { keywords: ['CHINA CAYENTE'], categoriaId: '2.11.14' },
  { keywords: ['CHINA GRUÑONA', 'CHINA GRUNONA'], categoriaId: '2.11.15' },
  { keywords: ['AMAZON'], categoriaId: '2.11.16' },
  { keywords: ['ENVAPRO'], categoriaId: '2.12.1' },
  { keywords: ['PUNTOQPACK'], categoriaId: '2.12.2' },
  { keywords: ['PAMPOLS'], categoriaId: '2.12.3' },
  { keywords: ['BOLSEMACK'], categoriaId: '2.12.4' },
  { keywords: ['WORKANA'], categoriaId: '2.23.1' },
  { keywords: ['RUSHOUR'], categoriaId: '2.43.2' },
  { keywords: ['SINQRO'], categoriaId: '2.43.3' },
  { keywords: ['FLYNT'], categoriaId: '2.43.5' },
  { keywords: ['ANTHROPIC', 'OPENAI', 'CLAUDE'], categoriaId: '2.43.6' },
  { keywords: ['CONTROL DE PLAGAS', 'PLAGAS'], categoriaId: '2.43.7' },
  { keywords: ['TRASPASO'], categoriaId: '3.1' },
  { keywords: ['BEN MENJAT', 'FRACCIONAMIENTO'], categoriaId: '3.6' },
  { keywords: ['UBER EATS', 'UBEREATS', 'UE PAGOS', 'UBER'], categoriaId: '1.1.1' },
  { keywords: ['GLOVO'], categoriaId: '1.1.2' },
  { keywords: ['JUST EAT', 'JUSTEAT'], categoriaId: '1.1.3' },
  { keywords: ['IBERDROLA', 'ENDESA'], categoriaId: '2.44.2' },
  { keywords: ['REAL GAS', 'GAS NATURAL', 'NATURGY'], categoriaId: '2.44.3' },
  { keywords: ['CANAL ISABEL'], categoriaId: '2.44.4' },
  { keywords: ['MOVISTAR', 'VODAFONE', 'ORANGE'], categoriaId: '2.44.1' },
]

export function autoCategorizar(
  concepto: string,
  reglasUsuario: Array<{ patron: string; categoria_codigo: string | null }> = []
): string | null {
  const upper = concepto.toUpperCase()

  for (const regla of reglasUsuario) {
    if (regla.categoria_codigo && upper.includes(regla.patron.toUpperCase())) {
      return regla.categoria_codigo
    }
  }

  if (upper.includes('AEAT') && upper.includes('IVA')) return '3.2'
  if (upper.includes('ALQUILER') && upper.includes('MALICIOSA')) return '2.31.1'

  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some(kw => upper.includes(kw))) {
      return rule.categoriaId
    }
  }

  return null
}
