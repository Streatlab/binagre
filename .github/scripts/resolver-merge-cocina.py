# Resuelve los 5 conflictos conocidos del merge Tanda Cocina <- trabajo (Equipo QA + B6)
# Union validada en local: tsc + 291 tests + build verdes (22-jul-2026).
import re, sys

def resolve(path, fn):
    t = open(path, encoding='utf-8').read()
    n = {'i': 0}
    def rep(m):
        n['i'] += 1
        return fn(n['i'], m.group(1), m.group(2))
    t2 = re.sub(r'<<<<<<<[^\n]*\n(.*?)\n=======\n(.*?)\n>>>>>>>[^\n]*', rep, t, flags=re.S)
    assert '<<<<<<<' not in t2, path
    open(path, 'w', encoding='utf-8').write(t2)
    print('resuelto', path, n['i'], 'conflictos')

B6 = ('          {/* B6 · Plato maestro: catálogo, alias, fusiones (acceso por paleta) */}\n'
      '          <Route path="cocina/platos-maestros" element={<ProtectedRoute solo={[\'admin\']}><PlatosMaestros /></ProtectedRoute>} />\n')

def app(i, ours, theirs):
    if i == 1:
        return ours + '\n' + theirs      # union de imports (B6 + Hoy/PlatoMaestro)
    return theirs                        # rutas: gana la estructura de la tanda
resolve('src/App.tsx', app)

# Recolocar la ruta B6 en un punto valido del arbol de rutas
t = open('src/App.tsx', encoding='utf-8').read()
ancla = '          {/* ── Bloque 4 · 🍳 Cocina · Operativa (admin + cocina) ── */}'
assert ancla in t and 'cocina/platos-maestros' not in t
t = t.replace(ancla, B6 + '\n' + ancla)
open('src/App.tsx', 'w', encoding='utf-8').write(t)

def pal(i, ours, theirs):
    return theirs + "\n  { label: 'Catálogo de platos (alias)', path: '/cocina/platos-maestros', group: 'Cocina' },"
resolve('src/components/CommandPalette.tsx', pal)

resolve('src/components/Sidebar.tsx', lambda i, o, t: t)

def modal(i, ours, theirs):
    if i == 1:
        return ('      const record = { nombre, elaboracion: elaboracion.trim() || null, categoria: categoria || null, '
                'raciones, tamano_rac: tamanoRac || null, unidad: unidad || null, fecha: isDirty ? todayISO : (fechaOriginal || null), '
                'coste_tanda: costeTanda, coste_rac: costeMP, margen_deseado_pct: margenOverrideNum, ...pvpRecord }')
    corte = ours.split('<p className="text-sm text-ink uppercase tracking-wider mb-3"')[0]
    cab = ('            <p className="text-sm text-ink uppercase tracking-wider mb-3" '
           "style={{ fontFamily: OSW, letterSpacing: '1px' }}>Waterfall pricing por canal</p>\n"
           '            <div className="flex flex-wrap gap-2 mb-3">')
    return corte.rstrip('\n') + '\n' + cab
resolve('src/components/escandallo/ModalReceta.tsx', modal)

resolve('src/pages/cocina/CostePlato.tsx', lambda i, o, t: o + '\n' + t)
print('OK resolucion completa')
