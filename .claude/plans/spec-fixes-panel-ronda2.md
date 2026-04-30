# SPEC FIXES RONDA 2 — Panel Resumen (94 fixes literales)

> Tras primera ronda 127 fixes, validación visual de Rubén detecta 94 fixes pendientes/nuevos.
> Este spec es CARPINTERO LITERAL. NO interpretar. NO improvisar.
> Si Code encuentra ambigüedad: PARA y avisa. NO improvisa.

---

## Modelo
- General: `claude-sonnet-4-7`
- Subagentes: Sonnet
- Triviales: Haiku permitido
- PROHIBIDO Opus

## Reglas de ejecución
1. Aislamiento absoluto Binagre vs David
2. Modo localhost + Vercel SIEMPRE al cierre
3. Pipeline: pm-spec → architect-review → implementer → qa-reviewer → erp-reviewer
4. Backup BD antes de cualquier cambio schema
5. Commit por bloque
6. Validación mobile 375 / 768 / 1280 con capturas en `.claude/tracking/mobile-validation/ronda2/`
7. Deploy Vercel automático al cierre + URL al final

---

# RUTAS DE ARCHIVOS

```
/src/lib/format.ts                                        (helpers — verificar y reforzar)
/src/components/ui/BarraCumplimiento.tsx                  (componente compartido — fix lógica)
/src/components/ui/BannerPendientes.tsx                   (crear / verificar)
/src/components/ui/DropdownButton.tsx                     (verificar ChevronDown)
/src/components/panel/resumen/CardVentas.tsx              (renombrar internamente como Facturación)
/src/components/panel/resumen/CardPedidosTM.tsx
/src/components/panel/resumen/CardResultadoPeriodo.tsx
/src/components/panel/resumen/CardRatio.tsx
/src/components/panel/resumen/CardSaldo.tsx
/src/components/panel/resumen/CardPE.tsx
/src/components/panel/resumen/CardProvisiones.tsx
/src/components/panel/resumen/CardTopVentas.tsx
/src/components/panel/resumen/CardPendientesSubir.tsx     (verificar eliminación)
/src/components/panel/resumen/ColDiasPico.tsx
/src/components/panel/resumen/ColFacturacionCanal.tsx
/src/components/panel/resumen/ColGruposGasto.tsx
/src/components/panel/resumen/TabResumen.tsx              (orquestador layout)
/src/components/panel/resumen/tokens.ts                   (tokens estilos)
/src/components/panel/resumen/types.ts
```

---

# TABLAS SUPABASE OBLIGATORIAS (verificar existen, si faltan crear)

```sql
-- objetivos
CREATE TABLE objetivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('semanal','mensual','anual')),
  año INT NOT NULL,
  mes INT NULL,
  semana INT NULL,
  valor NUMERIC(12,2) NOT NULL,
  override_usuario NUMERIC(12,2) NULL
);

-- kpi_objetivos
CREATE TABLE kpi_objetivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prime_cost_target NUMERIC(5,2) DEFAULT 60.00,
  ratio_target NUMERIC(5,2) DEFAULT 2.50,
  presupuesto_producto_pct NUMERIC(5,2) DEFAULT 30.00,
  presupuesto_personal_pct NUMERIC(5,2) DEFAULT 40.00,
  presupuesto_local_pct NUMERIC(5,2) DEFAULT 15.00,
  presupuesto_controlables_pct NUMERIC(5,2) DEFAULT 15.00
);

-- running (datos PyG mensuales reales)
CREATE TABLE running (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  año INT NOT NULL,
  mes INT NOT NULL,
  ingresos_brutos NUMERIC(12,2),
  comisiones_plataforma NUMERIC(12,2),
  iva_comisiones NUMERIC(12,2),
  ingresos_netos NUMERIC(12,2),
  producto NUMERIC(12,2),
  margen_bruto NUMERIC(12,2),
  personal NUMERIC(12,2),
  local NUMERIC(12,2),
  controlables NUMERIC(12,2),
  ebitda NUMERIC(12,2),
  provisiones_iva NUMERIC(12,2),
  provisiones_irpf NUMERIC(12,2),
  resultado_limpio NUMERIC(12,2),
  gastos_fijos_periodo NUMERIC(12,2),
  gastos_variables_periodo NUMERIC(12,2),
  facturacion_bruta_acumulada NUMERIC(12,2),
  pedidos_total INT
);

-- gastos_fijos
CREATE TABLE gastos_fijos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concepto TEXT NOT NULL,
  importe NUMERIC(12,2) NOT NULL,
  proxima_fecha_pago DATE NOT NULL,
  categoria TEXT
);

-- cuentas_bancarias
CREATE TABLE cuentas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titular TEXT NOT NULL CHECK (titular IN ('streat_lab','ruben','emilio')),
  banco TEXT NOT NULL,
  iban TEXT,
  saldo_actual NUMERIC(12,2),
  fecha_ultimo_extracto DATE,
  activa BOOLEAN DEFAULT true
);

-- resumenes_plataforma_marca_mensual
CREATE TABLE resumenes_plataforma_marca_mensual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  año INT NOT NULL,
  mes INT NOT NULL,
  marca TEXT NOT NULL,
  plataforma TEXT NOT NULL CHECK (plataforma IN ('uber','glovo','just_eat','web','directa')),
  bruto NUMERIC(12,2),
  comisiones NUMERIC(12,2),
  fees NUMERIC(12,2),
  cargos_promocion NUMERIC(12,2),
  pedidos INT,
  neto_real_cobrado NUMERIC(12,2)
);
```

Si alguna tabla no existe → crear con `Supabase apply_migration`.

---

# FIX 1 — HELPERS `/src/lib/format.ts`

REEMPLAZAR contenido completo de `/src/lib/format.ts` por:

```ts
export const fmtNum = (n: number | null | undefined, decimals: number = 2): string => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const fmtEur = (n: number | null | undefined, opts?: { showEuro?: boolean; decimals?: number }): string => {
  const decimals = opts?.decimals ?? 2;
  const showEuro = opts?.showEuro ?? false;
  if (n === null || n === undefined || isNaN(n)) return '—';
  const formatted = fmtNum(n, decimals);
  return showEuro ? `${formatted} €` : formatted;
};

export const fmtPct = (n: number | null | undefined, decimals: number = 2): string => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return `${fmtNum(n, decimals)}%`;
};

export const fmtSemana = (numSemana: number, lunes: Date): string => {
  const dd = String(lunes.getDate()).padStart(2, '0');
  const mm = String(lunes.getMonth() + 1).padStart(2, '0');
  const yy = String(lunes.getFullYear()).slice(-2);
  return `S${numSemana}_${dd}_${mm}_${yy}`;
};

export const colorSemaforo = (pct: number): string => {
  if (pct >= 80) return '#1D9E75';
  if (pct >= 50) return '#f5a623';
  return '#E24B4A';
};

export const fmtMes = (mes: number): string => {
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return meses[mes - 1] ?? '';
};
```

ELIMINAR cualquier helper local en componentes individuales (`fmtEntero`, `fmtEur0`). Sustituir por `fmtNum`/`fmtEur`/`fmtPct` de `/src/lib/format.ts`.

---

# FIX 2 — `/src/components/ui/BarraCumplimiento.tsx`

REEMPLAZAR contenido completo por:

