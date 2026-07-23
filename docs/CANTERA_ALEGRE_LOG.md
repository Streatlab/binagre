# CANTERA ALEGRE v1.0 · Log de adaptación

Manual: Notion CEREBRO-SL > LEY-ESTILO-01 · Drive "📚 Documentación Streat Lab".

## Hecho
- 22-jul-2026 · Pestaña HOY (src/pages/Home.tsx): plancha de KPIs sólidos pegados, tira de atención bajo el héroe, bloques de papel con ceja, accesos con sombra. Fuera lavados/pasteles.
- 22-jul-2026 · Sidebar (src/components/Sidebar.tsx): cabeceras de sección con tokens de área (Finanzas verde · Cocina amarillo · Operaciones naranja · Equipo tinta · Compras azul · Ventas rosa · Ajustes gris). Cero hex sueltos salvo el del modo oscuro (aplazado).
- 22-jul-2026 · Sol/luna del sidebar (src/components/ThemeToggle.tsx): quitada la sombra dura (molestaba). Regla nueva en el manual: los controles del marco del sidebar van sin sombra.
- 22-jul-2026 · Panel Global Resumen (src/components/panel/resumen/ResumenLanding.tsx, v21): derogadas las bandas a sangre encadenadas → columna con aire de 16px, cada pieza es un bloque de papel con ceja. Héroe amarillo + tira de atención pegada; plancha comparativa de 3 celdas blancas pegadas; frase potente con color por SIGNIFICADO. Lógica y datos intactos.
- 23-jul-2026 · Cabecera del Panel Global (src/pages/PanelGlobal.tsx): título+fecha a la izquierda ocupando el mismo alto que los desplegables; desplegables y pestañas (TabsPastilla) rediseñados como hermanos (mismo alto, borde 2px, Oswald, sombra 3px; activa hundida). Orden fijo: cabecera → pestañas → caja 13 semanas → contenido. Caja 13 semanas como tarjeta del sistema (blanca, ceja azul lateral, sombra por ser pulsable).
- 23-jul-2026 · Frases-insight: batería ampliada de 20 a 46 (tabla `frases_insight` en Supabase + espejo en frasesInsight.ts), con variantes gemelas que rotan por día y `elegirFrases(n)` que devuelve mensajes distintos. El héroe del Resumen (v22) usa la frase nº1 (lenguaje natural anclado a datos reales del periodo) y la sección "frase potente" la nº2. REGLA para el resto de pantallas principales: el titular del héroe SIEMPRE es una frase-insight, nunca un dato suelto.
- 23-jul-2026 · Build de consolidación (este commit): fuerza un deployment con TODO lo anterior en HEAD, tras un build encolado fuera de orden.
- 23-jul-2026 · Reintento de build tras pausa de Vercel.

## CANTERA ALEGRE v4 — Migración de cabeceras (23-jul-2026)

Sistema v4 (referencia canónica src/pages/PanelGlobal.tsx): `RutaPantalla` (miga de
pan "Módulo ▸ Pestaña", color por nivel + subtítulo) + `TabsPastilla` (plancha
segmentada, activa rosa) + `SubTabs` (segundo nivel subrayado). Filtros planos a la
derecha (flex-end). Solo se tocó cabecera/navegación; lógica de datos intacta.

### Selector de fecha
- `src/components/ui/SelectorFechaUniversal.tsx`: "Personalizado" rehecho con dos
  inputs `type=date` grandes Desde/Hasta, validación desde≤hasta, botón Aplicar rosa
  + Cancelar plano. Presets agrupados con separadores (Ahora / Semanas / Meses /
  Largo), ordenados de hoy hacia atrás. Menú blanco borde 2px v4. Botón cerrado con
  etiqueta "Periodo" + label elegido.

### Componentes compartidos migrados (arrastran muchas páginas)
- `src/components/kit/TabsContainer.tsx` → v4 (RutaPantalla + plancha para nivel
  primario con título; SubTabs para nivel secundario sin título). Cubre por ruta:
  Analítica, Clientes, Marketing, Compras, Operaciones (Registro diario /
  Mantenimiento / Calidad), Cocina Operativa y Cocina Dinero.
- `src/components/configuracion/ModTitle.tsx` + `TabPills.tsx` → v4. Cubre todo
  Ajustes con esos componentes: Integraciones, Reglas, Compras (config), Cocina
  (config), Usuarios, Bancos, etc.

### Páginas migradas (cabecera propia)
- Finanzas: Tesorería, Resultados (EEFF), Ventas, Rentabilidad, Papeleo
  (Documentacion), Panel de alertas, Bandeja de pendientes.
- Ajustes: ConfiguracionHub, Cuentas bancarias, Mapeo de marcas, Bancos y cuentas,
  Calendario operativo, Aprendizajes ERP, Aprendizaje calcNeto.
- Portada: Home (Hoy). Equipo (Personas / Dinero / Día a día / Documentos).
- Cocina: Hoy, Cocina inventario, Plato maestro, Platos maestros.
- Operaciones: Reclamación reembolsos (contadores → badges), Reuniones equipo.
- Otros: Importar ventas, Panel dirección, Proveedores, Marcas, Inventario, Tareas.

### Notas
- Páginas internas que se renderizan dentro de TabsContainer y aún conservan un
  título propio antiguo (p.ej. Panel MKT, Margen por canal, Producción) quedan con la
  cabecera v4 del contenedor + su subtítulo interno preexistente; limpiar ese
  subtítulo interno es trabajo posterior, fuera del alcance de esta tanda.
- PENDIENTE: ninguna página del encargo quedó sin migrar.

## Pendiente (orden)
Tesorería → EEFF → Objetivos → Papeleo → resto de pestañas del Panel → Cocina → Compras → Operaciones → Ajustes. En cada una: héroe con frase-insight de su categoría.
