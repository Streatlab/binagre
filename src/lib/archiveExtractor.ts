// archiveExtractor.ts — ZIP, RAR y 7z en browser (WASM)
// RAR: node-unrar-js | 7z: 7z-wasm via CDN dinamico

import { createExtractorFromData } from 'node-unrar-js'

async function cargar7z(): Promise<any> {
  if ((window as any).__7zWasm) return (window as any).__7zWasm
  const mod = await (Function('url', 'return import(url)')('https://cdn.jsdelivr.net/npm/7z-wasm@1.0.0/+esm'))
  const sz = await mod.default()
  ;(window as any).__7zWasm = sz
  return sz
}

type ExpandirZipFn = (blob: Blob, origen: string, validas: Set<string>, aceptados: File[], rechazados: string[], contador: {n:number}, nivel: number) => Promise<void>
type ExpandirRarFn = (blob: Blob, origen: string, validas: Set<string>, aceptados: File[], rechazados: string[], contador: {n:number}, expandirZip: ExpandirZipFn) => Promise<void>

export async function expandir7z(
  f: File | Blob, nombreOrigen: string, validas: Set<string>,
  aceptados: File[], rechazados: string[], contador: {n:number},
  expandirZip: ExpandirZipFn, expandirRar: ExpandirRarFn,
): Promise<void> {
  try {
    const sz = await cargar7z()
    const buf = await f.arrayBuffer()
    const data = new Uint8Array(buf)
    const archName = `_in_${Date.now()}`
    const outDir = `_out_${Date.now()}`
    sz.FS.writeFile(archName, data)
    sz.FS.mkdir(outDir)
    sz.callMain(['x', archName, `-o${outDir}`, '-y'])

    const leerDir = async (dir: string, prefijo: string) => {
      let entries: string[]
      try { entries = sz.FS.readdir(dir).filter((e: string) => e !== '.' && e !== '..') }
      catch { return }
      for (const entry of entries) {
        const fullPath = `${dir}/${entry}`
        const displayName = prefijo ? `${prefijo}/${entry}` : entry
        let stat: any
        try { stat = sz.FS.stat(fullPath) } catch { continue }
        if (sz.FS.isDir(stat.mode)) { await leerDir(fullPath, displayName); continue }
        const ext = entry.split('.').pop()?.toLowerCase() ?? ''
        const raw: Uint8Array = sz.FS.readFile(fullPath)
        // Cast explícito a ArrayBuffer para compatibilidad TS6
        const buf2 = raw.buffer as ArrayBuffer
        const blob = new Blob([buf2])
        if (ext === '7z') { await expandir7z(blob, `${nombreOrigen} → ${displayName}`, validas, aceptados, rechazados, contador, expandirZip, expandirRar); continue }
        if (ext === 'rar') { await expandirRar(blob, `${nombreOrigen} → ${displayName}`, validas, aceptados, rechazados, contador, expandirZip); continue }
        if (ext === 'zip') { await expandirZip(blob, `${nombreOrigen} → ${displayName}`, validas, aceptados, rechazados, contador, 1); continue }
        if (!validas.has(ext)) { rechazados.push(`${nombreOrigen} → ${displayName}`); continue }
        aceptados.push(new File([buf2], entry, { type: 'application/octet-stream' }))
        contador.n++
      }
    }

    await leerDir(outDir, '')
    try { sz.FS.unlink(archName) } catch {}
  } catch (err: any) {
    rechazados.push(`${nombreOrigen} (7z error: ${err?.message || 'error'})`)
  }
}

export async function expandirRar(
  f: File | Blob, nombreOrigen: string, validas: Set<string>,
  aceptados: File[], rechazados: string[], contador: {n:number},
  expandirZip: ExpandirZipFn,
): Promise<void> {
  try {
    const buf = await f.arrayBuffer()
    const extractor = await createExtractorFromData({ data: buf })
    const extracted = extractor.extract()
    for (const file of [...extracted.files]) {
      if (!file.extraction) continue
      if (file.fileHeader.flags.directory) continue
      const innerName = (file.fileHeader.name || '').split(/[/\\]/).pop() || file.fileHeader.name
      const ext = innerName.split('.').pop()?.toLowerCase() ?? ''
      // Cast explícito para evitar SharedArrayBuffer
      const raw = new Uint8Array(
        file.extraction.buffer as ArrayBuffer,
        file.extraction.byteOffset,
        file.extraction.byteLength,
      )
      const blob = new Blob([raw])
      if (ext === 'rar') { await expandirRar(blob, `${nombreOrigen} → ${innerName}`, validas, aceptados, rechazados, contador, expandirZip); continue }
      if (ext === '7z') { await expandir7z(blob, `${nombreOrigen} → ${innerName}`, validas, aceptados, rechazados, contador, expandirZip, expandirRar); continue }
      if (ext === 'zip') { await expandirZip(blob, `${nombreOrigen} → ${innerName}`, validas, aceptados, rechazados, contador, 1); continue }
      if (!validas.has(ext)) { rechazados.push(`${nombreOrigen} → ${innerName}`); continue }
      aceptados.push(new File([raw], innerName, { type: 'application/octet-stream' }))
      contador.n++
    }
  } catch (err: any) {
    rechazados.push(`${nombreOrigen} (RAR error: ${err?.message || 'error'})`)
  }
}