```tsx
import React from 'react';

interface Props {
  pct: number;            // 0-100+, puede pasar de 100
  altura?: number;        // default 8
  presupuesto?: number;   // si pasa 0 → barra vacía gris
}

export const BarraCumplimiento: React.FC<Props> = ({ pct, altura = 8, presupuesto }) => {
  // Edge case: presupuesto 0 → barra entera vacía gris
  if (presupuesto === 0) {
    return (
      <div style={{
        height: altura,
        borderRadius: altura / 2,
        background: '#ebe8e2',
      }} />
    );
  }

  const pctClamp = Math.min(Math.max(pct, 0), 100);

  // Color de la parte cumplida según pct:
  // 0-49% → amarillo  #f5a623
  // 50-79% → verde    #1D9E75
  // 80-100% → verde   #1D9E75
  let colorFill = '#f5a623';
  if (pctClamp >= 50) colorFill = '#1D9E75';

  return (
    <div style={{
      height: altura,
      borderRadius: altura / 2,
      background: '#ebe8e2',
      overflow: 'hidden',
      display: 'flex',
    }}>
      <div style={{ height: '100%', width: `${pctClamp}%`, background: colorFill }} />
      <div style={{ height: '100%', width: `${100 - pctClamp}%`, background: '#E24B4A' }} />
    </div>
  );
};
```

USAR `<BarraCumplimiento pct={X} />` en TODAS las barras de progreso de la página. Eliminar barras ad-hoc creadas con `<div>` directo.

---

# FIX 3 — BANNER `/src/components/ui/BannerPendientes.tsx`

CREAR archivo nuevo con contenido EXACTO:

```tsx
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface Props {
  pendientes: string[];
  onClose: () => void;
  onIrImportador: () => void;
}

export const BannerPendientes: React.FC<Props> = ({ pendientes, onClose, onIrImportador }) => {
  if (!pendientes || pendientes.length === 0) return null;

  return (
    <div style={{
      background: '#fef9e7',
      border: '1px solid #f5e08c',
      borderLeft: '3px solid #f5a623',
      borderRadius: 8,
      padding: '6px 14px',
      marginBottom: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      fontSize: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertTriangle size={14} color="#854F0B" />
        <span style={{ color: '#3a4050' }}>
          Tienes pendiente subir: <strong>{pendientes.join(', ')}</strong>
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={onIrImportador}
          style={{
            padding: '4px 10px',
            background: '#B01D23',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontFamily: 'Lexend',
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          IR AL IMPORTADOR
        </button>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#7a8090',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
```

Ajustes vs versión anterior:
- `padding: '6px 14px'` (era 8px 16px)
- `fontSize: 12` (era 13)
- Icono AlertTriangle 14px (era 14, OK)
- Botón "IR AL IMPORTADOR" `padding: '4px 10px'` y `fontSize: 11`
- Botón × como botón sin texto solo icono

---

# FIX 4 — DROPDOWN BUTTON `/src/components/ui/DropdownButton.tsx`

VERIFICAR que el contenido contiene:

```tsx
import { ChevronDown } from 'lucide-react';
// ...
<button style={{...}}>
  <span>{label}</span>
  <ChevronDown size={11} strokeWidth={2.5} style={{ marginLeft: 4 }} />
</button>
```

BUSCAR en TODO el código `▾` con grep y sustituir por el componente `<DropdownButton />` o por el bloque de JSX con ChevronDown 11px.

---

# FIX 5 — TABS PASTILLA contenedor

Archivo: `/src/components/ui/TabsPastilla.tsx` (o donde esté).

Container styles EXACTOS:
```ts
{
  background: '#ffffff',
  border: '0.5px solid #d0c8bc',
  borderRadius: 10,
  padding: '4px 6px',
  marginBottom: 12,
  display: 'inline-flex',
  gap: 4,
}
```

Antes era padding `'14px 18px'`. Ahora `'4px 6px'`. Ése es el "marco apenas 1mm".

Botones interior:
```ts
active: {
  padding: '5px 12px',
  borderRadius: 5,
  border: 'none',
  background: '#FF4757',
  color: '#fff',
  fontFamily: 'Lexend',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
},
inactive: {
  padding: '5px 12px',
  borderRadius: 5,
  border: '0.5px solid #d0c8bc',
  background: 'transparent',
  color: '#3a4050',
  fontFamily: 'Lexend',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
}
```

---

# FIX 6 — DROPDOWN MARCAS

Archivo: `/src/components/dropdowns/DropdownMarcas.tsx` (o donde esté el dropdown que muestra marcas).

Cada item:
```ts
{
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '3px 8px',          // antes 8px 12px
  fontSize: 12,                 // antes 13
  lineHeight: 1.2,              // antes 1.5
  cursor: 'pointer',
}
```

Container:
```ts
{
  maxHeight: 360,
  overflowY: 'auto',
  padding: 4,
}
```

---

# FIX 7 — CARD FACTURACIÓN `/src/components/panel/resumen/CardVentas.tsx`

REEMPLAZAR contenido completo del componente. Estructura final:

```tsx
import { fmtEur, fmtPct, fmtSemana, fmtMes, colorSemaforo } from '@/lib/format';
import { BarraCumplimiento } from '@/components/ui/BarraCumplimiento';

// [...]

export const CardVentas = ({ datos }) => {
  const {
    bruto,                    // suma facturación bruta de TODOS los canales
    netoEstimado,             // calculado con PMP
    margenPct,                // (netoEstimado / bruto) * 100
    objetivos: { semanal, mensual, anual },  // { valor, override_usuario, semanaNum, lunesSemana, mes, año }
    pctSemanal, pctMensual, pctAnual,
    deltaPct                  // % vs periodo anterior
  } = datos;

  return (
    <div style={cardBigStyle}>
      <div className="lbl">FACTURACIÓN</div>
      
      {/* Bruto y Neto MISMO TAMAÑO */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap', marginTop: 8 }}>
        <div>
          <div style={{ fontFamily: 'Oswald', fontSize: 38, fontWeight: 600, color: '#111111' }}>
            {fmtEur(bruto, { showEuro: false })}
          </div>
          <div style={{ fontFamily: 'Oswald', fontSize: 10, letterSpacing: 1.5, color: '#7a8090', textTransform: 'uppercase', fontWeight: 500 }}>
            BRUTO
          </div>
        </div>
        <div>
          <div style={{ fontFamily: 'Oswald', fontSize: 38, fontWeight: 600, color: '#1D9E75' }}>
            {fmtEur(netoEstimado, { showEuro: false })}
          </div>
          <div style={{ fontFamily: 'Oswald', fontSize: 10, letterSpacing: 1.5, color: '#1D9E75', textTransform: 'uppercase', fontWeight: 500 }}>
            NETO ESTIMADO · {fmtPct(margenPct, 0)}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: deltaPct < 0 ? '#E24B4A' : '#1D9E75', margin: '10px 0 16px' }}>
        {deltaPct < 0 ? '▼' : '▲'} {fmtPct(Math.abs(deltaPct), 1)} vs anterior
      </div>

      {/* LÍNEA SEMANAL */}
      <BloqueObjetivo
        etiqueta={fmtSemana(semanal.semanaNum, semanal.lunesSemana)}
        pct={pctSemanal}
        falta={semanal.valor - semanal.actual}
        objetivo={semanal.override_usuario ?? semanal.valor}
        objetivoBase={semanal.valor}
        tipo="semanal"
      />

      {/* LÍNEA MENSUAL */}
      <BloqueObjetivo
        etiqueta={fmtMes(mensual.mes)}
        pct={pctMensual}
        falta={mensual.valor - mensual.actual}
        objetivo={mensual.override_usuario ?? mensual.valor}
        objetivoBase={mensual.valor}
        tipo="mensual"
      />

      {/* LÍNEA ANUAL */}
      <BloqueObjetivo
        etiqueta={String(anual.año)}
        pct={pctAnual}
        falta={anual.valor - anual.actual}
        objetivo={anual.override_usuario ?? anual.valor}
        objetivoBase={anual.valor}
        tipo="anual"
      />
    </div>
  );
};

// Componente BloqueObjetivo (mismo archivo o /src/components/panel/resumen/BloqueObjetivo.tsx)
const BloqueObjetivo = ({ etiqueta, pct, falta, objetivo, objetivoBase, tipo }) => {
  return (
    <>
      <div style={{ fontFamily: 'Oswald', fontSize: 11, letterSpacing: 1.5, color: '#7a8090', textTransform: 'uppercase', fontWeight: 500, display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span>{etiqueta}</span>
        <span style={{ color: colorSemaforo(pct) }}>{fmtPct(pct, 0)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#7a8090', marginBottom: 6 }}>
        <span>Faltan</span>
        <span style={{ color: colorSemaforo(pct) }}>{fmtEur(falta, { showEuro: false })}</span>
        <span>de</span>
        <EditableInline
          valor={objetivo}
          valorBase={objetivoBase}
          tipo={tipo}
        />
      </div>
      <BarraCumplimiento pct={pct} />
      <div style={{ marginBottom: 14 }} />
    </>
  );
};
```

