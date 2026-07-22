/**
 * TabUnidades.tsx — Tanda C: reescrito para operar sobre las claves JSON de
 * `configuracion` que realmente consumen los modales de Escandallo (useConfig.ts:
 * `unidades`, `unidades_estandar`, `unidades_minimas`, `formatos_compra`). La versión
 * anterior escribía en tablas `config_formatos`/`unidades_relacion` sin migración que las
 * cree y sin ningún consumidor real — CRUD desconectado. Ver docs/HANDOFF_TANDAS_4-6.md.
 */
import EditorListaConfigJson from '@/components/configuracion/EditorListaConfigJson'

export default function TabUnidades() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
      <EditorListaConfigJson clave="unidades" titulo="Unidades (todas)" placeholder="Nueva unidad (ej: Kg.)" />
      <EditorListaConfigJson clave="unidades_estandar" titulo="Unidades estándar" placeholder="Nueva unidad estándar (ej: Kg.)" />
      <EditorListaConfigJson clave="unidades_minimas" titulo="Unidades mínimas" placeholder="Nueva unidad mínima (ej: gr.)" />
      <EditorListaConfigJson clave="formatos_compra" titulo="Formatos de compra" placeholder="Nuevo formato (ej: Caja)" />
    </div>
  )
}
