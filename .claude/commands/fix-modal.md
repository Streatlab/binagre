# /fix-modal — Skill

Patron estandar para fix de modal en Binagre ERP.

## Cuando usar
Cualquier fix sobre modales: fondo, labels, scroll, botones, autocompletado, validaciones.

## Patron canonico
- Fondo modal: tokens.modal (#484f66)
- Border radius: rounded-xl
- Padding interior: p-6
- Labels: text-sm font-medium text-white
- Inputs: bg-white/10 border border-white/20 rounded-lg px-3 py-2
- Botones primarios: bg-[var(--token-rojo)] text-white
- Botones secundarios: bg-transparent border border-white/30
- Scroll: overflow-y-auto max-h-[80vh]
- Cierre con tecla Esc + click fuera

## Pipeline reducido para fix-modal
implementer + qa-reviewer + qa-visual. Sin pm-spec ni architect-review (es patron conocido).
