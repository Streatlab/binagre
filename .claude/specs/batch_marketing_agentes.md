# BATCH MARKETING — Módulo agentes IA
## Repo: Streatlab/binagre · Path: C:\streatlab-erp

---

## CONTEXTO

Añadir módulo `/marketing` al ERP Binagre. Es un módulo más del ERP. Mismo sidebar, mismos tokens canónicos, mismo stack Next.js + Supabase. Supabase ya tiene las 3 tablas (`marketing_agents`, `marketing_runs`, `marketing_outputs`) y los 5 agentes con sus prompts. Solo construyes código y UI.

**MODELO:** Usa `claude-sonnet-4-6` en todas las llamadas a la Anthropic API. No cambies el modelo.

**NO improvises estilos.** Todos los valores visuales están en esta spec. Cualquier valor no listado aquí → busca el patrón equivalente en el ERP existente y replica.

---

## TOKENS CANÓNICOS — OBLIGATORIOS

Tipografía:
- Títulos página/KPI: `font-family: 'Oswald', sans-serif`, 22px, weight 600, letter-spacing 3px, MAYÚSCULAS
- Subtítulos card: Oswald, 12px, weight 500, letter-spacing 2px, MAYÚSCULAS
- Valores KPI gigantes: Oswald, 2.4rem, weight 600
- Body / texto general: `font-family: 'Lexend', sans-serif`, 14px, weight 400
- Texto pequeño (fechas, labels): Lexend, 12px, weight 400
- NUNCA usar otra familia tipográfica

Colores:
- Fondo página: `#f5f3ef`
- Fondo grupo/sección: `#ebe8e2`
- Fondo card: `#ffffff`
- Borde estándar: `0.5px solid #d0c8bc`
- Texto principal: `#111111`
- Texto secundario: `#3a4050`
- Texto muted (labels, fechas): `#7a8090`
- Acento / tab activa / botón primario: `#FF4757`
- Rojo Streat Lab (títulos página, identidad): `#B01D23`
- Sidebar bg: `#1e2233`

Semáforo alertas:
- ROJO: `#E24B4A`
- AMARILLO: `#f5a623`
- VERDE: `#1D9E75`

Espaciado:
- Border-radius card grande: `16px`
- Border-radius card pequeña: `10px`
- Border-radius botón: `6px`
- Padding card grande: `24px 28px`
- Padding card pequeña: `14px 16px`
- Gap grid KPIs: `14px`
- Margin-bottom título página: `18px`

---

## 1. WRAPPER ANTHROPIC

Crea `src/lib/marketing/anthropic.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function llamarAgente(
  promptBase: string,
  mensajeUsuario: string,
  maxTokens = 2000
): Promise<{ contenido: string; tokens: number }> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system: promptBase,
    messages: [{ role: 'user', content: mensajeUsuario }],
  });

  const contenido = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as any).text)
    .join('');

  return {
    contenido,
    tokens: response.usage.input_tokens + response.usage.output_tokens,
  };
}
```

---

## 2. SUBAGENTE ANALYTICS

Crea `src/lib/marketing/subagentes/analytics.ts`:

```typescript
import { llamarAgente } from '../anthropic';

export async function ejecutarAnalytics(supabase: any, runId: string) {
  const hoy = new Date();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  lunes.setHours(0, 0, 0, 0);
  const fechaInicioStr = lunes.toISOString().split('T')[0];

  const { data: ventas } = await supabase
    .from('facturacion_diario')
    .select('canal, total_ventas')
    .gte('fecha', fechaInicioStr);

  const canales: Record<string, number> = {};
  for (const v of ventas || []) {
    canales[v.canal] = (canales[v.canal] || 0) + (v.total_ventas || 0);
  }

  const totalVentas = Object.values(canales).reduce((a: number, b) => a + (b as number), 0);
  const ventasDirecto = canales['tienda_online'] || 0;
  const pedidosDirecto = (ventas || []).filter((v: any) => v.canal === 'tienda_online').length;

  const { data: agente } = await supabase
    .from('marketing_agents')
    .select('prompt_base, max_tokens')
    .eq('nombre', 'analytics')
    .single();

  const input = JSON.stringify({
    ventas_canal: {
      tienda_online: ventasDirecto,
      uber_eats: canales['uber_eats'] || 0,
      glovo: canales['glovo'] || 0,
      just_eat: canales['just_eat'] || 0,
    },
    ticket_medio_directo: pedidosDirecto > 0 ? ventasDirecto / pedidosDirecto : 0,
    semana_inicio: fechaInicioStr,
  });

  const { contenido, tokens } = await llamarAgente(agente.prompt_base, input, agente.max_tokens);

  await supabase.from('marketing_outputs').insert({
    run_id: runId,
    agente_nombre: 'analytics',
    tipo: 'informe_kpis',
    contenido,
    estado: 'pendiente',
  });

  await supabase
    .from('marketing_runs')
    .update({ tokens_usados: tokens })
    .eq('id', runId);

  try { return JSON.parse(contenido); } catch { return { resumen_ejecutivo: contenido, alertas: [] }; }
}
```

