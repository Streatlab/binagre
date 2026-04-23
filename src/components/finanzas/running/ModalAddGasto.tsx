import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CATEGORIAS_ORDEN, CATEGORIA_NOMBRE } from '@/lib/running';
import type { Categoria } from '@/lib/running';

interface Props { open: boolean; onClose: () => void; onSaved: () => void; }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 13,
  background: 'var(--rf-bg-card)',
  border: '1px solid var(--rf-border-input)', borderRadius: 8,
  color: 'var(--rf-text)', fontFamily: 'Lexend, sans-serif',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 500,
  color: 'var(--rf-text-label)', marginBottom: 6,
  fontFamily: 'Oswald, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase',
};

export default function ModalAddGasto({ open, onClose, onSaved }: Props) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0,10));
  const [categoria, setCategoria] = useState<Categoria>('PRODUCTO');
  const [subcategoria, setSubcategoria] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [concepto, setConcepto] = useState('');
  const [importe, setImporte] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const guardar = async () => {
    setErr(null);
    const imp = Number(importe.replace(',', '.'));
    if (!fecha || !categoria || !imp || imp <= 0) { setErr('Fecha, categoría e importe (>0) son obligatorios.'); return; }
    setSaving(true);
    const { error } = await supabase.from('gastos').insert({
      fecha, categoria, subcategoria: subcategoria || null,
      proveedor: proveedor || null, concepto: concepto || null, importe: imp, marca: null,
    } as any);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved(); onClose();
    setFecha(new Date().toISOString().slice(0,10));
    setCategoria('PRODUCTO'); setSubcategoria(''); setProveedor(''); setConcepto(''); setImporte('');
  };

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16,
    }} onClick={onClose}>
      <div onClick={(e)=>e.stopPropagation()} style={{
        background: 'var(--rf-bg-card)', border: '1px solid var(--rf-border)',
        borderRadius: 16, padding: 28, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{
          fontFamily:'Oswald, sans-serif', fontSize: 20, fontWeight: 700,
          color:'var(--rf-red)', letterSpacing:'0.1em', marginBottom: 24, textTransform:'uppercase',
        }}>Añadir gasto</div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
          <div>
            <label style={labelStyle}>Fecha</label>
            <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={inputStyle}/>
          </div>
          <div>
            <label style={labelStyle}>Categoría</label>
            <select value={categoria} onChange={e=>setCategoria(e.target.value as Categoria)} style={inputStyle}>
              {CATEGORIAS_ORDEN.map(c=> <option key={c} value={c}>{CATEGORIA_NOMBRE[c]}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>Subcategoría</label>
          <input type="text" value={subcategoria} onChange={e=>setSubcategoria(e.target.value)} style={inputStyle} placeholder="Ej: ALIMENTOS"/>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>Proveedor</label>
          <input type="text" value={proveedor} onChange={e=>setProveedor(e.target.value)} style={inputStyle} placeholder="Ej: Mercadona"/>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>Concepto</label>
          <input type="text" value={concepto} onChange={e=>setConcepto(e.target.value)} style={inputStyle} placeholder="Detalle del gasto"/>
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={labelStyle}>Importe (€)</label>
          <input type="text" inputMode="decimal" value={importe} onChange={e=>setImporte(e.target.value)} style={inputStyle} placeholder="0,00"/>
        </div>

        {err && (
          <div style={{ background:'var(--rf-red-soft)', color:'var(--rf-red)', padding:'8px 12px', borderRadius:6, fontSize:12, marginBottom:14 }}>
            {err}
          </div>
        )}

        <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} disabled={saving} style={{
            padding:'10px 20px', background:'transparent', border:'1px solid var(--rf-border-input)',
            borderRadius:8, color:'var(--rf-text-2)', fontSize:13, cursor:'pointer', fontFamily:'Lexend, sans-serif',
          }}>Cancelar</button>
          <button onClick={guardar} disabled={saving} style={{
            padding:'10px 24px', background:'var(--rf-red)', border:'none', borderRadius:8,
            color:'#fff', fontSize:12, cursor:'pointer', fontFamily:'Oswald, sans-serif',
            fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase',
          }}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
