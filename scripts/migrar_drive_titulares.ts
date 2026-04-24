/**
 * scripts/migrar_drive_titulares.ts
 *
 * Mueve los PDFs ya subidos a Drive a la carpeta del titular correspondiente.
 *
 * Estructura ORIGEN (Batch 2B):
 *   /05 FACTURAS RECIBIDAS/{año}/{trimestre}/{mes}/{tipo}/archivo
 *
 * Estructura DESTINO (Batch 2E):
 *   /05 FACTURAS RECIBIDAS/{CARPETA_TITULAR}/{año}/{trimestre}/{mes}/{tipo}/archivo
 *
 * Requisitos:
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + GOOGLE_SERVICE_ACCOUNT_JSON +
 *   GOOGLE_DRIVE_ROOT_FOLDER_ID en .env o entorno.
 *
 * Uso:
 *   npx tsx scripts/migrar_drive_titulares.ts            # dry-run
 *   npx tsx scripts/migrar_drive_titulares.ts --apply    # aplica movimientos
 *
 * Seguro: sólo añade parents, no borra archivos.
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eryauogxcpbgdryeimdq.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
const SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON

if (!SERVICE_KEY || !ROOT_FOLDER_ID || !SERVICE_ACCOUNT_JSON) {
  console.error('Faltan SUPABASE_SERVICE_ROLE_KEY / GOOGLE_DRIVE_ROOT_FOLDER_ID / GOOGLE_SERVICE_ACCOUNT_JSON')
  process.exit(1)
}

const apply = process.argv.includes('--apply')

const supabase = createClient(SUPABASE_URL, SERVICE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(SERVICE_ACCOUNT_JSON!),
  scopes: ['https://www.googleapis.com/auth/drive'],
})
const drive = google.drive({ version: 'v3', auth })

async function getOrCreateFolder(name: string, parentId: string): Promise<string> {
  const safe = name.replace(/'/g, "\\'")
  const { data } = await drive.files.list({
    q: `name='${safe}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  if (data.files?.[0]?.id) return data.files[0].id
  const { data: c } = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
    supportsAllDrives: true,
  })
  return c.id!
}

function trimestre(d: Date): string {
  const m = d.getMonth()
  if (m < 3) return '1T'
  if (m < 6) return '2T'
  if (m < 9) return '3T'
  return '4T'
}
const MESES = [
  '01 ENERO', '02 FEBRERO', '03 MARZO', '04 ABRIL', '05 MAYO', '06 JUNIO',
  '07 JULIO', '08 AGOSTO', '09 SEPTIEMBRE', '10 OCTUBRE', '11 NOVIEMBRE', '12 DICIEMBRE',
]

async function main() {
  console.log(`[${apply ? 'APPLY' : 'DRY-RUN'}] Migrando Drive a carpetas por titular...`)

  const { data: facturas } = await supabase
    .from('facturas')
    .select('id, pdf_drive_id, fecha_factura, tipo, titular_id')
    .not('pdf_drive_id', 'is', null)

  const { data: titulares } = await supabase.from('titulares').select('id, carpeta_drive')
  const mapaTit = new Map<string, string>()
  for (const t of titulares || []) mapaTit.set(t.id as string, t.carpeta_drive as string)

  let moved = 0
  for (const f of facturas || []) {
    const tit = f.titular_id ? mapaTit.get(f.titular_id as string) || 'SIN_TITULAR' : 'SIN_TITULAR'
    const fecha = new Date(f.fecha_factura as string)
    const año = String(fecha.getFullYear())
    const tri = trimestre(fecha)
    const mes = MESES[fecha.getMonth()]
    const carpetaTipo = f.tipo === 'plataforma' ? 'PLATAFORMAS' : 'PROVEEDORES'

    console.log(`  ${f.pdf_drive_id} → /${tit}/${año}/${tri}/${mes}/${carpetaTipo}/`)

    if (!apply) continue

    let folder = ROOT_FOLDER_ID!
    for (const n of [tit, año, tri, mes, carpetaTipo]) folder = await getOrCreateFolder(n, folder)

    // Añadir parent destino y quitar los otros parents
    const { data: file } = await drive.files.get({
      fileId: f.pdf_drive_id as string,
      fields: 'id, parents',
      supportsAllDrives: true,
    })
    const oldParents = (file.parents || []).join(',')
    await drive.files.update({
      fileId: f.pdf_drive_id as string,
      addParents: folder,
      removeParents: oldParents,
      supportsAllDrives: true,
    })
    moved++
  }

  console.log(`Listo. ${moved} archivos movidos (apply=${apply}).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