---

## 3. ORQUESTADOR

Crea `src/lib/marketing/orquestador.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { llamarAgente } from './anthropic';
import { ejecutarAnalytics } from './subagentes/analytics';

export async function ejecutarCicloMarketing() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: run } = await supabase
    .from('marketing_runs')
    .insert({ agente_nombre: 'orquestador', estado: 'en_curso' })
    .select()
    .single();

  try {
    const kpis = await ejecutarAnalytics(supabase, run.id);

    const { data: agente } = await supabase
      .from('marketing_agents')
      .select('prompt_base, max_tokens')
      .eq('nombre', 'orquestador')
      .single();

    const { contenido } = await llamarAgente(
      agente.prompt_base,
      JSON.stringify({ kpis, fecha: new Date().toISOString().split('T')[0] }),
      agente.max_tokens
    );

    await supabase.from('marketing_outputs').insert({
      run_id: run.id,
      agente_nombre: 'orquestador',
      tipo: 'plan_semanal',
      contenido,
      estado: 'pendiente',
    });

    await supabase
      .from('marketing_runs')
      .update({ estado: 'completado', completado_en: new Date().toISOString() })
      .eq('id', run.id);

    return { ok: true, runId: run.id };
  } catch (error: any) {
    await supabase
      .from('marketing_runs')
      .update({ estado: 'error', error: error.message })
      .eq('id', run.id);
    throw error;
  }
}
```

---

## 4. API ROUTES

Crea `pages/api/marketing/run.ts`:

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { ejecutarCicloMarketing } from '@/lib/marketing/orquestador';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const resultado = await ejecutarCicloMarketing();
    return res.status(200).json(resultado);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
```

Crea `pages/api/marketing/outputs.ts`:

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data } = await supabase
    .from('marketing_outputs')
    .select('*')
    .order('creado_en', { ascending: false })
    .limit(50);
  return res.status(200).json({ data });
}
```

Crea `pages/api/marketing/approve.ts`:

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { id, estado } = req.body;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  await supabase
    .from('marketing_outputs')
    .update({ estado, aprobado_en: new Date().toISOString() })
    .eq('id', id);
  return res.status(200).json({ ok: true });
}
```

---

## 5. PÁGINA PRINCIPAL

Crea `src/app/marketing/page.tsx` con el siguiente contenido exacto. No añadas ni quites nada sin motivo técnico que lo exija:

```tsx
'use client';
import { useState, useEffect } from 'react';

const T = {
  bg: '#f5f3ef',
  group: '#ebe8e2',
  card: '#ffffff',
  brd: '#d0c8bc',
  pri: '#111111',
  sec: '#3a4050',
  mut: '#7a8090',
  accent: '#FF4757',
  red: '#B01D23',
  verde: '#1D9E75',
  amber: '#f5a623',
  danger: '#E24B4A',
  fontTitle: "'Oswald', sans-serif",
  fontBody: "'Lexend', sans-serif",
};

