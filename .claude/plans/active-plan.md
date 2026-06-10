# Active Plan — Binagre ERP

## En curso — MEGA-BATCH v2 (sesión actual)

### Completado en esta sesión
- ✅ Fase 1.1 Bug marcas activa/estado desync
- ✅ Fase 1.3 Bug periodoLabel en ColDiasPico  
- ✅ Fase 1.4 PanelCobertura refresh + polling
- ✅ Fase 1.5 Objetivos toast feedback
- ✅ Fase 2.5 CalcNetoAprendizajePage
- ✅ Fase 2.6 AprendizajesPage
- ✅ Fase 4.2 PagosCobros completo (3 tabs)
- ✅ Fase 4.4 EscenariosTesorería 90 días
- ✅ Fase 4.8 Gestoría con exports trimestrales IVA
- ✅ Fase 6.4 Control Presencia y Fichaje
- ✅ Fase 7.1 Checklists Apertura/Cierre
- ✅ Fase 7.3 Tareas Operativas (Kanban)
- ✅ Fase 9.3 Modo oscuro default + ThemeToggle mobile
- ✅ Panel Global tabs Operaciones + Finanzas
- ✅ Usos ingredientes — trigger DB recalculo automático
- ✅ Tabla fichajes creada en Supabase
- ✅ Tabla manuales_operaciones creada en Supabase

### En progreso (agentes background)
- 🔄 Panel Global tabs Marcas + Evolución (agent a9a75fb7b5054cfb6)
- 🔄 Manuales Operaciones página (agent a82763ddf5c6c2f73)

### Pendiente (alta prioridad)
- [ ] Fase 7.2 Manuales operaciones — wiring App.tsx + Sidebar
- [ ] Panel Global tab Evolución — wiring
- [ ] Fase 10.7 Deploy master + Vercel prod

### Pendiente (media prioridad)
- [ ] Fase 3.3 OCR storage cleanup job
- [ ] Fase 4.6 Panel Global alertas dirección
- [ ] 26 facturas sin categoría — necesita Rubén
- [ ] RLS 38 tablas — requiere diseño de políticas

### BLOCKING — necesita decisión Rubén
- RLS: app usa PIN propio, no Supabase Auth → políticas RLS requieren service_role o ajuste de arquitectura
