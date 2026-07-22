import type { ReactNode } from 'react'

interface Props {
  title: string
  onSave: () => Promise<void> | void
  onCancel: () => void
  onDelete?: () => Promise<void> | void
  saving?: boolean
  canSave?: boolean
  children: ReactNode
  width?: number
}

export function EditModal({
  title, onSave, onCancel, onDelete, saving = false, canSave = true, children, width = 480,
}: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl shadow-2xl overflow-hidden"
        style={{ width: `${width}px`, maxWidth: '92vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-config-borde">
          <h2 className="text-[15px] font-bold text-config-text uppercase tracking-[0.12em]">{title}</h2>
        </div>
        <div className="px-6 py-5 space-y-4">{children}</div>
        <div className="px-6 py-4 border-t border-config-borde flex items-center gap-2">
          {onDelete && (
            <button
              onClick={onDelete}
              disabled={saving}
              className="px-4 py-2 text-xs font-medium text-accent-red hover:bg-config-rojo-wash rounded-lg disabled:opacity-50"
            >Eliminar</button>
          )}
          <div className="flex-1" />
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-xs font-medium text-config-mut-alt hover:bg-config-hover rounded-lg disabled:opacity-50"
          >Cancelar</button>
          <button
            onClick={onSave}
            disabled={saving || !canSave}
            className="px-4 py-2 text-xs font-medium bg-accent-red text-white rounded-lg hover:bg-granate-hover disabled:opacity-50"
          >{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] tracking-[0.14em] uppercase text-config-mut mb-1 font-medium">{label}</label>
      {children}
    </div>
  )
}
