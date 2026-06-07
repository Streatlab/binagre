import type { PlataformaId, Portal } from '../tipos.ts'
import { uber } from './uber.ts'
import { glovo } from './glovo.ts'
import { justeat } from './justeat.ts'
import { rushour } from './rushour.ts'
import { bbva } from './bbva.ts'

export const PORTALES: Record<PlataformaId, Portal> = {
  uber,
  glovo,
  justeat,
  rushour,
  bbva,
}