Componente `EditableInline`:
- Render: cifra con `border-bottom: 1px dashed #d0c8bc; cursor: text; color: #3a4050; padding: 0 2px`.
- Click → input number con valor actual.
- Enter / blur → `UPDATE objetivos SET override_usuario = nuevoValor`. Toast "Objetivo actualizado".
- Input vacío + Enter → `UPDATE objetivos SET override_usuario = NULL`. Toast "Objetivo restaurado".
- ESC → cancela.

PROHIBIDO: símbolo € en cualquier sitio de esta card.

Lectura objetivos desde Supabase:
```ts
const { data } = await supabase
  .from('objetivos')
  .select('valor, override_usuario, tipo, año, mes, semana')
  .eq('año', añoActual);

// Filtrar por tipo:
const semanal = data.find(d => d.tipo === 'semanal' && d.semana === semanaActual);
const mensual = data.find(d => d.tipo === 'mensual' && d.mes === mesActual);
const anual = data.find(d => d.tipo === 'anual');
```

---

# FIX 8 — CARD PEDIDOS · TM `/src/components/panel/resumen/CardPedidosTM.tsx`

REEMPLAZAR contenido. Datos:
- pedidos = INT total del periodo
- tmBruto = bruto / pedidos
- tmNeto = netoEstimado / pedidos
- desglose = [{ canal, pedidos, tmBruto, tmNeto, peso }] para los 5 canales

```tsx
<div style={cardBigStyle}>
  <div className="lbl">PEDIDOS · TM</div>
  
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, flexWrap: 'wrap', marginTop: 8 }}>
    <div>
      <div style={{ fontFamily: 'Oswald', fontSize: 38, fontWeight: 600, color: '#1E5BCC' }}>
        {fmtNum(pedidos, 0)}
      </div>
      <div style={{ fontFamily: 'Oswald', fontSize: 10, letterSpacing: 1.5, color: '#1E5BCC', textTransform: 'uppercase', fontWeight: 500 }}>
        PEDIDOS
      </div>
    </div>
    <div>
      <div style={{ fontFamily: 'Oswald', fontSize: 38, fontWeight: 600, color: '#F26B1F' }}>
        {fmtEur(tmBruto, { showEuro: true })}
      </div>
      <div style={{ fontFamily: 'Oswald', fontSize: 10, letterSpacing: 1.5, color: '#F26B1F', textTransform: 'uppercase', fontWeight: 500 }}>
        TM BRUTO
      </div>
    </div>
    <div>
      <div style={{ fontFamily: 'Oswald', fontSize: 38, fontWeight: 600, color: '#1D9E75' }}>
        {fmtEur(tmNeto, { showEuro: true })}
      </div>
      <div style={{ fontFamily: 'Oswald', fontSize: 10, letterSpacing: 1.5, color: '#1D9E75', textTransform: 'uppercase', fontWeight: 500 }}>
        TM NETO
      </div>
    </div>
  </div>

  <div style={{ fontSize: 12, color: '#E24B4A', margin: '8px 0 16px' }}>
    ▼ {fmtPct(deltaPedidosPct, 1)} pedidos · ▼ {fmtPct(deltaTmPct, 1)} TM vs anterior
  </div>

  {/* DESGLOSE 5 CANALES */}
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {canales.map(c => (
      <div key={c.canal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
          <span>● {labelCanal(c.canal)}</span>
          <span>
            <b style={{ color: '#1E5BCC', fontWeight: 500 }}>{fmtNum(c.pedidos, 0)}</b>
            {' · '}
            <span style={{ color: '#F26B1F' }}>{fmtEur(c.tmBruto, { showEuro: true })}</span>
            {' / '}
            <span style={{ color: '#1D9E75' }}>{fmtEur(c.tmNeto, { showEuro: true })}</span>
          </span>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: '#ebe8e2', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${c.peso}%`, background: COLOR_CANAL[c.canal] }} />
        </div>
      </div>
    ))}
  </div>
