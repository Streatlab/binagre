# LESSONS LEARNED — ERP Streat Lab
Reglas aprendidas de errores anteriores. Se actualiza automáticamente.

- Nunca usar bg-[] de Tailwind en modales — usar style={{backgroundColor:'#484f66'}} siempre
- Celdas sin dato: string vacío, nunca guion ni null visible
- fmtEur y fmtNum siempre desde src/utils/format.ts, nunca inline
- Mobile friendly es obligatorio en TODO lo que se toque, no opcional
