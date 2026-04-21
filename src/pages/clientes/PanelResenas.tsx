import { FONT } from '@/styles/tokens'

export default function PanelResenas() {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'60vh',gap:16,padding:'2rem'}}>
      <span style={{fontSize:48}}>🚧</span>
      <h2 style={{fontFamily:FONT.title,fontSize:28,color: 'var(--sl-text-primary)',letterSpacing:'0.04em',textAlign:'center'}}>PANEL RESEÑAS</h2>
      <p style={{fontFamily:'Lexend,sans-serif',fontSize:14,color: 'var(--sl-text-muted)'}}>Próximamente</p>
    </div>
  )
}