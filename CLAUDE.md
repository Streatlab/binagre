# CLAUDE.md — ERP Binagre / Streat Lab

## Contexto mínimo
- ERP React/TypeScript/Vite. Supabase: eryauogxcpbgdryeimdq. Vercel: proyecto "binagre".
- El usuario NO es programador. Todo se ejecuta vía herramientas, nunca se le pide código, SQL ni prompts.

## Comunicación (obligatorio)
1. Respuestas máx 3-4 líneas. Sin preámbulos, sin postambles, sin recapitulaciones.
2. Prohibido narrar: nunca "voy a", "déjame", "estoy revisando", ni anunciar herramientas.
3. Formato único: "Hecho: X" / "Resultado: X" / "Pendiente tuyo: X" / "Falla X. Alternativa: Y".
4. Cero código en chat. Cero nombres de archivos, funciones, tablas, hex, commits (salvo valor de negocio directo).
5. No pedir permisos ni confirmaciones: ejecutar. Preguntar SOLO ante bloqueo real (1 pregunta, 1 línea).
6. Si el usuario dice "silencio" o "corta": modo silencio total inmediato.

## Protocolo token-cero (obligatorio)
1. Lecturas quirúrgicas: solo la sección/función que se toca. NUNCA leer repo completo ni archivos enteros si basta un fragmento.
2. Ediciones dirigidas (reemplazos puntuales). Nunca reescribir archivos completos.
3. Un módulo por sesión. No tocar módulos no relacionados.
4. No releer módulos congelados (registro "frozen modules" en Notion).
5. Antes de explorar repo o Supabase: consultar el mapa de contexto cacheado en Notion "99 Claude".
6. Agrupar llamadas a herramientas en un solo turno cuando sea posible.
7. Al saturar contexto: volcar estado a Notion "99 Claude" antes de perder información.

## Deploy (obligatorio)
1. Vercel despliega en CADA `git push` a `trabajo`/`master` (Git integration), lo diga o no "[deploy]" en el mensaje — la etiqueta es solo convención humana, no un gate técnico (vercel.json no tiene `ignoreCommand`). Lo que quema build es el PUSH, no el texto del commit.
2. Por eso: commitear localmente tantas veces como haga falta, pero UN SOLO `git push` al final de cada tanda (agrupa todos los commits de esa tanda en ese push). Nunca push por bloque/microajuste.
3. LÍMITE DIARIO AGOTADO (22-jul, ~100 builds quemados en previews sin revisar) → CONGELADO hasta nuevo aviso: cero pushes salvo que Rubén lo pida explícitamente para verificar algo puntual. Seguir commiteando en local con normalidad.
4. Cuando se reanude: 1 push agrupado por tanda, objetivo 1-3 pushes/sesión máximo.
5. Tras un push si toca verificar: 1 sola consulta a Vercel, reportar READY o fallo sin preguntar.

## Rama de trabajo (obligatorio)
- Todo el mundo (todas las sesiones) trabaja SIEMPRE en la rama `trabajo`. `master` es producción.
- Nadie mergea ni publica a `master` por iniciativa propia, nunca. Solo se mergea/publica cuando Rubén lo pide explícitamente.

## Aislamiento absoluto
- Este repo = Binagre / Streat Lab. JAMÁS mezclar con erp-david / David Reparte / davidparte: ni repos, ni Supabase, ni design tokens, ni lógica de negocio.

## OCR/Conciliación
- Procedimiento oficial en Notion "📌 OBLIGATORIO LEER · Flujo OCR + Conciliación" (regla 3 bis). Leerlo antes de tocar OCR, no reinventar.
