import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { CategoriaGasto } from '@/lib/running-calc';
import { CATEGORIAS_ORDEN, NOMBRES_CATEGORIA } from '@/lib/running-calc';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  marcas?: string[];
}

export default function ModalAddGasto({ open, onClose, onSaved, marcas = ['Todas'] }: Props) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [categoria, setCategoria] = useState<CategoriaGasto>('PRODUCTO');
  const [subcategoria, setSubcategoria] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [proveedorAbv, setProveedorAbv] = useState('');
  const [concepto, setConcepto] = useState('');
  const [importe, setImporte] = useState('');
  const [marca, setMarca] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open) return null;

  const guardar = async () => {
    setErrorMsg(null);
    const imp = Number(importe.replace(',', '.'));
    if (!fecha || !categoria || !imp || imp <= 0) {
      setErrorMsg('Fecha, categoría e importe (>0) son obligatorios.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('gastos').insert({
      fecha,
      categoria,
      subcategoria: subcategoria || null,
      proveedor: proveedor || null,
      proveedor_abv: proveedorAbv ? proveedorAbv.toUpperCase().slice(0, 3) : null,
      concepto: concepto || null,
      importe: imp,
      marca: marca || null,
    } as any);
    setSaving(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    onSaved();
    onClose();
    setFecha(new Date().toISOString().slice(0, 10));
    setCategoria('PRODUCTO');
    setSubcategoria('');
    setProveedor('');
    setProveedorAbv('');
    setConcepto('');
    setImporte('');
    setMarca('');
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--rf-text-label)',
    marginBottom: 4,
    fontFamily: 'Oswald, sans-serif',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    fontSize: 13,
    background: 'var(--rf-bg-page)',
    border: '0.5px solid var(--rf-border-input)',
    borderRadius: 6,
    color: 'var(--rf-text-primary)',
    fontFamily: 'Lexend, sans-serif',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--rf-bg-card)',
          border: '0.5px solid var(--rf-border-card)',
          borderRadius: 12,
          padding: 24,
          maxWidth: 520,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div
          className="rf-font-header"
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--rf-red)',
            letterSpacing: '0.1em',
            marginBottom: 20,
            textTransform: 'uppercase',
          }}
        >
          Añadir gasto
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Categoría</label>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaGasto)} style={inputStyle}>
              {CATEGORIAS_ORDEN.map((c) => (
                <option key={c} value={c}>
                  {NOMBRES_CATEGORIA[c]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Subcategoría</label>
          <input type="text" value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)} style={inputStyle} placeholder="Ej: Alimentos y bebidas" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Proveedor</label>
            <input type="text" value={proveedor} onChange={(e) => setProveedor(e.target.value)} style={inputStyle} placeholder="Ej: Mercadona" />
          </div>
          <div>
            <label style={labelStyle}>ABV</label>
            <input
              type="text"
              value={proveedorAbv}
              onChange={(e) => setProveedorAbv(e.target.value.toUpperCase().slice(0, 3))}
              style={{ ...inputStyle, textTransform: 'uppercase' }}
              maxLength={3}
              placeholder="MER"
            />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Concepto</label>
          <input type="text" value={concepto} onChange={(e) => setConcepto(e.target.value)} style={inputStyle} placeholder="Compra semanal" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Importe (€)</label>
            <input
              type="text"
              inputMode="decimal"
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              style={inputStyle}
              placeholder="0,00"
            />
          </div>
          <div>
            <label style={labelStyle}>Marca</label>
            <select value={marca} onChange={(e) => setMarca(e.target.value)} style={inputStyle}>
              <option value="">—</option>
              {marcas.filter((m) => m !== 'Todas').map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {errorMsg && (
          <div
            style={{
              background: 'var(--rf-red-soft)',
              color: 'var(--rf-red)',
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            {errorMsg}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '10px 18px',
              background: 'transparent',
              border: '0.5px solid var(--rf-border-input)',
              borderRadius: 8,
              color: 'var(--rf-text-secondary)',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'Lexend, sans-serif',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={saving}
            style={{
              padding: '10px 18px',
              background: 'var(--rf-red)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'Oswald, sans-serif',
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
