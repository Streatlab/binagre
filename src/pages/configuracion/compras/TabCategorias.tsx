/**
 * TabCategorias.tsx — Tanda C: el bloque "Categorías de recetas" escribía en una tabla
 * `categorias_recetas` sin migración que la cree y sin ningún consumidor real (ModalReceta/
 * RecetasFichasTecnicas leen la clave JSON `categorias_recetas` de `configuracion`, no una
 * tabla). Reescrito para escribir en esa misma clave — fuente única, sin UI desconectada.
 * Se añaden también las de EPS (`categorias_eps`, que lee ModalEPS) y el genérico legacy
 * (`categorias`, que lee ModalMerma). Categorías de ingredientes: sin cambios, sigue siendo
 * `EditorCategoriasIngredientes` sobre la tabla dedicada `categorias_ingredientes`.
 */
import EditorCategoriasIngredientes from '@/components/escandallo/EditorCategoriasIngredientes'
import EditorListaConfigJson from '@/components/configuracion/EditorListaConfigJson'
import { PantallaCantera, HeroCantera } from '@/components/kit/cantera'

export default function TabCategorias() {
  return (
    <PantallaCantera embedded>
      <HeroCantera
        area="equipo"
        titular="Así tienes organizadas tus categorías"
        resumen="Ingredientes, recetas, EPS y mermas: cada una con su propia lista de categorías."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <EditorCategoriasIngredientes />
        <EditorListaConfigJson clave="categorias_recetas" titulo="Categorías de recetas" placeholder="Nueva categoría de receta..." />
        <EditorListaConfigJson clave="categorias_eps" titulo="Categorías de EPS" placeholder="Nueva categoría de EPS..." />
        <EditorListaConfigJson clave="categorias" titulo="Categorías (genérico, mermas)" placeholder="Nueva categoría..." />
      </div>
    </PantallaCantera>
  )
}
