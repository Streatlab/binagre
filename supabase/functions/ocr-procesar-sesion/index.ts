// Worker v14 (ESPEJO de la edge function desplegada en Supabase via MCP).
// Cambios v13 -> v14:
//  1. 'lectura_manual' (sin plantilla NIF, 0 API) cuenta como PENDIENTE, no error.
//  2. Respuesta no-JSON de Vercel (413 archivo grande) se parsea segura: error legible, no crash.
// Fuente canonica desplegada en Supabase. Este archivo es espejo para control de versiones.
// El cambio funcional vive en procesarFacturaRemoto() y en leerRespuesta().
//
// Ver version completa desplegada: Supabase project eryauogxcpbgdryeimdq, slug ocr-procesar-sesion, version 14.
