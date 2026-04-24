import type { Plugin, ViteDevServer } from 'vite'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Vite plugin: ejecuta funciones estilo Vercel (api/**.ts) en el dev server.
 * Carga dinámicamente el módulo con ssrLoadModule, añade polyfills status()/json()
 * y lee req.body como JSON si el content-type lo indica.
 */
export function vercelApiPlugin(): Plugin {
  return {
    name: 'vercel-api-dev',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        if (!url.startsWith('/api/')) return next()

        const pathname = url.split('?')[0]!.replace(/\/$/, '')
        const rel = pathname.replace(/^\/api\//, '')
        const apiDir = resolve(process.cwd(), 'api')

        const candidates = [
          resolve(apiDir, `${rel}.ts`),
          resolve(apiDir, rel, 'index.ts'),
        ]

        // Rutas dinámicas [id]
        const segments = rel.split('/').filter(Boolean)
        if (segments.length >= 1) {
          // api/foo/:id  → api/foo/[id].ts
          for (let i = 1; i < segments.length + 1; i++) {
            const testSegs = [...segments]
            testSegs[i - 1] = `[${segments[i - 1]}]`
            candidates.push(resolve(apiDir, `${testSegs.join('/')}.ts`))
            if (i < segments.length) {
              candidates.push(resolve(apiDir, `${testSegs.slice(0, i).join('/')}/${segments.slice(i).join('/')}.ts`))
            }
          }
        }

        const file = candidates.find(p => {
          try { return existsSync(p) && statSync(p).isFile() } catch { return false }
        })
        if (!file) return next()

        try {
          const mod = await server.ssrLoadModule(file)
          const handler = mod.default
          if (typeof handler !== 'function') return next()

          await enrichRequest(req)
          decorateResponse(res)

          // Query params
          const qIdx = url.indexOf('?')
          const qstr = qIdx >= 0 ? url.slice(qIdx + 1) : ''
          const query: Record<string, string> = {}
          if (qstr) {
            for (const part of qstr.split('&')) {
              const [k, v] = part.split('=')
              if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '')
            }
          }
          ;(req as any).query = query

          // Path params para [id] en rutas dinámicas
          ;(req as any).params = extractParams(file, pathname, apiDir)

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

function extractParams(file: string, pathname: string, apiDir: string): Record<string, string> {
  const rel = file.replace(apiDir, '').replace(/\\/g, '/').replace(/^\//, '').replace(/\.ts$/, '').replace(/\/index$/, '')
  const fileSegs = rel.split('/')
  const urlSegs = pathname.replace(/^\/api\//, '').split('/').filter(Boolean)
  const params: Record<string, string> = {}
  fileSegs.forEach((seg, i) => {
    const m = seg.match(/^\[(.+)\]$/)
    if (m && urlSegs[i]) params[m[1]!] = decodeURIComponent(urlSegs[i]!)
  })
  return params
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