export default function MarketingPage() {
  const [outputs, setOutputs] = useState<any[]>([]);
  const [ejecutando, setEjecutando] = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const res = await fetch('/api/marketing/outputs');
    const { data } = await res.json();
    setOutputs(data || []);
  }

  async function ejecutarCiclo() {
    setEjecutando(true);
    try { await fetch('/api/marketing/run', { method: 'POST' }); } finally {
      await cargar();
      setEjecutando(false);
    }
  }

  async function aprobar(id: string, estado: 'aprobado' | 'rechazado') {
    await fetch('/api/marketing/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, estado }),
    });
    await cargar();
  }

  const pendientes = outputs.filter((o) => o.estado === 'pendiente');
  const aprobados = outputs.filter((o) => o.estado === 'aprobado');
  const ultimoCiclo = outputs[0]?.creado_en
    ? new Date(outputs[0].creado_en).toLocaleDateString('es-ES')
    : '—';

  const kpis = [
    { label: 'PENDIENTES', valor: String(pendientes.length) },
    { label: 'APROBADOS', valor: String(aprobados.length) },
    { label: 'ÚLTIMO CICLO', valor: ultimoCiclo },
  ];

  return (
    <div style={{ padding: '32px 28px', background: T.bg, minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontFamily: T.fontTitle, color: T.red, fontSize: 22, fontWeight: 600, letterSpacing: 3, margin: 0, textTransform: 'uppercase' }}>
            MARKETING
          </h1>
          <p style={{ fontFamily: T.fontBody, color: T.mut, fontSize: 12, margin: '4px 0 0' }}>
            Sistema de agentes IA · Binagre
          </p>
        </div>
        <button
          onClick={ejecutarCiclo}
          disabled={ejecutando}
          style={{
            background: ejecutando ? T.mut : T.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '8px 18px',
            fontFamily: T.fontTitle,
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: 1,
            cursor: ejecutando ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase',
          }}
        >
          {ejecutando ? 'EJECUTANDO...' : 'EJECUTAR CICLO'}
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 16, padding: '24px 28px' }}>
            <div style={{ fontFamily: T.fontTitle, color: T.mut, fontSize: 12, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
              {k.label}
            </div>
            <div style={{ fontFamily: T.fontTitle, color: T.pri, fontSize: '2.4rem', fontWeight: 600, lineHeight: 1 }}>
              {k.valor}
            </div>
          </div>
        ))}
      </div>

      {/* Pendientes */}
      {pendientes.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: T.fontTitle, color: T.sec, fontSize: 12, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
            PENDIENTES DE APROBACIÓN
          </div>
          {pendientes.map((o) => {
            let contenidoMostrado = o.contenido;
            try { contenidoMostrado = JSON.stringify(JSON.parse(o.contenido), null, 2); } catch {}
            return (
              <div key={o.id} style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <span style={{ fontFamily: T.fontTitle, fontSize: 11, color: T.accent, letterSpacing: 1, textTransform: 'uppercase' }}>
                      {o.agente_nombre} · {o.tipo.replace(/_/g, ' ')}
                    </span>
                    <div style={{ fontFamily: T.fontBody, color: T.mut, fontSize: 12, marginTop: 2 }}>
                      {new Date(o.creado_en).toLocaleString('es-ES')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => aprobar(o.id, 'aprobado')}
                      style={{ background: T.verde, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontFamily: T.fontBody, fontSize: 12, cursor: 'pointer' }}
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => aprobar(o.id, 'rechazado')}
                      style={{ background: 'transparent', color: T.mut, border: `0.5px solid ${T.brd}`, borderRadius: 6, padding: '6px 14px', fontFamily: T.fontBody, fontSize: 12, cursor: 'pointer' }}
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
                <pre style={{ fontFamily: T.fontBody, fontSize: 12, color: T.sec, whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.6, background: T.group, borderRadius: 6, padding: '10px 12px' }}>
                  {contenidoMostrado}
                </pre>
              </div>
            );
          })}
        </div>
      )}

      {/* Historial */}
      {aprobados.length > 0 && (
        <div>
          <div style={{ fontFamily: T.fontTitle, color: T.sec, fontSize: 12, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
            HISTORIAL
          </div>
          <div style={{ background: T.card, border: `0.5px solid ${T.brd}`, borderRadius: 10, padding: '14px 16px' }}>
            {aprobados.slice(0, 5).map((o, i) => (
              <div key={o.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: i < 4 ? `0.5px solid ${T.brd}` : 'none',
              }}>
                <span style={{ fontFamily: T.fontBody, color: T.sec, fontSize: 13 }}>
                  {o.agente_nombre} · {o.tipo.replace(/_/g, ' ')}
                </span>
                <span style={{ fontFamily: T.fontBody, color: T.mut, fontSize: 12 }}>
                  {new Date(o.aprobado_en).toLocaleDateString('es-ES')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
```

---

## 6. SIDEBAR

Busca el archivo donde viven los items de navegación del sidebar. Añade esta entrada DESPUÉS de Dashboard y ANTES del resto:

```
{ href: '/marketing', label: 'MARKETING' }
```

No cambies ningún otro item existente.

---

## 7. DEPENDENCIA

Comprueba si `@anthropic-ai/sdk` está en `package.json`. Si no está, instálalo:

```bash
npm install @anthropic-ai/sdk
```

---

## CHECKLIST

- [ ] `src/lib/marketing/anthropic.ts`
- [ ] `src/lib/marketing/subagentes/analytics.ts`
- [ ] `src/lib/marketing/orquestador.ts`
- [ ] `pages/api/marketing/run.ts`
- [ ] `pages/api/marketing/outputs.ts`
- [ ] `pages/api/marketing/approve.ts`
- [ ] `src/app/marketing/page.tsx`
- [ ] Entrada MARKETING en sidebar
- [ ] `@anthropic-ai/sdk` instalado
- [ ] Build sin errores TypeScript

---

```
git add . && git commit -m "feat(marketing): módulo agentes IA — orquestador + analytics + UI aprobación" && git push origin master && npx vercel --prod && git pull origin master
```
