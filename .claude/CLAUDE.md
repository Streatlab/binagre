# STREAT LAB ERP — CLAUDE.md

## PROYECTO
- URL: https://streatlab-erp.vercel.app
- Stack: React + TypeScript + Vite + Tailwind + Supabase + Vercel
- Bar: C:\Users\ruben\streatlab-erp | Casa: C:\streatlab-erp
- Supabase: eryauogxcpbgdryeimdq.supabase.co

## REGLAS IRROMPIBLES
- Sin placeholders, sin parches, sin TODOs, causa raíz siempre
- Mobile friendly obligatorio en todo lo que se toque
- Una tarea a la vez — no tocar archivos fuera del scope
- Sin atajos: nada de "por ahora" o "temporalmente"
- Verificar build limpio antes de terminar

## DESIGN SYSTEM
Fondos: app #2e3347 | sidebar #1e2233 | modal #484f66 | input #3a4058 | input-calc #3d2828
Bordes: normal #4a5270 | calc #884040 | focus #e8f442
Texto: primary #f0f0ff | secondary #c8d0e8 | muted #7080a8 | calc #ffcccc
Acentos: yellow #e8f442 | red #B01D23 | eps #66aaff | rec #f5a623
Canales: Uber Eats #06C167 | Glovo #e8f442 | Just Eat #f5a623 | Web #B01D23 | Directa #66aaff
Fuentes: Lexend (todo) | Oswald (nav,tabs,th,botones,labels) | Impact (solo h1 página)
Botones: ds-btn-save #B01D23 | ds-btn-add #e8f442 texto #1a1a1a | ds-btn-cancel #555e7a
Modales: bg #484f66 | border-radius 10px | border #4a5270 | max-height 90vh
Tablas: thead sticky #353a50 Oswald 11px | odd #484f66 | even #404558

## FORMATO NÚMEROS
4 decimales: EUR/STD, EUR/MIN, C.Neto/STD, C.Neto/MIN
Siempre desde src/utils/format.ts — fmtEur, fmtNum, fmtPct, fmtDate
Celdas sin dato: string vacío, nunca guion ni null visible

## TRAS COMPACTACIÓN
1. Lee este CLAUDE.md
2. Lee .claude/skills/erp/SKILL.md
3. Confirma qué fix atacamos y espera aprobación antes de tocar nada

@lessons.md
