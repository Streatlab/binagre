// rarExtractor.ts — descomprimir RAR en browser usando node-unrar-js (WASM)
// Llamado desde Ocr.tsx igual que expandirZipRecursivo

import { createExtractorFromData } from 'node-unrar-js'

export async function expandirRarRecursivo(
  f: File | Blob,
  nombreOrigen: string,
  validas: Set<string>,
  aceptados: File[],
  rechazados: string[],
  contador: { n: number },
  expandirZip: (blob: Blob, nombre: string, validas: Set<string>, aceptados: File[], rechazados: string[], contador: { n: number }, nivel: number) => Promise<void>,
): Promise<void> {
  try {
    const buf = await f.arrayBuffer()
    const extractor = await createExtractorFromData({ data: buf })
    const extracted = extractor.extract()
    for (const file of [...extracted.files]) {
      if (!file.extraction) continue
      if (file.fileHeader.flags.directory) continue
      const innerName = (file.fileHeader.name || '').split(/[/\\]/).pop() || file.fileHeader.name
      const innerExt = innerName.split('.').pop()?.toLowerCase() ?? ''
      if (innerExt === 'rar') {
        await expandirRarRecursivo(
          new Blob([file.extraction]), `${nombreOrigen} → ${innerName}`,
          validas, aceptados, rechazados, contador, expandirZip,
        )
        continue
      }
      if (innerExt === 'zip') {
        await expandirZip(
          new Blob([file.extraction]), `${nombreOrigen} → ${innerName}`,
          validas, aceptados, rechazados, contador, 1,
        )
        continue
      }
      if (!validas.has(innerExt)) { rechazados.push(`${nombreOrigen} → ${innerName}`); continue }
      aceptados.push(new File([file.extraction], innerName, { type: 'application/octet-stream' }))
      contador.n++
    }
  } catch (err: any) {
    rechazados.push(`${nombreOrigen} (RAR corrupto o protegido: ${err?.message || 'error'})`)
  }
}
