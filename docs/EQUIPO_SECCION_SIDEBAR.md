# Equipo · seccion propia del sidebar (22-jul-2026)

Equipo vuelve a ser seccion propia del sidebar (color rosa #D6336C), con cuatro
entradas en vez de una pantalla con doce pestañas seguidas:

- **Personas** (`/equipo/personas`): Fichas · Organigrama · Incentivos · Portal del empleado
- **Dinero** (`/equipo/dinero`): Nominas · Costes · Seguridad Social y autonomos
- **Dia a dia** (`/equipo/dia-a-dia`): Horarios · Fichajes · Calendario laboral · Permisos y vacaciones
- **Documentos** (`/equipo/documentos`): sin pestañas

`src/pages/Equipo.tsx` recibe `grupo` por prop y solo pinta las pestañas de ese
grupo (constante `GRUPOS`). Las rutas antiguas (`/equipo`, `/equipo/organigrama`,
`/equipo/horarios`, `/equipo/presencia`, `/equipo/portal`, `/equipo/nominas`,
`/equipo/costes`, `/equipo/incentivos`) redirigen a su nuevo sitio, asi que
ningun enlace guardado se rompe.