</div>
```

Constante COLOR_CANAL:
```ts
const COLOR_CANAL = {
  uber:     '#06C167',
  glovo:    '#e8f442',
  just_eat: '#f5a623',
  web:      '#B01D23',
  directa:  '#66aaff',
};
```

PROHIBIDO escribir "Ticket Medio" en ningún sitio.

---

# FIX 9 — CARD RESULTADO `/src/components/panel/resumen/CardResultadoPeriodo.tsx`

REEMPLAZAR contenido completo.

Datos desde tabla `running` del mes actual:
- ingresos_brutos
- comisiones_plataforma + iva_comisiones
- ingresos_netos
- producto
- margen_bruto
- personal
- local
- controlables
- ebitda
- provisiones_iva + provisiones_irpf
- resultado_limpio
- prime_cost_pct = ((producto + personal) / ingresos_netos) * 100

Si tabla `running` no tiene datos del mes: mostrar "Datos insuficientes" en cada línea.

Estructura:

```tsx
<div style={cardBigStyle}>
  <div className="lbl">RESULTADO</div>
  
  {/* EBITDA arriba con € */}
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap', marginTop: 8 }}>
    <div>
      <div style={{ fontFamily: 'Oswald', fontSize: 38, fontWeight: 600, color: ebitda >= 0 ? '#1D9E75' : '#E24B4A' }}>
        {fmtEur(ebitda, { showEuro: true })}
      </div>
      <div style={{ fontFamily: 'Oswald', fontSize: 10, letterSpacing: 1.5, color: ebitda >= 0 ? '#1D9E75' : '#E24B4A', textTransform: 'uppercase', fontWeight: 500 }}>
        EBITDA
      </div>
    </div>
    <div>
      <div style={{ fontFamily: 'Oswald', fontSize: 24, fontWeight: 600, color: ebitda >= 0 ? '#1D9E75' : '#E24B4A' }}>
        {fmtPct(ebitdaPct, 1)}
      </div>
      <div style={{ fontFamily: 'Oswald', fontSize: 10, letterSpacing: 1.5, color: ebitda >= 0 ? '#1D9E75' : '#E24B4A', textTransform: 'uppercase', fontWeight: 500 }}>
        % S/NETOS · BANDA 10-13%
      </div>
    </div>
  </div>

  <div style={{ fontSize: 12, color: deltaEbitdaPp >= 0 ? '#1D9E75' : '#E24B4A', margin: '10px 0 16px' }}>
    {deltaEbitdaPp >= 0 ? '▲' : '▼'} {fmtNum(Math.abs(deltaEbitdaPp), 1)} puntos porcentuales vs anterior
  </div>

  {/* CASCADA PYG — sin € en líneas */}
  <div style={{ borderTop: '0.5px solid #d0c8bc', paddingTop: 12 }}>
    <LineaPyG label="Ingresos brutos" tooltip="Facturación plataforma + venta directa" valor={ingresos_brutos} />
    <LineaPyG label="Comisiones + IVA" tooltip="Comisiones plataformas + 21% IVA sobre comisiones" valor={comisiones_plataforma + iva_comisiones} signo="-" />
    <LineaPyG label="Ingresos netos" tooltip="Lo que de verdad entra a Streat Lab" valor={ingresos_netos} bold />
    <LineaPyG label="Producto" tooltip="Food cost + bebida + packaging + mermas" valor={producto} signo="-" />
    <LineaPyG label="Margen bruto" valor={margen_bruto} bold />
    <LineaPyG label="Personal" tooltip="Sueldos + SS + sueldos socios" valor={personal} signo="-" />
    <LineaPyG label="Local + Controlables" tooltip="Alquiler+IRPF+suministros + marketing+software+gestoría+bancos+transporte+seguros" valor={local + controlables} signo="-" />
    <LineaPyG label="Provisiones" tooltip="Provisión IVA + IRPF" valor={provisiones_iva + provisiones_irpf} signo="-" />
    <LineaPyG label="Resultado limpio" tooltip="Lo que queda tras provisiones" valor={resultado_limpio} bold colorSiNeg />
  </div>

  {/* PRIME COST */}
  <div style={{ borderTop: '0.5px solid #d0c8bc', paddingTop: 12, marginTop: 12 }}>
    <div style={{ fontFamily: 'Oswald', fontSize: 11, letterSpacing: 1.5, color: '#7a8090', textTransform: 'uppercase', fontWeight: 500, display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
      <span title="COGS + Personal sobre netos. KPI hostelería.">PRIME COST</span>
      <span style={{ color: colorSemaforo(100 - primeCostPct) }}>{fmtPct(primeCostPct, 1)}</span>
    </div>
    <BarraCumplimiento pct={primeCostPct} />
    <div style={{ fontSize: 11, color: '#7a8090', display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
      <span>
        <span style={{ color: '#1D9E75' }}>Objetivo</span>
        {' '}
        <EditableInline valor={primeCostTarget} tabla="kpi_objetivos" campo="prime_cost_target" />
        %
      </span>
      <span style={{ color: primeCostPct <= primeCostTarget ? '#1D9E75' : '#E24B4A' }}>
        {primeCostPct <= primeCostTarget ? 'OK' : 'Alto'}
      </span>
    </div>
  </div>
</div>
```

Componente `LineaPyG`:
```tsx
const LineaPyG = ({ label, tooltip, valor, signo, bold, colorSiNeg }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    marginBottom: 4,
    fontWeight: bold ? 500 : 400,
  }}>
    <span style={{ color: '#7a8090' }} title={tooltip}>{label}</span>
    <span style={{
      color: colorSiNeg && valor < 0 ? '#E24B4A' :
             colorSiNeg && valor > 0 ? '#1D9E75' :
             '#3a4050'
    }}>
      {signo === '-' ? '−' : ''}{fmtEur(valor, { showEuro: false })}
    </span>
  </div>
);
```

ELIMINAR del componente actual:
- Texto "Banda sector 55-65%" → reemplazado por "Objetivo {editable}%"
- Líneas "Netos estimados", "Netos reales factura", "Total gastos periodo", "Resultado limpio" como están actualmente → reemplazado por cascada completa de arriba

PROHIBIDO símbolo € fuera del bloque EBITDA arriba.

---

# FIX 10 — `/src/components/panel/resumen/ColFacturacionCanal.tsx`

REEMPLAZAR contenido. Estructura cada card:

```tsx
const CARD_CANAL_STYLE = {
  uber:     { bg: '#06C16720', border: '0.5px solid #06C167', borderWidth: '0.5px', text: '#0F6E56', textBold: '#0F6E56' },
  glovo:    { bg: '#e8f44230', border: '1px solid #5a5500',   borderWidth: '1px',   text: '#5a5500', textBold: '#3a3a00' },
  just_eat: { bg: '#f5a62320', border: '0.5px solid #f5a623', borderWidth: '0.5px', text: '#854F0B', textBold: '#854F0B' },
  web:      { bg: '#B01D2310', border: '0.5px solid #B01D2350', borderWidth: '0.5px', text: '#791F1F', textBold: '#791F1F' },
  directa:  { bg: '#66aaff20', border: '0.5px solid #66aaff',  borderWidth: '0.5px', text: '#185FA5', textBold: '#185FA5' },
};

// Card grande (Uber/Glovo/JustEat)
<div style={{
  background: estilo.bg,
  border: estilo.border,
  borderRadius: 14,
  padding: '14px 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
}}>
  <div>
    <div style={{ fontFamily: 'Oswald', fontSize: 11, letterSpacing: 1.5, color: estilo.text, textTransform: 'uppercase', fontWeight: 500 }}>
      {labelCanal}
    </div>
    <div style={{ fontFamily: 'Oswald', fontSize: 24, fontWeight: 600, color: estilo.textBold, marginTop: 4 }}>
      {fmtEur(bruto, { showEuro: false })}
    </div>
    <div style={{ fontSize: 11, color: estilo.text }}>Bruto</div>
  </div>
  <div style={{ textAlign: 'right' }}>
    <div style={{ fontFamily: 'Oswald', fontSize: 24, fontWeight: 600, color: '#1D9E75' }}>
      {fmtEur(neto, { showEuro: false })}
    </div>
    <div style={{ fontSize: 11, color: '#1D9E75' }}>Neto real</div>
    <div style={{ fontSize: 13, color: '#1D9E75', marginTop: 4, fontWeight: 500 }}>
      Margen {fmtPct(margenPct, 2)}
    </div>
  </div>
</div>
```

Cambios literales vs versión actual:
- Glovo: `border: '1px solid #5a5500'` (era `0.5px solid #e8f442` invisible)
- Bruto y Neto de cada card: `fontSize: 24` (eran 22 y 18 distintos). AHORA MISMO TAMAÑO
- "Bruto" capitalizado (era "bruto")
- "Neto real" capitalizado (era "neto real")
- Margen: `fmtPct(margenPct, 2)` con 2 decimales
- Eliminar texto "ADS · X €" si lo hay

Cálculo neto canal real desde tabla `resumenes_plataforma_marca_mensual`:
```ts
const datosCanal = await supabase
  .from('resumenes_plataforma_marca_mensual')
  .select('bruto, comisiones, fees, cargos_promocion, neto_real_cobrado')
  .eq('plataforma', canal)
  .eq('mes', mesActual)
  .eq('año', añoActual);

const bruto = sum(datosCanal.map(d => d.bruto));

// Si hay neto_real_cobrado en BD usar ese, sino calcular
const tieneRealCobrado = datosCanal.some(d => d.neto_real_cobrado !== null);
let neto;
if (tieneRealCobrado) {
  neto = sum(datosCanal.map(d => d.neto_real_cobrado ?? 0));
} else {
  const comisiones = sum(datosCanal.map(d => d.comisiones));
  const fees = sum(datosCanal.map(d => d.fees));
  const cargos = sum(datosCanal.map(d => d.cargos_promocion ?? 0));
  const ivaComisiones = (comisiones + fees + cargos) * 0.21;
  neto = bruto - comisiones - fees - cargos - ivaComisiones;
}

const margenPct = bruto > 0 ? (neto / bruto) * 100 : 0;
```

Si Just Eat tiene datos en BD pero no se mostraban antes, ahora debe mostrarse correctamente con sus datos reales.

PROHIBIDO símbolo € en bruto/neto.

---

# FIX 11 — `/src/components/panel/resumen/ColGruposGasto.tsx`

REEMPLAZAR contenido. 4 cards en orden EXACTO:

1. PRODUCTO · COGS
2. EQUIPO · LABOR
3. LOCAL · OCCUPANCY
4. CONTROLABLES · OPEX

Datos:
- consumido (sin IVA) desde tabla `running` mes actual
- presupuesto = (ingresos_netos * pct_grupo) si NO hay override en `kpi_objetivos`
- consumoPct = (consumido / presupuesto) * 100
- desviacion = consumido - presupuesto

Porcentajes default:
- producto: 30
- personal (equipo): 40
- local: 15
- controlables: 15

Estructura cada card:

```tsx
<div style={{
  background: '#fff',
  border: '0.5px solid #d0c8bc',
  borderRadius: 14,
  padding: '14px 16px',
}}>
  {/* CABECERA */}
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
    <div style={{ fontFamily: 'Oswald', fontSize: 11, letterSpacing: 1.5, color: '#7a8090', textTransform: 'uppercase', fontWeight: 500 }}>
      {NOMBRE_GRUPO}
    </div>
    {/* SOLO PRODUCTO muestra Food Cost */}
    {grupo === 'producto' && (
      <div style={{ fontSize: 11, color: '#1D9E75', fontWeight: 500 }}>
        Food Cost <span>{fmtPct(foodCostPct, 0)}</span>
      </div>
    )}
    {/* RESTO: nada en cabecera derecha */}
  </div>

  {/* VALORES */}
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6 }}>
    <div>
      <span style={{ fontFamily: 'Oswald', fontSize: 22, fontWeight: 600 }}>
        {fmtEur(consumido, { showEuro: true })}
      </span>
      <span style={{ fontSize: 13, color: '#7a8090' }}>
        {' / '}
        <EditableInline valor={presupuesto} tabla="kpi_objetivos" campo={`presupuesto_${grupo}`} unidad="€" />
      </span>
    </div>
    <div style={{ fontSize: 13, color: colorSemaforo(100 - Math.min(consumoPct, 100)), fontWeight: 500 }}>
      {fmtPct(consumoPct, 0)}
    </div>
  </div>

  {/* BARRA */}
  <div style={{ margin: '8px 0 4px' }}>
    <BarraCumplimiento pct={consumoPct} presupuesto={presupuesto} />
  </div>

  {/* LÍNEA INFERIOR */}
  <div style={{ fontSize: 11, color: '#7a8090', display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
    {/* OBJETIVO % editable inline (NO "Banda XX-XX%") */}
    <span>
      Objetivo{' '}
      <EditableInline
        valor={pctObjetivo}
        tabla="kpi_objetivos"
        campo={`presupuesto_${grupo}_pct`}
        unidad="%"
      />
    </span>
    {/* DESVIACIÓN sin €, signo coherente */}
    <span style={{ color: desviacion < 0 ? '#1D9E75' : '#E24B4A' }}>
      {desviacion < 0 ? '' : '+'}{fmtNum(desviacion, 2)} desv
    </span>
  </div>
</div>
```

Cambios literales:
- Símbolo € EN VALOR CONSUMIDO Y PRESUPUESTO (sí, en este card sí)
- Sin símbolo € en desviación
- ELIMINAR la cabecera derecha "% s/netos X%" en EQUIPO, LOCAL, CONTROLABLES
- ELIMINAR "Banda 25-30%" texto, sustituir por "Objetivo {pct}%" editable
- Aplicar BarraCumplimiento estilo Objetivos
- Decimales 2 en consumido, presupuesto y desviación

Lectura datos:
```ts
const running = await supabase.from('running').select('*').eq('año', año).eq('mes', mes).single();
const kpiObj = await supabase.from('kpi_objetivos').select('*').single();

const grupos = [
  {
    grupo: 'producto',
    NOMBRE_GRUPO: 'PRODUCTO · COGS',
    consumido: running?.producto ?? null,
    pctObjetivo: kpiObj?.presupuesto_producto_pct ?? 30,
    foodCostPct: running ? (running.producto / running.ingresos_netos) * 100 : null,
  },
  {
    grupo: 'personal',
    NOMBRE_GRUPO: 'EQUIPO · LABOR',
    consumido: running?.personal ?? null,
    pctObjetivo: kpiObj?.presupuesto_personal_pct ?? 40,
  },
  {
    grupo: 'local',
    NOMBRE_GRUPO: 'LOCAL · OCCUPANCY',
    consumido: running?.local ?? null,
    pctObjetivo: kpiObj?.presupuesto_local_pct ?? 15,
  },
  {
    grupo: 'controlables',
    NOMBRE_GRUPO: 'CONTROLABLES · OPEX',
    consumido: running?.controlables ?? null,
    pctObjetivo: kpiObj?.presupuesto_controlables_pct ?? 15,
  },
];

// Para cada grupo:
const presupuesto = running ? (running.ingresos_netos * pctObjetivo / 100) : null;
const consumoPct = presupuesto > 0 ? (consumido / presupuesto) * 100 : 0;
const desviacion = consumido - presupuesto;
```

Si `running` es null o sin datos: mostrar "Datos insuficientes" en consumido y presupuesto.

---

# FIX 12 — `/src/components/panel/resumen/ColDiasPico.tsx`

REEMPLAZAR contenido.

Estructura:

```tsx
<div className="lbl">DÍAS PICO — {fmtMes(mesActual)} - Facturación Bruta</div>

<svg viewBox="0 0 480 230" style={{ width: '100%', height: 'auto' }} fontFamily="Lexend, sans-serif">
  {/* Línea media dashed visible */}
  <line
    x1="15" y1={yMedia}
    x2="445" y2={yMedia}
    stroke="#3a4050"
    strokeDasharray="6 4"
    strokeWidth="1.5"
  />
  <text
    x="445" y={yMedia - 6}
    fontSize="11"
    fill="#3a4050"
    fontWeight="500"
    textAnchor="end"
  >
    Media: {fmtNum(mediaSemanal, 2)}
  </text>

  {/* Etiquetas valor encima de cada barra — TODAS MISMO TAMAÑO */}
  {dias.map((d, i) => (
    <text
      key={`v-${d.dia}`}
      x={X_BARRA[i] + 20}
      y="20"
      fontSize="11"
      fill="#7a8090"
      textAnchor="middle"
    >
      {fmtNum(d.facturacion, 2)}
    </text>
  ))}

  {/* Barras */}
  {dias.map((d, i) => (
    <rect
      key={`r-${d.dia}`}
      x={X_BARRA[i]}
      y={190 - (d.facturacion / max) * 125}
      width={40}
      height={(d.facturacion / max) * 125}
      fill={COLOR_DIA[d.dia]}
      rx={2}
    />
  ))}

  {/* Etiquetas día */}
  {dias.map((d, i) => (
    <text
      key={`d-${d.dia}`}
      x={X_BARRA[i] + 20}
      y="210"
      fontSize="12"
      fill="#7a8090"
      textAnchor="middle"
    >
      {labelDia(d.dia)}
    </text>
  ))}
</svg>

{/* Bloque inferior — sin "RESUMEN" */}
<div style={{ borderTop: '0.5px solid #d0c8bc', marginTop: 14, paddingTop: 12 }}>
  <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
    <span style={{ color: '#7a8090' }}>Día más fuerte</span>
    <span style={{ color: '#3a4050', fontWeight: 500 }}>
      {labelDia(diaFuerte)} · {fmtNum(valorDiaFuerte, 2)}
    </span>
  </div>
  <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
    <span style={{ color: '#7a8090' }}>Día más flojo</span>
    <span style={{ color: '#3a4050' }}>
      {labelDia(diaFlojo)} · {fmtNum(valorDiaFlojo, 2)}
    </span>
  </div>
  <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
    <span style={{ color: '#7a8090' }}>Media diaria</span>
    <span style={{ color: '#3a4050' }}>{fmtNum(mediaSemanal, 2)}</span>
  </div>
</div>
```

Constante COLOR_DIA:
```ts
const COLOR_DIA = {
  lun: '#1E5BCC',
  mar: '#06C167',
  mie: '#f5a623',
  jue: '#B01D23',
  vie: '#66aaff',
  sab: '#F26B1F',
  dom: '#1D9E75',
};

const X_BARRA = [15, 80, 145, 210, 275, 340, 405];
```

Datos REALES desde `facturacion_diaria` agrupada por DOW del mes seleccionado:
```ts
const dias = await supabase
  .from('facturacion_diaria')
  .select('fecha, bruto')
  .gte('fecha', `${año}-${mes}-01`)
  .lt('fecha', primerDiaMesSiguiente);

// Agrupar por día de la semana, sumar
```

Si no hay datos: SVG con barras altura 0 + texto "Datos insuficientes".

Línea media MUY VISIBLE: `stroke="#3a4050"` color oscuro, `strokeWidth="1.5"`, `strokeDasharray="6 4"`.

---

# FIX 13 — `/src/components/panel/resumen/CardSaldo.tsx`

REEMPLAZAR contenido.

Renombrar título:
- ANTES: "SALDO + PROYECCIÓN"
- DESPUÉS: "PROYECCIONES"

Lectura saldo:
```ts
const cuentas = await supabase
  .from('cuentas_bancarias')
  .select('saldo_actual, fecha_ultimo_extracto')
  .eq('titular', 'streat_lab')
  .eq('activa', true);

const saldoTotal = sum(cuentas.map(c => c.saldo_actual ?? 0));
const fechaUltimo = max(cuentas.map(c => c.fecha_ultimo_extracto));
```

Si tabla vacía: mostrar "Datos insuficientes" en valor saldo. Si fechaUltimo > 7 días: warning ámbar "Último extracto {X} días".

Estructura:

```tsx
<div style={cardStdStyle}>
  <div className="lbl-sm">PROYECCIONES</div>
  
  {/* SALDO */}
  <div style={{ fontFamily: 'Oswald', fontSize: 26, fontWeight: 600, marginTop: 6 }}>
    {fmtEur(saldoTotal, { showEuro: true })}
  </div>
  <div style={{ fontSize: 11, color: '#7a8090' }} title="Suma del saldo actual de las cuentas bancarias de Streat Lab">
    Saldo cuentas Streat Lab
  </div>

  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 14, paddingTop: 10, borderTop: '0.5px solid #d0c8bc' }}>
    <span style={{ color: '#7a8090' }}>Cobros 7d</span>
    <span style={{ color: '#1D9E75' }}>+{fmtEur(cobros7d, { showEuro: false })}</span>
  </div>
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
    <span style={{ color: '#7a8090' }}>Pagos 7d</span>
    <span style={{ color: '#E24B4A' }}>−{fmtEur(pagos7d, { showEuro: false })}</span>
  </div>
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 500, marginTop: 6 }}>
    <span>Proyección 7d</span>
    <span>{fmtEur(saldoTotal + cobros7d - pagos7d, { showEuro: false })}</span>
  </div>

  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 8 }}>
    <span style={{ color: '#7a8090' }}>Cobros 30d</span>
    <span style={{ color: '#1D9E75' }}>+{fmtEur(cobros30d, { showEuro: false })}</span>
  </div>
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
    <span style={{ color: '#7a8090' }}>Pagos 30d</span>
    <span style={{ color: '#E24B4A' }}>−{fmtEur(pagos30d, { showEuro: false })}</span>
  </div>
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 500, marginTop: 6 }}>
    <span>Proyección 30d</span>
    <span>{fmtEur(saldoTotal + cobros30d - pagos30d, { showEuro: false })}</span>
  </div>

  {/* NO BARRA Hoy→30d (eliminada) */}
</div>
```

Cálculos:

```ts
// Cobros 7d/30d: estimación según ciclos pago plataforma
async function calcularCobrosEstimados(dias: number) {
  const hoy = new Date();
  const limite = new Date(hoy.getTime() + dias * 86400000);
  
  // Lee facturas plataforma con neto_real_cobrado o estimar desde resumen
  const facturas = await supabase
    .from('resumenes_plataforma_marca_mensual')
    .select('plataforma, bruto, neto_real_cobrado, año, mes')
    .lte('año', hoy.getFullYear())
    .lte('mes', hoy.getMonth() + 1);
  
  let total = 0;
  for (const f of facturas) {
    // Si neto_real_cobrado existe → usar real
    // Si no existe → estimar
    const importe = f.neto_real_cobrado ?? estimarNeto(f);
    
    // Calcular fecha cobro estimada según plataforma:
    // Uber: lunes próximo a cierre semana
    // Glovo 1-15: día 5 mes siguiente
    // Glovo 16-fin: día 20 mes siguiente
    // Just Eat 1-15: día 20 mismo mes
    // Just Eat 16-fin: día 5 mes siguiente
    const fechaCobro = calcularFechaCobro(f);
    
    if (fechaCobro >= hoy && fechaCobro <= limite) {
      total += importe;
    }
  }
  
  return total;
}

async function calcularPagos(dias: number) {
  const hoy = new Date();
  const limite = new Date(hoy.getTime() + dias * 86400000);
  
  const fijos = await supabase
    .from('gastos_fijos')
    .select('importe')
    .gte('proxima_fecha_pago', hoy.toISOString().slice(0,10))
    .lte('proxima_fecha_pago', limite.toISOString().slice(0,10));
  
  return sum(fijos.map(f => f.importe));
}
```

ELIMINAR completamente la barra "Hoy → 30d" del componente actual.

---

# FIX 14 — `/src/components/panel/resumen/CardRatio.tsx`

REEMPLAZAR contenido.

```tsx
<div style={cardStdStyle}>
  {/* CABECERA */}
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
    <div className="lbl-sm" title="Euros que entran por cada euro de gasto. Mayor es mejor.">
      RATIO INGRESOS / GASTOS ⓘ
    </div>
    <div style={{ fontSize: 11, color: '#1D9E75', display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ color: '#1D9E75' }}>Objetivo</span>
      <EditableInline
        valor={ratioTarget}
        tabla="kpi_objetivos"
        campo="ratio_target"
        decimales={2}
        color="#1D9E75"
      />
    </div>
  </div>

  {/* COEFICIENTE GRANDE */}
  <div style={{ fontFamily: 'Oswald', fontSize: 38, fontWeight: 600, color: colorSemaforo((ratio / ratioTarget) * 100), marginTop: 6 }}>
    {fmtNum(ratio, 2)}
  </div>

  {/* DESVIACIÓN INMEDIATAMENTE BAJO */}
  <div style={{ marginTop: 6, marginBottom: 12 }}>
    <BarraCumplimiento pct={(ratio / ratioTarget) * 100} altura={6} />
    <div style={{ fontSize: 11, color: colorSemaforo((ratio / ratioTarget) * 100), marginTop: 4 }}>
      {ratio < ratioTarget ? '▼' : '▲'} {fmtPct(Math.abs((ratio / ratioTarget - 1) * 100), 0)} {ratio < ratioTarget ? 'bajo' : 'sobre'} objetivo
    </div>
  </div>

  {/* LÍNEAS DETALLE */}
  <div style={{ borderTop: '0.5px solid #d0c8bc', paddingTop: 10 }}>
    <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: '#7a8090' }}>Ingresos netos</span>
      <span>{fmtEur(ingresosNetos, { showEuro: false })}</span>
    </div>
    <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
      <span style={{ color: '#7a8090' }} title="Gastos fijos conocidos: alquiler, SS, nóminas, etc.">Gastos fijos</span>
      <span>{fmtEur(gastosFijos, { showEuro: false })}</span>
    </div>
    <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: '#7a8090' }} title="Gastos variables que cambian mes a mes">Gastos reales</span>
      <span>{fmtEur(gastosVariables, { showEuro: false })}</span>
    </div>
  </div>
</div>
```

Cálculos:
```ts
const running = await supabase.from('running').select('*').eq('año', año).eq('mes', mes).single();
const kpi = await supabase.from('kpi_objetivos').select('ratio_target').single();

const ingresosNetos = running?.ingresos_netos ?? 0;
const gastosFijos = running?.gastos_fijos_periodo ?? 0;
const gastosVariables = running?.gastos_variables_periodo ?? 0;
const ratio = (gastosFijos + gastosVariables) > 0 ? ingresosNetos / (gastosFijos + gastosVariables) : 0;
const ratioTarget = kpi?.ratio_target ?? 2.50;
```

Si running null: "Datos insuficientes" en cifras y ratio.

ELIMINAR del componente actual:
- Líneas "Netos estimados" / "Netos reales factura"
- La barra "Distancia al objetivo" del bloque inferior (movida arriba bajo el coeficiente)
- Texto "obj" → "Objetivo" verde
- Texto "% del objetivo" actual → desviación con flecha bajo coeficiente

---

# FIX 15 — `/src/components/panel/resumen/CardPE.tsx`

REEMPLAZAR contenido.

```tsx
<div style={cardStdStyle}>
  <div className="lbl-sm" title="Momento del periodo en que la facturación real cubre la suma de gastos fijos + variables + provisiones de impuestos.">
    PUNTO DE EQUILIBRIO ⓘ
  </div>
  
  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
    <div>
      <div style={{ fontFamily: 'Oswald', fontSize: 22, fontWeight: 600 }}>
        {fmtEur(brutoNecesario, { showEuro: true })}
      </div>
      <div style={{ fontSize: 11, color: '#7a8090' }}>Bruto necesario</div>
    </div>
    <div style={{ fontFamily: 'Oswald', fontSize: 18, fontWeight: 600, color: colorSemaforo(pct) }}>
      {fmtPct(pct, 2)}
    </div>
  </div>

  <div style={{ margin: '10px 0 4px' }}>
    <BarraCumplimiento pct={pct} />
  </div>
  <div style={{ fontSize: 11, color: '#7a8090', display: 'flex', justifyContent: 'space-between' }}>
    <span>Llevamos {fmtEur(facturadoActual, { showEuro: false })}</span>
    <span>Faltan {fmtEur(Math.max(brutoNecesario - facturadoActual, 0), { showEuro: false })}</span>
  </div>

  <div style={{ marginTop: 14, paddingTop: 10, borderTop: '0.5px solid #d0c8bc' }}>
    {/* Día verde estimado */}
    <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <span style={{ color: '#7a8090' }}>Día verde estimado</span>
      <span style={{ color: '#1D9E75', fontWeight: 500 }}>
        {textoDiaVerde}
      </span>
    </div>

    {/* Facturación día / TM */}
    <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: '#7a8090' }}>Pedidos día / TM</span>
      <span style={{ fontWeight: 500 }}>
        <span style={{ color: '#1E5BCC' }}>{fmtNum(pedidosDiaNecesarios, 0)}</span>
        {' / '}
        <span style={{ color: '#F26B1F' }}>{fmtEur(tmActual, { showEuro: false, decimals: 2 })}</span>
      </span>
    </div>

    {/* Realidad hoy */}
    <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginTop: 6, color: '#7a8090' }} title="Lo que estamos facturando de media diaria en el periodo seleccionado">
      <span>Realidad hoy</span>
      <span>
        {fmtEur(facturacionDiaActual, { showEuro: false })}/día · {fmtNum(pedidosDiaActual, 0)} ped/día
      </span>
    </div>
  </div>
</div>
```

Lógica `textoDiaVerde`:
```ts
let textoDiaVerde;
const diasMes = diasEnMes(año, mes);
const hoy = new Date();
const diaActual = hoy.getDate();

if (pct >= 100) {
  textoDiaVerde = `Alcanzado · día ${diaAlcanzado}`;
} else if (diaVerdeEstimado <= diasMes) {
  textoDiaVerde = `Día ${diaVerdeEstimado}`;
} else {
  // Pasa del mes
  const diasExtra = diaVerdeEstimado - diasMes;
  textoDiaVerde = `+${diasExtra}d sobre mes`;
}
```

Cálculos:
```ts
const brutoNecesario = (gastosFijos + gastosVariables + provisionesImpuestos) / margenNetoMedio;
const pct = facturadoActual > 0 ? (facturadoActual / brutoNecesario) * 100 : 0;
const facturacionDiaNecesaria = brutoNecesario / diasMes;
const pedidosDiaNecesarios = tmActual > 0 ? facturacionDiaNecesaria / tmActual : 0;
const diaVerdeEstimado = facturadoActual > 0 ? Math.ceil(brutoNecesario / (facturadoActual / diaActual)) : null;
```

Cambios literales vs versión actual:
- "9.610 € netos" → ELIMINADO
- "Bruto necesario" con B mayúscula
- "Día verde estimado · Alcanzado" → texto dinámico ("Día N" o "+Nd sobre mes")
- "Facturación día" / "Pedidos día" → unificado a una sola línea "Pedidos día / TM"
- "Real actual" → "Realidad hoy"
- TM con 2 decimales y color naranja
- Pedidos en azul
- Símbolo € SOLO en "Bruto necesario" (arriba), resto sin €
- Pct con 2 decimales

---

# FIX 16 — `/src/components/panel/resumen/CardProvisiones.tsx`

REEMPLAZAR contenido.

```tsx
<div style={cardStdStyle}>
  <div className="lbl-sm">PROVISIONES Y PRÓXIMOS PAGOS</div>
  
  <div style={{ marginTop: 8 }}>
    <div style={{ fontFamily: 'Oswald', fontSize: 24, fontWeight: 600 }}>
      {fmtEur(totalProvisiones, { showEuro: false })}
    </div>
    <div style={{ fontSize: 11, color: '#7a8090' }}>Total</div>
  </div>

  <div style={{ marginTop: 14, fontSize: 12, color: '#3a4050', display: 'flex', flexDirection: 'column', gap: 6 }}>
    {pagosProximos.length === 0 ? (
      <div style={{ color: '#7a8090', fontStyle: 'italic' }}>Datos insuficientes</div>
    ) : pagosProximos.map((p, idx) => (
      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#7a8090' }}>{p.concepto} ({fmtFechaCorta(p.fecha)})</span>
        <span>{fmtEur(p.importe, { showEuro: false })}</span>
      </div>
    ))}
  </div>
</div>
```

Lectura datos:
```ts
const hoy = new Date();
const limite30d = new Date(hoy.getTime() + 30 * 86400000);

const pagosProximos = await supabase
  .from('gastos_fijos')
  .select('concepto, proxima_fecha_pago, importe, categoria')
  .gte('proxima_fecha_pago', hoy.toISOString().slice(0,10))
  .lte('proxima_fecha_pago', limite30d.toISOString().slice(0,10))
  .order('proxima_fecha_pago', { ascending: true });

const totalProvisiones = sum(pagosProximos.map(p => p.importe));
```

Categorías reales que deben aparecer si están en BD:
- "IRPF alquiler"
- "IRPF empleado"
- "Cuota Régimen General SS"
- (otras gastos fijos)

PROHIBIDO inventar categorías. Si BD solo tiene 1 fila → mostrar 1 fila.

Cambios literales:
- ELIMINAR símbolo € en TODAS las cifras
- ELIMINAR "187 € + 178 €" (badge derecha)
- "A guardar este mes" → "Total"
- Decimales 2

---

# FIX 17 — LAYOUT TabResumen `/src/components/panel/resumen/TabResumen.tsx`

ANCHO de cada tercio en fila 4:

ANTES (probablemente):
```tsx
<div style={{ gridTemplateColumns: '1fr 1fr' }}>
  <CardProvisiones />
  <CardTopVentas />
</div>
```

DESPUÉS — Provisiones ocupa 1/3, Top Ventas ocupa 2/3:
```tsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
  <CardProvisiones />
  <CardTopVentas />
</div>
```

VERIFICAR que `CardPendientesSubir` NO se renderiza en `TabResumen.tsx`. Si está, eliminar import + uso.

---

# FIX 18 — CARD Top Ventas DATOS REALES

`/src/components/panel/resumen/CardTopVentas.tsx`

Si actualmente muestra "datos demo" con badge → ELIMINAR badge.

Lectura datos reales:
```ts
const top = await supabase
  .from('ventas_plataforma')  // o tabla equivalente con productos vendidos
  .select('producto, plataforma, cantidad, importe')
  .eq('año', año)
  .eq('mes', mes)
  .order('importe', { ascending: false })
  .limit(5);
```

Si tabla vacía: "Sin datos POS" (texto actual OK).

ELIMINAR badge "datos demo" amarillo si existe.

---

# CRITERIOS DE ACEPTACIÓN

1. Todos los números del Panel usan `fmtEur` o `fmtPct` o `fmtNum` con 2 decimales por defecto
2. Símbolo € SOLO en:
   - Card RESULTADO: cifra grande EBITDA arriba
   - Cards GRUPOS DE GASTO: consumido y presupuesto
   - Card PROYECCIONES: saldo cuentas Streat Lab
   - Card PUNTO EQUILIBRIO: bruto necesario
   - Resto: sin €
3. Card Facturación renombrada (sublabel "FACTURACIÓN")
4. Cifra Bruto color `#111111`, cifra Neto color `#1D9E75`, AMBAS fontSize 38
5. Etiquetas líneas: "S{N}_{DD}_{MM}_{YY}" / "Abril" / "2026"
6. Cantidades editables vienen de tabla `objetivos`, override usuario respetado
7. Card Pedidos·TM: 3 cifras al mismo fontSize 38, colores azul/naranja/verde
8. Card Resultado: cascada PyG completa con 9 líneas + tooltips
9. Card Resultado: "Banda sector 55-65%" → "Objetivo {pct}%" editable inline en verde
10. Cards Plataforma: Glovo con border 1px solid #5a5500
11. Cards Plataforma: Bruto y Neto MISMO TAMAÑO fontSize 24
12. Cards Plataforma: "Margen {XX,XX}%" con 2 decimales
13. Cards Grupo de gasto: Solo Producto muestra "Food Cost X%" en cabecera derecha
14. Cards Grupo de gasto: BarraCumplimiento estilo Objetivos (amarillo<50, verde≥50)
15. Cards Grupo de gasto: Línea inferior "Objetivo {pct}%" editable, sin "Banda XX-XX%"
16. Cards Grupo de gasto: Local con presupuesto 0 → barra vacía (no roja al 100%)
17. Card Días Pico: título "{Mes} - Facturación Bruta", línea media visible con valor
18. Card Días Pico: TODOS los valores encima de barras mismo fontSize 11
19. Card Saldo: título "PROYECCIONES" (no "SALDO + PROYECCIÓN")
20. Card Saldo: ELIMINADA barra "Hoy → 30d"
21. Card Ratio: "obj" → "Objetivo" en verde, editable
22. Card Ratio: desviación bajo coeficiente con BarraCumplimiento, no en bloque inferior
23. Card PE: "Bruto necesario" con B mayúscula, sin "9.610 € netos"
24. Card PE: "Día verde estimado" texto dinámico (Día N o +Nd sobre mes)
25. Card PE: una línea unificada "Pedidos día / TM" con pedidos azul + TM naranja
26. Card PE: "Real actual" → "Realidad hoy"
27. Card Provisiones: ancho 1/3 (Top Ventas 2/3)
28. Card Provisiones: sin €, datos reales o "Datos insuficientes"
29. Card Top Ventas: badge "datos demo" eliminado
30. Banner amarillo `padding: '6px 14px'`, fontSize 12
31. Marco tabs `padding: '4px 6px'`, borderRadius 10
32. Dropdowns con `<ChevronDown size={11} strokeWidth={2.5} />` en TODOS
33. Dropdown Marcas items `padding: '3px 8px'`, fontSize 12
34. BarraCumplimiento aplica lógica amarillo/verde según pct
35. BarraCumplimiento con `presupuesto={0}` → barra vacía gris
36. Mobile validado 375/768/1280 con capturas
37. Build TypeScript OK sin errores
38. Deploy Vercel automático con URL al final

---

# DECISIONES AUTÓNOMAS

PERMITIDO Code decidir:
1. Nombres internos de variables/funciones helper
2. Orden imports
3. Iconos Lucide equivalentes si el especificado no existe (mantener tamaño 11/14)
4. Refactor menor que no cambie comportamiento visible

OBLIGADO Code preguntar antes de:
1. Si una tabla Supabase no existe y schema en este spec parece insuficiente
2. Si dos rutas de archivo entran en conflicto
3. Si un valor literal del spec parece typo

PROHIBIDO Code:
1. Cambiar tamaños/colores/paddings del spec
2. Improvisar fórmulas de cálculo
3. Inventar datos para "rellenar visual"
4. Mantener helpers locales redundantes con `/src/lib/format.ts`

---

# ORDEN DE EJECUCIÓN

EN ORDEN, SIN PARAR. Commit por bloque + push:

1. FIX 1 — helpers `/src/lib/format.ts` → commit
2. FIX 2 — `/src/components/ui/BarraCumplimiento.tsx` → commit
3. FIX 3 — `/src/components/ui/BannerPendientes.tsx` → commit
4. FIX 4 — DropdownButton + grep `▾` global → commit
5. FIX 5 — TabsPastilla container styles → commit
6. FIX 6 — DropdownMarcas items compactos → commit
7. FIX 7 — CardVentas (Facturación) → commit
8. FIX 8 — CardPedidosTM → commit
9. FIX 9 — CardResultadoPeriodo → commit
10. FIX 10 — ColFacturacionCanal → commit
11. FIX 11 — ColGruposGasto → commit
12. FIX 12 — ColDiasPico → commit
13. FIX 13 — CardSaldo → commit
14. FIX 14 — CardRatio → commit
15. FIX 15 — CardPE → commit
16. FIX 16 — CardProvisiones → commit
17. FIX 17 — TabResumen layout → commit
18. FIX 18 — CardTopVentas → commit
19. Validación mobile 375/768/1280 + capturas → commit
20. Deploy Vercel + URL en `.claude/tracking/informe-fixes-panel-ronda2.md`

NO PARAR ENTRE FIXES. NO PREGUNTAR. Si tabla Supabase falta: crearla con schema del spec y continuar.

Tras último fix: deploy Vercel automático y avisar URL.
