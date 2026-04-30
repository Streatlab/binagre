import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toastStore';
import { fmtNum } from '@/lib/format';

interface Props {
  valor: number;
  tabla: string;
  campo: string;
  filtros?: Record<string, unknown>;
  decimales?: number;
  unidad?: '€' | '%' | '';
  color?: string;
  onUpdate?: () => void;
}

export const EditableInline: React.FC<Props> = ({
  valor, tabla, campo, filtros = {}, decimales = 2, unidad = '', color = '#3a4050', onUpdate
}) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState<string>(String(valor ?? ''));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(String(valor ?? '')); }, [valor]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const guardar = async () => {
    const trimmed = val.trim();
    if (trimmed === '') {
      const { error } = await supabase.from(tabla).update({ [campo]: null }).match(filtros);
      if (error) { toast.error('Error al restaurar'); return; }
      toast.success('Objetivo restaurado al valor base');
      setEditing(false);
      onUpdate?.();
      return;
    }
    const num = parseFloat(trimmed.replace(',', '.'));
    if (isNaN(num)) { setEditing(false); return; }
    const { error } = await supabase.from(tabla).update({ [campo]: num }).match(filtros);
    if (error) { toast.error('Error al guardar'); return; }
    toast.success('Objetivo actualizado');
    setEditing(false);
    onUpdate?.();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') guardar();
    if (e.key === 'Escape') { setVal(String(valor ?? '')); setEditing(false); }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={val}
        step="any"
        onChange={(e) => setVal(e.target.value)}
        onBlur={guardar}
        onKeyDown={onKey}
        style={{
          width: 80, padding: '0 4px', border: '1px solid #FF4757',
          borderRadius: 3, fontFamily: 'inherit', fontSize: 'inherit',
          color, background: '#fff'
        }}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      style={{
        borderBottom: '1px dashed #d0c8bc',
        cursor: 'text',
        color,
        padding: '0 2px',
      }}
    >
      {valor !== null && valor !== undefined
        ? fmtNum(valor, decimales)
        : '—'}{unidad === '%' ? `${unidad}` : unidad ? ` ${unidad}` : ''}
    </span>
  );
};

export default EditableInline;
