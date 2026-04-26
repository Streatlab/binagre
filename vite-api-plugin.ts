import type { Plugin, ViteDevServer } from 'vite'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Carga variables de entorno desde los ficheros .env.local → .env sin sobrescribir
 * los valores que ya existan en process.env (ej. ya puestos por el sistema).
 */
function loadDotEnvFiles(): void {
  const files = ['.env.local', '.env']
  for (const name of files) {
    const p = resolve(process.cwd(), name)
    if (!existsSync(p)) continue
    const raw = readFileSync(p, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!key || process.env[key] !== undefined) continue
      process.env[key] = val
    }
  }
}

/**
 * Vite plugin: ejecuta funciones estilo Vercel (api/**.ts) en el dev server.
 * Carga dinámicamente el módulo con ssrLoadModule, añade polyfills status()/json()
 * y lee req.body como JSON si el content-type lo indica.
 */
export function vercelApiPlugin(): Plugin {
  return {
    name: 'vercel-api-dev',
    configureServer(server: ViteDevServer) {
      loadDotEnvFiles()
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        if (!url.startsWith('/api/')) return next()

        const pathname = url.split('?')[0]!.replace(/\/$/, '')
        const rel = pathname.replace(/^\/api\//, '')
        const apiDir = resolve(process.cwd(), 'api')

        const segments = rel.split('/').filter(Boolean)
        const match = resolveRoute(apiDir, segments)
        if (!match) return next()
        const { file, params } = match

        try {
          const mod = await server.ssrLoadModule(file)
          const handler = mod.default
          if (typeof handler !== 'function') return next()

          await enrichRequest(req)
          decorateResponse(res)

          // Query params (URL ?foo=bar) + path params ([id], [action], ...)
          const qIdx = url.indexOf('?')
          const qstr = qIdx >= 0 ? url.slice(qIdx + 1) : ''
          const query: Record<string, string> = { ...params }
          if (qstr) {
            for (const part of qstr.split('&')) {
              const [k, v] = part.split('=')
              if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '')
            }
          }
          ;(req as any).query = query
          ;(req as any).params = params

          await handler(req, res)
        } catch (err: any) {
          // eslint-disable-next-line no-console
          console.error('[api dev]', file, err)
          if (!res.writableEnded) {
            res.statusCode = 500
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: err?.message || String(err), stack: err?.stack }))
          }
        }
      })
    },
  }
}

/**
 * Resuelve una ruta de URL contra el filesystem en estilo Vercel/Next:
 * - Match exacto: api/foo/bar.ts o api/foo/bar/index.ts
 * - Segmento dinámico archivo: api/foo/[param].ts (último segmento)
 * - Segmento dinámico carpeta: api/foo/[param]/... (segmentos intermedios)
 *
 * Escanea readdirSync para detectar [*] sin asumir el nombre del param.
 * Da prioridad a matches estáticos sobre dinámicos.
 */
function resolveRoute(
  dir: string,
  segments: string[],
): { file: string; params: Record<string, string> } | null {
  if (segments.length === 0) {
    const idx = resolve(dir, 'index.ts')
    if (existsSync(idx) && statSync(idx).isFile()) return { file: idx, params: {} }
    return null
  }

  const head = segments[0]!
  const rest = segments.slice(1)

  // 1. Match estático archivo (.ts) — solo si es el último segmento
  if (rest.length === 0) {
    const direct = resolve(dir, `${head}.ts`)
    try {
      if (existsSync(direct) && statSync(direct).isFile()) return { file: direct, params: {} }
    } catch { /* ignore */ }
  }

  // 2. Match estático carpeta — recursivo
  const exactDir = resolve(dir, head)
  try {
    if (existsSync(exactDir) && statSync(exactDir).isDirectory()) {
      const sub = resolveRoute(exactDir, rest)
      if (sub) return sub
    }
  } catch { /* ignore */ }

  // 3. Match dinámico [*] — escanear el directorio
  let entries: string[] = []
  try { entries = readdirSync(dir) } catch { return null }

  for (const entry of entries) {
    // Archivo dinámico: [param].ts (solo si es el último segmento)
    if (rest.length === 0 && entry.endsWith('.ts')) {
      const m = entry.match(/^\[(.+)\]\.ts$/)
      if (m) {
        const file = resolve(dir, entry)
        try {
          if (statSync(file).isFile()) {
            return { file, params: { [m[1]!]: decodeURIComponent(head) } }
          }
        } catch { /* ignore */ }
      }
      continue
    }
    // Carpeta dinámica: [param]/ — recursión con segmentos restantes
    const m = entry.match(/^\[(.+)\]$/)
    if (!m) continue
    const subDir = resolve(dir, entry)
    try {
      if (statSync(subDir).isDirectory()) {
        const sub = resolveRoute(subDir, rest)
        if (sub) {
          return { file: sub.file, params: { ...sub.params, [m[1]!]: decodeURIComponent(head) } }
        }
      }
    } catch { /* ignore */ }
  }

  return null
}

async function enrichRequest(req: IncomingMessage): Promise<void> {
  const method = (req.method || 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD') return
  if ((req as any).body !== undefined) return

  const chunks: Buffer[] = []
  await new Promise<void>((resolveP, rejectP) => {
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolveP())
    req.on('error', rejectP)
  })
  const buf = Buffer.concat(chunks)
  const ct = String(req.headers['content-type'] || '')
  if (ct.includes('application/json') && buf.length) {
    try { (req as any).body = JSON.parse(buf.toString('utf8')) } catch { (req as any).body = buf.toString('utf8') }
  } else if (ct.includes('application/x-www-form-urlencoded') && buf.length) {
    const body: Record<string, string> = {}
    for (const part of buf.toString('utf8').split('&')) {
      const [k, v] = part.split('=')
      if (k) body[decodeURIComponent(k)] = decodeURIComponent(v || '')
    }
    ;(req as any).body = body
  } else {
    ;(req as any).body = buf.length ? buf : undefined
  }
}

function decorateResponse(res: ServerResponse): void {
  const r = res as any
  if (typeof r.status !== 'function') {
    r.status = (code: number) => { res.statusCode = code; return r }
  }
  if (typeof r.json !== 'function') {
    r.json = (data: unknown) => {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(data))
      return r
    }
  }
  if (typeof r.send !== 'function') {
    r.send = (data: unknown) => {
      if (typeof data === 'object' && data !== null) {
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(data))
      } else {
        res.end(String(data ?? ''))
      }
      return r
    }
  }
}
